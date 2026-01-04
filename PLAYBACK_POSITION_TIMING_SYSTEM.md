# Playback Position & Beat/Measure Tracking System

## Overview

The BassNotion playback system tracks the current playback position and beat/measure information through a sophisticated multi-layered architecture. The yellow ring on the fretboard (showing the "current note") and measure-based highlighting are driven by real-time position updates flowing through the system.

---

## Core Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION (Play Button)                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TransportContext (TransportProvider)                               │
│  `/apps/frontend/src/domains/playback/contexts/TransportContext.tsx`│
│  - Centralized context managing transport state                     │
│  - position: TransportPosition (bars, beats, sixteenths, ticks)    │
│  - isPlaying, isPaused, isStopped states                            │
│  - Subscribe to EventBus: 'transport:position-updated' (60Hz)       │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                 ┌───────────┴──────────────┐
                 │                          │
                 ▼                          ▼
      ┌──────────────────────┐   ┌──────────────────────┐
      │ FretboardCard        │   │ Other Widgets        │
      │ (Widget Consumer)    │   │ (Metronome, etc)     │
      └──────────┬───────────┘   └──────────────────────┘
                 │
                 ▼
      ┌──────────────────────────────────────────────────┐
      │ useMeasureOpacity Hook                           │
      │ `/apps/frontend/src/domains/widgets/components/ │
      │ YouTubeWidgetPage/FretboardCard/hooks/          │
      │ useMeasureOpacity.ts`                            │
      │                                                   │
      │ Converts currentTime (ms) → MusicalPosition     │
      │ Calculates measure-relative highlighting        │
      └──────────┬───────────────────────────────────────┘
                 │
                 ▼
      ┌──────────────────────────────────────────────────┐
      │ FretboardGrid Component                          │
      │ `/apps/frontend/src/domains/widgets/components/ │
      │ YouTubeWidgetPage/FretboardCard/components/     │
      │ FretboardGrid.tsx`                               │
      │                                                   │
      │ - Receives getMeasureOpacity() callback         │
      │ - Receives getMeasureHighlight() callback       │
      │ - Receives nextNoteToPlay indicator             │
      └──────────┬───────────────────────────────────────┘
                 │
                 ▼
      ┌──────────────────────────────────────────────────┐
      │ FretboardDot Component                           │
      │ `/apps/frontend/src/domains/widgets/components/ │
      │ YouTubeWidgetPage/FretboardCard/components/     │
      │ FretboardDot.tsx`                                │
      │                                                   │
      │ - Renders with isCurrentNote={true}             │
      │ - Applies yellow ring: 'bg-orange-500 ring-2'   │
      │ - Applies animate-pulse effect                   │
      └──────────────────────────────────────────────────┘
```

---

## Key Files & Their Roles

### 1. TransportContext - Position State Manager
**File**: `/apps/frontend/src/domains/playback/contexts/TransportContext.tsx`

**Responsibility**: Centralized subscription point for all transport events

**Key State**:
```typescript
interface TransportContextValue {
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  tempo: number;
  timeSignature: TimeSignature;
  position: TransportPosition;  // bars, beats, sixteenths, ticks, seconds
  // ... control methods
}
```

**Position Updates**:
- Subscribes to EventBus events (single subscription for entire app)
- Event: `transport:position-updated` fired at 60Hz during playback
- Handler: `handlePositionUpdate()` (line 537-585)
- Updates state via `setPosition()` with validated position data

**How it works**:
1. EventBus emits `transport:position-updated` with position data
2. TransportContext updates React state via `setPosition(pos)`
3. All consumers (FretboardCard, etc.) re-render with new position
4. Position uses display format: 1-based bars/beats (1:1:0 = start, not 0:0:0)

---

### 2. useTransportPosition - Direct Subscription
**File**: `/apps/frontend/src/domains/playback/hooks/useTransportPosition.ts`

**Responsibility**: Direct EventBus subscription for minimal latency (used by audio components)

**Key Functions**:
```typescript
export function useTransportPosition({
  onPositionUpdate,
  enabled = true,
}: UseTransportPositionOptions)

// Helper functions
positionToBeatIndex(position)  // Convert 1-based beats to 0-based array index
isAtBeat(position, targetBeat)
isBarStart(position)
```

---

### 3. MusicalPositionManager - Time Conversion
**File**: `/apps/frontend/src/domains/playback/modules/transport/position/MusicalPositionManager.ts`

**Responsibility**: Converts between seconds and musical time (bars:beats:sixteenths)

**Key Methods**:
```typescript
// Core conversions
secondsToPosition(seconds): MusicalPosition  // 0-based internal format
positionToSeconds(position): number

// Display position (with countdown offset)
getDisplayPosition(): MusicalPosition  // Converts to 1-based for UI display

// Countdown support
setCountdownBeats(beats): void  // Set pre-roll duration
getCountdownBeats(): number     // Get current countdown

// Position tracking
updatePosition(seconds): MusicalPosition
getPosition(): MusicalPosition
```

**Position Format**:
- Internal (0-based): `bars:beats:sixteenths` where bars/beats start at 0
- Display (1-based): `bars:beats:sixteenths` where bars/beats start at 1 (DAW convention)

**Countdown Logic**:
- When countdown is enabled, display position is offset by `countdownBeats`
- Raw position 0:0:0 → Display -1:4:0 (countdown visible at measure -1)
- Raw position 4:0:0 → Display 1:1:0 (exercise starts at measure 1)

---

### 4. useMeasureOpacity - Measure-Based Highlighting
**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useMeasureOpacity.ts`

**Responsibility**: Calculate note opacity and highlight state based on current playback measure

**Key Interface**:
```typescript
interface UseMeasureOpacityConfig {
  exerciseNotes: ExerciseNote[];
  currentTime: number;          // Playback time in milliseconds
  isPlaying: boolean;
  tempo: number;
  timeSignature?: TimeSignature;
  stringCount: 4 | 5 | 6;
}

interface UseMeasureOpacityReturn {
  getNoteOpacity: (stringIndex, fret) => number;      // 0-1 opacity
  getMeasureHighlight: (stringIndex, fret) => MeasureHighlightResult;
  currentMeasure: number;       // 1-based
  currentBeat: number;          // 1-based
  isInTransition: boolean;
  transitionDuration: string;   // CSS duration
}
```

**How it calculates opacity** (lines 186-224):
1. Convert `currentTime` (ms) → MusicalPosition using MusicalTimeConverter
2. Extract measure from position (1-based from MusicalTimeConverter)
3. For each exercise note:
   - Get its measure (0-based from ExerciseNote.position.measure)
   - Convert to 0-based: `currentMeasure0Based = effectiveMeasure - 1`
   - Compare note's measure with current playback measure

**Opacity Rules**:
- **Current measure**: 100% opacity (fullly visible, green highlight)
- **Next measure**: 30% opacity (preview, green highlight)
- **Other measures**: 0% opacity (hidden) OR 100% opacity (grey, not highlighted)

**Special Handling**:
- `isInTransition`: True when beat >= 3 (showing next measure preview)
- `effectiveMeasure`: Adjusted to next measure during transition
- First-beat flicker fix: Forces effective time to 0 when playback starts (line 168)

---

### 5. FretboardGrid - Visual Rendering
**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/components/FretboardGrid.tsx`

**Responsibility**: Render fretboard visualization with timing-aware highlighting

**Key Props** (lines 60-100):
```typescript
interface FretboardGridProps {
  isCurrentNote: IsCurrentNoteFunction;              // Determine if dot is "current"
  getMeasureOpacity?: GetMeasureOpacityFunction;     // Get opacity 0-1
  getMeasureHighlight?: GetMeasureHighlightFunction; // Get highlight state
  measureOpacityTransition?: string;                 // CSS transition duration
  measureAwareConnections?: MeasureAwareConnection[];// Connections with measure info
  currentMeasure0Based?: number;                     // Current measure (0-based)
  nextNoteToPlay?: NextNoteToPlay | null;            // Yellow ring indicator
}
```

**Key Logic**:
- Passes `getMeasureOpacity()` to each FretboardDot
- Passes `getMeasureHighlight()` to determine green vs grey coloring
- Manages measure-aware connection lines (with transition lines)
- Transition target dot: First note of next measure (highlighted in orange)

---

### 6. FretboardDot - Individual Note Display
**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/components/FretboardDot.tsx`

**Responsibility**: Render a single note dot with timing-aware styling

**Key Props** (lines 9-28):
```typescript
interface FretboardDotProps {
  isCurrentNote: boolean;              // Is this the "current" note (yellow ring)
  isExerciseNote: boolean;             // Is this part of exercise
  measureOpacity?: number;             // Opacity from useMeasureOpacity
  opacityTransitionDuration?: string;  // CSS transition duration
}
```

**Styling Logic** (lines 59-73):
```typescript
getDotClassName = () => {
  if (isSelected) {
    return 'bg-green-500 text-black';
  } else if (isDraggedOver) {
    return 'bg-blue-500 text-white border-2 border-blue-300';
  } else if (isCurrentNote) {
    // ⭐ YELLOW RING EFFECT ⭐
    return 'bg-orange-500 text-white animate-pulse shadow-lg ring-2 ring-orange-300';
  } else if (fret in [3, 5, 7, 9, 12]) {
    return 'bg-slate-500 hover:bg-blue-400 text-white';  // Fret markers
  } else {
    return 'bg-slate-600 hover:bg-blue-400 text-white';  // Default
  }
};
```

**Opacity Calculation** (lines 82-87):
```typescript
const baseOpacity = measureOpacity ?? 1;
const finalOpacity = isBeingDragged ? Math.min(baseOpacity, 0.5) : baseOpacity;
```

**CSS Transition** (lines 89-104):
```typescript
const transition = `background-color 0.15s ease-in-out,
                    opacity ${opacityTransitionDuration || '250ms'} ease-in-out`;
```

---

## How The Yellow Ring Works

### The Flow

1. **Position Update (60Hz)**
   ```
   Transport.onPositionUpdate()
   → EventBus.emit('transport:position-updated', { position, seconds })
   → TransportContext.handlePositionUpdate()
   → setPosition(pos)
   → FretboardCard re-renders
   ```

2. **Measure Opacity Calculation**
   ```
   useMeasureOpacity() in FretboardCard
   - Input: currentTime (ms) from TransportContext.position.seconds
   - Convert: MusicalTimeConverter.msToPosition(currentTime, tempo, timeSignature)
   - Result: currentMeasure (1-based), currentBeat (1-based)
   - For each exercise note:
     - Get note.position.measure (0-based)
     - Convert playback measure to 0-based
     - Compare: Is note in current measure?
   - Return: getMeasureOpacity(stringIndex, fret) → 0 or 1.0
   ```

3. **Highlight Determination**
   ```
   getMeasureHighlight() in useMeasureOpacity
   - If note is in current measure: { shouldHighlight: true, state: 'current' }
   - If note is in next measure: { shouldHighlight: true, state: 'next' }
   - Else: { shouldHighlight: false, state: 'other' }
   - Return green highlight vs grey background
   ```

4. **Fretboard Rendering**
   ```
   FretboardGrid iterates exercise notes and passes callbacks to FretboardDot:
   - opacity = getMeasureOpacity(stringIndex, fret)
   - highlight = getMeasureHighlight(stringIndex, fret)

   FretboardDot applies styles:
   - If isCurrentNote: 'bg-orange-500 animate-pulse ring-2 ring-orange-300'
   - opacity: finalOpacity (from measureOpacity)
   - Renders at calculated x, y position
   ```

### What Makes the Yellow Ring "Current"

The `isCurrentNote` flag is determined by comparing the **note's measure** with the **current playback measure**:

```typescript
// In useMeasureOpacity
const currentMeasure0Based = effectiveMeasure - 1;  // Convert from 1-based to 0-based

if (noteMeasures.includes(currentMeasure0Based)) {
  // This note is in the currently playing measure
  return {
    shouldHighlight: true,
    state: 'current',  // ← Sets isCurrentNote to true
    opacity: 1.0       // Full visibility
  };
}
```

Then in FretboardGrid:
```typescript
<FretboardDot
  isCurrentNote={getMeasureHighlight(string, fret).state === 'current'}
  // This triggers the orange-500 + animate-pulse styling
/>
```

---

## Position Data Flow - Example Timeline

**At 120 BPM, 4/4 time (each beat = 500ms):**

```
Time (ms) | Elapsed | Display Pos | Measure | Beat | What's Highlighted?
────────────────────────────────────────────────────────────────────────
0         | 0.0s    | 1:1:0       | 1       | 1    | All notes in measure 1 (green)
200       | 0.2s    | 1:1:1       | 1       | 1    |
500       | 0.5s    | 1:2:0       | 1       | 2    |
1000      | 1.0s    | 1:3:0       | 1       | 3    | (transition zone starts)
1500      | 1.5s    | 1:4:0       | 1       | 4    |
2000      | 2.0s    | 2:1:0       | 2       | 1    | Switching: measure 2 notes now green
2500      | 2.5s    | 2:2:0       | 2       | 2    |
3000      | 3.0s    | 2:3:0       | 2       | 3    |
```

Each note on the fretboard:
- If its `position.measure === currentMeasure`: Yellow ring + 100% opacity
- If its `position.measure === currentMeasure + 1`: Grey + 30% opacity (preview)
- Otherwise: Hidden (0% opacity)

---

## Countdown Display

When a countdown is set (e.g., 4 beats before exercise starts):

### Raw vs Display Position

**Countdown Duration**: 4 beats = 1 measure in 4/4 time

```
Raw Internal     | Display (UI)  | What User Sees
─────────────────────────────────────────────────
0:0:0 (0.0s)     | -1:4:0        | Countdown measure -1, beat 4
0:1:0 (0.5s)     | -1:1:0        | Countdown measure -1, beat 1  ← Backwards countdown!
0:3:0 (1.5s)     | -1:3:0        | Countdown measure -1, beat 3
1:0:0 (2.0s)     | 1:1:0         | Exercise starts at measure 1, beat 1
```

**Implementation**:
- `MusicalPositionManager.setCountdownBeats(4)` sets offset
- `getDisplayPosition()` applies offset: `adjustedBeats = totalBeats - countdownBeats`
- When `adjustedBeats < 0`: Display in measure -1, beats count DOWN
- When `adjustedBeats >= 0`: Normal 1-based display starts

---

## Key Implementation Details

### 1. Position Format Conversions
- **EventBus events**: Use display format (1-based bars/beats)
- **MusicalPositionManager**: Internal 0-based, external display 1-based
- **MusicalTimeConverter**: 1-based measures/beats (match display format)
- **ExerciseNote.position**: 0-based measures (for internal calculations)

### 2. Timing Flow
```
Transport (Tone.js)
  → AudioContext.currentTime (seconds)
  → Position callback: Transport.getDisplayPosition()
  → EventBus: 'transport:position-updated'
  → TransportContext: setPosition()
  → FretboardCard gets new position via useTransportContext().position
  → useMeasureOpacity converts position.seconds to MusicalPosition
  → getMeasureOpacity() returns opacity for each note
  → FretboardDot renders with yellow ring if isCurrentNote
```

### 3. Update Rate & Performance
- **Position updates**: 60Hz (throttled by Transport)
- **FretboardGrid re-renders**: Only when position or highlight changes
- **Optimization**: Position moves faster than display format changes
  - e.g., at 120 BPM, beats last 500ms but position updates every ~17ms
  - UseMeasureOpacity batches updates at measure boundaries

### 4. Common Gotchas
- **Off-by-one bugs**: 1-based vs 0-based indexing differences
- **Time stale values**: currentTime may lag during props propagation
  - Solution: useMeasureOpacity uses `playbackJustStartedRef` to force time=0
- **Countdown backwards beats**: During countdown, beats count DOWN (4→3→2→1)
  - Uses `Math.ceil(absBeats)` for 1-based display during countdown
- **Measure boundaries**: Transition logic applies at beat 3 in 4/4 time

---

## Files Reference Map

| File | Purpose | Key Export |
|------|---------|------------|
| `/apps/frontend/src/domains/playback/contexts/TransportContext.tsx` | Position state management | `useTransportContext()`, `TransportProvider` |
| `/apps/frontend/src/domains/playback/hooks/useTransportPosition.ts` | Direct EventBus subscription | `useTransportPosition()`, `positionToBeatIndex()` |
| `/apps/frontend/src/domains/playback/modules/transport/position/MusicalPositionManager.ts` | Time conversion | `MusicalPositionManager` |
| `/apps/frontend/src/domains/playback/modules/transport/core/Transport.ts` | Transport coordinator | `Transport` class |
| `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useMeasureOpacity.ts` | Measure-based opacity | `useMeasureOpacity()` |
| `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/components/FretboardGrid.tsx` | Fretboard grid rendering | `FretboardGrid` component |
| `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/components/FretboardDot.tsx` | Individual note dot | `FretboardDot` component |
| `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useFretboard.ts` | Main fretboard hook | `useFretboard()` |
| `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/hooks/useFretboardExercise.ts` | Exercise integration | `useFretboardExercise()` |

---

## Quick Debugging Tips

### Enable Debug Logging
```typescript
// In browser console
window.__DEBUG_FRETBOARD__ = true;
// Then watch console for detailed position and measure calculations
```

### Check Position Updates
```typescript
// In browser console
const context = window.__transportContext;
setInterval(() => {
  const pos = context.position;
  console.log(`Position: ${pos.bars}:${pos.beats}:${pos.sixteenths},
               Current time: ${pos.seconds}ms`);
}, 1000);
```

### Monitor EventBus
```typescript
// Direct subscription to position updates
const eventBus = window.EventBus;
eventBus.on('transport:position-updated', (data) => {
  console.log('Position update:', data);
});
```

### Check Measure Calculation
```typescript
// Inside useMeasureOpacity, logs show:
// [useMeasureOpacity] 🎯 FIRST-BEAT FIX v3: Playback just started
// [MEASURE-DEBUG] positionKey=1,5, currentMeasure0Based=0
```

---

## Summary

The yellow ring highlighting system works by:

1. **Tracking playback time** via Transport and EventBus (60Hz updates)
2. **Converting time to musical position** (measure + beat) using MusicalTimeConverter
3. **Comparing note measures** to current playback measure
4. **Calculating opacity** based on measure comparison (100% current, 30% next, 0% other)
5. **Rendering dots** with `isCurrentNote` prop that triggers orange styling

All timing information flows through the TransportContext, making it the single source of truth for playback position across all widgets.
