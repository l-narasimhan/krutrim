# Krutrim — Fulfillment Center Digital Twin

Decisions, the realism standard and the process flow. Progress is tracked task by task in [TASKS.md](TASKS.md).
Nothing gets built until a task is picked from that list and approved.

## Decisions (agreed 2026-09-16)

| Topic | Decision |
|---|---|
| Reference | Joey (@aijoey) Datacenter Digital Twin, Phase 2 — dense Three.js scene inside a spatial-ops console |
| Visual bar | Very real: PBR materials, real dimensions, shadows, emissive lights, dense detail |
| Building | **Large regional:** about 250 × 180 m (45,000 m², 480k sq ft), about 60 dock doors, single-level pick module laid out so a mezzanine can be added above it later. Agreed 2026-09-17. |
| FC type | E-commerce sortable, **manual** operation: cart picking, hand sort, no loop sorter, no AMRs |
| Picking | **Hybrid racks (agreed 2026-09-17):** picking happens in the pallet racking. Levels 1–2 of every bay are pick levels fitted with bins, carton-flow or hand-stack shelves; levels above are pallet reserve for the same SKUs, replenished by dropping a pallet down. A smaller dedicated shelving module holds the fastest-moving small items: **FM-1, 40 × 20 m, about 10,400 bins (halved, agreed 2026-09-17).** |
| Bins | Every pick bin gets a unique, real Code 128 barcode label, legible in first person |
| Product catalogue | **Real goods, not placeholder shapes (2026-09-21):** the twin carries a real 135-SKU catalogue across household, drinkware, electronics, apparel, health & beauty, baby, pet, toys, sporting, luggage, tools and office. Every entry is a real product category in its real shipping case, at its real case-pack dimensions in metres, with its board grade and pack pattern. Reserve levels hold **sealed cases** — that is what a rack actually stores — and the individual product is only visible at a **pick face**, where the shipper is cut down and the eaches stand loose on the shelf. This applies to **every** rack module, not one pilot. |
| Catalogue rule | **No grocery: no food, beverage or consumable categories.** Drinkware (reusable bottles, tumblers, flasks) and luggage are in, because both are hard goods that ship as eaches in a retail carton; bottled water, coffee pods and dog food are out. Note `PRODUCTS` in `src/facility.ts` is a pre-3.8 leftover list that still names grocery items and should be retired. |
| People | Human associates modelled and animated (pickers, packers, receivers, graders, forklift operators) |
| Returns | Customer returns processing area (receive, grade, restock or liquidate) |
| Views | Bird's-eye orthographic plan view + first-person walk. **Arrow keys traverse in every mode** (walk, orbit, plan) and on-screen arrow buttons do the same for mouse and touch. |
| Stack | Vite + TypeScript + plain Three.js, HTML/CSS console, 1 unit = 1 metre |
| Data | Simulated first; live-data adapter is a later phase |
| Flow mode | **Two selectable flows (agreed 2026-09-17):** conveyor, the default, where pickers induct totes on the takeaway belt; and walk-to-drop, as smaller manual FCs run, where pickers carry finished totes around the storage block to a pack drop point and packers collect them. The belt stays in place in both. |
| Docks | **Flow-through (agreed 2026-09-17):** 26 inbound, 4 returns and 2 waste doors on the north wall; 30 outbound doors on the south wall. 62 doors total. |
| Carriers | **Outbound lanes OB-01…30, west to east (agreed 2026-09-17):** UPS 10, FedEx 8, USPS 6, regional and LTL 6. |
| Shift | **60 associates on the floor at once (agreed 2026-09-17)**, across pick, pack, receive, returns and forklifts. |
| Cages | **Hazmat and high-value cages on the north wall between inbound and returns (agreed 2026-09-17).** |

## Realism standard (hard rule)

Nothing unreal ships. Every object in the scene must be something that exists in a real fulfillment center, at its real size, built the way the real thing is built. Concretely:

1. **Real reference for every object.** Before modelling any item (a rack upright, a dock leveler, a pack bench, a bin label), pick a real product or standard and note its dimensions in the task. No invented shapes.
2. **Real dimensions.** 1 unit = 1 metre. Rack bays, beam levels, aisle widths, dock door sizes, trailer length, conveyor height, bin sizes, label sizes all match industry standards or a named product.
3. **Real materials.** Painted steel, galvanised steel, sealed concrete, corrugated cardboard, HDPE totes, stretch film, vinyl floor tape. PBR with roughness and metalness set from how the real material looks, plus wear where the real thing wears.
4. **Real conventions.** Location IDs, dock numbering, carrier names, floor markings, signage colours, hi-vis vest colours follow what real FCs use.
5. **No placeholder geometry in a finished task.** A task is not done while any plain untextured box stands in for a real object.
6. **Realism check per task.** Each task ends with a side-by-side against a real photo of the same thing before it is marked done.
7. **The reference bar.** If it would not pass in Joey's datacenter twin, it does not pass here.

## Assumptions to confirm

- Conveyors still exist where a manual FC would have them: a takeaway belt from pick to pack, and a SLAM line from pack to shipping. Sorting to carrier is done by hand into gaylords and pallets.
- Forklifts and pallet jacks are human-driven (no autonomous vehicles).
- Facility, people and SKUs are fictional but plausible. Names, carriers and location IDs follow real conventions.

## Proof of concept (2026-09-16) and full hall (2026-09-17)

A 60 × 40 m slice was built first (`docs/poc/`). On 2026-09-17 the plan was approved and the whole hall was
generated from `src/layout.ts` (`docs/hall/`): 62 docks with trailers, reserve racking A and B, the fast-mover
module, every zone painted and inspectable. First-pass coverage: 0.1–0.4, parts of 1.1–1.5, 2.1, 2.2, 3.1–3.3,
4.1–4.4, 10.1, 10.2, 11.1, 11.3, 11.4, 11.5. None of those tasks is marked done yet: each still needs its
realism check against a real photo. Known gaps: procedural (not photo) textures on steel and paint, no ambient
occlusion or bloom, and eaches are one representative geometry per form scaled per instance, so a form's cap
and label stretch by the same factor as its body.

Since that pass: people and trucks (milestone 9, 3.4), the conveyor and pack-to-ship band (milestone 5, 6.1,
6.3), equipment (rolling ladders), and the real product catalogue (3.8, 3.9, 4.2 contents). The 2026-09-21
change worth recording is that **the hall used to read as boxes**: real goods existed in the RES-B pilot only,
so the AISLE and PICK camera presets — RES-A and FM-1 — both landed on plain cartons, and FM-1's 10,400 bins
each held a single white block. Real goods now cover every rack module and every shelf bin.

## Phases

| Phase | What it delivers | Tracker milestones |
|---|---|---|
| **1 — The building, fully real** | The whole large-regional hall with every area in the program, all equipment at real dimensions, people at work, all navigation, the full console with layers, barcode scanning, polish and deployment. Motion is scripted loops (people walking pick paths, forklifts driving, doors, trailers). Metrics are simulated. | 0 – 13 (all 76 tasks) |
| **2 — Order flow** | A real simulation: trailers arrive and unload, QC pass or reject, putaway, pick waves, rebin, pack, SLAM, carrier sort, outbound, returns. Every KPI, event and inspector number derives from the sim. People and vehicles follow the work instead of loops. | new milestones 14 – 16 |
| **3 — Live twin** | Adapter so the scene renders from a real feed (WMS export, MQTT, REST) instead of the sim. Replay, heatmaps, alerting rules, scan-driven updates from real scanners. | new milestones 17 – 18 |

## Area program (agreed 2026-09-17: the FC must be big and have every real area)

Inbound → storage → outbound, with QC, putaway and support areas modelled as real zones, each labelled and inspectable.

| Group | Areas |
|---|---|
| Yard | Gate house and guard shack, trailer parking rows, yard tractor spotting trailers, associate parking, security entrance with turnstiles |
| Inbound | Inbound docks with trailer unloading (forklift and pallet jack for palletised loads, extendable conveyor and unloaders for floor-loaded cartons), receive and decant stations, **QA/QC inspection at receive**, **QC reject / damage / hold cage** (quarantine, vendor return), **putaway staging** (pallets and totes staged by destination), putaway buffer conveyor to the pick module, non-conveyable (NC) receive |
| Storage | Reserve pallet racking modules, pick module on a multi-level mezzanine, replenishment staging, hazmat cage, high-value cage |
| Outbound | Pick (cart to tote), rebin / sort walls for multi-item orders, pack singles, pack multis, gift wrap, SLAM, manual carrier sort, outbound staging lanes, outbound docks, carrier pickup lanes |
| Returns | Returns receive, grading benches, refurbish bench, liquidation staging, disposal and recycling |
| Support | ICQA, problem solve, damageland, packaging supplies, cardboard baler and recycling, battery charging room, dock offices, maintenance shop and RME, break rooms and cafeteria, offices and training rooms, restrooms |

## Process flow the twin represents

Inbound dock → Receive and decant → QC inspection (pass → putaway staging · fail → QC reject cage) →
Putaway: stow to bins (pick module) or reach-truck putaway to reserve racking → Replenishment reserve → pick →
Cart pick to tote → Takeaway conveyor → Rebin (multi-item) → Pack → SLAM (scan, label, apply, manifest) →
Manual carrier sort → Outbound staging lanes → Outbound dock → Trailer.
Side flows: Returns dock → Grading → Restock to bins, refurbish, liquidation, or disposal.
Damaged in process → Damageland → Problem solve → ICQA adjustment.

---

## Tasks

The task list and its status live in [TASKS.md](TASKS.md).

## Open questions

- Performance on a laptop GPU with the full hall (about 6 M triangles in the overview): measure in 12.3 and add LOD if needed.
