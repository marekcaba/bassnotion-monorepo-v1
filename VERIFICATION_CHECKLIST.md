# Verification Checklist: currentTime Flow Issues

## Quick Check: Is There a Discrepancy?

To verify if the bug exists in your environment, follow these steps:

### Step 1: Enable Debug Logging

```javascript
// In browser console
window.__DEBUG_FRETBOARD__ = true;
```

### Step 2: Start an Exercise

- Load any exercise
- Press Play
- Watch the console

### Step 3: Look for These Logs

#### Expected Logs (Fix Is Working):

```
[useFretboardExercise] 🎯 FIRST-BEAT FIX v3: Playback just started
[useMeasureOpacity] 🎯 FIRST-BEAT FIX v3: Playback just started
[RING-TIMING] === RING POSITION CALC ===
[RING-TIMING] exerciseTime=0.00ms
[MEASURE-DEBUG] effectiveMeasure=1, currentMeasure0Based=0
[RING-EXPECT] Note 0: ... → start=0ms
```

#### Problem Logs (Discrepancy Exists):

```
❌ [useFretboardExercise] 🎯 FIRST-BEAT FIX v3: NOT LOGGED!
✅ [useMeasureOpacity] 🎯 FIRST-BEAT FIX v3: Playback just started

OR

[RING-TIMING] exerciseTime=1500.00ms (should be near 0!)
[MEASURE-DEBUG] effectiveMeasure=1 (correct)
BUT
[RING-EXPECT] Note 0: start=0ms (ring is looking for note at 0ms)
BUT [RING-TIMING] showing 1500ms!
```

---

## The Three Key Symptoms

### Symptom 1: Yellow Ring on Wrong Note at Playback Start

**What to look for**:
- Press Play on an exercise
- Green/orange dots highlight correctly (measure 1)
- BUT the yellow ring appears on the 3rd or 4th note instead of 1st note

**Root cause**:
- `nextNoteToPlay` missing FIRST-BEAT FIX v3
- Uses stale `exerciseTime` from previous session
- Without fix, yellow ring jumps to wrong position

**Verification**:
```javascript
// At playback start:
console.log("Measure opacity showing:", measureOpacity.currentMeasure); // Should be 1
console.log("Ring position index:", nextNoteToPlay.noteIndex); // Should be 0!

// If not matching, discrepancy exists
```

### Symptom 2: Measure Opacity and Ring Showing Different Measures

**What to look for**:
- Dots show as Green (measure 1)
- But ring is on the dots that should be in Orange (measure 2)

**Root cause**:
- `useMeasureOpacity` correctly forced to time=0
- `nextNoteToPlay` using wrong time value
- They're out of sync

**Verification**:
```
Watch the dots change color (green→orange transition).
Does the yellow ring move at the same time?

If ring is always 1 measure ahead, discrepancy exists.
```

### Symptom 3: Ring Jerks/Jumps at Playback Start

**What to look for**:
- Play exercise
- Ring jumps from note 5 to note 1
- OR ring doesn't appear for first 1-2 seconds

**Root cause**:
- `nextNoteToPlay` not forcing time=0
- Rail/interpolation takes time to update
- Ring catches up after RAF loop stabilizes

**Verification**:
```javascript
// Enable detailed logging
window.__DEBUG_FRETBOARD__ = true;

// At T=0ms, should see:
[RING-SWITCH] Note X → 0  (should go TO 0, not FROM 0 to something else)
```

---

## Code-Level Verification

### Check 1: Verify useMeasureOpacity Has Fix

**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useMeasureOpacity.ts`

**Lines to check**: 144-170

```typescript
// ✅ SHOULD CONTAIN THIS:
const playbackJustStarted = isPlaying && !wasPlayingRef.current;
if (playbackJustStarted) {
  playbackJustStartedRef.current = true;
  console.log(
    `[useMeasureOpacity] 🎯 FIRST-BEAT FIX v3: Playback just started...`
  );
}
wasPlayingRef.current = isPlaying;

const effectiveTime = playbackJustStartedRef.current ? 0 : currentTime;

if (playbackJustStartedRef.current && currentTime < 1000) {
  playbackJustStartedRef.current = false;
}
```

**Result**:
- [ ] Code is present ✅
- [ ] Code is commented out ❌
- [ ] Code is missing ❌

### Check 2: Verify nextNoteToPlay Missing Fix

**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useFretboardExercise.ts`

**Lines to check**: 856-1023 (the nextNoteToPlay useMemo)

**Search for**:
```typescript
// ❌ Should NOT be in here:
const playbackJustStarted = syncProps.isPlaying && !wasPlayingRef.current;
if (playbackJustStarted) {
  playbackJustStartedRef.current = true;
}
```

**Result**:
- [ ] Not present (as expected) ✅
- [ ] Present (unexpected) ❌

### Check 3: Verify useMeasureOpacity Reset Condition Issue

**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useMeasureOpacity.ts`

**Lines to check**: 167

```typescript
// ⚠️ KNOWN ISSUE:
if (playbackJustStartedRef.current && currentTime < 1000) {
  playbackJustStartedRef.current = false;
}
```

**Issue**: `currentTime` is `exerciseTime` (after countdown subtraction)
- For 2s countdown: exerciseTime starts at 0, so reset happens immediately ✅
- For 0s countdown: exerciseTime = time value, might not trigger reset
- For long exercises: might trigger reset too late if time goes >1000ms before propagation

**Verification**:
```javascript
// What you'd expect:
// Time 0ms: playbackJustStartedRef = true
// Time 50ms: exerciseTime = 0, reset condition true → playbackJustStartedRef = false
// Time 100ms+: using normal interpolated time

// What might happen:
// Time 0ms: playbackJustStartedRef = true
// Time 50ms: exerciseTime = 2500 (stale value), reset condition false!
// Time 2000ms+: STILL forcing 0! ❌
```

### Check 4: Verify Dependencies

**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useFretboardExercise.ts`

**Lines to check**: 1015-1023

```typescript
// ✅ SHOULD HAVE:
const nextNoteToPlay = useMemo(() => {
  // ... calculation ...
}, [
  syncProps.isPlaying,
  exerciseData.hasExercise,
  exerciseData.exerciseNotes,
  exerciseTime,
  exerciseTempo,
  exerciseTimeSignature.numerator,
  animationState.time,  // ← This triggers re-calc every RAF frame
]);
```

**Issue**: Heavy recomputation every RAF frame (60Hz)
- Necessary for smooth ring animation
- But not optimized

**Result**:
- [ ] Has `animationState.time` in dependencies ✅ (updates every RAF)
- [ ] Missing from dependencies ❌ (won't update every frame)

---

## Time Flow Verification

### Test Case 1: Zero Countdown

**Setup**:
- Select exercise with NO countdown
- Expected timing:
  ```
  Play pressed at T=0
  exerciseTime starts at 0ms
  First note at 0ms
  ```

**What to check**:
1. Does ring appear on first note immediately?
   - [ ] YES ✅ - First beat fix working
   - [ ] NO ❌ - First beat fix missing or not working

2. Do measure highlights start at measure 1?
   - [ ] YES ✅ - Correct
   - [ ] NO ❌ - Measure opacity issue

3. Is there any 1-2 frame delay before ring appears?
   - [ ] NO ✅ - FIRST-BEAT FIX is forcing 0
   - [ ] YES ❌ - Using stale interpolated time

### Test Case 2: 2 Second Countdown

**Setup**:
- Select exercise with 2 second countdown
- Expected timing:
  ```
  Play pressed at T=0
  Countdown: T=0 to T=2000ms (ring shows first note)
  Exercise starts: T=2000ms (ring moves to second note)
  ```

**What to check**:
1. During countdown (T=0-2000), ring stays on first note?
   - [ ] YES ✅ - Countdown fix working
   - [ ] NO ❌ - Ring advancing during countdown

2. At T=2000ms, does ring smoothly move to next note?
   - [ ] YES ✅ - Transition correct
   - [ ] Delayed/Jerky ❌ - Timing issue

3. Do dots stay green during countdown?
   - [ ] YES ✅ - Measure opacity correct
   - [ ] Change to orange ❌ - Measure calc wrong

### Test Case 3: Mid-Exercise Play

**Setup**:
- Start exercise at T=0
- Pause at T=3000ms
- Resume play
- Expected: Ring should resume from note that would play at T=3000ms

**What to check**:
1. Does ring resume at correct note?
   - [ ] YES ✅ - Time tracking correct
   - [ ] NO, jumped to start ❌ - FIRST-BEAT FIX triggered wrongly on resume
   - [ ] NO, jumped mid-exercise ❌ - Time value corrupted

2. Are measure highlights correct?
   - [ ] YES ✅
   - [ ] NO, reset to bar 1 ❌ - measure opacity issue

---

## Detailed Timing Verification

### How to Capture Exact Values

```javascript
// In browser console during playback:

// Create a monitoring script
const monitor = setInterval(() => {
  // Access React internals (requires React DevTools or fiber inspection)
  // OR monkeypatch if possible

  console.log(JSON.stringify({
    timestamp: Date.now(),
    exerciseTime: null, // Would need to capture from component
    effectiveTime: null, // Would need to capture from component
    rawCurrentTime: null, // Would need to capture from component
    measureOpacityTime: null, // Would need to capture from component
    nextNoteIndex: null, // Would need to capture from component
  }, null, 2));
}, 100);

// Stop monitoring
clearInterval(monitor);
```

### Alternative: Add Temporary Debug Code

**In useFretboardExercise.ts**, after line 393:
```typescript
// TEMPORARY DEBUG - Remove after testing
if (syncProps.isPlaying && Date.now() % 1000 < 100) {
  console.log(`[TIMING-CAPTURE] rawCurrentTime=${rawCurrentTime.toFixed(0)}, exerciseTime=${exerciseTime.toFixed(0)}, countdownDurationMs=${countdownDurationMs.toFixed(0)}`);
}
```

**In useMeasureOpacity.ts**, around line 180:
```typescript
// TEMPORARY DEBUG - Remove after testing
if (isPlaybackEffective && Math.floor(currentTime / 1000) !== Math.floor((currentTime - 20) / 1000)) {
  console.log(`[MEASURE-TIMING] currentTime=${currentTime.toFixed(0)}, effectiveTime=${effectiveTime.toFixed(0)}, currentMeasure=${currentPosition.measure}`);
}
```

---

## The Two-System Check

### System 1: Are Both Fixes Applied?

```
useFretboardExercise (line 351-391):
- [ ] Has FIRST-BEAT FIX v3 for rawCurrentTime ✅
- [ ] Missing fix ❌

useMeasureOpacity (line 144-170):
- [ ] Has FIRST-BEAT FIX v3 for effectiveTime ✅
- [ ] Missing fix ❌

nextNoteToPlay (line 856-1023):
- [ ] Has FIRST-BEAT FIX v3 for exerciseTime ❌ (expected missing)
- [ ] Has fix (unexpected) ✅ (would be good!)
```

**Expected State**:
```
✅ useFretboardExercise.rawCurrentTime: PROTECTED
✅ useMeasureOpacity.effectiveTime: PROTECTED
❌ nextNoteToPlay.exerciseTime: NOT PROTECTED (BUG!)
```

### System 2: Do They Reset Correctly?

```
useFretboardExercise (line 388-391):
if (playbackJustStartedRef.current && animationState.transportTimeRef.current < 1000) {
  playbackJustStartedRef.current = false;
}

- [ ] Uses transportTimeRef (correct - raw value) ✅
- [ ] Uses rawCurrentTime ❌
- [ ] Uses exerciseTime ❌

useMeasureOpacity (line 167-170):
if (playbackJustStartedRef.current && currentTime < 1000) {
  playbackJustStartedRef.current = false;
}

- [ ] Uses currentTime (= exerciseTime) - PROBLEMATIC ⚠️
- [ ] Should use rawTime equivalent
- [ ] Should track differently

nextNoteToPlay:
- [ ] No reset logic (N/A) ✅
```

**Expected State**:
```
✅ useFretboardExercise.rawCurrentTime: Resets when transportTime > 1000 (correct!)
⚠️ useMeasureOpacity: Resets when exerciseTime > 1000 (potentially wrong!)
❌ nextNoteToPlay: No protection at all (bug!)
```

---

## Fix Priority

### High Priority (Likely to Cause Issues)
1. **Add FIRST-BEAT FIX v3 to nextNoteToPlay** ← Most critical
   - Yellow ring jumps to wrong note on first beat
   - No time protection for stale values

2. **Fix useMeasureOpacity Reset Condition**
   - Should use raw time reference, not exerciseTime
   - Current condition works by accident for most cases

### Medium Priority (Performance/Clarity)
3. **Optimize nextNoteToPlay Recalculation**
   - Currently recalcs every RAF frame (60Hz)
   - Could be optimized with binary search + time windows

4. **Extract First-Beat Fix to Shared Hook**
   - Both hooks duplicate the logic
   - Single source of truth would be clearer

### Low Priority (Documentation)
5. **Add Comments Explaining Time Flow**
   - Currently confusing with multiple time variables
   - Documentation should explain rawCurrentTime vs exerciseTime

---

## Sign-Off Checklist

After reviewing this analysis, verify:

- [ ] I understand the two time paths (Measure Opacity vs Yellow Ring)
- [ ] I can identify where the FIRST-BEAT FIX v3 is applied
- [ ] I can identify where it's missing (nextNoteToPlay)
- [ ] I understand the countdown duration adjustment
- [ ] I can spot the reset condition bug in useMeasureOpacity
- [ ] I can explain the difference between rawCurrentTime and exerciseTime
- [ ] I know how to enable debug logging to verify issues
- [ ] I can interpret the console logs to spot discrepancies

If all checked: **You're ready to review/fix the issues!**
