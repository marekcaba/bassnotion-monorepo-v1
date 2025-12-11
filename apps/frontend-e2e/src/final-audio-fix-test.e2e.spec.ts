import { test, expect } from '@playwright/test';

test.describe('Final Audio Fix Test', () => {
  test('verify widgets play audio after Transport state check fix', async ({
    page,
  }) => {
    // Wait for server to start
    await page.waitForTimeout(5000);

    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Capture all logs
    const allLogs: string[] = [];
    page.on('console', (msg) => {
      allLogs.push(msg.text());
    });

    // Monitor audio playback
    await page.evaluate(() => {
      (window as any).__finalTest = {
        scheduleCreations: [],
        scheduleExecutions: [],
        audioTriggers: [],
      };

      const Tone = (window as any).Tone;
      if (Tone) {
        // Monitor schedule creation
        const originalScheduleRepeat = Tone.Transport.scheduleRepeat;
        Tone.Transport.scheduleRepeat = function (...args: any[]) {
          const [callback, interval, startTime] = args;
          const creation = {
            interval,
            startTime: startTime || 'current',
            transportState: this.state,
            timestamp: Date.now(),
          };
          (window as any).__finalTest.scheduleCreations.push(creation);

          // Wrap callback
          const wrappedCallback = (time: number) => {
            (window as any).__finalTest.scheduleExecutions.push({
              interval,
              time,
              timestamp: Date.now(),
            });
            return callback(time);
          };

          return originalScheduleRepeat.call(
            this,
            wrappedCallback,
            interval,
            startTime,
          );
        };

        // Monitor audio triggers
        ['MembraneSynth', 'NoiseSynth', 'MetalSynth'].forEach((synthType) => {
          if (
            Tone[synthType] &&
            Tone[synthType].prototype.triggerAttackRelease
          ) {
            const original = Tone[synthType].prototype.triggerAttackRelease;
            Tone[synthType].prototype.triggerAttackRelease = function (
              ...args: any[]
            ) {
              (window as any).__finalTest.audioTriggers.push({
                type: synthType,
                args,
                timestamp: Date.now(),
              });
              console.log(`🎵 ${synthType} triggered!`);
              return original.apply(this, args);
            };
          }
        });
      }
    });

    // Click play
    console.log('\n=== Starting playback ===');
    await page.click('button:has-text("▶️ PLAY")');

    // Wait for audio to play
    await page.waitForTimeout(8000);

    // Get results
    const results = await page.evaluate(() => {
      const Tone = (window as any).Tone;
      return {
        test: (window as any).__finalTest,
        transport: {
          state: Tone?.Transport?.state,
          seconds: Tone?.Transport?.seconds,
        },
      };
    });

    // Analyze logs
    const waitingLogs = allLogs.filter((log) =>
      log.includes('Transport not started yet, waiting'),
    );
    const nowStartedLogs = allLogs.filter((log) =>
      log.includes('Transport now started, creating'),
    );
    const scheduleExecutedLogs = allLogs.filter(
      (log) =>
        log.includes('DRUM TRANSPORT SCHEDULE EXECUTED') ||
        log.includes('HARMONY TRANSPORT SCHEDULE EXECUTED'),
    );
    const triggeringLogs = allLogs.filter(
      (log) => log.includes('Triggering') && log.includes('at subdivision'),
    );

    console.log('\n=== Results Summary ===');
    console.log(`Transport wait logs: ${waitingLogs.length}`);
    console.log(`Transport started logs: ${nowStartedLogs.length}`);
    console.log(
      `Schedule executions: ${results.test.scheduleExecutions.length}`,
    );
    console.log(`Audio triggers: ${results.test.audioTriggers.length}`);
    console.log(`Schedule executed logs: ${scheduleExecutedLogs.length}`);
    console.log(`Triggering logs: ${triggeringLogs.length}`);

    if (waitingLogs.length > 0) {
      console.log('\n✅ Widgets waited for Transport to start');
      waitingLogs.forEach((log) => console.log(`  - ${log}`));
    }

    if (nowStartedLogs.length > 0) {
      console.log('\n✅ Widgets created schedules after Transport started');
      nowStartedLogs.forEach((log) => console.log(`  - ${log}`));
    }

    // Check schedule creation states
    console.log('\n=== Schedule Creation States ===');
    results.test.scheduleCreations.forEach((creation: any, i: number) => {
      console.log(
        `Schedule ${i + 1}: ${creation.interval}, Transport: ${creation.transportState}`,
      );
    });

    if (results.test.audioTriggers.length > 0) {
      console.log('\n🎉 SUCCESS! Audio is playing!');
      const drumTypes: Record<string, number> = {};
      results.test.audioTriggers.forEach((trigger: any) => {
        drumTypes[trigger.type] = (drumTypes[trigger.type] || 0) + 1;
      });
      console.log('Audio breakdown:', drumTypes);
    } else {
      console.log('\n❌ Still no audio triggers');
    }

    // Success criteria
    expect(results.test.scheduleExecutions.length).toBeGreaterThan(0);
    expect(results.test.audioTriggers.length).toBeGreaterThan(0);
    expect(results.transport.state).toBe('started');
  });
});
