# Code Locations Reference

## All relevant files and line numbers for the currentTime flow analysis

---

## Primary Files

### 1. useFretboardExercise.ts

**Location**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useFretboardExercise.ts`

**Key Sections**:

#### useAnimationTime Hook (Lines 45-246)
- **Purpose**: RAF-based time interpolation for 60fps animation
- **Key Variables**:
  - `lastTransportTimeRef` - Last time from transport:position-updated
  - `lastTransportReceivedAtRef` - When we received the last transport time
  - `renderTrigger` - State to trigger re-renders at 60fps
- **Key Methods**:
  - `subscribeToEvents()` - Subscribes to EventBus
  - `updateAnimation()` - RAF loop
- **Events subscribed**:
  - `playback:starting` - Initial position reset
  - `transport:stop` - Stop event
  - `transport:position-updated` - Continuous position updates

#### FIRST-BEAT FIX v3 for rawCurrentTime (Lines 351-391)
```typescript
Line 359: const playbackJustStarted = syncProps.isPlaying && !wasPlayingRef.current;
Line 360-365: Detection and logging
Line 366: wasPlayingRef.current = syncProps.isPlaying;

Line 380-384: Calculate rawCurrentTime with fix
  rawCurrentTime = playbackJustStartedRef.current ? 0 : ...

Line 388-391: Reset condition
  if (playbackJustStartedRef.current && animationState.transportTimeRef.current < 1000)
```

**Status**: ✅ FIRST-BEAT FIX v3 Applied

#### Countdown Adjustment (Line 393)
```typescript
const exerciseTime = Math.max(0, rawCurrentTime - countdownDurationMs);
```

#### nextNoteToPlay Calculation (Lines 856-1023)
- **Lines 860-881**: Helper function `noteToPosition()`
- **Lines 878-881**: When not playing, return first note
- **Lines 883-888**: Countdown handling (shows first note during countdown)
- **Lines 890-928**: Helper function `positionToMs()`
- **Lines 930-947**: Debug logging for first 5 notes timing
- **Lines 949-959**: Ring timing debug logs
- **Lines 961-1003**: Main loop - find current note by exerciseTime
- **Lines 1005-1010**: If before first note, show first note
- **Lines 1015-1023**: Dependencies array

**Status**: ❌ FIRST-BEAT FIX v3 NOT Applied - MISSING!

**Missing Code**:
- No `playbackJustStartedRef` tracking
- No `wasPlayingRef` tracking (separate one exists at line 294)
- No force to `effectiveExerciseTime = 0` on playback start
- No reset condition

---

### 2. useMeasureOpacity.ts

**Location**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useMeasureOpacity.ts`

**Key Sections**:

#### Interface Definitions (Lines 12-87)
- `MeasureOpacityConfig` - Configuration for opacity values
- `UseMeasureOpacityConfig` - Input configuration
- `MeasureHighlightState` - Type for highlight state
- `MeasureHighlightResult` - Result with shouldHighlight and opacity
- `UseMeasureOpacityReturn` - Return value with functions

#### Default Configuration (Lines 92-98)
```typescript
const DEFAULT_OPACITY_CONFIG: MeasureOpacityConfig = {
  currentMeasure: 1.0,    // 100% opacity for current measure
  nextMeasure: 0.3,       // 30% opacity for next measure preview
  otherMeasures: 0,       // 0% opacity for others
  transitionBeat: 5,      // Transition after beat 4 (disable early transition)
  transitionDurationMs: 250,
};
```

#### FIRST-BEAT FIX v3 Implementation (Lines 144-170)
```typescript
Line 140-142: Create refs for tracking
  const wasPlayingRef = useRef(false);
  const playbackJustStartedRef = useRef(false);

Line 144: Detect playback start
  const playbackJustStarted = isPlaying && !wasPlayingRef.current;

Line 152-158: Apply fix on detection
  if (playbackJustStarted) {
    playbackJustStartedRef.current = true;
    console.log('[useMeasureOpacity] 🎯 FIRST-BEAT FIX v3: ...')
  }

Line 159: Update ref for next render
  wasPlayingRef.current = isPlaying;

Line 163: Force time to 0
  const effectiveTime = playbackJustStartedRef.current ? 0 : currentTime;

Line 167-170: Reset condition (BUGGY)
  if (playbackJustStartedRef.current && currentTime < 1000) {
    playbackJustStartedRef.current = false;
  }
```

**Status**: ✅ FIRST-BEAT FIX v3 Applied, BUT ⚠️ Reset Condition is Broken

**Bug in Reset Condition**:
- Line 167: `currentTime < 1000`
- Problem: `currentTime` is `exerciseTime` (AFTER countdown subtraction)
- For 2s countdown: Works by accident (exerciseTime = 0 < 1000)
- For 0s countdown: `exerciseTime` = raw value, might not trigger reset

#### Current Time Calculation (Lines 176-200)
```typescript
Line 176-183: Calculate musical position
  if (!isPlaybackEffective) {
    return { measure: 1, beat: 1, subdivision: 0 };
  }

  const pos = MusicalTimeConverter.msToPosition(effectiveTime, {
    tempo,
    timeSignature,
  });
```

#### Transition Zone (Lines 202-205)
```typescript
const isInTransition = useMemo(() => {
  return currentPosition.beat >= opacityConfig.transitionBeat;
}, [currentPosition.beat, opacityConfig.transitionBeat]);
```

#### Effective Measure Calculation (Lines 207-213)
```typescript
const effectiveMeasure = useMemo(() => {
  return isInTransition
    ? currentPosition.measure + 1
    : currentPosition.measure;
}, [currentPosition.measure, isInTransition]);
```

#### Note Position Maps (Lines 216-350)
- `notePositionToMeasure` - Maps position to first measure (Lines 216-283)
- `notePositionToAllMeasures` - Maps position to all measures (Lines 286-350)

#### getMeasureHighlight Function (Lines 367-430)
```typescript
const getMeasureHighlight = useCallback(
  (stringIndex: number, fret: Fret): MeasureHighlightResult => {
    // Gets current and next measure (0-based)
    const currentMeasure0Based = isPlaybackEffective
      ? effectiveMeasure - 1
      : 0;
    const nextMeasure0Based = currentMeasure0Based + 1;

    // Check current measure
    if (noteMeasures.includes(currentMeasure0Based)) {
      return {
        shouldHighlight: true,
        state: 'current',
        opacity: opacityConfig.currentMeasure,
      };
    }

    // Check next measure
    if (noteMeasures.includes(nextMeasure0Based)) {
      return {
        shouldHighlight: true,
        state: 'next',
        opacity: opacityConfig.nextMeasure,
      };
    }

    // Other measures
    return {
      shouldHighlight: false,
      state: 'other',
      opacity: 1.0,
    };
  },
  [isPlaybackEffective, effectiveMeasure, notePositionToAllMeasures, opacityConfig],
);
```

#### getNoteOpacity Function (Lines 432-470)
```typescript
const getNoteOpacity = useCallback(
  (stringIndex: number, fret: Fret): number => {
    const positionKey = `${stringIndex},${fret}`;
    const noteMeasures = notePositionToAllMeasures.get(positionKey);

    if (!noteMeasures || noteMeasures.length === 0) {
      return 0;
    }

    const currentMeasure0Based = isPlaybackEffective
      ? effectiveMeasure - 1
      : 0;
    const nextMeasure0Based = currentMeasure0Based + 1;

    if (noteMeasures.includes(currentMeasure0Based)) {
      return opacityConfig.currentMeasure;
    }

    if (noteMeasures.includes(nextMeasure0Based)) {
      return opacityConfig.nextMeasure;
    }

    return opacityConfig.otherMeasures;
  },
  [isPlaybackEffective, effectiveMeasure, notePositionToAllMeasures, opacityConfig],
);
```

#### Return Value (Lines 478-486)
```typescript
return {
  getNoteOpacity,
  getMeasureHighlight,
  currentMeasure: currentPosition.measure,
  currentBeat: currentPosition.beat,
  isInTransition,
  transitionDuration,
};
```

---

### 3. FretboardGrid.tsx

**Location**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/components/FretboardGrid.tsx`

**Key Sections**:

#### Interface Definition (Lines 53-58)
```typescript
export interface NextNoteToPlay {
  stringIndex: number;
  fret: Fret;
  noteIndex: number;
}
```

#### Component Props (Lines 60-100)
```typescript
interface FretboardGridProps {
  // ... other props ...
  nextNoteToPlay?: NextNoteToPlay | null;  // Line 99
}
```

#### Component Destructuring (Lines 102-129)
```typescript
export const FretboardGrid: React.FC<FretboardGridProps> = ({
  // ... other destructuring ...
  nextNoteToPlay,  // Line 128
}) => {
```

#### Yellow Ring Rendering (Lines 399-403)
```typescript
const isNextNoteToPlay = nextNoteToPlay &&
  nextNoteToPlay.stringIndex === stringIndex &&
  nextNoteToPlay.fret === fret;
```

#### Ring Styling (Lines 428-441)
```typescript
const nextNoteRing = isNextNoteToPlay
  ? ' ring-1 ring-yellow-400 ring-offset-1 ring-offset-transparent'
  : '';

if (isOrangeMeasure) {
  const multipleSelectionRing = hasMultipleSelections && !isNextNoteToPlay
    ? ' ring-1 ring-orange-300'
    : '';
  return `bg-orange-500 text-white ${neumorphicShadowPressed}${multipleSelectionRing}${nextNoteRing}`;
} else {
  const multipleSelectionRing = hasMultipleSelections && !isNextNoteToPlay
    ? ' ring-1 ring-green-300'
    : '';
  return `bg-green-500 text-black ${neumorphicShadowPressed}${multipleSelectionRing}${nextNoteRing}`;
}
```

---

### 4. FretboardCard.tsx

**Location**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard.tsx`

**Key Sections**:

#### FretboardGrid Props (Lines 965-1008)
```typescript
<FretboardGrid
  // ... other props ...
  getMeasureOpacity={fretboard.measureOpacity.getNoteOpacity}  // Line 1002
  getMeasureHighlight={fretboard.measureOpacity.getMeasureHighlight}  // Line 1003
  measureOpacityTransition={fretboard.measureOpacity.transitionDuration}  // Line 1004
  measureAwareConnections={fretboard.exercise.measureAwareConnections}  // Line 1005
  currentMeasure0Based={fretboard.exercise.currentMeasure0Based}  // Line 1006
  nextNoteToPlay={fretboard.nextNoteToPlay}  // Line 1007
/>
```

---

## Time Variable Mapping

### Where Each Time Variable Comes From

```
syncProps.currentTime
  └─ From SyncedWidget/Transport
  └─ Updates via TIMELINE_UPDATE event

animationState.transportTimeRef
  └─ From useAnimationTime hook
  └─ Set in playback:starting event
  └─ Updated in transport:position-updated event
  └─ RAF loop reads this

animationState.receivedAtRef
  └─ From useAnimationTime hook
  └─ Set when transport:position-updated arrives
  └─ RAF loop uses for interpolation

rawCurrentTime
  └─ Calculated at render time in useFretboardExercise
  └─ = transportTimeRef + (now - receivedAtRef) + 300ms
  └─ FIRST-BEAT FIX v3 forces = 0 on playback start

countdownDurationMs
  └─ Calculated in useFretboardExercise
  └─ = countdownBars * beatsPerBar * msPerBeat

exerciseTime
  └─ Calculated in useFretboardExercise
  └─ = max(0, rawCurrentTime - countdownDurationMs)
  └─ Passed to useMeasureOpacity
  └─ Used directly in nextNoteToPlay

effectiveTime (in useMeasureOpacity)
  └─ = playbackJustStartedRef ? 0 : currentTime
  └─ currentTime param = exerciseTime
  └─ FIRST-BEAT FIX v3 forces = 0 on playback start

effectiveExerciseTime (should exist in nextNoteToPlay)
  └─ Currently MISSING - this is the bug!
  └─ Would be = playbackJustStartedRef ? 0 : exerciseTime
```

---

## Dependencies and Data Flow

### useFretboardExercise Output Used By:

**measureOpacity** (Line 415):
```typescript
const measureOpacity = useMeasureOpacity({
  exerciseNotes: exerciseData.exerciseNotes,
  currentTime: exerciseTime,           // ← TIME INPUT
  isPlaying: syncProps.isPlaying,
  tempo: exerciseTempo,
  timeSignature: exerciseTimeSignature,
  stringCount,
});
```

**FretboardGrid via FretboardCard** (Lines 1002-1003):
```typescript
getMeasureOpacity={fretboard.measureOpacity.getNoteOpacity}
getMeasureHighlight={fretboard.measureOpacity.getMeasureHighlight}
```

**FretboardGrid via FretboardCard** (Line 1007):
```typescript
nextNoteToPlay={fretboard.nextNoteToPlay}
```

---

## Key Constants

### FIRST-BEAT FIX Threshold (useFretboardExercise.ts)
```typescript
Line 388: if (playbackJustStartedRef.current && animationState.transportTimeRef.current < 1000)
```
**Meaning**: Reset fix when transport time > 1000ms (1 second)

### FIRST-BEAT FIX Threshold (useMeasureOpacity.ts)
```typescript
Line 167: if (playbackJustStartedRef.current && currentTime < 1000)
```
**Meaning**: Reset fix when exerciseTime < 1000ms (but should be > 1000!)
**Problem**: Condition is backwards!

### Visual Lookahead Compensation
```typescript
Line 376: const VISUAL_LOOKAHEAD_MS = 300;
```
**Meaning**: Add 300ms to ring time to account for visual update delay

### Countdown Calculation
```typescript
Line 337: const countdownBars = musicalTruthState.countdownBars;
Line 338: const beatsPerBar = exerciseTimeSignature.numerator;
Line 339: const msPerBeat = (60 / exerciseTempo) * 1000;
Line 340: const countdownDurationMs = countdownBars * beatsPerBar * msPerBeat;
```

### Tick Accuracy
```typescript
Line 897: const TICKS_PER_BEAT = 480;  // 480 PPQ (pulses per quarter note)
```

---

## Debug Logging Points

### In useFretboardExercise.ts

**Line 155-157**: FIRST-BEAT FIX v3 triggered
```
[useFretboardExercise] 🎯 FIRST-BEAT FIX v3: Playback just started
```

**Line 932-946**: Ring timing expectations
```
[RING-EXPECT] === EXERCISE NOTES TIMING (first 5) ===
[RING-EXPECT] msPerBeat=500ms @ 120 BPM
[RING-EXPECT] countdownDurationMs=2000ms
[RING-EXPECT] Note 0: pos={m:0, b:0, sub:0, tick:0} → start=0ms, end=500ms
```

**Line 951-959**: Ring position calculation
```
[RING-TIMING] === RING POSITION CALC ===
[RING-TIMING] rawCurrentTime=750ms
[RING-TIMING] countdownDurationMs=2000ms
[RING-TIMING] exerciseTime=0ms (clamped)
[RING-TIMING] msPerBeat=500ms @ 120 BPM
```

**Line 988-996**: Ring note transition
```
[RING-SWITCH] Note X → Y
[RING-SWITCH] rawCurrentTime=2850ms (includes +300ms lookahead)
[RING-SWITCH] Note Y audio plays at transport=2550ms
[RING-SWITCH] Delta: +300ms (EARLY)
```

### In useMeasureOpacity.ts

**Line 155-157**: FIRST-BEAT FIX v3 triggered
```
[useMeasureOpacity] 🎯 FIRST-BEAT FIX v3: Playback just started
```

**Line 178-182**: Current time debug (when __DEBUG_FRETBOARD__ = true)
```
[OPACITY-TIME-DEBUG] effectiveTime=0ms, tempo=120, isPlaybackEffective=true
```

**Line 389-395**: Measure calculation debug
```
[MEASURE-DEBUG] positionKey=1,5, effectiveMeasure=1, currentMeasure0Based=0
```

---

## How to Enable Debug Mode

```javascript
// In browser console
window.__DEBUG_FRETBOARD__ = true;

// Then check logs:
// - Filter by "[useFretboardExercise]"
// - Filter by "[useMeasureOpacity]"
// - Filter by "[RING-"
// - Filter by "[MEASURE-"
```

---

## Summary Table

| What | Where | Lines | Status |
|------|-------|-------|--------|
| FIRST-BEAT FIX v3 (raw time) | useFretboardExercise | 351-391 | ✅ Applied |
| FIRST-BEAT FIX v3 (measure) | useMeasureOpacity | 144-170 | ✅ Applied (buggy) |
| FIRST-BEAT FIX v3 (ring) | nextNoteToPlay | 856-1023 | ❌ MISSING |
| Countdown adjustment | useFretboardExercise | 393 | ✅ Applied |
| Ring rendering | FretboardGrid | 399-403 | ✅ Uses `nextNoteToPlay` |
| Measure rendering | FretboardGrid | All | ✅ Uses `getMeasureHighlight` |
| Passing time to hooks | FretboardCard | 1002-1007 | ✅ Correct |
| Reset condition (buggy) | useMeasureOpacity | 167 | ⚠️ Wrong condition |
| Dependencies (ring) | useFretboardExercise | 1015-1023 | ⚠️ Recalcs every RAF |

---

## Next Steps

1. Review CURRENTTIME_FLOW_ANALYSIS.md for detailed explanation
2. Review CURRENTTIME_FLOW_DIAGRAM.md for visual representation
3. Use VERIFICATION_CHECKLIST.md to confirm bugs exist
4. Implement fixes from CURRENTTIME_FLOW_SUMMARY.md
5. Run tests and manual verification

All files are in the repository root.
