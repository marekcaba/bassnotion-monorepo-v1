# Bass Coach — Per-Marker Authoring Matrix (admin)

Build-ready, source-verified (multi-agent workflow 2026-06-21). The admin authors each coach-
recording marker as a bassist thinks: **string + fret + technique** (NO MIDI in authoring). The
rich annotated recording IS the ground truth; the student comparison is built AFTER. Realizes the
[[BASS_COACH_PREMIUM_TIER_PLAN]] §0 authored-annotation model concretely.

## 1. MODEL
Markers already exist in `ReferenceTransientEditor`. Per marker the admin assigns: STRING+FRET
(pitch to listen for, no MIDI), PLUCK style (finger/pick/slap_thumb/mute_thumb/pop/tap), ROLE
(normal/ghost/dead/accent), and for legato a HAMMER-ON/PULL-OFF relationship to the PREVIOUS marker.

## 2. DATA MODEL — extend ReferenceAnalysis (libs/contracts/src/types/block.ts:532)
Parallel arrays, all optional, **index-aligned to onsetsSec** (mirrors lengthsSec/dynamics
precedent). JSONB blob → no DB migration. New fields:
- `bassType?: '4'|'5'|'6'` (self-describes the tuning the string/fret answer against — can't drift
  from the sibling config)
- `stringNumbers?: (1..6|null)[]` — ORIENTATION = BASS_TUNINGS/calculatePitch: **string 1 = HIGHEST
  (G on 4-string), N = lowest (E/B)**. This is REVERSED vs ExerciseNote.string "1=E" (exercise.ts:40).
  PIN WITH A TEST.
- `frets?: (number|null)[]` (0-24)
- `pluckStyles?: (PluckStyle|null)[]` — PluckStyle = finger|pick|slap_thumb|pop|mute_thumb|tap
  (**mute_thumb + pick are NET-NEW** — no existing field covered them)
- `techniques?: TechniqueType[][]` — reuses exercise.ts TechniqueType (slide/harmonic/vibrato/bend)
- `roles?: (MarkerRole|null)[]` — MarkerRole = normal|ghost|dead|accent
- `connectionsFromPrev?: (MarkerConnection|null)[]` — MarkerConnection = hammer_on|pull_off|slide
  (relationship: marker i connected FROM i-1; positional, survives splice)

**THE DESYNC FIX (the load-bearing decision):** the editor RE-SORTS markers on every edit
(ReferenceTransientEditor.tsx:150-154); delete=filter-by-index (:374); add=append+sort (:382).
Flat number[] + parallel arrays DESYNC the instant the sort permutes indices — every label past an
insert/delete/reorder describes the wrong note. (This latent bug ALREADY exists for lengthsSec/
dynamics, masked only because nothing authors them.) FIX: internally a marker is ONE OBJECT
(RefMarker) carrying its annotations + a stable editor-local `id`; commit sorts OBJECTS by timeSec
so each field rides the sort atomically; selection tracked by id not index. Arrays exist only at the
save boundary (toAnalysis zips, fromAnalysis unzips, length-assert vs onsetsSec.length on load).

## 3. AUTHORING UI — table below the waveform (canvas gestures 100% intact)
`ReferenceMarkerTable.tsx` (new): one row per marker — ▶ audition (reuses playNote), string (select
labelled by NOTE NAME), fret (input), **→note read-only live readout** (midiPitchToNoteName(
calculatePitch(string,fret,bassType)) — makes the orientation visible/ear-checkable at author time,
catches the reversal in front of the admin), pluck, role, ⟂-from-prev (disabled row 1; draws a canvas
arc). Plain click on a marker = select (play preserved) + canvas highlight.
SPEED GRAFTS (judges' top flaw on 35-marker basslines): finger/normal defaults = "done" in 2 cells;
keyboard nav (↑/↓ + Tab cell-walk, type g/d/a/e); shift-select + FILL-DOWN a column; "hide annotated
rows" filter + footer "Annotated X/N · ⚠ missing pitch".
REORDER GUARD: after a commit that changes a marker's predecessor, CLEAR connectionFromPrev on
affected rows + flag ("⟂ predecessor changed — re-check"). The object-rides-sort guarantee does NOT
cover a 2-marker relationship; this makes the break loud not silent.

## 4. TECHNIQUE MODEL — three orthogonal axes
pluck-hand (pluckStyle) | fretting/output (techniques: TechniqueType[]) | role (one of normal/ghost/
dead/accent) | + connectionFromPrev for legato. Rules: pluck-hand ONLY on pluckStyle (slap never in
two places); slide ONLY on connectionFromPrev (not also techniques) — avoids two-places ambiguity.

## 5. SAVE/LOAD
onChange widens (ReferenceTransientEditor.tsx:59) from (onsetsSec)=>void to (analysis: Pick<
ReferenceAnalysis,...>)=>void; value widens to ReferenceAnalysis; add bassType prop. Form persist
(GrooveCardBlockForm.tsx:322-327) → onChangeReferenceAnalysis(key, analysis) merging the whole object
(non-destructive spread). Load guard (:110) → `if (!value || !value.onsetsSec?.length)`. Old blobs
(only onsetsSec) → annotations default null. Backward-compatible, no migration.

## 6. PLAYER COMPARISON READS IT (forward-compat, NOT built here)
Scorer reads referenceAnalysis[key] per marker i. Expected pitch COMPUTED on read:
calculatePitch(stringNumbers[i], frets[i], bassType) (no MIDI stored). Compared to verifyPitch's
detected {hz,midi,cents} — octave-tolerant on low E/B (low bass pitch-detects slower). Technique→
dimension map: ghost→dynamics (not pitch), dead→muted outcome (refuse pitch), accent→rel dynamics,
connectionFromPrev hammer/pull→grade landing pitch+timing, DON'T penalize the missing onset
transient (legato has no re-pluck), pluckStyle→timbre dimension when that detector exists.

## 7. BUILD ORDER (smallest-first; 1-3 ship invisible, 4-6 light up UI)
1. Contracts + Zod (widen the non-passthrough z.object at backend groove-card-block.schema.ts:240-245
   or it STRIPS new fields) + orientation test, in lockstep. Build contracts.
2. Editor: number[] → RefMarker[] internally (stable id), commit sorts objects, behavior-identical
   (still emits only onsetsSec this step). The desync-proofing refactor.
3. Widen onChange + form persist + reload.
4. ReferenceMarkerTable.tsx (net-new) + selection + →note readout.
5. connectionFromPrev relationship + reorder guard + canvas arc.
6. Speed affordances (keyboard, fill-down, hide-annotated filter).

## 8. OPEN QUESTIONS (verify first)
1. ~~Does GrooveCardBlockConfig carry a bassType?~~ **RESOLVED 2026-06-21: NO bassType field exists.**
   → default to '4' (correct for all existing content); ReferenceAnalysis.bassType self-describes it
   per-analysis so adding a config-level field later is non-breaking. Not blocking.
2. GradingModeFields callback passes through verbatim (only TS signature widens)?
3. Re-detect path: discard existing annotations (fresh markers) — confirm matches admin expectation.
4. verifyPitch octave reliability on low strings (gates the comparison, not authoring).
5. Double-stops/chords: connectionFromPrev assumes MONOPHONIC; confirm coach refs are mono or document.

Key files: ReferenceTransientEditor.tsx (model :71, onChange :59, commit :150, add :382, delete :374,
drag :395, click=play :410, draw :289, playNote :232, load guard :110) · ReferenceMarkerTable.tsx
(new) · GrooveCardBlockForm.tsx (persist :322, host :586-668, mount ~:656) · block.ts
(ReferenceAnalysis :532, import :12) · exercise.ts (TechniqueType :21-34, roles :61-66, orientation
:40) · groove-card-block.schema.ts:240-245 (MUST widen) · fretboardCalculations.ts (BASS_TUNINGS :22,
calculatePitch :267, midiPitchToNoteName :326, orientation :18) · GrooveCardBlockView.tsx:1158 (read).
