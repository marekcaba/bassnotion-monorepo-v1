import { test, expect } from './fixtures';

test.describe('Transport 1-Second Playback Issue', () => {
  test('diagnose why transport stops after 1 second', async ({ page }) => {
    // Navigate to the actual widget page, not test page
    await page.goto('http://localhost:3001/exercises');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Allow all widgets to initialize

    // Capture all console logs
    const logs: Array<{ type: string; text: string; time: number }> = [];
    const startTime = Date.now();

    page.on('console', (msg) => {
      const text = msg.text();
      logs.push({
        type: msg.type(),
        text,
        time: Date.now() - startTime,
      });

      // Log important events
      if (
        text.includes('Transport') ||
        text.includes('stop') ||
        text.includes('STOP') ||
        text.includes('scheduled') ||
        text.includes('loop') ||
        text.includes('duration')
      ) {
        console.log(`[${Date.now() - startTime}ms] ${text}`);
      }
    });

    // Monitor network requests that might affect playback
    page.on('response', (response) => {
      if (
        response.url().includes('api') ||
        response.url().includes('exercise')
      ) {
        console.log(`[Network] ${response.status()} ${response.url()}`);
      }
    });

    // Set up monitoring before clicking play
    const monitorHandle = await page.evaluateHandle(() => {
      const monitor = {
        transportStates: [] as Array<{
          time: number;
          state: string;
          position: number;
        }>,
        loopInfo: null as any,
        scheduleIds: [] as number[],
        startTime: Date.now(),
      };

      // Monitor Transport state
      const interval = setInterval(() => {
        const Tone = (window as any).Tone;
        if (Tone?.Transport) {
          monitor.transportStates.push({
            time: Date.now() - monitor.startTime,
            state: Tone.Transport.state,
            position: Tone.Transport.seconds,
          });

          // Capture loop info once
          if (!monitor.loopInfo && Tone.Transport.loop) {
            monitor.loopInfo = {
              loop: Tone.Transport.loop,
              loopStart: Tone.Transport.loopStart,
              loopEnd: Tone.Transport.loopEnd,
            };
          }
        }
      }, 50);

      // Store for cleanup
      (window as any).__transportMonitor = { monitor, interval };

      return monitor;
    });

    // Take a screenshot to see what's on the page
    await page.screenshot({ path: 'exercise-page-debug.png' });

    // Look for play button - it's a button with specific styling on the widget page
    // The play button has a blue background and contains a Play icon
    let playButton = await page.locator('button.bg-blue-500').first();

    // Debug: log all buttons found
    const allButtons = await page.locator('button').all();
    console.log(`Found ${allButtons.length} buttons on the page`);

    // Try various selectors
    if (!(await playButton.count())) {
      console.log('No button.bg-blue-500 found');
      // Try finding button with rounded-full and blue background
      playButton = await page.locator('button.rounded-full.bg-blue-500');
    }

    if (!(await playButton.count())) {
      console.log('No button.rounded-full.bg-blue-500 found');
      // Try just any blue button
      playButton = await page.locator('button[class*="bg-blue"]');
    }

    if (!(await playButton.count())) {
      console.log('No blue buttons found, looking for play icon');
      // Look for SVG play icon
      const playIcon = await page.locator('svg path[d*="M5 3l14 9-14 9V3z"]');
      if (await playIcon.count()) {
        playButton = await playIcon.locator('..').locator('..'); // Go up to button
      }
    }

    if (!(await playButton.count())) {
      // List all button classes for debugging
      for (let i = 0; i < Math.min(10, allButtons.length); i++) {
        const classes = await allButtons[i].getAttribute('class');
        console.log(`Button ${i}: ${classes}`);
      }
      throw new Error('Could not find play button');
    }

    console.log('Clicking play button...');
    await playButton.click();

    // Wait for 5 seconds to see if it stops at 1 second
    await page.waitForTimeout(5000);

    // Get monitoring results
    const results = await page.evaluate(() => {
      const monitor = (window as any).__transportMonitor;
      if (monitor) {
        clearInterval(monitor.interval);
        return monitor.monitor;
      }
      return null;
    });

    if (!results) {
      throw new Error('No monitoring data collected');
    }

    // Analyze results
    console.log('\n=== ANALYSIS ===');
    console.log(`Total state samples: ${results.transportStates.length}`);

    // Find when transport started and stopped
    const startedIndex = results.transportStates.findIndex(
      (s) => s.state === 'started',
    );
    const stoppedIndex = results.transportStates.findIndex(
      (s, i) => i > startedIndex && s.state === 'stopped',
    );

    if (startedIndex >= 0) {
      const startedSample = results.transportStates[startedIndex];
      console.log(`Transport started at: ${startedSample.time}ms`);

      if (stoppedIndex >= 0) {
        const stoppedSample = results.transportStates[stoppedIndex];
        const playbackDuration = stoppedSample.time - startedSample.time;
        console.log(`Transport stopped at: ${stoppedSample.time}ms`);
        console.log(`Playback duration: ${playbackDuration}ms`);
        console.log(`Position reached: ${stoppedSample.position}s`);

        // Check if it stopped at ~1 second
        if (playbackDuration < 1500) {
          console.log(
            '⚠️ ISSUE CONFIRMED: Transport stopped after less than 1.5 seconds!',
          );

          // Look for clues in logs
          const stopLogs = logs.filter(
            (log) =>
              log.time >= startedSample.time &&
              log.time <= stoppedSample.time + 100 &&
              (log.text.includes('stop') || log.text.includes('STOP')),
          );

          console.log('\nLogs around stop time:');
          stopLogs.forEach((log) => {
            console.log(`  [${log.time}ms] ${log.text}`);
          });
        }
      } else {
        console.log('Transport never stopped (still playing after 5 seconds)');
      }
    } else {
      console.log('⚠️ Transport never started!');
    }

    // Check loop configuration
    if (results.loopInfo) {
      console.log('\nLoop configuration detected:');
      console.log(`  loop: ${results.loopInfo.loop}`);
      console.log(`  loopStart: ${results.loopInfo.loopStart}`);
      console.log(`  loopEnd: ${results.loopInfo.loopEnd}`);

      // Check if loopEnd is set to 1 second
      if (
        typeof results.loopInfo.loopEnd === 'string' &&
        results.loopInfo.loopEnd.includes(':')
      ) {
        // Parse transport time format
        const parts = results.loopInfo.loopEnd.split(':');
        if (parts[0] === '0' && parts[1] === '0') {
          console.log('⚠️ WARNING: Loop end is set to a very short duration!');
        }
      }
    }

    // Look for schedule-related logs
    const scheduleLogs = logs.filter(
      (log) => log.text.includes('schedule') || log.text.includes('Schedule'),
    );

    if (scheduleLogs.length > 0) {
      console.log('\nSchedule-related logs:');
      scheduleLogs.forEach((log) => {
        console.log(`  [${log.time}ms] ${log.text}`);
      });
    }

    // Check for any errors
    const errorLogs = logs.filter((log) => log.type === 'error');
    if (errorLogs.length > 0) {
      console.log('\nErrors detected:');
      errorLogs.forEach((log) => {
        console.log(`  [${log.time}ms] ${log.text}`);
      });
    }

    // Get final transport state
    const finalState = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      if (!Tone?.Transport) return null;

      return {
        state: Tone.Transport.state,
        position: Tone.Transport.position,
        seconds: Tone.Transport.seconds,
        loop: Tone.Transport.loop,
        loopEnd: Tone.Transport.loopEnd,
        bpm: Tone.Transport.bpm.value,
      };
    });

    console.log('\nFinal Transport state:', finalState);

    // Try to get exercise info
    const exerciseInfo = await page.evaluate(() => {
      // Try different ways to get exercise info
      const syncService = (window as any).widgetSyncService;
      if (syncService?.getSyncState) {
        const state = syncService.getSyncState();
        return state.exercise?.selectedExercise;
      }
      return null;
    });

    if (exerciseInfo) {
      console.log('\nExercise info:');
      console.log(`  Title: ${exerciseInfo.title}`);
      console.log(`  Duration: ${exerciseInfo.duration}ms`);
      console.log(`  Duration beats: ${exerciseInfo.duration_beats}`);
      console.log(`  BPM: ${exerciseInfo.bpm}`);
    }
  });

  test('compare transport behavior: test page vs widget page', async ({
    browser,
  }) => {
    const context = await browser.newContext();

    // Test on both pages in parallel
    const [testPageResults, widgetPageResults] = await Promise.all([
      testTransportOnPage(
        context,
        'http://localhost:3001/test-transport',
        'Test Page',
      ),
      testTransportOnPage(
        context,
        'http://localhost:3001/exercises',
        'Widget Page',
      ),
    ]);

    // Compare results
    console.log('\n=== COMPARISON ===');
    console.log('Test Page:');
    console.log(`  Playback duration: ${testPageResults.duration}ms`);
    console.log(`  Final position: ${testPageResults.finalPosition}s`);
    console.log(`  Stopped: ${testPageResults.stopped}`);

    console.log('\nWidget Page:');
    console.log(`  Playback duration: ${widgetPageResults.duration}ms`);
    console.log(`  Final position: ${widgetPageResults.finalPosition}s`);
    console.log(`  Stopped: ${widgetPageResults.stopped}`);

    if (testPageResults.duration > 5000 && widgetPageResults.duration < 2000) {
      console.log(
        '\n⚠️ ISSUE CONFIRMED: Widget page stops early while test page continues!',
      );
    }

    await context.close();
  });
});

async function testTransportOnPage(context: any, url: string, name: string) {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Start monitoring
  await page.evaluate(() => {
    (window as any).__startTime = Date.now();
    (window as any).__transportStarted = false;
    (window as any).__transportStopped = false;
    (window as any).__startPosition = 0;
    (window as any).__stopPosition = 0;

    const checkInterval = setInterval(() => {
      const Tone = (window as any).Tone;
      if (!Tone?.Transport) return;

      if (
        Tone.Transport.state === 'started' &&
        !(window as any).__transportStarted
      ) {
        (window as any).__transportStarted = Date.now();
        (window as any).__startPosition = Tone.Transport.seconds;
      }

      if (
        Tone.Transport.state === 'stopped' &&
        (window as any).__transportStarted &&
        !(window as any).__transportStopped
      ) {
        (window as any).__transportStopped = Date.now();
        (window as any).__stopPosition = Tone.Transport.seconds;
        clearInterval(checkInterval);
      }
    }, 50);

    (window as any).__checkInterval = checkInterval;
  });

  // Find and click play button
  let playButton;
  if (url.includes('test-transport')) {
    // Test page uses text-based button
    playButton = await page
      .locator('button')
      .filter({ hasText: /play|▶/i })
      .first();
  } else {
    // Widget page uses styled button with icon
    playButton = await page.locator('button.bg-blue-500').first();
    if (!(await playButton.isVisible())) {
      const globalControls = await page.locator('.bg-slate-800.rounded-2xl');
      playButton = await globalControls.locator('button').nth(3);
    }
  }

  await playButton.click();

  // Wait 5 seconds
  await page.waitForTimeout(5000);

  // Get results
  const results = await page.evaluate(() => {
    clearInterval((window as any).__checkInterval);

    const started = (window as any).__transportStarted;
    const stopped = (window as any).__transportStopped;
    const startPos = (window as any).__startPosition;
    const stopPos = (window as any).__stopPosition;

    return {
      started: started ? started - (window as any).__startTime : 0,
      stopped: stopped ? stopped - (window as any).__startTime : 0,
      duration: started && stopped ? stopped - started : started ? 5000 : 0,
      finalPosition: stopped
        ? stopPos
        : (window as any).Tone?.Transport?.seconds || 0,
      stopped: !!stopped,
    };
  });

  await page.close();
  return results;
}
