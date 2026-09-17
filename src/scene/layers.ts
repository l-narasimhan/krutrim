import * as THREE from 'three'
import type { Facility, Zone } from '../facility'
import { setInstance } from './util'

export type Layer = 'overview' | 'inventory' | 'flow' | 'labor' | 'safety'

export const LAYER_TITLE: Record<Layer, string> = {
  overview: 'full hall · 62 docks · reserve racking A and B · fast-mover module FM-1',
  inventory: 'reserve cases by bay fill · bins by velocity · green full, amber low, red empty',
  flow: 'zones by process stage · conveyors lit · inbound blue, storage orange, outbound green, returns purple',
  labor: 'zones by headcount · every associate marked, green at target, amber under, red idle · drivers on trucks',
  safety: 'forklift traffic red, pedestrian walkways green · 3 m clearance rings on moving trucks · pickers in truck aisles amber',
}
const GROUP_COLOR: Record<string, number> = { inbound: 0x2f7fd6, storage: 0xe08a1e, outbound: 0x2e9e5b, returns: 0xa64ad1, support: 0x6c7682, yard: 0x8f7a3a }
const RATE_TARGET: Record<string, number> = { picker: 120, packer: 110, receiver: 320, sorter: 240, qc: 45, grader: 40, driver: 28, lead: 10 }

/**
 * Overlay layers on the scene: translucent slabs over every zone coloured by the layer's meaning, a marker over
 * every associate, and clearance rings under trucks. The storage and conveyor renderers recolour their own
 * instances through `setLayer`; this owns what sits on top of the floor.
 */
export class Layers {
  group = new THREE.Group()
  layer: Layer = 'overview'
  private slabs: THREE.InstancedMesh
  private markers: THREE.InstancedMesh
  private rings: THREE.InstancedMesh
  private c = new THREE.Color()

  constructor(private f: Facility) {
    const zones = f.zones.filter(z => !z.level)
    this.slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false }), zones.length)
    zones.forEach((z, i) => setInstance(this.slabs, i, z.center[0], 0.06, z.center[2], z.size[0] - 0.3, 0.08, z.size[2] - 0.3))
    this.slabs.renderOrder = 3
    this.markers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), f.people.length)
    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(2.6, 3.0, 40), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }), f.trucks.length)
    this.rings.renderOrder = 3
    for (const m of [this.slabs, this.markers, this.rings]) { m.frustumCulled = false; m.visible = false; this.group.add(m) }
  }

  set(layer: Layer) {
    this.layer = layer
    this.slabs.visible = layer === 'flow' || layer === 'labor' || layer === 'safety'
    this.markers.visible = layer === 'labor' || layer === 'safety'
    this.rings.visible = layer === 'safety'
    if (this.slabs.visible) this.colourSlabs()
    this.update()
  }

  private colourSlabs() {
    const zones = this.f.zones.filter(z => !z.level)
    zones.forEach((z, i) => {
      if (this.layer === 'flow') this.c.setHex(GROUP_COLOR[z.group] ?? 0x6c7682)
      else if (this.layer === 'labor') { const n = this.headcount(z); this.c.setHSL(0.33 - Math.min(n, 12) / 12 * 0.33, 0.8, n ? 0.45 : 0.18) }
      else this.c.setHex(this.truckArea(z) ? 0xd6321e : z.group === 'support' ? 0x3a4a5a : 0x2e9e5b)
      this.slabs.setColorAt(i, this.c)
    })
    this.slabs.instanceColor!.needsUpdate = true
  }

  private headcount(z: Zone) {
    const a = z.area
    return this.f.people.filter(p => p.center[0] >= a.x && p.center[0] <= a.x + a.w && p.center[2] >= a.z && p.center[2] <= a.z + a.d).length
  }
  /** Where forklifts and reach trucks run: storage blocks, dock floors and staging. */
  private truckArea(z: Zone) { return z.group === 'storage' || /STG|DOCK|NC|REPL|PAL/.test(z.id) }

  /** Markers and rings follow the people and trucks; labor slabs follow headcount. */
  update() {
    if (!this.markers.visible && !this.rings.visible) return
    this.f.people.forEach((p, i) => {
      const target = RATE_TARGET[p.role]
      if (this.layer === 'labor') this.c.setHex(p.onBreak ? 0xd6321e : p.rate >= target ? 0x3ee39a : p.rate >= target * 0.8 ? 0xffb020 : 0xff6a3d)
      else this.c.setHex(p.role === 'driver' ? 0xff3b3b : p.role === 'picker' && p.zone !== 'FM-1' && !p.onBreak ? 0xffb020 : 0x3ee39a)
      this.markers.setColorAt(i, this.c)
      setInstance(this.markers, i, p.center[0], p.role === 'driver' ? 2.45 : 2.15, p.center[2])
    })
    this.markers.instanceMatrix.needsUpdate = true; this.markers.instanceColor!.needsUpdate = true
    this.f.trucks.forEach((t, i) => setInstance(this.rings, i, t.center[0], 0.02, t.center[2], 1, 1, 1, -Math.PI / 2, 0, 0))
    this.rings.instanceMatrix.needsUpdate = true
    if (this.layer === 'labor' && this.slabs.visible && (performance.now() % 1000) < 40) this.colourSlabs()
  }
}
