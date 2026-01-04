# Drum Scheduling - Quick Reference

## TL;DR

Drums are triggered by calling `source.start(audioTime)` in **SimpleInstrumentScheduler** at precise audio frame positions. The path is:

```
RegionScheduler
  → EventRouter (time conversion)
    → DrumScheduler (buffer lookup + velocity)
      → SimpleInstrumentScheduler.schedule()
        → AudioBufferSourceNode.start(audioTime)  ← TRIGGER
```

---

## Critical Files

| File | Line | What Happens |
|------|------|--------------|
| RegionScheduler.ts | 308 | Calculate absolute event time |
| RegionScheduler.ts | 370 | Call `emitEvent()` to schedule |
| EventRouter.ts | 96 | Convert to audio context time |
| EventRouter.ts | 102-103 | Round to exact audio frame (sample-perfect) |
| SimpleInstrumentScheduler.ts | 173 | `schedule()` method starts |
| SimpleInstrumentScheduler.ts | 206 | Look up buffer for drum type |
| SimpleInstrumentScheduler.ts | 268 | Calculate gain (velocity * 0.8) |
| SimpleInstrumentScheduler.ts | 304 | **`source.start(audioTime)` ← AUDIO TRIGGER** |
| RegionScheduler.ts | 480 | Backup scheduler: 100ms lookahead |

---

## Timing Values

### Time Conversion Formula
```
transportTime (beats) → seconds @ BPM
  + transportStartTime (audio context anchor)
  = audioTime (Web Audio time)
  → frame = Math.round(audioTime * 48000)
  → audioTime = frame / 48000  (back-calculate for precision)
```

### Key Timing Constants
```typescript
// RegionScheduler
const lookAheadTime = 0.1;  // 100ms backup lookahead

// SimpleInstrumentScheduler (DrumScheduler)
const baseVolume = 0.8;     // Drums volume
const preserveAttackEnvelope = true;  // No fade-in for drums
const FADE_IN_DURATION = 0;  // 0ms for drums (immediate)

// Backup scheduler processing
const currentTime = Tone.Transport.seconds;
const lookAheadEnd = currentTime + 0.1;  // 100ms window
```

---

## Event Scheduling Sequence

### Step 1: Event Time Calculation (RegionScheduler)
```typescript
// Line 308 of RegionScheduler.ts
const absoluteTime = region.startTime + eventTime + offsetTime + loopOffset;

// Example with 120 BPM, 4-beat countdown:
region.startTime = 0;         // First pattern
eventTime = 0;                // Kick on beat 1 (0:0:0)
offsetTime = 2.667;           // 4 beats @ 120 BPM = 2.667s
loopOffset = 0;               // First iteration
absoluteTime = 2.667;         // Total: 2.667 seconds
```

### Step 2: Event Batching (RegionScheduler)
```typescript
// Line 323 of RegionScheduler.ts
const timeKey = Math.round(absoluteTime * 1000) / 1000;  // 1ms precision
// 2.667 → 2.667 (rounded to 3 decimals)
// Multiple events at same timeKey are grouped together
```

### Step 3: Time Conversion (EventRouter)
```typescript
// Line 96 of EventRouter.ts
let audioTime = this.transportStartTime + time;
// transportStartTime = 0 (when audio started)
// time = 2.667 (from RegionScheduler)
// audioTime = 2.667

// Line 102-103: Frame rounding
frame = Math.round(2.667 * 48000);  // 128,064
audioTime = 128,064 / 48000;         // 2.667 exactly
```

### Step 4: Direct Audio Scheduling (SimpleInstrumentScheduler)
```typescript
// Line 173-443 of SimpleInstrumentScheduler.ts

// 206: Buffer lookup
const buffer = this.getBufferForEvent(event);  // 'kick' → audioBuffer

// 217-218: Velocity normalization
const velocity = event.velocity > 1 ? event.velocity / 127 : event.velocity;
// MIDI 100 → 0.787
// Float 0.787 → 0.787

// 268: Gain calculation
const targetGain = velocity * 0.8;  // 0.787 * 0.8 = 0.630

// 274: Set gain (immediate, no fade-in for drums)
velocityGain.gain.setValueAtTime(0.630, 2.667);

// 263-284: Create audio chain
source.buffer = buffer;
source.connect(velocityGain);
velocityGain.connect(destination);

// 304: TRIGGER POINT
source.start(2.667);  // Exact audio time (sample-perfect)
```

### Step 5: Fallback (100ms Lookahead)
```typescript
// Line 480 of RegionScheduler.ts
const lookAheadEnd = currentTime + 0.1;  // 100ms window

// If event not already scheduled:
if (absoluteTime >= currentTime && absoluteTime <= lookAheadEnd) {
  // Reschedule using Tone.Transport.schedule()
  emitEvent(instrumentType, event, absoluteTime);
}
```

---

## Velocity Control

### Input Formats
```typescript
// MIDI velocity (0-127)
event.velocity = 100;
normalized = 100 / 127 = 0.787;

// Float velocity (0-1)
event.velocity = 0.787;
normalized = 0.787;

// Default (if missing)
event.velocity = undefined;
normalized = 0.8;
```

### Gain Calculation
```typescript
// Velocity × Base Volume
targetGain = normalized * 0.8

// Gain automation (for drums: immediate, no fade-in)
velocityGain.gain.setValueAtTime(targetGain, audioTime);

// Output = sample * targetGain
// Example: sample amplitude 1.0 × gain 0.630 = 0.630 output amplitude
```

---

## Buffer Mapping (DrumScheduler)

```typescript
// From InstrumentSchedulers.ts lines 40-50
eventTypeToBufferKey: {
  kick: 'kick',      // Event type 'kick' → buffer key 'kick'
  snare: 'snare',
  hihat: 'hihat',
  openhat: 'openhat',
  crash: 'crash',
  ride: 'ride',
  tom1: 'tom1',
  tom2: 'tom2',
  tom3: 'tom3',
}

// Fallback (if above mapping fails):
event.data?.drum  // e.g., event.data.drum = 'kick'
```

---

## Lookahead Explanation

### Why 100ms?
- Catches events that main scheduler might miss
- Provides buffer for JavaScript callback delays
- Allows seeking/seeking adjustments
- Not too large (would cause premature scheduling)

### How It Works
```
Current time: 2.5s
Lookahead end: 2.5 + 0.1 = 2.6s

Events checked:
  2.5 ≤ eventTime ≤ 2.6

Example events:
  ✓ 2.55s: Inside window, schedule it
  ✓ 2.59s: Inside window, schedule it
  ✗ 2.4s: Outside window, skip
  ✗ 2.7s: Outside window, skip
```

---

## Sample-Perfect Timing

### The Problem
JavaScript callbacks have ~5-15ms jitter from:
- Event loop scheduling
- Browser context switches
- Garbage collection pauses

### The Solution
Use Web Audio API's built-in timing precision:

```typescript
// Instead of:
setTimeout(() => startAudio(), delayMs);  // ❌ 5-15ms jitter

// Do this:
source.start(absoluteAudioTime);  // ✅ Sample-perfect (20.8 µs precision)
```

### Precision Levels
```
JavaScript callback: ~5-15ms (milliseconds)
Web Audio scheduling: 20.8µs (microseconds)
Improvement: ~240x better
```

### How It Works
```
1. Convert: transportTime → audioTime
2. Round: audioTime → frame @ 48kHz
3. Precision: frame / 48000 = exact audioTime
4. Schedule: source.start(audioTime)
5. Result: Audio starts at exact frame boundary
```

---

## When Drums DON'T Trigger

### Check In This Order

1. **Buffer Loaded?**
   ```typescript
   if (!buffer) {
     logger.warn(`No buffer found for drum: ${event.type}`);
     return false;  // Falls back to event bus
   }
   ```

2. **Event Type Mapped?**
   ```typescript
   // Check if event.type is in eventTypeToBufferKey
   const mapped = config.eventTypeToBufferKey[event.type];
   if (!mapped) return false;
   ```

3. **Velocity Present?**
   ```typescript
   const velocity = event.velocity || 0.8;  // Default 0.8
   if (!velocity) console.error("Velocity missing");
   ```

4. **Audio Context Ready?**
   ```typescript
   if (!this.audioContext || !this.audioDestination) {
     logger.warn("Missing audio context or destination");
     return false;
   }
   ```

5. **WamDrummer Muted?** (If using WAM plugin)
   ```typescript
   if (wamDrummer.isMuted()) {
     console.log("Drums muted");  // Check master volume
   }
   ```

---

## Logging to Debug

### Enable Timing Diagnostics
```javascript
// Browser console
window.InstrumentTimingDiagnostic.enable();

// Then in console, look for:
// "🎯 FAANG: Direct audio scheduled - drums kick"
// "targetFrame: 128064"
// "lookAhead: 42.5ms"
```

### Monitor RegionScheduler
```javascript
// Console logs will show:
// "🔄 Track processing order: drums-track → ..."
// Tells you event collection order
```

### Check SimpleInstrumentScheduler
```javascript
// Look for in logs:
// "✅ DrumScheduler buffers injected"
// "🎯 FAANG: Direct audio scheduled"
// "targetFrame: X, lookAhead: Y ms"
```

---

## Tempo Changes

### How BPM Changes Affect Timing

```typescript
// When user changes tempo via UI:
Tone.Transport.bpm.value = 140;  // 120 → 140 BPM

// RegionScheduler recalculates:
const secondsPerBeat = 60 / 140;  // 0.429 seconds per beat
const regionDurationInSeconds = regionDurationInBeats * secondsPerBeat;
const eventTime = (ticks / 480) * secondsPerBeat;  // LIVE calculation

// Result: Timing automatically adjusts, no reloading needed
```

### Bass Duration Adjustment
```typescript
// SimpleInstrumentScheduler.ts lines 326-352
// When user changes tempo, bass notes recalculate duration:

if (liveBpm !== originalBpm) {
  // Recalculate: duration = beats * (60 / liveBpm)
  const adjustedDuration = durationInBeats * (60 / liveBpm);
  // Bass note plays correctly at new tempo
}
```

---

## Event Flow Diagram (ASCII)

```
MAIN SCHEDULER (Upfront)
┌─ RegionScheduler.scheduleAll()
│  ├─ Collect all events
│  ├─ Sort (CC64 before notes)
│  ├─ Group by time (1ms precision)
│  └─ Emit: emitEvent('drums', event, timeKey)
│
└─ EventRouter.emitEvent()
   ├─ audioTime = transportStartTime + timeKey
   ├─ frame = round(audioTime * 48000)
   └─ Emit: scheduleAudioDirect()
      │
      └─ DrumScheduler.schedule()
         └─ SimpleInstrumentScheduler.schedule()
            ├─ Buffer lookup
            ├─ Gain setup
            ├─ Audio chain connect
            └─ source.start(audioTime)  ← AUDIO TRIGGER

BACKUP SCHEDULER (100ms Lookahead)
┌─ RegionScheduler.processPosition() [periodic]
│  ├─ Check: currentTime ≤ event ≤ (currentTime + 0.1)
│  ├─ Skip if already scheduled
│  └─ Emit: Tone.Transport.schedule(emitEvent, absoluteTime)
│
└─ Catches any events missed by main scheduler
```

---

## Performance Tips

1. **Batch events by time** (already done in RegionScheduler)
   - Reduces callback count
   - Better cache locality

2. **Use direct audio scheduling** (SimpleInstrumentScheduler)
   - Bypasses JavaScript timing
   - Sample-perfect precision
   - Fallback to event bus if needed

3. **Skip backup scheduler if possible**
   - Backup adds 5-10ms overhead
   - Primary scheduler upfront = faster
   - Only use backup as safety net

4. **Pre-load all samples** (before exerciseStart)
   - Decoding is expensive (~5-20ms per sample)
   - Load once, reuse many times

---

## Related Docs

- `DRUM_SCHEDULING_ANALYSIS.md` - Deep dive with code references
- `docs/PLAYBACK_EVENT_ANALYSIS.md` - Event system overview
- `docs/MEASURE_SYNC_FIX_REPORT.md` - Timing synchronization
- `/TIMING_SYSTEM_DIAGRAMS.md` - Visual timing flows
