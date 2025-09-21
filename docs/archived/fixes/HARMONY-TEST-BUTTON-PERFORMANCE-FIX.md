# Harmony TEST Button Performance Fix

## Problem
The harmony widget TEST button was taking around 9 seconds to respond, with multiple instances of WamKeyboard and SalamanderVelocitySampler being created, each loading 150 samples despite samples supposedly being cached.

## Root Causes Identified
1. **Multiple WamKeyboard instances** - No singleton pattern, creating new instances on each TEST click
2. **Tone.setContext() calls** - Invalidating all cached buffers by switching contexts
3. **Re-initialization of AudioEngine** - ensureAudioContextLightweight was re-initializing the entire audio system
4. **Duplicate CoreServices initialization** - AudioProvider's handleAudioInitialized was calling services.initialize() without checking if already initialized

## Fixes Applied

### 1. WAM Plugin Singleton Manager
Created `/apps/frontend/src/domains/widgets/utils/wamPluginSingleton.ts`:
- Ensures only one WamKeyboard instance exists globally
- Uses GlobalSampleCache for persistence across re-initializations
- Manages reference counting for proper cleanup

### 2. Removed Tone.setContext() Calls
Modified `/apps/frontend/src/domains/playback/services/plugins/SalamanderVelocitySampler.ts`:
- Removed ALL Tone.setContext() calls that were invalidating cached buffers
- Let Tone.js manage its own context instead of forcing context switches

### 3. Updated HarmonyWidgetV2
Modified `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidgetV2.tsx`:
- Uses wamPluginSingleton instead of creating new instances
- Improved testChord function to check singleton first
- Better cleanup on unmount

### 4. Fixed ensureAudioContextLightweight
Modified `/apps/frontend/src/domains/playback/utils/ensureAudioContext.ts`:
- Added check to skip initialization if audio is already ready
- Prevents re-initialization when TEST button is clicked
- Added detailed logging for debugging

### 5. Added Guards to Prevent Duplicate Initialization
Modified multiple files:
- `AudioProvider.tsx`: Added check in handleAudioInitialized to skip if already initialized
- `CoreServices.ts`: Added logging and checks to prevent duplicate initialization
- `GlobalAudioSystem`: Added final check before creating new instances

## Result
The TEST button should now respond instantly if samples are already loaded, as it:
1. Reuses the existing WamKeyboard plugin instance
2. Doesn't invalidate cached buffers
3. Doesn't re-initialize the audio system
4. Properly uses the singleton pattern across the application

## Testing
Click the TEST button on the harmony widget and verify:
1. No new AudioEngine instances are created (no "AudioEngine[random-id]" logs)
2. No new sample loading occurs (no "Loading sample X of 150" logs)
3. Response is immediate (< 1 second)
4. Audio plays correctly