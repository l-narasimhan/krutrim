import * as THREE from 'three'
import { SHELF, BIN, type Bin, rowV, bayU, toWorld, moduleOrigin, MODULE_ROT_Y } from '../facility'
import type { StorageModule } from '../layout'
import { setInstance, boxAt, mergeAny } from './util'
import { mulberry32, rng } from '../rng'
import { LabelField } from './labels'
import type { Mats } from './mats'
import { productForSku, unitOf, type UnitForm } from '../catalog'
import { unitGeometry, UNIT_SIZE, UNIT_MATERIAL, UNIT_FORMS, eachColor, type GoodsMaterials } from './goods'

/** Per-bin seed. Bins carry stable ids, so hashing one gives that bin a private stream the shared RNG
 *  never sees — the same trick the pick faces use. */
function hash(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h >>> 0
}


/** One rivet-shelving module, built in its local frame like the racking and rotated to run north–south. */
export class Shelving {
  group = new THREE.Group()
  bins: THREE.InstancedMesh
  labels: LabelField
  colliders: THREE.Box3[] = []
  private binList: Bin[]
  private binColors: Float32Array | null = null

  /** Inventory layer: bins by velocity, red A movers, amber B, blue C, dark when empty; otherwise the shelf-bin blue. */
  setLayer(layer: string) {
    const ic = this.bins.instanceColor!
    if (!this.binColors) this.binColors = new Float32Array(ic.array)
    if (layer !== 'inventory') { (ic.array as Float32Array).set(this.binColors); ic.needsUpdate = true; return }
    const c = new THREE.Color()
    this.binList.forEach((b, i) => this.bins.setColorAt(i, c.setHex(!b.sku ? 0x2a2e33 : b.velocity === 'A' ? 0xff3b3b : b.velocity === 'B' ? 0xffb020 : 0x2f7fd6)))
    ic.needsUpdate = true
  }

  constructor(readonly module: StorageModule, bins: Bin[], M: Mats, GM: GoodsMaterials) {
    this.binList = bins
    const { unitW, unitD, unitH, post, shelfT, levels, levelPitch, firstShelfY } = SHELF
    const { rows, baysPerRow: units } = module
    const g = this.group
    const [ox, oy, oz] = moduleOrigin(module)
    g.position.set(ox, oy, oz); g.rotation.y = MODULE_ROT_Y

    // Rivet shelving: 1.5" angle posts at each unit corner, double-rivet beams under every shelf, particleboard decks.
    const nUnits = rows * 2 * units
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(post, unitH, post), M.steelDark, nUnits * 4)
    const shelves = new THREE.InstancedMesh(new THREE.BoxGeometry(unitW - post * 2, shelfT, unitD - post), M.particleboard, nUnits * levels)
    const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(unitW - post, 0.038, 0.02), M.steelDark, nUnits * levels * 2)
    const sideBeams = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.038, unitD - post), M.steelDark, nUnits * levels * 2)
    let pi = 0, si = 0, bi = 0, sbi = 0
    for (let r = 0; r < rows; r++) {
      const zc = rowV(module, r)
      for (const dir of [-1, 1]) {
        const zFront = zc + dir * (unitD - post / 2), zBack = zc + dir * post / 2, zMid = zc + dir * unitD / 2
        for (let u = 0; u < units; u++) {
          const x0 = bayU(module, u)
          const xl = x0 + post / 2, xr = x0 + unitW - post / 2
          for (const x of [xl, xr]) { setInstance(posts, pi++, x, unitH / 2, zFront); setInstance(posts, pi++, x, unitH / 2, zBack) }
          for (let l = 0; l < levels; l++) {
            const y = firstShelfY + l * levelPitch
            setInstance(shelves, si++, (xl + xr) / 2, y - shelfT / 2, zMid)
            setInstance(beams, bi++, (xl + xr) / 2, y - shelfT - 0.019, zFront); setInstance(beams, bi++, (xl + xr) / 2, y - shelfT - 0.019, zBack)
            setInstance(sideBeams, sbi++, xl, y - shelfT - 0.019, zMid); setInstance(sideBeams, sbi++, xr, y - shelfT - 0.019, zMid)
          }
        }
      }
    }
    for (const m of [posts, shelves, beams, sideBeams]) { m.castShadow = true; m.receiveShadow = true; g.add(m) }

    // Hopper-front bins. Geometry front is +Z; side A bins are turned to face -Z.
    this.bins = new THREE.InstancedMesh(makeBinGeometry(), M.binBlue, bins.length)
    this.labels = new LabelField(bins.length, 0.076, 0.024)
    const tint = new THREE.Color()
    bins.forEach((bin, i) => {
      const [x, y, z] = bin.local
      const ry = bin.faceDir === 1 ? 0 : Math.PI
      setInstance(this.bins, i, x, y - BIN.H / 2, z, 1, 1, 1, 0, ry, 0)
      this.bins.setColorAt(i, tint.setHSL(0.6, 0.62, 0.36 + (i % 7) * 0.01))
      // Label holder on the lower front face, centred, 1" x 3" thermal label.
      const zl = z + bin.faceDir * (BIN.L / 2 + 0.003)
      this.labels.set(i, bin.id, x, y - BIN.H / 2 + 0.05, zl, ry)
    })
    this.labels.commit()
    this.bins.castShadow = true; this.bins.receiveShadow = true
    this.bins.userData.resolve = (id: number) => bins[id]
    g.add(this.bins, this.labels.mesh)

    // Contents: the product the bin actually holds, from the same catalogue the rack pick faces use, so a bin
    // of drinkware holds bottles and a bin of bagged apparel holds pouches. One InstancedMesh per unit form —
    // a handful of draw calls for the whole module rather than one per bin, and no per-bin geometry.
    const stocked = bins.filter(b => b.sku)
    const eaches: { form: UnitForm; x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number }[] = []
    for (const bin of stocked) {
      // THE DRAW COUNT IS LOAD-BEARING. The box contents this replaces took exactly three rng() draws per
      // stocked bin, and the conveyor, packing, SLAM, rebin, outbound, inbound and the people are all built
      // downstream of this module — change the count and every one of them re-rolls. The draws are still
      // taken and discarded; the variation now comes from the per-bin seeded stream.
      rng(); rng(); rng()
      const u = unitOf(productForSku(bin.sku!))
      const roll = mulberry32(hash(bin.id))
      const [x, y, z] = bin.local
      const [gw, gh, gd] = UNIT_SIZE[u.form]
      // A SKU can hash into a bin smaller than itself, and the catalogue is assigned by hash, so an oversized
      // each is scaled down to sit inside the bin rather than clipping through the steel. A suitcase in an
      // AkroBin is the simplification; a suitcase through the side of one would be a bug.
      const fit = Math.min(1, (BIN.W * 0.8) / u.w, (BIN.L * 0.8) / u.d, (BIN.H * 0.85) / u.h)
      const fw = u.w * fit, fh = u.h * fit, fd = u.d * fit
      const gx = Math.max(1, Math.floor((BIN.W * 0.74) / fw))
      const gz = Math.max(1, Math.floor((BIN.L * 0.62) / fd))
      const layers = Math.max(1, Math.min(3, Math.floor((BIN.H * 0.7) / fh)))
      const fill = Math.min(1, bin.qty / 18)
      const want = Math.max(1, Math.round(gx * gz * layers * (0.22 + 0.62 * fill)))
      let placed = 0
      // Deepest row first so a partly-filled bin reads as picked-from-the-front, not as floating goods.
      for (let l = 0; l < layers && placed < want; l++) {
        for (let ix = 0; ix < gx && placed < want; ix++) {
          for (let iz = 0; iz < gz && placed < want; iz++) {
            eaches.push({
              form: u.form,
              x: x + (ix - (gx - 1) / 2) * fw + (roll() - 0.5) * 0.008,
              y: y - BIN.H / 2 + 0.006 + l * fh + fh / 2,
              z: z - bin.faceDir * BIN.L * 0.06 + (iz - (gz - 1) / 2) * fd,
              sx: fw / gw, sy: fh / gh, sz: fd / gd,
              ry: (roll() - 0.5) * 0.5,
            })
            placed++
          }
        }
      }
    }
    const byForm = new Map<UnitForm, number>()
    for (const e of eaches) byForm.set(e.form, (byForm.get(e.form) ?? 0) + 1)
    const contents = new Map<UnitForm, THREE.InstancedMesh>()
    for (const uf of UNIT_FORMS) {
      const n = byForm.get(uf) ?? 0
      if (!n) continue
      const mesh = new THREE.InstancedMesh(unitGeometry(uf), GM[UNIT_MATERIAL[uf]], n)
      mesh.receiveShadow = true
      contents.set(uf, mesh)
      g.add(mesh)
    }
    const cursor = new Map<UnitForm, number>()
    for (const e of eaches) {
      const mesh = contents.get(e.form)!
      const i = cursor.get(e.form) ?? 0
      cursor.set(e.form, i + 1)
      setInstance(mesh, i, e.x, e.y, e.z, e.sx, e.sy, e.sz, 0, e.ry, 0)
      // A shipped case of anything is not one flat colour: cartons fade, film wrinkles, labels differ.
      mesh.setColorAt(i, eachColor(e.form, i, tint))
    }
    for (const mesh of contents.values()) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    // Colliders in world space, one per row half.
    const half = Math.floor(units / 2)
    for (let r = 0; r < rows; r++) {
      const vc = rowV(module, r)
      for (const [u0, u1] of [[bayU(module, 0), bayU(module, half - 1) + unitW], [bayU(module, half), bayU(module, units - 1) + unitW]]) {
        const a = toWorld(module, u0 - 0.05, 0, vc - unitD - 0.05), b = toWorld(module, u1 + 0.05, 3, vc + unitD + 0.05)
        this.colliders.push(new THREE.Box3(new THREE.Vector3(Math.min(a[0], b[0]), 0, Math.min(a[2], b[2])), new THREE.Vector3(Math.max(a[0], b[0]), 3, Math.max(a[2], b[2]))))
      }
    }
  }
}

/**
 * AkroBin-style shelf bin, hollow with 4 mm walls: full-height back, open top, hopper front at 55% height
 * with a lip and a sloped hood. Front is +Z, origin at the bottom centre.
 */
export function makeBinGeometry(): THREE.BufferGeometry {
  const { L, W, H } = BIN
  const t = 0.004
  const s = new THREE.Shape()
  s.moveTo(-L / 2, 0)
  s.lineTo(L / 2, 0)
  s.lineTo(L / 2, H * 0.55)
  s.lineTo(L / 2 - 0.015, H * 0.6)
  s.lineTo(L / 2 - L * 0.38, H * 0.6)
  s.lineTo(L / 2 - L * 0.5, H)
  s.lineTo(-L / 2, H)
  s.closePath()
  const parts: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false })
    g.rotateY(-Math.PI / 2)
    g.translate(sx * (W / 2) + (sx > 0 ? 0 : t), 0, 0)
    parts.push(g)
  }
  parts.push(boxAt(W - 2 * t, t, L, 0, t / 2, 0))                                   // floor
  parts.push(boxAt(W - 2 * t, H, t, 0, H / 2, -L / 2 + t / 2))                       // back
  parts.push(boxAt(W - 2 * t, H * 0.55, t, 0, H * 0.275, L / 2 - t / 2))             // front
  const shelfLen = L * 0.38 - 0.015
  parts.push(boxAt(W - 2 * t, t, shelfLen, 0, H * 0.6, L / 2 - 0.015 - shelfLen / 2)) // hopper lip shelf
  const hoodLen = Math.hypot(L * 0.12, H * 0.4), hoodAng = Math.atan2(H * 0.4, L * 0.12)
  parts.push(boxAt(W - 2 * t, t, hoodLen, 0, H * 0.8, L / 2 - L * 0.44, 0, hoodAng))  // sloped hood
  const g = mergeAny(parts)
  parts.forEach(p => p.dispose())
  g.computeVertexNormals()
  return g
}
