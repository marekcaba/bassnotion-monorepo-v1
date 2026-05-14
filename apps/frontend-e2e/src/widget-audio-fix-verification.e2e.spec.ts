import { test, expect } from './fixtures';

test.describe('Widget Audio Fix Verification', () => {
  test('verify widgets now play audio after schedule timing fix', async ({
    page,
  }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Capture all logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });

    // Monitor schedule execution and audio attempts
    await page.evaluate(() => {
      (window as any).__fixVerification = {
        scheduleCallbacks: [],
        audioAttempts: [],
        drumEvents: [],
      };

      // Monitor schedule execution
      const Tone = (window as any).Tone;
      if (Tone) {
        const originalScheduleRepeat = Tone.Transport.scheduleRepeat;
        Tone.Transport.scheduleRepeat = function (...args: any[]) {
          const [callback, interval, startTime] = args;
          console.log(
            `📅 Schedule created: interval=${interval}, startTime=${startTime || 'current'}`,
          );

          // Wrap callback to monitor execution
          const wrappedCallback = (time: number) => {
            (window as any).__fixVerification.scheduleCallbacks.push({
              time,
              interval,
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

        // Monitor drum trigger attempts
        if (
          Tone.MembraneSynth &&
          Tone.MembraneSynth.prototype.triggerAttackRelease
        ) {
          const originalTrigger =
            Tone.MembraneSynth.prototype.triggerAttackRelease;
          Tone.MembraneSynth.prototype.triggerAttackRelease = function (
            ...args: any[]
          ) {
            console.log('🥁 Drum sound triggered!', args);
            (window as any).__fixVerification.audioAttempts.push({
              type: 'MembraneSynth',
              args,
              timestamp: Date.now(),
            });
            return originalTrigger.apply(this, args);
          };
        }

        // Also monitor NoiseSynth (snare)
        if (Tone.NoiseSynth && Tone.NoiseSynth.prototype.triggerAttackRelease) {
          const originalTrigger =
            Tone.NoiseSynth.prototype.triggerAttackRelease;
          Tone.NoiseSynth.prototype.triggerAttackRelease = function (
            ...args: any[]
          ) {
            console.log('🥁 Snare sound triggered!', args);
            (window as any).__fixVerification.audioAttempts.push({
              type: 'NoiseSynth',
              args,
              timestamp: Date.now(),
            });
            return originalTrigger.apply(this, args);
          };
        }
      }
    });

    // Click play
    await page.click('button:has-text("▶️ PLAY")');

    // Wait for audio to play
    await page.waitForTimeout(5000);

    // Get results
    const results = await page.evaluate(() => {
      return (window as any).__fixVerification;
    });

    console.log('\n=== Schedule Execution Results ===');
    console.log(
      `Schedule callbacks executed: ${results.scheduleCallbacks.length}`,
    );
    console.log(`Audio attempts: ${results.audioAttempts.length}`);

    // Check for key logs
    const drumScheduleLogs = logs.filter((log) =>
      log.includes('DRUM TRANSPORT SCHEDULE EXECUTED'),
    );
    const harmonyScheduleLogs = logs.filter((log) =>
      log.includes('HARMONY TRANSPORT SCHEDULE EXECUTED'),
    );
    const triggerLogs = logs.filter(
      (log) => log.includes('Triggering') && log.includes('at subdivision'),
    );

    console.log('\n=== Widget Schedule Execution ===');
    console.log(`Drum schedule executions: ${drumScheduleLogs.length}`);
    console.log(`Harmony schedule executions: ${harmonyScheduleLogs.length}`);
    console.log(`Drum trigger attempts: ${triggerLogs.length}`);

    if (drumScheduleLogs.length > 0) {
      console.log('\n✅ DRUM SCHEDULE IS NOW EXECUTING!');
      console.log('First few drum logs:', drumScheduleLogs.slice(0, 3));
    } else {
      console.log('\n❌ DRUM SCHEDULE STILL NOT EXECUTING');
    }

    if (results.audioAttempts.length > 0) {
      console.log('\n✅ AUDIO IS NOW BEING TRIGGERED!');
      console.log(
        'First few audio attempts:',
        results.audioAttempts.slice(0, 5),
      );
    } else {
      console.log('\n❌ NO AUDIO BEING TRIGGERED');
    }

    // Check for pattern events
    const patternLogs = logs.filter(
      (log) =>
        log.includes('First 3 drum events:') || log.includes('Drum check:'),
    );

    if (patternLogs.length > 0) {
      console.log('\n=== Pattern Information ===');
      patternLogs.forEach((log) => console.log(log));
    }

    // Verify the fix worked
    expect(drumScheduleLogs.length).toBeGreaterThan(0); // Schedule should execute
    expect(results.audioAttempts.length).toBeGreaterThan(0); // Audio should play
  });
});
