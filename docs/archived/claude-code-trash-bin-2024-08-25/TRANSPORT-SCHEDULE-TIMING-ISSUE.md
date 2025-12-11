# Transport Schedule Timing Issue

## Problem

Widgets play only 2 hihat sounds then stop. The Transport.scheduleRepeat callbacks execute once but don't continue.

## Root Cause Analysis

From the logs:

1. Transport starts with `+0.1` delay
2. First callback executes at time 0.227
3. Widgets play sounds successfully
4. But then something interrupts the schedule

## Key Evidence

```
HarmonyWidget.tsx:1159 🎵🎹 HARMONY TRANSPORT SCHEDULE EXECUTED! {time: 0.22666666666666668, loopIteration: 0, transportState: 'started'}
DrummerWidget.tsx:1077 🥁🥁 DRUM TRANSPORT SCHEDULE EXECUTED! {time: 0.22666666666666668, loopIteration: 0, transportState: 'started'}
```

After this, we see:

```
DrummerWidget.tsx:204 🥁 DrummerWidget: Sync state changed: {syncProps.isPlaying: true, final syncIsPlaying: true, Transport?.state: 'started', Tone.Transport.state: 'started', isConnected: true, …}
```

Then multiple re-renders and effect cleanups happen.

## The Issue

The widgets are likely recreating their schedules or clearing them when React re-renders after the first beat. This could be due to:

1. **Effect dependencies** - The useEffect that creates schedules might be re-running
2. **Cleanup functions** - Old schedules being cleared on re-render
3. **State updates** - Causing component re-renders that reset the schedules

## Solution Needed

Need to ensure Transport.scheduleRepeat persists across React re-renders. The schedule should only be created once when play starts and cleared once when stop is pressed.
