# Bass Coach — Premium Advanced Grading Tier ($24 base / $34 premium)

Build-ready, layered on the sync-proven timing+pitch base
([BASS_COACH_RECORDING_REFERENCE_PLAN.md](BASS_COACH_RECORDING_REFERENCE_PLAN.md)). All
`file:line` verified against source. Honest precision ceilings — do NOT exceed them in UI claims.

---

## 1. THE LAYERED MODEL

One **base grader** ($24, `bass_coach_basic`) scores **timing + pitch** vs the real recorded
reference take. **Coach-pitch** (detecting the recording's actual pitch per onset, offline +
admin-approved) is in the BASE — it's the "what" Yousician sells *and* the substrate that grounds
every dimension in what was really played. Each **$34 premium dimension** (`bass_coach_premium`) —
note length, ghost/mute, dynamics — is a **pure additive post-hoc read** over the base's matched
onset pairs: read the pair index, slice the player window, compare to a per-onset reference value,
attach one optional sub-score. It never edits the base timing/pitch math; **ungated, the $24 grade
is byte-identical**. Hammer/pull/slide are in NEITHER tier (they break one-transient-one-note) →
future "Technique" tier.

---

## 2. COACH-PITCH (ships in $24 BASE)

Net-new DSP `verifyPitch.ts` (the ONLY new estimator; confirmed absent). **YIN** (autocorr-diff +
CMND + parabolic interp), time-domain. Window: start `onsetSec+0.010`, length
`max(0.050, 2.5/f_min)` clamped to `min(samplesToNextOnset, ~3000@48k)` (low-B B0≈30.9Hz needs
~65ms). Lag-bound search to bass register `sr/350 … sr/28` (octave-error guard). f0→MIDI via the
`12*log2(f/C0)` **formula** from `KeyDetector.ts:173-178` — **NOT `frequencyToChromaBin()`** whose
`%12` (`:179`) discards the octave (E1 vs E2). Return `{midi, confidence, cents}` (cents free, stored
for premium-deferred intonation).

**`null` is first-class:** below confidence floor (staccato, rushed low-B, dead/ghost) → store `null`,
never a guess. Gaps, not wrong values.

**Pitch ANNOTATES, does not REJECT** (key correction): match purely on timing as today, then a
**post-loop pitch pass** attaches `playerMidi`/`pitchOk` to matched pairs. NO `verify?` 4th param on
`alignToReference` — keeps the $24 timing grade byte-identical whether pitch runs or not.
`pitchAccuracy = pitchConfirmedHits / (matchedCount − nullCount)`; surface `pitchCoverage` (nulls lower
coverage, not score).

**Connectedness — honestly scoped:** coach-pitch fixes the **count-mismatch** case (ghost-below-floor,
tie) by disambiguating transient↔chart via pitch agreement. It does NOT fix true legato (1 transient /
2 pitches = fewer onsets than notes) → §4.

Storage: `onsetMidi?: (number|null)[]`, `onsetCents?: (number|null)[]` on `ReferenceAnalysis`
(`block.ts:545`). Admin authors offline on the clean reference take, approves (detect-once model).

**Ceiling:** RELIABLE (predicted >95% semitone, pending real-DI validation) for discrete attacks E1+,
~50-65ms sustain. APPROXIMATE→`null` for staccato / rushed low-B. Intra-note transitions out of scope.

---

## 3. THE THREE PREMIUM DIMENSIONS ($34) — precision-confidence order

All are post-hoc reads over `alignment.matched`, reuse **already-built unwired** primitives in
`onsetAmplitude.ts` (`windowAmplitude`/`onsetAmplitude`/`computeEnvelope`/`noteLengthFromEnvelope`),
meaningful only in `gradingMode='reference'`.

### 3a. DYNAMICS / ACCENTS — most reliable, ship first (REUSE, zero new DSP)
Per matched onset `onsetAmplitude → {rms,peak}`; use **rms** (peak is noisy). **Normalization is the
answer to "loud and soft next to each other, NOT one global threshold":** `relRms[i] = rms[i] /
median(rms over take)`, `relDb[i] = 20*log10(relRms)`. 0dB = average note in THIS take; +6≈accent,
−12≈ghost. Computed identically on reference + player. Reference stored in dormant `dynamics?`
(`block.ts:541`). Chart intent = `is_accented`/`accent_level` (`exercise.ts:62-63`) — **label/feedback,
recording is the target.**
- RELIABLE: "accented the right notes / shape tracks the recording" (±1-2dB).
- APPROXIMATE: "6dB louder than that" (±2-3dB).
- ASPIRATIONAL—DON'T SHIP: absolute dB.
- Refusal guards: relDb IQR <~3dB → `dynamicsUntrustworthy:'compressed-input'` ("disable auto-gain");
  <~6-8 notes → refuse (unstable median).

### 3b. NOTE LENGTH — weakest core dim, ship second, COARSE (REUSE)
`computeEnvelope` + `noteLengthFromEnvelope` → ratio `playerLen/refLen` (tempo-relative). Reference =
dormant `lengthsSec?` (`block.ts:538`). Chart `duration`/`durationTicks` = sanity bound only (grading
vs ticks punishes the human phrasing we exist to capture).
- RELIABLE: gross staccato-vs-let-ring; "held into next note."
- APPROXIMATE: medium-vs-legato (~coin-flip-plus).
- NOT MEASURABLE: let-ring past next onset (envelope clamps at nextOnsetSec).
- **Ship as binary coaching only** ("clipping" / "let ring"). Don't advertise medium-vs-legato until
  `release`/`endFraction` ear-calibrated on a labelled corpus (net-new VALIDATION lift, §7 step 7).

### 3c. GHOST / MUTE — mixed, ship third (REUSE + ~6-line ZCR wrapper)
`relDyn` (RMS/median) + length + windowed ZCR (reuse `SpectralAnalyzer.ts:248-258` body). Reference =
low `dynamics` + short `lengthsSec`. Chart = `is_ghost_note`/`is_muted`/`mute_type` (`exercise.ts:61,
65-66`).
- RELIABLE: ghost-as-quiet (RMS contrast) — **grade this.**
- APPROXIMATE: dead-vs-quiet-real — yes/no hint, not a number.
- ASPIRATIONAL—DON'T GRADE: mute_type (palm/fretting/dead) — display-only boolean at most.
- Sub-floor ghost → no player onset → MISS at that index; grade **leniently** (near-inaudible ghost is
  correct). Requires authoring the reference with a lowered onset floor.

---

## 4. HAMMER / PULL / SLIDE — DEFER to a separate "Technique" tier
NOT $24, NOT $34. Reasons: (1) breaks the one-transient→one-pair invariant (legato = 1 transient / 2+
pitches; needs a parallel continuous-f0 contour machine + a `legatoSegments?` field + a new admin
contour-approval UI). (2) Fast H/P vs fast re-pluck = ASPIRATIONAL (~coin-flip-70%, can't signal when
guessing); `minOnsetGapSeconds:0.12` (`bassOnsetDetector.ts:63`) can't place two events <120ms apart.
(3) Brand risk — advanced players catch wrong calls instantly. Label a future tier "Technique, beta,"
slides-first.

---

## 5. ENTITLEMENT — $24 / $34

Feature keys in `FEATURE_KEYS` (`features.ts:20-27`): `bass_coach_basic`, `bass_coach_premium` (first
non-LeverCaps keys — `linesAndFills` is precedent; DB `feature_key` is TEXT, no schema change, only
seed rows; **rebuild contracts dist**).

**The $34 SKU fix (biggest flaw, solved):** a recurring $34 is a SUBSCRIPTION; `getGrantedFeatures`
only unions *purchase* rows and `getMembershipProductId` does `.find(type==='membership')` (first wins
— two memberships collide). `hasActiveSubscription` is a bare boolean. **Fix (no schema change):** the
`subscriptions` row already stores `stripe_price_id` (`subscription.repository.ts:11`) → resolve
`coachTier` from the active price-id inside `getGrantedFeatures` (`entitlement.service.ts:131-154`):
seed `_basic` on membership, `_premium` on a tier product keyed by env premium price-id. **Real small
service change** (intermediate designs' "zero service changes" was false). Fails dark (unknown price-id
→ base only).

**Where checked:** backend `getGrantedFeatures` is the real gate (anon→[], admin→all keys); gate the
coach path with the `grooves.controller.ts:119-131` pattern; wrap each premium block in
`if (granted.includes('bass_coach_premium'))`. Frontend = UX hint only (`grantedFeatures.includes`).
Admin grants at `/admin/products`; MUST add `FEATURE_LABELS` for both keys (`ProductEditor.tsx:31-38`
is exhaustive → won't compile otherwise). **Prod-migration landmine:** seed rows MUST land in prod via
the gated workflow (local hits prod), else `getGrantedFeatures` 500s; fails closed until seeded.

**Tier-leak / persistence:** premium dims compute in `scoreAgainstReference` (frontend). **CONFIRMED
2026-06-21: TimingMirrorPanel persists NOTHING server-side** → FE-gating is acceptable as a labeled
preview NOW. WHEN coach grades feed progress/streaks/teacher dashboard, the authoritative grade MUST be
recomputed server-side behind the `bass_coach_premium` gate.

---

## 6. DATA MODEL + ADMIN
`ReferenceAnalysis` (`block.ts:531-545`) gains: `onsetMidi?`, `onsetCents?` (net-new),
`ghostMuteClass?: ('full'|'ghost'|'muted'|null)[]` (net-new), wires dormant `lengthsSec?`/`dynamics?`,
uses `originalBpm?` for length-ratio tempo-map. `legatoSegments?` DEFERRED. All optional → no migration
(JSON blob). `ReferenceScore`/`ReferenceScoreOptions` (`scoreAgainstReference.ts:20-53`) gain optional
sub-score fields + a `premium?` bag (present only when granted).

Admin (the real cost): `ReferenceTransientEditor.tsx` today only draws onset markers. Add an
"analyze reference" offline pass computing all per-onset arrays + a **chart cross-check** (detected
`onsetMidi` vs chart note/string/fret → flag legato/tie/sub-floor-ghost desync for admin review), then
hand-correct + approve (detect-once-then-approve, never live re-detect). Author ghost references with a
lowered onset floor.

---

## 7. BUILD ORDER (smallest-first, base-then-premium)
1. **Contracts + entitlement keys** — add fields to `ReferenceAnalysis`/`ReferenceScore`/`Options`;
   `bass_coach_basic`/`_premium` to `FEATURE_KEYS`; `FEATURE_LABELS` entries; rebuild contracts.
2. **Entitlement wiring** [NET-NEW SERVICE] — `getActivePriceId`; price-id→premium grant in
   `getGrantedFeatures`; seed migration; gate the coach path; **db-push seed to PROD**.
3. **`verifyPitch.ts`** [NET-NEW DSP — only new estimator] — YIN `{midi,confidence,cents}`, full MIDI
   (not `%12`). Unit-test E1…G2, null below floor, octave preserved.
4. **Admin reference-analysis authoring pass** [NET-NEW UI — load-bearing prereq for ALL dims] —
   compute+approve `onsetMidi`/`onsetCents`/`dynamics`/`lengthsSec`/`ghostMuteClass` + chart-desync
   warnings.
5. **Base pitch wiring** — post-loop annotate over `matched` (no `verify?`); `pitchAccuracy`/
   `pitchCoverage` excluding nulls; call at `TimingMirrorPanel.tsx:283-286`. Base timing unchanged.
6. **DYNAMICS** (premium #1) [REUSE] — median-relative relDb, shape-correlation, accent hits, refusal
   guards. Gate `_premium`.
7. **NOTE-LENGTH** (premium #2) [REUSE + NET-NEW VALIDATION] — ratio, 2-band; ear-calibrate
   release/endFraction before any precision claim. Ship coarse.
8. **GHOST/MUTE** (premium #3) [REUSE + ZCR wrapper] — graded on amplitude contrast; lenient sub-floor
   miss; mute-type display-only.
9. **(LATER, separate tier)** Technique/Pro — contour f0 + `legatoSegments?` + contour UI + 3rd key.

---

## 8. OPEN QUESTIONS
1. ~~Coach grade persisted server-side?~~ **RESOLVED 2026-06-21: panel-only, persists nothing** → FE
   gating OK as preview now; server recompute required only when grades feed progress/teacher rails.
2. Exact $34 price-id mechanism — confirm it's a distinct Stripe price on the subscription (so
   `getActivePriceId` distinguishes it). Row stores `stripe_price_id`; confirm the env→price-id map.
3. `verifyPitch` accuracy on real low-B + fast 16ths — measure null rate before claiming pitch
   precision (the >95% is a prediction).
4. `release`/`endFraction` length constants — A/B vs ear-labelled staccato/let-ring before non-binary
   length claims.
5. Ghost `<0.35` relDyn cutoff + dynamics dB floor — unvalidated; ear-verify on real ghosted vs full.
6. Confirm the two non-lever feature keys don't break the cap-derivation path
   (`useEntitlement.ts:117-143`).
