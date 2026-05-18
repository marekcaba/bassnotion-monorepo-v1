// Mock implementation of Tone.js for testing
import { vi } from 'vitest';

const createMockToneNode = () => ({
  connect: vi.fn().mockReturnThis(),
  disconnect: vi.fn().mockReturnThis(),
  dispose: vi.fn(),
  gain: {
    value: 1,
    rampTo: vi.fn(),
  },
  pan: {
    value: 0,
    rampTo: vi.fn(),
  },
});

const createMockTimeline = () => ({
  add: vi.fn(),
  get: vi.fn().mockReturnValue({ value: 0.5 }),
  dispose: vi.fn(),
});

const mockTone = {
  Gain: vi.fn().mockImplementation(function (value = 1) {
    const node = createMockToneNode();
    // Tone.js Gain nodes have a gain AudioParam property
    node.gain = {
      value,
      rampTo: vi.fn(),
    };
    return node;
  }),
  Panner: vi.fn().mockImplementation(function (value = 0) {
    const node = createMockToneNode();
    // Tone.js Panner nodes have a pan AudioParam property
    node.pan = {
      value,
      rampTo: vi.fn(),
    };
    return node;
  }),
  Compressor: vi.fn().mockImplementation(function (config) {
    return {
      ...createMockToneNode(),
      config,
    };
  }),
  Limiter: vi.fn().mockImplementation(function (threshold) {
    return {
      ...createMockToneNode(),
      threshold,
    };
  }),
  Timeline: vi.fn().mockImplementation(() => createMockTimeline()),
  Destination: createMockToneNode(),
  Reverb: vi.fn().mockImplementation(function () {
    return createMockToneNode();
  }),
  Delay: vi.fn().mockImplementation(function () {
    return createMockToneNode();
  }),
  Distortion: vi.fn().mockImplementation(function () {
    return createMockToneNode();
  }),
  Volume: vi.fn().mockImplementation(function (db = 0) {
    return {
      ...createMockToneNode(),
      volume: {
        value: db,
        rampTo: vi.fn(),
      },
    };
  }),
  Transport: {
    bpm: {
      value: 120,
    },
    state: 'stopped',
    position: 0,
    seconds: 0,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    schedule: vi.fn(),
    scheduleRepeat: vi.fn(),
    scheduleOnce: vi.fn(),
    clear: vi.fn(),
    toSeconds: vi.fn((position) => {
      // Simple conversion for tests: "0:0:0" -> 0, "1:0:0" -> 1, etc.
      if (typeof position === 'number') return position;
      if (typeof position === 'string' && position.includes(':')) {
        const parts = position.split(':');
        return parseFloat(parts[0] || '0');
      }
      return 0;
    }),
  },
};

// Tone v15 factory accessor — returns the same Transport instance the
// legacy singleton exposes so prod code sees one source of truth.
mockTone.getTransport = vi.fn(() => mockTone.Transport);
mockTone.getDestination = vi.fn(() => mockTone.Destination);
mockTone.getContext = vi.fn(() => ({
  state: 'running',
  sampleRate: 44100,
  currentTime: 0,
  resume: vi.fn().mockResolvedValue(undefined),
}));
mockTone.setContext = vi.fn();
mockTone.now = vi.fn(() => 0);
mockTone.immediate = vi.fn(() => 0);
mockTone.start = vi.fn().mockResolvedValue(undefined);
// Tone.loaded() returns a promise resolved when all Player/Sampler buffers finish loading
mockTone.loaded = vi.fn().mockResolvedValue(undefined);
// Tone.Analyser is a constructor in production; tests that exercise the
// analyzer path need it shaped like a Tone node.
mockTone.Analyser = vi.fn().mockImplementation(() => ({
  ...createMockToneNode(),
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  getValue: vi.fn(() => new Float32Array(1024)),
  type: 'fft',
}));

// Export both default and named exports
module.exports = mockTone;
module.exports.default = mockTone;

// Add named exports
Object.keys(mockTone).forEach((key) => {
  module.exports[key] = mockTone[key];
});
