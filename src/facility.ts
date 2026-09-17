// The facility: every entity in the full hall with a real location ID, position and size, generated from the
// approved layout in layout.ts. 1 unit = 1 metre. Every dimension is an industry standard or a real product.
import { rng, rand, randInt, pick, chance } from './rng'
import {
  HALL as HALL_SPEC, HALL_X0, HALL_Z0, DOOR, MODULES, AREAS, RACK as RACK_LAYOUT, RACK_ROW_PITCH, SHELF as SHELF_LAYOUT, SHELF_ROW_PITCH,
  doors as layoutDoors, PACK, PACK_ZONES, PUT_WALLS, SLAM_STATIONS, RECEIVE, QC_BENCHES, type StorageModule, type Area,
} from './layout'

export { MODULES, AREAS, RACK_ROW_PITCH, SHELF_ROW_PITCH, DOOR } from './layout'

// ---- Real-world specs ----------------------------------------------------------------------

export const HALL = { w: HALL_SPEC.w, d: HALL_SPEC.d, grid: HALL_SPEC.grid, clearH: HALL_SPEC.clearH, roofY: HALL_SPEC.clearH + 0.6, x0: HALL_X0, z0: HALL_Z0 }

/** Selective pallet racking (teardrop, 42" deep frames, 108" step beams, 24' uprights), hybrid pick:
 *  levels 1–2 (A, B) are pick faces, levels 3–5 (C, D, E) hold reserve pallets. */
export const RACK = {
  frameDepth: RACK_LAYOUT.frameDepth,
  column: 0.076,           // 3" x 3" teardrop column
  uprightH: 7.315,         // 24' frame
  beamLen: 2.743,          // 108" clear bay
  beamH: 0.102,            // 4" step beam
  beamD: 0.05,
  bayPitch: RACK_LAYOUT.bayPitch,
  levelPitch: 1.75,        // beam-to-beam, fits a 1.4 m load + 100 mm clearance + beam
  levels: RACK_LAYOUT.levels,
  pickLevels: RACK_LAYOUT.pickLevels,
  flue: RACK_LAYOUT.flue,
  aisle: RACK_LAYOUT.aisle,
  crossAisle: RACK_LAYOUT.crossAisle,
}

/** GMA 48" x 40" stringer pallet. */
export const PALLET = { L: 1.219, W: 1.016, H: 0.14, boardT: 0.016, stringerH: 0.089, stringerW: 0.038 }

/** Boltless rivet shelving, 48"W x 18"D x 84"H, 5 shelf levels, particleboard decks. */
export const SHELF = {
  unitW: SHELF_LAYOUT.unitW, unitD: SHELF_LAYOUT.unitD, unitH: 2.134, post: 0.038, shelfT: 0.016,
  levels: SHELF_LAYOUT.levels, levelPitch: 0.45, firstShelfY: 0.12,
  aisle: SHELF_LAYOUT.aisle, binsPerShelf: SHELF_LAYOUT.binsPerShelf, crossAisle: SHELF_LAYOUT.crossAisle,
}

/** AkroBin 30-235 style hopper-front shelf bin, 10 7/8" L x 8 1/4" W x 7" H. */
export const BIN = { L: 0.276, W: 0.21, H: 0.178, gap: 0.023 }

/** 9' x 10' sectional dock door, 48" dock height, 6' x 8' pit leveler, laminated bumpers, 53' dry van. */
export const DOCK = {
  doorW: DOOR.w, doorH: DOOR.h, dockHeight: HALL_SPEC.dockHeight, levelerW: 1.83, levelerL: 2.44,
  bumperW: 0.254, bumperH: 0.356, bumperD: 0.114,
}
export const TRAILER = { L: 16.15, W: 2.6, H: 4.115, floorY: 1.219, boxH: 2.9 }

// ---- Module frames ------------------------------------------------------------------------------
// Storage rows run north–south. Each module is built in a local frame where rows run along local x
// (u, from the module's south edge northward) and are stacked along local z (v, from the west edge eastward),
// then rotated +90° about Y: world x = module.x + v, world z = module.z + module.d − u.

export type Vec3 = [number, number, number]
export const toWorld = (m: StorageModule, u: number, y: number, v: number): Vec3 => [m.x + v, y, m.z + m.d - u]
export const MODULE_ROT_Y = Math.PI / 2
export const moduleOrigin = (m: StorageModule): Vec3 => [m.x, 0, m.z + m.d]

/** Row r's flue centre (rack) or unit-pair centre (shelf) in local v. The first aisle runs along the west edge. */
export function rowV(m: StorageModule, r: number) {
  return m.kind === 'rack'
    ? RACK.aisle + RACK.frameDepth + RACK.flue / 2 + r * RACK_ROW_PITCH
    : SHELF.aisle + SHELF.unitD + r * SHELF_ROW_PITCH
}
/** Aisle a (1-based) centre in local v. */
export function aisleV(m: StorageModule, a: number) {
  const pitch = m.kind === 'rack' ? RACK_ROW_PITCH : SHELF_ROW_PITCH
  const aisle = m.kind === 'rack' ? RACK.aisle : SHELF.aisle
  return aisle / 2 + (a - 1) * pitch
}
/** Bay b's start in local u. A cross aisle splits the row in the middle. */
export function bayU(m: StorageModule, b: number) {
  const pitch = m.kind === 'rack' ? RACK.bayPitch : SHELF.unitW
  const cross = m.kind === 'rack' ? RACK.crossAisle : SHELF.crossAisle
  const half = Math.floor(m.baysPerRow / 2)
  return b * pitch + (b >= half ? cross : 0)
}
export const moduleCode = (m: StorageModule) => m.id.replace('RES-', 'R').replace('FM-1', 'FM')

// ---- Entities -------------------------------------------------------------------------------

interface Base { kind: string; id: string; center: Vec3; size: Vec3; face: Vec3 }

export interface PalletSlot { level: number; pos: number; lpn: string | null; sku: string | null; qty: number; instance: number; wrapped: boolean }
/** How a pick face is fitted out: open cases on the deck, gravity carton-flow lanes, or large shelf bins. */
export type FaceFit = 'hand' | 'flow' | 'bins'
export interface PickFace extends Base {
  kind: 'face'; module: string; bayId: string; level: number; fit: FaceFit; aisle: string; faceDir: 1 | -1
  local: Vec3
  sku: string | null; product: string | null; qty: number; capacity: number; velocity: 'A' | 'B' | 'C'; lastPick: string; lastReplen: string
}
export interface Bay extends Base {
  kind: 'bay'; module: string; row: number; side: 'A' | 'B'; index: number; aisle: string; faceDir: 1 | -1
  /** Local-frame centre for the module renderer. */
  local: Vec3
  slots: PalletSlot[]; faces: PickFace[]; fill: number; lastCount: string; extract: number; extractTarget: number
}
export interface Bin extends Base {
  kind: 'bin'; module: string; row: number; side: 'A' | 'B'; unit: number; bay: number; level: number; pos: number; aisle: string; faceDir: 1 | -1
  local: Vec3
  sku: string | null; product: string | null; qty: number; velocity: 'A' | 'B' | 'C'; lastStow: string; lastPick: string; instance: number
}
export type DockState = 'UNLOADING' | 'LOADING' | 'EMPTY' | 'CLOSED'
export interface Dock extends Base {
  kind: 'dock'; prefix: string; number: number; wall: 'N' | 'S'; use: string; carrier: string; trailerId: string | null
  state: DockState; progress: number; units: number; doorOpen: number; doorTarget: number; minutesAtDoor: number
}
export type StationType = 'single' | 'multi' | 'receive' | 'qc'
export interface Station extends Base {
  kind: 'station'; number: number; zone: string; type: StationType; associate: string | null
  /** Units per hour, items waiting, and units handled today, whatever the station handles. */
  rate: number; queue: number; packedToday: number; state: 'PACKING' | 'IDLE' | 'OFFLINE'
}
/** A fenced hold cage: what is inside, why, and for how long. */
export interface Cage extends Base { kind: 'cage'; name: string; items: number; oldestDays: number; reasons: [string, number][] }
export interface PutWall extends Base {
  kind: 'wall'; number: number; slots: number; filled: number; ordersOpen: number; ordersComplete: number; lit: boolean[]
}
export interface Slam extends Base { kind: 'slam'; number: number; rate: number; rejects: number; labelled: number; state: 'RUNNING' | 'STOPPED' }
/** One outbound lane per shipping door: the carrier sort position on the SLAM outfeed and the staging lane behind the door. */
export interface Lane extends Base {
  kind: 'lane'; role: 'sort' | 'stage'; number: number; door: string; carrier: string
  units: number; gaylords: number; pallets: number; cutoff: string; fill: number; state: 'OPEN' | 'CLOSING' | 'CLOSED'
}
export interface Zone extends Base { kind: 'zone'; name: string; group: Area['group']; note?: string; level?: 1; area: Area }
export type Entity = Bay | Bin | PickFace | Dock | Zone | Station | PutWall | Slam | Lane | Cage

export interface Facility {
  bays: Bay[]; bins: Bin[]; faces: PickFace[]; docks: Dock[]; zones: Zone[]; stations: Station[]; walls: PutWall[]; slams: Slam[]; lanes: Lane[]; cages: Cage[]
  byId: Map<string, Entity>
  baysOf: Map<string, Bay[]>; binsOf: Map<string, Bin[]>
}

const PRODUCTS = [
  'Cordless Drill 20V', 'Cat Litter 40 lb', 'Paper Towels 12 pk', 'Air Fryer 5.8 qt', 'Protein Powder 5 lb',
  'Diapers Size 4 152 ct', 'LED Bulbs 8 pk', 'Yoga Mat 6 mm', 'Dog Food 30 lb', 'Laundry Pods 81 ct',
  'Bluetooth Speaker', 'Stand Mixer 5 qt', 'Sparkling Water 24 pk', 'Printer Paper 10 rm', 'Space Heater 1500 W',
  'Weighted Blanket 15 lb', 'Coffee Pods 96 ct', 'Monitor 27 in', 'Mechanical Keyboard', 'Baby Wipes 720 ct',
  'Vitamin D3 400 ct', 'Phone Case Clear', 'HDMI Cable 6 ft', 'Running Shoes M10', 'Water Bottle 32 oz',
]
const ASSOCIATES = ['M. Okafor', 'J. Alvarez', 'R. Chen', 'T. Nguyen', 'S. Patel', 'D. Kowalski', 'A. Haddad', 'L. Moreau', 'K. Sato', 'B. Osei', 'E. Rivera', 'P. Lindqvist']
const INBOUND_CARRIERS: [string, string][] = [['XPO Logistics', 'XPOU'], ['J.B. Hunt', 'JBHU'], ['Schneider', 'SNLU'], ['Werner', 'WENU'], ['Knight-Swift', 'KNXU'], ['Estes Express', 'EXLA'], ['Old Dominion', 'ODFL']]
const OUTBOUND_SCAC: Record<string, string> = { UPS: 'UPSZ', FedEx: 'FDEG', USPS: 'USPS', 'Regional and LTL': 'SAIA' }
const sku = () => `B0${randInt(10, 99)}${pick(['K', 'X', 'M', 'R'])}${randInt(1000, 9999)}${pick(['A', 'B', 'C', 'D'])}`
const ago = (maxH: number) => {
  const m = randInt(2, maxH * 60)
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`
}
const pad = (n: number, w: number) => String(n).padStart(w, '0')

export function buildFacility(): Facility {
  const bays: Bay[] = [], bins: Bin[] = [], faces: PickFace[] = [], docks: Dock[] = [], zones: Zone[] = [], stations: Station[] = [], walls: PutWall[] = [], slams: Slam[] = [], lanes: Lane[] = [], cages: Cage[] = []
  const byId = new Map<string, Entity>()
  const baysOf = new Map<string, Bay[]>(), binsOf = new Map<string, Bin[]>()

  for (const m of MODULES) {
    if (m.kind === 'rack') baysOf.set(m.id, buildRackModule(m, bays, faces, byId))
    else binsOf.set(m.id, buildShelfModule(m, bins, byId))
  }

  // Dock doors. Location IDs are the door numbers painted on the wall: IB-01…26, RT-01…04, WC-01…02, OB-01…30.
  for (const d of layoutDoors()) {
    const outbound = d.prefix === 'OB'
    const occupied = d.prefix === 'WC' ? false : chance(outbound ? 0.6 : d.prefix === 'IB' ? 0.7 : 0.5)
    const carrierName = outbound ? d.use.split(', ')[1] : d.prefix === 'WC' ? 'Waste Management' : pick(INBOUND_CARRIERS)[0]
    const scac = outbound ? OUTBOUND_SCAC[carrierName] : d.prefix === 'WC' ? 'WMIU' : INBOUND_CARRIERS.find(c => c[0] === carrierName)![1]
    const dir: 1 | -1 = d.wall === 'N' ? -1 : 1 // outward normal
    const dock: Dock = {
      kind: 'dock', id: d.id, prefix: d.prefix, number: d.number, wall: d.wall, use: d.use.split(', ')[0], carrier: carrierName,
      trailerId: occupied ? `${scac} ${randInt(100000, 999999)}` : null,
      state: occupied ? (outbound ? 'LOADING' : 'UNLOADING') : chance(0.5) ? 'EMPTY' : 'CLOSED',
      progress: occupied ? rand(0.1, 0.9) : 0, units: occupied ? randInt(900, 2600) : 0,
      doorOpen: 0, doorTarget: 0, minutesAtDoor: occupied ? randInt(8, 75) : 0,
      center: [d.x, DOCK.doorH / 2, d.z], size: [DOCK.doorW + 0.6, DOCK.doorH + 0.4, 1.5], face: [0, 0, -dir],
    }
    dock.doorTarget = dock.state === 'CLOSED' ? 0 : 1
    dock.doorOpen = dock.doorTarget
    docks.push(dock); byId.set(dock.id, dock)
  }

  // Zones: every area in the program, inspectable from the plan.
  for (const a of AREAS) {
    if (a.group === 'circulation') continue
    // A zone "faces" its nearest wall that leaves room for a camera (6 m or more between the zone's edge and the
    // wall), so a camera framing it approaches from the open side rather than across storage or from inside the wall.
    const cx = a.x + a.w / 2, cz = a.z + a.d / 2
    const gaps: [number, Vec3][] = [[a.x - HALL_X0, [-1, 0, 0]], [-HALL_X0 - (a.x + a.w), [1, 0, 0]], [a.z - HALL_Z0, [0, 0, -1]], [-HALL_Z0 - (a.z + a.d), [0, 0, 1]]]
    const roomy = gaps.filter(g => g[0] >= 6)
    const face = (roomy.length ? roomy : gaps).reduce((m, t) => (t[0] < m[0] ? t : m))[1]
    const zone: Zone = {
      kind: 'zone', id: a.id, name: a.name, group: a.group, note: a.note, level: a.level, area: a,
      center: [cx, a.level ? 4.5 : 0.05, cz], size: [a.w, a.level ? 0.3 : 0.1, a.d], face,
    }
    zones.push(zone); byId.set(zone.id, zone)
  }

  // Pack stations: PK-01…24 singles, PK-25…48 multis, two rows per zone facing the box line, numbered west to east.
  for (const pz of PACK_ZONES) {
    const a = AREAS.find(x => x.id === pz.zone)!
    const x0 = a.x + (a.w - (PACK.perRow - 1) * PACK.pitch) / 2
    for (let r = 0; r < 2; r++) for (let i = 0; i < PACK.perRow; i++) {
      const n = pz.firstId + r * PACK.perRow + i
      const faceDir = r === 0 ? 1 : -1 // row 0 north of the line faces south onto it
      const z = PACK.lineZ - faceDir * PACK.rowOffset
      const staffed = chance(0.8)
      const st: Station = {
        kind: 'station', id: `PK-${pad(n, 2)}`, number: n, zone: pz.zone, type: pz.type,
        associate: staffed ? pick(ASSOCIATES) : null, rate: staffed ? randInt(pz.type === 'single' ? 70 : 40, pz.type === 'single' ? 130 : 75) : 0,
        queue: staffed ? randInt(0, 9) : 0, packedToday: staffed ? randInt(120, 640) : 0, state: staffed ? 'PACKING' : chance(0.5) ? 'IDLE' : 'OFFLINE',
        center: [x0 + i * PACK.pitch, 1.0, z], size: [PACK.pitch - 0.3, 2.0, 2.2], face: [0, 0, faceDir],
      }
      stations.push(st); byId.set(st.id, st)
    }
  }

  // Put walls RB-01…08 in the rebin zone; each slot lit when an order is in progress there.
  const PW = PUT_WALLS
  for (let r = 0; r < PW.rows; r++) for (let i = 0; i < PW.perRow; i++) {
    const n = r * PW.perRow + i + 1
    const slots = PW.cols * PW.tiers
    const lit = Array.from({ length: slots }, () => chance(0.45))
    const filled = lit.filter(Boolean).length
    const wall: PutWall = {
      kind: 'wall', id: `RB-${pad(n, 2)}`, number: n, slots, filled, ordersOpen: filled, ordersComplete: randInt(80, 400), lit,
      center: [PW.x0 + i * PW.pitch, PW.h / 2, PW.zRows[r]], size: [PW.w + 0.2, PW.h + 0.1, PW.d + 0.2], face: [0, 0, r === 0 ? 1 : -1],
    }
    walls.push(wall); byId.set(wall.id, wall)
  }
  // SLAM stations on the SLAM line.
  for (const st of SLAM_STATIONS) {
    const n = Number(st.id.split('-')[1])
    const slam: Slam = { kind: 'slam', id: st.id, number: n, rate: randInt(1400, 2100), rejects: randInt(3, 30), labelled: randInt(6000, 14000), state: 'RUNNING',
      center: [st.x + 2, 1.0, 41], size: [12, 2.2, 3], face: [0, 0, 1] }
    slams.push(slam); byId.set(slam.id, slam)
  }

  // Outbound lanes: a sort position under the SLAM outfeed and a staging lane behind each shipping door.
  const cutoffs = ['16:30', '17:00', '18:00', '19:30', '20:00', '21:00']
  for (const d of docks) {
    if (d.prefix !== 'OB') continue
    const cutoff = cutoffs[Math.floor((d.number - 1) / 5)]
    const state: Lane['state'] = chance(0.15) ? 'CLOSED' : chance(0.2) ? 'CLOSING' : 'OPEN'
    const sort: Lane = { kind: 'lane', role: 'sort', id: `SORT-${pad(d.number, 2)}`, number: d.number, door: d.id, carrier: d.carrier,
      units: randInt(20, 240), gaylords: 1, pallets: 0, cutoff, fill: rand(0.1, 0.95), state,
      center: [d.center[0], 0.7, 51.2], size: [3.2, 1.5, 2.6], face: [0, 0, -1] }
    const stage: Lane = { kind: 'lane', role: 'stage', id: `STG-${pad(d.number, 2)}`, number: d.number, door: d.id, carrier: d.carrier,
      units: randInt(200, 1800), gaylords: randInt(0, 3), pallets: randInt(0, 3), cutoff, fill: rand(0.05, 0.9), state,
      center: [d.center[0], 0.8, 71], size: [3.4, 2.0, 17], face: [0, 0, -1] }
    lanes.push(sort, stage); byId.set(sort.id, sort); byId.set(stage.id, stage)
  }

  // Receive and decant stations RV-01…16 and QC inspection benches QC-01…06.
  for (let i = 0; i < RECEIVE.count; i++) {
    const staffed = chance(0.75)
    const st: Station = { kind: 'station', id: `RV-${pad(i + 1, 2)}`, number: i + 1, zone: 'RCV', type: 'receive', associate: staffed ? pick(ASSOCIATES) : null,
      rate: staffed ? randInt(180, 420) : 0, queue: staffed ? randInt(0, 6) : 0, packedToday: staffed ? randInt(800, 3200) : 0, state: staffed ? 'PACKING' : chance(0.5) ? 'IDLE' : 'OFFLINE',
      center: [RECEIVE.x0 + i * RECEIVE.pitch, 1.0, RECEIVE.z], size: [3.6, 2.0, 3.0], face: [0, 0, -1] }
    stations.push(st); byId.set(st.id, st)
  }
  for (let i = 0; i < QC_BENCHES.count; i++) {
    const staffed = chance(0.7)
    const r = Math.floor(i / 3)
    const st: Station = { kind: 'station', id: `QC-${pad(i + 1, 2)}`, number: i + 1, zone: 'QC', type: 'qc', associate: staffed ? pick(ASSOCIATES) : null,
      rate: staffed ? randInt(20, 60) : 0, queue: staffed ? randInt(0, 5) : 0, packedToday: staffed ? randInt(60, 300) : 0, state: staffed ? 'PACKING' : 'IDLE',
      center: [QC_BENCHES.x0 + (i % 3) * QC_BENCHES.pitch, 1.0, QC_BENCHES.zRows[r]], size: [4.5, 2.0, 2.6], face: [0, 0, r === 0 ? 1 : -1] }
    stations.push(st); byId.set(st.id, st)
  }
  // Hold cages.
  const hold = AREAS.find(a => a.id === 'QC-HOLD')!
  const cage: Cage = { kind: 'cage', id: 'CAGE-QC', name: 'QC reject, damage and hold cage', items: randInt(40, 160), oldestDays: randInt(3, 21),
    reasons: [['Failed inspection', randInt(10, 60)], ['Damaged in transit', randInt(10, 50)], ['Vendor return', randInt(5, 30)], ['Mislabelled', randInt(2, 15)], ['Recall hold', randInt(0, 6)]],
    center: [hold.x + hold.w / 2, 1.2, hold.z + hold.d / 2], size: [hold.w, 2.4, hold.d], face: [-1, 0, 0] }
  cages.push(cage); byId.set(cage.id, cage)

  void rand
  return { bays, bins, faces, docks, zones, stations, walls, slams, lanes, cages, byId, baysOf, binsOf }
}

/** Rack bays: RA-07-012 is module RES-A, aisle 07, bay 012. Odd bays on the west face of the aisle, even on the east.
 *  Pallet slots RA-07-012-C1 (levels C–E, positions 1–2), pick faces RA-07-012-A / -B. */
function buildRackModule(m: StorageModule, all: Bay[], allFaces: PickFace[], byId: Map<string, Entity>): Bay[] {
  const out: Bay[] = []
  const code = moduleCode(m)
  let palletInstance = 0
  for (let r = 0; r < m.rows; r++) {
    const vc = rowV(m, r)
    for (const side of ['A', 'B'] as const) {
      const faceDir: 1 | -1 = side === 'A' ? -1 : 1
      const vFrame = vc + faceDir * (RACK.flue / 2 + RACK.frameDepth / 2)
      const aisleNo = side === 'A' ? r + 1 : r + 2
      for (let b = 0; b < m.baysPerRow; b++) {
        const u = bayU(m, b) + RACK.bayPitch / 2
        const bayNo = side === 'A' ? 2 * b + 2 : 2 * b + 1
        const id = `${code}-${pad(aisleNo, 2)}-${pad(bayNo, 3)}`
        const slots: PalletSlot[] = [], faces: PickFace[] = []
        const local: Vec3 = [u, RACK.uprightH / 2, vFrame]
        // Fit-out is per bay: a bay's two faces share lanes or shelving hardware, as they would be installed.
        const fit: FaceFit = pick(['hand', 'hand', 'flow', 'flow', 'flow', 'bins', 'bins'])
        for (let l = 0; l < RACK.levels; l++) {
          if (l < RACK.pickLevels) {
            const filled = chance(0.9)
            const capacity = fit === 'bins' ? 6 * 24 : fit === 'flow' ? 9 * 12 : 4 * 12
            const baseY = l === 0 ? 0 : l * RACK.levelPitch + RACK.beamH / 2
            const face: PickFace = {
              kind: 'face', id: `${id}-${'ABCDE'[l]}`, module: m.id, bayId: id, level: l, fit, aisle: `AISLE ${pad(aisleNo, 2)}`, faceDir,
              local: [u, baseY + RACK.levelPitch / 2 - 0.05, vFrame],
              center: toWorld(m, u, baseY + RACK.levelPitch / 2 - 0.05, vFrame), size: [RACK.frameDepth + 0.3, RACK.levelPitch - 0.2, RACK.bayPitch - 0.1], face: [faceDir, 0, 0],
              sku: filled ? sku() : null, product: filled ? pick(PRODUCTS) : null, qty: filled ? randInt(Math.round(capacity * 0.1), capacity) : 0, capacity,
              velocity: pick(['A', 'A', 'B', 'B', 'B', 'C']), lastPick: ago(4), lastReplen: ago(30),
            }
            faces.push(face); allFaces.push(face); byId.set(face.id, face)
            continue
          }
          for (let p = 0; p < 2; p++) {
            const filled = chance(0.82)
            slots.push({ level: l, pos: p, lpn: filled ? `LPN${randInt(1000000, 9999999)}` : null, sku: filled ? sku() : null, qty: filled ? randInt(24, 480) : 0, instance: filled ? palletInstance++ : -1, wrapped: filled ? chance(0.8) : false })
          }
        }
        const bay: Bay = {
          kind: 'bay', id, module: m.id, row: r, side, index: b, aisle: `AISLE ${pad(aisleNo, 2)}`, faceDir, local,
          center: toWorld(m, u, RACK.uprightH / 2, vFrame), size: [RACK.frameDepth + 0.1, RACK.uprightH + 1.2, RACK.bayPitch], face: [faceDir, 0, 0],
          slots, faces, fill: slots.filter(s => s.lpn).length / slots.length, lastCount: ago(72), extract: 0, extractTarget: 0,
        }
        out.push(bay); all.push(bay); byId.set(id, bay)
      }
    }
  }
  return out
}

/** Shelf bins: FM-03-018-C05 is module FM-1, aisle 03, bay 018, shelf C, position 05. */
function buildShelfModule(m: StorageModule, all: Bin[], byId: Map<string, Entity>): Bin[] {
  const out: Bin[] = []
  const code = moduleCode(m)
  let binInstance = 0
  for (let r = 0; r < m.rows; r++) {
    const vc = rowV(m, r)
    for (const side of ['A', 'B'] as const) {
      const faceDir: 1 | -1 = side === 'A' ? -1 : 1
      const aisleNo = side === 'A' ? r + 1 : r + 2
      for (let un = 0; un < m.baysPerRow; un++) {
        const u0 = bayU(m, un)
        const bayNo = side === 'A' ? 2 * un + 2 : 2 * un + 1
        for (let l = 0; l < SHELF.levels; l++) {
          const y = SHELF.firstShelfY + l * SHELF.levelPitch
          for (let p = 0; p < SHELF.binsPerShelf; p++) {
            const u = u0 + SHELF.post + BIN.W / 2 + 0.02 + p * (BIN.W + BIN.gap)
            const vFront = vc + faceDir * SHELF.unitD
            const v = vFront - faceDir * BIN.L / 2
            const id = `${code}-${pad(aisleNo, 2)}-${pad(bayNo, 3)}-${'ABCDE'[l]}${pad(p + 1, 2)}`
            const filled = chance(0.86)
            const bin: Bin = {
              kind: 'bin', id, module: m.id, row: r, side, unit: un, bay: bayNo, level: l, pos: p, aisle: `PICK AISLE ${pad(aisleNo, 2)}`, faceDir,
              local: [u, y + BIN.H / 2, v], center: toWorld(m, u, y + BIN.H / 2, v), size: [BIN.L, BIN.H, BIN.W], face: [faceDir, 0, 0],
              sku: filled ? sku() : null, product: filled ? pick(PRODUCTS) : null, qty: filled ? randInt(1, 18) : 0,
              velocity: pick(['A', 'A', 'B', 'B', 'B', 'C']), lastStow: ago(48), lastPick: ago(6), instance: binInstance++,
            }
            out.push(bin); all.push(bin); byId.set(id, bin)
          }
        }
      }
    }
  }
  return out
}

export const palletCount = (bays: Bay[]) => bays.reduce((n, b) => n + b.slots.filter(s => s.lpn).length, 0)
export { rng }
