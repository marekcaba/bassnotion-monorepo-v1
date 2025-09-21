# Transport Module Extraction Plan

## Overview

Extract transport-related functionality from UnifiedTransport.ts (3,107 lines) into a modular structure within the playback domain.

## UnifiedTransport Analysis

### Current Responsibilities (Too Many!)

1. **Timing & Clock Management**
   - Hardware clock synchronization
   - AudioWorklet timing
   - Web Worker fallback
   - Drift compensation & prediction

2. **Transport Control**
   - Start/stop/pause/resume
   - Seek operations
   - State management
   - Position tracking

3. **Event Scheduling**
   - Event queue management
   - Tone.js scheduling integration
   - Priority-based scheduling
   - Look-ahead scheduling

4. **Musical Time**
   - Bar:Beat:Sixteenth conversion
   - Tempo management
   - Time signature handling
   - Quantization

5. **Performance Monitoring**
   - Timing metrics
   - Drift analysis
   - CPU load tracking
   - Buffer health

6. **Integration**
   - EventBus communication
   - AudioEngine coordination
   - CommandQueue handling
   - Circuit breaker pattern

## Extraction Strategy

### Phase 1: Extract Types

Create `types/index.ts` with all transport-related types:

```typescript
// types/index.ts
export interface MusicalPosition { ... }
export interface TransportPosition { ... }
export interface TimeSignature { ... }
export type TransportState = 'stopped' | 'playing' | 'paused';
export interface TimingEvent { ... }
export interface TimingMetrics { ... }
export interface TransportConfig { ... }
```

### Phase 2: Extract Core Components

#### 2.1 Clock.ts

Responsibilities:

- Hardware clock synchronization
- AudioContext time management
- Clock drift compensation
- Time source abstraction

Extract from UnifiedTransport:

- `useHardwareClock`, `hardwareClockOffset`
- `clockSyncInterval`, `clockSyncHistory`
- `syncHardwareClock()`, `getAudioTime()`
- `calculateClockOffset()`

#### 2.2 Timeline.ts

Responsibilities:

- Musical position tracking
- Bar:Beat:Sixteenth calculations
- Position conversion utilities
- Seek position management

Extract from UnifiedTransport:

- `getPosition()`, `seek()`
- `convertMusicalToSeconds()`, `convertSecondsToMusical()`
- Position state management
- Quantization logic

#### 2.3 Scheduler.ts

Responsibilities:

- Event queue management
- Look-ahead scheduling
- Priority-based scheduling
- Tone.js integration

Extract from UnifiedTransport:

- `eventQueue`, `scheduledEvents`
- `schedule()`, `scheduleImmediate()`, `scheduleOnce()`
- `processScheduleQueue()`, `cleanupScheduledEvents()`
- Event priority handling

#### 2.4 Transport.ts (Main Coordinator)

Responsibilities:

- High-level transport control
- State management
- Component coordination
- Public API

Will use extracted components:

- Clock for timing
- Timeline for position
- Scheduler for events
- Sync components for timing accuracy

### Phase 3: Extract Sync Components

#### 3.1 TransportSync.ts

Responsibilities:

- Multi-component synchronization
- State consistency
- Event coordination

#### 3.2 LatencyCompensation.ts

Responsibilities:

- Output latency tracking
- Compensation calculations
- Adaptive adjustments

Extract from UnifiedTransport:

- Latency measurement logic
- Compensation algorithms
- Buffer management

#### 3.3 BeatGrid.ts

Responsibilities:

- Beat alignment
- Grid snapping
- Quantization helpers

### Phase 4: Pattern Support

Move existing pattern handling:

- `PatternScheduler.ts` (already exists in core)
- `PatternConverter.ts` (already exists in core)
- Create Pattern types and interfaces

## Implementation Order

1. **Create type definitions** (30 min)
   - Extract all interfaces/types to types/index.ts
   - Create types/errors.ts for TransportError

2. **Create Clock.ts** (2 hours)
   - Extract clock-related code
   - Create IClock interface
   - Unit tests

3. **Create Timeline.ts** (2 hours)
   - Extract position management
   - Create ITimeline interface
   - Unit tests

4. **Create Scheduler.ts** (3 hours)
   - Extract scheduling logic
   - Create IScheduler interface
   - Integration with Tone.js
   - Unit tests

5. **Create Transport.ts** (4 hours)
   - Implement main coordinator
   - Use extracted components
   - Maintain backward compatibility
   - Integration tests

6. **Update UnifiedTransport.ts** (2 hours)
   - Delegate to new Transport module
   - Maintain existing API
   - Deprecation warnings

## Success Criteria

1. **Functional**
   - All existing transport functionality works
   - No breaking changes to public API
   - Tests pass

2. **Architecture**
   - Each file < 500 lines
   - Clear single responsibilities
   - Well-defined interfaces
   - No circular dependencies

3. **Performance**
   - No timing regression
   - Same or better CPU usage
   - Maintained timing accuracy

## Risks & Mitigation

1. **Risk**: Breaking existing functionality
   - **Mitigation**: Extensive testing, gradual migration

2. **Risk**: Timing accuracy degradation
   - **Mitigation**: Performance benchmarks before/after

3. **Risk**: Complex integration
   - **Mitigation**: Keep UnifiedTransport as facade initially

## Next Steps

1. Start with type extraction
2. Create Clock.ts with tests
3. Gradually extract each component
4. Update UnifiedTransport to delegate
5. Eventually deprecate UnifiedTransport
