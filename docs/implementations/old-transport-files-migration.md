# Old Transport Files Migration Plan

## Overview

This document tracks the migration from the old transport systems to the new UnifiedTransport, and what to do with existing files.

**Last Updated**: 2024-01-08  
**Status**: Migration in progress (Phase 2 of 5)

## 🎯 Current Progress Summary

### ✅ Completed

- **UnifiedTransport** created with all professional DAW features
- **AudioWorklet** timing processor implemented (2.67ms resolution)
- **Kalman filter** drift compensation added
- **All deprecated files** marked with @deprecated annotations
- **CoreServices** updated to use UnifiedTransport
- **Backward compatibility** maintained through type exports
- **Test page** created at `/test-unified-transport`

### 🔄 In Progress

- Migrating widgets to use UnifiedTransport
- Refactoring TransportSyncManager as broadcast-only layer

### ⏳ Pending

- Update all imports (17 files)
- Update transport-related tests
- Delete deprecated files after full migration

### 📊 Key Achievements

- **Timing Resolution**: 15ms → 2.67ms (5.6x improvement)
- **Drift Compensation**: Basic → Adaptive Kalman filter
- **Architecture**: 3 conflicting systems → 1 unified master clock
- **Professional Features**: AudioWorklet, Web Worker, triple buffering

## Files to Handle

### 1. **TransportController.ts** ❌ TO BE DEPRECATED

- **Location**: `/services/core/TransportController.ts`
- **Status**: ✅ Marked as @deprecated with migration instructions
- **Action Plan**:
  1. ✅ Mark as `@deprecated` with migration instructions
  2. ⏳ Keep until all widgets/tests are migrated
  3. ⏳ Delete after full migration (estimated: 2-3 weeks)
- **Used by**: 17 files (widgets, tests, hooks)

### 2. **ProfessionalTimingEngine.ts** ❌ TO BE DEPRECATED

- **Location**: `/services/timing/ProfessionalTimingEngine.ts`
- **Status**: ✅ Marked as @deprecated, core logic merged into UnifiedTransport
- **Action Plan**:
  1. ✅ Mark as `@deprecated`
  2. ✅ Verified UnifiedTransport has all features + AudioWorklet support
  3. ⏳ Delete after testing phase
- **Used by**: Only `initializeProfessionalTiming.ts`

### 3. **TransportSyncManager.ts** ✅ KEEP & REFACTOR

- **Location**: `/services/core/TransportSyncManager.ts`
- **Status**: Keep as widget broadcast layer
- **Action Plan**:
  1. Remove ALL timing logic
  2. Use UnifiedTransport as timing source
  3. Keep only:
     - Widget registration/heartbeat
     - State broadcasting
     - Connection management
- **Refactoring Required**: Yes

### 4. **initializeProfessionalTiming.ts** ❌ TO BE DEPRECATED

- **Location**: `/services/timing/initializeProfessionalTiming.ts`
- **Status**: ✅ Marked as @deprecated, import removed from CoreServices
- **Action Plan**:
  1. ✅ Remove import from CoreServices
  2. ✅ Mark as @deprecated
  3. ⏳ Delete file after testing
- **Used by**: CoreServices.ts only (now removed)

### 5. **transportTiming.ts** ✅ KEEP

- **Location**: `/config/transportTiming.ts`
- **Status**: Keep as configuration utility
- **Action Plan**: No changes needed
- **Used by**: Various services for Tone.js configuration

## Test Files to Update

### Unit Tests

1. `/services/core/__tests__/TransportController.test.ts`
   - Rename to `UnifiedTransport.test.ts`
   - Update all imports and test cases

2. `/services/core/__tests__/TransportSyncManager.test.ts`
   - Update to test only broadcast functionality
   - Remove timing-related tests

### Integration Tests

1. `/services/__tests__/TransportController.integration.test.ts`
   - Update to use UnifiedTransport
   - Verify backward compatibility

2. `/services/__tests__/TransportScheduling.real.test.ts`
   - Update to test UnifiedTransport scheduling

## Components/Hooks to Update

### High Priority (Direct Usage)

1. `useTransport.ts` - Update to use UnifiedTransport
2. `TransportCommands.ts` - Update command implementations
3. `TransportWidgetAdapter.ts` - Update adapter to use UnifiedTransport
4. `ExerciseTimelineIndicator.tsx` - Update transport reference

### Medium Priority (Indirect Usage)

1. `WidgetSyncService.ts` - Verify compatibility
2. `CorePlaybackEngine.ts` - Update transport integration
3. `useCorePlaybackEngine.ts` - Update hook

### 6. **StableTransportScheduler.ts** ❌ TO BE DEPRECATED (NEW)

- **Location**: `/services/timing/StableTransportScheduler.ts`
- **Status**: ✅ Marked as @deprecated
- **Action Plan**:
  1. ✅ Mark as @deprecated
  2. ⏳ Functionality integrated into UnifiedTransport
  3. ⏳ Delete after migration
- **Used by**: ProfessionalTimingEngine (deprecated)

## Migration Steps

### Phase 1: Immediate Actions ✅ COMPLETED

1. ✅ Create UnifiedTransport.ts
2. ✅ Update CoreServices to use UnifiedTransport
3. ✅ Add backward compatibility exports
4. ✅ Create AudioWorklet processor for sample-accurate timing
5. ✅ Implement Kalman filter drift compensation

### Phase 2: Deprecation Marking ✅ COMPLETED

All deprecated files have been marked with:

- @deprecated annotations
- Migration instructions
- References to UnifiedTransport

Files marked:

- ✅ TransportController.ts
- ✅ ProfessionalTimingEngine.ts
- ✅ initializeProfessionalTiming.ts
- ✅ StableTransportScheduler.ts

### Phase 3: Component Migration (Week 1-2) 🔄 IN PROGRESS

1. ⏳ Update all hooks to use UnifiedTransport
2. ⏳ Update widgets one by one
3. ⏳ Update tests in parallel
4. ⏳ Verify each component works correctly

### Phase 4: TransportSyncManager Refactor (Week 2) ⏳ PENDING

1. Remove timing logic
2. Connect to UnifiedTransport for state
3. Test widget synchronization

### Phase 5: Cleanup (Week 3) ⏳ PENDING

1. Remove deprecated files
2. Remove backward compatibility exports
3. Update all documentation

## Backward Compatibility Strategy

### Current Implementation ✅

```typescript
// In CoreServices.ts
export { UnifiedTransport as TransportController } from './UnifiedTransport.js';
```

This ensures existing code continues to work while we migrate.

### Temporary Adapter Pattern

For complex migrations, create an adapter:

```typescript
// TransportControllerAdapter.ts
export class TransportControllerAdapter {
  private unifiedTransport: UnifiedTransport;

  // Map old methods to new
  async initialize() {
    return this.unifiedTransport.initialize();
  }

  // Add any missing methods that widgets expect
}
```

## Risk Assessment

### High Risk Files

- `CorePlaybackEngine.ts` - Central to playback functionality
- `WidgetSyncService.ts` - Critical for widget coordination
- Production apps using these services

### Mitigation

1. Extensive testing before each phase
2. Feature flags for gradual rollout
3. Keep old files until 100% migration confirmed
4. Monitor error rates during migration

## Success Criteria

1. All widgets work with UnifiedTransport
2. No regression in timing accuracy
3. Improved performance metrics:
   - Timing stability >99.5%
   - Drift <1ms
   - CPU usage <25%
4. All tests passing
5. No runtime errors in production

## Timeline

- **Week 0**: UnifiedTransport implementation ✅ COMPLETED
  - Created UnifiedTransport with all professional features
  - Added AudioWorklet support
  - Implemented Kalman filter drift compensation
  - Created test page for verification
- **Week 1**: Deprecation marking & hook updates
  - ✅ All old transport files marked as @deprecated
  - ✅ CoreServices updated to use UnifiedTransport
  - ⏳ Hook updates in progress
- **Week 2**: Widget migration & TransportSyncManager refactor ⏳ CURRENT
- **Week 3**: Testing & cleanup
- **Week 4**: Production deployment & monitoring
- **Week 5**: Remove deprecated files

## Commands for Migration

```bash
# Find all TransportController imports
grep -r "TransportController" --include="*.ts" --include="*.tsx" apps/frontend/src

# Find all ProfessionalTimingEngine references
grep -r "ProfessionalTimingEngine" --include="*.ts" apps/frontend/src

# Run tests after each migration step
pnpm test:transport

# Check for runtime errors
pnpm dev # Then check browser console
```

## Notes

- Keep TransportSyncManager but refactor it to be a pure broadcast layer
- The UnifiedTransport already has backward compatibility through type exports
- Monitor performance metrics closely during migration
- Document any breaking changes for external consumers
