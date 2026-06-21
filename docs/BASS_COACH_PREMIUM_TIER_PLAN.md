# Bass Coach — Premium Advanced Grading Tier ($24 base / $34 premium)

Build-ready, layered on the sync-proven timing+pitch base
([BASS_COACH_RECORDING_REFERENCE_PLAN.md](BASS_COACH_RECORDING_REFERENCE_PLAN.md)). All
`file:line` verified against source. Honest precision ceilings — do NOT exceed them in UI claims.

---

## 0. THE AUTHORED-ANNOTATION MODEL (decided 2026-06-21 — supersedes auto-classification)

**Two product decisions reshape this plan and make it easier + more real-world possible:**

1. **Recording + the coach's per-onset labels = the ground truth.** The teacher records the take
   AND annotates each onset at authoring time ("this is a ghost, this is a hammer-on start, this is
   a pull-off, this note is muted"). The MIDI chart drops to an OPTIONAL authoring-time cross-check
   (catch a slip), never a grade-time source. This is what makes "play it exactly like me" literally
   what the system measures — the recording carries the coach's exact feel/push/ghost/length, and
   the labels tell the scorer which dimension matters per note.

2. **Outcome-first technique grading.** A hammered/pulled/slid note is graded on whether the RIGHT
   PITCH arrived at the RIGHT TIME/LENGTH (verification against a known target — reliable), with the
   MECHANISM (hammered vs re-plucked) reported as a bonus "detected" hint only when confident. A
   hammer-on that lands the note clean *is* a good hammer-on.

**Why this is the big simplification:** it moves the hard CLASSIFICATION problem from grade-time
(automatic, on an unknown student signal — ~coin-flip on a DI) to authoring-time (the human teacher,
once, on their own recording where they know the truth). The detector stops needing to be smart; it
only MEASURES the student against a known, hand-blessed answer. This:
- removes the two worst auto-detection risks — technique and ghost become LABELS not detections;
- makes the chart optional (recording + labels are truth; MIDI is a nice-to-have cross-check) →
  the fragile chart↔recording index-pairing problem largely evaporates;
- promotes hammer/pull/slide from "aspirational, deferred" (old §4) to **gradeable on OUTCOME now**,
  in the $34 tier — the mechanism is a bonus, the outcome (pitch+time+length) is the grade.

**The scorer becomes LABEL-DRIVEN:** each onset's authored label selects which measurements apply.
`'normal'` → timing+pitch (+length/dynamics if premium). `'ghost'` → timing + dynamics-contrast
(don't expect strong pitch). `'hammer-start'`/`'pull-start'` → did the target pitch arrive at the
right time/length (outcome); mechanism hint if confident. `'muted'` → percussive character, lenient
pitch. The label is the teacher's instruction to the grader.

**Data:** add `technique?: OnsetTechnique[]` to `ReferenceAnalysis` (index-aligned to `onsetsSec`),
`OnsetTechnique = 'normal'|'ghost'|'hammer-start'|'pull-start'|'slide'|'muted'`. Authored + approved
in the reference editor (Step 4 gets a per-marker technique dropdown). All optional → no migration.

**The one honest catch (unchanged by labels):** even with your label, detecting whether the STUDENT
actually hammered vs re-plucked is the same coin-flip on their DI. But your label narrows it from
blind classification to "did the target pitch arrive near here (with/without a strong transient)" —
a verification, not a classification. Where even that's unreliable, we grade the OUTCOME and skip the
mechanism. Never claim mechanism precision we can't deliver.

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

## 4. HAMMER / PULL / SLIDE — graded ON OUTCOME in $34 (revised per §0 decisions)

**Revised:** the authored-annotation + outcome-first decisions (§0) move the *outcome* grade of
hammer/pull/slide INTO the $34 premium tier; only the *mechanism* grade (did they hammer vs re-pluck)
stays deferred. The teacher LABELS the technique onset (`'hammer-start'`/`'pull-start'`/`'slide'`) and
names the target — so we grade a VERIFICATION, not a classification:

- **OUTCOME (graded in $34, RELIABLE):** did the target pitch arrive at the right time + length?
  This is just the base pitch-verify (`verifyPitch`) + length measurement applied at the labeled
  position — reuses machinery we're already building. A clean-landing hammer-on scores well; a flubbed
  one (wrong pitch / late / didn't ring) scores poorly. Musically this IS the grade that matters.
- **MECHANISM (bonus hint, NOT a grade):** "hammered" vs "re-plucked" reported only when confident —
  i.e. when the detector clearly sees a pitch change WITHOUT a fresh transient (hammer) vs WITH one
  (re-pluck). When ambiguous (the common fast case) → show nothing, never guess. `minOnsetGapSeconds:
  0.12` (`bassOnsetDetector.ts:63`) bounds how close two events resolve, so mechanism is genuinely
  best-effort; the OUTCOME grade does not depend on it.

**Still deferred to a future "Technique/Pro" tier:** continuous-f0 contour grading (how smooth the
slide glide is, mid-note pitch trajectory) — needs the parallel sliding-window-f0 contour machine +
a `legatoSegments?` field + contour-approval UI. The point-pitch outcome grade above does NOT need
that; it just checks the target pitch landed.

**Brand-safe by construction:** we grade only what we can verify (outcome), and the mechanism hint is
explicitly best-effort/optional — never a confident wrong call an advanced player would catch.

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
**`technique?: OnsetTechnique[]`** (net-new, the AUTHORED label per onset — §0;
`OnsetTechnique = 'normal'|'ghost'|'hammer-start'|'pull-start'|'slide'|'muted'`), wires dormant
`lengthsSec?`/`dynamics?`, uses `originalBpm?` for length-ratio tempo-map. `ghostMuteClass?` from the
earlier auto-classify design is now SUBSUMED by the authored `technique?` (the teacher labels ghost/
muted directly — no auto-derivation needed; keep an optional auto-*proposal* in the editor as a
starting point the human approves). `legatoSegments?` (continuous contour) DEFERRED. All optional →
no migration (JSON blob). `ReferenceScore`/`ReferenceScoreOptions` (`scoreAgainstReference.ts:20-53`)
gain optional sub-score fields + a `premium?` bag (present only when granted).

**The scorer is LABEL-DRIVEN (§0):** `scoreAgainstReference` reads `technique[subIndex]` per matched
pair and dispatches which measurements apply (normal→timing+pitch; ghost→timing+dynamics-contrast;
hammer/pull/slide→outcome = target-pitch-arrived + length, mechanism-hint best-effort; muted→
percussive, lenient pitch). No label / `'normal'` → today's timing+pitch path exactly.

Admin (the real cost, now richer per §0): `ReferenceTransientEditor.tsx` today only draws onset
markers. Add (1) an "analyze reference" offline pass computing `onsetMidi`/`onsetCents`/`dynamics`/
`lengthsSec` + an OPTIONAL technique *proposal* (ghost-from-low-dynamics etc.) the human can accept;
(2) **a per-marker TECHNIQUE control** (dropdown: normal/ghost/hammer-start/pull-start/slide/muted) —
the teacher's hand-authored label, the heart of the §0 model; (3) the optional chart cross-check
(detected `onsetMidi` vs chart note/string/fret → flag desync) — now a nicety, not load-bearing, since
recording+labels are truth. Then hand-correct + approve (detect-once, never live re-detect). Author
ghost references with a lowered onset floor so sub-floor ghosts land in the arrays.

---

## 7. BUILD ORDER (smallest-first, base-then-premium)
1. **Contracts + entitlement keys** — add fields to `ReferenceAnalysis`/`ReferenceScore`/`Options`;
   `bass_coach_basic`/`_premium` to `FEATURE_KEYS`; `FEATURE_LABELS` entries; rebuild contracts.
2. **Entitlement wiring** [NET-NEW SERVICE] — `getActivePriceId`; price-id→premium grant in
   `getGrantedFeatures`; seed migration; gate the coach path; **db-push seed to PROD**.
3. **`verifyPitch.ts`** [NET-NEW DSP — only new estimator] — YIN `{midi,confidence,cents}`, full MIDI
   (not `%12`). Unit-test E1…G2, null below floor, octave preserved.
4. **Admin reference-analysis authoring pass** [NET-NEW UI — load-bearing prereq for ALL dims] —
   compute+approve `onsetMidi`/`onsetCents`/`dynamics`/`lengthsSec`; **per-marker TECHNIQUE dropdown**
   (`technique[]`, the §0 authored label) with optional auto-proposal; optional chart cross-check.
5. **Base pitch wiring** — post-loop annotate over `matched` (no `verify?`); `pitchAccuracy`/
   `pitchCoverage` excluding nulls; call at `TimingMirrorPanel.tsx:283-286`. Base timing unchanged.
6. **Label-driven scorer dispatch** — `scoreAgainstReference` reads `technique[subIndex]` per pair,
   selects which dims apply (§0/§6). `'normal'`/no-label = today's path exactly. Each dim's gate +
   measurement attaches per the label. *Test: a `'ghost'` onset grades dynamics not pitch; a `'normal'`
   onset is byte-identical to pre-label scoring.*
7. **DYNAMICS** (premium #1) [REUSE] — median-relative relDb, shape-correlation, accent hits, refusal
   guards. Gate `_premium`. (Also the `'ghost'`-label contrast grade.)
8. **TECHNIQUE OUTCOME** (premium #2 — newly in-tier per §4) [REUSE] — for `'hammer-start'`/
   `'pull-start'`/`'slide'` labels: grade target-pitch-arrived (verifyPitch at the labeled position) +
   length; mechanism-hint best-effort only when confident. No new DSP — reuses pitch + length.
9. **NOTE-LENGTH** (premium #3) [REUSE + NET-NEW VALIDATION] — ratio, 2-band; ear-calibrate
   release/endFraction before any precision claim. Ship coarse.
10. **MUTE character** (premium #4) [REUSE + ZCR wrapper] — `'muted'`-label percussive hint; mute-type
    display-only, never graded.
11. **(LATER, separate Technique/Pro tier)** continuous-f0 CONTOUR grading (slide-glide smoothness,
    mid-note trajectory) — `legatoSegments?` + contour-approval UI + 3rd key. The point-pitch OUTCOME
    grade (step 8) does NOT need this.

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
