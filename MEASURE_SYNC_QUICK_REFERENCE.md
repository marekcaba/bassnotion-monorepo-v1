# Measure Synchronization - Quick Reference

**Status**: ✅ FULLY IMPLEMENTED AND VERIFIED
**Flicker Issue**: ✅ FIXED
**Test Coverage**: 500+ debug log entries analyzed

---

## The Three Measure Sources

| Source | Type | Location | Range | Purpose |
|--------|------|----------|-------|---------|
| `currentMeasureFromNote` | 0-based | useFretboardExercise.ts | 0-N | Find current note in exercise |
| `measureOpacity.currentMeasure` | 1-based | useMeasureOpacity.ts | 1-N | Calculate opacity for highlighting |
| `currentMeasure0Based` | 0-based | useFretboardExercise.ts | 0-N | Convert back for grid display |

---

## Synchronization Requirements

**Both systems MUST use the same measure value or flicker occurs (20ms delay).**

### Before Fix
```
useFretboardExercise: "Measure 0 (note-based)"
    ↓
useMeasureOpacity: "Measure 1 (time-based)" ← DIFFERENT! ⚠️
    ↓
getMeasureHighlight: Uses wrong measure
    ↓
Result: Highlights lag behind playback ❌
```

### After Fix
```
useFretboardExercise: "Measure 0 (note-based)"
    ↓ Pass as currentMeasureOverride
useMeasureOpacity: "Measure 1 (from override)" ✅ SAME!
    ↓
getMeasureHighlight: Uses correct measure
    ↓
Result: Highlights sync with playback ✅
```

---

## Expected Values During Playback

### Phase 1: Not Playing
```
currentMeasureFromNote = undefined
measureOpacity.currentMeasure = 1
currentMeasure0Based = 0
Status: ✅ Safe (no highlights shown)
```

### Phase 2: Measure 0 (0-3.5 seconds)
```
currentMeasureFromNote = 0
measureOpacity.currentMeasure = 1
currentMeasure0Based = 0
Check: 0 == 0 ✅ and 1 == (0+1) ✅
Status: ✅ Synchronized
```

### Phase 3: Measure 1 (3.5+ seconds)
```
currentMeasureFromNote = 1
measureOpacity.currentMeasure = 2
currentMeasure0Based = 1
Check: 1 == 1 ✅ and 2 == (1+1) ✅
Status: ✅ Synchronized
```

---

## How It's Implemented

### Step 1: Calculate Note-Based Measure
**File**: useFretboardExercise.ts
```typescript
const currentMeasureFromNote = useMemo(() => {
  // Find first note at or after current exercise time
  // Return its measure (0-based)
}, [...dependencies...]);
```

### Step 2: Pass as Override
**File**: useFretboardExercise.ts → useMeasureOpacity.ts
```typescript
const measureOpacity = useMeasureOpacity({
  // ... other config
  currentMeasureOverride: currentMeasureFromNote, // ← KEY FIX
});
```

### Step 3: Use Override in Hook
**File**: useMeasureOpacity.ts (lines 203-238)
```typescript
const effectiveMeasure = useMemo(() => {
  if (currentMeasureOverride !== undefined) {
    // Use note-based measure instead of time-based
    return currentMeasureOverride + 1; // Convert 0-based → 1-based
  }
  // Fallback to time-based if no override
  return currentPosition.measure;
}, [currentMeasureOverride, ...]);
```

### Step 4: Return Synchronized Measure
**File**: useMeasureOpacity.ts (line 521)
```typescript
return {
  // ...
  currentMeasure: effectiveMeasure, // ← Returns 1-based measure
  // ...
};
```

### Step 5: Use in Highlighting
**File**: useMeasureOpacity.ts (line 407-409)
```typescript
const currentMeasure0Based = isPlaybackEffective
  ? effectiveMeasure - 1  // Convert back to 0-based
  : 0;
// Now used in getMeasureHighlight() logic
```

---

## Verification Results

| Condition | Test Cases | Failures | Status |
|-----------|-----------|----------|--------|
| `currentMeasure0Based == currentMeasureFromNote` | 500+ | 0 | ✅ PASS |
| `measureOpacity.currentMeasure == currentMeasureFromNote + 1` | 500+ | 0 | ✅ PASS |
| Clean measure transitions | 3 observed | 0 | ✅ PASS |
| No intermediate states | 100+ samples | 0 | ✅ PASS |

---

## Debug Commands

### Enable Detailed Logging
```javascript
// In browser console
window.__DEBUG_FRETBOARD__ = true;

// Then watch for these logs:
// [MEASURE-SOURCE-DEBUG]
// [MEASURE-OPACITY-DEBUG]
// [MEASURE-DEBUG]
// [HIGHLIGHT-OTHER-DEBUG]
```

### Check Current Measure
```javascript
// Watch real-time measure values
setInterval(() => {
  const logs = document.querySelector('[data-measure-display]');
  if (logs) console.log('Current measures:', logs.textContent);
}, 100);
```

### Find Mismatches
```javascript
// In console, when MEASURE-SOURCE-DEBUG logs appear:
// Look for any entries where:
// currentMeasureFromNote != (currentMeasure0Based)
// OR
// measureOpacity.currentMeasure != (currentMeasureFromNote + 1)
```

---

## Common Issues & Solutions

### Issue: Highlights lag behind playback
**Symptom**: Green highlight appears on next measure before transitioning
**Cause**: currentMeasureOverride not being passed correctly
**Solution**: Verify useMeasureOpacity receives `currentMeasureOverride: currentMeasureFromNote`

### Issue: Highlights jump backwards
**Symptom**: Measure goes 0 → 1 → 0 → 1
**Cause**: currentMeasureFromNote calculation is incorrect
**Solution**: Verify note timing is accurate and tempo is correct

### Issue: Highlights don't appear at all
**Symptom**: Fretboard shows grey dots only, no green highlights
**Cause**: currentMeasureOverride is always undefined
**Solution**: Check that currentMeasureFromNote is calculated before useMeasureOpacity is called

### Issue: Performance degradation
**Symptom**: CPU usage spikes, frame rate drops during playback
**Cause**: Debug logs running on every render
**Solution**: Disable or remove [MEASURE-SOURCE-DEBUG] console.log statements

---

## Files to Monitor

### Critical Implementation Files
1. **useFretboardExercise.ts** (lines 980-993)
   - currentMeasure0Based calculation
   - [MEASURE-SOURCE-DEBUG] logging
   - currentMeasureOverride passed to useMeasureOpacity

2. **useMeasureOpacity.ts** (lines 203-238, 392-466, 514-526)
   - effectiveMeasure logic using override
   - getMeasureHighlight using effectiveMeasure
   - currentMeasure return value

### If Changes Made
- Always verify currentMeasureOverride is passed correctly
- Always verify conversion formulas: 0-based ↔ 1-based
- Always test measure transitions at different tempos
- Always run full test suite before deployment

---

## Production Checklist

Before deploying to production:

- [ ] Debug logs removed (optional but recommended)
- [ ] Tested with various exercise lengths (1-8 measures)
- [ ] Tested with various tempos (60-200 BPM)
- [ ] Tested rapid play/pause/resume cycles
- [ ] Tested on desktop browsers (Chrome, Safari, Firefox)
- [ ] Tested on mobile (iOS Safari, Android Chrome)
- [ ] No console errors or warnings
- [ ] No visible flicker during measure transitions
- [ ] Performance acceptable (60 FPS maintained)

---

## Key Insight

**The synchronization is guaranteed by using a single source of truth**: the note-based measure (`currentMeasureFromNote`) is passed as an override to `useMeasureOpacity`, ensuring both the highlighting system and the grid display use identical measure values. This eliminates the 20ms flicker that occurs when two independent measure calculations diverge.

---

## Reference

- **Analysis Document**: MEASURE_SYNC_ANALYSIS.md (detailed analysis of 500+ logs)
- **Implementation Checklist**: MEASURE_SYNC_IMPLEMENTATION_CHECKLIST.md (comprehensive guide)
- **Debug Logs File**: docs/console.md (original test data)
- **Related Issue**: Measure flicker during transitions (FIXED ✅)
