import { test, expect } from '@playwright/test';

test.describe('Transport Instance Investigation', () => {
  test('deep dive into Transport instance and timing issues', async ({
    page,
  }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Capture all console logs
    const allLogs: string[] = [];
    page.on('console', (msg) => {
      allLogs.push(msg.text());
    });

    // PHASE 1: Check initial state and Transport instances
    console.log('\n=== PHASE 1: Initial State Check ===');
    const initialState = await page.evaluate(() => {
      const results: any = {
        globalTone: null,
        audioEngine: null,
        widgetTransports: {},
      };

      // Check global Tone
      const globalTone = (window as any).Tone;
      if (globalTone) {
        results.globalTone = {
          exists: true,
          transportId: globalTone.Transport._id || 'no-id',
          transportState: globalTone.Transport.state,
          contextState: globalTone.context.state,
          contextId: globalTone.context._context?.id,
        };
      }

      // Check AudioEngine
      const audioEngine = (window as any).AudioEngine;
      if (audioEngine) {
        results.audioEngine = {
          exists: true,
          hasTone: !!audioEngine.tone,
          transportId: audioEngine.tone?.Transport?._id || 'no-id',
        };
      }

      // Try to access widget internals (this is hacky but for debugging)
      const drummerWidget = document.querySelector(
        '[data-testid="drummer-widget"]',
      );
      const harmonyWidget = document.querySelector(
        '[data-testid="harmony-widget"]',
      );

      results.widgetTransports.drummer = { found: !!drummerWidget };
      results.widgetTransports.harmony = { found: !!harmonyWidget };

      return results;
    });

    console.log('Initial state:', JSON.stringify(initialState, null, 2));

    // PHASE 2: Monitor Transport start sequence
    console.log('\n=== PHASE 2: Transport Start Sequence ===');
    await page.evaluate(() => {
      (window as any).__transportMonitor = {
        events: [],
        scheduleCreations: [],
        transportStarts: [],
      };

      const Tone = (window as any).Tone;
      if (!Tone) return;

      // Monitor Transport.start calls
      const originalStart = Tone.Transport.start;
      Tone.Transport.start = function (...args: any[]) {
        const event = {
          method: 'Transport.start',
          args,
          state: this.state,
          seconds: this.seconds,
          timestamp: Date.now(),
          stackTrace: new Error().stack,
        };
        (window as any).__transportMonitor.transportStarts.push(event);
        console.log('🚀 Transport.start called:', event);
        return originalStart.apply(this, args);
      };

      // Monitor scheduleRepeat calls with more detail
      const originalScheduleRepeat = Tone.Transport.scheduleRepeat;
      Tone.Transport.scheduleRepeat = function (...args: any[]) {
        const [callback, interval, startTime] = args;
        const event = {
          method: 'scheduleRepeat',
          interval,
          startTime: startTime || 'current',
          transportState: this.state,
          transportSeconds: this.seconds,
          contextState: Tone.context.state,
          timestamp: Date.now(),
          stackTrace: new Error().stack,
        };
        (window as any).__transportMonitor.scheduleCreations.push(event);
        console.log('📅 scheduleRepeat called:', event);

        // Wrap callback to monitor execution
        const wrappedCallback = (time: number) => {
          const execEvent = {
            interval,
            time,
            transportState: Tone.Transport.state,
            transportSeconds: Tone.Transport.seconds,
            timestamp: Date.now(),
          };
          (window as any).__transportMonitor.events.push(execEvent);
          console.log('🔔 Schedule callback executed:', execEvent);
          return callback(time);
        };

        return originalScheduleRepeat.call(
          this,
          wrappedCallback,
          interval,
          startTime,
        );
      };
    });

    // Click play and monitor the sequence
    console.log('\n=== Clicking PLAY button ===');
    await page.click('button:has-text("▶️ PLAY")');

    // Wait and collect data
    await page.waitForTimeout(5000);

    // PHASE 3: Analyze collected data
    console.log('\n=== PHASE 3: Analysis ===');
    const monitorData = await page.evaluate(() => {
      return (window as any).__transportMonitor || {};
    });

    console.log(
      `\nTransport starts: ${monitorData.transportStarts?.length || 0}`,
    );
    if (monitorData.transportStarts?.length > 0) {
      monitorData.transportStarts.forEach((start: any, i: number) => {
        console.log(`Start ${i + 1}:`, {
          args: start.args,
          state: start.state,
          seconds: start.seconds,
        });
      });
    }

    console.log(
      `\nSchedule creations: ${monitorData.scheduleCreations?.length || 0}`,
    );
    if (monitorData.scheduleCreations?.length > 0) {
      monitorData.scheduleCreations.forEach((creation: any, i: number) => {
        console.log(`Schedule ${i + 1}:`, {
          interval: creation.interval,
          startTime: creation.startTime,
          transportState: creation.transportState,
          contextState: creation.contextState,
          transportSeconds: creation.transportSeconds,
        });
      });
    }

    console.log(`\nSchedule executions: ${monitorData.events?.length || 0}`);
    if (monitorData.events?.length > 0) {
      console.log('First few executions:', monitorData.events.slice(0, 5));
    }

    // PHASE 4: Check timing relationships
    console.log('\n=== PHASE 4: Timing Analysis ===');
    if (
      monitorData.transportStarts?.length > 0 &&
      monitorData.scheduleCreations?.length > 0
    ) {
      const firstStart = monitorData.transportStarts[0];
      monitorData.scheduleCreations.forEach((schedule: any, i: number) => {
        const timeDiff = schedule.timestamp - firstStart.timestamp;
        console.log(
          `Schedule ${i + 1} created ${timeDiff}ms ${timeDiff > 0 ? 'AFTER' : 'BEFORE'} Transport.start`,
        );
        console.log(
          `  - Transport state when schedule created: ${schedule.transportState}`,
        );
        console.log(
          `  - Context state when schedule created: ${schedule.contextState}`,
        );
      });
    }

    // PHASE 5: Check for widget-specific logs
    console.log('\n=== PHASE 5: Widget Logs ===');
    const widgetLogs = allLogs.filter(
      (log) =>
        log.includes('DRUM TRANSPORT SCHEDULE EXECUTED') ||
        log.includes('HARMONY TRANSPORT SCHEDULE EXECUTED') ||
        log.includes('Creating drum loop') ||
        log.includes('Transport schedule created'),
    );

    console.log(`Found ${widgetLogs.length} widget-related logs`);
    widgetLogs.forEach((log) => console.log(`- ${log}`));

    // Final check
    const finalState = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        transportState: Tone?.Transport?.state,
        transportSeconds: Tone?.Transport?.seconds,
        contextState: Tone?.context?.state,
        timelineLength: Tone?.Transport?._timeline?._timeline?.length,
      };
    });

    console.log('\n=== Final State ===');
    console.log(finalState);
  });
});
