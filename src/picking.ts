import * as THREE from 'three'
import type { Entity } from './facility'

export class Picker {
  private ray = new THREE.Raycaster()
  private ndc = new THREE.Vector2(-2, -2)
  private moved = false
  private down: [number, number] | null = null
  hovered: Entity | null = null
  onHover?: (e: Entity | null, x: number, y: number) => void
  onSelect?: (e: Entity) => void
  private px = 0
  private py = 0

  constructor(private canvas: HTMLCanvasElement, private targets: THREE.Object3D[], private getCamera: () => THREE.Camera) {
    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect()
      this.px = e.clientX - r.left; this.py = e.clientY - r.top
      this.ndc.set((this.px / r.width) * 2 - 1, -(this.py / r.height) * 2 + 1)
      this.moved = true
    })
    canvas.addEventListener('pointerdown', e => { this.down = [e.clientX, e.clientY] })
    canvas.addEventListener('pointerup', e => {
      if (!this.down) return
      const dist = Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1])
      this.down = null
      if (dist < 5) {
        if (document.pointerLockElement === canvas) this.castCentre()
        if (this.hovered) this.onSelect?.(this.hovered)
      }
    })
    canvas.addEventListener('pointerleave', () => { this.hovered = null; this.onHover?.(null, 0, 0) })
  }

  private castCentre() {
    this.ndc.set(0, 0)
    this.moved = true
    this.px = this.canvas.clientWidth / 2; this.py = this.canvas.clientHeight / 2
    this.update(true)
  }

  update(force = false) {
    const locked = document.pointerLockElement === this.canvas
    if (locked && !force) { this.ndc.set(0, 0); this.px = this.canvas.clientWidth / 2; this.py = this.canvas.clientHeight / 2; this.moved = true }
    if (!this.moved) return
    this.moved = false
    this.ray.setFromCamera(this.ndc, this.getCamera())
    this.ray.far = locked ? 6 : 400
    const hits = this.ray.intersectObjects(this.targets, false)
    let ent: Entity | null = null
    for (const h of hits) {
      const o = h.object
      if (o.userData.entity) { ent = o.userData.entity; break }
      if (o.userData.resolve && h.instanceId !== undefined) { ent = o.userData.resolve(h.instanceId); break }
    }
    if (ent !== this.hovered) {
      this.hovered = ent
      this.onHover?.(ent, this.px, this.py)
    } else if (ent) this.onHover?.(ent, this.px, this.py)
  }
}

/** Wireframe highlight box that snaps to an entity. */
export class Highlight {
  hover: THREE.LineSegments
  select: THREE.LineSegments
  constructor(scene: THREE.Scene) {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))
    this.hover = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x38d6ff, transparent: true, opacity: 0.9, depthTest: false }))
    this.select = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 1, depthTest: false }))
    this.hover.visible = this.select.visible = false
    this.hover.renderOrder = this.select.renderOrder = 10
    scene.add(this.hover, this.select)
  }
  static place(m: THREE.Object3D, e: Entity | null) {
    if (!e) { m.visible = false; return }
    m.visible = true
    m.position.set(e.center[0], e.center[1], e.center[2])
    m.scale.set(e.size[0] + 0.04, e.size[1] + 0.04, e.size[2] + 0.04)
  }
}
