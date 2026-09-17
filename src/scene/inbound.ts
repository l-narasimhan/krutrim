import * as THREE from 'three'
import { PALLET, DOOR, AREAS, type Facility } from '../facility'
import { PUTAWAY_GROUPS } from '../layout'
import { Tex } from '../assets'
import { boxAt, cylAt, merged, setInstance, canvasTexture } from './util'
import { makePalletGeometry } from './racking'
import { makeToteGeometry } from './conveyor'
import { TextLabels } from './text'
import type { Mats } from './mats'
import { rng } from '../rng'

/**
 * The inbound band. Dock staging: a striped lane behind every inbound door with unloaded pallets and a pallet jack.
 * Receive: 16 stations, each a receive desk (monitor, scanner, LPN printer) beside a decant table with cases being
 * broken down, a stack of empty totes and a bale cage for flattened cartons. QC: six inspection benches with scales
 * and sample carts, and painted PASS and FAIL lanes. The hold cage: 8 ft chain-link with a sliding gate, hold shelving
 * and red-tagged pallets inside. Putaway staging: painted pallet positions in three destination groups, staged
 * pallets and tote stacks, and the buffer conveyor east to the fast-mover module.
 */
export class Inbound {
  group = new THREE.Group()
  volumes: THREE.InstancedMesh
  text = new TextLabels(256)
  colliders: THREE.Box3[] = []

  constructor(f: Facility, M: Mats) {
    const steel: THREE.BufferGeometry[] = [], top: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = [], white: THREE.BufferGeometry[] = [], screens: THREE.BufferGeometry[] = [], yellow: THREE.BufferGeometry[] = [], green: THREE.BufferGeometry[] = [], redPaint: THREE.BufferGeometry[] = [], fence: THREE.BufferGeometry[] = [], orange: THREE.BufferGeometry[] = [], redTags: THREE.BufferGeometry[] = []
    const cardboard = new THREE.MeshStandardMaterial({ ...Tex.cardboard(), roughness: 1 })
    const pallets = new THREE.InstancedMesh(makePalletGeometry(), M.wood, 400)
    const loads = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cardboard, 400)
    const film = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.film, 400)
    const cases = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cardboard, 400)
    const totes = new THREE.InstancedMesh(makeToteGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), 600)
    const tint = new THREE.Color()
    let pi = 0, li = 0, fi = 0, ci = 0, ti = 0
    const stagePallet = (x: number, z: number, wrapped: boolean) => {
      const lh = 0.9 + rng() * 0.6
      setInstance(pallets, pi++, x, 0, z)
      setInstance(loads, li, x, PALLET.H + lh / 2, z, PALLET.W - 0.04, lh, PALLET.L - 0.04); loads.setColorAt(li++, tint.setHSL(0.08, 0.35, 0.42 + rng() * 0.12))
      if (wrapped) setInstance(film, fi++, x, PALLET.H + lh / 2, z, PALLET.W + 0.02, lh + 0.01, PALLET.L + 0.02)
    }
    const toteStack = (x: number, z: number, n: number, ry = 0) => { for (let k = 0; k < n; k++) { setInstance(totes, ti, x, 0.26 * k, z, 1, 1, 1, 0, ry, 0); totes.setColorAt(ti++, tint.setHex(k % 2 ? 0x9a9d9f : 0xe0b400)) } }

    // --- Dock staging lanes behind every inbound door: stripes, lane number, pallets, a pallet jack in some.
    const ibDocks = f.docks.filter(d => d.prefix === 'IB')
    const z0 = -91.44 + 2.6, z1 = -80.6
    for (const d of ibDocks) {
      const x = d.center[0]
      for (const s of [-1, 1]) yellow.push(boxAt(0.1, 0.001, z1 - z0, x + s * (DOOR.pitch / 2 - 0.05), 0.004, (z0 + z1) / 2))
      this.text.add(String(d.number).padStart(2, '0'), 0.8, x, 0.006, z1 - 0.9, { flat: true, color: 0xf2c200 })
      const n = d.trailerId ? Math.round(rng() * 3) : Math.round(rng() * 1.2)
      for (let k = 0; k < n; k++) stagePallet(x, z0 + 1.0 + k * 1.5, rng() < 0.7)
      if (rng() < 0.3) {
        // Manual pallet jack parked in the lane: forks, hydraulic body, tiller handle, wheels.
        const jz = z1 - 2.2
        orange.push(boxAt(0.16, 0.08, 1.15, x - 0.26, 0.09, jz), boxAt(0.16, 0.08, 1.15, x + 0.26, 0.09, jz), boxAt(0.55, 0.35, 0.3, x, 0.25, jz - 0.65))
        dark.push(cylAt(0.09, 0.5, x, 0.09, jz - 0.7, 'x', 10), boxAt(0.03, 0.03, 1.1, x, 0.85, jz - 1.15, 0, 0.55), boxAt(0.3, 0.03, 0.03, x, 1.25, jz - 1.55))
      }
    }
    // Extendable conveyor at two floor-loaded doors, boom retracted against the wall.
    for (const d of [ibDocks[7], ibDocks[16]]) {
      const x = d.center[0]
      dark.push(boxAt(0.7, 0.5, 6.0, x, 0.55, -91.44 + 3.6), boxAt(0.8, 0.12, 6.2, x, 0.86, -91.44 + 3.6))
      steel.push(boxAt(0.05, 0.75, 0.05, x - 0.35, 0.37, -91.44 + 6.4), boxAt(0.05, 0.75, 0.05, x + 0.35, 0.37, -91.44 + 6.4))
    }

    // --- Receive stations: desk, decant table, tote stack, cases on the table.
    const rcv = f.stations.filter(s => s.type === 'receive')
    for (const st of rcv) {
      const [x, , z] = st.center
      // Desk (west) and decant table (east), both facing the dock side (north).
      steel.push(...bench(x - 1.0, z, 1.2, 0.7, 0.95), ...bench(x + 0.8, z, 1.8, 0.9, 0.9))
      top.push(boxAt(1.2, 0.04, 0.7, x - 1.0, 0.93, z), boxAt(1.8, 0.04, 0.9, x + 0.8, 0.88, z))
      dark.push(boxAt(0.03, 0.4, 0.03, x - 1.2, 1.15, z + 0.25), boxAt(0.5, 0.32, 0.03, x - 1.2, 1.4, z + 0.25), boxAt(0.2, 0.18, 0.22, x - 0.6, 1.04, z + 0.15), boxAt(0.4, 0.02, 0.14, x - 1.1, 0.96, z - 0.1))
      screens.push(boxAt(0.46, 0.28, 0.004, x - 1.2, 1.4, z + 0.23))
      white.push(boxAt(0.08, 0.14, 0.1, x - 0.45, 1.02, z - 0.2))
      if (st.state === 'PACKING') for (let k = 0; k < 2 + Math.round(rng()); k++) {
        const cw = 0.3 + rng() * 0.2, ch = 0.2 + rng() * 0.15, cd = 0.3 + rng() * 0.2
        setInstance(cases, ci, x + 0.3 + k * 0.55, 0.9 + ch / 2, z + (rng() - 0.5) * 0.3, cw, ch, cd, 0, (rng() - 0.5) * 0.5, 0); cases.setColorAt(ci++, tint.setHSL(0.08, 0.35, 0.45 + rng() * 0.12))
      }
      toteStack(x + 1.95, z + 0.05, 3 + Math.round(rng() * 3))
      if (st.queue > 0) stagePallet(x + 0.6, z + 2.0, rng() < 0.5)
      this.colliders.push(new THREE.Box3(new THREE.Vector3(x - 1.7, 0, z - 0.5), new THREE.Vector3(x + 2.2, 1.5, z + 0.5)))
    }
    // Bale cages for flattened cartons at the west end of receive, and a baler chute sign.
    for (const bx of [-117.2, -115.8]) {
      const bz = -72.5
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) steel.push(boxAt(0.03, 1.6, 0.03, bx + sx * 0.55, 0.8, bz + sz * 0.45))
      fence.push(boxAt(1.1, 1.4, 0.005, bx, 0.9, bz - 0.45), boxAt(1.1, 1.4, 0.005, bx, 0.9, bz + 0.45), boxAt(0.005, 1.4, 0.9, bx - 0.55, 0.9, bz), boxAt(0.005, 1.4, 0.9, bx + 0.55, 0.9, bz))
      steel.push(boxAt(1.1, 0.03, 0.9, bx, 0.2, bz))
      setInstance(cases, ci, bx, 0.75, bz, 1.0, 1.0, 0.8); cases.setColorAt(ci++, tint.setHSL(0.08, 0.3, 0.5))
    }

    // --- QC benches, sample carts, pass and fail lanes.
    const qc = f.stations.filter(s => s.type === 'qc')
    for (const st of qc) {
      const [x, , z] = st.center
      const dir = st.face[2]
      steel.push(...bench(x, z, 1.8, 0.9, 0.9))
      top.push(boxAt(1.8, 0.04, 0.9, x, 0.88, z))
      white.push(boxAt(0.35, 0.05, 0.35, x - 0.55, 0.925, z))
      dark.push(boxAt(0.03, 0.4, 0.03, x + 0.6, 1.1, z - dir * 0.3), boxAt(0.5, 0.32, 0.03, x + 0.6, 1.35, z - dir * 0.3), boxAt(0.25, 0.02, 0.12, x + 0.1, 0.91, z + dir * 0.1))
      screens.push(boxAt(0.46, 0.28, 0.004, x + 0.6, 1.35, z - dir * 0.28))
      // Sample cart: two-shelf utility cart with a tote of samples.
      steel.push(boxAt(0.55, 0.03, 0.8, x + 1.5, 0.85, z), boxAt(0.55, 0.03, 0.8, x + 1.5, 0.35, z), ...[-1, 1].flatMap(sx => [-1, 1].map(sz => boxAt(0.025, 0.85, 0.025, x + 1.5 + sx * 0.26, 0.425, z + sz * 0.38))))
      toteStack(x + 1.5, z, 1)
      if (st.state === 'PACKING') { setInstance(cases, ci, x + 0.1, 1.02, z, 0.32, 0.24, 0.36, 0, 0.3, 0); cases.setColorAt(ci++, tint.setHSL(0.08, 0.35, 0.5)) }
      this.colliders.push(new THREE.Box3(new THREE.Vector3(x - 1.0, 0, z - 0.6), new THREE.Vector3(x + 1.9, 1.5, z + 0.6)))
    }
    // Pass lane (green) south to putaway staging, fail lane (red) east to the hold cage gate.
    green.push(boxAt(1.2, 0.001, 9.5, -34, 0.004, -75.4))
    for (const s of [-1, 1]) white.push(boxAt(0.1, 0.001, 9.5, -34 + s * 0.65, 0.005, -75.4))
    this.text.add('PASS → PUTAWAY', 0.45, -34, 0.007, -73.5, { flat: true, yaw: Math.PI / 2 })
    redPaint.push(boxAt(4.5, 0.001, 1.0, -32.2, 0.004, -78.8))
    this.text.add('FAIL → HOLD', 0.4, -32.2, 0.007, -78.8, { flat: true })

    // --- Hold cage: 8 ft chain-link on posts with a top rail, sliding gate on the west face, shelving and tagged pallets inside.
    const hold = AREAS.find(a => a.id === 'QC-HOLD')!
    const cageH = 2.44
    const perim: [number, number, number, number][] = [[hold.x, hold.z, hold.x + hold.w, hold.z], [hold.x + hold.w, hold.z, hold.x + hold.w, hold.z + hold.d], [hold.x, hold.z + hold.d, hold.x + hold.w, hold.z + hold.d], [hold.x, hold.z, hold.x, hold.z + hold.d]]
    const gate = { z0: hold.z + 4, z1: hold.z + 7 } // opening on the west face
    for (const [ax, az, bx, bz] of perim) {
      const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 2.4)
      const along = bx !== ax
      for (let k = 0; k <= n; k++) {
        const t = Math.min(1, k / n)
        const px = ax + (bx - ax) * t, pz = az + (bz - az) * t
        steel.push(boxAt(0.06, cageH, 0.06, px, cageH / 2, pz))
      }
      steel.push(along ? boxAt(len, 0.04, 0.04, (ax + bx) / 2, cageH, az) : boxAt(0.04, 0.04, len, ax, cageH, (az + bz) / 2))
      if (!along && ax === hold.x) {
        // West face with the gate opening: mesh either side, a sliding gate panel offset open.
        fence.push(boxAt(0.005, cageH - 0.1, gate.z0 - hold.z, ax, cageH / 2, (hold.z + gate.z0) / 2), boxAt(0.005, cageH - 0.1, hold.z + hold.d - gate.z1, ax, cageH / 2, (gate.z1 + hold.z + hold.d) / 2))
        fence.push(boxAt(0.005, cageH - 0.2, 3.0, ax - 0.08, cageH / 2, gate.z1 + 1.4))
        steel.push(boxAt(0.05, cageH - 0.2, 0.05, ax - 0.08, cageH / 2, gate.z1 - 0.1), boxAt(0.05, cageH - 0.2, 0.05, ax - 0.08, cageH / 2, gate.z1 + 2.9), boxAt(0.05, 0.05, 3.0, ax - 0.08, cageH - 0.2, gate.z1 + 1.4))
      } else fence.push(along ? boxAt(len, cageH - 0.1, 0.005, (ax + bx) / 2, cageH / 2, az) : boxAt(0.005, cageH - 0.1, len, ax, cageH / 2, (az + bz) / 2))
    }
    white.push(boxAt(0.9, 0.5, 0.01, hold.x - 0.12, 1.8, gate.z0 - 1.2))
    this.text.add('QC HOLD', 0.16, hold.x - 0.13, 1.9, gate.z0 - 1.2, { yaw: -Math.PI / 2, color: 0xc41e1e })
    this.text.add('AUTHORISED ONLY', 0.09, hold.x - 0.13, 1.68, gate.z0 - 1.2, { yaw: -Math.PI / 2, color: 0x111111 })
    // Inside: two rivet-shelving units of held items along the east wall, tagged pallets along the north.
    for (const sz of [2.5, 5.5]) {
      const sx = hold.x + hold.w - 0.6, z = hold.z + sz
      for (const dx of [-0.6, 0.6]) for (const dz of [-0.2, 0.2]) steel.push(boxAt(0.04, 2.1, 0.04, sx + dx, 1.05, z + dz))
      for (let l = 0; l < 4; l++) {
        top.push(boxAt(1.2, 0.02, 0.45, sx, 0.15 + l * 0.5, z))
        for (let k = 0; k < 2 + Math.round(rng()); k++) { setInstance(cases, ci, sx - 0.4 + k * 0.4, 0.16 + l * 0.5 + 0.12, z, 0.3, 0.24, 0.3); cases.setColorAt(ci++, tint.setHSL(0.08, 0.35, 0.45 + rng() * 0.12)); redTags.push(boxAt(0.06, 0.09, 0.002, sx - 0.4 + k * 0.4, 0.16 + l * 0.5 + 0.14, z - 0.16)) }
      }
    }
    for (let k = 0; k < 3; k++) { const px = hold.x + 1.2 + k * 1.6, pz = hold.z + hold.d - 1.2; stagePallet(px, pz, false); redTags.push(boxAt(0.1, 0.14, 0.002, px + 0.2, PALLET.H + 0.7, pz - PALLET.L / 2 - 0.005)) }
    this.colliders.push(new THREE.Box3(new THREE.Vector3(hold.x - 0.1, 0, hold.z - 0.1), new THREE.Vector3(hold.x + 0.1, cageH, gate.z0)), new THREE.Box3(new THREE.Vector3(hold.x - 0.1, 0, gate.z1), new THREE.Vector3(hold.x + 0.1, cageH, hold.z + hold.d + 0.1)))
    this.colliders.push(new THREE.Box3(new THREE.Vector3(hold.x, 0, hold.z - 0.1), new THREE.Vector3(hold.x + hold.w + 0.1, cageH, hold.z + 0.1)), new THREE.Box3(new THREE.Vector3(hold.x, 0, hold.z + hold.d - 0.1), new THREE.Vector3(hold.x + hold.w + 0.1, cageH, hold.z + hold.d + 0.1)), new THREE.Box3(new THREE.Vector3(hold.x + hold.w - 0.1, 0, hold.z), new THREE.Vector3(hold.x + hold.w + 0.1, cageH, hold.z + hold.d)))

    // --- Putaway staging: painted positions in destination groups, staged pallets and tote stacks, group signs.
    const pz0 = -69.4
    for (const g of PUTAWAY_GROUPS) {
      const perRow = Math.ceil(g.positions / 2)
      for (let k = 0; k < g.positions; k++) {
        const r = Math.floor(k / perRow), c = k % perRow
        const x = g.x0 + 0.7 + c * 1.5, z = pz0 + 0.9 + r * 1.8
        yellow.push(boxAt(1.4, 0.001, 0.08, x, 0.004, z - 0.85), boxAt(1.4, 0.001, 0.08, x, 0.004, z + 0.85), boxAt(0.08, 0.001, 1.7, x - 0.7, 0.004, z), boxAt(0.08, 0.001, 1.7, x + 0.7, 0.004, z))
        if (rng() < (g.dest === 'FM-1' ? 0.35 : 0.55)) stagePallet(x, z, rng() < 0.6)
        else if (g.dest === 'FM-1' && rng() < 0.6) toteStack(x, z, 4 + Math.round(rng() * 3))
      }
      const sx = g.x0 + 0.7 + (perRow - 1) * 1.5 / 2
      this.text.add(`PUTAWAY → ${g.dest}`, 0.5, sx, 0.006, pz0 - 0.6, { flat: true })
      steel.push(boxAt(0.05, 2.4, 0.05, g.x0 - 0.6, 1.2, pz0 + 1.8), boxAt(0.3, 0.02, 0.3, g.x0 - 0.6, 0.01, pz0 + 1.8))
      white.push(boxAt(0.9, 0.45, 0.01, g.x0 - 0.6, 2.5, pz0 + 1.8))
      this.text.add(g.dest, 0.2, g.x0 - 0.6, 2.5, pz0 + 1.79, { yaw: 0, color: 0x111111 })
    }

    pallets.count = pi; loads.count = li; film.count = fi; cases.count = ci; totes.count = ti
    this.text.commit()
    const mesh = canvasTexture(64, 64, ctx => {
      ctx.clearRect(0, 0, 64, 64); ctx.strokeStyle = '#b9bdc0'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(32, 0); ctx.lineTo(64, 32); ctx.lineTo(32, 64); ctx.closePath(); ctx.stroke()
    }, { repeat: [20, 40] })
    const fenceMat = new THREE.MeshStandardMaterial({ map: mesh, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.4 })
    const laminate = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.5 })
    this.group.add(merged(steel, M.steelDark), merged(top, laminate), merged(dark, M.steelDark), merged(white, new THREE.MeshStandardMaterial({ color: 0xececea, roughness: 0.5 })), merged(screens, new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6fb6ff, emissiveIntensity: 1.2 }), false), merged(orange, new THREE.MeshStandardMaterial({ color: 0xe8641e, roughness: 0.5, metalness: 0.4 })), merged(redTags, new THREE.MeshStandardMaterial({ color: 0xd42020, roughness: 0.6 }), false))
    const fm = new THREE.Mesh(merged(fence, fenceMat, false).geometry, fenceMat); this.group.add(fm)
    for (const [geos, mat] of [[yellow, M.paintYellow], [green, M.paintGreen], [redPaint, new THREE.MeshStandardMaterial({ color: 0xc41e1e, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 })]] as const) { if (geos.length) { const m = new THREE.Mesh(merged(geos, mat, false).geometry, mat); m.receiveShadow = true; this.group.add(m) } }
    this.group.add(pallets, loads, film, cases, totes, this.text.mesh)
    for (const m of [pallets, loads, cases, totes]) { m.castShadow = true; m.receiveShadow = true }
    film.renderOrder = 2
    // Hit volumes: receive and QC stations plus the cage.
    const hits = [...rcv, ...qc, ...f.cages]
    this.volumes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.hit, hits.length)
    hits.forEach((e, i) => setInstance(this.volumes, i, e.center[0], e.center[1], e.center[2], e.size[0], e.size[1], e.size[2]))
    this.volumes.userData.resolve = (id: number) => hits[id]
    this.group.add(this.volumes)
  }
}

/** Steel-frame bench legs and aprons for a top of w × d at height h, centred at (x, z). */
function bench(x: number, z: number, w: number, d: number, h: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(boxAt(0.05, h - 0.04, 0.05, x + sx * (w / 2 - 0.05), (h - 0.04) / 2, z + sz * (d / 2 - 0.05)))
  for (const sz of [-1, 1]) parts.push(boxAt(w - 0.1, 0.05, 0.05, x, h - 0.08, z + sz * (d / 2 - 0.05)))
  return parts
}
