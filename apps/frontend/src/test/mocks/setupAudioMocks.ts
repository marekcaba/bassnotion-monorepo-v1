/**
 * Complete Audio Mocking Setup for Integration Tests
 *
 * Provides comprehensive mocks for Web Audio API and Tone.js
 * to enable audio integration tests in Node.js environment
 */

import { vi } from 'vitest';

// Mock AudioParam
class MockAudioParam {
  value = 1;
  defaultValue = 1;
  minValue = 0;
  maxValue = 1;

  setValueAtTime(value: number, time: number) {
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    this.value = value;
    return this;
  }

  setTargetAtTime(value: number, time: number, timeConstant: number) {
    this.value = value;
    return this;
  }

  cancelScheduledValues(time: number) {
    return this;
  }
}

// Mock AudioNode base
class MockAudioNode {
  context: any;
  numberOfInputs = 1;
  numberOfOutputs = 1;
  channelCount = 2;

  connect(destination: any) {
    return destination;
  }

  disconnect() {}
}

// Mock GainNode
class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

// Mock OscillatorNode
class MockOscillatorNode extends MockAudioNode {
  frequency = new MockAudioParam();
  detune = new MockAudioParam();
  type: OscillatorType = 'sine';

  start(when?: number) {}
  stop(when?: number) {}
}

// Mock AudioBuffer
class MockAudioBuffer {
  constructor(
    public sampleRate: number,
    public length: number,
    public numberOfChannels: number,
  ) {}

  duration = this.length / this.sampleRate;

  getChannelData(channel: number): Float32Array {
    return new Float32Array(this.length);
  }

  copyFromChannel(
    destination: Float32Array,
    channelNumber: number,
    startInChannel?: number,
  ) {}
  copyToChannel(
    source: Float32Array,
    channelNumber: number,
    startInChannel?: number,
  ) {}
}

// Mock AudioContext
export class MockAudioContext {
  sampleRate = 48000;
  currentTime = 0;
  state: AudioContextState = 'running';
  baseLatency = 0.01;
  outputLatency = 0.02;
  listener = {};
  destination = new MockAudioNode();

  private _onstatechange: ((this: any, ev: Event) => any) | null = null;

  constructor() {
    // Auto-increment currentTime
    setInterval(() => {
      this.currentTime += 0.01;
    }, 10);
  }

  set onstatechange(handler: ((this: any, ev: Event) => any) | null) {
    this._onstatechange = handler;
  }

  get onstatechange() {
    return this._onstatechange;
  }

  async resume(): Promise<void> {
    this.state = 'running';
    if (this._onstatechange) {
      this._onstatechange.call(this, new Event('statechange'));
    }
    return Promise.resolve();
  }

  async suspend(): Promise<void> {
    this.state = 'suspended';
    if (this._onstatechange) {
      this._onstatechange.call(this, new Event('statechange'));
    }
    return Promise.resolve();
  }

  async close(): Promise<void> {
    this.state = 'closed';
    if (this._onstatechange) {
      this._onstatechange.call(this, new Event('statechange'));
    }
    return Promise.resolve();
  }

  createGain(): MockGainNode {
    return new MockGainNode();
  }

  createOscillator(): MockOscillatorNode {
    return new MockOscillatorNode();
  }

  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): MockAudioBuffer {
    return new MockAudioBuffer(sampleRate, length, numberOfChannels);
  }

  decodeAudioData(audioData: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve(
      new MockAudioBuffer(this.sampleRate, 44100, 2) as any,
    );
  }
}

// Mock AudioWorkletNode
export class MockAudioWorkletNode extends MockAudioNode {
  parameters = new Map();
  port = {
    postMessage: vi.fn(),
    onmessage: null,
    close: vi.fn(),
  };
}

// Create comprehensive Tone.js mock
export function createToneMock() {
  const transportState = {
    position: '0:0:0',
    seconds: 0,
    progress: 0,
    ticks: 0,
    bpm: { value: 120 },
    timeSignature: [4, 4],
    state: 'stopped' as 'started' | 'stopped' | 'paused',
  };

  const mockContext = new MockAudioContext();

  return {
    // Core objects
    Transport: {
      ...transportState,
      start: vi.fn(() => {
        transportState.state = 'started';
        return Promise.resolve();
      }),
      stop: vi.fn(() => {
        transportState.state = 'stopped';
        transportState.position = '0:0:0';
        transportState.seconds = 0;
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        transportState.state = 'paused';
        return Promise.resolve();
      }),
      schedule: vi.fn(),
      scheduleRepeat: vi.fn(),
      cancel: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },

    // Context
    context: mockContext,
    getContext: () => mockContext,
    setContext: vi.fn(),

    // Timing
    now: vi.fn(() => mockContext.currentTime),
    immediate: vi.fn(() => mockContext.currentTime),

    // Audio nodes
    Gain: vi.fn(() => ({
      gain: new MockAudioParam(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      toDestination: vi.fn(),
    })),

    Sampler: vi.fn(() => ({
      loaded: true,
      dispose: vi.fn(),
      triggerAttackRelease: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      toDestination: vi.fn(),
    })),

    // Utilities
    start: vi.fn(() => Promise.resolve()),
    loaded: vi.fn(() => Promise.resolve()),

    // Time utilities
    Time: vi.fn((time: any) => ({
      toSeconds: () => (typeof time === 'number' ? time : 0),
      toBarsBeatsSixteenths: () => '0:0:0',
    })),

    // Additional mocks for common Tone.js features
    Destination: new MockAudioNode(),
    Master: {
      volume: new MockAudioParam(),
      mute: false,
    },
  };
}

/**
 * Install comprehensive audio mocks globally
 */
export function installAudioMocks() {
  // Set up browser globals
  if (typeof global !== 'undefined') {
    // Navigator
    (global as any).navigator = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(null),
      },
    };

    // Performance
    (global as any).performance = {
      now: () => Date.now() - (global as any).performance._startTime,
      _startTime: Date.now(),
    };

    // Audio APIs
    (global as any).AudioContext = MockAudioContext;
    (global as any).AudioWorkletNode = MockAudioWorkletNode;
    (global as any).AudioBuffer = MockAudioBuffer;
    (global as any).GainNode = MockGainNode;
    (global as any).OscillatorNode = MockOscillatorNode;

    // Window object
    (global as any).window = {
      ...(global as any).window,
      AudioContext: MockAudioContext,
      AudioWorkletNode: MockAudioWorkletNode,
      navigator: (global as any).navigator,
      performance: (global as any).performance,
    };

    // Event class
    if (typeof Event === 'undefined') {
      (global as any).Event = class Event {
        constructor(
          public type: string,
          public options?: any,
        ) {}
      };
    }
  }

  // Mock Tone.js module
  vi.doMock('tone', () => ({
    default: createToneMock(),
    ...createToneMock(),
  }));
}

/**
 * Clean up audio mocks
 */
export function cleanupAudioMocks() {
  vi.unmock('tone');

  if (typeof global !== 'undefined' && global.window) {
    delete (global.window as any).__globalTone;
  }
}
