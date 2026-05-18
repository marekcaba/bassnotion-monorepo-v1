import { test, expect } from './fixtures';

test.describe('Session ID Synchronization', () => {
  test('should maintain session ID sync after pause/resume cycle', async ({
    page,
  }) => {
    // Track session ID mismatches
    let sessionIdMismatchDetected = false;
    const rejectedUpdates: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();

      // Detect session ID mismatches
      if (
        text.includes('Rejecting stale AudioWorklet') &&
        text.includes('sessionId=')
      ) {
        sessionIdMismatchDetected = true;
        rejectedUpdates.push(text);
        console.error('❌ SESSION ID MISMATCH:', text);
      }

      // Log session ID checks for debugging
      if (text.includes('SessionId check:')) {
        console.log('Session ID check:', text);
      }
    });

    // Navigate to test page
    await page.goto('http://localhost:3001/test-unified-transport');

    // Wait for page to load
    await page.waitForSelector('text=UnifiedTransport Test', {
      timeout: 10000,
    });

    // Start playback
    console.log('Starting playback...');
    const playButton = await page.locator('button:has-text("Play")').first();
    await playButton.click();

    // Play for 3 seconds
    await page.waitForTimeout(3000);

    // Pause
    console.log('Pausing...');
    const pauseButton = await page.locator('button:has-text("Pause")').first();
    await pauseButton.click();

    // Wait while paused
    console.log('Waiting in paused state...');
    await page.waitForTimeout(2000);

    // Resume
    console.log('Resuming...');
    const resumeButton = await page
      .locator('button:has-text("Resume")')
      .first();
    await resumeButton.click();

    // Play for another 3 seconds
    await page.waitForTimeout(3000);

    // Stop
    console.log('Stopping...');
    const stopButton = await page.locator('button:has-text("Stop")').first();
    await stopButton.click();

    // Wait a bit
    await page.waitForTimeout(1000);

    // Start again to test session ID after full stop
    console.log('Starting again after stop...');
    await playButton.click();

    // Play for 3 seconds
    await page.waitForTimeout(3000);

    // Stop
    await stopButton.click();

    // Verify NO session ID mismatches occurred
    console.log(`Total rejected updates: ${rejectedUpdates.length}`);
    if (rejectedUpdates.length > 0) {
      console.log('Rejected updates:', rejectedUpdates);
    }

    expect(sessionIdMismatchDetected).toBe(false);
    console.log(
      '✅ SUCCESS! Session IDs remained synchronized throughout pause/resume/stop cycles!',
    );
  });
});
