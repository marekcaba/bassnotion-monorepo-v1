# Timing System Visual Diagrams

## 1. Data Flow Architecture

```
                          ┌─────────────────────┐
                          │   USER: Play()      │
                          └──────────┬──────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │  PlaybackEngine / UnifiedTransport│
                    │  (Start audio playback)           │
                    └────────────────┬──────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │  Transport.start()                │
                    │  (Initialize Clock, set start time)
                    └────────────────┬──────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
   ┌────────────┐          ┌──────────────────┐        ┌──────────────┐
   │ Tone.js    │          │ AudioWorklet or  │        │ RAF Loop     │
   │ Transport  │          │ Web Worker       │        │ Polling      │
   │ (tempo)    │          │ (precise timing) │        │ (fallback)   │
   └────┬───────┘          └────────┬─────────┘        └─────┬────────┘
        │                          │                         │
        │  currentTime             │ tick events             │ elapsed
        │  (audioContext)          │                         │
        └────────────────┬─────────┴──────────┬──────────────┘
                         │                     │
                 ┌───────▼────────────────────▼────────┐
                 │  Transport.getDisplayPosition()     │
                 │  Converts elapsed → bars:beats:16ths│
                 │  Applies countdown offset (display) │
                 └───────┬──────────────────────────────┘
                         │
                         │ position: TransportPosition
                         │ { bars, beats, sixteenths, ticks, seconds }
                         │
              ┌──────────▼─────────────┐
              │  EventBus.emit()       │
              │  'transport:position'  │
              │  Event (60Hz throttled)│
              └──────────┬─────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   ┌──────────────┐ ┌────────────┐ ┌──────────────┐
   │TransportCtx  │ │FretboardCtx│ │MetronomeCtx  │
   │React State   │ │React State │ │React State   │
   │setPosition() │ │setPosition │ │setPosition   │
   └──────┬───────┘ └────┬───────┘ └──────┬───────┘
          │              │                 │
          │              ▼                 │
          │         ┌─────────────────┐   │
          │         │useMeasureOpacity│   │
          │         │Calculate opacity│   │
          │         │by measure index │   │
          │         └────────┬────────┘   │
          │                  │            │
          │              getMeasureOpacity │
          │              getMeasureHighlight
          │                  │            │
          ▼                  ▼            ▼
   ┌──────────────────────────────────────────┐
   │  FretboardGrid Component                 │
   │  Passes opacity/highlight to each dot    │
   └──────────┬───────────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────────┐
   │  FretboardDot (x100+ instances)          │
   │  - Apply isCurrentNote styling (orange)  │
   │  - Apply measure opacity (fade in/out)   │
   │  - Render yellow ring with pulse effect  │
   └──────────────────────────────────────────┘
```

---

## 2. Time & Position Format Conversions

```
Transport Timeline
─────────────────────────────────────────────────────────────────

audioContext.currentTime = 2456.123 seconds (elapsed since audio start)
                           │
                           ▼ Transport.getDisplayPosition()

elapsed = currentTime - transportStartTime = 2456.123 - 100.0 = 2356.123s
                           │
                           ▼ MusicalPositionManager.secondsToPosition()

At 120 BPM, 4/4 time:
- Beat duration: 0.5s (60s / 120 BPM)
- Bar duration: 2s (4 beats × 0.5s)

Total sixteenths = 2356.123s × (120/60 BPM) × 4 sixteenths = 18848.98 sixteenths
                   └─ seconds ─┘ └─ sixteenths per second ─┘

bars = floor(18848.98 / 16) = 1178 (0-based internal)
remaining sixteenths = 18848.98 % 16 = 8
beats = floor(8 / 4) = 2
sixteenths = 8 % 4 = 0

Internal position: { bars: 1178, beats: 2, sixteenths: 0 }
                           │
                           ▼ Convert to 1-based for display

Display position: { bars: 1179, beats: 3, sixteenths: 0 }
                   └─ matches DAW convention (starts at 1:1:0) ─┘

                           │
                           ▼ MusicalTimeConverter (for measure calculation)

Measure (1-based) = floor((bars × 4 + beats - 1) / timeSignature.numerator) + 1
                  = floor((1178 × 4 + 3 - 1) / 4) + 1
                  = floor(4714.5) + 1
                  = 4715

Beat within measure (1-based) = ((bars × 4 + beats - 1) % timeSignature.numerator) + 1
                              = ((1178 × 4 + 3 - 1) % 4) + 1
                              = (4714 % 4) + 1
                              = 2 + 1
                              = 3

currentPosition = { measure: 4715, beat: 3, subdivision: 0 }
                   └─ Measure 4715, Beat 3 of 4 ─┘
```

---

## 3. Measure-Based Opacity Calculation

```
From FretboardCard (useMeasureOpacity hook):

Input: exerciseNotes = [
  { string: 1, fret: 5, position: { measure: 0, beat: 0, ... } },
  { string: 1, fret: 3, position: { measure: 1, beat: 1, ... } },
  { string: 2, fret: 7, position: { measure: 2, beat: 2, ... } },
  ...
]

Current Time (ms): 2356123
Tempo: 120 BPM
Time Signature: 4/4

Step 1: Convert time to MusicalPosition
─────────────────────────────────────────
effectiveTime = 2356123ms ÷ 1000 = 2356.123s
MusicalTimeConverter.msToPosition(2356123, { tempo: 120, timeSignature: 4/4 })
→ { measure: 4715, beat: 3, subdivision: 0 }

Step 2: Calculate effective measure
────────────────────────────────────
currentPosition.beat = 3
transitionBeat = 5  (don't transition yet in 4/4 time)
isInTransition = (3 >= 5) = false
effectiveMeasure = currentPosition.measure = 4715 (1-based)

Step 3: Convert to 0-based for comparison with note data
──────────────────────────────────────────────────────────
currentMeasure0Based = effectiveMeasure - 1 = 4714
nextMeasure0Based = currentMeasure0Based + 1 = 4715

Step 4: Get opacity for each note position
────────────────────────────────────────────
For note at { string: 1, fret: 5, position.measure: 0 }:
  note.position.measure = 0 (0-based)
  Compare: Is 0 == 4714? No. Is 0 == 4715? No.
  → Opacity = otherMeasures = 0 (HIDDEN)
  → State = 'other' (grey, not highlighted)

For note at { string: 1, fret: 3, position.measure: 1 }:
  note.position.measure = 1 (0-based)
  Compare: Is 1 == 4714? No. Is 1 == 4715? No.
  → Opacity = otherMeasures = 0 (HIDDEN)
  → State = 'other' (grey, not highlighted)

For note at { string: 1, fret: 5, position.measure: 4714 }:
  note.position.measure = 4714 (0-based, matching current)
  Compare: Is 4714 == 4714? YES!
  → Opacity = currentMeasure = 1.0 (FULL OPACITY)
  → State = 'current' (green highlight, YELLOW RING)
  → isCurrentNote = true
  → CSS class: 'bg-orange-500 animate-pulse ring-2 ring-orange-300'

For note at { string: 2, fret: 7, position.measure: 4715 }:
  note.position.measure = 4715 (0-based, matching next)
  Compare: Is 4715 == 4714? No. Is 4715 == 4715? YES!
  → Opacity = nextMeasure = 0.3 (DIMMED PREVIEW)
  → State = 'next' (green highlight at 30% opacity)

Step 5: Return functions to FretboardGrid
───────────────────────────────────────────
getMeasureOpacity(1, 5) = 1.0  (current measure note - FULL)
getMeasureOpacity(1, 3) = 0    (past note - HIDDEN)
getMeasureOpacity(2, 7) = 0.3  (next measure note - PREVIEW)

getMeasureHighlight(1, 5) = { shouldHighlight: true, state: 'current', opacity: 1.0 }
getMeasureHighlight(2, 7) = { shouldHighlight: true, state: 'next', opacity: 0.3 }
```

---

## 4. Position Update Timing (60Hz)

```
Time (ms)  | Audio Time | Transport Time | Display Pos | Measure | Beat | Event
──────────────────────────────────────────────────────────────────────────────
0          | 100.000s   | 0.000s         | 1:1:0       | 1       | 1    | START
17         | 100.017s   | 0.017s         | 1:1:0       | 1       | 1    |
33         | 100.033s   | 0.033s         | 1:1:0       | 1       | 1    |
...
500        | 100.500s   | 0.500s         | 1:2:0       | 1       | 2    | BEAT UPDATE
501        | 100.501s   | 0.501s         | 1:2:0       | 1       | 2    |
...
1000       | 101.000s   | 1.000s         | 1:3:0       | 1       | 3    | BEAT UPDATE
...
1500       | 101.500s   | 1.500s         | 1:4:0       | 1       | 4    | BEAT UPDATE
...
2000       | 102.000s   | 2.000s         | 2:1:0       | 2       | 1    | MEASURE UPDATE
                                                       └─ Measure changes ─┘
```

**Position Update Frequency**:
- EventBus throttles position updates to 60Hz
- Actual audio timing from AudioContext is continuous
- UI updates happen at 60Hz (≈16.67ms intervals)
- At 120 BPM, each beat lasts 500ms = 30 position updates per beat

**Effective Rendering**:
- FretboardDot opacity animates via CSS transition (250ms default)
- Smooth fade in/out when notes transition between measures
- No "jumpy" highlighting because transition is gradual

---

## 5. Countdown Display Timeline

```
Countdown: 4 beats before exercise starts
Tempo: 120 BPM (0.5s per beat)

Time(s) | Raw Internal Pos | Display Pos | What Shows        | What Plays
────────────────────────────────────────────────────────────────────────
-2.0    | 0:0:0            | -1:4:0      | Countdown -1:4    | Click 1
-1.5    | 0:1:0            | -1:1:0      | Countdown -1:1    | Click 2
-1.0    | 0:2:0            | -1:2:0      | Countdown -1:2    | Click 3
-0.5    | 0:3:0            | -1:3:0      | Countdown -1:3    | Click 4
0.0     | 0:4:0 (rounded)  | 1:1:0       | Exercise 1:1      | ▶️ STARTS!
        │                 │             │                   │
        │ (countdown ends)│(display change)                  │
        │                 │             │
0.5     | 1:0:0            | 1:2:0       | Exercise 1:2      |
1.0     | 1:1:0            | 1:3:0       | Exercise 1:3      |
1.5     | 1:2:0            | 1:4:0       | Exercise 1:4      |
2.0     | 1:3:0            | 2:1:0       | Exercise 2:1      |

During Countdown (-2s to 0s):
  Display position: -1:4:0, -1:1:0, -1:2:0, -1:3:0 (beats count DOWN)
  Why? Because beats are calculated with:
    adjustedBeats = totalBeats - countdownBeats
    adjustedBeats < 0 → bar = -1, beats = ceil(abs(adjustedBeats))

  At -1.5s:
    totalBeats = 1 beat (0:1:0 in raw format)
    countdownBeats = 4 beats
    adjustedBeats = 1 - 4 = -3
    abs(-3) = 3 → ceil(3.0) = 3
    Display: -1:3:0 ✓

After Countdown (0s+):
  Display position: 1:1:0, 1:2:0, 1:3:0, 1:4:0, 2:1:0...
  Countdown offset no longer applied
  Normal 1-based display continues
```

**Key Insight**: The countdown uses NEGATIVE measure numbers to "stack" pre-roll before the exercise begins. Users never see measure 0 - they see -1, then jump to 1.

---

## 6. State Update Waterfall

```
EventBus: 'transport:position-updated' fired
                │
                ▼
TransportContext.handlePositionUpdate()
                │
        ┌───────▼───────┐
        │               │
        ▼               ▼
    setPosition()   LOG JITTER
    (React state)   DETECTION
        │
        ▼
TransportContext re-renders (position changed)
        │
        ├─────────────────────────────────────────────────┐
        │                                                 │
        ▼                                                 ▼
    FretboardCard                                OtherWidgets
    re-renders                                   (MetronomeWidget)
        │                                               │
        ├─ useTransportContext().position               │
        │  (now has new time value)                      │
        │                                               │
        ▼                                               ▼
    useMeasureOpacity()                         useTransportContext()
        │                                               │
        ├─ Convert currentTime to measure              │
        │  MusicalTimeConverter.msToPosition()         │
        │                                               │
        ├─ Compare with exercise note measures         │
        │                                               │
        ▼                                               ▼
    getMeasureOpacity(string, fret)           Use new position
    getMeasureHighlight(string, fret)         to sync audio/widgets
        │                                               │
        ▼                                               ▼
    FretboardGrid
    re-renders with new opacity/highlight values
        │
        ├─────────┬─────────┬─────────┬─────────┐
        │         │         │         │         │
        ▼         ▼         ▼         ▼         ▼
    Dot@1,5   Dot@1,3   Dot@2,7   Dot@2,5   Dot@3,12
    opacity:1 opacity:0 opacity:0.3 opacity:1 opacity:0
    yellow    hidden    preview    yellow    hidden
    ring      grey      green      ring      grey
    animate   (fade)    (fade in)   animate   (fade)
    pulse     out               pulse
```

**Re-render Optimization**:
- Position updates at 60Hz
- React batches updates (one render per animation frame)
- FretboardGrid memoized to prevent unnecessary renders
- Each FretboardDot's CSS transition handles the fade (not React re-renders)

---

## 7. Yellow Ring Styling Path

```
isCurrentNote = true
                │
                ▼
FretboardDot getDotClassName()
                │
        ┌───────▼───────────────────────────────┐
        │                                       │
        ▼                                       ▼
    CSS Classes Applied               Inline Styles Applied
    ─────────────────────────────────────────────────────────
    bg-orange-500                    opacity: 1.0
    text-white                       transition: background-color 0.15s,
    animate-pulse                                opacity 250ms
    shadow-lg                        zIndex: 20
    ring-2                           left: x - 13
    ring-orange-300                  top: y - 13
                                     width: 26px
                                     height: 26px
        │                                       │
        ▼                                       ▼
    ┌─────────────────────────────────────────┐
    │  Final Rendered Dot                      │
    │  ┌─────────────────────────────────┐    │
    │  │                                 │    │
    │  │      ┌─────────┐                │    │
    │  │      │         │                │    │
    │  │      │  ◯       │  ← Orange dot │    │
    │  │      │         │     with pulse│    │
    │  │      └─────────┘                │    │
    │  │                                 │    │
    │  │    ━━━━━━━━━━━━━━━━━━━━━━━━     │    │
    │  │    Yellow ring outline (2px)    │    │
    │  │    ━━━━━━━━━━━━━━━━━━━━━━━━     │    │
    │  │                                 │    │
    │  └─────────────────────────────────┘    │
    │                                          │
    │  pulsing every 2s (animate-pulse)        │
    └──────────────────────────────────────────┘
```

---

## 8. Connection Between Components

```
┌──────────────────────────────────────────────────────────────────────┐
│                        TransportProvider                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  State:                                                        │  │
│  │  - position: TransportPosition                                │  │
│  │  - tempo, timeSignature, isPlaying                            │  │
│  │                                                               │  │
│  │  Subscriptions:                                               │  │
│  │  - EventBus: 'transport:position-updated' (60Hz)            │  │
│  │  - EventBus: 'transport:tempo-change'                       │  │
│  │  - EventBus: 'transport:start/stop/pause/resume'            │  │
│  └────────────────────┬───────────────────────────────────────────┘  │
│                       │                                               │
│   ┌───────────────────┴────────────────────────┐                      │
│   │                                            │                      │
│   ▼                                            ▼                      │
│ ┌─────────────────────────┐      ┌──────────────────────────────────┐│
│ │ useTransportContext()    │      │ useTransportControls()           ││
│ │ All state + position     │      │ Controls only (no position)      ││
│ │ 60Hz re-renders          │      │ Stable context (no re-renders)   ││
│ └────────┬────────────────┘      └──────────────────────────────────┘│
│          │                                                            │
│          ▼                                                            │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │  FretboardCard                                                  │  │
│ │  ┌──────────────────────────────────────────────────────────┐  │  │
│ │  │ useFretboard()                                           │  │  │
│ │  │ - useFretboardState()                                    │  │  │
│ │  │ - useFretboardConnections()                              │  │  │
│ │  │ - useFretboardExercise()                                 │  │  │
│ │  │ - handleDotClick with audio                              │  │  │
│ │  └──────────────────────┬───────────────────────────────────┘  │  │
│ │                         │                                       │  │
│ │                         ▼                                       │  │
│ │  ┌──────────────────────────────────────────────────────────┐  │  │
│ │  │ useMeasureOpacity()                                      │  │  │
│ │  │ - Input: exerciseNotes, currentTime, tempo              │  │  │
│ │  │ - Output:                                                │  │  │
│ │  │   getMeasureOpacity(string, fret) → 0-1                 │  │  │
│ │  │   getMeasureHighlight(string, fret) → state + opacity   │  │  │
│ │  └──────────────────────┬───────────────────────────────────┘  │  │
│ │                         │                                       │  │
│ │                         ▼                                       │  │
│ │  ┌──────────────────────────────────────────────────────────┐  │  │
│ │  │ <FretboardGrid>                                          │  │  │
│ │  │ - Receives getMeasureOpacity callback                    │  │  │
│ │  │ - Receives getMeasureHighlight callback                 │  │  │
│ │  │ - Iterates exercise notes and renders dots              │  │  │
│ │  └──────────────────────┬───────────────────────────────────┘  │  │
│ │                         │                                       │  │
│ │           ┌─────────────┼─────────────┬─────────────┐            │  │
│ │           │             │             │             │            │  │
│ │           ▼             ▼             ▼             ▼            │  │
│ │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐   │  │
│ │  │ FretboardDot │ │ FretboardDot │ │ FretboardDot │ │ ...    │   │  │
│ │  │ string: 0    │ │ string: 1    │ │ string: 2    │ │        │   │  │
│ │  │ fret: 3      │ │ fret: 5      │ │ fret: 7      │ │        │   │  │
│ │  │ opacity: 0   │ │ opacity: 1.0 │ │ opacity: 0.3 │ │        │   │  │
│ │  │ HIDDEN       │ │ YELLOW RING  │ │ PREVIEW      │ │        │   │  │
│ │  └──────────────┘ └──────────────┘ └──────────────┘ └────────┘   │  │
│ │                         │                                       │  │
│ │                         ▼ (render)                              │  │
│ │  ┌──────────────────────────────────────────────────────────┐  │  │
│ │  │  Fretboard SVG/Canvas                                   │  │  │
│ │  │  With:                                                   │  │  │
│ │  │  - Strings and frets                                     │  │  │
│ │  │  - Dots with opacities applied                           │  │  │
│ │  │  - Connection lines (with measure-aware colors)          │  │  │
│ │  │  - Yellow pulsing ring on current note                   │  │  │
│ │  └──────────────────────────────────────────────────────────┘  │  │
│ └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Summary

The timing system connects through:

1. **Transport** (Tone.js) → Audio timing source
2. **EventBus** (60Hz) → Position updates
3. **TransportContext** → React state management
4. **useMeasureOpacity** → Time to measure conversion
5. **FretboardGrid** → Visual rendering
6. **FretboardDot** → Individual note styling with yellow ring

Each layer has a single responsibility and they communicate through clean interfaces.
