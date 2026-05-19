/**
 * Test setup utilities for audio-related tests
 * Provides mocks for CoreServices, Tone.js, and AudioContext
 */

import { vi } from 'vitest';

// Create mock AudioContext
const createMockAudioContext = () => ({
  state: 'running',
  sampleRate: 48000,
  currentTime: 0,
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createOscillator: vi.fn(() => ({
    frequency: { value: 440 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createBuffer: vi.fn(),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
});

// Mock Tone.js
const mockTransportInstance = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
  scheduleOnce: vi.fn(),
  scheduleRepeat: vi.fn(),
  clear: vi.fn(),
  state: 'stopped',
  position: 0,
  seconds: 0,
  bpm: {
    value: 120,
    rampTo: vi.fn(),
  },
  timeSignature: 4,
  loop: false,
  loopStart: 0,
  loopEnd: '4m',
};

export const mockTone = {
  context: {
    _context: createMockAudioContext(),
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
  },
  start: vi.fn().mockResolvedValue(undefined),
  // Legacy singleton + Tone v15 factory accessor returning the same instance.
  Transport: mockTransportInstance,
  getTransport: vi.fn(() => mockTransportInstance),
  Sampler: vi.fn().mockImplementation(() => ({
    triggerAttackRelease: vi.fn(),
    releaseAll: vi.fn(),
    dispose: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
  })),
  Synth: vi.fn().mockImplementation(() => ({
    triggerAttackRelease: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    dispose: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
  })),
  Part: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  })),
  Loop: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  })),
  now: vi.fn(() => 0),
  immediate: vi.fn(() => 0),
};

// Mock AudioEngine
export const mockAudioEngine = {
  getTone: () => mockTone,
  getContext: () => mockTone.context._context,
  initialize: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn(),
};

// Mock CoreServices
export const mockCoreServices = {
  getAudioEngine: () => mockAudioEngine,
  getEventBus: () => ({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
  }),
  getServiceRegistry: () => ({
    get: vi.fn(),
    register: vi.fn(),
  }),
};

/**
 * Setup audio test environment
 * Call this in beforeEach() or at the start of your test
 */
export function setupAudioTestEnvironment() {
  // Add CoreServices to window
  (window as any).__coreServices = mockCoreServices;
  (window as any).__globalCoreServices = mockCoreServices;

  // Add Tone to window as fallback
  (window as any).Tone = mockTone;

  // Mock AudioContext if not available
  if (typeof AudioContext === 'undefined') {
    (global as any).AudioContext = vi.fn().mockImplementation(() => ({
      state: 'running',
      sampleRate: 48000,
      currentTime: 0,
      createGain: vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createOscillator: vi.fn(() => ({
        frequency: { value: 440 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createBuffer: vi.fn(),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      resume: vi.fn().mockResolvedValue(undefined),
      suspend: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }));
  }
}

/**
 * Cleanup audio test environment
 * Call this in afterEach() or at the end of your test
 */
export function cleanupAudioTestEnvironment() {
  delete (window as any).__coreServices;
  delete (window as any).__globalCoreServices;
  delete (window as any).Tone;

  // Reset all mocks
  vi.clearAllMocks();
}

/**
 * Create a mock for a specific Tone.js class
 */
export function createToneMock(className: string, methods: string[] = []) {
  const mock = vi.fn().mockImplementation(() => {
    const instance: any = {
      dispose: vi.fn(),
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn().mockReturnThis(),
      toDestination: vi.fn().mockReturnThis(),
    };

    // Add custom methods
    methods.forEach((method) => {
      instance[method] = vi.fn();
    });

    return instance;
  });

  return mock;
}
