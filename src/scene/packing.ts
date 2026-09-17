import * as THREE from 'three'
import type { Station } from '../facility'
import { PACK, TOTE_DROPS } from '../layout'
import { Tex } from '../assets'
import { boxAt, cylAt, merged, setInstance } from './util'
import { makeToteGeometry } from './conveyor'
import { TextLabels } from './text'
import type { Mats } from './mats'
import { rng } from '../rng'

/**
 * Pack stations: a 72 × 36 in steel-frame packing bench with laminate top and lower shelf, a two-tier carton
 * riser at the back stocked with flat shippers, monitor on an arm, keyboard, bench scale, thermal label printer,
 * tape dispenser, a paper-dunnage dispenser beside the bench, a tote stand on the other side with the tote being
 * packed, and boxes in progress on the top. The bench faces the box line; the packer stands between them.
 */
export class Packing {
  group = new THREE.Group()
  volumes: THREE.InstancedMesh
  text = new TextLabels(64)
  colliders: THREE.Box3[] = []

  constructor(stations: Station[], M: Mats) {
    const { w, d, h } = PACK.bench
    const steel: THREE.BufferGeometry[] = [], top: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = [], white: THREE.BufferGeometry[] = [], screens: THREE.BufferGeometry[] = [], paper: THREE.BufferGeometry[] = []
    const cardboard = new THREE.MeshStandardMaterial({ ...Tex.cardboard(), roughness: 1 })
    const flats = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cardboard, stations.length * 12)
    const wip = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cardboard, stations.length * 2)
    const totes = new THREE.InstancedMesh(makeToteGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), stations.length)
    const tint = new THREE.Color()
    let fi = 0, wi = 0
    const place = (g: THREE.BufferGeometry, st: Station) => { if (st.face[2] < 0) g.rotateY(Math.PI); g.translate(st.center[0], 0, st.center[2]); return g }
    // Station-local frame: bench centred at the origin, its working edge toward +z (the box line), riser at −z.
    stations.forEach((st, i) => {
      const s: THREE.BufferGeometry[] = [], t: THREE.BufferGeometry[] = [], k: THREE.BufferGeometry[] = [], wh: THREE.BufferGeometry[] = [], sc: THREE.BufferGeometry[] = [], pp: THREE.BufferGeometry[] = []
      // Bench: 2" square tube legs and aprons, laminate top, particleboard lower shelf.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.push(boxAt(0.05, h - 0.04, 0.05, sx * (w / 2 - 0.05), (h - 0.04) / 2, sz * (d / 2 - 0.05)))
      for (const sz of [-1, 1]) s.push(boxAt(w - 0.1, 0.05, 0.05, 0, h - 0.08, sz * (d / 2 - 0.05)), boxAt(w - 0.1, 0.05, 0.05, 0, 0.3, sz * (d / 2 - 0.05)))
      t.push(boxAt(w, 0.04, d, 0, h - 0.02, 0))
      t.push(boxAt(w - 0.12, 0.02, d - 0.12, 0, 0.33, 0))
      // Riser at the back: two uprights, two shelves, flat cartons stacked on each.
      for (const sx of [-1, 1]) s.push(boxAt(0.04, 0.8, 0.04, sx * (w / 2 - 0.04), h + 0.4, -d / 2 + 0.04))
      for (const y of [h + 0.32, h + 0.66]) s.push(boxAt(w, 0.025, 0.35, 0, y, -d / 2 + 0.2))
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
        const bw = 0.24 + rng() * 0.06, bh = 0.02 + rng() * 0.015 + (c % 2) * 0.02
        setInstance(flats, fi, st.center[0] + (st.face[2] < 0 ? 1 : -1) * (-(w / 2) + 0.16 + c * 0.29), h + 0.33 + r * 0.34 + 0.06, st.center[2] + st.face[2] * (d / 2 - 0.2) * -1, bw, 0.12, bh * 6, 0, st.face[2] < 0 ? Math.PI : 0, 0)
        flats.setColorAt(fi++, tint.setHSL(0.08, 0.35, 0.42 + rng() * 0.15))
      }
      // Monitor on an arm from the riser upright, keyboard on the top, scale and printer at the ends.
      k.push(boxAt(0.03, 0.03, 0.3, w / 2 - 0.1, h + 0.55, -d / 2 + 0.2))
      k.push(boxAt(0.55, 0.34, 0.03, w / 2 - 0.35, h + 0.62, -d / 2 + 0.32))
      sc.push(boxAt(0.51, 0.3, 0.004, w / 2 - 0.35, h + 0.62, -d / 2 + 0.348))
      k.push(boxAt(0.42, 0.02, 0.15, w / 2 - 0.35, h + 0.01, -0.05))
      wh.push(boxAt(0.35, 0.05, 0.35, -w / 2 + 0.25, h + 0.025, -0.15))                 // bench scale
      k.push(boxAt(0.2, 0.19, 0.24, w / 2 - 0.12, h + 0.095, 0.25))                     // thermal printer
      k.push(boxAt(0.08, 0.1, 0.18, -w / 2 + 0.6, h + 0.05, 0.3))                        // tape gun
      // Paper dunnage dispenser: a roll on a stand beside the bench.
      pp.push(cylAt(0.2, 0.55, w / 2 + 0.45, 1.0, -0.1, 'z', 14))
      s.push(boxAt(0.04, 1.0, 0.04, w / 2 + 0.45, 0.5, -0.4), boxAt(0.04, 1.0, 0.04, w / 2 + 0.45, 0.5, 0.2), boxAt(0.5, 0.04, 0.7, w / 2 + 0.45, 0.02, -0.1))
      // Tote stand on the other side, with the tote being packed.
      s.push(boxAt(0.5, 0.04, 0.7, -w / 2 - 0.45, 0.7, 0), ...[-1, 1].flatMap(sx => [-1, 1].map(sz => boxAt(0.03, 0.7, 0.03, -w / 2 - 0.45 + sx * 0.22, 0.35, sz * 0.32))))
      const dir = st.face[2]
      setInstance(totes, i, st.center[0] + (dir < 0 ? 1 : -1) * (w / 2 + 0.45), 0.72, st.center[2], 1, 1, 1, 0, dir < 0 ? Math.PI : 0, 0)
      totes.setColorAt(i, tint.setHex(rng() < 0.5 ? 0x9a9d9f : 0xe0b400))
      // Work in progress: one or two boxes on the top when the station is packing.
      if (st.state === 'PACKING') for (let b = 0; b < 1 + Math.round(rng()); b++) {
        const bw = 0.3 + rng() * 0.15, bh = 0.2 + rng() * 0.12, bd = 0.35 + rng() * 0.15
        setInstance(wip, wi, st.center[0] + (dir < 0 ? 1 : -1) * (-0.1 + b * 0.5), h + bh / 2, st.center[2] + dir * 0.15, bw, bh, bd, 0, (rng() - 0.5) * 0.4, 0)
        wip.setColorAt(wi++, tint.setHSL(0.08, 0.35, 0.45 + rng() * 0.12))
      }
      for (const g of s) steel.push(place(g, st))
      for (const g of t) top.push(place(g, st))
      for (const g of k) dark.push(place(g, st))
      for (const g of wh) white.push(place(g, st))
      for (const g of sc) screens.push(place(g, st))
      for (const g of pp) paper.push(place(g, st))
      // Station number on the riser, readable from the packer's side.
      this.text.add(st.id, 0.14, st.center[0], h + 0.92, st.center[2] - dir * (d / 2 - 0.02), { yaw: dir > 0 ? 0 : Math.PI, color: 0x111111 })
      this.colliders.push(new THREE.Box3(new THREE.Vector3(st.center[0] - w / 2 - 0.8, 0, st.center[2] - d / 2 - 0.1), new THREE.Vector3(st.center[0] + w / 2 + 0.8, 1.5, st.center[2] + d / 2 + 0.1)))
    })
    flats.count = fi; wip.count = wi
    // Pack drop points for walk mode: a 2 × 2 m striped square, a sign, and a stack of empty totes beside it.
    const paint: THREE.BufferGeometry[] = []
    const dropTotes = new THREE.InstancedMesh(makeToteGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), TOTE_DROPS.length * 5)
    TOTE_DROPS.forEach((d, k) => {
      for (const [w, dd, ox, oz] of [[2.2, 0.1, 0, -1.05], [2.2, 0.1, 0, 1.05], [0.1, 2.2, -1.05, 0], [0.1, 2.2, 1.05, 0]]) paint.push(boxAt(w, 0.001, dd, d.x + ox, 0.004, d.z + oz))
      this.text.add('PACK DROP', 0.32, d.x, 0.006, d.z + 1.55, { flat: true, color: 0xf2c200 })
      for (let i = 0; i < 5; i++) { setInstance(dropTotes, k * 5 + i, d.x + 1.6, 0.26 * i, d.z, 1, 1, 1, 0, Math.PI / 2, 0); dropTotes.setColorAt(k * 5 + i, tint.setHex(i % 2 ? 0x9a9d9f : 0xe0b400)) }
    })
    const pm = new THREE.Mesh(merged(paint, M.paintYellow, false).geometry, M.paintYellow); pm.receiveShadow = true
    this.group.add(pm, dropTotes)
    this.text.commit()
    const laminate = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.5 })
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6fb6ff, emissiveIntensity: 1.2, roughness: 0.3 })
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xc8b48a, roughness: 0.9 })
    this.group.add(merged(steel, M.steelDark), merged(top, laminate), merged(dark, M.steelDark), merged(white, new THREE.MeshStandardMaterial({ color: 0xe8e8e6, roughness: 0.5 })), merged(screens, screenMat, false), merged(paper, paperMat), flats, wip, totes, this.text.mesh)
    for (const m of [flats, wip, totes]) { m.castShadow = true; m.receiveShadow = true }
    this.volumes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.hit, stations.length)
    stations.forEach((st, i) => setInstance(this.volumes, i, st.center[0], st.center[1], st.center[2], st.size[0], st.size[1], st.size[2]))
    this.volumes.userData.resolve = (id: number) => stations[id]
    this.group.add(this.volumes)
  }
}
