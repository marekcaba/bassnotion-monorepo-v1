# Bass Coach v2 — Stored Reference Analysis + Adaptive Player Detection

**Status:** Design (decided 2026-06-20, live-testing drove it). Supersedes the live-re-detect
reference approach in [BASS_COACH_BUILD_PLAN.md](./BASS_COACH_BUILD_PLAN.md) §5. The grid mirror and
the reference *pipeline* (capture → onset → align → grade) are PROVEN; this changes WHERE the
reference comes from and HOW the player is detected.

## Why this redesign (the live-test findings)

Spike testing on a real Clarett take surfaced the limit of slider-tuned detection:
- Grid mode: robust ("Solid pocket / 28ms / 35-of-35", clean) — snaps each note to its nearest grid
  slot INDEPENDENTLY, so a phantom/missed note only affects itself.
- Reference mode on the SAME take: "Work the timing / 63ms / 78% coverage (29 hit, 8 missed, 6
  extra)". The reference matcher aligns TWO real sequences, so a phantom or missed player onset
  doesn't just affect itself — it mis-claims a slot and CASCADES into false missed/extra, inflating
  the spread. **Reference mode demands cleaner player-onset detection than grid mode tolerates.**
- A fixed player threshold can't win: floor too high → misses real notes (28/37 detected); floor too
  low (0.02) → phantoms wreck the alignment (78% coverage). The slider is the wrong tool.

## The decided architecture (user, 2026-06-20)

> "The analysis of the coach bass recording should be STORED already, before the player even records
> — an approved amount of transients, length of notes, etc. Then we compare the player against THAT,
> no matter how loud the coach is. The only thing we deal with at runtime is the bass player's signal
> alone — and if his signal is loud or quiet, detect THAT and look for transients in that range
> automatically."

Two halves:

### A — Reference = STORED, APPROVED analysis (author-time, not runtime)
- The reference stops being re-detected live. It is analyzed ONCE, a human APPROVES it, and the
  approved analysis is STORED on the groove-card block as ground truth.
- DECISION: **detect once + admin approves** (not auto-approve, not derive-from-notation). Run
  onset/length/dynamics detection on the stem in the admin form, show the result, admin eyeballs/edits
  the transients, saves the APPROVED `referenceAnalysis`. Human safety net for odd stems.
- The stored analysis holds: onset times (at original tempo), note lengths, dynamics/accent — the
  full answer key for timing + (later) length + dynamics.
- ELIMINATES: the reference trust-guard, the ref onset sliders, the live re-detect, and most of the
  R-scaling fragility (onsets stored at original tempo, scaled by R at score time — same formula, but
  now over CLEAN approved data, not noisy live detection).

### B — Player = ADAPTIVE detection, normalized to the player's OWN signal (runtime)
- No fixed threshold, no slider. Measure the player take's OWN level/dynamics first, then look for
  transients RELATIVE to that. A loud and a quiet player both detect correctly automatically.
- DECISION: **adaptive + noise rejection** (both levers):
  1. Adaptive threshold (auto-gain): set the onset threshold from the take's own peak/RMS envelope,
     not a constant `minRelativeStrength`.
  2. Noise rejection in the aligner: a player onset that matches NO reference slot is dropped as
     NOISE, not penalized as "extra", and cannot steal a slot from a real note. Stops the phantom
     cascade that gave 78% coverage.

## The clean separation this achieves

| | Before (v1) | After (v2) |
|---|---|---|
| Reference | re-detected live, slider-tuned, trust-guarded | STORED approved analysis = ground truth |
| Player | fixed threshold, manual slider | ADAPTIVE detection (auto-gain) + noise-tolerant align |
| Runtime unknowns | reference detection AND player detection | ONLY the player's live signal |

No sliders for anyone (admin approves once; the student just plays). This is the productizable shape.

## What changes in the code we already built (REUSE vs REWORK)
- `captureBassInput`, the clock bridge, `gradeTiming`, `alignToReference` (structure), the grid
  mirror — REUSE.
- `bassOnsetDetector` — ADD an adaptive-threshold mode (derive the floor from the take's envelope);
  keep the fixed-option path for the grid mirror / tests.
- `alignToReference` — ADD noise rejection (unmatched player onset → drop, don't count as extra;
  don't let it claim a slot).
- `scoreAgainstReference` — read the STORED reference analysis instead of live ref onsets; the
  count/trust guard becomes "is the player playing enough", not "is the reference detection sane"
  (the reference is approved, by definition trustworthy).
- NEW: `referenceAnalysis` field on the block config (the stored answer key) + the admin
  detect-and-approve UI (extends the existing "Analyze reference stem" check into a save-able editor).
- The dev panel's ref sliders go away (reference is stored); player sliders go away (adaptive). The
  panel becomes: Arm → Play → grade.

## Honest caveats
- Adaptive detection is the BIG lever but won't make alignment perfect alone — hence noise rejection
  too. Both, player-side first.
- "Approved analysis" is a new admin authoring step (analyze → verify → save), the natural evolution
  of the per-stem preset. Real work, but it's author-time and one-time per groove.
- Length + dynamics (steps 5-6) slot into BOTH the stored reference analysis AND the player adaptive
  detection — design them together with this, not bolted on.

## Build order (revised)
1. **Adaptive player onset detection** (auto-gain from the take's envelope) — removes the player
   slider, the biggest live-test pain. Validate detected ≈ played on loud AND quiet takes.
2. **Noise rejection in the aligner** — unmatched player onset dropped, not penalized. Validate
   coverage climbs on a real take.
3. **`referenceAnalysis` stored field** + admin detect-and-approve UI — reference becomes data.
4. **Rewire `scoreAgainstReference`** to the stored analysis; drop the live ref re-detect + ref
   trust-guard.
5. Re-test the coach end-to-end on a real take — expect high coverage + an HONEST feel grade (the
   grid-vs-recording divergence becomes trustworthy).
6. THEN steps 5-6 (length, dynamics) over the same stored-analysis + adaptive-detection spine.

Related: [[bass-coach-reference-grading]], [[timing-mirror-proven]],
[[platform-has-ears-performance-analysis]], [[feedback-ear-first-measurement]].
