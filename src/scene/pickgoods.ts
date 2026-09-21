// Pick faces with the real product on them.
//
// Reserve pallets at levels C–E hold sealed cases, so cases are all you can see up there — that is what a
// fulfillment center stores. The individual product only becomes visible at a PICK FACE, where the shipper
// is cut down and the eaches sit loose on the shelf. This builds that: a cut case at the product's real
// dimensions, holding eaches of the product the face actually carries.
//
// Nothing here draws from the shared RNG stream. The per-face variation comes from mulberry32 seeded off the
// face id, so RES-B's fit-out cannot shift FM-1, the conveyors, inbound or the people.

import * as THREE from 'three'
import { RACK, type PickFace } from '../facility'
import { productForSku, unitOf, type Form, type UnitForm, type Product } from '../catalog'
import { mulberry32 } from '../rng'
import { setInstance, boxAt, mergeAny } from './util'
import { formGeometry, unitGeometry, FORM_SIZE, UNIT_SIZE, FORM_MATERIAL, UNIT_MATERIAL, UNIT_FORMS, eachColor, type GoodsMaterials } from './goods'
import { makeBinGeometry } from './shelving'
import { walkPickFaceDraws } from './pickfaces'
import { LabelField } from './labels'
import type { Mats } from './mats'

/** AkroBin 30-280 style hopper bin, 18" L x 16 1/2" W x 11" H — the large pick-face bin. */
const BIG_BIN = { L: 0.457, W: 0.419, H: 0.279 }
const FLOW = { lanes: 3, laneW: 0.8, rise: 0.12, railH: 0.06 }

/** How far a shipper is cut down, as a fraction of its height. Real cut cases are cut below the score line. */
const CUT = 0.55

const FORMS: Form[] = ['rsc', 'flat', 'shoebox', 'mailer', 'polybag', 'paperbag', 'tray', 'tub', 'roll', 'drum']

const hash = (s: string): number => {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h >>> 0
}

/** An open tray: the floor and four walls of a cut-down shipper, with the flute edge showing at the rim. */
function trayGeometry(w: number, h: number, d: number, wall = 0.004): THREE.BufferGeometry {
  const parts = [
    boxAt(w, wall, d, 0, wall / 2, 0),
    boxAt(w, h, wall, 0, h / 2, d / 2 - wall / 2),
    boxAt(w, h, wall, 0, h / 2, -d / 2 + wall / 2),
    boxAt(wall, h, d, w / 2 - wall / 2, h / 2, 0),
    boxAt(wall, h, d, -w / 2 + wall / 2, h / 2, 0),
  ]
  const g = mergeAny(parts)
  parts.forEach(p => p.dispose())
  return g
}

interface UnitPlace { ux: number; uy: number; uz: number; ry: number }
interface FacePlan {
  cut: { lx: number; lz: number; ry: number }[]   // cut cases: position on the deck and facing
  closed: { lx: number; ly: number; lz: number; ry: number }[]
  units: UnitPlace[]                               // local to the face
  form: Form
  unitForm: UnitForm
}

/**
 * Work out one face's fit-out: cut cases along the front, closed back stock behind, and the eaches sitting
 * in the cut cases.
 */
function planFace(f: PickFace, roll: () => number): FacePlan | null {
  if (!f.sku) return null
  const p = productForSku(f.sku)
  const unit = unitOf(p)
  const { frameDepth, column, bayPitch } = RACK

  const deckW = bayPitch - 0.12
  const deckD = frameDepth - column * 2
  const caseW = p.w, caseD = p.d
  // A cut case is cut below its score line, so the rim sits at CUT of the shipper height.
  const cutH = Math.min(p.h * CUT, RACK.levelPitch * 0.62)

  const nCut = Math.max(1, Math.min(4, Math.round(4 * (f.qty / f.capacity)) || 1))
  const pitchX = caseW + 0.05
  const frontZ = deckD / 2 - caseD / 2
  const cut: FacePlan['cut'] = []
  const units: UnitPlace[] = []

  // Eaches stand in the cut case in their own grid, filled in proportion to what the face actually holds.
  const nx = Math.max(1, Math.floor((caseW - 0.01) / unit.w))
  const nz = Math.max(1, Math.floor((caseD - 0.01) / unit.d))
  const layers = Math.max(1, Math.min(3, Math.floor(cutH / unit.h)))
  const perCase = nx * nz * layers
  const stock = Math.max(0.15, Math.min(1, f.qty / Math.max(1, f.capacity)))

  for (let k = 0; k < nCut; k++) {
    const lx = -(nCut - 1) * pitchX / 2 + k * pitchX + (roll() - 0.5) * 0.01
    const lz = frontZ + (roll() - 0.5) * 0.01
    cut.push({ lx, lz, ry: (roll() - 0.5) * 0.06 })
    // How much of this case's capacity is still there. The last case is the part one.
    const fraction = k < nCut - 1 ? 1 : Math.max(0.2, stock * nCut - (nCut - 1))
    const want = Math.round(perCase * fraction)
    let placed = 0
    for (let l = 0; l < layers && placed < want; l++) {
      for (let ix = 0; ix < nx && placed < want; ix++) {
        for (let iz = 0; iz < nz && placed < want; iz++) {
          units.push({
            ux: lx - (nx - 1) * unit.w / 2 + ix * unit.w + (roll() - 0.5) * 0.006,
            uy: l * unit.h + unit.h / 2 + 0.004,
            uz: lz - (nz - 1) * unit.d / 2 + iz * unit.d + (roll() - 0.5) * 0.006,
            ry: (roll() - 0.5) * 0.25,
          })
          placed++
        }
      }
    }
  }

  // Back stock: sealed cases of the same product, stacked flat behind the cut ones.
  const nClosed = Math.max(1, Math.min(3, Math.round(3 * stock) || 1))
  const closed: FacePlan['closed'] = []
  for (let k = 0; k < nClosed; k++) {
    closed.push({
      lx: -(nClosed - 1) * (caseW + 0.06) / 2 + k * (caseW + 0.06),
      ly: p.h / 2,
      lz: -deckD / 2 + caseD / 2 + 0.01,
      ry: (roll() - 0.5) * 0.05,
    })
  }

  return { cut, closed, units, form: p.form, unitForm: unit.form }
}

/**
 * The two pick levels of every rack bay with the real product on them. Same label and hit-volume contract as
 * the generic fit-out, so the picker, the inspector and the scanner are unaffected.
 */
export function buildGoodsPickFaces(
  faces: PickFace[], M: Mats, labels: LabelField, labelStart: number, group: THREE.Group, GM: GoodsMaterials,
): THREE.InstancedMesh {
  // Consume the pick-face draw sequence even though none of it is used here. It belongs to the shared RNG
  // stream, and FM-1, the conveyors, inbound, the people and the order trace are all generated after this
  // point — skipping these draws would re-roll every one of them.
  walkPickFaceDraws(faces)

  const { frameDepth, column, levelPitch, beamH, bayPitch } = RACK
  const baseY = (f: PickFace) => (f.level === 0 ? 0 : levelPitch + beamH / 2 + 0.004)
  const tint = new THREE.Color()

  // ---- Plan every face, then group the instances by form so this stays a handful of draw calls ----------
  const plans = faces.map(f => planFace(f, mulberry32(hash(f.id))))

  const cutByForm = new Map<Form, number>()
  const closedByForm = new Map<Form, number>()
  const unitByForm = new Map<UnitForm, number>()
  for (let i = 0; i < faces.length; i++) {
    const pl = plans[i]
    if (!pl) continue
    if (faces[i].fit === 'flow') {
      // A carton-flow lane's front case is opened so pickers can take eaches out of it, so it needs the
      // same tray and product as a hand-stack face. Without this an entire flow aisle still reads as boxes.
      const prod = productForSku(faces[i].sku!)
      const u = unitOf(prod)
      const cutH = Math.min(prod.h * CUT, RACK.levelPitch * 0.62)
      const nx = Math.max(1, Math.floor((prod.w - 0.01) / u.w))
      const nz = Math.max(1, Math.floor((prod.d - 0.01) / u.d))
      const layers = Math.max(1, Math.min(3, Math.floor(cutH / u.h)))
      cutByForm.set(pl.form, (cutByForm.get(pl.form) ?? 0) + FLOW.lanes)
      unitByForm.set(pl.unitForm, (unitByForm.get(pl.unitForm) ?? 0) + FLOW.lanes * nx * nz * layers)
      continue
    }
    if (faces[i].fit === 'bins') { unitByForm.set(pl.unitForm, (unitByForm.get(pl.unitForm) ?? 0) + 6 * 8); continue }
    cutByForm.set(pl.form, (cutByForm.get(pl.form) ?? 0) + pl.cut.length)
    closedByForm.set(pl.form, (closedByForm.get(pl.form) ?? 0) + pl.closed.length)
    unitByForm.set(pl.unitForm, (unitByForm.get(pl.unitForm) ?? 0) + pl.units.length)
  }

  const meshes: THREE.Object3D[] = []
  const mk = <T extends THREE.InstancedMesh>(m: T): T => { meshes.push(m); return m }

  const cutMesh = new Map<Form, THREE.InstancedMesh>()
  for (const form of FORMS) {
    const n = cutByForm.get(form) ?? 0
    if (!n) continue
    const [cw, , cd] = FORM_SIZE[form]
    const cutH = 0.12
    cutMesh.set(form, mk(new THREE.InstancedMesh(trayGeometry(cw, cutH, cd), GM[FORM_MATERIAL[form]], n)))
  }
  const closedMesh = new Map<Form, THREE.InstancedMesh>()
  for (const form of FORMS) {
    const n = closedByForm.get(form) ?? 0
    if (!n) continue
    closedMesh.set(form, mk(new THREE.InstancedMesh(formGeometry(form), GM[FORM_MATERIAL[form]], n)))
  }
  const unitMesh = new Map<UnitForm, THREE.InstancedMesh>()
  for (const uf of UNIT_FORMS) {
    const n = unitByForm.get(uf) ?? 0
    if (!n) continue
    unitMesh.set(uf, mk(new THREE.InstancedMesh(unitGeometry(uf), GM[UNIT_MATERIAL[uf]], n)))
  }

  // ---- Flow lanes: the roller deck is unchanged, but the cases on it are the real ones ----------------
  const laneLen = frameDepth - column * 2
  const slope = Math.atan2(FLOW.rise, laneLen)
  const lanes = mk(new THREE.InstancedMesh(new THREE.PlaneGeometry(FLOW.laneW, laneLen), M.galvanised, faces.filter(f => f.fit === 'flow').length * FLOW.lanes))
  const rails = mk(new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, FLOW.railH, laneLen), M.galvanised, faces.filter(f => f.fit === 'flow').length * (FLOW.lanes + 1)))
  const flowCaseMesh = new Map<Form, THREE.InstancedMesh>()
  const flowByForm = new Map<Form, number>()
  for (let i = 0; i < faces.length; i++) {
    const pl = plans[i]
    if (!pl || faces[i].fit !== 'flow') continue
    flowByForm.set(pl.form, (flowByForm.get(pl.form) ?? 0) + FLOW.lanes * 3)
  }
  for (const form of FORMS) {
    const n = flowByForm.get(form) ?? 0
    if (!n) continue
    flowCaseMesh.set(form, mk(new THREE.InstancedMesh(formGeometry(form), GM[FORM_MATERIAL[form]], n)))
  }

  // ---- Bins -------------------------------------------------------------------------------------------
  const binFaces = faces.filter(f => f.fit === 'bins')
  const binMesh = mk(new THREE.InstancedMesh(makeBinGeometry(), M.binBlue, binFaces.length * 6))

  // ---- Write the instances ----------------------------------------------------------------------------
  const cursors = { cut: new Map<Form, number>(), closed: new Map<Form, number>(), unit: new Map<UnitForm, number>(), flow: new Map<Form, number>() }
  const next = <K,>(m: Map<K, number>, k: K) => { const v = m.get(k) ?? 0; m.set(k, v + 1); return v }
  let li = 0, ri = 0, bni = 0

  for (let i = 0; i < faces.length; i++) {
    const f = faces[i], pl = plans[i]
    const [u, , v] = f.local
    const y0 = baseY(f)
    const ry = f.faceDir === 1 ? 0 : Math.PI

    if (!pl) continue

    if (f.fit === 'bins') {
      const front = v + f.faceDir * (frameDepth / 2 - column - 0.01)
      const sx = BIG_BIN.W / 0.21, sy = BIG_BIN.H / 0.178, sz = BIG_BIN.L / 0.276
      const roll = mulberry32(hash(f.id))
      for (let k = 0; k < 6; k++) {
        const bx = u - 2.5 * (BIG_BIN.W + 0.012) + k * (BIG_BIN.W + 0.012)
        const bz = front - f.faceDir * BIG_BIN.L / 2
        setInstance(binMesh, bni, bx, y0, bz, sx, sy, sz, 0, ry, 0)
        binMesh.setColorAt(bni++, tint.setHSL(0.6, 0.62, 0.34 + (k % 3) * 0.015))
        // Loose eaches heaped in the bin, standing on the bin floor.
        const um = unitMesh.get(pl.unitForm)
        if (!um) continue
        const [uw, uh, ud] = UNIT_SIZE[pl.unitForm]
        const gx = Math.max(1, Math.floor(BIG_BIN.W * 0.72 / uw))
        const gz = Math.max(1, Math.floor(BIG_BIN.L * 0.55 / ud))
        const sorted = Math.floor(gx * gz * 1.6 * Math.max(0.25, Math.min(1, f.qty / f.capacity)))
        let placed = 0
        for (let l = 0; l < 3 && placed < sorted; l++) {
          for (let ix = 0; ix < gx && placed < sorted; ix++) {
            for (let iz = 0; iz < gz && placed < sorted; iz++) {
              const ci = next(cursors.unit, pl.unitForm)
              setInstance(um, ci,
                bx + (ix - (gx - 1) / 2) * uw + (roll() - 0.5) * 0.01,
                y0 + 0.02 + l * uh + uh / 2,
                bz + (iz - (gz - 1) / 2) * ud,
                uw / UNIT_SIZE[pl.unitForm][0], uh / UNIT_SIZE[pl.unitForm][1], ud / UNIT_SIZE[pl.unitForm][2],
                0, (roll() - 0.5) * 0.9, 0)
              um.setColorAt(ci, eachColor(pl.unitForm, ci, tint))
              placed++
            }
          }
        }
      }
      continue
    }

    if (f.fit === 'flow') {
      const y0f = y0 + 0.05
      const tilt = -f.faceDir * slope
      const rx = -Math.PI / 2 + tilt
      const laneSpan = (FLOW.lanes - 1) * (FLOW.laneW + 0.06)
      const cm = flowCaseMesh.get(pl.form)
      const p = f.sku ? productForSku(f.sku) : null
      for (let k = 0; k <= FLOW.lanes; k++) {
        setInstance(rails, ri++, u - laneSpan / 2 - (FLOW.laneW + 0.06) / 2 + k * (FLOW.laneW + 0.06), y0f + FLOW.rise / 2 + FLOW.railH / 2, v, 1, 1, 1, tilt, 0, 0)
      }
      const nq = Math.max(0, Math.min(FLOW.lanes, Math.round(FLOW.lanes * f.qty / f.capacity)))
      for (let k = 0; k < FLOW.lanes; k++) {
        setInstance(lanes, li++, u - laneSpan / 2 + k * (FLOW.laneW + 0.06), y0f + FLOW.rise / 2, v, 1, 1, 1, rx, 0, 0)
        if (!cm || !p) continue
        const queued = k < nq ? 3 : k === nq ? 1 : 0
        const roll = mulberry32(hash(f.id))
        for (let q = 0; q < queued; q++) {
          const dist = 0.05 + p.d / 2 + q * (p.d + 0.02)
          const along = laneLen / 2 - dist
          const cx = u - laneSpan / 2 + k * (FLOW.laneW + 0.06)
          const cy = y0f + FLOW.rise / 2 - along * Math.tan(slope)
          const cz = v + f.faceDir * along
          if (q === 0) {
            // The front case is cut open; the lanes behind it stay sealed.
            const cutH = Math.min(p.h * CUT, levelPitch * 0.62)
            const tray = cutMesh.get(pl.form)
            if (tray) {
              const ci = next(cursors.cut, pl.form)
              setInstance(tray, ci, cx, cy + 0.02, cz, p.w / FORM_SIZE[pl.form][0], cutH / 0.12, p.d / FORM_SIZE[pl.form][2], tilt, 0, 0)
              tray.setColorAt(ci, tint.setRGB(0.86, 0.78, 0.66))
            }
            const um = unitMesh.get(pl.unitForm)
            if (um) {
              const u = unitOf(p)
              const nx = Math.max(1, Math.floor((p.w - 0.01) / u.w))
              const nz = Math.max(1, Math.floor((p.d - 0.01) / u.d))
              const layers = Math.max(1, Math.min(3, Math.floor(cutH / u.h)))
              const want = Math.max(1, Math.round(nx * nz * layers * Math.max(0.2, Math.min(1, f.qty / f.capacity))))
              const scale = unitScaleFor(p, pl.unitForm, UNIT_SIZE[pl.unitForm][0], UNIT_SIZE[pl.unitForm][1], UNIT_SIZE[pl.unitForm][2])
              let placed = 0
              for (let l = 0; l < layers && placed < want; l++) {
                for (let ix = 0; ix < nx && placed < want; ix++) {
                  for (let iz = 0; iz < nz && placed < want; iz++) {
                    const ci = next(cursors.unit, pl.unitForm)
                    setInstance(um, ci,
                      cx - (nx - 1) * u.w / 2 + ix * u.w + (roll() - 0.5) * 0.006,
                      cy + 0.02 + l * u.h + u.h / 2,
                      cz - (nz - 1) * u.d / 2 + iz * u.d + (roll() - 0.5) * 0.006,
                      scale[0], scale[1], scale[2], tilt, (roll() - 0.5) * 0.25, 0)
                    um.setColorAt(ci, eachColor(pl.unitForm, ci, tint))
                    placed++
                  }
                }
              }
            }
          } else {
            const ci = next(cursors.flow, pl.form)
            setInstance(cm, ci, cx, cy + p.h / 2 + 0.01, cz, p.w / FORM_SIZE[pl.form][0], p.h / FORM_SIZE[pl.form][1], p.d / FORM_SIZE[pl.form][2], tilt, 0, 0)
            cm.setColorAt(ci, tint.setRGB(0.95, 0.86, 0.74))
          }
        }
      }
      continue
    }

    // --- Hand-stack: cut cases with the eaches standing in them, sealed back stock behind --------------
    const cm = cutMesh.get(pl.form)
    const sm = closedMesh.get(pl.form)
    const um = unitMesh.get(pl.unitForm)
    const p = f.sku ? productForSku(f.sku) : null
    if (!p) continue
    const cutH = Math.min(p.h * CUT, RACK.levelPitch * 0.62)
    const sx = p.w / FORM_SIZE[pl.form][0]
    const syc = cutH / 0.12
    const sz = p.d / FORM_SIZE[pl.form][2]

    for (const c of pl.cut) {
      if (cm) {
        const ci = next(cursors.cut, pl.form)
        setInstance(cm, ci, u + c.lx, y0, v + c.lz, sx, syc, sz, 0, c.ry, 0)
        cm.setColorAt(ci, tint.setRGB(0.86, 0.78, 0.66))
      }
    }
    for (const c of pl.closed) {
      if (!sm) continue
      const ci = next(cursors.closed, pl.form)
      setInstance(sm, ci, u + c.lx, y0 + c.ly, v + c.lz, p.w / FORM_SIZE[pl.form][0], p.h / FORM_SIZE[pl.form][1], p.d / FORM_SIZE[pl.form][2], 0, c.ry, 0)
      sm.setColorAt(ci, tint.setRGB(0.92, 0.84, 0.72))
    }
    if (um) {
      const [gw, gh, gd] = UNIT_SIZE[pl.unitForm]
      const scale = unitScaleFor(p, pl.unitForm, gw, gh, gd)
      for (const pu of pl.units) {
        const ci = next(cursors.unit, pl.unitForm)
        setInstance(um, ci, u + pu.ux, y0 + pu.uy, v + pu.uz, scale[0], scale[1], scale[2], 0, pu.ry, 0)
        // Retail print and label colour varies between eaches; keep it inside the product's palette.
        um.setColorAt(ci, eachColor(pl.unitForm, ci, tint))
      }
    }
  }

  for (const m of meshes) { m.castShadow = true; m.receiveShadow = true; group.add(m) }
  trim(cutMesh, cursors.cut); trim(closedMesh, cursors.closed); trim(unitMesh, cursors.unit); trim(flowCaseMesh, cursors.flow)
  lanes.count = li; rails.count = ri; binMesh.count = bni

  // --- Labels on the level-B front beam: the floor face's label low, level B's above it ----------------
  const beamFront = (f: PickFace) => f.local[2] + f.faceDir * (frameDepth / 2 - column + 0.003)
  faces.forEach((f, i) => {
    const ry = f.faceDir === 1 ? 0 : Math.PI
    labels.set(labelStart + i, f.id, f.local[0] + 0.4, levelPitch + (f.level === 0 ? -0.026 : 0.026), beamFront(f), ry, f.sku ?? undefined)
  })

  // --- Hit volumes: one per face, proud of the bay volume so the near hit resolves to the face ----------
  const volumes = new THREE.InstancedMesh(new THREE.BoxGeometry(bayPitch - 0.1, levelPitch - 0.2, frameDepth + 0.3), M.hit, faces.length)
  faces.forEach((f, i) => setInstance(volumes, i, f.local[0], f.local[1], f.local[2]))
  volumes.userData.resolve = (id: number) => faces[id]
  group.add(volumes)
  return volumes
}

/** Scale the unit's representative geometry to this product's real each. */
function unitScaleFor(p: Product, _uf: UnitForm, gw: number, gh: number, gd: number): [number, number, number] {
  const u = unitOf(p)
  return [u.w / gw, u.h / gh, u.d / gd]
}

function trim<K>(meshes: Map<K, THREE.InstancedMesh>, used: Map<K, number>) {
  for (const [k, m] of meshes) m.count = used.get(k) ?? 0
}
