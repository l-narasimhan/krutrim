import * as THREE from 'three'
import './style.css'
import { buildFacility, HALL, RACK, SHELF, MODULES, aisleV, type Entity, type Vec3 } from './facility'
import { loadEnvironment } from './assets'
import { makeMaterials } from './scene/mats'
import { Building } from './scene/building'
import { Racking } from './scene/racking'
import { Shelving } from './scene/shelving'
import { Conveyor } from './scene/conveyor'
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
const M = makeMaterials()
const building = new Building(facility, M)
const rackings = MODULES.filter(m => m.kind === 'rack').map(m => new Racking(m, facility.baysOf.get(m.id)!, M))
const shelvings = MODULES.filter(m => m.kind === 'shelf').map(m => new Shelving(m, facility.binsOf.get(m.id)!, M))
const rackingOf = new Map(rackings.map(r => [r.module.id, r]))
const conveyor = new Conveyor(M)
scene.add(building.group, ...rackings.map(r => r.group), ...shelvings.map(s => s.group), conveyor.group)
const colliders = [...building.colliders, ...rackings.flatMap(r => r.colliders), ...shelvings.flatMap(s => s.colliders), ...conveyor.colliders]

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
const picker = new Picker(canvas, [...rackings.map(r => r.faceVolumes), ...rackings.map(r => r.volumes), ...shelvings.map(s => s.bins), building.dockVolumes, building.zoneVolumes], () => rig.camera)

picker.onHover = (e, x, y) => { Highlight.place(highlight.hover, e && e !== ui.selected ? e : null); ui.tooltip(e, x, y); canvas.style.cursor = e ? 'pointer' : '' }
picker.onSelect = e => select(e)

function select(e: Entity | null) {
  ui.select(e)
  Highlight.place(highlight.select, e)
  if (e) (document.getElementById('focus') as HTMLInputElement).value = e.id
  syncDoorButton()
}

function walkTo(e: Entity) {
  const off = e.kind === 'bay' || e.kind === 'face' ? RACK.aisle / 2 + RACK.frameDepth / 2 : e.kind === 'bin' ? SHELF.aisle / 2 + SHELF.unitD / 2 + 0.2 : e.kind === 'dock' ? 4 : 0
  const pos: Vec3 = [e.center[0] + e.face[0] * off, 1.7, e.center[2] + e.face[2] * off]
  // Face the entity: yaw 0 looks toward -Z, so look back along the face vector.
  const yaw = Math.atan2(e.face[0], e.face[2])
  rig.setMode('walk', { pos, yaw })
}
/** Standoff by kind: bins sit on a 1.4 m cart aisle so the camera stays inside it; docks read best from a
 *  few metres back; zones from far enough to see the whole outline but never from above the roof. */
const standoff = (e: Entity) => e.kind === 'bin' ? 0.7 : e.kind === 'face' ? 2.4 : e.kind === 'dock' ? 12 : e.kind === 'zone' ? THREE.MathUtils.clamp(Math.max(e.size[0], e.size[2]) * 0.6, 10, 42) : undefined
const flyTo = (e: Entity) => rig.frame(e.center, e.size, e.face, standoff(e))
const toggleDoor = (e: Entity) => { if (e.kind === 'dock') { e.doorTarget = e.doorTarget ? 0 : 1; e.state = e.doorTarget ? (e.trailerId ? e.state : 'EMPTY') : 'CLOSED'; building.animateDoor(e); ui.select(e); syncDoorButton() } }

ui.onAction = (a, e) => {
  if (a === 'pull' && e.kind === 'bay') { rackingOf.get(e.module)!.toggleExtract(e); ui.select(e) }
  if (a === 'door') toggleDoor(e)
  if (a === 'fly') flyTo(e)
  if (a === 'walk') walkTo(e)
}

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
document.querySelectorAll<HTMLButtonElement>('.cam[data-cam]').forEach(b => b.onclick = () => { tour.end(); presets[b.dataset.cam!]() })
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
document.getElementById('btn-brief')!.onclick = () => alert(`FC-DFW7 · full hall · phase 1\n\n${HALL.w.toFixed(0)} × ${HALL.d.toFixed(0)} m · ${facility.docks.length} dock doors (${busyDocks} occupied) · ${facility.bays.length} rack bays · ${facility.bays.reduce((n, b) => n + b.slots.filter(s => s.lpn).length, 0)} reserve pallets · ${facility.faces.length} pick faces · ${facility.bins.length} barcoded bins · ${facility.zones.length} zones\n\nEvery object is at real dimensions (1 unit = 1 m).`)
window.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return
  if (e.key === 'f' || e.key === 'F') { if (ui.selected) flyTo(ui.selected) }
  if (e.key === 'Escape' && tour.active) { tour.end(); return }
  if (e.key === 'Escape') { if (rig.mode === 'walk' && !document.pointerLockElement) presets.orbit(); else if (rig.mode !== 'walk') select(null) }
  if (e.key === 'p' || e.key === 'P') presets.plan()
  if (e.key === 'o' || e.key === 'O') presets.orbit()
})
syncDoorButton()

// Deep links for screenshots and sharing: #view=aisle&select=RA-02-005
function applyHash() {
  const h = new URLSearchParams(location.hash.slice(1))
  const v = h.get('view'); if (v && presets[v]) presets[v]()
  if (h.has('tour')) { tour.start(); tour.go(Number(h.get('tour')) || 0) }
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
  picker.update()
  renderer.render(scene, rig.camera)
  ui.update(dt, { fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles })
  requestAnimationFrame(frame)
}

loadEnvironment(renderer).then(env => {
  scene.environment = env
  scene.environmentIntensity = 0.28
}).catch(err => console.warn('environment failed, continuing without it', err)).finally(() => {
  document.getElementById('loading')!.hidden = true
  applyHash()
  requestAnimationFrame(frame)
})
