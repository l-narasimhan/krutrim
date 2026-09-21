# Krutrim — Vision

**Krutrim becomes the operating model of the supply chain: a validated, live, predictive twin that moves
from *showing* the network to *running* it.**

Today it shows a real fulfillment centre. That is rung one of six. The end goal — AI transformation, an
autonomous supply chain — is rung six, and every rung needs the one below it.

---

## The ladder

| # | Rung | Question it answers | State |
|---|---|---|---|
| 1 | **Visual twin** — real geometry, real dimensions, real conventions | What does it look like? | Built |
| 2 | **Simulated twin** — deterministic engine, calibrated rates, order flow | What happens if…? | Planned (milestones 14–16) |
| 3 | **Live twin** — feed from WMS / scanners / conveyors; fork from *now* | What is happening right now? | Planned (milestone 18) |
| 4 | **Predictive twin** — forecast demand, labour, congestion, exceptions | What will happen? | — |
| 5 | **Prescriptive twin** — ranked actions, expected value, error bars | What should we do? | — |
| 6 | **Autonomous twin** — bounded write-back, human on the exception | Do it. | — |

**The pivotal design decision:** rungs 2 and 3 must be *one engine*, not two products. "What if" from an empty
building is a study. "What if" from 14:20 with the carrier cutoff at 16:00 is an operating decision. Only the
second one is a twin, and only the second one earns its keep.

---

## The credibility gate

Autonomy is earned, not built. Four things must be true before the twin may *recommend*, and truer before it
may *act*:

1. **Real** — real dimensions, real conventions, real products. *Done.*
2. **Validated** — every rate named, cited and tunable; simulated output checked against real operations, with
   error bars, on named KPIs.
3. **Grounded** — running on a live feed, with reconciliation and a drift report that is allowed to say
   "I am wrong".
4. **Accountable** — every recommendation traceable to its inputs and assumptions; every action audited.

Skip 2 and you have a plausible cartoon. Skip 3 and you are optimising a fiction — confidently.

---

## Steps

| Step | Gate to pass before moving on |
|---|---|
| 1. **Finish the visual twin** — realism passes | It reads as a real building to someone who works in one |
| 2. **Build the sim core** — clock, scheduler, process graph, engineered standards | Deterministic, replayable, fingerprint-stable |
| 3. **Validate** — reconcile 3 named KPIs against real operations | Within a stated tolerance, or the model is fixed |
| 4. **Go live** — ingest a real feed, fork-from-live, drift report | Feed health visible; divergence measured, not hidden |
| 5. **Predict** — forecast from twin state + the event journal | Beats the naive baseline out of sample |
| 6. **Recommend, then act** — ranked actions, human-approved first | Recommendation hit rate tracked; only then bounded write-back |

---

## The flywheel — where the AI actually comes from

The twin is not only a model. It is a **data factory**:

- The sim generates labelled scenarios that do not exist in history — peak, breakdown, reconfiguration,
  the counterfactual you would never dare run on the real network.
- Live operation supplies ground truth to score those scenarios against.
- The event journal supplies structured training data with causality already attached.

Models trained on the twin get deployed, and their decisions return as new data. **That compounding loop — not
any single model — is the AI transformation.** It is also the reason the journal and determinism in the sim
core are not plumbing: they are the training set.

---

## Non-goals

- No write-back before validation.
- No autonomy without an audit trail and a human on the exception.
- No general-purpose simulation product. One network, validated, until told otherwise.

---

## Decisions needed

1. Is there a **real feed** to target — a named WMS/WES, or aspirational?
2. Who creates scenarios — **you, a planning team, or customers?**
3. **Design-time or operational** emphasis first?
