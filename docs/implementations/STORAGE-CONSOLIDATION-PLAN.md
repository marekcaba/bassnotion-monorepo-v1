# Storage Architecture Consolidation Plan

## Overview

We have duplicate storage implementations:
- **Legacy**: `/services/storage/` (19 files)
- **Modern**: `/modules/storage/` (modular, well-organized)

## Migration Strategy

### Phase 1: Identify Service Dependencies

Current services using legacy storage:
1. `AudioSampleManager.ts` - Already updated to use modules ✅
2. `SupabaseAssetClient.ts` - Already using dynamic imports for modules ✅
3. `CachedToneBufferLoader.ts` - Needs migration
4. `GlobalSampleCache.ts` - Duplicate of module version
5. Predictive loading components - Need migration

### Phase 2: Service-to-Module Mapping

| Legacy Service | Modern Module | Action |
|----------------|---------------|---------|
| `SupabaseAssetClient.ts` | `providers/SupabaseProviderAdvanced.ts` | Keep both, client uses provider |
| `GlobalSampleCache.ts` | `cache/GlobalSampleCache.ts` | Remove service version |
| `CachedToneBufferLoader.ts` | `loaders/SampleLoader.ts` | Migrate and remove |
| `AdaptiveAudioStreamer.ts` | `loaders/AssetLoader.ts` | Migrate features |
| `PredictiveLoadingEngine.ts` | `loaders/PreloadStrategy.ts` | Migrate algorithm |
| Cache services in `/cache/` | Module `/cache/` | Remove duplicates |
| Analytics in `/analytics/` | Module `/analytics/` | Remove duplicates |

### Phase 3: Migration Order

1. **Remove direct duplicates** (safe, no logic changes)
   - `GlobalSampleCache.ts` (service version)
   - `CacheAnalyticsEngine.ts` (in both locations)
   - `MemoryManager.ts` (in both locations)

2. **Migrate unique services** (requires code updates)
   - `CachedToneBufferLoader.ts` → Use `SampleLoader.ts`
   - `AdaptiveAudioStreamer.ts` → Enhance `AssetLoader.ts`
   - `PredictiveLoadingEngine.ts` → Enhance `PreloadStrategy.ts`

3. **Migrate MIDI services** (new functionality)
   - Move MIDI services to a new `/modules/midi/` directory
   - These are unique features not duplicated in modules

4. **Update imports** throughout the codebase

### Phase 4: Testing Strategy

1. Run existing storage tests
2. Verify audio loading still works
3. Check cache functionality
4. Performance benchmarks

## Implementation Steps

### Step 1: Remove Direct Duplicates
```bash
# Remove duplicate files (after verifying no unique logic)
rm apps/frontend/src/domains/playback/services/storage/GlobalSampleCache.ts
rm apps/frontend/src/domains/playback/services/storage/cache/CacheAnalyticsEngine.ts
rm apps/frontend/src/domains/playback/services/storage/cache/MemoryManager.ts
rm apps/frontend/src/domains/playback/services/storage/cache/CacheSynchronizationEngine.ts
```

### Step 2: Update Import References
Update all imports from:
```typescript
import { GlobalSampleCache } from '@/domains/playback/services/storage/GlobalSampleCache';
```
To:
```typescript
import { GlobalSampleCache } from '@/domains/playback/modules/storage/cache/GlobalSampleCache';
```

### Step 3: Migrate Unique Logic
Identify unique features in service implementations and port to modules.

## Benefits

1. **Single source of truth** for storage logic
2. **Better organization** with modular structure
3. **Reduced code duplication** (~50% less code)
4. **Clearer dependency graph**
5. **Easier testing and maintenance**