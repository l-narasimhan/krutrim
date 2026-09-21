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

## The workforce layer — pickers and packers as agents

Today every associate runs a fixed script forever. That has to become an **agent**: something that perceives,
decides and acts the way a person does.

This matters more than it sounds, because **humans are where all the variance in an FC comes from**. A model
that runs at a benchmark rate simulates an average that does not exist. Real throughput is a distribution, and
every useful workforce question lives inside that distribution.

**An agent is five things:**

1. **Bounded perception** — it knows its task, its cart, what is in front of it. *Not* the global state. This
   is what makes information a variable you can improve, rather than a given.
2. **Policy** — how it decides: batching, pick sequence, when to ask for help, whether to follow the SOP.
3. **Traits** — persistent per badge: base speed, accuracy, experience, ramp state, fatigue curve. So A-07 is
   reliably your fast picker, across runs.
4. **State** — fatigue, break need, cart fill, position.
5. **Actions** — walk, scan, pick, place, shortcut, escalate.

**The ladder — do not build the top first:**

| Level | What it is | What it unlocks |
|---|---|---|
| L1 | Scripted loop *(today)* | Nothing. It is animation. |
| L2 | **State-driven** — takes real work from the sim, travels the travel graph | Correct flows |
| L3 | **Trait-driven** — per-associate rates, accuracy, fatigue, ramp | **Most workforce questions** |
| L4 | **Cognitive** — chooses *how* to work, not just what | **Policy problems** |
| L5 | **Learned** — policy fitted to your real pick transactions | Simulates *your* people |

**Why L4 is worth reaching.** "We're three pickers down at 14:20 — do we make the cutoff?"

- L3 answers: *"No. Fourteen minutes short."*
- L4 answers: *"No — but the miss is not capacity. The SOP says batch six totes; your fast pickers batch
  twelve. Change the batch rule and you make it by nine minutes."*

L3 finds capacity problems. **L4 finds policy problems** — which is where the money usually is, and which no
dashboard can find.

**Two cautions.**

- **Do not over-build.** A distribution of rates (L3) captures most of the value. Full cognitive agents are
  only worth their cost for policy questions. Sequence it.
- **Frame it as capacity, not surveillance.** A "digital twin of your workforce" reads as monitoring
  individuals. Keep traits statistical and aggregate, at badge level not person level. This is the single most
  likely way for the project to be killed politically, and it costs nothing to avoid.

Two consequences beyond labour planning:

- **It makes fork-from-live real.** You fork with *these* people, at *this* fatigue, at 14:20 — not with an
  abstract resource pool.
- **It makes automation ROI computable.** You cannot claim an AMR beats a human until you can simulate the
  human. The agent layer is the baseline every automation business case is measured against.

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
