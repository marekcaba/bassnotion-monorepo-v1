import { test, expect } from '@playwright/test';

test.describe('Widget Schedule Bug Root Cause', () => {
  test('investigate why schedules do not fire', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');

    // Wait for initial setup
    await page.waitForTimeout(2000);

    // Capture all console logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });

    // Click play to ensure audio context is started
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(500);

    // Now test schedule creation and execution
    const scheduleTest = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      if (!Tone) {
        throw new Error('Tone.js not available');
      }

      const results = {
        contextState: Tone.context.state,
        transportState: Tone.Transport.state,
        transportPosition: Tone.Transport.position,
        transportSeconds: Tone.Transport.seconds,
        scheduleCreated: false,
        scheduleFired: false,
        immediateScheduleFired: false,
        manualTransportStarted: false,
        errors: [] as string[],
      };

      // Test 1: Create a simple schedule
      try {
        console.log('Creating test schedule...');
        const scheduleId = Tone.Transport.scheduleRepeat(
          (time: number) => {
            results.scheduleFired = true;
            console.log('🎉 Schedule fired! Time:', time);
          },
          '4n',
          0,
        );
        results.scheduleCreated = true;
        console.log('Schedule created with ID:', scheduleId);
      } catch (error) {
        results.errors.push(`Schedule creation error: ${error.message}`);
      }

      // Test 2: Create an immediate schedule
      try {
        console.log('Creating immediate schedule...');
        Tone.Transport.schedule((time: number) => {
          results.immediateScheduleFired = true;
          console.log('🎉 Immediate schedule fired! Time:', time);
        }, '+0.1');
      } catch (error) {
        results.errors.push(`Immediate schedule error: ${error.message}`);
      }

      // Test 3: Ensure transport is actually running
      if (Tone.Transport.state !== 'started') {
        console.log('Transport not started, starting manually...');
        try {
          Tone.Transport.start('+0.1');
          results.manualTransportStarted = true;
        } catch (error) {
          results.errors.push(`Transport start error: ${error.message}`);
        }
      }

      // Store results for later checking
      (window as any).__scheduleTestResults = results;

      // Also create a simple loop to test if loops work at all
      try {
        const loop = new Tone.Loop((time) => {
          console.log('🔄 Loop fired at time:', time);
        }, '4n');
        loop.start(0);
        (window as any).__testLoop = loop;
      } catch (error) {
        results.errors.push(`Loop creation error: ${error.message}`);
      }

      return results;
    });

    console.log('\n=== Initial Schedule Test Results ===');
    console.log('Context state:', scheduleTest.contextState);
    console.log('Transport state:', scheduleTest.transportState);
    console.log('Transport position:', scheduleTest.transportPosition);
    console.log('Transport seconds:', scheduleTest.transportSeconds);
    console.log('Schedule created:', scheduleTest.scheduleCreated);
    console.log(
      'Manual transport start needed:',
      scheduleTest.manualTransportStarted,
    );
    console.log('Errors:', scheduleTest.errors);

    // Wait for schedules to potentially fire
    await page.waitForTimeout(3000);

    // Check if schedules fired
    const finalResults = await page.evaluate(() => {
      const results = (window as any).__scheduleTestResults;
      const Tone = (window as any).Tone;
      const loop = (window as any).__testLoop;

      return {
        ...results,
        finalTransportState: Tone?.Transport?.state,
        finalTransportSeconds: Tone?.Transport?.seconds,
        finalContextState: Tone?.context?.state,
        loopState: loop?.state,
        timelineLength: Tone?.Transport?._timeline?._timeline?.length,
      };
    });

    console.log('\n=== Final Results After Waiting ===');
    console.log('Schedule fired:', finalResults.scheduleFired);
    console.log(
      'Immediate schedule fired:',
      finalResults.immediateScheduleFired,
    );
    console.log('Final transport state:', finalResults.finalTransportState);
    console.log('Final transport seconds:', finalResults.finalTransportSeconds);
    console.log('Final context state:', finalResults.finalContextState);
    console.log('Loop state:', finalResults.loopState);
    console.log('Timeline events:', finalResults.timelineLength);

    // Check logs for schedule execution
    const scheduleLogs = logs.filter(
      (log) =>
        log.includes('Schedule fired') ||
        log.includes('Loop fired') ||
        log.includes('schedule') ||
        log.includes('Schedule'),
    );

    console.log('\n=== Schedule-Related Logs ===');
    scheduleLogs.forEach((log) => console.log(log));

    // The bug: schedules don't fire even though transport is running
    if (
      !finalResults.scheduleFired &&
      finalResults.finalTransportState === 'started'
    ) {
      console.log(
        '\n❌ BUG CONFIRMED: Transport is running but schedules are not firing!',
      );
      console.log(
        'This explains why widgets produce no audio - their schedules never execute.',
      );
    }

    // Stop transport
    await page.click('button:has-text("⏹️ STOP")');
  });

  test('check if widget schedules are created at all', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Monitor widget schedule creation
    await page.evaluate(() => {
      (window as any).__widgetSchedules = [];

      // Intercept scheduleRepeat calls
      const Tone = (window as any).Tone;
      if (Tone) {
        const originalScheduleRepeat = Tone.Transport.scheduleRepeat;
        Tone.Transport.scheduleRepeat = function (...args: any[]) {
          console.log('🎯 scheduleRepeat called with:', args[1], args[2]);
          (window as any).__widgetSchedules.push({
            type: 'repeat',
            interval: args[1],
            startTime: args[2],
            timestamp: Date.now(),
          });
          return originalScheduleRepeat.apply(this, args);
        };
      }
    });

    // Click play to trigger widget initialization
    await page.click('button:has-text("▶️ PLAY")');

    // Wait for widgets to potentially create schedules
    await page.waitForTimeout(3000);

    // Check what schedules were created
    const widgetSchedules = await page.evaluate(() => {
      return (window as any).__widgetSchedules || [];
    });

    console.log('\n=== Widget Schedule Creation ===');
    console.log(`Total schedules created: ${widgetSchedules.length}`);
    widgetSchedules.forEach((schedule: any, index: number) => {
      console.log(`Schedule ${index + 1}:`, schedule);
    });

    if (widgetSchedules.length === 0) {
      console.log('\n❌ NO WIDGET SCHEDULES CREATED!');
      console.log(
        'This confirms widgets are not creating their audio schedules.',
      );
    }
  });
});
