import { test, expect } from '@playwright/test';

test.describe('Harmony Sound Test', () => {
  test('test if harmony widget produces sound after fix', async ({ page }) => {
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

    // Monitor Sampler creation and playback
    await page.evaluate(() => {
      (window as any).__harmonyTest = {
        samplerTriggers: [],
      };

      const Tone = (window as any).Tone;
      if (!Tone || !Tone.Sampler) return;

      // Monitor all triggerAttackRelease calls on Sampler prototype
      const originalTrigger = Tone.Sampler.prototype.triggerAttackRelease;
      Tone.Sampler.prototype.triggerAttackRelease = function (...args: any[]) {
        const [note, duration, time, velocity] = args;
        const trigger = {
          note,
          duration,
          time,
          velocity,
          loaded: this.loaded,
          timestamp: Date.now(),
        };
        (window as any).__harmonyTest.samplerTriggers.push(trigger);
        console.log('🎹 Sampler.triggerAttackRelease called:', trigger);
        return originalTrigger.apply(this, args);
      };
    });

    // Click play
    console.log('\n=== Starting playback ===');
    await page.click('button:has-text("▶️ PLAY")');

    // Wait for chord playback
    await page.waitForTimeout(8000);

    // Get results
    const results = await page.evaluate(() => {
      return (window as any).__harmonyTest || {};
    });

    // Check logs
    const harmonyLogs = allLogs.filter(
      (log) => log.includes('HARMONY') || log.includes('Harmony'),
    );

    const playChordLogs = allLogs.filter((log) =>
      log.includes('ATTEMPTING TO PLAY'),
    );

    const successLogs = allLogs.filter((log) =>
      log.includes('SUCCESS: playChord called'),
    );

    const loadedStateLogs = allLogs.filter((log) =>
      log.includes('Processor loaded state:'),
    );

    const errorLogs = allLogs.filter((log) => log.includes('ERROR playing'));

    console.log('\n=== Harmony Execution Summary ===');
    console.log(`Play attempts: ${playChordLogs.length}`);
    console.log(`Success calls: ${successLogs.length}`);
    console.log(`Sampler triggers: ${results.samplerTriggers?.length || 0}`);
    console.log(`Errors: ${errorLogs.length}`);

    if (playChordLogs.length > 0) {
      console.log('\nFirst play attempt:');
      console.log(playChordLogs[0]);
    }

    if (loadedStateLogs.length > 0) {
      console.log('\nProcessor loaded states:');
      loadedStateLogs.slice(0, 3).forEach((log) => console.log(log));
    }

    if (results.samplerTriggers?.length > 0) {
      console.log('\n✅ HARMONY IS PRODUCING SOUND!');
      console.log(`Total notes played: ${results.samplerTriggers.length}`);
      console.log('First few notes:', results.samplerTriggers.slice(0, 3));

      // Check if samples were loaded
      const loadedTriggers = results.samplerTriggers.filter(
        (t: any) => t.loaded,
      );
      const unloadedTriggers = results.samplerTriggers.filter(
        (t: any) => !t.loaded,
      );
      console.log(`  - With loaded samples: ${loadedTriggers.length}`);
      console.log(`  - Without loaded samples: ${unloadedTriggers.length}`);
    } else {
      console.log('\n❌ No sampler triggers detected');
    }

    if (errorLogs.length > 0) {
      console.log('\n=== Errors ===');
      errorLogs.forEach((log) => console.log(log));
    }

    // Check for initialization logs
    const initLogs = allLogs.filter(
      (log) =>
        log.includes('processor initialized') ||
        log.includes('processor ready'),
    );

    if (initLogs.length > 0) {
      console.log('\n=== Initialization ===');
      initLogs.forEach((log) => console.log(log));
    }

    // Check for loading logs
    const loadingLogs = allLogs.filter((log) =>
      log.includes('Loading 16-velocity Salamander'),
    );

    if (loadingLogs.length > 0) {
      console.log('\n=== Sample Loading ===');
      loadingLogs.forEach((log) => console.log(log));
    }
  });
});
