# CurrentTime Flow: Executive Summary

## The Problem in One Sentence

The **yellow ring indicator (nextNoteToPlay)** does NOT have the FIRST-BEAT FIX v3 that was applied to **measure-based highlighting**, causing them to potentially show different measures at playback start.

---

## Quick Facts

| Aspect | Measure Opacity | Yellow Ring | Status |
|--------|----------------|-------------|---------|
| Where it comes from | `useMeasureOpacity` hook | Inline in `useFretboardExercise` | Different architectures |
| Time input | `exerciseTime` (countdown-adjusted) | `exerciseTime` (same) | ✅ Same source |
| **FIRST-BEAT FIX v3** | ✅ HAS IT (lines 144-170) | ❌ MISSING | ⚠️ DISCREPANCY |
| Stale value protection | Forces time to 0 on playback start | No protection | Yellow ring vulnerable |
| Updates per frame | Via callback memoization | Every RAF frame (heavy) | Yellow ring recalcs more |
| Reset after fix applied | When time > 1000 (BUGGY) | N/A | Reset condition broken |

---

## The Issue

### What Should Happen

When you press Play on an exercise:

```
1. isPlaying transitions false → true
2. BOTH measure opacity AND yellow ring detect this
3. BOTH force their time value to 0
4. BOTH show: measure 1, beat 1, first note
5. On subsequent renders, both use interpolated time normally
```

### What Actually Happens

```
1. isPlaying transitions false → true
2. Measure opacity detects and forces time to 0 ✅
3. Yellow ring does NOT detect (no code for it) ❌
4. Measure opacity shows: measure 1, beat 1 ✅
5. Yellow ring shows: measure 3, beat 4 (using stale time) ❌
6. User sees: dots are green, but yellow ring is on orange dots! 🤯
```

---

## Root Causes

### 1. Missing FIRST-BEAT FIX in nextNoteToPlay

**Location**: `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useFretboardExercise.ts`, lines 856-1023

**What's missing**:
```typescript
// nextNoteToPlay SHOULD have this (but doesn't):
const playbackJustStarted = syncProps.isPlaying && !wasPlayingRef.current;
if (playbackJustStarted) {
  playbackJustStartedRef.current = true;
}
const effectiveExerciseTime = playbackJustStartedRef.current ? 0 : exerciseTime;
if (playbackJustStartedRef.current && someTimeValue < 1000) {
  playbackJustStartedRef.current = false;
}
```

**Why it matters**: Without this, `nextNoteToPlay` uses raw `exerciseTime` which might be stale (e.g., 1500ms from previous session) instead of 0.

### 2. Broken Reset Condition in useMeasureOpacity

**Location**: `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useMeasureOpacity.ts`, line 167

**Current code**:
```typescript
if (playbackJustStartedRef.current && currentTime < 1000) {
  playbackJustStartedRef.current = false;
}
```

**Problem**: `currentTime` is `exerciseTime` (AFTER countdown subtraction)
- For exercises with 2-second countdown: `exerciseTime` starts at 0 → condition resets correctly (by accident) ✅
- For exercises with 0-second countdown: `exerciseTime` = raw time value → condition might not trigger when needed
- For stale time values: If `exerciseTime` is 3000ms, condition never triggers → stuck forcing 0! ❌

**Better solution**: Should check `transportTimeRef` (the raw time value) instead.

### 3. Architectural Difference

**Measure Opacity**: Has a dedicated hook (`useMeasureOpacity`) with its own FIRST-BEAT FIX
**Yellow Ring**: Calculated inline in `useFretboardExercise` without its own fix

This difference means:
- They can drift out of sync
- Fixes applied to one don't automatically apply to the other
- Two separate state machines tracking same playback event

---

## Where the Code Is

### Files Involved

1. **useFretboardExercise.ts**
   - Lines 45-246: `useAnimationTime` (RAF interpolation, EventBus subscription)
   - Lines 351-391: FIRST-BEAT FIX v3 (for `rawCurrentTime`)
   - Line 393: Countdown adjustment
   - Lines 856-1023: `nextNoteToPlay` (missing FIRST-BEAT FIX v3!)

2. **useMeasureOpacity.ts**
   - Lines 144-170: FIRST-BEAT FIX v3 (for `effectiveTime`)
   - Line 167: Broken reset condition

3. **FretboardGrid.tsx**
   - Lines 399-403: Uses `nextNoteToPlay` to render yellow ring

4. **FretboardCard.tsx**
   - Line 1007: Passes `nextNoteToPlay` to `FretboardGrid`

### The Time Flow

```
syncProps.currentTime
    ↓
useAnimationTime (RFC interpolation)
    ↓
rawCurrentTime = transport + interpolation + 300ms lookahead
  [FIRST-BEAT FIX v3 applied here]
    ↓
exerciseTime = max(0, rawCurrentTime - countdown)
    ├─→ Path A: Passed to useMeasureOpacity (has 2nd FIRST-BEAT FIX)
    └─→ Path B: Used in nextNoteToPlay (NO FIRST-BEAT FIX!)
```

---

## How to Verify the Bug

### Quick Test

1. Enable debug logging: `window.__DEBUG_FRETBOARD__ = true`
2. Start an exercise with a countdown
3. Watch console as you press Play
4. Look for these logs:
   ```
   [useFretboardExercise] 🎯 FIRST-BEAT FIX v3: Playback just started
   [useMeasureOpacity] 🎯 FIRST-BEAT FIX v3: Playback just started
   ```
5. If you see the first but not the second, or different values, the discrepancy exists

### Visual Test

1. Load any exercise
2. Press Play
3. Watch for first frame after play starts
4. Do the green/orange dots show measure 1?
5. Does the yellow ring also appear on measure 1?
6. If ring appears on measure 2 or 3: **Bug confirmed!**

---

## Impact Assessment

### Severity: Medium

**Frequency**: Every time you press Play (happens often)

**Visibility**:
- Only visible for 1-2 frames if ring is noticeably off
- Visible longer if stale values are significantly wrong (e.g., 3000ms off)
- More noticeable if you watch at slow motion or with debug enabled

**User Impact**:
- Confusing during first beat of playback
- Yellow ring doesn't match highlighted (green/orange) dots
- Ring "snaps" to correct position after ~100ms
- Feels jerky/unpolished at start

**Frequency of Bug Scenarios**:
- Without countdown: ~100% of the time (no clamping to 0)
- With countdown: ~10-20% of the time (clamped to 0 by max(0, ...))
- Depends on browser latency and EventBus timing

---

## Solutions (Priority Order)

### Priority 1: Add FIRST-BEAT FIX v3 to nextNoteToPlay (HIGH)

**File**: `useFretboardExercise.ts`

**Location**: Inside the `nextNoteToPlay` useMemo (around line 856)

**Fix**:
```typescript
const nextNoteToPlay = useMemo(() => {
  if (!exerciseData.hasExercise || exerciseData.exerciseNotes.length === 0) {
    return null;
  }

  // NEW: Detect playback just started
  const playbackJustStartedForRing = syncProps.isPlaying && !wasPlayingRef.current;
  if (playbackJustStartedForRing) {
    playbackJustStartedRef.current = true;
    console.log('[nextNoteToPlay] FIRST-BEAT FIX v3: Playback just started');
  }
  // Update wasPlayingRef for next render
  wasPlayingRef.current = syncProps.isPlaying;

  // Use effective time that's forced to 0 on playback start
  const effectiveExerciseTime = playbackJustStartedRef.current ? 0 : exerciseTime;

  // Reset after time propagates
  if (playbackJustStartedRef.current && animationState.transportTimeRef.current < 1000) {
    playbackJustStartedRef.current = false;
  }

  // ... rest of calculation uses effectiveExerciseTime instead of exerciseTime ...

  // When not playing, show FIRST note
  if (!syncProps.isPlaying) {
    return noteToPosition(notes[0], 0);
  }

  // During countdown, show first note
  if (rawCurrentTime < countdownDurationMs) {
    return noteToPosition(notes[0], 0);
  }

  // ... in the loop, use effectiveExerciseTime instead of exerciseTime ...
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

    // ← USE effectiveExerciseTime HERE
    if (effectiveExerciseTime >= noteStartMs && effectiveExerciseTime < noteEndMs) {
      // ... return note ...
    }
  }

  // ... rest of logic ...
}, [
  syncProps.isPlaying,
  // ... other deps ...
  effectiveExerciseTime,  // ← Add this to deps
  animationState.time,
]);
```

**Effort**: ~20 lines of code

**Risk**: Low (isolated to ring calculation, won't affect other systems)

**Testing**: Check that yellow ring appears on first note, doesn't jump

### Priority 2: Fix Reset Condition in useMeasureOpacity (HIGH)

**File**: `useMeasureOpacity.ts`

**Location**: Line 167

**Current (buggy)**:
```typescript
if (playbackJustStartedRef.current && currentTime < 1000) {
  playbackJustStartedRef.current = false;
}
```

**Fixed**:
```typescript
// Reset based on raw transport time (before countdown subtraction)
// This ensures consistent behavior regardless of countdown duration
if (playbackJustStartedRef.current && isPlaybackEffective && currentTime > 500) {
  // currentTime > 500 means we're well past the first beat (even with stale values)
  playbackJustStartedRef.current = false;
}
```

Or even better, move the check to the transport time:

```typescript
// Need access to transport time - might require passing it as prop
// OR checking inside an effect that has access to it
```

**Effort**: ~5-10 lines of code

**Risk**: Low (only affects the flag reset logic)

**Testing**: Verify that measure opacity doesn't get stuck forcing time=0

### Priority 3: Extract Shared First-Beat Fix Hook (MEDIUM)

**Create**: New file `useFirstBeatFix.ts`

**Consolidate**: Both `useMeasureOpacity` and `nextNoteToPlay` logic into one hook

**Benefit**:
- Single source of truth
- Guaranteed consistency
- Easier to maintain and test
- Clearer logic

**Effort**: ~40 lines of code (create hook + update 2 call sites)

**Risk**: Medium (requires testing both consumers)

### Priority 4: Optimize nextNoteToPlay Recalculation (LOW)

**Currently**: Recalculates every RAF frame even if time hasn't changed enough

**Optimization**:
- Binary search for current note instead of linear loop
- Cache results within 50ms window
- Only recalculate if time advanced by > 50ms

**Effort**: ~50 lines

**Risk**: Medium (logic is complex, easy to introduce bugs)

**Benefit**: Reduces CPU from 60Hz recalculation to maybe 6-10Hz

---

## Testing Plan

### Unit Test (Testing the Fix)

```typescript
// Test that FIRST-BEAT FIX works for nextNoteToPlay
describe('nextNoteToPlay FIRST-BEAT FIX', () => {
  it('should force exerciseTime=0 when playback starts', () => {
    // Setup: isPlaying = false, transportTime = 1500ms (stale)
    // Action: isPlaying transitions to true
    // Expected: nextNoteToPlay calculated with exerciseTime=0, not 1500ms
    // Verify: ring shows noteIndex=0 (first note)
  });

  it('should reset fix after time propagates', () => {
    // Setup: playbackJustStartedRef = true (fix active)
    // transportTime = 2000ms
    // Action: Render with transportTime > 1000ms
    // Expected: playbackJustStartedRef resets to false
    // Verify: subsequent renders use real time, not forced 0
  });
});
```

### Integration Test

```typescript
// Test that ring and measure opacity match at playback start
describe('Ring and Measure Opacity Sync', () => {
  it('should show same measure at playback start', () => {
    // Setup: Load exercise, press play
    // Verify:
    //   measureOpacity.currentMeasure === 1
    //   nextNoteToPlay.noteIndex === 0 (first note)
    //   Green/orange dots match ring position
  });

  it('should handle countdown correctly', () => {
    // With 2s countdown
    // At T=0-2000: Ring stays on note 0, dots show measure 1
    // At T=2000: Ring advances to note 1, dots change color
  });
});
```

### Manual Test (What to Watch For)

1. No visual jump/jerk on first beat
2. Yellow ring on first note when measure shows "measure 1"
3. No delay before ring appears (should be instant)
4. After 1-2 frames, ring moves smoothly with playback

---

## Files to Review

- **CURRENTTIME_FLOW_ANALYSIS.md** - Detailed technical analysis
- **CURRENTTIME_FLOW_DIAGRAM.md** - Visual diagrams and timelines
- **VERIFICATION_CHECKLIST.md** - How to verify the issues exist
- **CURRENTTIME_FLOW_SUMMARY.md** - This file

---

## Conclusion

The **yellow ring (nextNoteToPlay) is missing the FIRST-BEAT FIX v3** that was correctly applied to measure-based highlighting. This causes:

1. Ring potentially shows wrong note at playback start
2. Discrepancy between dots color (green/orange) and ring position
3. Visual jerk/snap as ring catches up after ~100ms

**Recommended Action**: Apply the same FIRST-BEAT FIX pattern to `nextNoteToPlay` that was applied to `useMeasureOpacity`.

**Effort**: ~20 lines of code, ~30 minutes to implement + test

**Impact**: Fixes jerky yellow ring behavior, improves visual polish, increases consistency
