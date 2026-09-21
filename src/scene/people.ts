import * as THREE from 'three'
import { RACK, PALLET, MODULES, AREAS, aisleV, type Facility, type Person, type Truck, type PickFace, type Role, type Ladder } from '../facility'
import { TOTE_DROPS, type FlowMode } from '../layout'
import { boxAt, cylAt, setInstance, mergeAny } from './util'
import { makeToteGeometry } from './conveyor'
import { makePalletGeometry } from './racking'
import type { Mats } from './mats'
import { rng } from '../rng'

// ---- The figure --------------------------------------------------------------------------------------------
// A 1.75 m associate built from real segment lengths, posed procedurally. One skeleton is shared: it is posed for
// each person every frame and its joint matrices are copied into one instanced mesh per body part.
const SEG = { hip: 0.92, torso: 0.52, headR: 0.11, shoulderX: 0.2, upperArm: 0.3, forearm: 0.28, thigh: 0.45, shin: 0.44, hipX: 0.09 }
const VEST: Record<Role, number> = { picker: 0xff6a00, packer: 0xd6ff00, receiver: 0xd6ff00, sorter: 0xff6a00, qc: 0xd6ff00, grader: 0xd6ff00, driver: 0xff6a00, lead: 0x1e6fff }
const SKIN = [0xf1c9a5, 0xe0ac7e, 0xc68642, 0x8d5524, 0x5c3a1e, 0xf5d6c6]
const SHIRT = [0x2b2f3a, 0x3b3f46, 0x1d2a44, 0x4a4a4a, 0x5a3d2b, 0x223b2a]
const PANTS = [0x1f2a44, 0x2b2b2b, 0x3a3a3a, 0x4b3b2a]

type Pose = 'idle' | 'walk' | 'scan' | 'pick' | 'place' | 'work' | 'drive' | 'sit' | 'climb'

class Skeleton {
  root = new THREE.Object3D()
  hips = new THREE.Object3D(); torso = new THREE.Object3D(); head = new THREE.Object3D()
  shoulder = [new THREE.Object3D(), new THREE.Object3D()]; elbow = [new THREE.Object3D(), new THREE.Object3D()]; hand = [new THREE.Object3D(), new THREE.Object3D()]
  hip = [new THREE.Object3D(), new THREE.Object3D()]; knee = [new THREE.Object3D(), new THREE.Object3D()]; foot = [new THREE.Object3D(), new THREE.Object3D()]
  // Mesh anchors, offset to the segment centres.
  meshes: Record<string, THREE.Object3D> = {}
  constructor() {
    const { hip, torso, headR, shoulderX, upperArm, forearm, thigh, shin, hipX } = SEG
    this.root.add(this.hips); this.hips.position.y = hip
    this.hips.add(this.torso); this.torso.add(this.head); this.head.position.y = torso + headR + 0.02
    for (const s of [0, 1]) {
      const sx = s ? 1 : -1
      this.torso.add(this.shoulder[s]); this.shoulder[s].position.set(sx * shoulderX, torso - 0.06, 0)
      this.shoulder[s].add(this.elbow[s]); this.elbow[s].position.y = -upperArm
      this.elbow[s].add(this.hand[s]); this.hand[s].position.y = -forearm
      this.hips.add(this.hip[s]); this.hip[s].position.set(sx * hipX, 0, 0)
      this.hip[s].add(this.knee[s]); this.knee[s].position.y = -thigh
      this.knee[s].add(this.foot[s]); this.foot[s].position.y = -shin
    }
    const anchor = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); this.meshes[name] = o }
    anchor('hips', this.hips, 0, 0.06, 0)
    anchor('torso', this.torso, 0, torso / 2 + 0.08, 0)
    anchor('vest', this.torso, 0, torso / 2 + 0.1, 0)
    anchor('badge', this.torso, 0.1, torso / 2 + 0.05, 0.135)
    anchor('head', this.head, 0, 0, 0)
    anchor('cap', this.head, 0, headR - 0.02, -0.01)
    for (const s of [0, 1]) {
      anchor(`upperArm${s}`, this.shoulder[s], 0, -upperArm / 2, 0)
      anchor(`forearm${s}`, this.elbow[s], 0, -forearm / 2, 0)
      anchor(`hand${s}`, this.hand[s], 0, -0.04, 0)
      anchor(`thigh${s}`, this.hip[s], 0, -thigh / 2, 0)
      anchor(`shin${s}`, this.knee[s], 0, -shin / 2, 0)
      anchor(`foot${s}`, this.foot[s], 0, -0.04, 0.05)
    }
    anchor('scanner', this.hand[1], 0, -0.06, 0.06)
  }

  /** Pose the shared skeleton. `phase` advances with distance walked; `t` is time for stationary loops. */
  pose(p: Pose, phase: number, t: number, seatY = 0) {
    const sw = Math.sin(phase), cw = Math.cos(phase)
    const [sL, sR] = this.shoulder, [eL, eR] = this.elbow, [hL, hR] = this.hip, [kL, kR] = this.knee
    this.hips.position.y = SEG.hip; this.hips.rotation.set(0, 0, 0); this.torso.rotation.set(0, 0, 0); this.head.rotation.set(0, 0, 0)
    for (const o of [sL, sR, eL, eR, hL, hR, kL, kR]) o.rotation.set(0, 0, 0)
    for (const f of this.foot) f.rotation.set(0, 0, 0)
    switch (p) {
      case 'walk':
        this.hips.position.y = SEG.hip + Math.abs(cw) * 0.02
        hL.rotation.x = sw * 0.55; hR.rotation.x = -sw * 0.55
        kL.rotation.x = Math.max(0, -cw) * 0.9 * (sw > 0 ? 0 : 1) + Math.max(0, sw) * 0.0; kR.rotation.x = Math.max(0, cw) * 0.9 * (sw < 0 ? 0 : 1)
        kL.rotation.x = Math.max(0, Math.sin(phase + Math.PI / 2)) * 0.8 * (sw < 0 ? 1 : 0.2); kR.rotation.x = Math.max(0, Math.sin(phase - Math.PI / 2)) * 0.8 * (sw > 0 ? 1 : 0.2)
        sL.rotation.x = -sw * 0.4; sR.rotation.x = sw * 0.4; eL.rotation.x = -0.3; eR.rotation.x = -0.3
        this.torso.rotation.y = sw * 0.06
        break
      case 'idle':
        sL.rotation.x = 0.05 * Math.sin(t * 1.3); sR.rotation.x = -0.05 * Math.sin(t * 1.3); eL.rotation.x = -0.15; eR.rotation.x = -0.15
        this.torso.rotation.x = 0.02 * Math.sin(t * 0.8)
        break
      case 'scan':
        // Right arm raised toward the target, left arm relaxed; head looks along the aim.
        sR.rotation.x = -1.25; eR.rotation.x = -0.35; sL.rotation.x = 0.1; eL.rotation.x = -0.4; this.head.rotation.x = -0.15
        break
      case 'pick':
        sL.rotation.x = -1.0 + 0.15 * Math.sin(t * 4); sR.rotation.x = -1.0 + 0.15 * Math.sin(t * 4); eL.rotation.x = -0.6; eR.rotation.x = -0.6; this.torso.rotation.x = 0.25
        break
      case 'place':
        sL.rotation.x = -0.7; sR.rotation.x = -0.7; eL.rotation.x = -0.9; eR.rotation.x = -0.9; this.torso.rotation.x = 0.2
        break
      case 'work':
        // Hands over a bench, small alternating motion.
        sL.rotation.x = -0.75 + 0.2 * Math.sin(t * 3); sR.rotation.x = -0.75 - 0.2 * Math.sin(t * 3 + 1); eL.rotation.x = -1.1; eR.rotation.x = -1.1; this.torso.rotation.x = 0.12
        break
      case 'climb':
        // Working a ladder: hands alternate overhead, feet alternate on the treads, body pitched into the
        // rungs. The root carries the height; the hips stay at standing height above the tread.
        {
          const c = Math.sin(phase)
          this.torso.rotation.x = 0.10
          sL.rotation.x = -2.05 + c * 0.42; sR.rotation.x = -2.05 - c * 0.42
          eL.rotation.x = -0.40 + c * 0.15; eR.rotation.x = -0.40 - c * 0.15
          hL.rotation.x = -0.55 + c * 0.45; hR.rotation.x = -0.55 - c * 0.45
          kL.rotation.x = 1.15 - c * 0.30;   kR.rotation.x = 1.15 + c * 0.30
        }
        break
      case 'drive':
      case 'sit':
        this.hips.position.y = seatY
        hL.rotation.x = -1.4; hR.rotation.x = -1.4; kL.rotation.x = 1.3; kR.rotation.x = 1.3
        if (p === 'drive') { sL.rotation.x = -0.9; sR.rotation.x = -0.9; eL.rotation.x = -0.9; eR.rotation.x = -0.9 } else { sL.rotation.x = -0.4; sR.rotation.x = -0.4; eL.rotation.x = -1.2; eR.rotation.x = -1.2 }
        break
    }
  }
}

// ---- Behaviour ---------------------------------------------------------------------------------------------
type Step =
  | { kind: 'walk'; to: [number, number]; speed?: number }
  | { kind: 'scan'; face: PickFace }
  | { kind: 'hold'; pose: Pose; dur: number; task?: string; facing?: number }
  | { kind: 'drop'; at: [number, number] }
  /** Mount, work the top, dismount. `up` is the direction of travel. */
  | { kind: 'climb'; ladder: Ladder; up: boolean }
interface Actor {
  p: Person; x: number; z: number; yaw: number; phase: number; t: number
  /** Height of the feet above the floor. Non-zero only while on a ladder. */
  y: number
  steps: Step[]; i: number; stepT: number; pose: Pose; cart: number; seatY: number
  aimTarget: THREE.Vector3 | null; scanned: boolean; truck: number
  /** The aisle ladder this associate works, if any. */
  ladder: Ladder | null
}
interface Vehicle {
  t: Truck; x: number; z: number; yaw: number; steps: Step[]; i: number; stepT: number; lift: number; liftTarget: number; driver: Actor
}

const WALK = 1.35, JOG_CART = 1.1
const pad = (n: number) => String(n).padStart(2, '0')

export class People {
  group = new THREE.Group()
  volumes: THREE.InstancedMesh
  truckVolumes: THREE.InstancedMesh
  /** Called when a person completes a scan of a pick face. */
  onScan?: (p: Person, face: PickFace) => void
  onEvent?: (src: string, msg: string) => void
  /** Called when a picker drops a tote on the takeaway belt, with the drop point. */
  onDrop?: (p: Person, at: [number, number]) => void
  private sk = new Skeleton()
  private parts = new Map<string, THREE.InstancedMesh>()
  private actors: Actor[] = []
  private vehicles: Vehicle[] = []
  private aim: THREE.InstancedMesh
  private cartFrame: THREE.InstancedMesh
  private cartTotes: THREE.InstancedMesh
  private truckParts: Record<string, THREE.InstancedMesh>
  private truckPallet: THREE.InstancedMesh
  private truckLoad: THREE.InstancedMesh
  private tmpM = new THREE.Matrix4()
  private tmpV = new THREE.Vector3()
  mode: FlowMode = 'conveyor'

  constructor(private f: Facility, M: Mats) {
    const n = f.people.length
    const skin = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 })
    const cloth = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
    const vestMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x111111 })
    const dark = M.steelDark
    const geo: Record<string, [THREE.BufferGeometry, THREE.Material]> = {
      hips: [new THREE.BoxGeometry(0.34, 0.2, 0.22), cloth], torso: [new THREE.BoxGeometry(0.36, 0.5, 0.22), cloth],
      vest: [makeVestGeometry(), vestMat], badge: [new THREE.PlaneGeometry(0.06, 0.09), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 })],
      head: [new THREE.SphereGeometry(SEG.headR, 12, 10), skin], cap: [new THREE.BoxGeometry(0.2, 0.05, 0.22), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })],
      scanner: [new THREE.BoxGeometry(0.075, 0.17, 0.045), dark],
    }
    for (const s of [0, 1]) {
      geo[`upperArm${s}`] = [new THREE.BoxGeometry(0.1, SEG.upperArm, 0.1), cloth]; geo[`forearm${s}`] = [new THREE.BoxGeometry(0.085, SEG.forearm, 0.085), skin]
      geo[`hand${s}`] = [new THREE.BoxGeometry(0.08, 0.09, 0.05), skin]; geo[`thigh${s}`] = [new THREE.BoxGeometry(0.15, SEG.thigh, 0.15), cloth]
      geo[`shin${s}`] = [new THREE.BoxGeometry(0.12, SEG.shin, 0.12), cloth]; geo[`foot${s}`] = [new THREE.BoxGeometry(0.1, 0.08, 0.26), dark]
    }
    const tint = new THREE.Color()
    for (const [name, [g, m]] of Object.entries(geo)) {
      const im = new THREE.InstancedMesh(g, m, n)
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false
      this.parts.set(name, im); this.group.add(im)
    }
    f.people.forEach((p, i) => {
      const sk = SKIN[i % SKIN.length], sh = SHIRT[(i * 3) % SHIRT.length], pa = PANTS[(i * 5) % PANTS.length]
      for (const name of ['head', 'forearm0', 'forearm1', 'hand0', 'hand1']) this.parts.get(name)!.setColorAt(i, tint.setHex(sk))
      for (const name of ['torso', 'upperArm0', 'upperArm1']) this.parts.get(name)!.setColorAt(i, tint.setHex(sh))
      for (const name of ['hips', 'thigh0', 'thigh1', 'shin0', 'shin1']) this.parts.get(name)!.setColorAt(i, tint.setHex(pa))
      this.parts.get('vest')!.setColorAt(i, tint.setHex(VEST[p.role]))
      this.parts.get('cap')!.setColorAt(i, tint.setHex([0x222222, 0x4a2e1a, 0x8a6a3a, 0x111111][i % 4]))
    })
    // Red aim line from the handheld to the label being scanned.
    this.aim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.008, 1), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 3 }), n)
    this.aim.frustumCulled = false
    this.group.add(this.aim)
    // Pick carts: a 2-shelf tubular cart with four totes, one per picker.
    const pickers = f.people.filter(p => p.role === 'picker')
    this.cartFrame = new THREE.InstancedMesh(makeCartGeometry(), M.galvanised, pickers.length)
    this.cartTotes = new THREE.InstancedMesh(makeToteGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), pickers.length * 4)
    for (let i = 0; i < pickers.length * 4; i++) this.cartTotes.setColorAt(i, tint.setHex(i % 2 ? 0x9a9d9f : 0xe0b400))
    this.cartFrame.castShadow = true; this.cartTotes.castShadow = true
    this.group.add(this.cartFrame, this.cartTotes)
    // Trucks: chassis, mast, carriage with forks, wheels; pallet and load when carrying.
    const nt = f.trucks.length
    const truckPaint = new THREE.MeshStandardMaterial({ color: 0xf0a000, roughness: 0.4, metalness: 0.3 })
    this.truckParts = {
      chassis: new THREE.InstancedMesh(makeChassisGeometry(), truckPaint, nt),
      guard: new THREE.InstancedMesh(makeGuardGeometry(), dark, nt),
      mast: new THREE.InstancedMesh(makeMastGeometry(), dark, nt),
      forks: new THREE.InstancedMesh(makeForksGeometry(), dark, nt),
      wheels: new THREE.InstancedMesh(makeWheelsGeometry(), M.tyre, nt),
      seat: new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.1, 0.45), dark, nt),
      light: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3aa0ff, emissive: 0x3aa0ff, emissiveIntensity: 3 }), nt),
    }
    for (const m of Object.values(this.truckParts)) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m) }
    this.truckPallet = new THREE.InstancedMesh(makePalletGeometry(), M.wood, nt)
    this.truckLoad = new THREE.InstancedMesh(new THREE.BoxGeometry(PALLET.W - 0.04, 1.1, PALLET.L - 0.04), new THREE.MeshStandardMaterial({ color: 0xb98d5c, roughness: 1 }), nt)
    this.truckPallet.frustumCulled = this.truckLoad.frustumCulled = false
    this.group.add(this.truckPallet, this.truckLoad)
    // Hit volumes follow the people and trucks.
    this.volumes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), M.hit, n)
    this.volumes.userData.resolve = (id: number) => f.people[id]
    this.volumes.frustumCulled = false
    this.truckVolumes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 2.3, 3.2), M.hit, nt)
    this.truckVolumes.userData.resolve = (id: number) => f.trucks[id]
    this.truckVolumes.frustumCulled = false
    this.group.add(this.volumes, this.truckVolumes)

    this.assign()
    this.update(0)
  }

  // ---- Assign every associate a place and a loop -----------------------------------------------------------
  private assign() {
    const f = this.f
    const resA = MODULES.find(m => m.id === 'RES-A')!, fm1 = MODULES.find(m => m.id === 'FM-1')!
    let cart = 0
    const byRole = (r: Role) => f.people.filter(p => p.role === r)
    const actor = (p: Person, x: number, z: number, yaw = 0): Actor => {
      const a: Actor = { p, x, z, yaw, y: 0, phase: rng() * 6, t: rng() * 10, steps: [], i: 0, stepT: 0, pose: 'idle', cart: -1, seatY: 0, aimTarget: null, scanned: false, truck: -1, ladder: null }
      this.actors.push(a); return a
    }
    // Pickers: 15 in reserve racking aisles, 5 in the fast-mover module, each with a cart. Two of them are on break.
    byRole('picker').forEach((p, i) => {
      const onBreak = i >= 18
      if (onBreak) { p.onBreak = true; p.zone = 'BREAK'; p.task = 'On break'; const a = actor(p, -92 + i * 1.2, 52, Math.PI); a.steps = [{ kind: 'hold', pose: 'idle', dur: 1e9, task: 'On break' }]; return }
      const inFm = i >= 14
      const m = inFm ? fm1 : resA
      const aisle = inFm ? 2 + (i - 14) * 3 : 1 + i * 2 - (i > 12 ? 1 : 0)
      const x = m.x + aisleV(m, Math.min(aisle, m.rows + 1))
      p.zone = m.id; p.task = 'Picking'
      const a = actor(p, x, m.z + m.d - 2, 0)
      a.cart = cart++
      a.steps = this.pickLoop(p, m.id, x, m.z, m.z + m.d, inFm)
      // A picker in four works the upper level partway through the round: the pick face at level B is 1.75 m
      // up, which is what the aisle ladder is there for.
      if (i % 4 === 0) {
        const lad = this.ladderFor(x, m.id)
        if (lad) { a.ladder = lad; a.steps.push(...this.climbSteps(lad, m.id)) }
      }
    })
    this.pickerLoop = (a: Actor) => {
      const inFm = a.p.zone === 'FM-1'
      const m = inFm ? fm1 : resA
      const steps = this.pickLoop(a.p, m.id, a.steps.length && a.steps[0].kind === 'walk' ? a.steps[0].to[0] : a.x, m.z, m.z + m.d, inFm)
      // The climb is part of the round, so it has to be put back when the round is rebuilt.
      if (a.ladder) steps.push(...this.climbSteps(a.ladder, m.id))
      return steps
    }
    // Packers, receivers and QC work their stations.
    for (const role of ['packer', 'receiver', 'qc'] as const) byRole(role).forEach(p => {
      const st = p.station ? f.byId.get(p.station) : null
      if (!st || st.kind !== 'station') { const a = actor(p, -60, 30, 0); a.steps = [{ kind: 'hold', pose: 'idle', dur: 1e9, task: 'Awaiting assignment' }]; return }
      const dir = st.face[2]
      const off = role === 'packer' ? 0.85 : role === 'receiver' ? -0.75 : 0.75
      const a = actor(p, st.center[0] + (role === 'receiver' ? 0.8 : 0), st.center[2] + dir * off, dir > 0 ? Math.PI : 0)
      if (role === 'receiver') a.yaw = 0
      p.zone = st.zone; p.task = role === 'packer' ? `Packing at ${st.id}` : role === 'receiver' ? `Decanting at ${st.id}` : `Inspecting at ${st.id}`
      p.rate = st.rate
      a.steps = [{ kind: 'hold', pose: 'work', dur: 6 + rng() * 6 }, { kind: 'hold', pose: 'place', dur: 1.2 }, { kind: 'hold', pose: 'work', dur: 4 + rng() * 6 }, { kind: 'hold', pose: 'idle', dur: 1.5 }]
    })
    // Sorters walk the sort line: take a box off the line, carry it to a gaylord, come back.
    byRole('sorter').forEach((p, i) => {
      const lanes = f.lanes.filter(l => l.role === 'sort').slice(i * 7, i * 7 + 7)
      p.zone = 'SORT'; p.task = 'Scan-to-sort'; p.rate = 180 + Math.round(rng() * 80)
      const a = actor(p, lanes[0].center[0], 49.4, Math.PI)
      const steps: Step[] = []
      for (const l of lanes) {
        steps.push({ kind: 'walk', to: [l.center[0], 49.4] }, { kind: 'hold', pose: 'scan', dur: 0.8, task: `Scanning box for ${l.door}`, facing: 0 }, { kind: 'hold', pose: 'pick', dur: 0.9, facing: 0 }, { kind: 'walk', to: [l.center[0], 50.2] }, { kind: 'hold', pose: 'place', dur: 1.0, task: `Placing into ${l.id} · ${l.carrier}`, facing: Math.PI })
      }
      a.steps = steps
    })
    // Graders at the grading benches (returns zone), leads walking the floor.
    byRole('grader').forEach((p, i) => { const g = AREAS.find(x => x.id === 'GRADE')!; p.zone = 'GRADE'; p.task = 'Grading returns'; p.rate = 30 + i * 4; const a = actor(p, g.x + 4 + i * 6, g.z + 8, Math.PI); a.steps = [{ kind: 'hold', pose: 'work', dur: 8, task: 'Grading returns' }, { kind: 'hold', pose: 'scan', dur: 1 }, { kind: 'hold', pose: 'place', dur: 1 }] })
    byRole('lead').forEach((p, i) => {
      p.zone = i ? 'OUTBOUND' : 'INBOUND'; p.task = 'Walking the floor'; p.rate = 8
      const path: [number, number][] = i ? [[-100, 40], [40, 40], [40, 60], [-60, 60]] : [[-110, -66], [-40, -66], [-40, -78], [-110, -78]]
      const a = actor(p, path[0][0], path[0][1], 0)
      a.steps = path.flatMap(pt => [{ kind: 'walk', to: pt } as Step, { kind: 'hold', pose: 'idle', dur: 3, task: 'Checking in with the team' } as Step])
    })
    // Drivers: four reach trucks doing putaway into RES-A, two counterbalance forklifts on the inbound dock.
    const drivers = byRole('driver')
    f.trucks.forEach((t, i) => {
      const d = drivers[i]
      const a = actor(d, 0, 0, 0); a.truck = i; a.seatY = t.type === 'reach' ? 1.02 : 0.95
      d.zone = t.type === 'reach' ? 'RES-A' : 'IB-STG'; d.task = t.type === 'reach' ? 'Putaway to reserve' : 'Unloading trailers'; d.rate = 20 + Math.round(rng() * 12)
      const v: Vehicle = { t, x: 0, z: 0, yaw: 0, steps: [], i: 0, stepT: 0, lift: 0, liftTarget: 0, driver: a }
      if (t.type === 'reach') {
        const aisle = 4 + i * 6
        const x = resA.x + aisleV(resA, aisle)
        const stagingX = -100 + i * 18
        v.x = stagingX; v.z = -64.5
        t.task = `Putaway to AISLE ${pad(aisle)}`
        v.steps = [
          { kind: 'hold', pose: 'drive', dur: 2, task: 'Picking up pallet at putaway staging' },
          { kind: 'walk', to: [stagingX, -59.5], speed: 2.2 }, { kind: 'walk', to: [x, -59.5], speed: 2.8 }, { kind: 'walk', to: [x, -40 - i * 4], speed: 2.4 },
          { kind: 'hold', pose: 'drive', dur: 5, task: `Stowing pallet at ${x.toFixed(0)}` }, // lift handled by liftTarget in step logic
          { kind: 'walk', to: [x, -59.5], speed: 2.4 }, { kind: 'walk', to: [stagingX, -59.5], speed: 2.8 }, { kind: 'walk', to: [stagingX, -64.5], speed: 2.0 },
        ]
      } else {
        const door = f.docks.filter(x => x.prefix === 'IB' && x.trailerId)[i === 4 ? 1 : 4]
        const x = door.center[0]
        v.x = x; v.z = -84; v.yaw = Math.PI
        t.task = `Unloading ${door.id}`
        v.steps = [
          { kind: 'walk', to: [x, -89.5], speed: 1.8 }, { kind: 'hold', pose: 'drive', dur: 2.5, task: `Taking pallet off ${door.trailerId}` },
          { kind: 'walk', to: [x, -84], speed: 1.8 }, { kind: 'walk', to: [x + 3.6, -84], speed: 1.6 }, { kind: 'hold', pose: 'drive', dur: 2, task: 'Setting pallet in staging' },
          { kind: 'walk', to: [x, -84], speed: 1.8 },
        ]
      }
      this.vehicles.push(v)
    })
  }

  private pickerLoop: ((a: Actor) => Step[]) | null = null

  /** Switch how totes reach pack. Pickers restart their loops from the aisle mouth; everyone else is unaffected. */
  setFlowMode(mode: FlowMode) {
    if (mode === this.mode) return
    this.mode = mode
    for (const a of this.actors) if (a.cart >= 0 && !a.p.onBreak && this.pickerLoop) { a.steps = this.pickerLoop(a); a.i = 0; a.stepT = 0; a.scanned = false }
  }

  /** A picker's loop: walk the aisle stopping at faces to scan and pick, then hand the tote off: onto the takeaway
   *  belt in conveyor mode, or carried around the storage block to the pack drop in walk mode, and back. */
  private pickLoop(p: Person, module: string, x: number, zNorth: number, zSouth: number, shelf: boolean): Step[] {
    const steps: Step[] = []
    const stops = 5 + Math.floor(rng() * 3)
    const faces = shelf ? [] : this.f.faces.filter(fc => fc.module === module && Math.abs(fc.center[0] - x) < RACK.aisle / 2 + 1 && fc.sku)
    const bins = shelf ? this.f.bins.filter(b => b.module === module && Math.abs(b.center[0] - x) < 1.2 && b.sku) : []
    const zs: number[] = []
    for (let k = 0; k < stops; k++) zs.push(zSouth - 6 - k * ((zSouth - zNorth - 12) / stops) - rng() * 3)
    p.rate = 90 + Math.round(rng() * 50)
    for (const z of zs) {
      steps.push({ kind: 'walk', to: [x, z], speed: JOG_CART })
      const face = faces.length ? faces.reduce((b, fc) => (Math.abs(fc.center[2] - z) < Math.abs(b.center[2] - z) ? fc : b)) : null
      if (face) {
        const facing = face.face[0] > 0 ? -Math.PI / 2 : Math.PI / 2 // face vector points out of the rack toward the aisle; look back into it
        steps.push({ kind: 'scan', face }, { kind: 'hold', pose: 'pick', dur: 1.4 + rng(), task: `Picking ${face.product} at ${face.id}`, facing }, { kind: 'hold', pose: 'place', dur: 0.8, task: 'Placing in tote', facing })
      } else {
        const bin = bins.length ? bins.reduce((b, bn) => (Math.abs(bn.center[2] - z) < Math.abs(b.center[2] - z) ? bn : b)) : null
        const facing = bin && bin.face[0] > 0 ? -Math.PI / 2 : Math.PI / 2
        steps.push({ kind: 'hold', pose: 'scan', dur: 1.0, task: bin ? `Scanning ${bin.id}` : 'Scanning bin', facing }, { kind: 'hold', pose: 'pick', dur: 1.2 + rng(), task: bin ? `Picking ${bin.product} at ${bin.id}` : 'Picking', facing }, { kind: 'hold', pose: 'place', dur: 0.7, facing })
      }
    }
    if (this.mode === 'walk') {
      // Carry the tote to the pack drop: west of the racking for RES-A, down the centre aisle for FM-1, then back.
      const drop = TOTE_DROPS.find(d => d.from === (shelf ? 'FM-1' : 'RES-A'))!
      const out: [number, number][] = shelf
        ? [[x, -36], [42, -36], [42, 15.5], [drop.x, 15.5], [drop.x, drop.z - 1.4]]
        : [[x, 15.5], [-120, 15.5], [-120, drop.z - 1.4], [drop.x - 1.4, drop.z - 1.4]]
      for (const pt of out) steps.push({ kind: 'walk', to: pt, speed: JOG_CART })
      steps.push({ kind: 'drop', at: [drop.x, drop.z] })
      for (const pt of [...out].reverse().slice(1)) steps.push({ kind: 'walk', to: pt, speed: JOG_CART })
      steps.push({ kind: 'walk', to: [x, zSouth - 1], speed: JOG_CART })
      return steps
    }
    // South end: to the takeaway belt, drop the tote, come back to the aisle mouth.
    const beltZ = shelf ? -37.2 : 17.3
    steps.push({ kind: 'walk', to: [x, zSouth + 1.5], speed: JOG_CART }, { kind: 'walk', to: [x, beltZ - 0.6], speed: JOG_CART }, { kind: 'drop', at: [x, beltZ] }, { kind: 'walk', to: [x, zSouth - 1], speed: JOG_CART })
    return steps
  }

  /** The aisle ladder nearest this picker's aisle. */
  private ladderFor(x: number, module: string): Ladder | null {
    const near = this.f.ladders.filter(l => l.module === module)
    if (!near.length) return null
    return near.reduce((b, l) => (Math.abs(l.center[0] - x) < Math.abs(b.center[0] - x) ? l : b))
  }

  /**
   * Mount, work the upper pick level, dismount.
   *
   * Deliberately takes NO draws from the shared stream. This sequence is appended to existing picker loops,
   * and every draw in this file is consumed in a fixed order that the order trace and the console depend on.
   */
  private climbSteps(ladder: Ladder, module: string): Step[] {
    const face = this.f.faces
      .filter(fc => fc.module === module && fc.level === 1 && fc.sku &&
        Math.hypot(fc.center[0] - ladder.center[0], fc.center[2] - ladder.center[2]) < 3.2)
      .sort((a, b) => Math.abs(a.center[2] - ladder.center[2]) - Math.abs(b.center[2] - ladder.center[2]))[0] ?? null
    const facing = ladder.yaw + Math.PI          // square up to the rungs
    const ax = ladder.center[0] + Math.sin(ladder.yaw) * 1.5
    const az = ladder.center[2] + Math.cos(ladder.yaw) * 1.5
    const out: Step[] = [
      { kind: 'walk', to: [ax, az] },
      { kind: 'climb', ladder, up: true },
    ]
    if (face) out.push({ kind: 'hold', pose: 'scan', dur: 1.1, task: `Scanning ${face.id}`, facing })
    out.push({ kind: 'hold', pose: 'pick', dur: 3.4, facing, task: face ? `Picking ${face.product} from level B` : `Working level B · ${ladder.aisle}` })
    out.push({ kind: 'hold', pose: 'place', dur: 1.2, task: 'Placing in tote', facing })
    out.push({ kind: 'climb', ladder, up: false })
    return out
  }

  // ---- Per-frame -------------------------------------------------------------------------------------------
  update(dt: number) {
    for (const v of this.vehicles) this.stepVehicle(v, dt)
    for (const a of this.actors) if (a.truck < 0) this.stepActor(a, dt)
    this.actors.forEach((a, i) => this.drawActor(a, i))
    this.vehicles.forEach((v, i) => this.drawVehicle(v, i))
    for (const m of this.parts.values()) m.instanceMatrix.needsUpdate = true
    for (const m of Object.values(this.truckParts)) m.instanceMatrix.needsUpdate = true
    for (const m of [this.aim, this.cartFrame, this.cartTotes, this.truckPallet, this.truckLoad, this.volumes, this.truckVolumes]) m.instanceMatrix.needsUpdate = true
  }

  private stepActor(a: Actor, dt: number) {
    a.t += dt
    if (!a.steps.length) return
    const s = a.steps[a.i]
    a.stepT += dt
    const finish = () => { a.i = (a.i + 1) % a.steps.length; a.stepT = 0; a.scanned = false; a.aimTarget = null; a.p.scanning = false }
    if (s.kind === 'walk') {
      const dx = s.to[0] - a.x, dz = s.to[1] - a.z, d = Math.hypot(dx, dz)
      const sp = s.speed ?? WALK
      if (d < 0.05) { finish(); return }
      const step = Math.min(d, sp * dt)
      a.x += dx / d * step; a.z += dz / d * step; a.yaw = Math.atan2(dx, dz)
      a.y = 0
      a.phase += step * 3.4
      a.pose = 'walk'
      if (a.cart >= 0 && this.mode === 'walk' && a.i > a.steps.length - 12 && a.i < a.steps.length - 6) a.p.task = 'Carrying tote to the pack drop'
    } else if (s.kind === 'scan') {
      a.pose = 'scan'; a.p.scanning = true
      const fc = s.face
      a.yaw = fc.face[0] > 0 ? -Math.PI / 2 : Math.PI / 2
      a.aimTarget = this.tmpV.set(fc.center[0] + fc.face[0] * (RACK.frameDepth / 2 - RACK.column + 0.05), RACK.levelPitch + (fc.level === 0 ? -0.026 : 0.026), fc.center[2] + 0.4).clone()
      a.p.task = `Scanning ${fc.id}`
      if (a.stepT > 0.9 && !a.scanned) { a.scanned = true; this.onScan?.(a.p, fc) }
      if (a.stepT > 1.3) finish()
    } else if (s.kind === 'hold') {
      a.pose = s.pose; if (s.task) a.p.task = s.task
      if (s.facing !== undefined) a.yaw = s.facing
      if (s.pose === 'scan') a.p.scanning = true
      if (a.stepT > s.dur) finish()
    } else if (s.kind === 'climb') {
      const L = s.ladder
      const DUR = 2.8
      const t = Math.min(1, a.stepT / DUR)
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const f = s.up ? e : 1 - e
      // Local +z is the mounting side; the ladder climbs toward its own -z, which stands against the rack.
      const z0 = L.type === 'rolling' ? 0.52 : 0.30
      const z1 = L.type === 'rolling' ? -0.30 : -0.02
      const lz = z0 + (z1 - z0) * f + 0.12
      a.x = L.center[0] + lz * Math.sin(L.yaw)
      a.z = L.center[2] + lz * Math.cos(L.yaw)
      a.y = L.platformH * f
      a.yaw = L.yaw + Math.PI          // square up to the rungs
      a.pose = 'climb'
      a.phase += dt * 5.5
      a.p.task = s.up ? `Working level B · ${L.aisle}` : `Climbing down · ${L.aisle}`
      if (t >= 1) { a.y = s.up ? L.platformH : 0; finish() }
    } else if (s.kind === 'drop') {
      a.pose = 'place'; a.yaw = Math.atan2(s.at[0] - a.x, s.at[1] - a.z); a.p.task = this.mode === 'walk' ? 'Dropping tote at the pack drop' : 'Dropping tote on takeaway conveyor'
      if (a.stepT > 0.5 && !a.scanned) { a.scanned = true; this.onEvent?.('RF', `Tote T${Math.floor(100000 + rng() * 899999)} ${this.mode === 'walk' ? 'dropped at pack drop' : 'inducted · takeaway'} · ${a.p.name}`); this.onDrop?.(a.p, s.at) }
      if (a.stepT > 1.4) finish()
    }
  }

  private stepVehicle(v: Vehicle, dt: number) {
    const s = v.steps[v.i]
    v.stepT += dt
    const a = v.driver
    a.t += dt
    a.pose = 'drive'
    if (s.kind === 'walk') {
      const dx = s.to[0] - v.x, dz = s.to[1] - v.z, d = Math.hypot(dx, dz)
      const sp = s.speed ?? 2
      if (d < 0.05) { v.i = (v.i + 1) % v.steps.length; v.stepT = 0 } else {
        const step = Math.min(d, sp * dt)
        v.x += dx / d * step; v.z += dz / d * step
        const target = Math.atan2(dx, dz)
        let dy = target - v.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI
        v.yaw += Math.sign(dy) * Math.min(Math.abs(dy), 2.5 * dt)
      }
      v.liftTarget = 0.15
    } else if (s.kind === 'hold') {
      if (s.task) { v.t.task = s.task; a.p.task = s.task }
      // Stow: raise to the level, pause, lower; putaway staging and dock: forks low. Pallet on forks only on the way in.
      if (v.t.type === 'reach' && s.task?.startsWith('Stowing')) { v.liftTarget = v.stepT < 3.5 ? 3.5 : 0.15; v.t.carrying = v.stepT < 2.5 }
      else if (s.task?.startsWith('Picking up') || s.task?.startsWith('Taking')) { v.liftTarget = 0.15; if (v.stepT > 1.5) v.t.carrying = true }
      else if (s.task?.startsWith('Setting')) { if (v.stepT > 1) v.t.carrying = false }
      if (v.stepT > s.dur) { v.i = (v.i + 1) % v.steps.length; v.stepT = 0 }
    }
    v.lift += (v.liftTarget - v.lift) * Math.min(1, dt * 2.5)
    a.x = v.x; a.z = v.z; a.yaw = v.yaw
    v.t.center = [v.x, 1.0, v.z]; v.t.face = [Math.sin(v.yaw), 0, Math.cos(v.yaw)]
  }

  private drawActor(a: Actor, i: number) {
    const sk = this.sk
    const seated = a.truck >= 0 || a.pose === 'sit'
    // A seated driver sits 0.55 m back from the truck origin (the mast end is +z forward).
    const px = seated && a.truck >= 0 ? a.x - Math.sin(a.yaw) * 0.55 : a.x
    const pz = seated && a.truck >= 0 ? a.z - Math.cos(a.yaw) * 0.55 : a.z
    sk.root.position.set(px, a.y, pz); sk.root.rotation.y = a.yaw
    sk.pose(a.pose, a.phase, a.t, a.seatY)
    sk.root.updateMatrixWorld(true)
    for (const [name, im] of this.parts) {
      if (name === 'scanner' && !(a.pose === 'scan' || a.p.role === 'picker' || a.p.role === 'sorter' || a.p.role === 'receiver')) { setInstance(im, i, 0, -10, 0); continue }
      im.setMatrixAt(i, sk.meshes[name].matrixWorld)
    }
    a.p.center = [a.x, a.y + 0.9, a.z]; a.p.face = [Math.sin(a.yaw), 0, Math.cos(a.yaw)]
    setInstance(this.volumes, i, a.x, seated ? a.seatY : a.y + 0.9, a.z, 1, 1, 1, 0, a.yaw, 0)
    // Aim line from the scanner to the target while scanning.
    if (a.pose === 'scan' && a.aimTarget) {
      const from = this.tmpV.setFromMatrixPosition(sk.meshes.scanner.matrixWorld)
      const d = from.distanceTo(a.aimTarget)
      const mid = from.clone().lerp(a.aimTarget, 0.5)
      this.tmpM.lookAt(from, a.aimTarget, new THREE.Vector3(0, 1, 0))
      const q = new THREE.Quaternion().setFromRotationMatrix(this.tmpM)
      this.tmpM.compose(mid, q, new THREE.Vector3(1, 1, d))
      this.aim.setMatrixAt(i, this.tmpM)
    } else setInstance(this.aim, i, 0, -10, 0, 0.001, 0.001, 0.001)
    // Cart follows 0.9 m behind the picker.
    if (a.cart >= 0) {
      const cx = a.x - Math.sin(a.yaw) * 0.95, cz = a.z - Math.cos(a.yaw) * 0.95
      setInstance(this.cartFrame, a.cart, cx, 0, cz, 1, 1, 1, 0, a.yaw, 0)
      for (let k = 0; k < 4; k++) {
        const lx = (k % 2 ? 0.24 : -0.24), ly = k < 2 ? 0.28 : 0.86, lz = 0
        const wx = cx + Math.cos(a.yaw) * lx + Math.sin(a.yaw) * lz, wz = cz - Math.sin(a.yaw) * lx + Math.cos(a.yaw) * lz
        setInstance(this.cartTotes, a.cart * 4 + k, wx, ly, wz, 1, 1, 1, 0, a.yaw + Math.PI / 2, 0)
      }
    }
  }

  private drawVehicle(v: Vehicle, i: number) {
    const { x, z, yaw } = v
    const reach = v.t.type === 'reach'
    const sy = reach ? 1.0 : 1.0
    const P = this.truckParts
    setInstance(P.chassis, i, x, 0, z, reach ? 0.92 : 1, 1, reach ? 1.05 : 1, 0, yaw, 0)
    setInstance(P.guard, i, x, 0, z, 1, 1, 1, 0, yaw, 0)
    setInstance(P.mast, i, x, 0, z, 1, reach ? 1.6 : 1, 1, 0, yaw, 0)
    setInstance(P.wheels, i, x, 0, z, 1, 1, 1, 0, yaw, 0)
    setInstance(P.seat, i, x - Math.sin(yaw) * 0.55, 0.95, z - Math.cos(yaw) * 0.55, 1, sy, 1, 0, yaw, 0)
    setInstance(P.light, i, x, 2.25, z, 1, 1, 1, 0, yaw, 0)
    // Carriage and forks ride the mast; pallet and load sit on the forks when carrying.
    const fx = x + Math.sin(yaw) * 0.0, fz = z + Math.cos(yaw) * 0.0
    setInstance(P.forks, i, fx, v.lift, fz, 1, 1, 1, 0, yaw, 0)
    if (v.t.carrying) {
      const px = x + Math.sin(yaw) * 1.85, pz = z + Math.cos(yaw) * 1.85
      setInstance(this.truckPallet, i, px, v.lift + 0.02, pz, 1, 1, 1, 0, yaw + Math.PI / 2, 0)
      setInstance(this.truckLoad, i, px, v.lift + 0.02 + PALLET.H + 0.55, pz, 1, 1, 1, 0, yaw + Math.PI / 2, 0)
    } else { setInstance(this.truckPallet, i, 0, -10, 0); setInstance(this.truckLoad, i, 0, -10, 0) }
    setInstance(this.truckVolumes, i, x, 1.0, z, 1, 1, 1, 0, yaw, 0)
    this.drawActor(v.driver, this.actors.indexOf(v.driver))
  }
}

// ---- Geometry ----------------------------------------------------------------------------------------------
/** Class 2 vest: a sleeveless shell around the torso with two reflective bands. */
function makeVestGeometry(): THREE.BufferGeometry {
  const shell = new THREE.BoxGeometry(0.4, 0.44, 0.26)
  const band1 = boxAt(0.41, 0.03, 0.27, 0, -0.05, 0), band2 = boxAt(0.41, 0.03, 0.27, 0, -0.14, 0)
  return mergeAny([shell, band1, band2])
}
/** Pick cart: 1.0 × 0.6 m tubular frame, two shelves for four totes, handle at the back, casters. Origin at the floor, handle at −z. */
function makeCartGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const sx of [-0.48, 0.48]) for (const sz of [-0.28, 0.28]) parts.push(boxAt(0.025, 1.05, 0.025, sx, 0.525, sz))
  for (const y of [0.26, 0.84]) parts.push(boxAt(1.0, 0.02, 0.6, 0, y, 0))
  parts.push(boxAt(0.025, 0.025, 0.6, -0.48, 1.05, 0), boxAt(0.025, 0.025, 0.6, 0.48, 1.05, 0), boxAt(1.0, 0.025, 0.025, 0, 1.05, -0.28))
  for (const sx of [-0.45, 0.45]) for (const sz of [-0.25, 0.25]) parts.push(cylAt(0.06, 0.04, sx, 0.06, sz, 'x', 8))
  return mergeAny(parts)
}
/** Forklift chassis: body, counterweight, floorboard, dash. Origin at the floor centre, mast toward +z. */
function makeChassisGeometry(): THREE.BufferGeometry {
  return mergeAny([boxAt(1.15, 0.7, 2.2, 0, 0.55, -0.3), boxAt(1.15, 0.5, 0.5, 0, 0.5, -1.55), boxAt(1.1, 0.35, 0.5, 0, 1.05, 0.55), boxAt(1.0, 0.05, 0.8, 0, 0.9, -0.2)])
}
function makeGuardGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const sx of [-0.5, 0.5]) for (const sz of [-1.0, 0.7]) parts.push(boxAt(0.05, 1.4, 0.05, sx, 1.6, sz))
  parts.push(boxAt(1.1, 0.04, 1.8, 0, 2.3, -0.15))
  for (let k = -0.8; k < 0.7; k += 0.2) parts.push(boxAt(1.1, 0.02, 0.02, 0, 2.28, k))
  return mergeAny(parts)
}
function makeMastGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const sx of [-0.42, 0.42]) parts.push(boxAt(0.08, 2.2, 0.12, sx, 1.1, 1.05))
  for (const y of [0.3, 1.2, 2.15]) parts.push(boxAt(0.9, 0.06, 0.1, 0, y, 1.05))
  return mergeAny(parts)
}
function makeForksGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [boxAt(0.95, 0.5, 0.05, 0, 0.3, 1.14)]
  for (const sx of [-0.3, 0.3]) parts.push(boxAt(0.1, 0.04, 1.07, sx, 0.02, 1.14 + 0.535), boxAt(0.1, 0.4, 0.04, sx, 0.22, 1.16))
  return mergeAny(parts)
}
function makeWheelsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const sx of [-0.55, 0.55]) { parts.push(cylAt(0.24, 0.18, sx, 0.24, 0.55, 'x', 14)); parts.push(cylAt(0.19, 0.16, sx, 0.19, -1.1, 'x', 14)) }
  return mergeAny(parts)
}
