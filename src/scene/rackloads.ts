// Pallet loads that match what the pallet actually holds.
//
// Before this, every load was the same random tie-pattern of unit boxes, built without reference to the
// SKU on the slot — a pallet of cat litter and a pallet of yoga mats came out identical. Here the load is
// derived from `productForSku(slot.sku)`: case dimensions, case count and stacking pattern all follow the
// real product.
//
// The stacking patterns are not arbitrary. Fibre Box Association testing against single-box compression
// gives columnar (corners aligned) 0.84 — strongest, least stable; interlocked 0.49 — most stable but a
// few percent fewer cases; pinwheel ~20% below column. So heavy, non-crushable goods column-stack and
// light crushable goods interlock, which is what a warehouse actually does.
//
// RNG: everything here draws from its own stream, seeded per LPN. The facility's inventory comes off one
// shared stream that every dock, trailer, station and associate also draws from, so taking even one draw
// from it here would re-roll the entire rest of the twin.

import * as THREE from 'three'
import { PALLET, RACK } from '../facility'
import type { Bay } from '../facility'
import { productForSku, type Product, type Form } from '../catalog'
import { mulberry32 } from '../rng'
import { setInstance } from './util'
import {
  formGeometry, formTape, FORM_SIZE, FORM_MATERIAL, makeGoodsMaterials, makePalletGeometry,
  makeCornerBoardGeometry, openBoxShell, type GoodsMaterials,
} from './goods'

/** Everything Racking needs from a set of rack contents, so a content source can be swapped wholesale. */
export interface RackContent {
  meshes: THREE.Object3D[]
  /** One per occupied reserve slot, in bay-then-slot order — this is also the LPN label index. */
  palletCount: number
  /** World position of pallet `i`, already including any extract offset. */
  palletPos(i: number): [number, number, number]
  /** Re-place every instance of any pallet whose extract offset changed. */
  refresh(offsets: Float32Array): void
  /** Inventory layer: tint loads by how full their bay is, or restore the base board colours. */
  setLayer(layer: string): void
}

// Limits a real unit load respects.
const MAX_LOAD_H = 1.35    // m — must clear the 1.75 m beam pitch with 100 mm of lift clearance
const MAX_LOAD_KG = 1000   // a heavy load on a 108" step beam

const STRIDE = 7           // x y z sx sy sz ry per instance

const FORMS: Form[] = ['rsc', 'flat', 'shoebox', 'mailer', 'polybag', 'paperbag', 'tray', 'tub', 'roll', 'drum']

interface CasePlacement {
  form: Form
  lx: number; ly: number; lz: number   // local to the pallet deck top
  sx: number; sy: number; sz: number   // instance scale against the form's representative size
  ry: number
  tr: number; tg: number; tb: number   // base tint
}

interface PalletData {
  x: number; y: number; z: number
  fill: number
  wrapped: boolean
  loadH: number; loadW: number; loadD: number
  cases: CasePlacement[]
}

/** Per-mesh instance store: base transforms, which pallet each instance belongs to, and base colours. */
interface Layer {
  mesh: THREE.InstancedMesh
  base: Float32Array
  pallet: Int32Array
  count: number
  /** rgb per instance, captured at build time. Empty for meshes without per-instance colour. */
  color: Float32Array
}

interface Load {
  cases: CasePlacement[]
  /** Widest footprint any layer reaches, from the last built layer's span. */
  spanX: number
  spanZ: number
  /** Top of the top case above the deck = layers x case height. */
  height: number
}

/**
 * Lay out one pallet of a product. Returns placements local to the deck, y = 0 at the deck surface.
 */
function fillPallet(p: Product, roll: () => number): Load {
  const out: CasePlacement[] = []
  let maxSpanX = 0, maxSpanZ = 0
  const { w, h, d, pattern, kg } = p
  if (w <= 0 || h <= 0 || d <= 0) return { cases: out, spanX: 0, spanZ: 0, height: 0 }

  // Cases must fit the 48x40 deck with no overhang — overhang is the single most costly loading fault.
  const colX = Math.max(1, Math.floor(PALLET.W / w))
  const colZ = Math.max(1, Math.floor(PALLET.L / d))
  const rotX = Math.max(1, Math.floor(PALLET.W / d))
  const rotZ = Math.max(1, Math.floor(PALLET.L / w))

  const perLayer = colX * colZ
  const byHeight = Math.max(1, Math.floor(MAX_LOAD_H / h))
  const byWeight = Math.max(1, Math.floor(MAX_LOAD_KG / Math.max(0.1, kg * perLayer)))
  const layers = Math.max(1, Math.min(byHeight, byWeight, 12))

  for (let l = 0; l < layers; l++) {
    let rotated = false, shift = 0
    switch (pattern) {
      case 'column': break
      case 'interlock': rotated = l % 2 === 1; break
      case 'pinwheel': rotated = l % 2 === 1; shift = l % 4 >= 2 ? Math.min(w, d) * 0.5 : 0; break
      // Column-stack the lower half for compression strength, interlock the upper half for stability.
      case 'hybrid': rotated = l >= Math.ceil(layers / 2) && l % 2 === 1; break
    }
    const nx = rotated ? rotX : colX
    const nz = rotated ? rotZ : colZ
    const cw = rotated ? d : w
    const cd = rotated ? w : d
    const spanX = nx * cw, spanZ = nz * cd
    // Footprint is the centred span plus any pattern shift.
    maxSpanX = Math.max(maxSpanX, spanX + shift)
    maxSpanZ = Math.max(maxSpanZ, spanZ)
    const jit = 0.985 + roll() * 0.03
    const [tr, tg, tb] = tintFor(p, roll)

    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      // A part-built top layer loses a case now and then, exactly as a real load does.
      if (l === layers - 1 && roll() < 0.08) continue
      out.push({
        form: p.form,
        lx: -spanX / 2 + cw / 2 + ix * cw + shift + (roll() - 0.5) * 0.012,
        ly: h / 2 + l * h,
        lz: -spanZ / 2 + cd / 2 + iz * cd + (roll() - 0.5) * 0.012,
        sx: cw / FORM_SIZE[p.form][0] * jit,
        sy: h / FORM_SIZE[p.form][1] * jit,
        sz: cd / FORM_SIZE[p.form][2] * jit,
        ry: (rotated ? Math.PI / 2 : 0) + (roll() - 0.5) * 0.05,
        tr, tg, tb,
      })
    }
  }
  return { cases: out, spanX: maxSpanX, spanZ: maxSpanZ, height: layers * h }
}

/** Board colour varies case to case; printed liner reads lighter than raw kraft. */
function tintFor(p: Product, roll: () => number): [number, number, number] {
  const v = 0.92 + roll() * 0.14
  const printed = p.board === 'printed', bleach = p.board === 'bleached'
  const r = (bleach ? 1.05 : printed ? 1.0 : 0.96) * v
  const g = (bleach ? 1.03 : printed ? 0.99 : 0.88) * v
  const b = (bleach ? 1.0 : printed ? 0.98 : 0.76) * v
  return [Math.min(1.25, r), Math.min(1.25, g), Math.min(1.25, b)]
}

const hash = (s: string): number => {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h >>> 0
}

/**
 * Build the real contents for a module's bays, from the products their slots actually hold.
 */
export function buildDetailedContent(bays: Bay[], M: GoodsMaterials = makeGoodsMaterials()): RackContent {
  // ---- Pass 1: read the inventory, work out every load --------------------------------------------
  const pallets: PalletData[] = []
  let wrappedCount = 0

  for (const bay of bays) {
    for (const s of bay.slots) {
      if (!s.lpn) continue
      const p = productForSku(s.sku ?? s.lpn)
      const roll = mulberry32(hash(s.lpn))
      const top = s.level === 0 ? 0 : s.level * RACK.levelPitch + RACK.beamH / 2
      const load = fillPallet(p, roll)
      pallets.push({
        x: bay.local[0] + (s.pos ? 0.56 : -0.56),
        y: top,
        z: bay.local[2],
        fill: bay.fill,
        wrapped: s.wrapped && load.cases.length > 0,
        loadH: load.height,
        loadW: Math.min(PALLET.W, load.spanX),
        loadD: Math.min(PALLET.L, load.spanZ),
        cases: load.cases,
      })
      if (s.wrapped) wrappedCount++
    }
  }

  // ---- Build the meshes ---------------------------------------------------------------------------
  const meshes: THREE.Object3D[] = []
  const layers: Layer[] = []

  const palletMesh = new THREE.InstancedMesh(makePalletGeometry(), M.pallet, Math.max(1, pallets.length))
  palletMesh.count = pallets.length
  palletMesh.castShadow = palletMesh.receiveShadow = true
  meshes.push(palletMesh)
  const palletLayer: Layer = { mesh: palletMesh, base: new Float32Array(pallets.length * STRIDE), pallet: new Int32Array(pallets.length), count: pallets.length, color: new Float32Array(0) }
  layers.push(palletLayer)
  for (let i = 0; i < pallets.length; i++) {
    const o = i * STRIDE
    palletLayer.base[o] = pallets[i].x; palletLayer.base[o + 1] = pallets[i].y; palletLayer.base[o + 2] = pallets[i].z
    palletLayer.base[o + 3] = palletLayer.base[o + 4] = palletLayer.base[o + 5] = 1
    palletLayer.base[o + 6] = 0
    palletLayer.pallet[i] = i
  }

  // One instanced mesh per package form. Draw calls stay at ~10 for the module instead of one per product.
  const counts = new Map<Form, number>()
  for (const pl of pallets) for (const c of pl.cases) counts.set(c.form, (counts.get(c.form) ?? 0) + 1)

  const caseLayerOf = new Map<Form, Layer>()
  for (const form of FORMS) {
    const n = counts.get(form) ?? 0
    if (!n) continue
    const mesh = new THREE.InstancedMesh(formGeometry(form), M[FORM_MATERIAL[form]], n)
    mesh.count = n
    mesh.castShadow = mesh.receiveShadow = true
    meshes.push(mesh)
    const layer: Layer = { mesh, base: new Float32Array(n * STRIDE), pallet: new Int32Array(n), count: n, color: new Float32Array(n * 3) }
    layers.push(layer)
    caseLayerOf.set(form, layer)
  }

  // 48 mm carton sealing tape, its own semi-gloss material, riding the RSC carton tops.
  const tapeCount = counts.get('rsc') ?? 0
  let tapeLayer: Layer | null = null
  const tapeGeo = formTape('rsc')
  if (tapeCount && tapeGeo) {
    const mesh = new THREE.InstancedMesh(tapeGeo, M.tape, tapeCount)
    mesh.count = tapeCount
    mesh.receiveShadow = true
    meshes.push(mesh)
    tapeLayer = { mesh, base: new Float32Array(tapeCount * STRIDE), pallet: new Int32Array(tapeCount), count: tapeCount, color: new Float32Array(0) }
    layers.push(tapeLayer)
  }

  // Stretch wrap, as it is really applied: angle board down the four vertical corners, film bands run
  // around the load. Replaces the single translucent box that used to stand in for all of this.
  let boardLayer: Layer | null = null, bandLayer: Layer | null = null
  if (wrappedCount) {
    // Built at unit height and scaled per instance: every load is a different height, and a single global
    // board height would leave the angle board floating above the short loads and buried in the tall ones.
    const boardMesh = new THREE.InstancedMesh(makeCornerBoardGeometry(1), M.cornerBoard, wrappedCount * 4)
    boardMesh.count = wrappedCount * 4
    boardMesh.castShadow = boardMesh.receiveShadow = true
    meshes.push(boardMesh)
    boardLayer = { mesh: boardMesh, base: new Float32Array(wrappedCount * 4 * STRIDE), pallet: new Int32Array(wrappedCount * 4), count: wrappedCount * 4, color: new Float32Array(0) }
    layers.push(boardLayer)

    const bandMesh = new THREE.InstancedMesh(openBoxShell(), M.film, wrappedCount * 3)
    bandMesh.count = wrappedCount * 3
    bandMesh.renderOrder = 2
    meshes.push(bandMesh)
    bandLayer = { mesh: bandMesh, base: new Float32Array(wrappedCount * 3 * STRIDE), pallet: new Int32Array(wrappedCount * 3), count: wrappedCount * 3, color: new Float32Array(0) }
    layers.push(bandLayer)
  }

  // ---- Pass 2: write every placement into its mesh -------------------------------------------------
  const cursors = new Map<Form, number>()
  const tint = new THREE.Color()
  let tapeAt = 0, boardAt = 0, bandAt = 0
  const wrappedIdx: number[] = []

  for (let pi = 0; pi < pallets.length; pi++) {
    const pl = pallets[pi]
    for (const c of pl.cases) {
      const layer = caseLayerOf.get(c.form)
      if (!layer) continue
      const i = cursors.get(c.form) ?? 0
      cursors.set(c.form, i + 1)
      writePlacement(layer, i, pl, c.lx, PALLET.H + c.ly, c.lz, c.sx, c.sy, c.sz, c.ry, pi)
      // Seed colour for every instance so the Inventory layer can restore it.
      layer.mesh.setColorAt(i, tint.setRGB(c.tr, c.tg, c.tb))
      layer.color[i * 3] = c.tr; layer.color[i * 3 + 1] = c.tg; layer.color[i * 3 + 2] = c.tb
      if (c.form === 'rsc' && tapeLayer) {
        writePlacement(tapeLayer, tapeAt, pl, c.lx, PALLET.H + c.ly, c.lz, c.sx, c.sy, c.sz, c.ry, pi)
        tapeAt++
      }
    }
    if (pl.wrapped && boardLayer && bandLayer) {
      wrappedIdx.push(pi)
      // Four angle boards, one per vertical corner of the load.
      const hw = pl.loadW / 2, hd = pl.loadD / 2
      const corners: [number, number, number][] = [[-hw, -hd, 0], [hw, -hd, Math.PI / 2], [hw, hd, Math.PI], [-hw, hd, -Math.PI / 2]]
      for (const [cx, cz, ry] of corners) {
        writePlacement(boardLayer, boardAt++, pl, cx, PALLET.H + pl.loadH / 2, cz, 1, pl.loadH, 1, ry, pi)
      }
      // Three film bands at roughly 20 / 50 / 80 percent of load height.
      for (const t of [0.2, 0.5, 0.8]) {
        writePlacement(bandLayer, bandAt++, pl, 0, PALLET.H + pl.loadH * t, 0,
          pl.loadW + 0.02, 0.16, pl.loadD + 0.02, 0, pi)
      }
    }
  }
  if (bandLayer) bandLayer.mesh.count = bandAt
  if (boardLayer) boardLayer.mesh.count = boardAt

  // Restore every instance to its un-extracted position and push the buffers.
  for (const l of layers) {
    for (let i = 0; i < l.count; i++) applyAt(l, i, 0)
    l.mesh.instanceMatrix.needsUpdate = true
    if (l.mesh.instanceColor) l.mesh.instanceColor.needsUpdate = true
  }

  // ---- The content object --------------------------------------------------------------------------
  const offsets = new Float32Array(pallets.length)

  return {
    meshes,
    palletCount: pallets.length,

    palletPos(i: number): [number, number, number] {
      const o = i * STRIDE
      return [palletLayer.base[o], palletLayer.base[o + 1], palletLayer.base[o + 2] + offsets[i]]
    },

    /**
     * One pass over every instance rather than a scan per moved pallet: at ~200k cases, the per-pallet
     * scan made the pull animation cost millions of iterations a frame, right when the camera is closest.
     */
    refresh(next: Float32Array) {
      let touched = false
      for (let p = 0; p < pallets.length; p++) {
        if (next[p] !== offsets[p]) { offsets[p] = next[p]; touched = true }
      }
      if (!touched) return
      for (const l of layers) {
        for (let i = 0; i < l.count; i++) applyAt(l, i, offsets[l.pallet[i]])
        l.mesh.instanceMatrix.needsUpdate = true
      }
    },

    /**
     * Base colours are captured at build time, so switching to Inventory first and back is lossless.
     * (Snapshotting lazily on the first call would capture the inventory tint itself if the user opened
     * the Inventory layer before any other, and every case would stay green/amber/red for good.)
     */
    setLayer(layer: string) {
      const c = new THREE.Color()
      for (const l of layers) {
        if (!l.mesh.instanceColor) continue
        for (let i = 0; i < l.count; i++) {
          if (layer === 'inventory') c.setHSL(pallets[l.pallet[i]].fill * 0.33, 0.85, 0.45)
          else c.setRGB(l.color[i * 3], l.color[i * 3 + 1], l.color[i * 3 + 2])
          l.mesh.setColorAt(i, c)
        }
        l.mesh.instanceColor.needsUpdate = true
      }
    },
  }
}

/** Write one instance: base local transform, plus which pallet it belongs to. */
function writePlacement(
  l: Layer, i: number, pl: PalletData,
  lx: number, ly: number, lz: number,
  sx: number, sy: number, sz: number, ry: number, pallet: number,
) {
  const o = i * STRIDE
  l.base[o] = pl.x + lx; l.base[o + 1] = pl.y + ly; l.base[o + 2] = pl.z + lz
  l.base[o + 3] = sx; l.base[o + 4] = sy; l.base[o + 5] = sz; l.base[o + 6] = ry
  l.pallet[i] = pallet
}

/** Re-place instance `i` with an extract offset applied along local z. */
function applyAt(l: Layer, i: number, offZ: number) {
  const o = i * STRIDE
  setInstance(l.mesh, i, l.base[o], l.base[o + 1], l.base[o + 2] + offZ, l.base[o + 3], l.base[o + 4], l.base[o + 5], 0, l.base[o + 6], 0)
}
