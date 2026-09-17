import * as THREE from 'three'
import { HALL, DOCK, TRAILER, RACK, SHELF, MODULES, AREAS, rowV, aisleV, bayU, toWorld, type Facility, type Dock } from '../facility'
import { YARD } from '../layout'
import { Tex } from '../assets'
import { boxAt, cylAt, merged, setInstance, canvasTexture, mergeAny } from './util'
import { TextLabels } from './text'
import type { Mats } from './mats'
import { rng } from '../rng'

const X0 = HALL.x0, X1 = -HALL.x0, Z0 = HALL.z0, Z1 = -HALL.z0
const ZONE_COLOR: Record<string, number> = { inbound: 0x2f7fd6, storage: 0xe08a1e, outbound: 0x2e9e5b, returns: 0xa64ad1, support: 0x9aa3ad, yard: 0x8f7a3a, circulation: 0x9aa3ad }

/** The building shell, yard, services, floor markings and every dock door, all generated from the layout. */
export class Building {
  group = new THREE.Group()
  roof = new THREE.Group()
  text = new TextLabels(512)
  dockVolumes!: THREE.InstancedMesh
  zoneVolumes!: THREE.InstancedMesh
  colliders: THREE.Box3[] = []
  private doorPanels!: THREE.InstancedMesh
  private doorOverheads!: THREE.InstancedMesh
  private animatingDoors = new Set<Dock>()

  constructor(private f: Facility, private M: Mats) {
    this.buildFloor()
    this.buildShell()
    this.buildRoofStructure()
    this.buildLighting()
    this.buildServices()
    this.buildMarkings()
    this.buildDocks()
    this.buildTrailers()
    this.buildZones()
    this.text.commit()
    this.group.add(this.text.mesh, this.roof)
  }

  private buildFloor() {
    const M = this.M
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.d), new THREE.MeshStandardMaterial({ ...Tex.concrete([HALL.w / 4, HALL.d / 4]), color: 0x6f7479, roughness: 1, metalness: 0.02, normalScale: new THREE.Vector2(0.5, 0.5) }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.group.add(floor)
    // Saw-cut control joints on a 15' (4.57 m) grid.
    const joints = canvasTexture(512, 512, ctx => {
      ctx.clearRect(0, 0, 512, 512); ctx.fillStyle = 'rgba(20,20,20,0.55)'
      ctx.fillRect(0, 0, 512, 3); ctx.fillRect(0, 0, 3, 512)
    }, { repeat: [HALL.w / 4.57, HALL.d / 4.57] })
    const jm = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.d), new THREE.MeshStandardMaterial({ map: joints, transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, depthWrite: false }))
    jm.rotation.x = -Math.PI / 2; jm.position.y = 0.002
    this.group.add(jm)
    // Yard aprons outside both dock walls, 48" below the finished floor, with the dock face walls and trailer stripes.
    const stripes: THREE.BufferGeometry[] = [], faces: THREE.BufferGeometry[] = []
    for (const dir of [-1, 1]) {
      const zWall = dir > 0 ? Z1 : Z0
      const yard = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w + 40, YARD.apron), M.asphalt)
      yard.rotation.x = -Math.PI / 2; yard.position.set(0, -DOCK.dockHeight, zWall + dir * YARD.apron / 2)
      yard.receiveShadow = true
      this.group.add(yard)
      faces.push(boxAt(HALL.w, DOCK.dockHeight, 0.3, 0, -DOCK.dockHeight / 2, zWall + dir * 0.15))
      for (const d of this.f.docks) if (d.wall === (dir > 0 ? 'S' : 'N')) for (const dx of [-1.6, 1.6]) stripes.push(boxAt(0.1, 0.01, 18, d.center[0] + dx, -DOCK.dockHeight + 0.005, zWall + dir * 9.5))
    }
    this.group.add(merged(faces, M.concreteBare), merged(stripes, M.paintWhite, false))
  }

  private buildShell() {
    const M = this.M
    const H = HALL.roofY
    // Insulated metal panel walls with 36" vertical ribs.
    const rib = canvasTexture(128, 128, ctx => {
      ctx.fillStyle = '#d2d5d7'; ctx.fillRect(0, 0, 128, 128)
      ctx.fillStyle = '#c3c6c9'; ctx.fillRect(0, 0, 6, 128); ctx.fillRect(122, 0, 6, 128)
      ctx.fillStyle = '#dcdfe1'; ctx.fillRect(6, 0, 3, 128)
    }, { repeat: [HALL.w / 0.914, 1] })
    const wallMat = new THREE.MeshStandardMaterial({ map: rib, color: 0x9ca1a6, roughness: 0.55, metalness: 0.25 })
    const walls: THREE.BufferGeometry[] = [], band: THREE.BufferGeometry[] = []
    // West and east walls are solid.
    for (const s of [-1, 1]) {
      walls.push(boxAt(0.3, H, HALL.d + 0.6, s * (HALL.w / 2 + 0.15), H / 2, 0))
      band.push(boxAt(0.02, 1.2, HALL.d, s * (HALL.w / 2 - 0.02), 0.6, 0))
      this.colliders.push(new THREE.Box3(new THREE.Vector3(s * HALL.w / 2 - (s < 0 ? 1 : 0), -1, -HALL.d), new THREE.Vector3(s * HALL.w / 2 + (s > 0 ? 1 : 0), H, HALL.d)))
    }
    // Dock walls: panel segments between door openings, headers above them.
    for (const wall of ['N', 'S'] as const) {
      const dir = wall === 'S' ? 1 : -1, zW = wall === 'S' ? Z1 : Z0
      const xs = this.f.docks.filter(d => d.wall === wall).map(d => d.center[0]).sort((a, b) => a - b)
      let x = X0
      for (const dx of [...xs, null]) {
        const end = dx === null ? X1 : dx - DOCK.doorW / 2
        if (end > x) { walls.push(boxAt(end - x, H, 0.3, (x + end) / 2, H / 2, zW + dir * 0.15)); band.push(boxAt(end - x, 1.2, 0.02, (x + end) / 2, 0.6, zW - dir * 0.02)) }
        if (dx !== null) { walls.push(boxAt(DOCK.doorW, H - DOCK.doorH, 0.3, dx, DOCK.doorH + (H - DOCK.doorH) / 2, zW + dir * 0.15)); x = dx + DOCK.doorW / 2 }
      }
      this.colliders.push(new THREE.Box3(new THREE.Vector3(-HALL.w, -1, zW - (dir < 0 ? 1 : 0)), new THREE.Vector3(HALL.w, H, zW + (dir > 0 ? 1 : 0))))
    }
    this.group.add(merged(walls, wallMat), merged(band, M.steelDark, false))

    // W10 steel columns on the 50 ft grid, base plates, and yellow guards on interior columns.
    const cols: THREE.BufferGeometry[] = [], plates: THREE.BufferGeometry[] = [], guards: THREE.BufferGeometry[] = []
    const nx = Math.round(HALL.w / HALL.grid), nz = Math.round(HALL.d / HALL.grid)
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const edge = i === 0 || i === nx || j === 0 || j === nz
      const x = i === 0 ? X0 + 0.2 : i === nx ? X1 - 0.2 : X0 + i * HALL.grid
      const z = j === 0 ? Z0 + 0.2 : j === nz ? Z1 - 0.2 : Z0 + j * HALL.grid
      cols.push(boxAt(0.254, H, 0.254, x, H / 2, z))
      plates.push(boxAt(0.4, 0.03, 0.4, x, 0.015, z))
      if (!edge) {
        guards.push(boxAt(0.42, 0.6, 0.42, x, 0.3, z))
        this.colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.25, 0, z - 0.25), new THREE.Vector3(x + 0.25, 3, z + 0.25)))
      }
    }
    this.group.add(merged(cols, M.steelPainted), merged(plates, M.steelDark), merged(guards, M.safetyYellow))
  }

  private buildRoofStructure() {
    const M = this.M
    const H = HALL.clearH
    // Joist girders on the column lines (1.0 m deep) and 24K bar joists at 6' (1.83 m) spanning between them.
    const chords: THREE.BufferGeometry[] = []
    const girderDepth = 1.0, joistDepth = 0.6
    const nz = Math.round(HALL.d / HALL.grid)
    const girderZ: number[] = []
    for (let j = 0; j <= nz; j++) girderZ.push(j === 0 ? Z0 + 0.2 : j === nz ? Z1 - 0.2 : Z0 + j * HALL.grid)
    for (const z of girderZ) chords.push(boxAt(HALL.w, 0.12, 0.2, 0, H + girderDepth, z), boxAt(HALL.w, 0.12, 0.2, 0, H, z))
    const nJ = Math.floor(HALL.w / 1.83)
    const joistXs: number[] = []
    for (let i = 0; i <= nJ; i++) joistXs.push(X0 + i * 1.83 + 0.3)
    for (const x of joistXs) chords.push(boxAt(0.08, 0.06, HALL.d, x, H + joistDepth, 0), boxAt(0.08, 0.06, HALL.d, x, H + 0.03, 0))
    this.roof.add(merged(chords, M.steelPainted, false))
    // Zig-zag web members.
    const step = 0.6
    const nWebPerJoist = Math.floor(HALL.d / step)
    const nWebGirder = Math.floor(HALL.w / 1.2)
    const webs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 1, 0.03), M.steelPainted, joistXs.length * nWebPerJoist + girderZ.length * nWebGirder)
    let i = 0
    const webLen = Math.hypot(step, joistDepth), webAng = Math.atan2(step, joistDepth)
    for (const x of joistXs) for (let k = 0; k < nWebPerJoist; k++) setInstance(webs, i++, x, H + joistDepth / 2, Z0 + (k + 0.5) * step, 1, webLen, 1, (k % 2 ? 1 : -1) * webAng, 0, 0)
    const gLen = Math.hypot(1.2, girderDepth), gAng = Math.atan2(1.2, girderDepth)
    for (const z of girderZ) for (let k = 0; k < nWebGirder; k++) setInstance(webs, i++, X0 + (k + 0.5) * 1.2, H + girderDepth / 2, z, 1, gLen, 1, 0, 0, (k % 2 ? 1 : -1) * gAng)
    webs.count = i
    this.roof.add(webs)
    // Painted metal roof deck seen from below (hidden in plan view).
    const deckTex = canvasTexture(64, 64, ctx => {
      ctx.fillStyle = '#e6e8ea'; ctx.fillRect(0, 0, 64, 64)
      ctx.fillStyle = '#d5d8db'; ctx.fillRect(0, 0, 64, 10)
      ctx.fillStyle = '#eef0f1'; ctx.fillRect(0, 10, 64, 4)
    }, { repeat: [HALL.w / 0.15, 1] })
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.d), new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.8, metalness: 0.15, side: THREE.BackSide }))
    deck.rotation.x = -Math.PI / 2; deck.position.y = HALL.roofY + 0.7
    this.roof.add(deck)
  }

  private buildLighting() {
    const M = this.M
    // 4' linear LED high-bays (1.22 x 0.32 x 0.09 m) chain-hung 0.5 m below the joists, on a 6.1 x 7.6 m grid.
    const xs: number[] = [], zs: number[] = []
    for (let x = X0 + 3.05; x < X1; x += 6.1) xs.push(x)
    for (let z = Z0 + 3.8; z < Z1; z += 7.6) zs.push(z)
    const n = xs.length * zs.length
    const housing = new THREE.InstancedMesh(new THREE.BoxGeometry(1.22, 0.09, 0.32), M.fixtureHousing, n)
    const lens = new THREE.InstancedMesh(new THREE.BoxGeometry(1.16, 0.02, 0.26), M.fixtureLens, n)
    const chain = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 5), M.steelDark, n * 2)
    const y = HALL.clearH - 0.5
    let i = 0
    for (const x of xs) for (const z of zs) {
      setInstance(housing, i, x, y, z)
      setInstance(lens, i, x, y - 0.05, z)
      setInstance(chain, i * 2, x - 0.5, y + 0.3, z)
      setInstance(chain, i * 2 + 1, x + 0.5, y + 0.3, z)
      i++
    }
    this.roof.add(housing, lens, chain)
  }

  private buildServices() {
    const M = this.M
    // Wet-pipe sprinklers: 4" cross mains on every other column line, 1 1/4" branch lines every 12', pendent heads every 10'.
    const red: THREE.BufferGeometry[] = []
    const yMain = HALL.clearH - 0.25
    for (let j = 1; j < Math.round(HALL.d / HALL.grid); j += 2) red.push(cylAt(0.05, HALL.w, 0, yMain, Z0 + j * HALL.grid, 'x', 10))
    const heads: THREE.BufferGeometry[] = []
    for (let x = X0 + 1.83; x < X1; x += 3.66) {
      red.push(cylAt(0.018, HALL.d - 0.6, x, yMain - 0.12, 0, 'z', 6))
      for (let z = Z0 + 1.5; z < Z1; z += 3.05) heads.push(cylAt(0.012, 0.08, x, yMain - 0.18, z, 'y', 5), cylAt(0.03, 0.01, x, yMain - 0.23, z, 'y', 6))
    }
    this.roof.add(merged(red, M.sprinklerRed, false), merged(heads, M.galvanised, false))
    // 12" ladder cable tray along both dock walls at 4.5 m with a conduit drop to every door operator.
    const tray: THREE.BufferGeometry[] = []
    const yT = 4.5
    for (const wall of ['N', 'S'] as const) {
      const dir = wall === 'S' ? 1 : -1, zT = (wall === 'S' ? Z1 : Z0) - dir * 0.45
      tray.push(boxAt(HALL.w - 1, 0.1, 0.03, 0, yT, zT - 0.15), boxAt(HALL.w - 1, 0.1, 0.03, 0, yT, zT + 0.15))
      for (let x = X0 + 0.5; x < X1 - 0.5; x += 0.3) tray.push(boxAt(0.03, 0.02, 0.3, x, yT - 0.04, zT))
      for (const d of this.f.docks) if (d.wall === wall) tray.push(cylAt(0.013, yT - DOCK.doorH - 0.5, d.center[0] + DOCK.doorW / 2 + 0.35, DOCK.doorH + 0.25 + (yT - DOCK.doorH - 0.5) / 2, zT, 'y', 6))
    }
    this.group.add(merged(tray, M.galvanised, false))
  }

  private buildMarkings() {
    const M = this.M
    const yellow: THREE.BufferGeometry[] = [], green: THREE.BufferGeometry[] = [], white: THREE.BufferGeometry[] = []
    const y = 0.004
    // Storage modules: 4" yellow lines 150 mm in front of every rack and shelf face, aisle numbers at both ends.
    for (const m of MODULES) {
      const depth = m.kind === 'rack' ? RACK.frameDepth + RACK.flue / 2 : SHELF.unitD
      const aisle = m.kind === 'rack' ? RACK.aisle : SHELF.aisle
      const pitch = m.kind === 'rack' ? RACK.bayPitch : SHELF.unitW
      const u0 = bayU(m, 0), u1 = bayU(m, m.baysPerRow - 1) + pitch
      for (let r = 0; r < m.rows; r++) for (const s of [-1, 1]) {
        const v = rowV(m, r) + s * (depth + 0.15)
        const a = toWorld(m, u0, y, v), b = toWorld(m, u1, y, v)
        yellow.push(boxAt(0.1, 0.001, Math.abs(b[2] - a[2]), a[0], y, (a[2] + b[2]) / 2))
      }
      for (let a = 1; a <= m.rows + 1; a++) {
        const x = m.x + aisleV(m, a)
        const label = m.kind === 'rack' ? `AISLE ${String(a).padStart(2, '0')}` : `PICK ${String(a).padStart(2, '0')}`
        const h = Math.min(0.6, aisle * 0.16)
        this.text.add(label, h, x, y + 0.002, m.z + m.d + 1.2, { flat: true })
        this.text.add(label, h, x, y + 0.002, m.z - 1.2, { flat: true, yaw: Math.PI })
      }
    }
    // Zones: 4" yellow boundary and a painted name. Circulation areas are green pedestrian walkways with white edges.
    for (const a of AREAS) {
      if (a.level) continue
      if (a.group === 'circulation') {
        const along = a.w >= a.d
        const cx = a.x + a.w / 2, cz = a.z + a.d / 2
        green.push(along ? boxAt(a.w, 0.001, 1.2, cx, y, cz) : boxAt(1.2, 0.001, a.d, cx, y, cz))
        for (const s of [-1, 1]) white.push(along ? boxAt(a.w, 0.001, 0.1, cx, y + 0.001, cz + s * 0.65) : boxAt(0.1, 0.001, a.d, cx + s * 0.65, y + 0.001, cz))
        continue
      }
      const x0 = a.x + 0.1, x1 = a.x + a.w - 0.1, z0 = a.z + 0.1, z1 = a.z + a.d - 0.1
      yellow.push(boxAt(x1 - x0, 0.001, 0.1, (x0 + x1) / 2, y, z0), boxAt(x1 - x0, 0.001, 0.1, (x0 + x1) / 2, y, z1), boxAt(0.1, 0.001, z1 - z0, x0, y, (z0 + z1) / 2), boxAt(0.1, 0.001, z1 - z0, x1, y, (z0 + z1) / 2))
      const h = Math.max(0.6, Math.min(2.2, Math.min(a.w, a.d) * 0.12, a.w / (a.name.length * 0.7)))
      this.text.add(a.name.toUpperCase(), h, a.x + a.w / 2, y + 0.002, a.z + 1.2 + h / 2, { flat: true })
    }
    // Dock approaches: hazard hatching and yellow lane lines at every door.
    const hatch = canvasTexture(128, 128, ctx => {
      ctx.fillStyle = '#e9b400'; ctx.fillRect(0, 0, 128, 128)
      ctx.fillStyle = '#151515'
      for (let i = -128; i < 256; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 16, 0); ctx.lineTo(i + 144, 128); ctx.lineTo(i + 128, 128); ctx.fill() }
    }, { repeat: [1.5, 1] })
    const hz = new THREE.InstancedMesh(new THREE.PlaneGeometry(DOCK.doorW + 1.2, 0.6), new THREE.MeshStandardMaterial({ map: hatch, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }), this.f.docks.length)
    this.f.docks.forEach((d, i) => {
      const dir = d.wall === 'S' ? 1 : -1, zW = d.center[2]
      setInstance(hz, i, d.center[0], y, zW - dir * (DOCK.levelerL + 0.4), 1, 1, 1, -Math.PI / 2, 0, 0)
      for (const s of [-1, 1]) yellow.push(boxAt(0.1, 0.001, 6, d.center[0] + s * 2.2, y, zW - dir * 3.5))
    })
    this.group.add(hz)
    for (const [geos, mat] of [[yellow, M.paintYellow], [green, M.paintGreen], [white, M.paintWhite]] as const) {
      const m = new THREE.Mesh(mergeAny(geos), mat); m.receiveShadow = true; this.group.add(m)
    }
  }

  private buildDocks() {
    const M = this.M
    const { doorW, doorH } = DOCK
    const docks = this.f.docks
    // Sectional door: four 30" panels with a vision window in panel 3. The panel scales down as it rolls up on the track.
    const panelTex = canvasTexture(256, 512, ctx => {
      ctx.fillStyle = '#eef0f1'; ctx.fillRect(0, 0, 256, 512)
      for (let i = 1; i < 4; i++) { ctx.fillStyle = '#bfc3c6'; ctx.fillRect(0, i * 128 - 2, 256, 4) }
      ctx.fillStyle = '#d9dcde'
      for (let i = 0; i < 4; i++) { ctx.fillRect(12, i * 128 + 14, 232, 100) }
      ctx.fillStyle = '#e6e8e9'
      for (let i = 0; i < 4; i++) { ctx.fillRect(20, i * 128 + 22, 216, 84) }
    })
    const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.45, metalness: 0.3 })
    const doorGeo = new THREE.BoxGeometry(doorW, doorH, 0.045)
    doorGeo.translate(0, -doorH / 2, 0) // origin at the top so it rolls up in place
    this.doorPanels = new THREE.InstancedMesh(doorGeo, panelMat, docks.length)
    this.doorPanels.castShadow = true
    const ovGeo = new THREE.BoxGeometry(doorW, 0.045, doorH)
    ovGeo.translate(0, 0, -doorH / 2) // the raised sections lie on the ceiling track just inside the wall
    this.doorOverheads = new THREE.InstancedMesh(ovGeo, panelMat, docks.length)
    const lampHeads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0xffe9c4, emissive: 0xffd9a0, emissiveIntensity: 3 }), docks.length)
    this.dockVolumes = new THREE.InstancedMesh(new THREE.BoxGeometry(doorW + 0.6, doorH + 0.4, 1.4), M.hit, docks.length)
    this.dockVolumes.userData.resolve = (id: number) => docks[id]
    const steel: THREE.BufferGeometry[] = [], levelers: THREE.BufferGeometry[] = [], rubber: THREE.BufferGeometry[] = [], seals: THREE.BufferGeometry[] = [], restraints: THREE.BufferGeometry[] = [], plates: THREE.BufferGeometry[] = []
    // Hardware is modelled in a local frame with the wall at z = 0 and the yard toward +z, then turned for the north wall.
    const place = (parts: THREE.BufferGeometry[], d: Dock) => parts.map(g => { if (d.wall === 'N') g.rotateY(Math.PI); g.translate(d.center[0], 0, d.center[2]); return g })
    docks.forEach((d, i) => {
      const dir = d.wall === 'S' ? 1 : -1, ry = d.wall === 'S' ? 0 : Math.PI
      const x = d.center[0], zW = d.center[2]
      this.placeDoor(d, i)
      setInstance(lampHeads, i, x + dir * (doorW / 2 + 0.6), doorH - 0.4, zW - dir * 1.25, 1, 1, 1, Math.PI / 2, 0, 0)
      setInstance(this.dockVolumes, i, x, doorH / 2, zW)
      const s: THREE.BufferGeometry[] = []
      for (const k of [-1, 1]) {
        s.push(boxAt(0.05, doorH + 0.3, 0.06, k * (doorW / 2 + 0.06), (doorH + 0.3) / 2, -0.12))
        s.push(boxAt(0.05, 0.06, doorH + 0.4, k * (doorW / 2 + 0.06), doorH + 0.35, -0.25 - doorH / 2))
        s.push(boxAt(0.08, doorH + 0.5, 0.08, k * (doorW / 2 + 0.14), (doorH + 0.5) / 2, -0.04))
      }
      s.push(boxAt(doorW + 0.5, 0.12, 0.12, 0, doorH + 0.1, -0.06))
      s.push(cylAt(0.02, 1.2, doorW / 2 + 0.6, doorH - 0.4, -0.6, 'z', 6))            // dock light arm
      s.push(boxAt(0.25, 0.25, 0.4, doorW / 2 + 0.35, doorH + 0.5, -1.2))            // door operator
      steel.push(...place(s, d))
      levelers.push(...place([boxAt(DOCK.levelerW, 0.02, DOCK.levelerL, 0, 0.01, -DOCK.levelerL / 2 - 0.15), boxAt(DOCK.levelerW, 0.02, 0.45, 0, 0.0, 0.15)], d))
      rubber.push(...place([-1, 1].map(k => boxAt(DOCK.bumperW, DOCK.bumperH, DOCK.bumperD, k * (doorW / 2 + 0.05), -0.05, 0.3 + DOCK.bumperD / 2)), d))
      seals.push(...place([...[-1, 1].map(k => boxAt(0.3, doorH + 0.4, 0.45, k * (doorW / 2 + 0.35), (doorH + 0.4) / 2, 0.3 + 0.225)), boxAt(doorW + 1.0, 0.35, 0.45, 0, doorH + 0.45, 0.3 + 0.225)], d))
      restraints.push(...place([boxAt(0.45, 0.5, 0.5, 0, -DOCK.dockHeight + 0.25, 0.6)], d))
      // Door number on a plate inside and outside.
      for (const [dz, yaw] of [[-0.17, Math.PI], [0.32, 0]] as const) {
        plates.push(...place([boxAt(1.1, 0.5, 0.01, 0, doorH + 0.9, dz)], d))
        this.text.add(d.id, 0.32, x, doorH + 0.9, zW + dir * (dz + (dz < 0 ? -0.006 : 0.006)), { yaw: yaw + ry, color: 0x111111 })
      }
    })
    this.group.add(this.doorPanels, this.doorOverheads, lampHeads, this.dockVolumes)
    this.group.add(merged(steel, M.steelDark), merged(levelers, new THREE.MeshStandardMaterial({ color: 0x6f7377, roughness: 0.5, metalness: 0.8 })), merged(rubber, M.rubber), merged(seals, M.dockSeal), merged(restraints, M.safetyYellow), merged(plates, new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6 }), false))
    this.doorPanels.instanceMatrix.needsUpdate = true
    this.doorOverheads.instanceMatrix.needsUpdate = true
  }

  private placeDoor(d: Dock, i: number) {
    const dir = d.wall === 'S' ? 1 : -1, ry = d.wall === 'S' ? 0 : Math.PI
    const closed = 1 - d.doorOpen
    setInstance(this.doorPanels, i, d.center[0], DOCK.doorH, d.center[2] - dir * 0.1, 1, Math.max(0.02, closed), 1, 0, ry, 0)
    setInstance(this.doorOverheads, i, d.center[0], DOCK.doorH + 0.35, d.center[2] - dir * 0.25, 1, 1, Math.max(0.02, d.doorOpen), 0, ry, 0)
  }

  private buildTrailers() {
    const M = this.M
    const { L, W, boxH } = TRAILER
    const side = canvasTexture(64, 64, ctx => {
      ctx.fillStyle = '#d9dbde'; ctx.fillRect(0, 0, 64, 64)
      ctx.fillStyle = '#c4c7ca'; ctx.fillRect(0, 0, 4, 64)
      ctx.fillStyle = '#e4e6e8'; ctx.fillRect(4, 0, 2, 64)
    }, { repeat: [L / 0.3, 1] })
    const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.35, metalness: 0.7 })
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.9 })
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf4f5f4, roughness: 0.6 })
    const cardboard = new THREE.MeshStandardMaterial({ ...Tex.cardboard(), roughness: 1 })
    const buckets: [THREE.Material, THREE.BufferGeometry[]][] = [[sideMat, []], [floorMat, []], [roofMat, []], [M.wood, []], [cardboard, []], [M.trailerFrame, []], [M.tyre, []], [M.galvanised, []]]
    const [shellB, floorB, roofB, palletB, cargoB, frameB, wheelB, hubB] = buckets.map(b => b[1])
    for (const d of this.f.docks) {
      if (!d.trailerId) continue
      const dir = d.wall === 'S' ? 1 : -1
      // Local frame: rear of the trailer at z = 0 against the bumpers, box extending toward +z; the whole
      // trailer sits with its floor level with the dock.
      const zRear = 0.3 + DOCK.bumperD, zc = zRear + L / 2
      const parts: [THREE.BufferGeometry[], THREE.BufferGeometry[]][] = []
      const shell: THREE.BufferGeometry[] = []
      for (const s of [-1, 1]) shell.push(boxAt(0.03, boxH, L, s * (W / 2 - 0.015), boxH / 2 + 0.05, zc))
      shell.push(boxAt(W, boxH, 0.03, 0, boxH / 2 + 0.05, zRear + L - 0.015))
      for (const s of [-1, 1]) shell.push(boxAt(0.04, boxH - 0.1, 1.25, s * (W / 2 + 0.02), boxH / 2 + 0.05, zRear + 0.66))
      parts.push([shell, shellB])
      parts.push([[boxAt(W - 0.06, 0.05, L, 0, 0.025, zc)], floorB])
      parts.push([[boxAt(W + 0.02, 0.03, L + 0.02, 0, boxH + 0.05, zc)], roofB])
      // Cargo: pallets of cases from the nose back to the unload line for inbound, from the rear forward for outbound.
      const cargo: THREE.BufferGeometry[] = [], cargoPallets: THREE.BufferGeometry[] = []
      const remaining = d.state === 'UNLOADING' ? 1 - d.progress : d.progress
      const lineZ = d.state === 'UNLOADING' ? zRear + L * (1 - remaining) : zRear + L * remaining
      for (let z = zRear + 0.7; z < zRear + L - 0.6; z += 1.28) {
        const loaded = d.state === 'UNLOADING' ? z > lineZ : z < lineZ
        if (!loaded) continue
        for (const s of [-1, 1]) {
          const px = s * 0.6
          cargoPallets.push(boxAt(1.0, 0.14, 1.2, px, 0.12, z))
          const layers = 3 + Math.floor(rng() * 2)
          for (let l = 0; l < layers; l++) for (const dx of [-0.25, 0.25]) for (const dz of [-0.3, 0.3]) cargo.push(boxAt(0.48, 0.33, 0.58, px + dx, 0.19 + 0.165 + l * 0.33, z + dz))
        }
      }
      parts.push([cargoPallets, palletB], [cargo, cargoB])
      // Rear frame, underframe, tandem axles, landing gear, mud flaps.
      const frame: THREE.BufferGeometry[] = []
      frame.push(boxAt(W + 0.04, 0.12, 0.08, 0, 0.05, zRear + 0.04))
      for (const s of [-1, 1]) frame.push(boxAt(0.06, boxH, 0.1, s * (W / 2 - 0.02), boxH / 2, zRear + 0.05))
      frame.push(boxAt(W, 0.08, 0.1, 0, boxH + 0.02, zRear + 0.05))
      frame.push(boxAt(W - 0.2, 0.25, L - 0.5, 0, -0.15, zc))
      for (const dz of [1.4, 2.7]) frame.push(cylAt(0.05, W - 0.3, 0, -0.5, zRear + dz, 'x', 8))
      for (const s of [-1, 1]) frame.push(boxAt(0.08, 0.7, 0.08, s * 0.9, -0.55, zRear + L - 3.0), boxAt(0.3, 0.05, 0.25, s * 0.9, -0.9, zRear + L - 3.0))
      for (const s of [-1, 1]) frame.push(boxAt(0.6, 0.5, 0.02, s * 0.85, -0.85, zRear + 0.9))
      parts.push([frame, frameB])
      const wheels: THREE.BufferGeometry[] = [], hubs: THREE.BufferGeometry[] = []
      for (const dz of [1.4, 2.7]) for (const s of [-1, 1]) {
        for (const dx of [0.55, 0.85]) wheels.push(cylAt(0.5, 0.28, s * dx, -0.5, zRear + dz, 'x', 18))
        hubs.push(cylAt(0.28, 0.02, s * 1.0, -0.5, zRear + dz, 'x', 14))
      }
      parts.push([wheels, wheelB], [hubs, hubB])
      const yBase = -DOCK.dockHeight + TRAILER.floorY
      for (const [geos, bucket] of parts) for (const g of geos) {
        if (dir < 0) g.rotateY(Math.PI)
        g.translate(d.center[0], yBase, d.center[2])
        bucket.push(g)
      }
      const zA = d.center[2] + dir * zRear, zB = d.center[2] + dir * (zRear + L)
      this.colliders.push(new THREE.Box3(new THREE.Vector3(d.center[0] - W / 2, -2, Math.min(zA, zB)), new THREE.Vector3(d.center[0] + W / 2, 4, Math.max(zA, zB))))
    }
    for (const [mat, geos] of buckets) if (geos.length) this.group.add(merged(geos, mat, mat !== cardboard))
  }

  /** Flat hit volumes on the floor so any zone can be clicked in the plan; mezzanine zones float at their level. */
  private buildZones() {
    const zones = this.f.zones
    this.zoneVolumes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.M.hit, zones.length)
    zones.forEach((z, i) => setInstance(this.zoneVolumes, i, z.center[0], z.center[1], z.center[2], z.size[0], z.size[1], z.size[2]))
    this.zoneVolumes.userData.resolve = (id: number) => zones[id]
    this.group.add(this.zoneVolumes)
    // Mezzanine outline: a hatched slab edge at its level so the plan shows it without hiding what is below.
    const mezz = this.f.zones.filter(z => z.level)
    const edges: THREE.BufferGeometry[] = []
    for (const z of mezz) {
      const a = z.area
      edges.push(boxAt(a.w, 0.4, 0.1, a.x + a.w / 2, 4.5, a.z + 0.05), boxAt(a.w, 0.4, 0.1, a.x + a.w / 2, 4.5, a.z + a.d - 0.05), boxAt(0.1, 0.4, a.d, a.x + 0.05, 4.5, a.z + a.d / 2), boxAt(0.1, 0.4, a.d, a.x + a.w - 0.05, 4.5, a.z + a.d / 2))
    }
    if (edges.length) this.group.add(merged(edges, this.M.steelPainted))
  }

  zoneColor(group: string) { return ZONE_COLOR[group] ?? 0x9aa3ad }

  /** Start animating a dock door toward its target. */
  animateDoor(d: Dock) { this.animatingDoors.add(d) }

  update(dt: number) {
    if (!this.animatingDoors.size) return
    for (const d of this.animatingDoors) {
      d.doorOpen += (d.doorTarget - d.doorOpen) * Math.min(1, dt * 1.8)
      if (Math.abs(d.doorTarget - d.doorOpen) < 0.005) { d.doorOpen = d.doorTarget; this.animatingDoors.delete(d) }
      this.placeDoor(d, this.f.docks.indexOf(d))
    }
    this.doorPanels.instanceMatrix.needsUpdate = true
    this.doorOverheads.instanceMatrix.needsUpdate = true
  }
}
