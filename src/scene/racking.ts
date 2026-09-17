import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RACK, RACK_ROW_PITCH, PALLET, type Bay, palletCount, rowV, bayU, toWorld, moduleOrigin, MODULE_ROT_Y } from '../facility'
import type { StorageModule } from '../layout'
import { Tex } from '../assets'
import { setInstance, boxAt, canvasTexture } from './util'
import { LabelField } from './labels'
import { buildPickFaces } from './pickfaces'
import type { Mats } from './mats'
import { rng, pick, randInt } from '../rng'

/** Common corrugated case sizes (m): w × h × d. */
const CASES: [number, number, number][] = [[0.4, 0.3, 0.3], [0.6, 0.4, 0.4], [0.5, 0.3, 0.35], [0.33, 0.25, 0.45], [0.45, 0.35, 0.3]]

/**
 * One reserve racking module. Built in the module's local frame (rows along local x, faces along ±local z),
 * then the group is rotated so rows run north–south in the hall. Every bay's `local` centre comes from facility.ts.
 */
export class Racking {
  group = new THREE.Group()
  volumes: THREE.InstancedMesh
  faceVolumes: THREE.InstancedMesh
  labels: LabelField
  colliders: THREE.Box3[] = []
  private pallets: THREE.InstancedMesh
  private cases: THREE.InstancedMesh
  private film: THREE.InstancedMesh
  private palletBase: Float32Array
  private caseBase: Float32Array
  private caseRange: Int32Array // per pallet: start, count
  private caseScale: Float32Array
  private filmOf: Int32Array
  private filmSize: Float32Array
  private firstPallet = new Map<Bay, number>()
  private animating = new Set<Bay>()

  constructor(readonly module: StorageModule, private bays: Bay[], M: Mats) {
    const { bayPitch, levels, levelPitch, frameDepth, column, uprightH, beamLen, beamH, beamD, flue } = RACK
    const { rows, baysPerRow: nBays } = module
    const g = this.group
    const [ox, oy, oz] = moduleOrigin(module)
    g.position.set(ox, oy, oz); g.rotation.y = MODULE_ROT_Y

    // Upright positions along the row: at the start of every bay, plus the end of each half-row at the cross aisle.
    const half = Math.floor(nBays / 2)
    const uprightU: number[] = []
    for (let b = 0; b < nBays; b++) uprightU.push(bayU(module, b))
    uprightU.push(bayU(module, half - 1) + bayPitch, bayU(module, nBays - 1) + bayPitch)
    uprightU.sort((a, b) => a - b)

    // --- Frames: teardrop columns, footplates, horizontal and diagonal bracing, row spacers.
    const nFrames = rows * 2 * uprightU.length
    const cols = new THREE.InstancedMesh(new THREE.BoxGeometry(column, uprightH, column), M.upright, nFrames * 2)
    const plates = new THREE.InstancedMesh(new THREE.BoxGeometry(0.127, 0.006, 0.178), M.upright, nFrames * 2)
    const braceLen = frameDepth - column
    const nDiag = Math.floor((uprightH - 0.3) / 1.2)
    const braces = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 1, 0.035), M.upright, nFrames * (nDiag + 2))
    const spacers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, flue + column), M.upright, rows * uprightU.length * 2)
    let ci = 0, bi = 0, si = 0
    const diagLen = Math.hypot(braceLen, 1.2), diagAng = Math.atan2(braceLen, 1.2)
    for (let r = 0; r < rows; r++) {
      const zc = rowV(module, r)
      for (const dir of [-1, 1]) {
        const zBack = zc + dir * (flue / 2 + column / 2)
        const zFront = zc + dir * (flue / 2 + frameDepth - column / 2)
        for (const x of uprightU) {
          setInstance(cols, ci, x, uprightH / 2, zFront); setInstance(plates, ci++, x, 0.003, zFront)
          setInstance(cols, ci, x, uprightH / 2, zBack); setInstance(plates, ci++, x, 0.003, zBack)
          const zm = (zFront + zBack) / 2
          setInstance(braces, bi++, x, 0.15, zm, 1, braceLen, 1, Math.PI / 2, 0, 0)
          setInstance(braces, bi++, x, uprightH - 0.15, zm, 1, braceLen, 1, Math.PI / 2, 0, 0)
          for (let k = 0; k < nDiag; k++) setInstance(braces, bi++, x, 0.3 + k * 1.2 + 0.6, zm, 1, diagLen, 1, (k % 2 ? 1 : -1) * diagAng, 0, 0)
        }
      }
      for (const x of uprightU) for (const y of [2.0, 5.5]) setInstance(spacers, si++, x, y, zc)
    }
    braces.count = bi
    for (const m of [cols, plates, braces, spacers]) { m.castShadow = true; m.receiveShadow = true; g.add(m) }

    // --- Step beams (front and rear) at each level above the floor, with wire decking.
    const nBeams = rows * 2 * nBays * (levels - 1) * 2
    const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(beamLen, beamH, beamD), M.beam, nBeams)
    const wireTex = canvasTexture(64, 64, ctx => {
      ctx.clearRect(0, 0, 64, 64); ctx.strokeStyle = '#c8ccd0'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(64, 2); ctx.moveTo(2, 0); ctx.lineTo(2, 64); ctx.stroke()
    }, { repeat: [1.168 / 0.1016, 1.067 / 0.0635], srgb: true })
    const wireMat = new THREE.MeshStandardMaterial({ map: wireTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.35, color: 0xd8dcdf })
    const decks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.168, frameDepth), wireMat, rows * 2 * nBays * (levels - 1) * 2)
    let bmi = 0, di = 0
    for (let r = 0; r < rows; r++) {
      const zc = rowV(module, r)
      for (const dir of [-1, 1]) {
        const zBack = zc + dir * (flue / 2 + column + beamD / 2)
        const zFront = zc + dir * (flue / 2 + frameDepth - column - beamD / 2)
        const zMid = zc + dir * (flue / 2 + frameDepth / 2)
        for (let b = 0; b < nBays; b++) {
          const cx = bayU(module, b) + bayPitch / 2
          for (let l = 1; l < levels; l++) {
            const y = l * levelPitch
            setInstance(beams, bmi++, cx, y, zFront); setInstance(beams, bmi++, cx, y, zBack)
            for (const dx of [-0.62, 0.62]) setInstance(decks, di++, cx + dx, y + beamH / 2 + 0.002, zMid, 1, 1, 1, -Math.PI / 2, 0, 0)
          }
        }
      }
    }
    beams.castShadow = true; beams.receiveShadow = true
    g.add(beams, decks)

    // --- Pallets, cases, stretch film, LPN labels. One instanced mesh each.
    const nPallets = palletCount(bays)
    this.pallets = new THREE.InstancedMesh(makePalletGeometry(), M.wood, nPallets)
    this.palletBase = new Float32Array(nPallets * 3)
    this.caseRange = new Int32Array(nPallets * 2)
    this.filmOf = new Int32Array(nPallets).fill(-1)
    this.filmSize = new Float32Array(nPallets * 2)
    const caseMat = new THREE.MeshStandardMaterial({ ...Tex.cardboard(), roughness: 1, metalness: 0 })
    const caseBase: number[] = [], caseScale: number[] = []
    const filmPos: number[] = []
    let pi = 0
    for (const bay of bays) {
      this.firstPallet.set(bay, pi)
      for (const s of bay.slots) {
        if (!s.lpn) continue
        const x = bay.local[0] + (s.pos ? 0.56 : -0.56)
        const y = s.level === 0 ? 0 : s.level * levelPitch + beamH / 2
        const z = bay.local[2]
        this.palletBase.set([x, y, z], pi * 3)
        // Load: a tie pattern of a random case size, 3–5 layers, slight size jitter so no two loads match.
        const [cw, ch, cd] = pick(CASES)
        const nx = Math.max(1, Math.floor(PALLET.W / cw)), nz = Math.max(1, Math.floor(PALLET.L / cd))
        const layers = randInt(3, s.level === 0 ? 5 : 4)
        const start = caseBase.length / 3
        const jitter = 0.97 + rng() * 0.05
        for (let l = 0; l < layers; l++) for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
          if (l === layers - 1 && rng() < 0.08) continue // a missing case on the top layer now and then
          caseBase.push(x - (nx - 1) * cw / 2 + ix * cw, y + PALLET.H + ch / 2 + l * ch, z - (nz - 1) * cd / 2 + iz * cd)
          caseScale.push(cw * jitter, ch * jitter, cd * jitter)
        }
        this.caseRange[pi * 2] = start; this.caseRange[pi * 2 + 1] = caseBase.length / 3 - start
        const loadH = layers * ch
        if (s.wrapped) {
          this.filmOf[pi] = filmPos.length / 3
          filmPos.push(x, y + PALLET.H + loadH / 2, z)
          this.filmSize[pi * 2] = nx * cw + 0.02; this.filmSize[pi * 2 + 1] = loadH + 0.01
        }
        pi++
      }
    }
    this.caseBase = new Float32Array(caseBase)
    this.caseScale = new Float32Array(caseScale)
    this.cases = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), caseMat, Math.max(1, caseBase.length / 3))
    this.cases.count = caseBase.length / 3
    const tint = new THREE.Color()
    for (let i = 0; i < this.cases.count; i++) {
      const b = this.caseBase, sc = this.caseScale
      setInstance(this.cases, i, b[i * 3], b[i * 3 + 1], b[i * 3 + 2], sc[i * 3], sc[i * 3 + 1], sc[i * 3 + 2])
      this.cases.setColorAt(i, tint.setHSL(0.08, 0.35, 0.42 + rng() * 0.16))
    }
    this.film = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, PALLET.L + 0.02), M.film, Math.max(1, filmPos.length / 3))
    this.film.count = filmPos.length / 3
    for (let i = 0; i < nPallets; i++) {
      const b = this.palletBase
      setInstance(this.pallets, i, b[i * 3], b[i * 3 + 1], b[i * 3 + 2])
      const fi = this.filmOf[i]
      if (fi >= 0) setInstance(this.film, fi, filmPos[fi * 3], filmPos[fi * 3 + 1], filmPos[fi * 3 + 2], this.filmSize[i * 2], this.filmSize[i * 2 + 1], 1)
    }
    this.pallets.castShadow = true; this.pallets.receiveShadow = true
    this.cases.castShadow = true; this.cases.receiveShadow = true
    this.film.renderOrder = 2
    g.add(this.pallets, this.cases, this.film)

    // --- Labels: 4x6" LPN license plates on each load face, barcoded bay placards on the level-C beam,
    // and one label per pick face on the level-B beam.
    const faces = bays.flatMap(b => b.faces)
    this.labels = new LabelField(nPallets + bays.length + faces.length, 0.1, 0.031)
    pi = 0
    for (const bay of bays) {
      const ry = bay.faceDir === 1 ? 0 : Math.PI
      for (const s of bay.slots) {
        if (!s.lpn) continue
        const b = this.palletBase
        const zFace = b[pi * 3 + 2] + bay.faceDir * (PALLET.L / 2 + 0.012)
        this.labels.set(pi, s.lpn, b[pi * 3] + 0.25, b[pi * 3 + 1] + PALLET.H + 0.55, zFace, ry, s.sku ?? undefined)
        pi++
      }
    }
    // Placards sit centred on the front face of the first reserve beam (level C) of every bay.
    const placards = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), bays.length)
    bays.forEach((bay, i) => {
      const ry = bay.faceDir === 1 ? 0 : Math.PI
      const zFace = bay.local[2] + bay.faceDir * (frameDepth / 2 - column + 0.004)
      this.labels.set(nPallets + i, bay.id, bay.local[0], RACK.pickLevels * levelPitch, zFace, ry, bay.aisle)
      setInstance(placards, i, bay.local[0], RACK.pickLevels * levelPitch, zFace - bay.faceDir * 0.002, 1, 1, 1, 0, ry, 0)
    })
    // Pick-level fit-out and face labels.
    this.faceVolumes = buildPickFaces(faces, M, this.labels, nPallets + bays.length, g)
    this.labels.commit()
    g.add(this.labels.mesh, placards)

    // --- Pick volumes, one per bay.
    this.volumes = new THREE.InstancedMesh(new THREE.BoxGeometry(bayPitch, uprightH + 1.2, frameDepth + 0.1), M.hit, bays.length)
    bays.forEach((bay, i) => setInstance(this.volumes, i, bay.local[0], bay.local[1], bay.local[2]))
    this.volumes.userData.resolve = (id: number) => bays[id]
    g.add(this.volumes)

    // --- Colliders in world space: one box per row half, leaving the cross aisle open.
    const hd = flue / 2 + frameDepth + 0.1
    for (let r = 0; r < rows; r++) {
      const vc = rowV(module, r)
      for (const [u0, u1] of [[bayU(module, 0), bayU(module, half - 1) + bayPitch], [bayU(module, half), bayU(module, nBays - 1) + bayPitch]]) {
        const a = toWorld(module, u0 - 0.3, 0, vc - hd), b = toWorld(module, u1 + 0.3, 9, vc + hd)
        this.colliders.push(new THREE.Box3(new THREE.Vector3(Math.min(a[0], b[0]), 0, Math.min(a[2], b[2])), new THREE.Vector3(Math.max(a[0], b[0]), 9, Math.max(a[2], b[2]))))
      }
    }
  }

  /** Slide a bay's pallets out toward the aisle (or back). */
  toggleExtract(bay: Bay) {
    bay.extractTarget = bay.extractTarget > 0.5 ? 0 : 1
    this.animating.add(bay)
  }

  update(dt: number) {
    if (!this.animating.size) return
    for (const bay of this.animating) {
      const d = bay.extractTarget - bay.extract
      bay.extract += Math.sign(d) * Math.min(Math.abs(d), dt * 1.6)
      if (Math.abs(bay.extractTarget - bay.extract) < 1e-3) { bay.extract = bay.extractTarget; this.animating.delete(bay) }
      const off = bay.faceDir * 1.3 * easeInOut(bay.extract)
      const ry = bay.faceDir === 1 ? 0 : Math.PI
      let pi = this.firstPallet.get(bay)!
      for (const s of bay.slots) {
        if (!s.lpn) continue
        const pb = this.palletBase, i = pi
        setInstance(this.pallets, i, pb[i * 3], pb[i * 3 + 1], pb[i * 3 + 2] + off)
        const cs = this.caseRange[i * 2], cn = this.caseRange[i * 2 + 1]
        for (let c = cs; c < cs + cn; c++) setInstance(this.cases, c, this.caseBase[c * 3], this.caseBase[c * 3 + 1], this.caseBase[c * 3 + 2] + off, this.caseScale[c * 3], this.caseScale[c * 3 + 1], this.caseScale[c * 3 + 2])
        const fi = this.filmOf[i]
        if (fi >= 0) {
          const m = new THREE.Matrix4(); this.film.getMatrixAt(fi, m)
          const p = new THREE.Vector3().setFromMatrixPosition(m)
          setInstance(this.film, fi, p.x, p.y, pb[i * 3 + 2] + off, this.filmSize[i * 2], this.filmSize[i * 2 + 1], 1)
        }
        this.labels.place(i, pb[i * 3] + 0.25, pb[i * 3 + 1] + PALLET.H + 0.55, pb[i * 3 + 2] + off + bay.faceDir * (PALLET.L / 2 + 0.012), ry)
        pi++
      }
    }
    this.pallets.instanceMatrix.needsUpdate = true
    this.cases.instanceMatrix.needsUpdate = true
    this.film.instanceMatrix.needsUpdate = true
    this.labels.mesh.instanceMatrix.needsUpdate = true
  }
}

const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

/** GMA 48x40 stringer pallet: 3 stringers, 7 top deck boards, 3 bottom boards. Origin at the bottom centre. */
export function makePalletGeometry(): THREE.BufferGeometry {
  const { L, W, H, boardT, stringerH, stringerW } = PALLET
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-W / 2 + stringerW / 2, 0, W / 2 - stringerW / 2]) parts.push(boxAt(stringerW, stringerH, L, x, boardT + stringerH / 2, 0))
  const topN = 7, topW = 0.14
  for (let i = 0; i < topN; i++) parts.push(boxAt(W, boardT, topW, 0, H - boardT / 2, -L / 2 + topW / 2 + i * ((L - topW) / (topN - 1))))
  for (const z of [-L / 2 + 0.07, 0, L / 2 - 0.07]) parts.push(boxAt(W, boardT, topW, 0, boardT / 2, z))
  const g = mergeGeometries(parts, false)!
  parts.forEach(p => p.dispose())
  return g
}
