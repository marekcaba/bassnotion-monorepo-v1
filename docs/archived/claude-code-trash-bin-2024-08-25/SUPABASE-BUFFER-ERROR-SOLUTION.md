# Supabase Buffer Error Solution

## Problem

The "buffer is either not set or not loaded" errors occur because:

1. Salamander piano samples are loaded from Supabase (390KB per sample)
2. Loading 88 keys × 16 velocity layers = 1,408 samples takes significant time
3. HarmonyWidget schedules playback immediately when Transport starts
4. Samples haven't finished loading from Supabase when playback begins

## Current Behavior

1. Page loads → HarmonyWidget mounts
2. HarmonyWidget creates ChordInstrumentProcessor
3. ChordInstrumentProcessor starts loading samples from Supabase
4. User can click PLAY immediately
5. Transport schedules chord playback
6. Samples aren't loaded yet → buffer errors

## Solution Options

### Option 1: Disable Play Until Ready (Recommended)

```typescript
// In test-transport page
const [audioReady, setAudioReady] = useState(false);

// Disable play button
<button disabled={!audioReady}>▶️ PLAY</button>

// Set ready when samples loaded
```

### Option 2: Preload Common Samples Only

- Load only the most common velocity layers (v8, v10, v12)
- Load only the notes used in the exercise
- This reduces load time from ~30s to ~5s

### Option 3: Use Local Samples

- Ship samples with the app (150MB)
- No network delays
- Instant playback

### Option 4: Progressive Loading

- Start with synthesis
- Load samples in background
- Switch to samples when ready

## Why This Happens with Supabase

1. Each sample is ~390KB
2. Network latency adds 50-200ms per request
3. Browser connection limits (6 concurrent)
4. Total load time: 20-40 seconds for all samples

## Recommendations

1. Show loading progress to user
2. Preload only required samples for exercise
3. Cache loaded samples in IndexedDB
4. Consider CDN with better geographic distribution
