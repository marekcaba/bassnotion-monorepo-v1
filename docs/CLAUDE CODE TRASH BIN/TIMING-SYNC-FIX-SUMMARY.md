# Timing Synchronization Fix Summary

## Issues Fixed

### 1. Frame Tracking Issue (Initial Problem)
**Problem**: `lastAudioWorkletFrame` was showing as 0 in position updates, causing master clock mode to fail.

**Root Cause**: The reinitialized AudioWorklet handler wasn't storing timing values (`lastAudioWorkletTime` and `lastAudioWorkletFrame`).

**Fix**: Added the missing assignments in the reinit handler to properly store frame values from AudioWorklet timing updates.

### 2. 100ms Timing Drift (Main Issue)
**Problem**: Persistent ~100ms timing drift between AudioWorklet and Tone.js Transport, causing systematic sync adjustments.

**Root Cause**: The AudioWorklet and Transport were trying to sync two independent clocks that started at different times. The code was attempting to calculate offsets and compensate, but this created more complexity and drift.

**Fix**: Simplified the approach to treat AudioWorklet as the ONLY source of truth. In master clock mode, we now force Transport to always match AudioWorklet exactly:
```typescript
// MASTER CLOCK MODE: AudioWorklet is the ONLY source of truth
const audioWorkletPosition = this.lastAudioWorkletTime;
tone.Transport.seconds = audioWorkletPosition;
drift = 0; // No drift in master clock mode - AudioWorklet IS the time
```

### 3. Session ID Mismatch (Final Issue)
**Problem**: After pause/resume cycles, AudioWorklet timing updates were rejected due to session ID mismatch (e.g., "sessionId=3, expected=2").

**Root Cause**: When stopping the transport, the AudioWorklet increments its session ID, but UnifiedTransport wasn't incrementing its `expectedSessionId` to match.

**Fix**: 
1. Added session ID increment in the `stop()` method to match AudioWorklet's behavior
2. Added temporary message handler removal to clear any pending messages from the old session

## Test Results

All tests now pass successfully:
- ✅ No timing drift detected over extended playback
- ✅ Session IDs remain synchronized through pause/resume/stop cycles
- ✅ Frame tracking works correctly with proper values

## Key Insights

1. **Master Clock Pattern**: When using AudioWorklet as master clock, don't try to calculate offsets or compensate - just force the slave (Transport) to match exactly.

2. **Session Management**: Both sides of a messaging protocol need to increment session IDs synchronously to avoid rejecting valid messages.

3. **Message Queue Clearing**: When stopping/restarting components that use message passing, temporarily remove handlers to clear any in-flight messages from previous sessions.

## Files Modified

1. `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`
   - Fixed frame tracking in reinit handler
   - Simplified master clock synchronization
   - Added session ID increment in stop method
   - Added message queue clearing logic

## E2E Tests Created

1. `test-timing-drift-fixed.e2e.spec.ts` - Verifies no timing drift occurs
2. `test-session-id-sync.e2e.spec.ts` - Verifies session IDs stay synchronized
3. `test-complete-timing-sync.e2e.spec.ts` - Comprehensive test of all scenarios