# Instrument Switching - Quick Reference Guide

## File Locations (Key Files)

```
Core Switching Logic:
  apps/frontend/src/domains/playback/services/core/scheduling/HarmonySchedulerV2.ts (739 lines)
  apps/frontend/src/domains/playback/services/core/scheduling/VelocityLayerSelector.ts
  apps/frontend/src/domains/playback/services/core/scheduling/GrandPianoMapper.ts

Sample Cache:
  apps/frontend/src/domains/playback/modules/storage/cache/GlobalSampleCache.ts (400+ lines)
  apps/frontend/src/domains/playback/modules/storage/cache/SampleCache.ts
  apps/frontend/src/domains/playback/modules/storage/providers/LocalProvider.ts

Instrument Samplers:
  apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/GrandPianoVelocitySampler.ts
  apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/WurlitzerVelocitySampler.ts
  apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/RhodesVelocitySampler.ts

Preloading:
  apps/frontend/src/domains/playback/modules/preloading/strategies/HarmonyPreloadStrategy.ts
  apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts

Lifecycle:
  apps/frontend/src/domains/playback/modules/lifecycle/InstrumentLifecycleManager.ts (600+ lines)

Tests:
  apps/frontend/src/domains/playback/services/core/scheduling/__tests__/InstrumentSwitching.test.ts
  apps/frontend/src/domains/playback/services/core/scheduling/__tests__/InstrumentSwitching.integration.test.ts

Data:
  apps/frontend/src/domains/playback/data/instruments/piano/grand-piano.json
  apps/frontend/src/domains/playback/data/instruments/piano/grandpiano-keyboard-map.json
  apps/frontend/src/domains/playback/data/instruments/wurlitzer/wurlitzer-piano.json
```

## Bug Flow Diagram

```
User switches exercise (GrandPiano → Wurlitzer)
         ↓
PlaybackEngine.setExercise() detects new instrument
         ↓
HarmonySchedulerV2.setBuffers(newSamples, 'wurlitzer') called
         ↓
Detect instrument change at line 193-197
         ↓
IF isInstrumentChanging THEN
  stopAll(false)  [LINE 205] ← BUG INVESTIGATION POINT
         ↓
Update currentHarmonyInstrument = 'wurlitzer'
Update VelocityLayerSelector layers (7 → 5)
Load new Wurlitzer samples into harmonyBuffers
Setup EQ (or disable if not Grand Piano)
         ↓
Schedule new Wurlitzer notes
         ↓
BUG: Old GrandPiano samples still heard?
     Possible causes:
     1. Cache key collision (no instrument prefix)
     2. Tone.js sampler not disposed
     3. Audio sources not fully cleared
     4. EQ still connected to old destination
```

## Instrument Characteristics

| Property | Grand Piano | Wurlitzer | Rhodes |
|----------|-------------|-----------|--------|
| Velocity Layers | 7 (v1-v7) | 5 (v1-v5) | 4 (v1-v4) |
| Sampling | Sparse (25 notes) | Full chromatic | Full chromatic |
| Notes/Octave | 4 (A,C,D#,F#) | 12 (all notes) | 12 (all notes) |
| Pitch-Shift | Yes (±1 semitone) | No | No |
| Octave Shift | 0 | -12 semitones | -12 semitones |
| EQ | Yes (3-band) | No | No |
| Effects | Sustain (CC64) | Tremolo LFO | Sustain (CC64) |
| Cache Key | `grandpiano-{layer}-{note}` | `wurlitzer-{layer}-{note}` | `rhodes-{layer}-{note}` |

## Critical Line Numbers in HarmonySchedulerV2.ts

```
Line 193-197:  Instrument change detection
Line 200-205:  stopAll(false) call ← PRIMARY BUG POINT
Line 209:      Update harmonyBuffers
Line 211:      Update currentHarmonyInstrument
Line 218:      Configure velocity selector
Line 224:      Load Grand Piano keyboard map
Line 246-288:  Setup EQ for Grand Piano
Line 531:      Track active sources in onended
Line 586-700:  stopAll() implementation ← SECONDARY BUG POINT
Line 703-704:  Clear maps in stopAll()
```

## stopAll() Method Behavior

**What it does:**
- Logs all scheduled sources (map snapshot)
- Applies 50ms fadeout to all active sources
- Calls stop() on each audio source
- Disconnects audio sources
- Clears scheduledAudioSources map (line 703)
- Clears activeHarmonySources map (line 704)

**What it DOESN'T do:**
- Clear GlobalSampleCache
- Dispose Tone.js Sampler instances
- Dispose EQ nodes
- Update velocity layer selector

**Error Detection:**
- Warns if scheduledAudioSources is empty but activeHarmonySources has content
- Indicates possible instance mismatch

## Console Debugging

```javascript
// Check current instrument
window.__diagnosticData?.currentHarmonyInstrument

// Check source counts
console.log('Scheduled sources:', harmonyScheduler.scheduledAudioSources.size);
console.log('Active sources:', harmonyScheduler.activeHarmonySources.size);

// Check cache for old samples
const cache = GlobalSampleCache.getInstance();
const stats = cache.getCacheStats();
console.log('Cache stats:', stats);

// Check specific cache key
const grandPianoC4 = cache.get('grandpiano-v4-C4');
console.log('GrandPiano C4 in cache?', !!grandPianoC4);

// Check velocity selector
console.log('Current velocity selector state:', velocitySelector.currentInstrument);
```

## Debugging Checklist

When Grand Piano samples persist in Wurlitzer:

1. **Confirm stopAll() is called:**
   - Add console.log at HarmonySchedulerV2.ts line 205
   - Verify it executes when switching instruments

2. **Check audio source counts:**
   - Before switch: how many sources?
   - After stopAll(): are they all 0?

3. **Verify cache separation:**
   - Look for cache keys in console
   - Do they include instrument name?
   - Pattern: `{instrument}-{layer}-{note}`

4. **Inspect Tone.js samplers:**
   - Are old samplers still connected?
   - Check source node connections
   - Look for multiple samplers on destination

5. **Trace EQ setup:**
   - Verify previous EQ disposed (line 260-262)
   - Confirm new EQ created only for Grand Piano
   - Check if old EQ still in audio graph

6. **Review velocity layer change:**
   - Before: 7 layers (Grand Piano)
   - After: 5 layers (Wurlitzer)
   - Are ranges actually updated?

## Testing Commands

```bash
# Unit tests for instrument switching
pnpm vitest run apps/frontend/src/domains/playback/services/core/scheduling/__tests__/InstrumentSwitching.test.ts

# Integration tests
pnpm vitest run apps/frontend/src/domains/playback/services/core/scheduling/__tests__/InstrumentSwitching.integration.test.ts

# Cache tests
pnpm vitest run apps/frontend/src/domains/playback/modules/storage/cache/__tests__

# Full playback domain tests
pnpm test:frontend:playback
```

## Key Methods to Trace

```
HarmonySchedulerV2.setBuffers()
  Line 188-243
  Add logging to see:
    - Old vs new instrument
    - stopAll() result
    - Maps after clearing

HarmonySchedulerV2.stopAll()
  Line 586-700
  Add logging to see:
    - Each source being stopped
    - Map sizes before/after
    - Errors during stop

VelocityLayerSelector.setInstrument()
  Add logging to see:
    - Layer count change (7 → 5)
    - Velocity range updates

GlobalSampleCache.get()
  Add logging to see:
    - Cache key requested
    - Cache hit/miss
    - What buffer returned

GrandPianoVelocitySampler.dispose()
  Add logging to see:
    - Sampler disposal completion
    - Tone.js cleanup status
```

## Velocity Layer Ranges

**Grand Piano (7 layers):**
```
v1: 0-18     v2: 19-36    v3: 37-54
v4: 55-72    v5: 73-90    v6: 91-108
v7: 109-127
```

**Wurlitzer (5 layers):**
```
v1: 0-25     v2: 26-51    v3: 52-76
v4: 77-102   v5: 103-127
```

**Rhodes (4 layers):**
```
v1: 0-31     v2: 32-63    v3: 64-95
v4: 96-127
```

## Common Issues & Solutions

| Issue | Cause | Location | Fix |
|-------|-------|----------|-----|
| Audio doubling on switch | Old sources not stopped | Line 200-205 | Verify stopAll() called |
| Wrong samples playing | Cache key not namespaced | GlobalSampleCache | Add instrument prefix |
| Clicks/pops on switch | No fadeout | Line 640-649 | Implement 50ms fadeout |
| Sustain pedal broken | CC64 timeline not set | Line 298+ | Call setCurrentCC64Timeline() |
| EQ on wrong instrument | Previous EQ not disposed | Line 260-262 | Dispose before creating new |

## Performance Metrics

| Operation | Impact | Time |
|-----------|--------|------|
| stopAll(false) | Stop all sources + 50ms fadeout | ~50ms |
| Load new samples | Copy Map references | <1ms |
| Setup EQ | Create ParametricEQ | ~5ms |
| Update velocity selector | Change layer config | <1ms |
| **Total Switching** | Full instrument change | ~60ms |

## Related Patterns

- **Sustain Pedal:** CC64 timeline set in setCurrentCC64Timeline()
- **Sparse Sampling:** GrandPianoMapper converts 88 keys to 25 samples
- **Polyphony:** activeHarmonySources tracks multi-note playing
- **Ring-out:** FadeoutManager handles exercise end fadeout
- **EQ:** ParametricEQ creates insertion point between gain and destination

