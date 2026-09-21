// Real goods for the racking: case geometry by package form, and the board/plastic materials that go on it.
//
// Every case here is chamfered. A razor 90-degree edge is the loudest CG tell there is — real board has a
// crease that catches light. The chamfer is built as the convex hull of 24 points (8 corners x 3 inward
// offsets), which lands on exactly 44 triangles with guaranteed-correct winding and flat normals. For
// comparison, three's RoundedBoxGeometry at one segment costs 108 — 9x a plain box, and about 2.8M extra
// triangles across RES-B alone.
//
// Corrugation is a normal map, not geometry: B-flute is 3 mm at ~154 flutes/m, which never resolves as
// geometry at the distance you actually view a rack from.

import * as THREE from 'three'
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'
import { mergeAny, boxAt, cylAt } from './util'
import { PALLET } from '../facility'
import type { Form, UnitForm } from '../catalog'

export type V3 = [number, number, number]

// ---- Chamfered box -------------------------------------------------------------------------------------------

/** The 24 vertices of a box with every edge cut back by `r`. */
function chamferPoints(w: number, h: number, d: number, r: number): THREE.Vector3[] {
  const X = w / 2, Y = h / 2, Z = d / 2
  const e = Math.min(r, Math.min(X, Math.min(Y, Z)) * 0.85)
  const pts: THREE.Vector3[] = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(new THREE.Vector3(sx * X, sy * (Y - e), sz * (Z - e)))
    pts.push(new THREE.Vector3(sx * (X - e), sy * Y, sz * (Z - e)))
    pts.push(new THREE.Vector3(sx * (X - e), sy * (Y - e), sz * Z))
  }
  return pts
}

/**
 * Assign UVs from world metres, per triangle, by the triangle's dominant normal axis.
 *
 * Vertical faces (dominant X or Z) get u = the horizontal axis and v = Y, so the flute lines in the
 * corrugation map run vertically — which is how flutes sit in a real carton wall. Horizontal faces get
 * u = X, v = Z. UVs are metres, so the map's `repeat` alone controls flute spacing.
 */
function assignWorldUVs(g: THREE.BufferGeometry) {
  const pos = g.attributes.position
  const nrm = g.attributes.normal
  const uv = new Float32Array(pos.count * 2)
  const comp = (i: number, a: number) => a === 0 ? pos.getX(i) : a === 1 ? pos.getY(i) : pos.getZ(i)
  for (let t = 0; t < pos.count; t += 3) {
    const nx = Math.abs(nrm.getX(t)), ny = Math.abs(nrm.getY(t)), nz = Math.abs(nrm.getZ(t))
    let ua: number, va: number
    if (ny >= nx && ny >= nz) { ua = 0; va = 2 }            // top / bottom: u = x, v = z
    else { ua = nz >= nx ? 0 : 2; va = 1 }                  // walls: horizontal u, vertical v
    for (let k = 0; k < 3; k++) {
      const i = t + k
      uv[i * 2] = comp(i, ua)
      uv[i * 2 + 1] = comp(i, va)
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/** A box with chamfered edges: 44 triangles, correct normals, UVs in metres. */
export function chamferedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const g = new ConvexGeometry(chamferPoints(w, h, d, r))
  assignWorldUVs(g)
  return g
}

// ---- Procedural maps -----------------------------------------------------------------------------------------

let corrugationTex: THREE.CanvasTexture | null = null

/**
 * Corrugated flute relief as a tangent-space normal map. 16 flutes across a 64 mm tile = 4 mm pitch,
 * the C-flute standard. Drawn once and shared by every board material.
 */
export function corrugationMap(): THREE.CanvasTexture {
  if (corrugationTex) return corrugationTex
  const W = 128, H = 32, PITCH = 8 // px per flute at this resolution
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(W, H)
  for (let x = 0; x < W; x++) {
    // A flute is a half-round ridge: the surface normal tilts through +/- the slope angle.
    const t = ((x % PITCH) / PITCH) * Math.PI * 2
    const slope = Math.cos(t) * 0.55
    for (let y = 0; y < H; y++) {
      // Break up the flutes along their length so the tile does not read as a printed stripe.
      const wobble = Math.sin(x * 0.7 + y * 1.9) * 0.035
      const i = (y * W + x) * 4
      img.data[i] = Math.round(128 + 127 * Math.max(-1, Math.min(1, slope + wobble)))
      img.data[i + 1] = 128
      img.data[i + 2] = 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / 0.064, 1 / 0.064) // one tile per 64 mm
  t.anisotropy = 8
  corrugationTex = t
  return t
}

let printBandTex: THREE.CanvasTexture | null = null

/** Flexo-printed panel band for printed liner board — a real print block, not a per-case label. */
function printBandMap(): THREE.CanvasTexture {
  if (printBandTex) return printBandTex
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#e8e3d6'; ctx.fillRect(0, 0, S, S)
  // A printed block with a rule and a knock-out — the shape of real flexo print on a shipper.
  ctx.fillStyle = '#2c4f7c'; ctx.fillRect(10, 14, 108, 26)
  ctx.fillStyle = '#e8e3d6'; ctx.fillRect(16, 20, 62, 14)
  ctx.fillStyle = '#2c4f7c'; ctx.fillRect(10, 46, 46, 8)
  ctx.fillStyle = '#b23a2e'; ctx.fillRect(62, 46, 30, 8)
  ctx.fillStyle = '#3a3a3a'
  for (let i = 0; i < 22; i++) ctx.fillRect(10 + i * 5, 62, i % 3 === 0 ? 3 : 1, 30) // a barcode-ish print block
  ctx.fillStyle = '#2c4f7c'; ctx.fillRect(10, 98, 108, 4)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.repeat.set(1 / 0.32, 1 / 0.24)
  t.anisotropy = 8
  printBandTex = t
  return t
}

// ---- Materials -----------------------------------------------------------------------------------------------

export interface GoodsMaterials {
  kraft: THREE.MeshStandardMaterial
  bleached: THREE.MeshStandardMaterial
  printed: THREE.MeshStandardMaterial
  poly: THREE.MeshStandardMaterial
  plastic: THREE.MeshStandardMaterial
  tape: THREE.MeshStandardMaterial
  cornerBoard: THREE.MeshStandardMaterial
  film: THREE.MeshPhysicalMaterial
  pallet: THREE.MeshStandardMaterial
  /** Tinplate for cans; distinguishable from moulded plastic at a glance. */
  metal: THREE.MeshStandardMaterial
  /** Polycarbonate hardside luggage: the one glossy, clear-coated shell in the catalogue. */
  shell: THREE.MeshPhysicalMaterial
  /** Matte vulcanised rubber, for balls. */
  rubber: THREE.MeshStandardMaterial
}

/**
 * Every each form the catalogue can produce.
 *
 * Declared once, here, because a module that builds its instance meshes by iterating this list silently
 * renders NOTHING for a form it is missing — the placement loop finds no mesh and skips the each without
 * erroring. It lived in two modules before, and adding a form to one of them emptied the other's shelves.
 */
export const UNIT_FORMS: UnitForm[] = ['box', 'bottle', 'roll', 'pouch', 'tub', 'can', 'pack', 'suitcase', 'ball']

/**
 * Per-instance colour, by form.
 *
 * Most eaches are a printed carton: the variation is a slight shade, because a shelf of identical boxes is
 * not one flat colour but is still one colour. Luggage is the exception — a luggage wall is genuinely
 * multi-coloured, and the colour is most of what makes a case read as a case rather than a box, so those
 * forms draw from a real palette (black, silver, navy, oxblood, teal) instead.
 */
export const UNIT_PALETTE: Partial<Record<UnitForm, number[]>> = {
  suitcase: [0x2b3038, 0x8d97a2, 0x243f5c, 0x6f2a2a, 0x2a4a45, 0x1b1d21],
}

export function eachColor(form: UnitForm, i: number, out: THREE.Color): THREE.Color {
  const pal = UNIT_PALETTE[form]
  if (pal) return out.setHex(pal[i % pal.length])
  const shade = 0.88 + 0.22 * (((i * 2654435761) >>> 8) % 100) / 100
  return out.setRGB(shade, shade * 0.99, shade * 0.96)
}

/** Which material an each is made of, by its form. */
export const UNIT_MATERIAL: Record<UnitForm, keyof GoodsMaterials> = {
  box: 'printed',
  bottle: 'plastic',
  roll: 'kraft',
  pouch: 'poly',
  tub: 'plastic',
  can: 'metal',
  pack: 'printed',
  suitcase: 'shell',
  ball: 'rubber',
}

export function makeGoodsMaterials(): GoodsMaterials {
  const corr = corrugationMap()
  const board = (color: number, roughness: number, map?: THREE.Texture) => new THREE.MeshStandardMaterial({
    color, map, roughness, metalness: 0,
    normalMap: corr,
    normalScale: new THREE.Vector2(0.85, 0.85),
  })
  return {
    // Unbleached kraft liner, the default shipper.
    kraft: board(0xb98f5e, 0.94),
    // Bleached white liner, used for retail and light goods.
    bleached: board(0xd9d3c4, 0.9),
    // Printed liner: same board, flexo print block.
    printed: board(0xe8e3d6, 0.78, printBandMap()),
    // Poly bag / shrink: soft, semi-gloss, no flute relief.
    poly: new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.42, metalness: 0 }),
    // Moulded plastic for tubs, rolls and drums.
    plastic: new THREE.MeshStandardMaterial({ color: 0xdfe0e2, roughness: 0.38, metalness: 0.02 }),
    // Pressure-sensitive carton sealing tape, 48 mm, semi-gloss.
    tape: new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.34, metalness: 0 }),
    // Kraft angle board at the corners of a wrapped load.
    cornerBoard: new THREE.MeshStandardMaterial({ color: 0xb08a58, roughness: 0.95, metalness: 0 }),
    // Stretch film: a thin, high-clarity film under tension.
    film: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.12, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false, side: THREE.DoubleSide,
    }),
    // Kiln-dried hardwood, as a GMA pallet is actually made.
    pallet: new THREE.MeshStandardMaterial({ color: 0xa88656, roughness: 0.92, metalness: 0 }),
    // Lacquered tinplate.
    metal: new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.28, metalness: 0.85 }),
    // Moulded polycarbonate: the shell is the only thing in the catalogue that reads as gloss plastic.
    shell: new THREE.MeshPhysicalMaterial({
      color: 0x39434f, roughness: 0.26, metalness: 0.04,
      clearcoat: 0.85, clearcoatRoughness: 0.14,
    }),
    // Vulcanised rubber, matte, with the grain that stops a ball reading as a sphere.
    rubber: new THREE.MeshStandardMaterial({ color: 0xc05a1e, roughness: 0.78, metalness: 0 }),
  }
}

/** GMA 48x40 stringer pallet: 3 stringers, 7 top deck boards, 3 bottom boards. Origin at the bottom centre. */
export function makePalletGeometry(): THREE.BufferGeometry {
  const { L, W, H, boardT, stringerH, stringerW } = PALLET
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-W / 2 + stringerW / 2, 0, W / 2 - stringerW / 2]) parts.push(boxAt(stringerW, stringerH, L, x, boardT + stringerH / 2, 0))
  const topN = 7, topW = 0.14
  for (let i = 0; i < topN; i++) parts.push(boxAt(W, boardT, topW, 0, H - boardT / 2, -L / 2 + topW / 2 + i * ((L - topW) / (topN - 1))))
  for (const z of [-L / 2 + 0.07, 0, L / 2 - 0.07]) parts.push(boxAt(W, boardT, topW, 0, boardT / 2, z))
  const g = mergeAny(parts)
  parts.forEach(p => p.dispose())
  return g
}

/** A 50 x 50 mm kraft angle board, as used on the vertical corners of a wrapped load. */
export function makeCornerBoardGeometry(h: number): THREE.BufferGeometry {
  const arm = 0.05, t = 0.003
  const parts = [
    boxAt(t, h, arm, -arm / 2 + t / 2, 0, 0),
    boxAt(arm, h, t, 0, 0, -arm / 2 + t / 2),
  ]
  const g = mergeAny(parts)
  parts.forEach(p => p.dispose())
  return g
}

/** A box with no top or bottom face: the shape a stretch-film band actually takes around a load. */
export function openBoxShell(): THREE.BufferGeometry {
  const parts = [
    boxAt(1, 1, 0.001, 0, 0, 0.5), boxAt(1, 1, 0.001, 0, 0, -0.5),
    boxAt(0.001, 1, 1, 0.5, 0, 0), boxAt(0.001, 1, 1, -0.5, 0, 0),
  ]
  const g = mergeAny(parts)
  parts.forEach(p => p.dispose())
  return g
}

// ---- Form geometry -------------------------------------------------------------------------------------------
//
// One representative geometry per form, scaled per instance to the case's real dimensions. Sizes within a
// form vary by well under 2x, so the chamfer and the corrugation pitch stay visually right; a single
// geometry per form keeps this to one draw call per form rather than one per product.

/** Representative case size per form (metres), taken from the median of the catalogue. */
export const FORM_SIZE: Record<Form, V3> = {
  rsc: [0.40, 0.20, 0.28],
  shoebox: [0.35, 0.13, 0.23],
  polybag: [0.38, 0.12, 0.28],
  paperbag: [0.60, 0.15, 0.40],
  tub: [0.30, 0.28, 0.30],
  roll: [0.15, 0.68, 0.15],
  tray: [0.30, 0.22, 0.30],
  flat: [0.70, 0.12, 0.40],
  mailer: [0.24, 0.05, 0.18],
  drum: [0.32, 0.30, 0.32],
}

const CHAMFER: Record<Form, number> = {
  rsc: 0.006, flat: 0.005, shoebox: 0.004, mailer: 0.010,
  polybag: 0.030, paperbag: 0.018, tray: 0.010, tub: 0.004, roll: 0.003, drum: 0.005,
}

/** Which forms the board materials apply to, versus plastic. */
export const FORM_MATERIAL: Record<Form, keyof GoodsMaterials> = {
  rsc: 'kraft', flat: 'kraft', shoebox: 'printed', mailer: 'kraft',
  polybag: 'poly', paperbag: 'kraft', tray: 'poly', tub: 'plastic', roll: 'kraft', drum: 'plastic',
}

/**
 * Detail geometry that shares the body's material and so can be merged into it: a shoe box lid, a tub
 * rim, a drum rolling rib. The case tape is NOT here — it has its own semi-gloss material and would
 * bleed into the board if merged.
 */
function bodyExtras(form: Form): THREE.BufferGeometry[] {
  const [w, h, d] = FORM_SIZE[form]
  const parts: THREE.BufferGeometry[] = []
  if (form === 'shoebox') {
    // Lid: a shallow cap that overhangs the body, which is how a two-piece shoe box reads.
    const lid = chamferedBox(w + 0.008, h * 0.30, d + 0.008, 0.004)
    lid.translate(0, h / 2 - h * 0.15, 0)
    parts.push(lid)
  }
  if (form === 'tub' || form === 'drum') {
    // Moulded lid rim, slightly proud of the body.
    const rim = new THREE.CylinderGeometry(w / 2 * 1.03, w / 2 * 1.03, 0.016, 12)
    rim.translate(0, h / 2 - 0.008, 0)
    parts.push(rim)
  }
  if (form === 'drum') {
    for (const y of [-h * 0.2, h * 0.2]) {
      const rib = new THREE.CylinderGeometry(w / 2 * 1.02, w / 2 * 1.02, 0.010, 12)
      rib.translate(0, y, 0)
      parts.push(rib)
    }
  }
  return parts
}

const cachedGeoms: Partial<Record<Form, THREE.BufferGeometry>> = {}
const cachedTape: Partial<Record<Form, THREE.BufferGeometry>> = {}

/** The shared body geometry for a package form. Built once, instanced for every case of that form. */
export function formGeometry(form: Form): THREE.BufferGeometry {
  const hit = cachedGeoms[form]
  if (hit) return hit
  const [w, h, d] = FORM_SIZE[form]
  let g: THREE.BufferGeometry
  if (form === 'tub' || form === 'drum' || form === 'roll') {
    g = new THREE.CylinderGeometry(w / 2, w / 2 * (form === 'tub' ? 0.96 : 1), h, 12, 1)
    assignCylinderUVs(g, w, h)
  } else {
    g = chamferedBox(w, h, d, CHAMFER[form])
  }
  const extras = bodyExtras(form)
  if (extras.length) {
    g = mergeAny([g, ...extras])
    extras.forEach(e => e.dispose())
  }
  cachedGeoms[form] = g
  return g
}

/**
 * 48 mm pressure-sensitive carton sealing tape down the RSC centre seam. Its own mesh, because it is
 * semi-gloss where the board is matte — the two cannot share a material. Returns null for every form
 * that is not a regular slotted container.
 */
export function formTape(form: Form): THREE.BufferGeometry | null {
  if (form !== 'rsc') return null
  const hit = cachedTape[form]
  if (hit) return hit
  const [w, h] = FORM_SIZE[form]
  const tape = new THREE.PlaneGeometry(w * 0.62, 0.048)
  tape.rotateX(-Math.PI / 2)
  tape.translate(0, h / 2 + 0.0004, 0)
  cachedTape[form] = tape
  return tape
}

// ---- The each ------------------------------------------------------------------------------------------------
//
// What a picker actually takes off the shelf, visible only where a case is cut open or the goods are loose.
// Built at a representative size per form and scaled per instance, same as the cases, so this is one draw
// call per unit form rather than one per product.

export const UNIT_SIZE: Record<UnitForm, V3> = {
  box: [0.15, 0.12, 0.10],
  bottle: [0.08, 0.24, 0.08],
  roll: [0.11, 0.26, 0.11],
  pouch: [0.24, 0.07, 0.18],
  tub: [0.15, 0.16, 0.15],
  can: [0.10, 0.14, 0.10],
  pack: [0.30, 0.04, 0.22],
  // Carry-on 22 x 14 x 9 in, as it lies on its back in its own shipper: width 0.58 is the case height.
  suitcase: [0.58, 0.25, 0.38],
  ball: [0.24, 0.24, 0.24],
}

/** Radial segments for the round forms. 8 keeps a shelf of bottles affordable; the caps and labels come
 *  from the material, not from more segments. */
const UNIT_SEG = 8

const cachedUnits: Partial<Record<UnitForm, THREE.BufferGeometry>> = {}

export function unitGeometry(form: UnitForm): THREE.BufferGeometry {
  const hit = cachedUnits[form]
  if (hit) return hit
  const [w, h, d] = UNIT_SIZE[form]
  let g: THREE.BufferGeometry
  switch (form) {
    case 'bottle': {
      // Base to closure: body, a tapered shoulder, a short neck and the screw cap, stacked so the whole
      // thing spans exactly the each's height. The shoulder is the part that makes a cylinder read as a
      // bottle rather than a tin — an insulated bottle is a straight wall for three quarters of its height
      // and then turns in hard over the last tenth.
      const R = w / 2
      const bodyH = h * 0.74, shoulderH = h * 0.10, neckH = h * 0.06, capH = h * 0.10
      const parts: THREE.BufferGeometry[] = []
      let y = -h / 2
      const body = new THREE.CylinderGeometry(R, R * 0.97, bodyH, UNIT_SEG)
      body.translate(0, y + bodyH / 2, 0); parts.push(body); y += bodyH
      const shoulder = new THREE.CylinderGeometry(R * 0.42, R, shoulderH, UNIT_SEG)
      shoulder.translate(0, y + shoulderH / 2, 0); parts.push(shoulder); y += shoulderH
      const neck = new THREE.CylinderGeometry(R * 0.40, R * 0.42, neckH, UNIT_SEG)
      neck.translate(0, y + neckH / 2, 0); parts.push(neck); y += neckH
      // The closure is the widest part above the shoulder, which is what the eye picks up as a cap.
      const cap = new THREE.CylinderGeometry(R * 0.48, R * 0.48, capH, UNIT_SEG)
      cap.translate(0, y + capH / 2, 0); parts.push(cap)
      // A label band proud of the body wall, at the height a real one wraps.
      const label = new THREE.CylinderGeometry(R * 1.025, R * 1.025, bodyH * 0.40, UNIT_SEG)
      label.translate(0, -h / 2 + bodyH * 0.52, 0); parts.push(label)
      g = mergeAny(parts)
      parts.forEach(x => x.dispose())
      break
    }
    case 'roll':
    case 'tub':
    case 'can':
      g = new THREE.CylinderGeometry(w / 2, w / 2, h, UNIT_SEG)
      assignCylinderUVs(g, w, h)
      break
    case 'pouch':
      // Soft goods slump; a large chamfer is what separates a bag from a box at a glance.
      g = chamferedBox(w, h, d, Math.min(h * 0.42, w * 0.16))
      break
    case 'suitcase': {
      // A hardside spinner lying on its back in its shipper, which is how one actually sits on a pallet: the
      // 22 x 14 in front face is up, the 9 in thickness is the height, and the four spinner wheels stand
      // proud of the long sides. Built hollow-free — a solid shell is indistinguishable at this size and
      // costs a fraction of a modelled interior.
      const r = Math.min(h * 0.42, w * 0.06)          // the shell's edge radius, ~25 mm on a real case
      const body = chamferedBox(w, h, d, r)
      body.translate(0, h / 2, 0)
      const parts: THREE.BufferGeometry[] = [body]
      // The clamshell split: a proud band around the case at mid-thickness, which is what the zip and its
      // extrusion sit on. Slightly oversized so it reads as a seam rather than a stripe.
      const band = chamferedBox(w * 1.006, h * 0.07, d * 1.006, r * 0.4)
      band.translate(0, h * 0.52, 0)
      parts.push(band)
      // Four spinner wheels, axles across the case, standing proud of both long sides.
      const wr = h * 0.11, wl = d * 0.055
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        parts.push(cylAt(wr, wl, sx * (w / 2 - wr * 1.6), h * 0.5, sz * (d / 2 + wl * 0.34), 'x', 8))
      }
      // Telescoping handle, retracted: the two tubes lie flat along the case's short end.
      for (const sz of [-1, 1]) {
        parts.push(cylAt(w * 0.012, d * 0.1, -w / 2 + w * 0.05, h * 0.74, sz * d * 0.24, 'z', 6))
      }
      // Top and side carry handles.
      parts.push(boxAt(w * 0.012, h * 0.02, d * 0.30, -w / 2 - w * 0.008, h * 0.78, 0))
      parts.push(boxAt(w * 0.26, h * 0.02, d * 0.012, 0, h * 0.86, d / 2 + d * 0.008))
      g = mergeAny(parts)
      parts.forEach(p => p.dispose())
      break
    }
    case 'ball':
      // A ball is the one each that is not box-like at all: a low-poly sphere reads correctly at shelf
      // distance and the material carries the grain.
      g = new THREE.SphereGeometry(d / 2, 12, 8)
      break
    case 'pack':
      g = chamferedBox(w, h, d, 0.003)
      break
    default:
      g = chamferedBox(w, h, d, 0.004)
  }
  cachedUnits[form] = g
  return g
}

/** Cylinder UVs in metres: u wraps the circumference, v runs up the side so flutes stay vertical. */
function assignCylinderUVs(g: THREE.BufferGeometry, diameter: number, height: number) {
  const uv = g.attributes.uv
  const circ = Math.PI * diameter
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * height)
  }
  uv.needsUpdate = true
}
