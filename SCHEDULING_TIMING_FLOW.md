# Audio Scheduling Timing Flow & Frame Calculations

## Event Scheduling Timeline

```
PLAYBACK TIMELINE (in seconds)
├─ t=1.85s  ← Scheduler checks: "What events in [1.85 - 2.0s]?"
│
├─ t=2.0s   ← EVENT PLAYS: harmony note, bass note, metronome click
│           (All scheduled 150ms earlier at t=1.85s)
│
├─ t=2.02s  ← Scheduler checks: "What events in [2.02 - 2.17s]?"
│
├─ t=2.15s  ← Scheduler checks: "What events in [2.15 - 2.30s]?"
│
└─ t=2.2s   ← EVENT PLAYS: next harmony note
            (Scheduled at t=2.05s)


LOOK-AHEAD WINDOW: 150ms
└─ scheduleUntil = currentTime + 0.15
└─ Only events in this window are scheduled each cycle
└─ Prevents overwhelming the scheduler with too many events
```

---

## Frame-Based Timing (48kHz Audio Sample Rate)

### Frame Calculations

```
Audio Sample Rate: 48,000 Hz
Frame Duration: 1/48000 = 20.83 microseconds
Frame Count: audio_seconds * 48000

EXAMPLE CONVERSIONS:
├─ 0.5 seconds    = 0.5 * 48000 = 24,000 frames
├─ 1.0 second     = 1.0 * 48000 = 48,000 frames
├─ 2.0 seconds    = 2.0 * 48000 = 96,000 frames
└─ 2.15 seconds   = 2.15 * 48000 = 103,200 frames

LOOK-AHEAD IN FRAMES:
├─ 150ms = 0.15 seconds = 0.15 * 48000 = 7,200 frames
├─ 20ms  = 0.02 seconds = 0.02 * 48000 = 960 frames
└─ 1ms   = 0.001 seconds = 0.001 * 48000 = 48 frames
```

### targetFrame vs scheduleFrame

```
SCHEDULING EVENT AT t=2.0s:

At scheduling time (t=1.85s):
├─ currentAudioTime = 1.85s
├─ scheduleFrame = 1.85 * 48000 = 88,800 frames
│
└─ Event to schedule:
   ├─ scheduledAudioTime = 2.0s
   ├─ targetFrame = 2.0 * 48000 = 96,000 frames
   │
   └─ Look-ahead distance:
      ├─ Frames: 96,000 - 88,800 = 7,200 frames
      ├─ Milliseconds: 7,200 / 48 = 150ms ✓
      └─ Formula: (targetFrame - scheduleFrame) / 48 = lookaheadMs


ANOTHER EXAMPLE AT t=2.2s:

At scheduling time (t=2.05s):
├─ scheduleFrame = 2.05 * 48000 = 98,400 frames
│
└─ Event at t=2.35s:
   ├─ targetFrame = 2.35 * 48000 = 112,800 frames
   │
   └─ Look-ahead:
      ├─ Frames: 112,800 - 98,400 = 14,400 frames
      ├─ Milliseconds: 14,400 / 48 = 300ms (too far!)
      └─ But scheduler only schedules [98.4 - 98.55s], so not scheduled yet
```

---

## Event Time Calculation (Musical Positions)

### MIDI Tick to Seconds Conversion

```
MIDI TICK CONSTANTS:
├─ Standard: 480 ticks per quarter note
├─ Each tick: 1/480 of a beat

CALCULATION:
1. Parse from MIDI data: ticks = event.data.ticks
2. Convert to beats: beats = ticks / 480
3. Convert to seconds: seconds = beats * (60 / BPM)

EXAMPLE: Harmony note at tick 960, BPM=120
├─ beats = 960 / 480 = 2 beats
├─ seconds = 2 * (60 / 120) = 2 * 0.5 = 1.0 second
├─ frames = 1.0 * 48000 = 48,000 frames
└─ Timestamp: "Beat 2 of measure 1" → t=1.0s


FULL TIME CALCULATION (from RegionScheduler):
────────────────────────────────────────────
const absoluteTime =
  region.startTime        // When region starts (e.g., 0.3s)
  + eventTime             // Event offset within region (e.g., 1.0s)
  + offsetTime             // Countdown offset (e.g., 0.0s)
  + loopOffset             // Repeat iteration (e.g., 0.0s)

Example:
├─ region.startTime = 0.3s (region starts after 300ms)
├─ eventTime = 1.0s (second beat of measure, BPM=120)
├─ offsetTime = 0.0s (no countdown)
├─ loopOffset = 0.0s (first iteration)
└─ TOTAL: 0.3 + 1.0 + 0.0 + 0.0 = 1.3 seconds absolute

THEN: Rounded to 3 decimals
├─ Math.round(1.3 * 1000) / 1000 = 1.3s
└─ Used for batching events at same time
```

---

## Cross-Instrument Timing Measurement

### Diagnostic Data Collection

```
When an event is triggered:

TimingEvent {
  instrument: 'harmony'              // Which instrument
  eventType: 'note-C4'              // What event

  scheduledAudioTime: 2.0            // When it SHOULD play (seconds)
  jsExecutionTime: 1849.2            // When source.start() actually called
                                     // (performance.now(), not audio time!)

  scheduleFrame: 96000               // Frame count at scheduling
  targetFrame: 96000                 // Frame count at playback

  lookaheadMs: 150                   // How far ahead scheduled
  beat: 1                            // Musical position
  measure: 2
}
```

### Beat Grouping & Comparison

```
GROUPING STRATEGY:
├─ Round scheduledAudioTime to 10ms precision for grouping
├─ Group: `${measure}:${Math.round(audioTime * 100)}`
└─ Example: "2:20000" = measure 2, t=2.0s (20000 * 0.0001)

CROSS-INSTRUMENT SYNC ANALYSIS:

Beat 2:1 (audioTime: 2.0s)
├─ 🥇 Drums    (kick)          jsExecution: 1849.2ms, delta: 0.0ms
├─ ✅ Metronome (click)        jsExecution: 1849.3ms, delta: 0.1ms
├─ ✅ Harmony   (C4)           jsExecution: 1849.4ms, delta: 0.2ms
└─ ⚠️ Bass      (root note)    jsExecution: 1850.1ms, delta: 0.9ms

   MAX DELTA: 0.9ms (< 5ms ✓ GOOD)


TIMING INTERPRETATION:
├─ < 1ms   : EXCELLENT - inaudible
├─ < 5ms   : GOOD - barely perceptible  ← BassNotion target
├─ < 20ms  : ACCEPTABLE - may be noticeable
└─ > 20ms  : NEEDS ATTENTION - audible
```

---

## Scheduler Update Cycle

### 20ms Polling Loop

```
POLLING STRATEGY (50Hz):

Time    Action                          Events in window
────────────────────────────────────────────────────────
0.00s → Check [0.00 - 0.15s]           Schedule: t=0.05s, t=0.10s
        Schedule those events

0.02s → Check [0.02 - 0.17s]           Schedule: t=0.15s (new!)

0.04s → Check [0.04 - 0.19s]           Schedule: t=0.17s (new!)

0.06s → Check [0.06 - 0.21s]           No new events

0.08s → Check [0.08 - 0.23s]           Schedule: t=0.20s (new!)


EVENTS SCHEDULED:
├─ At t=0.00s: [t=0.05s event, t=0.10s event]
├─ At t=0.02s: [t=0.15s event]
├─ At t=0.04s: [t=0.17s event]
├─ At t=0.08s: [t=0.20s event]
└─ By t=0.20s: All events up to t=0.35s are already scheduled!

BENEFITS:
├─ No event is scheduled with < 150ms notice
├─ Events arrive in time even with CPU jitter
├─ Tone.js has time to optimize scheduling
└─ No missed deadlines
```

---

## Visual vs Audio Timing (Different Systems)

### Audio Timing (Look-Ahead + Web Audio)

```
AUDIO EVENT SCHEDULING:

1. Event created at t=1.85s
   └─ target: t=2.0s
   └─ lookahead: 150ms ✓

2. Tone.js Transport.schedule(callback, 2.0)
   └─ Stores callback to execute at exactly t=2.0s

3. At t=2.0s (Web Audio API thread)
   └─ Tone.js invokes callback
   └─ Sampler.start(audioContext.currentTime)
   └─ Timing: sample-accurate (20.83µs ≈ 1 sample @ 48kHz)

4. Actual audio output
   └─ 10-50ms hardware latency (not scheduling jitter!)
   └─ Consistent, not a timing error
```

### Visual Timing (Animation Frame Based)

```
VISUAL UPDATE LOOP:

Scheduled at 60fps = 16.67ms per frame

Frame #1 (t=0.0ms)
├─ requestAnimationFrame callback
├─ Read audio time from AudioContext
├─ Render new positions
└─ Next frame in 16.67ms

Frame #2 (t≈16.67ms)
├─ Read audio time again
├─ Calculate elapsed = now - lastTime
├─ Update UI if different
└─ Next frame in 16.67ms


TIMING ACCURACY:
├─ Best case: UI updates match audio to ±8.33ms (half frame)
├─ Typical: ±5-10ms drift
├─ If > ±20ms: Visual lags noticeably behind audio
└─ Target: Drift correction every 1000ms
```

### Why They're Different

```
AUDIO EVENTS:
├─ Scheduled far in advance (150ms)
├─ Executed by Web Audio API (not JS!)
├─ Sample-accurate timing
└─ No jitter from JS garbage collection

VISUAL UPDATES:
├─ Scheduled at frame rate (60fps)
├─ Executed by JS (can jitter)
├─ Depends on GC, CPU load
├─ But "good enough" for UI (±5-20ms acceptable)
└─ Sync strategy: Measure drift, apply correction factor
```

---

## Tempo Change & Beat Tracking

### Accumulating Beats Across Tempo Changes

```
SCENARIO: User changes BPM from 120 → 140 during playback

Before tempo change:
├─ Current time: t=2.5s
├─ BPM: 120
├─ Accumulated beats: 0
└─ Last change: t=0.0s

Tempo change event triggered:
├─ Time since last change: 2.5 - 0.0 = 2.5s
├─ Beats at old tempo: 2.5 * (120/60) = 5 beats
├─ Update: accumulatedBeats = 0 + 5 = 5 beats
│
└─ Reset timing reference:
   ├─ lastTempoChangeTime = 2.5s
   ├─ currentBPM = 140
   └─ accumulatedBeats = 5 (snapshot)

After tempo change (at t=2.6s):
├─ Time since last change: 2.6 - 2.5 = 0.1s
├─ Beats since change: 0.1 * (140/60) = 0.233 beats
├─ Total beats: 5 + 0.233 = 5.233 beats
│
└─ Convert back to "equivalent seconds":
   └─ equivalentSeconds = 5.233 / (140/60) = 2.244s
   └─ This matches position calculation downstream!

RESULT:
├─ No position jumps when tempo changes
├─ Smooth transition from old to new tempo
└─ Visual and audio stay in sync
```

---

## Look-Ahead Safety Margins

### Why 150ms is Professional Standard

```
REACTION TIME ANALYSIS:

Typical event arrival:  "Please play note at t=2.0s"

With different look-ahead times:

50ms look-ahead:
├─ Must schedule by: t=1.95s
├─ Processing time: 50ms
├─ Risk: CPU jitter, JS garbage collection
├─ On slow devices: May miss deadline!

150ms look-ahead:
├─ Must schedule by: t=1.85s
├─ Processing time: 150ms
├─ Risk: Very unlikely to miss deadline
├─ On any device: Reliable scheduling

300ms look-ahead:
├─ Must schedule by: t=1.70s
├─ Processing time: 300ms
├─ Risk: Almost impossible to miss
├─ But: More latency for real-time interaction

BassNotion: 150ms = professional standard
├─ Safe margin for consumer hardware
├─ Not excessive latency (< 5 frames @ 30fps)
└─ Matches DAW practice (Pro Tools, Ableton, etc.)
```

---

## Diagnostic Tool Usage

### Measuring Timing Performance

```javascript
// Enable timing diagnostics
window.__timingDiagnostic.enable();

// Play the exercise (collect data for ~30 seconds)

// Get report
window.__timingDiagnostic.report();

// Expected output:
// ├─ Total events: 240 (8 per measure, 30 measures)
// ├─ Events by instrument:
// │  ├─ drums: 60 events, avg lookahead: 149.5ms
// │  ├─ metronome: 30 events, avg lookahead: 150.1ms
// │  ├─ harmony: 90 events, avg lookahead: 150.0ms
// │  └─ bass: 60 events, avg lookahead: 149.8ms
// │
// ├─ Timing comparison (same-beat events):
// │  ├─ Beat 1:1: drums +0.0ms, metronome +0.2ms, harmony +0.5ms, bass +0.8ms
// │  ├─ Beat 1:2: drums +0.1ms, metronome +0.3ms, harmony +0.4ms, bass +0.7ms
// │  └─ ... (more beats)
// │
// ├─ Overall statistics:
// │  ├─ Max timing difference: 0.9ms ← Cross-instrument sync!
// │  ├─ Avg timing difference: 0.4ms
// │  └─ All instruments within 5ms ✓ EXCELLENT
// │
// └─ Interpretation:
//    ✅ GOOD: All instruments within 5ms - barely perceptible
```

---

## Summary: The Complete Picture

```
EVENT JOURNEY FROM CREATION TO AUDIO OUTPUT:

1. EVENT CREATION
   └─ Musical position: measure 2, beat 1
   └─ MIDI ticks: 960 (2 beats * 480 ticks/beat)
   └─ Region starts: t=0.3s

2. TIME CALCULATION
   └─ ticks → beats: 960 / 480 = 2 beats
   └─ beats → seconds: 2 * (60/120) = 1.0s
   └─ absolute time: 0.3 + 1.0 = 1.3s (transport-relative)

3. SCHEDULING
   └─ At t=1.15s, scheduler checks: "What events in [1.15 - 1.30s]?"
   └─ Finds this event at t=1.3s
   └─ Calls: Tone.Transport.schedule(callback, 1.3)
   └─ Look-ahead: (1.3 - 1.15) = 150ms ✓

4. EXECUTION
   └─ At t=1.3s, Tone.js invokes callback
   └─ Calls: sampler.start(audioContext.currentTime)
   └─ Sample-accurate timing: ±20µs (1 frame @ 48kHz)

5. AUDIO OUTPUT
   └─ Actual sound: ~10-50ms later (hardware latency)
   └─ Not timing jitter - consistent per device

6. VISUAL FEEDBACK
   └─ Next animation frame (≤16.67ms away)
   └─ Reads audio time, renders new UI
   └─ Target sync: ±5ms from audio

TIMING LAYERS:
├─ Event scheduling: 150ms look-ahead (for stability)
├─ Web Audio timing: sample-accurate 20µs (AudioWorklet)
├─ Cross-instrument sync: < 5ms (from diagnostics)
├─ Visual updates: ±5-10ms from audio
└─ Hardware latency: ~10-50ms (consistent, not jitter)

ACCURACY TARGETS:
├─ ❌ NOT 3% (too variable with tempo)
├─ ✅ YES: Sample-accurate (< 1ms) with AudioWorklet
├─ ✅ YES: Cross-instrument sync < 5ms
├─ ✅ YES: 150ms look-ahead for stability
└─ ✅ YES: ±5ms visual sync
```
