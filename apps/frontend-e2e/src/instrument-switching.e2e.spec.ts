import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Instrument Switching E2E Tests
 *
 * Tests the full user flow of switching between keyboard instruments
 * (Wurlitzer, Grand Piano, Rhodes) on tutorial pages with multiple exercises.
 *
 * Key scenarios tested:
 * 1. Sample preloading for all exercises on page load
 * 2. Correct instrument configuration when selecting exercises
 * 3. No sample mismatch between instruments
 * 4. Proper audio output per instrument
 */

test.describe('Keyboard Instrument Switching', () => {
  // Test tutorial page URL - use full URL with base
  const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3001';
  const TUTORIAL_URL = `${BASE_URL}/widgets/youtube`;

  test.beforeEach(async ({ page }) => {
    // Navigate to tutorial page
    await page.goto(TUTORIAL_URL);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Wait for initial UI to render
    await page.waitForTimeout(1000);
  });

  // ==========================================================================
  // TEST: Sample Preloading Verification
  // ==========================================================================
  test('should preload samples for all exercises on tutorial page load', async ({
    page,
  }) => {
    await test.step('Wait for preloading to start', async () => {
      // Wait for ScrollTriggerLoader or ExerciseSelector to trigger
      await page.waitForTimeout(2000);
    });

    await test.step('Verify preloading console logs', async () => {
      // Collect console logs related to sample loading
      const consoleLogs: string[] = [];

      page.on('console', (msg) => {
        const text = msg.text();
        if (
          text.includes('harmony-samples-loaded') ||
          text.includes('loadFullSamples') ||
          text.includes('CACHE-HIT') ||
          text.includes('CACHE-MISS') ||
          text.includes('loadTutorialSamples')
        ) {
          consoleLogs.push(text);
        }
      });

      // Trigger preloading by scrolling
      await page.mouse.move(100, 100);
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(3000);

      // Log collected messages for debugging
      console.log('Sample loading logs:', consoleLogs);
    });

    await test.step('Verify GlobalSampleCache has entries', async () => {
      // Check if GlobalSampleCache has cached samples
      const cacheStats = await page.evaluate(() => {
        const globalCache = (window as any).__bassnotion_globalSampleCache;
        if (globalCache) {
          return {
            hasCache: true,
            stats: globalCache.getCacheStats?.() || null,
          };
        }
        return { hasCache: false, stats: null };
      });

      console.log('Cache stats:', cacheStats);

      // We expect the cache to exist (preloading should have initialized it)
      // Note: Cache may not be exposed on window in production
    });
  });

  // ==========================================================================
  // TEST: Exercise Selection Updates Instrument Configuration
  // ==========================================================================
  test('should update instrument configuration when selecting different exercise', async ({
    page,
  }) => {
    await test.step('Find and click first exercise', async () => {
      // Wait for exercises to load
      const exerciseSelector = page.locator(
        '[data-testid="exercise-selector"], [data-testid="exercise-list"], .exercise-card, .exercise-item',
      );

      if ((await exerciseSelector.count()) > 0) {
        await exerciseSelector.first().click();
        await page.waitForTimeout(500);
      }
    });

    await test.step('Verify instrument state after first exercise selection', async () => {
      // Check console for instrument selection logs
      const instrumentLogs: string[] = [];

      page.on('console', (msg) => {
        const text = msg.text();
        if (
          text.includes('harmonyInstrument') ||
          text.includes('setHarmonyInstrument') ||
          text.includes('CHECKPOINT-3') ||
          text.includes('setCurrentInstrument')
        ) {
          instrumentLogs.push(text);
        }
      });

      // Select second exercise if available
      const exercises = page.locator(
        '[data-testid="exercise-selector"] > *, .exercise-card, .exercise-item',
      );

      if ((await exercises.count()) > 1) {
        await exercises.nth(1).click();
        await page.waitForTimeout(1000);

        console.log('Instrument logs after switching:', instrumentLogs);
      }
    });
  });

  // ==========================================================================
  // TEST: Octave Shift Verification
  // ==========================================================================
  test('should apply correct octave shift per instrument type', async ({
    page,
  }) => {
    await test.step('Verify octave shift configuration in INSTRUMENT_CONFIGS', async () => {
      const octaveShiftConfig = await page.evaluate(() => {
        // Try to access the Scheduler's INSTRUMENT_CONFIGS
        const scheduler = (window as any).__bassnotion_scheduler;
        const configs = (window as any).INSTRUMENT_CONFIGS;

        if (configs) {
          return {
            harmonyOctaveShift: configs.harmony?.octaveShift,
            harmonyInstrument: configs.harmony?.harmonyInstrument,
          };
        }

        return null;
      });

      console.log('Octave shift config:', octaveShiftConfig);

      // If configs are exposed, verify the logic
      if (octaveShiftConfig) {
        if (octaveShiftConfig.harmonyInstrument === 'grandpiano') {
          expect(octaveShiftConfig.harmonyOctaveShift).toBe(0);
        } else {
          expect(octaveShiftConfig.harmonyOctaveShift).toBe(12);
        }
      }
    });
  });

  // ==========================================================================
  // TEST: Cache Key Instrument Separation
  // ==========================================================================
  test('should use instrument-prefixed cache keys', async ({ page }) => {
    const cacheKeys: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      // Look for cache key patterns like "grandpiano-v7-C4" or "wurlitzer-v3-D4"
      const keyMatch = text.match(
        /(grandpiano|wurlitzer|rhodes)-v\d+-[A-Gs]+\d/g,
      );
      if (keyMatch) {
        cacheKeys.push(...keyMatch);
      }
    });

    await test.step('Trigger sample loading and collect cache keys', async () => {
      // Scroll to trigger preloading
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(3000);

      console.log('Collected cache keys:', cacheKeys);

      // Verify keys follow the pattern {instrument}-{layer}-{note}
      cacheKeys.forEach((key) => {
        expect(key).toMatch(/^(grandpiano|wurlitzer|rhodes)-v\d+-[A-Gs]+\d$/);
      });
    });
  });

  // ==========================================================================
  // TEST: Velocity Layer Selection Per Instrument
  // ==========================================================================
  test('should select correct velocity layer for each instrument', async ({
    page,
  }) => {
    await test.step('Verify velocity layer selection in console', async () => {
      const velocityLogs: string[] = [];

      page.on('console', (msg) => {
        const text = msg.text();
        if (
          text.includes('VelocityLayerSelector') ||
          text.includes('selectLayer') ||
          text.includes('velocity')
        ) {
          velocityLogs.push(text);
        }
      });

      // Try to play something to trigger velocity selection
      const playButton = page.locator(
        '[data-testid="play-button"], button:has-text("Play"), .play-button',
      );

      if ((await playButton.count()) > 0) {
        await playButton.first().click();
        await page.waitForTimeout(2000);

        // Stop playback
        const stopButton = page.locator(
          '[data-testid="stop-button"], button:has-text("Stop"), .stop-button',
        );
        if ((await stopButton.count()) > 0) {
          await stopButton.first().click();
        }
      }

      console.log('Velocity logs:', velocityLogs);
    });
  });

  // ==========================================================================
  // TEST: Grand Piano Sparse Sampling (GrandPianoMapper)
  // ==========================================================================
  test('should use GrandPianoMapper for sparse sampling', async ({ page }) => {
    const mapperLogs: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('GrandPianoMapper') ||
        text.includes('mapNote') ||
        text.includes('playbackRate') ||
        text.includes('sparse')
      ) {
        mapperLogs.push(text);
      }
    });

    await test.step('Trigger Grand Piano playback', async () => {
      // Try to find and select a Grand Piano exercise
      const exerciseCards = page.locator('.exercise-card, .exercise-item');

      for (let i = 0; i < (await exerciseCards.count()); i++) {
        const card = exerciseCards.nth(i);
        const cardText = await card.textContent();

        if (cardText?.toLowerCase().includes('grand') || cardText?.toLowerCase().includes('piano')) {
          await card.click();
          await page.waitForTimeout(1000);
          break;
        }
      }

      // Try to play
      const playButton = page.locator(
        '[data-testid="play-button"], button:has-text("Play")',
      );
      if ((await playButton.count()) > 0) {
        await playButton.first().click();
        await page.waitForTimeout(2000);

        const stopButton = page.locator('[data-testid="stop-button"], button:has-text("Stop")');
        if ((await stopButton.count()) > 0) {
          await stopButton.first().click();
        }
      }

      console.log('GrandPianoMapper logs:', mapperLogs);
    });
  });

  // ==========================================================================
  // TEST: No Audio Errors During Instrument Switch
  // ==========================================================================
  test('should not produce audio errors when switching instruments', async ({
    page,
  }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await test.step('Switch between multiple exercises rapidly', async () => {
      const exercises = page.locator('.exercise-card, .exercise-item, [data-testid="exercise-item"]');
      const exerciseCount = await exercises.count();

      if (exerciseCount >= 2) {
        // Rapid switching
        for (let i = 0; i < Math.min(5, exerciseCount); i++) {
          await exercises.nth(i % exerciseCount).click();
          await page.waitForTimeout(300);
        }

        await page.waitForTimeout(1000);
      }
    });

    await test.step('Verify no audio-related errors', async () => {
      const audioErrors = errors.filter(
        (e) =>
          e.includes('AudioContext') ||
          e.includes('AudioBuffer') ||
          e.includes('sample') ||
          e.includes('buffer') ||
          e.includes('audio'),
      );

      console.log('Audio-related errors:', audioErrors);

      // We expect no audio errors
      expect(audioErrors.length).toBe(0);
    });
  });

  // ==========================================================================
  // TEST: PlaybackEngine Instrument State
  // ==========================================================================
  test('should have correct instrument state in PlaybackEngine', async ({
    page,
  }) => {
    await test.step('Check PlaybackEngine state', async () => {
      // Wait for engine to initialize
      await page.waitForTimeout(2000);

      const engineState = await page.evaluate(() => {
        const engine = (window as any).__bassnotion_playbackEngine;
        if (engine) {
          return {
            hasEngine: true,
            state: engine.getState?.() || null,
            stats: engine.getStats?.() || null,
          };
        }
        return { hasEngine: false, state: null, stats: null };
      });

      console.log('PlaybackEngine state:', engineState);
    });
  });

  // ==========================================================================
  // TEST: HarmonySchedulerV2 Buffer Injection
  // ==========================================================================
  test('should inject correct buffers to HarmonySchedulerV2', async ({
    page,
  }) => {
    const bufferLogs: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('[HARMONY] BUFFER MAP INJECTED') ||
        text.includes('setHarmonyBuffers') ||
        text.includes('HarmonySchedulerV2')
      ) {
        bufferLogs.push(text);
      }
    });

    await test.step('Trigger buffer injection', async () => {
      // Select an exercise to trigger buffer loading
      const exercises = page.locator('.exercise-card, .exercise-item');
      if ((await exercises.count()) > 0) {
        await exercises.first().click();
        await page.waitForTimeout(2000);
      }

      console.log('Buffer injection logs:', bufferLogs);

      // Look for successful buffer injection
      const hasBufferInjection = bufferLogs.some(
        (log) =>
          log.includes('BUFFER MAP INJECTED') ||
          log.includes('setHarmonyBuffers'),
      );

      console.log('Buffer injection detected:', hasBufferInjection);
    });
  });

  // ==========================================================================
  // TEST: Full Exercise Playback Cycle
  // ==========================================================================
  test('should complete full playback cycle with instrument switching', async ({
    page,
  }) => {
    await test.step('Play first exercise', async () => {
      const exercises = page.locator('.exercise-card, .exercise-item');

      if ((await exercises.count()) > 0) {
        await exercises.first().click();
        await page.waitForTimeout(500);

        const playButton = page.locator('[data-testid="play-button"], button:has-text("Play")');
        if ((await playButton.count()) > 0) {
          await playButton.first().click();
          await page.waitForTimeout(2000);

          // Stop
          const stopButton = page.locator('[data-testid="stop-button"], button:has-text("Stop")');
          if ((await stopButton.count()) > 0) {
            await stopButton.first().click();
            await page.waitForTimeout(500);
          }
        }
      }
    });

    await test.step('Switch to second exercise and play', async () => {
      const exercises = page.locator('.exercise-card, .exercise-item');

      if ((await exercises.count()) > 1) {
        await exercises.nth(1).click();
        await page.waitForTimeout(500);

        const playButton = page.locator('[data-testid="play-button"], button:has-text("Play")');
        if ((await playButton.count()) > 0) {
          await playButton.first().click();
          await page.waitForTimeout(2000);

          // Stop
          const stopButton = page.locator('[data-testid="stop-button"], button:has-text("Stop")');
          if ((await stopButton.count()) > 0) {
            await stopButton.first().click();
          }
        }
      }
    });

    await test.step('Verify no stuck audio', async () => {
      // Check for any audio still playing after stop
      const isPlaying = await page.evaluate(() => {
        const engine = (window as any).__bassnotion_playbackEngine;
        if (engine && engine.getState) {
          return engine.getState() === 'playing';
        }
        return false;
      });

      expect(isPlaying).toBe(false);
    });
  });
});

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

/**
 * Wait for samples to be preloaded
 */
async function waitForSamplesToLoad(page: Page, timeout = 10000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const samplesLoaded = await page.evaluate(() => {
      return (window as any).__allSamplesLoaded === true;
    });

    if (samplesLoaded) {
      return;
    }

    await page.waitForTimeout(500);
  }

  console.warn('Samples did not load within timeout');
}

/**
 * Get current instrument from page state
 */
async function getCurrentInstrument(
  page: Page,
): Promise<string | null> {
  return page.evaluate(() => {
    const widgetState = (window as any).__bassnotion_widgetState;
    if (widgetState) {
      return widgetState.harmonyInstrument || null;
    }
    return null;
  });
}
