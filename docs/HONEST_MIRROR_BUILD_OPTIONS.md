# The Honest Mirror — Build Options (what "having ears" lets us build)

**Status:** Exploration → spike planned. No production code yet. Stands on PROVEN capture
([`PRACTICE_TOOLS_FEASIBILITY.md`](PRACTICE_TOOLS_FEASIBILITY.md)) + the live-analysis design
([`PERFORMANCE_ANALYSIS_FEASIBILITY.md`](PERFORMANCE_ANALYSIS_FEASIBILITY.md)).
**Date:** 2026-06-20.

**Framing (the user's strategy):** the business lives or dies in four FLOWS, ranked:
1. **Stranger → first HEARABLE win** (decides everything)
2. **The number has to feel TRUE — every time** (the substrate under all of it)
3. Open → one tap → rep → progress → want tomorrow (retention)
4. Plateau → right offer → buy → graduate → return (the loop closing)
Rules across all: one obvious next action; no dead ends; state-aware. "#1 sitting on #2" is the
whole game — a stranger getting a real hearable win, built on a number they trust.

---

## THE FINDING: flows #1 and #2 are currently built on SELF-REPORT

Codebase recon (2026-06-20) against the four flows:

| Flow | What decides it | What the code does TODAY | File |
|---|---|---|---|
| **#1 hearable win** | "first win is real and HEARABLE" | assessment is a **video theory quiz**; the "win" is answering questions — **nothing is heard** | `apps/frontend/src/app/assessment/page.tsx` |
| **#2 number feels true** | "score matches what the player feels and HEARS" | the "71%" is a **quiz percentage** (knowledge Qs, congruent/wrong) — an honest quiz score, but **NOT a measurement of playing** | `assessment/machines/assessmentMachine.ts:107` |
| **#3 retention** | "see the progress" | "you moved" = tempo-ladder climb + attendance/streak (REAL) — but it's "you showed up / climbed BPM", not "you got tighter, here's proof" | `app/app/gym/page.tsx:694` |
| **#3 rep quality** | honest pass | `conquer` criterion = a self-report button "✓ I played it clean"; `time`/`loops` are honestly measured but measure ATTENDANCE not QUALITY | `drill/components/ConquerOutcome.tsx:115` |

**Conclusion:** the platform measures *attendance and self-report*, not *playing*. The single thing
the whole strategy stands on — measuring the playing — **does not exist yet.** Live performance
analysis is therefore NOT "a feature"; it is **the substrate of flows #1 and #2.** This is exactly
the user's "#1 sitting on #2."

---

## WHAT HEARING UNLOCKS, flow by flow

- **#2 (substrate first):** the assessment stops being a quiz and becomes a **played diagnostic** —
  "play one bar to a click" → a timing number from their actual hands. THAT is the honest mirror;
  "six years and my timing's at 71%?" hits because it came from playing, not multiple choice. A quiz
  can never deliver "I can hear it's true."
- **#1 (the decider):** stranger plays 1 bar → honest number → ONE targeted rep → **re-measure →
  the number moves → they HEAR it move.** That before→after IS the hearable win. Today's "you moved"
  is ladder/attendance; hearing makes it a MEASURED improvement on the thing just drilled.
- **#3 (retention):** upgrades "you moved" from attendance to QUALITY, and turns the self-report
  `conquer` button into a measured pass → Bronze/Silver/Gold become EARNED, not claimed.
- **#4 (loop):** a plateau detected from MEASURED quality stalling ("timing flat at 78% for 9 days")
  is a sharp, honest Accelerator trigger instead of crying wolf on BPM. Hearing makes the plateau true.

---

## REUSE: ~40% of the scoring engine already EXISTS

| Asset | Status | Use |
|---|---|---|
| **Capture** (getUserMedia raw, engine AudioContext, ~±5–11ms latency) | ✅ PROVEN 2026-06-20 | the input |
| **`Permissions-Policy: microphone=(self)`** | ✅ DONE (PR #170) | unblocks the mic |
| **`BeatTimingAnalyzer`** (`playback/utils/BeatTimingAnalyzer.ts`) | ✅ LIVE + WIRED | **the scoring engine.** `recordBeat(source, beatNumber, measureNumber, actualTime)` → outputs `drift, jitter, consistency (0-100), syncScore (0-100), driftTrend`. Today it scores the APP's playback timing; **point it at the USER's onsets and it scores the player.** |
| **`TimingMetricsCollector`** | ✅ live | accuracy% pattern (`perfect/total`) — template |
| Groove grid + clock (`useGrooveCardPlayback`: loopStartAudioTime, loopDurationSeconds) | ✅ exists | the expected grid |
| Bass-mute (`setStemMuted('audio-bass', true)`) | ✅ exists | play against backing |
| **Onset detection** (audio → note starts) | 🟡 rough version built 2026-06-20 (the removed probe) | harden |
| **Pitch detection** (YIN) | ❌ net-new | only if grading NOTES (not needed for timing-only mirror) |
| **WebMIDI input** | ❌ net-new | alternative ears for MIDI-bass minority |
| Note-comparison / user-performance scoring wiring | ❌ net-new | the glue |

**~40% scaffold (timing-score engine + audio infra), ~60% net-new (onset hardening, the clock
reconciliation, the wiring, the visualization).** The scoring MATH is NOT net-new — it ships.

⚠️ **Honesty caveat to nail in the spike:** `BeatTimingAnalyzer` uses `performance.now()` (wall-clock
ms); capture uses `audioContext.currentTime` (audio-clock seconds). For a TRUE number these clocks
MUST be reconciled, or the score lies. Small but load-bearing.

---

## "MOST IMPRESSIVE" resolves to TIMING, rendered viscerally — not notes

The user chose "whatever's most impressive" for the first number. Analysis:

- **Impressiveness = UNDENIABILITY, not richness.** The mirror moment is a skilled player going
  "…damn, that's true." Which measurement does that fastest?
- **TIMING is the most undeniable + most humbling.** Most self-taught bassists have timing problems
  they CAN'T hear in themselves — they think they're in the pocket. Show their attacks landing 30ms
  late, consistently, WITH a visual, and that's the gut-punch. And per the ear-first principle, once
  pointed out they can immediately HEAR it.
- **NOTES are LESS impressive for the mirror** (counterintuitively): a competent player mostly plays
  the right notes, so "you played the right notes" is confetti, not a mirror. Notes matter for
  LEARNING A LINE (flow #3 content), not DIAGNOSING (flow #1/#2).
- So "most impressive" = **timing + its VISUALIZATION** (attack-vs-grid, zoomable, DAW-like). The
  impressiveness is the visual PROOF of the truth, not adding pitch. Cheap, accurate, reuses
  `BeatTimingAnalyzer`. **Pitch is deferred, not on the critical path to the mirror.**

⚠️ **The trap in "impressive":** per flow #2, an impressive-but-WRONG number is the FASTEST way to
kill trust ("the first time it feels wrong, trust dies"). So the spike's job is DUAL: be impressive
AND prove accuracy against the user's own ear. Impressive rides on accurate, never instead of it.

---

## VIABILITY ACROSS HARDWARE — timing reaches the widest audience (added 2026-06-20)

Q: is the mirror viable for users with only a LAPTOP MIC + amp in the room (no interface)?
**A: for the TIMING mirror — yes, with one setup nudge. For NOTES/pitch — much worse.** This is a
big reason timing-first is right: onset detection is the capability that DEGRADES MOST GRACEFULLY on
bad audio.

- **Onset detection is robust to bad audio.** A bass attack is a sharp wide-band energy burst — it
  punches through a laptop mic + room reverb + noise. Detecting WHEN a note happened is far more
  forgiving than detecting WHAT (pitch) or HOW CLEAN (tone). So the timing mirror mostly survives a
  laptop mic; the pitch mirror does not.
- **Monitoring is fine** — a laptop-mic user with an amp in the room HEARS themselves via the amp
  (0ms, physical) + backing acoustically. The daemon's monitoring problem doesn't bite here.
- **THE REAL BLOCKER = backing-track BLEED.** Mic hears the user's bass AND the backing track
  (drums/kicks look like onsets) → false onsets corrupt the timing number. The interface user is
  immune (clean separate channel). FIX — and we control the backing, so this is tractable:
  - **Backing on HEADPHONES** (mic hears only the amp/bass) → bleed gone. A SETUP INSTRUCTION, not
    code. Most practicers can do this.
  - **Spectral gating / known-backing subtraction** — we GENERATED the backing, so we know exactly
    what's bleeding and when → gate onsets that correlate with the known kick/snare grid. More DSP,
    but tractable BECAUSE we have the reference signal (separation users don't; we do).
- **Room latency is variable** (acoustic travel ~3ms/m + amp latency + mic path), vs the interface's
  clean correctable constant. More baked-in jitter, less punch-in-correctable. Tolerable for timing.

| User | Timing mirror | Note/pitch mirror |
|---|---|---|
| Interface (DI) | ✅ excellent — clean channel, ~±11ms proven | ✅ good |
| Laptop mic + amp, backing on **HEADPHONES** | ✅ **viable** — onsets punch through, no bleed | 🟡 rough (room/mic colors pitch; bass fundamentals survive) |
| Laptop mic + amp, backing on **SPEAKERS** | 🟡 compromised by bleed → needs spectral gating | 🔴 poor |

**Verdict:** the timing mirror is viable for the laptop-mic user IF the backing is on headphones (a
one-line setup nudge). Speaker-bleed is solvable via known-backing gating. The pitch mirror needs a
clean signal (interface). → Another reason TIMING-FIRST: widest audience on the worst hardware.

## THE OPTIONS (ranked by the user's own flow logic)

- **Option A — Played TIMING mirror (RECOMMENDED).** Capture (done) → onset detect → feed
  `BeatTimingAnalyzer` (exists) → a timing number + visual from playing. Diagnostic = "play 1 bar";
  win = "drill it, re-measure, hear it move." NO pitch needed. It IS flow #2, reuses the live scoring
  engine, cheapest to TRUST, and is the Gym's core L2 (Pulse/Timing). Highest leverage in the codebase.
- **Option B — Add NOTE correctness** (net-new YIN pitch). Richer diagnosis ("right notes, loose
  timing") but pitch is harder + slower on low bass ([[platform-has-ears-performance-analysis]]).
  Layer AFTER timing proves the mirror.
- **Option C — MIDI-input ears** (net-new WebMIDI). Perfect accuracy, sidesteps audio DSP, but only
  serves the MIDI-bass minority. A niche accelerant, not the main road.

---

## DECISION (2026-06-20): spike the most-impressive TIMING mirror in ISOLATION first

User chose: first number = "most impressive" (→ resolved to timing+visual above); first surface =
**standalone spike** (prove onset→score accuracy in isolation before betting a real flow on it — the
same discipline that worked for the latency question).

**The spike's dual job:** (1) render the timing truth viscerally (the gut-punch), (2) PROVE the
number is accurate against the ear (or impressive becomes a liability per flow #2).

### Spike build sketch
```
play a 1-bar (or 4-bar) loop on a click, bass muted
  → capture user onsets (audioContext.currentTime)            [PROVEN]
  → onset detection (harden the removed probe's detector)     [40% there]
  → reconcile audio-clock ↔ BeatTimingAnalyzer wall-clock     [load-bearing, small]
  → recordBeat(...) per onset against the grid                [BeatTimingAnalyzer — EXISTS]
  → render: syncScore + jitter + driftTrend + a DAW-like
            attack-vs-grid visual (zoomable, ear-first)        [the impressive part — net-new viz]
  → VALIDATE: does the number match what the user HEARS when
            they listen back? (ear is ground truth)            [the trust gate]
```

### What the spike must answer (TEST, not design)
- [ ] Is onset detection accurate enough on real bass that the timing number is TRUSTWORTHY (the
      flow-#2 bar)? Validate against the user's ear, not a proxy.
- [ ] Does the audio↔wall clock reconciliation hold (no systematic offset faking the score)?
- [ ] Does the visual make the truth UNDENIABLE — is the "…damn, that's true" reaction real?
- [ ] What does a known-good player score vs a known-loose one — does the number DISCRIMINATE?
- [ ] **LAPTOP-MIC path:** does onset detection hold on a laptop mic + amp in the room with the
      backing on HEADPHONES (the wide-audience case)? And how bad is the bleed on SPEAKERS — does
      known-backing gating fix it? Test BOTH the interface and the laptop-mic-headphones rigs, since
      the stranger flow has many laptop-only users.

### Then (only if the spike proves trustworthy + impressive)
- Wire into a real flow. Lower-risk first surface = a **gym rep** (flow #3 — engine/grid/drill exist),
  THEN the **assessment** (flow #1 — highest stakes, public onboarding, the played diagnostic).
- Before→after re-measure = the hearable win (flow #1).
- Measured `conquer` + earned Bronze/Silver/Gold (flow #3).
- Measured-stall plateau detection → Accelerator trigger (flow #4).

---

## Cross-flow rules this must honor (the user's "product vs maze" rules)
- **One obvious next action, always** — the mirror ends pointing at the ONE rep that fixes the
  diagnosed weakness; the rep ends pointing at re-measure / tomorrow. Never "…now what?"
- **No dead ends** — diagnostic → first rep → re-measure → gym. Every surface points at the next.
- **State-aware** — free visitor (played diagnostic + 1 win), member (today's rep, measured),
  plateaued (Accelerator), grad (next goal pre-loaded) each get the right next step.
- Value Equation made physical: lower the bottom (frictionless played-assessment, one-tap re-measure,
  zero confusion) + raise the top ("I can HEAR I'm getting better"). The mirror raises the top; it
  only works if setup stays frictionless (don't make them fight an interface to get heard).

## Related
- [[practice-tools-feasibility]] (capture proof), [[platform-has-ears-performance-analysis]] (the
  live-analysis design this picks the timing slice of), [[bass-gym-engine-architecture]],
  [[bass-gym-treadmill-shipped]], [[pocket-is-emergent-domain]], [[feedback-ear-first-measurement]]
  (the trust gate's ground truth).
