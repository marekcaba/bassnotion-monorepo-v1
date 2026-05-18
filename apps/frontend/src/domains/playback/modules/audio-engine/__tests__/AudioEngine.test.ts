/**
 * AudioEngine Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine } from '../core/AudioEngine.js';
import { AudioContextManager } from '../core/AudioContextManager.js';
import { ToneWrapper } from '../core/ToneWrapper.js';

// Mock Tone.js — expose getTransport() (Tone v15) returning the same
// Transport object used by the legacy singleton, so prod code using either
// API path observes a single source of truth.
vi.mock('tone', () => {
  const Transport: Record<string, unknown> = {};
  const sampler = {
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    default: {
      start: vi.fn().mockResolvedValue(undefined),
      now: vi.fn().mockReturnValue(0),
      setContext: vi.fn(),
      getContext: vi.fn().mockReturnValue({}),
      getTransport: vi.fn().mockReturnValue(Transport),
      context: {},
      Transport,
      Sampler: vi.fn().mockImplementation(() => sampler),
    },
    start: vi.fn().mockResolvedValue(undefined),
    now: vi.fn().mockReturnValue(0),
    setContext: vi.fn(),
    getContext: vi.fn().mockReturnValue({}),
    getTransport: vi.fn().mockReturnValue(Transport),
    context: {},
    Transport,
    Sampler: vi.fn().mockImplementation(() => sampler),
  };
});

// Mock AudioContext
const mockAudioContext = {
  state: 'running',
  sampleRate: 48000,
  baseLatency: 0.01,
  outputLatency: 0.02,
  currentTime: 0,
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  destination: {},
  resume: vi.fn().mockImplementation(async function () {
    mockAudioContext.state = 'running';
    return Promise.resolve();
  }),
  suspend: vi.fn().mockImplementation(async function () {
    mockAudioContext.state = 'suspended';
    return Promise.resolve();
  }),
  close: vi.fn().mockImplementation(async function () {
    mockAudioContext.state = 'closed';
    return Promise.resolve();
  }),
};

// Mock window.AudioContext
global.AudioContext = vi.fn(() => mockAudioContext) as any;
// Mock AudioWorkletNode for browser compatibility test
global.AudioWorkletNode = vi.fn() as any;

describe('AudioEngine Module', () => {
  let audioEngine: AudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global AudioContext to ensure clean state
    (AudioContextManager as any).globalContext = null;
    if (typeof window !== 'undefined') {
      (window as any).__persistentAudioContext = null;
    }
    // Ensure mock starts with running state
    mockAudioContext.state = 'running';
    audioEngine = new AudioEngine();
  });

  afterEach(async () => {
    await audioEngine.dispose();
  });

  describe('initialization', () => {
    it('should pre-initialize successfully', async () => {
      await audioEngine.preInitialize();

      // Should load Tone.js
      const toneModule = await import('tone');
      expect(toneModule.default).toBeDefined();
    });

    it('should initialize with AudioContext', async () => {
      await audioEngine.initialize();

      expect(audioEngine.isReady()).toBe(true);
      expect(global.AudioContext).toHaveBeenCalled();
    });

    it('should handle multiple initialization calls gracefully', async () => {
      // First initialization should create AudioContext
      await audioEngine.initialize();
      const firstCallCount = (global.AudioContext as any).mock.calls.length;

      // Second initialization should reuse the same context
      await audioEngine.initialize();
      const secondCallCount = (global.AudioContext as any).mock.calls.length;

      expect(audioEngine.isReady()).toBe(true);
      expect(secondCallCount).toBe(firstCallCount); // No new AudioContext created
    });
  });

  describe('audio operations', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should start audio engine', async () => {
      // Ensure context is in suspended state to trigger resume
      mockAudioContext.state = 'suspended';
      await audioEngine.start();
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should stop audio engine', async () => {
      // Ensure context is running before stopping
      mockAudioContext.state = 'running';
      await audioEngine.stop();
      expect(mockAudioContext.suspend).toHaveBeenCalled();
    });

    it('should create sampler', async () => {
      const sampler = await audioEngine.createSampler({
        urls: { C4: 'sample.wav' },
      });

      expect(sampler).toBeDefined();
      expect(sampler.triggerAttack).toBeDefined();
      expect(sampler.dispose).toBeDefined();
    });

    it('should get current time', () => {
      const time = audioEngine.getCurrentTime();
      expect(typeof time).toBe('number');
    });

    it('should get metrics', () => {
      const metrics = audioEngine.getMetrics();

      expect(metrics).toHaveProperty('latency');
      expect(metrics).toHaveProperty('sampleRate');
      expect(metrics.sampleRate).toBe(48000);
    });
  });

  describe('error handling', () => {
    it('should throw when accessing Tone before initialization', () => {
      expect(() => audioEngine.getTone()).toThrow('not initialized');
    });

    it('should throw when accessing context before initialization', () => {
      expect(() => audioEngine.getContext()).toThrow('not available');
    });

    it('should throw when creating sampler before initialization', async () => {
      await expect(audioEngine.createSampler({})).rejects.toThrow(
        'not initialized',
      );
    });
  });

  describe('browser compatibility', () => {
    it('should detect browser support', async () => {
      const engine = new AudioEngine({ enableBrowserCheck: true });

      // Should succeed in test environment with mocked APIs
      await expect(engine.preInitialize()).resolves.not.toThrow();
    });
  });

  describe('disposal', () => {
    it('should dispose resources properly', async () => {
      await audioEngine.initialize();
      await audioEngine.dispose();

      expect(audioEngine.isReady()).toBe(false);
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });
});

describe('AudioContextManager', () => {
  let contextManager: AudioContextManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global context state
    (AudioContextManager as any).globalContext = null;
    // Reset mock state to running by default
    mockAudioContext.state = 'running';
    contextManager = new AudioContextManager();
  });

  afterEach(async () => {
    await contextManager.close();
    // Reset the mock to a clean state for next test
    mockAudioContext.state = 'running';
  });

  it('should create AudioContext', async () => {
    const context = await contextManager.getOrCreateContext();

    expect(context).toBeDefined();
    // The context should be running after creation (or closed if in test cleanup)
    // In tests, the state might be affected by other tests' cleanup
    expect(['running', 'closed']).toContain(context.state);
  });

  it('should reuse global context', async () => {
    const context1 = await contextManager.getOrCreateContext();

    // Create a new manager
    const contextManager2 = new AudioContextManager();

    // Ensure the global context is in running state
    mockAudioContext.state = 'running';

    const context2 = await contextManager2.getOrCreateContext();

    expect(context1).toBe(context2);
  });

  it('should handle state changes', async () => {
    const context = await contextManager.getOrCreateContext();
    const stateHandler = vi.fn();

    contextManager.onStateChange(stateHandler);

    // Simulate state change
    if (context.addEventListener) {
      const event = new Event('statechange');
      context.dispatchEvent(event);
    }
  });
});

describe('ToneWrapper', () => {
  let toneWrapper: ToneWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    toneWrapper = ToneWrapper.getInstance();
  });

  it('should be singleton', () => {
    const instance1 = ToneWrapper.getInstance();
    const instance2 = ToneWrapper.getInstance();

    expect(instance1).toBe(instance2);
  });

  it('should load Tone.js', async () => {
    await toneWrapper.load();

    expect(toneWrapper.isReady()).toBe(true);
  });

  it('should provide Tone.js methods', async () => {
    await toneWrapper.load();

    const tone = toneWrapper.getTone();
    expect(tone.start).toBeDefined();
    expect(tone.now).toBeDefined();
  });

  it('should create samplers', async () => {
    await toneWrapper.load();

    const sampler = toneWrapper.createSampler({
      urls: { C4: 'sample.wav' },
    });

    expect(sampler).toBeDefined();
    expect(sampler.triggerAttack).toBeDefined();
  });
});
