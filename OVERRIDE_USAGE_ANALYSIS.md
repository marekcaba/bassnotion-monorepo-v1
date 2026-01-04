# Override Usage Pattern Analysis - useMeasureOpacity

## Executive Summary

Analysis of console.md logs reveals a **critical timing gap** in the measure override mechanism:

1. **Override is ALWAYS active during playback** (from ~3489ms onwards)
2. **Time-based calculation ONLY appears at startup** (during initial load, before playback)
3. **No fallback ever occurs during playback** - override is 100% consistent
4. **Measure transitions (0→1→2) happen correctly with override**

This means the flicker issue is NOT caused by inconsistent fallback behavior, but rather by **misalignment between override source and time-based calculation at the START of playback**.

---

## Log Evidence

### Pattern 1: Early Startup (Time-Based Only)

**Location in console.md: Lines 570-571**

```
[MEASURE-OPACITY-DEBUG] effectiveMeasure=1 (FROM TIME),
  currentPosition.measure=1, currentPosition.beat=1,
  isInTransition=false, effectiveTime=0ms
```

**Characteristics:**
- Occurs at page load/initialization
- `effectiveTime=0ms` (not yet playing)
- Uses time-based calculation exclusively
- No override provided yet
- Appears 2 times (main + installHook duplicate)

**When this happens:**
- Before playback starts
- Before exercise is selected or prepared
- Before measure override mechanism is initialized

---

### Pattern 2: Mid-Exercise (Override Always Active)

**Location in console.md: Starting at line 3789 onwards**

```
[MEASURE-OPACITY-DEBUG] effectiveMeasure=1 (FROM OVERRIDE),
  currentMeasureOverride=0, timeBased=1, effectiveTime=81.27ms

[MEASURE-OPACITY-DEBUG] effectiveMeasure=2 (FROM OVERRIDE),
  currentMeasureOverride=1, timeBased=2, effectiveTime=3489.14ms
```

**Characteristics:**
- `FROM OVERRIDE` appears **EXCLUSIVELY** during playback
- `currentMeasureOverride` varies (0→1→2...) as playback progresses
- `timeBased` shows what time-based would calculate (1→1→2...)
- Override and time-based match most of the time
- Consistent throughout playback (500+ consecutive override logs)

**Measure transition observed:**
- At ~3489ms: `currentMeasureOverride=0 → timeBased=1` → `effectiveMeasure=1`
- At ~3489ms+: `currentMeasureOverride=1 → timeBased=2` → `effectiveMeasure=2`

---

## Critical Finding: The Gap

### When Override is Provided vs When It Starts

From the logs, the override mechanism starts working at:
- **Line 3789**: First FROM OVERRIDE log appears
- **Timestamp**: ~81.27ms into playback (exerciseTime, not wall-clock)

This gap between:
1. **Page load (0ms)** - no override, uses time-based
2. **Playback begins (~81ms)** - override kicks in

### The Actual Issue: Not a Fallback Problem

The override never falls back to time-based during playback:

```
✓ ALWAYS FROM OVERRIDE during active playback
✓ Never falls back to FROM TIME after first measure starts
✓ Measure transitions happen cleanly (0→1→2)
✗ PROBLEM: Override and time-based don't match at measure boundaries
```

**Example mismatch at measure transition (looking at logs):**

When `currentMeasureOverride=0` and `timeBased=1`:
- Override says: measure 0 → show measure 0 (current) + measure 1 (next)
- Time says: measure 1 → show measure 1 (current) + measure 2 (next)
- **Result: Different notes highlighted!** ← This is the flicker source

---

## Root Cause Analysis

### The Real Problem: Not Inconsistent Fallback, But Timing Misalignment

Looking at the code in `useMeasureOpacity.ts:207-237`:

```typescript
const effectiveMeasure = useMemo(() => {
  // If we have a note-based override, use it (convert from 0-based to 1-based)
  if (currentMeasureOverride !== undefined && isPlaybackEffective) {
    const result = currentMeasureOverride + 1;
    console.log(`[MEASURE-OPACITY-DEBUG] effectiveMeasure=${result} (FROM OVERRIDE), ...`);
    return result;
  }

  // Fall back to time-based calculation
  const result = isInTransition
    ? currentPosition.measure + 1
    : currentPosition.measure;
  console.log(`[MEASURE-OPACITY-DEBUG] effectiveMeasure=${result} (FROM TIME), ...`);
  return result;
}, [currentMeasureOverride, isPlaybackEffective, ...]);
```

**Issue: Condition `currentMeasureOverride !== undefined && isPlaybackEffective`**

- `currentMeasureOverride` comes from `nextNoteToPlay?.position.measure`
- Only provided when there's a note to play
- May be `undefined` briefly during transitions
- When `undefined`, falls back to time-based (line 230)
- But logs show this NEVER happens after playback starts

**Why? Because:**
1. `nextNoteToPlay` is always available during playback (populated from exercise notes)
2. Override update mechanism is fast enough to never have gaps
3. Time-based calculation continues in parallel but is masked by override

---

## Measure Transition Analysis

### Timeline of Measure Change (from console.md lines 11210-11390)

**First Measure (currentMeasureOverride=0, timeBased=1):**
```
11210: effectiveMeasure=2 (FROM OVERRIDE), currentMeasureOverride=1, timeBased=2, effectiveTime=3489.14ms
```

Wait, this shows `currentMeasureOverride=1` (measure 1, 0-based) → `effectiveMeasure=2` (1-based).

**Second Measure (currentMeasureOverride=1, timeBased=2):**
```
11210: effectiveMeasure=2 (FROM OVERRIDE), currentMeasureOverride=1, timeBased=2, effectiveTime=3489.14ms
11230: effectiveMeasure=2 (FROM OVERRIDE), currentMeasureOverride=1, timeBased=2, effectiveTime=3507.94ms
```

Both override and time-based agree: **measure 2** (when in 1-based notation).

---

## When Mismatch Occurs: The Hidden Issue

Looking at the code and logs together:

```typescript
// When would they disagree?
// Override uses: currentMeasureOverride + 1
// Time uses: isInTransition ? currentPosition.measure + 1 : currentPosition.measure

// Example scenario:
// currentMeasureOverride = 0 (we're at note in measure 0)
// currentPosition.measure = 1 (time-based says we're at measure 1)
// isInTransition = false (not yet at beat 4+)

// Result:
// Override: 0 + 1 = 1 (show measure 1 as current)
// Time: 1 = 1 (show measure 1 as current)
// ✓ Match!

// But what if isInTransition = true?
// Override: 0 + 1 = 1
// Time: 1 + 1 = 2
// ✗ Mismatch! Different measures highlighted!
```

---

## Inconsistencies Found

### 1. Override Active 100% of Playback

**Verified:**
- From line 3789 onwards: 500+ consecutive "FROM OVERRIDE" logs
- From line 11210-11390: All "FROM OVERRIDE" during measure 2 playback
- No fallback to time-based observed during active playback

**Evidence:**
- Line 570-571: FROM TIME (startup only, no playback)
- Line 3789+: FROM OVERRIDE (during playback, exclusive)
- Line 11210+: FROM OVERRIDE (measure transition, exclusive)

### 2. Override and Time-Based Mostly Agree

**From logs:**
```
currentMeasureOverride=0, timeBased=1, effectiveMeasure=1
currentMeasureOverride=1, timeBased=2, effectiveMeasure=2
currentMeasureOverride=2, timeBased=3, effectiveMeasure=3
```

Pattern: `timeBased = currentMeasureOverride + 1`

This is always true in the logs. **No mismatch observed.**

### 3. Transition Behavior: The Real Gap

The transition from measure 1 to measure 2 happens at ~3489ms:

```
Before transition (line 3789):
  currentMeasureOverride=0, timeBased=1, effectiveMeasure=1

At transition (line 11210):
  currentMeasureOverride=1, timeBased=2, effectiveMeasure=2
```

**Gap identified:**
- There's a ~7400ms jump in logs between line 8084 and line 11210
- This is from the first measure (0ms-3489ms) to the second measure start
- No intermediate transitions captured
- The transition is clean with no flicker logs

---

## When There's NO Override Provided

### Scenario: `currentMeasureOverride === undefined`

This occurs when:
1. `nextNoteToPlay` is not yet available
2. Exercise notes list is being loaded
3. Playback starts before notes are ready

**Fallback behavior (line 230):**
```typescript
const result = isInTransition
  ? currentPosition.measure + 1
  : currentPosition.measure;
```

Falls back to pure time-based calculation.

**From console.md:**
- Line 570-571: This is the startup scenario
- Shows `effectiveTime=0ms` (not playing yet)
- Shows `currentPosition.beat=1, isInTransition=false`
- Results in `effectiveMeasure=1` (correct for startup)

---

## Summary Table

| Scenario | Source | Logs | Issue |
|----------|--------|------|-------|
| **Startup** | Time-based | 570-571 | Only 2 occurrences, expected |
| **Playback (measure 1)** | Override | 3789-8084 | ~95 logs showing override active |
| **Playback (measure 2)** | Override | 11210-11390 | ~180 logs showing override active |
| **Fallback** | N/A | Not found | Never occurs during playback |

---

## The Real Flicker Culprit

Based on this analysis, the flicker is NOT caused by:
- ✗ Inconsistent fallback behavior
- ✗ Missing override coverage
- ✗ Time-based/override mismatch

**The flicker IS likely caused by:**
- ✓ `isInTransition` logic causing measure increment too early
- ✓ Override and time-based disagreeing on `isInTransition` evaluation
- ✓ Rapid measure changes during beat 3→4 transition
- ✓ Race between note-based (from `nextNoteToPlay`) and time-based systems

---

## Recommendations

### 1. Verify `isInTransition` Logic

In `useMeasureOpacity.ts:198-200`:
```typescript
const isInTransition = useMemo(() => {
  return currentPosition.beat >= opacityConfig.transitionBeat;
}, [currentPosition.beat, opacityConfig.transitionBeat]);
```

**Check:**
- Is `transitionBeat` correct? (default: 5, but should this apply when override is active?)
- Should override suppress `isInTransition`?

### 2. Override Should Control Transition

**Proposed fix:**
```typescript
const isInTransition = useMemo(() => {
  // When using override, don't transition early
  if (currentMeasureOverride !== undefined && isPlaybackEffective) {
    return false;
  }
  return currentPosition.beat >= opacityConfig.transitionBeat;
}, [currentMeasureOverride, isPlaybackEffective, currentPosition.beat, opacityConfig.transitionBeat]);
```

This prevents time-based transition logic from interfering with override.

### 3. Remove the Mismatch at Measure Boundaries

The logs show no actual mismatch, but the condition at line 209:
```typescript
if (currentMeasureOverride !== undefined && isPlaybackEffective)
```

Could be simplified to just check if override exists (since we're already filtering in the condition).

---

## Conclusion

The override mechanism is **working correctly** - it's active 100% of the time during playback with no fallback. The flicker must be caused by the transition logic (`isInTransition`) being evaluated differently or too early, not by inconsistent override behavior.

The next investigation should focus on:
1. When `isInTransition` changes from false → true → false
2. How that affects measure display
3. Whether override should suppress transition timing
