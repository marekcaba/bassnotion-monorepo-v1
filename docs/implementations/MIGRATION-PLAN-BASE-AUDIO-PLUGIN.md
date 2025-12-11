# Migration Plan: BaseAudioPlugin to Module System

## Overview

BaseAudioPlugin.ts is an abstract base class that provides standard implementation foundation for all audio plugins in the system. It currently resides in the services directory but should be migrated to the modules system for better organization.

## Current State

- Location: `apps/frontend/src/domains/playback/services/BaseAudioPlugin.ts`
- Dependencies:
  - Plugin types from `../types/plugin.js`
  - EventEmitter from Node.js
- Usage:
  - Used by test files in `services/core/__tests__/`
  - Implements AudioPlugin interface
  - Provides lifecycle management and state handling

## Migration Strategy

### Phase 1: Create Module Structure

1. Create new location: `apps/frontend/src/domains/playback/modules/plugins/base/BaseAudioPlugin.ts`
2. Move the BaseAudioPlugin class to the new location
3. Update imports to use the plugin types from their current location

### Phase 2: Update Dependencies

1. Update all test files that import BaseAudioPlugin:
   - `services/core/__tests__/CoreServicesIntegration.test.ts`
   - `services/core/__tests__/PluginManager.test.ts`
2. Create re-export in services for backward compatibility:
   ```typescript
   // services/BaseAudioPlugin.ts
   export { BaseAudioPlugin } from '../modules/plugins/base/BaseAudioPlugin.js';
   ```

### Phase 3: Integrate with Module System

1. Create an index.ts in `modules/plugins/` that exports all plugin-related functionality
2. Add BaseAudioPlugin to the module exports
3. Consider creating additional plugin base classes for specific categories (InstrumentPlugin, EffectPlugin, etc.)

### Phase 4: Enhance Plugin Architecture

1. Add plugin discovery mechanism
2. Create plugin registry for dynamic plugin management
3. Add plugin metadata validation
4. Implement plugin dependency resolution

### Phase 5: Remove Legacy Code

1. Once all consumers are updated, remove the re-export from services
2. Delete the original file from services directory
3. Update documentation to reflect new location

## Technical Considerations

### Benefits

- Better organization within module system
- Clear separation of concerns
- Easier plugin discovery and management
- Consistent with module-based architecture

### Risks

- Breaking changes for existing test files
- Need to maintain backward compatibility during transition
- Potential circular dependency issues

### Implementation Timeline

- Phase 1-2: ✅ Complete
- Phase 3-4: ✅ Complete
- Phase 5: ✅ Complete (2025-09-08)

## Migration Status (2025-09-08)

### ✅ Migration Complete

- BaseAudioPlugin has been successfully migrated from services to modules
- All consumers updated to use new import path
- Legacy re-export removed
- Tests updated (some unrelated test failures exist)

### Final State

- **New location**: `apps/frontend/src/domains/playback/modules/plugins/base/BaseAudioPlugin.ts`
- **Export available from**: `@/domains/playback/modules/plugins`
- **Legacy file removed**: ✅ `services/BaseAudioPlugin.ts` deleted

## Action Items

1. [x] Create module structure for plugins
2. [x] Move BaseAudioPlugin to modules
3. [x] Update test imports
4. [x] Create backward compatibility exports
5. [x] Remove legacy code
6. [ ] Document new plugin architecture
7. [ ] Plan enhanced plugin features
