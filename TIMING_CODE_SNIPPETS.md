# Timing System - Code Snippets & Quick Reference

## Quick Lookup: Position Data Types

### TransportPosition (Display Format)
```typescript
// File: /apps/frontend/src/domains/playback/contexts/TransportContext.tsx
interface TransportPosition {
  bars: number;       // 1-based (1, 2, 3, ...)
  beats: number;      // 1-based (1, 2, 3, 4 in 4/4 time)
  sixteenths: number; // 0-based (0, 1, 2, 3)
  ticks: number;      // Sub-sixteenth resolution
  seconds: number;    // Playback time in milliseconds
}

// Example: Display position 2:3:2 = Measure 2, Beat 3, 2nd sixteenth
const pos = { bars: 2, beats: 3, sixteenths: 2, ticks: 0, seconds: 1500 };
```

### MusicalPosition (Measure-based)
```typescript
// File: @bassnotion/contracts/types/musical-time.ts
interface MusicalPosition {
  measure: number;    // 1-based (1, 2, 3, ...) from MusicalTimeConverter
  beat: number;       // 1-based (1, 2, 3, 4 in 4/4 time)
  subdivision: number; // 0-based subdivision within beat
}

// Example: Measure 5, Beat 2, Subdivision 0
const pos = { measure: 5, beat: 2, subdivision: 0 };
```

### ExerciseNote Position (0-based Internal)
```typescript
// File: @bassnotion/contracts/types/exercise.ts
interface ExerciseNote {
  string: number;     // 1-based (1, 2, 3, 4, 5)
  fret: number;       // 0=open, 1-24 for fret positions
  timestamp?: number; // Milliseconds (legacy, being phased out)
  position?: {        // NEW: Musical position with 0-based measures
    measure: number;  // 0-based (0, 1, 2, ...) ← CAREFUL: Different from display!
    beat: number;     // 1-based (1, 2, 3, 4)
    subdivision: number;
  };
}

// Example: First note in exercise at measure 0 (first bar), beat 1
const note = { string: 1, fret: 5, position: { measure: 0, beat: 1, subdivision: 0 } };
```

---

## Quick Lookup: Key Functions

### Get Current Playback Position

```typescript
// FROM REACT COMPONENT
import { useTransportContext } from '@/domains/playback/contexts/TransportContext';

function MyComponent() {
  const transport = useTransportContext();

  // Current position (display format: 1-based)
  console.log(`Playing: ${transport.position.bars}:${transport.position.beats}`);

  // Current playback time in milliseconds
  console.log(`Time: ${transport.position.seconds}ms`);

  // Playback state
  console.log(`Playing: ${transport.isPlaying}`);
}
```

### Convert Time to Musical Position

```typescript
// FROM MusicalTimeConverter (for measure-based calculations)
import { MusicalTimeConverter } from '@bassnotion/contracts';

// Time in milliseconds → Musical position (1-based measures)
const timeMs = 2000; // 2 seconds
const pos = MusicalTimeConverter.msToPosition(timeMs, {
  tempo: 120,
  timeSignature: { numerator: 4, denominator: 4 }
});

console.log(`Measure: ${pos.measure}, Beat: ${pos.beat}`);
// Output: Measure: 1, Beat: 3
```

### Calculate Note Opacity During Playback

```typescript
// FROM FRETBOARD CARD
import { useMeasureOpacity } from '...FretboardCard/hooks/useMeasureOpacity';

function FretboardCard({ exercise, currentTime, isPlaying, tempo }) {
  const { getNoteOpacity, getMeasureHighlight, currentMeasure } = useMeasureOpacity({
    exerciseNotes: exercise.notes,
    currentTime,    // Current playback time in milliseconds
    isPlaying,
    tempo,
    stringCount: 4,
  });

  // For each note in exercise
  exercise.notes.forEach(note => {
    const stringIndex = convertStringToIndex(note.string);
    const fret = note.fret === 0 ? 'open' : note.fret;

    // Get opacity (0 = hidden, 1 = full visible)
    const opacity = getNoteOpacity(stringIndex, fret);

    // Get highlight state (green vs grey)
    const highlight = getMeasureHighlight(stringIndex, fret);
    // Returns: { shouldHighlight: bool, state: 'current'|'next'|'other', opacity: 0-1 }

    // Render the dot
    renderDot({
      opacity,
      isCurrentNote: highlight.state === 'current',
      shouldHighlight: highlight.shouldHighlight,
    });
  });
}
```

### Subscribe to Position Updates Directly

```typescript
// FOR AUDIO COMPONENTS (bypassing React for low-latency)
import { useTransportPosition } from '@/domains/playback/hooks/useTransportPosition';

function AudioComponent() {
  useTransportPosition({
    onPositionUpdate: (position) => {
      // Called when position updates (60Hz)
      console.log(`Position: ${position.bars}:${position.beats}`);

      // Use this for audio synchronization with <50ms latency
      updateAudioIfNeeded(position);
    },
    enabled: true, // Can disable when not needed
  });
}
```

---

## Quick Lookup: Event Types

### EventBus Position Update Event

```typescript
// EMITTED BY: Transport.getDisplayPosition() → EventBus.emit()
// FREQUENCY: 60Hz (throttled)
// SUBSCRIBED BY: TransportContext, audio components

eventBus.on('transport:position-updated', (data) => {
  console.log(data);
  // Output:
  // {
  //   position: {
  //     bars: 2,
  //     beats: 3,
  //     sixteenths: 1,
  //     ticks: 120,
  //     seconds: 1500
  //   },
  //   seconds: 1500,
  //   timestamp: 1702345678901  // Optional: performance.now()
  // }
});
```

### EventBus Tempo Change Event

```typescript
eventBus.on('transport:tempo-change', (data) => {
  console.log(`Tempo changed to ${data.tempo} BPM`);
  // Use this to recalculate measure durations
});
```

### EventBus Transport State Events

```typescript
// Fires when playback state changes
eventBus.on('transport:start', () => { /* ... */ });
eventBus.on('transport:stop', () => { /* ... */ });
eventBus.on('transport:pause', () => { /* ... */ });
eventBus.on('transport:resume', () => { /* ... */ });

// Special: Fires BEFORE transport:start, useful for resetting UI
eventBus.on('playback:starting', (data) => {
  console.log(`About to start, position will reset to: ${data.position}`);
});
```

---

## Debugging Tips

### Enable Detailed Logging

```typescript
// In browser console
window.__DEBUG_FRETBOARD__ = true;

// Then in useMeasureOpacity, you'll see logs like:
// [OPACITY-TIME-DEBUG] effectiveTime=1500ms, tempo=120, isPlaybackEffective=true
// [MEASURE-DEBUG] positionKey=1,5, currentMeasure0Based=0, nextMeasure0Based=1
```

### Monitor Position Updates

```typescript
// Browser console
const eventBus = window.EventBus || window.___eventBus;
eventBus.on('transport:position-updated', (data) => {
  console.table({
    time_ms: data.seconds,
    bars: data.position.bars,
    beats: data.position.beats,
    sixteenths: data.position.sixteenths,
  });
});

// Or subscribe to multiple events
['transport:start', 'transport:position-updated', 'transport:stop'].forEach(ev => {
  eventBus.on(ev, (data) => {
    console.log(`[${ev}]`, data);
  });
});
```

### Check Current Measure Calculation

```typescript
// Browser console - manually calculate what measure we're in
function debugCurrentMeasure() {
  const context = window.useTransportContext?.();
  const timeMs = context?.position?.seconds;
  const pos = window.MusicalTimeConverter?.msToPosition(timeMs, {
    tempo: 120,
    timeSignature: { numerator: 4, denominator: 4 }
  });

  console.log(`Time: ${timeMs}ms → Measure: ${pos.measure}, Beat: ${pos.beat}`);
}

// Call it repeatedly
setInterval(debugCurrentMeasure, 1000);
```

### Verify Note Opacity Calculation

```typescript
// Inside FretboardCard, add temporary logging
function FretboardCard() {
  const { getNoteOpacity, getMeasureHighlight, currentMeasure } = useMeasureOpacity({...});

  // Add this in a useEffect
  useEffect(() => {
    exercise.notes.forEach(note => {
      const opacity = getNoteOpacity(note.string - 1, note.fret === 0 ? 'open' : note.fret);
      const highlight = getMeasureHighlight(note.string - 1, note.fret === 0 ? 'open' : note.fret);

      console.log(`Note: string=${note.string}, fret=${note.fret}, measure=${note.position?.measure}`, {
        opacity,
        highlight,
        currentMeasure,
      });
    });
  }, [currentMeasure]); // Runs when measure changes
}
```

---

## Common Tasks

### Task: Highlight the Next Note Coming Up

```typescript
// In FretboardCard, find which note plays after current position
function getNextNoteToPLay(
  exerciseNotes: ExerciseNote[],
  currentMeasure: number,  // From useMeasureOpacity
  currentBeat: number      // From useMeasureOpacity
): ExerciseNote | null {
  // Find first note that comes after current playback position
  // Sort by measure, then beat
  const sortedNotes = [...exerciseNotes].sort((a, b) => {
    const aMeasure = a.position?.measure ?? 0;
    const aBeats = a.position?.beat ?? 0;
    const bMeasure = b.position?.measure ?? 0;
    const bBeats = b.position?.beat ?? 0;

    if (aMeasure !== bMeasure) return aMeasure - bMeasure;
    return aBeats - bBeats;
  });

  // Find first note after current position
  for (const note of sortedNotes) {
    const noteMeasure = note.position?.measure ?? 0;
    const noteBeat = note.position?.beat ?? 1;

    // Convert to 1-based for comparison with currentMeasure (1-based)
    const noteMeasure1Based = noteMeasure + 1;

    if (noteMeasure1Based > currentMeasure ||
        (noteMeasure1Based === currentMeasure && noteBeat > currentBeat)) {
      return note;
    }
  }

  return null;
}

// Usage
const nextNote = getNextNoteToPLay(exercise.notes, currentMeasure, currentBeat);
if (nextNote) {
  console.log(`Next note: string ${nextNote.string}, fret ${nextNote.fret}`);
}
```

### Task: Find All Notes in Current Measure

```typescript
function getNotesInMeasure(
  exerciseNotes: ExerciseNote[],
  measureNumber: number  // 1-based
): ExerciseNote[] {
  const measure0Based = measureNumber - 1;
  return exerciseNotes.filter(
    note => (note.position?.measure ?? 0) === measure0Based
  );
}

// Usage
const currentNotes = getNotesInMeasure(exercise.notes, currentMeasure);
console.log(`${currentNotes.length} notes in this measure`);
```

### Task: Detect Measure Boundary Crossing

```typescript
function useOnMeasureChange(
  currentMeasure: number,
  callback: (newMeasure: number) => void
) {
  const prevMeasureRef = useRef(currentMeasure);

  useEffect(() => {
    if (currentMeasure !== prevMeasureRef.current) {
      callback(currentMeasure);
      prevMeasureRef.current = currentMeasure;
    }
  }, [currentMeasure, callback]);
}

// Usage
useOnMeasureChange(currentMeasure, (newMeasure) => {
  console.log(`Moved to measure ${newMeasure}`);
  // Play sound, update UI, etc.
});
```

---

## Position Format Conversion Reference

```
INPUT FORMATS:
──────────────

1. EventBus Event Data:
   { position: { bars, beats, sixteenths, ticks, seconds }, ... }
   Format: 1-based bars/beats (display format)

2. MusicalTimeConverter Output:
   { measure, beat, subdivision }
   Format: 1-based measures (from time)

3. ExerciseNote.position:
   { measure, beat, subdivision }
   Format: 0-based measures (internal storage!)

4. MusicalPositionManager Internal:
   { bars, beats, sixteenths, ticks }
   Format: 0-based bars/beats (raw/internal)


CONVERSION STEPS:
─────────────────

Time (ms)
  │
  ├─→ MusicalPositionManager.secondsToPosition()
  │   └─→ 0-based: bars:beats:sixteenths
  │       │
  │       ├─→ Add 1 to bars/beats for 1-based display
  │       └─→ EventBus: 'transport:position-updated' (1-based)
  │
  └─→ MusicalTimeConverter.msToPosition()
      └─→ 1-based: measure:beat:subdivision
          └─→ useMeasureOpacity: Compare with ExerciseNote.position


FORMAT MAPPING:
───────────────

                Display Position    |  Musical Position  |  Note Position
                (1-based)           |  (1-based)         |  (0-based)
────────────────────────────────────────────────────────────────────────
Time: 0ms       bars=1, beats=1     |  measure=1, beat=1 |  measure=0, beat=1
Time: 500ms     bars=1, beats=2     |  measure=1, beat=2 |  measure=0, beat=2
Time: 2000ms    bars=2, beats=1     |  measure=2, beat=1 |  measure=1, beat=1

Comparison:
  displayBars=2, beats=1 (display format)
  ↓ Convert to internal: bars=1, beats=0 (internal format)
  ↓ Convert to 0-based: measure=0 (for note comparison)
  ↓ Compare with note.position.measure=0
  ↓ Match! Note is in current measure.
```

---

## Performance Notes

### Position Update Frequency

```
Real-time timeline:
────────────────────

Audio Timeline    Position Updates
─────────────────────────────────
0ms       │       │ (update #1)
17ms      │       │
33ms      │       │
50ms      │       │
67ms      │ ──────┤ (update #2)
83ms      │       │
...
500ms     │ BEAT  │ ── (update #30)
501ms     │       │
...
1000ms    │ BEAT  │ ── (update #60)

Frequency: 60Hz = 1 update every ~16.67ms
Per beat: 500ms / 16.67ms = ~30 updates per beat (at 120 BPM)
```

### React Re-render Optimization

```
FretboardCard re-renders 60 times per second during playback.
But each dot's opacity change is handled by CSS transition, not React!

Structure:
──────────

TransportContext (position state)
  ↓ Re-renders 60Hz
FretboardCard
  ↓ Calls useMeasureOpacity (fast calculation)
FretboardGrid
  ↓ Passes callbacks to dots (not values!)
FretboardDot (memo'd)
  ↓ NO re-render if props unchanged
  ✓ CSS handles opacity transition smoothly

Result: 60Hz position updates, smooth visual transitions,
        no janky React re-renders.
```

---

## Testing Notes

### Unit Test: Position Conversion

```typescript
import { MusicalTimeConverter } from '@bassnotion/contracts';

describe('Position Conversion', () => {
  it('should convert milliseconds to musical position', () => {
    const result = MusicalTimeConverter.msToPosition(2000, {
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 }
    });

    expect(result.measure).toBe(1); // First measure (1-based)
    expect(result.beat).toBe(3);    // Third beat
  });
});
```

### Integration Test: Opacity Calculation

```typescript
import { renderHook } from '@testing-library/react';
import { useMeasureOpacity } from '...useMeasureOpacity';

it('should show current measure notes at full opacity', () => {
  const { result } = renderHook(() =>
    useMeasureOpacity({
      exerciseNotes: [
        { string: 1, fret: 5, position: { measure: 0, beat: 1, subdivision: 0 } }
      ],
      currentTime: 0,      // At start of exercise (measure 1)
      isPlaying: true,
      tempo: 120,
      stringCount: 4,
    })
  );

  const opacity = result.current.getNoteOpacity(0, 5);
  expect(opacity).toBe(1.0); // Full visibility for current measure
});
```

