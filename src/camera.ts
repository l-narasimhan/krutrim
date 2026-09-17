import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { HALL, type Vec3 } from './facility'

export type Mode = 'orbit' | 'plan' | 'walk'

const EYE = 1.7, WALK = 1.4, JOG = 2.8, RADIUS = 0.35

export class CameraRig {
  persp: THREE.PerspectiveCamera
  ortho: THREE.OrthographicCamera
  controls: OrbitControls
  mode: Mode = 'orbit'
  onModeChange?: (m: Mode) => void
  private fly: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; t: number; dur: number } | null = null
  private keys = new Set<string>()
  private yaw = Math.PI
  private pitch = 0
  private walkPos = new THREE.Vector3(-2, EYE, 12)
  private locked = false

  constructor(private canvas: HTMLCanvasElement, private colliders: THREE.Box3[]) {
    const aspect = canvas.clientWidth / canvas.clientHeight
    this.persp = new THREE.PerspectiveCamera(55, aspect, 0.1, 1500)
    this.persp.position.set(160, 120, 240)
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400)
    this.ortho.position.set(0, 200, 0)
    this.ortho.up.set(0, 0, -1)
    this.ortho.lookAt(0, 0, 0)
    this.controls = new OrbitControls(this.persp, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI / 2 - 0.01
    this.controls.minDistance = 1.5
    this.controls.maxDistance = 700
    this.controls.target.set(0, 0, 10)
    this.resize(canvas.clientWidth, canvas.clientHeight)

    window.addEventListener('keydown', e => { if (this.mode === 'walk') this.keys.add(e.code) })
    window.addEventListener('keyup', e => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas
      if (!this.locked && this.mode === 'walk') this.keys.clear()
    })
    canvas.addEventListener('mousemove', e => {
      if (this.mode !== 'walk' || !this.locked) return
      this.yaw -= e.movementX * 0.0022
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022, -1.2, 1.2)
    })
    canvas.addEventListener('click', () => { if (this.mode === 'walk' && !this.locked) this.lock() })
  }

  private lock() {
    try { const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => {}) } catch { /* headless or denied: keyboard turning still works */ }
  }

  get camera(): THREE.Camera { return this.mode === 'plan' ? this.ortho : this.persp }

  resize(w: number, h: number) {
    const aspect = w / h
    this.persp.aspect = aspect
    this.persp.updateProjectionMatrix()
    const halfH = 100
    this.ortho.left = -halfH * aspect; this.ortho.right = halfH * aspect
    this.ortho.top = halfH; this.ortho.bottom = -halfH
    this.ortho.updateProjectionMatrix()
  }

  setMode(mode: Mode, at?: { pos: Vec3; yaw?: number }) {
    if (this.mode === 'walk' && mode !== 'walk' && document.pointerLockElement) document.exitPointerLock()
    this.mode = mode
    this.fly = null
    if (mode === 'plan') {
      this.controls.object = this.ortho
      this.controls.enableRotate = false
      this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
      this.controls.target.set(0, 0, 0)
      this.ortho.position.set(0, 200, 0)
      this.ortho.zoom = 1
      this.ortho.updateProjectionMatrix()
      this.controls.screenSpacePanning = true
      this.controls.minZoom = 0.5; this.controls.maxZoom = 60
    } else {
      this.controls.object = this.persp
      this.controls.enableRotate = true
      this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
      this.controls.screenSpacePanning = false
    }
    this.controls.enabled = mode !== 'walk'
    if (mode === 'walk') {
      if (at) { this.walkPos.set(at.pos[0], EYE, at.pos[2]); this.yaw = at.yaw ?? this.yaw }
      this.pitch = 0
      this.lock()
    }
    this.controls.update()
    this.onModeChange?.(mode)
  }

  /** Finish any fly-to immediately (used by deep links so the first frame is already in place). */
  snap() {
    if (!this.fly) return
    this.persp.position.copy(this.fly.p1)
    this.controls.target.copy(this.fly.t1)
    this.fly = null
    this.controls.update()
  }

  flyTo(pos: Vec3, target: Vec3, dur = 1.2) {
    if (this.mode !== 'orbit') this.setMode('orbit')
    this.fly = { p0: this.persp.position.clone(), p1: new THREE.Vector3(...pos), t0: this.controls.target.clone(), t1: new THREE.Vector3(...target), t: 0, dur }
  }

  /** Frame an entity from the side it faces (`face` is its outward unit vector), at a distance that fits it in view. */
  frame(center: Vec3, size: Vec3, face: Vec3 = [0, 0, 1], standoff?: number) {
    const s = Math.max(size[0], size[1], size[2])
    const dist = standoff ?? Math.max(2.2, s * 1.3)
    const t: Vec3 = [center[0], Math.min(center[1], 4), center[2]]
    // Offset a little to the side of the face direction so the view is three-quarter, not head-on.
    const sx = -face[2], sz = face[0]
    const pos: Vec3 = [center[0] + face[0] * dist * 0.85 + sx * dist * 0.35, Math.min(center[1], 4) + dist * 0.45, center[2] + face[2] * dist * 0.85 + sz * dist * 0.35]
    // Stay inside the hall so a wall never ends up between the camera and the target.
    pos[0] = THREE.MathUtils.clamp(pos[0], -HALL.w / 2 + 1, HALL.w / 2 - 1)
    pos[2] = THREE.MathUtils.clamp(pos[2], -HALL.d / 2 + 1, HALL.d / 2 - 1)
    this.flyTo(pos, t, 1.0)
  }

  update(dt: number) {
    if (this.mode === 'walk') {
      this.updateWalk(dt)
      return
    }
    if (this.fly) {
      const f = this.fly
      f.t = Math.min(1, f.t + dt / f.dur)
      const k = f.t < 0.5 ? 4 * f.t ** 3 : 1 - Math.pow(-2 * f.t + 2, 3) / 2
      this.persp.position.lerpVectors(f.p0, f.p1, k)
      this.controls.target.lerpVectors(f.t0, f.t1, k)
      if (f.t >= 1) this.fly = null
    }
    this.controls.update()
  }

  private updateWalk(dt: number) {
    const k = this.keys
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0)
    const strafe = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0)
    const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0)
    this.yaw += turn * 1.6 * dt
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? JOG : WALK
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw)
    // Facing direction is -Z rotated by yaw.
    const dx = (-sin * fwd + cos * strafe) * speed * dt
    const dz = (-cos * fwd - sin * strafe) * speed * dt
    this.walkPos.x += dx; this.walkPos.z += dz
    this.resolveCollisions()
    this.walkPos.x = THREE.MathUtils.clamp(this.walkPos.x, -HALL.w / 2 + 0.5, HALL.w / 2 - 0.5)
    this.walkPos.z = THREE.MathUtils.clamp(this.walkPos.z, -HALL.d / 2 + 0.5, HALL.d / 2 - 0.5)
    this.persp.position.copy(this.walkPos)
    this.persp.rotation.set(0, 0, 0, 'YXZ')
    this.persp.rotation.y = this.yaw
    this.persp.rotation.x = this.pitch
  }

  private resolveCollisions() {
    const p = this.walkPos
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.colliders) {
        if (b.min.y > EYE || b.max.y < 0.2) continue
        const cx = THREE.MathUtils.clamp(p.x, b.min.x, b.max.x)
        const cz = THREE.MathUtils.clamp(p.z, b.min.z, b.max.z)
        let ddx = p.x - cx, ddz = p.z - cz
        let d = Math.hypot(ddx, ddz)
        if (d >= RADIUS) continue
        if (d < 1e-4) {
          // Inside the box: push out through the nearest face.
          const ex = Math.min(p.x - b.min.x, b.max.x - p.x), ez = Math.min(p.z - b.min.z, b.max.z - p.z)
          if (ex < ez) p.x += (p.x - b.min.x < b.max.x - p.x ? -1 : 1) * (ex + RADIUS)
          else p.z += (p.z - b.min.z < b.max.z - p.z ? -1 : 1) * (ez + RADIUS)
          continue
        }
        ddx /= d; ddz /= d
        p.x = cx + ddx * RADIUS; p.z = cz + ddz * RADIUS
      }
    }
  }

  get walkPosition() { return this.walkPos }
  get walkYaw() { return this.yaw }
}
