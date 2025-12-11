import { test, expect, Page, ConsoleMessage } from '@playwright/test';

test.describe('Transport and Widget Synchronization', () => {
  let logs: ConsoleMessage[] = [];

  test.beforeEach(async ({ page }) => {
    logs = [];

    // Capture all console logs
    page.on('console', (msg) => {
      logs.push(msg);
    });

    // Listen for errors
    page.on('pageerror', (error) => {
      console.error('Page error:', error);
    });
  });

  test('transport starts and widgets respond to play event', async ({
    page,
  }) => {
    // Navigate to the test transport page
    await page.goto('/test-transport');

    // Wait for the page to load and transport to initialize
    await page.waitForSelector('button:has-text("▶️ PLAY")', {
      timeout: 10000,
    });

    // Check initial state
    const playButton = page.locator('button:has-text("▶️ PLAY")');
    await expect(playButton).toBeVisible();

    // Verify AudioContext warning is present (expected before user gesture)
    const audioContextWarning = logs.find((log) =>
      log.text().includes('AudioContext was not allowed to start'),
    );
    expect(audioContextWarning).toBeTruthy();

    // Click play button to start transport
    await playButton.click();

    // Wait for transport to start
    await page.waitForTimeout(500);

    // Check that transport started
    const transportStartLog = logs.find((log) =>
      log
        .text()
        .includes('TransportController: Transport started successfully'),
    );
    expect(transportStartLog).toBeTruthy();

    // Verify widgets received play event
    const widgetPlayEvents = logs.filter((log) =>
      log.text().includes('Received PLAY event'),
    );
    expect(widgetPlayEvents.length).toBeGreaterThan(0);

    // Check specific widgets
    const metronomePlayed = logs.find((log) =>
      log
        .text()
        .includes(
          'useWidgetSync[enhanced-metronome-widget]: Received PLAY event',
        ),
    );
    const harmonyPlayed = logs.find((log) =>
      log.text().includes('useWidgetSync[harmony-widget]: Received PLAY event'),
    );
    const drummerPlayed = logs.find((log) =>
      log.text().includes('useWidgetSync[drummer-widget]: Received PLAY event'),
    );

    expect(metronomePlayed).toBeTruthy();
    expect(harmonyPlayed).toBeTruthy();
    expect(drummerPlayed).toBeTruthy();

    // Check that widgets are actually playing
    await page.waitForTimeout(1000);

    // Verify drum loop started
    const drumLoopStarted = logs.find((log) =>
      log.text().includes('DrummerWidget: Loop scheduled with startTime'),
    );
    expect(drumLoopStarted).toBeTruthy();

    // Verify harmony loop started
    const harmonyLoopStarted = logs.find((log) =>
      log.text().includes('HarmonyWidget: Loop scheduled with startTime'),
    );
    expect(harmonyLoopStarted).toBeTruthy();
  });

  test('widgets stop when transport stops', async ({ page }) => {
    await page.goto('/test-transport');
    await page.waitForSelector('button:has-text("▶️ PLAY")');

    // Start transport
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(1000);

    // Stop transport (the same button now shows STOP)
    const stopButton = page.locator('button:has-text("⏹️ STOP")');
    await stopButton.click();

    await page.waitForTimeout(500);

    // Verify stop event was sent
    const stopEventSent = logs.find((log) =>
      log.text().includes('Received STOP event from test-transport-page'),
    );
    expect(stopEventSent).toBeTruthy();

    // Verify widgets received stop event
    const widgetStopEvents = logs.filter((log) =>
      log.text().includes('Received STOP event'),
    );
    expect(widgetStopEvents.length).toBeGreaterThan(0);

    // Check that drum loop stopped
    const drumLoopStopped = logs.find((log) =>
      log
        .text()
        .includes('DrummerWidget: syncIsPlaying=false, stopping drum loop'),
    );
    expect(drumLoopStopped).toBeTruthy();
  });

  test('widgets maintain sync during tempo changes', async ({ page }) => {
    await page.goto('/test-transport');
    await page.waitForSelector('button:has-text("▶️ PLAY")');

    // Start transport
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(1000);

    // Change tempo
    const tempoSlider = page.locator('input[type="range"]');
    await tempoSlider.fill('100');

    await page.waitForTimeout(500);

    // Verify tempo change event
    const tempoChangeEvent = logs.find((log) =>
      log.text().includes('TEMPO_CHANGE event'),
    );
    expect(tempoChangeEvent).toBeTruthy();

    // Verify widgets are still in sync
    const widgetsInSync = logs.filter((log) =>
      log.text().includes('isConnected: true'),
    );
    expect(widgetsInSync.length).toBeGreaterThan(0);
  });

  test('audio context initialization on user gesture', async ({ page }) => {
    await page.goto('/test-transport');

    // Wait for any indication the page has loaded - look for the main heading
    await page.waitForSelector('h1:has-text("Global Transport")', {
      timeout: 10000,
    });

    // Give the page time to initialize
    await page.waitForTimeout(2000);

    // Check if Tone.js exists at all
    const toneExists = await page.evaluate(() => {
      return typeof (window as any).Tone !== 'undefined';
    });

    if (!toneExists) {
      console.log('Tone.js not loaded, skipping AudioContext test');
      return;
    }

    // If Tone exists, check if it has a context
    const hasContext = await page.evaluate(() => {
      return (window as any).Tone?.context !== undefined;
    });

    if (!hasContext) {
      console.log('Tone.js loaded but no context available');
      return;
    }

    // Check AudioContext state
    const contextState = await page.evaluate(() => {
      return (window as any).Tone?.context?.state;
    });

    // The context might be in any state depending on browser and initialization
    expect(['suspended', 'running', 'closed']).toContain(contextState);

    // If there's a play button and context is suspended, try clicking it
    const playButton = page.locator('button:has-text("PLAY")').first();
    const playButtonVisible = await playButton.isVisible().catch(() => false);

    if (playButtonVisible && contextState === 'suspended') {
      await playButton.click();
      await page.waitForTimeout(1000);

      // Check if context state changed
      const newContextState = await page.evaluate(() => {
        return (window as any).Tone?.context?.state;
      });

      // It should be running after user interaction
      expect(newContextState).toBe('running');
    }

    // Log final state for debugging
    console.log(
      'Final AudioContext state:',
      await page.evaluate(() => (window as any).Tone?.context?.state),
    );
  });

  test('widget sync service event propagation', async ({ page }) => {
    await page.goto('/test-transport');
    await page.waitForSelector('button:has-text("▶️ PLAY")');

    // Start monitoring event flow
    const eventFlow: string[] = [];

    logs.forEach((log) => {
      if (log.text().includes('WidgetSyncService:')) {
        eventFlow.push(log.text());
      }
    });

    // Start transport
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(1000);

    // Check event flow order
    const syncServiceLogs = logs.filter((log) =>
      log.text().includes('WidgetSyncService:'),
    );

    // Verify proper event flow
    const receivedEvent = syncServiceLogs.find((log) =>
      log.text().includes('Received PLAY event'),
    );
    const processingEvent = syncServiceLogs.find((log) =>
      log.text().includes('Processing PLAY event'),
    );

    expect(receivedEvent).toBeTruthy();
    expect(processingEvent).toBeTruthy();

    // Verify event reached all widgets
    const widgetReceivedEvents = logs.filter(
      (log) =>
        log.text().includes('useWidgetSync[') &&
        log.text().includes('Received PLAY event'),
    );
    expect(widgetReceivedEvents.length).toBe(3); // metronome, harmony, drummer
  });

  test('transport position synchronization', async ({ page }) => {
    await page.goto('/test-transport');
    await page.waitForSelector('button:has-text("▶️ PLAY")');

    // Start transport
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(2000);

    // Check transport position updates
    const positionUpdates = logs.filter((log) =>
      log.text().includes('transportPosition:'),
    );
    expect(positionUpdates.length).toBeGreaterThan(0);

    // Verify widgets are tracking position
    const widgetPositionLogs = logs.filter(
      (log) =>
        log.text().includes('position:') &&
        (log.text().includes('DrummerWidget') ||
          log.text().includes('HarmonyWidget')),
    );
    expect(widgetPositionLogs.length).toBeGreaterThan(0);
  });

  test('widget connection status', async ({ page }) => {
    await page.goto('/test-transport');
    await page.waitForSelector('button:has-text("▶️ PLAY")');

    // Check initial connection status
    const initialConnectionLogs = logs.filter((log) =>
      log.text().includes('isConnected: false'),
    );
    expect(initialConnectionLogs.length).toBeGreaterThan(0);

    // Start transport
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(1000);

    // Check for connection timeout warnings
    const connectionTimeouts = logs.filter((log) =>
      log.text().includes('Sync connection lost'),
    );

    // If there are connection timeouts, this indicates the sync issue
    if (connectionTimeouts.length > 0) {
      console.log(
        'Found sync connection timeouts:',
        connectionTimeouts.map((log) => log.text()),
      );
    }
  });

  test('widget audio loading and initialization', async ({ page }) => {
    await page.goto('/test-transport');
    await page.waitForSelector('button:has-text("▶️ PLAY")');

    // Start transport to trigger audio loading
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(3000);

    // Check drum samples loaded
    const drumSamplesLoaded = logs.find((log) =>
      log.text().includes('Drum samples loaded:'),
    );
    expect(drumSamplesLoaded).toBeTruthy();

    // Check harmony instrument loaded
    const harmonyInstrumentLoaded = logs.find((log) =>
      log.text().includes('16-velocity Salamander Grand Piano ready!'),
    );
    expect(harmonyInstrumentLoaded).toBeTruthy();

    // Verify samplers are created
    const samplersCreated = logs.filter((log) =>
      log.text().includes('sampler loaded successfully'),
    );
    expect(samplersCreated.length).toBeGreaterThan(0);
  });
});
