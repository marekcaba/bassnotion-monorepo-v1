# Widget Consolidation Plan

## Overview

This document outlines the plan to consolidate widget versions and remove deprecated V1 implementations in favor of V2 widgets that use the new Track System and WAM plugins.

## Current State

### V1 Widgets (Deprecated)
- `MetronomeWidget.tsx`
- `DrummerWidget.tsx`
- `BassLineWidget.tsx`
- `HarmonyWidget.tsx` (already removed)

### V2 Widgets (Current)
- `MetronomeWidgetV2.tsx`
- `DrummerWidgetV2.tsx`
- `BassLineWidgetV2.tsx`
- `HarmonyWidgetV2.tsx`

### Files Still Using V1 Widgets
1. **Test Files**:
   - `/components/__tests__/BassLineWidget.test.tsx`
   - `/components/__tests__/DrummerWidget.test.tsx`
   - `/components/__tests__/DrummerWidget.real.test.tsx`

2. **Example Files**:
   - `/examples/IntegratedDrummerTrack.tsx`
   - `/examples/DrummerWithTrackSystem.tsx`

## Migration Steps

### Phase 1: Update Tests (Immediate)
1. Update test files to import V2 widgets
2. Adjust test cases for V2 widget API differences
3. Ensure all tests pass with V2 widgets

### Phase 2: Update Examples (Immediate)
1. Update example files to use V2 widgets
2. Verify examples still demonstrate intended functionality
3. Update any documentation referencing these examples

### Phase 3: Remove V1 Files (After Verification)
1. Delete V1 widget files:
   - `MetronomeWidget.tsx`
   - `DrummerWidget.tsx`
   - `BassLineWidget.tsx`
2. Remove commented exports from `index.ts`
3. Clean up any V1-specific utilities or hooks

### Phase 4: Rename V2 Widgets (COMPLETED)
Once V1 is completely removed, consider:
1. ✅ Rename `*WidgetV2.tsx` to `*Widget.tsx`
2. ✅ Update all imports
3. ✅ This makes the codebase cleaner for new developers

**Completed on 2025-08-30**:
- Renamed all V2 widget files to remove the "V2" suffix
- Updated all imports in components, tests, and examples
- Verified no remaining V2 references in the codebase

## Key Differences Between V1 and V2

### Architecture Changes
- **V1**: Direct Tone.js integration, custom state management
- **V2**: Track System integration, WAM plugin architecture

### API Changes
- **Props**: V2 widgets have simplified props, rely on Track System
- **State**: V2 uses centralized transport state
- **Events**: V2 uses event bus for communication

### Performance Improvements
- **V2**: Better sample preloading
- **V2**: Optimized scheduling
- **V2**: Reduced re-renders

## Testing Strategy

### Unit Tests
- Update mocks for Track System
- Test WAM plugin integration
- Verify transport synchronization

### Integration Tests
- Test widget interactions
- Verify audio playback
- Check timing accuracy

### Manual Testing
- Test in all supported browsers
- Verify mobile compatibility
- Check performance metrics

## Rollback Plan

If issues are discovered:
1. Revert changes in git
2. Uncomment V1 exports in index.ts
3. Fix issues in separate branch
4. Re-attempt migration

## Success Criteria

- [x] All tests pass with V2 widgets
- [x] No runtime errors in browser console
- [x] Performance metrics maintained or improved
- [x] Examples work correctly
- [x] No V1 imports remain in codebase
- [x] V2 widgets renamed to remove suffix

## Timeline

- **Day 1**: Update tests and examples
- **Day 2**: Test thoroughly in all environments
- **Day 3**: Remove V1 files if all tests pass
- **Day 4**: Consider renaming V2 widgets

## Notes for Developers

### Common Migration Issues
1. **State Management**: V2 widgets don't manage their own transport state
2. **Props**: Some V1 props are no longer needed in V2
3. **Events**: Event handling is different in V2

### Where to Get Help
- Check V2 widget source code for examples
- Look at `FourWidgetsCard.tsx` for integration patterns
- Review Track System documentation

## Post-Migration Cleanup

1. Update CLAUDE.md to reflect V2-only widgets
2. Archive any V1-specific documentation
3. Update component inventory
4. Remove V1-specific dependencies if any