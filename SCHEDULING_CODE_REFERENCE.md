# Audio Scheduling Code Reference Guide

## File Locations & Key Methods

### 1. Configuration & Constants

**File:** `/apps/frontend/src/domains/playback/config/transportTiming.ts`

```typescript
// Look-ahead time configuration
lookAheadTime: 0.15              // 150ms
updateInterval: 0.02             // 20ms (50Hz polling)
startupLookahead: 0.3            // 300ms startup buffer

// Key function
applyTransportTimingConfig(Tone)  // Apply to Tone.js context
validateTransportTiming(Tone)     // Check if settings match
```

---

### 2. Event Scheduling - The Core Orchestrator

**File:** `/apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts`

**Key Method:** `scheduleAll()` - Main orchestration entry point

```typescript
// Lines 275-308: Time Calculation
const eventData = (event as any).data;
let eventTime: number;

if (eventData?.ticks !== undefined) {
  const ticksPerBeat = 480;
  const absoluteTicks = eventData.ticks;
  eventTime = (absoluteTicks / ticksPerBeat) * secondsPerBeat;
}

// Lines 301-308: Apply all offsets
const offsetTime = countdownEnabled && !region.skipCountdownOffset
  ? parsePosition(`0:${countdownOffsetBeats}:0`)
  : 0;

const absoluteTime = region.startTime + eventTime + offsetTime + loopOffset;
const timeKey = Math.round(absoluteTime * 1000) / 1000;  // Round to 1ms
```

**Time Calculation Formula:**
```
absoluteTime = region.startTime + eventTime + offsetTime + loopOffset
             = region.startTime + (ticks/480)*(60/BPM) + countdown + loop_offset
```

**Key Variables:**
- `eventTime`: Offset within region (converted from MIDI ticks)
- `offsetTime`: Countdown offset (if enabled)
- `loopOffset`: Repeat iteration offset
- `timeKey`: Rounded to 1ms precision for event batching

---

### 3. Scheduler Class - Look-Ahead Implementation

**File:** `/apps/frontend/src/domains/playback/modules/transport/core/Scheduler.ts`

**Key Method:** `processScheduleQueue(currentTime)` - Lines 201-259

```typescript
private processScheduleQueue(currentTime: number): void {
  const scheduleUntil = currentTime + this.config.lookAheadTime;  // Add 150ms

  // Filter events within look-ahead window
  const eventsToSchedule = this.eventQueue
    .filter(
      (event) =>
        event.time > currentTime &&
        event.time <= scheduleUntil &&
        !this.scheduledEvents.has(event.id),
    )
    .sort((a, b) => {
      // Sort by priority, then time
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.time - b.time;
    });

  // Schedule with Tone.js
  const Tone = getTone();
  for (const event of eventsToSchedule) {
    const scheduleId = Tone.Transport.schedule((time: number) => {
      event.callback(time);
      // Clean up after execution
    }, event.time);

    this.scheduledEvents.set(event.id, scheduleId);
  }

  this.scheduledUntil = scheduleUntil;
}
```

**Key Calculation:**
```typescript
scheduleUntil = currentTime + 0.15  // 150ms look-ahead window
```

**Only events where:** `currentTime < event.time <= scheduleUntil`

---

### 4. Clock - Time Source

**File:** `/apps/frontend/src/domains/playback/modules/transport/core/Clock.ts`

**Key Methods:**
```typescript
// Get current audio time
getAudioTime(): number
  // Returns AudioContext time if available, otherwise system time

// Initialize with audio context
async initialize(audioContext: AudioContext)

// Sample-accurate clock (optional)
sampleAccurateClock: SampleAccurateClock | null
```

**Usage in Scheduler:**
```typescript
const currentTime = Tone.Transport.seconds;  // From Clock
const scheduleUntil = currentTime + 0.15;
```

---

### 5. Sample-Accurate Clock (Frame-Based)

**File:** `/apps/frontend/src/domains/playback/modules/transport/sync/SampleAccurateClock.ts`

**Frame Calculation:**
```typescript
export interface ClockState {
  currentTime: number;        // seconds
  currentFrame: number;       // frame count = seconds * 48000
  audioContextTime: number;   // AudioContext.currentTime
}

// Frame conversion helper
const frames = seconds * 48000;     // 48kHz sample rate
const seconds = frames / 48000;
const lookaheadFrames = 150 * 48;  // 150ms = 7200 frames
```

---

### 6. Drift Prediction

**File:** `/apps/frontend/src/domains/playback/modules/transport/sync/DriftPredictor.ts`

**Key Method:** `predict(futureTimeMs)`

```typescript
predict(futureTimeMs = 100): DriftPrediction {
  const currentDrift = this.kalmanFilter.getCurrentEstimate();

  const timeDelta = futureTimeMs / 1000;
  const predictedDrift =
    currentDrift +
    this.driftVelocity * timeDelta +
    0.5 * this.driftAcceleration * timeDelta * timeDelta;

  return {
    currentDrift,
    predictedDrift,
    confidence,  // 0-1
    trend,       // 'stable' | 'increasing' | 'decreasing'
    rate,        // ms/s
  };
}
```

**Kalman Filter:** Predictive drift compensation using velocity and acceleration

---

### 7. Polling Position Updates

**File:** `/apps/frontend/src/domains/playback/modules/transport/scheduling/strategies/PollingStrategy.ts`

**Key Method:** `start()` - Lines 116-192

```typescript
start(): void {
  // Initialize tempo tracking
  this.accumulatedBeats = 0;
  this.lastTempoChangeTime = this.transportStartTime;
  this.currentBPM = Tone.Transport.bpm.value;

  const update = () => {
    // Calculate elapsed time
    const absoluteTime = this.clock.getAudioTime();
    const wallClockElapsed = absoluteTime - this.transportStartTime;

    // TEMPO COMPENSATION: Calculate total beats
    const elapsedSinceLastChange = absoluteTime - this.lastTempoChangeTime;
    const beatsSinceLastChange = elapsedSinceLastChange * (this.currentBPM / 60);
    const totalBeats = this.accumulatedBeats + beatsSinceLastChange;

    // Convert beats to equivalent seconds
    const equivalentSeconds = totalBeats / (this.currentBPM / 60);

    // Update timeline
    this.timeline.updatePositionFromSeconds(equivalentSeconds);

    // Emit position update
    this.emitUpdate(equivalentSeconds);
  };

  // Initial update
  update();

  // Set up 20ms polling
  this.intervalId = window.setInterval(update, this.config.pollingIntervalMs);
}
```

**Polling Rate:** `this.config.pollingIntervalMs` = 20ms (50Hz)

**Tempo Change Handling:** Lines 85-114
```typescript
onTempoChange(newBPM: number): void {
  // Snapshot beats at old tempo
  const now = this.clock.getAudioTime();
  const elapsedSinceLastChange = now - this.lastTempoChangeTime;
  const beatsSinceLastChange = elapsedSinceLastChange * (this.currentBPM / 60);
  this.accumulatedBeats += beatsSinceLastChange;

  // Reset for new tempo
  this.lastTempoChangeTime = now;
  this.currentBPM = newBPM;
}
```

---

### 8. Timing Diagnostics

**File:** `/apps/frontend/src/domains/playback/services/core/diagnostics/InstrumentTimingDiagnostic.ts`

**Key Methods:**
```typescript
enable(): void                          // Start collection
disable(): void                         // Stop collection
record(event: TimingEvent): void       // Record a timing event
analyzeByBeat(): BeatTimingComparison[]  // Group by beat
report(): void                          // Print human-readable report
exportJSON(): string                   // Export raw data
```

**TimingEvent Structure:** (Lines 18-28)
```typescript
interface TimingEvent {
  instrument: 'drums' | 'metronome' | 'harmony' | 'bass' | 'voice-cue';
  eventType: string;              // e.g., 'kick', 'C4', 'click'
  scheduledAudioTime: number;     // When it SHOULD play (seconds)
  jsExecutionTime: number;        // When source.start() was called
  scheduleFrame: number;          // Frame count at scheduling
  targetFrame: number;            // Frame count at playback
  lookaheadMs: number;            // (targetFrame - scheduleFrame) / 48
  beat: number;
  measure: number;
}
```

**Beat Grouping:** (Lines 91-103)
```typescript
// Round to 10ms for grouping
const beatKey = `${event.measure}:${Math.round(event.scheduledAudioTime * 100)}`;

// Group events on same beat
if (!beatGroups.has(beatKey)) {
  beatGroups.set(beatKey, []);
}
```

**Usage in Browser:**
```javascript
window.__timingDiagnostic.enable();
// Play exercise
window.__timingDiagnostic.report();
```

---

### 9. Audio-Visual Sync

**File:** `/apps/frontend/src/domains/widgets/services/AudioVisualSync.ts`

**Configuration:** (Lines 12-17)
```typescript
interface AudioVisualSyncConfig {
  targetLatency: number;      // 50ms
  syncAccuracy: number;       // 5ms (target accuracy)
  driftCorrectionInterval: number;  // 1000ms
  visualFrameRate: number;    // 60fps
}
```

**Latency Calculation:** (Lines 137-162)
```typescript
private calculateLatency(): number {
  const baseLatency = this.audioContext.baseLatency || 0;
  const outputLatency = this.audioContext.outputLatency || 0;
  const processingLatency = 10;

  const totalLatency = (baseLatency + outputLatency) * 1000 + processingLatency;

  // Track history for average
  this.latencyHistory.push(totalLatency);
  if (this.latencyHistory.length > 50) {
    this.latencyHistory.shift();
  }

  return totalLatency;
}
```

**Drift Correction:** (Lines 167-199)
```typescript
private updateDriftCorrection(syncPoint: SyncPoint): void {
  // Only correct at specified intervals
  if (now - this.lastSyncTime < this.config.driftCorrectionInterval) {
    return;
  }

  // Calculate drift from recent sync points
  const recentPoints = this.syncPointHistory.slice(-10);
  const driftValues = recentPoints.map(p => p.actualTime - p.scheduledTime);
  const avgDrift = driftValues.reduce((sum, d) => sum + d, 0) / driftValues.length;

  // Apply gradual correction if significant
  if (Math.abs(avgDrift) >= 1) {
    this.driftOffset += avgDrift * 0.1;  // 10% correction factor
  }
}
```

---

### 10. Scheduler Update Loop Configuration

**File:** `/apps/frontend/src/domains/playback/modules/transport/scheduling/types/scheduler.types.ts`

**Default Configuration:** (Lines 186-191)
```typescript
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  pollingIntervalMs: 20,           // 50 Hz polling
  eventDrivenThrottleMs: 8.33,     // 120 Hz event-driven
  preferEventDriven: true,         // Prefer faster option
};
```

---

## Calculation Formulas Quick Reference

### Time Conversions

```typescript
// MIDI ticks to seconds
seconds = (ticks / 480) * (60 / BPM)

// Seconds to frames (48kHz)
frames = seconds * 48000

// Frames to milliseconds of look-ahead
lookaheadMs = (targetFrame - scheduleFrame) / 48

// BPM to beats per second
beatsPerSecond = BPM / 60

// Elapsed time to beats
beats = elapsedSeconds * (BPM / 60)
```

### Look-Ahead Window

```typescript
// Scheduling window
scheduleUntil = currentTime + lookAheadTime
// Events scheduled if: currentTime < event.time <= scheduleUntil

// At 150ms look-ahead
scheduleUntil = currentTime + 0.15

// Example:
// currentTime = 2.0s → schedule up to 2.15s
// currentTime = 2.02s → schedule up to 2.17s
```

### Tempo-Aware Position

```typescript
// Track accumulated beats across tempo changes
totalBeats = accumulatedBeats + (elapsedSinceLastChange * (BPM / 60))

// Convert back to "equivalent seconds"
equivalentSeconds = totalBeats / (BPM / 60)

// This prevents position jumps when tempo changes
```

---

## Debug Commands

### Enable Timing Diagnostics

```javascript
// Browser console
window.__timingDiagnostic.enable();

// Play the exercise
// ... wait 30 seconds ...

// Print report
window.__timingDiagnostic.report();

// Export raw data
const json = window.__timingDiagnostic.exportJSON();
console.log(json);
```

### Check Logger Output

```javascript
// Set log level
window.logger.setLevel(window.LogLevel.DEBUG);

// Categories (see logger.ts for full list)
// Enabled: RegionProcessor, TransportClock, DriftPredictor
// Disabled: FretboardCard, youtube-widget, CoreServices

// Example:
window.logger.setLevel(window.LogLevel.INFO);
```

### Audio Context Information

```javascript
// Get current timing
Tone.Transport.seconds        // Current playback position
Tone.Transport.bpm.value      // Current BPM
Tone.context.currentTime      // AudioContext time
Tone.context.lookAhead        // Scheduler look-ahead
Tone.context.updateInterval   // Scheduler update rate
```

---

## Key Metrics & Targets

### Current Implementation

| Metric | Value | Source | Notes |
|--------|-------|--------|-------|
| Look-ahead time | 150ms | transportTiming.ts:32 | Professional DAW standard |
| Update interval | 20ms | transportTiming.ts:39 | 50Hz polling rate |
| Sample rate | 48kHz | SampleAccurateClock | Standard for audio |
| Cross-instrument sync | < 5ms | InstrumentTimingDiagnostic | From measurements |
| Audio jitter | < 1ms | AudioWorklet | Sample-accurate timing |
| Visual sync target | ±5ms | AudioVisualSync | Animation frame based |
| Drift threshold | 1ms | DriftPredictor | Significant drift = > 1ms |
| Visual frame rate | 60fps | transportTiming.ts:63 | 16.67ms per frame |

### NOT a Target: 3% Accuracy

**Why not 3%:**
- Too variable with tempo (loose for slow, tight for fast)
- Doesn't match professional audio standards
- Current system achieves < 1-5ms (much better than 3%)

**Current targets instead:**
- Sample-accurate: < 1ms (with AudioWorklet)
- Cross-instrument: < 5ms (typical measurement)
- Look-ahead: 150ms (for stability)
- Visual sync: ±5-10ms

---

## Testing & Measurement

### Unit Tests

```bash
# Test scheduling system
pnpm vitest run apps/frontend/src/domains/playback/modules/transport/core/__tests__/Scheduler.test.ts

# Test drift prediction
pnpm vitest run apps/frontend/src/domains/playback/modules/transport/sync/__tests__/DriftPredictor.test.ts

# Test polling strategy
pnpm vitest run apps/frontend/src/domains/playback/modules/transport/scheduling/__tests__/PositionUpdateScheduler.test.ts
```

### Integration Tests

```bash
# Test transport integration
pnpm vitest run apps/frontend/src/domains/playback/modules/transport/__tests__/integration/

# Test PlaybackEngine integration
pnpm vitest run apps/frontend/src/domains/playback/services/core/__tests__/PlaybackEngine.test.ts
```

### Manual Testing

```javascript
// In browser console during playback:

// 1. Enable diagnostics
window.__timingDiagnostic.enable();

// 2. Play exercise (30+ seconds for good data)

// 3. Get report
window.__timingDiagnostic.report();

// 4. Evaluate results
// < 1ms:  EXCELLENT
// < 5ms:  GOOD
// < 20ms: ACCEPTABLE
// > 20ms: NEEDS ATTENTION
```

---

## Summary: Code Execution Flow

```
1. RegionScheduler.scheduleAll()
   └─ Calculate: absoluteTime = startTime + eventTime + offset + loop

2. Scheduler.processScheduleQueue()
   └─ Calculate: scheduleUntil = currentTime + 0.15
   └─ Filter: events where currentTime < time <= scheduleUntil
   └─ Sort: by priority, then time

3. Tone.Transport.schedule(callback, time)
   └─ Store callback, execute at exact time

4. At event time:
   └─ Tone.js invokes callback
   └─ source.start(audioContext.currentTime)
   └─ Timing: sample-accurate (AudioWorklet)

5. InstrumentTimingDiagnostic.record()
   └─ Record: scheduledAudioTime, jsExecutionTime, scheduleFrame, targetFrame
   └─ Calculate: lookaheadMs = (targetFrame - scheduleFrame) / 48

6. Browser: window.__timingDiagnostic.report()
   └─ Show: cross-instrument timing differences
   └─ Target: all < 5ms
```
