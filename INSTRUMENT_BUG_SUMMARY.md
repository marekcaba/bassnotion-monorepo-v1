# Instrument Switching Bug - Summary & Investigation Guide

## Problem Statement

When switching from Grand Piano to Wurlitzer exercise, Grand Piano samples continue playing alongside Wurlitzer samples, creating a "two pianos" effect.

## Root Cause Hypothesis

The bug likely occurs in one of these areas:

### 1. Source Stopping (HIGH PRIORITY)
**File:** `apps/frontend/src/domains/playback/services/core/scheduling/HarmonySchedulerV2.ts`
**Lines:** 200-205, 586-700

The `setBuffers()` method calls `stopAll(false)` when instrument changes, but:
- May not stop all sources
- May not clear all tracking maps
- May have instance mismatch (wrong scheduler instance)

**Check:**
```javascript
// In browser console during instrument switch
console.log('Scheduled sources:', harmonyScheduler.scheduledAudioSources.size);
console.log('Active sources:', harmonyScheduler.activeHarmonySources.size);
// Both should be 0 after switching
```

### 2. Cache Contamination (HIGH PRIORITY)
**File:** `apps/frontend/src/domains/playback/modules/storage/cache/GlobalSampleCache.ts`

Wurlitzer may be receiving Grand Piano samples from cache if:
- Cache keys not namespaced by instrument
- Pattern should be: `grandpiano-v4-C4` not just `v4-C4`

**Check:**
```javascript
const cache = GlobalSampleCache.getInstance();
const grandPianoC4 = cache.get('grandpiano-v4-C4');
const wurlitzerC4 = cache.get('wurlitzer-v3-C4');
console.log('GrandPiano C4:', !!grandPianoC4);
console.log('Wurlitzer C4:', !!wurlitzerC4);
// Should be different buffers
```

### 3. Tone.js Sampler Disposal (MEDIUM PRIORITY)
**Files:** 
- `GrandPianoVelocitySampler.ts`
- `WurlitzerVelocitySampler.ts`

Old Tone.js Sampler instances may not be disposed when switching:
- Multiple samplers on same destination
- Old sampler still playing despite source stop
- Tone.js context not properly cleaned

**Check:**
```javascript
// Look for multiple audio nodes connected to destination
// Count source nodes in audio graph
// Check if old sampler still has active voices
```

### 4. EQ Node Persistence (MEDIUM PRIORITY)
**File:** `HarmonySchedulerV2.ts`
**Lines:** 246-288 (setupEQ method)

Grand Piano's EQ node may still be connected:
- Previous EQ not disposed before new one created
- Old EQ still in audio graph
- Only Grand Piano should have EQ

**Check:**
```javascript
// After switching to Wurlitzer:
console.log('Has EQ for Wurlitzer?', harmonyScheduler.grandPianoEQ !== null);
// Should be null/falsy
```

## Investigation Steps (In Order)

### Step 1: Verify stopAll() Execution
Add to HarmonySchedulerV2.ts line 205:
```typescript
console.log('[BUG-DEBUG] About to call stopAll(false) during instrument switch');
console.log('[BUG-DEBUG] Maps before stopAll:', {
  scheduled: this.scheduledAudioSources.size,
  active: this.activeHarmonySources.size
});
```

Add at start of stopAll() line 587:
```typescript
console.log('[BUG-DEBUG] stopAll() CALLED with graceful=', graceful);
console.log('[BUG-DEBUG] Maps entering stopAll:', {
  scheduled: this.scheduledAudioSources.size,
  active: this.activeHarmonySources.size
});
```

Add at end of stopAll() after line 704:
```typescript
console.log('[BUG-DEBUG] stopAll() COMPLETED. Maps after:', {
  scheduled: this.scheduledAudioSources.size,  // Should be 0
  active: this.activeHarmonySources.size       // Should be 0
});
```

### Step 2: Check Cache Separation
In browser console during bug reproduction:
```javascript
const cache = GlobalSampleCache.getInstance();
// Try to get a sample with instrument prefix
const gp = cache.get('grandpiano-v4-C4');
const wl = cache.get('wurlitzer-v3-C4');
console.log('Different buffers?', gp !== wl);

// Check all cache keys
const stats = cache.getCacheStats();
console.log('Total cached samples:', stats.samplesCount);
// Look for both instruments in logs
```

### Step 3: Monitor Audio Node Graph
```javascript
// Count active audio nodes
const gainNodes = document.querySelectorAll('audio-worklet-node');
console.log('Active audio nodes:', gainNodes.length);

// Check source nodes
const sourceNodes = audioContext.getChannelCount?.();
console.log('Audio context active sources');
```

### Step 4: Trace Sampler Instances
Add diagnostics to both samplers:
```typescript
// In GrandPianoVelocitySampler constructor:
this._instanceId = `GP${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
console.log('[GP-SAMPLER] Instance created:', this._instanceId);

// In dispose():
console.log('[GP-SAMPLER] Disposing instance:', this._instanceId);
```

Similar for WurlitzerVelocitySampler:
```typescript
this._instanceId = `WL${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
console.log('[WL-SAMPLER] Instance created:', this._instanceId);
```

## Test Case for Reproduction

1. Start tutorial with Grand Piano exercise
2. Play a few notes (should hear Grand Piano)
3. Switch to Wurlitzer exercise
4. Expected: Only Wurlitzer sound
5. Actual: Grand Piano + Wurlitzer (BUG)

## Files to Review (Priority Order)

```
PRIORITY 1 (Highest - Most Likely Bug):
├── HarmonySchedulerV2.ts (line 200-205: stopAll call)
├── HarmonySchedulerV2.ts (line 586-700: stopAll implementation)
└── GlobalSampleCache.ts (cache key generation)

PRIORITY 2 (High - Probable):
├── GrandPianoVelocitySampler.ts (Tone.js disposal)
├── WurlitzerVelocitySampler.ts (Tone.js disposal)
└── HarmonySchedulerV2.ts (line 246-288: EQ setup)

PRIORITY 3 (Medium - Background):
├── VelocityLayerSelector.ts (layer switching)
├── GrandPianoMapper.ts (sparse sampling)
└── InstrumentLifecycleManager.ts (resource cleanup)
```

## Key Diagnostic Outputs to Watch For

When switching from Grand Piano to Wurlitzer, you should see:

```
[HARMONY-SCHEDULER-V2] 🔄 Instrument changed
  oldInstrument: grandpiano
  newInstrument: wurlitzer
  scheduledCount: 5  (number of active notes)
  activeCount: 2     (number of active voices)
  willStopSources: true

[🛑 HARMONY-SCHEDULER-V2 STOP CALLED 🛑]
  scheduledCount: 5
  activeCount: 2
  graceful: false

[HARMONY-SCHEDULER-V2 STOP] Sources stopped
  stoppedCount: 5    (should equal scheduledCount)
  fadedCount: 2      (should equal activeCount)
  errorCount: 0      (should be 0)
```

If you see different numbers or `errorCount > 0`, that's a clue!

## Supporting Test Files

Review these to understand expected behavior:
- `InstrumentSwitching.test.ts` - Unit tests for switching logic
- `InstrumentSwitching.integration.test.ts` - Full flow tests

Run with:
```bash
pnpm vitest run apps/frontend/src/domains/playback/services/core/scheduling/__tests__/InstrumentSwitching.test.ts
pnpm vitest run apps/frontend/src/domains/playback/services/core/scheduling/__tests__/InstrumentSwitching.integration.test.ts
```

## Hypothesis Testing Matrix

| Hypothesis | Evidence | Location | Likelihood |
|-----------|----------|----------|------------|
| stopAll() not called | Missing console logs | Line 205 | MEDIUM |
| stopAll() incomplete | Maps not cleared | Line 703-704 | HIGH |
| Cache contamination | Wrong cache key | GlobalSampleCache | MEDIUM |
| Multiple instances | Multiple stopAll() calls | Instance ID tracking | LOW |
| Tone.js not disposed | Audio nodes in graph | Sampler.dispose() | HIGH |
| EQ not disposed | Old EQ in graph | Line 260-262 | MEDIUM |
| Wrong scheduler | Multiple schedulers active | Window registry | LOW |

## Related Comments in Code

**HarmonyPreloadStrategy.ts lines 38-46:**
```
CRITICAL FIX: DO NOT connect to destination during preloading!
Connection happens when exercise is actually played (in HarmonyWidget)
Connecting here causes double instrument playback when switching exercises
because multiple instruments get loaded and connected during preload phase
```

This suggests multiple instruments may be loaded and connected simultaneously!

## Next Actions

1. Add the diagnostic logging above to HarmonySchedulerV2.ts
2. Reproduce the bug with console open
3. Check stopAll() is being called and maps are cleared
4. Check cache keys include instrument name
5. Check Tone.js samplers are disposed
6. Check EQ nodes are not persisting
7. Run existing tests to ensure they pass
8. If tests pass but bug exists, create new test case that fails

