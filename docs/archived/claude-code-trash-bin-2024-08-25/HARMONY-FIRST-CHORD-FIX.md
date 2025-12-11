# Harmony Widget Audio Source Gap Fix

## Issue

The HarmonyWidget was not playing chords properly even though it reported as "loaded" after ~2.3 seconds. The widget would skip or fail to play chords when playback started.

## Root Cause

The issue was a race condition during the progressive loading phases:

1. Phase 1 loads basic sampler → sets `isReady = true`
2. Widget can now respond to play commands with basic sampler
3. Phase 2 loads velocity layers (v10) and **disposes the basic sampler**
4. During this transition, `samplerRef.current` becomes null
5. If playback starts during this gap, there's no audio source available!

The code was checking `processorRef.current || samplerRef.current` but during the transition, both could be unavailable.

## Solution

Set the new processor BEFORE disconnecting the old sampler to ensure continuous audio availability:

```typescript
// BEFORE (causes gap):
samplerRef.current.disconnect();
samplerRef.current.dispose();
samplerRef.current = null;
processorRef.current = layerSampler;

// AFTER (no gap):
processorRef.current = layerSampler;
layerSampler.toDestination();
// NOW safe to dispose old sampler
samplerRef.current.disconnect();
samplerRef.current.dispose();
```

## Technical Details

- Ensures there's always an active audio source during progressive loading
- Phase 1 sampler remains active until Phase 2 processor is fully ready
- No interruption in playback capability during the transition
- Widget remains responsive throughout all loading phases

## Testing

1. Start playback immediately after page load
2. Verify harmony plays correctly even during phase transitions
3. Monitor console logs to confirm smooth processor handoff
4. Test rapid play/stop cycles during loading phases
