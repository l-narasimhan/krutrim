// Full-hall layout for task 0.2. Pure data, no Three.js: the plan diagram (scripts/plan-svg.ts) and, once the
// plan is approved, buildFacility() both read from here so the picture and the geometry can never disagree.
//
// Units are metres, 1 unit = 1 m. Origin is the hall centre; +x east, +z south (toward the outbound wall).
// Every area rect is given by its north-west corner (x, z) and its width (w, along x) and depth (d, along z).

// ---- Building ------------------------------------------------------------------------------------------------

/** 800 ft × 600 ft = 480,000 sq ft, on a 50 ft × 50 ft column grid (16 × 12 structural bays). */
export const FT = 0.3048
export const HALL = {
  w: 800 * FT,           // 243.84 m
  d: 600 * FT,           // 182.88 m
  grid: 50 * FT,         // 15.24 m column grid
  clearH: 40 * FT,       // 12.19 m clear height, 36 ft to the joist bottom chord
  dockHeight: 48 * 0.0254,
}
export const HALL_X0 = -HALL.w / 2
export const HALL_Z0 = -HALL.d / 2

/** 9 ft × 10 ft sectional doors on a 12 ft centre-to-centre pitch, per dock design practice. */
export const DOOR = { pitch: 12 * FT, w: 9 * FT, h: 10 * FT }

export type Wall = 'N' | 'S'
export interface DoorRun {
  prefix: string
  wall: Wall
  /** x of the first door centre. */
  x0: number
  count: number
  /** First door number in the run. */
  from: number
  use: string
}

/** Dock doors. Inbound on the north wall, outbound on the south wall: a flow-through building. */
export const DOOR_RUNS: DoorRun[] = [
  { prefix: 'IB', wall: 'N', x0: -115.0, count: 24, from: 1, use: 'Inbound receiving' },
  { prefix: 'IB', wall: 'N', x0: -115.0 + 24 * DOOR.pitch, count: 2, from: 25, use: 'Non-conveyable receive' },
  { prefix: 'RT', wall: 'N', x0: 44.0, count: 4, from: 1, use: 'Returns' },
  { prefix: 'WC', wall: 'N', x0: 108.0, count: 2, from: 1, use: 'Waste compactor, bale-out' },
  { prefix: 'OB', wall: 'S', x0: -50.0, count: 30, from: 1, use: 'Outbound shipping' },
]

/** Outbound lane assignment, west to east along OB-01…30 (agreed 2026-09-17). */
export const CARRIERS: { name: string; lanes: number }[] = [
  { name: 'UPS', lanes: 10 }, { name: 'FedEx', lanes: 8 }, { name: 'USPS', lanes: 6 }, { name: 'Regional and LTL', lanes: 6 },
]
/** Carrier for an outbound door number, 1-based. */
export function carrierFor(obNumber: number): string {
  let n = obNumber
  for (const c of CARRIERS) { if (n <= c.lanes) return c.name; n -= c.lanes }
  return CARRIERS[CARRIERS.length - 1].name
}

export interface Door { id: string; prefix: string; number: number; wall: Wall; x: number; z: number; use: string }
export function doors(): Door[] {
  const out: Door[] = []
  for (const r of DOOR_RUNS)
    for (let i = 0; i < r.count; i++) {
      const n = r.from + i
      out.push({ id: `${r.prefix}-${String(n).padStart(2, '0')}`, prefix: r.prefix, number: n, wall: r.wall,
        x: r.x0 + i * DOOR.pitch, z: r.wall === 'N' ? HALL_Z0 : -HALL_Z0, use: r.prefix === 'OB' ? `${r.use}, ${carrierFor(n)}` : r.use })
    }
  return out
}

// ---- Storage modules -----------------------------------------------------------------------------------------

/** Selective pallet racking, hybrid pick: levels 1–2 are pick faces, levels 3–5 pallet reserve. Same
 *  hardware as the POC (42" teardrop frames, 108" step beams, 24' uprights). Rows run north–south so
 *  putaway enters from the inbound band and picks leave onto the takeaway conveyor at the south end. */
export const RACK = {
  frameDepth: 1.067, flue: 0.457, aisle: 3.5, bayPitch: 2.743 + 0.076, levels: 5, pickLevels: 2,
  crossAisle: 4.0,
}
export const RACK_ROW_PITCH = RACK.frameDepth * 2 + RACK.flue + RACK.aisle // 5.94 m

/** Rivet shelving, cart pick: 48" × 18" units back to back with a 1.4 m cart aisle (real cart-pick aisles
 *  are 1.2–1.5 m; the POC's 3 m aisle was too wide). 5 levels × 5 bins per shelf face. */
export const SHELF = { unitW: 1.219, unitD: 0.457, aisle: 1.4, levels: 5, binsPerShelf: 5, crossAisle: 3.0 }
export const SHELF_ROW_PITCH = SHELF.unitD * 2 + SHELF.aisle // 2.31 m

export interface StorageModule {
  id: string
  kind: 'rack' | 'shelf'
  name: string
  x: number; z: number; w: number; d: number
  /** Derived at build time. */
  rows: number; baysPerRow: number
}

function rackModule(id: string, name: string, x: number, z: number, w: number, d: number): StorageModule {
  const rows = Math.floor((w - RACK.aisle) / RACK_ROW_PITCH)
  const baysPerRow = Math.floor((d - RACK.crossAisle) / RACK.bayPitch)
  return { id, kind: 'rack', name, x, z, w, d, rows, baysPerRow }
}
function shelfModule(id: string, name: string, x: number, z: number, w: number, d: number): StorageModule {
  const rows = Math.floor((w - SHELF.aisle) / SHELF_ROW_PITCH)
  const baysPerRow = Math.floor((d - SHELF.crossAisle) / SHELF.unitW)
  return { id, kind: 'shelf', name, x, z, w, d, rows, baysPerRow }
}

export const MODULES: StorageModule[] = [
  rackModule('RES-A', 'Reserve racking A, hybrid pick', -118, -58, 158, 72),
  rackModule('RES-B', 'Reserve racking B, hybrid pick', 44, -34, 60, 48),
  shelfModule('FM-1', 'Fast-mover shelving module (mezzanine-ready)', 64, -58, 40, 20),
]

// ---- Areas ---------------------------------------------------------------------------------------------------

export type Group = 'yard' | 'inbound' | 'storage' | 'outbound' | 'returns' | 'support' | 'circulation'
export interface Area {
  id: string; name: string; group: Group
  x: number; z: number; w: number; d: number
  /** Short note shown on the plan: what stands here, at what scale. */
  note?: string
  /** Drawn as an overlay on the level below (mezzanine). */
  level?: 1
}

const A = (id: string, name: string, group: Group, x: number, z: number, w: number, d: number, note?: string, level?: 1): Area =>
  ({ id, name, group, x, z, w, d, note, level })

const XW = HALL_X0, XE = -HALL_X0, ZN = HALL_Z0, ZS = -HALL_Z0

export const AREAS: Area[] = [
  // Inbound band, north wall, west to east
  A('IB-STG', 'Inbound dock staging', 'inbound', -118, ZN, 96, 11, 'Floor lanes behind IB-01…24, pallet jacks, extendable conveyors'),
  A('RCV', 'Receive and decant', 'inbound', -118, -80.4, 68, 10, '16 receive stations, tote stacks, bale area'),
  A('QC', 'QA/QC inspection', 'inbound', -50, -80.4, 20, 10, 'Inspection benches, scales, pass/fail lanes'),
  A('QC-HOLD', 'QC reject / damage / hold cage', 'inbound', -30, -80.4, 8, 12, 'Fenced, gated, red hold tags'),
  A('PA-STG', 'Putaway staging', 'inbound', -118, -70.4, 84, 9.4, 'Positions by destination module, buffer conveyor east to FM-1'),
  A('NC', 'Non-conveyable receive and storage', 'inbound', -22, ZN, 22, 30.4, 'Behind IB-25/26, oversize floor positions, NC racking'),
  A('DO-N', 'Dock office (inbound)', 'support', 0, ZN, 10, 6),
  A('HAZ', 'Hazmat cage', 'storage', 12, ZN, 12, 12, 'Fenced, ventilated, flammables cabinet'),
  A('HV', 'High-value cage', 'storage', 24, ZN, 12, 12, 'Fenced, badge access, own shelving'),
  // Returns, behind RT-01…04
  A('RT-RCV', 'Returns receive', 'returns', 40, ZN, 20, 13.4, 'Behind RT-01…04, returns totes, carts'),
  A('GRADE', 'Grading benches', 'returns', 60, ZN, 20, 13.4, '12 benches, four grade bins each'),
  A('REFURB', 'Refurbish bench', 'returns', 40, -78, 12, 10),
  A('LIQ', 'Liquidation staging', 'returns', 52, -78, 16, 10, 'Pallets toward outbound'),
  A('DISP', 'Disposal and recycling', 'returns', 68, -78, 12, 10),
  // Support, north-east
  A('ICQA', 'ICQA', 'support', 80, ZN, 10, 11.4),
  A('PS', 'Problem solve', 'support', 90, ZN, 10, 11.4),
  A('DMG', 'Damageland cage', 'support', 80, -80, 20, 12, 'Hold shelving, item count and age'),
  A('BALER', 'Cardboard baler and recycling', 'support', 100, ZN, 21.92, 15.4, 'Baler at WC-02, compactor at WC-01'),
  // Support, east wall
  A('BATT', 'Battery charging room', 'support', 106, -76, 15.92, 30, 'Chargers, eyewash, ventilation'),
  A('RME', 'Maintenance shop and RME', 'support', 106, -46, 15.92, 30),
  A('SAFE-E', 'Restrooms, first aid, AED', 'support', 106, -16, 15.92, 18),
  A('TOTES', 'Empty tote and cart storage', 'support', 106, 2, 15.92, 19),
  A('PKG', 'Packaging supplies', 'support', 80, 21, 41.92, 29, 'Box, mailer, dunnage and tape racking'),
  // Storage
  A('RES-A', 'Reserve racking A, hybrid pick', 'storage', -118, -58, 158, 72),
  A('RES-B', 'Reserve racking B, hybrid pick', 'storage', 44, -34, 60, 48),
  A('REPL', 'Replenishment staging', 'storage', 44, -58, 20, 20, 'Reserve-to-pick pallets by aisle'),
  A('FM-1', 'Fast-mover shelving module', 'storage', 64, -58, 40, 20, 'Halved 2026-09-17; single level, mezzanine footprint kept'),
  // Outbound band, north to south
  A('TAKE', 'Takeaway conveyor and south cross aisle', 'outbound', -118, 14, 222, 7, 'Belt at z 17–19, aisle-end inducts'),
  A('PACK-S', 'Pack singles', 'outbound', -110, 21, 50, 17, '24 stations'),
  A('REBIN', 'Rebin / sort walls', 'outbound', -60, 21, 40, 17, 'Put walls with lit slots, tote induct'),
  A('PACK-M', 'Pack multis', 'outbound', -20, 21, 50, 17, '24 stations'),
  A('GIFT', 'Gift wrap and special handling', 'outbound', 30, 21, 20, 17),
  A('TOTE-R', 'Empty tote return and cart park', 'outbound', 50, 21, 30, 17),
  A('SLAM', 'SLAM line', 'outbound', -110, 38, 160, 6, 'Scan tunnel, print and apply, in-line scale, reject lane'),
  A('SORT', 'Manual carrier sort', 'outbound', -70, 44, 130, 18, 'Sort desks, gaylords and pallets per lane'),
  A('OB-STG', 'Outbound staging lanes', 'outbound', -70, 62, 140, 18, '30 lanes, one per OB door, stretch wrapper'),
  A('OB-DOCK', 'Outbound dock floor', 'outbound', -70, 80, 140, 11.44, 'Behind OB-01…30, fluid-load conveyors'),
  // South-east
  A('PAL', 'Empty pallet and gaylord storage', 'support', 80, 50, 41.92, 20),
  A('DO-S', 'Dock office (outbound), driver waiting', 'support', 80, 70, 20, 21.44),
  A('ELEC', 'Electrical and fire pump rooms', 'support', 100, 70, 21.92, 21.44),
  // West end: people
  A('WALK-W', 'West walkway, first aid, spill kits', 'circulation', XW, 21, 11.92, 23),
  A('TRAIN', 'Training rooms', 'support', XW, 44, 17, 18),
  A('WC', 'Restrooms and lockers', 'support', XW, 62, 17, 16),
  A('BREAK', 'Break rooms, vending, stairs to mezzanine', 'support', -104.92, 44, 34.92, 22),
  A('CAFE', 'Cafeteria', 'support', -104.92, 66, 34.92, 25.44),
  A('SEC', 'Security entrance, turnstiles', 'support', XW, 78, 17, 13.44, 'Guard desk, badge readers, door to associate parking'),
  A('MEZZ', 'Offices mezzanine (level 1)', 'support', XW, 44, 52, 47.44, 'Offices, HR, conference, above cafeteria and training', 1),
  // Circulation
  A('AISLE-W', 'West main aisle', 'circulation', XW, -58, 3.92, 72),
  A('AISLE-C', 'Centre main aisle', 'circulation', 40, -58, 4, 72),
  A('AISLE-E', 'East walkway', 'circulation', 104, -76, 2, 97),
  A('XA-1', 'Cross aisle', 'circulation', -118, -24, 158, RACK.crossAisle),
  A('XA-2', 'Cross aisle', 'circulation', -118, -61, 222, 3),
  A('XA-3', 'Cross aisle, FM-1 south entry', 'circulation', 44, -38, 60, 4),
]

// ---- Conveyors -----------------------------------------------------------------------------------------------

/** A powered conveyor line: a polyline of world (x, z) points, top of belt or rollers at `h`, spurs that branch
 *  off it, `kind` belt or roller, and what rides it. */
export interface ConveyorLine {
  id: string; name: string; points: [number, number][]; h: number; spurs: { at: number; to: [number, number] }[]
  kind: 'belt' | 'roller'; carries: 'tote' | 'box'
  /** Distance along the line after which boxes carry a shipping label (downstream of print-and-apply). */
  labelAfter?: number
}

/** SLAM stations on the SLAM line, one downstream of each pack merge: in-line scale, scan tunnel,
 *  print-and-apply, verify scanner, reject lane. `x` is the tunnel position. */
export const SLAM_STATIONS: { id: string; x: number }[] = [{ id: 'SLAM-1', x: -50 }, { id: 'SLAM-2', x: 38 }]

/** Put walls for multi-item rebin: 8 walls in two rows of 4 in the rebin zone, each 8 slots wide × 6 high. */
export const PUT_WALLS = { rows: 2, perRow: 4, w: 3.0, h: 2.2, d: 0.6, cols: 8, tiers: 6, zRows: [25.5, 33.0], x0: -55, pitch: 10 }

/** Pack stations: two rows of 12 per pack zone facing a packed-box roller line at `lineZ`, which runs east then
 *  south to the SLAM line. Station pitch 3 m, bench 1.8 × 0.9 m at 0.9 m. */
export const PACK = { perRow: 12, pitch: 3.0, lineZ: 29.5, rowOffset: 2.6, bench: { w: 1.8, d: 0.9, h: 0.9 } }
export const PACK_ZONES: { zone: string; type: 'single' | 'multi'; firstId: number }[] = [
  { zone: 'PACK-S', type: 'single', firstId: 1 }, { zone: 'PACK-M', type: 'multi', firstId: 25 },
]

/** The takeaway belt runs west along the south edge of storage at z 18 and diverts into each pack zone;
 *  each pack zone's box line collects packed boxes and carries them south to the SLAM line at z 41. */
export const CONVEYORS: ConveyorLine[] = [
  { id: 'CV-PACK-S', name: 'Pack singles box line', kind: 'roller', carries: 'box', h: 0.75, spurs: [], points: [[-107, PACK.lineZ], [-62, PACK.lineZ], [-62, 40.5]] },
  { id: 'CV-PACK-M', name: 'Pack multis box line', kind: 'roller', carries: 'box', h: 0.75, spurs: [], points: [[-17, PACK.lineZ], [28, PACK.lineZ], [28, 40.5]] },
  // SLAM line: east along z 41 through both SLAM stations, then south into the sort zone and west along z 48
  // past the carrier sort positions. Boxes are labelled 3 m past the first print-and-apply they meet.
  { id: 'CV-SLAM', name: 'SLAM line', kind: 'roller', carries: 'box', h: 0.75, spurs: [], points: [[-108, 41], [48, 41], [48, 48], [-65, 48]], labelAfter: 61 },
  {
    id: 'CV-TAKE', name: 'Takeaway conveyor', kind: 'belt', carries: 'tote', points: [[50, 18], [-118, 18]], h: 0.85,
    spurs: [
      { at: 40, to: [40, 25] },   // gift wrap
      { at: 5, to: [5, 25] },     // pack multis
      { at: -40, to: [-40, 23.5] }, // rebin, stops short of put wall RB-02
      { at: -85, to: [-85, 25] }, // pack singles
    ],
  },
]

// ---- Yard ----------------------------------------------------------------------------------------------------

export const TRAILER = { L: 16.15, W: 2.6 }
/** 130 ft apron per dock design guides, then trailer parking rows at 12 ft pitch. */
export const YARD = {
  apron: 130 * FT,
  fence: { x: -200, z: -178, w: 360, d: 356 },
  areas: [
    A('Y-N', 'North yard apron, yard tractor lane', 'yard', XW - 20, ZN - 130 * FT, HALL.w + 40, 130 * FT),
    A('Y-S', 'South yard apron, carrier pickup lanes', 'yard', XW - 20, ZS, HALL.w + 40, 130 * FT),
    A('TP-N', 'Trailer parking, 2 rows × 56', 'yard', XW - 20, ZN - 130 * FT - 2 * (TRAILER.L + 2), HALL.w + 40, 2 * (TRAILER.L + 2)),
    A('TP-S', 'Trailer parking, 2 rows × 56', 'yard', XW - 20, ZS + 130 * FT, HALL.w + 40, 2 * (TRAILER.L + 2)),
    A('GATE', 'Gate house and guard shack', 'yard', -196, -60, 14, 10, 'Truck entry and exit, scale'),
    A('PARK', 'Associate parking, 480 stalls', 'yard', -196, 0, 50, 110, 'Walkway to the security entrance'),
  ],
}

// ---- Derived numbers, for the plan legend and the task notes ------------------------------------------------

export function summary() {
  const ds = doors()
  const byPrefix: Record<string, number> = {}
  for (const d of ds) byPrefix[d.prefix] = (byPrefix[d.prefix] ?? 0) + 1
  let rackBays = 0, palletPositions = 0, pickFaces = 0, shelfUnits = 0, bins = 0
  for (const m of MODULES) {
    const bays = m.rows * 2 * m.baysPerRow
    if (m.kind === 'rack') {
      rackBays += bays
      palletPositions += bays * (RACK.levels - RACK.pickLevels) * 2
      pickFaces += bays * RACK.pickLevels
    } else {
      shelfUnits += bays
      bins += bays * SHELF.levels * SHELF.binsPerShelf
    }
  }
  return {
    hall: { w: HALL.w, d: HALL.d, sqft: 800 * 600, grid: HALL.grid },
    doors: { total: ds.length, byPrefix },
    modules: MODULES.map(m => ({ id: m.id, rows: m.rows, baysPerRow: m.baysPerRow, bays: m.rows * 2 * m.baysPerRow })),
    rackBays, palletPositions, pickFaces, shelfUnits, bins,
    areas: AREAS.length,
  }
}
