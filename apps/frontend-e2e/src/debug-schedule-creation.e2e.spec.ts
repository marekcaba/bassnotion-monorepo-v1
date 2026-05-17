import { test, expect } from './fixtures';

test.describe('Debug Schedule Creation', () => {
  test('check what happens when widgets create schedules', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Monitor all schedule creations
    await page.evaluate(() => {
      (window as any).__scheduleDebug = {
        creations: [],
        transportStates: [],
      };

      const Tone = (window as any).Tone;
      if (!Tone) return;

      // Monitor scheduleRepeat
      const originalScheduleRepeat = Tone.Transport.scheduleRepeat;
      Tone.Transport.scheduleRepeat = function (...args: any[]) {
        const [callback, interval, startTime] = args;
        // Typed as any so we can attach result/success/error post-call.
        // (TS would otherwise narrow the literal type and reject the
        // post-hoc property assignments below.)
        const creation: any = {
          method: 'scheduleRepeat',
          interval,
          startTime: startTime === undefined ? 'undefined' : startTime,
          transportState: this.state,
          transportSeconds: this.seconds,
          contextState: Tone.context.state,
          timestamp: Date.now(),
          stackTrace: new Error().stack,
        };

        console.log('📅 Schedule creation attempt:', creation);
        (window as any).__scheduleDebug.creations.push(creation);

        try {
          const result = originalScheduleRepeat.apply(this, args);
          creation.result = result;
          creation.success = true;
          console.log('✅ Schedule created successfully, ID:', result);
          return result;
        } catch (error) {
          creation.error = error.message;
          creation.success = false;
          console.error('❌ Schedule creation failed:', error);
          throw error;
        }
      };

      // Monitor Transport state changes
      const originalStart = Tone.Transport.start;
      Tone.Transport.start = function (...args: any[]) {
        (window as any).__scheduleDebug.transportStates.push({
          event: 'start',
          args,
          stateBefore: this.state,
          timestamp: Date.now(),
        });
        const result = originalStart.apply(this, args);
        (window as any).__scheduleDebug.transportStates.push({
          event: 'started',
          stateAfter: this.state,
          timestamp: Date.now(),
        });
        return result;
      };
    });

    // Capture logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('Widget') ||
        text.includes('schedule') ||
        text.includes('Transport')
      ) {
        logs.push(text);
      }
    });

    // Click play
    console.log('\n=== Clicking PLAY ===');
    await page.click('button:has-text("▶️ PLAY")');

    // Wait for things to happen
    await page.waitForTimeout(3000);

    // Get debug data
    const debugData = await page.evaluate(() => {
      return (window as any).__scheduleDebug;
    });

    console.log('\n=== Schedule Creations ===');
    debugData.creations.forEach((creation: any, i: number) => {
      console.log(`\nCreation ${i + 1}:`);
      console.log(`  Interval: ${creation.interval}`);
      console.log(`  Start time: ${creation.startTime}`);
      console.log(`  Transport state: ${creation.transportState}`);
      console.log(`  Success: ${creation.success}`);
      console.log(`  Result ID: ${creation.result}`);
      if (creation.error) {
        console.log(`  Error: ${creation.error}`);
      }

      // Check if it's a widget schedule
      if (creation.stackTrace?.includes('Widget')) {
        console.log('  Source: WIDGET');
      }
    });

    console.log('\n=== Transport State Changes ===');
    debugData.transportStates.forEach((state: any) => {
      console.log(`${state.event}: ${JSON.stringify(state)}`);
    });

    // Check timeline
    const timelineState = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        timelineLength: Tone?.Transport?._timeline?._timeline?.length,
        transportState: Tone?.Transport?.state,
        transportSeconds: Tone?.Transport?.seconds,
      };
    });

    console.log('\n=== Timeline State ===');
    console.log(timelineState);

    // Check for widget-specific logs
    const widgetLogs = logs.filter(
      (log) =>
        log.includes('Creating drum loop') ||
        log.includes('Transport schedule created'),
    );

    console.log('\n=== Widget Logs ===');
    widgetLogs.forEach((log) => console.log(log));
  });
});
