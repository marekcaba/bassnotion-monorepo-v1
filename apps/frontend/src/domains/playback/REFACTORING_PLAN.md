# Playback Domain Refactoring Plan

## Overview
This document outlines the comprehensive refactoring plan for the playback domain, focusing on three main areas: Transport Module Migration, Repository Pattern Consolidation, and Deprecated Hook Migration.

## 1. Transport Module Migration Plan

### Current Status
- **Migrated**: 40% (basic transport operations, clock sync, event integration)
- **Remaining**: 60% (advanced timing features, professional-grade functionality)

### Phase 1: AudioWorklet Implementation (Critical)
**Timeline**: 1 week
**Files to create:**
- `modules/transport/worklets/TimingProcessor.ts`
- `modules/transport/worklets/AudioWorkletManager.ts`
- `modules/transport/sync/SampleAccurateClock.ts`

**Implementation steps:**
1. Extract AudioWorklet code from UnifiedTransport (lines 782-1279)
2. Create AudioWorkletManager to handle initialization and messaging
3. Implement session ID tracking for reliable communication
4. Add silent oscillator hack for audio graph
5. Create tests for AudioWorklet timing accuracy

### Phase 2: Advanced Drift Compensation
**Timeline**: 3 days
**Files to create:**
- `modules/transport/sync/DriftPredictor.ts`
- `modules/transport/sync/KalmanFilter.ts`
- `modules/transport/sync/AdaptiveDriftCompensator.ts`

**Implementation steps:**
1. Extract DriftPredictor class (lines 3318-3344)
2. Extract KalmanFilter implementation (lines 3346-3385)
3. Integrate with existing Clock.ts
4. Add drift history tracking
5. Create performance benchmarks

### Phase 3: Web Worker Fallback
**Timeline**: 2 days
**Files to create:**
- `modules/transport/workers/TimingWorker.ts`
- `modules/transport/workers/WorkerFallback.ts`

**Implementation steps:**
1. Extract Web Worker code (lines 1280-1336)
2. Create fallback detection logic
3. Integrate with AudioWorkletManager
4. Test across different browsers

### Phase 4: Professional Scheduling Features
**Timeline**: 4 days
**Files to enhance:**
- `modules/transport/core/Scheduler.ts` (add priority queues)
- `modules/transport/sync/PreBuffer.ts` (new file)
- `modules/transport/sync/QuantumScheduler.ts` (new file)

**Implementation steps:**
1. Add priority-based scheduling (high/normal/low)
2. Implement pre-buffering system (100ms look-ahead)
3. Add quantum-based pause/resume
4. Create event metadata support
5. Test with complex scheduling scenarios

### Phase 5: Integration & Testing
**Timeline**: 3 days
**Tasks:**
1. Update UnifiedTransport to delegate to new modules
2. Add feature flags for gradual rollout
3. Create performance comparison tests
4. Document migration path for consumers

## 2. Repository Pattern Consolidation Plan

### Target Structure
```
src/shared/repository/
├── base/
│   ├── BaseRepository.ts
│   ├── IRepository.ts
│   └── types.ts
├── decorators/
│   ├── CachedRepository.ts
│   ├── ResultRepository.ts
│   └── index.ts
├── store/
│   └── createRepositoryStore.ts
└── index.ts
```

### Implementation Steps

#### Step 1: Create Base Infrastructure (Day 1)
```typescript
// BaseRepository.ts
export abstract class BaseRepository<TEntity, TId, TDTO> implements IRepository<TEntity, TId> {
  protected abstract readonly baseUrl: string;
  protected readonly logger: Logger;
  
  constructor(protected readonly apiClient: ApiClient) {
    this.logger = createStructuredLogger(this.constructor.name);
  }

  async findById(id: TId): Promise<TEntity> {
    const response = await this.apiClient.get<TDTO>(`${this.baseUrl}/${id}`);
    return this.mapFromDTO(response);
  }

  // ... common CRUD operations

  protected abstract mapFromDTO(dto: TDTO): TEntity;
  protected abstract mapToDTO(entity: TEntity): TDTO;
}
```

#### Step 2: Create Generic Decorators (Day 2)
```typescript
// CachedRepository.ts
export class CachedRepository<TEntity, TId> implements IRepository<TEntity, TId> {
  private cache = new Map<string, CacheEntry<TEntity>>();
  private readonly TTL = 5 * 60 * 1000;

  constructor(
    private repository: IRepository<TEntity, TId>,
    private extractId: (entity: TEntity) => string
  ) {}

  async findById(id: TId): Promise<TEntity> {
    const cacheKey = String(id);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const entity = await this.repository.findById(id);
    this.setCache(cacheKey, entity);
    return entity;
  }
}
```

#### Step 3: Migrate Existing Repositories (Days 3-5)
1. Start with User domain (simplest)
2. Update Exercise domain
3. Update Tutorial domain
4. Update Creator domain
5. Update Playback domain

#### Step 4: Create Migration Guide (Day 6)
Document how to migrate existing repositories to use new base classes.

## 3. Deprecated Hook Migration Plan

### Hooks to Migrate
1. `useCorePlaybackEngine` → `useCoreServices`
2. `usePlaybackState` → Direct Zustand store usage
3. `useAssetLoading` → `useAudio` with preloading
4. `useToneInit` → Remove (handled by AudioEngine)

### Migration Steps

#### Step 1: Update useWidgetSync.ts
**Current:**
```typescript
import { usePlaybackState } from '@/domains/playback/hooks/usePlaybackState';
const playbackState = usePlaybackState();
```

**New:**
```typescript
import { usePlaybackStore } from '@/domains/playback/store/playbackStore';
const playbackState = usePlaybackStore();
```

#### Step 2: Remove Deprecated Hooks (After Migration)
1. Remove `useCorePlaybackEngine.ts`
2. Remove `usePlaybackState.ts`
3. Remove `useAssetLoading.ts`
4. Remove `useToneInit.ts`
5. Update exports in `index.ts`

#### Step 3: Update Documentation
1. Update README.md to remove deprecated hook references
2. Update type definitions
3. Add migration guide for external consumers

## Timeline Summary

### Week 1-2: Transport Module
- Days 1-5: AudioWorklet implementation
- Days 6-8: Drift compensation
- Days 9-10: Web Worker fallback

### Week 3: Transport Module (cont.) + Repository
- Days 11-14: Professional scheduling
- Days 15-17: Integration & testing
- Days 18-19: Repository base infrastructure

### Week 4: Repository + Hooks
- Days 20-24: Repository migration
- Day 25: Repository documentation
- Days 26-27: Hook migration
- Day 28: Final testing & documentation

## Success Metrics
1. **Transport**: No timing regression, <1ms drift, >99.5% stability
2. **Repository**: 80% code reduction, consistent patterns
3. **Hooks**: Zero usage of deprecated hooks, clean migration

## Risks & Mitigation
1. **Transport timing regression**: Extensive benchmarking before/after
2. **Repository breaking changes**: Gradual migration with adapters
3. **Hook compatibility**: Maintain exports with deprecation warnings

## Next Steps
1. Get approval for plan
2. Create feature branches for each phase
3. Set up performance benchmarks
4. Begin Phase 1 implementation