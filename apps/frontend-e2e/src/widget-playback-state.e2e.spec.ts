import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

test.describe('Widget Playback State Synchronization', () => {
  let page: Page;
  let logs: string[] = [];

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    logs = [];

    // Capture all console logs
    page.on('console', (msg) => {
      const text = msg.text();
      logs.push(text);

      // Log important sync-related messages
      if (
        text.includes('Sync') ||
        text.includes('isPlaying') ||
        text.includes('Transport')
      ) {
        console.log('[LOG]', text);
      }
    });
  });

  test('widgets start playing when transport starts', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Add data attributes for testing
    await page.evaluate(() => {
      // Expose widget states for testing
      (window as any).__widgetStates = {
        metronome: { isPlaying: false },
        harmony: { isPlaying: false },
        drummer: { isPlaying: false },
      };
    });

    // Click play button
    await page.click('[data-testid="play-button"]');

    // Wait for transport to start
    await page.waitForFunction(
      () => {
        const Tone = (window as any).Tone;
        return Tone?.Transport?.state === 'started';
      },
      { timeout: 5000 },
    );

    // Check that widgets received play event
    await page.waitForTimeout(1000);

    // Verify play events were received
    const metronomePlay = logs.find((log) =>
      log.includes(
        'useWidgetSync[enhanced-metronome-widget]: Received PLAY event',
      ),
    );
    const harmonyPlay = logs.find((log) =>
      log.includes('useWidgetSync[harmony-widget]: Received PLAY event'),
    );
    const drummerPlay = logs.find((log) =>
      log.includes('useWidgetSync[drummer-widget]: Received PLAY event'),
    );

    expect(metronomePlay).toBeTruthy();
    expect(harmonyPlay).toBeTruthy();
    expect(drummerPlay).toBeTruthy();

    // Check for the specific issue: "Transport is playing but isPlaying is false"
    const syncIssue = logs.find((log) =>
      log.includes('Transport is playing but isPlaying is false'),
    );

    if (syncIssue) {
      console.error('SYNC ISSUE DETECTED:', syncIssue);
    }

    // Verify actual playback started
    const drumLoopStarted = logs.find((log) =>
      log.includes('DrummerWidget: Loop scheduled with startTime'),
    );
    const harmonyStarted = logs.find((log) =>
      log.includes('HarmonyWidget: Starting playback'),
    );

    expect(drumLoopStarted).toBeTruthy();
    expect(harmonyStarted).toBeTruthy();
  });

  test('widgets maintain correct isPlaying state', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Monitor isPlaying state changes
    const isPlayingLogs = logs.filter((log) => log.includes('isPlaying'));

    // Start transport
    await page.click('[data-testid="play-button"]');
    await page.waitForTimeout(1000);

    // Check isPlaying states in logs
    const playingStates = logs.filter(
      (log) =>
        log.includes('syncProps.isPlaying: true') ||
        log.includes('final syncIsPlaying: true'),
    );

    expect(playingStates.length).toBeGreaterThan(0);

    // Stop transport
    await page.click('[data-testid="stop-button"]');
    await page.waitForTimeout(500);

    // Check stopped states
    const stoppedStates = logs.filter(
      (log) =>
        log.includes('syncProps.isPlaying: false') ||
        log.includes('final syncIsPlaying: false'),
    );

    expect(stoppedStates.length).toBeGreaterThan(0);
  });

  test('widget sync connection status', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Start playback
    await page.click('[data-testid="play-button"]');

    // Wait for potential sync timeout (30 seconds as per the error)
    console.log('Waiting for sync connection timeout...');
    await page.waitForTimeout(31000);

    // Check for sync connection lost
    const connectionLost = logs.filter((log) =>
      log.includes('Sync connection lost'),
    );

    if (connectionLost.length > 0) {
      console.error('CRITICAL: Sync connection lost detected!');
      connectionLost.forEach((log) => {
        const match = log.match(/\((\d+)ms since last sync\)/);
        if (match) {
          console.error(`Widget lost sync after ${match[1]}ms`);
        }
      });

      // This is the main issue - widgets lose sync connection
      expect(connectionLost.length).toBe(0); // This will fail, showing the issue
    }
  });

  test('transport state vs widget state mismatch', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Start transport
    await page.click('[data-testid="play-button"]');
    await page.waitForTimeout(1000);

    // Check for state mismatches
    const stateLogs = logs.filter((log) => log.includes('Sync state changed'));

    // Look for the specific mismatch pattern
    stateLogs.forEach((log) => {
      if (
        log.includes("Transport?.state: 'started'") &&
        log.includes('isConnected: false')
      ) {
        console.error(
          'MISMATCH: Transport is started but widget is not connected!',
        );
      }
      if (
        log.includes("Transport?.state: 'stopped'") &&
        log.includes('syncProps.isPlaying: true')
      ) {
        console.error('MISMATCH: Transport is stopped but sync says playing!');
      }
    });

    // Check if widgets ever become connected
    const connectedLogs = logs.filter((log) =>
      log.includes('isConnected: true'),
    );

    expect(connectedLogs.length).toBeGreaterThan(0);
  });

  test('widget event processing performance', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Start transport
    await page.click('[data-testid="play-button"]');
    await page.waitForTimeout(500);

    // Check event processing times
    const processingTimes = logs.filter(
      (log) => log.includes('Processed event') && log.includes('ms'),
    );

    processingTimes.forEach((log) => {
      const match = log.match(/Processed event \w+ in ([\d.]+)ms/);
      if (match) {
        const time = parseFloat(match[1]);
        expect(time).toBeLessThan(10); // Should be very fast
      }
    });
  });

  test('widget loop scheduling', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Start transport
    await page.click('[data-testid="play-button"]');
    await page.waitForTimeout(2000);

    // Check loop scheduling
    const loopScheduleLogs = logs.filter((log) =>
      log.includes('Loop scheduled with startTime'),
    );

    expect(loopScheduleLogs.length).toBeGreaterThan(0);

    // Check if loops actually started
    const loopStartedLogs = logs.filter((log) =>
      log.includes("loopState: 'started'"),
    );

    expect(loopStartedLogs.length).toBeGreaterThan(0);

    // Check for immediate start (startTime: 0)
    const immediateStarts = loopScheduleLogs.filter((log) =>
      log.includes('startTime: 0'),
    );

    if (immediateStarts.length > 0) {
      console.log('Loops starting immediately (good)');
    }
  });

  test('transport position tracking', async () => {
    await page.goto('/test-transport');
    await page.waitForLoadState('networkidle');

    // Start transport
    await page.click('[data-testid="play-button"]');

    // Let it play for a bit
    await page.waitForTimeout(3000);

    // Check transport position logs
    const positionLogs = logs.filter((log) =>
      log.includes('transportPosition:'),
    );

    // Verify position is advancing
    const positions: string[] = [];
    positionLogs.forEach((log) => {
      const match = log.match(/transportPosition: '([^']+)'/);
      if (match) {
        positions.push(match[1]);
      }
    });

    // Should have different positions
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBeGreaterThan(1);

    // Check if position starts at 0:0:0
    if (positions.length > 0 && positions[0] !== '0:0:0') {
      console.warn('Transport not starting from beginning:', positions[0]);
    }
  });
});
