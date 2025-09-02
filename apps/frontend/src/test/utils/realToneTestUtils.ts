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
    interval = '4n',
    duration = 2000, // 2 seconds
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
    await new Promise((resolve) => setTimeout(resolve, duration));

    // Clean up
    Tone.Transport.clear(scheduleId);
    Tone.Transport.stop();

    return callbackTimes;
  }

  /**
   * Test that scheduleRepeat actually repeats
   */
  async testScheduleRepeatContinuity(interval = '4n'): Promise<{
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
      console.log(
        `Schedule callback ${callCount}: time=${time}, position=${Tone.Transport.position}`,
      );
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
  expectedCallbacks = 4,
  interval = '4n',
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

/**
 * Setup real Tone.js for integration tests
 */
export async function setupRealTone() {
  // Create a shared mock AudioContext instance
  const mockAudioContext = {
    constructor: { name: 'AudioContext' },
    state: 'running',
    sampleRate: 44100,
    currentTime: 0,
    destination: { maxChannelCount: 2 },
    baseLatency: 0.01,
    outputLatency: 0.02,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    createGain: vi.fn().mockReturnValue({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createOscillator: vi.fn().mockReturnValue({
      frequency: {
        value: 440,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      type: 'sine',
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBufferSource: vi.fn().mockReturnValue({
      buffer: null,
      playbackRate: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createDynamicsCompressor: vi.fn().mockReturnValue({
      threshold: { value: -24 },
      knee: { value: 30 },
      ratio: { value: 12 },
      attack: { value: 0.003 },
      release: { value: 0.25 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createAnalyser: vi.fn().mockReturnValue({
      fftSize: 2048,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getByteTimeDomainData: vi.fn(),
    }),
    createBiquadFilter: vi.fn().mockReturnValue({
      type: 'lowpass',
      frequency: { value: 350, setValueAtTime: vi.fn() },
      Q: { value: 1 },
      gain: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createDelay: vi.fn().mockReturnValue({
      delayTime: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createChannelSplitter: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createChannelMerger: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    decodeAudioData: vi.fn().mockResolvedValue({
      duration: 1,
      length: 44100,
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
    }),
    suspend: vi.fn().mockImplementation(function () {
      this.state = 'suspended';
    }),
    resume: vi.fn().mockImplementation(function () {
      this.state = 'running';
    }),
    close: vi.fn().mockImplementation(function () {
      this.state = 'closed';
    }),
  };

  // Mock Web Audio API for test environment if not available
  if (typeof window !== 'undefined') {
    // Mock BaseAudioContext first (parent class)
    if (!window.BaseAudioContext) {
      // @ts-ignore
      window.BaseAudioContext = vi.fn();
    }

    if (!window.AudioContext) {
      // @ts-ignore
      window.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);

      // Also add it to globalThis for Node environment
      // @ts-ignore
      globalThis.AudioContext = window.AudioContext;
      // @ts-ignore
      globalThis.BaseAudioContext = window.BaseAudioContext;
    }
  } else {
    // Node environment
    // @ts-ignore
    global.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
    // @ts-ignore
    global.BaseAudioContext = vi.fn();
  }

  // Mock performance.now if not available
  if (typeof performance === 'undefined') {
    // @ts-ignore
    global.performance = {
      now: () => Date.now(),
    };
  }

  // Store the mock context globally so AudioEngine can access it
  // @ts-ignore
  if (typeof window !== 'undefined') {
    window.__mockAudioContext = mockAudioContext;
  } else {
    global.__mockAudioContext = mockAudioContext;
  }
}
