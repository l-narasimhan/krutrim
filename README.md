# Fulcrum Twin — fulfillment center digital twin

A real-time 3D digital twin of an e-commerce fulfillment center, built as a plain Three.js app inside a
spatial-ops console. 1 unit = 1 metre; every object is a real product at its real dimensions.

**Status: full hall, first pass.** The whole 800 × 600 ft building is generated from the approved layout in
`src/layout.ts`. The build plan is in [PLAN.md](PLAN.md), progress in [TASKS.md](TASKS.md).

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
