# BackgroundSampleLoader Pre-Initialization Fix

## The Issue

When clicking "Start Background Loading" before clicking Play:

- AudioEngine is only pre-initialized (Tone.js loaded, no AudioContext)
- BackgroundSampleLoader tries to call `audioEngine.getTone()` which throws an error
- This error appears in the console even though the loader gracefully falls back to URL preloading

## The Solution

1. **Added helper methods to BackgroundSampleLoader:**
   - `canPreloadUrls()`: Always returns true - URLs can be preloaded anytime
   - `isToneReady()`: Checks if AudioEngine is fully initialized

2. **Updated error handling:**
   - Removed the `console.error()` for expected pre-initialization state
   - The loader still catches the error and falls back to URL preloading
   - This is the intended behavior - preload URLs first, create audio objects later

3. **How it works now:**
   - **Before Play button**: BackgroundSampleLoader preloads URLs only (useful for caching)
   - **After Play button**: AudioEngine is fully initialized, loader can create Tone.js objects

## Testing

1. Load the page
2. Click "Start Background Loading" immediately
3. Should see "⏳ Tone.js not ready yet, preloading URLs only" (not an error)
4. URLs are preloaded in the background
5. Click Play button
6. Click "Start Background Loading" again
7. Now full sample loading works with Tone.js objects

## Benefits

- No scary error messages in console
- URLs are cached even before audio initialization
- Smooth transition from URL preloading to full sample loading
- Better user experience
