import { test, expect } from '@playwright/test';

test.describe('Test Drums Audio', () => {
  test('drums should load and play', async ({ page }) => {
    // Track console messages
    const logs: string[] = [];
    const errors: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('🥁') ||
        text.includes('kick') ||
        text.includes('snare') ||
        text.includes('hihat') ||
        text.includes('sampler') ||
        text.includes('Loading drum')
      ) {
        logs.push(`[${msg.type()}] ${text}`);
      }
      if (msg.type() === 'error' || msg.type() === 'warning') {
        errors.push(`[${msg.type()}] ${text}`);
      }
    });

    await page.goto('http://localhost:3001/test-transport');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Wait for drum initialization
    await page.waitForTimeout(5000);

    // Print all drum-related logs
    console.log('\n🥁 Drum-related logs:');
    logs.forEach((log) => console.log(log));

    // Check if any drum logs appeared
    const hasDrumLogs = logs.some((log) => log.includes('🥁'));
    console.log(`\nDrum logs found: ${hasDrumLogs}`);

    // Start playback
    await page.click('button:has-text("▶️ PLAY")');

    // Wait for playback
    await page.waitForTimeout(3000);

    // Check for new logs
    const newLogs = logs.slice(-10);
    console.log('\n🥁 Recent drum logs after play:');
    newLogs.forEach((log) => console.log(log));

    // Print errors
    if (errors.length > 0) {
      console.log('\n❌ Errors found:');
      errors.forEach((err) => console.log(err));
    }
  });
});
