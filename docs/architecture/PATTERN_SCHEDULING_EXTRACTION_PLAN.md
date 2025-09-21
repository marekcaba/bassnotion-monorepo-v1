# Pattern Scheduling System Extraction Plan

## Overview
The PatternScheduler provides professional DAW-style pattern scheduling with region-based playback, lookahead scheduling, and sample-accurate timing. This is CRITICAL for professional sequencing features.

## Current System Analysis

### PatternScheduler Features:

1. **Region-Based Scheduling**
   - Track region management with start/duration
   - Pattern and MIDI event conversion
   - Region bounds checking and activation
   - Multiple region support per track

2. **Advanced Looping System**
   - Infinite loops (loopCount = 0)
   - Finite loop counting
   - Loop iteration tracking
   - Per-loop event scheduling

3. **Lookahead Scheduling (200ms)**
   - Predictive event scheduling
   - Sample-accurate timing precision (1ms)
   - Missed event detection and handling
   - Priority-based event processing

4. **Professional Performance Features**
   - Binary search optimization for large event lists
   - Maximum events per cycle (50) to prevent blocking
   - CPU usage estimation
   - Performance metrics tracking

5. **Musical Time Conversion**
   - Musical position to seconds conversion
   - Beat-based calculations
   - Time signature support
   - Tick-level precision (960 PPQ)

6. **Integration Points**
   - UnifiedTransport scheduling integration
   - EventBus for communication
   - PatternConverter for event transformation
   - Track system for region updates

## Key Capabilities to Preserve

### 1. Region Management
```typescript
interface ScheduledRegion {
  region: Region;
  trackId: string;
  nextEventIndex: number;
  events: SchedulableEvent[];
  lastScheduledTime: number;
  currentLoop: number;
  loopStartTime: number;
}
```

### 2. Lookahead Scheduling
- 200ms lookahead window
- 2.67ms scheduling interval
- 1ms timing precision
- Sample-accurate event placement

### 3. Loop Handling
- Infinite and finite loop support
- Loop iteration calculations
- Per-loop event offset computation
- Automatic loop advancement

### 4. Performance Optimization
- Binary search for large patterns
- Event batching (50 events max per cycle)
- CPU usage monitoring
- Missed event tracking

## Extraction Strategy

### Option 1: Add to Transport Module (Recommended)
Create a patterns layer within the transport module:
```
modules/transport/
├── core/
├── sync/
├── patterns/                      # NEW
│   ├── PatternScheduler.ts        # Core scheduling
│   ├── RegionManager.ts           # Region lifecycle
│   ├── LoopController.ts          # Loop logic
│   ├── EventScheduler.ts          # Event timing
│   └── types.ts                   # Pattern types
└── index.ts
```

### Option 2: Create Separate Patterns Module
```
modules/patterns/
├── core/
│   ├── Scheduler.ts
│   ├── RegionManager.ts
│   └── EventProcessor.ts
├── conversion/
│   ├── PatternConverter.ts
│   └── MidiConverter.ts
├── timing/
│   ├── LookaheadScheduler.ts
│   └── MusicalTimeConverter.ts
└── index.ts
```

## Implementation Steps

### Phase 1: Extract Core Scheduling Logic
1. Create PatternScheduler in modules/transport/patterns/
2. Extract region management
3. Extract lookahead scheduling
4. Preserve all timing constants

### Phase 2: Extract Loop System
1. Extract loop iteration logic
2. Preserve infinite/finite loop handling
3. Maintain loop offset calculations
4. Keep loop advancement logic

### Phase 3: Extract Performance Features
1. Extract binary search optimization
2. Preserve event batching
3. Maintain performance metrics
4. Keep CPU usage monitoring

### Phase 4: Integration & Testing
1. Connect to Transport scheduler
2. Maintain EventBus integration
3. Preserve PatternConverter usage
4. Create comprehensive tests

## Critical Dependencies

### Musical Time Utilities (regionUtils.ts)
- `compareMusicalPositions`
- `addMusicalTime`
- `musicalPositionToSeconds`
- `subtractMusicalTime`

### Pattern Conversion (PatternConverter.ts)
- `patternToEvents` method
- SchedulableEvent format
- Priority handling

### Transport Integration
- scheduleEvent method usage
- Lookahead timing alignment
- Transport state event handling

## Risk Assessment

### High-Risk Areas
1. **Musical Time Calculations** - Any error breaks timing
2. **Loop Logic** - Complex iteration math
3. **Lookahead Scheduling** - Timing-critical performance
4. **Event Conversion** - Pattern to audio event mapping

### Mitigation Strategies
1. Preserve all mathematical algorithms exactly
2. Extensive loop testing with various patterns
3. Performance benchmarking
4. Musical accuracy validation

## Success Criteria
1. All region-based playback continues working
2. Loop functionality preserved (infinite and finite)
3. Lookahead scheduling maintains 200ms window
4. No performance degradation
5. All musical time calculations preserved
6. Pattern conversion continues working

## Files Dependencies to Investigate
- `PatternConverter.ts` - Event conversion logic
- `regionUtils.ts` - Musical time utilities
- `Region.ts` types - Region data structures
- `Pattern.ts` types - Pattern definitions

## Next Steps
1. Analyze PatternConverter.ts dependencies
2. Create modules/transport/patterns/ structure
3. Extract core PatternScheduler class
4. Preserve all musical time algorithms
5. Create comprehensive test suite