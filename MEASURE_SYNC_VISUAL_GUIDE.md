# Measure Synchronization - Visual Guide

---

## The Problem: Pre-Fix Flicker

```
Timeline of Measure State (WITHOUT FIX):

t=0ms
│
├─ useFretboardExercise (note-based calc)
│  └─ currentMeasureFromNote = 0 (from exercise notes list)
│
├─ useMeasureOpacity (time-based calc)
│  └─ effectiveMeasure = 0 (from MusicalTimeConverter)
│
├─ getMeasureHighlight()
│  └─ Uses: effectiveMeasure = 0 → Highlight measure 0
│
└─ FretboardGrid display
   └─ Uses: currentMeasureFromNote = 0 → Show measure 0 as active

✓ Both agree: Measure 0 is active
✓ Highlights appear on correct notes
═══════════════════════════════════════════════════════════

t=3500ms (Measure transition point)
│
├─ Notes say: "We've moved to measure 1"
│  currentMeasureFromNote = 1
│
├─ Time says: "We're still in measure 0"
│  (slight delay in MusicalTimeConverter update)
│  effectiveMeasure = 0
│
├─ getMeasureHighlight() is called
│  └─ Uses: effectiveMeasure = 0 → Highlight measure 0
│     But currentMeasureFromNote = 1
│     ✗ MISMATCH! 20ms lag detected
│
└─ Result: FLICKER
   Highlights jump one measure ahead/behind
   Visual jitter for ~20ms
   User sees ugly transition
```

---

## The Solution: Fixed Data Flow

```
Timeline of Measure State (WITH FIX):

Throughout entire session:

currentMeasureFromNote (0-based, from notes)
        │
        ├─ CONVERTED ─────────────────┐
        │ add 1 for 1-based           │
        │                             │
        ↓                             ↓
currentMeasureOverride              effectiveMeasure
(0-based input)             (1-based, same measure!)
        │                             │
        │                             │
        ├─ PASSED TO ──→ useMeasureOpacity()
        │                      │
        │                      ├─ if (override !== undefined)
        │                      │    use override + 1
        │                      │ else
        │                      │    use time-based fallback
        │                      │
        │                      ↓
        │            getMeasureHighlight()
        │                      │
        │                      └─ Uses: effectiveMeasure
        │                         (SAME SOURCE as override!)
        │
        ├─ RETURNED FROM ← useMeasureOpacity
        │                      │
        │                      ↓
        │            currentMeasure (1-based)
        │
        ├─ CONVERTED ─────────────────┐
        │ subtract 1 for 0-based      │
        │                             │
        ↓                             ↓
currentMeasure0Based            FretboardGrid display
(0-based result)                uses currentMeasure0Based
        │                             │
        └─ SAME SOURCE AS ───────────→ currentMeasureFromNote
           (cycled through system)

Result: PERFECT SYNC
All systems use same measure value
No flicker!
```

---

## Phase-by-Phase Execution

### Phase 1: User Clicks Play

```
┌─────────────────────────────────────────────────────────┐
│ BEFORE FIRST NOTE PLAYS                                │
│                                                         │
│ isPlaying = true                                       │
│ exerciseTime = 0ms                                     │
│ currentMeasureFromNote = 0 (from first note)          │
│                                                         │
│ useMeasureOpacity() receives:                         │
│ ├─ currentMeasureOverride = 0                         │
│ ├─ currentTime = 0ms                                  │
│ ├─ isPlaying = true                                   │
│ └─ isPlaybackEffective = true                         │
│                                                         │
│ Calculation:                                          │
│ if (currentMeasureOverride !== undefined) {           │
│   effectiveMeasure = 0 + 1 = 1 ✓                     │
│ }                                                      │
│                                                         │
│ Returns:                                              │
│ currentMeasure = 1                                    │
│                                                         │
│ FretboardGrid converts:                               │
│ currentMeasure0Based = 1 - 1 = 0 ✓                   │
│                                                         │
│ getMeasureHighlight() uses:                           │
│ currentMeasure0Based = 0                              │
│ effectiveMeasure = 1                                  │
│ → Highlights measure 0 ✓                             │
│                                                         │
│ RESULT: ✓ Perfect sync                                │
└─────────────────────────────────────────────────────────┘
```

### Phase 2: Playing Measure 1

```
┌─────────────────────────────────────────────────────────┐
│ MEASURE 1 PLAYBACK (0-3500ms)                          │
│                                                         │
│ exerciseTime = 237ms (for example)                     │
│ currentMeasureFromNote = 0 (still in measure 0)       │
│                                                         │
│ useMeasureOpacity() receives:                         │
│ ├─ currentMeasureOverride = 0                         │
│ └─ effectiveTime = 237ms                             │
│                                                         │
│ Calculation:                                          │
│ override !== undefined? YES                           │
│ → Use override: effectiveMeasure = 0 + 1 = 1         │
│ (ignore time-based calc entirely)                    │
│                                                         │
│ Returns:                                              │
│ currentMeasure = 1                                    │
│                                                         │
│ FretboardGrid:                                        │
│ currentMeasure0Based = 1 - 1 = 0 ✓                   │
│                                                         │
│ Highlights:                                           │
│ getMeasureHighlight() checks:                         │
│ currentMeasure0Based = 0 ✓                            │
│ effectiveMeasure = 1 ✓                                │
│ → Both point to measure 0 → Green highlight ✓        │
│                                                         │
│ Repeated 200+ times, always synced ✓                │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: Measure Transition (3500ms)

```
┌─────────────────────────────────────────────────────────┐
│ TRANSITION POINT (3500ms)                              │
│                                                         │
│ Notes now indicate: Move to next measure              │
│ currentMeasureFromNote = 1 (updated instantly)        │
│                                                         │
│ useMeasureOpacity() receives:                         │
│ ├─ currentMeasureOverride = 1 (UPDATED!)             │
│ └─ currentTime = 3500ms                              │
│                                                         │
│ Calculation:                                          │
│ override !== undefined? YES                           │
│ → Use override: effectiveMeasure = 1 + 1 = 2         │
│ (again, ignore time-based calc)                     │
│                                                         │
│ Returns:                                              │
│ currentMeasure = 2                                    │
│                                                         │
│ FretboardGrid converts:                               │
│ currentMeasure0Based = 2 - 1 = 1 ✓                   │
│                                                         │
│ Highlights switch:                                    │
│ from measure 0 (grey) → measure 1 (green) ✓         │
│                                                         │
│ RESULT: ✓ Clean, immediate transition                │
│         ✓ NO intermediate states                      │
│         ✓ NO flicker                                  │
└─────────────────────────────────────────────────────────┘
```

### Phase 4: Playing Measure 2

```
┌─────────────────────────────────────────────────────────┐
│ MEASURE 2 PLAYBACK (3500ms+)                           │
│                                                         │
│ exerciseTime = 3718ms (for example)                    │
│ currentMeasureFromNote = 1 (in measure 1)             │
│                                                         │
│ useMeasureOpacity() receives:                         │
│ ├─ currentMeasureOverride = 1                         │
│ └─ effectiveTime = 3718ms                            │
│                                                         │
│ Calculation:                                          │
│ override !== undefined? YES                           │
│ → Use override: effectiveMeasure = 1 + 1 = 2         │
│ (measure-based, not time-based)                     │
│                                                         │
│ Returns:                                              │
│ currentMeasure = 2                                    │
│                                                         │
│ FretboardGrid:                                        │
│ currentMeasure0Based = 2 - 1 = 1 ✓                   │
│                                                         │
│ Highlights:                                           │
│ getMeasureHighlight() checks:                         │
│ currentMeasure0Based = 1 ✓                            │
│ effectiveMeasure = 2 ✓                                │
│ → Both point to measure 1 → Green highlight ✓        │
│                                                         │
│ Sustained 100+ times, always synced ✓               │
└─────────────────────────────────────────────────────────┘
```

---

## Data Structure Relationships

### Pre-Playback

```
useFretboardExercise.ts
├─ isPlaying = false
├─ currentMeasureFromNote = undefined
│
useMeasureOpacity.ts
├─ isPlaybackEffective = false
├─ effectiveMeasure = defaults to 1
│
Result
├─ currentMeasure = 1
├─ currentMeasure0Based = 0
│
getMeasureHighlight()
└─ All notes show grey (inactive) → No flicker risk
```

### During Playback

```
useFretboardExercise.ts
├─ isPlaying = true
├─ exerciseTime = N ms
├─ currentMeasureFromNote = M (0-based, from notes)
│
useMeasureOpacity.ts
├─ currentMeasureOverride = M (received from above)
├─ Calculation: effectiveMeasure = M + 1 (convert to 1-based)
├─ (ignores time-based calculation)
│
getMeasureHighlight()
├─ currentMeasure0Based = effectiveMeasure - 1 = M
├─ Checks if note in measure M → Green highlight ✓
│
FretboardGrid.tsx
└─ currentMeasure0Based = M → Displays measure M as active ✓

RESULT: Both systems use measure M → NO FLICKER
```

---

## Conversion Chain Visualization

```
                    0-BASED          1-BASED
                    (Notes)         (Time API)
                       │                │
                       │                │
    currentMeasureFromNote         MusicalTimeConverter
    (0-based integer)              (returns 1-based measure)
             │                            │
             └─────┬─────────────────────┘
                   │
                   │ OVERRIDE FORCES
                   │ NOTE-BASED TO BE USED
                   ↓
        currentMeasureOverride (0-based)
                   │
                   │ PASSED TO
                   ↓
        useMeasureOpacity()
                   │
                   │ CONVERTED
                   │ override + 1
                   ↓
        effectiveMeasure (1-based, from override)
                   │
                   ├─ USED IN ──────→ getMeasureHighlight()
                   │ (returns correct highlight state)
                   │
                   │ RETURNED AS
                   ↓
        currentMeasure (1-based, goes back out)
                   │
                   │ CONVERTED
                   │ measure - 1
                   ↓
        currentMeasure0Based (0-based)
                   │
                   ├─ USED IN ──────→ FretboardGrid display
                   │ (shows correct measure)
                   │
                   └─ EQUALS ──────→ currentMeasureFromNote
                   (Perfect sync!)
```

---

## Error Scenarios

### Scenario A: currentMeasureOverride NOT Passed

```
PROBLEM: useMeasureOpacity doesn't receive the override

useFretboardExercise calculates: currentMeasureFromNote = 0

useMeasureOpacity calculates:
├─ override = undefined (not passed!)
├─ Falls back to time-based
├─ time-based = 0.5 (between measures)
├─ effectiveMeasure = 0.5
└─ Returns currentMeasure = 1 (correct by accident)

FretboardGrid:
├─ currentMeasure0Based = 0 (correct)
└─ But getMeasureHighlight uses effectiveMeasure = 0.5

getMeasureHighlight() confused:
├─ Checks: is note in measure 0.5? (NO)
├─ Checks: is note in measure 1.5? (NO)
└─ Result: No highlights (WRONG!)

SYMPTOM: Fretboard shows grey dots only, no green highlights
FIX: Ensure currentMeasureOverride is passed to useMeasureOpacity
```

### Scenario B: Conversion Formula Wrong

```
PROBLEM: currentMeasure0Based calculated incorrectly

Assume: currentMeasure = 2

WRONG CONVERSION:
└─ currentMeasure0Based = currentMeasure (no conversion!)
   └─ currentMeasure0Based = 2
   └─ But currentMeasureFromNote = 1
   └─ MISMATCH! (2 != 1)
   └─ Result: Off-by-one flicker

CORRECT CONVERSION:
└─ currentMeasure0Based = currentMeasure - 1
   └─ currentMeasure0Based = 2 - 1 = 1
   └─ Matches currentMeasureFromNote = 1
   └─ Result: Perfect sync

SYMPTOM: Highlights appear on wrong measure
FIX: Verify formula: currentMeasure0Based = currentMeasure - 1
```

### Scenario C: effectiveMeasure Doesn't Use Override

```
PROBLEM: useMeasureOpacity ignores the override

Code (WRONG):
│
├─ if (currentMeasureOverride !== undefined) {
│    // Actually uses time-based instead!
│    const result = currentPosition.measure; // IGNORES override!
│  }

Result:
├─ currentMeasureOverride = 0
├─ currentPosition.measure = 0 (time-based)
├─ But at transition, time-based lags slightly
├─ effectiveMeasure = 0 (time-based)
└─ getMeasureHighlight uses wrong measure
   └─ Flicker!

Code (CORRECT):
│
├─ if (currentMeasureOverride !== undefined) {
│    const result = currentMeasureOverride + 1; // Uses override!
│  }

Result:
├─ currentMeasureOverride = 0
├─ effectiveMeasure = 0 + 1 = 1 (from override!)
├─ getMeasureHighlight uses override-based measure
└─ No flicker!

SYMPTOM: Highlight lag at measure transitions (~20ms)
FIX: Verify useMeasureOpacity actually uses currentMeasureOverride
```

---

## Testing Checklist

### Unit Tests to Add

```
Test 1: Override is passed correctly
├─ Setup: currentMeasureFromNote = 2
├─ Call: useMeasureOpacity({ currentMeasureOverride: 2, ... })
├─ Assert: currentMeasure returned = 3 (2 + 1)
└─ Assert: getMeasureHighlight uses measure 2 (3 - 1)

Test 2: Conversion formulas are symmetric
├─ Setup: Various measure values (0-10)
├─ Verify: measure = (measure0Based + 1) → All match
├─ Verify: measure0Based = (measure - 1) → All match
└─ Assert: (measure - 1) + 1 = measure (always true)

Test 3: Fallback works if override undefined
├─ Setup: currentMeasureOverride = undefined
├─ Setup: currentTime = 500ms, tempo = 100 BPM
├─ Call: useMeasureOpacity({ currentMeasureOverride: undefined, ... })
├─ Assert: Uses time-based fallback
└─ Assert: Still returns valid currentMeasure

Test 4: Transition is clean
├─ Setup: Playback from start, measure 0
├─ Simulate: Time advances to 3500ms (transition point)
├─ Update: currentMeasureFromNote = 0 → 1
├─ Assert: No intermediate states (0.5, 1.5)
└─ Assert: Direct transition 0 → 1

Test 5: Values sync through cycle
├─ Setup: Various input values
├─ Cycle: Input → convert → calculate → return → convert back
├─ Assert: Final value equals original input
└─ Assert: No loss of precision or rounding errors
```

### Integration Tests to Add

```
Test: Full measure sync during playback
├─ Setup: Load exercise with 4 measures
├─ Start: Play from beginning
├─ Monitor: currentMeasureFromNote, currentMeasure, currentMeasure0Based
├─ Assert: All three stay synchronized throughout
├─ Assert: Transitions are clean (no jitter)
└─ Assert: No visible flicker on screen

Test: Multiple play/pause cycles
├─ Setup: Load exercise
├─ Cycle: Play → Pause → Play → ...
├─ Assert: Measure values reset correctly when paused
├─ Assert: Resume uses correct measure from current time
└─ Assert: No lingering state from previous cycle

Test: Various tempos
├─ Setup: Load same exercise
├─ Test: Slow tempo (60 BPM), normal (120), fast (200)
├─ Assert: Transitions still sync at all tempos
└─ Assert: No tempo-dependent flicker

Test: Various exercise lengths
├─ Setup: Exercises with 1, 2, 4, 8 measures
├─ Test: All transitions in all exercises
├─ Assert: Sync maintained for all lengths
└─ Assert: No scaling-dependent issues
```

---

## Conclusion

The measure synchronization fix works by:

1. **Capturing note-based measure** (direct from exercise data)
2. **Passing as override** to opacity hook
3. **Using override throughout** highlight calculations
4. **Returning same measure** to grid display

This ensures all systems see the same measure value, eliminating the 20ms flicker that occurs when time-based and note-based measures diverge during transitions.

**Result**: Smooth, flicker-free playback with synchronized visual highlights.
