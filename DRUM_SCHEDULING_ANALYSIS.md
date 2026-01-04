# Drum Sound Scheduling & Triggering Analysis

## Overview

Drum sounds are triggered through a three-layer scheduling architecture with fallback mechanisms, lookahead windows, and sample-perfect timing. The path from transport position to audio output involves multiple scheduling strategies that converge at the `WamDrummer` plugin.

---

## Layer 1: Main Event Scheduler (RegionScheduler)

**File**: `apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts`

### Scheduling Flow

1. **Event Collection** (lines 125-345):
   - Iterates through all tracks and their regions
   - Sorts events so control changes (CC64) execute before note triggers
   - Batches events by absolute time (rounded to 3 decimals for grouping)

2. **Time Calculation**:
   ```typescript
   // Line 308: Absolute time calculation
   const absoluteTime = region.startTime + eventTime + offsetTime + loopOffset;

   // Breakdown:
   // - region.startTime: When the region begins in exercise (seconds)
   // - eventTime: Time within pattern calculated from event.data.ticks
   // - offsetTime: Countdown offset (4 beats default = ~2.67s @ 120 BPM)
   // - loopOffset: For repeated patterns (loopNum * regionDurationInSeconds)
   ```

3. **Event Batching** (line 323):
   ```typescript
   // Time key with 3-decimal precision (1ms resolution)
   const timeKey = Math.round(absoluteTime * 1000) / 1000;

   // All events at same time are grouped together
   eventsByTime.get(timeKey)!.push({
     instrumentType,
     event,
     eventKey,
     regionId: region.id,
   });
   ```

4. **Audio Scheduling** (lines 349-375):
   - Converts relative transport time to absolute audio time
   - Skips past events (checking if `transportStartTime + timeKey < audioContext.currentTime`)
   - Calls `emitEvent(instrumentType, event, timeKey)` for each batch

### Key Timing Values

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `timeKey` precision | 3 decimals (1ms) | Event batching granularity |
| Past event threshold | `audioContext.currentTime` | Skip already-played events |
| Loop count | 1+ repetitions | Pattern repetition within exercise |
| Region duration | beats (converted to seconds) | Single pattern cycle length |

---

## Layer 2: Event Router (Direct Audio Scheduling)

**File**: `apps/frontend/src/domains/playback/services/core/region-processing/event-routing/EventRouter.ts`

### Routing Decision Tree

```typescript
// Line 93-120: Event routing with fallback
emitEvent(instrumentType: string, event: PatternEvent, time: number): void {
  // Step 1: Convert transport time → AudioContext time
  let audioTime = this.transportStartTime + time;  // Line 96

  // Step 2: Round to exact audio frame (sample-perfect)
  let frame = 0;
  if (this.audioContext) {
    frame = Math.round(audioTime * this.sampleRate);  // Line 102
    audioTime = frame / this.sampleRate;  // Back-calculate precise time
  }

  // Step 3: Try direct audio scheduling first (FAANG solution)
  if (this.scheduleAudioDirect(instrumentType, event, audioTime, frame)) {
    return;  // Successfully scheduled - skip event bus
  }

  // Step 4: Fall back to event bus for unsupported instruments
  this.emitToEventBus(instrumentType, event, audioTime);
}
```

### Drum Routing (Lines 138-140)

```typescript
if (instrumentType === 'drums') {
  return this.drumScheduler.schedule(event, audioTime, frame);
}
```

**Target**: `DrumScheduler` (direct audio path) with event bus fallback.

### Sample-Accurate Timing Conversion

| Step | Formula | Result |
|------|---------|--------|
| 1. Transport time | `time` (in seconds) | Relative to transport start |
| 2. Add anchor | `transportStartTime + time` | Absolute audio context time |
| 3. Frame rounding | `Math.round(audioTime * sampleRate)` | Exact audio frame (e.g., 2,304,000 @ 48kHz) |
| 4. Back-calculate | `frame / sampleRate` | Precise audio time (e.g., 48.000 seconds exactly) |

**Sample Rate**: 48,000 Hz (typical)
**Sample Duration**: 1/48,000 = 0.0000208 seconds = **20.8 microseconds**

---

## Layer 3: Direct Audio Scheduling (DrumScheduler)

**File**: `apps/frontend/src/domains/playback/services/core/region-processing/scheduling/InstrumentSchedulers.ts` (lines 35-56)

### DrumScheduler Configuration

```typescript
export class DrumScheduler extends SimpleInstrumentScheduler {
  constructor(instanceId: string, tracks: Map<string, any>) {
    const config: SchedulerConfig = {
      loggerName: 'DrumScheduler',
      instrumentType: 'drums',
      eventTypeToBufferKey: {
        kick: 'kick',
        snare: 'snare',
        hihat: 'hihat',
        openhat: 'openhat',
        crash: 'crash',
        ride: 'ride',
        tom1: 'tom1',
        tom2: 'tom2',
        tom3: 'tom3',
      },
      baseVolume: 0.8,
      preserveAttackEnvelope: true,
    };
    super(instanceId, tracks, config);
  }
}
```

### Core Scheduling Logic

**File**: `apps/frontend/src/domains/playback/services/core/region-processing/scheduling/SimpleInstrumentScheduler.ts` (lines 173-443)

#### Step 1: Buffer Lookup (Lines 140-167)

```typescript
private getBufferForEvent(event: PatternEvent): AudioBuffer | null {
  // Priority order:
  // 1. Check eventTypeToBufferKey mapping (e.g., 'kick' → buffer)
  const bufferKey = this.config.eventTypeToBufferKey[event.type];
  if (bufferKey && this.buffers.has(bufferKey)) {
    return this.buffers.get(bufferKey)!;
  }

  // 2. Fallback: Check event.data.drum (for dynamic drum names)
  if (event.data?.drum && this.buffers.has(event.data.drum)) {
    return this.buffers.get(event.data.drum)!;
  }

  // Returns null if not found (falls back to event bus)
}
```

#### Step 2: Velocity Normalization (Lines 217-218)

```typescript
const rawVelocity = event.velocity || 0.8;  // Default 0.8 (64/127 MIDI velocity)
const velocity = rawVelocity > 1 ? rawVelocity / 127 : rawVelocity;  // Normalize MIDI
```

**MIDI Velocity Range**: 0-127
**Normalized Range**: 0-1
**Conversion**: If velocity > 1, treat as MIDI and divide by 127

#### Step 3: Gain Setup (Lines 266-280)

```typescript
// Create gain for velocity control
const velocityGain = this.audioContext.createGain();
const targetGain = velocity * this.config.baseVolume!;  // 0.8 * velocity

// For drums: preserveAttackEnvelope = true (line 52 in DrumScheduler config)
if (this.config.preserveAttackEnvelope) {
  // START AT FULL VOLUME IMMEDIATELY - preserve attack transient
  velocityGain.gain.setValueAtTime(targetGain, audioTime);  // Line 274
} else {
  // OTHER INSTRUMENTS: Use 10ms exponential fade-in to prevent clicks
  const FADE_IN_DURATION = 0.01;  // 10ms
  velocityGain.gain.setValueAtTime(0.001, audioTime);
  velocityGain.gain.exponentialRampToValueAtTime(targetGain, audioTime + FADE_IN_DURATION);
}
```

**For Drums**:
- No fade-in (full volume immediately at audioTime)
- Preserves attack envelope
- Allows transient punch to be heard

#### Step 4: Audio Node Chain (Lines 282-284)

```typescript
// Connect: source → gain → destination
source.connect(velocityGain);
velocityGain.connect(this.audioDestination);
```

This routes through:
```
AudioBufferSourceNode
    ↓
GainNode (velocity control)
    ↓
Mixer/Master Output
    ↓
Audio Output
```

#### Step 5: Scheduled Start (Lines 297-304)

```typescript
// CRITICAL: Schedule start at EXACT audio time (sample-perfect)
const offsetSeconds = this.config.preserveAttackEnvelope
  ? 0  // For drums: no offset, start at frame 0
  : silentSamplesAtStart / buffer.sampleRate;  // For others: skip silence

const sourceStartCallTime = performance.now();
source.start(audioTime, offsetSeconds);  // LINE 304: TRIGGER POINT
const sourceStartCallEnd = performance.now();
```

**This is where the audio actually starts playing.**

### Timing Diagnostics (Lines 385-403)

Logs the precise scheduling information:

```typescript
InstrumentTimingDiagnostic.record({
  instrument: 'drums',
  eventType: event.data?.drum || event.type,  // 'kick', 'snare', 'hihat', etc.
  scheduledAudioTime: audioTime,  // The exact moment audio will start
  jsExecutionTime: sourceStartCallEnd,  // When JS code finished scheduling
  scheduleFrame: Math.round(scheduleTime * this.sampleRate),  // Frame we're at now
  targetFrame: frame,  // Frame we're scheduling for
  lookaheadMs: timeDelta,  // How far in advance we scheduled (typically 10-50ms)
  beat: eventBeat,
  measure: eventMeasure,
});
```

---

## Layer 4: WAM Drummer Plugin (Audio Playback)

**File**: `apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamDrummer.ts`

**Note**: In the current direct audio path, `WamDrummer` is NOT used. Instead, samples play directly through `AudioBufferSourceNode` in the Web Audio API. The `WamDrummer` plugin is available as an alternative interface but the primary drum playback mechanism is Layer 3.

However, for completeness, here's how `WamDrummer.triggerPad()` works (lines 511-553):

```typescript
triggerPad(padNumber: number, velocity = 1, time?: number): void {
  const pad = this.pads.get(padNumber);
  if (!pad || !pad.loaded || !pad.buffer) return;

  const triggerTime = time !== undefined ? time : this.context.currentTime;

  // Create source node
  const source = this.context.createBufferSource();
  source.buffer = pad.buffer;
  source.playbackRate.value = pad.pitch;  // Pitch control

  // Connect to pad's gain node
  const gain = this.padGains.get(padNumber);
  if (gain) {
    source.connect(gain);

    // Apply velocity
    const originalGain = pad.volume;
    gain.gain.setValueAtTime(originalGain * velocity, triggerTime);  // Line 529
  }

  // START PLAYBACK (Line 533: TRIGGER POINT)
  source.start(triggerTime);

  // Track and cleanup
  this._activeSources.add(source);
  source.onended = () => {
    this._activeSources.delete(source);
    // Update sampler tracking
  };
}
```

**Key Points**:
- Accepts optional `time` parameter for scheduled triggering
- Applies velocity to pad's gain node
- Starts playback with `source.start(triggerTime)`
- Tracks active sources for cleanup

---

## Backup Scheduling System (Defense-in-Depth)

**File**: `apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts` (lines 455-561)

### Lookahead Window

```typescript
// Line 115: Lookahead time (from BackupScheduler)
private lookAheadTime: number = 0.1;  // 100 milliseconds
```

### Processing Logic

```typescript
processPosition(
  isRunning: boolean,
  tracks: Track[],
  // ... other params
): void {
  if (!isRunning) return;  // Don't schedule if stopping

  const Tone = getTone();
  const currentTime = Tone.Transport.seconds;

  // CRITICAL: Lookahead window calculation (Line 480)
  const lookAheadEnd = currentTime + this.lookAheadTime;  // +100ms

  // Check each event in the window:
  // currentTime ≤ eventTime ≤ lookAheadEnd
  // This catches any events the main scheduler might have missed
}
```

### When Backup Scheduler Activates

1. **Primary scheduler missed an event**: If an event wasn't scheduled in the main batch due to timing issues
2. **Transport time jumped**: If seeking happened and an event is now within the lookahead window
3. **Late arrivals**: Events that should have been scheduled earlier but are now imminent

### Lookahead Window Timing

| Scenario | Timing |
|----------|--------|
| Current transport time | T = 2.5 seconds |
| Lookahead window end | 2.5 + 0.1 = 2.6 seconds |
| Events eligible for backup | 2.5 ≤ eventTime ≤ 2.6 |
| Window width | 100 milliseconds |

---

## Complete Timing Flow (Example)

### Setup
- Exercise BPM: 120
- Transport start time: 0 seconds
- Countdown: 4 beats enabled (offset = 2.667 seconds @ 120 BPM)
- Pattern: Kick on beat 1

### Event Calculation

```
1. Event position: "0:0:0" (measure 0, beat 0, sixteenth 0)
2. Event time: parsePosition("0:0:0") = 0 seconds
3. Countdown offset: parsePosition("0:4:0") = 2.667 seconds
4. Region start: 0 seconds (first pattern)
5. Loop offset: 0 (first iteration)

Absolute transport time = 0 + 0 + 2.667 + 0 = 2.667 seconds
```

### Audio Scheduling

```
1. transportStartTime = 0 seconds (when audio context started playing)
2. Add transport time: audioTime = 0 + 2.667 = 2.667 seconds
3. Round to frame: frame = Math.round(2.667 * 48000) = 128,064
4. Back-calculate: audioTime = 128,064 / 48000 = 2.667 seconds exactly
5. Schedule start: source.start(2.667)
```

### Actual Playback

```
Audio context current time: 2.600 seconds (during countdown)
Scheduled time: 2.667 seconds
Lookahead: 2.667 - 2.600 = 67 milliseconds
Result: Drum triggers at EXACTLY 2.667 seconds (sample-perfect)
```

---

## Velocity and Gain Chain

### Velocity Flow

```
Event velocity:
  ├─ MIDI (0-127): Normalized to 0-1 by dividing by 127
  └─ Float (0-1): Used directly

Applied gain:
  targetGain = velocity * baseVolume
  targetGain = velocity * 0.8  (for drums)

Example:
  - MIDI velocity 100 → normalized to 0.787
  - Applied gain = 0.787 * 0.8 = 0.630
```

### Gain Automation Timeline

For drums (preserveAttackEnvelope = true):

```
audioTime = 2.667s:
  gain.setValueAtTime(targetGain, 2.667)  → Instant to target
  (No fade-in, attack envelope preserved)
  ↓
2.667s onwards:
  Full volume playback until sample ends naturally
```

---

## Lookahead Summary

| Layer | Lookahead | Method | Purpose |
|-------|-----------|--------|---------|
| 1. RegionScheduler | None explicit | Batch all at once | Upfront scheduling to prevent doubling |
| 2. EventRouter | Sample-level | Frame rounding | Sub-sample precision |
| 3. SimpleInstrumentScheduler | None explicit | Direct scheduling | Immediate source.start() |
| 4. BackupScheduler | **100ms** | Periodic polling | Defense-in-depth catch-up |

### Primary Lookahead: 100ms (Backup Scheduler)

The main lookahead mechanism is the **backup scheduler's 100-millisecond window**. This catches any events that:
- Were missed by the upfront scheduler
- Fall within the next 100ms window from current playback position
- Haven't already been marked as scheduled

---

## Event Flow Diagram

```
RegionScheduler
├─ Collects all events from all tracks
├─ Groups by absolute time (1ms precision)
├─ Calls emitEvent() for each batch
│
└─→ EventRouter
    ├─ Converts transport time to audio time
    ├─ Rounds to exact audio frame (sample-perfect)
    ├─ Tries direct audio scheduling
    │
    └─→ DrumScheduler (SimpleInstrumentScheduler)
        ├─ Finds buffer for drum type
        ├─ Normalizes velocity
        ├─ Creates gain node chain
        ├─ Schedules source.start(audioTime)  ← AUDIO TRIGGER
        └─ Records timing diagnostics

        FALLBACK: If direct scheduling fails
        └─→ EventRouter.emitToEventBus()
            └─→ event.emit('drum-trigger', {...})
                └─→ [Legacy event handlers]

BackupScheduler (Continuous)
├─ Every ~5ms: checks events in lookahead window
├─ If event not already scheduled
└─→ Calls emitEvent() again as safety net
```

---

## Key Timing Values Reference

### Global Timing
| Value | Meaning |
|-------|---------|
| 120 BPM | Default exercise tempo |
| 60/120 = 0.5s | Duration of 1 beat @ 120 BPM |
| 4 beats | Default countdown duration |
| 4 * 0.5 = 2.0s | Countdown duration @ 120 BPM |

### Scheduling Precision
| Value | Meaning |
|-------|---------|
| 48,000 Hz | Sample rate (typical) |
| 20.8 µs | Duration of 1 sample |
| 3 decimals | Time batching precision (1ms) |
| 1 frame | Minimum scheduling granularity |

### Lookahead
| Value | Meaning |
|-------|---------|
| 100ms | Backup scheduler window |
| 0 ms | Primary scheduler (upfront) |
| 50ms | Stop fadeout duration (when manually stopping) |
| 10ms | Fade-in for non-attack-sensitive instruments |

### Drums Specific
| Value | Meaning |
|-------|---------|
| 0.8 | Base volume (80%) |
| 0 ms | Fade-in (preserveAttackEnvelope = true) |
| 0 offset | No silent sample skipping |

---

## Debugging Commands

### Enable Timing Diagnostics

```typescript
// In browser console:
window.InstrumentTimingDiagnostic.enable();

// Then check logs for timing records:
// "🎯 FAANG: Direct audio scheduled - drums kick"
// Shows: targetFrame, lookaheadMs, audioTime, etc.
```

### Monitor Backup Scheduler

```typescript
// Check console logs for:
// "⏰ Interval fired but isRunning=false, skipping"
// Or: "Scheduled backup event..."
```

### Verify Audio Timing

```typescript
// In RegionScheduler logs, look for:
// "🔄 Track processing order: ..."
// "🎯 FAANG: Direct audio scheduled..."
// Shows exact timing for each drum trigger
```

---

## Potential Issues & Solutions

### Issue: Drums Not Triggering

**Possible Causes**:
1. Buffer not loaded for drum type
2. WamDrummer plugin muted or volume at 0
3. Velocity value missing (defaults to 0.8)
4. Event type not in eventTypeToBufferKey mapping

**Debug**:
```typescript
// Check buffer availability
console.log(simpleInstrumentScheduler.buffers);

// Check event mapping
console.log(config.eventTypeToBufferKey);

// Verify velocity in event
console.log(event.velocity);
```

### Issue: Timing Jitter

**Possible Causes**:
1. JavaScript callback delays in backup scheduler
2. Scheduling too far in advance (accumulates rounding errors)
3. Browser context switches or GC pauses

**Solutions**:
- Use primary (upfront) scheduler instead of relying on backup
- Batch events to reduce callback overhead
- Use frame-perfect rounding for precision

### Issue: Drums Too Quiet

**Debug Gain Chain**:
```
event.velocity (0-127 or 0-1)
    ↓ [normalize if > 1]
    ↓ [multiply by 0.8]
WamDrummer.setVolume(0-1)
    ↓ [multiply]
Final output gain
```

Check each stage in browser DevTools.

---

## Files Referenced

1. **RegionScheduler**: Main event collection and scheduling orchestration
2. **EventRouter**: Time conversion and instrument routing
3. **SimpleInstrumentScheduler**: Direct audio scheduling implementation
4. **InstrumentSchedulers**: DrumScheduler configuration
5. **WamDrummer**: Alternative drum triggering interface (plugin pattern)

---

## Summary

Drum sounds are triggered through a sophisticated three-layer system:

1. **Upfront Scheduling** (RegionScheduler): Batches all events with 1ms precision
2. **Direct Audio** (SimpleInstrumentScheduler): Uses `AudioBufferSourceNode.start(audioTime)` for sample-perfect timing
3. **Backup System** (100ms lookahead): Catches any missed events as safety net

The **critical trigger point** is `source.start(audioTime)` in SimpleInstrumentScheduler.schedule(), where the exact frame-based audio time is used to schedule playback with microsecond precision. This bypasses JavaScript timing issues entirely and lets the Web Audio API handle the actual playback at the specified moment.
