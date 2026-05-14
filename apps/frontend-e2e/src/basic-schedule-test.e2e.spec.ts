import { test, expect } from './fixtures';

test.describe('Basic Schedule Test', () => {
  test('verify basic Tone.js schedule works at all', async ({ page }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click play to start transport
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(500);

    // Create a simple schedule test
    const scheduleResults = await page.evaluate(async () => {
      const Tone = (window as any).Tone;
      if (!Tone) {
        throw new Error('Tone.js not available');
      }

      const results = {
        transportState: Tone.Transport.state,
        contextState: Tone.context.state,
        transportSeconds: Tone.Transport.seconds,
        scheduleAttempts: [] as any[],
        scheduleFires: [] as any[],
      };

      // Try different schedule approaches
      console.log('Creating test schedules...');

      // 1. Simple scheduleRepeat with no start time
      try {
        const id1 = Tone.Transport.scheduleRepeat((time: number) => {
          results.scheduleFires.push({ type: 'repeat-no-start', time });
          console.log('✅ Schedule 1 fired (no start time):', time);
        }, '4n');
        results.scheduleAttempts.push({ type: 'repeat-no-start', id: id1 });
      } catch (e) {
        results.scheduleAttempts.push({
          type: 'repeat-no-start',
          error: e.message,
        });
      }

      // 2. scheduleRepeat with +0.1 start
      try {
        const id2 = Tone.Transport.scheduleRepeat(
          (time: number) => {
            results.scheduleFires.push({ type: 'repeat-+0.1', time });
            console.log('✅ Schedule 2 fired (+0.1 start):', time);
          },
          '4n',
          '+0.1',
        );
        results.scheduleAttempts.push({ type: 'repeat-+0.1', id: id2 });
      } catch (e) {
        results.scheduleAttempts.push({
          type: 'repeat-+0.1',
          error: e.message,
        });
      }

      // 3. Simple schedule (one-time)
      try {
        const id3 = Tone.Transport.schedule((time: number) => {
          results.scheduleFires.push({ type: 'one-time', time });
          console.log('✅ Schedule 3 fired (one-time):', time);
        }, '+0.5');
        results.scheduleAttempts.push({ type: 'one-time', id: id3 });
      } catch (e) {
        results.scheduleAttempts.push({ type: 'one-time', error: e.message });
      }

      // 4. Direct setInterval as control
      const intervalFires: number[] = [];
      const intervalId = setInterval(() => {
        intervalFires.push(Date.now());
        console.log('⏰ setInterval fired');
      }, 500);

      // Wait for schedules to fire
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Clear interval
      clearInterval(intervalId);

      // Update final state
      results.transportState = Tone.Transport.state;
      results.transportSeconds = Tone.Transport.seconds;

      // Add interval results
      (results as any).intervalFires = intervalFires.length;

      return results;
    });

    console.log('\n=== Schedule Test Results ===');
    console.log('Transport state:', scheduleResults.transportState);
    console.log('Context state:', scheduleResults.contextState);
    console.log('Transport seconds:', scheduleResults.transportSeconds);
    console.log('Schedule attempts:', scheduleResults.scheduleAttempts);
    console.log('Schedule fires:', scheduleResults.scheduleFires.length);
    console.log('setInterval fires:', (scheduleResults as any).intervalFires);

    if (scheduleResults.scheduleFires.length === 0) {
      console.log('\n❌ NO SCHEDULES FIRED AT ALL!');
      console.log(
        'This indicates a fundamental issue with Tone.Transport in the test environment.',
      );
    } else {
      console.log('\n✅ Some schedules fired:');
      scheduleResults.scheduleFires.forEach((fire) => {
        console.log(`- ${fire.type} at time ${fire.time}`);
      });
    }

    // The transport should be running
    expect(scheduleResults.transportState).toBe('started');
    expect(scheduleResults.contextState).toBe('running');
    expect(scheduleResults.transportSeconds).toBeGreaterThan(2); // Should have advanced
  });
});
