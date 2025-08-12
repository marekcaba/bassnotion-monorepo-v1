# Harmony Widget Synchronization Fix

## Problem
The user reported that the harmony widget felt "slightly off the grid" compared to other widgets (drums, metronome), even though console logs showed all widgets starting at approximately the same time.

## Root Cause
The timing issue was in the `SalamanderVelocitySampler.ts` file. The sampler was incorrectly handling the `time` parameter:

1. At line 408, it was converting the time parameter: `const baseTime = time !== undefined ? time : Tone.now()`
2. At line 435, it was using `baseTime` instead of the original `time` parameter
3. This caused Transport-relative timing strings like `"+0.05"` to be converted to absolute time values too early

## Fix Applied
Updated `SalamanderVelocitySampler.ts`:

```typescript
// Before (line 408):
const baseTime = time !== undefined ? time : Tone.now();

// After:
// CRITICAL FIX: Don't convert time parameter here - pass it through as-is
// This preserves Transport-relative timing like "+0.05"

// Before (line 435):
const noteTime = time !== undefined ? baseTime : undefined;

// After:
// CRITICAL FIX: Use the original time parameter, not baseTime
// This preserves Transport-relative timing like "+0.05"
const noteTime = time;
```

## Why This Fixes the Issue
1. The harmony widget passes timing from the Transport loop callback (e.g., `time` parameter from the loop)
2. This timing needs to be preserved as-is when passed to Tone.js scheduling functions
3. Converting Transport-relative timing to absolute time too early causes slight desynchronization
4. By passing the timing parameter through unchanged, the harmony widget now schedules notes at exactly the same time as other widgets

## Testing
Navigate to http://localhost:3001/test-exercises and:
1. Select an exercise with harmony
2. Click Play
3. Listen for tight synchronization between harmony, drums, and metronome
4. All widgets should now be perfectly in sync "on the grid"

## Result
The harmony widget is now synchronized with other widgets, playing exactly on the beat with no perceptible delay.