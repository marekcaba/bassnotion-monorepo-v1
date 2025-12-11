import { test, expect } from '@playwright/test';

test.describe('Transport Stopped Schedule Bug', () => {
  test('verify schedules created when Transport is stopped dont work', async ({
    page,
  }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test different scheduling scenarios
    const testResults = await page.evaluate(async () => {
      const Tone = (window as any).Tone;
      if (!Tone) throw new Error('Tone.js not available');

      const results = {
        scenarios: [] as any[],
      };

      // Ensure context is running
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }

      // SCENARIO 1: Schedule when Transport is STOPPED (widget scenario)
      console.log('\n=== SCENARIO 1: Schedule when Transport STOPPED ===');

      let scenario1Fires = 0;
      const id1 = Tone.Transport.scheduleRepeat((time: number) => {
        scenario1Fires++;
        console.log('✅ Scenario 1 fired!', time);
      }, '4n'); // No start time = "current"

      console.log('Created schedule while stopped:', {
        transportState: Tone.Transport.state,
        scheduleId: id1,
      });

      // Now start Transport
      Tone.Transport.start('+0.1');

      // Wait for potential fires
      await new Promise((resolve) => setTimeout(resolve, 2000));

      results.scenarios.push({
        name: 'Schedule when stopped',
        fires: scenario1Fires,
        transportStateAtCreation: 'stopped',
      });

      // Stop and clear
      Tone.Transport.stop();
      Tone.Transport.clear(id1);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // SCENARIO 2: Schedule AFTER Transport is STARTED
      console.log('\n=== SCENARIO 2: Schedule AFTER Transport STARTED ===');

      // Start Transport first
      Tone.Transport.start('+0.1');
      await new Promise((resolve) => setTimeout(resolve, 200));

      let scenario2Fires = 0;
      const id2 = Tone.Transport.scheduleRepeat((time: number) => {
        scenario2Fires++;
        console.log('✅ Scenario 2 fired!', time);
      }, '4n');

      console.log('Created schedule while started:', {
        transportState: Tone.Transport.state,
        scheduleId: id2,
      });

      // Wait for fires
      await new Promise((resolve) => setTimeout(resolve, 2000));

      results.scenarios.push({
        name: 'Schedule after started',
        fires: scenario2Fires,
        transportStateAtCreation: 'started',
      });

      // Stop and clear
      Tone.Transport.stop();
      Tone.Transport.clear(id2);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // SCENARIO 3: Schedule with explicit start time when stopped
      console.log('\n=== SCENARIO 3: Schedule with +0.1 when STOPPED ===');

      let scenario3Fires = 0;
      const id3 = Tone.Transport.scheduleRepeat(
        (time: number) => {
          scenario3Fires++;
          console.log('✅ Scenario 3 fired!', time);
        },
        '4n',
        '+0.1',
      );

      console.log('Created schedule with +0.1 while stopped:', {
        transportState: Tone.Transport.state,
        scheduleId: id3,
      });

      // Start Transport
      Tone.Transport.start('+0.1');

      // Wait for fires
      await new Promise((resolve) => setTimeout(resolve, 2000));

      results.scenarios.push({
        name: 'Schedule with +0.1 when stopped',
        fires: scenario3Fires,
        transportStateAtCreation: 'stopped',
      });

      // Clean up
      Tone.Transport.stop();
      Tone.Transport.clear(id3);

      return results;
    });

    console.log('\n=== TEST RESULTS ===');
    testResults.scenarios.forEach((scenario) => {
      console.log(`${scenario.name}:`);
      console.log(
        `  - Transport state at creation: ${scenario.transportStateAtCreation}`,
      );
      console.log(`  - Fires: ${scenario.fires}`);
      console.log(
        `  - Result: ${scenario.fires > 0 ? '✅ WORKS' : '❌ BROKEN'}`,
      );
    });

    // The bug: schedules created when Transport is stopped don't work
    const stoppedScenario = testResults.scenarios.find(
      (s) => s.name === 'Schedule when stopped',
    );
    const startedScenario = testResults.scenarios.find(
      (s) => s.name === 'Schedule after started',
    );

    if (stoppedScenario?.fires === 0 && startedScenario?.fires > 0) {
      console.log(
        '\n❌ BUG CONFIRMED: Schedules created when Transport is stopped DO NOT WORK!',
      );
      console.log(
        "This is why widget audio doesn't play - widgets create schedules before Transport starts.",
      );
    }
  });
});
