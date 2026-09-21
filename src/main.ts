import * as THREE from 'three'
import './style.css'
import { buildFacility, resolveProducts, HALL, RACK, SHELF, MODULES, aisleV, type Entity, type Vec3 } from './facility'
import { rngDraws } from './rng'
import { zoneAisle, NON_CARTON } from './zoning'
import { loadEnvironment } from './assets'
import { makeMaterials } from './scene/mats'
import { Building } from './scene/building'
import { Racking } from './scene/racking'
import { buildDetailedContent } from './scene/rackloads'
import { makeGoodsMaterials } from './scene/goods'
import { Shelving } from './scene/shelving'
import { Conveyor } from './scene/conveyor'
import { Packing } from './scene/packing'
import { SlamLine } from './scene/slam'
import { Rebin } from './scene/rebin'
import { Outbound } from './scene/outbound'
import { Inbound } from './scene/inbound'
import { People } from './scene/people'
import { Equipment } from './scene/equipment'
import { OrderTrace } from './scene/trace'
import { Layers, LAYER_TITLE, type Layer } from './scene/layers'
import { CameraRig, type Mode } from './camera'
import { Picker, Highlight } from './picking'
import { Console } from './ui'
import { Tour } from './tour'

const canvas = document.getElementById('gl') as HTMLCanvasElement
const viewport = document.getElementById('viewport')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(viewport.clientWidth, viewport.clientHeight, false)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.8
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x05070a)
scene.fog = new THREE.Fog(0x05070a, 350, 900)

// Lighting: the hall is lit by its high-bays, so the key light comes from above with a warm-white LED tint,
// the environment map gives the steel and film something to reflect, and a cool sky fill leaks in from the docks.
// The shadow frustum follows the camera target: 4096 px over 120 m keeps contact shadows crisp wherever you look.
const key = new THREE.DirectionalLight(0xfff3e0, 1.7)
key.castShadow = true
key.shadow.mapSize.set(4096, 4096)
key.shadow.camera.left = -60; key.shadow.camera.right = 60
key.shadow.camera.top = 60; key.shadow.camera.bottom = -60
key.shadow.camera.near = 5; key.shadow.camera.far = 120
key.shadow.bias = -0.0004
key.shadow.normalBias = 0.03
scene.add(key, key.target)
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a2f24, 0.12))
const keyOffset = new THREE.Vector3(14, 60, 4)
function followKey(target: THREE.Vector3) {
  key.position.copy(target).add(keyOffset)
  key.target.position.copy(target)
}

const facility = buildFacility()
// Commodity zoning, then make every displayed product name agree with the SKU it belongs to (and so with
// the goods in the racks). Both are pure string writes and take no draws from the shared stream.
zoneAisle(facility, 'RB-04-', NON_CARTON)
resolveProducts(facility)
const M = makeMaterials()
const building = new Building(facility, M)
// Every rack module carries real contents: chamfered cases at the catalogue's real dimensions, the product
// that matches the SKU, and real stretch wrap. The RES-B-only pilot is over — with one module on real goods
// and the rest on the built-in box loads, the AISLE camera landed on plain cartons and the twin read as a
// hall of brown boxes. One shared materials object, so this costs one set of maps regardless of module count.
const goodsMats = makeGoodsMaterials()
const rackings = MODULES.filter(m => m.kind === 'rack').map(m => {
  const bays = facility.baysOf.get(m.id)!
  return new Racking(m, bays, M, buildDetailedContent(bays, goodsMats), goodsMats)
})
const shelvings = MODULES.filter(m => m.kind === 'shelf').map(m => new Shelving(m, facility.binsOf.get(m.id)!, M, goodsMats))
const rackingOf = new Map(rackings.map(r => [r.module.id, r]))
const conveyor = new Conveyor(M)
const packing = new Packing(facility.stations.filter(s => s.type === 'single' || s.type === 'multi'), M)
const slam = new SlamLine(facility.slams, M)
const rebin = new Rebin(facility.walls, M)
const outbound = new Outbound(facility.lanes, M)
const inbound = new Inbound(facility, M)
const people = new People(facility, M)
const equipment = new Equipment(facility, M)
scene.add(building.group, ...rackings.map(r => r.group), ...shelvings.map(s => s.group), conveyor.group, packing.group, slam.group, rebin.group, outbound.group, inbound.group, people.group, equipment.group)
const colliders = [...building.colliders, ...rackings.flatMap(r => r.colliders), ...shelvings.flatMap(s => s.colliders), ...conveyor.colliders, ...packing.colliders, ...slam.colliders, ...rebin.colliders, ...outbound.colliders, ...inbound.colliders, ...equipment.colliders]

// Daylight spilling in at the open doors, and a few pooled lights along the default views.
for (const d of facility.docks) if (d.doorTarget && Math.abs(d.number % 6) === 3) {
  const p = new THREE.PointLight(0xcfe4ff, 14, 22, 2)
  p.position.set(d.center[0], 2.2, d.center[2] - (d.wall === 'N' ? -1.5 : 1.5))
  scene.add(p)
}
for (const [x, z] of [[-39, 22], [-33, -20], [-45, -20], [70, -48], [0, 30]]) {
  const p = new THREE.PointLight(0xfff0d6, 60, 26, 1.8)
  p.position.set(x, HALL.clearH - 0.8, z)
  scene.add(p)
}

const rig = new CameraRig(canvas, colliders)
const highlight = new Highlight(scene)
const ui = new Console(facility)
const picker = new Picker(canvas, [people.volumes, people.truckVolumes, equipment.volumes, ...rackings.map(r => r.faceVolumes), ...rackings.map(r => r.volumes), ...shelvings.map(s => s.bins), building.dockVolumes, packing.volumes, inbound.volumes, slam.volumes, rebin.volumes, outbound.volumes, building.zoneVolumes], () => rig.camera)

// Scans from the floor: the face loses a unit, the stream logs it, and a beep plays if the scan is near the camera.
let audio: AudioContext | null = null
canvas.addEventListener('pointerdown', () => { if (!audio) try { audio = new AudioContext() } catch { audio = null } }, { once: true })
function beep(at: Vec3) {
  if (!audio) return
  const cam = rig.mode === 'walk' ? rig.walkPosition : rig.camera.position
  const d = Math.hypot(cam.x - at[0], cam.z - at[2])
  if (d > 25) return
  const o = audio.createOscillator(), g = audio.createGain()
  o.type = 'square'; o.frequency.value = 2600
  g.gain.value = Math.min(0.08, 0.12 / (1 + d * 0.3))
  o.connect(g).connect(audio.destination)
  o.start(); o.stop(audio.currentTime + 0.08)
}
people.onScan = (p, face) => {
  if (face.qty > 0) face.qty--
  p.unitsToday++
  ui.log('RF', `Pick confirmed · ${face.id} · 1 ea · ${p.name} · ${face.qty} left`)
  if (ui.selected === face) ui.select(face)
  beep(face.center)
}
people.onEvent = (src, msg) => ui.log(src, msg)
// Follow one order: a highlighted tote from a picker's cart to a carrier gaylord, camera tracking it.
const trace = new OrderTrace(facility)
scene.add(trace.group)
trace.onEvent = (src, msg) => ui.log(src, msg)
people.onDrop = (p, at) => trace.dropped(p, at)
trace.onDone = () => { rig.follow = null }
function startOrder() {
  tour.end(); select(null); trace.start(); trace.update(0)
  rig.frame(trace.position, [1, 1, 1], [0, 0, 1], 4.5)
  rig.follow = () => trace.position
}
const flowSel = document.getElementById('sel-flow') as HTMLSelectElement
flowSel.onchange = () => {
  const m = flowSel.value as 'conveyor' | 'walk'
  people.setFlowMode(m); trace.mode = m
  if (trace.active) trace.end()
  ui.log('WMS', m === 'walk' ? 'Flow mode: walk-to-drop · pickers carry totes to the pack drop' : 'Flow mode: conveyor · pickers induct totes on the takeaway belt')
}
document.getElementById('btn-order')!.onclick = () => (trace.active ? trace.end() : startOrder())
document.querySelector<HTMLButtonElement>('#tour [data-tour="end"]')!.addEventListener('click', () => { if (trace.active) trace.end() })

picker.onHover = (e, x, y) => { Highlight.place(highlight.hover, e && e !== ui.selected ? e : null); ui.tooltip(e, x, y); canvas.style.cursor = e ? 'pointer' : '' }
picker.onSelect = e => select(e)

function select(e: Entity | null) {
  if (!e) rig.follow = null
  ui.select(e)
  Highlight.place(highlight.select, e)
  if (e) (document.getElementById('focus') as HTMLInputElement).value = e.id
  syncDoorButton()
}

function walkTo(e: Entity) {
  const off = e.kind === 'bay' || e.kind === 'face' ? RACK.aisle / 2 + RACK.frameDepth / 2 : e.kind === 'bin' ? SHELF.aisle / 2 + SHELF.unitD / 2 + 0.2 : e.kind === 'dock' ? 4 : e.kind === 'station' ? 1.1 : e.kind === 'wall' ? 1.2 : e.kind === 'slam' ? 3 : e.kind === 'lane' ? (e.role === 'sort' ? 2 : 10) : e.kind === 'cage' ? 6 : e.kind === 'person' ? 1.6 : e.kind === 'truck' ? 3 : e.kind === 'ladder' ? 2.0 : 0
  const pos: Vec3 = [e.center[0] + e.face[0] * off, 1.7, e.center[2] + e.face[2] * off]
  // Face the entity: yaw 0 looks toward -Z, so look back along the face vector.
  const yaw = Math.atan2(e.face[0], e.face[2])
  rig.setMode('walk', { pos, yaw })
}
/** Standoff by kind: bins sit on a 1.4 m cart aisle so the camera stays inside it; docks read best from a
 *  few metres back; zones from far enough to see the whole outline but never from above the roof. */
const standoff = (e: Entity) => e.kind === 'bin' ? 0.7 : e.kind === 'face' ? 2.4 : e.kind === 'dock' ? 12 : e.kind === 'station' ? 4.5 : e.kind === 'wall' ? 5 : e.kind === 'slam' ? 10 : e.kind === 'lane' ? (e.role === 'sort' ? 5 : 16) : e.kind === 'cage' ? 14 : e.kind === 'person' ? 3.2 : e.kind === 'truck' ? 6 : e.kind === 'ladder' ? 3.0 : e.kind === 'zone' ? THREE.MathUtils.clamp(Math.max(e.size[0], e.size[2]) * 0.6, 10, 42) : undefined
const flyTo = (e: Entity) => rig.frame(e.center, e.size, e.face, standoff(e))
const toggleDoor = (e: Entity) => { if (e.kind === 'dock') { e.doorTarget = e.doorTarget ? 0 : 1; e.state = e.doorTarget ? (e.trailerId ? e.state : 'EMPTY') : 'CLOSED'; building.animateDoor(e); ui.select(e); syncDoorButton() } }

ui.onAction = (a, e) => {
  if (a === 'pull' && e.kind === 'bay') { rackingOf.get(e.module)!.toggleExtract(e); ui.select(e) }
  if (a === 'door') toggleDoor(e)
  if (a === 'fly') { rig.follow = null; flyTo(e) }
  if (a === 'walk') { rig.follow = null; walkTo(e) }
  if (a === 'follow') { select(e); flyTo(e); rig.follow = () => e.center }
}

// ---- Layers: recolour the scene by what you want to see ----------------------------------------
const layers = new Layers(facility)
scene.add(layers.group)
function setLayer(l: Layer) {
  layers.set(l)
  for (const r of rackings) r.setLayer(l)
  for (const sh of shelvings) sh.setLayer(l)
  conveyor.setLayer(l)
  document.querySelectorAll<HTMLButtonElement>('.nav[data-layer]').forEach(b => b.classList.toggle('on', b.dataset.layer === l))
  document.getElementById('layer-title')!.innerHTML = `<b>${l.toUpperCase()}</b> ${LAYER_TITLE[l]}`
}
document.querySelectorAll<HTMLButtonElement>('.nav[data-layer]').forEach(b => { b.disabled = false; b.onclick = () => setLayer(b.dataset.layer as Layer) })

// ---- Camera bar, layers, focus, keys ----------------------------------------------------------
const resA = MODULES.find(m => m.id === 'RES-A')!, fm1 = MODULES.find(m => m.id === 'FM-1')!
const aisleX = (m: typeof resA, a: number) => m.x + aisleV(m, a)
const ob15 = facility.byId.get('OB-15')!
const presets: Record<string, () => void> = {
  orbit: () => rig.flyTo([160, 120, 240], [0, 0, 10]),
  reset: () => { select(null); rig.flyTo([160, 120, 240], [0, 0, 10]) },
  aisle: () => { const x = aisleX(resA, 2); rig.flyTo([x + 1.2, 4.2, resA.z + resA.d + 3], [x, 2.2, resA.z + resA.d - 20]) },
  pick: () => { const x = aisleX(fm1, 2); rig.flyTo([x + 0.6, 3.2, fm1.z + fm1.d + 2.5], [x, 1.1, fm1.z + fm1.d - 8]) },
  dock: () => rig.flyTo([ob15.center[0] - 9, 4.5, ob15.center[2] - 12], [ob15.center[0], 1.8, ob15.center[2]]),
  plan: () => rig.setMode('plan'),
  walk: () => rig.setMode('walk', { pos: [aisleX(resA, 2), 1.7, resA.z + resA.d + 3], yaw: 0 }),
}
document.querySelectorAll<HTMLButtonElement>('.cam[data-cam]').forEach(b => b.onclick = () => { tour.end(); rig.follow = null; presets[b.dataset.cam!]() })
// Guided tour: inbound docks to every corner, in process order. Each stop frames and selects the entity.
const tour = new Tour(facility, 7, e => { select(e); flyTo(e) }, () => {})
document.getElementById('btn-tour')!.onclick = () => (tour.active ? tour.end() : tour.start())
rig.onModeChange = (m: Mode) => {
  document.querySelectorAll<HTMLButtonElement>('.cam[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === m))
  viewport.classList.toggle('walk', m === 'walk')
  document.getElementById('walk-hint')!.hidden = m !== 'walk'
  building.roof.visible = m !== 'plan'
}
rig.onModeChange('orbit')
document.getElementById('btn-pull')!.onclick = () => { if (ui.selected?.kind === 'bay') { rackingOf.get(ui.selected.module)!.toggleExtract(ui.selected); ui.select(ui.selected) } }
const doorBtn = document.getElementById('btn-door') as HTMLButtonElement
function syncDoorButton() {
  const d = ui.selected?.kind === 'dock' ? ui.selected : null
  doorBtn.disabled = !d
  doorBtn.textContent = d?.doorTarget ? 'CLOSE DOOR' : 'OPEN DOOR'
}
doorBtn.onclick = () => { if (ui.selected?.kind === 'dock') toggleDoor(ui.selected) }
const focusInput = document.getElementById('focus') as HTMLInputElement
const focusGo = () => { const e = facility.byId.get(focusInput.value.trim().toUpperCase()); if (e) { select(e); flyTo(e) } }
document.getElementById('btn-focus')!.onclick = focusGo
focusInput.addEventListener('change', focusGo)
const busyDocks = facility.docks.filter(d => d.trailerId).length
document.getElementById('btn-brief')!.onclick = () => alert(`FC-DFW7 · full hall · phase 1\n\n${HALL.w.toFixed(0)} × ${HALL.d.toFixed(0)} m · ${facility.docks.length} dock doors (${busyDocks} occupied) · ${facility.bays.length} rack bays · ${facility.bays.reduce((n, b) => n + b.slots.filter(s => s.lpn).length, 0)} reserve pallets · ${facility.faces.length} pick faces · ${facility.bins.length} barcoded bins · ${facility.zones.length} zones · ${facility.people.length} associates on shift · ${facility.trucks.length} trucks\n\nEvery object is at real dimensions (1 unit = 1 m).`)
window.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return
  if (e.key === 'f' || e.key === 'F') { if (ui.selected) flyTo(ui.selected) }
  if (e.key === 'Escape' && tour.active) { tour.end(); return }
  if (e.key === 'Escape' && trace.active) { trace.end(); return }
  if (e.key === 'Escape') { if (rig.mode === 'walk' && !document.pointerLockElement) presets.orbit(); else if (rig.mode !== 'walk') select(null) }
  if (e.key === 'p' || e.key === 'P') presets.plan()
  if (e.key >= '1' && e.key <= '5') setLayer((['overview', 'inventory', 'flow', 'labor', 'safety'] as Layer[])[Number(e.key) - 1])
  if (e.key === 'o' || e.key === 'O') presets.orbit()
})
syncDoorButton()

// Deep links for screenshots and sharing: #view=aisle&select=RA-02-005
function applyHash() {
  const h = new URLSearchParams(location.hash.slice(1))
  const v = h.get('view'); if (v && presets[v]) presets[v]()
  const ly = h.get('layer'); if (ly && ly in LAYER_TITLE) setLayer(ly as Layer)
  if (h.has('tour')) { tour.start(); tour.go(Number(h.get('tour')) || 0) }
  if (h.get('flow') === 'walk') { flowSel.value = 'walk'; people.setFlowMode('walk'); trace.mode = 'walk' }
  if (h.has('order')) startOrder()
  const s = h.get('select'); const e = s ? facility.byId.get(s.toUpperCase()) : null
  if (e) select(e)
  if (h.has('fly') && e) flyTo(e)
  const w = h.get('walk')?.split(',').map(Number)
  if (w && w.length === 3) rig.setMode('walk', { pos: [w[0], 1.7, w[1]], yaw: w[2] })
  if (h.has('pull') && e?.kind === 'bay') { const r = rackingOf.get(e.module)!; r.toggleExtract(e); r.update(2); ui.select(e) }
  if (h.get('door') === '0' && e?.kind === 'dock') { e.doorTarget = 0; e.doorOpen = 0; building.animateDoor(e); building.update(1); syncDoorButton() }
  rig.snap()
}
window.addEventListener('hashchange', applyHash)

// ---- Resize and loop --------------------------------------------------------------------------
const ro = new ResizeObserver(() => { renderer.setSize(viewport.clientWidth, viewport.clientHeight, false); rig.resize(viewport.clientWidth, viewport.clientHeight) })
ro.observe(viewport)

let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now
  fpsAcc += dt; fpsN++
  if (fpsAcc >= 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0 }
  tour.update(dt)
  rig.update(dt)
  followKey(rig.mode === 'walk' ? rig.walkPosition : rig.controls.target)
  building.update(dt)
  for (const r of rackings) r.update(dt)
  conveyor.update(dt)
  people.update(dt)
  trace.update(dt)
  layers.update()
  picker.update()
  renderer.render(scene, rig.camera)
  ui.update(dt, { fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles })
  requestAnimationFrame(frame)
}

// The whole twin is generated from one seeded RNG stream in a fixed order, so the number of draws taken
// by the time the last scene module is built is a fingerprint of the entire facility. Exposed so the
// RES-B detailed-contents path can be proven not to have shifted anything downstream of it.
;(window as unknown as { __rngDraws: number }).__rngDraws = rngDraws()

loadEnvironment(renderer).then(env => {
  scene.environment = env
  scene.environmentIntensity = 0.28
}).catch(err => console.warn('environment failed, continuing without it', err)).finally(() => {
  document.getElementById('loading')!.hidden = true
  applyHash()
  requestAnimationFrame(frame)
})
