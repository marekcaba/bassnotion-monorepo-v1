import { test, expect } from '@playwright/test';

test.describe('UnifiedTransport Timing Drift Fix', () => {
  test('should maintain perfect synchronization without drift', async ({
    page,
  }) => {
    // Capture all console messages
    const consoleMessages: string[] = [];
    let majorSyncAdjustmentDetected = false;
    let driftWarnings = 0;

    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(text);

      // Log timing-related messages
      if (
        text.includes('AudioWorklet') ||
        text.includes('sync adjustment') ||
        text.includes('Frame tracking') ||
        text.includes('drift') ||
        text.includes('Timing update')
      ) {
        console.log(`Browser: ${text}`);
      }

      // Detect major sync adjustments (100ms+)
      if (text.includes('AudioWorklet major sync adjustment')) {
        majorSyncAdjustmentDetected = true;
        console.error('❌ MAJOR SYNC ADJUSTMENT DETECTED:', text);
      }

      // Count drift warnings
      if (text.includes('drift')) {
        driftWarnings++;
      }
    });

    // Navigate to test-unified-transport page
    await page.goto('http://localhost:3001/test-unified-transport');

    // Wait for page to load
    await page.waitForSelector('text=UnifiedTransport Test', {
      timeout: 10000,
    });

    // Start playback (audio initialization happens automatically)
    console.log('Starting playback (will initialize audio)...');
    const playButton = await page.locator('button:has-text("Play")').first();
    await playButton.click();

    // Wait for audio initialization and playback to start
    await page.waitForTimeout(2000);

    // Monitor for 10 seconds to check for drift
    console.log('Monitoring for timing drift over 10 seconds...');
    await page.waitForTimeout(10000);

    // Check timing metrics
    const driftElement = await page.locator('text=/Current Drift:.*ms/');
    const driftText = await driftElement.textContent();
    const driftMatch = driftText?.match(/Current Drift: ([\d.-]+)ms/);
    const currentDrift = driftMatch ? parseFloat(driftMatch[1]) : 0;

    console.log(`Current drift: ${currentDrift}ms`);

    // Stop playback
    const stopButton = await page.locator('button:has-text("Stop")').first();
    await stopButton.click();

    // Verify no major sync adjustments occurred
    expect(majorSyncAdjustmentDetected).toBe(false);

    // Verify drift is minimal (less than 5ms is acceptable)
    expect(Math.abs(currentDrift)).toBeLessThan(5);

    // Test restart to ensure clean reinitialization
    console.log('Testing restart for clean reinitialization...');
    await page.waitForTimeout(500);
    await playButton.click();
    await page.waitForTimeout(3000);
    await stopButton.click();

    // Final verification
    expect(majorSyncAdjustmentDetected).toBe(false);
    console.log(
      `✅ Test passed! Drift warnings: ${driftWarnings}, Major adjustments: ${majorSyncAdjustmentDetected ? 'YES' : 'NO'}`,
    );

    // Log final state for debugging
    const finalMetrics = await page.locator('.space-y-2').textContent();
    console.log('Final metrics:', finalMetrics);
  });
});
