# Harmony Three-Phase Loading Fix

## The Architecture

The system has two separate sample loading mechanisms:

1. **InitialSamplePreloader** - Used by ScrollTriggerLoader and ExerciseSelector
   - Phase 2: Loads 30 essential harmony samples (v10 layer) on user scroll
   - Phase 3: Loads 120 additional samples (v1, v6, v14, v16 layers) when ExerciseSelector visible
   - Downloads samples but does NOT cache decoded AudioBuffers (incompatible contexts)

2. **SalamanderVelocitySampler** - Used by WamKeyboard plugin
   - Loads 150 samples (5 layers × 30 notes) when TEST button clicked
   - Uses Tone.Sampler which makes its own HTTP requests

## The Problem

When TEST button is clicked, SalamanderVelocitySampler loads samples that were ALREADY downloaded by InitialSamplePreloader. This happens because:

1. InitialSamplePreloader fetches samples but doesn't cache the decoded buffers
2. CachedToneBufferLoader checks for cached buffers (which don't exist)
3. Tone.Sampler falls back to loading from network

## The Solution

The browser's HTTP cache should handle this automatically:

1. **Phase 1**: Page loads - no samples
2. **Phase 2**: User scrolls - InitialSamplePreloader fetches 30 samples
   - Browser caches these HTTP responses
3. **Phase 3**: ExerciseSelector visible - InitialSamplePreloader fetches 120 more samples
   - Browser caches these HTTP responses
4. **TEST clicked**: Tone.Sampler requests same URLs
   - Browser serves from HTTP cache instantly (no network request)

## Why It's Still Loading

The samples are likely being re-downloaded because:

1. **Different URLs**: InitialSamplePreloader and SalamanderVelocitySampler might use slightly different URLs
2. **Cache Headers**: Supabase might not be setting proper Cache-Control headers
3. **CORS**: Cross-origin requests might bypass cache

## Recommendations

1. **Verify URLs match exactly** between InitialSamplePreloader and SalamanderVelocitySampler
2. **Check browser Network tab** to see if samples are served from cache
3. **Consider service worker** to force cache all sample requests
4. **Use single loading system** - either InitialSamplePreloader OR SalamanderVelocitySampler, not both

## Current Status

- ✅ Three-phase loading re-enabled
- ✅ WAM plugin singleton prevents duplicate instances
- ✅ No Tone.setContext() calls to prevent buffer invalidation
- ❌ Samples still loading twice (browser cache not being used)

The TEST button will respond faster once the browser properly caches the samples from phases 2 & 3.
