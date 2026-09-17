import * as THREE from 'three'
import type { PutWall } from '../facility'
import { PUT_WALLS } from '../layout'
import { Tex } from '../assets'
import { boxAt, merged, setInstance } from './util'
import { TextLabels } from './text'
import type { Mats } from './mats'
import { rng } from '../rng'

/**
 * Put walls for multi-item rebin: a steel-frame wall of open cubbies, 8 across × 6 high, each cubby with a
 * put-to-light indicator on its lip. Lit cubbies hold an order in progress and show a few units inside.
 * The induct side faces the tote spur; packers pull completed orders from the other side.
 */
export class Rebin {
  group = new THREE.Group()
  volumes: THREE.InstancedMesh
  text = new TextLabels(16)
  colliders: THREE.Box3[] = []

  constructor(walls: PutWall[], M: Mats) {
    const { w, h, d, cols, tiers } = PUT_WALLS
    const cw = w / cols, ch = h / tiers
    const frame: THREE.BufferGeometry[] = [], panels: THREE.BufferGeometry[] = []
    const nSlots = cols * tiers
    const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.012, 0.01), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.5 }), walls.length * nSlots)
    const units = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ ...Tex.cardboard(), roughness: 1 }), walls.length * nSlots * 2)
    const tint = new THREE.Color()
    let li = 0, ui = 0
    walls.forEach((wall, wi) => {
      const [cx, , cz] = wall.center
      const dir = wall.face[2]
      // Frame: two end posts, top and bottom rails; cubby shelves and dividers as thin panels; open back.
      for (const sx of [-1, 1]) frame.push(boxAt(0.05, h, d, cx + sx * (w / 2 + 0.025), h / 2, cz))
      for (const y of [0.02, h - 0.02]) frame.push(boxAt(w, 0.04, d, cx, y, cz))
      for (let t = 1; t < tiers; t++) panels.push(boxAt(w, 0.012, d, cx, t * ch, cz))
      for (let c = 1; c < cols; c++) panels.push(boxAt(0.012, h, d, cx - w / 2 + c * cw, h / 2, cz))
      for (let t = 0; t < tiers; t++) for (let c = 0; c < cols; c++) {
        const i = t * cols + c
        const x = cx - w / 2 + (c + 0.5) * cw
        const y = t * ch
        const lit = wall.lit[i]
        setInstance(leds, li, x, y + 0.03, cz + dir * (d / 2 + 0.006), 1, 1, 1, 0, dir > 0 ? 0 : Math.PI, 0)
        leds.setColorAt(li++, tint.setHex(lit ? (rng() < 0.8 ? 0x38d66a : 0xffb020) : 0x203020))
        if (lit) for (let u = 0; u < 1 + Math.round(rng()); u++) {
          const uw = cw * (0.35 + rng() * 0.3), uh = ch * (0.25 + rng() * 0.3), ud = d * (0.3 + rng() * 0.3)
          setInstance(units, ui, x + (rng() - 0.5) * cw * 0.3, y + 0.02 + uh / 2, cz + (rng() - 0.5) * d * 0.4, uw, uh, ud, 0, (rng() - 0.5) * 0.8, 0)
          units.setColorAt(ui++, tint.setHSL(0.08 + rng() * 0.05, 0.3, 0.5 + rng() * 0.2))
        }
      }
      this.text.add(wall.id, 0.18, cx, h + 0.16, cz + dir * (d / 2), { yaw: dir > 0 ? 0 : Math.PI, color: 0xffffff })
      this.colliders.push(new THREE.Box3(new THREE.Vector3(cx - w / 2 - 0.1, 0, cz - d / 2 - 0.1), new THREE.Vector3(cx + w / 2 + 0.1, h, cz + d / 2 + 0.1)))
      void wi
    })
    units.count = ui
    this.text.commit()
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.6, metalness: 0.3 })
    this.group.add(merged(frame, M.steelDark), merged(panels, panelMat), leds, units, this.text.mesh)
    units.castShadow = true; units.receiveShadow = true
    this.volumes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.hit, walls.length)
    walls.forEach((wall, i) => setInstance(this.volumes, i, wall.center[0], wall.center[1], wall.center[2], wall.size[0], wall.size[1], wall.size[2]))
    this.volumes.userData.resolve = (id: number) => walls[id]
    this.group.add(this.volumes)
  }
}
