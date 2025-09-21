# Playback Domain Module Migration

**Date**: January 2025  
**Status**: Completed  
**Impact**: Breaking changes to import paths

## Overview

This document describes the migration of the playback domain from a services-based architecture to a modular architecture. This change improves code organization, reduces coupling, and makes the codebase more maintainable.

## Migration Summary

### What Changed

1. **Directory Structure**: Moved from `services/` to `modules/`
2. **Import Paths**: All imports updated to use new module paths
3. **File Organization**: Grouped related functionality into focused modules
4. **Test Structure**: Tests remain co-located with their modules

### Before vs After

```typescript
// Before
import { GlobalSampleCache } from '@/domains/playback/services/storage/GlobalSampleCache';
import { EnhancedTrackManagerProcessor } from '@/domains/playback/services/plugins/EnhancedTrackManagerProcessor';

// After
import { GlobalSampleCache } from '@/domains/playback/modules/storage/cache/GlobalSampleCache';
import { TrackManager } from '@/domains/playback/modules/tracks/core/TrackManager';
```

## Module Structure

```
domains/playback/modules/
├── audio-engine/       # Core audio processing
├── instruments/        # Instrument implementations
├── lifecycle/          # Component lifecycle management
├── loading/           # Asset loading and streaming
├── optimization/      # Performance optimization
├── storage/           # Caching and storage
├── tracks/            # Track management and state
└── transport/         # Timing and scheduling
```

## Breaking Changes

### 1. Import Path Updates

All imports from `services/` must be updated to `modules/`:

```typescript
// ❌ Old
import { AudioEngine } from '@/domains/playback/services/core/AudioEngine';

// ✅ New
import { AudioEngine } from '@/domains/playback/modules/audio-engine/core/AudioEngine';
```

### 2. Deleted Classes

The following classes were removed and replaced:

- `EnhancedTrackManagerProcessor` → Use `TrackManager` instead
- `PatternScheduler` (in services) → Use module version
- `EventScheduler` (in services) → Use module version

### 3. API Changes

- `GlobalSampleCache` now includes a `getStats()` method
- `TrackManager` constructor now requires an `EventBus` parameter
- Mock objects in tests need updated method signatures

## Migration Steps

### For Existing Code

1. **Update Imports**
   ```bash
   # Find all old imports
   grep -r "from '@/domains/playback/services/" --include="*.ts" --include="*.tsx"
   
   # Update systematically by module
   ```

2. **Update Mock Objects**
   ```typescript
   // Add missing methods to mocks
   GlobalSampleCache: {
     getInstance: vi.fn(),
     getStats: vi.fn().mockReturnValue({
       samplesCount: 0,
       instrumentsCount: 0,
       totalSize: 0,
     }),
   }
   ```

3. **Fix Dependency Injection**
   ```typescript
   // TrackManager now needs EventBus
   const eventBus = new EventBus();
   const trackManager = new TrackManager(eventBus);
   ```

### For New Development

1. Always import from `modules/` not `services/`
2. Check the module's public API (index.ts) first
3. Prefer importing from module roots when possible

## Testing Changes

### Mock Updates

Tests need updated mocks for:

1. **Tone.Transport**
   ```typescript
   Transport: {
     schedule: vi.fn(() => 'mock-schedule-id'),
     scheduleRepeat: vi.fn(() => 'mock-schedule-repeat-id'),
   }
   ```

2. **GlobalSampleCache**
   - Added `getStats()` method
   - Returns cache statistics

3. **EventBus Integration**
   - TrackStateContainer now emits events
   - Tests can verify event emissions

## Benefits of Migration

1. **Better Organization**: Related code is grouped together
2. **Clearer Dependencies**: Module boundaries are explicit
3. **Improved Testing**: Easier to mock module boundaries
4. **Performance**: Reduced circular dependencies
5. **Maintainability**: Easier to find and modify code

## Common Issues and Solutions

### Issue: Cannot find module
**Solution**: Check if the import path needs updating from services/ to modules/

### Issue: Property 'method' does not exist
**Solution**: Check if the API changed or if mocks need updating

### Issue: Tests failing with undefined errors
**Solution**: Update mock return values (especially for Tone.js methods)

## Future Considerations

1. **Remaining Tech Debt**: 
   - UnifiedTransport.ts (3000+ lines) needs refactoring
   - Some modules still have large files that could be split

2. **Further Modularization**:
   - Consider extracting common patterns
   - Create shared utilities module

3. **Documentation**:
   - Add README.md to each module
   - Document public APIs

## References

- Original PR: [Link to PR if available]
- Related Issues: Phase 7 cleanup
- Architecture Decision Records: [Link if available]