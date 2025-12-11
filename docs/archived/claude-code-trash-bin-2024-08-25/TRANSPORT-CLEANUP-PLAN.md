# Transport System Cleanup Plan

## Current State

UnifiedTransport is the single source of truth for transport functionality, but there are multiple deprecated/redundant files creating confusion.

## Files to Remove (Deprecated)

### 1. TransportController.ts

- **Path**: `/domains/playback/services/core/TransportController.ts`
- **Reason**: Deprecated, functionality moved to UnifiedTransport
- **Action**: Delete file after updating imports

### 2. StableTransportScheduler.ts

- **Path**: `/domains/playback/services/timing/StableTransportScheduler.ts`
- **Reason**: Deprecated, functionality integrated into UnifiedTransport
- **Action**: Delete file

### 3. ProfessionalTimingEngine.ts

- **Path**: `/domains/playback/services/timing/ProfessionalTimingEngine.ts`
- **Reason**: Deprecated, merged into UnifiedTransport
- **Action**: Delete file

### 4. ProfessionalTransportScheduler Directory

- **Path**: `/domains/playback/services/ProfessionalTransportScheduler/`
- **Reason**: Only contains remnants (constants.ts, utils/)
- **Action**: Delete entire directory

### 5. TransportSyncManager.original.ts

- **Path**: `/domains/playback/services/core/TransportSyncManager.original.ts`
- **Reason**: Backup file, no longer needed
- **Action**: Delete file

## Files to Update

### 1. CoreServices.ts

- **Change**: Remove `getTransportController()` method
- **Keep**: Only `getUnifiedTransport()`

### 2. index.ts (playback domain)

- **Change**: Remove `TransportController` export
- **Add**: Export `UnifiedTransport` directly

### 3. useTransport.ts hook

- **Change**: Update to use `getUnifiedTransport()` instead of `getTransportController()`

### 4. TransportWidgetAdapter.ts

- **Change**: Update comments to reflect UnifiedTransport as the source
- **Consider**: Simplifying the adapter pattern

## Import Updates Needed

Search and replace across codebase:

1. `import { TransportController }` → `import { UnifiedTransport }`
2. `getTransportController()` → `getUnifiedTransport()`
3. References to deprecated classes in comments/docs

## Test Files to Update

- `/domains/playback/services/core/__tests__/TransportController.test.ts`
- `/domains/playback/services/__tests__/TransportController.integration.test.ts`
- Any tests importing deprecated transport classes

## Benefits of Cleanup

1. **Clarity**: One clear transport implementation
2. **Maintainability**: No confusion about which class to use
3. **Performance**: Smaller bundle size without deprecated code
4. **Developer Experience**: Clear API surface

## Migration Path

1. Update all imports to use UnifiedTransport
2. Update CoreServices to only expose getUnifiedTransport()
3. Delete deprecated files
4. Update tests
5. Update documentation

## Verification

After cleanup, verify:

- [ ] Only UnifiedTransport exists as transport implementation
- [ ] All imports use UnifiedTransport
- [ ] Tests pass
- [ ] No references to deprecated classes
- [ ] Documentation reflects single transport system
