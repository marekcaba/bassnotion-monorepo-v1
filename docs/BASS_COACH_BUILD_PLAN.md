# Bass Coach — Build-Ready Plan (reference-mode grading)

**Status:** Plan / grounded in the real codebase. Extends the PROVEN grid timing-mirror
(offset −0.5ms, jitter 30.6ms). Design: [docs/BASS_COACH_REFERENCE_GRADING.md](./BASS_COACH_REFERENCE_GRADING.md).
**Date:** 2026-06-20.

**Goal of this plan:** make the build FIT the codebase — no duplication, no dead code, no breaking
existing groove-card features (gym, drill, dynamic-loop, sheet-playhead, waitlist). Reference mode is
an **additive sibling** to the grid path, gated by an admin-chosen per-exercise `gradingMode` field.

The headline measurement: grade a player's recorded bass take against the groove card's **own bass
stem** (`bassBuffer`) — onset timing, note length, dynamics — not just the ideal grid.

---

## 1. WHAT TO REUSE vs WHAT'S GENUINELY NET-NEW

### REUSE (extend, do not rebuild)

| Concern | Reuse this (file:line) | How |
|---|---|---|
| Mic capture (player take) | `timing-mirror/captureBassInput.ts` (raw constraints AGC/NS/EC off; `startedAtCtxTime` :46-49; `toMono` :183) | **Verbatim.** Single mic path. Also use `toMono(bassBuffer)` for the reference — no second capture, no re-implemented channel averaging. |
| Onset detection (BOTH sides) | `timing-mirror/bassOnsetDetector.ts` `detectBassOnsets` :135 (wraps drum-slicer `detectOnsetsDetailed` READ-ONLY via per-call options :140-154; drops synthetic origin onset :158) | Call it **twice**: on the player take (as today) AND on `toMono(bassBuffer)` for reference onsets. Pass reference-specific options; never edit `BASS_DEFAULTS` (:53-66) or the drum DEFAULTS. |
| Loop-grid bucketing | `timing-mirror/scoreAgainstGrid.ts` `snapOnsetToGrid` :87, count-in `beforeGrid` handling :95-107 | Use it to bucket BOTH player and reference onsets into bar+subdivision regions = the **alignment anchor** (the doc's tractability trick). Don't recompute `barSeconds`. |
| Clock anchor | `useGrooveCardPlayback.ts` `loopStartAudioTime` :1506, `loopDurationSeconds` :579, `getCurrentTime` :603, `bassBuffer` :159/1613, `R = currentBpm/originalBpm` :1110 | Zero new clock code. Reference onset → ctx clock: `referenceOnsetCtxSec = loopStartAudioTime + (onsetInBuffer / R)`. Both sequences then live in one `audioContext.currentTime` clock. |
| `GridParams` assembly | `TimingMirrorPanel.tsx` :196-203 (builds `loopStart/loopDuration/lengthBars/bpm` at the play transition) | Feed the SAME object to the reference scorer; don't re-derive bpm/barSeconds. |
| Human-scaled grade vocabulary | `timing-mirror/timingGrade.ts` `gradeTiming`/`TimingGrade`/`TIERS` :16-61 | Add `gradeLength()` / `gradeDynamics()` SIBLINGS reusing the tier/score/color shape. One grading language across all three dimensions. |
| Per-pair drift/jitter math | `scoreAgainstGrid.ts` already constructs a **fresh** `new BeatTimingAnalyzer()` (:148) | Feed it matched-pair errors the same way grid mode feeds grid errors. Never the live singleton. |
| RMS formula (for dynamics) | `SpectralAnalyzer.ts` `calculateDynamicRange` RMS sum-of-squares loop :306-310 | Copy the **RMS loop only** into a per-onset window helper. ⚠️ Do NOT copy the peak line :313 (footgun — see §2). |
| Admin field pattern | `GrooveCardBlockForm.tsx` `role` `<select>` :254 / `ReferenceDropFields` :409 (self-contained `{value,onChange}` + module default + normalize-on-read) | Author `gradingMode` via `updateField('gradingMode', …)` :56. Copy the `role` select shape (enum), no empty "None" option. |
| Contract + schema seams | `block.ts` `GrooveCardBlockConfig` :431 (next to `referenceDrop` :501) · `groove-card-block.schema.ts` :127 + `.refine` :221 · `GrooveCardBlockView.tsx` `withDefaults` :153 | One field on the existing interface, one key on the one Zod schema, one default-on-read seam. |
| Player-facing graded region | `GrooveCardBlockView.tsx` `isDrillBrick` block :1072; `ConquerOutcome.tsx` (Silver/Gold tiers greyed "until scoring") | The coach grade is the score ConquerOutcome waits for. Mount as a ConquerOutcome sibling. |
| Prod entitlement gate | `useEntitlement` / `capsEnabled` (:202) / subscriptions-table membership | Real prod enablement = authored exercise (`gradingMode` set) + member entitlement. NOT a new env flag. |

### GENUINELY NET-NEW (confirmed nothing to reuse — grep for `dtw|sequence align|levenshtein|needleman|smith-waterman` = ZERO hits)

1. **Player↔reference aligner** — grid-anchored regional aligner (bucket onsets into bar+subdivision via
   `snapOnsetToGrid`, align within regions, allow skips/extras). Net-new sibling in `timing-mirror/`.
2. **Note-offset / length detection on recorded audio** — where a recorded note ENDS (envelope-drop or
   next-onset-gap). No existing code (all `duration/noteEnd/envelope` hits are MIDI/synth/scheduler OUTPUT).
3. **Per-onset amplitude / dynamics** — windowed RMS/peak over `[onset, onset+attackWindow]`. No importable
   per-window helper exists (whole-buffer `calculateDynamicRange` only).
4. **Shared envelope-follower helper** — ONE helper that BOTH length-detection and dynamics call.
5. **`gradingMode` field + Zod key + `.refine` rule + form fieldset + read-default.**
6. **Mode-aware reference scorer + player-facing CoachPanel** (UI written fresh; modules reused).
7. **`gradeLength()` / `gradeDynamics()`** siblings in `timingGrade.ts`.

---

## 2. DUPLICATION TO AVOID (specific code NOT to re-implement)

1. **`BeatTimingAnalyzer.compareSourceTiming` (BeatTimingAnalyzer.ts:225-273) — the #1 trap.** It "compares
   two performances" but matches on identical `measureNumber+beatNumber` (index/grid-matched, :225) and its
   only consumer is `TimingDebugWindow.tsx:35` via the **live singleton**. It CANNOT handle skips/extras/
   different note counts — exactly what Frame 2 needs. **Do NOT fork it or wire it as the aligner.** You MAY
   copy its per-pair variance→correlation formula (:255-266) into a fresh module AFTER pairs are matched —
   never route onsets through the singleton; always `new BeatTimingAnalyzer()`.

2. **Bar-grid math is already triplicated** — `useReferenceDrop.ts:206`, `scoreAgainstGrid.ts:90`,
   `TimingMirrorPanel.tsx:202`. **Do not add a 4th copy.** Bucket via the existing `snapOnsetToGrid` and pass
   the SAME `GridParams`.

3. **Onset detection** — `detectBassOnsets` is the single bass path. Run it on both sides; **do NOT add a
   second detector for the reference stem.** Re-decode is unnecessary: `bassBuffer` is already in the preload
   cache (`useGrooveCardStemPreload.ts` `getBuffer`/`getVariantBuffer`).

4. **`SpectralAnalyzer.calculateDynamicRange` peak line (:313) `Math.max(...channelData.map(Math.abs))`** —
   spreading a Float32Array of hundreds of thousands of samples overflows the call stack. **Copy the RMS loop
   (:306-310), compute peak with a plain `for` loop.** Never `Math.max(...spread)` on capture data.

5. **`OnsetInfo.confidence` is spectral-FLUX (attack sharpness), not loudness** (`detectOnsets.ts:52-56`).
   Tempting but WRONG as a dynamics proxy. Dynamics must come from the capture Float32Array samples.

6. **Capture/clock/grid path** — do NOT fork `scoreAgainstGrid`'s grid path (proven −0.5ms/30.6ms; gym/drill
   dev work depends on it). The reference scorer is an ADDITIVE sibling.

7. **`TimingMirrorPanel.tsx` is throwaway probe scaffolding** (sliders, "spike step 4" copy, :1-19 self-
   describes as "NOT a member-facing feature"). **Reuse the four `timing-mirror/*` modules; write the player
   CoachPanel fresh.** Do NOT copy the panel wholesale.

8. **Config plumbing** — do NOT create a parallel `GradingConfig` type, a second Zod schema in
   `contracts/validation` (there is intentionally none for groove-card), a new admin form, or a second
   default-application step. One interface field, one schema key, one `withDefaults` default.

9. **`/drum-record` route** — a device-OUTPUT recorder (`createMediaStreamDestination` + MediaRecorder, no
   getUserMedia). NOT a mic-capture duplicate. Leave it untouched; don't generalize it with `captureBassInput`.

---

## 3. DEAD CODE (ignore — do NOT expand)

- **`useBeatTimingReport.ts`** — zero consumers (grep returns only its definition). It writes to the live
  `beatTimingAnalyzer` singleton — the exact thing the coach avoids. **Do NOT wire the coach through it.**
  It is orphaned; flag for deletion SEPARATELY, not as part of this build.
- **`/admin/grooves` library editor** — unused per memory (`groove-card-authoring-is-inline-in-tutorials`).
  Author `gradingMode` INLINE in `GrooveCardBlockForm.tsx`, never in `/admin/grooves`.
- **`TimingMirrorPanel.tsx`** — dev probe; not dead but throwaway for the player feature. Keep it behind
  `NEXT_PUBLIC_BASS_RECORDER_PROBE` for the dev loop; reuse its modules, not the shell.

---

## 4. THE `gradingMode` FIELD — exact placement + the backward-compat answer

### Where it goes (four edits, all additive)

1. **Type** — `libs/contracts/src/types/block.ts:431` `GrooveCardBlockConfig`, beside `referenceDrop` (:501).
   Add **OPTIONAL** (see backward-compat below):
   ```ts
   /** BASS COACH: how a player's recorded take is graded. 'grid' = vs the ideal
    *  metronomic grid (built); 'reference' = vs this card's own bass stem
    *  (onset/length/dynamics). Admin-authored, mandatory CHOICE at publish; defaulted
    *  to 'grid' on READ for legacy blocks (see GrooveCardBlockView withDefaults). */
   gradingMode?: 'grid' | 'reference';
   ```
   Re-export is automatic (`types/index.ts` → `index.ts export *`). **Rebuild contracts dist** (see §6).

2. **Zod** — `apps/backend/src/domains/tutorials/groove-card-block.schema.ts:127`. The object is
   **non-passthrough**: any undeclared field is STRIPPED on save (the trap warned on `chordChart` :157 and
   `referenceDrop` :206). Declare it or it silently never persists:
   ```ts
   gradingMode: z.enum(['grid', 'reference']).optional(),
   ```

3. **Form** — `apps/frontend/src/domains/admin/components/BlockEditor/configs/GrooveCardBlockForm.tsx`. Copy
   the `role` `<select>` shape (:254) — but with **no empty "None" option** and a publish-time required check.
   Wire via `updateField('gradingMode', value)` (:56). (If "reference" later reveals extra authoring such as
   which dimensions to grade, promote to a `ReferenceDropFields`-style fieldset — :409 — not a bare select.)

4. **Read-default** — `GrooveCardBlockView.tsx` `withDefaults` (:153), the sole default-on-read seam where
   `title/bpm/key/stems` are already backfilled:
   ```ts
   gradingMode: c.gradingMode ?? 'grid',
   ```
   Keep `gradingMode` PER-BLOCK (like `referenceDrop`/`completionCriterion`) — the View's library resolution
   (:171-183) deliberately leaves drill/grading fields on `rawConfig`. Do NOT add it to `GrooveLibraryItem`/
   `CreateGrooveInput` unless the team decides grading is intrinsic to a groove (Open Question).

### Backward-compat answer (the core tension: "mandatory, no default" vs existing data)

**Making `gradingMode` a hard-required Zod field BREAKS at two layers** (verified):
- **TS compile** — ~6 plainly-typed `: GrooveCardBlockConfig` literals would fail instantly:
  `groove-card-block.schema.spec.ts:22`, `waitlistGrooveCard.config.ts:37`, and `makeConfig()` in
  `noProvider.test.ts:59`, `waitlistCap.test.ts:65`, `loopSelection.test.ts:151`, plus `pitchShift.test.ts:211`.
  (`bassVariant.test.ts:171` casts `as unknown as` so it would NOT break.)
- **Zod** — a required key + `.refine` rule rejects EVERY existing groove-card block on its next admin save
  (none carry the field; config lives in `tutorials.blocks` JSONB, no DB migration). The schema spec
  `validConfig()` (:22, backs ~10 assertions incl. :87) flips red.

**RESOLUTION (recommended): decouple "mandatory CHOICE" from "required wire contract."**
- Keep `gradingMode?` **OPTIONAL** in both the TS interface and Zod (declared so it isn't stripped).
- **Default `'grid'` on READ** in `withDefaults` (:153) — the player never sees `undefined`.
- **Enforce the mandatory CHOICE in the admin FORM at publish time only** (block save UI) — not in the wire
  contract. This honors the design doc's "no ambiguously-graded exercise" intent at the authoring surface.
- Result: zero TS breakage, zero Zod rejection, zero migration, all spec tests stay green.

**Alternative (viable, pre-production):** since CLAUDE.md confirms no production users, a one-time JSONB
backfill (`gradingMode: 'grid'` on every groove-card block) lets you make the contract truly required. Heavier
(needs a script + spec updates). **Optional-with-read-default is strictly safer and is the recommendation.**

**Reject:** `z.enum(...).default('grid')` as "required" — `.default` only fires when the key is ABSENT, so it
silently coerces every legacy card to grid mode without an admin choosing, defeating the mandatory-choice intent.

---

## 5. REFERENCE-ONSET VALIDITY — the verdict

**VERDICT: `bassBuffer` is a SOUND reference. The architecture is de-risked; residual risks are
calibration/guarding, not architecture.**

**Why the source is sound:**
- `bassBuffer` is the clean, original-tempo/original-key decoded PCM straight from the file
  (`useGrooveCardStemPreload.ts:177`, variants :135), cached raw, never re-encoded/stretched.
- Pitch and tempo are **node params, not buffer edits** (`useGrooveCardPlayback.ts:1605-1608`: "Pitch-shift
  is applied at the node, not by swapping buffers"). `setBassVariant` (:842-877) is a PCM-only worklet swap.
  So `detectBassOnsets(toMono(bassBuffer))` reads original-BPM/original-key onset positions regardless of the
  user's live key/tempo. The ONLY thing that changes the onset SET is a variant/fill swap (a different
  recording), not a transform of the same recording.

**Tempo/clock/variant handling required:**
- **Tempo (R≠1):** signalsmith is a constant-ratio (linear-in-time) stretch (`PitchShiftAdapter.ts:194-209`),
  so detect onsets ONCE on the raw original-BPM buffer and **scale by 1/R** at score time:
  `referenceOnsetCtxSec = loopStartAudioTime + onsetInBuffer / R`, `R = currentBpm/originalBpm`. Do NOT
  re-detect per tempo. Cache reference onsets per `variantId` at original tempo.
- **Clock:** reference onsets and player onsets share one `audioContext` clock. The bass self-looping node
  starts at RAW T0 = `loopStartAudioTime` with NO stretch-latency pull (`RegionScheduler.ts:1066-1071`,
  onset-meter-proven). **Never anchor to `getAudioPhase`** (~185ms visual latency, explicitly rejected at
  `scoreAgainstGrid.ts:80-85`) and **never re-introduce a stretchLatency pull** on this path.
- **Offset semantics:** the reference onset is the SCHEDULED grid time (zero added latency); the player onset
  carries mic INPUT latency. This is the SAME situation grid mode already lives with (−0.5ms offset). Treat a
  constant offset as **calibration** (report it separately as latency/anticipation), grade feel on the
  de-meaned jitter component — exactly as `gradeTiming` already splits `offsetMs` from `jitterMs`.
- **Variant/fill swap mid-take:** **snapshot `bassBuffer` at take-START** (mirror `gridRef` snapshot,
  `TimingMirrorPanel.tsx:198`); refuse/segment a take during which `activeBassVariantId` changed. Don't
  re-read `bassBuffer` after stop — it may point at a swapped variant.
- **Sub-loop selection active:** the stem starts at `region.loopSlice.startSeconds`, not buffer 0
  (`RegionScheduler.ts:1052`; `useGrooveCardPlayback.ts:1008-1017`). For v1 **DISABLE reference grading while
  a sub-loop selection is active** (or subtract `startSeconds` before the `/R + loopStart` mapping).

**What MUST be TESTED FIRST (the cheapest de-risk, before any UI):**
- `BASS_DEFAULTS` (`bassOnsetDetector.ts:53-66`, sensitivity 2.1 etc.) were tuned against a HOT Clarett **DI**
  take to fix a 219-onset over-trigger. The clean authored stem is a different signal class. Running the
  live-DI preset on the stem is plausible but **UNVERIFIED**. A wrong preset corrupts the grading TARGET for
  every take. So: **dump `detectBassOnsets(toMono(bassBuffer))` for each real groove stem and ear-verify the
  onset count/positions against `bassNotation.notes` (`block.ts:470`) using the onset-meter/waveform-zoom dev
  tools.** If one shared preset doesn't hold across stems, add a per-exercise reference-detection preset.
- Add a **reference-side trust guard** (a sibling to the grid-mode `collisionRate` guard,
  `scoreAgainstGrid.ts:129-133): if detected reference onset count diverges from `bassNotation.notes` beyond a
  tolerance, **REFUSE to grade** rather than grade against a mis-detected target.

---

## 6. BREAKAGE RISKS + how each is avoided

| Risk | Avoided by |
|---|---|
| **Required field breaks TS compile + Zod (blocker)** | Optional-with-read-default (§4). Zero TS literal breakage, zero Zod rejection, spec tests stay green. |
| **Non-passthrough schema STRIPS `gradingMode`** | Declare the key in `grooveCardBlockConfigSchema` (:127) — heed the `chordChart`/`referenceDrop` strip comments (:157/:206). |
| **Contracts dist desync (local-only)** | `@bassnotion/contracts` → `libs/contracts/dist` (gitignored). After editing `block.ts`, rebuild BEFORE touching consumers: `npx nx build @bassnotion/contracts`. Backend Zod is a SEPARATE hand-written copy — edit BOTH `block.ts` and `schema.ts`. CI/Vercel rebuild from source, so no stale dist reaches prod. |
| **Shared onset detector interference** | `detectOnsetsDetailed` is PURE — no module-level state (grep: NONE); `opt = {...DEFAULTS, ...options}` (:136), all buffers call-local; bass wrapper HPFs a `Float32Array.from()` COPY (:144). Running it on `bassBuffer` cannot affect the live drum slicer. Pass options; never mutate `BASS_DEFAULTS`/drum DEFAULTS. Call it OFF the play hot-path (take-start / memoized per variant), not per frame — it's a synchronous FFT over the whole stem. |
| **AudioContext fragility** | `captureBassInput` only READS the context via `WindowRegistry.getAudioContext()` (read-only :139-147), makes an INPUT-only `MediaStreamSource` never connected to `destination`, `track.stop()` on teardown (mic-leak guard :105), disposes on `onGlobalStateChange 'closed'` (:124-130). No `new AudioContext()`/`close()`/rebind. Keep this lifecycle verbatim. |
| **Bass-mute leaks across features** | `TimingMirrorPanel.tsx:108` sets `setStemMuted('audio-bass', true)` on arm with NO restore — the dev panel tolerates it, but the gym/drill/dynamic-loop/sheet-playhead share the card. **The real CoachPanel MUST capture `isBassMuted` at arm and restore the prior state on stop/error/unmount.** |
| **Forking the proven grid path** | Reference scorer is an ADDITIVE sibling; do not alter `scoreAgainstGrid`'s grid path (−0.5ms/30.6ms). |
| **Singleton history interleave** | Always `new BeatTimingAnalyzer()` per call (like `scoreAgainstGrid.ts:148`); never the exported singleton; never `compareSourceTiming` as the matcher. |
| **Stack-overflow in dynamics** | Plain `for`-loop peak, never `Math.max(...spread)` (the `SpectralAnalyzer.ts:313` footgun). |
| **`withDefaults` is load-bearing for every card** | A required field with no default here would blank every pre-existing card. Default `'grid'` there exactly like intrinsics. Preserve the `originalBpm` vs `tempoOverride` logic (:157-162) — don't collapse them. |

---

## 7. THE SAFE BUILD SEQUENCE

Ordered cheapest-de-risk-first. Each step: BUILD / REUSES / VALIDATE / MUST-NOT-TOUCH.

### Step 0 — De-risk reference-onset extraction on the REAL stem (NO UI, NO contract)
- **Build:** a throwaway harness/script (or extend the existing `TimingMirrorPanel` dev probe) that runs
  `detectBassOnsets(toMono(bassBuffer), bassBuffer.sampleRate, opts)` and dumps onset count + positions.
- **Reuses:** `captureBassInput.toMono` (:183), `detectBassOnsets` (:135), `useGrooveCardPlayback.bassBuffer`
  (:159/1613), onset-meter/waveform-zoom dev tools (`docs/dev-tools/audio-audit/`).
- **Validate (EAR-FIRST):** detected reference onset count/positions match `bassNotation.notes` (`block.ts:470`)
  for each real groove stem. Decide: one shared reference preset, or per-exercise preset?
- **MUST NOT TOUCH:** `BASS_DEFAULTS` / drum DEFAULTS (pass options only); `getAudioPhase` as a clock.
- **Gate:** do not proceed to the scorer until reference detection is trustworthy on real stems.

### Step 1 — The `gradingMode` field (cheap; forces the authoring decision; unblocks everything)
- **Build:** the four additive edits in §4 (type, Zod, form select, read-default). OPTIONAL field + read-default.
- **Reuses:** `role` `<select>` (:254), `updateField` (:56), `withDefaults` (:153), the one Zod schema (:127).
- **Validate:** rebuild contracts dist; `groove-card-block.schema.spec.ts` stays green; add a "keeps an
  admin-authored `gradingMode` (not stripped on save)" test mirroring the `referenceDrop` strip test (:133-149);
  author a card in `/tutorials`, confirm the value persists round-trip.
- **MUST NOT TOUCH:** schema passthrough behaviour; `withDefaults` `originalBpm`/`tempoOverride` logic;
  `/admin/grooves`; `GrooveLibraryItem`/`CreateGrooveInput` (keep it per-block).

### Step 2 — Per-onset amplitude helper + envelope follower (shared infra for length & dynamics)
- **Build:** ONE `timing-mirror/` helper: `{rms, peak}` over `[onset, onset+attackWindow]` on a Float32Array;
  ONE shared envelope follower that both length-detection and dynamics will call.
- **Reuses:** `SpectralAnalyzer` RMS sum-of-squares loop (:306-310) — RMS ONLY; capture's raw mono samples +
  sampleRate (`captureBassInput.ts:49`).
- **Validate:** unit-test against a synthetic signal with known accent contour; peak via plain `for`-loop.
- **MUST NOT TOUCH:** `Math.max(...spread)` (:313 footgun); `OnsetInfo.confidence` as a dynamics proxy.

### Step 3 — Grid-anchored regional aligner (the genuinely net-new core)
- **Build:** a `timing-mirror/` sibling that buckets player + reference onsets into bar+subdivision regions and
  aligns WITHIN regions (allow skips/extras; unmatched = miss/extra).
- **Reuses:** `snapOnsetToGrid` (:87) for bucketing; the SAME `GridParams` from `TimingMirrorPanel.tsx:196-203`;
  the `beforeGrid` count-in drop (:95-107) on BOTH sequences; reference onset mapping
  `loopStartAudioTime + onsetInBuffer/R`; per-pair stddev/correlation (copy `BeatTimingAnalyzer.ts:255-266` math
  into a fresh module) AFTER matching.
- **Validate:** a take that skips a note and a take that adds a note align correctly; confirm regional alignment
  suffices (the doc's open question) before reaching for full DTW.
- **MUST NOT TOUCH:** `compareSourceTiming` as the matcher; the live `BeatTimingAnalyzer` singleton; a 4th copy
  of bar-grid math; `scoreAgainstGrid`'s grid path.

### Step 4 — Reference-timing scorer + `gradeTiming` reuse (ship the headline first)
- **Build:** mode-aware reference scorer: matched-pair onset errors → `gradeTiming`. Report player↔reference
  OFFSET separately from JITTER (offset = calibration/latency, jitter = feel). Add the reference-side trust
  guard (count-match vs `bassNotation.notes` + a `collisionRate` sibling) that REFUSES to grade a bad target.
- **Reuses:** fresh `new BeatTimingAnalyzer()` (:148 pattern); `gradeTiming` (:16-61).
- **Validate:** on a clean self-played take vs the stem; offset stable, jitter sane; trust guard refuses on a
  deliberately mis-detected stem.
- **MUST NOT TOUCH:** grid-mode scorer; the singleton.

### Step 5 — Note length (offset detection) → `gradeLength()`
- **Build:** note-end detection (envelope-drop threshold vs next-onset-gap) on both sequences via the Step-2
  envelope follower; `gradeLength()` sibling in `timingGrade.ts`.
- **Validate:** EAR-FIRST on the clean stem first, then live; staccato vs legato separable.
- **MUST NOT TOUCH:** the grade vocabulary scale (extend, don't fork).

### Step 6 — Dynamics → `gradeDynamics()`
- **Build:** per-onset RMS/peak (Step 2) on both sequences; grade the RELATIVE accent contour (normalize per
  take), NOT absolute dB; `gradeDynamics()` sibling.
- **Validate:** ghost-vs-accent contour grades correctly across two takes at different DI levels.
- **MUST NOT TOUCH:** absolute-amplitude comparison; `confidence` as loudness.

### Step 7 — Player-facing CoachPanel + prod gating (fresh UI, reused modules)
- **Build:** a CoachPanel written FRESH, mounted in the `isDrillBrick` graded region
  (`GrooveCardBlockView.tsx:1072`) as a ConquerOutcome sibling, keyed off `config.gradingMode`. Grid mode shows
  the built grid grade; reference mode shows the 3-dimension coach grade. **Capture `isBassMuted` at arm,
  restore on stop/error/unmount.**
- **Reuses:** the four `timing-mirror/*` modules + Steps 2-6 siblings; `playback.bassBuffer/audioContext/
  loopStartAudioTime/loopDurationSeconds/lengthBars`; `useEntitlement`/`capsEnabled` (:202); ConquerOutcome.
- **Validate:** authored reference exercise + member entitlement renders the coach in prod-shaped build; the
  `NEXT_PUBLIC_BASS_RECORDER_PROBE` dev probe still tree-shakes out of prod; bass un-mutes after a take.
- **MUST NOT TOUCH:** the env-flag probe gate (leave it static/direct so Next DCE strips it); `ConquerOutcome`'s
  existing criterion controls (extend, don't rewire); the membership/entitlement path (reuse, don't fork);
  `bassBuffer/audioContext/loop*` semantics (gym/drill/dynamic-loop/sheet-playhead depend on them).

---

## 8. OPEN QUESTIONS (need a human/test decision)

**Before Step 0:**
- Does one shared reference-detection preset hold across all real stems, or is a per-exercise preset needed
  (authored field vs auto-tuned, validated against `bassNotation.notes` count)?

**Before Step 1:**
- Mandatory-no-default vs backward-compat: confirm **optional-with-read-default** (recommended) vs a one-time
  JSONB backfill for a hard contract. (Pre-production status makes either viable; the former is safer.)
- Is `gradingMode` a property of the BLOCK (per-exercise, recommended — leave `GrooveLibraryItem` untouched) or
  of the GROOVE (intrinsic — needs `grooves.ts` + library Zod + the View resolution merge :171-183)?
- Should "reference" mode be selectable only when the card HAS a gradeable bass stem? A cross-field guard in the
  `.refine` (`stems.bass` non-empty) — but the schema allows empty stems during draft auto-save (:39).

**Before Step 3:**
- Does grid-anchored REGIONAL alignment handle real skips/extras, or is full free-sequence DTW required for
  un-looped material? (Test with a skip-a-note take.)

**Before Step 4:**
- Does reference mode grade PITCH (exact notes) or rhythm/feel only? v1 is rhythm-only per the doc; no
  per-note pitch-detection module exists (`KeyDetector` is whole-buffer key). Confirm v1 scope.

**Before Step 5:**
- Note-offset detection: envelope-drop threshold vs next-onset-gap? Ear-test on the clean stem first.

**Before Step 6:**
- Dynamics comparability: grade RELATIVE accent contour (normalized per take), not absolute level — confirm the
  normalization decision (DI/rig levels make absolute amplitude incomparable).

**Before Step 7 (placement + surface):**
- Mount as a ConquerOutcome sibling (below the card) or a new `GrooveCardShell` slot (inside the frame)?
- Coach only on drill bricks (`isDrillBrick` region), or also plain tutorial cards with `gradingMode` set (then
  broaden the mount to `config.gradingMode != null` independent of role/criterion)?
- Tie to the GYM membership entitlement specifically (trains Pocket, a gym L2), or the generic `useEntitlement`
  caps band? And `mode==='block'` only — does the coach run on the waitlist surface at all? (The env-probe runs
  everywhere today; the real feature likely should be `mode==='block'`-only.)
- Time signature beyond 4/4: the playback clock HARDCODES 4/4 (`loopDuration ×4`, count-in 4/4) while
  `bassNotation.timeSignature` can declare otherwise (`block.ts:473`). Confirm reference mode is **4/4-only for
  v1**, or `loopDurationSeconds` itself is wrong for non-4/4.
