# Story 3.18: FAANG-Style Web DAW Architecture Refactor

## Status: SUPERSEDED BY EPIC 3.18

**⚠️ NOTICE: This story has been broken down into Epic 3.18 with 7 manageable stories.**

**See:** `EPIC-3.18-faang-web-daw-architecture.md` for the complete Epic breakdown.

**Next Action:** Start with Story 3.18.1 - Service Audit & Preservation Planning

## Story

- As a **BassNotion developer**
- I want **to refactor the playback domain to follow FAANG-style best practices**
- so that **we have a professional-grade Web DAW architecture that rivals desktop DAWs like Logic Pro X and Ableton Live**

## Context

**CRITICAL ARCHITECTURAL CRISIS:** The current playback domain suffers from severe over-engineering with 56+ competing services that prevent reliable audio playback. Deep investigation reveals:

- **Service Explosion:** 56+ service files including 3,329-line MobileOptimizer, 2,234-line QualityScaler
- **4 Competing Audio Systems:** ToneInstanceManager, AudioEngine, AudioContextManager, ToneProvider all trying to manage Tone.js
- **Global State Pollution:** `(window as any).ToneSingleton` and multiple `window.*` patterns
- **Technical Debt Crisis:** 100+ "TODO: Review non-null assertion" comments, widespread error handling failures
- **Paralysis by Over-Engineering:** Complex systems that don't work instead of simple systems that do

**Architecture Document:** See `bassnotion-web-daw-architecture.md` for detailed technical foundation, **Widget Preservation Strategy**, and **Growth Services Strategy** showing how we'll add CDN, mobile optimization, and other scalability services when metrics justify them.

**WIDGET PRESERVATION GUARANTEE:** This refactor **ENHANCES your existing widgets** (HarmonyWidget, DrummerWidget, BassLineWidget, etc.) by providing them with more reliable audio services. Your 6,500+ lines of professional widget code remain intact and get better performance.

## Acceptance Criteria (ACs)

1. **Radical Service Reduction**
   - [ ] Delete 50+ over-engineered service files
   - [ ] Implement exactly 5 core services: AudioEngine, ServiceRegistry, EventBus, TransportController, PluginManager
   - [ ] Each service <200 lines (except PluginManager)
   - [ ] Remove all *Optimizer.ts, *Monitor.ts, \*Engine.ts files (except AudioEngine)

2. **Zero Global State**
   - [ ] Remove all `(window as any).*` patterns (ToneSingleton, ToneInstanceId)
   - [ ] Delete ToneInstanceManager, AudioContextManager, ToneProvider
   - [ ] Implement ServiceRegistry for dependency injection

3. **Single Source of Truth for Audio**
   - [ ] AudioEngine is the ONLY way to access Tone.js
   - [ ] Remove all direct `import * as Tone from 'tone'` (15+ files)
   - [ ] Single AudioContext managed by AudioEngine only

4. **FAANG-Style Simplification**
   - [ ] ServiceRegistry manages all service dependencies
   - [ ] EventBus handles all inter-service communication
   - [ ] Command pattern for transport operations with undo/redo
   - [ ] No competing architectural patterns

5. **Working Audio Playback**
   - [ ] 99%+ successful audio initialization rate
   - [ ] Reliable start/stop/pause functionality
   - [ ] Clean error messages without technical debt comments
   - [ ] End-to-end widget integration that actually works

6. **Clean Codebase**
   - [ ] Remove 100+ "TODO: Review non-null assertion" comments
   - [ ] TypeScript strict mode with proper error handling
   - [ ] No console.error('Failed to...') patterns
   - [ ] Comprehensive test coverage for core services

7. **Developer Experience**
   - [ ] Simple React hooks: useAudio, useTransport, usePlugins
   - [ ] Clear documentation and examples
   - [ ] Widget developers never touch Tone.js directly
   - [ ] 5-minute setup for new audio widgets

## Tasks / Subtasks

### Task 1: Selective Service Deletion & Preservation (AC: 1)

- [ ] Subtask 1.1: **PRESERVE** valuable components: Error handling system (`services/errors/`), MusicalTimeEngine, PrecisionSynchronizationEngine, BaseAudioPlugin, PerformanceMonitor
- [ ] Subtask 1.2: **PRESERVE** working plugin ecosystem: DrumProcessor, ChordInstrumentProcessor, all samplers (Rhodes, Wurlitzer, Salamander)
- [ ] Subtask 1.3: **PRESERVE** AssetManager core logic, HybridDrumSampleManager for Supabase integration
- [ ] Subtask 1.4: **ARCHIVE** over-engineered services: MobileOptimizer.ts (3,329 lines), QualityScaler.ts (2,234 lines), AnalyticsEngine.ts (2,034 lines)
- [ ] Subtask 1.5: **DELETE** architectural anti-patterns: ToneInstanceManager.ts, AudioContextManager.ts, ToneProvider.ts
- [ ] Subtask 1.6: **INTEGRATE** preserved components into 5 core services architecture

### Task 2: Integrate Core Services with Preserved Components (AC: 1, 2, 4)

- [ ] Subtask 2.1: Create ServiceRegistry class with dependency injection
- [ ] Subtask 2.2: Create EventBus class enhanced with existing CircuitBreaker for resilience
- [ ] Subtask 2.3: Enhance AudioEngine with existing PerformanceMonitor and CircuitBreaker integration
- [ ] Subtask 2.4: Create TransportController integrating MusicalTimeEngine and PrecisionSynchronizationEngine
- [ ] Subtask 2.5: Simplify PluginManager while preserving BaseAudioPlugin interface and existing 25+ plugins

### Task 3: Eliminate Global State (AC: 2, 3)

- [ ] Subtask 3.1: Remove all `(window as any).ToneSingleton` patterns
- [ ] Subtask 3.2: Remove all `(window as any).ToneInstanceId` patterns
- [ ] Subtask 3.3: Replace all direct Tone.js imports with AudioEngine access
- [ ] Subtask 3.4: Update 15+ files that directly import Tone.js
- [ ] Subtask 3.5: Verify zero global state with comprehensive audit

### Task 4: Implement Service Architecture (AC: 4)

- [ ] Subtask 4.1: Wire ServiceRegistry to manage all 5 core services
- [ ] Subtask 4.2: Implement EventBus for all service communication
- [ ] Subtask 4.3: Add Command pattern for transport operations
- [ ] Subtask 4.4: Ensure clean dependency injection throughout

### Task 5: Fix Audio Reliability (AC: 5)

- [ ] Subtask 5.1: Implement robust AudioContext initialization
- [ ] Subtask 5.2: Add proper error handling without technical debt comments
- [ ] Subtask 5.3: Test audio playback across different browsers/devices
- [ ] Subtask 5.4: Achieve 99%+ successful initialization rate
- [ ] Subtask 5.5: Remove all console.error('Failed to...') patterns

### Task 6: Clean Technical Debt (AC: 6)

- [ ] Subtask 6.1: Remove 100+ "TODO: Review non-null assertion" comments
- [ ] Subtask 6.2: Enable TypeScript strict mode across all services
- [ ] Subtask 6.3: Replace any types with proper TypeScript interfaces
- [ ] Subtask 6.4: Add comprehensive error handling with custom error classes

### Task 7: Create Developer Experience (AC: 7)

- [ ] Subtask 7.1: Create useAudio hook for basic audio operations
- [ ] Subtask 7.2: Create useTransport hook for playback control
- [ ] Subtask 7.3: Create usePlugins hook for audio processing
- [ ] Subtask 7.4: Create AudioProvider for React context
- [ ] Subtask 7.5: Build example widgets demonstrating 5-minute setup

### Task 8: Widget Integration & Enhancement (AC: 7)

- [ ] Subtask 8.1: Update HarmonyWidget to use new AudioEngine (preserve all 1,628 lines)
- [ ] Subtask 8.2: Update DrummerWidget to use enhanced TransportController (preserve all 1,301 lines)
- [ ] Subtask 8.3: Update BassLineWidget to use simplified PluginManager (preserve all 818 lines)
- [ ] Subtask 8.4: Update all other widgets (MetronomeWidget, GlobalControls, LoopGridStrip)
- [ ] Subtask 8.5: Verify SyncedWidget base class works with new services
- [ ] Subtask 8.6: Test widget error boundaries with new error handling
- [ ] Subtask 8.7: Validate widget performance improvements

### Task 9: Testing and Validation (AC: all)

- [ ] Subtask 9.1: Unit tests for all 5 core services
- [ ] Subtask 9.2: Integration tests for service interactions
- [ ] Subtask 9.3: E2E tests for widget audio playback
- [ ] Subtask 9.4: Performance benchmarks vs. current system
- [ ] Subtask 9.5: Validate all acceptance criteria are met
- [ ] Subtask 9.6: Create metrics collection system for growth service triggers
- [ ] Subtask 9.7: Document thresholds for when to add each growth service

## Dev Technical Guidance

### FAANG-Style Simplified Architecture

**BEFORE: 56+ Services, 4 Audio Systems, Global State Chaos**
**AFTER: 5 Core Services, Clean Dependencies, Zero Globals**

```typescript
// 1. ServiceRegistry - Dependency Injection (replaces 4 competing systems)
class ServiceRegistry {
  private services = new Map<string, any>();

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) throw new AudioError(`Service ${name} not found`);
    return service;
  }

  async initialize(): Promise<void> {
    // Initialize services in correct order
    await this.get<AudioEngine>('audioEngine').initialize();
    await this.get<TransportController>('transport').initialize();
    await this.get<PluginManager>('plugins').initialize();
  }
}

// 2. AudioEngine - Single Source of Truth (replaces ToneInstanceManager + 3 others)
class AudioEngine {
  private tone: any = null;
  private context: AudioContext;
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    this.context = new AudioContext({
      sampleRate: 48000,
      latencyHint: 'interactive',
    });

    this.tone = await import('tone');
    this.tone.setContext(this.context);

    this.eventBus.emit('audio:ready', { context: this.context });
  }

  // ONLY way to access Tone.js - no more direct imports
  getTone(): any {
    return this.tone;
  }
  getContext(): AudioContext {
    return this.context;
  }
  createSampler(config: SamplerConfig): AudioSampler {
    return new this.tone.Sampler(config);
  }
}

// 3. EventBus - Communication Hub (replaces 20+ EventEmitter classes)
class EventBus {
  private events = new Map<string, Set<Function>>();

  emit(event: string, data: any): void {
    this.events.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        // Clean error handling - no more console.error('Failed to...')
        throw new AudioError(`Event handler failed for ${event}`, error);
      }
    });
  }

  on(event: string, handler: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }
}

// 4. TransportController - Simple Playback (replaces 642-line ProfessionalTransportScheduler)
class TransportController {
  constructor(
    private audioEngine: AudioEngine,
    private eventBus: EventBus,
  ) {}

  start(): void {
    const tone = this.audioEngine.getTone();
    tone.Transport.start();
    this.eventBus.emit('transport:started', { time: tone.now() });
  }

  stop(): void {
    const tone = this.audioEngine.getTone();
    tone.Transport.stop();
    this.eventBus.emit('transport:stopped', { time: tone.now() });
  }

  setTempo(bpm: number): void {
    const tone = this.audioEngine.getTone();
    tone.Transport.bpm.value = bpm;
    this.eventBus.emit('transport:tempo-changed', { bpm });
  }
}

// 5. PluginManager - Essential Processing (simplified from 842 lines)
class PluginManager {
  private plugins = new Map<string, AudioPlugin>();

  constructor(
    private audioEngine: AudioEngine,
    private eventBus: EventBus,
  ) {}

  register(id: string, plugin: AudioPlugin): void {
    plugin.initialize(this.audioEngine);
    this.plugins.set(id, plugin);
    this.eventBus.emit('plugin:registered', { id, plugin });
  }

  process(audioData: AudioData): AudioData {
    let result = audioData;
    for (const plugin of this.plugins.values()) {
      result = plugin.process(result);
    }
    return result;
  }
}
```

### FAANG-Style Migration Strategy

**Philosophy: Delete First, Build Second**

#### **Phase 1: Mass Deletion (Week 1)**

```bash
# Delete the chaos - remove 50+ over-engineered files
rm -rf apps/frontend/src/domains/playback/services/MobileOptimizer.ts      # 3,329 lines
rm -rf apps/frontend/src/domains/playback/services/QualityScaler.ts       # 2,234 lines
rm -rf apps/frontend/src/domains/playback/services/AnalyticsEngine.ts     # 2,034 lines
rm -rf apps/frontend/src/domains/playback/services/ResourceManager.ts     # 1,957 lines
rm -rf apps/frontend/src/domains/playback/services/ProfessionalTransportScheduler/  # 642 lines
rm -rf apps/frontend/src/domains/playback/services/UnifiedTransportController/
rm -rf apps/frontend/src/domains/playback/services/*Optimizer.ts
rm -rf apps/frontend/src/domains/playback/services/*Monitor.ts
rm -rf apps/frontend/src/domains/playback/services/ToneInstanceManager.ts
rm -rf apps/frontend/src/domains/playback/services/AudioContextManager.ts
rm -rf apps/frontend/src/domains/playback/providers/ToneProvider.tsx
```

#### **Phase 2: Build 5 Core Services (Week 2)**

1. ServiceRegistry with dependency injection
2. EventBus for communication
3. AudioEngine as single Tone.js source
4. TransportController for playback
5. PluginManager for processing

#### **Phase 3: Zero Global State (Week 3)**

1. Remove all `(window as any).*` patterns
2. Update 15+ files with direct Tone.js imports
3. Replace with AudioEngine access only
4. Comprehensive global state audit

#### **Phase 4: Widget Integration (Week 4)**

1. Create React hooks: useAudio, useTransport, usePlugins
2. Build AudioProvider for context
3. Update existing widgets
4. 5-minute setup examples

#### **Phase 5: Validation (Week 5)**

1. 99%+ audio initialization success rate
2. Zero technical debt comments
3. Comprehensive test coverage
4. Performance benchmarks

### FAANG Engineering Principles Applied

1. **Radical Simplification**: 56 services → 5 services
2. **Single Source of Truth**: AudioEngine is the ONLY way to access Tone.js
3. **Dependency Injection**: ServiceRegistry manages all dependencies
4. **Event-Driven**: EventBus handles all communication
5. **Working Over Perfect**: Focus on reliable audio playback, not theoretical perfection
6. **Delete Code**: If it doesn't make audio play better, delete it

### Success Metrics (vs. Current Chaos)

| Metric            | Before              | After               |
| ----------------- | ------------------- | ------------------- |
| Service Files     | 56+                 | 5                   |
| Lines of Code     | 50,000+             | <5,000              |
| Global State      | Multiple `window.*` | Zero                |
| Tone.js Access    | 4 competing ways    | 1 way (AudioEngine) |
| Technical Debt    | 100+ TODO comments  | Zero                |
| Audio Reliability | Frequent failures   | 99%+ success        |

## Story Progress Notes

### Agent Model Used: `Claude 3.5 Sonnet`

### Completion Notes List

- Identified extensive existing professional components to leverage
- Found anti-patterns: global state, multiple Tone instances
- Designed architecture that builds on existing work rather than replacing it
- Focus on fixing core issues while preserving good patterns

### Change Log

- 2024-XX-XX: Story created based on investigation of existing playback domain
- Found that much of the "FAANG-style" architecture already exists, just needs proper integration
