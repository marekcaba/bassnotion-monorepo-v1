# FretboardCard Component System

## Overview

The FretboardCard component is a comprehensive dual-mode (2D/3D) interactive bass guitar fretboard that supports user dot selection, exercise loading, audio feedback, and seamless mode switching. This document explains the architecture, state management system, and key features that coordinate between multiple state sources to ensure consistent behavior across all scenarios.

## Key Features

- **Dual-Mode Visualization**: Seamless switching between 2D grid and 3D cylindrical fretboard views
- **Multi-String Support**: 4, 5, and 6-string bass guitar configurations with dynamic string hiding/revealing
- **Exercise Integration**: Automatic exercise loading with sync event handling
- **Audio Feedback**: Real-time audio playback with Web Audio API integration
- **Drag & Drop**: Intuitive note reordering with visual feedback
- **Widget Synchronization**: Integration with YouTube player, metronome, and other widgets
- **Accessibility**: Full keyboard navigation and screen reader support
- **Manual Selection Protection**: Prevents exercise auto-population when users have made manual changes

## Core Architecture

### Component Structure

```
FretboardCard/
├── FretboardCard.tsx           # Main component with SyncedWidget wrapper
├── components/
│   ├── FretboardGrid.tsx       # 2D fretboard visualization
│   ├── Fretboard3D.tsx         # 3D cylindrical fretboard
│   ├── FretboardHeader.tsx     # Header with sync status & controls
│   ├── FretboardControls.tsx   # 2D mode controls
│   ├── ExerciseProgressBar.tsx # Exercise progress display
│   ├── FretboardDot.tsx        # Individual dot component
│   └── GridLines/              # Grid line components
├── hooks/
│   ├── useFretboard.ts         # Main hook combining all functionality
│   ├── useFretboardState.ts    # Local state management
│   ├── useFretboardExercise.ts # Exercise integration
│   └── useFretboardConnections.ts # Connection line logic
├── utils/
│   ├── connectionDetection.ts  # Connection algorithms
│   ├── fretboardGeometry.ts    # Position calculations
│   └── highlightCalculations.ts # Visual highlighting
└── types/
    └── fretboardTypes.ts       # TypeScript definitions
```

### State Sources

The FretboardCard manages multiple interconnected state sources:

1. **2D Local State** (`useFretboardState`)
   - `selectedDots`: Map<string, number[]> - user-selected dots with order numbers
   - `selectionOrder`: number - counter for sequential dot selection
   - `stringCount`: 4 | 5 | 6 - bass guitar string configuration
   - `tiltAngle`: number - 3D perspective angle
   - `draggedDot`: DraggedDot | null - currently dragged dot
   - `dragOverTarget`: DragOverTarget | null - drag hover target

2. **3D Shared State** (Props from parent)
   - `selectedDots3D`: Map<string, number[]> - shared between 2D and 3D modes
   - `stringCount3D`: 4 | 5 | 6 - shared string count
   - `cameraMode`: 'overview' | 'action' - 3D camera configuration

3. **Exercise State** (`useFretboardExercise`)
   - `selectedExercise`: Exercise data from sync system
   - `exerciseNotes`: ExerciseNote[] - exercise metadata
   - `hasExercise`: boolean - whether an exercise is loaded
   - `audioIntegration`: Audio feedback system

4. **Manual Reset State** (Refs)
   - `userHasManuallyReset`: boolean - tracks if user clicked reset
   - `userHasManualSelections`: boolean - tracks if user made manual selections
   - `lastResetTime`: number - timestamp of last reset
   - `lastClickTimestamp`: number - timestamp of last exercise click
   - `currentExerciseId`: string | null - current exercise ID for change detection

## State Flow Diagrams

### 1. User Manual Dot Selection

```
User clicks dot (2D mode)
    ↓
useFretboardState.handleDotClick()
    ↓
selectedDots updated (2D)
    ↓
Real-time sync: 2D → shared state
    ↓
sharedSetSelectedDots() called
    ↓
selectedDots3D updated (3D)
    ↓
Both modes show selection
```

### 2. Exercise Loading Flow

```
User clicks exercise in selector
    ↓
ExerciseSelectorCard.handleExerciseSelect()
    ↓
EXERCISE_CHANGE event emitted (with clickTimestamp)
    ↓
FretboardCard.handleExerciseChange()
    ↓
loadExercise() called
    ↓
Check manual selection protection:
    - If userHasManualSelections && same exercise: skip
    - If different exercise || after reset: proceed
    ↓
Both 2D and 3D states populated:
    - fretboard.state.setSelectedDots()
    - sharedSetSelectedDots()
    - setSelectedDots3D()
    ↓
Exercise metadata stored:
    - currentExerciseId updated
    - lastClickTimestamp updated
    - userHasManualSelections reset
```

### 3. Reset Flow

```
User clicks Reset button
    ↓
handleUnifiedReset()
    ↓
Multiple state clears:
    - fretboard.state.setSelectedDots(new Map())
    - sharedSetSelectedDots(new Map())
    - setSelectedDots3D(new Map())
    ↓
Flags set:
    - userHasManuallyReset = true
    - userHasManualSelections = false
    - currentExerciseId = null
    - lastResetTime = now
    ↓
Both modes cleared
    ↓
Exercise tracking cleared to allow re-selection
```

### 4. Mode Switching Flow

```
User toggles 2D ↔ 3D mode
    ↓
Mode switching effect triggers
    ↓
Check current states
    ↓
If states differ:
    - 2D → 3D: sync fretboard.selectedDots to sharedSelectedDots
    - 3D → 2D: sync sharedSelectedDots to fretboard.selectedDots
    ↓
Both modes synchronized
```

## Key Functions

### `loadExercise(exercise, isAfterReset)`

**Purpose**: Single source of truth for exercise loading  
**Behavior**:

- Populates ALL state sources simultaneously
- Clears `userHasManuallyReset` flag if loading after reset
- Ensures immediate, consistent state across modes

### `handleUnifiedReset()`

**Purpose**: Universal reset for both modes  
**Behavior**:

- Clears all state sources (2D, 3D, shared)
- Sets `userHasManuallyReset = true`
- Prevents auto-population until user action

### Real-time Synchronization Effects

**Purpose**: Keep 2D and 3D states synchronized  
**Behavior**:

- Continuously syncs user selections between modes
- Respects state differences to prevent infinite loops
- Always active (not blocked by reset state)

## State Persistence Rules

### ✅ User Manual Selections

- **Persist across mode switches**: Yes
- **Cleared by reset**: Yes
- **Cleared by exercise selection**: Yes
- **Synced between modes**: Yes (real-time)

### ✅ Exercise-loaded Selections

- **Persist across mode switches**: Yes
- **Cleared by reset**: Yes
- **Overwritten by new exercise**: Yes
- **Synced between modes**: Yes (immediate)

### ✅ Reset State

- **Persists across mode switches**: Yes
- **Cleared by exercise selection**: Yes
- **Prevents auto-population**: Yes
- **Affects both modes**: Yes

## Critical State Management Patterns

### 1. Preventing Infinite Loops

```typescript
// Check if states are actually different before syncing
const currentSharedKeys = Array.from(sharedSelectedDots.keys())
  .sort()
  .join(',');
const fretboardKeys = Array.from(fretboard.selectedDots.keys())
  .sort()
  .join(',');

if (currentSharedKeys !== fretboardKeys) {
  sharedSetSelectedDots(fretboard.selectedDots);
}
```

### 2. Exercise Click Detection

```typescript
// Use timestamps to detect user clicks vs re-renders
if (exercise && clickTimestamp && clickTimestamp > lastClickTimestamp.current) {
  lastClickTimestamp.current = clickTimestamp;
  loadExercise(exercise, isAfterReset);
}
```

### 3. Reset State Management

```typescript
// Manual reset prevents auto-population
if (!userHasManuallyReset.current) {
  // Auto-population logic here
}
```

## Component Integration

### Hooks Used

- `useFretboard()` - Main hook combining all functionality
- `useFretboardState()` - 2D state management
- `useFretboardExercise()` - Exercise integration (auto-population disabled)
- `useAudioFretboard()` - Audio feedback system

### Sync System Integration

- Subscribes to `EXERCISE_CHANGE` events
- Emits `CUSTOM_BASSLINE` events for widget sync
- Uses `widgetSyncService` for direct event subscription

## Manual Selection Protection System

### Purpose

Prevents exercise auto-population from overriding user modifications, ensuring users don't lose their work when the same exercise is clicked multiple times.

### How It Works

- **`userHasManualSelections`**: Boolean flag that tracks if user has made any manual dot selections
- **Exercise Loading Logic**: Checks if user has manual selections AND clicking same exercise → skips auto-population
- **Different Exercise**: Always loads new exercise data, replacing user modifications
- **After Reset**: Clears manual selections flag, allowing exercise auto-population to resume

### Behavioral Rules

1. **Manual dot selection**: Sets `userHasManualSelections = true`
2. **Same exercise clicked**: If manual selections exist, skips auto-population
3. **Different exercise clicked**: Always loads, resets manual selections flag
4. **After reset**: Clears manual selections flag, allows auto-population
5. **Drag & drop**: Counts as manual selection, sets flag to true

### User Experience Benefits

- **Preserves user work**: Prevents accidental loss of manual modifications
- **Intuitive behavior**: Same exercise doesn't override, different exercise does
- **Clear state transitions**: Reset button clears the protection
- **Flexible workflow**: Users can modify exercises without losing changes

## Common Scenarios

### Scenario 1: User Workflow

1. User selects dots in 2D mode → visible in both modes
2. User switches to 3D mode → selections persist
3. User adds more dots in 3D mode → visible in both modes
4. User switches back to 2D mode → all selections persist

### Scenario 2: Exercise Workflow

1. User selects exercise → populates both modes
2. User switches modes → exercise persists
3. User clicks same exercise again → reloads in both modes
4. User switches modes → exercise still persists

### Scenario 3: Reset Workflow

1. User has selections in both modes
2. User clicks reset → both modes clear
3. User switches modes → both stay clear (no auto-population)
4. User manually selects dots → selections persist across modes
5. User selects exercise → clears reset state, loads exercise

### Scenario 4: Manual Selection Protection

1. User loads exercise → exercise data displayed
2. User manually adds/removes dots → manual selections flag set
3. User clicks same exercise again → no change (protected)
4. User clicks different exercise → loads new exercise (overrides)
5. User clicks reset → clears protection, allows auto-population

## Debugging Tips

### State Inspection

```typescript
// Check current state in console
console.log('2D State:', fretboard.selectedDots);
console.log('3D State:', sharedSelectedDots);
console.log('Reset State:', userHasManuallyReset.current);
```

### Common Issues

1. **Selections not persisting**: Check real-time sync effects
2. **Auto-population after reset**: Check `userHasManuallyReset` flag
3. **Mode switching issues**: Check mode switching effect dependencies
4. **Exercise not loading**: Check `clickTimestamp` comparison
5. **Manual selections being overridden**: Check `userHasManualSelections` flag
6. **String count changes blocked**: Check for dots on hidden strings
7. **Audio not playing**: Check `audioIntegration.isAudioEnabled` and error states

## String Index Mapping System

### Hidden String Layout System

The system uses a consistent 6-string base layout where strings are hidden/revealed based on string count:

```typescript
// Full string configuration (always present):
// Base layout: B(0), E(1), A(2), D(3), G(4), C(5)

// Visible strings by configuration:
// 4-string: E(1), A(2), D(3), G(4) - B and C hidden
// 5-string: B(0), E(1), A(2), D(3), G(4) - C hidden
// 6-string: B(0), E(1), A(2), D(3), G(4), C(5) - all visible
```

### String Count Changes (Hidden/Reveal System)

When switching between string counts, strings are simply hidden or revealed:

**No Index Conversion Needed:**

- **4→5 strings**: Reveals B string at index 0, no index changes
- **5→4 strings**: Hides B string at index 0, no index changes
- **5→6 strings**: Reveals C string at index 5, no index changes
- **6→5 strings**: Hides C string at index 5, no index changes
- **4→6 strings**: Reveals B(0) and C(5), no index changes
- **6→4 strings**: Hides B(0) and C(5), no index changes

**Benefits:**

- **Zero flickering**: No state conversion or index manipulation
- **Consistent indices**: E string is always at index 1, A always at index 2, etc.
- **Just show/hide**: String rows are simply revealed or hidden
- **No complex logic**: No conversion calculations needed
- **Smooth transitions**: Feels like natural string addition/removal

**String Count Validation:**

- **Dots on Hidden Strings**: Prevents string count changes that would hide selected dots
- **Warning Messages**: Shows specific messages about which strings would be hidden
- **Button Styling**: Visually indicates which string count changes are blocked
- **User-Friendly**: Clear tooltips explain why certain changes are disabled

The system ensures that:

- **Consistent Storage**: All dots are stored using consistent indices (B=0, E=1, A=2, D=3, G=4, C=5)
- **Show/Hide Logic**: String count changes only affect which strings are visible, not their indices
- **No Index Conversion**: When clicking dots, they're stored with absolute indices immediately
- **Smooth Transitions**: Only the visibility of string rows changes, existing dots stay in place
- **Zero Flickering**: No state conversion or recreation of existing strings
- **Protected Selections**: Prevents accidental loss of selections when changing string counts

**Example Flow:**

1. User clicks open E on 4-string fretboard → stored as "1,open" (E=1 in full layout)
2. User switches to 5-string → B string row appears, E note still at "1,open" (E=1)
3. User switches back to 4-string → B string row hides, E note still at "1,open" (E=1)
4. Result: E string note stays on E string throughout all transitions

## Future Considerations

### Performance Optimization

- Consider debouncing real-time sync for large selections
- Implement virtual scrolling for exercise lists
- Add state persistence to localStorage

### Feature Extensions

- Multi-exercise selection support
- Undo/redo functionality
- Selection history tracking
- Advanced exercise filtering
- 6-string bass support (ready for implementation)

## Audio Integration

### Audio System

The FretboardCard integrates with the `useAudioFretboard` hook to provide real-time audio feedback:

- **Audio Triggers**: Each dot click or selection triggers corresponding bass note
- **Web Audio API**: Uses Tone.js for low-latency audio synthesis
- **String Tuning**: Supports standard bass tuning (B-E-A-D-G-C for 6-string)
- **Fret Calculation**: Calculates exact frequencies for each fret position
- **Audio State**: Tracks audio enabled/disabled state and error conditions

### Audio Features

- **Real-time Feedback**: Instant audio on dot selection
- **Exercise Playback**: Audio feedback during exercise practice
- **Error Handling**: Graceful fallback when audio is unavailable
- **Volume Control**: Integrated with user audio preferences

## API Reference

### Types

```typescript
type SelectedDotsMap = Map<string, number[]>;
type StringCount = 4 | 5 | 6;
type Fret = number | 'open';
type CameraMode = 'overview' | 'action';
type DraggedDot = { stringIndex: number; fret: Fret; order: number };
type DragOverTarget = { stringIndex: number; fret: Fret };
```

### Key Props

```typescript
interface FretboardCardProps {
  is3DMode?: boolean;
  selectedDots3D?: Map<string, number[]>;
  setSelectedDots3D?: (selectedDots: Map<string, number[]>) => void;
  stringCount3D?: 4 | 5 | 6;
  setStringCount3D?: (count: 4 | 5 | 6) => void;
  cameraMode?: 'overview' | 'action';
  setCameraMode?: (mode: 'overview' | 'action') => void;
}
```

### Main Hook Returns

```typescript
interface UseFretboardReturn {
  // State
  selectedDots: SelectedDotsMap;
  stringCount: StringCount;
  tiltAngle: number;
  frets: number[];

  // Exercise integration
  exerciseData: {
    selectedExercise: Exercise | null;
    exerciseNotes: ExerciseNote[];
    hasExercise: boolean;
  };

  // Audio integration
  exercise: {
    audioIntegration: {
      isAudioEnabled: boolean;
      audioError: string | null;
      playbackPosition: number;
    };
    triggerNote: (stringIndex: number, fret: Fret) => void;
  };

  // State management
  state: {
    setSelectedDots: (dots: SelectedDotsMap) => void;
    setSelectionOrder: (order: number) => void;
    handleStringCountChange: (count: StringCount) => void;
    hasDotsOnHiddenStrings: (
      currentCount: StringCount,
      newCount: StringCount,
      dots: SelectedDotsMap,
    ) => boolean;
  };

  // Utility functions
  checkHasSelectedDots: () => boolean;
  checkGetDotOrder: (stringIndex: number, fret: Fret) => number[];
  isExerciseNote: (stringIndex: number, fret: Fret) => boolean;
  isCurrentNote: (stringIndex: number, fret: Fret) => boolean;
}
```

---

_This document reflects the current state management system as of the latest implementation. For questions or clarifications, refer to the actual source code or contact the development team._
