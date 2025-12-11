# Transport Latency Fix

## Problem

There's a 2-3 second delay between UI actions (play/stop) and actual audio playback. The logs show that audio events are being scheduled at transport times like 2.01s and 4.02s instead of immediately.

## Root Cause

The widgets are scheduling their audio events at the current transport position (which might already be at 2+ seconds) instead of scheduling them to start immediately or with minimal lookahead.

## Solution

The widgets need to:

1. Schedule events with minimal lookahead (e.g., +0.1s for buffer) instead of at the current transport time
2. Use Tone.Transport.immediate() or "+0.1" timing instead of absolute transport positions
3. Ensure the Transport starts from position 0 when play is pressed

## Quick Fix

In the widget scheduling code, replace:

```javascript
// OLD: Schedules at current transport time (could be 2+ seconds)
const time = Tone.Transport.seconds;
sampler.triggerAttackRelease(notes, duration, time);

// NEW: Schedule with minimal lookahead
const time = '+0.1'; // 100ms lookahead
sampler.triggerAttackRelease(notes, duration, time);
```

## Files to Check

1. HarmonyWidgetRealPiano.tsx - Check how it schedules chord playback
2. DrummerWidget.tsx - Check drum pattern scheduling
3. EnhancedMetronomeWidget.tsx - Check metronome scheduling
4. transportSync.ts - Ensure proper time calculation

## Verification

After fixing, the audio should start within 100-200ms of pressing play, not 2-3 seconds later.
