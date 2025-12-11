import { test, expect } from '@playwright/test';

test.describe('Complete Timing Synchronization', () => {
  test('should handle all timing scenarios without drift or session ID issues', async ({
    page,
  }) => {
    test.setTimeout(60000); // Increase timeout to 60 seconds
    // Track all issues
    let majorSyncAdjustmentDetected = false;
    let sessionIdMismatchDetected = false;
    const issues: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();

      // Detect major sync adjustments (100ms+)
      if (text.includes('AudioWorklet major sync adjustment')) {
        majorSyncAdjustmentDetected = true;
        issues.push(`DRIFT: ${text}`);
        console.error('❌ MAJOR SYNC ADJUSTMENT:', text);
      }

      // Detect session ID mismatches
      if (
        text.includes('Rejecting stale AudioWorklet') &&
        text.includes('sessionId=')
      ) {
        sessionIdMismatchDetected = true;
        issues.push(`SESSION: ${text}`);
        console.error('❌ SESSION ID MISMATCH:', text);
      }

      // Log important timing events
      if (
        text.includes('UnifiedTransport stop: Incremented expectedSessionId') ||
        (text.includes('TimingProcessor') && text.includes('STOPPED')) ||
        text.includes('Frame tracking update')
      ) {
        console.log(`Timing: ${text}`);
      }
    });

    // Navigate to test page
    await page.goto('http://localhost:3001/test-unified-transport');

    // Wait for page to load
    await page.waitForSelector('text=UnifiedTransport Test', {
      timeout: 10000,
    });

    console.log('=== Test Scenario 1: Basic Play/Stop ===');
    // Start playback
    const playButton = await page.locator('button:has-text("Play")').first();
    await playButton.click();

    // Play for 5 seconds
    await page.waitForTimeout(5000);

    // Stop
    const stopButton = await page.locator('button:has-text("Stop")').first();
    await stopButton.click();

    await page.waitForTimeout(500);

    console.log('=== Test Scenario 2: Pause/Resume ===');
    // Start again
    await playButton.click();
    await page.waitForTimeout(2000);

    // Pause
    const pauseButton = await page.locator('button:has-text("Pause")').first();
    await pauseButton.click();

    // Wait while paused (simulating user waiting)
    await page.waitForTimeout(3000);

    // Resume
    const resumeButton = await page
      .locator('button:has-text("Resume")')
      .first();
    await resumeButton.click();

    // Play for another 5 seconds
    await page.waitForTimeout(5000);

    // Stop
    await stopButton.click();

    console.log('=== Test Scenario 3: Multiple Start/Stop cycles ===');
    // Multiple quick start/stop cycles
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(500);
      await playButton.click();
      await page.waitForTimeout(2000);
      await stopButton.click();
    }

    console.log('=== Test Scenario 4: Long playback ===');
    // Start and let it play for a longer period
    await page.waitForTimeout(1000);
    await playButton.click();

    // Monitor for 10 seconds
    await page.waitForTimeout(10000);

    // Final stop
    await stopButton.click();

    // Check results
    console.log('=== Test Results ===');
    console.log(
      `Major sync adjustments: ${majorSyncAdjustmentDetected ? 'DETECTED' : 'None'}`,
    );
    console.log(
      `Session ID mismatches: ${sessionIdMismatchDetected ? 'DETECTED' : 'None'}`,
    );
    console.log(`Total issues: ${issues.length}`);

    if (issues.length > 0) {
      console.log('Issues detected:');
      issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }

    // Verify no issues occurred
    expect(majorSyncAdjustmentDetected).toBe(false);
    expect(sessionIdMismatchDetected).toBe(false);
    expect(issues.length).toBe(0);

    console.log(
      '✅ SUCCESS! Perfect timing synchronization throughout all test scenarios!',
    );
  });
});
