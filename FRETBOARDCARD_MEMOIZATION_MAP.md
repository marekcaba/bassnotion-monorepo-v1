# FretboardCard Memoization & Performance Map

## Quick Reference: Where Memoization Happens

### Component Memoization Layers

```
┌─────────────────────────────────────────────────────────┐
│ FretboardCard (Outer React.memo)                         │
│ - Custom comparator checks 17 props                      │
│ - Props: is3DMode, stringCount3D, selectedDots3D, etc    │
│ - Logs all changes to logger                             │
└──────────────────────┬──────────────────────────────────┘
                       │ (wrapped in SyncedWidget)
                       ↓
┌─────────────────────────────────────────────────────────┐
│ FretboardCardContent (Inner React.memo)                  │
│ - Custom comparator with 100ms currentTime throttle      │
│ - Tracks prop changes in prevPropsRef                    │
│ - Logs detailed render info + stack trace                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ├──→ useFretboard (hook)
                       ├──→ useExerciseLoader (hook)
                       ├──→ useDotSynchronization (hook)
                       ├──→ useDotSelectionHandlers (hook)
                       └──→ FretboardGrid (Memoized FC)
```

---

## Hook Memoization Points

### useFretboard Hook

```typescript
useFretboard(syncProps: MinimalSyncProps, config?)
├── useFretboardState(config)
│   ├── useState: dotsState { selectedDots, selectionOrder }
│   ├── useMemo: frets array
│   ├── useMemo: fretboardState object
│   └── useCallback × 13 functions (all with meaningful deps)
│
├── useFretboardConnections(selectedDots, stringCount)
│   ├── useMemo: connection calculations
│   └── useCallback: highlight functions
│
├── useFretboardExercise(syncProps, options)
│   ├── useAnimationTime(isPlaying, currentTime)
│   │   ├── useEffect: EventBus subscription (RAF loop)
│   │   ├── useRef: lastTransportTimeRef, lastTransportReceivedAtRef
│   │   └── useState: renderTrigger (for 60fps animation)
│   │
│   ├── useMemo: exerciseData from selectedExercise
│   ├── useState: musicalTruthState (reactive tempo)
│   ├── useEffect: Subscribe to musicalTruth changes
│   │
│   └── useMeasureOpacity(config)
│       ├── useMemo: opacityConfig merge
│       ├── useMemo: currentPosition from time
│       ├── useMemo: notePositionToAllMeasures (Map)
│       ├── useMemo: notePositionToAllMeasures (all measures)
│       ├── useCallback: getMeasureHighlight (with measure param)
│       └── useCallback: getNoteOpacity
│
└── useCallback × 3 (for drag/drop handlers)
```

### FretboardCardContent Internal

```typescript
FretboardCardContent function body
├── useState: zoomLevel, isDragging, dragStart, hasUserScrolled
├── useRef: scrollContainerRef, prevPropsRef
│
├── useMemo: fretboardSyncProps (stabilizes for useFretboard)
├── useMemo: fretboardConfig (stabilizes for useFretboard)
├── useMemo: sharedSelectedDots, sharedSetSelectedDots, sharedStringCount
│
├── useCallback: handleExerciseSelect ([] deps - uses refs!)
├── useCallback: scrollToFret
├── useCallback: handleGridDragStart
├── useCallback: handleGridDrop
│
├── useEffect: debugLog selectedExerciseId changes
├── useEffect: resetScroll on mode change
├── useEffect: initScroll on mount
├── useEffect: autoScroll to currentNote
│
└── useExerciseLoader (hook)
    ├── useEffect: Watch for exercise changes
    └── useCallback: onExerciseLoad
```

---

## Re-render Trigger Points (What Causes Re-renders)

### Automatic Re-renders (Sync System)

```
Transport Update (30Hz)
  → EventBus: 'transport:position-updated'
  → lastTransportTimeRef updated (NO RENDER)
  → RAF loop triggers (via setRenderTrigger)
  → React re-render #N
  → FretboardCardContent comparison:
    ├─ currentTime diff > 100ms? YES → RE-RENDER
    ├─ currentTime diff <= 100ms? NO → SKIP RENDER
    └─ Other props changed? Check individually

Pattern: ~2-3 renders per second (instead of 30)
```

### User-Initiated Re-renders

```
User clicks dot
  → handleDotClickWithAudio()
  → state.handleDotClick(string, fret)
  → setDotsState({ selectedDots, selectionOrder })
  → FretboardCardContent comparison: selectedDots changed
  → RE-RENDER
  → FretboardGrid updates
  → Audio played (via exercise.triggerNote)
  → Emit CUSTOM_BASSLINE event

Pattern: 1 render per click
```

### Exercise Load Re-renders

```
Exercise selected
  → selectedExerciseId prop changes
  → FretboardCard outer memo: change detected
  → FretboardCardContent memo: selectedExercise changed
  → RE-RENDER
  → useExerciseLoader effect triggers
  → Auto-populate dots (setSelectedDots3D)
  → FretboardGrid updates with new dots

Pattern: 1-2 renders per exercise load
```

---

## Dependency Array Health Check

### Safe Dependencies (Prevent Issues)

```typescript
// ✅ These are safe to include:
useCallback(fn, [
  state.selectedDots,           // Stable reference (Map)
  dotsState.selectionOrder,     // Primitive number
  maxFrets,                      // Primitive number
  stringCount,                   // Primitive 4|5|6
  isPlaying,                     // Primitive boolean
  currentMeasure0Based,          // Primitive number
]);

// ✅ Safe to depend on these functions:
useCallback(fn, [
  state.handleDotClick,          // From same hook (stable)
  exercise.triggerNote,          // From same hook (stable)
  fretboard.handleDragStart,     // Returned from useFretboard
]);
```

### Dangerous Dependencies (Cause Issues)

```typescript
// ❌ NEVER include these:
useCallback(fn, [
  ...deps,
  setSelectedDots,    // State setter - always new reference
  emitEvent,          // Sync action - unstable object method
  handleChange,       // Inline function - creates new each render
]);

// ❌ NEVER include in effects:
useEffect(() => {
  setState(value);
}, [setState, value]); // setState in deps → infinite loop!

// ✅ CORRECT:
useEffect(() => {
  setState(value);
}, [value]); // setState always stable, exclude it
```

---

## Memory Footprint

### Object/Map Created Per Render

```
FretboardCardContent Render #N:
├── prevPropsRef check (compares object properties)
├── changedProps array (string[])
├── fretboardSyncProps (new object each time? NO - memoized)
├── fretboardConfig (new object each time? NO - memoized)
├── sharedSelectedDots Map (passed in - not created)
│
└── FretboardGrid component:
    ├── ~64 dots (4-string × 16 frets)
    ├── Measurement calculations (fast)
    └── Connection line calculations (memoized)

// useAnimationTime per RAF call:
├── performance.now() call (negligible)
├── interpolation calculation (2 numbers + 1 subtraction)
└── setRenderTrigger(rafTime) (updates state number)

// useMeasureOpacity per render:
├── notePositionToAllMeasures Map (memoized - reused)
├── ~64 opacity lookups (O(1) per lookup)
└── ~64 highlight state lookups (O(1) per lookup)
```

**Memory Impact**: Negligible - mostly reused memoized objects

---

## Performance Metrics

### Render Frequency During Playback

```
Theoretical Maximum (no optimization): 30 FPS
- Transport events: 30Hz
- 1 render per event
- Result: 30 renders/second, jank

With RAF Interpolation + Throttle: ~3 FPS
- Transport events: 30Hz
- 100ms throttle: only 2-3 render per second
- RAF loop: smooth 60fps animation between renders
- Result: 3 renders/second, smooth 60fps visual

Measurement:
- Start timestamp: logged in every render
- Duration: calculated at render end
- Typical: 2-5ms per render (FretboardGrid)
```

### Memoization Effectiveness

```
Without Memoization:
- FretboardCardContent: 60 renders/second (if RAF updates every frame)
- FretboardGrid: 60 renders/second
- useCallback overhead: 60 recreations/second

With Memoization:
- FretboardCardContent: 3 renders/second (100ms throttle)
- FretboardGrid: 3 renders/second (skipped 56 of 60)
- useCallback overhead: 0 recreations/second (stable)

Result: 95% reduction in component renders!
```

---

## Flicker/Freeze Prevention Strategies

### Race Condition Protection

```typescript
// Problem: Stale position events arrive after playback starts
// Solution: Timestamp validation
const eventTimestamp = data.timestamp ?? performance.now();
const playbackStartedAt = playbackStartedAtRef.current;
const timeSincePlaybackStart = now - playbackStartedAt;

if (timeSincePlaybackStart < 500 && eventTimestamp < playbackStartedAt) {
  return; // Event is from BEFORE we started - ignore it!
}
```

### Measure Transition Flicker Fix

```typescript
// Problem: Different calculations racing (time-based vs note-based)
// Solution: Single source of truth + explicit parameter
const getMeasureHighlight = useCallback(
  (stringIndex, fret, measure) => { // ← measure passed explicitly
    // No closure capture - always use the passed parameter
    if (noteMeasures.includes(measure)) return 'current';
    if (noteMeasures.includes(measure + 1)) return 'next';
    return 'other';
  },
  [notePositionToAllMeasures, opacityConfig] // measure NOT in deps
);
```

### Stale Closure Prevention

```typescript
// Problem: Callback captures old value in closure
// Solution 1: Functional state update
setDotsState(prevState => {
  // Always gets current state - no closure capture
  return { ...prevState, selectedDots: newMap };
});

// Solution 2: Ref-based current value
const handleExerciseSelect = useCallback(
  (exerciseId) => {
    // Use ref - always current value
    const exercise = exercisesListRef.current.find(...);
  },
  [] // No deps needed!
);

// Solution 3: Explicit parameter passing
getMeasureHighlight(stringIndex, fret, measure) // ← pass measure
```

---

## Debugging Checklist

### Is Component Rendering Too Much?

- [ ] Check FretboardCardContent render count in console
- [ ] Should be ~3-5 per second during playback
- [ ] If > 20 per second, check prop changes in logger output
- [ ] Enable `window.__DEBUG_FRETBOARD__ = true` for detailed logs

### Is Animation Smooth (60fps)?

- [ ] RAF loop should trigger every 16.67ms (60fps)
- [ ] Check with `window.__DEBUG_RAF_TIMING__ = true`
- [ ] Visual smoothness = RAF works even if React renders 3/sec

### Is Measure Highlighting Wrong?

- [ ] Check `getMeasureHighlight` parameter is being passed
- [ ] Verify `currentMeasure` value in console
- [ ] Check that `notePositionToAllMeasures` Map is built correctly
- [ ] Enable debug logging in `useMeasureOpacity`

### Are Dots Syncing 2D/3D?

- [ ] Check `useDotSynchronization` effect triggers
- [ ] Verify `localDots` vs `sharedDots` in devtools
- [ ] Check `areDotsEqual` logic for false positives
- [ ] Verify `is3DMode` flag is changing correctly

---

## Quick Fix Guide

### Fix: Too Many Re-renders
```typescript
// 1. Check FretboardCardContent comparison function
// Increase currentTime throttle from 100ms to 200ms:
const prevTime = prevProps.syncProps.currentTime || 0;
const nextTime = nextProps.syncProps.currentTime || 0;
if (Math.abs(nextTime - prevTime) > 200) { // ← increased from 100
  changes.push('syncProps.currentTime');
}

// 2. Check for new function props being created
// Should not include callback functions in deps array
```

### Fix: Measure Highlighting Not Updating
```typescript
// 1. Verify getMeasureHighlight receives measure parameter
getMeasureHighlight(stringIndex, fret, currentMeasureFromNote)
                                        ↑ MUST PASS THIS

// 2. Check that FretboardGrid is passing measure correctly
// in the prop: currentMeasureFromNote={fretboard.exercise.currentMeasureFromNote}

// 3. Verify notePositionToAllMeasures Map is populated
// Enable debug: window.__DEBUG_FRETBOARD__ = true
```

### Fix: Audio Not Playing
```typescript
// 1. Check exercise.triggerNote is being called
console.log('Dot clicked', {
  stringIndex, fret,
  triggerNoteCalled: !!fretboard.handleDotClickWithAudio
});

// 2. Verify audioIntegration is initialized
// Check useAudioFretboard hook in useFretboardExercise

// 3. Check AudioContext is not suspended
// Click anywhere on page first, then try audio
```

---

## Performance Tuning Parameters

All in `FretboardCardContent`:

```typescript
// 1. currentTime throttle (Line 1092)
if (Math.abs(nextTime - prevTime) > 100) { // ← Tune this
  // Default: 100ms (3 renders/sec with 30Hz transport)
  // Higher: Smoother measure display (use 200ms for 1.5/sec)
  // Lower: More accurate measure timing (use 50ms for 6/sec)
}

// 2. Zoom level (Line 338)
const [zoomLevel, setZoomLevel] = useState(1.15);
// Default: 1.15 (15% zoom)
// Affects: Visual size of fretboard on screen
// Note: Doesn't affect rendering performance

// 3. useMeasureOpacity config (Line 538 in useMeasureOpacity)
const DEFAULT_OPACITY_CONFIG: MeasureOpacityConfig = {
  currentMeasureActive: 1.0,      // Current note opacity
  currentMeasureInactive: 0.8,    // Other notes in measure
  nextMeasure: 0.3,               // Preview opacity
  otherMeasures: 0,               // Past/future opacity
  transitionBeat: 5,              // When to show next (5=disable)
  transitionDurationMs: 250,      // CSS transition time
};
```

---

## Summary Table

| Aspect | Value | Optimization |
|--------|-------|--------------|
| Component Layers | 3 (FretboardCard, FretboardCardContent, FretboardGrid) | Custom memo comparators on each |
| Hooks Used | 7+ main hooks | Composition pattern |
| useCallback Usage | 13+ functions | Stable references prevent prop drilling |
| useMemo Usage | 5+ objects | Stabilize hook deps |
| Expected Renders/Sec | 3-5 (playback) | 100ms currentTime throttle |
| RAF Loop Frequency | 60fps | Smooth animation |
| Typical Render Duration | 2-5ms | FretboardGrid 64 dots |
| Memory Leak Risk | LOW | All effects have cleanup |
| Flicker Risk | LOW | Race condition + closure fixes |

