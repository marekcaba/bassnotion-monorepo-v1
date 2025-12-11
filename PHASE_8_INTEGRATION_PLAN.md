# Phase 8 Integration Plan - RegionProcessor Service Layer

## Status: Services Created ✅ | Integration: In Progress 🚧

## Completed Steps

### 1. Service Creation ✅

- [x] IApplicationServices.ts (~230 lines) - Service interfaces
- [x] TrackRegistrationService.ts (~187 lines)
- [x] BufferConfigurationService.ts (~268 lines)
- [x] ConfigurationManagementService.ts (~152 lines)
- [x] SchedulingOrchestrationService.ts (~336 lines)
- [x] index.ts (~50 lines) - Clean exports

**Total: ~1,223 lines of new Application Services code**

### 2. RegionProcessor Updates ✅

- [x] Added Phase 8 imports
- [x] Added service property declarations

## Remaining Integration Steps

### Step 3: Instantiate Services in Constructor

Add to constructor (after line 345):

```typescript
// Phase 8: Instantiate application services
this.trackRegistrationService = new TrackRegistrationService(
  this._instanceId,
  {
    trackManager: this.trackManager,
    tracks: this.tracks,
    scheduledEvents: this.scheduledEvents,
    activeHarmonySources: this.activeHarmonySources,
    currentCC64Timeline: this.currentCC64Timeline,
    getIsRunning: () => this.isRunning,
  },
  {
    clearTrackEvents: this.clearTrackEvents.bind(this),
    clearHarmonyState: this.clearHarmonyState.bind(this),
    registerTracks: this.registerTracks.bind(this),
    scheduleAllRegions: this.scheduleAllRegions.bind(this),
    loadGrandPianoKeyboardMap: this.loadGrandPianoKeyboardMap.bind(this),
    getGrandPianoKeyboardMap: () => this.grandPianoKeyboardMap,
    setCurrentHarmonyInstrument: (instrument) => {
      this.currentHarmonyInstrument = instrument;
    },
  },
);

this.bufferConfigurationService = new BufferConfigurationService(
  this._instanceId,
  {
    bufferCoordinator: this.bufferCoordinator,
    bufferRegistry: this.bufferRegistry,
    velocityLayerSelector: this.velocityLayerSelector,
    metronomeScheduler: this.metronomeScheduler,
    drumScheduler: this.drumScheduler,
    voiceCueScheduler: this.voiceCueScheduler,
    harmonyScheduler: this.harmonyScheduler,
    bassScheduler: this.bassScheduler,
    eventRouter: this.eventRouter,
    eventBus: this.eventBus,
    timingMetricsCollector: this.timingMetricsCollector,
    cc64TimelineBuilder: this.cc64TimelineBuilder,
    trackTimingAccuracy: this.trackTimingAccuracy.bind(this),
  },
  {
    setAudioContext: (context) => {
      this.audioContext = context;
    },
    setSampleRate: (rate) => {
      this.sampleRate = rate;
    },
    setAudioDestination: (destination) => {
      this.audioDestination = destination;
    },
    setHarmonyState: (state) => {
      this.harmonyBuffers = state.harmonyBuffers;
      this.harmonyVelocityRanges = state.harmonyVelocityRanges;
      this.currentHarmonyInstrument = state.currentHarmonyInstrument;
      this.grandPianoKeyboardMap = state.grandPianoKeyboardMap;
    },
    setBassBuffers: (buffers) => {
      this.bassBuffers = buffers;
    },
    setVoiceCueBuffers: (buffers) => {
      this.voiceCueBuffers = buffers;
    },
  },
);

this.configurationManagementService = new ConfigurationManagementService(
  this._instanceId,
  {
    configurationCoordinator: this.configurationCoordinator,
    countdownManager: this.countdownManager,
    scheduleCache: this.scheduleCache,
    cc64TimelineBuilder: this.cc64TimelineBuilder,
    tracks: this.tracks,
  },
  {
    setCountdownOffsetBeats: (beats) => {
      this.countdownOffsetBeats = beats;
    },
    setPluginManager: (pluginManager) => {
      this.pluginManager = pluginManager;
    },
  },
);

this.schedulingOrchestrationService = new SchedulingOrchestrationService(
  this._instanceId,
  {
    regionScheduler: this.regionScheduler,
    backupScheduler: this.backupScheduler,
    exerciseDurationCalculator: this.exerciseDurationCalculator,
    timingMetricsCollector: this.timingMetricsCollector,
    cc64TimelineBuilder: this.cc64TimelineBuilder,
    sustainPedalAnalyzer: this.sustainPedalAnalyzer,
    harmonyScheduler: this.harmonyScheduler,
    countdownManager: this.countdownManager,
    tracks: this.tracks,
    scheduledEvents: this.scheduledEvents,
    scheduledIds: this.scheduledIds,
    scheduledAudioSources: this.scheduledAudioSources,
    audioContext: this.audioContext,
    countdownEnabled: this.countdownEnabled,
    countdownOffsetBeats: this.countdownOffsetBeats,
    exerciseEndTime: this.exerciseEndTime,
    lastBeatThreshold: this.lastBeatThreshold,
    currentCC64Timeline: this.currentCC64Timeline,
    getIsRunning: () => this.isRunning,
    getIsScheduling: () => this.isScheduling,
    setIsScheduling: (value) => {
      this.isScheduling = value;
    },
    getTransportStartTime: () => this.transportStartTime,
    setTransportStartTime: (time) => {
      this.transportStartTime = time;
    },
  },
  {
    getInstrumentType: this.getInstrumentType.bind(this),
    parsePositionToObject: this.parsePositionToObject.bind(this),
    parsePosition: this.parsePosition.bind(this),
    buildCC64Timeline: this.buildCC64Timeline.bind(this),
    logCC64DiagnosticTable: this.logCC64DiagnosticTable.bind(this),
    getCachedSchedule: this.getCachedSchedule.bind(this),
    setCachedSchedule: this.setCachedSchedule.bind(this),
    emitEvent: this.emitEvent.bind(this),
    setCurrentCC64Timeline: this.setCurrentCC64Timeline.bind(this),
    setExerciseEndTime: (time) => {
      this.exerciseEndTime = time;
    },
    setLastBeatThreshold: (threshold) => {
      this.lastBeatThreshold = threshold;
    },
    setCurrentCC64TimelineState: (timeline) => {
      this.currentCC64Timeline = timeline;
    },
  },
);
```

### Step 4: Delegate Public Methods to Services

#### Track Registration Methods

Replace existing implementations with delegation:

```typescript
registerTracks(tracks: Track[]): void {
  this.trackRegistrationService.registerTracks(tracks);
}

updateTracks(
  tracks: Track[],
  exerciseMetadata?: { harmonyInstrument?: string },
): void {
  this.trackRegistrationService.updateTracks(tracks, exerciseMetadata);
}
```

#### Buffer Configuration Methods

Replace all `setAudioContext` and buffer setter methods:

```typescript
setAudioContext(context: AudioContext): void {
  this.bufferConfigurationService.setAudioContext(context);
}

setMetronomeBuffers(
  accent: AudioBuffer,
  click: AudioBuffer,
  destination: AudioNode,
): void {
  this.bufferConfigurationService.setMetronomeBuffers(accent, click, destination);
}

// Similar for: setDrumBuffers, setVoiceCueBuffers, setHarmonyBuffers, setBassBuffers
```

#### Configuration Management Methods

Replace countdown and plugin configuration:

```typescript
enableCountdown(timeSignature: {
  numerator: number;
  denominator: number;
}): void {
  this.configurationManagementService.enableCountdown(timeSignature);
}

disableCountdown(): void {
  this.configurationManagementService.disableCountdown();
}

addCountdownRegion(timeSignature: {
  numerator: number;
  denominator: number;
}): void {
  this.configurationManagementService.addCountdownRegion(timeSignature);
}

addVoiceCountdownRegion(timeSignature: {
  numerator: number;
  denominator: number;
}): void {
  this.configurationManagementService.addVoiceCountdownRegion(timeSignature);
}

setPluginManager(pluginManager: PluginManager): void {
  this.configurationManagementService.setPluginManager(pluginManager);
}
```

#### Scheduling Orchestration Methods

Replace scheduling coordination:

```typescript
private scheduleAllRegions(): void {
  this.schedulingOrchestrationService.scheduleAllRegions();
}

private reschedulePendingEvents(): void {
  this.schedulingOrchestrationService.reschedulePendingEvents();
}

private processCurrentPosition(): void {
  this.schedulingOrchestrationService.processCurrentPosition();
}

private calculateExerciseDuration(): void {
  this.schedulingOrchestrationService.calculateExerciseDuration();
}
```

## Expected Results After Integration

### Line Count Reduction

- **Current**: 1,306 lines
- **Expected After Phase 8**: ~650-700 lines (50% reduction)
- **Reduction**: ~600-650 lines

### Breakdown:

- Imports: +22 lines
- Property declarations: +4 lines
- Constructor service instantiation: +150 lines
- Method delegation: -600 lines (replaced with 1-2 line calls)
- **Net**: -424 to -474 lines

### Code Quality Improvements

✅ Following Google SRE: "Small and focused"
✅ Following Netflix: Loose coupling via service layer
✅ Following Meta SOLID: Single Responsibility Principle
✅ Clear separation of concerns
✅ Easy to test (mock services)
✅ Ready for Phase 9 (DI Container)

## Testing Strategy

### 1. Unit Tests for Each Service (Phase 8 - Step 7)

- TrackRegistrationService.test.ts
- BufferConfigurationService.test.ts
- ConfigurationManagementService.test.ts
- SchedulingOrchestrationService.test.ts

### 2. Integration Tests (Phase 8 - Step 8)

- Verify all existing RegionProcessor tests pass
- Verify Phase 4 integration tests pass
- Zero breaking changes

## Next Actions

1. ✅ Service interfaces created
2. ✅ Services implemented
3. ✅ Imports added to RegionProcessor
4. ✅ Property declarations added
5. 🚧 Instantiate services in constructor
6. ⏳ Delegate public methods to services
7. ⏳ Create comprehensive service tests
8. ⏳ Verify zero breaking changes

## Benefits

### Immediate

- 50% line reduction in RegionProcessor
- Clear service boundaries
- Improved testability

### Phase 9 Ready

- Services use clean dependency injection
- Easy to wire into DI Container
- Prepared for event-driven coordination

### Long-term

- Foundation for microservices architecture
- Independent service deployment
- Easier onboarding for new developers
