s# BassNotion Has Ears — Live Performance Analysis Feasibility

**Status:** Exploration / not committed. The capture layer it stands on is PROVEN (measured
2026-06-20, see [`PRACTICE_TOOLS_FEASIBILITY.md`](PRACTICE_TOOLS_FEASIBILITY.md) → "Capturing the
user's OWN bass recording"). This doc is about the layer ABOVE capture: **hearing what the student
plays and grading it against the exercise.**

**Date:** 2026-06-20.
**Question that started it:** "Can our platform have EARS and detect a user playing AGAINST our
exercises? Measure onset, recognise notes, where they put ghost notes, etc. — and how long does the
analysis take after they stop playing?"

**Product surface:** this is a **Bass Gym TRAINING capability**, NOT a Moises-style practice tool.
It bolts onto the treadmill engine and the Gym's L2s (Pulse, Timing, Note Duration → emergent
Pocket). Kept separate from the practice-tools doc on purpose. See
[[bass-gym-engine-architecture]], [[bass-gym-treadmill-shipped]], [[pocket-is-emergent-domain]].

---

## The headline answers (decided 2026-06-20)

1. **It's feasible, and bass is the EASIEST instrument for it.** Bass is monophonic and
   low-frequency with strong fundamentals → it sidesteps polyphony, the hard problem in
   music-information-retrieval. We're playing on easy mode.
2. **Timing model = LIVE streaming** (analyse as they play, in an AudioWorklet), grading
   **BOTH timing AND notes**.
3. **Wait after they STOP = ~0 ms.** With live streaming there is nothing left to analyse — the
   last note was graded milliseconds after it sounded. **The "analysing…" spinner does not need to
   exist.** (This is the whole point of choosing streaming over batch.)
4. **The cost doesn't vanish — it RELOCATES** from "a burst after stop" to "sustained real-time DSP
   during play." The number that matters becomes **per-note grading latency during play (~30–80 ms)**,
   not after-stop wait.
5. **HARD CONSTRAINT — stay 100% on-device.** Same wall as separation: a server path adds a network
   round-trip + queue + "we now possess the user's audio." On-device the DSP is cheap enough to run
   in the browser. Server = a different product with a worse privacy story. Do not cross this line.

---

## This is NOT stem separation — throw out the 3–5 min mental model

The 3–5 min wait in the practice-tools doc is **htdemucs neural separation** — an 80 MB model
crunching a whole song. **Note/onset/timing analysis of a live bass take is a categorically lighter,
different problem:** classic DSP (onset detection, pitch tracking) over a short mono signal. No
neural net required for the core. Orders of magnitude faster — milliseconds, not minutes.

---

## What's detectable, by difficulty (bass = easy mode)

| Capability | Difficulty | Reality |
|---|---|---|
| **Onset** (when a note starts) | 🟢 solved | Spectral-flux on a high-passed signal, ~±5–10 ms. The foundation of all timing grading. We built a rough version 2026-06-20. |
| **Pitch / note** (what note) | 🟢 very doable on bass | Monophonic pitch (YIN / pYIN) is mature; bass fundamentals are strong → reliable note-name + octave. |
| **Timing grade** (in the pocket?) | 🟢 doable now | onset → nearest grid beat → offset + consistency. Exactly what the capture probe did. = the Gym's Pulse/Timing L2s. |
| **Note correctness** (right vs exercise) | 🟢🟡 doable | pitch + the AUTHORED exercise notes → compare. "You played b3 instead of 3." |
| **Note duration** (staccato/legato) | 🟡 moderate | onset + OFFSET (note-end). Offset is harder than onset (bass decays gradually) but trackable via envelope. = the Note Duration L2. |
| **Ghost notes / dynamics** | 🟡 moderate | per-onset amplitude/velocity is readable. The CHALLENGE is classifying "ghost note" vs "missed note" vs "string noise" — distinct from just detecting a low-velocity attack. |
| **Articulation** (slides/hammer-ons/bends) | 🟡🔴 harder | the pitch TRAJECTORY between onsets — a slide is a continuous glide, a hammer-on is a pitch change with no new attack. Frontier-ish. |
| **Tone / technique** (finger vs pick vs slap) | 🔴 hard | spectral-timbre classification, needs a trained model. Not near-term. |

**The 🟢 row is exactly what the Gym trains (Pulse, Timing, Note Duration).** You do NOT need the
hard rows to make the Gym hear the student. Don't let articulation/transcription gate the achievable
core.

---

## The unlock: grade against a KNOWN exercise, don't transcribe cold

The single most important architectural fact:

> **A practice app grading against a known exercise is a fundamentally EASIER problem than
> "transcribe arbitrary bass."** You AUTHOR the exercises — you already have the answer key
> (expected notes + expected timing per beat). You're CHECKING an attempt against a known answer,
> not DISCOVERING it from scratch. ~10× easier.

This is the same insight as the capture test (the grid did the hard work). Here it appears twice:
the exercise gives you (a) the expected notes and (b) the grid to align them to.

---

## The hard part of "live + both": INCREMENTAL alignment — and how the grid dissolves it

Timing-live is easy: onset → nearest grid beat → done. No future needed.

**Note-correctness-live is the genuinely hard bit.** Grading correctness *after* a take, you DTW-align
the whole played sequence against the whole exercise — if they skip note 4 you can see 5–8 still line
up. **Live, you can't see the future.** When a note is played you must decide IN THE MOMENT: is this
the next expected note? a wrong note? an extra note? did they skip ahead? — without knowing what
comes next. That's a real-time alignment problem (how a Rocksmith/karaoke scorer tracks position).

**v1 move that sidesteps full sequence alignment — anchor correctness to the GRID, not to a
free-running sequence:**

```
The exercise is LOOPED, GRIDDED, and AUTHORED → every grid position N has an expected note.
  → when an onset fires near grid position N, check its detected pitch against expected-note-at-N.
  → the GRID *is* the alignment. No DTW, no future-peeking, no sequence tracking.
```

Works precisely because Gym exercises are looped + gridded + authored (you know
expected-note-per-beat). Skipped/extra notes show up as "grid position N had no onset" / "an onset
landed between grid positions" — both gradeable without sequence alignment. Full free-sequence DTW
is a later upgrade for un-gridded material; the Gym doesn't need it.

---

## ⚠️ The one bass-specific physics constraint — low notes pitch-detect SLOWER

**You cannot give instant PITCH feedback on a low bass note. Physics.** Pitch detection needs a few
wavelengths of signal to be unambiguous:

- Low E (E1) ≈ 41 Hz → one cycle ≈ **24 ms** → want 2–3 cycles → **~50–70 ms** before pitch is confident.
- An octave up (E2 ≈ 82 Hz) → ~half that. Higher notes are faster.

Consequences for the live UI (design around this, don't fight it):
- **Onset/TIMING feedback can be instant** — the ATTACK is detectable immediately ("you hit it").
- **PITCH feedback has an inherent ~30–70 ms floor, WORSE for lower notes** ("…and it was the right note").
- **Two-stage live feedback:** the "note hit" (timing) lights up on the attack; the "right note?"
  (pitch) confirms a beat-fraction later. NEVER promise instant pitch on a sub-bass note you
  physically cannot deliver it for.

This also sets the real latency number for the feature:
**per-note grading ≈ 30–80 ms after the attack during play; ~0 ms after stop.**

---

## Timing budget — the actual numbers

Classic-DSP pipeline over a ~14 s take (~16–32 bass notes), all on-device:

| Stage | Cost | Note |
|---|---|---|
| Onset (spectral-flux) | ~10–50 ms | linear in audio length; trivial |
| Pitch (YIN per note) | ~50–300 ms total batch / ~30–70 ms live-per-note | the heaviest classic step; low notes slower (physics above) |
| Alignment (grid-anchored) | ~5–50 ms | tiny — the grid does it; full DTW only if un-gridded |
| Grading math | <5 ms | arithmetic |

- **If built BATCH (after stop):** total **~200–500 ms** — a brief "scoring…" flash, near-instant.
- **If built LIVE (chosen):** **~0 ms after stop**; **~30–80 ms per note during play**; sustained
  real-time worklet load (fine on desktop; the thing to watch on mobile).
- **AVOID:** CREPE / neural pitch (hundreds of ms–seconds, and needs a model) when YIN suffices; and
  ANY server round-trip (breaks both the latency budget and the privacy wall).

---

## Build pieces — droppable library vs net-new

| Piece | Source | Effort |
|---|---|---|
| Capture (getUserMedia, raw constraints, engine AudioContext) | **DONE / proven** 2026-06-20 | reuse |
| `Permissions-Policy: microphone=(self)` | **DONE** (PR #170) | reuse |
| Onset detection (spectral-flux) | known algorithm; rough version built 2026-06-20 | harden — net-new-ish |
| Monophonic pitch (YIN / pYIN) | mature, droppable (well-known impls) | integrate |
| The groove grid + clock (`loopStartAudioTime`, `loopDurationSeconds`, beat math) | **EXISTS** (`useGrooveCardPlayback`) | reuse |
| Bass-mute to play against the backing | **EXISTS** (`setStemMuted('audio-bass', true)`) | reuse |
| AudioWorklet real-time integration | the worklet that runs onset+pitch every block under the RT budget | **net-new — the core lift** |
| Grid-anchored incremental scorer | "onset near grid N → check pitch vs expected-note-at-N" | **net-new — the core lift** |
| Two-stage live UI (timing instant, pitch confirms) | green/red per grid position, respecting the low-note pitch floor | net-new |
| Authored "answer key" per exercise (expected note per beat) | the Gym already authors basslines/notation → the expected notes EXIST | mostly reuse |

**Two real net-new lifts:** (1) the real-time worklet DSP (onset+pitch every audio block within
budget), (2) the grid-anchored incremental scorer. Everything else is reuse or a droppable library.
The cost moved into the real-time path (the streaming tradeoff), it did not disappear.

---

## How it bolts onto the Gym (the product point)

The treadmill engine today advances on self-reported / criterion completion. This turns the Gym from
"did they self-report" into **"we HEARD them":**

- **Pulse / Timing L2** ← onset timing vs grid (the 🟢 capability, gradeable live and instantly on the attack).
- **Note Duration L2** ← onset+offset envelope per note.
- **Note correctness** ← grid-anchored pitch check vs the authored exercise.
- **Pocket** stays EMERGENT ([[pocket-is-emergent-domain]]) — we train the underlying L2s the ears
  now measure; we do not "grade pocket" directly.

The headline student moment: **"Play this bassline" → the card hears onset timing (pocket), pitch
(right notes), and per-note dynamics (ghost-note attempts), grid-anchors them to the exercise you
authored, and grades — live as they play, results already there when they stop.**

---

## Decisions firmed up (2026-06-20)
- **Timing model = LIVE streaming**, grading **BOTH timing and notes** → after-stop wait ~0 ms; the
  real latency is per-note ~30–80 ms during play.
- **Alignment = grid-anchored**, NOT free-sequence DTW (the Gym's looped/gridded/authored exercises
  make the grid the aligner). Full DTW is a later upgrade for un-gridded material only.
- **Pitch = YIN-class classic DSP**, NOT CREPE/neural — fast enough, no model, on-device.
- **100% on-device**, no server analysis (latency + privacy wall, same as separation).
- **Design around the low-note pitch-latency floor** with two-stage feedback (timing instant on the
  attack, pitch confirms a beat-fraction later); never promise instant pitch on sub-bass.

## Open items before any build
- [ ] Spike a real onset+pitch detector (spectral-flux + YIN) on a recorded bass take → prove note
      accuracy on real bass the way capture latency was proven. The load-bearing TEST.
- [ ] Measure the real per-note pitch-confidence latency on LOW notes (E1/F1) on target devices.
- [ ] Profile the AudioWorklet RT budget (onset+pitch every block) on desktop AND a mid mobile.
- [ ] Decide ghost-note classification policy (low-velocity attack vs miss vs noise) — needs the
      ear-first treatment ([[feedback-ear-first-measurement]]): show the audible thing, don't trust a
      proxy metric.
- [ ] Define the authored "answer key" schema (expected note + expected duration per beat) — likely
      already derivable from the existing bassline notation; confirm.

## Related
- Capture proof + measured latency: [`PRACTICE_TOOLS_FEASIBILITY.md`](PRACTICE_TOOLS_FEASIBILITY.md)
  → "Capturing the user's OWN bass recording".
- Gym: [[bass-gym-engine-architecture]], [[bass-gym-treadmill-shipped]],
  [[pocket-is-emergent-domain]], [[reference-drop-grid-is-tempo-math]] (grid = tempo math, the same
  grid this scorer anchors to).
- Ear-first measurement discipline: [[feedback-ear-first-measurement]].
