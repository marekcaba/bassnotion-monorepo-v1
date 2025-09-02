/**
 * Real Transport Scheduling Tests
 *
 * Tests actual Tone.Transport.scheduleRepeat behavior to debug why
 * schedules stop after the first callback
 *
 * IMPORTANT: This test uses real Tone.js, not mocks!
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';

// We'll dynamically import Tone.js to avoid mocks
let Tone: typeof import('tone');

describe('Transport.scheduleRepeat - Real Behavior Tests', () => {
  beforeAll(async () => {
    // Dynamically import Tone.js to get the real implementation
    Tone = await import('tone');
    console.log('Loaded real Tone.js version:', Tone.version);
  });

  beforeEach(async () => {
    if (!Tone) {
      throw new Error('Tone.js not loaded');
    }

    // Initialize audio context
    await Tone.start();

    // Reset Transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = 120;
  });

  afterEach(async () => {
    if (Tone) {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      await Tone.getContext().close();
    }
  });

  it('should execute callbacks repeatedly when Transport is running', async () => {
    const callbacks: Array<{
      time: number;
      iteration: number;
      position: string;
    }> = [];
    let iteration = 0;

    const scheduleId = Tone.Transport.scheduleRepeat(
      (time) => {
        callbacks.push({
          time,
          iteration: iteration++,
          position: Tone.Transport.position.toString(),
        });
        console.log(
          `Callback ${iteration}: time=${time}, position=${Tone.Transport.position}`,
        );
      },
      '8n',
      0,
    );

    // Start transport with small delay (like in the app)
    Tone.Transport.start('+0.1');

    // Wait for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    Tone.Transport.clear(scheduleId);
    Tone.Transport.stop();

    console.log('Total callbacks:', callbacks.length);
    console.log('First 5 callbacks:', callbacks.slice(0, 5));

    // At 120 BPM, 8n = 0.25 seconds, so in 2 seconds we should get ~8 callbacks
    expect(callbacks.length).toBeGreaterThanOrEqual(6);

    // Verify iterations increment
    expect(callbacks[0].iteration).toBe(0);
    expect(callbacks[1].iteration).toBe(1);
    expect(callbacks[2].iteration).toBe(2);
  });

  it('should handle multiple simultaneous schedules', async () => {
    const schedule1Callbacks: number[] = [];
    const schedule2Callbacks: number[] = [];

    const id1 = Tone.Transport.scheduleRepeat(
      (time) => {
        schedule1Callbacks.push(time);
      },
      '8n',
      0,
    );

    const id2 = Tone.Transport.scheduleRepeat(
      (time) => {
        schedule2Callbacks.push(time);
      },
      '4n',
      0,
    );

    Tone.Transport.start();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    Tone.Transport.clear(id1);
    Tone.Transport.clear(id2);
    Tone.Transport.stop();

    // Both schedules should have callbacks
    expect(schedule1Callbacks.length).toBeGreaterThan(2);
    expect(schedule2Callbacks.length).toBeGreaterThan(1);

    // Schedule 1 (8n) should have roughly twice as many callbacks as schedule 2 (4n)
    const ratio = schedule1Callbacks.length / schedule2Callbacks.length;
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(2.5);
  });

  it('should continue scheduling after clearing and recreating', async () => {
    const callbacks: number[] = [];

    // First schedule
    let scheduleId = Tone.Transport.scheduleRepeat(
      (time) => {
        callbacks.push(time);
      },
      '8n',
      0,
    );

    Tone.Transport.start();

    // Wait for some callbacks
    await new Promise((resolve) => setTimeout(resolve, 500));

    const callbacksBeforeClear = callbacks.length;
    expect(callbacksBeforeClear).toBeGreaterThan(0);

    // Clear and recreate (simulating React re-render)
    Tone.Transport.clear(scheduleId);

    scheduleId = Tone.Transport.scheduleRepeat(
      (time) => {
        callbacks.push(time);
      },
      '8n',
      0,
    );

    // Wait for more callbacks
    await new Promise((resolve) => setTimeout(resolve, 500));

    Tone.Transport.clear(scheduleId);
    Tone.Transport.stop();

    // Should have callbacks from both periods
    expect(callbacks.length).toBeGreaterThan(callbacksBeforeClear);
    console.log(
      `Callbacks before clear: ${callbacksBeforeClear}, total: ${callbacks.length}`,
    );
  });

  it('should handle Transport state changes correctly', async () => {
    const callbacks: Array<{ time: number; transportState: string }> = [];

    const scheduleId = Tone.Transport.scheduleRepeat(
      (time) => {
        callbacks.push({
          time,
          transportState: Tone.Transport.state,
        });
      },
      '8n',
      0,
    );

    // Start
    Tone.Transport.start();
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Pause
    Tone.Transport.pause();
    const callbacksBeforePause = callbacks.length;
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Resume
    Tone.Transport.start();
    await new Promise((resolve) => setTimeout(resolve, 300));

    Tone.Transport.clear(scheduleId);
    Tone.Transport.stop();

    // Should have callbacks before pause
    expect(callbacksBeforePause).toBeGreaterThan(0);

    // Should not have callbacks during pause
    const callbacksDuringPause = callbacks.filter(
      (_, index) =>
        index >= callbacksBeforePause &&
        callbacks[index].transportState === 'paused',
    ).length;
    expect(callbacksDuringPause).toBe(0);

    // Should resume callbacks after pause
    expect(callbacks.length).toBeGreaterThan(callbacksBeforePause);
  });

  it('reproduces the exact issue from the app', async () => {
    const logs: string[] = [];

    // Simulate exact DrummerWidget behavior
    console.log('Starting test that reproduces the app issue...');

    const scheduleId = Tone.Transport.scheduleRepeat(
      (time) => {
        const log = `🥁🥁 DRUM TRANSPORT SCHEDULE EXECUTED! {time: ${time}, loopIteration: ${logs.length}, transportState: '${Tone.Transport.state}'}`;
        logs.push(log);
        console.log(log);
      },
      '8n',
      0,
    );

    // Start with delay like in the app
    Tone.Transport.start('+0.1');

    // Wait and check periodically
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      console.log(
        `After ${(i + 1) * 400}ms: ${logs.length} callbacks, Transport.state: ${Tone.Transport.state}`,
      );
    }

    Tone.Transport.clear(scheduleId);
    Tone.Transport.stop();

    // The issue: only getting 1 callback
    console.log('Total callbacks received:', logs.length);
    console.log('All logs:', logs);

    // This test should FAIL if it reproduces the issue
    expect(logs.length).toBeGreaterThan(1);
  });

  it('tests scheduleRepeat with immediate start (no +0.1 delay)', async () => {
    const callbacks: number[] = [];

    const scheduleId = Tone.Transport.scheduleRepeat(
      (time) => {
        callbacks.push(time);
        console.log(`Immediate start callback at time: ${time}`);
      },
      '8n',
      0,
    );

    // Start immediately (no delay)
    Tone.Transport.start();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    Tone.Transport.clear(scheduleId);
    Tone.Transport.stop();

    console.log(`Immediate start test: ${callbacks.length} callbacks`);
    expect(callbacks.length).toBeGreaterThan(3);
  });

  it('tests if Transport is actually running after start', async () => {
    Tone.Transport.start('+0.1');

    // Check state immediately
    console.log('State immediately after start:', Tone.Transport.state);

    // Check state after delay
    await new Promise((resolve) => setTimeout(resolve, 150));
    console.log('State after 150ms:', Tone.Transport.state);
    expect(Tone.Transport.state).toBe('started');

    // Monitor Transport.seconds progression
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      times.push(Tone.Transport.seconds);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('Transport.seconds progression:', times);

    // Seconds should be increasing
    expect(times[4]).toBeGreaterThan(times[0]);

    Tone.Transport.stop();
  });
});
