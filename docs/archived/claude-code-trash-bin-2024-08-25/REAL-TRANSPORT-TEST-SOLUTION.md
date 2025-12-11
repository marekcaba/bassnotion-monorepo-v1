# Real Transport Test Solution

## The Problem

The tests use mocked Tone.js Transport that doesn't actually implement `scheduleRepeat` functionality:

```javascript
// In test/mocks/audioLibraryMocks.ts
const mockTransport = {
  scheduleRepeat: vi.fn(), // Just a mock function!
};
```

This is why tests pass but the real app fails - the mock doesn't simulate the actual behavior.

## Solution: Create Real Integration Tests

### 1. Browser-based Test Page

Created `/apps/frontend/public/test-transport-schedule.html` that tests real Tone.js in the browser:

- Tests Transport.scheduleRepeat with `+0.1` delay (app behavior)
- Tests immediate start
- Shows if the issue reproduces in isolation

To use:

```bash
pnpm dev:frontend
# Open http://localhost:3001/test-transport-schedule.html
```

### 2. Real Tone.js Test Utils

Created utilities that use actual Tone.js instead of mocks:

- `/apps/frontend/src/test/utils/realToneTestUtils.ts`
- `/apps/frontend/src/test/setupRealTone.ts`

### 3. Fixing the Widget Tests

To create real tests that catch Transport issues:

```typescript
// Example real widget test
import { render } from '@testing-library/react';
import * as Tone from 'tone'; // Real Tone.js, not mocked!

describe('DrummerWidget - Real Transport Test', () => {
  it('should maintain schedules across re-renders', async () => {
    // Use real Transport
    await Tone.start();

    // Render widget and verify scheduling continues
    // This would catch the real issue!
  });
});
```

## Key Findings

1. **Mock vs Reality**: The test mocks have `scheduleRepeat: vi.fn()` which doesn't repeat
2. **Real Issue**: In the real app, scheduleRepeat fires once then stops
3. **Test Gap**: Tests can't catch this because they don't test real Transport behavior

## Next Steps

1. **Debug in Browser**: Use the HTML test page to see if issue reproduces in isolation
2. **Fix Widget Code**: If issue reproduces, the problem is in how widgets handle schedules
3. **Update Tests**: Replace mock Transport with real Tone.js in critical tests

## Likely Root Cause

The widgets are probably:

1. Creating schedules in useEffect
2. Not properly cleaning up old schedules
3. Re-rendering and losing schedule references
4. Or Transport.start timing issue with the `+0.1` delay

The browser test will help isolate which one it is!
