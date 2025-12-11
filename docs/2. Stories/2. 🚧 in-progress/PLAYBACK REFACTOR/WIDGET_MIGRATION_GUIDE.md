# Widget Migration Guide: RegionProcessor → PlaybackEngine

**Document Version:** 1.0
**Created:** 2025-11-23
**Phase:** 2.2 - Widget Migration & Adapter Pattern
**Status:** ✅ Complete - All 3 primary widgets migrated

---

## Table of Contents

1. [Overview](#overview)
2. [Migration Timeline](#migration-timeline)
3. [Quick Reference](#quick-reference)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Common Patterns](#common-patterns)
6. [Testing Checklist](#testing-checklist)
7. [Rollback Strategy](#rollback-strategy)
8. [Adapter Removal Plan](#adapter-removal-plan)

---

## Overview

### Why Migrate?

The `RegionProcessor` API is being replaced by the new `PlaybackEngine` API as part of the Playback Architecture Refactor. The new API provides:

- ✅ **Better state management:** Explicit state machine (7 states) vs boolean flags
- ✅ **Unified architecture:** Single source of truth for playback state
- ✅ **Improved performance:** Reduced overhead from consolidation
- ✅ **Better testability:** Cleaner API surface with dependency injection
- ✅ **Bug fixes preserved:** All 6 critical bug fixes maintained

### Migration Status

| Widget          | Status      | Call Sites | Completed  | Notes                           |
| --------------- | ----------- | ---------- | ---------- | ------------------------------- |
| DrummerWidget   | ✅ Complete | 2          | 2025-11-23 | Pattern loading, MIDI import    |
| HarmonyWidget   | ✅ Complete | 4          | 2025-11-23 | Complex: PluginManager, buffers |
| MetronomeWidget | ✅ Complete | 3          | 2025-11-23 | Time signature, BPM changes     |
| VoiceCueWidget  | N/A         | 0          | -          | Instrument type only, no widget |

**Total Migration:** 9 call sites converted, 3 widgets migrated (100%)

---

## Migration Timeline

### Backward Compatibility Period

```
Phase 2.2 (Now)          Phase 3.1 (Week 7)        Phase 3.2 (Week 8)
     │                         │                         │
     ├─ Adapter created        ├─ Adapter deprecated     ├─ Adapter removed
     ├─ Widgets migrate        ├─ Warning on use         ├─ RegionProcessor removed
     └─ Both APIs work         └─ Migration complete     └─ Only PlaybackEngine
```

- **Phase 2.2 (Days 1-3):** Adapter created, widgets migrated to PlaybackEngine
- **Phase 2.2 (Day 4):** Regression testing (42/42 tests passing)
- **Phase 2.2 (Day 5):** Documentation (this guide)
- **Phase 3.1 (Week 7):** Adapter marked for removal, loud deprecation warnings
- **Phase 3.2 (Week 8):** Adapter and RegionProcessor removed from codebase

**Current Status:** We are in Phase 2.2, Day 5. The adapter is available but deprecated.

---

## Quick Reference

### API Changes Summary

| Old API (RegionProcessor) | New API (PlaybackEngine)                     | Status                         |
| ------------------------- | -------------------------------------------- | ------------------------------ |
| `getRegionProcessor()`    | `getPlaybackEngine()`                        | ✅ Direct replacement          |
| `registerTracks([track])` | `registerTrack(track)`                       | ✅ Singular form               |
| `updateTracks([track])`   | `unregisterTrack(id) + registerTrack(track)` | ✅ Two-step pattern            |
| `setAudioContext(ctx)`    | Set during `initialize(ctx, dest)`           | ✅ No-op (initialization only) |
| `setHarmonyBuffers(...)`  | Internal buffer management                   | ✅ No-op (internal)            |
| `setPluginManager(pm)`    | `setPluginManager(pm)`                       | ✅ Same                        |
| `getWamKeyboard()`        | `getWamKeyboard()`                           | ✅ Same                        |
| `disableCountdown()`      | `setCountdownConfig(beats, false)`           | ✅ More flexible               |
| `start()`                 | `start()`                                    | ✅ Same                        |
| `stop(graceful)`          | `stop(graceful)`                             | ✅ Same                        |
| `pause()`                 | `pause()`                                    | ✅ Same                        |
| N/A                       | `resume()`                                   | ✅ New: resume from pause      |
| `.isRunning`              | `getState() === 'playing'`                   | ✅ State machine check         |
| `dispose()`               | `dispose()`                                  | ✅ Same                        |

---

## Step-by-Step Migration

### Step 1: Update CoreServices Call

**Before:**

```typescript
const coreServices = window.__globalCoreServices || window.__coreServices;
const regionProcessor = coreServices?.getRegionProcessor?.();

if (!regionProcessor) {
  console.error('RegionProcessor not available');
  return;
}
```

**After:**

```typescript
const coreServices = window.__globalCoreServices || window.__coreServices;
const playbackEngine = coreServices?.getPlaybackEngine?.();

if (!playbackEngine) {
  console.error('PlaybackEngine not available');
  return;
}
```

**Why:** `getPlaybackEngine()` returns the new unified playback system.

---

### Step 2: Replace Track Registration

**Pattern A: Initial Registration**

**Before:**

```typescript
regionProcessor.registerTracks([
  {
    id: 'widget-track',
    name: 'Widget Track',
    regions: [...],
    instrumentType: 'metronome',
  },
]);
```

**After:**

```typescript
playbackEngine.registerTrack({
  id: 'widget-track',
  name: 'Widget Track',
  regions: [...],
  instrumentType: 'metronome',
});
```

**Why:** PlaybackEngine uses singular `registerTrack()` instead of bulk `registerTracks()`.

---

**Pattern B: Track Updates**

**Before:**

```typescript
regionProcessor.updateTracks([
  {
    id: 'widget-track',
    name: 'Widget Track - Updated',
    regions: [...],
    instrumentType: 'metronome',
  },
]);
```

**After:**

```typescript
// Two-step pattern: unregister old, register new
playbackEngine.unregisterTrack('widget-track');
playbackEngine.registerTrack({
  id: 'widget-track',
  name: 'Widget Track - Updated',
  regions: [...],
  instrumentType: 'metronome',
});
```

**Why:** PlaybackEngine doesn't have `updateTracks()`. The unregister + register pattern is explicit and prevents race conditions.

---

### Step 3: Replace State Checks

**Before:**

```typescript
const isRunning = (regionProcessor as any).isRunning;

if (isRunning) {
  // Update during playback
  regionProcessor.updateTracks([track]);
} else {
  // Initial registration
  regionProcessor.registerTracks([track]);
}
```

**After:**

```typescript
const isRunning = playbackEngine.getState() === 'playing';

if (isRunning) {
  // Update during playback
  playbackEngine.unregisterTrack(trackId);
  playbackEngine.registerTrack(track);
} else {
  // Initial registration
  playbackEngine.registerTrack(track);
}
```

**Why:** PlaybackEngine uses a state machine (`getState()`) instead of boolean flags.

**Available States:**

- `idle` - Not initialized
- `loading` - Initializing resources
- `ready` - Initialized, ready to play
- `playing` - Active playback
- `paused` - Playback paused
- `stopped` - Playback stopped
- `error` - Error state

---

### Step 4: Remove Buffer Management (HarmonyWidget only)

**Before:**

```typescript
if (harmonyBuffers && harmonyBuffers.size > 0) {
  regionProcessor.setHarmonyBuffers(
    harmonyBuffers,
    audioContext.destination,
    perNoteVelocityRanges,
    instrument,
  );
}
```

**After:**

```typescript
// Buffer management is now internal to PlaybackEngine
// Just log for diagnostics (optional)
if (harmonyBuffers && harmonyBuffers.size > 0) {
  console.log('[WIDGET] Harmony buffers available', {
    noteCount: harmonyBuffers.size,
    instrument,
  });
}
// No need to inject buffers - PlaybackEngine handles this internally
```

**Why:** PlaybackEngine manages buffers internally through BufferManager. External injection is no longer needed.

---

### Step 5: Verify State Transitions

**Before:**

```typescript
// RegionProcessor had limited state checking
if (regionProcessor.isRunning) {
  // playing
} else {
  // not playing (could be ready, stopped, paused, or error)
}
```

**After:**

```typescript
// PlaybackEngine provides explicit state machine
const state = playbackEngine.getState();

if (state === 'playing') {
  // Active playback
} else if (state === 'paused') {
  // Paused - can resume
} else if (state === 'ready' || state === 'stopped') {
  // Ready to start
} else if (state === 'error') {
  // Error state - handle gracefully
}
```

**Why:** Explicit states prevent ambiguous behavior.

---

## Common Patterns

### Pattern 1: DrummerWidget - Pattern Updates

**Scenario:** User changes drum pattern, need to update regions during playback.

**Before:**

```typescript
useEffect(() => {
  if (globalServices && globalServices.getRegionProcessor) {
    const regionProcessor = globalServices.getRegionProcessor();

    regionProcessor.updateTracks([
      {
        id: 'drummer-widget-track',
        regions: newRegions,
        instrumentType: 'drums',
      },
    ]);
  }
}, [selectedPattern]);
```

**After:**

```typescript
useEffect(() => {
  if (globalServices && globalServices.getPlaybackEngine) {
    const playbackEngine = globalServices.getPlaybackEngine();

    if (playbackEngine) {
      // Unregister old track
      playbackEngine.unregisterTrack('drummer-widget-track');

      // Register with new pattern
      playbackEngine.registerTrack({
        id: 'drummer-widget-track',
        regions: newRegions,
        instrumentType: 'drums',
      });
    }
  }
}, [selectedPattern]);
```

**Call Sites:** [DrummerWidget.tsx:513](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget.tsx#L513), [DrummerWidget.tsx:836](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget.tsx#L836)

---

### Pattern 2: HarmonyWidget - PluginManager Integration

**Scenario:** Complex widget with WAM plugin, velocity layers, and sustain pedal.

**Before:**

```typescript
// Setup PluginManager
regionProcessor.setPluginManager(pluginManager);

// Inject harmony buffers
regionProcessor.setHarmonyBuffers(
  harmonyBuffers,
  audioContext.destination,
  perNoteVelocityRanges,
  instrument,
);

// Check state
const isRunning = (regionProcessor as any).isRunning;

// Register or update
if (isRunning) {
  regionProcessor.updateTracks([track]);
} else {
  regionProcessor.registerTracks([track]);
}
```

**After:**

```typescript
// Setup PluginManager (same)
playbackEngine.setPluginManager(pluginManager);

// No buffer injection needed - managed internally
console.log('[HARMONY] Buffers managed by PlaybackEngine', {
  noteCount: harmonyBuffers.size,
  instrument,
});

// Check state (explicit)
const isRunning = playbackEngine.getState() === 'playing';

// Register or update
if (isRunning) {
  playbackEngine.unregisterTrack('harmony-widget-track');
  playbackEngine.registerTrack(track);
} else {
  playbackEngine.registerTrack(track);
}
```

**Call Sites:** [HarmonyWidget.tsx:1321](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx#L1321), [HarmonyWidget.tsx:1456](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx#L1456), [HarmonyWidget.tsx:1492](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx#L1492), [HarmonyWidget.tsx:1748-1758](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx#L1748)

---

### Pattern 3: MetronomeWidget - Time Signature & BPM

**Scenario:** User changes time signature (4/4 → 3/4) or BPM, need to rebuild metronome pattern.

**Before:**

```typescript
useEffect(() => {
  if (globalServices && globalServices.getRegionProcessor) {
    const regionProcessor = globalServices.getRegionProcessor();

    // Rebuild regions with new time signature
    const newRegions = buildMetronomeRegions(timeSignature, bpm);

    regionProcessor.updateTracks([
      {
        id: 'metronome-track',
        regions: newRegions,
        instrumentType: 'metronome',
      },
    ]);
  }
}, [timeSignature, bpm]);
```

**After:**

```typescript
useEffect(() => {
  if (globalServices && globalServices.getPlaybackEngine) {
    const playbackEngine = globalServices.getPlaybackEngine();

    if (playbackEngine) {
      // Rebuild regions with new time signature
      const newRegions = buildMetronomeRegions(timeSignature, bpm);

      // Unregister old, register new
      playbackEngine.unregisterTrack('metronome-track');
      playbackEngine.registerTrack({
        id: 'metronome-track',
        regions: newRegions,
        instrumentType: 'metronome',
      });
    }
  }
}, [timeSignature, bpm]);
```

**Call Sites:** [MetronomeWidget.tsx:333](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/MetronomeWidget.tsx#L333), [MetronomeWidget.tsx:426](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/MetronomeWidget.tsx#L426), [MetronomeWidget.tsx:483](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/MetronomeWidget.tsx#L483)

---

## Testing Checklist

### Before Migration

- [ ] Read this migration guide completely
- [ ] Identify all `getRegionProcessor()` call sites in your widget
- [ ] List all `registerTracks()` and `updateTracks()` calls
- [ ] Document current widget behavior (baseline for regression testing)

### During Migration

- [ ] Replace `getRegionProcessor()` with `getPlaybackEngine()`
- [ ] Replace `registerTracks([track])` with `registerTrack(track)`
- [ ] Replace `updateTracks([track])` with `unregisterTrack() + registerTrack()`
- [ ] Replace `.isRunning` with `getState() === 'playing'`
- [ ] Remove `setHarmonyBuffers()` calls (if HarmonyWidget)
- [ ] Remove `setAudioContext()` calls (initialization only)
- [ ] Test widget in isolation
- [ ] Test widget with other widgets active
- [ ] Test exercise switching
- [ ] Test tempo changes during playback

### After Migration

- [ ] Run regression test suite: `pnpm vitest run widget-migration-regression.test.ts`
- [ ] Verify no console errors in browser DevTools
- [ ] Test all widget features (pattern loading, MIDI import, etc.)
- [ ] Verify no memory leaks (Chrome DevTools Memory Profiler)
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Update widget documentation with new API calls

---

## Rollback Strategy

### If Migration Causes Issues

**Option 1: Use RegionProcessorAdapter (Temporary)**

```typescript
// If PlaybackEngine has issues, temporarily use adapter
const coreServices = window.__globalCoreServices;
const adapter = new RegionProcessorAdapter(coreServices.getPlaybackEngine());

// Adapter provides backward-compatible API
adapter.registerTracks([track]);
adapter.updateTracks([track]);
// ... etc
```

**When to Use:** Critical production issue, need immediate fix while investigating.

**Option 2: Revert Migration Commit**

```bash
# Revert widget migration commit
git revert <commit-hash>

# Test that old API still works
pnpm vitest run <widget>.test.ts

# Deploy hotfix
```

**When to Use:** Migration broken beyond quick fix, need to restore stability.

---

## Adapter Removal Plan

### Phase 3.1 (Week 7): Mark Adapter for Removal

**Actions:**

1. Add loud deprecation warnings to adapter:

```typescript
console.error(
  '🚨 [DEPRECATED] RegionProcessorAdapter will be REMOVED in 1 week! ' +
    'Migrate to PlaybackEngine immediately. See WIDGET_MIGRATION_GUIDE.md',
);
```

2. Update all adapter method warnings to ERROR level
3. Send Slack/Discord announcement to team
4. Review all remaining adapter usage in codebase
5. Create migration tickets for any remaining widgets

**Pass Criteria:**

- Zero adapter usage in production widgets
- All tests passing without adapter
- Team acknowledged migration deadline

---

### Phase 3.2 (Week 8): Remove Adapter

**Actions:**

1. Delete `RegionProcessorAdapter.ts`
2. Delete `RegionProcessorAdapter.test.ts`
3. Remove `getRegionProcessor()` from CoreServices
4. Delete `RegionProcessor.ts` (legacy class)
5. Update all documentation to remove RegionProcessor references
6. Run full regression suite: `pnpm vitest run apps/frontend/src/domains/playback/`

**Pass Criteria:**

- No import errors after deletion
- All tests passing (600+ tests)
- Zero runtime errors in production
- Memory usage stable or improved

**Rollback Plan:**

- Revert adapter deletion commit (git revert)
- Restore RegionProcessor from backup
- Investigate root cause before attempting removal again

---

## FAQ

### Q: Why two-step pattern (unregister + register) instead of updateTracks()?

**A:** The two-step pattern is explicit and prevents race conditions:

- **Explicit:** Clear what's happening (remove old, add new)
- **No race conditions:** Can't have two versions of same track registered
- **Better for debugging:** Each step logged separately
- **Consistent:** Same pattern for all track operations

### Q: What happens to buffers in HarmonyWidget?

**A:** PlaybackEngine manages buffers internally through `BufferManager`. You no longer need to inject them with `setHarmonyBuffers()`. The engine automatically:

- Loads buffers from GlobalSampleCache
- Maps notes to velocity layers
- Handles buffer cleanup on dispose

### Q: Can I still use RegionProcessor?

**A:** Yes, until Phase 3.2 (Week 8). The `RegionProcessorAdapter` provides backward compatibility. However:

- ⚠️ Adapter is deprecated (loud warnings in console)
- ⚠️ Adapter will be removed in Week 8
- ✅ Migrate now to avoid disruption

### Q: How do I test my migration?

**A:** Three-level testing strategy:

1. **Unit tests:** Widget behavior in isolation
2. **Integration tests:** Widget + PlaybackEngine interactions
3. **Regression tests:** Run `widget-migration-regression.test.ts` (19 scenarios)

See [Testing Checklist](#testing-checklist) above.

### Q: What if I find a bug in PlaybackEngine?

**A:** Report immediately:

1. Create GitHub issue with "Playback Engine" label
2. Include reproduction steps
3. Note if issue exists in RegionProcessor (regression)
4. Ping team in Slack/Discord
5. Consider temporary rollback if critical

### Q: Performance impact of migration?

**A:** **Neutral to positive:**

- ✅ Same or better performance (consolidated architecture)
- ✅ Reduced memory overhead (single state machine)
- ✅ Faster state checks (no boolean flags)
- ✅ Bug fixes preserved (timing, memory, etc.)

Verified with 42/42 regression tests passing.

---

## Additional Resources

- [Playback Engine Refactor Story](./PLAYBACK_ENGINE_REFACTOR_STORY.md) - Master implementation plan
- [Core Services Call Sites](./CORE_SERVICES_CALL_SITES.md) - All RegionProcessor usage locations
- [Bug Fix Verification Report](./BUG_FIX_VERIFICATION_REPORT.md) - Preserved bug fixes (58 tests)
- [PlaybackEngine.ts](../../../apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts) - Source code
- [RegionProcessorAdapter.ts](../../../apps/frontend/src/domains/playback/services/core/RegionProcessorAdapter.ts) - Backward compatibility adapter

---

**Questions?** Contact the Playback Team or create a GitHub issue.

**Last Updated:** 2025-11-23
**Document Owner:** Playback Architecture Refactor Team
