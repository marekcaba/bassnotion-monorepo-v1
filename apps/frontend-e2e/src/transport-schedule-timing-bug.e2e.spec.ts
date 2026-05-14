import { test, expect } from './fixtures';

test.describe('Transport Schedule Timing Bug', () => {
  test('schedules created at time 0 do not fire when transport starts at +0.1', async ({
    page,
  }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');

    // Inject a test to demonstrate the timing issue
    await page.evaluate(() => {
      const Tone = (window as any).Tone;
      if (!Tone) {
        throw new Error('Tone.js not available');
      }

      console.log('Initial AudioContext state:', Tone.context.state);
      console.log('Initial Transport state:', Tone.Transport.state);

      (window as any).__scheduleTestResults = {
        schedule0Fired: 0,
        schedule01Fired: 0,
        scheduleNowFired: 0,
        scheduleAfterStartFired: 0,
      };

      // Schedule at time 0 (what widgets do)
      const id0 = Tone.Transport.scheduleRepeat(
        (time: number) => {
          (window as any).__scheduleTestResults.schedule0Fired++;
          console.log(
            `⏰ Schedule at 0 fired! Count: ${(window as any).__scheduleTestResults.schedule0Fired}, time: ${time}`,
          );
        },
        '8n',
        0,
      );
      console.log('Schedule at 0 created with ID:', id0);

      // Schedule at time +0.1 (matching transport start time)
      const id01 = Tone.Transport.scheduleRepeat(
        (time: number) => {
          (window as any).__scheduleTestResults.schedule01Fired++;
          console.log(
            `⏰ Schedule at +0.1 fired! Count: ${(window as any).__scheduleTestResults.schedule01Fired}, time: ${time}`,
          );
        },
        '8n',
        '+0.1',
      );
      console.log('Schedule at +0.1 created with ID:', id01);

      // Schedule at "now" (should work regardless)
      const idNow = Tone.Transport.scheduleRepeat((time: number) => {
        (window as any).__scheduleTestResults.scheduleNowFired++;
        console.log(
          `⏰ Schedule at now fired! Count: ${(window as any).__scheduleTestResults.scheduleNowFired}, time: ${time}`,
        );
      }, '8n');
      console.log('Schedule at now created with ID:', idNow);

      // Store IDs for later inspection
      (window as any).__scheduleIds = { id0, id01, idNow };

      console.log('Test schedules created');
      console.log(
        'Transport timeline events:',
        Tone.Transport._timeline._timeline.length,
      );
    });

    // Start transport (which starts at +0.1)
    await page.click('button:has-text("▶️ PLAY")');

    // Wait for schedules to fire
    await page.waitForTimeout(2000);

    // Get results and transport state
    const {
      results,
      transportState,
      transportSeconds,
      contextState,
      scheduleIds,
      timelineLength,
    } = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        results: (window as any).__scheduleTestResults,
        transportState: Tone?.Transport?.state,
        transportSeconds: Tone?.Transport?.seconds,
        contextState: Tone?.context?.state,
        scheduleIds: (window as any).__scheduleIds,
        timelineLength: Tone?.Transport?._timeline?._timeline?.length || 0,
      };
    });

    console.log('\n=== Schedule Test Results ===');
    console.log(`Transport state: ${transportState}`);
    console.log(`Transport seconds: ${transportSeconds}`);
    console.log(`AudioContext state: ${contextState}`);
    console.log(`Timeline events: ${timelineLength}`);
    console.log(`Schedule at 0: ${results.schedule0Fired} fires`);
    console.log(`Schedule at +0.1: ${results.schedule01Fired} fires`);
    console.log(`Schedule at now: ${results.scheduleNowFired} fires`);
    console.log('Schedule IDs:', scheduleIds);

    // The bug: schedule at 0 won't fire because transport starts at +0.1
    if (results.schedule0Fired === 0 && results.schedule01Fired > 0) {
      console.log(
        '\n❌ BUG CONFIRMED: Schedules created at time 0 do not fire when Transport starts at +0.1!',
      );
      console.log(
        'This is why widgets only play for 1 second or not at all - their schedules never start!',
      );
    }

    // Stop transport
    await page.click('button:has-text("⏹️ STOP")');

    // Let's also try creating a schedule AFTER the transport starts
    await page.evaluate(() => {
      const Tone = (window as any).Tone;
      console.log(
        'Creating schedule after start, Transport state:',
        Tone.Transport.state,
      );
      console.log(
        'Creating schedule after start, AudioContext state:',
        Tone.context.state,
      );

      // Try scheduling after transport is already running
      const idAfter = Tone.Transport.scheduleRepeat((time: number) => {
        (window as any).__scheduleTestResults.scheduleAfterStartFired++;
        console.log(
          `⏰ Schedule created AFTER start fired! Count: ${(window as any).__scheduleTestResults.scheduleAfterStartFired}, time: ${time}`,
        );
      }, '8n');
      console.log('Schedule after start created with ID:', idAfter);
    });

    // Wait for more schedules to potentially fire
    await page.waitForTimeout(2000);

    // Get final results
    const finalResults = await page.evaluate(() => {
      return (window as any).__scheduleTestResults;
    });

    console.log('\n=== Final Results ===');
    console.log(`Schedule at 0: ${finalResults.schedule0Fired} fires`);
    console.log(`Schedule at +0.1: ${finalResults.schedule01Fired} fires`);
    console.log(`Schedule at now: ${finalResults.scheduleNowFired} fires`);
    console.log(
      `Schedule after start: ${finalResults.scheduleAfterStartFired} fires`,
    );

    // This demonstrates the bug
    expect(finalResults.schedule0Fired).toBe(0); // This is the bug!
    expect(finalResults.schedule01Fired).toBeGreaterThan(0); // This works
    expect(finalResults.scheduleNowFired).toBeGreaterThan(0); // This works
  });

  test('widgets should use +0.1 or current time for schedules', async ({
    page,
  }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check how widgets are creating their schedules
    const widgetScheduleInfo = await page.evaluate(() => {
      const logs: string[] = [];
      const originalLog = console.log;

      console.log = (...args) => {
        const message = args.join(' ');
        if (
          message.includes('scheduleRepeat') ||
          message.includes('schedule created')
        ) {
          logs.push(message);
        }
        originalLog.apply(console, args);
      };

      return { logsReady: true };
    });

    // Click play to trigger widget schedule creation
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(1000);

    // Check widget schedule creation logs
    const logs = await page.evaluate(() => {
      const logs = (window as any).__widgetScheduleLogs || [];

      // Also check the actual code
      const drumScheduleCode = document.querySelector(
        '[data-testid="drummer-widget"]',
      );
      const harmonyScheduleCode = document.querySelector(
        '[data-testid="harmony-widget"]',
      );

      return {
        logs,
        hasDrumWidget: !!drumScheduleCode,
        hasHarmonyWidget: !!harmonyScheduleCode,
      };
    });

    console.log('\n=== Widget Schedule Creation ===');
    console.log(`Found ${logs.logs.length} schedule creation logs`);
    console.log(`Drum widget present: ${logs.hasDrumWidget}`);
    console.log(`Harmony widget present: ${logs.hasHarmonyWidget}`);

    // The fix: widgets should use '+0.1' or omit the start time (defaults to "now")
    // instead of using 0
  });
});
