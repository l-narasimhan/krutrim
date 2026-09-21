# Krutrim — fulfillment center digital twin

A real-time 3D digital twin of an e-commerce fulfillment center, built as a plain Three.js app inside a
spatial-ops console. 1 unit = 1 metre; every object is a real product at its real dimensions.

**Status: full hall, first pass.** The whole 800 × 600 ft building is generated from the approved layout in
`src/layout.ts`. The build plan is in [PLAN.md](PLAN.md), progress in [TASKS.md](TASKS.md).

## Status

As of 2026-09-17: 22 done, 0 built and in review, 25 first-pass (not yet held to the realism bar), 33 not started, out of 80 tasks. Full detail per task in [TASKS.md](TASKS.md).

✅ done · 🟡 built, in review · 🔵 first pass exists · ⬜ not started

**0 Foundations**  
🔵 0.1 App shell<br>✅ 0.2 Facility data model<br>🔵 0.3 Renderer and lighting rig<br>🔵 0.4 Camera system

**1 Building shell and yard**  
🔵 1.1 Floor<br>🔵 1.2 Walls, columns, roof structure<br>🔵 1.3 High-bay lighting<br>🔵 1.4 Overhead services<br>🔵 1.5 Floor markings<br>⬜ 1.6 Signage<br>⬜ 1.7 Truck yard<br>⬜ 1.8 Yard moves

**2 Inbound**  
🔵 2.1 Dock doors<br>🔵 2.2 Trailers and tractors<br>✅ 2.3 Receive stations<br>✅ 2.4 Inbound staging<br>✅ 2.5 QA/QC inspection at receive<br>✅ 2.6 QC reject / damage / hold cage<br>✅ 2.7 Putaway staging<br>⬜ 2.8 Non-conveyable (NC) receive and storage<br>⬜ 2.9 Dock unloading in motion

**3 Reserve storage and rack picking**  
🔵 3.1 Racking structure<br>✅ 3.7 Rack pick levels (hybrid)<br>🔵 3.2 Pallets and loads<br>🔵 3.3 Bay inspection<br>✅ 3.4 Forklifts and reach trucks<br>⬜ 3.5 Hazmat cage and high-value cage<br>⬜ 3.6 Replenishment staging

**4 Pick module**  
🔵 4.1 Fast-mover shelving module (smaller than first planned)<br>🔵 4.2 Bins<br>🔵 4.3 Barcode labels<br>🔵 4.4 Bin inspection<br>⬜ 4.5 Pick carts and totes<br>⬜ 4.6 Pick path markings<br>⬜ 4.7 Pick mezzanine (optional, later)

**5 Pack, SLAM, manual sort**  
✅ 5.1 Takeaway conveyor<br>✅ 5.2 Pack stations<br>✅ 5.3 SLAM line<br>✅ 5.4 Manual carrier sort<br>✅ 5.5 Rebin / sort walls for multi-item orders<br>⬜ 5.6 Gift wrap and special handling stations

**6 Outbound**  
✅ 6.1 Outbound staging lanes per carrier, gaylords, wrapped pallets, stretch wrapper<br>⬜ 6.2 Fluid load<br>✅ 6.3 Lane inspection

**7 Returns**  
⬜ 7.1 Returns receive<br>⬜ 7.2 Grading benches<br>⬜ 7.3 Returns outputs<br>⬜ 7.4 Refurbish bench, liquidation staging, disposal and recycling

**8 Supporting areas**  
⬜ 8.1 Problem-solve and ICQA desks<br>⬜ 8.2 Packaging supplies racks, battery charging room, dock office<br>⬜ 8.3 Mezzanine with offices and break room, restrooms, stairs<br>⬜ 8.4 Fire equipment, first-aid, eyewash, spill kits<br>⬜ 8.5 Damageland and problem-solve cage with hold shelving<br>⬜ 8.6 Cardboard baler and recycling area, waste compactor at a dock<br>⬜ 8.7 Maintenance shop and RME, forklift battery and charging room with chargers<br>⬜ 8.8 Cafeteria, break rooms, training rooms, offices, restrooms on a mezzanine<br>⬜ 8.9 Security entrance

**9 People**  
✅ 9.1 Human figure<br>✅ 9.2 Animations<br>✅ 9.3 Role behaviours<br>✅ 9.4 Person inspection<br>✅ 9.5 Handheld scanners in people's hands

**10 Navigation**  
🔵 10.1 Bird's-eye<br>🔵 10.2 First person<br>⬜ 10.3 Mini-map in first person with position and heading<br>✅ 10.4 Presets and guided tour of the inbound-to-outbound route<br>🔵 10.5 Arrow traversal in every mode

**11 Console**  
🔵 11.1 Console shell<br>✅ 11.2 Layers<br>🔵 11.3 Event stream<br>🔵 11.4 Inspector<br>🔵 11.5 Focus and search by location ID or name

**12 Polish, performance, delivery**  
⬜ 12.1 Baked ambient occlusion and contact shadows<br>⬜ 12.2 Post-processing<br>⬜ 12.3 Performance budget<br>⬜ 12.4 Deploy to Vercel, README with screenshots and a recorded walkthrough

**13 Barcode scanning**  
🔵 13.1 In-twin handheld<br>⬜ 13.2 Hardware scanner input<br>⬜ 13.3 Camera scanning<br>⬜ 13.4 Scan-driven data

**Beyond phase 1:** the order-flow simulation (phase 2) that drives people and trucks from real orders, and the live-data adapter (phase 3). The FOLLOW ORDER trace and the two flow modes are a first taste of phase 2.

## Run

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # type-check + production bundle in dist/
npm run plan       # render the labelled hall plan (docs/plan/) from src/layout.ts
```

## What is built

- **Layout.** `src/layout.ts` holds every area, dock door, storage module and yard element in metres.
  `npm run plan` renders it as a labelled plan (`docs/plan/`); `buildFacility()` generates every entity from it.
- **Building shell.** 800 × 600 ft hall on a 50 ft column grid: sealed concrete floor with saw-cut joints,
  insulated metal panel walls with 62 door openings, W10 columns, joist girders and bar joists, painted roof deck,
  960 LED high-bays, sprinkler mains and branch lines, cable tray on both dock walls, every zone outlined and
  named on the floor, every aisle numbered at both ends, hazard hatching at every door.
- **Reserve racking, hybrid pick.** RES-A (25 double rows × 24 bays) and RES-B (9 × 15), 1,470 bays of
  42" teardrop frames, 24' uprights, 108" step beams, wire decking. Levels A–B are 2,940 pick faces, each fitted
  as hand-stack cut cases, three carton-flow roller lanes, or six 18 in hopper bins, with its own scannable label;
  levels C–E hold about 9,000 GMA pallets with case loads and LPN labels.
- **Fast-mover module FM-1.** 16 double rows of rivet shelving on 1.4 m cart aisles with 10,400 hopper-front
  bins. Every bin, pallet and bay carries a real Code 128 label drawn per pixel in the shader.
- **Docks.** 62 doors (26 inbound, 4 returns, 2 waste, 30 outbound with carrier lanes), each with sectional
  door, leveler, bumpers, seal, dock light, restraint and number plate; 42 doors have a 53 ft dry van whose
  cargo tracks its load or unload progress.
- **Inbound band.** Striped staging lanes behind every inbound door with pallets and pallet jacks, 16 receive and
  decant stations, six QC benches with pass and fail lanes, a chain-link hold cage, putaway staging positions by
  destination, and a buffer conveyor carrying totes to the fast-mover module.
- **Takeaway conveyor and pack.** 168 m of 24 in belt conveyor along the south edge of storage with spurs into
  each pack zone; totes ride it continuously. 48 pack stations in two rows per pack zone, fully equipped and
  inspectable, with roller box lines carrying packed boxes to two SLAM stations (scale, scan tunnel,
  print-and-apply, reject lane) and on to 30 manual carrier sort positions with gaylords and scan desks.
  Eight put-to-light walls in rebin. 30 striped staging lanes behind the outbound doors with gaylords, wrapped
  pallets and a stretch wrapper.
- **People and trucks.** 60 associates on shift in role-coloured vests: pickers with carts walking the aisles,
  scanning faces with a red aim line and beep, picking and dropping totes on the takeaway belt; packers, receivers,
  QC, sorters, graders and leads at work; four reach trucks doing putaway and two forklifts unloading. Every person
  and truck is inspectable.
- **Layers.** Inventory (cases by fill, bins by velocity), Flow (zones by stage, conveyors lit), Labor (zones by
  headcount, every associate marked against target) and Safety (forklift areas, walkways, clearance rings). Keys 1 to 5.
- **Console.** KPI tiles, live event stream, inspector for bays, bins, docks and zones, focus search by
  location ID, fps / draw call / triangle stats.

Location IDs: `RA-07-012` rack bay (module, aisle, bay; odd bays west of the aisle), `RA-07-012-C1` pallet slot,
`RA-07-012-A` pick face, `FM-03-018-C05` bin (module, aisle, bay, shelf, position), `OB-15` dock door, `SLAM` zone.

## Controls

| Action | How |
|---|---|
| Orbit | drag · scroll · right-drag to pan |
| Camera presets | ORBIT · AISLE · PICK · DOCK · PLAN · WALK · RESET buttons, or `O` / `P` keys |
| Guided tour | TOUR: 44 stops from the inbound docks through every area, PREV / NEXT / END TOUR, `Esc` ends |
| Bird's-eye | PLAN (orthographic, drag to pan, scroll to zoom) |
| First person | WALK, then `W A S D` or arrows, mouse to look, `Shift` to jog, `Esc` to release the mouse |
| Inspect | hover for a readout, click to open the inspector |
| Fly to selection | `F`, or FLY TO in the inspector |
| Walk to selection | WALK TO in the inspector |
| Pull pallets out of a bay | PULL PALLETS (select a bay first) |
| Open / close the dock door | OPEN DOOR / CLOSE DOOR |
| Deep links | `#view=aisle`, `#select=FM-03-018-C05&fly`, `#walk=x,z,yaw`, `#select=RA-07-012&pull`, `#select=OB-15&door=0`, `#tour=12` |

## Assets

CC0 textures and HDRI from [Poly Haven](https://polyhaven.com) (`concrete_floor_02`, `empty_warehouse_01`)
and [ambientCG](https://ambientcg.com) (`Cardboard004`). Everything else is generated in code.

## Screenshots

Full hall in `docs/hall/`, the original slice in `docs/poc/`.
