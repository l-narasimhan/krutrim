// Aisle equipment: the ladders that work the upper pick levels.
//
// The hybrid racking puts pick level B at 1.75 m and the pick module's top shelf at 1.92 m. A case on either
// puts the pick around 2.0 m — above comfortable reach several hundred times a shift — so a manual FC runs
// rolling safety ladders in the rack aisles and fibreglass step ladders in the narrow cart aisles.
//
// Real references: the rolling ladder is a Ballymore/Tri-Arc style 6-step, 1.52 m platform, 230 mm rise,
// 610 mm tread width, spring-loaded casters that retract under load. The step ladder is a 1.83 m fibreglass
// A-frame. Both are rated 136 kg (300 lb).

import * as THREE from 'three'
import type { Facility } from '../facility'
import { setInstance, boxAt, cylAt, mergeAny } from './util'
import type { Mats } from './mats'

/** Rolling safety ladder, platform up. Origin at ground centre; it climbs toward -z, which goes against
 *  the rack, so the climber mounts from +z on the aisle side. */
function makeRollingLadder(): THREE.BufferGeometry {
  const H = 1.52            // platform height
  const STEPS = 6
  const RISE = H / (STEPS + 0.15)
  const zBase = 0.52, zTop = -0.30
  const run = zBase - zTop
  const half = 0.305        // half the 610 mm tread width
  const sLen = Math.hypot(run, H)
  const sAng = Math.atan2(run, H)   // lean from vertical
  const parts: THREE.BufferGeometry[] = []

  // Side stringers, one each side. rotateX(t) leans the top toward +z, so the sign here has to match the
  // steps, which climb toward -z: a positive angle would rake the rails against the treads and make a
  // zigzag that still reads as "a ladder" from across the aisle.
  for (const sx of [-half - 0.02, half + 0.02]) {
    parts.push(boxAt(0.055, sLen, 0.075, sx, H / 2, (zBase + zTop) / 2, 0, -sAng))
  }
  // Steps, horizontal, inset between the stringers.
  for (let k = 0; k < STEPS; k++) {
    const f = (k + 1) / (STEPS + 1)
    parts.push(boxAt(0.58, 0.028, 0.20, 0, RISE * (k + 1), zBase - run * f))
    // Gusset under each tread, as the real thing has.
    parts.push(boxAt(0.58, 0.05, 0.02, 0, RISE * (k + 1) - 0.045, zBase - run * f - 0.10))
  }
  // Top platform, with a toe plate at its front edge.
  parts.push(boxAt(0.66, 0.03, 0.58, 0, H, zTop))
  parts.push(boxAt(0.66, 0.12, 0.02, 0, H + 0.075, zTop - 0.28))
  // Tubular handrails up both sides, past the platform.
  for (const sx of [-half - 0.02, half + 0.02]) {
    parts.push(boxAt(0.038, 0.86, 0.038, sx, H + 0.43, zTop - 0.25))
    parts.push(boxAt(0.038, 0.86, 0.038, sx, H + 0.43, zTop + 0.25))
    parts.push(boxAt(0.038, 0.038, 0.54, sx, H + 0.84, zTop))
    parts.push(boxAt(0.038, 0.038, 0.54, sx, H + 0.44, zTop))
  }
  // Base frame and the four spring-loaded casters.
  for (const z of [zBase - 0.06, zTop + 0.06]) parts.push(boxAt(0.72, 0.06, 0.06, 0, 0.11, z))
  for (const sx of [-half, half]) for (const z of [zBase - 0.06, zTop + 0.06]) {
    parts.push(cylAt(0.052, 0.038, sx, 0.055, z, 'x', 8))
  }
  const g = mergeAny(parts)
  parts.forEach(p => p.dispose())
  return g
}

/** Fibreglass step ladder, A-frame, 1.83 m. Origin at ground centre, +z is the climbing side, and the
 *  apex is at z = 0. */
function makeStepLadder(): THREE.BufferGeometry {
  const H = 1.83
  const zFront = 0.29, zBack = -0.27
  const half = 0.275
  const parts: THREE.BufferGeometry[] = []
  const frontLen = Math.hypot(zFront, H), frontAng = Math.atan2(zFront, H)
  const backLen = Math.hypot(-zBack, H), backAng = Math.atan2(-zBack, H)
  for (const sx of [-half, half]) {
    parts.push(boxAt(0.032, frontLen, 0.075, sx, H / 2, zFront / 2, 0, -frontAng))
    parts.push(boxAt(0.028, backLen, 0.05, sx, H / 2, zBack / 2, 0, backAng))
  }
  // Five steps plus the top cap.
  for (let k = 1; k <= 5; k++) {
    const y = k * 0.30
    const z = zFront * (1 - y / H)
    parts.push(boxAt(0.50, 0.024, 0.14, 0, y, z - 0.02))
  }
  parts.push(boxAt(0.52, 0.028, 0.20, 0, H, -0.02))
  // Folding spreader bars between the two frames.
  for (const sx of [-half + 0.02, half - 0.02]) {
    parts.push(boxAt(0.018, 0.018, 0.46, sx, 0.62, 0.02))
    parts.push(boxAt(0.018, 0.30, 0.018, sx, 0.47, 0.24))
    parts.push(boxAt(0.018, 0.30, 0.018, sx, 0.47, -0.20))
  }
  // Slip-resistant feet.
  for (const sx of [-half, half]) {
    parts.push(boxAt(0.055, 0.03, 0.075, sx, 0.015, zFront))
    parts.push(boxAt(0.05, 0.03, 0.05, sx, 0.015, zBack))
  }
  const g = mergeAny(parts)
  parts.forEach(p => p.dispose())
  return g
}

/**
 * The ladders on the floor, one instanced mesh per type, with a pick volume so any of them can be inspected.
 */
export class Equipment {
  group = new THREE.Group()
  volumes: THREE.InstancedMesh

  constructor(facility: Facility, M: Mats) {
    const rolling = facility.ladders.filter(l => l.type === 'rolling')
    const step = facility.ladders.filter(l => l.type === 'step')

    const rollMesh = new THREE.InstancedMesh(makeRollingLadder(), M.ladder, Math.max(1, rolling.length))
    const stepMesh = new THREE.InstancedMesh(makeStepLadder(), M.ladder, Math.max(1, step.length))
    rollMesh.count = rolling.length
    stepMesh.count = step.length
    rollMesh.castShadow = rollMesh.receiveShadow = true
    stepMesh.castShadow = stepMesh.receiveShadow = true

    for (const [mesh, list] of [[rollMesh, rolling], [stepMesh, step]] as const) {
      list.forEach((l, i) => {
        // The model's +z is the climbing side; `yaw` turns it to lean against its rack. `face` is the
        // camera approach direction and runs down the aisle, so it is deliberately not used here.
        setInstance(mesh, i, l.center[0], 0, l.center[2], 1, 1, 1, 0, l.yaw, 0)
      })
    }

    // One hit volume per ladder, so hovering and clicking resolve to the entity.
    this.volumes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.hit, facility.ladders.length)
    facility.ladders.forEach((l, i) => setInstance(this.volumes, i, l.center[0], l.center[1], l.center[2], l.size[0], l.size[1], l.size[2]))
    this.volumes.userData.resolve = (id: number) => facility.ladders[id]

    this.group.add(rollMesh, stepMesh, this.volumes)
  }

  /** Ladders are parked, not driven — nothing to animate yet. */
  update(_dt: number) { void _dt }

  /** Ladder positions block the walk camera. */
  get colliders(): THREE.Box3[] {
    const out: THREE.Box3[] = []
    const v = this.volumes
    const m = new THREE.Matrix4()
    for (let i = 0; i < v.count; i++) {
      v.getMatrixAt(i, m)
      const p = new THREE.Vector3().setFromMatrixPosition(m)
      const b = new THREE.Box3(new THREE.Vector3(p.x - 0.45, 0, p.z - 0.55), new THREE.Vector3(p.x + 0.45, 2.3, p.z + 0.55))
      out.push(b)
    }
    return out
  }
}
