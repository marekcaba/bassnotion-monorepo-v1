import { test, expect } from '@playwright/test';

test.describe('Test Sampler Loading', () => {
  test('check sampler loading and fallback', async ({ page }) => {
    // Capture console logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('🎹') ||
        text.includes('Sampler') ||
        text.includes('layer')
      ) {
        logs.push(text);
      }
    });

    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give samplers time to load

    console.log('\n=== Sampler Loading Logs ===');
    logs
      .filter((log) => log.includes('loaded') || log.includes('Sampler'))
      .forEach((log) => console.log(log));

    // Click play
    console.log('\n=== Starting playback ===');
    await page.click('button:has-text("▶️ PLAY")');

    // Wait for errors
    await page.waitForTimeout(2000);

    console.log('\n=== Fallback Mechanism Logs ===');
    logs
      .filter(
        (log) =>
          log.includes('Looking for fallback') ||
          log.includes('Checking layer') ||
          log.includes('Checked samplers') ||
          log.includes('Loaded layers'),
      )
      .forEach((log) => console.log(log));

    console.log('\n=== Error Logs ===');
    logs
      .filter((log) => log.includes('No loaded sampler'))
      .forEach((log) => console.log(log));
  });
});
