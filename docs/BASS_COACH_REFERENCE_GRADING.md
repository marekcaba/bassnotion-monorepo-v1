# The Bass Coach — Grading Against a Reference Performance

**Status:** Design / not built. Extends the PROVEN timing mirror (offset −0.5ms, jitter 30.6ms on a
real take — see [[timing-mirror-proven]]). No code yet for this layer.
**Date:** 2026-06-20.

**The realization (user, 2026-06-20):** the mirror can measure against TWO fundamentally different
references, and they grade DIFFERENT skills:

> "Measure against how it SHOULD be in a perfect world — every note on the grid, precise length — OR
> measure against an ACTUAL bass recording, where the player isn't forced into the grid but into the
> bass-COACH measurement: how close he is to the real recording."

---

## The two reference frames (they can give OPPOSITE verdicts on the same take)

### Frame 1 — IDEAL GRID (built, proven)
Reference = mathematical perfection: every note quantized to the grid, exact length. Grades **raw
metronomic timing** — your relationship to the pulse. This is the **Pulse/Timing L2**. The reference
is GENERATED from the authored notation; no recording needed.

### Frame 2 — REAL REFERENCE RECORDING (the "bass coach", to build)
Reference = a human performance, which is DELIBERATELY NOT on the grid — it has push/pull, swing,
notes laid back behind the beat, the FEEL that makes it groove. Grades **how close you are to the
target performance**. This is the **Pocket / "play it like the record"** measurement.

**Why this matters:** a great bassline is often INTENTIONALLY off the grid. Frame 1 would PENALIZE a
player for matching the real feel (because the real feel isn't grid-perfect); Frame 2 REWARDS exactly
that. Same take, opposite grades. The distinction is load-bearing, not cosmetic.

---

## DECISION (2026-06-20): the frame is a property of the EXERCISE, admin-chosen, MANDATORY

The grading mode is NOT a player toggle and NOT a global setting. **The admin authoring a groove-card
block picks the mode, and it's a required field.** The exercise's intent determines what "good" means:

- "Lock The Pocket" / metronome-discipline exercise → **grid** mode.
- "Play it like the record" / feel exercise → **reference** mode.

Rationale: the exercise declares the intent; the mirror measures the right thing for that intent. A
required field (no default) prevents an ambiguously-graded exercise — which would be exactly the
"what do I do now?" confusion the flow rules forbid. Fits the existing inline-authoring pattern
([[groove-card-authoring-is-inline-in-tutorials]]) — another field on the groove-card block config,
like Reference-Drop.

---

## What makes Frame 2 buildable NOW: we already own the reference

`useGrooveCardPlayback` already exposes **`bassBuffer: AudioBuffer | null`** (line 159/1632 — "the
currently active bass AudioBuffer, the source the card visualises"). **The reference recording is the
groove card's own bass stem.** We mute it for the player to play over — and we run the SAME
`detectBassOnsets` on it to get the reference's note positions.

So the architecture is: **same capture + same onset detection, but the GRID is swapped for the
REFERENCE's actual onsets.** scoreAgainstGrid already snaps player onsets to a target; in Frame 2 the
target set is the reference's onset times instead of the mathematical grid.

---

## What Frame 2 grades (all three — the full coach)

| Dimension | What it measures vs the reference | Detection | Difficulty |
|---|---|---|---|
| **Onset timing** | when each note STARTS vs the reference's note starts ("in their pocket") | ✅ have `detectBassOnsets` | 🟢 reuse |
| **Note length / duration** | how long each note is held vs the reference (staccato/legato) = Note Duration L2 | ❌ need note-OFFSET detection (note-end) | 🟡 new |
| **Dynamics / accent** | how hard each note is hit vs the reference (ghost notes, accents) | ❌ need per-onset amplitude (readable from capture) | 🟡 new |

Onset is reuse. Length needs **offset detection** (where a note ends — harder than onset; bass decays
gradually, so it's an envelope-drop / next-onset-gap problem). Dynamics needs **per-onset amplitude**
(the capture already has the samples; take RMS/peak in the attack window).

---

## The genuinely hard part: PLAYER↔REFERENCE alignment

Frame 1 was easy because the grid is deterministic — every onset snaps to its nearest subdivision
independently. Frame 2 is harder: the player and the reference are two REAL note sequences, and the
player may **skip a note, add a note, or play a different count**. You can't just pair them by index.

This is sequence alignment (DTW-like): match player note k to reference note j such that the overall
pairing is consistent, allowing insertions (extra player notes) and deletions (missed notes). Per-pair
error (timing / length / dynamics) is then computed on the matched pairs; unmatched = miss/extra.

**Mitigation that keeps it tractable (same trick as Frame 1):** the reference is LOOPED and on a known
bar grid. Anchor BOTH sequences to the loop grid (each note belongs to a bar+subdivision region), then
align within regions rather than across the whole free sequence. This bounds the alignment search and
makes skips/extras local. (Full free-sequence DTW is the fallback for un-looped material.)

---

## Architecture sketch

```
ADMIN (groove-card block form): gradingMode = 'grid' | 'reference'   ← REQUIRED field
   (reference mode also implies "this card has a real bass stem to grade against")

PLAYER take (capture → detectBassOnsets) ─┐
                                          ├─→ MODE-AWARE SCORER
reference (bassBuffer → detectBassOnsets) ─┘     • grid mode:  player onsets vs ideal grid (BUILT)
   (+ offset detection → note lengths)            • ref mode:   align player↔reference, then per-pair
   (+ per-onset amplitude → dynamics)                           timing/length/dynamics error
                                                 → per-dimension grade + overall "how close to the record"
```

Reuse: capture, detectBassOnsets, the clock bridge, the loop grid (as the alignment anchor), the
human-scaled grade ([[timing-mirror-proven]] timingGrade.ts — extend per dimension).
Net-new: note-offset (length) detection, per-onset amplitude (dynamics), the player↔reference aligner,
the admin `gradingMode` field + schema, the mode-aware scorer, multi-dimension grade display.

---

## Build order (proposed)
1. **Admin `gradingMode` field** (required) on the groove-card block config + contract schema. Cheap,
   unblocks everything, forces the authoring decision.
2. **Reference onset extraction** — run detectBassOnsets on `bassBuffer`; prove it finds the stem's
   notes (the stem is clean/authored, so easier than live bass).
3. **Reference-timing scorer** — align player onsets ↔ reference onsets (grid-anchored), grade onset
   timing vs the reference. The headline "are you in their pocket" — ship this first.
4. **Note length** — offset detection on both player + reference → length-match grade.
5. **Dynamics** — per-onset amplitude on both → accent/ghost grade.
6. Mode-aware panel: grid mode shows the grid grade (built); reference mode shows the 3-dimension
   coach grade. Admin field drives which.

## Open questions before build
- [ ] Note-offset (length) detection on bass — envelope-drop threshold vs next-onset-gap? Test on the
      stem first (clean) then live (messy). Ear-first ([[feedback-ear-first-measurement]]).
- [ ] Alignment: confirm grid-anchored regional alignment handles real skips/extras, or do we need
      full DTW? (Test with a take that skips a note.)
- [ ] Dynamics reference: is the stem's per-note amplitude a fair target, or does DI level / the
      player's rig make absolute amplitude incomparable? (Likely grade RELATIVE accent pattern, not
      absolute level.)
- [ ] Does reference mode need the player to match the EXACT notes (pitch), or just the rhythm/feel?
      (Pitch = the harder Frame-2 extension; rhythm-only is the v1.)

## Related
[[timing-mirror-proven]] (the grid mirror this extends), [[honest-mirror-build-options]],
[[platform-has-ears-performance-analysis]] (grade-vs-known-exercise + grid-anchored alignment),
[[pocket-is-emergent-domain]] (reference/feel mode trains Pocket), [[groove-card-authoring-is-inline-in-tutorials]]
(where the admin field lives), [[reference-drop-grid-is-tempo-math]] (the loop grid = the alignment anchor).
