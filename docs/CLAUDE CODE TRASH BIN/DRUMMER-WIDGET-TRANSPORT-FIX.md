# DrummerWidget Transport Sync Fix

## Problems Fixed

### 1. DrummerWidget Not Syncing with Global Transport
**Issue**: The DrummerWidget was starting/stopping its own Tone.Transport instance instead of using the global transport controlled by TransportController.

**Root Cause**: Lines 341-342 and 346-347 in DrummerWidget were calling `Tone.Transport.start()` and `Tone.Transport.stop()` directly.

**Solution**: 
- Removed Transport start/stop calls from DrummerWidget
- Widget now only schedules/clears events on the already-running global Transport
- Changed logging to reflect that it's scheduling on the global Transport

### 2. Buffer Size Reporting as Undefined
**Issue**: The SalamanderVelocitySampler was logging "undefined buffers loaded" because `sampler._buffers.size` wasn't accessible correctly.

**Root Cause**: The internal `_buffers` property structure varies - sometimes it's a Map with `.size`, sometimes it's an object.

**Solution**:
- Added robust buffer count detection: `buffers.size || Object.keys(buffers).length`
- Applied this fix to all places where buffer count is checked
- Now correctly reports actual buffer count

## Files Modified

### 1. `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget.tsx`
- Lines 340-350: Removed Transport control, kept only event scheduling

### 2. `/apps/frontend/src/domains/playback/services/plugins/SalamanderVelocitySampler.ts`
- Lines 221-225: Fixed buffer count reporting in ensureReady()
- Lines 551-552: Fixed buffer count in loadLayer()
- Lines 794-795: Fixed buffer size check in triggerAttackRelease()
- Line 813: Fixed buffer size comparison

## How It Works Now

1. **Global Transport Control**: 
   - TransportController manages the single Tone.Transport instance
   - All widgets schedule their events on this shared Transport
   - No widget can start/stop the Transport independently

2. **DrummerWidget Behavior**:
   - When `isPlaying` becomes true: Schedules drum pattern events
   - When `isPlaying` becomes false: Clears its scheduled events
   - Never touches Transport start/stop state

3. **Buffer Management**:
   - Correctly detects and reports buffer count
   - Handles both Map and Object buffer structures
   - Provides accurate feedback about loading state

## Testing
1. Start the transport from the main control
2. Verify DrummerWidget plays in sync with other widgets
3. Stop the transport and verify DrummerWidget stops
4. Check console logs for proper buffer count reporting (not "undefined")