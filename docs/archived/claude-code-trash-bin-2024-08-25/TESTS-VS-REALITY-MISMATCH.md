# Tests vs Reality Mismatch - The Real Problem

## THE SMOKING GUN 🔫

The tests are passing because they use MOCKED Transport that doesn't actually implement `scheduleRepeat`!

```javascript
// In test/mocks/audioLibraryMocks.ts
const mockTransport = {
  scheduleRepeat: vi.fn(), // <-- Just a mock function that does NOTHING!
  // ...
};
```

## Why Tests Pass But Reality Fails

1. **Tests**: Use `vi.fn()` mock that just returns immediately
2. **Reality**: Uses real `Tone.Transport.scheduleRepeat` which has some issue
3. **Result**: Tests pass, real code fails after first callback

## Evidence From Logs

```
🥁🥁 DRUM TRANSPORT SCHEDULE EXECUTED! {time: 0.227, loopIteration: 0, transportState: 'started'}
```

We see `loopIteration: 0` but never see `1, 2, 3...` - the schedule fires ONCE then stops.

## Root Cause Theories

1. **Transport Start Timing**: Transport starts with `+0.1` delay, widgets might be checking state too early
2. **Schedule Persistence**: Something is clearing/recreating the schedules after first callback
3. **React Re-renders**: Component re-renders might be interfering with Tone.js schedules

## The Real Issue

The disconnect between test mocks and actual Tone.js behavior means:

- We can't trust the tests to catch real Transport issues
- The actual `Transport.scheduleRepeat` implementation has different behavior than expected
- Something in the real Tone.js is preventing repeat callbacks after the first execution

## Next Steps

1. **Verify Transport continues running**: Check if Transport.seconds increases
2. **Test scheduleRepeat directly**: Create minimal test without React
3. **Check for schedule clearing**: Log when schedules are cleared
4. **Fix the tests**: Make them use real Tone.js or better mocks
