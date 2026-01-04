# CurrentTime Flow Analysis: useMeasureOpacity vs nextNoteToPlay

## Overview

This document traces how `currentTime` flows through the codebase to both `useMeasureOpacity` (measure-based opacity/highlighting) and `nextNoteToPlay` (yellow ring indicator), identifying where the FIRST-BEAT FIX v3 is and isn't applied.

---

## The Complete Flow

### Entry Point: useFretboardExercise

**File**: `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useFretboardExercise.ts`

The hook receives `syncProps.currentTime` from the SyncedWidget:

```typescript
// Line 348
const fallbackTime = syncProps.currentTime || 0;
const animationState = useAnimationTime(syncProps.isPlaying, fallbackTime);
```

### Stage 1: Time Interpolation (useAnimationTime)

**Lines 45-246** in `useFretboardExercise.ts`

The `useAnimationTime` hook:
- Stores `lastTransportTimeRef` and `lastTransportReceivedAtRef`
- Subscribes to `transport:position-updated` events
- Runs RAF loop for 60fps animation
- Returns `animationState.time`, `transportTimeRef`, `receivedAtRef`

**Note**: The actual interpolated time is NOT calculated in this hook; refs are returned for render-time calculation.

### Stage 2: First-Beat Fix v3 (in useFretboardExercise)

**Lines 351-391** - FIRST-BEAT FIX v3 Implementation

```typescript
// Line 359
const playbackJustStarted = syncProps.isPlaying && !wasPlayingRef.current;
if (playbackJustStarted) {
  playbackJustStartedRef.current = true;
  console.log(
    `[useFretboardExercise] 🎯 FIRST-BEAT FIX v3: Playback just started, forcing time to 0 (transportTime was ${animationState.transportTimeRef.current}ms)`
  );
}
wasPlayingRef.current = syncProps.isPlaying;

// Line 380-384: Calculate rawCurrentTime at RENDER TIME
const rawCurrentTime = playbackJustStartedRef.current
  ? 0
  : syncProps.isPlaying
    ? animationState.transportTimeRef.current + (performance.now() - animationState.receivedAtRef.current) + VISUAL_LOOKAHEAD_MS
    : fallbackTime;

// Lines 388-391: Reset flag when time propagates
if (playbackJustStartedRef.current && animationState.transportTimeRef.current < 1000) {
  playbackJustStartedRef.current = false;
}

// Line 393: Countdown adjustment
const exerciseTime = Math.max(0, rawCurrentTime - countdownDurationMs);
```

**What it does**:
1. Detects when `isPlaying` transitions from `false` -> `true`
2. Forces `rawCurrentTime = 0` for that first render
3. Adds `VISUAL_LOOKAHEAD_MS` (+300ms) compensation
4. Subtracts `countdownDurationMs` to get `exerciseTime`

---

## Flow Divergence: Where Does Each Hook Get Its Time?

### Path A: useMeasureOpacity

**File**: `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useMeasureOpacity.ts`

**Called from**: `useFretboardExercise.ts` line 415

```typescript
const measureOpacity = useMeasureOpacity({
  exerciseNotes: exerciseData.exerciseNotes,
  currentTime: exerciseTime,  // ⬅️ USES EXERCISE TIME (with countdown subtracted)
  isPlaying: syncProps.isPlaying || false,
  tempo: exerciseTempo,
  timeSignature: exerciseTimeSignature,
  stringCount,
});
```

**Inside useMeasureOpacity** (lines 144-170):

```typescript
// FIRST-BEAT FIX v3: Detect when playback JUST started
const playbackJustStarted = isPlaying && !wasPlayingRef.current;
if (playbackJustStarted) {
  playbackJustStartedRef.current = true;
  console.log(
    `[useMeasureOpacity] 🎯 FIRST-BEAT FIX v3: Playback just started, forcing time to 0 (was ${currentTime}ms)`
  );
}
wasPlayingRef.current = isPlaying;

// Use 0 for the first render when playback starts, then use actual time
const effectiveTime = playbackJustStartedRef.current ? 0 : currentTime;

// Reset the flag after first render with actual time update
if (playbackJustStartedRef.current && currentTime < 1000) {
  playbackJustStartedRef.current = false;
}
```

**Issues with this approach**:
1. ✅ Uses `exerciseTime` (already has countdown subtracted)
2. ✅ Has FIRST-BEAT FIX v3 applied locally
3. ⚠️ The fix checks `currentTime < 1000`, but this is AFTER countdown subtraction
   - If countdown is 2 seconds, actual `currentTime` might be 2300ms when `exerciseTime` is 300ms
   - The reset condition might not trigger when expected!

### Path B: nextNoteToPlay

**File**: `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useFretboardExercise.ts` lines 856-1023

**Called directly in useFretboardExercise** - NOT in a separate hook

```typescript
const nextNoteToPlay = useMemo(() => {
  if (!exerciseData.hasExercise || exerciseData.exerciseNotes.length === 0) {
    return null;
  }

  const notes = exerciseData.exerciseNotes;
  const maxString = Math.max(...notes.map((n: ExerciseNote) => n.string));

  // Helper to convert note to fretboard position
  const noteToPosition = (note: ExerciseNote, index: number) => {
    // ... string/fret mapping ...
    return { stringIndex, fret, noteIndex: index };
  };

  // When not playing, show the FIRST note
  if (!syncProps.isPlaying) {
    return noteToPosition(notes[0], 0);
  }

  // COUNTDOWN FIX: During countdown, always show first note
  if (rawCurrentTime < countdownDurationMs) {  // ⬅️ Uses rawCurrentTime (BEFORE countdown subtraction!)
    return noteToPosition(notes[0], 0);
  }

  // ... rest of calculation uses exerciseTime ...
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const noteStartMs = positionToMs(note.position);
    let noteEndMs: number;
    if (i < notes.length - 1) {
      const nextNote = notes[i + 1];
      noteEndMs = positionToMs(nextNote.position);
    } else {
      const noteDuration = note.duration ?? 1;
      noteEndMs = noteStartMs + (noteDuration * msPerBeat);
    }

    // Check if current time is within this note's duration
    if (exerciseTime >= noteStartMs && exerciseTime < noteEndMs) {  // ⬅️ Uses exerciseTime (with countdown subtracted)
      // ... return note ...
      return noteToPosition(note, i);
    }
  }

  // ... remaining logic ...
}, [
  syncProps.isPlaying,
  exerciseData.hasExercise,
  exerciseData.exerciseNotes,
  exerciseTime,  // ⬅️ Depends on exerciseTime
  exerciseTempo,
  exerciseTimeSignature.numerator,
  animationState.time,  // Triggers recalculation on each RAF frame
]);
```

**Critical Issues with nextNoteToPlay**:
1. ⚠️ NO FIRST-BEAT FIX v3 applied directly!
2. ⚠️ The memo depends on `animationState.time` which changes every RAF frame
3. ⚠️ Mixed time sources:
   - Line 886: `rawCurrentTime < countdownDurationMs` (uses RAW time with +300ms lookahead)
   - Lines 963-983: Actual note matching uses `exerciseTime` (countdown-subtracted)

---

## KEY DISCREPANCY IDENTIFIED

### **The Yellow Ring (nextNoteToPlay) Has NO FIRST-BEAT FIX v3!**

While `useMeasureOpacity` has FIRST-BEAT FIX v3 implemented (lines 144-170 in useMeasureOpacity.ts):

```typescript
// Force time to 0 on playback start
const playbackJustStarted = isPlaying && !wasPlayingRef.current;
if (playbackJustStarted) {
  playbackJustStartedRef.current = true;
}
const effectiveTime = playbackJustStartedRef.current ? 0 : currentTime;
```

The `nextNoteToPlay` calculation in `useFretboardExercise.ts` **does NOT have this fix!**

It directly uses `exerciseTime` in its memoized calculation without any protection against stale values.

---

## The Countdown Time Handling Inconsistency

### In useMeasureOpacity:
```typescript
// Line 417
const measureOpacity = useMeasureOpacity({
  currentTime: exerciseTime,  // Already has countdown subtracted
  isPlaying: syncProps.isPlaying || false,
  // ...
});

// Inside useMeasureOpacity, line 167
if (playbackJustStartedRef.current && currentTime < 1000) {
  // PROBLEM: currentTime is exerciseTime (after countdown subtraction)
  // If countdown is 2s, exerciseTime starts at 0, so this resets too early!
  playbackJustStartedRef.current = false;
}
```

### In nextNoteToPlay:
```typescript
// Line 886
if (rawCurrentTime < countdownDurationMs) {  // rawCurrentTime = before countdown subtraction
  return noteToPosition(notes[0], 0);
}

// Line 963
if (exerciseTime >= noteStartMs && exerciseTime < noteEndMs) {  // exerciseTime = after countdown
```

**Inconsistency**: `useMeasureOpacity` receives `exerciseTime` but its reset condition checks against `< 1000` (assuming it's early in playback). But `exerciseTime` could be any value depending on countdown duration!

---

## Time Sources Used

### rawCurrentTime (in useFretboardExercise)
```typescript
// Line 380-384
const rawCurrentTime = playbackJustStartedRef.current
  ? 0
  : syncProps.isPlaying
    ? animationState.transportTimeRef.current
      + (performance.now() - animationState.receivedAtRef.current)
      + VISUAL_LOOKAHEAD_MS  // +300ms compensation
    : fallbackTime;
```

**Components**:
- Transport time from AudioWorklet
- +Interpolation based on RAF timing
- +300ms visual lookahead compensation
- No countdown subtraction yet

### exerciseTime (in useFretboardExercise)
```typescript
// Line 393
const exerciseTime = Math.max(0, rawCurrentTime - countdownDurationMs);
```

**Components**:
- rawCurrentTime (with all above)
- Minus countdown duration (variable based on exercise)
- Clamped to 0 minimum

---

## Summary of Discrepancies

| Aspect | useMeasureOpacity | nextNoteToPlay | Status |
|--------|------------------|-----------------|--------|
| **Receives** | `exerciseTime` (countdown-adjusted) | Inline calc using `exerciseTime` | ✅ Same source |
| **FIRST-BEAT FIX v3** | ✅ Has fix (lines 144-170) | ❌ NO FIX | ⚠️ MISSING |
| **Stale time protection** | ✅ Forces 0 on playback start | ❌ No protection | ⚠️ MISSING |
| **RAF frame updates** | Via `currentTime` prop | Via `animationState.time` in deps | ✅ Both update every RAF |
| **Reset condition** | `currentTime < 1000` (BROKEN for exercises with countdown) | No reset needed (no local state) | ⚠️ ISSUE |
| **Lookahead compensation** | Already in `rawCurrentTime` before receiving | Already in `rawCurrentTime` before use | ✅ Both have it |

---

## Root Causes

### 1. **nextNoteToPlay Missing FIRST-BEAT FIX v3**
   - The yellow ring calculation happens directly in `useFretboardExercise`
   - It uses `exerciseTime` from refs/interpolation
   - But doesn't check if `isPlaying` just transitioned to `true`
   - Solution: Add same playback-start detection as `useMeasureOpacity`

### 2. **useMeasureOpacity Reset Condition Broken**
   - Line 167 checks `currentTime < 1000`
   - But `currentTime` is `exerciseTime` (after countdown subtraction)
   - For a 2-second countdown, `exerciseTime` is ~0-500ms when audio starts
   - The condition might reset at wrong time if countdown is long
   - Solution: Use `animationState.transportTimeRef` directly or track timing better

### 3. **Inconsistent Time References**
   - `useMeasureOpacity` gets `exerciseTime` (1 level of abstraction)
   - `nextNoteToPlay` calculates directly with `rawCurrentTime` and `exerciseTime` (2 levels)
   - Both should use same reference point for consistency

### 4. **useMeasureOpacity's Local wasPlayingRef vs useFretboardExercise's**
   - Both hooks track `wasPlayingRef` separately
   - Both have separate `playbackJustStartedRef` flags
   - They reset independently with potentially different timing
   - Measure opacity might stop forcing `0` while yellow ring is still using stale values (or vice versa)

---

## Recommended Fixes

### Option 1: Add FIRST-BEAT FIX v3 to nextNoteToPlay
Apply the same pattern directly in the `useMemo`:

```typescript
// At start of nextNoteToPlay useMemo
const playbackJustStartedForRing = syncProps.isPlaying && !wasPlayingRef.current;
if (playbackJustStartedForRing) {
  playbackJustStartedRef.current = true;
  console.log(`[nextNoteToPlay] FIRST-BEAT FIX: Playback started`);
}
wasPlayingRef.current = syncProps.isPlaying;

// Then use this to force exerciseTime to 0
const effectiveExerciseTime = playbackJustStartedRef.current ? 0 : exerciseTime;

// Reset after propagation
if (playbackJustStartedRef.current && animationState.transportTimeRef.current < 1000) {
  playbackJustStartedRef.current = false;
}
```

### Option 2: Extract to Shared Hook
Create `useFirstBeatFix` hook that returns the fixed time:

```typescript
function useFirstBeatFix(isPlaying: boolean, rawTime: number) {
  const wasPlayingRef = useRef(false);
  const playbackJustStartedRef = useRef(false);

  const playbackJustStarted = isPlaying && !wasPlayingRef.current;
  if (playbackJustStarted) {
    playbackJustStartedRef.current = true;
  }
  wasPlayingRef.current = isPlaying;

  const effectiveTime = playbackJustStartedRef.current ? 0 : rawTime;

  if (playbackJustStartedRef.current && rawTime < 1000) {
    playbackJustStartedRef.current = false;
  }

  return effectiveTime;
}
```

### Option 3: Move All Time Calculations to useFretboardExercise
Have `useMeasureOpacity` NOT do its own FIRST-BEAT FIX - only `useFretboardExercise` should do it, then both consumers get the already-fixed time.

---

## Testing Verification

To verify the fix is working:

1. **Enable debug logs**:
   ```javascript
   window.__DEBUG_FRETBOARD__ = true;
   ```

2. **Observe console for both sources**:
   ```
   [useFretboardExercise] 🎯 FIRST-BEAT FIX v3: Playback just started
   [useMeasureOpacity] 🎯 FIRST-BEAT FIX v3: Playback just started
   [RING-TIMING] === RING POSITION CALC === (should show exerciseTime near 0)
   [MEASURE-DEBUG] (should show measure 1)
   [RING-EXPECT] Note 0: pos={m:0, b:0, ...} → start=0ms (should be first beat)
   ```

3. **Check for discrepancies**:
   - Measure opacity showing bar 1 but ring on bar 3? → useMeasureOpacity fix working, nextNoteToPlay not
   - Ring showing but measure opacity off? → nextNoteToPlay needs fix
   - Both inconsistent? → One or both fixes aren't resetting properly

---

## Files Affected

- **useFretboardExercise.ts** - Lines 351-391 (has fix), Lines 856-1023 (missing fix)
- **useMeasureOpacity.ts** - Lines 144-170 (has fix, but with bugs)
- **FretboardGrid.tsx** - Lines 399-403 (uses nextNoteToPlay)
- **FretboardCard.tsx** - Line 1007 (passes nextNoteToPlay)

---

## Related Issues

- Measure opacity reset condition broken (uses wrong time reference)
- Separate state in two hooks can drift apart
- Yellow ring calculation depends on RAF but doesn't protect against stale initial values
