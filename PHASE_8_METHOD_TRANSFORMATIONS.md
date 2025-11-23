# Phase 8 Method Transformations

## Architecture Change

**Before Phase 8:**
```
RegionProcessor
  → Coordinators (BufferCoordinator, ConfigurationCoordinator, LifecycleCoordinator)
    → Domain Services (Schedulers, Managers)
```

**After Phase 8:**
```
RegionProcessor (Thin Facade)
  → Application Services (Service Layer)
    → Coordinators (Helper Modules)
      → Domain Services (Schedulers, Managers)
```

## Methods That Need Transformation

### 1. Configuration Methods (Currently Phase 7 → ConfigurationCoordinator)

#### `enableCountdown()`

**Current Implementation** (Phase 7):
```typescript
enableCountdown(timeSignature: {
  numerator: number;
  denominator: number;
}): void {
  // Phase 7: Delegate countdown configuration to ConfigurationCoordinator
  this.countdownOffsetBeats = this.configurationCoordinator.enableCountdown(
    timeSignature,
    this.countdownManager,
    this.scheduleCache,
    this.cc64TimelineBuilder,
  );
}
```

**New Implementation** (Phase 8):
```typescript
enableCountdown(timeSignature: {
  numerator: number;
  denominator: number;
}): void {
  // Phase 8: Delegate to ConfigurationManagementService
  this.configurationManagementService.enableCountdown(timeSignature);
}
```

**What Happens:**
- RegionProcessor calls `configurationManagementService`
- Service internally calls `configurationCoordinator`
- Coordinator coordinates across modules
- Service updates RegionProcessor state via callbacks

---

#### `disableCountdown()`

**Current** (Phase 7 - 8 lines):
```typescript
disableCountdown(): void {
  // Phase 7: Delegate countdown configuration to ConfigurationCoordinator
  this.configurationCoordinator.disableCountdown(
    this.countdownManager,
    this.scheduleCache,
    this.cc64TimelineBuilder,
  );
  this.countdownOffsetBeats = 0; // Sync for backward compat
}
```

**New** (Phase 8 - 3 lines):
```typescript
disableCountdown(): void {
  // Phase 8: Delegate to ConfigurationManagementService
  this.configurationManagementService.disableCountdown();
}
```

---

#### `addCountdownRegion()`

**Current** (Phase 7 - 7 lines):
```typescript
addCountdownRegion(timeSignature: {
  numerator: number;
  denominator: number;
}): void {
  // Phase 7: Delegate to ConfigurationCoordinator
  this.configurationCoordinator.addCountdownRegion(
    timeSignature,
    this.tracks,
    this.countdownManager,
  );
}
```

**New** (Phase 8 - 3 lines):
```typescript
addCountdownRegion(timeSignature: {
  numerator: number;
  denominator: number;
}): void {
  // Phase 8: Delegate to ConfigurationManagementService
  this.configurationManagementService.addCountdownRegion(timeSignature);
}
```

---

#### `addVoiceCountdownRegion()`

**Current** (Phase 7 - 7 lines):
```typescript
addVoiceCountdownRegion(timeSignature: {
  numerator: number;
  denominator: number;
}): void {
  // Phase 7: Delegate to ConfigurationCoordinator
  this.configurationCoordinator.addVoiceCountdownRegion(
    timeSignature,
    this.tracks,
    this.countdownManager,
  );
}
```

**New** (Phase 8 - 3 lines):
```typescript
addVoiceCountdownRegion(timeSignature: {
  numerator: number;
  denominator: number;
}): void {
  // Phase 8: Delegate to ConfigurationManagementService
  this.configurationManagementService.addVoiceCountdownRegion(timeSignature);
}
```

---

### 2. Buffer Configuration Methods (Currently Phase 7 → BufferCoordinator)

#### `setAudioContext()`

**Current** (Phase 7 - 18 lines):
```typescript
setAudioContext(context: AudioContext): void {
  this.audioContext = context;
  this.sampleRate = this.bufferCoordinator.setAudioContext(
    context,
    this.bufferRegistry,
    {
      voiceCue: this.voiceCueScheduler,
      metronome: this.metronomeScheduler,
      drum: this.drumScheduler,
      bass: this.bassScheduler,
    },
    this.eventRouter,
    this.eventBus,
    this.harmonyScheduler,
    this.trackTimingAccuracy.bind(this),
    this.timingMetricsCollector,
    this.cc64TimelineBuilder,
  );
}
```

**New** (Phase 8 - 3 lines):
```typescript
setAudioContext(context: AudioContext): void {
  // Phase 8: Delegate to BufferConfigurationService
  this.bufferConfigurationService.setAudioContext(context);
}
```

---

#### `setMetronomeBuffers()`

**Current** (Phase 7 - 9 lines):
```typescript
setMetronomeBuffers(
  accent: AudioBuffer,
  click: AudioBuffer,
  destination: AudioNode,
): void {
  this.bufferCoordinator.setMetronomeBuffers(
    accent,
    click,
    destination,
    this.bufferRegistry,
    this.metronomeScheduler,
  );
  this.audioDestination = this.bufferRegistry.getAudioDestination();
}
```

**New** (Phase 8 - 4 lines):
```typescript
setMetronomeBuffers(
  accent: AudioBuffer,
  click: AudioBuffer,
  destination: AudioNode,
): void {
  // Phase 8: Delegate to BufferConfigurationService
  this.bufferConfigurationService.setMetronomeBuffers(accent, click, destination);
}
```

---

#### `setDrumBuffers()`

**Current** (Phase 7 - 11 lines):
```typescript
setDrumBuffers(
  kick: AudioBuffer,
  snare: AudioBuffer,
  hihat: AudioBuffer,
  destination: AudioNode,
): void {
  this.bufferCoordinator.setDrumBuffers(
    kick,
    snare,
    hihat,
    destination,
    this.bufferRegistry,
    this.drumScheduler,
  );
  this.audioDestination = this.bufferRegistry.getAudioDestination();
}
```

**New** (Phase 8 - 5 lines):
```typescript
setDrumBuffers(
  kick: AudioBuffer,
  snare: AudioBuffer,
  hihat: AudioBuffer,
  destination: AudioNode,
): void {
  // Phase 8: Delegate to BufferConfigurationService
  this.bufferConfigurationService.setDrumBuffers(kick, snare, hihat, destination);
}
```

---

#### `setVoiceCueBuffers()`

**Current** (Phase 7 - 9 lines):
```typescript
setVoiceCueBuffers(
  samples: Map<string, AudioBuffer>,
  destination: AudioNode,
): void {
  this.bufferCoordinator.setVoiceCueBuffers(
    samples,
    destination,
    this.bufferRegistry,
    this.voiceCueScheduler,
  );
  this.voiceCueBuffers = samples; // Sync for backward compat
  this.audioDestination = this.bufferRegistry.getAudioDestination();
}
```

**New** (Phase 8 - 4 lines):
```typescript
setVoiceCueBuffers(
  samples: Map<string, AudioBuffer>,
  destination: AudioNode,
): void {
  // Phase 8: Delegate to BufferConfigurationService
  this.bufferConfigurationService.setVoiceCueBuffers(samples, destination);
}
```

---

#### `setHarmonyBuffers()`

**Current** (Phase 7 - 23 lines):
```typescript
async setHarmonyBuffers(
  samples: Map<string, AudioBuffer>,
  destination: AudioNode,
  perNoteVelocityRanges?: Record<string, any[]>,
  instrument?: string,
): Promise<void> {
  const result = await this.bufferCoordinator.setHarmonyBuffers(
    samples,
    destination,
    perNoteVelocityRanges,
    instrument,
    this.bufferRegistry,
    this.harmonyScheduler,
    this.velocityLayerSelector,
  );

  // Sync internal state for backward compatibility
  this.harmonyBuffers = result.harmonyBuffers;
  this.harmonyVelocityRanges = result.harmonyVelocityRanges;
  this.currentHarmonyInstrument = result.currentHarmonyInstrument;
  this.grandPianoKeyboardMap = result.grandPianoKeyboardMap;
  this.audioDestination = this.bufferRegistry.getAudioDestination();
}
```

**New** (Phase 8 - 6 lines):
```typescript
async setHarmonyBuffers(
  samples: Map<string, AudioBuffer>,
  destination: AudioNode,
  perNoteVelocityRanges?: Record<string, any[]>,
  instrument?: string,
): Promise<void> {
  // Phase 8: Delegate to BufferConfigurationService
  await this.bufferConfigurationService.setHarmonyBuffers(
    samples,
    destination,
    perNoteVelocityRanges,
    instrument,
  );
}
```

---

#### `setBassBuffers()`

**Current** (Phase 7 - 10 lines):
```typescript
setBassBuffers(
  samples: Map<string, AudioBuffer>,
  destination: AudioNode,
): void {
  const result = this.bufferCoordinator.setBassBuffers(
    samples,
    destination,
    this.bufferRegistry,
    this.bassScheduler,
  );
  this.bassBuffers = result.bassBuffers; // Sync for backward compat
  this.audioDestination = this.bufferRegistry.getAudioDestination();
}
```

**New** (Phase 8 - 4 lines):
```typescript
setBassBuffers(
  samples: Map<string, AudioBuffer>,
  destination: AudioNode,
): void {
  // Phase 8: Delegate to BufferConfigurationService
  this.bufferConfigurationService.setBassBuffers(samples, destination);
}
```

---

#### `loadGrandPianoKeyboardMap()` (private)

**Current** (Phase 7 - 4 lines):
```typescript
private async loadGrandPianoKeyboardMap(): Promise<void> {
  this.grandPianoKeyboardMap = await this.bufferCoordinator.loadGrandPianoKeyboardMap(
    this.bufferRegistry,
  );
}
```

**New** (Phase 8 - 3 lines):
```typescript
private async loadGrandPianoKeyboardMap(): Promise<void> {
  // Phase 8: Delegate to BufferConfigurationService
  await this.bufferConfigurationService.loadGrandPianoKeyboardMap();
}
```

---

### 3. Scheduling Methods (Currently inline or Phase 6 → RegionScheduler)

#### `scheduleAllRegions()` (private)

**Current** (Phase 6 - 46 lines):
```typescript
private scheduleAllRegions(): void {
  if (this.isScheduling) {
    logger.error('🚨 RegionProcessor: Scheduling already in progress!');
    return;
  }

  this.isScheduling = true;

  try {
    this.debugger.log('RegionProcessor', 'scheduling-all-regions', {
      trackCount: this.tracks.size,
    });

    // Phase 6: Delegate to RegionScheduler
    const result = this.regionScheduler.scheduleAll(
      /* 11 parameters */
    );

    this.currentCC64Timeline = result.currentCC64Timeline;

    logger.info(
      `✅ Scheduled ${result.totalEvents} audio events...`,
    );

  } finally {
    this.isScheduling = false;
  }
}
```

**New** (Phase 8 - 3 lines):
```typescript
private scheduleAllRegions(): void {
  // Phase 8: Delegate to SchedulingOrchestrationService
  this.schedulingOrchestrationService.scheduleAllRegions();
}
```

---

#### `reschedulePendingEvents()` (private)

**Current** (Inline - 106 lines):
```typescript
private reschedulePendingEvents(): void {
  if (!this.isRunning) {
    logger.warn('⚠️ RegionProcessor: Cannot reschedule events - not running');
    return;
  }

  if (this.isScheduling) {
    logger.warn('⚠️ RegionProcessor: Cannot reschedule during active scheduling');
    return;
  }

  // ... 90+ lines of tempo change logic ...

  this.scheduleAllRegions();
}
```

**New** (Phase 8 - 3 lines):
```typescript
private reschedulePendingEvents(): void {
  // Phase 8: Delegate to SchedulingOrchestrationService
  this.schedulingOrchestrationService.reschedulePendingEvents();
}
```

---

#### `calculateExerciseDuration()` (private)

**Current** (Phase 5 - 22 lines):
```typescript
private calculateExerciseDuration(): void {
  const result = this.exerciseDurationCalculator.calculateDuration(
    this.tracks,
    this.countdownEnabled,
    this.countdownOffsetBeats,
  );

  this.exerciseEndTime = result.exerciseEndTime;
  this.lastBeatThreshold = result.lastBeatThreshold;

  // Phase 3: Sync exercise timing to SustainPedalAnalyzer
  this.sustainPedalAnalyzer.setExerciseTiming(
    this.exerciseEndTime,
    this.lastBeatThreshold,
  );

  // Phase 4: Sync exercise timing to HarmonyScheduler
  this.harmonyScheduler.setExerciseTiming(
    this.exerciseEndTime,
    this.lastBeatThreshold,
  );
}
```

**New** (Phase 8 - 3 lines):
```typescript
private calculateExerciseDuration(): void {
  // Phase 8: Delegate to SchedulingOrchestrationService
  this.schedulingOrchestrationService.calculateExerciseDuration();
}
```

---

#### `processCurrentPosition()` (private)

**Current** (Phase 5 - 13 lines):
```typescript
private processCurrentPosition(): void {
  this.backupScheduler.processPosition(
    this.isRunning,
    this.tracks,
    this.scheduledEvents,
    this.scheduledIds,
    this.countdownEnabled,
    this.countdownOffsetBeats,
    this.parsePosition.bind(this),
    this.getInstrumentType.bind(this),
    this.emitEvent.bind(this),
  );
}
```

**New** (Phase 8 - 3 lines):
```typescript
private processCurrentPosition(): void {
  // Phase 8: Delegate to SchedulingOrchestrationService
  this.schedulingOrchestrationService.processCurrentPosition();
}
```

---

### 4. Track Management Methods (Currently Phase 6 → TrackManager)

#### `registerTracks()`

**Current** (Phase 6 - 40 lines with harmony validation):
```typescript
registerTracks(tracks: Track[]): void {
  this.trackManager.registerTracks(
    tracks,
    this.tracks,
    this.scheduledEvents,
    this.clearTrackEvents.bind(this),
    this.clearHarmonyState.bind(this),
    this.debugger.log.bind(this.debugger),
  );

  // CRITICAL FIX: Defensive check for multiple harmony tracks
  const registeredHarmonyTracks = Array.from(this.tracks.values()).filter(
    (t) => t.instrumentType === 'harmony',
  );
  if (registeredHarmonyTracks.length > 1) {
    // ... 20 lines of validation logging ...
  }
}
```

**New** (Phase 8 - 3 lines):
```typescript
registerTracks(tracks: Track[]): void {
  // Phase 8: Delegate to TrackRegistrationService
  this.trackRegistrationService.registerTracks(tracks);
}
```

---

#### `updateTracks()`

**Current** (Phase 6 - 14 lines):
```typescript
updateTracks(
  tracks: Track[],
  exerciseMetadata?: { harmonyInstrument?: string },
): void {
  this.trackManager.updateTracks(
    tracks,
    exerciseMetadata,
    this.isRunning,
    this.tracks,
    this.scheduledEvents,
    /* 8 more callback parameters */
  );
}
```

**New** (Phase 8 - 4 lines):
```typescript
updateTracks(
  tracks: Track[],
  exerciseMetadata?: { harmonyInstrument?: string },
): void {
  // Phase 8: Delegate to TrackRegistrationService
  this.trackRegistrationService.updateTracks(tracks, exerciseMetadata);
}
```

---

### 5. Plugin Management (Currently inline)

#### `setPluginManager()`

**Current** (6 lines):
```typescript
setPluginManager(pluginManager: PluginManager): void {
  this.pluginManager = pluginManager;
  logger.info('✅ PluginManager injected into RegionProcessor', {
    instanceId: this._instanceId,
  });
}
```

**New** (Phase 8 - 3 lines):
```typescript
setPluginManager(pluginManager: PluginManager): void {
  // Phase 8: Delegate to ConfigurationManagementService
  this.configurationManagementService.setPluginManager(pluginManager);
}
```

---

## Summary of Line Reductions

| Method | Current Lines | New Lines | Saved |
|--------|--------------|-----------|-------|
| enableCountdown | 8 | 3 | 5 |
| disableCountdown | 8 | 3 | 5 |
| addCountdownRegion | 7 | 3 | 4 |
| addVoiceCountdownRegion | 7 | 3 | 4 |
| setAudioContext | 18 | 3 | 15 |
| setMetronomeBuffers | 9 | 4 | 5 |
| setDrumBuffers | 11 | 5 | 6 |
| setVoiceCueBuffers | 9 | 4 | 5 |
| setHarmonyBuffers | 23 | 6 | 17 |
| setBassBuffers | 10 | 4 | 6 |
| loadGrandPianoKeyboardMap | 4 | 3 | 1 |
| scheduleAllRegions | 46 | 3 | 43 |
| reschedulePendingEvents | 106 | 3 | 103 |
| calculateExerciseDuration | 22 | 3 | 19 |
| processCurrentPosition | 13 | 3 | 10 |
| registerTracks | 40 | 3 | 37 |
| updateTracks | 14 | 4 | 10 |
| setPluginManager | 6 | 3 | 3 |
| **TOTAL** | **361** | **63** | **298** |

**Total Line Reduction: ~298 lines** just from these method transformations!

Combined with constructor cleanup and removing duplicate state management, we should achieve the **~650 line target** for RegionProcessor.
