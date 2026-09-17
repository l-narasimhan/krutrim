import * as THREE from 'three'
import { RACK, BIN, type PickFace } from '../facility'
import { Tex } from '../assets'
import { setInstance, canvasTexture } from './util'
import { makeBinGeometry } from './shelving'
import { LabelField } from './labels'
import type { Mats } from './mats'
import { rng, pick, randInt } from '../rng'

/** Cut-case sizes for hand-stack and carton-flow faces (m): w × h × d. */
const CASES: [number, number, number][] = [[0.4, 0.28, 0.32], [0.45, 0.3, 0.36], [0.36, 0.25, 0.3], [0.5, 0.32, 0.4]]
/** AkroBin 30-280 style, 18" L × 16 1/2" W × 11" H, scaled from the shelf-bin geometry. */
const BIG_BIN = { L: 0.457, W: 0.419, H: 0.279 }
const FLOW = { lanes: 3, laneW: 0.8, rise: 0.12, railH: 0.06 }

/**
 * Fit-out of the two pick levels of every rack bay, in the module's local frame. Per bay: hand-stack faces get
 * open cases on the wire deck with closed reserve cases behind; carton-flow faces get three sloped roller lanes
 * with cases queued on them; bin faces get six large hopper bins. Every face carries a Code 128 label on the
 * level-B beam, lower label for the floor face, and a hit volume so it can be scanned.
 */
export function buildPickFaces(faces: PickFace[], M: Mats, labels: LabelField, labelStart: number, group: THREE.Group): THREE.InstancedMesh {
  const { frameDepth, column, levelPitch, beamH, bayPitch } = RACK
  const hand = faces.filter(f => f.fit === 'hand'), flow = faces.filter(f => f.fit === 'flow'), bins = faces.filter(f => f.fit === 'bins')
  const cardboard = new THREE.MeshStandardMaterial({ ...Tex.cardboard(), roughness: 1, metalness: 0 })
  const tint = new THREE.Color()
  const baseY = (f: PickFace) => (f.level === 0 ? 0 : levelPitch + beamH / 2 + 0.004)

  // --- Hand-stack: up to 4 open cases along the front with the top flaps cut, 2–3 closed cases behind.
  const openCases = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cardboard, hand.length * 4)
  const cutTops = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 1 }), hand.length * 4)
  const backCases = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cardboard, hand.length * 3)
  let oi = 0, bi = 0
  for (const f of hand) {
    const [u, , v] = f.local
    const y0 = baseY(f)
    const front = v + f.faceDir * (frameDepth / 2 - column - 0.02)
    const n = f.sku ? randInt(2, 4) : 0
    const [cw, ch, cd] = pick(CASES)
    for (let k = 0; k < n; k++) {
      const x = u - (n - 1) * (cw + 0.06) / 2 + k * (cw + 0.06)
      const z = front - f.faceDir * cd / 2
      const jitter = 0.96 + rng() * 0.06
      setInstance(openCases, oi, x, y0 + ch * 0.8 / 2, z, cw * jitter, ch * 0.8, cd * jitter)
      openCases.setColorAt(oi, tint.setHSL(0.08, 0.35, 0.45 + rng() * 0.12))
      // The cut interior: a darker slab just below the rim, product level set by the face quantity.
      const fill = f.qty / f.capacity
      setInstance(cutTops, oi++, x, y0 + ch * 0.8 * (0.35 + 0.45 * fill), z, cw * 0.9, 0.01, cd * 0.9)
    }
    const nb = f.sku ? randInt(1, 3) : 0
    for (let k = 0; k < nb; k++) {
      const x = u - (nb - 1) * (cw + 0.08) / 2 + k * (cw + 0.08)
      setInstance(backCases, bi, x, y0 + ch / 2, front - f.faceDir * (cd + 0.08 + cd / 2), cw, ch, cd)
      backCases.setColorAt(bi++, tint.setHSL(0.08, 0.33, 0.42 + rng() * 0.12))
    }
  }
  openCases.count = oi; cutTops.count = oi; backCases.count = bi

  // --- Carton flow: three roller lanes per face, back raised 120 mm, cases queued front to back.
  const rollerTex = canvasTexture(64, 64, ctx => {
    ctx.fillStyle = '#b9bdc0'; ctx.fillRect(0, 0, 64, 64)
    ctx.fillStyle = '#7d8286'; ctx.fillRect(0, 0, 64, 6); ctx.fillRect(0, 32, 64, 6)
    ctx.fillStyle = '#d6d9db'; ctx.fillRect(0, 10, 64, 3); ctx.fillRect(0, 42, 64, 3)
  }, { repeat: [1, frameDepth / 0.1] })
  const laneMat = new THREE.MeshStandardMaterial({ map: rollerTex, roughness: 0.4, metalness: 0.7 })
  const laneLen = frameDepth - column * 2
  const slope = Math.atan2(FLOW.rise, laneLen)
  const lanes = new THREE.InstancedMesh(new THREE.PlaneGeometry(FLOW.laneW, laneLen), laneMat, flow.length * FLOW.lanes)
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, FLOW.railH, laneLen), M.galvanised, flow.length * (FLOW.lanes + 1))
  const flowCases = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cardboard, flow.length * FLOW.lanes * 3)
  let li = 0, ri = 0, fi = 0
  for (const f of flow) {
    const [u, , v] = f.local
    const y0 = baseY(f) + 0.05
    const tilt = -f.faceDir * slope // back end higher; the plane's +z edge is toward the aisle for faceDir 1
    const rx = -Math.PI / 2 + tilt
    const zc = v // lane centred in the frame depth
    const laneSpan = (FLOW.lanes - 1) * (FLOW.laneW + 0.06)
    for (let k = 0; k <= FLOW.lanes; k++) {
      const x = u - laneSpan / 2 - (FLOW.laneW + 0.06) / 2 + k * (FLOW.laneW + 0.06)
      setInstance(rails, ri++, x, y0 + FLOW.rise / 2 + FLOW.railH / 2, zc, 1, 1, 1, tilt, 0, 0)
    }
    const [cw, ch, cd] = pick(CASES)
    const nq = f.sku ? Math.max(1, Math.round(3 * f.qty / f.capacity)) : 0
    for (let k = 0; k < FLOW.lanes; k++) {
      const x = u - laneSpan / 2 + k * (FLOW.laneW + 0.06)
      setInstance(lanes, li++, x, y0 + FLOW.rise / 2, zc, 1, 1, 1, rx, 0, 0)
      const lanesQueued = k < nq ? 3 : k === nq ? randInt(0, 2) : 0
      for (let q = 0; q < lanesQueued; q++) {
        // Distance from the front stop along the lane, and the height the slope gives at that point.
        const d = 0.05 + cd / 2 + q * (cd + 0.02)
        const along = laneLen / 2 - d
        const z = zc + f.faceDir * along
        const yy = y0 + FLOW.rise / 2 - along * Math.tan(slope) * -1
        setInstance(flowCases, fi, x, yy + ch / 2 + 0.01, z, cw, ch, cd, tilt, 0, 0)
        flowCases.setColorAt(fi++, tint.setHSL(0.08, 0.35, 0.42 + rng() * 0.14))
      }
    }
  }
  lanes.count = li; rails.count = ri; flowCases.count = fi

  // --- Bins: six large hopper bins across the front of the deck.
  const binGeo = makeBinGeometry()
  const binMesh = new THREE.InstancedMesh(binGeo, M.binBlue, bins.length * 6)
  const sx = BIG_BIN.W / BIN.W, sy = BIG_BIN.H / BIN.H, sz = BIG_BIN.L / BIN.L
  let bni = 0
  for (const f of bins) {
    const [u, , v] = f.local
    const y0 = baseY(f)
    const front = v + f.faceDir * (frameDepth / 2 - column - 0.01)
    const ry = f.faceDir === 1 ? 0 : Math.PI
    for (let k = 0; k < 6; k++) {
      const x = u - 2.5 * (BIG_BIN.W + 0.012) + k * (BIG_BIN.W + 0.012)
      setInstance(binMesh, bni, x, y0, front - f.faceDir * BIG_BIN.L / 2, sx, sy, sz, 0, ry, 0)
      binMesh.setColorAt(bni++, tint.setHSL(0.6, 0.62, 0.34 + (k % 3) * 0.015))
    }
  }

  for (const m of [openCases, cutTops, backCases, lanes, rails, flowCases, binMesh]) { m.castShadow = true; m.receiveShadow = true; group.add(m) }

  // --- Labels on the level-B front beam: the floor face's label sits low on the beam, level B's above it.
  const beamFront = (f: PickFace) => f.local[2] + f.faceDir * (frameDepth / 2 - column + 0.003)
  faces.forEach((f, i) => {
    const ry = f.faceDir === 1 ? 0 : Math.PI
    labels.set(labelStart + i, f.id, f.local[0] + 0.4, levelPitch + (f.level === 0 ? -0.026 : 0.026), beamFront(f), ry, f.sku ?? undefined)
  })

  // --- Hit volumes: one per face, proud of the bay volume so the near hit resolves to the face.
  const volumes = new THREE.InstancedMesh(new THREE.BoxGeometry(bayPitch - 0.1, levelPitch - 0.2, frameDepth + 0.3), M.hit, faces.length)
  faces.forEach((f, i) => setInstance(volumes, i, f.local[0], f.local[1], f.local[2]))
  volumes.userData.resolve = (id: number) => faces[id]
  group.add(volumes)
  return volumes
}
