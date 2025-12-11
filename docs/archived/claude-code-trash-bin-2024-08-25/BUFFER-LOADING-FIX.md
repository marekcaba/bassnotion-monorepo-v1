# Buffer Loading Fix for Widget Audio Playback

## Problem

The widgets (particularly HarmonyWidget using ChordInstrumentProcessor) were throwing "buffer is either not set or not loaded" errors when trying to play audio synchronized with the global transport.

## Root Cause

1. **Lazy Loading Issue**: The SalamanderVelocitySampler loads velocity layers on-demand when notes are played
2. **Connection Issue**: Newly loaded samplers weren't being connected to the audio destination
3. **Timing Issue**: The samplers were being used before their buffers were fully loaded
4. **Tone.js Async Loading**: Tone.Sampler's `loaded` promise can resolve before buffers are actually ready

## Solution Applied

### 1. Global Tone.loaded() Wait (SalamanderVelocitySampler.ts:319-326, 531-533)

- Added `await Tone.loaded()` after creating samplers
- This ensures ALL Tone.js buffers are loaded globally
- Applied both during initialization and when loading new layers dynamically

### 2. Enhanced Buffer Checking (SalamanderVelocitySampler.ts:681-727, 774-799)

- Added thorough pre-flight checks before playing
- Verify buffers exist and have size > 0
- Check for specific note availability or pitch-shift capability
- Throw early if buffers aren't ready to trigger fallback logic

### 3. Auto-Connect on Load (SalamanderVelocitySampler.ts:553-565)

- Connect samplers to destination immediately when loaded
- Previously, samplers were only connected during the initial `connect()` call
- Now dynamically loaded samplers are automatically connected

### 4. Connect Before Play (SalamanderVelocitySampler.ts:768-772)

- Added safety check to ensure sampler is connected before playing
- If destination exists but sampler isn't connected, connect it just-in-time

## Files Modified

- `/apps/frontend/src/domains/playback/services/plugins/SalamanderVelocitySampler.ts`

## Testing

After applying these fixes:

1. Restart the frontend: `pm2 restart bassnotion-frontend`
2. Navigate to a page with widgets
3. Start playback with the global transport
4. Verify no buffer errors appear in the console
5. Confirm audio plays correctly from all widgets

## Additional Notes

- The DrummerWidget uses `Tone.Player` which has simpler loading semantics
- The fix focuses on the more complex `Tone.Sampler` used by the harmony instruments
- This fix ensures samplers are properly initialized and connected before playback
