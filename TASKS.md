# Fulcrum Twin — task tracker

Source of truth for progress. Decisions, the realism rule and the process flow live in [PLAN.md](PLAN.md).
Updated every time a task changes state. Last update: 2026-09-17 (plan approved; full hall built from the layout data: 62 docks, RES-A, RES-B, FM-1, 47 zones; 0.2 in REVIEW).

**Status legend**

| Status | Meaning |
|---|---|
| `TODO` | Not started |
| `POC` | First pass exists in the proof of concept, not yet held to the realism standard |
| `WIP` | In progress, approved by you |
| `REVIEW` | Built, waiting for your look and the side-by-side realism check |
| `DONE` | Passed the realism check, you signed off |
| `BLOCKED` | Waiting on a decision or an asset |

**Size:** S under an hour · M a few hours · L a day or more.

## Progress

| Milestone | Tasks | DONE | REVIEW | WIP | POC | TODO |
|---|---|---|---|---|---|---|
| 0 Foundations | 4 | 0 | 1 | 0 | 3 | 0 |
| 1 Building shell and yard | 8 | 0 | 0 | 0 | 5 | 3 |
| 2 Inbound | 9 | 0 | 0 | 0 | 2 | 7 |
| 3 Reserve storage and rack picking | 7 | 0 | 0 | 0 | 3 | 4 |
| 4 Pick module | 7 | 0 | 0 | 0 | 4 | 3 |
| 5 Pack, SLAM, manual sort | 6 | 0 | 0 | 0 | 0 | 6 |
| 6 Outbound | 3 | 0 | 0 | 0 | 0 | 3 |
| 7 Returns | 4 | 0 | 0 | 0 | 0 | 4 |
| 8 Supporting areas | 9 | 0 | 0 | 0 | 0 | 9 |
| 9 People | 5 | 0 | 0 | 0 | 0 | 5 |
| 10 Navigation | 5 | 0 | 0 | 0 | 3 | 2 |
| 11 Console | 5 | 0 | 0 | 0 | 4 | 1 |
| 12 Polish, performance, delivery | 4 | 0 | 0 | 0 | 0 | 4 |
| 13 Barcode scanning | 4 | 0 | 0 | 0 | 1 | 3 |
| **Total** | **80** | **0** | **1** | **0** | **25** | **54** |

## Next up

0.2 is built and in REVIEW: the whole hall renders from `src/layout.ts` (plan: `npm run plan`, `docs/plan/`; screenshots:
`docs/hall/`). Sign it off after a look, then: 1.1 → 1.2 → 3.1 → 3.7 → 3.2 → 4.1 → 4.2 → 4.3, then people, docks and the flow areas.

Resuming in a new session: read PLAN.md, then this file, then `npm run dev` in this folder and open http://localhost:5180.

---

## 0 Foundations

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 0.1 | App shell: Vite + TS + Three.js, canvas, render loop, resize, fps / draw call / triangle counter | S | POC | Blank lit scene at 60 fps | Working in POC |
| 0.2 | Facility data model: full big-hall layout with every area in the PLAN.md area program, zones, naming conventions, seeded generator for every location ID | L | REVIEW | `buildFacility()` returns every entity with position and size; labelled plan diagram approved by you | Plan approved 2026-09-17 and built the same day. `src/layout.ts` is the source (800 × 600 ft, 62 doors with carriers, 52 areas); `buildFacility()` returns 1,506 rack bays with reserve slots C–E and pick faces A–B, 10,400 bins, 62 docks, 47 zones, all with world position, size and face. Modules are built in a local frame and rotated so rows run north–south. Pick faces have IDs but no fit-out until 3.7 |
| 0.3 | Renderer and lighting rig: ACES, physically based lights, shadow key light, HDRI environment, fog | M | POC | Test steel box looks like painted steel under warehouse light | Needs bloom and AO later (12.1, 12.2) |
| 0.4 | Camera system: orbit, smooth fly-to, named presets, frame-an-entity | M | POC | Presets animate cleanly; framing fits any object | Camera clamped inside the hall |

## 1 Building shell

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 1.1 | Floor: sealed concrete, wear, saw-cut joint grid, slight reflectivity | M | POC | Reads as concrete at 2 m and at 100 m | Poly Haven concrete_floor_02; joints on 15' grid |
| 1.2 | Walls, columns, roof structure: IMP walls, W10 columns, joist girders, bar joists, roof deck | M | POC | Reads as a real steel building from inside and above | Full hall on the 50 ft grid with 62 door openings; walls are flat, need panel joints, base angle detail, girts |
| 1.3 | High-bay lighting: LED fixture rows, emissive housings, light pools on the floor | M | POC | Fixtures visible; floor shows pooled light | Only 5 point lights for pools; needs a light-pool solution that scales |
| 1.4 | Overhead services: sprinkler mains and branches, cable tray, conduit drops, HVAC ducts, HVLS fans | M | POC | Looking up in first person is believable | Sprinklers and tray in; no ducts, no fans |
| 1.5 | Floor markings: aisle stripes, walkways, hazard hatching, zone paint, painted labels | M | POC | Plan view fully labelled | Full hall: every zone outlined and named, every aisle numbered at both ends, hatching at all 62 doors; text is one instanced atlas (`scene/text.ts`) |
| 1.6 | Signage: hanging aisle signs, zone banners, exit signs, safety boards | S | TODO | Every aisle identifiable from its end | |
| 1.7 | Truck yard: apron, striping, trailer parking rows, yard jockey lane, gate house, yard lights, fence | M | TODO | View from outside the dock wall looks like a yard | Apron and one trailer position exist; scope grew 2026-09-17 |
| 1.8 | Yard moves: yard tractor spotting trailers in and out of doors, restraint engage, dock light on, arrivals and departures in the event stream | M | TODO | A trailer leaves a door and another backs in without clipping | New 2026-09-17 |

## 2 Inbound

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 2.1 | Dock doors: 62 doors, roll-up animation, leveler, bumpers, dock light, restraint, number | M | POC | Door opens on click; number readable | All 62 built with all parts, instanced panels, numbered plates inside and out; any door opens from the inspector |
| 2.2 | Trailers and tractors: 53 ft dry vans, wheels, landing gear, livery, tractor cabs | M | POC | Trailers sit correctly against docks, doors open | 42 trailers at occupied doors on both walls, cargo tracks load/unload progress; no tractor, no livery |
| 2.3 | Receive stations: desks, scanners, monitors, printers, tote stacks, bale area | M | TODO | Receive station inspectable | |
| 2.4 | Inbound staging: floor lanes, pallets, pallet jacks, stretch wrap, receive conveyor | S | TODO | Staging populated and labelled | |
| 2.5 | QA/QC inspection at receive: inspection benches, sample carts, scales, monitors, pass/fail lanes | M | TODO | An inspection bench is inspectable with pass/fail counts | New 2026-09-17 |
| 2.6 | QC reject / damage / hold cage: fenced quarantine cage with gate, hold shelving, vendor-return pallets, red hold tags | M | TODO | Cage inspectable: items on hold, reason codes, age | New 2026-09-17 |
| 2.7 | Putaway staging: floor positions by destination module, staged pallets and tote stacks, putaway buffer conveyor to the pick module | M | TODO | Staged pallets carry destination labels; buffer conveyor feeds the mezzanine | New 2026-09-17 |
| 2.8 | Non-conveyable (NC) receive and storage: oversize floor positions, NC pallet racking | S | TODO | NC zone labelled and stocked | New 2026-09-17 |
| 2.9 | Dock unloading in motion: forklift / pallet jack cycling pallets from trailer to staging; extendable conveyor into floor-loaded trailers with unloaders handing cartons; cargo in the trailer shrinks; dock inspector progress tracks it | M | TODO | A trailer visibly empties over time by both methods | New 2026-09-17 |

## 3 Reserve storage and rack picking

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 3.1 | Racking structure: teardrop uprights, orange step beams, wire decking, footplates, row spacers, guards; instanced | L | POC | Full reserve block in under 40 draw calls | RES-A (25 rows × 24 bays) and RES-B (9 × 17) with cross aisles, about 12 draw calls per module; punching is a bump map, beams lack safety locks and end connectors; aisle-end guards not yet placed on the full modules |
| 3.7 | Rack pick levels (hybrid): levels 1–2 of every bay fitted with bins, carton-flow lanes or hand-stack shelves, each pick face barcoded; pallet reserve above | L | TODO | Any bay shows pick faces below and reserve pallets above; a pick face scans | New 2026-09-17: picking happens in the racks |
| 3.2 | Pallets and loads: GMA pallets, wrapped load variants, cardboard texture, LPN labels | M | POC | No two adjacent loads look identical | Film is a translucent box; needs wrap creases and corner boards |
| 3.3 | Bay inspection: tooltip, inspector with slot grid, pull-pallets action | M | POC | Any bay clickable and pullable | Working |
| 3.4 | Forklifts and reach trucks: detailed models, parked and driving with mast animation | M | TODO | A truck drives an aisle and stops at a bay | |
| 3.5 | Hazmat cage and high-value cage: fenced, gated, signed, own racking and shelving | S | TODO | Both cages labelled and inspectable | New 2026-09-17; placed on the north wall between inbound and returns (HAZ, HV in `src/layout.ts`), agreed 2026-09-17 |
| 3.6 | Replenishment staging: reserve-to-pick pallets staged at the pick module ends | S | TODO | Staged replen pallets carry destination labels | New 2026-09-17 |

## 4 Pick module

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 4.1 | Fast-mover shelving module (smaller than first planned): rivet shelving, posts, shelves, dividers, kick plates | M | POC | Rows render instanced at real proportions | FM-1: 16 double rows × 26 units on 1.4 m cart aisles; no dividers or kick plates yet |
| 4.2 | Bins: instanced, 3 size variants, partially filled with product shapes | M | POC | About 10,000 bins in a handful of draw calls | 10,400 bins in FM-1, one size, hollow, with contents, 3 draw calls |
| 4.3 | Barcode labels: Code 128 encoder, one label per bin, drawn per pixel in the shader from a data texture | L | POC | Label readable; a phone app scans it off the screen | Replaced the bitmap atlas 2026-09-17: 10,400 bin labels + 9,000 LPN labels + 1,506 placards as one data texture each (`scene/labels.ts`), crisp at any distance; phone scan not yet verified |
| 4.4 | Bin inspection: click to scan, location, SKUs, quantities, last stow / pick, velocity | M | POC | Scanning any bin gives correct data | Working |
| 4.5 | Pick carts and totes: carts with tote positions, two tote colours, handheld on cart | S | TODO | Carts in aisles and with pickers | |
| 4.6 | Pick path markings: aisle-end signs with bay ranges, floor arrows | S | TODO | Pick path followable in first person | |
| 4.7 | Pick mezzanine (optional, later): steel mezzanine above the pick module, decking, handrail, stairs, tote lifts, level signage | L | TODO | Walkable on every level in first person | Deferred 2026-09-17: single-level pick agreed; layout keeps room for it |

## 5 Pack, SLAM and manual sort

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 5.1 | Takeaway conveyor: belt and roller sections, rails, legs, photo eyes, motors with conduit | M | TODO | Totes ride it end to end | |
| 5.2 | Pack stations: 12 stations with bench, box shelf, tape, dunnage, scale, printer, monitor | M | TODO | Stations inspectable with associate, rate, queue | |
| 5.3 | SLAM line: scanner tunnel, print-and-apply, in-line scale, reject lane | M | TODO | Boxes ride through and get a label | |
| 5.4 | Manual carrier sort: sort desks, gaylords and pallets per lane, scan-to-sort screens | M | TODO | Lanes labelled by carrier and inspectable | |
| 5.5 | Rebin / sort walls for multi-item orders: put walls with lit slots, tote induct, order-complete lights | M | TODO | A multi-item order fills a wall slot | New 2026-09-17 |
| 5.6 | Gift wrap and special handling stations | S | TODO | Stations inspectable | New 2026-09-17 |

## 6 Outbound transport zone

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 6.1 | Outbound staging lanes per carrier, gaylords, wrapped pallets, stretch wrapper | M | TODO | 30 outbound docks each have a labelled lane | Carrier mix agreed 2026-09-17: UPS 10, FedEx 8, USPS 6, regional and LTL 6, in `src/layout.ts` |
| 6.2 | Fluid load: extendable conveyors into open trailers, boxes being loaded | S | TODO | An outbound trailer shows a load in progress | |
| 6.3 | Lane inspection: carrier, cut-off, box count, trailer fill | S | TODO | Any lane clickable | |

## 7 Returns processing

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 7.1 | Returns receive: dedicated dock, unload area, returns totes, carts | S | TODO | Returns has its own labelled zone | |
| 7.2 | Grading benches: scanner, monitor, four grade bins, test equipment | M | TODO | Benches inspectable | |
| 7.3 | Returns outputs: restock totes toward pick, liquidation pallets toward outbound | S | TODO | Both outputs visible | |
| 7.4 | Refurbish bench, liquidation staging, disposal and recycling | S | TODO | All three labelled and inspectable | New 2026-09-17 |

## 8 Supporting areas

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 8.1 | Problem-solve and ICQA desks | S | TODO | Present and labelled | Zones ICQA and PS placed and painted in 0.2; no desks yet |
| 8.2 | Packaging supplies racks, battery charging room, dock office | S | TODO | Present and labelled | |
| 8.3 | Mezzanine with offices and break room, restrooms, stairs | M | TODO | Walkable in first person | |
| 8.4 | Fire equipment, first-aid, eyewash, spill kits | S | TODO | Present at code-plausible spacing | |
| 8.5 | Damageland and problem-solve cage with hold shelving | S | TODO | Inspectable: item count, age | New 2026-09-17 |
| 8.6 | Cardboard baler and recycling area, waste compactor at a dock | S | TODO | Present and labelled | New 2026-09-17 |
| 8.7 | Maintenance shop and RME, forklift battery and charging room with chargers | M | TODO | Walkable in first person | New 2026-09-17 |
| 8.8 | Cafeteria, break rooms, training rooms, offices, restrooms on a mezzanine | M | TODO | Walkable in first person | New 2026-09-17 |
| 8.9 | Security entrance: turnstiles, guard desk, badge readers, associate parking and walkways outside | S | TODO | Entry sequence walkable from the car park | New 2026-09-17 |

## 9 People

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 9.1 | Human figure: licensed rigged low-poly figure, vest colour by role, badge | L | TODO | Walks in place, looks right at 2 m | Needs a CC0 or Mixamo-licensed source; your call on the look |
| 9.2 | Animations: walk, idle, pick, place, pack, scan, drive | M | TODO | Each role has its loop | |
| 9.3 | Role behaviours: pickers with carts, packers, receivers, graders, drivers; schedules and breaks | L | TODO | Floor looks staffed and busy in every zone | Shift size agreed 2026-09-17: 60 on the floor |
| 9.4 | Person inspection: name, role, task, rate, time on shift | S | TODO | Any person clickable | |
| 9.5 | Handheld scanners in people's hands: real RF device model (Zebra TC-series / MC9300 style), holstered when walking, raised at a pick face with a red aim line and beep; each scan emits an event and updates the location (ties to 13.4) | M | TODO | Watch a picker scan a label and see the scan appear in the stream and on the bin | New 2026-09-17 |

## 10 Navigation

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 10.1 | Bird's-eye: orthographic plan, pan and zoom, labels legible, click to inspect or dive | M | POC | Whole FC readable at a glance | Works for the slice; roof hides in plan |
| 10.2 | First person: eye height, arrows and WASD, mouse look, jog, collision | M | POC | Walk the whole pick path without clipping | Working; collision is box-based |
| 10.3 | Mini-map in first person with position and heading | S | TODO | Dot tracks the walker | |
| 10.4 | Presets and guided tour of the inbound-to-outbound route | S | TODO | Tour completes without collision | Presets exist; no tour |
| 10.5 | Arrow traversal in every mode: arrows walk in first person, move the orbit camera along the floor, pan the plan view; on-screen arrow pad for mouse and touch | S | POC | Arrows move you in all three modes | Arrows work in first person only |

## 11 Console

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 11.1 | Console shell: top bar, layer nav, KPI tiles, inspector, event stream, camera bar, stats | M | POC | Layout matches the reference structure | Working |
| 11.2 | Layers: Overview, Inventory, Flow, Labor, Safety recolouring | M | TODO | Switching layers recolours the scene | Nav buttons present, disabled |
| 11.3 | Event stream: simulated WMS, dock, pack, returns, safety events, filters | S | POC | Events scroll at a realistic rate | Working |
| 11.4 | Inspector: header, status, meta, metric tiles, sparkline, capacity bars, detail grid, actions | M | POC | Every inspectable type renders correctly | Bay, bin, dock done |
| 11.5 | Focus and search by location ID or name | S | POC | `1A-02-014-C05` flies to that bin | Working |

## 12 Polish, performance, delivery

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 12.1 | Baked ambient occlusion and contact shadows | M | TODO | Racks and walls sit in the scene, no floating look | |
| 12.2 | Post-processing: bloom on fixtures and screens, optional SSAO | M | TODO | Lights glow like the reference | |
| 12.3 | Performance budget: 60 fps on a laptop GPU, under 200 draw calls, LOD for bins and labels | M | TODO | Budget met on the full layout | POC: 60 fps, 50–90 draw calls |
| 12.4 | Deploy to Vercel, README with screenshots and a recorded walkthrough | S | TODO | Public URL works | |

## 13 Barcode scanning

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 13.1 | In-twin handheld: raise scanner in first person, aim, range-limited decode, beep, scan-location / scan-item / confirm-qty workflow | S | POC | A pick or stow can be completed by scanning in first person | Click-to-scan exists; no handheld, no workflow |
| 13.2 | Hardware scanner input: keyboard-wedge listener, print-labels page with real-size labels as PDF | S | TODO | A printed label scanned with a USB scanner flies to that bin | |
| 13.3 | Camera scanning: BarcodeDetector with ZXing fallback, phone as wireless scanner over WebSocket | M | TODO | A phone scan of a printed label selects the bin in the twin | |
| 13.4 | Scan-driven data: scans update quantities, last pick / stow, and emit events | S | TODO | Inventory layer changes as scans happen | Bridge to the live-data phase |
