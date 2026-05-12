# Exercise/Tutorial Switching Architecture - Complete Map

**Created**: 2026-01-31
**Focus**: Understanding the complete flow when exercises change and identifying race conditions

## Executive Summary

The exercise switching system is distributed across multiple layers:

1. **Detection Layer** - Multiple components independently detect exercise changes via `exercise?.id` in useEffect dependencies
2. **Cleanup Layer** - Each component manages its own state cleanup (regions, buffers, registered patterns)
3. **Registration Layer** - Tracks get re-registered with PlaybackEngine after cleanup
4. **Propagation Layer** - Changes propagate asynchronously through refs, state updates, and event listeners

**Critical Issue**: Components are not perfectly synchronized - cleanup and re-registration happen independently, creating potential race conditions where playback starts before all widgets are ready.

---

## 1. EXERCISE CHANGE DETECTION POINTS

### Location 1: GlobalControls.tsx (Line 90-93)
**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/GlobalControls.tsx`

```typescript
useEffect(() => {
  const changedProps: string[] = [];
  if (prevPropsRef.current.selectedExercise?.id !== selectedExercise?.id) {
    changedProps.push(
      `selectedExercise: ${prevPropsRef.current.selectedExercise?.id} -> ${selectedExercise?.id}`,
    );
  }
  // ... more prop tracking
}, [selectedExercise, duration, hasSelectedDots, loopRegion, isLoopEnabled]);
```

**Purpose**: Track prop changes for debugging
**Action**: Logs exercise ID changes but does NOT trigger cleanup
**Limitation**: Passive observation only

---

### Location 2: useExerciseLoader Hook (Line 160-169)
**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/GlobalControls/hooks/useExerciseLoader.ts`

```typescript
useEffect(() => {
  logger.debug('🔄 useExerciseLoader: useEffect TRIGGERED', {
    selectedExerciseId: selectedExercise?.id,
    selectedExerciseBpm: selectedExercise?.bpm,
    metronomeInitialized: metronomeTrackRef.current.isInitialized,
    drumInitialized: drumTrackRef.current.isInitialized,
    lastLoadedId: lastLoadedExerciseRef.current,
    isLoading: loadingRef.current,
    transportTempo: transport?.tempo,
  });
  // ... exercise loading logic
}, [
  typeof selectedExercise?.id === 'object'
    ? selectedExercise?.id?.value
    : selectedExercise?.id,
  selectedExercise?.drumPattern?.length,
  selectedExercise?.drummerMidiUrl,
]);
```

**Purpose**: Main exercise loader - detects exercise change by ID
**Action**:
- Checks if `exerciseIdChanged` (line 192-193)
- Clears ALL existing regions: metronome, drums, bass (lines 253-255)
- Loads new MIDI/patterns for the exercise
- Registers tracks with PlaybackEngine (line 539)

**Key Logic** (lines 186-229):
```typescript
const selectedExerciseId = typeof selectedExercise.id === 'object'
  ? selectedExercise.id.value
  : String(selectedExercise.id);

const exerciseIdChanged = lastLoadedExerciseRef.current !== selectedExerciseId;

// Skip if already loading
if (loadingRef.current) return;

// Debounce: Skip if same exercise within 100ms
const now = Date.now();
const timeSinceLastLoad = now - lastLoadTimestampRef.current;
if (!exerciseIdChanged && timeSinceLastLoad < LOAD_DEBOUNCE_MS) return;

// Skip if same exercise already loaded
if (!exerciseIdChanged && lastLoadedExerciseRef.current === selectedExerciseId) return;
```

**Critical Variables**:
- `lastLoadedExerciseRef.current` - Tracks last loaded exercise ID
- `loadingRef.current` - Prevents concurrent loads
- `LOAD_DEBOUNCE_MS = 100` - Debounce window

---

### Location 3: useBassBufferRegistration Hook (Line 63-80)
**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/BassLineWidget/hooks/useBassBufferRegistration.ts`

```typescript
useEffect(() => {
  if (exercise?.id !== prevExerciseIdRef.current) {
    if (isVerboseDebugEnabled()) {
      console.log('[BASS-WIDGET] Exercise changed, clearing bass buffers ready flag', {
        prevExerciseId: prevExerciseIdRef.current,
        newExerciseId: exercise?.id,
      });
    }
    WindowRegistry.clearBassBuffersReady();
    lastRegisteredExerciseIdRef.current = null;
    isRegisteringRef.current = false;
    prevExerciseIdRef.current = exercise?.id;
  }
}, [exercise?.id]);
```

**Purpose**: Detect exercise change and reset bass buffer registration state
**Action**:
- Clears `WindowRegistry.bassBuffersReady` flag
- Resets `lastRegisteredExerciseIdRef` so fresh registration can occur
- Resets `isRegisteringRef` to allow new registration (CRITICAL!)

**Key Insight**: The bass widget PREVENTS duplicate registrations during the same exercise, but allows fresh registration on exercise change.

---

### Location 4: DrummerWidget.tsx (Line 133-169)
**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/DrummerWidget/DrummerWidget.tsx`

```typescript
useEffect(() => {
  const exerciseId = exercise?.id?.value || exercise?.id;

  // Skip if no exercise or same exercise
  if (!exerciseId || exerciseId === prevExerciseIdRef.current) {
    prevExerciseIdRef.current = exerciseId;
    return;
  }

  // Only clear tracks if there was a PREVIOUS exercise
  if (prevExerciseIdRef.current !== undefined) {
    logger.info('[DRUMMER-WIDGET] Exercise changed, clearing drum state', {
      previousExerciseId: prevExerciseIdRef.current,
      newExerciseId: exerciseId,
      hasPattern: !!exercise?.drumPattern,
    });
    // Clear drum pattern state
    trackRef.current.clearRegions();
    // ... additional cleanup
  } else {
    logger.debug('[DRUMMER-WIDGET] First mount with exercise, skipping track clear', {
      exerciseId,
    });
  }
  prevExerciseIdRef.current = exerciseId;
}, [exercise?.id]);
```

**Purpose**: Detect exercise change and clear drum state
**Action**:
- Only clears on SUBSEQUENT exercises, not on first mount
- Calls `trackRef.current.clearRegions()`
- Prevents race condition where fresh tracks are immediately cleared on mount

**Key Logic**: Prevents clearing tracks that were just registered by deferring clear until next exercise switch

---

## 2. CLEANUP OPERATIONS

### Track Region Clearing

#### GlobalControls → useExerciseLoader (Lines 253-255)
```typescript
// Clear existing regions from tracks
logger.info('🎮 useExerciseLoader: Clearing existing track regions');
metronomeTrackRef.current.clearRegions();
drumTrackRef.current.clearRegions();
bassTrackRef.current.clearRegions();
```

**When**: Called BEFORE loading new exercise
**What**: Clears ALL regions from all three tracks
**How**: Directly calls `track.clearRegions()` method

#### DrummerWidget (Line 157)
```typescript
trackRef.current.clearRegions();
```

**When**: Only on exercise change (not first mount)
**What**: Clears drum track regions
**How**: Widget-specific cleanup

---

### Bass Buffer Clearing

#### useBassBufferRegistration (Lines 71-77)
```typescript
WindowRegistry.clearBassBuffersReady();
lastRegisteredExerciseIdRef.current = null;
isRegisteringRef.current = false;
prevExerciseIdRef.current = exercise?.id;
```

**When**: Exercise changes
**What**:
- Clears `bassBuffersReady` flag (prevents playback from starting)
- Resets registration tracking
- Resets in-progress flag

**Why**: Ensures bass widget will re-register buffers with fresh exercise data

---

### PlaybackEngine Track Clearing

**File**: `/apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts`
**Lines**: Search for `registerTracks` method

The PlaybackEngine maintains a `tracks` map (line 161):
```typescript
private tracks = new Map<string, Track>();
```

When `registerTracks()` is called, tracks are:
1. Added to the internal map
2. Associated with regions
3. Scheduled for playback

There is NO explicit "clear all tracks" method - tracks are replaced via `registerTracks()`.

---

## 3. ORCHESTRATION FLOW - COMPLETE EXECUTION ORDER

### Scenario: User clicks Exercise B while Exercise A is loaded

```
┌─────────────────────────────────────────────────────────────────┐
│ INSTANT 0ms: User selects Exercise B from dropdown              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ INSTANT 0ms: onExerciseSelect() called → updates state          │
│ ⚠️ React batches updates                                          │
│ - YouTubeWidgetPage.selectedExercise updates                    │
│ - All consumers of selectedExercise get new value               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ INSTANT 1-2ms: React render phase starts                        │
│ All components detect selectedExercise change:                  │
│ 1. GlobalControls (prop change tracking)                        │
│ 2. useExerciseLoader (main loader hook)                         │
│ 3. useBassBufferRegistration (bass widget)                      │
│ 4. DrummerWidget (drum widget)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ INSTANT 2-3ms: useEffect cleanup functions fire                 │
│ ⚠️ ORDER IS NOT GUARANTEED (depends on dependency arrays)       │
│                                                                  │
│ [RACE CONDITION ZONE]                                           │
│ Two possible execution paths:                                   │
└─────────────────────────────────────────────────────────────────┘

PATH A: useExerciseLoader fires FIRST (most common)
────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────┐
│ TIME: 2-3ms                                                      │
│ useExerciseLoader.useEffect fires:                              │
│                                                                  │
│ 1. Checks exerciseIdChanged (line 192-193)                      │
│    Result: TRUE (lastLoadedExerciseRef = null → "Ex-A")         │
│                                                                  │
│ 2. Checks guard conditions (lines 196-229):                     │
│    ✓ loadingRef.current = false (not loading)                   │
│    ✓ timeSinceLastLoad > 100ms (or diff exercise)               │
│    ✓ exerciseIdChanged = true (not same exercise)                │
│                                                                  │
│ 3. Sets loadingRef.current = true (line 231)                    │
│    Sets isLoadingExercise state = true (line 233)               │
│                                                                  │
│ ✅ ENTERS loadExercise() async function                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 3-4ms (in loadExercise async)                             │
│                                                                  │
│ 1. Update lastLoadedExerciseRef = "Ex-B" (line 245)             │
│                                                                  │
│ 2. musicalTruth.setFromExercise(selectedExercise) (line 249)    │
│    Sets exercise BPM as new tempo source                        │
│                                                                  │
│ 3. CLEAR PHASE (lines 252-255):                                 │
│    ✓ metronomeTrackRef.current.clearRegions()                   │
│    ✓ drumTrackRef.current.clearRegions()                        │
│    ✓ bassTrackRef.current.clearRegions()                        │
│    ⚠️ PlaybackEngine tracks map still has OLD regions!          │
│                                                                  │
│ 4. Create ExerciseLoader instance (line 258)                    │
│                                                                  │
│ 5. Check for per-widget MIDI (lines 265-283)                    │
│    - drumPattern? Load via loadFromDrumPattern() (line 308)     │
│    - drummerMidiUrl? Load via loadMidiDirect() (line 355)       │
│    - notes (bass)? Load via loadFromBassNotes() (line 409)      │
│                                                                  │
│ 6. WAIT FOR TRACK INIT (lines 314-317, etc):                   │
│    For each widget (metronome, drums, bass):                    │
│    - waitForTrackInit(trackRef, name) - polls 3000ms            │
│    - If ready: addRegion() to track                             │
│    - If NOT ready: log warning, continue                        │
│                                                                  │
│ ⚠️ CRITICAL ISSUE: If bass track not ready, region not added!   │
│    Bass buffers won't be registered!                            │
│                                                                  │
│ 7. Register tracks with PlaybackEngine (line 539)               │
│    playbackEngine.registerTracks(tracks)                        │
│    ✅ Updates PlaybackEngine.tracks map with new regions       │
│                                                                  │
│ 8. Finally block (line 838-841):                                │
│    loadingRef.current = false                                   │
│    setIsLoadingExercise(false)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 4-5ms (still in async)                                    │
│                                                                  │
│ useBassBufferRegistration.useEffect fires (line 63-80):         │
│ - Exercise ID changed? YES                                      │
│ - Clear bassBuffersReady flag (prevents playback)               │
│ - Reset lastRegisteredExerciseIdRef = null                      │
│ - Reset isRegisteringRef = false                                │
│ - Update prevExerciseIdRef = "Ex-B"                             │
│                                                                  │
│ Then trigger registration (lines 333-354):                      │
│ - Check if trackIsReady && bassNoteCount > 0                    │
│ - If yes: Call registerBassWithPlaybackEngine()                 │
│                                                                  │
│ registerBassWithPlaybackEngine():                               │
│   1. Get CoreServices from WindowRegistry                       │
│   2. Get PlaybackEngine                                         │
│   3. Get cached bass buffers for exercise                       │
│   4. Decode buffers if available                                │
│   5. Inject into PlaybackEngine.setBassBuffers()                │
│   6. Set bassBuffersReady = true ✅                             │
│                                                                  │
│ ⚠️ RACE CONDITION: What if playback starts before this?         │
│    Playback would use OLD buffers!                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 5-6ms                                                      │
│                                                                  │
│ DrummerWidget.useEffect fires (line 133-169):                   │
│ - Exercise ID changed? YES                                      │
│ - Is this the FIRST mount? NO (prevExerciseIdRef !== undefined) │
│ - Clear drum regions (line 157)                                 │
│   ⚠️ CRITICAL RACE: We already cleared in useExerciseLoader!   │
│   But this is the widget's own cleanup for consistency          │
│ - Set prevExerciseIdRef = "Ex-B"                                │
│                                                                  │
│ ⚠️ RACE: If drum regions were just added, they may be cleared! │
│    Timing depends on render order!                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 6ms+                                                       │
│                                                                  │
│ Back in loadExercise() - Continue MIDI loading if not complete  │
│ (depends on async IO - may take 50-500ms)                       │
│                                                                  │
│ Once complete:                                                  │
│ - lastLoadedExerciseRef = "Ex-B"                                │
│ - loadingRef.current = false                                    │
│ - All widgets should have new regions registered                │
│                                                                  │
│ ✅ Ready for playback!                                          │
└─────────────────────────────────────────────────────────────────┘


PATH B: DrummerWidget fires FIRST (race condition scenario)
────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────┐
│ TIME: 2-3ms                                                      │
│ DrummerWidget.useEffect fires BEFORE useExerciseLoader:         │
│                                                                  │
│ prevExerciseIdRef.current = "Ex-A"                              │
│ exercise?.id = "Ex-B"                                           │
│ Comparison: "Ex-A" !== "Ex-B" → TRUE                            │
│                                                                  │
│ prevExerciseIdRef.current !== undefined? YES                    │
│ → Calls clearRegions() on drum track                            │
│                                                                  │
│ ⚠️ PROBLEM: useExerciseLoader hasn't fired yet!                │
│    No new regions are being added                               │
│    Only clearing OLD regions                                    │
│                                                                  │
│ Then, 1-5ms later:                                              │
│ useExerciseLoader fires and adds new drum regions               │
│                                                                  │
│ Result: ✅ Works correctly (though timing was tight)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. RACE CONDITIONS AND TIMING ISSUES

### Race Condition #1: Playback Starts Before Bass Buffers Ready

**Timeline**:
```
2ms: Exercise B selected
3ms: useExerciseLoader clears regions, starts loading
4ms: useBassBufferRegistration clears bassBuffersReady flag
5ms: User immediately clicks Play button
     ✅ Checks bassBuffersReady (currently false) - GOOD
     But then starts playback with STALE buffers from bass scheduler

6ms: useBassBufferRegistration finishes decoding buffers
     Sets bassBuffersReady = true (too late!)
     Playback already started with wrong buffers
```

**Likelihood**: Medium (requires fast user interaction after exercise select)
**Impact**: Bass plays silent or wrong notes for ~1-2 seconds

**Mitigation**: `bassBuffersReady` flag is checked before playback starts (good!)

---

### Race Condition #2: DrummerWidget Clears Fresh Regions

**Timeline**:
```
2ms: Exercise B selected
3ms: React render - both useExerciseLoader AND DrummerWidget notified
4ms: useExerciseLoader starts async load
5ms: ExerciseLoader completes, adds drum regions to track
6ms: React detects state change in components
7ms: DrummerWidget.useEffect fires
     prevExerciseIdRef = "Ex-A"
     exercise.id = "Ex-B"
     → Calls clearRegions()
     ✗ CLEARS REGIONS JUST ADDED AT 5ms!

8ms: Playback starts with no drum regions
```

**Likelihood**: Low-Medium (timing dependent on React batching and async IO)
**Impact**: Drums don't play

**Current Mitigation**: DrummerWidget only clears if `prevExerciseIdRef.current !== undefined`, preventing first-mount clears

---

### Race Condition #3: Multiple Concurrent Loads

**Timeline**:
```
0ms: Exercise B selected
1ms: useExerciseLoader.useEffect fires → sets loadingRef = true
2ms: Exercise C selected (fast user clicks)
3ms: useExerciseLoader.useEffect fires AGAIN
     But loadingRef.current = true (still loading B!)
     → RETURNS EARLY at line 198
     ✗ Exercise C never loads!

4ms: Exercise B finishes loading
     lastLoadedExerciseRef = "Ex-B"
     But Exercise C was supposed to load!
```

**Likelihood**: Low (requires very fast user clicks)
**Impact**: Exercise doesn't load as expected

**Current Mitigation**:
- `loadingRef.current` prevents concurrent loads
- Debounce window (100ms) prevents re-fire
- Next click after load completes will work correctly

---

### Race Condition #4: Bass Track Not Ready During Exercise Load

**Timeline**:
```
2ms: Exercise B selected
3ms: useExerciseLoader starts
5ms: ExerciseLoader tries to add bass regions
     Calls waitForTrackInit(bassTrackRef, 'Bass')
     Bass track NOT initialized yet!
     Polls for 3000ms...
     TIMEOUT after 3s

7ms: User gives up waiting, clicks Play
     Bass regions never registered
     PlaybackEngine doesn't have bass track
     ✗ Bass silent during playback
```

**Likelihood**: Medium (bass track may not be initialized until practice phase)
**Impact**: Bass plays silent

**Current Mitigation**:
- Logs warning instead of crashing (line 449)
- Falls back to creating regions when track finally initializes

---

## 5. COMPLETE STATE MANAGEMENT MAP

### State Variables by Component

#### GlobalControls.tsx
```typescript
// Prop tracking (line 79-85)
prevPropsRef: {
  selectedExercise?: Exercise
  duration: number
  hasSelectedDots: boolean
  loopRegion: null | Region
  isLoopEnabled: boolean
}

// Track management
metronomeTrackRef: ref to track object
drumTrackRef: ref to track object
bassTrackRef: ref to track object

// Playback state
transport.isPlaying: boolean
transport.tempo: number
currentPosition: number
```

#### useExerciseLoader Hook
```typescript
// Exercise tracking (line 154-157)
isLoadingExercise: boolean (state)
loadingRef.current: boolean (prevents concurrent loads)
lastLoadedExerciseRef.current: string | null (last loaded exercise ID)
lastLoadTimestampRef.current: number (last load timestamp)

// Constants
LOAD_DEBOUNCE_MS = 100

// Dependencies
selectedExercise: Exercise (from props)
transport: ExerciseLoaderTransport (from props)
```

#### useBassBufferRegistration Hook
```typescript
// Exercise tracking (line 55-57)
lastRegisteredExerciseIdRef: string | null (last registered ID)
isRegisteringRef: boolean (prevents concurrent registrations)
prevExerciseIdRef: string | undefined (previous exercise ID)

// Flags via WindowRegistry
bassBuffersReady: boolean (global flag)
```

#### DrummerWidget.tsx
```typescript
// Exercise tracking (line 127)
prevExerciseIdRef: string | undefined

// Track reference (line 121)
trackRef: ref to drum track

// Pattern tracking
currentRegionRef: string | null (current region being used)
```

---

## 6. DATA FLOW - Exercise Selection to Playback

```
YouTubeWidgetPage
  │
  ├─> onExerciseSelect(exerciseId)
  │   └─> setState({ selectedExercise: exercise })
  │
  ├─> Re-renders with new selectedExercise
  │
  ├─> Passes selectedExercise to:
  │   ├─> GlobalControls (prop change tracking)
  │   ├─> useExerciseLoader (main loader)
  │   └─> All widget components (detect change)
  │
  ├─> useExerciseLoader.useEffect fires:
  │   ├─> Clear all track regions
  │   ├─> Load MIDI from exercise sources:
  │   │   ├─> drumPattern → loadFromDrumPattern()
  │   │   ├─> drummerMidiUrl → loadMidiDirect()
  │   │   ├─> notes (bass) → loadFromBassNotes()
  │   │   └─> metronomeMidiUrl → loadMidiDirect()
  │   ├─> Wait for tracks to initialize
  │   ├─> Add regions to tracks
  │   └─> registerTracks() to PlaybackEngine
  │
  ├─> Widget-specific effects fire:
  │   ├─> useBassBufferRegistration:
  │   │   ├─> Clear bassBuffersReady flag
  │   │   ├─> Reset registration state
  │   │   └─> Trigger buffer loading
  │   │
  │   └─> DrummerWidget:
  │       ├─> Clear drum regions (if not first mount)
  │       └─> Update prevExerciseIdRef
  │
  └─> When all complete:
      └─> User clicks Play
          └─> Check bassBuffersReady flag
          └─> Transport.play() starts playback
```

---

## 7. CRITICAL DEPENDENCIES AND GUARDS

### Guard 1: loadingRef.current (Line 196-201)
```typescript
// Skip if already loading
if (loadingRef.current) {
  logger.debug('🎮 useExerciseLoader: Already loading, skipping duplicate call');
  return;
}
```
**Purpose**: Prevents concurrent exercise loads
**Scope**: Global to hook instance
**Reset**: Line 839 in finally block

### Guard 2: Debounce Window (Line 203-217)
```typescript
const now = Date.now();
const timeSinceLastLoad = now - lastLoadTimestampRef.current;
if (!exerciseIdChanged && timeSinceLastLoad < LOAD_DEBOUNCE_MS) {
  return;
}
```
**Purpose**: Prevents re-loading same exercise within 100ms
**Scope**: Per hook instance
**Window**: 100ms

### Guard 3: Same Exercise Check (Line 220-229)
```typescript
if (!exerciseIdChanged && lastLoadedExerciseRef.current === selectedExerciseId) {
  logger.debug('🎮 useExerciseLoader: Same exercise already loaded, skipping');
  return;
}
```
**Purpose**: Prevents loading same exercise twice
**Scope**: Per hook instance
**Trigger**: Exercise ID must be different string value

### Guard 4: Bass Buffers Ready (Before playback)
```typescript
// In playback control (not shown here, inferred from architecture)
if (!WindowRegistry.areBassBuffersReady()) {
  logger.warn('Bass buffers not ready yet');
  // Prevent playback or show loading indicator
}
```
**Purpose**: Prevents playback before bass buffers are decoded
**Scope**: Global (WindowRegistry)
**Reset**: Line 71 in useBassBufferRegistration

### Guard 5: Track Initialization Check (Line 129)
```typescript
async function waitForTrackInit(trackRef, trackName, maxWaitMs = 3000) {
  while (Date.now() - startTime < maxWaitMs) {
    if (trackRef.current.isInitialized && trackRef.current.track) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}
```
**Purpose**: Waits for track to be initialized before adding regions
**Scope**: Per track, per load
**Timeout**: 3000ms

---

## 8. POTENTIAL IMPROVEMENTS

### Issue 1: No Coordination Between Widget Cleanup and Central Loader
**Current**: DrummerWidget clears drums independently after useExerciseLoader clears everything
**Fix**:
- Centralize cleanup in useExerciseLoader only
- Remove widget-specific clearRegions() calls
- Or: Add explicit coordination signals

### Issue 2: Bass Buffers Ready Flag Not Enforced
**Current**: `bassBuffersReady` flag is checked but playback may start anyway
**Fix**:
- Make bassBuffersReady check a hard blocker in play handler
- Show loading UI while waiting
- Add timeout with graceful degradation

### Issue 3: Track Initialization Timing
**Current**: Waits 3 seconds for tracks to initialize, times out silently
**Fix**:
- Initialize tracks eagerly in Act 1 (understanding phase)
- Don't wait during exercise load
- Add regions when track eventually initializes via callback

### Issue 4: No Atomic Exercise Switch
**Current**: Exercise switch is a loose coordination of independent effects
**Fix**:
- Create `useExerciseSwitch()` hook that:
  - Stops playback
  - Waits for all cleanup to complete
  - Loads all regions
  - Signals ready state
  - Only then allows playback

### Issue 5: Race Between Multiple Exercise Changes
**Current**: Fast user clicks can cause skip if loadingRef.current is true
**Fix**:
- Queue exercise IDs instead of simple loading flag
- Process queue sequentially
- Always load the latest queued exercise

---

## 9. FILE REFERENCE MAP

| Purpose | File | Lines | Key Vars |
|---------|------|-------|----------|
| Main container | `YouTubeWidgetPage.tsx` | 1-100+ | `selectedExercise`, `onExerciseSelect` |
| Prop tracking | `GlobalControls.tsx` | 87-133 | `prevPropsRef` |
| Exercise loader | `useExerciseLoader.ts` | 160-858 | `loadingRef`, `lastLoadedExerciseRef`, `lastLoadTimestampRef` |
| Bass management | `useBassBufferRegistration.ts` | 63-80 | `lastRegisteredExerciseIdRef`, `prevExerciseIdRef` |
| Drum management | `DrummerWidget.tsx` | 133-169 | `prevExerciseIdRef`, `trackRef` |
| Playback | `PlaybackEngine.ts` | 1-2227 | `tracks` map, `registerTracks()` |
| Track creation | `useTrack.ts` | 1-100+ | Track object creation |
| DAW integration | `GlobalControlsDAW.tsx` | 136-315 | Alternative exercise loader |

---

## 10. TESTING SCENARIOS

### Scenario A: Fast Exercise Switch (Timing: <100ms between clicks)
1. User selects Exercise B
2. Before load completes (<100ms), user selects Exercise C
3. Expected: Exercise C loads (but currently may skip due to loadingRef)
4. Current behavior: May load B but skip C
5. Recommended fix: Queue latest exercise ID

### Scenario B: Play During Loading
1. User selects Exercise B
2. User clicks Play immediately
3. Loading still in progress
4. Expected: Show loading UI, delay play
5. Current behavior: May start playback with incomplete regions
6. Recommended fix: Block play button until isLoadingExercise = false

### Scenario C: Bass Buffers Not Ready
1. User selects bass exercise
2. Buffers start decoding
3. User clicks Play before decode complete
4. Expected: Prevent playback until ready
5. Current behavior: May play with stale buffers
6. Recommended fix: Enforce bassBuffersReady check

### Scenario D: Track Not Initialized
1. Widget in Act 1 (understanding phase)
2. User selects exercise
3. useExerciseLoader waits 3s for drum track
4. Timeout occurs, warning logged
5. User switches to Act 2 (practice phase)
6. Drum track finally initializes
7. Expected: Regions add when track ready
8. Current behavior: Regions miss the boat
9. Recommended fix: Use callbacks instead of polling

---

## Summary

The exercise switching architecture is **semi-coordinated** with **independent state management** at multiple levels. Each component detects exercise changes and manages its own cleanup, but there is no central orchestration point. This creates **3 main race conditions**:

1. **Playback before bass ready** - mitigated by flag check
2. **Widget clears fresh regions** - mitigated by first-mount check
3. **Track not initialized** - mitigated by timeout, but regions may not load

The system **works well in normal usage** but can fail under:
- Fast user interactions (rapid exercise clicks)
- Slow async IO (network delays loading MIDI)
- Race conditions between React render batching and async effects

**Recommended fix**: Create a centralized `useExerciseSwitch()` hook that orchestrates cleanup, loading, and readiness signals as a single atomic operation.
