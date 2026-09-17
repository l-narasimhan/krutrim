import * as THREE from 'three'
import type { Lane } from '../facility'
import { PALLET, DOOR } from '../facility'
import { Tex } from '../assets'
import { boxAt, cylAt, merged, setInstance } from './util'
import { makePalletGeometry } from './racking'
import { TextLabels } from './text'
import type { Mats } from './mats'
import { rng } from '../rng'

/** 48 × 40 × 36 in gaylord: a triple-wall bulk box, open top, on a GMA pallet. */
const GAYLORD = { L: PALLET.L, W: PALLET.W, H: 0.914 }
const CARRIER_COLOR: Record<string, number> = { UPS: 0x4a2f1b, FedEx: 0x4d148c, USPS: 0x1b3f8f, 'Regional and LTL': 0x3d4a52 }
const SORT_Z = 51.2, STAGE_Z0 = 62.8, STAGE_Z1 = 79.6

/**
 * Manual carrier sort and outbound staging. Under the SLAM outfeed, one sort position per shipping door holds a
 * gaylord on a pallet with the carrier's lane sign on a post, and a scan-to-sort desk every five positions.
 * Behind each door, a 12 ft striped staging lane runs from the sort area to the dock floor with gaylords and
 * stretch-wrapped pallets staged in it and a numbered sign at its head. A turntable stretch wrapper stands at
 * the west end of staging.
 */
export class Outbound {
  group = new THREE.Group()
  volumes: THREE.InstancedMesh
  text = new TextLabels(200)
  colliders: THREE.Box3[] = []

  constructor(lanes: Lane[], M: Mats) {
    const steel: THREE.BufferGeometry[] = [], signs: THREE.BufferGeometry[] = [], paint: THREE.BufferGeometry[] = [], white: THREE.BufferGeometry[] = [], screens: THREE.BufferGeometry[] = []
    const cardboard = new THREE.MeshStandardMaterial({ ...Tex.cardboard(), roughness: 1 })
    const nUnits = lanes.length * 4
    const pallets = new THREE.InstancedMesh(makePalletGeometry(), M.wood, nUnits)
    const gaylords = new THREE.InstancedMesh(makeGaylordGeometry(), cardboard, nUnits)
    const loads = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cardboard, nUnits)
    const film = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.film, nUnits)
    const fills = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cardboard, nUnits)
    const tint = new THREE.Color()
    let pi = 0, gi = 0, li = 0, fi = 0, ci = 0
    const signColor = new Map<string, number>()
    for (const lane of lanes) {
      const x = lane.center[0]
      const color = CARRIER_COLOR[lane.carrier] ?? 0x3d4a52
      if (lane.role === 'sort') {
        // Gaylord on a pallet facing the line, part-filled with boxes, and the lane sign on a post behind it.
        setInstance(pallets, pi++, x, 0, SORT_Z)
        setInstance(gaylords, gi++, x, PALLET.H, SORT_Z)
        if (lane.fill > 0.15) { setInstance(fills, ci, x, PALLET.H + 0.03 + GAYLORD.H * lane.fill * 0.45, SORT_Z, GAYLORD.W - 0.08, GAYLORD.H * lane.fill * 0.9, GAYLORD.L - 0.08); fills.setColorAt(ci++, tint.setHSL(0.08, 0.3, 0.4)) }
        steel.push(boxAt(0.05, 2.3, 0.05, x, 1.15, SORT_Z + 1.0), boxAt(0.3, 0.02, 0.3, x, 0.01, SORT_Z + 1.0))
        signs.push(boxAt(1.4, 0.45, 0.03, x, 2.45, SORT_Z + 1.0))
        signColor.set(`s${lane.id}`, color)
        this.text.add(lane.carrier.replace('Regional and LTL', 'LTL').toUpperCase(), 0.13, x, 2.53, SORT_Z + 0.98, { yaw: Math.PI, color: 0xffffff })
        this.text.add(lane.door, 0.16, x, 2.34, SORT_Z + 0.98, { yaw: Math.PI, color: 0xffffff })
        // Scan-to-sort desk every five positions: stand with monitor, scanner cradle and a printer.
        if (lane.number % 5 === 3) {
          const dx = x + DOOR.pitch / 2
          steel.push(boxAt(0.6, 0.04, 0.5, dx, 1.0, SORT_Z - 0.6), boxAt(0.05, 1.0, 0.05, dx - 0.25, 0.5, SORT_Z - 0.6), boxAt(0.05, 1.0, 0.05, dx + 0.25, 0.5, SORT_Z - 0.6), boxAt(0.03, 0.5, 0.03, dx, 1.25, SORT_Z - 0.4))
          steel.push(boxAt(0.5, 0.32, 0.03, dx, 1.55, SORT_Z - 0.4))
          screens.push(boxAt(0.46, 0.28, 0.004, dx, 1.55, SORT_Z - 0.42))
          white.push(boxAt(0.12, 0.1, 0.14, dx - 0.18, 1.07, SORT_Z - 0.55))
        }
        this.colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.7, 0, SORT_Z - 0.7), new THREE.Vector3(x + 0.7, 1.2, SORT_Z + 1.1)))
      } else {
        // Staging lane: 4" yellow stripes both sides, lane number painted at the head, sign post at the head.
        for (const s of [-1, 1]) paint.push(boxAt(0.1, 0.001, STAGE_Z1 - STAGE_Z0, x + s * (DOOR.pitch / 2 - 0.05), 0.004, (STAGE_Z0 + STAGE_Z1) / 2))
        this.text.add(String(lane.number).padStart(2, '0'), 1.0, x, 0.006, STAGE_Z0 + 1.2, { flat: true, yaw: Math.PI, color: 0xf2c200 }) // read walking toward the door
        steel.push(boxAt(0.05, 2.2, 0.05, x - DOOR.pitch / 2 + 0.35, 1.1, STAGE_Z0 + 0.3), boxAt(0.3, 0.02, 0.3, x - DOOR.pitch / 2 + 0.35, 0.01, STAGE_Z0 + 0.3))
        signs.push(boxAt(0.9, 0.4, 0.03, x - DOOR.pitch / 2 + 0.35, 2.35, STAGE_Z0 + 0.3))
        this.text.add(lane.carrier.replace('Regional and LTL', 'LTL').toUpperCase(), 0.11, x - DOOR.pitch / 2 + 0.35, 2.42, STAGE_Z0 + 0.28, { yaw: Math.PI, color: 0xffffff })
        this.text.add(lane.door, 0.14, x - DOOR.pitch / 2 + 0.35, 2.26, STAGE_Z0 + 0.28, { yaw: Math.PI, color: 0xffffff })
        // Staged units from the dock end back toward sort: gaylords first, then wrapped pallets.
        let z = STAGE_Z1 - 1.0
        for (let g = 0; g < lane.gaylords; g++, z -= 1.5) {
          setInstance(pallets, pi++, x, 0, z); setInstance(gaylords, gi++, x, PALLET.H, z)
          setInstance(fills, ci, x, PALLET.H + 0.45, z, GAYLORD.W - 0.08, 0.8, GAYLORD.L - 0.08); fills.setColorAt(ci++, tint.setHSL(0.08, 0.3, 0.4))
        }
        for (let p = 0; p < lane.pallets; p++, z -= 1.5) {
          const lh = 1.1 + rng() * 0.5
          setInstance(pallets, pi++, x, 0, z)
          setInstance(loads, li, x, PALLET.H + lh / 2, z, PALLET.W - 0.04, lh, PALLET.L - 0.04); loads.setColorAt(li++, tint.setHSL(0.08, 0.35, 0.42 + rng() * 0.12))
          setInstance(film, fi++, x, PALLET.H + lh / 2, z, PALLET.W + 0.02, lh + 0.01, PALLET.L + 0.02)
        }
        this.colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.6, 0, z + 0.75), new THREE.Vector3(x + 0.6, 2, STAGE_Z1)))
      }
    }
    // Stretch wrapper at the west end of staging: turntable, mast with film carriage, control box.
    const wx = -66, wz = 66
    steel.push(boxAt(2.0, 0.08, 2.0, wx, 0.04, wz), boxAt(0.35, 2.4, 0.35, wx, 1.2, wz - 1.3), boxAt(0.25, 0.7, 0.3, wx, 1.1, wz - 1.05), boxAt(0.3, 0.4, 0.25, wx + 0.4, 1.3, wz - 1.3))
    const turntable = cylAt(0.85, 0.06, wx, 0.11, wz, 'y', 24)
    white.push(cylAt(0.09, 0.5, wx, 1.1, wz - 0.9, 'y', 10))
    steel.push(turntable)
    setInstance(pallets, pi++, wx, 0.14, wz)
    setInstance(loads, li, wx, 0.14 + PALLET.H + 0.6, wz, PALLET.W - 0.04, 1.2, PALLET.L - 0.04); loads.setColorAt(li++, tint.setHSL(0.08, 0.35, 0.45))
    setInstance(film, fi++, wx, 0.14 + PALLET.H + 0.35, wz, PALLET.W + 0.02, 0.7, PALLET.L + 0.02)
    this.colliders.push(new THREE.Box3(new THREE.Vector3(wx - 1.1, 0, wz - 1.6), new THREE.Vector3(wx + 1.1, 2.5, wz + 1.1)))
    this.text.add('STRETCH WRAP', 0.5, wx, 0.006, wz + 1.6, { flat: true })

    pallets.count = pi; gaylords.count = gi; loads.count = li; film.count = fi; fills.count = ci
    this.text.commit()
    // Sign plates are coloured per carrier: one merged mesh per carrier colour.
    const byColor = new Map<number, THREE.BufferGeometry[]>()
    let k = 0
    for (const lane of lanes) { const c = CARRIER_COLOR[lane.carrier] ?? 0x3d4a52; (byColor.get(c) ?? byColor.set(c, []).get(c)!).push(signs[k++]) }
    for (const [c, geos] of byColor) this.group.add(merged(geos, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }), false))
    void signColor
    this.group.add(merged(steel, M.steelDark), merged(white, new THREE.MeshStandardMaterial({ color: 0xececea, roughness: 0.5 })), merged(screens, new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6fb6ff, emissiveIntensity: 1.2 }), false), pallets, gaylords, loads, film, fills)
    const pm = new THREE.Mesh(merged(paint, M.paintYellow, false).geometry, M.paintYellow); pm.receiveShadow = true; this.group.add(pm)
    for (const m of [pallets, gaylords, loads, fills]) { m.castShadow = true; m.receiveShadow = true }
    film.renderOrder = 2
    this.group.add(this.text.mesh)
    this.volumes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.hit, lanes.length)
    lanes.forEach((l, i) => setInstance(this.volumes, i, l.center[0], l.center[1], l.center[2], l.size[0], l.size[1], l.size[2]))
    this.volumes.userData.resolve = (id: number) => lanes[id]
    this.group.add(this.volumes)
  }
}

/** Open-top gaylord: four 12 mm walls and a floor, origin at the bottom centre. */
function makeGaylordGeometry(): THREE.BufferGeometry {
  const { L, W, H } = GAYLORD
  const t = 0.012
  const parts = [
    boxAt(W, t, L, 0, t / 2, 0),
    boxAt(t, H, L, -W / 2 + t / 2, H / 2, 0), boxAt(t, H, L, W / 2 - t / 2, H / 2, 0),
    boxAt(W, H, t, 0, H / 2, -L / 2 + t / 2), boxAt(W, H, t, 0, H / 2, L / 2 - t / 2),
  ]
  return merged(parts, new THREE.MeshStandardMaterial()).geometry
}
