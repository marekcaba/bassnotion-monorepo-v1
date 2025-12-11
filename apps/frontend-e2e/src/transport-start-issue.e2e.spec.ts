import { test, expect } from '@playwright/test';

test.describe('Transport Start Issue', () => {
  test('investigate why Transport.start doesnt actually start', async ({
    page,
  }) => {
    await page.goto('http://localhost:3001/test-transport');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test Transport.start directly
    console.log('\n=== Testing Transport.start directly ===');

    const startTest = await page.evaluate(async () => {
      const Tone = (window as any).Tone;
      if (!Tone) throw new Error('Tone.js not available');

      const results = {
        beforeStart: {},
        afterStart: {},
        afterWait: {},
        manualStart: {},
      };

      // Check initial state
      results.beforeStart = {
        transportState: Tone.Transport.state,
        contextState: Tone.context.state,
        seconds: Tone.Transport.seconds,
      };

      console.log('Before start:', results.beforeStart);

      // Try to start Transport
      console.log('Calling Transport.start("+0.1")...');
      Tone.Transport.start('+0.1');

      // Check immediately after
      results.afterStart = {
        transportState: Tone.Transport.state,
        contextState: Tone.context.state,
        seconds: Tone.Transport.seconds,
      };

      console.log('After start:', results.afterStart);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 200));

      results.afterWait = {
        transportState: Tone.Transport.state,
        contextState: Tone.context.state,
        seconds: Tone.Transport.seconds,
      };

      console.log('After wait:', results.afterWait);

      // If still stopped, try starting without delay
      if (results.afterWait.transportState === 'stopped') {
        console.log('Transport still stopped, trying immediate start...');
        Tone.Transport.start();

        await new Promise((resolve) => setTimeout(resolve, 200));

        results.manualStart = {
          transportState: Tone.Transport.state,
          contextState: Tone.context.state,
          seconds: Tone.Transport.seconds,
        };

        console.log('After manual start:', results.manualStart);
      }

      return results;
    });

    console.log('\n=== Direct Transport.start Results ===');
    console.log(JSON.stringify(startTest, null, 2));

    // Now test through the UI
    console.log('\n\n=== Testing through UI ===');

    // Monitor what happens when clicking play
    await page.evaluate(() => {
      (window as any).__transportDebug = [];

      const Tone = (window as any).Tone;
      if (!Tone) return;

      // Monitor all Transport method calls
      ['start', 'stop', 'pause', 'cancel'].forEach((method) => {
        const original = Tone.Transport[method];
        Tone.Transport[method] = function (...args: any[]) {
          const debug = {
            method,
            args,
            stateBefore: this.state,
            secondsBefore: this.seconds,
            timestamp: Date.now(),
          };

          console.log(`🎵 Transport.${method} called:`, debug);
          (window as any).__transportDebug.push(debug);

          const result = original.apply(this, args);

          debug.stateAfter = this.state;
          debug.secondsAfter = this.seconds;

          return result;
        };
      });
    });

    // Click play
    await page.click('button:has-text("▶️ PLAY")');
    await page.waitForTimeout(1000);

    // Get debug info
    const transportDebug = await page.evaluate(() => {
      return {
        debug: (window as any).__transportDebug,
        finalState: {
          transportState: (window as any).Tone?.Transport?.state,
          seconds: (window as any).Tone?.Transport?.seconds,
          contextState: (window as any).Tone?.context?.state,
        },
      };
    });

    console.log('\n=== UI Transport Calls ===');
    transportDebug.debug.forEach((call: any) => {
      console.log(`${call.method}:`, {
        args: call.args,
        stateBefore: call.stateBefore,
        stateAfter: call.stateAfter,
      });
    });

    console.log('\n=== Final State ===');
    console.log(transportDebug.finalState);

    // Check if there's a pattern
    if (
      transportDebug.finalState.transportState === 'started' &&
      transportDebug.debug.some((d: any) => d.stateAfter === 'stopped')
    ) {
      console.log(
        '\n⚠️ Transport.start is being called but not taking effect immediately!',
      );
      console.log('This could be due to the +0.1 delay or async behavior.');
    }
  });
});
