# Playback Domain Critical Bugs Analysis

**Date**: 2025-01-22
**Status**: Identified, Pending Fix
**Severity**: Critical (3 bugs), High (1 bug)

## Overview

This document details 4 critical bugs discovered in the playback domain that cause memory leaks, race conditions, silent audio failures, and state management issues. These bugs affect core functionality and must be addressed systematically.

## Summary Table

| Priority    | Bug                                        | Impact                                        | Files Affected |
| ----------- | ------------------------------------------ | --------------------------------------------- | -------------- |
| 🔴 CRITICAL | Race Condition in Initialization           | Double buffer loading, unpredictable behavior | 3 files        |
| 🔴 CRITICAL | OfflineAudioContext Incompatibility        | Silent audio failures, wasted preloading      | 3 files        |
| 🔴 CRITICAL | Memory Leak - AudioBufferSourceNode        | Linear memory growth, eventual crash          | 6 files        |
| 🟠 HIGH     | No Single Source of Truth for AudioContext | Multiple contexts, state mismatches           | 5+ files       |

---

## Bug #1: Race Condition in Initialization

### Problem Statement

Two independent initialization paths can execute in unpredictable order, causing buffers to be loaded twice and creating timing conflicts.

**Initialization Paths**:

1. **useCoreServices** - Auto-initializes on first **click/touch** → Creates `window.__globalCoreServices`
2. **ScrollTriggerLoader** - Preloads samples on first **scroll** → Tries to access `window.__globalCoreServices`

### Race Condition Scenarios

| User Action          | Execution Order                                            | Result                                             |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| Scroll → Click Play  | `loadEssentialSamples()` runs before `CoreServices` exists | Falls back to OfflineContext, samples loaded twice |
| Click Play → Scroll  | Both run simultaneously                                    | Potential buffer injection conflicts               |
| Rapid Click + Scroll | Undefined execution order                                  | Unpredictable behavior                             |

### Evidence

**Location**: [apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts:85-98](apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts)

```typescript
// Fallback logic when CoreServices doesn't exist yet
const coreServices = window.__globalCoreServices || window.__coreServices;
if (!coreServices) {
  logger.info('CoreServices not ready yet, falling back to URL caching only');
  const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
  return this.loadEssentialHarmonySamples(offlineContext); // ⚠️ Uses OfflineContext
}
```

**Location**: [apps/frontend/src/domains/playback/hooks/useCoreServices.ts:519-536](apps/frontend/src/domains/playback/hooks/useCoreServices.ts)

```typescript
// Auto-initialize on first click
useEffect(() => {
  if (autoInitialize && !isInitialized && !isLoading) {
    const handleFirstInteraction = () => {
      initialize().catch(console.error); // Creates CoreServices
      document.removeEventListener('click', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
  }
}, [autoInitialize, isInitialized, isLoading, initialize]);
```

### Impact

- **Wasted CPU**: Samples decoded twice (once with OfflineContext, once with real AudioContext)
- **Wasted Memory**: Duplicate buffers in cache
- **Unpredictable State**: CoreServices may initialize while buffers are being loaded
- **Buffer Incompatibility**: See Bug #2

### Proposed Solution

1. **Move preInitialize() to page load** - Load Tone.js early (doesn't need user gesture)
2. **Add state machine** - Track initialization stages: `uninitialized`, `pre-initialized`, `initializing`, `initialized`
3. **Coordinate triggers** - Make ScrollTriggerLoader check state before proceeding
4. **Single initialization path** - Ensure only one code path creates CoreServices

### Files to Modify

- [apps/frontend/src/domains/playback/hooks/useCoreServices.ts:519-536](apps/frontend/src/domains/playback/hooks/useCoreServices.ts)
- [apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts:85-98](apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts)
- [apps/frontend/src/domains/playback/components/ScrollTriggerLoader.tsx:24-55](apps/frontend/src/domains/playback/components/ScrollTriggerLoader.tsx)

---

## Bug #2: OfflineAudioContext Buffer Incompatibility

### Problem Statement

AudioBuffers decoded with `OfflineAudioContext` cannot be used with a different `AudioContext`. The Web Audio API requires buffers to be from the **same context** that plays them.

### Root Cause

**Phase 2 Preloading** (during scroll, no user gesture):

```typescript
// Uses OfflineAudioContext to decode without user interaction
const offlineContext = new OfflineAudioContext(2, 44100, 44100);
const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

// Buffer is cached
GlobalSampleCache.cacheBuffer('drum-kick', audioBuffer);
```

**Playback** (after user clicks play):

```typescript
// Real AudioContext is created
const context = new AudioContext();

// Tries to use buffer from OfflineContext
const buffer = GlobalSampleCache.getBuffer('drum-kick'); // ⚠️ Wrong context!
source.buffer = buffer; // Silent failure or error
```

### Why This Breaks

From Web Audio API specification:

> An AudioBuffer created from one AudioContext cannot be used with a different AudioContext. Attempting to do so will result in an `InvalidStateError`.

Additionally:

- Buffers are tied to the context's sample rate
- Internal buffer format may differ between contexts
- Some browsers silently fail, others throw errors

### Evidence

**Explicit warnings in code**:

[apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts](apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts) (lines referenced in analysis):

```typescript
// DON'T cache the decoded buffer - it won't work with Tone.js!
// GlobalSampleCache.cacheBuffer(path, audioBuffer);
```

Comments appear in multiple locations (lines 598, 636, 713) warning against caching OfflineContext buffers.

### Impact

- **Silent Audio Failures**: Buffers don't play but no error thrown
- **Wasted Preloading**: All Phase 2 buffer decoding is wasted
- **Re-downloads**: Samples must be fetched and decoded again
- **Poor UX**: First playback attempt fails, second attempt works

### Proposed Solution

**Phase 2 (Scroll Trigger) - URL Caching Only**:

```typescript
// Only cache the URL, don't decode yet
fetch(sampleUrl)
  .then((response) => response.blob())
  .then((blob) => {
    const url = URL.createObjectURL(blob);
    GlobalSampleCache.cacheUrl('drum-kick', url);
    // Don't decode - just store the URL
  });
```

**Phase 3 (After User Gesture) - Decode with Real Context**:

```typescript
// Now we have the real AudioContext
const context = audioEngine.getContext();

// Fetch from cache (URL only)
const url = GlobalSampleCache.getUrl('drum-kick');

// Decode with REAL context
fetch(url)
  .then((response) => response.arrayBuffer())
  .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
  .then((audioBuffer) => {
    // Now buffer is compatible!
    GlobalSampleCache.cacheBuffer('drum-kick', audioBuffer, {
      isContextCompatible: true,
      contextId: context.id, // Track which context it belongs to
    });
  });
```

**Add Validation**:

```typescript
// In GlobalSampleCache
getCachedBuffer(path: string): AudioBuffer | null {
  const sample = this.samples.get(path);
  if (!sample?.buffer) return null;

  // Validate buffer is from current context
  if (!sample.isContextCompatible || sample.contextId !== this.currentContextId) {
    logger.warn(`Buffer ${path} is from different AudioContext, invalidating`);
    this.samples.delete(path);
    return null;
  }

  return sample.buffer;
}
```

### Files to Modify

- [apps/frontend/src/domains/playback/modules/storage/cache/GlobalSampleCache.ts](apps/frontend/src/domains/playback/modules/storage/cache/GlobalSampleCache.ts) - Add context tracking
- [apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts](apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts) - Change Phase 2 to URL-only
- [apps/frontend/src/domains/playback/services/core/CoreServices.ts:196-302](apps/frontend/src/domains/playback/services/core/CoreServices.ts) - Decode after context creation

---

## Bug #3: Memory Leak - AudioBufferSourceNode Tracking

### Problem Statement

Every audio event creates an `AudioBufferSourceNode` that is added to a tracking map, but these nodes are **never removed** after playback ends. This causes linear memory growth during playback.

### Evidence

**Location**: [apps/frontend/src/domains/playback/services/core/RegionProcessor.ts:149-152](apps/frontend/src/domains/playback/services/core/RegionProcessor.ts)

```typescript
// Map to track scheduled audio sources
private scheduledAudioSources = new Map<
  AudioBufferSourceNode,
  { type: 'one-shot' | 'sustained'; hasStopScheduled: boolean }
>();
```

**Sources are added** (example from harmony scheduling):

```typescript
const source = this.audioContext.createBufferSource();
source.buffer = buffer;
source.connect(gain);

// Added to map
this.scheduledAudioSources.set(source, {
  type: 'sustained',
  hasStopScheduled: false,
});

source.start(audioTime);
// ⚠️ NEVER REMOVED FROM MAP!
```

**Similar patterns** in:

- HarmonyScheduler - Creates sources for piano notes
- BassScheduler - Creates sources for bass notes
- DrumScheduler - Creates sources for drum hits
- MetronomeScheduler - Creates sources for click tracks
- VoiceCueScheduler - Creates sources for countdown

### Memory Growth Analysis

**Example**: 10-minute practice session

- Tempo: 120 BPM
- Harmony notes: 4 per bar
- Drum hits: 8 per bar
- Metronome: 4 clicks per bar

```
Calculations:
120 BPM = 30 bars/minute
10 minutes = 300 bars

Sources created:
- Harmony: 300 bars × 4 notes = 1,200 sources
- Drums: 300 bars × 8 hits = 2,400 sources
- Metronome: 300 bars × 4 clicks = 1,200 sources
- Voice cues: ~40 sources

Total: ~4,840 AudioBufferSourceNode references in map
```

Each source reference + metadata ≈ 100 bytes = **484 KB** just for tracking map.

Actual buffers may still be in memory due to references = **Megabytes** of wasted memory.

### Impact

- **Linear Memory Growth**: Memory increases proportionally to playback duration
- **Eventual Performance Degradation**: GC pressure increases over time
- **Potential Crash**: On memory-constrained devices (mobile), app may crash after extended playback
- **Map Size Bloat**: Large map impacts iteration performance

### Proposed Solution

**Add cleanup in onended callback**:

```typescript
const source = this.audioContext.createBufferSource();
source.buffer = buffer;
source.connect(gain);

// Track source
this.scheduledAudioSources.set(source, {
  type: 'one-shot',
  hasStopScheduled: false,
});

// ✅ ADD CLEANUP
source.onended = () => {
  this.scheduledAudioSources.delete(source);
  // Also clean up from activeHarmonySources, activeBassSources, etc.
};

source.start(audioTime);
```

**Add cleanup when stopping**:

```typescript
stop(): void {
  // Stop all active sources
  this.scheduledAudioSources.forEach((metadata, source) => {
    try {
      source.stop();
    } catch (e) {
      // Already stopped
    }
  });

  // Clear the map
  this.scheduledAudioSources.clear();
  this.activeHarmonySources.clear();
  this.activeBassSources.clear();
}
```

**Add periodic garbage collection** (optional safety net):

```typescript
private cleanupFinishedSources(): void {
  const now = this.audioContext.currentTime;

  this.scheduledAudioSources.forEach((metadata, source) => {
    // If source should have finished by now, remove it
    if (source.scheduledEndTime && source.scheduledEndTime < now) {
      this.scheduledAudioSources.delete(source);
    }
  });
}
```

### Files to Modify

- [apps/frontend/src/domains/playback/services/core/RegionProcessor.ts](apps/frontend/src/domains/playback/services/core/RegionProcessor.ts) - Add cleanup in stop/reset
- [apps/frontend/src/domains/playback/services/core/region-processing/scheduling/HarmonyScheduler.ts](apps/frontend/src/domains/playback/services/core/region-processing/scheduling/HarmonyScheduler.ts) - Add onended cleanup
- [apps/frontend/src/domains/playback/services/core/region-processing/scheduling/BassScheduler.ts](apps/frontend/src/domains/playback/services/core/region-processing/scheduling/BassScheduler.ts) - Add onended cleanup
- [apps/frontend/src/domains/playback/services/core/region-processing/scheduling/DrumScheduler.ts](apps/frontend/src/domains/playback/services/core/region-processing/scheduling/DrumScheduler.ts) - Add onended cleanup
- [apps/frontend/src/domains/playback/services/core/region-processing/scheduling/MetronomeScheduler.ts](apps/frontend/src/domains/playback/services/core/region-processing/scheduling/MetronomeScheduler.ts) - Add onended cleanup
- [apps/frontend/src/domains/playback/services/core/region-processing/scheduling/VoiceCueScheduler.ts](apps/frontend/src/domains/playback/services/core/region-processing/scheduling/VoiceCueScheduler.ts) - Add onended cleanup

---

## Bug #4: No Single Source of Truth for AudioContext State

### Problem Statement

Multiple components independently check and manage AudioContext state without coordination, risking:

- Multiple AudioContext instances (browser limit ≈ 6)
- Instruments using different contexts (audio won't play together)
- State mismatches between components
- Race conditions on context creation

### Evidence

**Multiple context creation points**:

1. **CoreServices** - Creates primary context:

   ```typescript
   // apps/frontend/src/domains/playback/services/core/CoreServices.ts:187
   const context = await this.audioEngine.getContext();
   this.regionProcessor.setAudioContext(context);
   ```

2. **InitialSamplePreloader** - Checks context independently:

   ```typescript
   // apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts:90-93
   if (audioEngine?.isReady?.()) {
     const context = audioEngine.getContext();
     if (context?.state === 'running') {
       // Use context
     }
   }
   ```

3. **WAM Plugins** - May create their own contexts:

   ```typescript
   // Widget components get context directly
   const harmonyInstrument =
     await wamPluginSingleton.getOrCreateKeyboardPlugin(context);
   ```

4. **useAudio Hook** - Gets context separately:
   ```typescript
   // apps/frontend/src/domains/playback/hooks/useAudio.ts
   const audioEngine = window.__globalCoreServices?.getAudioEngine();
   const context = audioEngine?.getContext();
   ```

**No coordination between checks** - Each component makes independent decisions about:

- When to create a context
- When to resume/suspend
- Which context to use
- Context state validity

### Current State Management Issues

**Polling-based detection**:

```typescript
// apps/frontend/src/domains/playback/utils/contextManager.ts:41
// Checks every 500ms for context changes
setInterval(() => {
  if (Tone.context.rawContext !== storedContext) {
    // Context changed!
    GlobalSampleCache.clearAllBuffers();
  }
}, 500);
```

**Problems**:

- 500ms delay to detect changes
- No events emitted
- Other components unaware of changes
- No coordination on cleanup

### Impact

- **Multiple Contexts**: Different widgets may use different AudioContext instances
- **Audio Incompatibility**: Buffers from one context don't work with another
- **State Desynchronization**: UI shows "running" but context is "suspended"
- **Resource Waste**: Multiple contexts consume more CPU/memory
- **Mobile Issues**: iOS Safari has strict context limits

### Proposed Solution

**Centralized Context Management**:

```typescript
// AudioContextManager becomes the single source of truth
class AudioContextManager {
  private static context: AudioContext | null = null;
  private static eventBus: EventBus;

  static getOrCreateContext(config): AudioContext {
    if (!this.context) {
      this.context = new AudioContext(config);

      // Listen for state changes (standard Web Audio API)
      this.context.addEventListener('statechange', () => {
        this.eventBus.emit('audio:context-state-changed', {
          state: this.context!.state,
          contextId: this.context!.id,
        });
      });

      this.eventBus.emit('audio:context-created', {
        contextId: this.context.id,
      });
    }

    return this.context;
  }

  static getContext(): AudioContext | null {
    return this.context;
  }

  static closeContext(): void {
    if (this.context) {
      this.context.close();
      this.eventBus.emit('audio:context-closed');
      this.context = null;
    }
  }
}
```

**All components use centralized access**:

```typescript
// Instead of creating their own
const context = CoreServices.getAudioEngine().getContext();

// Listen for state changes
eventBus.on('audio:context-state-changed', ({ state }) => {
  if (state === 'suspended') {
    // Handle suspension
  }
});
```

**Replace polling with events**:

```typescript
// Remove 500ms polling interval
// Use native statechange event instead
context.addEventListener('statechange', () => {
  // Immediate notification
  eventBus.emit('audio:context-state-changed', { state: context.state });
});
```

### Files to Modify

- [apps/frontend/src/domains/playback/modules/audio-engine/core/AudioContextManager.ts](apps/frontend/src/domains/playback/modules/audio-engine/core/AudioContextManager.ts) - Add event-based state management
- [apps/frontend/src/domains/playback/utils/contextManager.ts](apps/frontend/src/domains/playback/utils/contextManager.ts) - Replace polling with events
- [apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts](apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts) - Use centralized context
- [apps/frontend/src/domains/playback/hooks/useAudio.ts](apps/frontend/src/domains/playback/hooks/useAudio.ts) - Listen for state events
- Various widget files - Update to use centralized access

---

## Priority & Implementation Order

### Recommended Sequence

1. **Fix Bug #3 (Memory Leak) - IMMEDIATE**
   - Safest fix with no API changes
   - Immediate impact on performance
   - Low risk of breaking existing functionality
   - Can be tested independently

2. **Fix Bug #4 (AudioContext Centralization) - HIGH**
   - Prevents future issues
   - Improves overall architecture
   - Enables better debugging
   - Required foundation for other fixes

3. **Fix Bug #2 (Buffer Incompatibility) - CRITICAL**
   - Requires AudioContext centralization (Bug #4) to be fixed first
   - More complex, affects preloading strategy
   - Needs careful testing of phase transitions

4. **Fix Bug #1 (Race Condition) - CRITICAL**
   - Most complex fix
   - Requires state machine implementation
   - Depends on Bug #2 and #4 being resolved
   - Needs extensive integration testing

### Rationale

- Start with **safest, highest-impact** fix (memory leak)
- Build **architectural foundation** (context centralization)
- Fix **data integrity** issues (buffer compatibility)
- Finally address **timing/coordination** (race condition)

---

## Testing Strategy

### Unit Tests

**Bug #3 - Memory Leak**:

```typescript
describe('AudioBufferSourceNode cleanup', () => {
  it('should remove sources from map after playback ends', async () => {
    const processor = new RegionProcessor(eventBus);

    // Schedule a note
    processor.scheduleHarmonyNote({ note: 'C4', time: 0.1 });

    // Wait for playback to complete
    await sleep(200);

    // Map should be empty
    expect(processor.scheduledAudioSources.size).toBe(0);
  });

  it('should clear all sources on stop', () => {
    const processor = new RegionProcessor(eventBus);

    // Schedule multiple notes
    processor.scheduleHarmonyNote({ note: 'C4', time: 0.1 });
    processor.scheduleHarmonyNote({ note: 'E4', time: 0.2 });

    processor.stop();

    expect(processor.scheduledAudioSources.size).toBe(0);
  });
});
```

**Bug #4 - Context Centralization**:

```typescript
describe('AudioContext state management', () => {
  it('should emit event on context creation', () => {
    const listener = jest.fn();
    eventBus.on('audio:context-created', listener);

    AudioContextManager.getOrCreateContext();

    expect(listener).toHaveBeenCalledWith({ contextId: expect.any(String) });
  });

  it('should emit event on state change', () => {
    const listener = jest.fn();
    eventBus.on('audio:context-state-changed', listener);

    const context = AudioContextManager.getOrCreateContext();
    context.resume();

    expect(listener).toHaveBeenCalledWith({ state: 'running' });
  });
});
```

**Bug #2 - Buffer Compatibility**:

```typescript
describe('Buffer context validation', () => {
  it('should invalidate buffers from different context', () => {
    const cache = GlobalSampleCache.getInstance();
    const oldContext = new AudioContext();

    // Cache buffer with old context
    cache.setCurrentContext(oldContext);
    cache.cacheBuffer('test', audioBuffer);

    // Create new context
    const newContext = new AudioContext();
    cache.setCurrentContext(newContext);

    // Should return null (incompatible)
    expect(cache.getCachedBuffer('test')).toBeNull();
  });
});
```

### Integration Tests

**Bug #1 - Race Condition**:

```typescript
describe('Initialization sequence', () => {
  it('should handle scroll before click', async () => {
    // Simulate scroll
    fireEvent.scroll(window);
    await waitFor(() => expect(preloader.isPreloading).toBe(true));

    // Then click
    fireEvent.click(playButton);

    // Should initialize only once
    expect(CoreServices.getInstance()).toBeDefined();
    expect(bufferLoadCount).toBe(1); // Not 2
  });

  it('should handle click before scroll', async () => {
    // Simulate click
    fireEvent.click(playButton);
    await waitFor(() => expect(coreServices.isInitialized).toBe(true));

    // Then scroll
    fireEvent.scroll(window);

    // Should not re-initialize
    expect(initializeCallCount).toBe(1);
  });
});
```

### Memory Profiling

```typescript
// Test script for Bug #3
describe('Memory leak test', () => {
  it('should not grow memory during extended playback', async () => {
    const initialHeap = performance.memory.usedJSHeapSize;

    // Play for 10 minutes
    await playExercise({ duration: 600000 });

    const finalHeap = performance.memory.usedJSHeapSize;
    const growth = finalHeap - initialHeap;

    // Should not grow more than 10MB (accounting for normal GC)
    expect(growth).toBeLessThan(10 * 1024 * 1024);
  });
});
```

### Mobile Testing

- **iOS Safari**: Verify context creation requires user gesture
- **Android Chrome**: Test background/foreground transitions
- **Silent Mode**: Verify detection and user notification
- **Memory Constraints**: Test on devices with <2GB RAM

---

## Rollback Plan

Each fix is designed to be independently reversible:

### Bug #3 Rollback

```bash
# Remove onended callbacks
git revert <commit-hash>
# No API changes, safe rollback
```

### Bug #4 Rollback

```bash
# Revert to direct context access
git revert <commit-hash>
# EventBus listeners are additive, no breaking changes
```

### Bug #2 Rollback

```bash
# Revert to OfflineContext decoding
git revert <commit-hash>
# May need to clear cache for users
```

### Bug #1 Rollback

```bash
# Revert to current initialization
git revert <commit-hash>
# State machine changes are internal
```

---

## Success Metrics

### Quantitative

- ✅ **Memory**: No heap growth >10MB after 30 minutes continuous playback
- ✅ **Errors**: Zero "AudioContext incompatible" errors in production logs
- ✅ **Contexts**: Maximum 1 AudioContext instance per page load
- ✅ **Initialization**: 100% success rate on first playback attempt
- ✅ **Performance**: No degradation in audio scheduling latency

### Qualitative

- ✅ **UX**: Audio plays correctly on first click, every time
- ✅ **Stability**: No crashes during extended practice sessions
- ✅ **Mobile**: Smooth experience on iOS Safari and Android Chrome
- ✅ **Developer**: Clear error messages, easy debugging

---

## File Reference Summary

### Bug #1: Race Condition

- [apps/frontend/src/domains/playback/hooks/useCoreServices.ts](apps/frontend/src/domains/playback/hooks/useCoreServices.ts) (lines 519-536)
- [apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts](apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts) (lines 85-98)
- [apps/frontend/src/domains/playback/components/ScrollTriggerLoader.tsx](apps/frontend/src/domains/playback/components/ScrollTriggerLoader.tsx) (lines 24-55)

### Bug #2: Buffer Incompatibility

- [apps/frontend/src/domains/playback/modules/storage/cache/GlobalSampleCache.ts](apps/frontend/src/domains/playback/modules/storage/cache/GlobalSampleCache.ts) (entire file)
- [apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts](apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts) (Phase 2 methods)
- [apps/frontend/src/domains/playback/services/core/CoreServices.ts](apps/frontend/src/domains/playback/services/core/CoreServices.ts) (lines 196-302)

### Bug #3: Memory Leak

- [apps/frontend/src/domains/playback/services/core/RegionProcessor.ts](apps/frontend/src/domains/playback/services/core/RegionProcessor.ts) (lines 149-152)
- [apps/frontend/src/domains/playback/services/core/region-processing/scheduling/HarmonyScheduler.ts](apps/frontend/src/domains/playback/services/core/region-processing/scheduling/HarmonyScheduler.ts)
- [apps/frontend/src/domains/playback/services/core/region-processing/scheduling/BassScheduler.ts](apps/frontend/src/domains/playback/services/core/region-processing/scheduling/BassScheduler.ts)
- [apps/frontend/src/domains/playback/services/core/region-processing/scheduling/DrumScheduler.ts](apps/frontend/src/domains/playback/services/core/region-processing/scheduling/DrumScheduler.ts)
- [apps/frontend/src/domains/playback/services/core/region-processing/scheduling/MetronomeScheduler.ts](apps/frontend/src/domains/playback/services/core/region-processing/scheduling/MetronomeScheduler.ts)
- [apps/frontend/src/domains/playback/services/core/region-processing/scheduling/VoiceCueScheduler.ts](apps/frontend/src/domains/playback/services/core/region-processing/scheduling/VoiceCueScheduler.ts)

### Bug #4: Context State Management

- [apps/frontend/src/domains/playback/modules/audio-engine/core/AudioContextManager.ts](apps/frontend/src/domains/playback/modules/audio-engine/core/AudioContextManager.ts)
- [apps/frontend/src/domains/playback/utils/contextManager.ts](apps/frontend/src/domains/playback/utils/contextManager.ts)
- [apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts](apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts)
- [apps/frontend/src/domains/playback/hooks/useAudio.ts](apps/frontend/src/domains/playback/hooks/useAudio.ts)
- Various widget components

---

## Next Steps

1. Review this document with the team
2. Choose first bug to tackle (recommended: Bug #3)
3. Create implementation story/ticket
4. Write tests first (TDD approach)
5. Implement fix
6. Verify with memory profiling
7. Deploy and monitor
8. Proceed to next bug

---

**Document Version**: 1.0
**Last Updated**: 2025-01-22
**Author**: Architecture Analysis (Claude Code)
