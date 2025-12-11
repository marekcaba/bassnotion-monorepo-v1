import { test, expect } from '@playwright/test';

test.describe('Widget Schedule Execution Test', () => {
  test('test if widget schedules execute after proper setup', async ({
    page,
  }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Set up comprehensive monitoring
    await page.evaluate(() => {
      (window as any).__widgetTest = {
        schedules: [],
        executions: [],
        errors: [],
      };

      const Tone = (window as any).Tone;
      if (!Tone) return;

      // Monitor scheduleRepeat with execution tracking
      const originalScheduleRepeat = Tone.Transport.scheduleRepeat;
      Tone.Transport.scheduleRepeat = function (...args: any[]) {
        const [callback, interval, startTime] = args;

        const scheduleInfo = {
          interval,
          startTime,
          createdAt: Date.now(),
          transportState: this.state,
          id: null as any,
        };

        // Wrap callback
        const wrappedCallback = (time: number) => {
          const execution = {
            scheduleId: scheduleInfo.id,
            interval,
            time,
            executedAt: Date.now(),
            transportState: Tone.Transport.state,
          };

          (window as any).__widgetTest.executions.push(execution);
          console.log(`✅ Schedule ${scheduleInfo.id} executed!`, execution);

          try {
            return callback(time);
          } catch (error) {
            (window as any).__widgetTest.errors.push({
              scheduleId: scheduleInfo.id,
              error: error.message,
            });
            throw error;
          }
        };

        try {
          const id = originalScheduleRepeat.call(
            this,
            wrappedCallback,
            interval,
            startTime,
          );
          scheduleInfo.id = id;
          (window as any).__widgetTest.schedules.push(scheduleInfo);
          console.log(`📅 Schedule ${id} created`, scheduleInfo);
          return id;
        } catch (error) {
          console.error('Schedule creation error:', error);
          throw error;
        }
      };
    });

    // Capture specific logs
    const importantLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('DRUM TRANSPORT SCHEDULE EXECUTED') ||
        text.includes('HARMONY TRANSPORT SCHEDULE EXECUTED') ||
        text.includes('Triggering') ||
        text.includes('Schedule') ||
        text.includes('executed')
      ) {
        importantLogs.push(text);
      }
    });

    // Click play
    console.log('\n=== Starting playback ===');
    await page.click('button:has-text("▶️ PLAY")');

    // Wait longer to ensure schedules have time to execute
    console.log('Waiting for schedules to execute...');
    await page.waitForTimeout(8000);

    // Get results
    const results = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        test: (window as any).__widgetTest,
        transport: {
          state: Tone?.Transport?.state,
          seconds: Tone?.Transport?.seconds,
          position: Tone?.Transport?.position?.toString(),
        },
        timeline: {
          length: Tone?.Transport?._timeline?._timeline?.length,
        },
      };
    });

    console.log('\n=== Schedule Creation Results ===');
    results.test.schedules.forEach((schedule: any) => {
      console.log(`Schedule ${schedule.id}:`);
      console.log(`  - Interval: ${schedule.interval}`);
      console.log(`  - Start time: ${schedule.startTime}`);
      console.log(`  - Created when Transport: ${schedule.transportState}`);

      const executions = results.test.executions.filter(
        (e: any) => e.scheduleId === schedule.id,
      );
      console.log(`  - Executions: ${executions.length}`);

      if (executions.length === 0 && schedule.startTime === '+0.1') {
        console.log('  ❌ Schedule with +0.1 start time NOT executing!');
      }
    });

    console.log('\n=== Transport State ===');
    console.log(results.transport);

    console.log('\n=== Timeline ===');
    console.log(`Timeline events: ${results.timeline.length}`);

    console.log('\n=== Execution Summary ===');
    console.log(`Total schedules: ${results.test.schedules.length}`);
    console.log(`Total executions: ${results.test.executions.length}`);
    console.log(`Errors: ${results.test.errors.length}`);

    if (results.test.executions.length === 0) {
      console.log('\n❌ NO SCHEDULES ARE EXECUTING!');

      // Check important logs
      console.log('\n=== Widget Logs ===');
      const widgetLogs = importantLogs
        .filter((log) => log.includes('DRUM') || log.includes('HARMONY'))
        .slice(0, 10);

      if (widgetLogs.length === 0) {
        console.log('No widget execution logs found');
      } else {
        widgetLogs.forEach((log) => console.log(log));
      }
    } else {
      console.log('\n✅ Some schedules are executing');
      console.log('Execution breakdown:');
      const byInterval = results.test.executions.reduce(
        (acc: any, exec: any) => {
          acc[exec.interval] = (acc[exec.interval] || 0) + 1;
          return acc;
        },
        {},
      );
      Object.entries(byInterval).forEach(([interval, count]) => {
        console.log(`  ${interval}: ${count} executions`);
      });
    }
  });
});
