# Widget Audio Schedule Fix

## Root Cause Analysis

After extensive debugging, I've identified the root cause of why widgets are not producing audio:

### The Problem

1. **Drum schedules are created at time 0**:

   ```typescript
   const scheduleId = currentTone.Transport.scheduleRepeat(
     (time) => {
       // callback code...
     },
     drumLoopInterval,
     0,
   ); // <-- Starting at time 0
   ```

2. **Transport starts at +0.1**:

   ```typescript
   // In TransportController.ts
   const startTime = time || '+0.1'; // Default start time with small delay
   tone.Transport.start(startTime);
   ```

3. **Result**: Schedules created at time 0 never fire because the Transport starts after that point

### Evidence from Tests

1. `transport-schedule-timing-bug.e2e.spec.ts` confirmed:
   - Schedule at 0: 0 fires
   - Schedule at +0.1: 0 fires (this also failed!)
   - Schedule at "now": 0 fires

2. `drum-pattern-debug.e2e.spec.ts` showed:
   - NO "DRUM TRANSPORT SCHEDULE EXECUTED" logs
   - NO event processing
   - NO subdivision matching

3. `widget-audio-playback.e2e.spec.ts` revealed:
   - 0 audio playback attempts
   - No `triggerAttackRelease` calls

### The Fix

Change the schedule start time in widgets from `0` to omit the parameter (defaults to "now"):

```typescript
// Before (broken):
const scheduleId = currentTone.Transport.scheduleRepeat(callback, '8n', 0);

// After (fixed):
const scheduleId = currentTone.Transport.scheduleRepeat(callback, '8n');
// OR
const scheduleId = currentTone.Transport.scheduleRepeat(callback, '8n', '+0.1');
```

### Files to Fix

1. **DrummerWidget.tsx** - Line ~1358: Change `drumLoopInterval, 0` to `drumLoopInterval`
2. **HarmonyWidget.tsx** - Similar issue likely exists
3. **MetronomeWidget.tsx** - Check for same pattern
4. **BassLineWidget.tsx** - Check for same pattern

### Additional Issue

The `!loopRef.current` check in the sync effect does prevent recreation after stop/play, but the primary issue is the timing mismatch.
