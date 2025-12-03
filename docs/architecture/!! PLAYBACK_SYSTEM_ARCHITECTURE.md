# Playback System Architecture

**Last Updated**: December 2025
**Status**: Production (Pre-Launch)
**Complexity**: FAANG-Grade Audio Engine

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architectural Layers](#architectural-layers)
3. [Core Modules (23 Total)](#core-modules-23-total)
4. [Service Classes & Public APIs](#service-classes--public-apis)
5. [React Components](#react-components)
6. [Custom Hooks](#custom-hooks)
7. [Architectural Patterns](#architectural-patterns)
8. [Critical Subsystems](#critical-subsystems)
9. [Data Flow & Communication](#data-flow--communication)
10. [Tech Debt & Roadmap](#tech-debt--roadmap)
11. [Statistics & Metrics](#statistics--metrics)

---

## Executive Summary

The BassNotion playback domain is a **production-grade, FAANG-quality audio engine** designed for sample-accurate multi-track playback, 3D bass fretboard visualization, and professional DAW-like features.

### Key Characteristics

- **~500+ TypeScript files** organized across 6 architectural layers
- **23 self-contained modules** with clear boundaries
- **Sample-accurate scheduling** using Web Audio API
- **Event-driven architecture** with circuit breakers
- **Domain-Driven Design (DDD)** with repositories, entities, value objects
- **Modular breakdown** of former "god objects" (3,902 lines → 1,329 + 15 modules)
- **Comprehensive error handling** with graceful degradation
- **Production monitoring** with health checks and metrics

### Architecture Philosophy

1. **Separation of Concerns**: Clear layer boundaries
2. **Dependency Injection**: Testable, maintainable code
3. **Event-Driven Communication**: Decoupled services
4. **Progressive Enhancement**: Graceful degradation on errors
5. **Performance First**: Sample-accurate timing, zero-latency scheduling
6. **Developer Experience**: Type-safe APIs, comprehensive hooks

---

## Architectural Layers

The playback domain follows a **6-layer architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: PRESENTATION                                      │
│  - React Components (10)                                    │
│  - Custom Hooks (16)                                        │
│  - Context Providers (2)                                    │
│  - React Contexts (1)                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: APPLICATION / SERVICE                             │
│  - CoreServices (orchestrator)                              │
│  - RegionProcessor (audio scheduling)                       │
│  - PluginManager (WAM plugins)                              │
│  - EventBus (event-driven communication)                    │
│  - TransportAdapter (transport control)                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: DOMAIN / MODULES                                  │
│  - 23 Self-Contained Modules                                │
│  - Each: types/, core/, index.ts                            │
│  - Minimal cross-module dependencies                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: INFRASTRUCTURE                                    │
│  - Repositories (DDD data access)                           │
│  - Storage Services (Supabase, CDN)                         │
│  - Monitoring Services                                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: CROSS-CUTTING CONCERNS                            │
│  - Error Handling & Circuit Breakers                        │
│  - Logging & Correlation IDs                                │
│  - Configuration Management                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 6: PLATFORM                                          │
│  - Web Audio API                                            │
│  - Tone.js                                                  │
│  - IndexedDB                                                │
│  - Web Audio Modules (WAM)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### Layer 1: Presentation Layer
**Purpose**: User interface and React integration

**Components**:
- React components (UI rendering, 3D visualization)
- Custom hooks (component integration layer)
- Context providers (global state)
- React contexts (dependency injection for UI)

**Key Files**:
- `components/FretboardVisualizer/` - 3D bass fretboard
- `components/CoreServicesGate.tsx` - Race condition prevention
- `hooks/useTrack.ts` - Track-based architecture
- `providers/AudioProvider.tsx` - Global audio context

#### Layer 2: Application/Service Layer
**Purpose**: Business logic orchestration and coordination

**Components**:
- CoreServices - Central integration point
- RegionProcessor - Audio scheduling orchestrator
- PluginManager - Plugin lifecycle management
- EventBus - Service-to-service communication
- TransportAdapter - Transport control abstraction

**Key Files**:
- `services/core/CoreServices.ts` (941 lines)
- `services/core/RegionProcessor.ts` (1,329 lines)
- `services/core/PluginManager.ts` (668 lines)
- `services/core/EventBus.ts` (602 lines)
- `services/core/TransportAdapter.ts` (466 lines)

#### Layer 3: Domain/Module Layer
**Purpose**: Self-contained domain logic with clear boundaries

**23 Modules**:
- instruments/ - Instrument implementations
- transport/ - Timing & synchronization
- storage/ - Sample & asset management
- audio-engine/ - Web Audio abstraction
- preloading/ - Sample preloading strategies
- midi/ - MIDI processing pipeline
- tracks/ - Multi-track management
- metadata/ - Audio metadata analysis
- (15 additional modules)

**Pattern**: Each module has `types/`, `core/`, `index.ts`

#### Layer 4: Infrastructure Layer
**Purpose**: External integrations and data access

**Components**:
- Repositories (DDD pattern) - Data access interfaces
- Storage services - Supabase, CDN integration
- Monitoring services - Health checks, metrics

**Key Files**:
- `repositories/track/TrackRepository.ts`
- `services/storage/SupabaseAssetClientFacade.ts`
- `services/monitoring/HealthMonitor.ts`

#### Layer 5: Cross-Cutting Concerns
**Purpose**: Shared functionality across all layers

**Components**:
- Error handling (circuit breakers, recovery)
- Logging (correlation IDs, structured logs)
- Configuration (feature flags, timing config)

**Key Files**:
- `errors/CircuitBreaker.ts`
- `config/featureFlags.ts`
- `utils/ensureAudioContext.ts`

#### Layer 6: Platform Layer
**Purpose**: Browser APIs and third-party libraries

**Technologies**:
- Web Audio API - Low-latency audio scheduling
- Tone.js - Music theory abstractions
- IndexedDB - Sample caching
- Web Audio Modules (WAM) - Plugin architecture

---

## Core Modules (23 Total)

### Critical Modules (Most Complex)

#### 1. `modules/instruments/` (60+ files)
**Purpose**: Instrument implementations with velocity layers

**Structure**:
```
instruments/
├── base/                    # Base classes
│   ├── Instrument.ts
│   ├── Sampler.ts
│   └── InstrumentAdapter.ts
├── implementations/         # Concrete instruments
│   ├── bass/               # Bass synth/sampler
│   ├── drums/              # Multi-sample drum kit
│   ├── harmony/            # Piano, Rhodes, Wurlitzer
│   ├── metronome/          # Click track
│   └── voice-cue/          # Voice announcements
├── adapters/wam/           # Web Audio Module adapters
│   ├── WamDrummer.ts
│   ├── WamKeyboard.ts
│   ├── WamBass.ts
│   └── WamMetronome.ts
└── types/                  # Type definitions
```

**Key Classes**:
- `WurlitzerVelocitySampler` - 4-16 velocity layer sampler
- `WamKeyboard` - WAM keyboard adapter with CC64 sustain
- `DrumKit` - Multi-sample drum kit

**Responsibilities**:
- Sample loading and management
- Velocity layer selection
- MIDI note mapping
- WAM plugin integration
- Octave shifting (Grand Piano: 0, Wurlitzer/Rhodes: -12)

#### 2. `modules/transport/` (40+ files)
**Purpose**: Timing, synchronization, and transport control

**Structure**:
```
transport/
├── core/
│   ├── Clock.ts                    # Master clock
│   ├── Timeline.ts                 # Event timeline
│   ├── Transport.ts                # Transport state machine
│   ├── TransportController.ts      # Transport control
│   └── Scheduler.ts                # Event scheduling
├── position/
│   └── MusicalPositionManager.ts   # Musical time tracking
├── scheduling/
│   └── EventScheduler.ts           # Precise event scheduling
├── sync/
│   ├── SampleAccurateClock.ts      # Sample-accurate timing
│   └── WidgetSyncManager.ts        # Multi-widget sync
└── worklets/                       # Audio worklets (future)
```

**Key Classes**:
- `TransportController` - State machine (stopped/playing/paused)
- `SampleAccurateClock` - Sample-accurate timing
- `MusicalPositionManager` - Musical position (bars:beats:sixteenths)

**Responsibilities**:
- Sample-accurate timing
- Transport state management
- Musical position tracking
- Loop management
- Tempo change handling
- Multi-widget synchronization

#### 3. `modules/storage/` (35+ files)
**Purpose**: Sample loading, caching, and CDN integration

**Structure**:
```
storage/
├── cache/
│   └── GlobalSampleCache.ts        # Central sample cache
├── batch/
│   ├── strategies/                 # Batch loading strategies
│   └── executors/                  # Batch execution
├── cdn/
│   └── CDNAdapter.ts               # CDN optimization
├── resilience/                     # Retry & circuit breaker
└── providers/                      # Storage backends
```

**Key Classes**:
- `GlobalSampleCache` - Central in-memory sample cache
- `BatchLoadExecutor` - Parallel sample loading
- `CDNAdapter` - CloudFront integration

**Responsibilities**:
- Sample caching (in-memory + IndexedDB)
- Batch loading with priority
- CDN integration and optimization
- Retry logic with exponential backoff
- Circuit breaker for failed loads

#### 4. `modules/audio-engine/` (20+ files)
**Purpose**: Web Audio API abstraction

**Structure**:
```
audio-engine/
├── core/
│   ├── AudioEngine.ts              # Main engine
│   ├── AudioContextManager.ts      # Context lifecycle
│   ├── ToneWrapper.ts              # Tone.js integration
│   └── AudioNodeManager.ts         # Node management
└── processors/
    ├── EffectsChain.ts             # Effects processing
    ├── MixerNode.ts                # Multi-channel mixing
    └── VolumeControl.ts            # Volume automation
```

**Key Classes**:
- `AudioEngine` - AudioContext wrapper
- `AudioContextManager` - Lifecycle & state management
- `MixerNode` - Multi-channel mixer with routing

**Responsibilities**:
- AudioContext lifecycle (suspended → running)
- Audio node graph management
- Effects routing
- Master output management

#### 5. `modules/midi/` (20+ files)
**Purpose**: MIDI file parsing and processing

**Structure**:
```
midi/
├── parser/                         # MIDI file parsing
├── loaders/                        # MIDI loading
├── transformers/                   # MIDI transformations
├── validators/                     # MIDI validation
└── pipeline/                       # Processing pipeline
```

**Key Classes**:
- `MidiParser` - MIDI file parsing
- `MidiValidator` - Validate MIDI structure
- `MidiTransformer` - Transform MIDI events

**Responsibilities**:
- Parse MIDI files (.mid)
- Extract notes, tempo, time signature
- Convert MIDI to internal format
- Validate MIDI structure

#### 6. `modules/preloading/` (15+ files)
**Purpose**: Smart sample preloading strategies

**Structure**:
```
preloading/
├── strategies/
│   ├── DrumPreloadStrategy.ts
│   ├── HarmonyPreloadStrategy.ts
│   ├── BassPreloadStrategy.ts
│   └── MetronomePreloadStrategy.ts
└── core/
    └── PreloadCoordinator.ts       # Orchestrates preloading
```

**Key Classes**:
- `HarmonyPreloadStrategy` - MIDI-based note loading
- `DrumPreloadStrategy` - Load all drum samples
- `PreloadCoordinator` - Orchestrates strategies

**Responsibilities**:
- MIDI-based smart loading (load only required notes)
- Instrument-specific preload strategies
- Priority-based loading
- OfflineAudioContext preloading (no user gesture)

### Supporting Modules

#### 7. `modules/tracks/` - Multi-track management
#### 8. `modules/metadata/` - Audio metadata (tempo, key, spectral)
#### 9. `modules/cdn/` - CDN optimization
#### 10. `modules/prediction/` - Predictive sample loading
#### 11. `modules/exercises/` - Exercise data management
#### 12. `modules/optimization/` - Performance monitoring
#### 13. `modules/errors/` - Module-level error handling
#### 14. `modules/logging/` - Module logging
#### 15. `modules/plugins/` - Plugin system base
#### 16. `modules/tempo/` - Tempo management (new)
#### 17. `modules/shared/` - Shared utilities
#### 18. `modules/expression/` - Musical expression
#### 19. `modules/intelligence/` - Smart features
#### 20. `modules/lifecycle/` - Component lifecycle
#### 21. `modules/loading/` - Asset loading
#### 22. `modules/pipelines/` - Processing pipelines
#### 23. `modules/__tests__/` - Module integration tests

---

## Service Classes & Public APIs

### 1. CoreServices (941 lines)
**Role**: Central orchestrator integrating all core services

**Singleton Pattern**: `GlobalAudioSystem` survives React re-mounts

**Public API**:
```typescript
class CoreServices {
  // Lifecycle
  async preInitialize(): Promise<void>
  async initialize(): Promise<void>
  async start(): Promise<void>
  async stop(): Promise<void>
  async dispose(): Promise<void>

  // Service Access
  getEventBus(): EventBus
  getAudioEngine(): AudioEngine
  getUnifiedTransport(): TransportAdapter
  getRegionProcessor(): RegionProcessor
  getPlaybackEngine(): PlaybackEngine  // Feature flag
  getTransportSyncManager(): TransportSyncManager
  getPluginManager(): PluginManager
  getAudioEventRouter(): AudioEventRouter
  getServiceRegistry(): ServiceRegistry
  getInstrumentRegistry(): InstrumentRegistry

  // Status
  isReady(): boolean
  getStatus(): CoreServicesStatus
}
```

**Responsibilities**:
- Service dependency injection
- Lifecycle coordination
- Sample buffer injection to RegionProcessor
- Plugin registration
- Feature flag management (dual-engine support)

**Usage**:
```typescript
import { CoreServices } from '@/domains/playback/services/core/CoreServices';

const coreServices = CoreServices.getInstance();
await coreServices.preInitialize();  // No AudioContext
await coreServices.initialize();     // Requires user gesture
await coreServices.start();          // Start playback
```

---

### 2. RegionProcessor (1,329 lines)
**Role**: Audio scheduling orchestrator for MIDI regions

**Extracted Modules**: Delegates to 15+ specialized modules

**Public API**:
```typescript
class RegionProcessor {
  // Configuration
  enableCountdown(timeSignature: TimeSignature): void
  disableCountdown(): void
  setAudioContext(context: AudioContext): void
  setPluginManager(pluginManager: PluginManager): void

  // Buffer Injection
  setMetronomeBuffers(accent: AudioBuffer, click: AudioBuffer, destination: AudioNode): void
  setDrumBuffers(kick: AudioBuffer, snare: AudioBuffer, hihat: AudioBuffer, destination: AudioNode): void
  setHarmonyBuffers(samples: Map<string, AudioBuffer[]>, destination: AudioNode, velocityRanges?: Map<string, VelocityRange[]>, instrument?: string): void
  setBassBuffers(samples: Map<string, AudioBuffer>, destination: AudioNode): void
  setVoiceCueBuffers(samples: Map<string, AudioBuffer>, destination: AudioNode): void

  // Track Management
  registerTracks(tracks: Track[]): void
  updateTracks(tracks: Track[], exerciseMetadata?: ExerciseMetadata): void

  // Lifecycle
  start(): void
  stop(graceful?: boolean): void  // graceful=true lets one-shots finish
  dispose(): void

  // Metrics
  getTimingMetrics(): TimingMetrics
}
```

**Region Processing Sub-Modules**:
1. **BufferManager** - Audio buffer registry
2. **ScheduleCache** - Per-exercise schedule caching
3. **TimingMetricsCollector** - Timing accuracy metrics
4. **SustainPedalManager** - CC64 pedal timeline
5. **HarmonySchedulerV2** - Modular harmony scheduler (1,477 lines)
6. **SimpleInstrumentScheduler** - One-shot samples (drums, bass, voice, metronome)
7. **RegionScheduler** - Orchestrates all scheduling
8. **LifecycleCoordinator** - Start/stop orchestration
9. **ConfigurationManager** - Countdown & time signature config
10. **TimePositionConverter** - Musical time → seconds
11. **EventRouter** - Route events to correct scheduler
12. **TrackManager** - Track registration & lifecycle
13. **DiagnosticLogger** - CC64 diagnostic tables
14. **VelocityLayerSelector** - Per-note velocity ranges
15. **MusicalTimeConverter** - Time domain conversions

**Responsibilities**:
- Process MIDI regions and schedule audio events
- Sample-accurate timing using `AudioContext.currentTime`
- Direct `AudioBufferSourceNode` scheduling (bypass event bus)
- CC64 sustain pedal management
- Tempo change handling with instant rescheduling
- Countdown system (metronome + voice cues)
- Multi-instrument coordination

**Architecture**:
```
RegionProcessor
    ├─→ LifecycleCoordinator
    │       ├─→ ConfigurationManager (countdown)
    │       └─→ TrackManager (track registry)
    │
    ├─→ BufferManager (audio buffers)
    │
    ├─→ RegionScheduler (orchestrator)
    │       ├─→ EventRouter
    │       ├─→ HarmonySchedulerV2
    │       │       ├─→ VelocityLayerSelector
    │       │       ├─→ SustainPedalManager
    │       │       ├─→ FadeoutManager
    │       │       └─→ BufferFallbackStrategy
    │       │
    │       └─→ SimpleInstrumentScheduler (drums, bass, voice, metronome)
    │
    ├─→ ScheduleCache (exercise caching)
    │
    └─→ TimingMetricsCollector (metrics)
```

---

### 3. Scheduler (596 lines)
**Role**: Unified event scheduler for all instruments

**Phase 1 Task 1.1**: Replaces 23+ scheduling modules

**Public API**:
```typescript
class Scheduler {
  // Configuration
  setAudioContext(context: AudioContext): void
  setBuffers(buffers: Map<string, AudioBuffer | AudioBuffer[]>, destination: AudioNode): void
  setHarmonyInstrument(instrument: string, perNoteRanges?: Map<string, VelocityRange[]>): void

  // Scheduling
  schedule(instrumentType: InstrumentType, event: SchedulableEvent, audioTime: number, options?: ScheduleOptions): ScheduledSource
  scheduleRegion(instrumentType: InstrumentType, events: SchedulableEvent[], startTime: number): ScheduledSource[]

  // Cleanup
  cancelAllScheduled(): void
  dispose(): void

  // Monitoring
  getStats(): SchedulerStats
}

// Types
type InstrumentType = 'metronome' | 'drums' | 'harmony' | 'bass' | 'voice';
type ScheduleOptions = { velocity?: number; duration?: number; fadeOut?: boolean };
```

**Supported Instruments**:
- **Metronome**: One-shot clicks (accent, normal)
- **Drums**: One-shot samples (kick, snare, hihat)
- **Bass**: One-shot bass notes
- **Voice Cues**: One-shot voice announcements
- **Harmony**: Sustained notes with velocity layers (4-16 layers)

**Responsibilities**:
- Data-driven instrument configuration
- Velocity layer selection (harmony)
- Octave shifting (Grand Piano: 0, Wurlitzer/Rhodes: -12 semitones)
- Auto-cleanup on note end (Bug #3 fix preserved)
- Source tracking for cancellation

---

### 4. EventBus (602 lines)
**Role**: Event-driven communication with circuit breakers

**Singleton Pattern**: Global event bus instance

**Public API**:
```typescript
class EventBus {
  // Subscription
  on<T>(event: string, handler: (data: T) => void): () => void  // Returns unsubscribe
  subscribe<T>(event: string, handler: (data: T) => void): () => void

  // Publishing
  async emit(event: string, data?: any, source?: string): Promise<void>
  async emitAndWait(event: string, data?: any, source?: string): Promise<void>

  // Replay (for debugging)
  async replay(filter?: (event: HistoryEntry) => boolean, targetHandler?: Function): Promise<void>
  getHistory(event?: string): HistoryEntry[]
  clearHistory(event?: string): void

  // Introspection
  getRegisteredEvents(): string[]
  getHandlerCount(event: string): number
  removeAllHandlers(event?: string): void

  // Schema Validation
  registerSchema(event: string, schema: ZodSchema): void

  // Monitoring
  getEventAnalytics(): EventAnalytics
  getCircuitBreakerMetrics(): Map<string, CircuitBreakerStatus>

  // Debugging
  getInstanceId(): string

  // Singleton
  static getGlobalInstance(config?: EventBusConfig): EventBus
}
```

**Event Types**:
```typescript
// Transport Events
'transport:start' | 'transport:stop' | 'transport:pause'
'transport:seek' | 'transport:tempo-change' | 'transport:time-signature-change'

// Playback Events
'playback:region-start' | 'playback:region-end'
'playback:note-on' | 'playback:note-off'

// Plugin Events
'plugin:loaded' | 'plugin:activated' | 'plugin:deactivated'

// Error Events
'error:audio-context' | 'error:sample-load' | 'error:scheduling'
```

**Responsibilities**:
- Type-safe event subscriptions
- Event history for replay
- Circuit breaker protection (failureThreshold: 3, recovery: 30s)
- Schema validation (optional)
- Event batching (optional)
- Cross-service communication

**Circuit Breaker States**:
- **CLOSED**: Normal operation
- **OPEN**: Too many failures, reject new events
- **HALF_OPEN**: Testing recovery

---

### 5. PluginManager (668 lines)
**Role**: WAM plugin lifecycle management

**Implements**: `Service` interface

**Public API**:
```typescript
class PluginManager implements Service {
  // Service Lifecycle
  async initialize(): Promise<void>
  async start(): Promise<void>
  async stop(): Promise<void>
  async dispose(): Promise<void>

  // Plugin Registration
  async register(plugin: AudioPlugin, dependencies?: string[]): Promise<void>

  // Plugin Lifecycle
  async loadPlugin(pluginId: string): Promise<void>
  async activatePlugin(pluginId: string): Promise<void>
  async deactivatePlugin(pluginId: string): Promise<void>

  // Plugin Access
  getPlugin<T extends AudioPlugin>(pluginId: string): T | undefined
  getAllPlugins(): AudioPlugin[]
  getPluginsByCapability(capability: string): AudioPlugin[]
  getPluginState(pluginId: string): PluginState

  // Bulk Operations
  async loadAllPlugins(): Promise<void>  // Loads in dependency order
}

// Plugin States
type PluginState = 'unloaded' | 'loading' | 'loaded' | 'active' | 'inactive' | 'error';
```

**Auto-Loaded Plugins**:
- `WamKeyboardPlugin` - Harmony keyboard with CC64
- `BassProcessor` - Bass sampler
- `DrumProcessor` - Drum kit
- `MetronomeProcessor` - Metronome clicks

**Responsibilities**:
- Plugin lifecycle (load → initialize → activate → deactivate → dispose)
- Dependency resolution (topological sort)
- Transport event forwarding to plugins
- Circuit breaker for error handling
- PluginAudioContext wrapper for context access

---

### 6. TransportAdapter (466 lines)
**Role**: Transport control abstraction (replaces 3000+ line UnifiedTransport)

**Singleton Pattern**: Single transport instance

**Public API**:
```typescript
class TransportAdapter {
  // Singleton
  static getInstance(eventBus?: EventBus, audioEngine?: AudioEngine, config?: TransportConfig): TransportAdapter

  // Lifecycle
  async initialize(): Promise<void>
  async dispose(): Promise<void>

  // Playback Control
  async start(): Promise<void>
  async stop(): Promise<void>
  async pause(): Promise<void>
  async resume(): Promise<void>
  async seek(position: number): Promise<void>

  // Configuration
  setTempo(bpm: number): void
  setTimeSignature(numerator: number, denominator: number): void
  async setLoop(startOrEnabled: boolean | number, end?: number): Promise<void>
  setLoopMusical(enabled: boolean, start?: string, end?: string): void
  setExerciseDuration(totalBars: number, beatsPerBar: number): void
  setCountdownBeats(beats: number): void
  setTransportStartTime(time: number): void

  // State Access
  getState(): TransportState
  getPosition(): number              // seconds
  getMusicalPosition(): MusicalPosition
  getCurrentTime(): number           // seconds (alias)
  getTempo(): number
  getTimeSignature(): TimeSignature
  getCurrentPosition(): string       // UI display (bars:beats:sixteenths)
  getDisplayPosition(): string       // Countdown-adjusted position

  // Event Scheduling
  scheduleEvent(event: SchedulableEvent): void
  cancelEvent(eventId: string): void

  // Metrics
  getMetrics(): TransportMetrics
}

// Types
type TransportState = 'stopped' | 'playing' | 'paused';
type MusicalPosition = { bars: number; beats: number; sixteenths: number };
```

**Responsibilities**:
- Wraps `TransportController` from `modules/transport/`
- Backward compatibility API (migration from UnifiedTransport)
- Countdown offset management for display
- Musical position tracking
- Loop management
- Event scheduling delegation

---

### 7. InitialSamplePreloader (2,154 lines)
**Role**: Three-phase sample loading system

**Singleton Pattern**: Single preloader instance

**Public API**:
```typescript
class InitialSamplePreloader {
  // Singleton
  static getInstance(): InitialSamplePreloader

  // Loading Phases
  async loadEssentialSamples(): Promise<void>         // Phase 2: Register configs
  async loadFullSamples(exercise?: Exercise): Promise<void>  // Phase 3: FAANG smart loading
  async loadTutorialSamples(exercises: Exercise[], tutorialId?: string): Promise<void>

  // Status
  isComplete(): boolean
  getStats(): PreloadStats
}
```

**Three-Phase Loading**:

**Phase 1: Pre-initialization** (ScrollTriggerLoader)
- Initialize CoreServices without AudioContext
- Load Tone.js
- Set up event bus

**Phase 2: Essential Samples** (loadEssentialSamples)
- Register instrument configs
- Load minimal metronome samples
- OfflineAudioContext preloading (no user gesture)

**Phase 3: Smart Loading** (loadFullSamples)
- **MIDI-based smart loading** - Load only required notes
- AudioContext instrument creation (requires running context)
- Parallel loading with priority
- RegionProcessor buffer injection
- Voice cue countdown support

**Responsibilities**:
- MIDI-based note extraction (load only used notes)
- OfflineAudioContext preloading (background)
- AudioContext instrument creation (foreground)
- Instrument factory registration
- GlobalSampleCache integration
- Buffer injection to RegionProcessor

**Preload Strategies**:
- `HarmonyPreloadStrategy` - MIDI-based note loading
- `DrumPreloadStrategy` - Load all drum samples
- `BassPreloadStrategy` - MIDI-based note loading
- `MetronomePreloadStrategy` - Load accent + click

---

### 8. WindowRegistry (398 lines)
**Role**: Centralized window global management (Bug #8 fix)

**Static Utility**: All methods are static

**Public API**:
```typescript
class WindowRegistry {
  // Core Services
  static setCoreServices(services: CoreServices): void
  static getCoreServices(): CoreServices | null

  // Service Registry
  static setServiceRegistry(registry: ServiceRegistry): void
  static getServiceRegistry(): ServiceRegistry | null

  // Event Bus
  static setEventBus(eventBus: EventBus): void
  static getEventBus(): EventBus | null

  // Audio Context
  static setAudioContext(context: AudioContext): void
  static getAudioContext(): AudioContext | null

  // Dual-Engine Tracking
  static setRegionProcessor(processor: RegionProcessor): void
  static getRegionProcessor(): RegionProcessor | null
  static setPlaybackEngine(engine: PlaybackEngine): void
  static getPlaybackEngine(): PlaybackEngine | null

  // Sample Loading Flags
  static setSamplesReady(ready: boolean): void
  static getSamplesReady(): boolean

  // Cleanup
  static cleanup(): void

  // Debugging
  static debugGetAll(): Record<string, any>
  static debugCheckLegacyKeys(): string[]
}
```

**Global Keys** (all prefixed with `__bassnotion_`):
```typescript
window.__bassnotion_coreServices
window.__bassnotion_serviceRegistry
window.__bassnotion_eventBus
window.__bassnotion_audioContext
window.__bassnotion_regionProcessor    // Legacy engine
window.__bassnotion_playbackEngine     // New engine
window.__bassnotion_samplesReady
```

**Responsibilities**:
- Prevent window object pollution
- Type-safe global accessors
- Dual-engine tracking (RegionProcessor + PlaybackEngine)
- Legacy key cleanup
- Development debugging

---

## React Components

### 3D Visualization Components (5)

#### 1. FretboardVisualizer
**File**: `components/FretboardVisualizer/FretboardVisualizer.tsx`

**Props**:
```typescript
interface FretboardVisualizerProps {
  notes: ExerciseNote[];
  currentTime: number;
  bpm: number;
  isPlaying: boolean;
  onCameraReset?: () => void;
  onSettingsClick?: () => void;
  isEditMode?: boolean;
  onNotesChange?: (notes: ExerciseNote[]) => void;
  onEditModeToggle?: (isEditMode: boolean) => void;
}
```

**Responsibilities**:
- 3D fretboard visualization using React Three Fiber
- Edit mode with note selection
- Context menu for note editing
- Keyboard shortcuts (Escape, Delete)
- Integrates Canvas, OrbitControls, PerspectiveCamera

#### 2. Fretboard3D
**Props**:
```typescript
interface Fretboard3DProps {
  visible?: boolean;
  strings?: number;
  notes?: ExerciseNote[];
  isEditMode?: boolean;
  selectedNote?: number | null;
  onNoteSelect?: (index: number | null) => void;
}
```

**Responsibilities**:
- Renders 3D fretboard geometry
- Fretboard dots/markers (circles/squares)
- Perspective scaling (bottom bigger, top smaller)
- Click detection for note selection

#### 3. NoteRenderer
**Props**:
```typescript
interface NoteRendererProps {
  notes: ExerciseNote[];
  currentTime: number;
  bpm: number;
  visible?: boolean;
}
```

**Responsibilities**:
- Renders notes as 3D spheres
- Color-coded states: current (red), upcoming (fade), played (gray)
- Opacity calculation for fade-in
- Position calculation based on timestamp
- Note labels above spheres

#### 4. TechniqueRenderer
**Props**:
```typescript
interface TechniqueRendererProps {
  notes: ExerciseNote[];
  currentTime: number;
  visible?: boolean;
}
```

**Responsibilities**:
- Renders bass playing techniques as 3D visualizations
- Hammer-on (red curved line)
- Pull-off (cyan curved line)
- Slide (blue straight line)
- Bend (green curved arc)
- Harmonic (gold diamond shape)
- Time-based visibility (4s ahead, 1s behind)

#### 5. NoteSelector
**Props**:
```typescript
interface NoteSelectorProps {
  selectedNoteId: string | null;
  notes: ExerciseNote[];
  onSelectionChange: (noteId: string | null) => void;
  isEditMode: boolean;
}
```

**Responsibilities**:
- Visual highlight for selected notes
- Gold ring geometry around selected note
- Pulse animation with double ring

### Interaction Components (2)

#### 6. InteractionManager
**Props**:
```typescript
interface InteractionManagerProps {
  notes: ExerciseNote[];
  onNoteSelect: (noteId: string | null) => void;
  onNoteCreate: (fret: number, string: number, time: number) => void;
  onNoteDrag: (noteId: string, newFret: number, newString: number, newTime: number) => void;
  selectedNoteId: string | null;
  isEditMode: boolean;
  currentTime: number;
  children: React.ReactNode;
}
```

**Responsibilities**:
- Raycasting for 3D click detection
- World coordinates → fret/string conversion
- Note creation by clicking empty spaces
- Note selection and dragging
- Keyboard shortcuts for deletion

#### 7. ContextMenu
**Props**:
```typescript
interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  selectedNote: ExerciseNote | null;
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onProperties: () => void;
}
```

**Responsibilities**:
- Right-click context menu for note editing
- Keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+D, Del)
- Click-outside to close

### System Components (3)

#### 8. CoreServicesGate
**Props**:
```typescript
interface CoreServicesGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: (error: Error) => React.ReactNode;
}
```

**Responsibilities**:
- Race condition prevention gate
- Suspends rendering until CoreServices ready
- Three states: loading, error, ready
- Exports companion hook: `useCoreServicesReady()`

#### 9. ScrollTriggerLoader
**Props**:
```typescript
interface ScrollTriggerLoaderProps {
  exercises?: Exercise[];
  tutorialId?: string;
}
```

**Responsibilities**:
- Critical initialization orchestrator
- Triggers on first user interaction
- 3-step sequence:
  1. Pre-initialize CoreServices (no AudioContext)
  2. Load tutorial/essential samples
  3. Emit 'samples-ready' event
- Prevents Bug #1 (Race Condition)
- Invisible component (renders nothing)

#### 10. TransportSyncMonitor
**Props**: None

**Responsibilities**:
- FAANG-style monitoring dashboard
- Real-time metrics: clients, latency, heartbeats, reconnections
- Health status: healthy/warning/critical
- Collapsible UI (button when hidden, panel when visible)

---

## Custom Hooks

### Core Audio Hooks (4)

#### 1. useAudio
**Signature**:
```typescript
function useAudio(serviceRegistry?: ServiceRegistry): UseAudioResult

type UseAudioResult = {
  isReady: boolean;
  isInitializing: boolean;
  error: Error | null;
  createSampler: (config: SamplerConfig) => Promise<AudioSampler>;
  getTone: () => any;
  audioContext: AudioContext | null;
  initialize: () => Promise<void>;
}
```

**Purpose**: AudioEngine integration with error handling and type-safe sampler creation

#### 2. useAudioContext
**Signature**:
```typescript
function useAudioContext(): UseAudioContextReturn

type UseAudioContextReturn = {
  context: AudioContext | null;
  state: AudioContextState | null;
  isRunning: boolean;
  isSuspended: boolean;
  isClosed: boolean;
}
```

**Purpose**: Bug #4 fix - Event-driven AudioContext state (replaces 500ms polling with 0ms latency)

#### 3. useCoreServices
**Signature**:
```typescript
function useCoreServices(options?: UseCoreServicesOptions): UseCoreServicesReturn

type UseCoreServicesOptions = {
  autoInitialize?: boolean;
  enablePerformanceMonitoring?: boolean;
  mobileOptimized?: boolean;
  onError?: (error: Error) => void;
  onPerformanceAlert?: (alert: PerformanceAlert) => void;
}

type UseCoreServicesReturn = {
  state: CoreServicesState;
  controls: PlaybackControls;
  services: { coreServices, audioEngine, transport, eventBus, pluginManager };
  initialize: () => Promise<void>;
  dispose: () => Promise<void>;
}
```

**Purpose**: Modern CoreServices integration (replaces legacy useCorePlaybackEngine)

#### 4. usePlatformAudio
**Signature**:
```typescript
function usePlatformAudio(): PlatformAudioState

type PlatformAudioState = {
  coreServices: CoreServices | null;
  transport: TransportAdapter | null;
  sampleLoader: InitialSamplePreloader | null;
  isAudioReady: boolean;
  isLoading: boolean;
  error: Error | null;
  audioContextState: 'suspended' | 'running' | 'closed' | 'unknown';
  sampleProgress: { harmony, drums, bass, metronome, overall };
}
```

**Purpose**: Universal audio hook (works with or without AudioProvider). Hybrid pattern: React context first, then global singleton fallback.

### Track Management Hooks (3)

#### 5. useTrack
**Signature**:
```typescript
function useTrack(options: UseTrackOptions): UseTrackReturn

type UseTrackOptions = {
  trackId: string;
  name: string;
  type: InstrumentType;
  autoInit?: boolean;
  debugMode?: boolean;
}

type UseTrackReturn = {
  // Track instance
  track: Track | null;
  trackId: string;

  // State
  isInitialized: boolean;
  isReady: boolean;
  error: Error | null;
  state: TrackState;

  // Playback control
  play: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  mute: () => void;
  solo: () => void;

  // Volume/Pan
  setVolume: (volume: number) => void;
  setPan: (pan: number) => void;

  // Plugin management
  loadWAMPlugin: (pluginUrl: string, config?: any) => Promise<void>;
  removePlugin: (pluginId: string) => void;

  // Transport integration
  isPlaying: boolean;
  currentTime: number;
  tempo: number;

  // Region management (13 methods)
  regions: Region[];
  createRegionFromPattern: (pattern: Pattern) => Region;
  migratePatternToRegion: (pattern: Pattern) => Region;
  addRegion: (region: Region) => void;
  removeRegion: (regionId: string) => void;
  updateRegion: (regionId: string, updates: Partial<Region>) => void;
  getRegionsInRange: (start: number, end: number) => Region[];
  getRegionsAtPosition: (position: number) => Region[];
  clearRegions: () => void;

  // Arrangement view
  selectedRegions: string[];
  selectRegion: (regionId: string) => void;
  deselectRegion: (regionId: string) => void;
}
```

**Purpose**: Track-based widget architecture. Each widget becomes a track controller with WAM plugins and region management. Professional DAW pattern.

#### 6. useTrackMigration
**Signature**:
```typescript
function useTrackMigration(options: UseTrackMigrationOptions): UseTrackMigrationReturn

type UseTrackMigrationOptions = {
  widgetId: string;
  trackType?: InstrumentType;
  debug?: boolean;
}

type UseTrackMigrationReturn = {
  // usePlaybackState-compatible interface
  playbackState, isInitialized, isLoading, error,
  performanceMetrics,
  play, pause, stop, setTempo, setPitch, setVolume, seek,
  isPlaying, isPaused, isStopped,
  syncEvents,
  tempo, masterVolume, pitch, swingFactor,

  // New useTrack features exposed
  track, trackId, regions,
  addRegion, removeRegion
}
```

**Purpose**: Migration adapter (usePlaybackState → useTrack). Allows gradual widget migration.

#### 7. useTrackCompatibility
**Signature**:
```typescript
function useTrackCompatibility(options: UseTrackCompatibilityOptions): TrackCompatibilityState

type UseTrackCompatibilityOptions = {
  widgetId: string;
  widgetType: string;
  pattern?: Pattern;
  enabled?: boolean;
  priority?: number;
  onPatternTrigger?: (event: PatternEvent, time: number) => void;
  onStateChange?: (state: any) => void;
  debugMode?: boolean;
}

type TrackCompatibilityState = {
  isRegistered: boolean;
  isEnabled: boolean;
  trackId: string;
  track: Track | null;
  updatePattern: (pattern: Pattern) => void;
  setEnabled: (enabled: boolean) => void;
  migrateToTrack: () => Promise<Track>;
  metrics: { eventCount, lastEventTime };
}
```

**Purpose**: Backward compatibility layer for existing widget hooks to work with track-based system.

### Mixing Hooks (3)

#### 8. useTrackMixing
**Signature**:
```typescript
function useTrackMixing(options: UseTrackMixingOptions): TrackMixingControls

type UseTrackMixingOptions = {
  track: Track;
  onSoloChange?: (isSoloed: boolean) => void;
  onMuteChange?: (isMuted: boolean) => void;
  debugMode?: boolean;
}

type TrackMixingControls = {
  volume: number;
  pan: number;
  isMuted: boolean;
  isSoloed: boolean;
  setVolume: (volume: number) => void;
  setPan: (pan: number) => void;
  toggleMute: () => void;
  toggleSolo: () => void;
  addEffect: (effect: AudioEffect) => void;
  createSend: (bus: string, level: number) => void;
  updateSendLevel: (sendId: string, level: number) => void;
  channel: MixerChannel | null;
  isChannelActive: boolean;
}
```

**Purpose**: Track-based mixing controls with TrackMixingEngine integration.

#### 9. useMixBuses
#### 10. useMixingSnapshots

### Timing Hooks (2)

#### 11. useTrackTiming
**Signature**:
```typescript
function useTrackTiming(options: UseTrackTimingOptions): TrackTimingHookState

type UseTrackTimingOptions = {
  track: Track;
  priority?: number;
  onIsolated?: (info: IsolatedTrackInfo) => void;
  onRecovered?: (trackId: string) => void;
  debugMode?: boolean;
}

type TrackTimingHookState = {
  isActive: boolean;
  drift: number;
  stability: number;
  errorCount: number;
  isIsolated: boolean;
  isolationReason: string;
  canRecover: boolean;
  scheduleEvent: (event: TimingEvent) => void;
  cancelEvent: (eventId: string) => void;
  resetErrors: () => void;
  recoverFromIsolation: () => void;
  metrics?: TrackSyncMetrics;
}
```

**Purpose**: Track timing synchronization with sample-accurate scheduling and timing isolation.

#### 12. useTimingHealth

### Plugin Hooks (2)

#### 13. usePlugins
#### 14. useWAMPlugin

### State Hooks (2)

#### 15. usePlaybackState
**Signature**:
```typescript
function usePlaybackState(widgetId?: string): UsePlaybackStateReturn

type UsePlaybackStateReturn = {
  playbackState, isInitialized, isLoading, error,
  performanceMetrics,
  play, pause, stop, setTempo, setPitch, setVolume, seek,
  isPlaying, isPaused, isStopped,
  syncEvents,
  tempo, masterVolume, pitch, swingFactor
}
```

**Purpose**: Easy access to playback state (Zustand store). Optimized for minimal re-renders.

#### 16. useAssetLoading

### Deprecated Hooks (0)

#### ~~useTransport~~ (REMOVED - December 2025)
**Status**: Migrated to TransportContext ✅

**Migration Complete**: Old hook deleted, all imports now use `useTransport()` from TransportContext.
- Old individual subscriptions (56+) replaced with single shared subscription
- 87% reduction in EventBus subscriptions achieved
- All components migrated to TransportProvider pattern

---

## Architectural Patterns

### 1. God Object Breakdown

**Problem**: Massive, unmaintainable service files

**Solution**: Extract into focused modules with single responsibilities

**Examples**:
- **RegionProcessor**: 3,902 lines → 1,329 lines + 15 modules
- **UnifiedTransport**: 3,000+ lines → TransportAdapter (466 lines) + modules/transport
- **HarmonyScheduler**: 1,477 lines → HarmonySchedulerV2 (still large, needs further breakdown)

**Benefits**:
- Easier testing (isolated modules)
- Better maintainability
- Clear responsibilities
- Parallel development

### 2. Service Interface Pattern

**Pattern**: All core services implement `Service` interface

**Interface**:
```typescript
interface Service {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
```

**Services**:
- CoreServices
- PluginManager
- EventBus
- AudioEngine
- TransportAdapter

**Benefits**:
- Consistent lifecycle
- Predictable behavior
- Easy testing (mock services)

### 3. Singleton Pattern

**Usage**: Services that need single global instance

**Examples**:
- EventBus - Single event bus for entire app
- TransportAdapter - Single transport controller
- PluginManager - Single plugin registry
- InitialSamplePreloader - Single sample loader
- WindowRegistry - Static utility class

**Implementation**:
```typescript
class EventBus {
  private static instance: EventBus;

  static getGlobalInstance(config?: EventBusConfig): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus(config);
    }
    return EventBus.instance;
  }

  private constructor() { /* ... */ }
}
```

**Benefits**:
- Single source of truth
- Survives React re-mounts
- Global accessibility

### 4. Dependency Injection

**Pattern**: ServiceRegistry manages service dependencies

**Implementation**:
```typescript
class ServiceRegistry {
  private services = new Map<string, any>();

  register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }

  get<T>(key: string): T {
    return this.services.get(key) as T;
  }
}

// Usage
const registry = new ServiceRegistry();
registry.register('eventBus', new EventBus());
registry.register('audioEngine', new AudioEngine(registry.get('eventBus')));

// In services
class PluginManager {
  constructor(private registry: ServiceRegistry) {}

  getEventBus() {
    return this.registry.get<EventBus>('eventBus');
  }
}
```

**Benefits**:
- Testability (inject mocks)
- Loose coupling
- Clear dependencies

### 5. Event-Driven Architecture

**Pattern**: Pub/sub via EventBus with circuit breakers

**Implementation**:
```typescript
// Publisher
eventBus.emit('transport:start', { time: audioContext.currentTime });

// Subscriber
const unsubscribe = eventBus.on('transport:start', (data) => {
  console.log('Transport started at', data.time);
});

// Cleanup
unsubscribe();
```

**Circuit Breaker**:
```typescript
// If handler fails 3 times, circuit opens
// Rejects new events for 30 seconds
// Then tries again (half-open)
```

**Benefits**:
- Decoupled services
- Error isolation
- Event replay for debugging

### 6. Repository Pattern (DDD)

**Pattern**: Separate data access from business logic

**Structure**:
```
repositories/
├── interfaces/
│   ├── ITrackRepository.ts
│   ├── ITransportRepository.ts
│   └── IPluginPresetRepository.ts
├── track/
│   ├── TrackRepository.ts
│   ├── CachedTrackRepository.ts
│   └── TrackRepositoryStore.ts
├── entities/
│   ├── TrackEntity.ts
│   └── TransportState.ts
└── value-objects/
    ├── TrackId.ts
    ├── Tempo.ts
    └── Volume.ts
```

**Example**:
```typescript
// Interface
interface ITrackRepository {
  findById(id: TrackId): Promise<TrackEntity>;
  save(track: TrackEntity): Promise<void>;
  delete(id: TrackId): Promise<void>;
}

// Implementation
class TrackRepository implements ITrackRepository {
  async findById(id: TrackId): Promise<TrackEntity> {
    const data = await db.tracks.get(id.value);
    return TrackEntity.fromData(data);
  }
}

// Value Object
class TrackId {
  constructor(private readonly value: string) {
    if (!value) throw new Error('TrackId cannot be empty');
  }

  equals(other: TrackId): boolean {
    return this.value === other.value;
  }
}
```

**Benefits**:
- Clear boundaries
- Testable (mock repositories)
- Domain model protection

### 7. Adapter Pattern

**Pattern**: Wrap external APIs or legacy code

**Examples**:

**TransportAdapter** - Wraps TransportController
```typescript
class TransportAdapter {
  private controller: TransportController;

  async start() {
    await this.controller.start();
    this.eventBus.emit('transport:start');
  }
}
```

**InstrumentAdapter** - Wraps legacy processors
```typescript
class InstrumentAdapter implements Instrument {
  constructor(private legacyProcessor: any) {}

  async play(note: number, velocity: number) {
    this.legacyProcessor.trigger(note, velocity);
  }
}
```

**Benefits**:
- Gradual migration
- Backward compatibility
- Interface stability

### 8. Strategy Pattern

**Pattern**: Interchangeable algorithms

**Examples**:

**PreloadStrategy**
```typescript
interface PreloadStrategy {
  preload(exercise: Exercise): Promise<void>;
}

class HarmonyPreloadStrategy implements PreloadStrategy {
  async preload(exercise: Exercise) {
    const notes = extractNotesFromMIDI(exercise);
    await loadOnlyRequiredNotes(notes);
  }
}

class DrumPreloadStrategy implements PreloadStrategy {
  async preload(exercise: Exercise) {
    await loadAllDrumSamples();  // Different strategy
  }
}
```

**BatchLoadStrategy**
```typescript
interface BatchLoadStrategy {
  load(urls: string[]): Promise<AudioBuffer[]>;
}

class ParallelLoadStrategy implements BatchLoadStrategy {
  async load(urls: string[]) {
    return Promise.all(urls.map(loadAudioBuffer));
  }
}
```

**Benefits**:
- Flexible algorithms
- Easy to add new strategies
- Testable independently

---

## Critical Subsystems

### 1. Sample-Accurate Audio Scheduling

**Architecture**:
```
EventScheduler
    ↓
AudioContext.currentTime (reference clock)
    ↓
AudioBufferSourceNode.start(audioTime)
    ↓
Hardware Audio Output
```

**Key Principles**:
- Use `AudioContext.currentTime` as reference (never `Date.now()`)
- Schedule events in audio time domain (seconds from context start)
- Direct `AudioBufferSourceNode` scheduling (bypass event bus for audio)
- Lookahead scheduling (schedule 100ms ahead, update every 25ms)

**Code Example**:
```typescript
// RegionProcessor scheduling
const audioTime = this.audioContext.currentTime + 0.1;  // 100ms lookahead
const source = this.audioContext.createBufferSource();
source.buffer = buffer;
source.connect(destination);
source.start(audioTime);  // Sample-accurate!
```

**Latency Calculation**:
```typescript
// Output latency compensation
const outputLatency = audioContext.outputLatency || 0;
const compensatedTime = audioTime - outputLatency;
source.start(compensatedTime);
```

### 2. Multi-Track Synchronization

**Components**:
- `SampleAccurateClock` - Master clock (AudioContext.currentTime)
- `WidgetSyncManager` - Multi-widget sync via heartbeat
- `MultiTrackTimingSynchronizer` - Cross-track timing
- `TimingIsolationManager` - Isolate broken tracks

**Sync Flow**:
```
SampleAccurateClock (master)
    ↓
TransportController (transport time)
    ↓
RegionProcessor (schedules all tracks)
    ↓
Track 1, Track 2, Track 3, ... (individual instruments)
    ↓
MultiTrackTimingSynchronizer (drift detection)
    ↓
TimingIsolationManager (isolate if drift > 50ms)
```

**Drift Detection**:
```typescript
const expectedTime = transportTime;
const actualTime = trackTime;
const drift = Math.abs(actualTime - expectedTime);

if (drift > 50) {  // 50ms threshold
  timingIsolationManager.isolateTrack(trackId, 'excessive-drift');
}
```

**Recovery**:
```typescript
// Reset track timing
track.reset();
track.seekTo(transport.getCurrentTime());

// If drift < 10ms for 5 seconds, recover
if (stableFor5Seconds) {
  timingIsolationManager.recoverTrack(trackId);
}
```

### 3. Velocity-Layered Sampling

**Architecture**:
```
HarmonySchedulerV2
    ↓
VelocityLayerSelector
    ↓
Select layer based on MIDI velocity (0-127)
    ↓
AudioBuffer from correct layer
    ↓
Schedule with AudioBufferSourceNode
```

**Velocity Ranges**:
```typescript
// Example: Grand Piano (16 velocity layers)
const velocityRanges: VelocityRange[] = [
  { min: 0,   max: 7,   layer: 0 },   // ppp
  { min: 8,   max: 15,  layer: 1 },
  { min: 16,  max: 23,  layer: 2 },
  // ... 13 more layers
  { min: 120, max: 127, layer: 15 },  // fff
];

// Wurlitzer (4 velocity layers)
const wurlitzerRanges: VelocityRange[] = [
  { min: 0,   max: 31,  layer: 0 },   // v1
  { min: 32,  max: 63,  layer: 1 },   // v2
  { min: 64,  max: 95,  layer: 2 },   // v3
  { min: 96,  max: 127, layer: 3 },   // v4
];
```

**Layer Selection**:
```typescript
function selectVelocityLayer(velocity: number, ranges: VelocityRange[]): number {
  for (const range of ranges) {
    if (velocity >= range.min && velocity <= range.max) {
      return range.layer;
    }
  }
  return 0;  // Default to softest layer
}
```

**Buffer Loading**:
```typescript
// Harmony buffers organized by note and layer
const harmonyBuffers = new Map<string, AudioBuffer[]>();

// Example: C4 with 4 velocity layers
harmonyBuffers.set('C4', [
  buffer_C4_v1,  // velocity 0-31
  buffer_C4_v2,  // velocity 32-63
  buffer_C4_v3,  // velocity 64-95
  buffer_C4_v4,  // velocity 96-127
]);

// At scheduling time
const layer = selectVelocityLayer(velocity, ranges);
const buffer = harmonyBuffers.get(noteName)[layer];
```

### 4. Sustain Pedal System (CC64)

**Architecture**:
```
MIDI CC64 Events
    ↓
SustainPedalManager
    ↓
Build pedal-down timeline
    ↓
Extend note durations during pedal-down
    ↓
HarmonySchedulerV2 schedules extended notes
```

**Timeline Building**:
```typescript
// Extract CC64 events from MIDI
const cc64Events = midiEvents.filter(e => e.type === 'cc' && e.controller === 64);

// Build timeline of pedal state
const pedalTimeline: PedalEvent[] = [];
cc64Events.forEach(event => {
  pedalTimeline.push({
    time: event.time,
    isDown: event.value >= 64  // MIDI convention: >=64 is "down"
  });
});
```

**Note Duration Extension**:
```typescript
function extendNoteDuration(note: MIDINoteEvent, pedalTimeline: PedalEvent[]): number {
  const noteOff = note.time + note.duration;

  // Find pedal state at note-off time
  const pedalState = getPedalStateAt(noteOff, pedalTimeline);

  if (pedalState.isDown) {
    // Extend until pedal release
    const pedalRelease = findNextPedalRelease(noteOff, pedalTimeline);
    return pedalRelease - note.time;
  }

  return note.duration;  // No extension
}
```

**Scheduling**:
```typescript
// Schedule note with extended duration
const extendedDuration = extendNoteDuration(note, pedalTimeline);
const source = scheduleNote(note, layer);

// Schedule note-off at extended time
source.stop(note.time + extendedDuration);
```

### 5. Three-Phase Sample Loading

**Phase 1: Pre-initialization** (ScrollTriggerLoader)
```typescript
// On first user interaction (scroll, touch, click)
await CoreServices.getInstance().preInitialize();  // No AudioContext yet
```

**Phase 2: Essential Samples** (InitialSamplePreloader)
```typescript
// Load minimal samples needed for immediate playback
await preloader.loadEssentialSamples();

// What's loaded:
// - Instrument configs (JSON)
// - Metronome accent + click
// - OfflineAudioContext preloading (background)
```

**Phase 3: Smart Loading** (InitialSamplePreloader)
```typescript
// MIDI-based smart loading - load only required notes
await preloader.loadFullSamples(exercise);

// What's loaded:
// - Extract notes from MIDI
// - Load only used notes (not all 88 piano keys)
// - AudioContext instrument creation (foreground)
// - Buffer injection to RegionProcessor
```

**MIDI-Based Note Extraction**:
```typescript
// Extract unique notes from MIDI
function extractRequiredNotes(exercise: Exercise): Set<string> {
  const notes = new Set<string>();

  exercise.tracks.forEach(track => {
    track.regions.forEach(region => {
      region.events.forEach(event => {
        if (event.type === 'note') {
          notes.add(midiNumberToNoteName(event.note));
        }
      });
    });
  });

  return notes;
}

// Example: Exercise uses C4, E4, G4
// Load only: C4_v1-v4.wav, E4_v1-v4.wav, G4_v1-v4.wav
// Don't load: A4, B4, C5, ... (unused notes)
```

### 6. MIDI Processing Pipeline

**Pipeline Stages**:
```
MIDI File (.mid)
    ↓
MidiParser (parse binary format)
    ↓
MidiValidator (validate structure)
    ↓
MidiTransformer (transform to internal format)
    ↓
RegionConverter (convert to playback regions)
    ↓
RegionProcessor (schedule audio events)
```

**Code Flow**:
```typescript
// 1. Parse MIDI file
const midiData = await MidiParser.parse(midiFileBuffer);

// 2. Validate structure
const validation = MidiValidator.validate(midiData);
if (!validation.valid) throw new Error(validation.errors);

// 3. Transform to internal format
const internalFormat = MidiTransformer.transform(midiData);

// 4. Convert to regions
const regions = RegionConverter.convert(internalFormat);

// 5. Schedule audio events
regionProcessor.registerTracks(regions);
regionProcessor.start();
```

**MIDI Event Types**:
```typescript
type MidiEvent =
  | { type: 'note'; note: number; velocity: number; duration: number; time: number }
  | { type: 'cc'; controller: number; value: number; time: number }
  | { type: 'tempo'; bpm: number; time: number }
  | { type: 'timeSignature'; numerator: number; denominator: number; time: number };
```

### 7. 3D Fretboard Visualization

**Technology Stack**:
- React Three Fiber (React renderer for Three.js)
- Three.js (3D graphics library)
- @react-three/drei (Three.js helpers)

**Architecture**:
```
FretboardVisualizer (main component)
    ├─→ Canvas (React Three Fiber)
    │       ├─→ PerspectiveCamera
    │       ├─→ OrbitControls (camera control)
    │       └─→ Scene
    │               ├─→ Fretboard3D (fretboard geometry)
    │               ├─→ NoteRenderer (note spheres)
    │               ├─→ TechniqueRenderer (hammer-ons, slides, etc.)
    │               ├─→ InteractionManager (raycasting)
    │               └─→ NoteSelector (selection highlight)
    │
    └─→ ContextMenu (2D overlay)
```

**Raycasting for Note Selection**:
```typescript
// InteractionManager.tsx
const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObject(fretboardMesh);

  if (intersects.length > 0) {
    const point = intersects[0].point;
    const { fret, string } = worldToFretboard(point);
    onNoteCreate(fret, string, currentTime);
  }
}, [camera, currentTime]);
```

**Note Rendering with Color Coding**:
```typescript
// NoteRenderer.tsx
const visibleNotes = useMemo(() => {
  return notes.map(note => {
    const state = getNoteState(note, currentTime);
    const material = createNoteMaterial(state);
    const position = calculateNoteDisplayPosition(note, bpm, currentTime);

    return { note, material, position };
  });
}, [notes, currentTime, bpm]);

// Color coding
// - Current note: RED (#ff0000)
// - Upcoming note: String color with fade
// - Played note: GRAY (#808080)
```

**Technique Visualization**:
```typescript
// TechniqueRenderer.tsx
// Hammer-on: Red curved line connecting two notes
// Pull-off: Cyan curved line
// Slide: Blue straight line
// Bend: Green curved arc
// Harmonic: Gold diamond shape

const renderHammerOn = (fromNote: Note, toNote: Note) => {
  const curve = new THREE.QuadraticBezierCurve3(
    fromNote.position,
    midPoint,
    toNote.position
  );

  const geometry = new THREE.TubeGeometry(curve, 20, 0.02);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  return <mesh geometry={geometry} material={material} />;
};
```

---

## Data Flow & Communication

### Event Flow Diagram

```
User Interaction (Play button)
    ↓
React Component (onClick handler)
    ↓
Custom Hook (useTransport.start())
    ↓
TransportAdapter.start()
    ↓
EventBus.emit('transport:start')
    ↓
RegionProcessor (subscribed to 'transport:start')
    ↓
RegionScheduler.scheduleAllRegions()
    ↓
HarmonySchedulerV2 / SimpleInstrumentScheduler
    ↓
AudioContext.createBufferSource()
    ↓
source.start(audioTime)  // Sample-accurate!
    ↓
Hardware Audio Output
```

### Service Communication Patterns

**1. Direct Calls** (synchronous, low-latency)
```typescript
// Good for: Immediate operations, no side effects
const tempo = transport.getTempo();
const state = transport.getState();
```

**2. Event Bus** (asynchronous, decoupled)
```typescript
// Good for: Service-to-service communication, side effects
eventBus.emit('transport:tempo-change', { bpm: 120 });

// Multiple subscribers
eventBus.on('transport:tempo-change', (data) => {
  regionProcessor.handleTempoChange(data.bpm);
});

eventBus.on('transport:tempo-change', (data) => {
  metricsCollector.recordTempoChange(data.bpm);
});
```

**3. React Context** (UI state propagation)
```typescript
// Good for: Global UI state, avoid prop drilling
<TransportContext.Provider value={{ transport, isPlaying, tempo }}>
  <App />
</TransportContext.Provider>

// In child component
const { isPlaying, tempo } = useContext(TransportContext);
```

**4. Zustand Store** (React state management)
```typescript
// Good for: UI state, optimized re-renders
const usePlaybackStore = create((set) => ({
  isPlaying: false,
  tempo: 120,
  setTempo: (tempo) => set({ tempo }),
}));

// In component
const tempo = usePlaybackStore((state) => state.tempo);  // Only re-renders when tempo changes
```

### Buffer Injection Flow

```
InitialSamplePreloader
    ↓
Load samples from Supabase/CDN
    ↓
Decode to AudioBuffers
    ↓
Store in GlobalSampleCache
    ↓
Inject to RegionProcessor
    ↓
BufferManager stores buffers
    ↓
Schedulers access buffers
    ↓
Create AudioBufferSourceNode
    ↓
Schedule playback
```

**Code Example**:
```typescript
// 1. Load samples
const samples = await preloader.loadFullSamples(exercise);

// 2. Get buffers from cache
const harmonyBuffers = GlobalSampleCache.getHarmonyBuffers('wurlitzer');

// 3. Inject to RegionProcessor
regionProcessor.setHarmonyBuffers(
  harmonyBuffers,
  audioEngine.getDestination(),
  velocityRanges,
  'wurlitzer'
);

// 4. RegionProcessor stores in BufferManager
bufferManager.setHarmonyBuffers(harmonyBuffers);

// 5. Scheduler accesses buffers
const buffer = bufferManager.getHarmonyBuffer(noteName, layer);

// 6. Schedule playback
const source = audioContext.createBufferSource();
source.buffer = buffer;
source.connect(destination);
source.start(audioTime);
```

---

## Tech Debt & Roadmap

### Current Tech Debt

#### 1. HarmonySchedulerV2 Still Large (1,477 lines)
**Issue**: Extracted from RegionProcessor but still too large

**Plan**:
- Extract `VelocityLayerSelector` (done)
- Extract `SustainPedalHandler` (done)
- Extract `FadeoutManager` (done)
- Extract `BufferFallbackStrategy` (done)
- **TODO**: Further breakdown into note scheduling, buffer management, state tracking

#### 2. ~~useTransport Subscription Overhead~~ (COMPLETED ✅)
**Issue**: Created individual subscriptions per component (56+ subscriptions with 7 components)

**Solution**: TransportContext migration (87% reduction achieved)

**Status**: Migration complete (December 2025)
- Old `hooks/useTransport.ts` deleted
- All imports updated to use `contexts/TransportContext`
- TransportProvider added to all required page components
- Tests updated/skipped for deprecated functionality

#### 2.1 ~~EventScheduler Orphaned Code~~ (COMPLETED ✅)
**Issue**: EventScheduler.ts (382 lines) was never integrated, replaced by Scheduler.ts

**Solution**: Deleted orphaned code and cleaned up commented references

**Status**: Cleanup complete (December 2025)
- `modules/transport/scheduling/EventScheduler.ts` deleted
- Commented references removed from TransportController
- System uses Scheduler.ts exclusively (better features: repeat events, binary search, queue limits)

#### 2.2 ~~Legacy Scheduler Fragmentation~~ (COMPLETED ✅)
**Issue**: 14+ scheduler implementations across two architectures (Tone.js modules/ vs Web Audio API services/)

**Analysis**: Legacy schedulers contained advanced features (flams, humanization, walking bass generator) but these are DAW-level composition features out of scope for a playback engine. Pre-click feature was inferior to existing Countdown system (audio + visual + position + voice cues vs basic audio clicks).

**Solution**: Deleted all legacy scheduler implementations

**Status**: Cleanup complete (December 2025)
- Deleted 6 scheduler files (~2,280 lines):
  - `services/core/SimpleRegionScheduler.ts` (207 lines)
  - `modules/instruments/components/drums/DrumPatternScheduler.ts` (443 lines)
  - `modules/instruments/components/metronome/MetronomeScheduler.ts` (342 lines)
  - `modules/instruments/components/bass/BassSequencer.ts` (527 lines)
  - `modules/instruments/architecture/IInstrumentScheduler.ts` (263 lines)
  - `modules/transport/core/Scheduler.ts` (362 lines - Tone.js version)
- Deleted supporting files:
  - `modules/instruments/implementations/metronome/MetronomeFacade.ts`
  - `modules/instruments/architecture/InstrumentContainer.ts`
- Updated 4 barrel export files to remove deleted scheduler references
- Production system uses unified Web Audio API schedulers exclusively:
  - `services/core/Scheduler.ts` (595 lines) - unified scheduler for all instruments
  - `services/core/scheduling/HarmonySchedulerV2.ts` (1,477 lines) - harmony-specific
  - `services/core/region-processing/scheduling/SimpleInstrumentScheduler.ts` - base class

#### 3. 105 Service Files in Playback Domain
**Issue**: Too many service files, hard to navigate

**Plan**:
- Consolidate related services
- Move services to modules
- Reduce top-level service files to <20

#### 4. Playback Domain Size (500+ files)
**Issue**: Difficult to navigate and understand

**Mitigation**:
- Clear module boundaries (done)
- Comprehensive documentation (this file)
- Developer handbook with quick reference

### Roadmap

#### Phase 1: Core Refactoring (In Progress)
- ✅ RegionProcessor modular breakdown
- ✅ UnifiedTransport → TransportAdapter migration
- ✅ HarmonyScheduler extraction
- ✅ WindowRegistry centralization
- ✅ useAudioContext event-driven
- 🚧 PlaybackEngine (feature flag enabled)
- 🚧 Track-based architecture migration
- 🚧 useTrack adoption across widgets

#### Phase 2: Performance Optimization (Next)
- Optimize sample loading (reduce memory)
- Implement worker-based scheduling
- Audio worklets for low-latency processing
- Lazy loading for non-critical modules

#### Phase 3: Production Readiness (Q1 2025)
- Comprehensive error handling
- Monitoring & alerting
- A/B testing framework
- User acceptance testing

#### Phase 4: Advanced Features (Q2 2025)
- Audio effects (reverb, delay, compression)
- MIDI recording
- Multi-user collaboration
- Cloud sync

---

## Statistics & Metrics

### File Counts
- **Total TypeScript files**: ~500+
- **React components**: 10
- **Custom hooks**: 16
- **Modules**: 23
- **Service classes**: 10+
- **Region processing modules**: 15+
- **Repositories**: 5
- **Value objects**: 5

### Lines of Code
- **CoreServices**: 941 lines
- **RegionProcessor**: 1,329 lines (reduced from 3,902)
- **InitialSamplePreloader**: 2,154 lines
- **HarmonySchedulerV2**: 1,477 lines (needs further breakdown)
- **EventBus**: 602 lines
- **PluginManager**: 668 lines
- **Scheduler**: 596 lines
- **TransportAdapter**: 466 lines
- **WindowRegistry**: 398 lines

### Architecture Layers
- **Layer 1 (Presentation)**: 10 components + 16 hooks + 2 providers + 1 context
- **Layer 2 (Application/Service)**: 10+ service classes
- **Layer 3 (Domain/Modules)**: 23 modules
- **Layer 4 (Infrastructure)**: 5 repositories + storage services
- **Layer 5 (Cross-Cutting)**: Error handling, logging, config
- **Layer 6 (Platform)**: Web Audio API, Tone.js, IndexedDB, WAM

### Module Complexity
- **Most complex modules**: instruments (60+ files), transport (40+ files), storage (35+ files)
- **Critical modules**: audio-engine, midi (20+ files each)
- **Supporting modules**: 16 modules with varying sizes

### Pattern Usage
- **Singleton**: 5 classes
- **Service Interface**: 5+ services
- **Repository Pattern**: 5 repositories
- **Adapter Pattern**: 3 adapters
- **Strategy Pattern**: 10+ strategies
- **Event-Driven**: 1 EventBus, 50+ event types

### Test Coverage
- **Unit tests**: Co-located with source files
- **Integration tests**: `__tests__/` subdirectories
- **E2E tests**: Playwright in separate package

---

## Conclusion

The BassNotion playback domain is a **production-ready, FAANG-quality audio engine** with:

1. **Clear Architecture**: 6 layers, 23 modules, DDD patterns
2. **Sample-Accurate Timing**: Web Audio API scheduling
3. **Sophisticated Features**: Velocity layers, sustain pedal, 3D visualization
4. **Production Practices**: Error handling, monitoring, circuit breakers
5. **Developer Experience**: Type-safe APIs, comprehensive hooks, documentation

**Current Focus**: Track-based architecture migration, PlaybackEngine rollout, performance optimization

**Production Launch**: Q1 2025 (pending comprehensive testing and monitoring setup)

---

**Maintained By**: Development Team
**Review Cycle**: Quarterly
**Last Reviewed**: December 2025
