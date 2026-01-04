# CurrentTime Flow Diagram

## The Two Paths: Measure Opacity vs Yellow Ring

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SyncedWidget (Parent)                                                       │
│ ├─ syncProps.currentTime (from transport)                                   │
│ └─ syncProps.isPlaying (boolean)                                            │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ useFretboardExercise Hook                                                    │
│                                                                              │
│  INPUT: syncProps.currentTime                                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Stage 1: useAnimationTime (RAF Interpolation)                        │   │
│  │                                                                      │   │
│  │ - animationState.transportTimeRef (from transport:position-updated) │   │
│  │ - animationState.receivedAtRef (RAF timestamp)                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                               │                                              │
│  ┌───────────────────────────▼──────────────────────────────────────────┐   │
│  │ Stage 2: Calculate rawCurrentTime (Line 380-384)                    │   │
│  │                                                                      │   │
│  │  rawCurrentTime = transportTimeRef                                   │   │
│  │                 + (now - receivedAtRef)  [Interpolation ~0-30ms]    │   │
│  │                 + 300ms                  [Visual lookahead]         │   │
│  │                                                                      │   │
│  │  IF playbackJustStarted: rawCurrentTime = 0                          │   │
│  │                                                                      │   │
│  │  ✅ HAS FIRST-BEAT FIX v3                                            │   │
│  └──────────────────────────────┬─────────────────────────────────────┘   │
│                                  │                                          │
│  ┌───────────────────────────────▼──────────────────────────────────────┐   │
│  │ Stage 3: Countdown Adjustment (Line 393)                            │   │
│  │                                                                      │   │
│  │  exerciseTime = max(0, rawCurrentTime - countdownDurationMs)         │   │
│  │                                                                      │   │
│  │  Example:                                                            │   │
│  │  - rawCurrentTime = 0ms (on first beat)                             │   │
│  │  - countdownDurationMs = 2000ms (2 second countdown)                │   │
│  │  - exerciseTime = max(0, -2000) = 0ms                               │   │
│  │                                                                      │   │
│  │  - rawCurrentTime = 2500ms (2.5s into playback)                     │   │
│  │  - countdownDurationMs = 2000ms                                     │   │
│  │  - exerciseTime = max(0, 500) = 500ms                               │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────┬──────────────────────┘
                   │                                  │
        ┌──────────▼──────────────┐      ┌───────────▼────────────────┐
        │ PATH A: Measure Opacity │      │ PATH B: Yellow Ring        │
        └──────────┬──────────────┘      └───────────┬────────────────┘
                   │                                  │
                   ▼                                  ▼
    ┌──────────────────────────────────┐ ┌──────────────────────────────┐
    │ useMeasureOpacity Hook            │ │ nextNoteToPlay useMemo       │
    │ (Separate Hook)                   │ │ (Inline in exercise hook)    │
    │                                   │ │                              │
    │ INPUT: exerciseTime               │ │ INPUT: exerciseTime          │
    │        isPlaying                  │ │        isPlaying             │
    │        tempo                      │ │        exerciseNotes         │
    │        timeSignature              │ │                              │
    │                                   │ │ OUTPUT: {                    │
    │ ┌─────────────────────────────┐   │ │   stringIndex: number        │
    │ │ FIRST-BEAT FIX v3           │   │ │   fret: number | 'open'      │
    │ │ (Lines 144-170)             │   │ │   noteIndex: number          │
    │ │ ✅ Applied locally!          │   │ │ }                            │
    │ │                             │   │ │                              │
    │ │ wasPlayingRef.current       │   │ │ ⚠️ NO LOCAL FIX!              │
    │ │ playbackJustStartedRef      │   │ │                              │
    │ │                             │   │ │ But depends on:              │
    │ │ const effectiveTime =       │   │ │ - animationState.time        │
    │ │   playbackJustStartedRef    │   │ │ - exerciseTime               │
    │ │   ? 0                       │   │ │                              │
    │ │   : currentTime             │   │ │ Both update each RAF frame   │
    │ └──────────────────────────────┤  │ │                              │
    │                                │  │ │                              │
    │ Uses effectiveTime to calc:    │  │ │                              │
    │ - currentPosition              │  │ │ Calculation:                 │
    │ - currentMeasure (1-based)     │  │ │ - Uses COUNTDOWN FIX:        │
    │ - currentBeat                  │  │ │   if (rawCurrentTime <       │
    │                                │  │ │     countdownDurationMs)     │
    │ OUTPUT:                        │  │ │   return note[0]             │
    │ - currentMeasure              │  │ │                              │
    │ - currentBeat                 │  │ │ - Then loops through notes:  │
    │ - getMeasureHighlight(str,fret)│ │ │   if (exerciseTime >=        │
    │ - getNoteOpacity(str,fret)    │  │ │     noteStart &&             │
    │ - isInTransition              │  │ │     exerciseTime <           │
    │ - transitionDuration          │  │ │     noteEnd)                 │
    │                                │  │ │   return that note           │
    │                                │  │ │                              │
    │ BUG IN RESET CONDITION:       │  │ │                              │
    │ Line 167:                     │  │ │                              │
    │ if (playbackJustStartedRef &&  │  │ │ Dependencies:                │
    │     currentTime < 1000) {      │  │ │ [isPlaying, hasExercise,    │
    │   // Reset flag               │  │ │  exerciseNotes,              │
    │ }                             │  │ │  exerciseTime,               │
    │                              │  │ │  exerciseTempo,              │
    │ PROBLEM:                     │  │ │  timeSignature.numerator,    │
    │ currentTime = exerciseTime   │  │ │  animationState.time]        │
    │ which is AFTER countdown!    │  │ │                              │
    │ So if countdown=2s,          │  │ │ Triggers recalc EVERY        │
    │ exerciseTime starts at 0,    │  │ │ RAF frame! (~60Hz)            │
    │ not at 2000ms!               │  │ │                              │
    └──────────────────────────────┘  └──────────────────────────────┘
                   │                                  │
                   ▼                                  ▼
         ┌──────────────────────┐        ┌──────────────────────────┐
         │ FretboardCard passes │        │ FretboardCard passes     │
         │ getMeasureHighlight()│        │ nextNoteToPlay to        │
         │ getMeasureOpacity()  │        │ FretboardGrid            │
         │ transitionDuration   │        │                          │
         └──────────┬───────────┘        └──────────┬───────────────┘
                    │                               │
                    ▼                               ▼
         ┌──────────────────────┐        ┌──────────────────────────┐
         │ FretboardGrid uses:  │        │ FretboardGrid checks:    │
         │                      │        │                          │
         │ getMeasureHighlight()│        │ if (nextNoteToPlay &&    │
         │ to color dots:       │        │     nextNoteToPlay       │
         │ - Green (current)    │        │     .stringIndex === s && │
         │ - Orange (next)      │        │     nextNoteToPlay       │
         │ - Grey (other)       │        │     .fret === f)         │
         │                      │        │ {                        │
         │ getMeasureOpacity()  │        │   Add yellow ring!       │
         │ to set opacity:      │        │ }                        │
         │ - 1.0 (current)      │        │                          │
         │ - 0.3 (next)         │        │ STYLING:                 │
         │ - 0.0 (other)        │        │ ring-1 ring-yellow-400   │
         │                      │        │ ring-offset-1            │
         │ Also applies:        │        │                          │
         │ - fadeOpacity        │        │ APPLIED TO: All selected │
         │ - dragOpacity        │        │ dots matching the note   │
         │ - combined           │        │                          │
         │                      │        │                          │
         │ RESULT:              │        │ RESULT:                  │
         │ Dots fade in/out     │        │ Yellow ring around       │
         │ as measures change   │        │ current note            │
         └──────────────────────┘        └──────────────────────────┘
```

---

## Time Value Examples Over Time

During an exercise with 2-second countdown at 120 BPM:

```
Time since play button clicked:

0ms:    Transport time = 0
        rawCurrentTime = 0 (FIRST-BEAT FIX forces this)
        exerciseTime = max(0, 0 - 2000) = 0

        Measure Opacity sees:   0ms → 0ms (fix applied) ✅
        NextNoteToPlay sees:    0ms → 0ms (via exerciseTime) ✅
        Status: Both see beat 1 correctly

500ms:  Transport time ≈ 500
        rawCurrentTime ≈ 500 + (0) + 300 = 800 (includes lookahead)
        exerciseTime = max(0, 800 - 2000) = 0 (still in countdown!)

        Measure Opacity sees:   0ms → Still beat 1 ✅
        NextNoteToPlay sees:    0ms → Still beat 1 ✅
        Status: Both still in countdown

1500ms: Transport time ≈ 1500
        rawCurrentTime ≈ 1500 + (0) + 300 = 1800
        exerciseTime = max(0, 1800 - 2000) = 0 (still in countdown!)

        Measure Opacity:        0ms → Beat 1 ✅
        NextNoteToPlay:         0ms → Beat 1 ✅

2500ms: Transport time ≈ 2500
        rawCurrentTime ≈ 2500 + (50) + 300 = 2850 (past countdown!)
        exerciseTime = max(0, 2850 - 2000) = 850

        Measure Opacity sees:   850ms → Beat ~3 of measure 1
        NextNoteToPlay sees:    850ms → Should be the note at 850ms

        FIRST-BEAT FIX resets: playbackJustStartedRef = false
        (when transportTime > 1000, which it now is)

        Status: Both now use normal interpolated time ✅
```

---

## The Bug Scenario

### When useMeasureOpacity's Fix Works But Yellow Ring Doesn't:

```
Playback starts:

isPlaying: false → true (transition detected!)

useMeasureOpacity (Line 152):
  playbackJustStarted = true && !false = true ✅
  playbackJustStartedRef.current = true
  console.log shows fix applied ✅

nextNoteToPlay (No special handling):
  playbackJustStarted is checked, but NOT saved
  useMemo just uses exerciseTime directly

First render:
  useMeasureOpacity.effectiveTime = 0 (forced by fix)
    → Shows measure 1, beat 1 ✅

  nextNoteToPlay.exerciseTime = 0 (but not forced by fix)
    → SHOULD show first note ✅
    BUT: What if there's RAF timing delay?

    If rawCurrentTime is still stale (1500ms from prev session),
    exerciseTime = max(0, 1500 - 2000) = 0 (clamped to 0)
    → Still works, but only because of max(0, ...) clamp!

    What if no countdown?
    exerciseTime = 1500ms (wrong!)
    → Yellow ring jumps to wrong note! ❌

Without countdown (countdownDurationMs = 0):

  rawCurrentTime could be stale: 1500ms (from prev session or RAF backlog)
  exerciseTime = 1500ms - 0 = 1500ms

  useMeasureOpacity.effectiveTime = 0 (fix applied)
    → Shows beat 1 ✅

  nextNoteToPlay.exerciseTime = 1500ms (no fix!)
    → Yellow ring shows note at 1500ms! ❌

  DISCREPANCY: Measure shows beat 1, ring shows beat 4+
```

---

## The Reset Condition Bug

```
useMeasureOpacity Line 167:

if (playbackJustStartedRef.current && currentTime < 1000) {
  playbackJustStartedRef.current = false;
}

Timeline:

Time 0:    Play button pressed
           isPlaying = false → true
           playbackJustStartedRef.current = true

Time 50ms: First render
           rawCurrentTime = 0 (forced)
           exerciseTime = max(0, 0 - 2000) = 0
           currentTime (param) = 0
           → currentTime < 1000? YES! Reset condition triggers!
           → playbackJustStartedRef.current = false
           ✅ Correct for exercises WITH countdown!

Time 150ms: But what if countdown = 100ms?
            rawCurrentTime = 0
            exerciseTime = max(0, 0 - 100) = 0
            currentTime = 0
            → currentTime < 1000? YES!
            → playbackJustStartedRef.current = false
            ✅ Still correct

Time 100ms: And what if countdown = 0?
            rawCurrentTime = 0
            exerciseTime = 0
            currentTime = 0
            → currentTime < 1000? YES!
            → playbackJustStartedRef.current = false
            ✅ Still works, but...

Time 150ms: If RAF delay causes late update:
            rawCurrentTime = 150 (RAF caught up)
            exerciseTime = 150
            currentTime = 150
            → currentTime < 1000? YES!
            → Reset still works ✅

           But what if browser was busy?
            rawCurrentTime = 3000 (very late update)
            exerciseTime = 3000
            currentTime = 3000
            → currentTime < 1000? NO!
            → playbackJustStartedRef.current still TRUE!
            → effectiveTime forced to 0 even at time 3000!

            STUCK IN FIX MODE! ❌
```

---

## Dependency Graph

### useMeasureOpacity Dependency Issues:

```
useMeasureOpacity is called with:
  exerciseTime (depends on RAF interpolation and isPlaying)

inside useMeasureOpacity:
  useCallback(getMeasureHighlight, [
    isPlaybackEffective,    ← Depends on effectiveTime
    effectiveMeasure,       ← Depends on currentPosition
    notePositionToAllMeasures,
    opacityConfig,
  ])

  useCallback(getNoteOpacity, [
    isPlaybackEffective,    ← Depends on effectiveTime
    effectiveMeasure,       ← Depends on currentPosition
    notePositionToAllMeasures,
    opacityConfig,
  ])

  useMemo(currentPosition, [
    effectiveTime,          ← Triggers every time effectiveTime changes
    isPlaybackEffective,
    tempo,
    timeSignature
  ])

effectiveTime depends on:
  currentTime (prop) ← Changes every RAF frame
  playbackJustStartedRef ← Changes only on isPlaying transition

So in practice:
  getMeasureHighlight re-created when effectiveTime changes
  getMeasureHighlight re-created when currentPosition changes
  currentPosition re-created every RAF frame (as long as isPlaying)

RESULT: Heavy re-computation every RAF frame!
        But necessary for smooth 60fps animation.
```

### nextNoteToPlay Dependency Issues:

```
nextNoteToPlay useMemo depends on:
  [isPlaying,
   hasExercise,
   exerciseNotes,
   exerciseTime,               ← Changes every RAF frame!
   exerciseTempo,
   timeSignature.numerator,
   animationState.time]        ← Changes every RAF frame!

RESULT: Re-computed EVERY RAF FRAME (60Hz)
        Searches through all notes for the current one
        Heavy computation every 16ms!

OPTIMIZATION OPPORTUNITY:
  Could cache based on exerciseTime ranges
  Use binary search for large note lists
  Memoize within certain time windows
```

---

## Summary Table

| Aspect | Measure Opacity | Yellow Ring | Sync Status |
|--------|-----------------|-------------|-------------|
| **Time Input** | `exerciseTime` | `exerciseTime` (inline) | ✅ Same |
| **FIRST-BEAT FIX v3** | ✅ Lines 144-170 | ❌ None | ⚠️ MISSING |
| **Stale Value Protection** | ✅ Forces 0 on playback start | ❌ No protection | ⚠️ BROKEN |
| **RAF Updates** | Via `currentTime` prop | Via `animationState.time` in deps | ✅ Both update |
| **Reset Condition** | `currentTime < 1000` (BROKEN) | No reset (N/A) | ⚠️ ISSUE |
| **Lookahead** | Already applied | Already applied | ✅ Same |
| **Countdown Handling** | Receives after-countdown time | Uses raw time for check | ⚠️ MIXED |
| **Performance** | Re-computes via callbacks | Re-computes every RAF | ⚠️ Heavy |
