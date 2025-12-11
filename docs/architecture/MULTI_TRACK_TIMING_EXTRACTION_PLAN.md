# Multi-Track Timing Synchronization Extraction Plan

## Overview

The MultiTrackTimingSynchronizer provides sample-accurate synchronization across multiple tracks using AudioWorklet master clock. This is a CRITICAL feature for professional audio playback.

## Current System Analysis

### MultiTrackTimingSynchronizer Features:

1. **Per-Track Timing State Management**
   - Individual drift measurement and compensation
   - Priority-based scheduling
   - Error isolation to prevent cascade failures
   - Drift history tracking for averaging

2. **Sample-Accurate Scheduling**
   - AudioWorklet integration for precise timing
   - Musical position to sample conversion
   - Per-track compensation offsets
   - Event scheduling with Tone.js Transport

3. **Drift Compensation Algorithms**
   - Real-time drift measurement
   - Averaging over history window
   - Automatic compensation application
   - Configurable tolerance (1ms default)

4. **Cross-Track Synchronization Monitoring**
   - 100ms sync check intervals
   - Per-track metrics calculation
   - Overall sync health scoring
   - Warning generation system

5. **Timing Isolation**
   - Error threshold before isolation (5 errors)
   - Prevents cascade failures
   - Track-specific error recovery
   - Active/inactive state management

## Key Capabilities to Preserve

### 1. Track Registration & State

```typescript
interface TrackTimingState {
  trackId: string;
  lastScheduledTime: number;
  lastAudioWorkletTime: number;
  driftMeasurement: number;
  driftHistory: number[];
  compensationOffset: number;
  priority: number;
  isActive: boolean;
  errorCount: number;
}
```

### 2. Sample-Accurate Event Scheduling

- Musical position to seconds conversion
- Priority-based event scheduling
- Compensation offset application
- Tone.js Transport integration

### 3. Drift Measurement & Compensation

- Real-time drift calculation
- Historical averaging
- Automatic compensation
- Sample-level accuracy tracking

### 4. Health Monitoring

- Per-track stability metrics
- Cross-track sync validation
- Error rate tracking
- Warning generation

## Extraction Strategy

### Option 1: Add to Tracks Module (Recommended)

Create a timing synchronization layer within the tracks module:

```
modules/tracks/
├── core/
│   ├── Track.ts
│   ├── TrackManager.ts
│   └── Region.ts
├── timing/                        # NEW
│   ├── TrackTimingSynchronizer.ts
│   ├── DriftCompensator.ts
│   ├── TimingState.ts
│   └── SyncMonitor.ts
├── mixing/
└── index.ts
```

### Option 2: Create Separate Timing Module

```
modules/timing/
├── core/
│   ├── TimingSynchronizer.ts
│   └── AudioWorkletClock.ts
├── tracks/
│   ├── TrackTimingManager.ts
│   └── DriftCompensator.ts
├── monitoring/
│   ├── SyncMonitor.ts
│   └── HealthReporter.ts
└── index.ts
```

## Implementation Steps

### Phase 1: Extract Core Timing Logic

1. Create TrackTimingSynchronizer class in modules/tracks/timing/
2. Extract timing state management
3. Extract drift measurement algorithms
4. Maintain singleton pattern

### Phase 2: Extract Scheduling System

1. Extract sample-accurate scheduling logic
2. Preserve musical position conversion
3. Maintain Tone.js integration
4. Keep priority-based scheduling

### Phase 3: Extract Monitoring & Health

1. Extract sync monitoring system
2. Preserve metrics calculation
3. Maintain warning generation
4. Keep health scoring

### Phase 4: Integration & Testing

1. Connect to existing Track system
2. Maintain EventBus integration
3. Create comprehensive tests
4. Ensure backward compatibility

## Risk Assessment

### High-Risk Areas

1. **AudioWorklet Integration** - Critical for sample accuracy
2. **Tone.js Scheduling** - Must maintain exact timing
3. **Drift Compensation** - Algorithm precision critical
4. **Event Timing** - Any delays break synchronization

### Mitigation Strategies

1. Line-by-line algorithm preservation
2. Extensive timing tests
3. Performance benchmarking
4. A/B testing with original

## Success Criteria

1. Sample-accurate timing maintained (< 1 sample drift)
2. All drift compensation algorithms preserved
3. Health monitoring continues functioning
4. No performance regression
5. All tests pass

## Dependencies to Consider

- UnifiedTransport for timing source
- EventBus for event propagation
- Tone.js for scheduling
- Track system for integration
- ServiceRegistry for lifecycle

## Next Steps

1. Create modules/tracks/timing/ directory
2. Extract TrackTimingSynchronizer as core class
3. Preserve all timing algorithms exactly
4. Create comprehensive test suite
5. Validate sample accuracy
