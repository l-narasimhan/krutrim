import * as THREE from 'three'
import type { Slam } from '../facility'
import { boxAt, cylAt, merged, setInstance } from './util'
import { TextLabels } from './text'
import type { Mats } from './mats'

const H = 0.75 // top of rollers on the SLAM line
const W = 0.61

/**
 * SLAM: scan, label, apply, manifest. Each station sits on the SLAM line in order of travel (east):
 * in-line checkweigh scale (a short isolated bed on load cells), a scan tunnel (framed hood with cameras on
 * five sides), a print-and-apply labeler beside the line with its tamp arm over the box path and a label roll,
 * a verify scanner post, then a reject divert onto a short gravity lane to the south with a few boxes on it.
 */
export class SlamLine {
  group = new THREE.Group()
  volumes: THREE.InstancedMesh
  text = new TextLabels(16)
  colliders: THREE.Box3[] = []

  constructor(slams: Slam[], M: Mats) {
    const dark: THREE.BufferGeometry[] = [], galv: THREE.BufferGeometry[] = [], hood: THREE.BufferGeometry[] = [], white: THREE.BufferGeometry[] = [], red: THREE.BufferGeometry[] = [], blue: THREE.BufferGeometry[] = []
    const z = 41
    for (const s of slams) {
      const x = s.center[0] - 2 // tunnel position
      // Checkweigh scale: a 1.2 m bed on its own stand, 20 mm above the line so the gap reads, with a display post.
      galv.push(boxAt(1.2, 0.04, W + 0.1, x - 3, H + 0.01, z), boxAt(1.0, 0.1, 0.3, x - 3, 0.05, z))
      for (const sx of [-1, 1]) galv.push(boxAt(0.06, H - 0.1, 0.06, x - 3 + sx * 0.5, (H - 0.1) / 2, z + W / 2 + 0.2))
      dark.push(boxAt(0.05, 1.7, 0.05, x - 3.5, 0.85, z + W / 2 + 0.45), boxAt(0.3, 0.2, 0.06, x - 3.5, 1.75, z + W / 2 + 0.45))
      // Scan tunnel: extruded-aluminium frame 1.4 m long, 1.5 m clear, camera housings on top and sides.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) galv.push(boxAt(0.05, 1.5, 0.05, x + sx * 0.7, H + 0.75, z + sz * (W / 2 + 0.3)))
      for (const sz of [-1, 1]) galv.push(boxAt(1.45, 0.05, 0.05, x, H + 1.5, z + sz * (W / 2 + 0.3)))
      for (const sx of [-1, 1]) galv.push(boxAt(0.05, 0.05, W + 0.65, x + sx * 0.7, H + 1.5, z))
      hood.push(boxAt(1.45, 0.06, W + 0.7, x, H + 1.53, z))
      for (const sz of [-1, 1]) hood.push(boxAt(1.45, 1.1, 0.03, x, H + 0.95, z + sz * (W / 2 + 0.31)))
      dark.push(boxAt(0.18, 0.12, 0.18, x, H + 1.42, z), boxAt(0.12, 0.18, 0.18, x, H + 1.0, z + W / 2 + 0.22), boxAt(0.12, 0.18, 0.18, x, H + 1.0, z - W / 2 - 0.22))
      red.push(boxAt(0.02, 0.02, W + 0.2, x, H + 1.35, z))
      // Print-and-apply: labeler cabinet on a stand beside the line, tamp arm over the belt, label roll and ribbon.
      const px = x + 2.4
      dark.push(boxAt(0.7, 0.6, 0.45, px, H + 0.75, z - W / 2 - 0.55))
      galv.push(boxAt(0.06, H + 0.45, 0.06, px - 0.3, (H + 0.45) / 2, z - W / 2 - 0.55), boxAt(0.06, H + 0.45, 0.06, px + 0.3, (H + 0.45) / 2, z - W / 2 - 0.55), boxAt(0.7, 0.04, 0.5, px, 0.02, z - W / 2 - 0.55))
      dark.push(boxAt(0.12, 0.12, 0.7, px, H + 0.85, z - 0.15), boxAt(0.2, 0.08, 0.2, px, H + 0.55, z))
      white.push(cylAt(0.14, 0.05, px - 0.2, H + 1.2, z - W / 2 - 0.55, 'z', 16), boxAt(0.1, 0.15, 0.001, px, H + 0.47, z))
      // Verify scanner on a post downstream, and a beacon stack.
      dark.push(boxAt(0.04, 1.4, 0.04, px + 1.2, 0.7, z + W / 2 + 0.25), boxAt(0.12, 0.1, 0.1, px + 1.2, H + 0.55, z + W / 2 + 0.2))
      galv.push(cylAt(0.03, 0.3, px + 1.2, 1.55, z + W / 2 + 0.25, 'y', 8))
      red.push(cylAt(0.035, 0.1, px + 1.2, 1.75, z + W / 2 + 0.25, 'y', 10))
      // Reject lane: a 2.5 m gravity roller lane diverging south, with a stop and two boxes waiting on it.
      const rx = px + 2.6
      galv.push(boxAt(W, 0.05, 2.5, rx, H - 0.05, z + W / 2 + 1.55), boxAt(0.04, 0.12, 2.5, rx - W / 2, H + 0.02, z + W / 2 + 1.55), boxAt(0.04, 0.12, 2.5, rx + W / 2, H + 0.02, z + W / 2 + 1.55), boxAt(W + 0.1, 0.15, 0.04, rx, H + 0.05, z + W / 2 + 2.8))
      for (const sx of [-1, 1]) galv.push(boxAt(0.05, H - 0.1, 0.05, rx + sx * 0.25, (H - 0.1) / 2, z + W / 2 + 2.6))
      blue.push(boxAt(0.4, 0.3, 0.02, rx, H + 0.3, z + W / 2 + 0.2)) // divert arm
      this.text.add(`REJECT`, 0.12, rx, H + 0.35, z + W / 2 + 2.83, { yaw: 0, color: 0xffffff })
      this.text.add(s.id, 0.2, x, H + 1.75, z + W / 2 + 0.34, { yaw: 0, color: 0xffffff })
      this.colliders.push(new THREE.Box3(new THREE.Vector3(x - 4, 0, z - 1.3), new THREE.Vector3(rx + 0.6, 2.4, z + 3.2)))
    }
    this.text.commit()
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.6, metalness: 0.4 })
    this.group.add(merged(dark, M.steelDark), merged(galv, M.galvanised), merged(hood, hoodMat), merged(white, new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 })), merged(red, new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 2 }), false), merged(blue, M.upright), this.text.mesh)
    this.volumes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.hit, slams.length)
    slams.forEach((s, i) => setInstance(this.volumes, i, s.center[0], s.center[1], s.center[2], s.size[0], s.size[1], s.size[2]))
    this.volumes.userData.resolve = (id: number) => slams[id]
    this.group.add(this.volumes)
  }
}
