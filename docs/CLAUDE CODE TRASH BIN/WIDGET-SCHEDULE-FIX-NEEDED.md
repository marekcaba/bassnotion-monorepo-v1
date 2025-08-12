# Widget Schedule Fix Needed

## Current Behavior
1. Transport starts successfully 
2. Widgets create schedules with Transport.scheduleRepeat
3. First callback executes at time 0.227
4. You hear 2 hihat sounds
5. No further callbacks execute
6. Transport continues running but widgets are silent

## Root Cause
The schedules are being created correctly but something is preventing them from continuing. Possible causes:

1. **React Re-renders**: Component re-renders might be clearing/recreating schedules
2. **Effect Cleanup**: useEffect cleanup functions might be clearing schedules prematurely  
3. **Schedule Timing**: The `+0.1` start time for Transport might be causing sync issues

## Evidence from Logs
```
DrummerWidget.tsx:1077 🥁🥁 DRUM TRANSPORT SCHEDULE EXECUTED! {time: 0.22666666666666668, loopIteration: 0, transportState: 'started'}
```
This shows the first callback works, but we don't see `loopIteration: 1, 2, 3...`

## Quick Test
To verify if Transport.scheduleRepeat works at all, you could add this simple test in the browser console when Transport is running:

```javascript
const tone = window.Tone;
let count = 0;
const id = tone.Transport.scheduleRepeat((time) => {
  console.log('TEST:', count++, time, tone.Transport.position.toString());
}, '4n', 0);

// To stop: tone.Transport.clear(id);
```

## Recommended Fix
The widgets need to ensure their schedules persist across React re-renders. Options:

1. Store schedule IDs in refs that persist across renders
2. Add guards to prevent recreating schedules if they already exist
3. Move schedule creation outside of effects that might re-run

The key is that Transport.scheduleRepeat should be called ONCE when play starts and cleared ONCE when stop is pressed.