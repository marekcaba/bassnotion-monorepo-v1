# Instrument Loading & Switching - File Location Guide

## Overview

This document maps all files related to instrument loading, switching, and sample management in the BassNotion playback domain.

## Core Instrument Switching & Scheduling

### HarmonySchedulerV2.ts (739 lines) - PRIMARY BUG LOCATION
**Path:** `apps/frontend/src/domains/playback/services/core/scheduling/HarmonySchedulerV2.ts`

**Key Method:** `setBuffers()` at line 188-243
- Detects instrument change (line 193-197)
- Calls `stopAll(false)` to stop previous instrument (line 200-205)
- Updates `currentHarmonyInstrument` state (line 211)
- Configures velocity layer selector (line 218)
- Loads Grand Piano keyboard map if needed (line 224)
- Sets up EQ for Grand Piano (line 246-288)

**Key Method:** `stopAll(graceful)` at line 586-700
- Applies 50ms fadeout for manual stop
- Stops all audio sources and disconnects them
- Clears `scheduledAudioSources` map (line 703)
- Clears `activeHarmonySources` map (line 704)
- **BUG POINT:** Does this clear everything? Check if sources still exist elsewhere

### VelocityLayerSelector.ts
**Path:** `apps/frontend/src/domains/playback/services/core/scheduling/VelocityLayerSelector.ts`

- Grand Piano: 7 velocity layers (v1-v7)
- Wurlitzer: 5 velocity layers (v1-v5)
- Rhodes: 4 velocity layers (v1-v4)
- Method: `setInstrument()` updates layer configuration on switch

### GrandPianoMapper.ts (380 lines)
**Path:** `apps/frontend/src/domains/playback/services/core/scheduling/GrandPianoMapper.ts`

- Maps requested notes to physical samples (25 total for 88 keys)
- Calculates pitch-shift for sparse sampling
- Loads keyboard map from cache or JSON
- Static methods for singleton access

## Sample Cache & Storage

### GlobalSampleCache.ts (400+ lines) - POTENTIAL BUG LOCATION
**Path:** `apps/frontend/src/domains/playback/modules/storage/cache/GlobalSampleCache.ts`

- Central sample cache with memory/IndexedDB layers
- Cache key pattern: `{instrument}-{layer}-{note}`
  - Example: `grandpiano-v4-C4` vs `wurlitzer-v3-C4`
- **CRITICAL:** Cache doesn't auto-clear when switching instruments

### SampleCache.ts
**Path:** `apps/frontend/src/domains/playback/modules/storage/cache/SampleCache.ts`

- Intelligent cache with adaptive eviction
- Tracks hit rates, latency, performance metrics

### LocalProvider.ts
**Path:** `apps/frontend/src/domains/playback/modules/storage/providers/LocalProvider.ts`

- IndexedDB persistent storage for samples
- Survives page reloads

## Instrument Implementations

### GrandPianoVelocitySampler.ts (400+ lines)
**Path:** `apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/GrandPianoVelocitySampler.ts`

- Loads 7 velocity layers
- Sparse sampling (25 samples → 88 keys via pitch-shifting)
- Professional EQ for tone shaping
- Sustain pedal (CC64) support
- Config from: `/data/instruments/piano/grand-piano.json`

### WurlitzerVelocitySampler.ts (500+ lines)
**Path:** `apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/WurlitzerVelocitySampler.ts`

- Loads 5 velocity layers (different ranges than Grand Piano)
- Full chromatic sampling (all 12 notes/octave)
- Tremolo LFO modulation
- Sustain pedal support
- Config from: `/data/instruments/wurlitzer/wurlitzer-piano.json`
- **BUG RISK:** Old Tone.js Sampler instances might not be disposed

### RhodesVelocitySampler.ts
**Path:** `apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/RhodesVelocitySampler.ts`

- 4 velocity layers
- Full chromatic sampling
- Sustain pedal support

## Preloading & Initialization

### HarmonyPreloadStrategy.ts (300+ lines)
**Path:** `apps/frontend/src/domains/playback/modules/preloading/strategies/HarmonyPreloadStrategy.ts`

- Preloads essential harmony samples
- Loads keyboard map for Grand Piano
- CRITICAL NOTE (lines 38-46):
  - "DO NOT connect to destination during preloading"
  - "Connecting here causes double instrument playback when switching"
  - This suggests multiple instrument instances may exist

### InitialSamplePreloader.ts
**Path:** `apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts`

- Coordinates preloading across all strategies
- Populates GlobalSampleCache with metadata

## Lifecycle & Resource Management

### InstrumentLifecycleManager.ts (600+ lines)
**Path:** `apps/frontend/src/domains/playback/modules/lifecycle/InstrumentLifecycleManager.ts`

- Enterprise resource management for instruments
- Memory optimization and cleanup
- Performance analytics

## Tests (Critical for Understanding)

### InstrumentSwitching.test.ts (Unit Tests)
**Path:** `apps/frontend/src/domains/playback/services/core/scheduling/__tests__/InstrumentSwitching.test.ts`

- **Test Suite 1:** Cache Key Separation
  - Verifies unique keys per instrument
  - Ensures no cross-instrument contamination
- **Test Suite 2:** Velocity Layer Separation
  - Different layers per instrument
  - Correct velocity ranges
- **Test Suite 3:** Octave Shift Separation
  - Grand Piano: 0 semitones
  - Wurlitzer/Rhodes: -12 semitones

### InstrumentSwitching.integration.test.ts (Integration Tests)
**Path:** `apps/frontend/src/domains/playback/services/core/scheduling/__tests__/InstrumentSwitching.integration.test.ts` (510 lines)

- Full data flow when switching instruments
- Sample buffer loading and replacement
- Cache key generation and retrieval

## Configuration Files

### grand-piano.json
**Path:** `apps/frontend/src/domains/playback/data/instruments/piano/grand-piano.json`

- 7 velocity layers with ranges
- Sample mapping (note → file paths)
- Storage configuration

### grandpiano-keyboard-map.json
**Path:** `apps/frontend/src/domains/playback/data/instruments/piano/grandpiano-keyboard-map.json`

- Maps 88 keys to 25 physical samples
- Includes playback rates for pitch-shifting

### wurlitzer-piano.json
**Path:** `apps/frontend/src/domains/playback/data/instruments/wurlitzer/wurlitzer-piano.json`

- 5 velocity layers with different ranges
- Full chromatic note mapping

## Support Services

### ParametricEQ.ts
**Path:** `apps/frontend/src/domains/playback/modules/audio-engine/processors/ParametricEQ.ts`

- 3-band parametric EQ for Grand Piano
- Created in HarmonySchedulerV2.setupEQ() at line 246-288
- **BUG RISK:** Previous EQ may not be disposed before creating new one

### InstrumentDependencyManager.ts
**Path:** `apps/frontend/src/domains/playback/services/InstrumentDependencyManager.ts`

- Lazy loads Tone.js independently
- Ensures shared AudioContext

## Bug Investigation Focus Areas

1. **HarmonySchedulerV2.setBuffers()** (line 188-243)
   - Is stopAll(false) actually called?
   - Are ALL maps cleared?

2. **GlobalSampleCache** 
   - Are cache keys namespaced by instrument?
   - Are old samples still returned?

3. **Tone.js Sampler Disposal**
   - Are old sampler instances disconnected?
   - Multiple samplers on same destination?

4. **EQ Setup** (line 246-288)
   - Is previous EQ disposed before new creation?
   - Is old EQ still connected to audio graph?

5. **Active Source Tracking**
   - Are all source nodes in the maps?
   - Are sources properly removed when they end?

## Key Code Pattern: Instrument Switching

```typescript
// When exercise changes instrument:
const samples = await loadInstrumentSamples('wurlitzer');
harmonyScheduler.setBuffers(
  samples,
  destination,
  velocityRanges,
  'wurlitzer'  // Triggers setBuffers() logic
);

// Inside setBuffers():
if (instrument !== this.currentHarmonyInstrument) {
  if (hasActiveSources) {
    this.stopAll(false);  // Stop old instrument sources
  }
}
this.harmonyBuffers = samples;  // Load new samples
this.currentHarmonyInstrument = instrument;
```

## Summary

**Primary locations for bug investigation:**
1. HarmonySchedulerV2.ts (line 200-205: stopAll call)
2. HarmonySchedulerV2.ts (line 586-700: stopAll implementation)
3. GlobalSampleCache.ts (cache key generation)
4. GrandPianoVelocitySampler.ts (sample loading/disposal)
5. WurlitzerVelocitySampler.ts (sample loading/disposal)

