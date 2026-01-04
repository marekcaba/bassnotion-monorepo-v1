# FretboardCard Rendering and State Update Analysis

## Executive Summary

The FretboardCard component is a highly optimized, complex interactive component with **extensive memoization, custom comparison functions, and RAF-based animation**. It achieves 60fps smooth rendering during playback while handling frequent prop changes from the widget sync system.

### Key Performance Characteristics:
- **Render Frequency**: 60fps during playback (via RAF loop in `useAnimationTime`)
- **Memoization Strategy**: Triple-layer React.memo with custom equality checks
- **State Update Pattern**: Functional state updates with ref-based optimization
- **Time Synchronization**: RAF-based interpolation for smooth animation between 30Hz transport events

---

## Component Hierarchy & Memoization Strategy

### 1. **FretboardCard (Main Component)**

**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard.tsx`

**Memoization Level 1** - Outer wrapper using `React.memo` with custom comparison:

```typescript
export const FretboardCard = React.memo(
  function FretboardCard({ ... }: FretboardCardProps) {
    return (
      <SyncedWidget>
        {(syncProps) => <FretboardCardContent ... />}
      </SyncedWidget>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function tracking 17 props
    const changes: string[] = [];
    // Returns isEqual (true = skip re-render, false = re-render)
  }
);
```

**Props Tracked**:
- `is3DMode`, `onToggle3DMode`
- `selectedDots3D`, `setSelectedDots3D`
- `stringCount3D`, `setStringCount3D`
- `cameraMode`, `setCameraMode`
- `maxFrets`, `tiltAngle`, `onMaxFretsChange`, `onTiltAngleChange`
- `tutorialData`, `tutorialSlug`, `exercises`, `selectedExerciseId`, `onExerciseSelect`

---

### 2. **FretboardCardContent (Content Wrapper)**

**Memoization Level 2** - Inner content with custom comparison:

```typescript
const FretboardCardContent = React.memo(
  function FretboardCardContent({ syncProps, ... }: Props) {
    // Tracks what changed between renders
    const prevPropsRef = useRef({
      syncActions, selectedExercise, isPlaying, currentTime,
      tempo, masterVolume, exercisesLength, selectedExerciseId, is3DMode
    });

    // Logs all changes for debugging
    logger.info(`🔴 FretboardCardContent render #${globalRenderCount}`, {
      changedProps,
      renderStack: new Error().stack,
    });
  },
  (prevProps, nextProps) => {
    // Custom comparison with 100ms throttle on currentTime
    const prevTime = prevProps.syncProps.currentTime || 0;
    const nextTime = nextProps.syncProps.currentTime || 0;

    // Only re-render if time changed > 100ms
    if (Math.abs(nextTime - prevTime) > 100) {
      changes.push('syncProps.currentTime');
    }

    return isEqual; // true = skip render
  }
);
```

**Critical Feature**: **100ms currentTime throttle** - prevents re-renders for every transport update

---

## State Management Architecture

### Three-Layer State Pattern

#### **1. useFretboardState - Local Dots Management**

```typescript
const [dotsState, setDotsState] = useState<{
  selectedDots: SelectedDotsMap;
  selectionOrder: number;
}>({ selectedDots: new Map(), selectionOrder: 0 });
```

**Performance Optimizations**:
- **Combined state**: `selectedDots + selectionOrder` in single `setDotsState` call
- **Functional updates**: All mutations use `setDotsState(prev => ({...}))` to avoid stale closures
- **Memoized frets**: `useMemo(() => Array.from({ length: maxFrets }, ...), [maxFrets])`
- **No local config state**: `stringCount`, `tiltAngle`, `maxFrets` read directly from props (parent-managed)

**State Handlers**:
```typescript
const handleDotClick = useCallback((stringIndex, fret) => {
  setDotsState(prevState => {
    // Single state update for both selectedDots and selectionOrder
    const isSelected = isDotSelected(stringIndex, fret, prevState.selectedDots);
    if (isSelected) {
      // Deselect + renumber remaining dots
      return { selectedDots: newMap, selectionOrder: newSize };
    } else {
      // Select with next sequential order
      return { selectedDots: newMap, selectionOrder: newOrder };
    }
  });
}, []); // No dependencies - uses functional state update
```

**Key Insight**: All state mutations trigger single `setDotsState` call, preventing double-renders that plagued earlier versions.

---

#### **2. useFretboardExercise - Exercise Data & Audio Integration**

**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useFretboardExercise.ts` (lines 1-400+)

**Critical Features**:

**A. Time Interpolation System (`useAnimationTime`)**
- Transport events arrive at ~30Hz (every 33ms)
- RAF loop runs at 60fps (every 16.67ms)
- **Interpolation formula**: `transportTime + (now - lastReceivedAt)`

```typescript
const updateAnimation = () => {
  // RAF callback - just triggers re-render
  setRenderTrigger(rafTime); // State update for dependency tracking
  rafRef.current = requestAnimationFrame(updateAnimation);
};

// At RENDER TIME (not in callback):
const interpolatedTime =
  lastTransportTimeRef.current +
  (performance.now() - lastTransportReceivedAtRef.current);
```

**Why This Works**:
1. RAF callback doesn't calculate time - just triggers render
2. Render-time calculation gets current `performance.now()` - fresh value
3. No delay between RAF and render = smooth interpolation

**Race Condition Fix**:
```typescript
// Reject stale position events from before playback started
if (timeSincePlaybackStart < 500 && eventTimestamp < playbackStartedAt) {
  return; // DON'T UPDATE THE REF - event is stale!
}
```

**B. Measure-Based Note Tracking**
```typescript
const [musicalTruthState, setMusicalTruthState] = useState(() =>
  musicalTruth.getTruth()
);

// Subscribe to tempo changes (reactive)
useEffect(() => {
  const unsubscribe = musicalTruth.subscribe(setMusicalTruthState);
  return unsubscribe;
}, []);

// Use reactive state
const exerciseTempo = musicalTruthState.bpm;
const exerciseTimeSignature = musicalTruthState.timeSignature;
```

**Key insight**: Tempo and time signature are **reactive** - component re-renders when they change

---

#### **3. useMeasureOpacity - Opacity Calculations**

**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useMeasureOpacity.ts` (lines 1-456)

```typescript
export function useMeasureOpacity(config: UseMeasureOpacityConfig): UseMeasureOpacityReturn {
  // Note position -> measure mapping (memoized)
  const notePositionToAllMeasures = useMemo(() => {
    const measuresMap = new Map<string, number[]>();
    exerciseNotes.forEach(note => {
      // Convert exercise note to fretboard position key
      const positionKey = `${stringIndex},${fret}`;
      // Map which measures contain this position
      measuresMap.set(positionKey, [measure1, measure2, ...]);
    });
    return measuresMap;
  }, [exerciseNotes, tempo, timeSignature]);

  // Return callbacks for fast lookup
  const getMeasureHighlight = useCallback(
    (stringIndex: number, fret: Fret, measure: number) => {
      const noteMeasures = notePositionToAllMeasures.get(`${stringIndex},${fret}`);

      if (noteMeasures?.includes(measure)) {
        return { shouldHighlight: true, state: 'current', opacity: 1.0 };
      }
      if (noteMeasures?.includes(measure + 1)) {
        return { shouldHighlight: true, state: 'next', opacity: 0.3 };
      }
      return { shouldHighlight: false, state: 'other', opacity: 1.0 };
    },
    [notePositionToAllMeasures, opacityConfig]
  );

  const getNoteOpacity = useCallback(
    (stringIndex: number, fret: Fret) => {
      const positionKey = `${stringIndex},${fret}`;
      const noteMeasures = notePositionToAllMeasures.get(positionKey);

      if (noteMeasures?.includes(currentMeasure0Based)) {
        return opacityConfig.currentMeasure; // 1.0
      }
      if (noteMeasures?.includes(currentMeasure0Based + 1)) {
        return opacityConfig.nextMeasure; // 0.3
      }
      return opacityConfig.otherMeasures; // 0
    },
    [currentMeasure0Based, notePositionToAllMeasures, opacityConfig]
  );
}
```

**Single Source of Truth**:
- `currentMeasure` passed explicitly (not captured in closure)
- Prevents "stale closure" bugs during measure transitions

---

## Main Hook Integration (`useFretboard`)

**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useFretboard.ts` (lines 26-195)

```typescript
export const useFretboard = (syncProps: MinimalSyncProps, config?) => {
  // State management
  const state = useFretboardState(config);

  // Connection highlighting
  const connections = useFretboardConnections(
    state.selectedDots,
    state.stringCount
  );

  // Exercise integration with audio
  const exercise = useFretboardExercise(syncProps, {
    setSelectedDots: state.setSelectedDots,
    autoPopulateOnExerciseLoad: true,
    stringCount: state.stringCount,
  });

  // Enhanced handlers with audio feedback
  const handleDotClickWithAudio = useCallback(
    (stringIndex: number, fret: Fret) => {
      state.handleDotClick(stringIndex, fret);     // Update state
      exercise.triggerNote(stringIndex, fret);     // Play audio
    },
    [state.handleDotClick, exercise.triggerNote]
  );

  // Emit bassline event on changes
  useEffect(() => {
    if (selectedDotsChanged && isManualChangeRef.current) {
      exercise.emitBasslineEvent(state.selectedDots);
      isManualChangeRef.current = false;
    }
    prevSelectedDotsRef.current = new Map(state.selectedDots);
  }, [state.selectedDots, exercise.emitBasslineEvent]);

  return {
    state,
    connections,
    exercise,
    handleDotClickWithAudio,
    handleClearWithSync,
    handleDragDropWithAudio,
    stringCount: state.stringCount,
    selectedDots: state.selectedDots,
    // ... more state values
  };
};
```

---

## useEffect Dependencies Analysis

### Critical useEffect Hooks in FretboardCardContent

#### **1. Exercise Auto-Population (Lines 686-724)**
```typescript
useEffect(() => {
  // Auto-populate 3D mode with exercise notes
  if (
    fretboard.exerciseData.hasExercise &&
    fretboard.exerciseData.exerciseNotes.length > 0 &&
    setSelectedDots3D &&
    !manualSelectionTracking.hasManuallyReset() &&
    !manualSelectionTracking.hasManualSelections()
  ) {
    const exerciseDotsMap = fretboard.exercise.convertExerciseNotesToSelectedDots(
      fretboard.exerciseData.exerciseNotes
    );
    setSelectedDots3D(exerciseDotsMap);
  }
}, [
  fretboard.exerciseData.hasExercise,
  fretboard.exerciseData.exerciseNotes.length,
  fretboard.exerciseData.selectedExercise?.id,
  setSelectedDots3D,
  // Removed unstable function references to prevent infinite loops
]);
```

**What Triggers It**:
- When exercise loads
- When exercise notes change
- When manual reset is cleared

**Performance Note**: Functions `manualSelectionTracking.*` are NOT in dependencies because they're stable.

#### **2. Auto-Scroll During Playback (Lines 748-806)**
```typescript
useEffect(() => {
  if (
    !is3DMode &&
    !hasUserScrolled &&
    fretboard.exercise.audioIntegration.playbackPosition?.isPlaying
  ) {
    const currentNote = fretboard.exercise.audioIntegration.playbackPosition.currentNote;
    if (currentNote && typeof currentNote.fret === 'number') {
      scrollToFret(currentNote.fret);
    }
  }
}, [
  is3DMode,
  hasUserScrolled,
  fretboard.exercise.audioIntegration.playbackPosition?.isPlaying,
  fretboard.exercise.audioIntegration.playbackPosition?.currentNote,
  scrollToFret,
]);
```

**What Triggers It**:
- When user is NOT in 3D mode
- When user hasn't manually scrolled
- When `currentNote` changes during playback

---

## Callback Memoization Strategy

### All Callbacks Use useCallback with Explicit Dependencies

#### **handleExerciseSelect (Lines 381-472)**
```typescript
const handleExerciseSelect = React.useCallback(
  (exerciseId: string) => {
    // Uses refs for current values
    const exercise = exercisesListRef.current.find(ex => ex.id.value === exerciseId);

    onExerciseSelectRef.current?.(exerciseId);

    const syncActions = syncActionsRef.current;
    if (syncActions?.emitEvent) {
      syncActions.emitEvent('EXERCISE_CHANGE', ...);
      syncActions.emitEvent('TEMPO_CHANGE', ...);
      // ... more events
    }
  },
  [] // No dependencies - uses refs for everything!
);
```

**Performance Pattern**:
- Callback never recreates (empty dependency array)
- Uses refs to access current values
- Avoids stale closure problems

#### **handleGridDragStart & handleGridDrop (Lines 864-880)**
```typescript
const handleGridDragStart = React.useCallback(
  (e: React.DragEvent, stringIndex: number, fret: number | 'open') => {
    const orders = fretboard.checkGetDotOrder(stringIndex, fret);
    const order = orders.length > 0 ? orders[0] : 0;
    if (order !== undefined) {
      fretboard.handleDragStart(stringIndex, fret, order);
    }
  },
  [fretboard.checkGetDotOrder, fretboard.handleDragStart] // Stable function references
);

const handleGridDrop = React.useCallback(
  (e: React.DragEvent, targetStringIndex: number, targetFret: number | 'open') => {
    dotSelectionHandlers.handleDragDrop(targetStringIndex, targetFret);
  },
  [dotSelectionHandlers.handleDragDrop]
);
```

**Pattern**: Each callback depends on stable function references only (not data)

---

## useMemo Optimization Points

### Three Critical useMemo Calls

#### **1. fretboardSyncProps (Lines 518-539)**
```typescript
const fretboardSyncProps = React.useMemo(() => {
  const props = {
    selectedExercise: syncProps.selectedExercise,
    isPlaying: syncProps.isPlaying,
    currentTime: syncProps.currentTime,
    tempo: syncProps.tempo,
    masterVolume: syncProps.masterVolume,
    sync: syncProps.sync,
  };
  logger.info(`🎯 FretboardCard: fretboardSyncProps memoized...`, props);
  return props;
}, [
  syncProps.selectedExercise,
  syncProps.isPlaying,
  syncProps.currentTime, // Included - arePropsEqual throttles to 100ms
  syncProps.tempo,
  syncProps.masterVolume,
  syncProps.sync,
]);
```

**Purpose**: Stabilize prop object for `useFretboard` hook dependency

#### **2. fretboardConfig (Lines 541-552)**
```typescript
const fretboardConfig = React.useMemo(() => {
  const config = {
    stringCount: sharedStringCount,
    maxFrets: maxFrets,
    tiltAngle: tiltAngle,
  };
  return config;
}, [sharedStringCount, maxFrets, tiltAngle]);
```

**Purpose**: Stabilize config object for `useFretboard` initialization

#### **3. Used in useMeasureOpacity (Lines 207-275 in useMeasureOpacity.ts)**
```typescript
const notePositionToAllMeasures = useMemo(() => {
  const measuresMap = new Map<string, number[]>();

  exerciseNotes.forEach(note => {
    // Build position -> measures mapping
    const positionKey = `${stringIndex},${fret}`;
    measuresMap.set(positionKey, [measure1, measure2, ...]);
  });

  return measuresMap;
}, [exerciseNotes, tempo, timeSignature]);
```

**Purpose**: Pre-calculate all note positions for O(1) opacity lookups

---

## Performance Bottlenecks & Mitigation Strategies

### 1. **Excessive Re-renders During Playback**

**Problem**: `syncProps.currentTime` updates 30Hz (every 33ms) from transport events

**Solution**:
- **100ms throttle** in FretboardCardContent comparison function
- **RAF-based interpolation** in useAnimationTime for smooth 60fps animation
- **Memoized measure calculations** prevent recalculation on every frame

**Impact**: Component re-renders ~3 times per second instead of 30 times per second

### 2. **Stale Closures in Callbacks**

**Problem**: Callbacks capturing old prop/state values from closure

**Solution**:
- **Functional state updates** in `useFretboardState`
- **Ref storage** for current values in `FretboardCardContent`
- **Empty dependency arrays** with ref-based value access
- **Explicit parameter passing** in `getMeasureHighlight(measure)` instead of closure capture

### 3. **Race Conditions on Playback Start**

**Problem**: Stale position events from previous playback overwriting initial time=0

**Solution**:
```typescript
const playbackStartedAtRef = useRef<number>(0);

// On playback start
playbackStartedAtRef.current = performance.now();

// On position event
if (timeSincePlaybackStart < 500 && eventTimestamp < playbackStartedAt) {
  return; // Reject stale event!
}
```

### 4. **Measure Transition Flicker**

**Problem**: Two competing calculations (time-based vs note-based) causing oscillation

**Solution**:
- **Single source of truth**: `currentMeasure` from note-based tracking
- **Explicit parameter passing**: `getMeasureHighlight(measure)` instead of closure
- **No competing calculations**: Opacity uses only note-based measure

---

## Render Count Tracking

The component includes **detailed render logging**:

```typescript
let fretboardCardRenderCount = 0;
let globalRenderCount = 0;

// On every FretboardCardContent render:
globalRenderCount++;

// Track what changed
const changedProps: string[] = [];
Object.keys(currentProps).forEach(key => {
  if (prevPropsRef.current[key] !== currentProps[key]) {
    changedProps.push(key);
  }
});

logger.info(`🔴 FretboardCardContent render #${globalRenderCount}`, {
  changedProps,
  renderDurationMs: (renderEndTime - renderStartTime).toFixed(2),
  renderStack: new Error().stack?.split('\n').slice(1, 5),
});
```

**Typical Render Sequence During Playback**:
1. Mount: 2-3 renders (initialization)
2. Exercise load: 1-2 renders (populate dots)
3. Playback: ~3 renders/second (100ms throttle)
4. Measure transition: 1 render (measure change)

---

## Data Flow Diagrams

### **From Transport Update to Visual Change**

```
Transport Event (30Hz)
  ↓
EventBus.on('transport:position-updated')
  ↓
lastTransportTimeRef.current = newTime
lastTransportReceivedAtRef.current = eventTimestamp
  ↓
[No render triggered - just updates refs]
  ↓
RAF Loop (60Hz)
  ↓
setRenderTrigger(rafTime) [triggers setState]
  ↓
React Re-render (1 of 2 per 30Hz update)
  ↓
Render-time Calculation:
  interpolatedTime = transportTimeRef + (now - receivedAtRef)
  ↓
useMeasureOpacity gets currentTime
  ↓
getMeasureHighlight(stringIndex, fret, measure) called per dot
  ↓
FretboardGrid re-renders with new opacities
```

### **State Update Flow on Dot Click**

```
User clicks dot → onDotClick(stringIndex, fret)
  ↓
fretboard.handleDotClickWithAudio(...)
  ↓
state.handleDotClick(stringIndex, fret)
  ↓
setDotsState(prevState => {
  // Single state update for both:
  // - selectedDots Map
  // - selectionOrder number
  return { selectedDots: newMap, selectionOrder: newOrder };
})
  ↓
React batches to single setState call
  ↓
FretboardCardContent re-renders (triggered by selectedDots change)
  ↓
exercise.triggerNote(stringIndex, fret) [audio feedback]
  ↓
Check if manual change → emit CUSTOM_BASSLINE event
```

---

## Files Summary

| File | Purpose | Key Optimization |
|------|---------|-------------------|
| `FretboardCard.tsx` | Main component wrapper | Triple-layer memoization with custom comparisons |
| `useFretboard.ts` | Hook composition | Combines state + connections + exercise |
| `useFretboardState.ts` | Dot selection state | Combined state updates (dots + order) |
| `useFretboardExercise.ts` | Exercise & audio integration | RAF-based time interpolation, race condition fixes |
| `useMeasureOpacity.ts` | Opacity calculation | Memoized note position maps, explicit measure parameter |
| `useDotSynchronization.ts` | 2D/3D sync | Bidirectional state synchronization |
| `FretboardGrid.tsx` | Grid rendering | Memoized with measure-aware connections |

---

## Potential Performance Improvements

### 1. **Further Reduce Re-renders**
- Increase 100ms throttle to 200ms if measure display isn't timing-critical
- Separate "position animation" from "measure highlight" updates

### 2. **Optimize useAnimationTime**
- Cache `performance.now()` calculation instead of calling in every RAF frame
- Use `sharedArrayBuffer` for cross-worker time sync (if using workers)

### 3. **Measure Opacity Calculation**
- Pre-calculate all 64 note positions' opacities once per measure (instead of per-render)
- Store as `[opacity1, opacity2, ..., opacity64]` array for O(1) lookup

### 4. **Connection Lines**
- Memoize line coordinates when measure-aware connections don't change
- Use CSS filters instead of opacity for performance

---

## Debugging Features

### Enable Debug Logging
```typescript
// In browser console
window.__DEBUG_FRETBOARD__ = true;
window.__DEBUG_RAF_TIMING__ = true;
window.logger.setLevel(window.LogLevel.DEBUG);
```

### Monitor Render Count
```typescript
// In browser console
console.log(`Total renders: ${window.fretboardCardRenderCount}`);
```

### Check Measure Calculations
```typescript
// In useMeasureOpacity
const allMeasures = Array.from(allMeasures).sort((a, b) => a - b);
console.log('[useMeasureOpacity] Exercise measures:', allMeasures);
console.log('[useMeasureOpacity] Total notes:', exerciseNotes.length);
```

---

## Conclusion

FretboardCard demonstrates **production-grade React performance optimization**:

1. **Multi-layer memoization** with custom equality checks prevents unnecessary re-renders
2. **RAF-based animation** smoothly interpolates between low-frequency transport events
3. **Functional state updates** eliminate stale closure issues
4. **Explicit parameter passing** prevents measure transition flicker
5. **Race condition protection** ensures reliable playback start
6. **Comprehensive logging** enables detailed performance debugging

The 100ms render throttle combined with 60fps RAF interpolation creates the illusion of smooth 60fps animation while only re-rendering ~3 times per second—a significant performance win for a complex interactive visualization component.
