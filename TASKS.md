# Krutrim — task tracker

Source of truth for progress. Decisions, the realism rule and the process flow live in [PLAN.md](PLAN.md).
Updated every time a task changes state. Last update: 2026-09-21 (3.8 and 3.9 added in REVIEW, 4.2 to REVIEW; the real-goods rollout out of the RES-B pilot).

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
| 0 Foundations | 4 | 1 | 0 | 0 | 3 | 0 |
| 1 Building shell and yard | 8 | 0 | 0 | 0 | 5 | 3 |
| 2 Inbound | 9 | 5 | 0 | 0 | 2 | 2 |
| 3 Reserve storage and rack picking | 9 | 2 | 2 | 0 | 3 | 2 |
| 4 Pick module | 7 | 0 | 1 | 0 | 3 | 3 |
| 5 Pack, SLAM, manual sort | 6 | 5 | 0 | 0 | 0 | 1 |
| 6 Outbound | 3 | 2 | 0 | 0 | 0 | 1 |
| 7 Returns | 4 | 0 | 0 | 0 | 0 | 4 |
| 8 Supporting areas | 9 | 0 | 0 | 0 | 0 | 9 |
| 9 People | 5 | 5 | 0 | 0 | 0 | 0 |
| 10 Navigation | 5 | 1 | 0 | 0 | 3 | 1 |
| 11 Console | 5 | 1 | 0 | 0 | 4 | 0 |
| 12 Polish, performance, delivery | 4 | 0 | 0 | 0 | 0 | 4 |
| 13 Barcode scanning | 4 | 0 | 0 | 0 | 1 | 3 |
| **Total** | **82** | **22** | **3** | **0** | **24** | **33** |

## Next up

Agreed 2026-09-17: fill the process zones along the tour, outbound band first (5.1 → 5.2 → 5.5 → 5.3 → 5.4 → 6.1),
then the inbound band (2.3 → 2.4 → 2.5 → 2.6 → 2.7), then realism passes and people.

Resuming in a new session: read PLAN.md, then this file, then `npm run dev` in this folder and open http://localhost:5180.

---

## 0 Foundations

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 0.1 | App shell: Vite + TS + Three.js, canvas, render loop, resize, fps / draw call / triangle counter | S | POC | Blank lit scene at 60 fps | Working in POC |
| 0.2 | Facility data model: full big-hall layout with every area in the PLAN.md area program, zones, naming conventions, seeded generator for every location ID | L | DONE | `buildFacility()` returns every entity with position and size; labelled plan diagram approved by you | Plan approved 2026-09-17 and built the same day. `src/layout.ts` is the source (800 × 600 ft, 62 doors with carriers, 52 areas); `buildFacility()` returns 1,470 rack bays with reserve slots C–E and pick faces A–B, 10,400 bins, 62 docks, 47 zones, all with world position, size and face. Modules are built in a local frame and rotated so rows run north–south. Pick faces fitted out in 3.7. Signed off by Lan 2026-09-17 |
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
| 2.3 | Receive stations: desks, scanners, monitors, printers, tote stacks, bale area | M | DONE | Receive station inspectable | Built 2026-09-17 (`scene/inbound.ts`): RV-01…16, each a receive desk with monitor, scanner and LPN printer beside a decant table with cases, a tote stack and a queued pallet; two bale cages at the west end; inspector shows associate, units/h vs target, pallets queued, received today. Signed off by Lan 2026-09-17 |
| 2.4 | Inbound staging: floor lanes, pallets, pallet jacks, stretch wrap, receive conveyor | S | DONE | Staging populated and labelled | Built 2026-09-17: a striped, numbered lane behind every inbound door with unloaded pallets (more at occupied doors), manual pallet jacks in some lanes, two extendable conveyors parked at floor-load doors. Signed off by Lan 2026-09-17 |
| 2.5 | QA/QC inspection at receive: inspection benches, sample carts, scales, monitors, pass/fail lanes | M | DONE | An inspection bench is inspectable with pass/fail counts | Built 2026-09-17: QC-01…06 benches with scale, monitor and sample cart; green PASS lane south to putaway staging, red FAIL lane east to the hold cage; inspector shows samples/h, queue, inspected today. Pass/fail split is phase 2 data. Signed off by Lan 2026-09-17 |
| 2.6 | QC reject / damage / hold cage: fenced quarantine cage with gate, hold shelving, vendor-return pallets, red hold tags | M | DONE | Cage inspectable: items on hold, reason codes, age | Built 2026-09-17: CAGE-QC, 8 ft chain-link on posts with top rail, sliding gate and QC HOLD sign on the west face, hold shelving and red-tagged pallets inside; inspector shows items, oldest hold and holds by reason. Signed off by Lan 2026-09-17 |
| 2.7 | Putaway staging: floor positions by destination module, staged pallets and tote stacks, putaway buffer conveyor to the pick module | M | DONE | Staged pallets carry destination labels; buffer conveyor feeds the mezzanine | Built 2026-09-17: 30 painted positions in RES-A, RES-B and FM-1 groups with painted and posted destination signs, staged pallets and tote stacks; buffer belt conveyor from staging east to FM-1 with totes riding it. Per-pallet destination labels still to do. Signed off by Lan 2026-09-17 |
| 2.8 | Non-conveyable (NC) receive and storage: oversize floor positions, NC pallet racking | S | TODO | NC zone labelled and stocked | New 2026-09-17 |
| 2.9 | Dock unloading in motion: forklift / pallet jack cycling pallets from trailer to staging; extendable conveyor into floor-loaded trailers with unloaders handing cartons; cargo in the trailer shrinks; dock inspector progress tracks it | M | TODO | A trailer visibly empties over time by both methods | New 2026-09-17 |

## 3 Reserve storage and rack picking

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 3.1 | Racking structure: teardrop uprights, orange step beams, wire decking, footplates, row spacers, guards; instanced | L | POC | Full reserve block in under 40 draw calls | RES-A (25 rows × 24 bays) and RES-B (9 × 15) with cross aisles, about 12 draw calls per module; punching is a bump map, beams lack safety locks and end connectors; aisle-end guards not yet placed on the full modules |
| 3.7 | Rack pick levels (hybrid): levels 1–2 of every bay fitted with bins, carton-flow lanes or hand-stack shelves, each pick face barcoded; pallet reserve above | L | DONE | Any bay shows pick faces below and reserve pallets above; a pick face scans | Built 2026-09-17 (`scene/pickfaces.ts`): 3,012 faces are entities with product, qty, capacity and velocity; fit-out per bay is hand-stack (cut cases + reserve cases), carton flow (3 roller lanes, 120 mm drop, queued cases) or 6 × 18 in hopper bins; face labels on the level-B beam, bay placard moved to the level-C beam; click or focus a face to scan it. Signed off by Lan 2026-09-17 |
| 3.2 | Pallets and loads: GMA pallets, wrapped load variants, cardboard texture, LPN labels | M | POC | No two adjacent loads look identical | Film is a translucent box; needs wrap creases and corner boards |
| 3.3 | Bay inspection: tooltip, inspector with slot grid, pull-pallets action | M | POC | Any bay clickable and pullable | Working |
| 3.4 | Forklifts and reach trucks: detailed models, parked and driving with mast animation | M | DONE | A truck drives an aisle and stops at a bay | Built 2026-09-17 with milestone 9 (`scene/people.ts`): four reach trucks RT-01…04 run putaway loops from staging down a RES-A aisle, stop at a bay, raise the mast, set the pallet and return; two counterbalance forklifts FL-01…02 cycle pallets from an occupied inbound door to staging; drivers seated; inspector shows driver, task, battery, hour meter. Models are proportioned but simple: no tyres tread, hydraulics or decals yet. Signed off by Lan 2026-09-17 |
| 3.5 | Hazmat cage and high-value cage: fenced, gated, signed, own racking and shelving | S | TODO | Both cages labelled and inspectable | New 2026-09-17; placed on the north wall between inbound and returns (HAZ, HV in `src/layout.ts`), agreed 2026-09-17 |
| 3.6 | Replenishment staging: reserve-to-pick pallets staged at the pick module ends | S | TODO | Staged replen pallets carry destination labels | New 2026-09-17 |
| 3.8 | Real product catalogue and real rack contents: every case at its real corrugated dimensions, board grade and pack pattern, holding the product that matches the SKU, on **every** rack module | L | REVIEW | Any pick face shows the real product for its SKU standing in a cut case; reserve levels show sealed cases | Built 2026-09-20/21 (`src/catalog.ts`, `scene/goods.ts`, `scene/rackloads.ts`, `scene/pickgoods.ts`): a 135-SKU catalogue with real case-pack dimensions in metres, form (RSC, shoebox, polybag, tub, roll, tray, drum, mailer, flat), pack pattern (column / interlock / pinwheel / hybrid) and board grade; cases are chamfered convex hulls at 44 tris with a C-flute corrugation normal map and world-metre UVs; load building walks a real pallet pattern per bay; pick faces cut the shipper down and stand the eaches in it. **Rolled out from the RES-B pilot to every rack module 2026-09-21** — with one module on real goods the AISLE camera landed on plain cartons and the hall read as boxes. Measured at the AISLE preset: 11k → 60k triangles, 157 → 277 draw calls, still 60 fps. Eaches are one representative geometry per form scaled per instance, so a form's cap and label are stretched by the same factor as its body. Not yet signed off |
| 3.9 | Luggage and drinkware: real suitcases and bottles as eaches, with their own unit forms and geometry | M | REVIEW | A pick face carrying a suitcase shows a suitcase; a drinkware face shows bottles | Built 2026-09-21: **Luggage** (10 SKUs — carry-on 22 in, hardside 20 in, checked 26 in and 29 in, 2 pc set, duffel, garment bag, underseat tote, ride-on, packing cubes) and **Drinkware** (8 SKUs — insulated 32/24 oz, tumbler 20 oz, travel mug, vacuum flask, kids, glass, brush set). New `suitcase` and `ball` unit forms: the case is a clear-coated polycarbonate clamshell with a proud zip band, four spinner wheels and retracted telescoping handle; luggage draws from a real colour palette (black, silver, navy, oxblood, teal) so a luggage wall reads as luggage, not as uniform cartons. The bottle was rebuilt base-to-closure so the shoulder reads as a bottle rather than a tin. **No beverages**: drinkware is hard goods that ship as eaches, bottled water is grocery and stays out under the catalogue rule — say the word if that rule should change. `UNIT_FORMS` is now declared once in `goods.ts`; it lived in two modules, and adding a form to one of them silently emptied the other's shelves. Verified in-scene by a DOM scan of all 13,343 faces and bins. Not yet signed off |

## 4 Pick module

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 4.1 | Fast-mover shelving module (smaller than first planned): rivet shelving, posts, shelves, dividers, kick plates | M | POC | Rows render instanced at real proportions | FM-1: 16 double rows × 26 units on 1.4 m cart aisles; no dividers or kick plates yet |
| 4.2 | Bins: instanced, 3 size variants, partially filled with product shapes | M | REVIEW | About 10,000 bins in a handful of draw calls | 10,400 bins in FM-1, one size, hollow, 3 draw calls. **Contents rebuilt 2026-09-21**: each bin now holds the eaches of the SKU it actually carries, from the same catalogue the rack faces use, instead of one plain white box — a bin of drinkware holds bottles, a bin of bagged apparel holds pouches. One InstancedMesh per unit form. An oversized each is scaled to fit its bin rather than clipping the steel, which is the standing simplification. Occupancy follows the bin's quantity, so a picked-down bin reads as picked-down. No dividers or kick plates yet, still one bin size |
| 4.3 | Barcode labels: Code 128 encoder, one label per bin, drawn per pixel in the shader from a data texture | L | POC | Label readable; a phone app scans it off the screen | Replaced the bitmap atlas 2026-09-17: 10,400 bin labels + 9,000 LPN labels + 1,506 placards as one data texture each (`scene/labels.ts`), crisp at any distance; phone scan not yet verified |
| 4.4 | Bin inspection: click to scan, location, SKUs, quantities, last stow / pick, velocity | M | POC | Scanning any bin gives correct data | Working |
| 4.5 | Pick carts and totes: carts with tote positions, two tote colours, handheld on cart | S | TODO | Carts in aisles and with pickers | |
| 4.6 | Pick path markings: aisle-end signs with bay ranges, floor arrows | S | TODO | Pick path followable in first person | |
| 4.7 | Pick mezzanine (optional, later): steel mezzanine above the pick module, decking, handrail, stairs, tote lifts, level signage | L | TODO | Walkable on every level in first person | Deferred 2026-09-17: single-level pick agreed; layout keeps room for it |

## 5 Pack, SLAM and manual sort

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 5.1 | Takeaway conveyor: belt and roller sections, rails, legs, photo eyes, motors with conduit | M | DONE | Totes ride it end to end | Built 2026-09-17 (`scene/conveyor.ts`, line data in `layout.ts` CONVEYORS): 168 m 24 in belt at 0.85 m along z 18 in 10 ft sections on H-stands, guard rails, gearmotor drives every 30 m with conduit to a control station, photo eyes every 20 ft, spurs into gift, pack multis, rebin and pack singles; 70 attached-lid totes ride west at 0.6 m/s. Signed off by Lan 2026-09-17 |
| 5.2 | Pack stations: 48 stations with bench, box shelf, tape, dunnage, scale, printer, monitor | M | DONE | Stations inspectable with associate, rate, queue | Built 2026-09-17 (`scene/packing.ts`): PK-01…24 singles, PK-25…48 multis, two rows per zone facing a roller box line that runs to the SLAM zone with packed boxes riding it; each station has bench, carton riser with flats, monitor, keyboard, scale, printer, tape gun, dunnage roll, tote stand, WIP boxes and its number; inspector shows associate, rate vs target, queue, packed today. No people yet (milestone 9). Signed off by Lan 2026-09-17 |
| 5.3 | SLAM line: scanner tunnel, print-and-apply, in-line scale, reject lane | M | DONE | Boxes ride through and get a label | Built 2026-09-17 (`scene/slam.ts`): SLAM line along z 41 then into the sort zone, stations SLAM-1 and SLAM-2 downstream of each pack merge with checkweigh scale, 5-sided scan tunnel, print-and-apply with tamp arm and label roll, verify scanner and beacon, divert to a gravity reject lane; boxes carry a 4 × 6 label after the first labeler; inspector shows rate, labelled, rejects. Signed off by Lan 2026-09-17 |
| 5.4 | Manual carrier sort: sort desks, gaylords and pallets per lane, scan-to-sort screens | M | DONE | Lanes labelled by carrier and inspectable | Built 2026-09-17 (`scene/outbound.ts`): 30 sort positions SORT-01…30 under the SLAM outfeed, one per shipping door, each a gaylord on a pallet with a carrier-coloured lane sign; scan-to-sort desks with screens every five positions; inspector shows boxes sorted, gaylord fill, trailer fill, cut-off. Signed off by Lan 2026-09-17 |
| 5.5 | Rebin / sort walls for multi-item orders: put walls with lit slots, tote induct, order-complete lights | M | DONE | A multi-item order fills a wall slot | Built 2026-09-17 (`scene/rebin.ts`): 8 put walls RB-01…08, 8 × 6 cubbies each with a put-to-light LED, lit cubbies hold units; the takeaway spur inducts at RB-02; inspector shows the cubby grid, orders open and completed. Order flow itself is phase 2. Signed off by Lan 2026-09-17 |
| 5.6 | Gift wrap and special handling stations | S | TODO | Stations inspectable | New 2026-09-17 |

## 6 Outbound transport zone

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 6.1 | Outbound staging lanes per carrier, gaylords, wrapped pallets, stretch wrapper | M | DONE | 30 outbound docks each have a labelled lane | Built 2026-09-17 (`scene/outbound.ts`): STG-01…30 striped 12 ft lanes from sort to the dock floor with painted numbers, carrier signs at the lane head, gaylords and stretch-wrapped pallets staged, turntable stretch wrapper at the west end. Signed off by Lan 2026-09-17 |
| 6.2 | Fluid load: extendable conveyors into open trailers, boxes being loaded | S | TODO | An outbound trailer shows a load in progress | |
| 6.3 | Lane inspection: carrier, cut-off, box count, trailer fill | S | DONE | Any lane clickable | Built with 6.1: sort positions and staging lanes are entities with carrier, door, cut-off, units, fill and state; tooltip and inspector. Signed off by Lan 2026-09-17 |

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
| 9.1 | Human figure: rigged low-poly figure, vest colour by role, badge | L | DONE | Walks in place, looks right at 2 m | Built 2026-09-17 in code (`scene/people.ts`): 1.75 m figure with real segment lengths, 19 instanced parts, skin, shirt, trousers and cap varied per person, class 2 vest coloured by role (orange pickers, sorters, drivers; lime packers, receivers, QC, graders; blue leads) with reflective bands, badge, handheld in the right hand. A scanned or rigged figure can replace the parts without touching behaviour. Signed off by Lan 2026-09-17 |
| 9.2 | Animations: walk, idle, pick, place, pack, scan, drive | M | DONE | Each role has its loop | Built 2026-09-17: procedural walk cycle driven by distance, idle, scan (arm raised, aim line), pick, place, bench work, drive and sit poses on a shared skeleton. Signed off by Lan 2026-09-17 |
| 9.3 | Role behaviours: pickers with carts, packers, receivers, graders, drivers; schedules and breaks | L | DONE | Floor looks staffed and busy in every zone | Built 2026-09-17: 60 on shift. 18 pickers walk aisles in RES-A and FM-1 with carts, stop at faces to scan and pick, drop totes on the takeaway belt; 16 packers, 8 receivers and 2 QC at their stations; 4 sorters scan-to-sort along the outfeed; 2 graders; 2 leads walk the floor; 6 drivers; 2 pickers on break. Loops are scripted; phase 2 makes them follow orders. Flow mode switch (2026-09-17): conveyor or walk-to-drop, pickers re-plan their loop on switch; FOLLOW ORDER traces either. Signed off by Lan 2026-09-17 |
| 9.4 | Person inspection: name, role, task, rate, time on shift | S | DONE | Any person clickable | Built 2026-09-17: hit volumes follow every person and truck; inspector shows badge, zone, station, live task, rate vs role target, units today, time on shift. Signed off by Lan 2026-09-17 |
| 9.5 | Handheld scanners in people's hands: real RF device model (Zebra TC-series / MC9300 style), holstered when walking, raised at a pick face with a red aim line and beep; each scan emits an event and updates the location (ties to 13.4) | M | DONE | Watch a picker scan a label and see the scan appear in the stream and on the bin | Built 2026-09-17: handheld in hand, raised at the face with a red aim line to its label; each scan logs an RF event, decrements the face quantity (live in the inspector if selected) and beeps within 25 m of the camera. Device is a plain block, not yet a modelled TC-series. Signed off by Lan 2026-09-17 |

## 10 Navigation

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 10.1 | Bird's-eye: orthographic plan, pan and zoom, labels legible, click to inspect or dive | M | POC | Whole FC readable at a glance | Works for the slice; roof hides in plan |
| 10.2 | First person: eye height, arrows and WASD, mouse look, jog, collision | M | POC | Walk the whole pick path without clipping | Working; collision is box-based |
| 10.3 | Mini-map in first person with position and heading | S | TODO | Dot tracks the walker | |
| 10.4 | Presets and guided tour of the inbound-to-outbound route | S | DONE | Tour completes without collision | Built 2026-09-17: TOUR button flies 44 stops from the inbound docks through every area in process order, then returns and support, selecting each in the inspector with a caption; prev / next / end, Esc ends; `#tour=N` deep link (`src/tour.ts`). Signed off by Lan 2026-09-17 |
| 10.5 | Arrow traversal in every mode: arrows walk in first person, move the orbit camera along the floor, pan the plan view; on-screen arrow pad for mouse and touch | S | POC | Arrows move you in all three modes | Arrows work in first person only |

## 11 Console

| ID | Task | Size | Status | Done when | Notes |
|---|---|---|---|---|---|
| 11.1 | Console shell: top bar, layer nav, KPI tiles, inspector, event stream, camera bar, stats | M | POC | Layout matches the reference structure | Working |
| 11.2 | Layers: Overview, Inventory, Flow, Labor, Safety recolouring | M | DONE | Switching layers recolours the scene | Built 2026-09-17 (`scene/layers.ts` plus `setLayer` on racking, shelving and conveyors): Inventory tints reserve cases by bay fill and bins by velocity; Flow colours zone slabs by process stage and lights every conveyor; Labor colours zones by live headcount and marks each associate green, amber or red against their rate target; Safety marks forklift areas red, walkways green, 3 m clearance rings on trucks, pickers in truck aisles amber. Keys 1–5, `#layer=` deep link. Signed off by Lan 2026-09-17 |
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
