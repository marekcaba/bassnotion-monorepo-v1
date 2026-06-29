# Scale Engine — Design (the gym Scales tool's foundation)

> Status: **DESIGN — for review.** No code yet beyond the first (broken) generator. This
> doc proposes the data model for the scale/exercise engine: the fretboard note-universe,
> scale positions, the show-filter (box / position / octave / path), and the MIDI feed to
> the audio engine. Grounded in a scout of the real audio engine (file:line below), so the
> MIDI section matches what exists, not invention.

---

## 1. The problem with the current generator (why we're here)

The first generator produced a multi-octave run by greedily climbing `currentString`, which
got stuck on the top string → the scale lit a single horizontal line, not a real fingering
across the neck (confirmed visually). And "a run up the neck" is too simplistic: a real
scale exercise has **positions/shapes**, can go **up one path and down another**, and
**lands on different beats depending on the user's fret/string count**. That's the real
thing we're building. This needs blueprints + a fretboard model, not an algorithm guessing.

---

## 2. The layered model (the spine)

```
1. FRETBOARD MODEL    — the user's bass: stringCount + maxFrets → the playable note universe
2. SCALE DEFINITION   — a scale type's interval pattern (+ its canonical POSITIONS/shapes)
3. NOTE UNIVERSE      — every place the scale's notes occur on THIS fretboard (the full map)
4. SHOW-FILTER        — what subset to render/practice: whole | box | position | octave | path
5. EXERCISE / PATH    — an ORDERED route through the chosen notes (up one path, down another)
6. RENDER + MIDI FEED — the ordered notes → (a) fretboard dots, (b) PatternEvents the audio
                        engine plays so the student HEARS the bass
```

Each layer is pure + testable. The user's bass config (layer 1) flows through everything —
**it changes what notes exist, which changes what the exercise plays and when** (§7).

---

## 3. Fretboard model (layer 1)

The user's bass defines the note universe. From their profile: `stringCount` (4/5/6) +
`maxFrets`. Open-string MIDI by string (already in `scaleGenerator.ts`):

```
4-string: E1=28 A1=33 D2=38 G2=43           (string 1=E … 4=G, by pitch)
5-string: B0=23 + the above                  (string 1=B … 5=G)
6-string: + C3=48                            (string 1=B … 6=C)
```

A position is `(string, fret)`; its pitch is `openMidi[string] + fret`, valid for
`0 ≤ fret ≤ maxFrets`. **This is the load-bearing input** — 21 vs 24 frets is a different
universe (more high notes available), which changes the exercise (§7).

---

## 4. Scale definition + POSITIONS (layer 2) — the blueprints

A scale type has (a) an interval pattern (have this) and (b) **canonical POSITIONS** — the
box shapes a bassist actually plays. Major has 7 positions (one starting on each degree),
pentatonic has 5, etc. A position is a **fingering blueprint**: a set of `(stringOffset,
fretOffset)` relative to a root anchor, spanning ~4-5 frets across all strings.

```ts
// scaleBlueprints.ts (the config file — DATA, not logic)
interface ScalePosition {
  /** Which scale degree this box is anchored on (1 = the I/root box). */
  positionNumber: number;
  /** The fingering: each note as (string index from the anchor, fret from the anchor).
   *  Defined for a 4-string base; layer-1 maps it onto 5/6-string + clamps to maxFrets. */
  shape: { stringOffset: number; fretOffset: number }[];
}
interface ScaleBlueprint {
  intervals: number[];          // semitones from root (have this)
  positions: ScalePosition[];   // the canonical box shapes
}
const SCALE_BLUEPRINTS: Record<ScaleType, ScaleBlueprint> = { major: {...}, ... };
```

**This is the config you'll author/expand.** Adding a scale or refining a shape = editing
data, not logic.

**DECIDED: blueprints are ADMIN-AUTHORED (refined in the admin panel).** The exact shape
coordinates are music pedagogy — yours to define. So the blueprint config is not a
hardcoded file but **data the admin edits** (an authoring surface + storage), the same
no-code pattern as the training goals / groove cards. The build seeds a _proposed_ default
shape per scale (a standard fingering); you refine it visually in the admin panel; the
engine reads the stored shapes. Build order §10 reflects this: code ships a sensible
default, the admin owns the final shapes.

---

## 5. Note universe (layer 3)

Given the fretboard model + a scale + root: compute **every** `(string, fret)` on the neck
whose pitch is in the scale. This is the full map (what a "show the whole scale" mode draws).
Pure: `(stringCount, maxFrets, root, scaleType) → ScaleNote[]` covering the whole neck.

The show-filter (§6) then selects a subset of this universe.

---

## 6. The SHOW-FILTER (layer 4) — what to practice

One scale, many ways to view/practice it. The filter picks the subset:

| Mode       | What shows                     | Use                |
| ---------- | ------------------------------ | ------------------ |
| `whole`    | every scale note on the neck   | see the full map   |
| `position` | one canonical box (position N) | practice one shape |
| `octave`   | one octave span                | focused range      |
| `path`     | an ordered route (§5 exercise) | the run up/down    |

This is a UI control (later) — for the first build, **one default** (probably `position 1`
or a single ascending path). The model supports all; we wire one now.

---

## 7. EXERCISE / PATH (layer 5) — the core: up one way, down another, lands by fret count

**This is the thing we're building.** An exercise is an **ordered route** through notes — not
a set. Critically it can ascend via one path and descend via a different one.

```ts
interface ScalePath {
  /** Ordered positions to play, in sequence. */
  steps: { string: number; fret: number }[];
}
interface ScaleExercise {
  ascending: ScalePath; // the route up
  descending?: ScalePath; // a DIFFERENT route down (optional; defaults to reverse-ascending)
}
```

**Why fret/string count changes the LANDING (the key insight):** an exercise like "straight
eighths, bottom to top and back" has a length = (ascending steps + descending steps). With
**24 frets** there are more notes before the turnaround than with **21 frets** → the "down"
phase starts on a **different beat**, and the same note lands on a different beat. So the
exercise is **generated against the user's fretboard**, not a fixed grid:

```
buildExercise(fretboardModel, scale, root, filter) → ordered note list
  → the turnaround index depends on how many notes fit on THIS neck
  → each note gets a beat position (one per 8th / quarter / etc.)
```

**FIRST BUILD scope (agreed):** one **ascending path** done correctly (a real position
fingering across strings), with the data model shaped as PATHS so descending / alternate
routes are pure data later. No code rewrite to add them.

---

## 8. RENDER + MIDI FEED (layer 6) — grounded in the real engine

The ordered note list feeds two consumers:

### 8a. The fretboard (visual) — DONE

Already works: notes → `ExerciseNoteInput[]` → `Ring3DOverlayCanvas`. The `showAllNotes`
prop lights the whole set; the active note steps in time. (This part is built.)

### 8b. The audio (HEAR the bass) — the real constraint

From the engine scout (file:line in the scout, summarized):

- The engine's playable note = **`PatternEvent`** (`region.types.ts:5`): `position`
  (`"bar:beat:sixteenth"` musical time), `type: 'bass'`, `velocity`, `duration`, and
  `data.midiNote` (**pitch is keyed by MIDI number**; string/fret ride as metadata).
- **Per-note bass = a SAMPLER, not a synth** (`SimpleInstrumentScheduler`/`BassScheduler`).
  One recorded sample per MIDI note (Supabase bucket, `bass-{midi}-{string}`). **A note with
  no sample is SILENT — there is no pitch-shift fallback.** ← a hard constraint on range.
- This per-note path **works in production** (the tutorial widget uses it via `ExerciseLoader`
  → `setBassBuffers` → `BassScheduler`), **but the gym/groove-card surface only plays stems**
  (`setAudioStemBuffers`). So making the scale audible = **integration**, not building a synth:
  register a bass note-track + load the sample set alongside the groove backing.
- `ExerciseLoader.ts:507-529` **already converts string/fret → `PatternEvent`** — directly
  reusable: our scale notes (string/fret/MIDI) map to `PatternEvent`s the same way.
- Scheduling is **region/track-bound** (no "loose note list" API). We wrap the scale's notes
  in a region/track and `scheduleAllRegions()`; it rides the **same Tone.Transport +
  AtomicPlaybackClock** the groove-card backing already starts → stays in sync.

**The MIDI-feed plan:** scale note list → `PatternEvent[]` (midiNote + `position` per beat) →
register a `bass` note-track → schedule. The sample-range limit (§ above) means we either
(a) load a sample set covering the practiced range, or (b) accept some notes silent until the
sampler covers them. **This is a real decision to make (§9 open Q).**

---

## 9. Decisions + remaining open questions

**DECIDED:**

- **Visual-first.** Build the correct visual scale (fretboard shows the right shape, lit +
  animated in time) FIRST. Audible per-note bass (the sampler integration §8b) is a SECOND
  step — deferred, not in build 1. The fretboard timing already works regardless.
- **Blueprints are admin-authored** (§4) — code seeds a default shape, admin refines in the panel.

**Still open (resolve while building the visual layer):**

1. **Default filter for build 1.** One position (a box)? One ascending path? The whole map lit?
   Recommend: render the **selected position's box** (a real fingering across strings) as the
   first correct visual — fixes the broken single-string bug with the least scope.
2. **Note rhythm** (for when the play-along sequence is generated). Straight eighths vs quarters
   — sets beat positions + the turnaround landing. (Eighths = your example.) Matters once we
   animate a path; for a static box it's deferred.
3. **(Deferred to audible step) Sample range.** The bass sampler has a finite recorded range;
   a scale up a 24-fret neck may exceed it → silent notes. Resolve when wiring audio (§8b).
4. **Backing.** Demo groove (fixed key) vs metronome/drone matching the root. The root follows
   the key switcher now, but the groove is a recording in E — transposing ±N may sound off at
   edges. Separate from the scale-visual work.

---

## 10. Build order — VISUAL FIRST

**Phase A — the correct visual scale (build now):**

1. **Fretboard model + note universe** (pure) — `(stringCount, maxFrets, root, scaleType) →
every scale note on the neck`. Adapts to the user's bass. Tested.
2. **Blueprint default shapes** (`scaleBlueprints.ts`) — a sensible standard fingering per scale
   as the seed default (you refine in admin later). Position-based.
3. **Position/box selector** (pure) — `(noteUniverse, blueprint, positionN) → the box's notes`.
   This is the first correct render (fixes the single-string bug).
4. **Wire to the fretboard** — replace the broken generator; the scale shows as a real shape
   across the strings, `showAllNotes` lights it, the box is correct.

**Phase B — admin authoring (after the visual works):** 5. **Admin panel** to edit the blueprint shapes (no-code, like training goals) + storage.

**Phase C — deferred (separate steps, not now):** 6. **Exercise paths + animation** — ordered routes (up/down), the fret-count-dependent
turnaround, beat positions (§7). The play-along sequence. 7. **Audible bass** — notes → `PatternEvent[]` → bass note-track + sampler, in time (§8b). 8. **Show-filter UI** — position / octave / path / whole.

### Related

- `scaleGenerator.ts` (the current, to-be-replaced generator) + `scaleGenerator.test.ts`
- `docs/GYM_EQUIPMENT_DESIGN.md` — the equipment floor this tool belongs to
- Engine: `region.types.ts` (PatternEvent), `ExerciseLoader.ts` (string/fret→event),
  `SimpleInstrumentScheduler.ts`/`BassScheduler` (the sampler), `RegionScheduler.ts` (scheduling)
