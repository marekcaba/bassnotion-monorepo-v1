/**
 * Real Tone.js Test Utilities
 * 
 * Uses actual Tone.js instead of mocks to test real behavior.
 * This ensures tests catch issues that only appear with real Transport.scheduleRepeat
 */

import * as Tone from 'tone';
import { vi } from 'vitest';

export interface RealToneTestOptions {
  // Transport options
  bpm?: number;
  // How long to let the transport run
  runDuration?: number;
  // Whether to start transport immediately
  autoStart?: boolean;
}

export class RealToneTestEnvironment {
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  constructor(private options: RealToneTestOptions = {}) {}

  async setup() {
    // Use real console for debugging
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;

    // Initialize audio context
    await Tone.start();
    
    // Configure Transport
    if (this.options.bpm) {
      Tone.Transport.bpm.value = this.options.bpm;
    }

    // Reset Transport state
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;

    if (this.options.autoStart) {
      Tone.Transport.start();
    }

    return {
      Transport: Tone.Transport,
      Tone,
    };
  }

  async cleanup() {
    // Stop and reset Transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    // Dispose of any created nodes
    await Tone.getContext().close();
    
    // Restore console
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }

  /**
   * Run Transport for a specified duration and capture schedule callbacks
   */
  async runTransportTest(
    scheduleCallback: (time: number) => void,
    interval: string = '4n',
    duration: number = 2000 // 2 seconds
  ): Promise<number[]> {
    const callbackTimes: number[] = [];
    
    // Schedule the callback
    const scheduleId = Tone.Transport.scheduleRepeat((time) => {
      callbackTimes.push(time);
      scheduleCallback(time);
    }, interval);

    // Start Transport if not already started
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }

    // Wait for the specified duration
    await new Promise(resolve => setTimeout(resolve, duration));

    // Clean up
    Tone.Transport.clear(scheduleId);
    Tone.Transport.stop();

    return callbackTimes;
  }

  /**
   * Test that scheduleRepeat actually repeats
   */
  async testScheduleRepeatContinuity(interval: string = '4n'): Promise<{
    callCount: number;
    times: number[];
    positions: string[];
  }> {
    let callCount = 0;
    const times: number[] = [];
    const positions: string[] = [];

    await this.runTransportTest((time) => {
      callCount++;
      times.push(time);
      positions.push(Tone.Transport.position.toString());
      console.log(`Schedule callback ${callCount}: time=${time}, position=${Tone.Transport.position}`);
    }, interval);

    return { callCount, times, positions };
  }
}

/**
 * Create a real Tone.js test environment
 */
export function createRealToneTest(options: RealToneTestOptions = {}) {
  return new RealToneTestEnvironment(options);
}

/**
 * Test helper to verify Transport schedules work correctly
 */
export async function verifyTransportScheduling(
  testFn: () => void,
  expectedCallbacks: number = 4,
  interval: string = '4n'
): Promise<boolean> {
  const env = createRealToneTest({ bpm: 120, autoStart: true });
  
  try {
    await env.setup();
    
    const result = await env.testScheduleRepeatContinuity(interval);
    
    console.log('Transport scheduling test result:', {
      expectedCallbacks,
      actualCallbacks: result.callCount,
      times: result.times,
      positions: result.positions,
    });

    return result.callCount >= expectedCallbacks;
  } finally {
    await env.cleanup();
  }
}