# Migration Plan: InitialSamplePreloader Functionality

## Overview
InitialSamplePreloader.ts is a complex 1030-line service that handles three-phase loading of audio samples and creates WAM plugin instances. It's actively used by many components and needs careful migration to the module system.

## Current State
- Location: `apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts`
- Size: 1030 lines
- Key Features:
  - Three-phase progressive loading
  - WAM plugin creation (harmony, drums, metronome)
  - OfflineAudioContext usage for non-blocking decode
  - GlobalSampleCache integration
  - Essential samples for quick start
  - Full sample loading for complete experience

## Dependencies
- GlobalSampleCache (already in modules)
- wamPluginSingleton
- AudioEngine from CoreServices
- Multiple instrument implementations

## Consumers
- PreloadInitializer component
- Widget components (BassLineWidget, DrummerWidget, HarmonyWidget, MetronomeWidget)
- Test files expecting preloaded instruments

## Migration Strategy

### Phase 1: Analyze and Decompose
1. **Separate Concerns**:
   - Sample loading logic → `modules/loading/SamplePreloader.ts`
   - WAM plugin creation → `modules/instruments/factories/`
   - Progressive loading → `modules/loading/ProgressiveLoader.ts`
   - Cache management → Use existing GlobalSampleCache

2. **Create Service Interfaces**:
   ```typescript
   interface ISamplePreloader {
     loadEssentialSamples(): Promise<void>
     loadFullSamples(): Promise<void>
     getLoadingProgress(): LoadingProgress
   }
   
   interface IInstrumentFactory {
     createHarmonyInstrument(): Promise<WamKeyboard>
     createDrumInstrument(): Promise<WamDrummer>
     createMetronomeInstrument(): Promise<WamMetronome>
   }
   ```

### Phase 2: Create Module Structure
```
modules/
├── loading/
│   ├── core/
│   │   ├── SamplePreloader.ts
│   │   ├── ProgressiveLoader.ts
│   │   └── LoadingOrchestrator.ts
│   ├── strategies/
│   │   ├── EssentialSamplesStrategy.ts
│   │   ├── FullSamplesStrategy.ts
│   │   └── ThreePhaseStrategy.ts
│   └── index.ts
└── instruments/
    └── factories/
        ├── HarmonyInstrumentFactory.ts
        ├── DrumInstrumentFactory.ts
        ├── MetronomeInstrumentFactory.ts
        └── index.ts
```

### Phase 3: Implement Core Modules

#### SamplePreloader Module
```typescript
// modules/loading/core/SamplePreloader.ts
export class SamplePreloader {
  constructor(
    private cache: GlobalSampleCache,
    private loadingStrategy: ILoadingStrategy
  ) {}
  
  async preloadSamples(config: PreloadConfig): Promise<void>
  getProgress(): LoadingProgress
  cancel(): void
}
```

#### Instrument Factories
```typescript
// modules/instruments/factories/HarmonyInstrumentFactory.ts
export class HarmonyInstrumentFactory {
  async createWithEssentialSamples(): Promise<WamKeyboard>
  async loadFullSamples(instrument: WamKeyboard): Promise<void>
}
```

### Phase 4: Create Backward Compatible Wrapper
```typescript
// services/InitialSamplePreloader.ts (temporary)
import { SamplePreloader } from '../modules/loading/core/SamplePreloader.js';
import { InstrumentFactories } from '../modules/instruments/factories/index.js';

export class InitialSamplePreloader {
  // Delegate to new modules while maintaining API
  private samplePreloader: SamplePreloader;
  private instrumentFactories: InstrumentFactories;
  
  // Maintain singleton pattern for compatibility
  static getInstance(): InitialSamplePreloader {
    // Implementation using new modules
  }
}
```

### Phase 5: Update Consumers Gradually
1. Start with test files
2. Update widget components one by one
3. Update PreloadInitializer
4. Monitor for any issues

### Phase 6: Remove Legacy Code
1. Once all consumers updated, remove wrapper
2. Delete original 1030-line file
3. Update imports throughout codebase

## Technical Considerations

### Benefits
- Separation of concerns
- Reusable loading strategies
- Better testability
- Cleaner instrument creation
- Easier to maintain and extend

### Risks
- Complex migration due to many consumers
- Singleton pattern needs careful handling
- Three-phase loading timing is critical
- WAM plugin initialization is sensitive

### Performance Considerations
- Maintain non-blocking decode with OfflineAudioContext
- Preserve three-phase loading for UX
- Keep essential samples minimal
- Optimize cache usage

## Implementation Timeline
- Phase 1: 3 days - Analysis and design ✅
- Phase 2: 2 days - Create module structure ✅
- Phase 3: 1 week - Implement core modules ✅
- Phase 4: 3 days - Backward compatible wrapper ✅
- Phase 5: 2 weeks - Gradual consumer updates ✅
- Phase 6: 1 day - Cleanup (pending)

## Migration Status (2025-09-08)

### Completed
- ✅ Created SamplePreloader module in `modules/preloading/core/`
- ✅ Implemented loading strategies for Harmony, Drums, and Metronome
- ✅ Created backward compatible wrapper (`InitialSamplePreloader.migration.ts`)
- ✅ Created bridge file (`InitialSamplePreloader.bridge.ts`) for gradual migration
- ✅ Updated all widget consumers to use bridge file
- ✅ Bridge tests passing, maintaining API compatibility

### In Progress
- 🟡 Performance benchmarking before enabling modular implementation
- 🟡 Feature flag currently set to use legacy implementation

### Next Steps
1. Enable modular implementation via `NEXT_PUBLIC_USE_MODULAR_PRELOADER=true`
2. Run performance benchmarks
3. Fix remaining test failures in widget integration tests
4. Remove legacy implementation once verified
5. Update all imports to use modules directly

## Critical Success Factors
1. ✅ No regression in loading performance (using bridge)
2. ✅ Maintain three-phase loading behavior
3. ✅ All widgets continue to work
4. ⚠️ Tests partially green (some need updates for new module system)
5. ✅ No increase in initial load time

## Action Items
1. [x] Map all consumers of InitialSamplePreloader
2. [x] Design loading strategy interfaces
3. [x] Create SamplePreloader module
4. [ ] Extract instrument factory logic (partial - in strategies)
5. [x] Implement progressive loading module
6. [x] Create backward compatible wrapper
7. [x] Write comprehensive tests (bridge tests)
8. [x] Update widget components
9. [ ] Performance benchmark before/after
10. [x] Document new architecture