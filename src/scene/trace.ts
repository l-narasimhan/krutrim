import * as THREE from 'three'
import { CONVEYORS, PACK } from '../layout'
import type { Facility, Person, Vec3, Lane, Station } from '../facility'
import { makePath, along, makeToteGeometry, type Path } from './conveyor'
import { rng } from '../rng'

/**
 * Follow one order through the building: a picker's tote goes onto the takeaway belt, rides to the pack spur,
 * becomes a box at a pack station, rides the box line into SLAM, gets its label, runs down the outfeed and is
 * sorted into its carrier's gaylord. One highlighted item moves through those stages; the camera follows it and
 * a caption names each stage. Everything else on the floor keeps doing what it was doing.
 */
type Stage = 'waiting' | 'cart' | 'belt' | 'spur' | 'toBench' | 'pack' | 'boxLine' | 'slam' | 'outfeed' | 'sort' | 'done'

const SPEED = 0.6
const STAGE_N: Record<Stage, number> = { waiting: 1, cart: 1, belt: 2, spur: 2, toBench: 3, pack: 3, boxLine: 4, slam: 4, outfeed: 5, sort: 5, done: 5 }

export class OrderTrace {
  group = new THREE.Group()
  active = false
  position: Vec3 = [0, 0, 0]
  onEvent?: (src: string, msg: string) => void
  onDone?: () => void
  private stage: Stage = 'waiting'
  private t = 0
  private s = 0
  private tote: THREE.Mesh
  private box: THREE.Mesh
  private label: THREE.Mesh
  private ring: THREE.Mesh
  private picker: Person | null = null
  private station: Station | null = null
  private lane: Lane | null = null
  private orderId = ''
  private take: Path; private spur: Path; private packLine: Path; private slam: Path
  private tmp = new THREE.Vector2()
  private el = document.getElementById('tour')!
  private captionSaid = ''

  constructor(private f: Facility) {
    const glow = new THREE.MeshStandardMaterial({ color: 0x3ee39a, emissive: 0x3ee39a, emissiveIntensity: 0.9, roughness: 0.5 })
    this.tote = new THREE.Mesh(makeToteGeometry(), glow)
    this.box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0xb98d5c, emissive: 0x3ee39a, emissiveIntensity: 0.35, roughness: 1 }))
    this.label = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.15), new THREE.MeshStandardMaterial({ color: 0xf6f5f0, roughness: 0.6 }))
    this.label.rotation.x = -Math.PI / 2
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: 0x3ee39a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }))
    this.ring.rotation.x = -Math.PI / 2
    for (const m of [this.tote, this.box, this.label, this.ring]) m.visible = false
    this.group.add(this.tote, this.box, this.label, this.ring)
    const line = (id: string) => CONVEYORS.find(c => c.id === id)!
    this.take = makePath(line('CV-TAKE').points)
    const sp = line('CV-TAKE').spurs.find(x => x.at === -85)!
    this.spur = makePath([[sp.at, 18], sp.to])
    this.packLine = makePath(line('CV-PACK-S').points)
    this.slam = makePath(line('CV-SLAM').points)
  }

  /** Start following the next tote of a working picker in reserve racking A. */
  start() {
    const pickers = this.f.people.filter(p => p.role === 'picker' && !p.onBreak && p.zone === 'RES-A')
    this.picker = pickers[Math.floor(rng() * pickers.length)]
    this.station = this.f.stations.filter(s => s.type === 'single' && s.state === 'PACKING' && s.face[2] > 0).sort((a, b) => Math.abs(a.center[0] + 85) - Math.abs(b.center[0] + 85))[0]
    const sorts = this.f.lanes.filter(l => l.role === 'sort' && l.state !== 'CLOSED')
    this.lane = sorts[Math.floor(rng() * sorts.length)]
    this.orderId = String(Math.floor(1000000 + rng() * 8999999))
    this.active = true; this.stage = 'cart'; this.t = 0; this.s = 0
    this.el.hidden = false
    this.el.querySelector('.tour-head b')!.textContent = 'FOLLOWING ORDER ' + this.orderId
    for (const k of ['prev', 'next']) (this.el.querySelector(`[data-tour="${k}"]`) as HTMLElement).hidden = true
    this.caption(`Order ${this.orderId} · picking`, `${this.picker.name} is picking this order in ${this.picker.zone}. The tote rides on the cart until the aisle is done.`)
    this.onEvent?.('WMS', `Order ${this.orderId} released · single · ${this.lane.carrier} · cut-off ${this.lane.cutoff}`)
  }

  end() {
    this.active = false; this.stage = 'waiting'
    for (const m of [this.tote, this.box, this.label, this.ring]) m.visible = false
    for (const k of ['prev', 'next']) (this.el.querySelector(`[data-tour="${k}"]`) as HTMLElement).hidden = false
    this.el.hidden = true
    this.onDone?.()
  }

  /** The picker dropped a tote: if it is ours, it leaves the cart and joins the belt. */
  dropped(p: Person, at: [number, number]) {
    if (!this.active || this.stage !== 'cart' || p !== this.picker) return
    this.stage = 'belt'; this.s = Math.abs(at[0] - this.take.pts[0].x); this.t = 0
    this.caption(`Order ${this.orderId} · on the takeaway belt`, `Tote inducted at aisle ${p.zone === 'RES-A' ? at[0].toFixed(0) : ''}. It rides west to the pack singles spur.`)
    this.onEvent?.('RF', `Order ${this.orderId} · tote inducted on takeaway · ${p.name}`)
  }

  private caption(title: string, say: string) {
    if (this.captionSaid === title) return
    this.captionSaid = title
    this.el.querySelector('.tour-title')!.textContent = title
    this.el.querySelector('.tour-say')!.textContent = say
    this.el.querySelector('.tour-n')!.textContent = `stage ${STAGE_N[this.stage]} / 5`
  }

  update(dt: number) {
    if (!this.active) return
    this.t += dt
    const st = this.station!, lane = this.lane!
    let x = this.position[0], y = this.position[1], z = this.position[2], ry = 0
    const showTote = this.stage === 'cart' || this.stage === 'belt' || this.stage === 'spur' || this.stage === 'toBench' || (this.stage === 'pack' && this.t < 3)
    switch (this.stage) {
      case 'cart': {
        const p = this.picker!
        x = p.center[0] - p.face[0] * 0.95 + p.face[2] * 0.24; z = p.center[2] - p.face[2] * 0.95 - p.face[0] * 0.24; y = 0.86; ry = Math.atan2(p.face[0], p.face[2]) + Math.PI / 2
        break
      }
      case 'belt': {
        this.s += SPEED * dt
        const spurS = Math.abs(-85 - this.take.pts[0].x)
        if (this.s >= spurS) { this.stage = 'spur'; this.s = 0; this.caption(`Order ${this.orderId} · diverting to pack singles`, 'The divert pushes the tote down the spur toward the pack stations.'); break }
        ry = along(this.take, this.s, this.tmp); x = this.tmp.x; z = this.tmp.y; y = 0.852
        break
      }
      case 'spur': {
        this.s += SPEED * dt
        if (this.s >= this.spur.len) { this.stage = 'toBench'; this.t = 0; this.caption(`Order ${this.orderId} · to ${st.id}`, `${st.associate} pulls the tote off the spur to the bench.`); break }
        ry = along(this.spur, this.s, this.tmp); x = this.tmp.x; z = this.tmp.y; y = 0.852
        break
      }
      case 'toBench': {
        const tx = st.center[0] - 0.3, tz = st.center[2] - 0.2
        const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz)
        if (d < 0.05) { this.stage = 'pack'; this.t = 0; this.caption(`Order ${this.orderId} · packing at ${st.id}`, `${st.associate} scans the tote, picks the box size, packs, seals and weighs it.`); this.onEvent?.('PACK', `Order ${this.orderId} · arrived ${st.id} · ${st.associate}`); break }
        const step = Math.min(d, 1.0 * dt); x += dx / d * step; z += dz / d * step; y = 0.9
        break
      }
      case 'pack': {
        x = st.center[0] - 0.3; z = st.center[2] - 0.2; y = this.t < 3 ? 0.9 : PACK.bench.h + 0.15
        if (this.t > 6) {
          this.stage = 'boxLine'; this.s = Math.abs(st.center[0] - this.packLine.pts[0].x); this.t = 0
          this.caption(`Order ${this.orderId} · packed, onto the box line`, 'The box rides the pack singles line east and then south to the SLAM line.')
          this.onEvent?.('PACK', `Order ${this.orderId} packed · ${st.id} · ${st.associate} · 1 item`)
        }
        break
      }
      case 'boxLine': {
        this.s += SPEED * dt
        if (this.s >= this.packLine.len) { this.stage = 'slam'; this.s = Math.abs(-62 - this.slam.pts[0].x); this.caption(`Order ${this.orderId} · SLAM`, 'Checkweigh, scan tunnel, then print-and-apply puts the carrier label on the top of the box.'); break }
        ry = along(this.packLine, this.s, this.tmp); x = this.tmp.x; z = this.tmp.y; y = 0.752
        break
      }
      case 'slam': {
        this.s += SPEED * dt
        ry = along(this.slam, this.s, this.tmp); x = this.tmp.x; z = this.tmp.y; y = 0.752
        if (this.s > 61 && !this.label.visible) { this.label.visible = true; this.onEvent?.('SLAM', `Order ${this.orderId} · labelled at SLAM-1 · ${lane.carrier} · ${lane.door}`) }
        if (this.s > 61.5 && this.captionSaid.indexOf('outfeed') < 0) this.caption(`Order ${this.orderId} · labelled, on the outfeed`, `Label reads ${lane.carrier}, door ${lane.door}. The box runs east, turns south and comes west along the sort line.`)
        const sortS = this.slam.cum[2] + (48 - lane.center[0])
        if (this.s >= sortS) { this.stage = 'outfeed'; this.t = 0; this.caption(`Order ${this.orderId} · at ${lane.id}`, `A sorter scans the label and carries the box to the ${lane.carrier} gaylord.`); this.stage = 'sort' }
        break
      }
      case 'sort': {
        const tx = lane.center[0], tz = 51.2
        const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz)
        if (d < 0.05) {
          lane.units++
          this.onEvent?.('SORT', `Order ${this.orderId} · sorted into ${lane.id} · ${lane.carrier} · ${lane.door} · cut-off ${lane.cutoff}`)
          this.stage = 'done'; this.t = 0
          this.caption(`Order ${this.orderId} · sorted`, `In the ${lane.carrier} gaylord at ${lane.id}, bound for ${lane.door}. It ships at the ${lane.cutoff} cut-off.`)
          break
        }
        const step = Math.min(d, 1.0 * dt); x += dx / d * step; z += dz / d * step; y = 1.0
        break
      }
      case 'done': {
        y = 0.7
        if (this.t > 5) { this.end(); return }
        break
      }
    }
    this.position = [x, y, z]
    this.tote.visible = showTote; this.box.visible = !showTote && this.stage !== 'waiting'
    this.label.visible = this.label.visible && this.box.visible
    this.ring.visible = true
    this.tote.position.set(x, y, z); this.tote.rotation.y = ry
    this.box.position.set(x, y + 0.15, z); this.box.rotation.y = ry
    this.label.position.set(x, y + 0.305, z); this.label.rotation.z = -ry
    this.ring.position.set(x, 0.01, z)
  }
}
