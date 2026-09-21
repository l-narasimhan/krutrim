# Krutrim — Simulation POC (Ops)

One simulation, one question, shown to an Ops audience. It is a **vertical slice through the real layers** —
not a throwaway demo. Every task below is either a real ID from [SIM-PLAN.md](SIM-PLAN.md) or a new UI task
that the plan was missing.

Question it answers: **"It's 14:20 — do we make the 16:00 carrier cutoffs?"**

---

## 1. The demo

Six beats, about three minutes.

| # | What happens | What it proves |
|---|---|---|
| 1 | Open the twin. **14:20.** 1,240 open orders, 18 pickers on the floor, three carriers with 16:00 cutoffs | The twin holds real operating state |
| 2 | Ask: **"Do we make the 16:00 cutoffs?"** | A question, not a dashboard |
| 3 | It **runs forward** — pickers move, totes flow, clock runs to 16:00 | The engine, playing out in the space |
| 4 | **"No. UPS misses by 14 minutes."** | An answer, in 30 seconds |
| 5 | **Show your work:** 18 pickers at 158 UPH — *your* last 30 days, not the WERC benchmark. If the FM-1 replen lands after 15:10 it becomes a 26-minute miss | The reasoning, and the flip condition |
| 6 | **Move four pickers from inbound to pick → re-run → "You make it, by 9 minutes."** | An intervention, quantified |

Beat 6 is the one that sells it to Ops: not *"here is a number"*, but *"here is the lever, and here is what it
buys you."*

---

## 2. Data — synthetic, but StarRocks-shaped

StarRocks access is not available yet, so the POC runs on **generated data**. The discipline that keeps this
from becoming a rewrite:

- **Generate into the StarRocks shape.** Same table names, same column names, same ID formats, same units.
  Swapping to real data later is a connection change, not a mapping rewrite.
- **Write it out as a fixture file**, not generated in-memory at runtime. The fixture is the regression input
  for the whole of phase 2, and it is what milestone 18.3 tests against.
- **Calibrate to plausible numbers** — the rates in [SIM-PLAN.md](SIM-PLAN.md) §4.7 already cite WERC and
  e-commerce benchmarks. Use those, not invented round numbers.
- **Say so in the room.** An Ops audience knows their own volumes; a demo that pretends to be their data
  loses the room the moment someone recognises a number. The honest framing is *"the engine, on
  representative data — your feed plugs in here"*, and pointing at the adapter seam.

**The one thing worth chasing anyway:** even a small manual export — 200 rows of open orders, current bin
quantities, carrier cutoff times — is worth more than any amount of synthetic data, because it settles the
open question from decision 1: **does StarRocks carry the twin's location IDs?** That answer shapes 18.3
either way.

---

## 3. Tasks

Slice of the real plan. Sizes as in SIM-PLAN.

### Engine (milestone 14)

| ID | Task | Size |
|---|---|---|
| 14.1 | Sim package skeleton: `src/sim/engine/`, no `three`/DOM imports, lint rule enforcing it | S |
| 14.2 | Clock and event queue: integer-ms time, `(time, priority, seq)` ordering, run/pause/step | M |
| 14.3 | Named RNG forks over `src/rng.ts`, stream positions serialisable | S |
| 14.5 | Activity engine: start/end intervals the view can interpolate | M |
| 14.7 | Canonical event schema v1 + JSONL journal writer | M |
| 14.10 | Headless runner — partial: enough to run one scenario and write its journal | M |

### Flow (milestone 15) — outbound only

| ID | Task | Size |
|---|---|---|
| 15.1 | Flow units — partial: order, tote, carton, parcel | M |
| 15.4 | Demand model — partial: an order file with carrier mix and cutoffs | M |
| 15.6 | Outbound — partial: pick → pack → sort → stage → cutoff. No rebin, no SLAM detail | L |
| 15.8 | Standards library: every rate cited in one file, editable, shown in the UI | M |
| 15.9 | Work assignment — partial: task queues and a simple dispatch rule | L |
| 15.10 | **Scene repaint path**: diff sim state → scene, on change only | L |
| 15.11 | Scene migration — partial: `people` and `packing` read from the sim, not their loops | L |

### Metrics (milestone 16) — three numbers only

| ID | Task | Size |
|---|---|---|
| 16.1 | KPI tree — partial: on-time %, cutoff risk, units/hr | L |
| 16.8 | Switch off the fabricated surfaces: synthetic event generator, random-walk KPIs | S |

### What-if (milestone 17)

| ID | Task | Size |
|---|---|---|
| 17.1 | Scenario schema + baseline/delta resolution | M |
| 17.4 | Background execution: Web Worker so the UI never blocks on a run | M |
| 17.5 | Scenario panel — partial: **one lever**, picker headcount | L |
| 17.9 | Fork from snapshot → branch → short-horizon run | L |

### Console — **new tasks, missing from SIM-PLAN**

The plan has no console tasks for the sim. These are the surfaces that make it operable, and they are what
makes the demo a demo.

| ID | Task | Size |
|---|---|---|
| 20.1 | **Mode toggle `LIVE ⇄ SCENARIO`**, with a visual frame change so a scenario can never be mistaken for reality | S |
| 20.2 | **Time bar**: sim clock, run/pause/step, speed, fork marker | M |
| 20.3 | **ASK**: preset questions for Ops ("Do we make the cutoffs?", "What if I move N pickers?") | M |
| 20.4 | **Answer panel**: verdict, assumptions with sources, the flip condition | M |
| 20.5 | **Intervention control**: headcount slider on a zone, then re-run | M |

**Total: 27 tasks** — 22 sliced from the plan, 5 new console tasks.

---

## 4. Acceptance

The POC is done when, on a laptop, with no live integration:

1. The demo runs end to end in under three minutes
2. The same scenario run twice produces **byte-identical journals** (determinism holds)
3. The answer names its assumptions, and each one cites a source
4. Moving the headcount lever changes the answer, and the delta is explained
5. `src/sim/engine/` imports no `three` and no DOM — the lint rule passes

Point 2 is the one not to skip. Without determinism the demo becomes unreproducible, and *"can you run that
again?"* is the second question anyone asks.

---

## 5. Deliberately not in the POC

Inbound, returns, rebin, SLAM detail, the full travel graph with congestion, cognitive (L4) agents, the cost
model, multi-site, prediction, and the StarRocks integration itself.

Each is in the plan and each is deferred on purpose. **The POC's job is to be credible, not complete.**

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| **Synthetic data loses the room** — an Ops audience spots numbers that are not theirs | Say it up front, point at the adapter seam, and get even 200 real rows if you can |
| **The slice drifts into a prototype** — throwaway shortcuts in the sim because it is "just a demo" | Build through the real layers (14.1 first) so the slice *is* milestones 14–15 progress |
| **Scene repaint (15.10) is underestimated** — it is the task that makes the sim visible, and it is the hardest | It is on the critical path; do not leave it until last |
| **Demo works, engine does not generalise** — one hard-coded scenario path | The scenario schema (17.1) exists from the start, even with one lever |
