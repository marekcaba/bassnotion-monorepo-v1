# FretboardCard Code Locations Reference

## Quick Navigation Guide

### Main Files

| File | Lines | Purpose |
|------|-------|---------|
| `FretboardCard.tsx` | 1-1154 | Main component + content wrapper |
| `useFretboard.ts` | 1-195 | Hook composition + enhancement |
| `useFretboardState.ts` | 1-364 | Dot selection state management |
| `useFretboardExercise.ts` | 1-600+ | Exercise + audio + time sync |
| `useMeasureOpacity.ts` | 1-456 | Opacity + highlight calculations |
| `useDotSynchronization.ts` | 1-150+ | 2D/3D mode sync |
| `FretboardGrid.tsx` | 1-400+ | Grid rendering (memoized) |

---

## FretboardCard.tsx - Detailed Line Map

### Outer Component (FretboardCard)

```typescript
Lines 1-117:    Imports + type definitions
Lines 98-211:   FretboardCard outer React.memo
                ├─ Lines 99-117:   Props interface
                ├─ Lines 118-122:   Exercise selection logic
                └─ Lines 163-210:   Custom comparator function
                    └─ Line 209:    Return isEqual (true=skip, false=render)
```

**Key**: Custom comparator tracks 17 props for rendering decisions

### Inner Content Component (FretboardCardContent)

```typescript
Lines 213-1107: FretboardCardContent React.memo
                ├─ Lines 215-254:   Function signature + type defs
                ├─ Lines 256-263:   Skeleton debug logging
                ├─ Lines 265-335:   Detailed render logging
                ├─ Lines 338-344:   Local state (zoom, scroll, drag)
                ├─ Lines 354-376:   Ref management for current values
                ├─ Lines 362-376:   Ref update effects
                ├─ Lines 381-472:   handleExerciseSelect callback
                │   └─ Line 471:    Empty dependencies [] - uses refs!
                ├─ Lines 479-489:   Debug effect for selectedExerciseId
                ├─ Lines 492-503:   Scroll position effects
                ├─ Lines 518-539:   useMemo: fretboardSyncProps
                ├─ Lines 541-552:   useMemo: fretboardConfig
                ├─ Lines 558-566:   useFretboard hook call
                ├─ Lines 581-584:   useManualSelectionTracking hook
                ├─ Lines 623-642:   useExerciseLoader hook
                ├─ Lines 645-657:   useDotSynchronization hook
                ├─ Lines 660-676:   useDotSelectionHandlers hook
                ├─ Lines 679-683:   useStringCountHandlers hook
                ├─ Lines 686-724:   useEffect: auto-populate 3D
                │   └─ Line 717:    Dependencies (no functions!)
                ├─ Lines 727-745:   scrollToFret callback
                ├─ Lines 748-806:   useEffect: auto-scroll playback
                │   └─ Line 800:    Dependencies with playbackPosition
                ├─ Lines 812-844:   Scroll drag handlers
                ├─ Lines 864-880:   useMemo callbacks
                │   ├─ Line 872:    handleGridDragStart dependencies
                │   └─ Line 879:    handleGridDrop dependencies
                └─ Lines 882-1031:  JSX rendering
                    ├─ Lines 888-930:   3D mode rendering
                    ├─ Lines 932-1019:  2D mode rendering
                    ├─ Line 985-1016:   FretboardGrid component props
                    └─ Line 1023:       Audio error display
```

### FretboardCardContent Custom Comparator

```typescript
Lines 1034-1107: Custom comparison function
                 ├─ Lines 1042-1071:  Individual prop checks (17 props)
                 ├─ Lines 1073-1086:  syncProps checks (except currentTime)
                 ├─ Lines 1088-1094:  ⭐ currentTime throttle logic
                 │   └─ Line 1092:    Math.abs(nextTime - prevTime) > 100
                 ├─ Line 1096:        isEqual = changes.length === 0
                 └─ Lines 1098-1105:  Log if changes detected
```

**Critical**: Line 1092 - 100ms currentTime throttle (main performance optimization)

---

## useFretboard.ts - Detailed Line Map

```typescript
Lines 1-10:     Imports + logger
Lines 12-32:    JSDoc + type definitions
Lines 26-33:    useFretboard function signature

Lines 38-51:    Hook instantiation
                ├─ Line 38:  const state = useFretboardState(config)
                ├─ Line 41:  const connections = useFretboardConnections(...)
                └─ Line 47:  const exercise = useFretboardExercise(...)

Lines 54-82:    Enhanced handlers with audio
                ├─ Lines 54-63:   handleDotClickWithAudio
                ├─ Lines 66-70:   handleClearWithSync
                ├─ Lines 73-81:   handleDragDropWithAudio

Lines 84-119:   Emit bassline event on changes
                ├─ Lines 84-119:  useEffect for selectedDots change detection
                │   ├─ Line 89-109:   Compare Maps
                │   ├─ Line 112-114:  Emit if changed + manual flag set
                │   └─ Line 119:      Dependencies: [selectedDots, emitBasslineEvent]

Lines 122-141:  Enhanced handlers (with manual tracking)
                ├─ Lines 122-128:  handleDotClickWithAudioEnhanced
                ├─ Lines 130-136:  handleDragDropWithAudioEnhanced
                └─ Lines 138-141:  handleClearWithSyncEnhanced

Lines 143-195:  Return statement
                ├─ Line 144:     state
                ├─ Line 147:     connections
                ├─ Line 150:     exercise
                ├─ Lines 153-156: Enhanced handlers
                ├─ Lines 159-161: Convenience state values
                ├─ Lines 165-171: Convenience handler functions
                ├─ Lines 174-177: Drag handlers
                ├─ Lines 180-182: Highlight functions
                ├─ Lines 185-186: Exercise functions
                ├─ Line 190:      measureOpacity
                └─ Line 193:      nextNoteToPlay
```

---

## useFretboardState.ts - Detailed Line Map

### State & Configuration

```typescript
Lines 24-33:    Function signature + config
Lines 29-33:    ⭐ Parent-managed config (SINGLE SOURCE OF TRUTH)
                ├─ Line 31:  stringCount = initialConfig?.stringCount || 4
                ├─ Line 32:  tiltAngle = initialConfig?.tiltAngle || 35
                └─ Line 33:  maxFrets = initialConfig?.maxFrets || 25

Lines 37-43:    ⭐ Combined state (PERFORMANCE FIX)
                └─ dotsState: { selectedDots, selectionOrder }
```

### Memoization & Calculations

```typescript
Lines 56-59:    useMemo: frets array
                └─ [maxFrets] dependencies

Lines 62-80:    useMemo: fretboardState object
                └─ [stringCount, tiltAngle, maxFrets, dotsState, ...]

Lines 83-118:   useCallback: hasDotsOnHiddenStrings
                └─ [] no dependencies
```

### State Handlers

```typescript
Lines 125-182:  useCallback: handleDotClick
                ├─ Lines 128-179:  Functional state update
                │   ├─ Lines 134-167: Deselect + renumber
                │   └─ Lines 169-177: Select with order
                └─ Line 181:        Dependencies: []

Lines 184-193:  useCallback: handleRemoveDot
Lines 195-201:  useCallback: handleClearSelectedDots
                ├─ Line 197:        Single state update
                └─ Line 201:        Dependencies: []

Lines 204-209:  useCallback: handleDragStart
Lines 211-214:  useCallback: handleDragEnd
Lines 216-225:  useCallback: handleDragEnter
Lines 223-225:  useCallback: handleDragLeave

Lines 227-275:  useCallback: handleDragDrop (complex)
                ├─ Lines 241-268:  Functional state update
                ├─ Line 274:        Dependencies: [draggedDot]
                └─ Lines 271-272:   Clear drag state
```

### Utility Functions

```typescript
Lines 278-290:  useCallback: checkIsDotSelected
                └─ [dotsState.selectedDots] dependencies

Lines 285-290:  useCallback: checkGetDotOrder
                └─ [dotsState.selectedDots] dependencies

Lines 292-294:  useCallback: checkHasSelectedDots
                └─ [dotsState.selectedDots] dependencies

Lines 297-305:  useCallback: handleResetFretboard
                └─ [] no dependencies
```

### Setters for Compatibility

```typescript
Lines 308-317:  useCallback: setSelectedDots
                └─ [] no dependencies

Lines 319-324:  useCallback: setSelectionOrder
                └─ [] no dependencies
```

---

## useFretboardExercise.ts - Detailed Line Map

### Time Interpolation Hook (useAnimationTime)

```typescript
Lines 35-298:   useAnimationTime function
                ├─ Lines 39-46:   AnimationTimeState interface
                ├─ Lines 48-51:   Function signature

                ├─ Lines 52-69:   Ref setup for interpolation
                │   ├─ Line 53:   lastTransportTimeRef
                │   ├─ Line 54:   lastTransportReceivedAtRef
                │   ├─ Line 57:   fallbackTimeRef
                │   ├─ Line 62:   playbackStartedAtRef
                │   ├─ Line 65:   renderTrigger state
                │   ├─ Line 67:   rafRef
                │   └─ Line 69:   unsubPositionRef

                ├─ Lines 79-192:  useEffect: EventBus subscription (mount)
                │   ├─ Lines 81-87:    RETRY_CONFIG constants
                │   ├─ Lines 102-104:  getEventBus function
                │   ├─ Lines 110-133:  subscribeToEvents function
                │   │   ├─ Line 114:   playback:starting event
                │   │   ├─ Line 125:   transport:stop event
                │   │   └─ Line 131:   Success log
                │   ├─ Lines 139-167:  attemptSubscription with backoff
                │   ├─ Line 170:       Start subscription loop
                │   └─ Lines 173-191:  Cleanup function

                ├─ Lines 195-289:  useEffect: Position updates + RAF (play only)
                │   ├─ Lines 204-250:  EventBus subscription
                │   │   ├─ Line 209:   Subscribe to transport:position-updated
                │   │   ├─ Lines 212-233:  ⭐ Race condition fix (stale event rejection)
                │   │   ├─ Line 238:   timeMs = seconds * 1000
                │   │   ├─ Line 239:   Update lastTransportTimeRef
                │   │   └─ Line 241:   Update lastTransportReceivedAtRef
                │   ├─ Lines 252-273:  RAF loop
                │   │   ├─ Lines 256-263:  RAF callback (FLICKER DEBUG)
                │   │   ├─ Line 266:   setRenderTrigger(rafTime)
                │   │   ├─ Line 269:   requestAnimationFrame
                │   │   └─ Lines 273:  Start initial RAF
                │   └─ Lines 276-286:  Cleanup

                └─ Line 289:       Dependencies: [isPlaying] ONLY!
```

**Critical**: Line 289 - MUST have only `[isPlaying]` to prevent infinite loops

### Exercise Integration Hook (useFretboardExercise)

```typescript
Lines 300-400+:  useFretboardExercise function

                 Lines 313-321:  Function signature

                 ├─ Lines 325-337:  Options extraction
                 ├─ Line 334:       useAudioFretboard hook call

                 ├─ Lines 339-351:  Ref declarations
                 │   ├─ Line 340:   userHasManuallyResetRef
                 │   ├─ Line 341:   lastExerciseIdRef
                 │   ├─ Line 342:   lastPopulationTimestampRef
                 │   ├─ Line 346:   wasPlayingRef (first-beat fix)
                 │   ├─ Line 347:   playbackJustStartedRef
                 │   └─ Line 351:   playbackStartedAtRef

                 ├─ Lines 354-365:  useMemo: exerciseData
                 │   └─ Line 365:    Dependencies: [selectedExercise]

                 ├─ Lines 371-386:  useState + useEffect: musicalTruthState
                 │   ├─ Line 371:    useState(getTruth)
                 │   ├─ Lines 375-385: subscribe to musicalTruth changes
                 │   └─ Line 386:    Returns: unsubscribe

                 ├─ Lines 389-390:  Reactive state values
                 │   ├─ Line 389:    exerciseTempo = musicalTruthState.bpm
                 │   └─ Line 390:    exerciseTimeSignature = musicalTruthState.timeSignature

                 └─ Lines 392-398:  Countdown duration calculation
                     ├─ Line 395:    countdownBars = musicalTruthState.countdownBars
                     ├─ Line 396:    beatsPerBar = timeSignature.numerator
                     ├─ Line 397:    msPerBeat = (60 / tempo) * 1000
                     └─ Line 398:    countdownDurationMs = bars * beats * msPerBeat
```

---

## useMeasureOpacity.ts - Detailed Line Map

### Configuration & Types

```typescript
Lines 1-116:    Types + default config
                ├─ Lines 15-32:    MeasureOpacityConfig interface
                ├─ Lines 38-60:    UseMeasureOpacityConfig interface
                ├─ Lines 65-77:    MeasureHighlightResult interface
                ├─ Lines 82-103:   UseMeasureOpacityReturn interface
                └─ Lines 108-116:  DEFAULT_OPACITY_CONFIG constant
```

### Main Hook Function

```typescript
Lines 138-456:  useMeasureOpacity function
                ├─ Lines 141-150:  Config destructuring

                ├─ Lines 153-156:  useMemo: opacityConfig merge
                │   └─ [userConfig] dependencies

                ├─ Lines 169-173:  Effective time calculation
                │   └─ Line 169:    effectiveTime = currentTime

                ├─ Lines 176-200:  useMemo: currentPosition
                │   ├─ Lines 179-183:  Debug logging (if enabled)
                │   ├─ Lines 192-195:  MusicalTimeConverter.msToPosition
                │   └─ Line 200:       Dependencies: [effectiveTime, isPlaybackEffective, tempo, timeSignature]

                ├─ Lines 203-205:  useMemo: isInTransition
                │   └─ Line 204:    currentPosition.beat >= transitionBeat

                ├─ Lines 208-275:  useMemo: notePositionToAllMeasures
                │   ├─ Lines 211-271:  Build position -> measure mapping
                │   │   ├─ Lines 215-230: Get note measure
                │   │   ├─ Lines 233-247: Map exercise string to fretboard index
                │   │   ├─ Lines 249-251: Create position key
                │   │   └─ Lines 253-257: Store in map
                │   └─ Line 275:        Dependencies: [exerciseNotes, tempo, timeSignature]

                ├─ Lines 278-342:  useMemo: notePositionToAllMeasures (all measures)
                │   ├─ Lines 280-288:  Initialize map + debug
                │   ├─ Lines 290-330:  Build multi-measure tracking
                │   └─ Line 342:       Dependencies: [exerciseNotes, tempo, timeSignature]
```

### Callback Functions

```typescript
Lines 367-409:  useCallback: getMeasureHighlight
                ├─ Lines 368-407: Function body
                │   ├─ Line 369:   positionKey = `${stringIndex},${fret}`
                │   ├─ Line 370:   noteMeasures from map lookup
                │   ├─ Lines 373-374: Return 'other' if no notes
                │   ├─ Lines 383-388: Return 'current' if in current measure
                │   ├─ Lines 391-397: Return 'next' if in next measure
                │   └─ Lines 402-406: Return 'other' (grey) for past/future
                └─ Line 408:        Dependencies: [notePositionToAllMeasures, opacityConfig]

Lines 411-438:  useCallback: getNoteOpacity
                ├─ Lines 412-436: Function body
                │   ├─ Line 413:   positionKey = `${stringIndex},${fret}`
                │   ├─ Line 414:   noteMeasures from map lookup
                │   ├─ Lines 417-418: Return 0 if no notes
                │   ├─ Line 422:   nextMeasure0Based = currentMeasure + 1
                │   ├─ Lines 425-426: Return currentMeasure opacity if in current
                │   ├─ Lines 429-431: Return nextMeasure opacity if in next
                │   └─ Lines 435:   Return otherMeasures opacity (usually 0)
                └─ Line 437:        Dependencies: [currentMeasure0Based, notePositionToAllMeasures, opacityConfig]
```

### Return Statement

```typescript
Lines 441-444:  useMemo: transitionDuration CSS string
                └─ [opacityConfig.transitionDurationMs] dependencies

Lines 446-456:  Return object
                ├─ Line 447:  getNoteOpacity
                ├─ Line 448:  getMeasureHighlight
                ├─ Line 451:  currentMeasure (0-based)
                ├─ Line 452:  currentBeat (1-based)
                ├─ Line 453:  isInTransition
                └─ Line 454:  transitionDuration (CSS string)
```

---

## useDotSynchronization.ts - Detailed Line Map

```typescript
Lines 1-16:     Imports + interface
Lines 22-34:    Function signature

Lines 38-48:    useCallback: calculateMaxOrder
                ├─ Lines 39-43:   Calculate max from all orders
                └─ [] dependencies

Lines 53-60:    useCallback: areDotsEqual
                ├─ Lines 54-57:   Compare keys (simple string comparison)
                └─ [] dependencies

Lines 63-86:    useEffect: 2D → shared state sync (when in 2D mode)
                ├─ Lines 64-75:   Sync if different and in 2D mode
                ├─ Line 77-86:    Dependencies (all props + callbacks)
                └─ Key: Only runs in 2D mode

Lines 89-115+:  useEffect: shared state → 2D sync (when in 3D mode)
                ├─ Lines 90-100:  Sync if different and in 3D mode
                └─ Key: Only runs in 3D mode
```

---

## FretboardGrid.tsx - Detailed Line Map

```typescript
Lines 1-127:    Imports + type definitions
Lines 128-150:  Function signature + props destructuring

Lines 131-400+: FretboardGrid React.memo
                ├─ Lines 131:    React.memo wrapper
                ├─ Lines 132-157: Props destructuring (40+ props)
                ├─ Lines 160-170: Logging (if enabled)
                ├─ Lines 172-175: Vertical lines for frets
                ├─ Lines 176-179: Horizontal lines for strings
                ├─ Lines 180-400: For each position (dot)
                │   ├─ Line 200:   Check if selected
                │   ├─ Line 203:   Check if exercise note
                │   ├─ Line 206:   Check if current note
                │   ├─ Line 209:   Get measure highlight
                │   ├─ Line 212:   Get opacity
                │   └─ Line 215+:  Render FretboardDot component
                └─ Line 400+:     Return JSX
```

---

## File Structure Tree

```
/FretboardCard/
├── FretboardCard.tsx                    [1154 lines] ⭐ Main component
├── README.md                            [Documentation]
├── index.ts                             [Re-exports]
├── types/
│   └── fretboardTypes.ts               [Type definitions]
├── hooks/
│   ├── useFretboard.ts                 [195 lines] ⭐ Hook composition
│   ├── useFretboardState.ts            [364 lines] ⭐ State management
│   ├── useFretboardExercise.ts         [600+ lines] ⭐ Exercise + audio + time
│   ├── useMeasureOpacity.ts            [456 lines] ⭐ Opacity + highlight
│   ├── useFretboardConnections.ts      [Various] Connection highlighting
│   ├── useDotSynchronization.ts        [150+ lines] 2D/3D sync
│   ├── useDotSelectionHandlers.ts      [Various] Click/drag handlers
│   ├── useExerciseLoader.ts            [Various] Exercise loading
│   ├── useStringCountHandlers.ts       [Various] String count changes
│   └── useManualSelectionTracking.ts   [Various] Manual reset tracking
├── components/
│   ├── FretboardGrid.tsx               [400+ lines] ⭐ Grid rendering
│   ├── Fretboard3D.tsx                 [Three.js rendering]
│   ├── FretboardDot.tsx                [Individual dot]
│   ├── FretboardHeader.tsx             [Header controls]
│   ├── FretboardControls.tsx           [Control buttons]
│   ├── FretboardModeControls.tsx       [2D/3D toggle]
│   ├── ExerciseProgressBar.tsx         [Progress display]
│   ├── DotDropdownMenu.tsx             [Context menu]
│   └── GridLines/
│       ├── HorizontalLines.tsx         [String lines]
│       ├── VerticalLines.tsx           [Fret lines]
│       └── DiagonalLines.tsx           [Connection lines]
├── utils/
│   ├── highlightCalculations.ts        [Highlight logic]
│   ├── connectionDetection.ts          [Connection detection]
│   ├── fretboardGeometry.ts            [Position calculations]
│   ├── formatConversion.ts             [Format conversion]
│   └── stringCountValidation.ts        [String count helpers]
└── __tests__/
    ├── FretboardCard.freeze.test.tsx   [Freeze detection tests]
    ├── FretboardCard.deps.test.tsx     [Dependency tests]
    ├── highlightFunctions.test.ts      [Highlight tests]
    ├── useMeasureOpacity.test.ts       [Opacity tests]
    └── exercise-auto-population.test.tsx [Auto-pop tests]
```

---

## Key Line References by Feature

### Re-render Throttling
- **FretboardCard.tsx, Line 1092**: `Math.abs(nextTime - prevTime) > 100`
- **FretboardCardContent memo, Lines 1088-1094**: currentTime throttle logic

### Time Interpolation
- **useFretboardExercise.ts, Line 48-298**: useAnimationTime hook
- **useFretboardExercise.ts, Lines 253-273**: RAF loop implementation

### Race Condition Fix
- **useFretboardExercise.ts, Lines 212-233**: Stale event rejection
- **useFretboardExercise.ts, Line 217-220**: Event timestamp validation

### Measure Flicker Prevention
- **useMeasureOpacity.ts, Line 367**: getMeasureHighlight with measure parameter
- **useMeasureOpacity.ts, Line 364**: Explicit parameter (no closure capture)

### Stale Closure Prevention
- **FretboardCard.tsx, Line 471**: handleExerciseSelect with empty deps
- **FretboardCard.tsx, Lines 354-376**: Ref update effects
- **useFretboardState.ts, Line 181**: handleDotClick with functional update

### Combined State Pattern
- **useFretboardState.ts, Lines 37-43**: Combined dotsState
- **useFretboardState.ts, Line 128-179**: Single setDotsState call in handleDotClick

### Measure Opacity Calculation
- **useMeasureOpacity.ts, Lines 208-275**: notePositionToAllMeasures memoization
- **useMeasureOpacity.ts, Lines 411-438**: getNoteOpacity callback

---

## Search Keywords

When looking for specific functionality, search for:

| Feature | Search Term | Files |
|---------|------------|-------|
| Current time updates | "currentTime" | FretboardCard.tsx, useFretboardExercise.ts |
| Measure tracking | "currentMeasure" | useMeasureOpacity.ts, useFretboardExercise.ts |
| Dot selection | "handleDotClick" | useFretboardState.ts, FretboardCard.tsx |
| Exercise loading | "exerciseData" | useFretboardExercise.ts, useExerciseLoader.ts |
| Audio playback | "triggerNote" | useFretboard.ts, useAudioFretboard.ts |
| 2D/3D sync | "useDotSynchronization" | FretboardCard.tsx |
| Render count | "globalRenderCount" | FretboardCard.tsx (Lines 213, 283) |
| RAF timing | "requestAnimationFrame" | useFretboardExercise.ts |
| Throttle logic | "Math.abs(nextTime - prevTime)" | FretboardCard.tsx, Line 1092 |

