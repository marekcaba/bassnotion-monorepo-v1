/**
 * Mock AudioEngine for testing instruments with dependency injection
 */

import { vi } from 'vitest';

// Mock Tone objects
export const createMockToneObject = (type: string) => ({
  connect: vi.fn().mockReturnThis(),
  disconnect: vi.fn(),
  dispose: vi.fn(),
  toDestination: vi.fn().mockReturnThis(),
  type,
});

export const createMockSampler = (urls?: any, options?: any) => {
  const sampler = {
    ...createMockToneObject('Sampler'),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    loaded: true,
  };

  // Handle onload callback if provided
  if (options?.onload) {
    // Call onload immediately to simulate loaded samples
    Promise.resolve().then(() => options.onload());
  }

  return sampler;
};

export const createMockSynth = () => ({
  ...createMockToneObject('Synth'),
  triggerAttack: vi.fn(),
  triggerRelease: vi.fn(),
  triggerAttackRelease: vi.fn(),
});

// Create mock Tone module
export const mockTone = {
  start: vi.fn().mockResolvedValue(undefined),
  now: vi.fn().mockReturnValue(0),
  loaded: vi.fn().mockResolvedValue(undefined),
  context: {
    currentTime: 0,
    state: 'running',
    _context: {},
  },
  Transport: {
    bpm: {
      value: 120,
      rampTo: vi.fn(),
    },
    position: '0:0:0',
    state: 'stopped',
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    scheduleOnce: vi.fn(),
    seconds: 0,
  },
  // Factory functions
  Sampler: vi.fn((urls?: any, options?: any) =>
    createMockSampler(urls, options),
  ),
  Synth: vi.fn(() => createMockSynth()),
  MonoSynth: vi.fn(() => createMockSynth()),
  NoiseSynth: vi.fn(() => createMockSynth()),
  MembraneSynth: vi.fn(() => createMockSynth()),
  Gain: vi.fn((gain?: number) => ({
    ...createMockToneObject('Gain'),
    gain: { value: gain ?? 1, rampTo: vi.fn() },
  })),
  Volume: vi.fn((vol?: number) => ({
    ...createMockToneObject('Volume'),
    volume: { value: vol ?? 0, rampTo: vi.fn() },
    mute: false,
  })),
  EQ3: vi.fn((options?: any) => ({
    ...createMockToneObject('EQ3'),
    low: { value: options?.low ?? 0 },
    mid: { value: options?.mid ?? 0 },
    high: { value: options?.high ?? 0 },
  })),
  Compressor: vi.fn((options?: any) => ({
    ...createMockToneObject('Compressor'),
    threshold: { value: options?.threshold ?? -24 },
    ratio: { value: options?.ratio ?? 2 },
    attack: { value: options?.attack ?? 0.01 },
    release: { value: options?.release ?? 0.1 },
  })),
  Filter: vi.fn((options?: any) => ({
    ...createMockToneObject('Filter'),
    frequency: { value: options?.frequency ?? 440 },
    Q: { value: options?.Q ?? 1 },
    gain: { value: options?.gain ?? 0 },
  })),
  Panner: vi.fn((pan?: number) => ({
    ...createMockToneObject('Panner'),
    pan: { value: pan ?? 0, rampTo: vi.fn() },
  })),
  Meter: vi.fn(() => createMockToneObject('Meter')),
  Analyser: vi.fn(() => createMockToneObject('Analyser')),
  Player: vi.fn(() => ({
    ...createMockToneObject('Player'),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  Oscillator: vi.fn(() => ({
    ...createMockToneObject('Oscillator'),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  AmplitudeEnvelope: vi.fn(() => createMockToneObject('AmplitudeEnvelope')),
  Sequence: vi.fn(() => ({
    ...createMockToneObject('Sequence'),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  Gate: vi.fn(() => createMockToneObject('Gate')),
  Limiter: vi.fn(() => createMockToneObject('Limiter')),
  Reverb: vi.fn(() => createMockToneObject('Reverb')),
  Delay: vi.fn(() => createMockToneObject('Delay')),
  Distortion: vi.fn(() => createMockToneObject('Distortion')),

  // Destination
  Destination: { connect: vi.fn(), disconnect: vi.fn() },

  // Utility functions
  dbToGain: vi.fn((db: number) => Math.pow(10, db / 20)),
  gainToDb: vi.fn((gain: number) => 20 * Math.log10(gain)),
};

/**
 * Create a mock AudioEngine with all required methods
 */
export const createMockAudioEngine = () => ({
  // Core methods
  getTone: vi.fn(() => mockTone),
  getContext: vi.fn(() => ({ state: 'running', sampleRate: 48000 })),
  initialize: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn().mockResolvedValue(undefined),
  isReady: vi.fn().mockReturnValue(true),
  getCurrentTime: vi.fn().mockReturnValue(0),

  // Factory methods for DI
  createGain: vi.fn((gain?: number) => {
    const gainNode = createMockToneObject('Gain');
    const rampToFn = vi.fn();
    gainNode.gain = { value: gain ?? 1, rampTo: rampToFn };
    // Store rampTo for test access
    gainNode._rampTo = rampToFn;
    return gainNode;
  }),
  createVolume: vi.fn((vol?: number) => {
    const volumeNode = createMockToneObject('Volume');
    const rampToFn = vi.fn();
    volumeNode.volume = { value: vol ?? 0, rampTo: rampToFn };
    volumeNode.mute = false;
    volumeNode._rampTo = rampToFn;
    return volumeNode;
  }),
  createEQ3: vi.fn((options?: any) => ({
    ...createMockToneObject('EQ3'),
    low: { value: options?.low ?? 0 },
    mid: { value: options?.mid ?? 0 },
    high: { value: options?.high ?? 0 },
  })),
  createCompressor: vi.fn((options?: any) => ({
    ...createMockToneObject('Compressor'),
    threshold: { value: options?.threshold ?? -24 },
    ratio: { value: options?.ratio ?? 2 },
    attack: { value: options?.attack ?? 0.01 },
    release: { value: options?.release ?? 0.1 },
  })),
  createFilter: vi.fn((options?: any) => ({
    ...createMockToneObject('Filter'),
    frequency: { value: options?.frequency ?? 440 },
    Q: { value: options?.Q ?? 1 },
    gain: { value: options?.gain ?? 0 },
  })),
  createPanner: vi.fn((pan?: number) => {
    const pannerNode = createMockToneObject('Panner');
    const rampToFn = vi.fn();
    pannerNode.pan = { value: pan ?? 0, rampTo: rampToFn };
    pannerNode._rampTo = rampToFn;
    return pannerNode;
  }),
  createMeter: vi.fn((options?: any) => mockTone.Meter(options)),
  createAnalyser: vi.fn((type?: string, size?: number) =>
    mockTone.Analyser(type, size),
  ),
  createMonoSynth: vi.fn((options?: any) => mockTone.MonoSynth(options)),
  createSynth: vi.fn((options?: any) => mockTone.Synth(options)),
  createNoiseSynth: vi.fn((options?: any) => mockTone.NoiseSynth(options)),
  createMembraneSynth: vi.fn((options?: any) =>
    mockTone.MembraneSynth(options),
  ),
  createPlayer: vi.fn((options?: any) => mockTone.Player(options)),
  createOscillator: vi.fn((options?: any) => mockTone.Oscillator(options)),
  createAmplitudeEnvelope: vi.fn((options?: any) =>
    mockTone.AmplitudeEnvelope(options),
  ),
  createSequence: vi.fn((cb: any, events: any, sub?: any) =>
    mockTone.Sequence(cb, events, sub),
  ),
  createSampler: vi.fn((config: any) => {
    const sampler = createMockSampler();
    // Handle the AudioSampler interface
    return {
      triggerAttack: sampler.triggerAttack,
      triggerRelease: sampler.triggerRelease,
      triggerAttackRelease: sampler.triggerAttackRelease,
      connect: sampler.connect,
      disconnect: sampler.disconnect,
      dispose: sampler.dispose,
    };
  }),
  createGate: vi.fn((options?: any) => mockTone.Gate(options)),
  createLimiter: vi.fn((options?: any) => mockTone.Limiter(options)),
  createReverb: vi.fn((options?: any) => mockTone.Reverb(options)),
  createDelay: vi.fn((options?: any) => mockTone.Delay(options)),
  createDistortion: vi.fn((options?: any) => mockTone.Distortion(options)),

  // Utility methods
  getDestination: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
  now: vi.fn(() => 0),
});
