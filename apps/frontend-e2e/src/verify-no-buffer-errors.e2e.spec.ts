import { test, expect } from '@playwright/test';

test.describe('Verify No Buffer Errors', () => {
  test('harmony widget plays without buffer errors', async ({ page }) => {
    test.setTimeout(60000); // Increase timeout to 60 seconds
    // Track all errors
    const errors: string[] = [];
    const logs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        errors.push(text);
      }
      // Capture specific logs for debugging
      if (text.includes('🎹') || text.includes('📝') || text.includes('🎵')) {
        logs.push(`[${msg.type()}] ${text}`);
      }
    });

    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');

    // Wait for page to be ready and widgets to be loaded
    console.log('Waiting for page to be ready...');

    // Wait for the auto-init to complete
    await page.waitForFunction(
      () => {
        const autoInitBanner = document.querySelector('.bg-green-900');
        return (
          autoInitBanner &&
          autoInitBanner.textContent?.includes('Tutorial Ready!')
        );
      },
      { timeout: 10000 },
    );

    // Give HarmonyWidget time to load samples from Supabase (smart loading)
    console.log('Waiting for HarmonyWidget to smart load Supabase samples...');
    await page.waitForTimeout(25000); // 25 seconds for loading from Supabase

    console.log('Audio systems loaded, starting playback...');
    // Click play
    await page.click('button:has-text("▶️ PLAY")');

    // Wait for playback
    await page.waitForTimeout(3000);

    // Print debug logs
    console.log('\n🔍 Debug logs:');
    logs.forEach((log) => console.log(log));

    // Check for buffer errors
    const bufferErrors = errors.filter(
      (err) =>
        err.includes('buffer is either not set or not loaded') ||
        err.includes('No loaded sampler can play note'),
    );

    if (bufferErrors.length > 0) {
      console.log('\n❌ Buffer errors found:');
      bufferErrors.forEach((err) => console.log(err));
    } else {
      console.log('\n✅ No buffer errors - audio playing successfully!');
    }

    expect(bufferErrors.length).toBe(0);
  });
});
