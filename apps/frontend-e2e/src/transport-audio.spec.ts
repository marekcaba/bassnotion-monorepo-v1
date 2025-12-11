/**
 * REAL Transport and Audio Tests
 * Tests the ACTUAL audio system, not mocks
 */

import { test, expect } from '@playwright/test';

test.describe('Real Transport Audio Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the test transport page
    await page.goto('/test-transport');

    // Wait for the page to load - look for the actual heading
    await page.waitForSelector(
      'h1:has-text("Global Transport & Widget Synchronization Test")',
    );
  });

  test('Transport starts and schedules continue running', async ({ page }) => {
    // Wait for audio to be ready - check for Epic 3.18 Ready
    await page.waitForSelector('text=Epic 3.18 Ready: ✅', { timeout: 10000 });

    // Monitor the event log for drum callbacks (set up before starting)
    const drumCallbacks = [];

    // Listen to console logs to capture drum events
    page.on('console', (msg) => {
      if (msg.text().includes('DRUM TRANSPORT SCHEDULE EXECUTED')) {
        drumCallbacks.push(msg.text());
      }
    });

    // Click Start Transport
    await page.click('button:has-text("Start Transport")');

    // Wait for transport to start - check the transport state
    await page.waitForSelector('text=Transport State: playing', {
      timeout: 5000,
    });

    // Wait 3 seconds for callbacks
    await page.waitForTimeout(3000);

    // Should have multiple callbacks (at least 10 in 3 seconds at 120 BPM)
    expect(drumCallbacks.length).toBeGreaterThan(10);

    // Stop transport
    await page.click('button:has-text("Stop Transport")');

    // Verify transport stopped
    await page.waitForSelector('text=Transport State: stopped', {
      timeout: 5000,
    });
  });

  test('Widgets produce actual audio output', async ({ page }) => {
    // Enable audio permissions
    await page.context().grantPermissions(['microphone']);

    // Monitor console for audio events (set up before starting)
    const audioEvents = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('Playing at volume') ||
        text.includes('triggerAttackRelease') ||
        text.includes('SCHEDULE EXECUTED')
      ) {
        audioEvents.push(text);
      }
    });

    // Wait for widgets to load
    await page.waitForSelector('[data-testid="drummer-widget"]');
    await page.waitForSelector('[data-testid="metronome-widget"]');
    await page.waitForSelector('[data-testid="harmony-widget"]');

    // Start transport
    await page.click('button:has-text("Start Transport")');

    // Start playback and wait for it to be active
    await page.waitForSelector('text=Transport State: playing', {
      timeout: 5000,
    });

    // Wait for audio events
    await page.waitForTimeout(2000);

    // Should have audio events from all widgets
    expect(audioEvents.some((e) => e.includes('DRUM'))).toBeTruthy();
    expect(audioEvents.some((e) => e.includes('METRONOME'))).toBeTruthy();
    expect(audioEvents.some((e) => e.includes('HARMONY'))).toBeTruthy();
  });

  test('AudioContext activates on user gesture', async ({ page }) => {
    // Wait for page to load and check initial state
    await page.waitForSelector('text=Epic 3.18 Ready: ✅', { timeout: 10000 });

    const contextState = await page.evaluate(() => {
      return window.Tone?.context?.state || 'unknown';
    });

    // Click start - this is the user gesture
    await page.click('button:has-text("Start Transport")');

    // Wait a bit
    await page.waitForTimeout(500);

    // Context should be running
    const runningState = await page.evaluate(() => {
      return window.Tone?.context?.state || 'unknown';
    });

    expect(runningState).toBe('running');
  });

  test('Transport schedules persist across widget re-renders', async ({
    page,
  }) => {
    // Start transport
    await page.click('button:has-text("Start Transport")');

    // Collect initial callbacks
    const callbacks = [];
    page.on('console', (msg) => {
      if (msg.text().includes('SCHEDULE EXECUTED')) {
        callbacks.push({
          time: Date.now(),
          text: msg.text(),
        });
      }
    });

    // Wait for initial callbacks
    await page.waitForTimeout(1000);
    const initialCount = callbacks.length;
    expect(initialCount).toBeGreaterThan(0);

    // Trigger a re-render by changing tempo using the slider
    const slider = await page.locator(
      'input[type="range"][min="60"][max="200"]',
    );
    await slider.fill('140');

    // Wait for more callbacks
    await page.waitForTimeout(2000);

    // Should continue getting callbacks
    const finalCount = callbacks.length;
    expect(finalCount).toBeGreaterThan(initialCount * 2);

    // Verify no long gaps in callbacks (indicating schedule was destroyed)
    for (let i = 1; i < callbacks.length; i++) {
      const gap = callbacks[i].time - callbacks[i - 1].time;
      // Gap should never be more than 1 second
      expect(gap).toBeLessThan(1000);
    }
  });
});
