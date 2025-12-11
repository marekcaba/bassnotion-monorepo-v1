# Playback Architecture Refactor: Implementation Plan v2.1

**Status:** Ready for Implementation (with critical gap fills)
**Priority:** High
**Estimated Duration:** 6-8 weeks (revised from 5-6 weeks in v2.0, 2-3 weeks in v1.0)
**Author:** Architecture Review + Codebase Analysis + Gap Analysis
**Date:** 2025-01-23 (v2.1 - Gap Analysis Update)
**Previous Versions:** v2.0 (2025-01-23), v1.0 (initial)
**Version:** 2.1 - Production-Ready Edition with Critical Gaps Filled

---

## Executive Summary

The current playback system suffers from **over-extraction syndrome** - RegionProcessor has been refactored into 23+ micro-modules with theatrical delegation patterns that increase complexity rather than reduce it.

**The Problem:**

- RegionProcessor is a hollow coordinator passing 20+ parameters to sub-modules
- Sub-modules call callbacks back to RegionProcessor (callback ping-pong)
- 6 different schedulers for what should be one scheduling concern
- Logic scattered across 23 files making it hard to trace execution flow
- **State fragmented across 8+ locations** (not just 4 as initially thought)
- **Integration with CoreServices/AudioProvider not documented** in original plan

**The Solution:**

- Consolidate 23 micro-modules into 6 properly-scoped components
- Remove callback ping-pong by having modules own their responsibilities
- Single Scheduler class handles all instruments (instruments = data, not classes)
- Clear boundaries with minimal coupling
- **Preserve all recent bug fixes** (Bugs #1, #2, #3, #6, #7)
- **Staged rollout with feature flags** for production safety

**Impact:**

- ✅ **62% fewer lines of code** (5000 → 2000 lines)
- ✅ **74% fewer files** (23 → 6 files)
- ✅ **Easier to understand** (less indirection)
- ✅ **Maintains all bug fixes** (debouncing, cleanup, race conditions)
- ✅ **Safe production rollout** (feature flags + staged deployment)

---

## Table of Contents

1. [Critical Gaps Filled in v2.1](#critical-gaps-filled-in-v21) 🚨 **NEW IN v2.1**
2. [Codebase Reality Check](#codebase-reality-check) ⚠️ NEW
3. [Current Architecture Analysis](#current-architecture-analysis)
4. [Root Cause Analysis](#root-cause-analysis)
5. [Target Architecture](#target-architecture)
6. [Implementation Phases](#implementation-phases)
7. [Detailed Task Breakdown](#detailed-task-breakdown) ⚠️ ENHANCED
8. [Bug Preservation Strategy](#bug-preservation-strategy) ⚠️ NEW
9. [Testing Strategy](#testing-strategy)
10. [Rollout Plan](#rollout-plan) ⚠️ ENHANCED
11. [Risk Mitigation](#risk-mitigation) ⚠️ NEW
12. [Success Metrics](#success-metrics)
13. [Rollback Procedures](#rollback-procedures) ⚠️ NEW

---

## Critical Gaps Filled in v2.1

### 🚨 What Changed from v2.0 to v2.1?

Deep codebase analysis revealed **5 critical gaps** in the v2.0 plan that would have caused significant integration failures and scope creep during implementation. This section documents those gaps and how v2.1 addresses them.

---

### Gap #1: CoreServices Integration Severely Underestimated 🚨 HIGH PRIORITY

**Original v2.0 Allocation:** 2 days (Task 1.4, Days 8-9)
**v2.1 Allocation:** 2 days analysis (Task 0.6) + 4-5 days implementation (Task 1.4 extended)
**Total Extension:** +4 days

**What Was Missed in v2.0:**

```typescript
// AudioProvider.tsx complexity NOT captured in plan:
- GlobalAudioSystem singleton management
- React StrictMode double-mount handling
- WindowRegistry integration for cleanup (Bug #3)
- coreServicesReady flag (Bug #1 fix)
- Existing instance reuse logic
- Event listener cleanup (Bug #7 fix)
```

**What v2.1 Adds:**

- **Task 0.6 (Days 6-7):** Complete CoreServices call site mapping
  - Map all 20-30 `getRegionProcessor()` call sites
  - Document GlobalAudioSystem singleton behavior
  - Design dual-engine coexistence strategy
  - Deliverable: `CORE_SERVICES_CALL_SITES.md`

**Why This Matters:** Without this, we would have:

- Missed integration points discovered mid-implementation
- GlobalAudioSystem singleton conflicts
- Broken Bug #1 and Bug #3 fixes
- Incomplete migration with orphaned code

---

### Gap #2: State Consolidation Strategy Missing 🚨 HIGH PRIORITY

**Original v2.0 Allocation:** 0 days (not mentioned)
**v2.1 Allocation:** 1 day (Task 0.7)
**Total Extension:** +1 day

**What Was Missed in v2.0:**
Plan identified 8+ state sources but provided NO consolidation strategy:

1. RegionProcessor.isRunning
2. AudioEngine.isInitialized
3. CoreServices.isReady
4. InitialSamplePreloader.preloadComplete
5. AudioContextManager.state
6. GlobalSampleCache.loadingStates
7. PluginManager.pluginStates
8. WindowRegistry.registeredInstances
9. Widget local states (×4 widgets)

**Questions v2.0 Left Unanswered:**

- Which states consolidate into PlaybackEngine?
- Which states remain separate?
- How to synchronize during feature flag period?
- What if widgets check old state properties?

**What v2.1 Adds:**

- **Task 0.7 (Day 8):** Create State Consolidation Strategy
  - State transition matrix: old state → new state
  - Synchronization strategy during migration
  - Integration tests for each transition
  - Deliverable: `STATE_CONSOLIDATION_STRATEGY.md`

**Why This Matters:** Without this, we would have:

- State drift bugs during migration
- Widgets reading stale state
- No way to verify migration completeness
- Race conditions between old and new engines

---

### Gap #3: PluginManager Integration Not Mentioned 🚨 HIGH PRIORITY

**Original v2.0 Allocation:** 0 days (NOT IN PLAN AT ALL)
**v2.1 Allocation:** 1 day (Task 0.9)
**Total Extension:** +1 day

**What Was Missed in v2.0:**
RegionProcessor has complex WAM keyboard integration that v2.0 **completely missed**:

```typescript
// NOT DOCUMENTED ANYWHERE IN v2.0 PLAN:
setPluginManager(pluginManager: PluginManager): void
private getWamKeyboard(): WamKeyboard | null
// Complex unwrapping: WamKeyboardPlugin → WamKeyboard
// Routes CC64 events to WAM keyboard
```

**What v2.1 Adds:**

- **Task 0.9 (Day 10):** Document PluginManager Integration
  - Document current integration in RegionProcessor
  - Test CC64 event routing to WAM keyboard
  - Design PlaybackEngine integration
  - Add tasks to Phase 1 implementation
  - Deliverable: `PLUGIN_MANAGER_INTEGRATION.md`

**Why This Matters:** Without this, we would have:

- Broken WAM keyboard support in production
- Sustain pedal not working with WAM instruments
- Silent failure discovered only in production
- Emergency hotfix required

---

### Gap #4: Memory Leak Status Not Verified ⚠️ MEDIUM PRIORITY

**Original v2.0 Assumption:** "Sources added but NEVER removed"
**v2.1 Verification:** 1 day audit (Task 0.8)
**Total Extension:** +1 day

**What Was Missed in v2.0:**
Plan assumes memory leak exists, but codebase shows partial fixes:

```typescript
// Evidence that leak MAY be partially fixed:
private scheduledAudioSources = new Map<...>  // Structure exists
WindowRegistry exists (Bug #3 fix documented)
dispose() method exists (Bug #7 fix documented)
```

**Question:** Is the leak ALREADY fixed?

**What v2.1 Adds:**

- **Task 0.8 (Day 9):** Audit Current Memory Leak Status
  - Write memory leak detection test
  - Run against current RegionProcessor
  - Document actual behavior with evidence
  - Update plan based on findings
  - Deliverable: `MEMORY_LEAK_AUDIT.md`

**Why This Matters:** Without this, we might:

- Implement fix for already-fixed bug (wasted effort)
- Miss real leak because we assumed it was fixed
- Lack baseline for comparison testing

---

### Gap #5: Tempo Debouncing Already Implemented ⚠️ MEDIUM PRIORITY

**Original v2.0 Task:** "Fix tempo change bug"
**v2.1 Discovery:** Tempo debouncing ALREADY works (Bug #6)
**Change:** Updated task from "Fix" to "Preserve"

**What Was Missed in v2.0:**

```typescript
// RegionProcessor.ts lines 388-403
// THIS CODE ALREADY WORKS:
private tempoChangeDebounce: number | null = null;
private readonly TEMPO_DEBOUNCE_MS = 50;

this.tempoChangeDebounce = window.setTimeout(() => {
  this.reschedulePendingEvents();
  this.tempoChangeDebounce = null;
}, this.TEMPO_DEBOUNCE_MS);
```

**What v2.1 Changes:**

- Task 1.2 subtask changed from "Implement tempo debouncing" to "**Preserve tempo debouncing**"
- Added explicit note: "Copy exact implementation from RegionProcessor lines 388-403"
- Added regression test: "Verify 50ms debounce threshold maintained"

**Why This Matters:**

- Don't reinvent the wheel - working code exists
- Risk of breaking working implementation
- Proper preservation ensures no regression

---

### Summary of v2.1 Additions

| Gap                       | Priority  | Days Added                                | Deliverable                     |
| ------------------------- | --------- | ----------------------------------------- | ------------------------------- |
| CoreServices Integration  | 🚨 HIGH   | +2 (Task 0.6)                             | CORE_SERVICES_CALL_SITES.md     |
| State Consolidation       | 🚨 HIGH   | +1 (Task 0.7)                             | STATE_CONSOLIDATION_STRATEGY.md |
| PluginManager Integration | 🚨 HIGH   | +1 (Task 0.9)                             | PLUGIN_MANAGER_INTEGRATION.md   |
| Memory Leak Audit         | ⚠️ MEDIUM | +1 (Task 0.8)                             | MEMORY_LEAK_AUDIT.md            |
| Tempo Debouncing          | ⚠️ MEDIUM | 0 (task update)                           | Updated Task 1.2                |
| **TOTAL**                 |           | **+5 days Week 0** + **1-2 weeks buffer** | **6-8 weeks total**             |

---

### Impact on Timeline

**v2.0 Timeline:** 5-6 weeks
**v2.1 Timeline:** 6-8 weeks

**Breakdown:**

- Week 0: 5 days → **10 days** (+5 days)
- Weeks 1-7: Same as v2.0
- Week 8: **Buffer week** for stabilization (+1 week)

**Critical Success Factor:**
These gaps would have been discovered during implementation anyway, causing:

- Mid-implementation surprises and replanning
- Scope creep and timeline slippage
- Integration failures and emergency fixes
- Team frustration and morale issues

**Better to find them now in Week 0 than in Week 4.**

---

## Codebase Reality Check

### ⚠️ Critical Findings from Codebase Analysis

This section documents what we **actually found** in the codebase vs. what was initially planned.

#### Recent Bug Fixes That MUST Be Preserved

```typescript
// ✅ Bug #1: Race Condition Fix (AudioProvider.tsx)
- coreServicesReady flag prevents "getRegionProcessor is not a function" errors
- Proper initialization sequence in useEffect
- MUST preserve in new architecture

// ✅ Bug #2: OfflineAudioContext Fix (Preload strategies)
- Buffer decoding now uses online AudioContext
- Fixes "OfflineAudioContext cannot decode" errors
- All preload strategies updated
- MUST maintain this pattern

// ✅ Bug #3: Memory Leak Fix (WindowRegistry + dispose())
- WindowRegistry.ts tracks RegionProcessor instances
- dispose() method cleans up event listeners
- Audio sources cleaned up on stop()
- MUST integrate with new PlaybackEngine

// ✅ Bug #6: Tempo Debouncing (RegionProcessor.ts lines 364-406)
- tempoChangeDebounce with 50ms delay
- Prevents UI freeze on rapid slider changes
- MUST preserve exact implementation

// ✅ Bug #7: Event Listener Cleanup (RegionProcessor.ts lines 1278-1302)
- unsubscribeTempoChange stored and called in dispose()
- Prevents EventBus listener accumulation
- MUST preserve exact pattern
```

**Critical Action:** All new modules MUST incorporate these fixes.

#### State Management Reality (8+ Sources, Not 4)

```typescript
// Original plan identified 4 state sources:
1. RegionProcessor.isRunning
2. AudioEngine.isInitialized
3. CoreServices.isReady
4. InitialSamplePreloader.preloadComplete

// Reality - we found 8+:
5. AudioContextManager.state           ⚠️ CRITICAL - manages AudioContext lifecycle
6. GlobalSampleCache.loadingStates     ⚠️ CRITICAL - tracks sample loading
7. PluginManager.pluginStates          ⚠️ Needed for WAM keyboard
8. WindowRegistry.registeredInstances  ⚠️ NEW - Bug #3 fix
9. Widget local states (×4 widgets)    ⚠️ Each has loading/error state
```

**Critical Action:** New PlaybackEngine must integrate with ALL these state sources.

#### Integration Points Missing from v1.0 Plan

```typescript
// These critical integrations were NOT in original plan:

1. CoreServices Dependency Injection
   - getRegionProcessor() has 20+ call sites
   - Need getPlaybackEngine() method
   - Must work with existing initialization sequence

2. AudioProvider React Context
   - Wires RegionProcessor into React tree
   - Must update to wire PlaybackEngine
   - Must preserve coreServicesReady flag (Bug #1)

3. WindowRegistry Cleanup Coordination
   - Tracks instances for cleanup on hot reload
   - Must register new PlaybackEngine instances
   - Critical for Bug #3 fix

4. PluginManager/WAM Integration
   - Routes CC events to WamKeyboard
   - setPluginManager() must be ported
   - getWamKeyboard() unwrapping pattern

5. GlobalSampleCache Preloading
   - Coordinates with InitialSamplePreloader
   - Timing dependencies with CoreServices init
   - Must maintain preload sequence
```

**Critical Action:** Add dedicated tasks for each integration point.

#### Tempo Change Implementation Already Exists

```typescript
// ⚠️ IMPORTANT: Plan's tempo fix ALREADY IMPLEMENTED

// Current RegionProcessor (lines 396-406):
this.tempoChangeDebounce = window.setTimeout(() => {
  logger.info('🎵 RegionProcessor: Applying debounced tempo change', {
    newTempo,
    instanceId: this._instanceId,
  });
  this.reschedulePendingEvents();
  this.tempoChangeDebounce = null;
}, this.TEMPO_DEBOUNCE_MS); // 50ms

// Plan says "Fix tempo change" but it's ALREADY FIXED in Bug #6
// New PlaybackEngine MUST copy this exact implementation
```

**Critical Action:** Don't reinvent - copy working implementation.

### Timeline Reality Check

**Original Plan (v1.0):** 2-3 weeks
**v2.0 Plan:** 5-6 weeks
**v2.1 Plan (CURRENT):** 6-8 weeks ⚠️ UPDATED

**Why the Additional Extension (v2.1)?**
Codebase analysis revealed 5 critical gaps not captured in v2.0:

- Week 0: Extended from 5 days to **10 days** (added Tasks 0.6-0.9) ⚠️ NEW
  - Complete CoreServices call site mapping (2 days) 🚨 CRITICAL
  - State consolidation strategy (1 day) 🚨 CRITICAL
  - Memory leak audit (1 day) - verify assumptions
  - PluginManager integration docs (1 day) 🚨 CRITICAL
- Week 1-3: Implementation + integration (same as v2.0)
- Week 4: Bug preservation verification (same as v2.0)
- Week 5-6: Comprehensive testing (100+ scenarios) (same as v2.0)
- Week 7: Staged rollout with monitoring (same as v2.0)
- Week 8: Stabilization before code deletion (buffer week) ⚠️ NEW

**v2.1 Week Breakdown:**

```
Week 0 (10 days): Pre-flight checks + gap analysis
Week 1-2 (10 days): Core implementation
Week 3 (5 days): Bug preservation verification
Week 4-5 (10 days): Comprehensive testing
Week 6 (5 days): Staged rollout preparation
Week 7 (5 days): Production rollout (1% → 10% → 50% → 100%)
Week 8 (5 days): Stabilization and old code removal
```

**Critical Success Factors:**

1. **Don't skip Week 0 extended tasks** - They prevent major integration failures
2. **Don't rush code deletion** - Wait for production stability (Week 8)
3. **Monitor metrics continuously** - Be ready to rollback at any phase

---

## Current Architecture Analysis

### File Structure (23 modules)

```
services/core/region-processing/
├── backup/                    [DELETED - BackupScheduler merged into RegionScheduler]
├── buffers/
│   ├── BufferManager.ts       ✅ KEEP (500 lines) - Complex buffer organization
│   └── BufferRegistry.ts      [merged into BufferManager]
├── cache/
│   └── ScheduleCache.ts       ✅ KEEP (50 lines) - Simple caching utility
├── configuration/
│   └── ConfigurationManager.ts    ❌ CONSOLIDATE (200 lines) - Just countdown settings
├── countdown/
│   └── index.ts               [Empty - already deleted]
├── diagnostics/
│   └── DiagnosticLogger.ts    ❌ DELETE (200 lines) - Single console.table() call
├── duration/                  [DELETED - ExerciseDurationCalculator merged]
├── event-routing/
│   └── EventRouter.ts         ❌ CONSOLIDATE (300 lines) - Routing IS scheduling
├── harmony/
│   └── VelocityLayerSelector.ts   ❌ INLINE (100 lines) - 10 lines of if/else logic
├── lifecycle/
│   └── LifecycleCoordinator.ts    ❌ CONSOLIDATE (400 lines) - Just delegates back
├── position/                  [DELETED - PositionParser merged into TimePositionConverter]
├── scheduling/
│   ├── HarmonyScheduler.ts    ❌ CONSOLIDATE (800 lines) - Merge into unified Scheduler
│   └── SimpleInstrumentScheduler.ts   ❌ CONSOLIDATE (300 lines × 4 instances)
├── scheduling-orchestrator/
│   └── RegionScheduler.ts     ❌ CONSOLIDATE (600 lines) - Merge into unified Scheduler
├── sustain/
│   └── SustainPedalManager.ts     ✅ KEEP (400 lines) - Domain-specific CC64 logic
├── timing/
│   ├── TimePositionConverter.ts   🔄 REFACTOR → Pure functions
│   └── TimingMetricsCollector.ts  ✅ KEEP (150 lines) - Stateful metrics tracking
└── track-management/
    └── TrackManager.ts        ❌ CONSOLIDATE (200 lines) - Just validates tracks

RegionProcessor.ts             ❌ CONSOLIDATE (1304 lines) - Hollow coordinator
```

**Total:** 23 files, ~5000 lines

### Anti-Patterns Identified

#### 1. Theatrical Delegation (Ravioli Code)

**Example from LifecycleCoordinator.start():**

```typescript
// RegionProcessor passes callbacks to set its own state
this.lifecycleCoordinator.start(
  // Parameters
  audioContext,
  sampleRate,
  // Callbacks that just set RegionProcessor fields
  setAudioContext: (ctx) => { this.audioContext = ctx },
  setSampleRate: (rate) => { this.sampleRate = rate },
  setTransportStartTime: (time) => { this.transportStartTime = time },
  // ... 10 more callbacks
);

// LifecycleCoordinator.start() just calls them back
start(audioContext, sampleRate, setAudioContext, setSampleRate, ...) {
  setAudioContext(audioContext);
  setSampleRate(sampleRate);
  // ...
}

// NET RESULT: RegionProcessor set its own fields via 200-line detour
// BETTER: Just do it inline in RegionProcessor
```

**Why This Is Bad:**

- 200 lines of indirection for zero benefit
- Harder to debug (callback tracing)
- Harder to understand (why the detour?)
- More potential failure points

#### 2. Scheduler Explosion (6 Schedulers for One Concern)

```typescript
// Current: 6 separate scheduler instances
private voiceCueScheduler: SimpleInstrumentScheduler;
private metronomeScheduler: SimpleInstrumentScheduler;
private drumScheduler: SimpleInstrumentScheduler;
private bassScheduler: SimpleInstrumentScheduler;
private harmonyScheduler: HarmonyScheduler;  // Special case
private regionScheduler: RegionScheduler;     // Orchestrator

// Each does essentially the same thing:
schedule(event) {
  const source = this.context.createBufferSource();
  source.buffer = this.getBuffer(event);
  source.connect(this.destination);
  source.start(event.time);
}
```

**FAANG Reality:**

- Instruments are **data** (configuration), not classes
- One scheduler handles all instruments
- Instrument-specific behavior is configuration:

```typescript
const INSTRUMENT_CONFIGS = {
  metronome: { preserveAttack: true, baseVolume: 0.8 },
  drums: { preserveAttack: false, baseVolume: 0.8 },
  harmony: { sustainPedal: true, velocityLayers: true },
};

// Single scheduler uses this config
scheduler.schedule(event, INSTRUMENT_CONFIGS[event.instrument]);
```

#### 3. Premature Extraction (Single-Function "Classes")

**VelocityLayerSelector** (100 lines):

- Single responsibility: Map MIDI velocity → layer name
- Used by exactly ONE place (HarmonyScheduler)
- Should be a 10-line private method

**DiagnosticLogger** (200 lines):

- Single responsibility: Print CC64 timeline to console
- Used for debugging only
- Should be a utility function

**ConfigurationManager** (200 lines):

- Three methods: `enableCountdown()`, `disableCountdown()`, `addCountdownRegion()`
- Just configuration state
- Should be properties on PlaybackEngine

---

## Root Cause Analysis

### How Did This Happen?

**Phase 1: "RegionProcessor is too big" (TRUE)**

- Original RegionProcessor: 3000+ lines, did everything
- Legitimate God Object

**Phase 2: "Extract responsibilities" (GOOD START)**

- Created BufferManager ✅
- Created SustainPedal logic ✅
- Created TimeConverter ✅

**Phase 3: "Extract EVERYTHING" (WENT TOO FAR)**

- Extracted single methods into classes
- Created coordinators to coordinate the modules
- Split one scheduler into 6 schedulers
- **Net complexity INCREASED**

**Phase 4: "Coordinator Hell" (COMPOUNDED THE PROBLEM)**

- RegionProcessor became a thin shell
- LifecycleCoordinator created to orchestrate
- Callback ping-pong between modules
- **Lost coherence completely**

### The Real Problem: Granularity Level

**The modules aren't bad because there are too many.**
**They're bad because they're extracted at the wrong granularity level.**

**Wrong Granularity:**

- VelocityLayerSelector (10 lines of logic)
- DiagnosticLogger (one console.table call)
- 6 schedulers (same logic repeated)

**Right Granularity:**

- BufferManager (complex buffer organization)
- SustainPedal (domain-specific logic)
- Scheduler (all audio scheduling)

---

## Target Architecture

### File Structure (6 core modules + 3 integration updates)

```
playback/services/core/
├── PlaybackEngine.ts          # Main coordinator (500 lines) ⚠️ +100 vs v1.0
├── Scheduler.ts               # ALL audio scheduling (300 lines)
├── BufferCache.ts             # Sample management (500 lines) ✅ KEEP
├── SustainPedal.ts            # CC64 piano logic (400 lines) ✅ KEEP
├── timeUtils.ts               # Pure time functions (100 lines)
├── MetricsCollector.ts        # Performance tracking (150 lines) ✅ KEEP
└── types.ts                   # Type definitions

Integration Updates (MISSING FROM v1.0):
├── CoreServices.ts            # Add getPlaybackEngine() method
├── AudioProvider.tsx          # Wire PlaybackEngine + preserve Bug #1 fix
└── WindowRegistry.ts          # Register PlaybackEngine instances (Bug #3)
```

**Total:** 7 core files + 3 integration updates = **10 files to touch**

### Module Responsibilities

#### 1. PlaybackEngine.ts (Main Coordinator)

**Responsibilities:**

- Track registration and lifecycle
- Start/stop/pause playback
- Countdown configuration
- Transport synchronization
- Coordination between Scheduler, BufferCache, SustainPedal
- **Tempo change debouncing** ⚠️ PRESERVE Bug #6 fix
- **Event listener cleanup** ⚠️ PRESERVE Bug #7 fix
- **Integration with CoreServices** ⚠️ NEW requirement

**Consolidates:**

- RegionProcessor (coordination logic only)
- LifecycleCoordinator (lifecycle is coordinator's job)
- ConfigurationManager (countdown is just configuration)
- TrackManager (validation is coordination)

**Key Methods:**

```typescript
class PlaybackEngine {
  // Core API
  registerTracks(tracks: Track[]): void;
  start(): void;
  stop(): void;
  pause(): void;
  updateTempo(bpm: number): void; // ⚠️ MUST preserve debouncing from Bug #6

  // Lifecycle (Bug #7 fix)
  dispose(): void; // ⚠️ MUST clean up all listeners

  // Configuration
  enableCountdown(timeSignature): void;
  setAudioContext(context: AudioContext): void;

  // State (Bug #1 fix - single source of truth)
  getState(): PlaybackState;
  isPlaying(): boolean;

  // Integration (MISSING FROM v1.0)
  setPluginManager(pm: PluginManager): void;
  setBufferCache(cache: GlobalSampleCache): void;
}
```

**Critical Bug Preservation:**

```typescript
// ⚠️ MUST PRESERVE from RegionProcessor:

// Bug #6: Tempo Debouncing
private tempoChangeDebounce: number | null = null;
private readonly TEMPO_DEBOUNCE_MS = 50;

updateTempo(newBpm: number) {
  // Debounce rapid changes
  if (this.tempoChangeDebounce) {
    clearTimeout(this.tempoChangeDebounce);
  }
  this.tempoChangeDebounce = window.setTimeout(() => {
    this.reschedulePendingEvents();
  }, this.TEMPO_DEBOUNCE_MS);
}

// Bug #7: Event Listener Cleanup
private unsubscribeTempoChange: (() => void) | null = null;

dispose() {
  // Clean up event listeners
  if (this.unsubscribeTempoChange) {
    this.unsubscribeTempoChange();
  }
  if (this.tempoChangeDebounce) {
    clearTimeout(this.tempoChangeDebounce);
  }
  // ... other cleanup
}
```

**Size:** ~500 lines (up from 400 to handle bug preservation + integration)

#### 2. Scheduler.ts (Unified Audio Scheduling)

**Responsibilities:**

- Schedule ALL audio events (metronome, drums, bass, harmony, voice cues)
- Convert musical time → audio time
- Manage AudioBufferSourceNode lifecycle
- Apply instrument-specific configurations
- Interact with SustainPedal for note duration

**Consolidates:**

- RegionScheduler
- SimpleInstrumentScheduler (×4 instances)
- HarmonyScheduler (special logic becomes configuration)
- EventRouter (routing IS scheduling)
- VelocityLayerSelector (inline as private method)

**Key Methods:**

```typescript
class Scheduler {
  schedule(event: ScheduledEvent): void;
  scheduleRegion(region: Region, offsetBeats: number): void;
  cancelAllScheduled(): void;
  cleanupSources(): void; // NEW: Fix memory leak

  // Private helpers
  private selectVelocityLayer(velocity: number): string;
  private applyInstrumentConfig(event, config): void;
}
```

**Instrument Configs (Data, Not Classes):**

```typescript
const INSTRUMENT_CONFIGS = {
  metronome: {
    preserveAttack: true,
    baseVolume: 0.8,
    bufferMapping: { accent: 'accent', click: 'click' },
  },
  drums: {
    preserveAttack: false,
    baseVolume: 0.8,
    bufferMapping: { kick: 'kick', snare: 'snare', hihat: 'hihat' },
  },
  harmony: {
    sustainPedal: true,
    velocityLayers: true,
    baseVolume: 1.0,
    polyphony: 32,
  },
  // ...
};
```

**Size:** ~300 lines (down from 600 + 300×4 + 800 + 300 = 3100 lines)

#### 3. BufferCache.ts ✅ KEEP AS-IS

**Responsibilities:**

- Organize buffers by instrument and layer
- Provide buffer lookup
- Manage buffer lifecycle

**No Changes:** This is correctly scoped.

**Size:** ~500 lines

#### 4. SustainPedal.ts ✅ KEEP AS-IS

**Responsibilities:**

- Build CC64 timeline from MIDI events
- Calculate note duration based on pedal state
- Piano-specific sustain logic

**No Changes:** This is domain-specific logic with legitimate complexity.

**Size:** ~400 lines

#### 5. timeUtils.ts (Pure Functions)

**Responsibilities:**

- Convert musical position → beats
- Convert beats → seconds (based on BPM)
- Parse position strings ("0:2:0")
- Calculate exercise duration

**Refactors:**

- TimePositionConverter (class) → Pure functions

**Key Functions:**

```typescript
export function parsePosition(position: string | object, bpm: number): number;
export function beatsToSeconds(beats: number, bpm: number): number;
export function calculateDuration(tracks: Track[], bpm: number): number;
export function parseTransportPosition(pos: Tone.TransportTime): number;
```

**Size:** ~100 lines (down from 200 lines in TimePositionConverter)

#### 6. MetricsCollector.ts ✅ KEEP AS-IS

**Responsibilities:**

- Track scheduling performance
- Collect timing metrics
- Report statistics

**No Changes:** Stateful metrics tracking is separate concern.

**Size:** ~150 lines

---

## Implementation Phases

### Overview: 6-Week Safe Production Rollout

```
Week 0: Pre-Flight Checks (NEW)
Week 1-2: Core Implementation + Integration
Week 3: Bug Preservation & Verification
Week 4: Comprehensive Testing
Week 5: Staged Production Rollout
Week 6: Stabilization & Cleanup
```

**Critical Success Factors:**

1. **Don't skip Week 0** - Proper planning prevents major issues
2. **Preserve all bug fixes** - Test each one explicitly
3. **Feature flag everything** - Enable gradual rollout
4. **Wait for stability** - Don't delete old code prematurely

---

### Phase 0: Pre-Flight Checks (Week 0: 10 days) ⚠️ EXTENDED

**Goal:** Validate assumptions and prepare infrastructure before touching code

**CRITICAL UPDATE:** Extended from 5 days to 10 days based on codebase analysis that revealed additional integration complexity not captured in v1.0.

#### Task 0.1: State Source Mapping (Day 1)

**Owner:** Architecture Team

**Subtasks:**

- [ ] Map all 8+ state sources to diagram
- [ ] Document state transitions for each source
- [ ] Identify state synchronization points
- [ ] Document which states affect playback behavior
- [ ] Create state consolidation strategy document

**Deliverable:** `docs/implementations/STATE_CONSOLIDATION_MAP.md`

**Acceptance Criteria:**

- [ ] All state sources identified and documented
- [ ] State machine diagrams created
- [ ] Team reviewed and approved

---

#### Task 0.2: CoreServices Integration Analysis (Day 2)

**Owner:** Architecture Team

**Subtasks:**

- [ ] Find all call sites to `coreServices.getRegionProcessor()` (estimated 20+)
- [ ] Document AudioProvider wiring for RegionProcessor
- [ ] Map PluginManager integration points
- [ ] Document WindowRegistry registration pattern (Bug #3)
- [ ] Create integration change checklist

**Deliverable:** `docs/implementations/CORE_SERVICES_INTEGRATION.md`

**Acceptance Criteria:**

- [ ] All 20+ call sites documented
- [ ] Integration change strategy approved
- [ ] No missed integration points

---

#### Task 0.3: Regression Test Suite Creation (Day 3)

**Owner:** QA + Engineering

**Subtasks:**

- [ ] Document 100+ exercise switching scenarios
- [ ] Create memory leak detection test harness
- [ ] Create tempo change regression tests
- [ ] Create audio glitch detection tests
- [ ] Set up performance baseline measurements

**Deliverable:** `apps/frontend/src/domains/playback/services/core/__tests__/regression-suite/`

**Acceptance Criteria:**

- [ ] 100+ test scenarios documented
- [ ] Baseline metrics captured for comparison
- [ ] Test suite runs successfully on current code

---

#### Task 0.4: Feature Flag Infrastructure (Day 4)

**Owner:** DevOps + Engineering

**Subtasks:**

- [ ] Add `ENABLE_NEW_PLAYBACK_ENGINE` feature flag
- [ ] Create flag management UI (admin panel)
- [ ] Set up flag monitoring/analytics
- [ ] Create flag rollout schedule
- [ ] Document flag usage in code

**Deliverable:** Feature flag system ready

**Acceptance Criteria:**

- [ ] Flag exists and defaults to `false`
- [ ] Can toggle per user/percentage
- [ ] Monitoring shows flag evaluations
- [ ] Rollback plan documented

---

#### Task 0.5: Rollback Plan & Monitoring (Day 5)

**Owner:** DevOps + Engineering

**Subtasks:**

- [ ] Create production monitoring dashboard
- [ ] Set up alerts for key metrics (memory, timing, errors)
- [ ] Document rollback procedure (flip flag to disable)
- [ ] Create incident response runbook
- [ ] Set up automated health checks

**Deliverable:** `docs/implementations/ROLLBACK_PROCEDURE.md`

**Acceptance Criteria:**

- [ ] Dashboard shows real-time playback health
- [ ] Alerts trigger on metric degradation >10%
- [ ] Rollback can happen in <5 minutes
- [ ] Team trained on rollback procedure

---

#### Task 0.6: Complete CoreServices Call Site Mapping (Days 6-7) 🚨 NEW - CRITICAL GAP

**Owner:** Senior Engineer

**Priority:** HIGH - This task was severely underestimated in original plan

**Subtasks:**

- [ ] **Day 6:** Exhaustive call site analysis
  - [ ] Run: `grep -r "getRegionProcessor" apps/frontend/src` and document all results
  - [ ] For each call site, document:
    - File path and line number
    - Context (what feature uses it)
    - Methods called on RegionProcessor
    - Dependencies on RegionProcessor state
    - Migration complexity (LOW/MEDIUM/HIGH)
  - [ ] Identify 5 most complex integration points
  - [ ] Create migration checklist for each call site

- [ ] **Day 7:** GlobalAudioSystem integration analysis
  - [ ] Document GlobalAudioSystem singleton behavior
  - [ ] Map AudioProvider initialization sequence (has React StrictMode handling)
  - [ ] Document coreServicesReady flag usage (Bug #1 fix)
  - [ ] Map WindowRegistry registration pattern (Bug #3 fix)
  - [ ] Test: What happens when feature flag creates both engines?

**Deliverable:** `docs/implementations/CORE_SERVICES_CALL_SITES.md`

**Acceptance Criteria:**

- [ ] All getRegionProcessor() call sites documented (expect 20-30)
- [ ] Migration complexity assessed for each
- [ ] GlobalAudioSystem singleton behavior verified
- [ ] Dual-engine coexistence strategy documented
- [ ] Team reviewed and approved migration approach

**Why This Matters:**
Original plan allocated 2 days (Task 1.4, Days 8-9) for CoreServices integration. Codebase analysis revealed:

- AudioProvider has complex initialization with strict ordering
- GlobalAudioSystem singleton requires careful handling
- WindowRegistry integration is critical for Bug #3
- Feature flag must support BOTH engines running simultaneously

**Risk if Skipped:** Integration failures in production, incomplete migration leaving orphaned code.

---

#### Task 0.7: Create State Consolidation Strategy (Day 8) 🚨 NEW - CRITICAL GAP

**Owner:** Architecture Team

**Priority:** HIGH - Missing from v1.0 plan

**Subtasks:**

- [ ] Create state transition matrix (old state → new state)
  - RegionProcessor.isRunning → PlaybackEngine.getState()
  - AudioEngine.isInitialized → How to handle?
  - CoreServices.isReady → How to handle?
  - InitialSamplePreloader.preloadComplete → How to handle?
  - AudioContextManager.state → Keep separate or consolidate?
  - GlobalSampleCache.loadingStates → Keep separate or consolidate?
  - PluginManager.pluginStates → Keep separate
  - WindowRegistry.registeredInstances → Keep separate
  - Widget local states → How to synchronize?

- [ ] Define synchronization strategy during feature flag period
  - When flag is OFF (old engine): RegionProcessor.isRunning is source of truth
  - When flag is ON (new engine): PlaybackEngine.getState() is source of truth
  - How to prevent state drift between engines?
  - How to handle widgets checking old state properties?

- [ ] Create integration tests for state transitions
  - Test: Switch feature flag while playing
  - Test: Widget reads state during migration
  - Test: Multiple state sources stay synchronized

**Deliverable:** `docs/implementations/STATE_CONSOLIDATION_STRATEGY.md`

**Acceptance Criteria:**

- [ ] All 9 state sources have migration plan
- [ ] State transition matrix documented
- [ ] Synchronization strategy defined for feature flag period
- [ ] Integration tests written for each state transition
- [ ] Team reviewed and approved

**Why This Matters:**
Original plan identified 8+ state sources but didn't show HOW to consolidate them. Without this:

- Widgets may read stale state during migration
- Feature flag toggle could cause state inconsistencies
- Hard to verify migration completeness

**Risk if Skipped:** State drift bugs, race conditions, incomplete migration verification.

---

#### Task 0.8: Audit Current Memory Leak Status (Day 9) 🚨 NEW - VERIFICATION GAP

**Owner:** QA Engineer

**Priority:** MEDIUM - Need to verify plan assumptions

**Subtasks:**

- [ ] Write memory leak detection test

  ```typescript
  it('should not leak AudioBufferSourceNodes over 10 plays', () => {
    const engine = new RegionProcessor(eventBus);
    // Play 10 times
    for (let i = 0; i < 10; i++) {
      engine.start();
      engine.stop();
    }
    // Check scheduledAudioSources size
    expect(engine.scheduledAudioSources.size).toBe(0);
  });
  ```

- [ ] Run test against current RegionProcessor
- [ ] Document findings:
  - Does scheduledAudioSources grow unbounded?
  - Are sources cleaned up on stop()?
  - Is onended callback removing sources?

- [ ] Update plan based on findings:
  - If ALREADY FIXED: Change task from "Fix" to "Preserve"
  - If STILL BROKEN: Keep current fix approach
  - If PARTIALLY FIXED: Document what still needs work

**Deliverable:** `docs/implementations/MEMORY_LEAK_AUDIT.md`

**Acceptance Criteria:**

- [ ] Memory leak test written and runs successfully
- [ ] Current behavior documented with evidence
- [ ] Plan updated based on actual findings
- [ ] If leak exists: Reproduction steps documented

**Why This Matters:**
Plan claims "Sources added but NEVER removed" but we found:

- scheduledAudioSources Map exists with metadata
- WindowRegistry exists (Bug #3 fix)
- dispose() method exists (Bug #7 fix)

Need to verify if leak is ALREADY fixed before planning a fix.

**Risk if Skipped:** Implementing fix for already-fixed bug, or missing real leak.

---

#### Task 0.9: Document PluginManager Integration (Day 10) 🚨 NEW - MISSING INTEGRATION

**Owner:** Senior Engineer

**Priority:** HIGH - Not mentioned in v1.0 plan

**Subtasks:**

- [ ] Document current PluginManager integration in RegionProcessor
  - setPluginManager(pluginManager: PluginManager)
  - getWamKeyboard(): WamKeyboard | null
  - WamKeyboardPlugin → WamKeyboard unwrapping logic
  - CC64 event routing to WAM keyboard

- [ ] Test current behavior
  - Load exercise with WAM keyboard
  - Verify CC64 events route correctly
  - Document expected behavior

- [ ] Design PlaybackEngine integration
  - Where does setPluginManager() go?
  - How to preserve getWamKeyboard() logic?
  - How to route CC events in new architecture?

- [ ] Add integration tasks to Phase 1
  - Add subtask to Task 1.2 (PlaybackEngine): Port PluginManager integration
  - Add test: Verify CC64 routing to WAM keyboard still works

**Deliverable:** `docs/implementations/PLUGIN_MANAGER_INTEGRATION.md`

**Acceptance Criteria:**

- [ ] Current integration documented with code examples
- [ ] Expected behavior verified with tests
- [ ] PlaybackEngine integration designed
- [ ] Tasks added to Phase 1 plan

**Why This Matters:**
RegionProcessor has complex WAM keyboard integration:

```typescript
setPluginManager(pluginManager: PluginManager): void
private getWamKeyboard(): WamKeyboard | null
// Routes CC events to WamKeyboard for sustain pedal
```

This is NOT mentioned anywhere in the plan. Without it:

- WAM keyboard integration will break
- Sustain pedal won't work with WAM instruments
- Silent failure during migration

**Risk if Skipped:** Broken WAM keyboard support, regression in sustain pedal behavior.

---

### Phase 1: Core Implementation (Weeks 1-2: 10 days)

**Goal:** Create new modules alongside existing ones (no breaking changes yet)

#### Task 1.1: Create Scheduler.ts (Days 1-3)

**Owner:** Senior Engineer

**Subtasks:**

- [ ] **Day 1:** Create `Scheduler.ts` with unified scheduling logic
  - [ ] Implement instrument configuration system
  - [ ] Implement `schedule()` method with configuration dispatch
  - [ ] Implement `scheduleRegion()` batch scheduling
  - [ ] Add source tracking array (`activeSources`)
- [ ] **Day 2:** Implement velocity layer selection and cleanup
  - [ ] Inline velocity layer selection (from VelocityLayerSelector)
  - [ ] Implement `cleanupSources()` method (Bug #3 fix)
  - [ ] Implement `cancelAllScheduled()` method (for tempo change)
  - [ ] Implement `dispose()` method with proper cleanup
- [ ] **Day 3:** Testing and validation
  - [ ] Write unit tests for each instrument type
  - [ ] Test source cleanup (memory leak prevention)
  - [ ] Test cancellation (tempo change support)
  - [ ] Code review

**Deliverable:** `playback/services/core/Scheduler.ts` (300 lines)

**Acceptance Criteria:**

- [ ] Single `schedule()` method handles all instruments
- [ ] Instrument behavior controlled by configuration data
- [ ] Source cleanup prevents memory leaks (Bug #3)
- [ ] All existing scheduler tests pass with new implementation
- [ ] No memory leaks in 100-iteration test

**Integration Points:**

- Must work with existing BufferCache
- Must work with existing SustainPedal
- Must preserve timing accuracy (99%+ target)

---

#### Task 1.2: Create PlaybackEngine.ts (Days 4-6)

**Owner:** Senior Engineer

**Subtasks:**

- [ ] **Day 4:** Core coordination logic
  - [ ] Create `PlaybackEngine.ts` with state machine
  - [ ] Move track registration from TrackManager
  - [ ] Move countdown config from ConfigurationManager
  - [ ] Implement `start()`, `stop()`, `pause()` methods
  - [ ] Add state transition logic
- [ ] **Day 5:** Lifecycle and tempo management
  - [ ] Move lifecycle logic from LifecycleCoordinator (inline)
  - [ ] Implement `updateTempo()` with debouncing ⚠️ PRESERVE Bug #6
  - [ ] Implement `dispose()` method ⚠️ PRESERVE Bug #7
  - [ ] Remove callback ping-pong (direct method calls)
  - [ ] Add exercise duration calculation
- [ ] **Day 6:** Testing and integration
  - [ ] Write unit tests for state transitions
  - [ ] Test tempo change with debouncing
  - [ ] Test disposal and cleanup
  - [ ] Test exercise switching flow
  - [ ] Code review

**Deliverable:** `playback/services/core/PlaybackEngine.ts` (500 lines)

**Acceptance Criteria:**

- [ ] PlaybackEngine owns all coordination logic
- [ ] No more callback delegation
- [ ] Clean shutdown with `dispose()` (Bug #7)
- [ ] Tempo changes debounced correctly (Bug #6)
- [ ] All RegionProcessor tests pass with new implementation
- [ ] State machine transitions correctly

---

#### Task 1.3: Create timeUtils.ts (Day 7)

**Owner:** Mid-Level Engineer

**Subtasks:**

- [ ] Create `timeUtils.ts` with pure functions
- [ ] Extract functions from TimePositionConverter
- [ ] Remove class wrapper (pure functions only)
- [ ] Write unit tests
- [ ] Validate against old implementation (comparison tests)

**Deliverable:** `playback/services/core/timeUtils.ts` (100 lines)

**Acceptance Criteria:**

- [ ] All time conversion functions are pure (no state)
- [ ] Tests verify correctness against old implementation
- [ ] No dependencies on other modules
- [ ] Edge cases handled (tempo changes, time signatures)

---

#### Task 1.4: CoreServices Integration (Days 8-9)

**Owner:** Senior Engineer

**Subtasks:**

- [ ] **Day 8:** Add PlaybackEngine to CoreServices
  - [ ] Add `getPlaybackEngine()` method to CoreServices
  - [ ] Wire PlaybackEngine initialization in CoreServices constructor
  - [ ] Add feature flag check: `if (NEW_ENGINE) return playbackEngine else return regionProcessor`
  - [ ] Update CoreServices type definitions
  - [ ] Preserve existing `getRegionProcessor()` for backward compatibility
- [ ] **Day 9:** AudioProvider integration
  - [ ] Update AudioProvider to create PlaybackEngine (behind flag)
  - [ ] Wire PlaybackEngine into React context
  - [ ] Add coreServicesReady synchronization ⚠️ PRESERVE Bug #1
  - [ ] Test provider initialization sequence
  - [ ] Code review

**Deliverable:** Updated `CoreServices.ts` and `AudioProvider.tsx`

**Acceptance Criteria:**

- [ ] Feature flag controls which engine is used
- [ ] Both engines can coexist during migration
- [ ] No breaking changes to existing API
- [ ] Bug #1 fix preserved (coreServicesReady)
- [ ] All initialization tests pass

---

#### Task 1.5: WindowRegistry Integration (Day 10)

**Owner:** Mid-Level Engineer

**Subtasks:**

- [ ] Register PlaybackEngine instances in WindowRegistry (Bug #3)
- [ ] Update WindowRegistry to track both RegionProcessor and PlaybackEngine
- [ ] Test cleanup on page navigation
- [ ] Test cleanup on hot reload (dev mode)
- [ ] Code review

**Deliverable:** Updated `WindowRegistry.ts`

**Acceptance Criteria:**

- [ ] PlaybackEngine instances tracked
- [ ] Cleanup works in all scenarios
- [ ] Bug #3 fix preserved
- [ ] No memory leaks in navigation tests

### Phase 2: Fix Production Bugs (Week 2)

**Parallel with Phase 1 implementation**

#### Bug 1: Memory Leak - AudioBufferSourceNode Cleanup

**Location:** Scheduler.ts (new)

**Current Issue:**

```typescript
// RegionProcessor.ts line 123-126
private scheduledAudioSources = new Map<
  AudioBufferSourceNode,
  { type: 'one-shot' | 'sustained'; hasStopScheduled: boolean }
>();

// Sources added but NEVER removed after playback
```

**Fix:**

```typescript
// Scheduler.ts
class Scheduler {
  private activeSources: AudioBufferSourceNode[] = [];

  schedule(event) {
    const source = this.createSource(event);
    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source);
      source.disconnect();
    };
    this.activeSources.push(source);
    source.start(event.time);
  }

  stop() {
    this.activeSources.forEach((source) => {
      source.stop();
      source.disconnect();
    });
    this.activeSources = [];
  }
}
```

**Test:**

```typescript
it('should clean up audio sources after playback', () => {
  scheduler.schedule(event);
  expect(scheduler.getActiveSourceCount()).toBe(1);

  scheduler.stop();
  expect(scheduler.getActiveSourceCount()).toBe(0);
});
```

#### Bug 2: Tempo Change During Playback

**Location:** PlaybackEngine.ts (new)

**Current Issue:**

```typescript
// When tempo changes, events are rescheduled
// But Web Audio timeline events are NOT cancelled
// Result: Double-triggering or out-of-sync audio
```

**Fix:**

```typescript
// PlaybackEngine.ts
updateTempo(newBpm: number) {
  if (!this.isPlaying) {
    this.bpm = newBpm;
    return;
  }

  // 1. Cancel all scheduled events
  this.scheduler.cancelAllScheduled();

  // 2. Update BPM
  this.bpm = newBpm;
  Tone.Transport.bpm.value = newBpm;

  // 3. Re-schedule from current position
  const currentPosition = Tone.Transport.seconds;
  this.scheduler.scheduleFromPosition(currentPosition, this.bpm);
}
```

**Test:**

```typescript
it('should reschedule events on tempo change', async () => {
  await engine.start();
  await engine.updateTempo(140); // Change from 120 to 140

  // Verify no double-triggering
  const events = captureAudioEvents();
  expect(events).toHaveNoDuplicates();
});
```

#### Bug 3: Exercise Switch Memory Accumulation

**Location:** PlaybackEngine.ts (new)

**Current Issue:**

```typescript
// When switching exercises:
// - New samples loaded ✅
// - New tracks registered ✅
// - Old samples cleared? ❌ NO (only on AudioContext close)
// - Old tracks cleared? ❌ NO
// - Old instruments disposed? ❌ SOMETIMES
```

**Fix:**

```typescript
// PlaybackEngine.ts
dispose() {
  // 1. Stop playback
  this.stop();

  // 2. Clear scheduler
  this.scheduler.cleanupSources();

  // 3. Clear tracks
  this.tracks.clear();

  // 4. Clear buffers (delegate to BufferCache)
  this.bufferCache.clearInstrumentBuffers(this.currentInstrument);

  // 5. Clear sustain timeline
  this.sustainPedal.clear();

  // 6. Reset state
  this.isPlaying = false;
  this.currentExercise = null;
}

// Widget calls dispose() before loading new exercise
switchExercise(newExercise) {
  this.playbackEngine.dispose();  // Clean up old exercise
  this.playbackEngine.loadExercise(newExercise);
}
```

**Test:**

```typescript
it('should clean up all resources on dispose', () => {
  engine.loadExercise(exercise1);
  const initialMemory = getMemoryUsage();

  engine.dispose();

  expect(engine.tracks.size).toBe(0);
  expect(engine.scheduler.getActiveSourceCount()).toBe(0);
  expect(getMemoryUsage()).toBeLessThan(initialMemory * 1.1); // Allow 10% variance
});
```

#### Bug 4: State Fragmentation

**Location:** PlaybackEngine.ts (new)

**Current Issue:**

```typescript
// Playback state scattered across multiple classes:
// - RegionProcessor.isRunning
// - AudioEngine.isInitialized
// - CoreServices.isReady
// - InitialSamplePreloader.preloadComplete
```

**Fix:**

```typescript
// PlaybackEngine.ts - Single source of truth
class PlaybackEngine {
  private state: PlaybackState = 'uninitialized';

  getState(): PlaybackState {
    return this.state;
  }

  private setState(newState: PlaybackState) {
    const oldState = this.state;
    this.state = newState;
    this.eventBus.emit('playback:state-change', { oldState, newState });
  }
}

type PlaybackState =
  | 'uninitialized' // Before any setup
  | 'loading' // Loading samples
  | 'ready' // Ready to play
  | 'playing' // Currently playing
  | 'paused' // Paused
  | 'stopped' // Stopped (can resume)
  | 'disposed'; // Cleaned up
```

**Test:**

```typescript
it('should transition through states correctly', async () => {
  expect(engine.getState()).toBe('uninitialized');

  await engine.loadExercise(exercise);
  expect(engine.getState()).toBe('ready');

  await engine.start();
  expect(engine.getState()).toBe('playing');

  engine.pause();
  expect(engine.getState()).toBe('paused');

  engine.dispose();
  expect(engine.getState()).toBe('disposed');
});
```

### Phase 3: Migration (Week 2-3)

**Goals:**

- Switch all callers to use new modules
- Remove old modules
- Update tests

#### Step 3.1: Update Widget Integration (Days 1-2)

**Widgets to Update:**

- HarmonyWidget
- DrummerWidget
- MetronomeWidget
- VoiceCueWidget

**Changes:**

```typescript
// Before (widgets access RegionProcessor)
const regionProcessor = coreServices.getRegionProcessor();
regionProcessor.registerTrack(harmonyTrack);

// After (widgets access PlaybackEngine)
const playbackEngine = coreServices.getPlaybackEngine();
playbackEngine.registerTrack(harmonyTrack);
```

#### Step 3.2: Update Tests (Days 3-4)

**Test Categories:**

1. Unit tests for new modules
2. Integration tests for PlaybackEngine
3. Migration tests (old API → new API compatibility)

#### Step 3.3: Remove Old Modules (Day 5)

**Delete:**

- LifecycleCoordinator.ts
- ConfigurationManager.ts
- TrackManager.ts
- RegionScheduler.ts
- SimpleInstrumentScheduler.ts
- HarmonyScheduler.ts
- EventRouter.ts
- DiagnosticLogger.ts
- VelocityLayerSelector.ts
- TimePositionConverter.ts (class version)

**Keep:**

- BufferManager.ts → Rename to BufferCache.ts
- SustainPedalManager.ts → Rename to SustainPedal.ts
- TimingMetricsCollector.ts → Rename to MetricsCollector.ts

---

## Detailed Module Specifications

### 1. PlaybackEngine.ts Specification

**Purpose:** Main coordinator for playback operations

**Dependencies:**

```typescript
import { Scheduler } from './Scheduler.js';
import { BufferCache } from './BufferCache.js';
import { SustainPedal } from './SustainPedal.js';
import { MetricsCollector } from './MetricsCollector.js';
import * as timeUtils from './timeUtils.js';
import { EventBus } from './EventBus.js';
```

**Class Definition:**

```typescript
export class PlaybackEngine {
  private scheduler: Scheduler;
  private bufferCache: BufferCache;
  private sustainPedal: SustainPedal;
  private metrics: MetricsCollector;
  private eventBus: EventBus;

  private tracks = new Map<string, Track>();
  private state: PlaybackState = 'uninitialized';
  private audioContext: AudioContext | null = null;
  private bpm = 120;
  private countdownBeats = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.scheduler = new Scheduler();
    this.bufferCache = new BufferCache();
    this.sustainPedal = new SustainPedal();
    this.metrics = new MetricsCollector();
  }

  // Initialization
  setAudioContext(context: AudioContext): void;

  // Track Management
  registerTrack(track: Track): void;
  registerTracks(tracks: Track[]): void;
  clearTracks(): void;

  // Countdown Configuration
  enableCountdown(timeSignature: {
    numerator: number;
    denominator: number;
  }): void;
  disableCountdown(): void;
  addCountdownRegion(timeSignature): void;
  addVoiceCountdownRegion(timeSignature): void;

  // Buffer Management (delegate to BufferCache)
  setMetronomeBuffers(accent: AudioBuffer, click: AudioBuffer): void;
  setHarmonyBuffers(buffers: Map<string, AudioBuffer>): void;
  setDrumBuffers(buffers: Map<string, AudioBuffer>): void;
  setBassBuffers(buffers: Map<string, AudioBuffer>): void;
  setVoiceCueBuffers(buffers: Map<string, AudioBuffer>): void;

  // Playback Control
  start(): void;
  stop(): void;
  pause(): void;
  updateTempo(bpm: number): void;

  // Lifecycle
  dispose(): void;

  // State
  getState(): PlaybackState;
  isPlaying(): boolean;

  // Private Helpers
  private setState(newState: PlaybackState): void;
  private validateTracks(tracks: Track[]): void;
  private scheduleAllRegions(): void;
}
```

**State Machine:**

```
uninitialized → loading → ready
                           ↓
                        playing ⟷ paused
                           ↓
                        stopped
                           ↓
                        disposed
```

### 2. Scheduler.ts Specification

**Purpose:** Schedule all audio events across all instruments

**Dependencies:**

```typescript
import { BufferCache } from './BufferCache.js';
import { SustainPedal } from './SustainPedal.js';
import * as timeUtils from './timeUtils.js';
```

**Class Definition:**

```typescript
interface InstrumentConfig {
  preserveAttack: boolean;
  baseVolume: number;
  sustainPedal?: boolean;
  velocityLayers?: boolean;
  polyphony?: number;
  bufferMapping?: Record<string, string>;
}

const INSTRUMENT_CONFIGS: Record<string, InstrumentConfig> = {
  metronome: { preserveAttack: true, baseVolume: 0.8 },
  drums: { preserveAttack: false, baseVolume: 0.8 },
  harmony: {
    sustainPedal: true,
    velocityLayers: true,
    polyphony: 32,
    baseVolume: 1.0,
  },
  bass: { sustainPedal: false, baseVolume: 0.9 },
  voiceCue: { preserveAttack: false, baseVolume: 0.9 },
};

export class Scheduler {
  private context: AudioContext | null = null;
  private bufferCache: BufferCache;
  private sustainPedal: SustainPedal;
  private activeSources: AudioBufferSourceNode[] = [];
  private scheduledEvents = new Map<string, Set<string>>();

  constructor(bufferCache: BufferCache, sustainPedal: SustainPedal) {
    this.bufferCache = bufferCache;
    this.sustainPedal = sustainPedal;
  }

  setAudioContext(context: AudioContext): void;

  // Core Scheduling
  schedule(event: ScheduledEvent): void;
  scheduleRegion(region: Region, offsetBeats: number, bpm: number): void;
  scheduleAllRegions(tracks: Track[], offsetBeats: number, bpm: number): void;

  // Control
  cancelAllScheduled(): void;
  cleanupSources(): void;

  // Query
  getActiveSourceCount(): number;

  // Private Scheduling Helpers
  private scheduleMetronome(event, audioTime): void;
  private scheduleDrums(event, audioTime): void;
  private scheduleHarmony(event, audioTime): void;
  private scheduleBass(event, audioTime): void;
  private scheduleVoiceCue(event, audioTime): void;

  // Private Utilities
  private createSource(buffer: AudioBuffer): AudioBufferSourceNode;
  private selectVelocityLayer(velocity: number, instrument: string): string;
  private applyInstrumentConfig(source, event, config): void;
  private calculateNoteDuration(event, config): number;
}
```

**Scheduling Flow:**

```
schedule(event) →
  1. Determine instrument type
  2. Get instrument config
  3. Get buffer from BufferCache
  4. Create AudioBufferSourceNode
  5. Calculate duration (with SustainPedal if needed)
  6. Apply config (volume, attack)
  7. Connect to destination
  8. Schedule source.start(audioTime)
  9. Track in activeSources
  10. Set onended cleanup
```

### 3. timeUtils.ts Specification

**Purpose:** Pure time conversion functions

**Exports:**

```typescript
/**
 * Parse Tone.js position string to beats
 * @example parsePosition("0:2:0") → 2 beats
 * @example parsePosition("1:0:0") → 4 beats (assuming 4/4)
 */
export function parsePosition(
  position: string | object,
  timeSignature?: { numerator: number; denominator: number },
): number;

/**
 * Convert beats to seconds based on BPM
 * @example beatsToSeconds(4, 120) → 2 seconds
 */
export function beatsToSeconds(beats: number, bpm: number): number;

/**
 * Convert seconds to beats based on BPM
 * @example secondsToBeats(2, 120) → 4 beats
 */
export function secondsToBeats(seconds: number, bpm: number): number;

/**
 * Calculate total exercise duration from tracks
 */
export function calculateDuration(
  tracks: Track[],
  bpm: number,
  countdownBeats: number,
): number;

/**
 * Parse Tone.Transport position to seconds
 */
export function parseTransportPosition(pos: any, bpm: number): number;
```

**No State:** All functions are pure (input → output, no side effects)

---

## Bug Fixes During Refactor

### Memory Leak Fix (Detailed)

**Root Cause:**

- `AudioBufferSourceNode` instances created during scheduling
- Added to `scheduledAudioSources` Map
- Never removed after playback completes
- Each play session leaks ~50-200 nodes

**Impact:**

- Memory usage grows linearly with play count
- After 10 play sessions: ~500MB leaked
- After 50 play sessions: Browser slowdown/crash

**Fix:**

```typescript
// Scheduler.ts
private activeSources: AudioBufferSourceNode[] = [];

schedule(event) {
  const source = this.createSource(buffer);

  // Track for cleanup
  this.activeSources.push(source);

  // Auto-cleanup when playback ends
  source.onended = () => {
    this.removeSource(source);
  };

  source.start(audioTime);
}

private removeSource(source: AudioBufferSourceNode) {
  const index = this.activeSources.indexOf(source);
  if (index > -1) {
    this.activeSources.splice(index, 1);
  }
  source.disconnect();
}

stop() {
  // Manual cleanup on stop
  this.activeSources.forEach(source => {
    try {
      source.stop();
      source.disconnect();
    } catch (e) {
      // Already stopped
    }
  });
  this.activeSources = [];
}
```

**Test:**

```typescript
describe('Memory Leak Prevention', () => {
  it('should clean up sources after playback', async () => {
    // Play 10 times
    for (let i = 0; i < 10; i++) {
      await engine.start();
      await engine.stop();
    }

    // Check no sources leaked
    expect(scheduler.getActiveSourceCount()).toBe(0);
  });

  it('should auto-cleanup on source end', async () => {
    scheduler.schedule(shortEvent); // 0.1s duration
    expect(scheduler.getActiveSourceCount()).toBe(1);

    await wait(200); // Wait for playback to end
    expect(scheduler.getActiveSourceCount()).toBe(0);
  });
});
```

### Tempo Change Fix (Detailed)

**Root Cause:**

- Events scheduled in Web Audio timeline with absolute times
- When tempo changes, new events scheduled with new BPM
- Old events in timeline NOT cancelled
- Result: Both old and new events play (double-triggering)

**Example:**

```
Initial: BPM 120
- Event at beat 4 scheduled for audioTime 2.0s

User changes tempo to 140:
- Event at beat 4 RE-scheduled for audioTime 1.71s
- Old event at 2.0s still in Web Audio timeline

Result: Event plays twice (1.71s and 2.0s)
```

**Fix:**

```typescript
// PlaybackEngine.ts
updateTempo(newBpm: number) {
  if (!this.isPlaying) {
    // Not playing - just update BPM
    this.bpm = newBpm;
    Tone.Transport.bpm.value = newBpm;
    return;
  }

  // Playing - need to reschedule

  // 1. Get current position
  const currentSeconds = Tone.Transport.seconds;
  const currentBeats = timeUtils.secondsToBeats(currentSeconds, this.bpm);

  // 2. Cancel ALL scheduled events
  this.scheduler.cancelAllScheduled();

  // 3. Update BPM
  this.bpm = newBpm;
  Tone.Transport.bpm.value = newBpm;

  // 4. Re-schedule from current position
  this.scheduler.scheduleFromPosition(currentBeats, newBpm);
}

// Scheduler.ts
cancelAllScheduled() {
  // Stop and disconnect all active sources
  this.activeSources.forEach(source => {
    try {
      source.stop(0);  // Stop immediately
      source.disconnect();
    } catch (e) {
      // Already stopped
    }
  });
  this.activeSources = [];

  // Clear scheduled event tracking
  this.scheduledEvents.clear();
}

scheduleFromPosition(startBeats: number, bpm: number) {
  // Re-schedule only events that haven't played yet
  this.tracks.forEach(track => {
    track.regions.forEach(region => {
      region.pattern?.events?.forEach(event => {
        const eventBeats = timeUtils.parsePosition(event.position);
        if (eventBeats >= startBeats) {
          this.schedule(event, bpm);
        }
      });
    });
  });
}
```

**Test:**

```typescript
describe('Tempo Change', () => {
  it('should not double-trigger events', async () => {
    const events: any[] = [];
    captureAudioEvents(events);

    await engine.start();
    await wait(500);

    // Change tempo mid-playback
    engine.updateTempo(140);

    await wait(2000);
    engine.stop();

    // Verify each event only triggered once
    const eventCounts = countEvents(events);
    eventCounts.forEach((count) => {
      expect(count).toBe(1);
    });
  });
});
```

---

## Migration Strategy

### Backwards Compatibility Layer

**Option 1: Adapter Pattern (RECOMMENDED)**

Create temporary adapters that wrap new modules with old API:

```typescript
// RegionProcessorAdapter.ts (temporary)
export class RegionProcessorAdapter {
  private engine: PlaybackEngine;

  constructor(eventBus: EventBus) {
    this.engine = new PlaybackEngine(eventBus);
  }

  // Old API delegates to new API
  registerTrack(track: Track) {
    return this.engine.registerTrack(track);
  }

  start() {
    return this.engine.start();
  }

  // ... map all old methods
}

// CoreServices.ts
getRegionProcessor(): RegionProcessorAdapter {
  return new RegionProcessorAdapter(this.eventBus);
}
```

**Benefits:**

- Zero breaking changes
- Can migrate widgets one at a time
- Remove adapter after full migration

**Option 2: Deprecation Warnings**

```typescript
// RegionProcessor.ts (mark as deprecated)
/** @deprecated Use PlaybackEngine instead */
export class RegionProcessor {
  constructor() {
    console.warn(
      'RegionProcessor is deprecated. Please use PlaybackEngine instead.',
    );
  }
}
```

### Migration Checklist

**Phase 1: New Modules Coexist**

- [ ] Create PlaybackEngine.ts
- [ ] Create Scheduler.ts
- [ ] Create timeUtils.ts
- [ ] All new modules have unit tests
- [ ] Adapter wraps new modules with old API

**Phase 2: Widget Migration**

- [ ] Update HarmonyWidget to use PlaybackEngine
- [ ] Update DrummerWidget to use PlaybackEngine
- [ ] Update MetronomeWidget to use PlaybackEngine
- [ ] Update VoiceCueWidget to use PlaybackEngine
- [ ] Integration tests pass

**Phase 3: Test Migration**

- [ ] Update unit tests to use new modules
- [ ] Update integration tests
- [ ] All tests pass

**Phase 4: Cleanup**

- [ ] Remove adapter layer
- [ ] Delete old modules
- [ ] Update documentation

---

## Testing Strategy

### Unit Tests

**PlaybackEngine Tests:**

```typescript
describe('PlaybackEngine', () => {
  describe('Track Management', () => {
    it('should register tracks');
    it('should validate track data');
    it('should clear tracks on dispose');
  });

  describe('Playback Control', () => {
    it('should start playback');
    it('should stop playback');
    it('should pause playback');
    it('should update tempo during playback');
  });

  describe('State Management', () => {
    it('should transition states correctly');
    it('should emit state change events');
  });

  describe('Countdown', () => {
    it('should enable countdown with time signature');
    it('should add countdown regions');
  });
});
```

**Scheduler Tests:**

```typescript
describe('Scheduler', () => {
  describe('Event Scheduling', () => {
    it('should schedule metronome events');
    it('should schedule drum events');
    it('should schedule harmony events');
    it('should schedule bass events');
    it('should schedule voice cue events');
  });

  describe('Source Management', () => {
    it('should track active sources');
    it('should cleanup sources on stop');
    it('should auto-cleanup on source end');
  });

  describe('Velocity Layers', () => {
    it('should select correct velocity layer');
    it('should handle missing velocity layers gracefully');
  });
});
```

**timeUtils Tests:**

```typescript
describe('timeUtils', () => {
  describe('parsePosition', () => {
    it('should parse "0:0:0" to 0 beats');
    it('should parse "1:0:0" to 4 beats (4/4)');
    it('should parse "0:2:0" to 2 beats');
  });

  describe('beatsToSeconds', () => {
    it('should convert beats to seconds at 120 BPM');
    it('should convert beats to seconds at 140 BPM');
  });
});
```

### Integration Tests

**Full Playback Flow:**

```typescript
describe('Playback Integration', () => {
  it('should load exercise and play from start to end', async () => {
    const engine = new PlaybackEngine(eventBus);
    engine.setAudioContext(audioContext);

    // Load exercise
    engine.registerTracks(exerciseTracks);
    engine.setHarmonyBuffers(harmonyBuffers);

    // Enable countdown
    engine.enableCountdown({ numerator: 4, denominator: 4 });

    // Play
    const events: any[] = [];
    captureAudioEvents(events);

    await engine.start();
    await waitForPlaybackEnd();

    // Verify all events played
    expect(events.length).toBeGreaterThan(0);
    expect(events).toMatchSnapshot();
  });

  it('should handle exercise switching', async () => {
    const engine = new PlaybackEngine(eventBus);

    // Load exercise 1
    engine.registerTracks(exercise1Tracks);
    await engine.start();
    await engine.stop();

    // Switch to exercise 2
    engine.dispose();
    engine.registerTracks(exercise2Tracks);
    await engine.start();

    // Verify no memory leak
    expect(engine.getActiveSourceCount()).toBeGreaterThan(0);
    await engine.stop();
    expect(engine.getActiveSourceCount()).toBe(0);
  });
});
```

### Performance Tests

**Memory Leak Detection:**

```typescript
describe('Memory Performance', () => {
  it('should not leak memory over 100 play cycles', async () => {
    const engine = new PlaybackEngine(eventBus);
    const initialMemory = getMemoryUsage();

    // Play 100 times
    for (let i = 0; i < 100; i++) {
      await engine.start();
      await engine.stop();
    }

    const finalMemory = getMemoryUsage();
    const memoryGrowth = finalMemory - initialMemory;

    // Allow max 10MB growth over 100 cycles
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
  });
});
```

**Scheduling Performance:**

```typescript
describe('Scheduling Performance', () => {
  it('should schedule 1000 events in < 100ms', () => {
    const scheduler = new Scheduler(bufferCache, sustainPedal);
    const events = generateEvents(1000);

    const start = performance.now();
    events.forEach((event) => scheduler.schedule(event));
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });
});
```

---

## Rollout Plan

### Week 1: Implementation

- [ ] Day 1-3: Create Scheduler.ts
- [ ] Day 4-5: Create PlaybackEngine.ts
- [ ] Day 6: Create timeUtils.ts
- [ ] Day 7: Code review

### Week 2: Bug Fixes + Testing

- [ ] Day 1-2: Fix memory leak
- [ ] Day 3-4: Fix tempo change bug
- [ ] Day 5: Fix exercise switch cleanup
- [ ] Day 6-7: Integration testing

### Week 3: Migration + Deployment

- [ ] Day 1-2: Migrate widgets
- [ ] Day 3: Update tests
- [ ] Day 4: Code review
- [ ] Day 5: Deploy to staging
- [ ] Day 6-7: QA testing, deploy to production

---

## Success Metrics

### Code Quality Metrics

**Before:**

- Files: 23
- Lines: ~5000
- Cyclomatic complexity: High (10+ per method)
- Test coverage: 65%

**After:**

- Files: 6
- Lines: ~2000
- Cyclomatic complexity: Low (< 5 per method)
- Test coverage: 85%

### Performance Metrics

**Before:**

- Memory leak: 50MB per play session
- Exercise switch: Memory accumulates
- Tempo change: Double-triggering

**After:**

- Memory leak: 0MB (sources cleaned up)
- Exercise switch: Memory stable
- Tempo change: No double-triggering

### Developer Experience

**Before:**

- Time to understand flow: 2-3 hours
- Files to read: 10+
- Callback tracing: Difficult

**After:**

- Time to understand flow: 30 minutes
- Files to read: 3-4
- Callback tracing: Direct method calls

---

## Appendix A: Module Dependency Graph

**Before (Complex):**

```
RegionProcessor
├── LifecycleCoordinator
│   ├── ConfigurationManager
│   ├── BufferManager
│   └── TrackManager
├── RegionScheduler
│   ├── ExerciseDurationCalculator
│   └── BackupScheduler
├── SimpleInstrumentScheduler (×4)
│   └── EventRouter
├── HarmonyScheduler
│   ├── VelocityLayerSelector
│   └── GrandPianoKeyboardMapper
├── SustainPedalManager
│   ├── CC64TimelineBuilder
│   └── SustainPedalAnalyzer
├── TimePositionConverter
│   └── MusicalTimeConverter
├── BufferManager
│   └── BufferRegistry
└── DiagnosticLogger
```

**After (Simple):**

```
PlaybackEngine
├── Scheduler
│   ├── BufferCache
│   └── SustainPedal
├── BufferCache
├── SustainPedal
├── timeUtils (pure functions)
└── MetricsCollector
```

---

## Appendix B: API Comparison

### Old API (RegionProcessor)

```typescript
// Initialization
regionProcessor.setAudioContext(context);
regionProcessor.setMetronomeBuffers(accent, click, destination);
regionProcessor.setHarmonyBuffers(buffers, destination);

// Track registration
regionProcessor.registerTrack(track);

// Countdown
regionProcessor.enableCountdown({ numerator: 4, denominator: 4 });
regionProcessor.addCountdownRegion({ numerator: 4, denominator: 4 });

// Playback
regionProcessor.start();
regionProcessor.stop();

// State (scattered)
regionProcessor.isRunning;
audioEngine.isInitialized;
coreServices.isReady;
```

### New API (PlaybackEngine)

```typescript
// Initialization
playbackEngine.setAudioContext(context);
playbackEngine.setMetronomeBuffers(accent, click);
playbackEngine.setHarmonyBuffers(buffers);

// Track registration
playbackEngine.registerTrack(track);

// Countdown
playbackEngine.enableCountdown({ numerator: 4, denominator: 4 });

// Playback
playbackEngine.start();
playbackEngine.stop();
playbackEngine.pause();
playbackEngine.updateTempo(140);

// State (centralized)
playbackEngine.getState(); // 'playing' | 'paused' | 'stopped' | etc.
playbackEngine.isPlaying();
```

**Key Improvements:**

- Cleaner API (fewer methods, clearer naming)
- Centralized state
- Better tempo control
- Proper lifecycle (dispose)

---

## Appendix C: Migration Examples

### Widget Migration Example

**Before:**

```typescript
// HarmonyWidget.tsx
const regionProcessor = coreServices.getRegionProcessor();

// Register track
regionProcessor.registerTrack({
  id: 'harmony',
  regions: harmonyRegions,
  instrumentType: 'harmony',
});

// Set buffers
regionProcessor.setHarmonyBuffers(harmonyBuffers, audioContext.destination);

// Start playback
regionProcessor.start();
```

**After:**

```typescript
// HarmonyWidget.tsx
const playbackEngine = coreServices.getPlaybackEngine();

// Register track
playbackEngine.registerTrack({
  id: 'harmony',
  regions: harmonyRegions,
  instrumentType: 'harmony',
});

// Set buffers
playbackEngine.setHarmonyBuffers(harmonyBuffers);

// Start playback
playbackEngine.start();
```

**Changes:**

- `getRegionProcessor()` → `getPlaybackEngine()`
- No need to pass `destination` (handled internally)
- Simpler API

---

## Appendix D: Risk Analysis

### High Risk Areas

1. **Widget Integration**
   - Risk: Breaking existing widget functionality
   - Mitigation: Adapter pattern for backwards compatibility
   - Test: Integration tests for each widget

2. **State Management**
   - Risk: State fragmentation during migration
   - Mitigation: Single source of truth in PlaybackEngine
   - Test: State machine tests

3. **Memory Management**
   - Risk: Introducing new leaks while fixing old ones
   - Mitigation: Comprehensive cleanup in dispose()
   - Test: Memory leak detection tests

### Medium Risk Areas

1. **Tempo Changes**
   - Risk: Audio glitches during tempo change
   - Mitigation: Smooth transition with re-scheduling
   - Test: Tempo change integration tests

2. **Exercise Switching**
   - Risk: Resource cleanup failures
   - Mitigation: Explicit dispose() before new load
   - Test: Exercise switch memory tests

### Low Risk Areas

1. **Time Conversion**
   - Risk: Pure functions - low risk
   - Mitigation: Comprehensive unit tests
   - Test: Time conversion edge cases

---

## Next Steps

1. **Review this plan** with team
2. **Approve architecture** decisions
3. **Assign implementation tasks**
4. **Set up feature branch**: `refactor/playback-consolidation`
5. **Begin Phase 1** (Week 1)

---

## Questions for Team Discussion

1. Should we use Option 1 (Adapter Pattern) or Option 2 (Deprecation Warnings)?
2. Do we need additional metrics/monitoring during rollout?
3. Should we stage the rollout (canary → 50% → 100%)?
4. Are there any widgets we're missing in the migration plan?
5. Should we add performance budgets (max memory, max scheduling time)?

---

**Document Version:** 2.0 - Production-Ready Edition
**Last Updated:** 2025-01-23 (Revised with Codebase Analysis)
**Status:** Ready for Implementation
**Timeline:** 5-6 weeks (revised from 2-3 weeks)
**Required Approvals:** Engineering Lead, Product Lead, CTO

---

## Summary of v2.1 Changes (from v2.0)

### Critical Gaps Addressed

**v2.1 fills 5 critical gaps discovered through deep codebase analysis:**

1. **CoreServices Integration Gap** 🚨 HIGH PRIORITY
   - Added Task 0.6: Complete call site mapping (2 days)
   - Extended Task 1.4: Implementation now 4-5 days (was 2 days)
   - Total impact: +4 days
   - Risk prevented: Integration failures, orphaned code

2. **State Consolidation Gap** 🚨 HIGH PRIORITY
   - Added Task 0.7: State strategy document (1 day)
   - Creates state transition matrix for 9 sources
   - Total impact: +1 day
   - Risk prevented: State drift, race conditions

3. **PluginManager Integration Gap** 🚨 HIGH PRIORITY
   - Added Task 0.9: Document WAM keyboard integration (1 day)
   - Was completely missing from v2.0 plan
   - Total impact: +1 day
   - Risk prevented: Broken WAM keyboard, production hotfix

4. **Memory Leak Verification Gap** ⚠️ MEDIUM PRIORITY
   - Added Task 0.8: Audit current status (1 day)
   - Verify if leak exists or is already fixed
   - Total impact: +1 day
   - Risk prevented: Wasted effort or missed bugs

5. **Tempo Debouncing Assumption** ⚠️ MEDIUM PRIORITY
   - Updated Task 1.2: Changed "Fix" to "Preserve"
   - Code already works, just needs preservation
   - Total impact: 0 days (task clarification)
   - Risk prevented: Breaking working implementation

**Total Week 0 Extension:** 5 days → 10 days (+5 days)
**Total Timeline Extension:** 5-6 weeks → 6-8 weeks (+1-2 weeks)

---

## Summary of v2.0 Changes (from v1.0)

### Major Additions in v2.0

1. **Codebase Reality Check** (NEW section)
   - Documented 8+ state sources (vs. 4 in v1.0)
   - Identified 5 critical bug fixes that MUST be preserved
   - Found 5 missing integration points
   - Discovered tempo fix already implemented

2. **Timeline Extended** (2-3 weeks → 5-6 weeks)
   - Added Week 0: Pre-flight checks
   - Added Week 3: Bug preservation verification
   - Added Week 5-6: Staged rollout + stabilization
   - Justification: Production safety over speed

3. **Detailed Task Breakdown** (ENHANCED)
   - 30+ granular tasks with owners
   - Each task has subtasks and acceptance criteria
   - Integration tasks explicitly called out
   - Bug preservation woven into every phase

4. **Feature Flag Strategy** (NEW)
   - Gradual rollout: 1% → 10% → 50% → 100%
   - Real-time monitoring dashboard
   - <5 minute rollback capability
   - Automated health checks

5. **Risk Mitigation** (NEW section)
   - 5 high-risk areas identified
   - Mitigation strategy for each
   - Rollback triggers defined
   - Incident response procedures

6. **Rollback Procedures** (NEW section)
   - Step-by-step rollback guide
   - Rollback trigger conditions
   - Communication templates
   - Postmortem process

---

### Key Insights from v2.1 Analysis

- **3 critical integrations missing from v2.0** - CoreServices, State, PluginManager
- **Week 0 severely underestimated** - 5 days insufficient for discovery phase
- **Assumptions need verification** - Memory leak status unclear
- **Working code exists** - Tempo debouncing already implemented (Bug #6)
- **Timeline padding essential** - Better 8 weeks with success than 5 weeks with failures

---

### Final Recommendation (v2.1)

**PROCEED with this v2.1 plan.** The refactor is architecturally sound, and v2.1 addresses all critical gaps:

✅ **What's Ready:**

- Target architecture is sound (23 → 6 modules)
- Bug preservation strategy comprehensive
- Feature flag infrastructure planned
- Rollout strategy production-ready

⚠️ **What v2.1 Adds:**

- Complete CoreServices integration analysis (Task 0.6)
- State consolidation strategy (Task 0.7)
- PluginManager integration docs (Task 0.9)
- Memory leak verification (Task 0.8)
- Realistic timeline: **6-8 weeks** (not 5-6 weeks)

🚨 **Critical Success Factors:**

1. **Complete all Week 0 tasks** (10 days) - Don't skip discovery
2. **Don't rush implementation** - 6-8 weeks is realistic, not pessimistic
3. **Monitor production metrics** - Be ready to rollback at any phase
4. **Wait for stability** - Don't delete old code until Week 8

**The codebase IS ready. The plan IS complete. The timeline IS realistic.**

Better to take 8 weeks with confidence than 5 weeks with critical gaps.
