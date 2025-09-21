// Mock implementation of Tone.js for testing
import { vi } from 'vitest';

console.log('TONE MOCK IS BEING LOADED!');

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
  Gain: vi.fn().mockImplementation(function(value = 1) {
    const node = createMockToneNode();
    // Tone.js Gain nodes have a gain AudioParam property
    node.gain = {
      value,
      rampTo: vi.fn(),
    };
    return node;
  }),
  Panner: vi.fn().mockImplementation(function(value = 0) {
    const node = createMockToneNode();
    // Tone.js Panner nodes have a pan AudioParam property
    node.pan = {
      value,
      rampTo: vi.fn(),
    };
    return node;
  }),
  Compressor: vi.fn().mockImplementation(function(config) {
    return {
      ...createMockToneNode(),
      config,
    };
  }),
  Limiter: vi.fn().mockImplementation(function(threshold) {
    return {
      ...createMockToneNode(),
      threshold,
    };
  }),
  Timeline: vi.fn().mockImplementation(() => createMockTimeline()),
  Destination: createMockToneNode(),
  Reverb: vi.fn().mockImplementation(function(config) {
    return {
      ...createMockToneNode(),
      config,
    };
  }),
  Delay: vi.fn().mockImplementation(function(time, feedback) {
    return {
      ...createMockToneNode(),
      time,
      feedback,
    };
  }),
  FeedbackDelay: vi.fn().mockImplementation(function(time, feedback) {
    return {
      ...createMockToneNode(),
      time,
      feedback,
    };
  }),
  Distortion: vi.fn().mockImplementation(function(amount) {
    return {
      ...createMockToneNode(),
      amount,
    };
  }),
  Filter: vi.fn().mockImplementation(function(frequency, type) {
    return {
      ...createMockToneNode(),
      frequency,
      type,
    };
  }),
  Volume: vi.fn().mockImplementation(function(db = 0) {
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
  getDestination: vi.fn(() => createMockToneNode()),
};

// Export as ES module
export default mockTone;

// Export named exports
export const {
  Gain,
  Panner,
  Compressor,
  Limiter,
  Timeline,
  Destination,
  Reverb,
  Delay,
  FeedbackDelay,
  Distortion,
  Filter,
  Volume,
  Transport,
  getDestination
} = mockTone;