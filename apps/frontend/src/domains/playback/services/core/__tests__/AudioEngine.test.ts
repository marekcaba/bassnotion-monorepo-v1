import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioEngine, AudioError } from '../AudioEngine.js';
import { EventBus } from '../EventBus.js';

// Mock dependencies
vi.mock('../PerformanceMonitor.js', () => ({
  PerformanceMonitor: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getMetrics: vi.fn(() => ({
        latency: 10,
        averageLatency: 12,
        maxLatency: 20,
        dropoutCount: 0,
        bufferUnderruns: 0,
        cpuUsage: 0.3,
        memoryUsage: 100,
        sampleRate: 48000,
        bufferSize: 128,
        timestamp: Date.now(),
      })),
      recordDropout: vi.fn(),
    })),
  },
}));

vi.mock('../errors/CircuitBreaker.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: vi.fn((operation) => operation()),
    getMetrics: vi.fn(() => ({
      state: 'closed',
      failureCount: 0,
      successCount: 10,
      rejectedCount: 0,
      totalRequests: 10,
      averageResponseTime: 5,
      uptime: 100,
    })),
  })),
}));

// Mock Tone.js with proper context handling
const mockTone = {
  start: vi.fn().mockResolvedValue(undefined),
  setContext: vi.fn(),
  now: vi.fn(() => 1.5),
  getContext: vi.fn(() => mockAudioContext),
  Sampler: vi.fn().mockImplementation((config) => ({
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    config,
  })),
  Context: vi.fn(),
};

// Store reference to mock context
let mockAudioContext: any;

// Mock dynamic import - Tone.js is imported dynamically in AudioEngine
global.import = vi.fn((module: string) => {
  if (module === 'tone') {
    return Promise.resolve(mockTone);
  }
  return Promise.reject(new Error(`Module not found: ${module}`));
}) as any;

// Mock AudioContext
class MockAudioContext {
  state = 'suspended';
  sampleRate = 48000;
  baseLatency = 0.01;
  outputLatency = 0.02;
  destination = {
    maxChannelCount: 2,
    channelCount: 2,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
    numberOfInputs: 1,
    numberOfOutputs: 0,
    connect: vi.fn(),
    disconnect: vi.fn()
  };
  
  listener = {
    forwardX: { value: 0 },
    forwardY: { value: 0 },
    forwardZ: { value: -1 },
    upX: { value: 0 },
    upY: { value: 1 },
    upZ: { value: 0 },
    positionX: { value: 0 },
    positionY: { value: 0 },
    positionZ: { value: 0 }
  };
  
  resume = vi.fn().mockImplementation(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  
  suspend = vi.fn().mockImplementation(() => {
    this.state = 'suspended';
    return Promise.resolve();
  });
  
  close = vi.fn().mockImplementation(() => {
    this.state = 'closed';
    return Promise.resolve();
  });
  
  addEventListener = vi.fn();
  
  createGain = vi.fn().mockReturnValue({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    },
    connect: vi.fn(),
    disconnect: vi.fn()
  });
}

// Mock AudioWorkletNode for browser compatibility check
class MockAudioWorkletNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

// Make AudioContext constructor return our mock instance
global.AudioContext = vi.fn().mockImplementation(() => {
  mockAudioContext = new MockAudioContext();
  return mockAudioContext;
}) as any;
global.AudioWorkletNode = MockAudioWorkletNode as any;

describe('AudioEngine', () => {
  let audioEngine: AudioEngine;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global AudioContext to MockAudioContext
    global.AudioContext = MockAudioContext as any;
    eventBus = new EventBus();
    audioEngine = new AudioEngine(eventBus, {
      enableBrowserCheck: false,
      retryOptions: { maxRetries: 0 }
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await audioEngine.initialize();

      expect(audioEngine.isReady()).toBe(true);
      expect(emitSpy).toHaveBeenCalledWith('audio:tone-loaded', expect.any(Object));
      expect(emitSpy).toHaveBeenCalledWith('audio:initialized', expect.objectContaining({
        context: expect.any(MockAudioContext),
        sampleRate: 48000,
        latency: 0.03,
      }));
    });

    it('should return same promise for concurrent initialization', async () => {
      const promise1 = audioEngine.initialize();
      const promise2 = audioEngine.initialize();

      // Both calls should return the same promise instance
      expect(promise1 === promise2).toBe(true);
      
      await Promise.all([promise1, promise2]);
      
      // Verify initialization happened only once
      expect(mockTone.setContext).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Init failed');
      global.AudioContext = vi.fn().mockImplementation(() => {
        throw error;
      }) as any;

      const emitSpy = vi.spyOn(eventBus, 'emit');

      await expect(audioEngine.initialize()).rejects.toThrow(AudioError);
      expect(emitSpy).toHaveBeenCalledWith('audio:error', expect.any(Object));
    });

    it('should initialize with custom config', async () => {
      const customEngine = new AudioEngine(eventBus, {
        sampleRate: 44100,
        latencyHint: 'playback',
        enableBrowserCheck: false,
        retryOptions: { maxRetries: 0 }
      });

      await customEngine.initialize();

      const context = customEngine.getContext();
      expect(context).toBeInstanceOf(MockAudioContext);
    });
  });

  describe('start/stop', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should start audio context', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      
      // Mock state change when Tone.start is called
      mockTone.start.mockImplementation(() => {
        const context = audioEngine.getContext() as MockAudioContext;
        context.state = 'running';
        return Promise.resolve();
      });

      await audioEngine.start();

      expect(mockTone.start).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith('audio:started', expect.objectContaining({
        state: 'running',
        timestamp: expect.any(Number),
      }));
    });

    it('should not start if already running', async () => {
      const context = audioEngine.getContext() as MockAudioContext;
      context.state = 'running';

      await audioEngine.start();
      vi.clearAllMocks();

      await audioEngine.start();
      expect(mockTone.start).not.toHaveBeenCalled();
    });

    it('should stop audio context', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const context = audioEngine.getContext() as MockAudioContext;
      context.state = 'running';

      await audioEngine.stop();

      expect(context.suspend).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith('audio:stopped', expect.objectContaining({
        state: 'suspended',
        timestamp: expect.any(Number),
      }));
    });

    it('should handle start without initialization', async () => {
      const uninitializedEngine = new AudioEngine(eventBus);
      await uninitializedEngine.start();
      expect(uninitializedEngine.isReady()).toBe(true);
    });
  });

  describe('Tone.js access', () => {
    it('should provide Tone.js access after initialization', async () => {
      await audioEngine.initialize();
      const tone = audioEngine.getTone();
      expect(tone).toBe(mockTone);
    });

    it('should throw error if accessing Tone before initialization', () => {
      expect(() => audioEngine.getTone()).toThrow(AudioError);
    });
  });

  describe('sampler creation', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should create sampler successfully', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const config = {
        urls: { C4: 'sample.mp3' },
        baseUrl: '/samples/',
      };

      const sampler = await audioEngine.createSampler(config);

      expect(mockTone.Sampler).toHaveBeenCalledWith(config);
      expect(sampler).toHaveProperty('triggerAttack');
      expect(sampler).toHaveProperty('triggerRelease');
      expect(sampler).toHaveProperty('triggerAttackRelease');
      expect(emitSpy).toHaveBeenCalledWith('audio:sampler-created', expect.objectContaining({
        samplerCount: 1,
        creationTime: expect.any(Number),
        timestamp: expect.any(Number),
      }));
    });

    it('should track sampler disposal', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const sampler = await audioEngine.createSampler({});

      sampler.dispose();

      expect(emitSpy).toHaveBeenCalledWith('audio:sampler-disposed', expect.objectContaining({
        samplerCount: 0,
        timestamp: expect.any(Number),
      }));
    });

    it('should handle sampler creation errors', async () => {
      const error = new Error('Sampler creation failed');
      mockTone.Sampler.mockImplementationOnce(() => {
        throw error;
      });

      await expect(audioEngine.createSampler({})).rejects.toThrow(AudioError);
    });

    it('should throw error if creating sampler before initialization', async () => {
      const uninitializedEngine = new AudioEngine(eventBus);
      await expect(uninitializedEngine.createSampler({})).rejects.toThrow(AudioError);
    });
  });

  describe('utilities', () => {
    it('should get current time', async () => {
      await audioEngine.initialize();
      const time = audioEngine.getCurrentTime();
      expect(time).toBe(1.5);
    });

    it('should return 0 for time before initialization', () => {
      const time = audioEngine.getCurrentTime();
      expect(time).toBe(0);
    });

    it('should get AudioContext', async () => {
      await audioEngine.initialize();
      const context = audioEngine.getContext();
      expect(context).toBeInstanceOf(MockAudioContext);
    });

    it('should throw error when getting context before initialization', () => {
      expect(() => audioEngine.getContext()).toThrow(AudioError);
    });
  });

  describe('metrics', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should get performance metrics', () => {
      const metrics = audioEngine.getPerformanceMetrics();
      expect(metrics).toHaveProperty('latency');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('dropoutCount');
    });

    it('should get circuit breaker metrics', () => {
      const metrics = audioEngine.getCircuitBreakerMetrics();
      expect(metrics).toHaveProperty('state', 'closed');
      expect(metrics).toHaveProperty('failureCount', 0);
      expect(metrics).toHaveProperty('uptime', 100);
    });
  });

  describe('disposal', () => {
    it('should dispose resources properly', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      await audioEngine.initialize();
      const context = audioEngine.getContext() as MockAudioContext;

      await audioEngine.dispose();

      expect(context.close).toHaveBeenCalled();
      expect(audioEngine.isReady()).toBe(false);
      expect(emitSpy).toHaveBeenCalledWith('audio:disposed', expect.any(Object));
    });

    it('should warn about active samplers during disposal', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      await audioEngine.initialize();
      await audioEngine.createSampler({});

      await audioEngine.dispose();

      expect(emitSpy).toHaveBeenCalledWith('audio:warning', expect.objectContaining({
        message: expect.stringContaining('1 active samplers'),
      }));
    });

    it('should handle disposal without initialization', async () => {
      await expect(audioEngine.dispose()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle missing AudioContext properties', async () => {
      const PartialMockContext = vi.fn().mockImplementation(() => ({
        state: 'suspended',
        sampleRate: 48000,
        // Missing baseLatency and outputLatency
        suspend: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
      }));

      global.AudioContext = PartialMockContext as any;

      const engine = new AudioEngine(eventBus);
      await expect(engine.initialize()).resolves.not.toThrow();
    });

    it('should handle concurrent operations', async () => {
      await audioEngine.initialize();

      const operations = [
        audioEngine.start(),
        audioEngine.createSampler({}),
        audioEngine.createSampler({}),
        audioEngine.stop(),
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });
});