# PlaybackEngine Scheduling Integration Status

## Summary

Implemented the 4-phase scheduling infrastructure in PlaybackEngine as per PLAYBACK_ENGINE_REFACTOR_STORY.md (Task 1.2, Day 2, line 516: "Move lifecycle logic from LifecycleCoordinator").

**Current Status:** PARTIAL IMPLEMENTATION - Structure complete, actual scheduling logic pending

## What Was Implemented

### 1. Reverted Wrong Approach

- ❌ **Removed**: RegionProcessorAdapter delegation back to RegionProcessor god object
- ✅ **Fixed**: Adapter no longer takes regionProcessor parameter
- ✅ **Fixed**: CoreServices updated to not pass RegionProcessor to adapter

### 2. Added Scheduling Infrastructure to PlaybackEngine (lines 133-145)

```typescript
// Scheduling infrastructure (inlined from LifecycleCoordinator)
private transportStartTime = 0;
private scheduleInterval: NodeJS.Timeout | null = null;
private isInitialScheduling = false;
private scheduledIds = new Set<number>(); // Tone.Transport event IDs
private scheduledEvents = new Map<string, Set<string>>(); // Track region IDs
private isRunning = false;
private sampleRate = 44100;

// Scheduling modules (from region-processing)
private regionScheduler: RegionScheduler | null = null;
private metricsCollector: TimingMetricsCollector | null = null;
private eventRouter: EventRouter | null = null;
```

### 3. Initialized Scheduling Modules (lines 194-197)

```typescript
// Initialize scheduling modules (from region-processing)
this.regionScheduler = new RegionScheduler(this.instanceId);
this.metricsCollector = new TimingMetricsCollector(this.instanceId);
this.eventRouter = new EventRouter(this.instanceId);
```

### 4. Implemented 4-Phase start() Method (lines 305-385)

Following the exact pattern from LifecycleCoordinator.start():

**Phase 1: Transport Anchor Setup** (lines 329-339)

- 300ms startup lookahead
- Transport start time = audioContext.currentTime + 0.3
- Sync transport start time to modules

**Phase 2: State Preparation** (lines 341-360)

- Clear scheduled state (Tone.Transport events, scheduled IDs)
- Reset timing metrics
- Start metrics reporting
- Check BPM
- Disable Tone.Transport.loop

**Phase 3: Initial Scheduling** (lines 362-365)

- Set isInitialScheduling = true
- Call scheduleAllRegions() ⚠️ **STUB - NOT IMPLEMENTED**
- Clear isInitialScheduling

**Phase 4: Scheduling Loop** (lines 367-372)

- Start 25ms setInterval
- Calls processCurrentPosition() ⚠️ **STUB - NOT IMPLEMENTED**

### 5. Implemented Helper Methods

- `syncTransportStartTime()` - lines 458-468
- `clearScheduledState()` - lines 474-485
- `resetMetrics()` - lines 491-495
- `startMetricsReporting()` - lines 501-505
- `scheduleAllRegions()` - lines 587-614 ⚠️ **STUB**
- `processCurrentPosition()` - lines 621-629 ⚠️ **STUB**

### 6. Updated stop() and dispose()

- **stop()**: Clear scheduling interval, clear scheduled state (lines 390-422)
- **dispose()**: Clear interval, cleanup modules, reset isRunning (lines 632-718)

## What Is NOT Implemented (Critical Gap)

### scheduleAllRegions() - Currently a Stub

**Location:** lines 602-614

**What it should do** (from RegionScheduler.scheduleAll):

1. Collect events from all track regions
2. Calculate absolute time with countdown offset
3. Build CC64 timeline for harmony tracks
4. Batch events by time
5. Route events through instrument-specific schedulers:
   - MetronomeScheduler
   - DrumScheduler
   - HarmonySchedulerV2
   - BassScheduler
   - VoiceCueScheduler

**Current implementation:**

```typescript
this.logger.warn(
  'scheduleAllRegions() not yet implemented - scheduling handled by RegionProcessor via adapter',
);
```

### processCurrentPosition() - Currently a Stub

**Location:** lines 621-629

**What it should do:**

1. Get current transport position
2. Check if more events need scheduling (based on lookahead)
3. Dynamically schedule events as transport progresses

**Current implementation:**

```typescript
// TODO: Implement dynamic scheduling check here
```

## The Integration Challenge

### Why Direct RegionScheduler Integration is Complex

RegionScheduler.scheduleAll() requires **16 dependency-injected functions**:

1. `getInstrumentType(track)`
2. `parsePositionToObject(position)` - converts musical time to {measure, beat, subdivision, tick}
3. `parsePosition(position)` - converts to beat number
4. `buildCC64Timeline(events, region)`
5. `logCC64DiagnosticTable(events, region)`
6. `getCachedSchedule(exerciseId)`
7. `setCachedSchedule(exerciseId, schedule)`
8. `emitEvent(instrumentType, event, time)`
9. `setCurrentCC64Timeline(timeline)`
10. `calculateExerciseDuration()`
    11-16. Plus more from EventRouter

These functions are currently methods on RegionProcessor (the god object we're trying to eliminate).

### The Modular Architecture Problem

The region-processing modules were designed as a **functional breakdown** of RegionProcessor with dependency injection:

- `RegionScheduler` - orchestrates scheduling
- `EventRouter` - routes events to instrument schedulers
- `MetronomeScheduler`, `DrumScheduler`, `HarmonySchedulerV2`, etc. - instrument-specific scheduling
- `TimingMetricsCollector` - metrics
- `CC64TimelineBuilder` - sustain pedal
- `MusicalTimeConverter` - time calculations
- `ScheduleCache` - caching

These modules are **called by RegionProcessor**, passing all the required function dependencies.

## Next Steps (For User Decision)

### Option 1: Temporary Hybrid (Fastest, Technical Debt)

Keep RegionProcessor alive temporarily and have PlaybackEngine.scheduleAllRegions() call into RegionProcessor's scheduling logic:

```typescript
private scheduleAllRegions(): void {
  // Temporary: Delegate to RegionProcessor until full integration
  const regionProcessor = coreServices.getActualRegionProcessor();
  regionProcessor.scheduleAllRegions();
}
```

- ✅ Pros: Audio works immediately, 4-phase structure in place
- ❌ Cons: Still depends on RegionProcessor god object, defeats the purpose

### Option 2: Full Integration (Proper, More Work)

Implement PlaybackEngine methods that RegionScheduler needs:

1. Add helper methods to PlaybackEngine:
   - `getInstrumentType(track): string`
   - `parsePosition(position): number`
   - `buildCC64Timeline(events, region): Map<number, boolean>`
   - etc. (14 more)
2. Call RegionScheduler.scheduleAll() with all dependencies
3. Fully eliminate RegionProcessor

- ✅ Pros: Proper FAANG architecture, no god object
- ❌ Cons: ~500 lines of additional code, 2-3 days work

### Option 3: New Story/Epic (Strategic)

Create Phase 2.3 story for "PlaybackEngine Scheduling Integration":

- Day 1: Implement helper methods in PlaybackEngine
- Day 2: Integrate RegionScheduler.scheduleAll()
- Day 3: Integrate instrument schedulers
- Day 4: Testing and validation
- Day 5: Remove RegionProcessor

- ✅ Pros: Planned, tracked, proper implementation
- ❌ Cons: Feature flag must stay OFF until complete

## Recommendation

Given the user's directive "we need to make the playback engine work properly not find excuses, even if it needs whole new story", I recommend **Option 3** with a temporary hybrid:

1. **Short-term (This Session)**:
   - Document current state (this file)
   - Enable basic audio by having adapter call both PlaybackEngine AND RegionProcessor
   - Clearly mark as TEMPORARY

2. **Next Session/Story**:
   - Create Phase 2.3 epic
   - Properly integrate region-processing modules
   - Remove RegionProcessor god object

## Files Modified

### Completed Changes

- ✅ [PlaybackEngine.ts](apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts) - 4-phase scheduling structure
- ✅ [RegionProcessorAdapter.ts](apps/frontend/src/domains/playback/services/core/RegionProcessorAdapter.ts) - Removed delegation
- ✅ [CoreServices.ts](apps/frontend/src/domains/playback/services/core/CoreServices.ts) - Updated adapter creation

### Needs Implementation

- ⚠️ PlaybackEngine.scheduleAllRegions() - Currently stub
- ⚠️ PlaybackEngine.processCurrentPosition() - Currently stub
- ⚠️ RegionProcessorAdapter - Needs temporary scheduling delegation OR full integration

## Testing Status

- ⚠️ **Not Tested**: No audio will play with current implementation
- ⚠️ **Reason**: scheduleAllRegions() is a no-op

## Compilation Status

- ⏳ Checking for TypeScript errors...
