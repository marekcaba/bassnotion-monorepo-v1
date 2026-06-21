# Bass Coach — Grade Against the REAL RECORDED Bass Take

> **The recording is the answer key for *when*. The chart is the answer key for *what*.**
> Grade the player by opening a window at each approved recorded-onset and confirming an
> onset + the right pitch there — timing measured against the recorded onset, never a grid.

Source-verified architecture (multi-agent workflow, 2026-06-21). Spine =
`minimal-graft-onto-current`. All `file:line` verified against current source.

---

## 1. THE MODEL IN ONE PARAGRAPH

The grading target is the set of **admin-approved onsets detected on the real recorded
reference bass take** (`ReferenceAnalysis.onsetsSec`, `libs/contracts/src/types/block.ts:535`
— stem-buffer seconds, ascending, human-verified). For each recorded onset `i`, map it to a
real audio-context time, open a short window in the player's captured take, and require
**(a)** a detected player onset within a per-note tolerance **and (b)** the player's pitch in
that window matches the pitch the chart says note `i` should be. Right-time/right-pitch =
**hit**, graded `playerSec − recordedOnsetSec` (the recording's own push/pull is truth — no
beat snapping). Right-time/wrong-pitch = **miss** (the gap to close). A player attack near no
recorded onset = **noise** (ignored). The chart (`ExerciseNote[]`) contributes exactly one
thing — a per-onset pitch label — never a timing target.

---

## 2. THE SYNC SOLUTION (centerpiece) — PROVEN

The key exploit: **the reference recording IS the playing stem.** No cross-device clock; one
`audioContext.currentTime` domain (player mic + stem share the engine context via
`captureBassInput.ts` → `WindowRegistry.getAudioContext()`).

**Anchor:** `loopStartAudioTime` = bar-1 downbeat AFTER the count-in
(`useGrooveCardPlayback.ts:1499-1506`): `anchor (= getTransportStartTime() ≈ ctx.now+~300ms
lookahead) + 4*secondsPerBeat`. The engine injects the count-in as a separate metronome region
and offsets stem regions by one bar (`:1437-1442`), so the count-in **never appears in
`onsetsSec`**.

**The three maps onto one clock:**

| Timeline | → audio-ctx seconds | Source |
|---|---|---|
| Recorded reference (buffer sec `t`) | `loopStartAudioTime + t / R` | `TimingMirrorPanel.tsx:267,280` |
| Music / loop | `loopStartAudioTime` (post-count-in downbeat) | `useGrooveCardPlayback.ts:1501,1506` |
| Player capture (buffer sec `u`) | `u + startedAtCtxTime`, `startedAtCtxTime = ctx.now − inputLatencySec` | `captureBassInput.ts` |

`R = currentBpm/originalBpm` (`TimingMirrorPanel.tsx:267`). Recorded onset `t=0` → audible at
`loopStartAudioTime`. Head silence (if any) lives inside `onsetsSec[0]` — no separate lead-in
term. **Scorer uses raw `loopStartAudioTime`, never the read-head/phase (visual-latency-shifted
~185ms).**

**Open Q2 — PROVEN (2026-06-21):** `docs/dev-tools/audio-audit/ogg-padding-probe.mjs` confirmed
the runtime-decoded OGG bass stem shares sample 0 with the source (Vorbis granulepos == WAV
count == decoded count; first-onset Δ=0.00ms). No hidden decode-padding offset.

**Two sync guards (Step 6):**
1. `audibleStart` null-fallback (`:1505`) silently drops the ~300ms lookahead → thread a
   `transportAnchorWasNull` flag; mark take untrustworthy if set.
2. Mid-take tempo nudge shears `R` (live) vs frozen grid → refuse to grade takes where
   `currentBpm` changed (`bpmChangedDuringTake`). Grade constant-tempo only.

---

## 3. PITCH LABELING + VERIFICATION (the two net-new lifts)

### 3.1 Label association — BIND AT ADMIN TIME (not grade-time zip)
Grade-time `refAbs[i] ↔ chartAttack[i]` index-zip is fragile (markers are hand-edited, chart is
MIDI; one divergence mis-labels everything downstream, and the count guard is bypassed at
`TimingMirrorPanel.tsx:284-285`). **Fix:** extend `ReferenceAnalysis` with
`onsetMidi?: (number|null)[]` (index-aligned to `onsetsSec`). Admin editor proposes a label per
marker (from the chart), human approves/overrides once. Grade time just reads `onsetMidi[i]`.

**Proposed-label builder** (`buildReferenceLabels`, pure, new file):
1. Filter chart to attacks — reuse the predicate at `TimingMirrorPanel.tsx:176-181` (drop LEGATO
   techniques); add `duration === 'tied'`. Ghosts stay (real attacks).
2. Sort by `MusicalTimeConverter.comparePositions` (`musical-time-converter.ts:185`); tie-break
   via `positionToMs` (`:59-79`, **ordering only**).
3. Map each attack → MIDI via `calculatePitch(note.string, note.fret, '4')`
   (`fretboardCalculations.ts:267-292`).

**Fallback:** `onsetMidi` absent/null → that onset grades **time-only** (today's behaviour).
Zero regression.

### 3.2 Pitch verifier — `timing-mirror/verifyPitch.ts` (~60 lines, dependency-free)
No f0 estimator exists in-repo (the autocorrelation at `MusicalFeatureExtractor.ts:296` never
converts lag→Hz — don't adapt it). YIN difference function + CMND + parabolic interpolation,
**computed full-band then judged against the prior** (a band-only verifier can only confirm,
never reject — the judge-flagged flaw).

- **Window:** start ~10ms after the onset (skip attack, land on steady-state); length
  `min(4096, samplesToNextOnset)` ≈ 93ms @44.1k (≥3 periods of low-E; contains low-B lag). If
  too short to contain `tau0` → fall through to time-only.
- `expectedHz = 440 * 2**((midi−69)/12)` from stored `onsetMidi[i]`.
- **Decision:** strong in-band dip (CMND<~0.15, `tau ∈ [tau0/2^(1/12), tau0*2^(1/12)]`) →
  `'confirmed'`; strong global dip >50 cents off → `'wrong'` (the reject); no strong dip →
  `'unknown'` → accept.
- **Octave-snap:** global min within ±50 cents of `expected×2` or `÷2` → `'confirmed'` (octave
  slip of the right note), not `'wrong'`.
- Low-bass is slower to confirm (wider window) — accepted: timing is graded from the onset, not
  the pitch window, so slowness never costs timing accuracy, only the accept/reject boolean.

---

## 4. THE MATCHER + GRADE

Keep `alignToReference` as the time matcher; add an optional verify callback after a time-match.

**`alignToReference.ts`:** first fix the **stale header** (lines 1-16, 47-54 describe the
abandoned grid-slot-bucketing — drift-back-to-grid hazard). Add 4th param
`verify?: (refIndex, playerSec) => 'confirmed'|'wrong'|'unknown'`. At the hit branch (`:98-105`):
`'confirmed'|'unknown'` ⇒ HIT (carry `pitch` on `AlignedPair`); `'wrong'` ⇒ push to `missed`,
**don't claim** `best` (falls into noise at `:111-112`); no verify ⇒ today's behaviour.

**`scoreAgainstReference.ts`:** `ReferenceScoreOptions` gains `verify?`, threaded into
`alignToReference` (`:80`). **Grading math UNCHANGED:** `errorSec = playerSec − referenceSec`
(`:104`); `jitterMs` = de-meaned matched-error stddev = feel (`:121-125`); `offsetMs` =
calibratable lean (`:127`); capture-latency calibrated out by `estimateGrossOffset` (`:77-78`).
Add `pitchAccuracy = pitchConfirmedHits / matchedCount`.

**Panel call site (`TimingMirrorPanel.tsx:283-286`):** build `makeVerifier(signal, sampleRate,
startedAt, refOnsetMidi)` closure; `refOnsetMidi = config.referenceAnalysis?.[key]?.onsetMidi ??
null`. Null label → `'unknown'` (time-only).

Ghosts/accents ride as label metadata but don't gate timing in this build.

---

## 5. DATA MODEL + ADMIN

`ReferenceAnalysis` (`block.ts:530-545`) gains `onsetMidi?: (number|null)[]` (index-aligned to
`onsetsSec`; null = time-only). **No Zod change** (plain TS interface). No DB migration
(`referenceAnalysis` is block-config JSON).

Admin flow stays "approve the markers" + now carries pitch:
1. Widen `ReferenceTransientEditor` `onChange` (`:59`) from `(onsetsSec)` → `({onsetsSec,
   onsetMidi})`.
2. Overlay chart-derived proposed labels (note name via `midiPitchToNoteName`,
   `fretboardCalculations.ts:326`); show a **mismatch badge** where proposal count ≠ marker
   count so the human resolves it once.
3. Persist both arrays (update `GrooveCardBlockForm.tsx` handler).

Existing approved blocks have no `onsetMidi` → time-only until re-approved.

---

## 6. BUILD ORDER (smallest-first, each independently testable)

1. **Fix stale comments + active-bassline chart bug.** Rewrite `alignToReference.ts` header
   (1-16, 47-54). `GrooveCardBlockView.tsx:1150`: pass the **active-bassline** chart (reuse
   `activeNotation` memo `:493-505`), not `config.bassNotation?.notes`. Widen panel prop type
   (`TimingMirrorPanel.tsx:67`). Type-check.
2. **`buildReferenceLabels.ts`** (pure, new). Test: open A = MIDI 33 = 55Hz; **`ExerciseNote.string`
   doc (`exercise.ts:40`: 1=E…4=G) is REVERSED vs `BASS_TUNINGS` (string 1 = highest)** — pin
   with the test.
3. **Contracts + admin binding.** Add `onsetMidi?` to `ReferenceAnalysis`; widen editor
   `onChange` + overlay labels + mismatch badge; update form persist.
4. **`verifyPitch.ts`** (pure, new — core DSP). Full-band YIN + CMND + parabolic + prior-judged
   + octave-snap. Test offline fixtures (confirmed/wrong/unknown/octave-slip).
5. **Wire the gate.** `verify?` into `alignToReference` + `scoreAgainstReference`; `makeVerifier`
   + panel call site. Test: wrong-pitch matched onset → miss+noise; no-label → today's grade.
6. **Sync guards.** Thread `transportAnchorWasNull` + `bpmChangedDuringTake`; refuse rather than
   grade a sheared take.

**Net-new lifts: Step 4 (pitch verifier) and Steps 2-3 (label association). Rest is wiring.**

---

## 7. OPEN QUESTIONS (verify live before trusting)

1. Is `getTransportStartTime()` ever null at play time? (Step 6 guard mandatory if so.)
2. ~~Does recorded-buffer-sample-0 == grid downbeat?~~ **RESOLVED** — ogg-padding-probe.mjs Δ=0.
3. Does `config.originalBpm` == the stem's recorded tempo? (`R` reads block-level, not
   `ReferenceAnalysis.originalBpm` `:542`.) Equal today; confirm per exercise.
4. Repeated-pitch index-slip — eyeball the mismatch badge on a real root-root-fifth bassline.
5. **R≠1 fidelity:** the uniform `t/R` stretch warps the recording's own push/pull. Faithful
   master only at native tempo. Decide: label off-tempo grading "approximate" or offer the coach
   only at native tempo.
