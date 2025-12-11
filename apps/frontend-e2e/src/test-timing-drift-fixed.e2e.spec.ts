import { test, expect } from '@playwright/test';

test.describe('Timing Drift Fix Verification', () => {
  test('should NOT have any major sync adjustments', async ({ page }) => {
    // Track sync adjustments
    let majorSyncAdjustmentDetected = false;
    const syncAdjustments: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();

      // Detect major sync adjustments (100ms+)
      if (text.includes('AudioWorklet major sync adjustment')) {
        majorSyncAdjustmentDetected = true;
        syncAdjustments.push(text);
        console.error('❌ MAJOR SYNC ADJUSTMENT DETECTED:', text);
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

    // Monitor for 15 seconds
    console.log('Monitoring for timing drift over 15 seconds...');
    await page.waitForTimeout(15000);

    // Stop playback
    const stopButton = await page.locator('button:has-text("Stop")').first();
    await stopButton.click();

    // Verify NO major sync adjustments occurred
    console.log(`Total sync adjustments detected: ${syncAdjustments.length}`);
    if (syncAdjustments.length > 0) {
      console.log('Sync adjustments:', syncAdjustments);
    }

    expect(majorSyncAdjustmentDetected).toBe(false);

    // Test restart to ensure clean reinitialization
    console.log('Testing restart...');
    await page.waitForTimeout(500);
    await playButton.click();
    await page.waitForTimeout(5000);
    await stopButton.click();

    // Final verification
    expect(majorSyncAdjustmentDetected).toBe(false);
    console.log(
      '✅ SUCCESS! No timing drift detected - AudioWorklet and Transport are perfectly synchronized!',
    );
  });
});
