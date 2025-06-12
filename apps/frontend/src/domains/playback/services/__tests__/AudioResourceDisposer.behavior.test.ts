/**
 * AudioResourceDisposer Behavior Tests
 *
 * These tests focus on behavior and outcomes rather than implementation details.
 * Following the successful pattern from ResourceUsageMonitor, WorkerPoolManager,
 * PerformanceMonitor, StatePersistenceManager, ABTestFramework, and MemoryLeakDetector.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AudioResourceDisposer,
  FadeType,
  DisposalStrategy,
  AudioResourceType,
  type TimerService,
} from '../AudioResourceDisposer.js';
import type {
  AudioResource as _AudioResource,
  DisposalConfig as _DisposalConfig,
  FadeConfig as _FadeConfig,
  DisposalResult as _DisposalResult,
  DisposalMetrics as _DisposalMetrics,
} from '../AudioResourceDisposer.js';

// Test Environment Setup
const setupTestEnvironment = () => {
  const mockGainNode = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setValueCurveAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    context: { currentTime: 0 },
  };

  const mockOscillator = {
    frequency: { value: 440 },
    start: vi.fn(),
    stop: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    context: { currentTime: 0 },
  };

  const mockMediaElement = {
    volume: 1.0,
    pause: vi.fn(),
    load: vi.fn(),
    removeEventListener: vi.fn(),
    addEventListener: vi.fn(),
    currentTime: 0,
    duration: 60,
  };

  const mockAudioContext = {
    currentTime: 0,
    state: 'running',
    close: vi.fn(),
    createGain: vi.fn().mockReturnValue(mockGainNode),
    createOscillator: vi.fn().mockReturnValue(mockOscillator),
  };

  (global as any).AudioContext = vi
    .fn()
    .mockImplementation(() => mockAudioContext);

  (global as any).HTMLMediaElement = vi
    .fn()
    .mockImplementation(() => mockMediaElement);

  // Timer functions are now injected via TimerService dependency injection
  // This removes the need for global timer mocking and improves testability

  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return { mockGainNode, mockOscillator, mockMediaElement, mockAudioContext };
};

const createAudioResource = (
  id: string,
  type: AudioResourceType,
  options = {},
) => ({
  id,
  type,
  resource: createMockResourceByType(type),
  metadata: {
    createdAt: Date.now() - 5000,
    lastUsed: Date.now() - 1000,
    isPlaying: true,
    hasActiveConnections: true,
    fadeInProgress: false,
    priority: 'medium' as const,
  },
  dependencies: [],
  cleanup: vi.fn().mockResolvedValue(undefined),
  ...options,
});

const createMockResourceByType = (type: AudioResourceType) => {
  switch (type) {
    case AudioResourceType.TONE_INSTRUMENT:
      return {
        dispose: vi.fn(),
        stop: vi.fn(),
        triggerRelease: vi.fn(),
        volume: {
          value: 1,
          rampTo: vi
            .fn()
            .mockImplementation((_value: number, _time?: number) => {
              return Promise.resolve();
            }),
        },
      };

    case AudioResourceType.TONE_EFFECT:
      return {
        dispose: vi.fn(),
        wet: {
          value: 1,
          rampTo: vi.fn(),
        },
      };

    case AudioResourceType.GAIN_NODE:
      return {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          setValueCurveAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };

    case AudioResourceType.OSCILLATOR:
      return {
        frequency: { value: 440 },
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };

    case AudioResourceType.MEDIA_ELEMENT:
      return {
        volume: 1.0,
        pause: vi.fn(),
        load: vi.fn(),
        removeEventListener: vi.fn(),
        addEventListener: vi.fn(),
        currentTime: 0,
        duration: 60,
      };

    case AudioResourceType.AUDIO_BUFFER:
      return {
        length: 44100,
        sampleRate: 44100,
        numberOfChannels: 2,
      };

    default:
      return {};
  }
};

const createDisposalConfig = (overrides = {}) => ({
  strategy: DisposalStrategy.GRACEFUL,
  fadeConfig: {
    type: FadeType.EXPONENTIAL,
    duration: 100,
    startLevel: 1.0,
    endLevel: 0.0,
    easing: 'ease-out' as const,
  },
  maxDisposalTime: 5000,
  batchSize: 10,
  deferredDelay: 1000,
  preventArtifacts: true,
  validateCleanup: true,
  ...overrides,
});

const expectValidDisposalResult = (result: any) => {
  expect(result).toBeDefined();
  expect(typeof result.success).toBe('boolean');
  expect(typeof result.resourceId).toBe('string');
  expect(typeof result.fadeTime).toBe('number');
  expect(typeof result.artifactsDetected).toBe('boolean');
  expect(result.fadeTime).toBeGreaterThanOrEqual(0);
};

const expectValidMetrics = (metrics: any) => {
  expect(metrics).toBeDefined();
  expect(typeof metrics.totalDisposed).toBe('number');
  expect(typeof metrics.totalFadeTime).toBe('number');
  expect(typeof metrics.artifactsDetected).toBe('number');
  expect(metrics.totalDisposed).toBeGreaterThanOrEqual(0);
};

describe('AudioResourceDisposer Behaviors', () => {
  let disposer: AudioResourceDisposer;
  let mockTimerService: TimerService;

  beforeEach(() => {
    setupTestEnvironment();
    vi.useFakeTimers();

    // Create mocked timer service for dependency injection
    mockTimerService = {
      setInterval: vi.fn().mockImplementation((callback, delay) => {
        return setTimeout(callback, delay) as any;
      }),
      clearInterval: vi.fn(),
    };

    (AudioResourceDisposer as any).instance = null;
    disposer = AudioResourceDisposer.getInstance(undefined, mockTimerService);
  });

  afterEach(() => {
    disposer.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initialization Behaviors', () => {
    test('should provide singleton instance', () => {
      const instance1 = AudioResourceDisposer.getInstance();
      const instance2 = AudioResourceDisposer.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(AudioResourceDisposer);
    });

    test('should initialize with default metrics', () => {
      const metrics = disposer.getMetrics();

      expectValidMetrics(metrics);
      expect(metrics.totalDisposed).toBe(0);
    });

    test('should accept custom configuration', () => {
      const customConfig = createDisposalConfig({
        strategy: DisposalStrategy.IMMEDIATE,
      });

      const customDisposer = AudioResourceDisposer.getInstance(customConfig);
      expect(customDisposer).toBeInstanceOf(AudioResourceDisposer);
    });

    test('should setup batch processing', () => {
      expect(mockTimerService.setInterval).toHaveBeenCalled();
    });
  });

  describe('Resource Registration Behaviors', () => {
    test('should register audio resources', () => {
      const resource = createAudioResource(
        'test-audio',
        AudioResourceType.AUDIO_BUFFER,
      );

      expect(() => disposer.registerResource(resource)).not.toThrow();

      const activeResources = disposer.getActiveResources();
      expect(activeResources.length).toBe(1);
      expect(activeResources[0]?.id).toBe('test-audio');
    });

    test('should track multiple resource types', () => {
      const toneInstrument = createAudioResource(
        'tone-1',
        AudioResourceType.TONE_INSTRUMENT,
      );
      const gainNode = createAudioResource(
        'gain-1',
        AudioResourceType.GAIN_NODE,
      );

      disposer.registerResource(toneInstrument);
      disposer.registerResource(gainNode);

      const activeResources = disposer.getActiveResources();
      expect(activeResources.length).toBe(2);
    });

    test('should handle resources with dependencies', () => {
      const resource = createAudioResource(
        'main',
        AudioResourceType.TONE_INSTRUMENT,
        {
          dependencies: ['effect-1', 'effect-2'],
        },
      );

      disposer.registerResource(resource);

      const activeResources = disposer.getActiveResources();
      expect(activeResources[0]?.dependencies).toEqual([
        'effect-1',
        'effect-2',
      ]);
    });
  });

  describe('Graceful Disposal Behaviors', () => {
    test('should perform graceful disposal with fade-out', async () => {
      const resource = createAudioResource(
        'graceful-test',
        AudioResourceType.GAIN_NODE,
      );
      disposer.registerResource(resource);

      const result = await disposer.disposeResource(
        'graceful-test',
        DisposalStrategy.GRACEFUL,
      );

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
      expect(result.disposalStrategy).toBe(DisposalStrategy.GRACEFUL);
    });

    test('should prevent audio artifacts', async () => {
      const toneInstrument = createAudioResource(
        'tone-fade',
        AudioResourceType.TONE_INSTRUMENT,
      );
      disposer.registerResource(toneInstrument);

      const result = await disposer.disposeResource('tone-fade');

      expectValidDisposalResult(result);
      expect(result.artifactsDetected).toBe(false);
    });

    test('should support different fade types', async () => {
      const gainNode = createAudioResource(
        'fade-test',
        AudioResourceType.GAIN_NODE,
      );
      disposer.registerResource(gainNode);

      const fadeConfig = {
        type: FadeType.SINE,
        duration: 150,
        startLevel: 1.0,
        endLevel: 0.0,
        easing: 'ease-out' as const,
      };

      const result = await disposer.disposeResource(
        'fade-test',
        DisposalStrategy.GRACEFUL,
        fadeConfig,
      );

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
    });

    test('should apply linear fade correctly', async () => {
      const resource = createAudioResource(
        'linear-fade',
        AudioResourceType.GAIN_NODE,
      );
      disposer.registerResource(resource);

      const fadeConfig = {
        type: FadeType.LINEAR,
        duration: 200,
        startLevel: 0.8,
        endLevel: 0.0,
        easing: 'ease-in-out' as const,
      };

      const result = await disposer.disposeResource(
        'linear-fade',
        DisposalStrategy.GRACEFUL,
        fadeConfig,
      );

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
    });

    test('should apply exponential fade correctly', async () => {
      const resource = createAudioResource(
        'exponential-fade',
        AudioResourceType.GAIN_NODE,
      );
      disposer.registerResource(resource);

      const fadeConfig = {
        type: FadeType.EXPONENTIAL,
        duration: 100,
        startLevel: 1.0,
        endLevel: 0.001, // Must be > 0 for exponential
        easing: 'ease-out' as const,
      };

      const result = await disposer.disposeResource(
        'exponential-fade',
        DisposalStrategy.GRACEFUL,
        fadeConfig,
      );

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
    });

    test('should apply sine fade with custom curve', async () => {
      const resource = createAudioResource(
        'sine-fade',
        AudioResourceType.GAIN_NODE,
      );
      disposer.registerResource(resource);

      const fadeConfig = {
        type: FadeType.SINE,
        duration: 150,
        startLevel: 1.0,
        endLevel: 0.0,
      };

      const result = await disposer.disposeResource(
        'sine-fade',
        DisposalStrategy.GRACEFUL,
        fadeConfig,
      );

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
    });
  });

  describe('Immediate Disposal Behaviors', () => {
    test('should perform immediate disposal', async () => {
      const resource = createAudioResource(
        'immediate-test',
        AudioResourceType.AUDIO_BUFFER,
      );
      disposer.registerResource(resource);

      const result = await disposer.disposeResource(
        'immediate-test',
        DisposalStrategy.IMMEDIATE,
      );

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
      expect(result.disposalStrategy).toBe(DisposalStrategy.IMMEDIATE);
      expect(result.fadeTime).toBe(0);
    });

    test('should cleanup without fade-out', async () => {
      const toneInstrument = createAudioResource(
        'immediate-tone',
        AudioResourceType.TONE_INSTRUMENT,
      );
      disposer.registerResource(toneInstrument);

      const result = await disposer.disposeResource(
        'immediate-tone',
        DisposalStrategy.IMMEDIATE,
      );

      expectValidDisposalResult(result);
      expect(result.fadeTime).toBe(0);
    });
  });

  describe('Batch Disposal Behaviors', () => {
    test('should queue resources for batch disposal', async () => {
      const resource = createAudioResource(
        'batch-test',
        AudioResourceType.AUDIO_BUFFER,
      );
      disposer.registerResource(resource);

      const result = await disposer.disposeResource(
        'batch-test',
        DisposalStrategy.BATCH,
      );

      expectValidDisposalResult(result);
      expect(result.disposalStrategy).toBe(DisposalStrategy.BATCH);
    });

    test('should process multiple resources in batches', async () => {
      const resources = Array.from({ length: 5 }, (_, i) =>
        createAudioResource(`batch-${i}`, AudioResourceType.GAIN_NODE),
      );

      resources.forEach((resource) => disposer.registerResource(resource));

      const results = await Promise.all(
        resources.map((resource) =>
          disposer.disposeResource(resource.id, DisposalStrategy.BATCH),
        ),
      );

      results.forEach((result) => {
        expectValidDisposalResult(result);
        expect(result.disposalStrategy).toBe(DisposalStrategy.BATCH);
      });
    });

    test('should process batch disposal with size limits', async () => {
      // Register more resources than typical batch size
      for (let i = 0; i < 15; i++) {
        const resource = createAudioResource(
          `large-batch-${i}`,
          AudioResourceType.AUDIO_BUFFER,
        );
        disposer.registerResource(resource);
      }

      const results = await disposer.disposeAllResources(
        DisposalStrategy.BATCH,
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Artifact Prevention Behaviors', () => {
    test('should prevent audio artifacts during disposal', async () => {
      const playingResource = createAudioResource(
        'playing-resource',
        AudioResourceType.GAIN_NODE,
        {
          metadata: {
            createdAt: Date.now(),
            lastUsed: Date.now(),
            isPlaying: true,
            hasActiveConnections: true,
            fadeInProgress: false,
            priority: 'high' as const,
          },
        },
      );
      disposer.registerResource(playingResource);

      const result = await disposer.disposeResource(
        'playing-resource',
        DisposalStrategy.GRACEFUL,
      );

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
      expect(result.artifactsDetected).toBe(false);
      expect(result.fadeTime).toBeGreaterThan(0);
    });

    test('should wait for active connections to complete', async () => {
      const connectedResource = createAudioResource(
        'connected-resource',
        AudioResourceType.OSCILLATOR,
        {
          metadata: {
            createdAt: Date.now(),
            lastUsed: Date.now(),
            isPlaying: true,
            hasActiveConnections: true,
            fadeInProgress: false,
            priority: 'high' as const,
          },
        },
      );
      disposer.registerResource(connectedResource);

      const result = await disposer.disposeResource('connected-resource');

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
    });
  });

  describe('Dependency Management Behaviors', () => {
    test('should handle resource dependencies during disposal', async () => {
      const dependentResource = createAudioResource(
        'dependent-resource',
        AudioResourceType.AUDIO_BUFFER,
        {
          dependencies: ['dependency-1', 'dependency-2'],
          metadata: {
            createdAt: Date.now(),
            lastUsed: Date.now(),
            isPlaying: false,
            hasActiveConnections: false,
            fadeInProgress: false,
            priority: 'medium' as const,
          },
        },
      );
      disposer.registerResource(dependentResource);

      const result = await disposer.disposeResource('dependent-resource');

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
    });
  });

  describe('Deferred Disposal Behaviors', () => {
    test('should schedule deferred disposal', async () => {
      const resource = createAudioResource(
        'deferred-test',
        AudioResourceType.GAIN_NODE,
      );
      disposer.registerResource(resource);

      const result = await disposer.disposeResource(
        'deferred-test',
        DisposalStrategy.DEFERRED,
      );

      expectValidDisposalResult(result);
      expect(result.disposalStrategy).toBe(DisposalStrategy.DEFERRED);
    });
  });

  describe('Media Element Disposal Behaviors', () => {
    test('should fade out media element volume', async () => {
      const resource = createAudioResource(
        'media-element',
        AudioResourceType.MEDIA_ELEMENT,
        {
          metadata: {
            createdAt: Date.now(),
            lastUsed: Date.now(),
            isPlaying: true,
            hasActiveConnections: false,
            fadeInProgress: false,
            priority: 'medium' as const,
          },
        },
      );
      disposer.registerResource(resource);

      const result = await disposer.disposeResource(
        'media-element',
        DisposalStrategy.GRACEFUL,
      );

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
    });

    test('should handle media element cleanup properly', async () => {
      const mediaElement = createMockResourceByType(
        AudioResourceType.MEDIA_ELEMENT,
      );
      const resource = createAudioResource(
        'media-cleanup',
        AudioResourceType.MEDIA_ELEMENT,
        {
          resource: mediaElement,
        },
      );
      disposer.registerResource(resource);

      await disposer.disposeResource('media-cleanup');

      expect(mediaElement.pause).toHaveBeenCalled();
      expect(mediaElement.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('Resource Type Specific Behaviors', () => {
    test('should handle Tone.js instruments', async () => {
      const instrument = createAudioResource(
        'tone-instrument',
        AudioResourceType.TONE_INSTRUMENT,
      );
      disposer.registerResource(instrument);

      const result = await disposer.disposeResource('tone-instrument');

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
    });

    test('should handle Web Audio nodes', async () => {
      const gainNode = createAudioResource(
        'gain-node',
        AudioResourceType.GAIN_NODE,
      );
      disposer.registerResource(gainNode);

      const result = await disposer.disposeResource('gain-node');

      expectValidDisposalResult(result);
    });

    test('should handle audio buffers', async () => {
      const buffer = createAudioResource(
        'buffer',
        AudioResourceType.AUDIO_BUFFER,
      );
      disposer.registerResource(buffer);

      const result = await disposer.disposeResource('buffer');

      expectValidDisposalResult(result);
    });

    test('should call custom cleanup functions', async () => {
      const customCleanup = vi.fn().mockResolvedValue(undefined);
      const resource = createAudioResource(
        'custom',
        AudioResourceType.GAIN_NODE,
        {
          cleanup: customCleanup,
        },
      );
      disposer.registerResource(resource);

      await disposer.disposeResource('custom');

      expect(customCleanup).toHaveBeenCalled();
    });
  });

  describe('Metrics Behaviors', () => {
    test('should track disposal metrics', async () => {
      const resource = createAudioResource(
        'metrics-test',
        AudioResourceType.GAIN_NODE,
      );
      disposer.registerResource(resource);

      const initialMetrics = disposer.getMetrics();

      await disposer.disposeResource('metrics-test');

      const finalMetrics = disposer.getMetrics();
      expect(finalMetrics.totalDisposed).toBe(initialMetrics.totalDisposed + 1);
      expect(finalMetrics.totalFadeTime).toBeGreaterThanOrEqual(
        initialMetrics.totalFadeTime,
      );
    });

    test('should track disposal strategies', async () => {
      const immediate = createAudioResource(
        'immediate',
        AudioResourceType.AUDIO_BUFFER,
      );
      const graceful = createAudioResource(
        'graceful',
        AudioResourceType.GAIN_NODE,
      );

      disposer.registerResource(immediate);
      disposer.registerResource(graceful);

      await disposer.disposeResource('immediate', DisposalStrategy.IMMEDIATE);
      await disposer.disposeResource('graceful', DisposalStrategy.GRACEFUL);

      const metrics = disposer.getMetrics();
      expect(metrics.disposalsByStrategy[DisposalStrategy.IMMEDIATE]).toBe(1);
      expect(metrics.disposalsByStrategy[DisposalStrategy.GRACEFUL]).toBe(1);
    });

    test('should track disposal by type', async () => {
      const resources = [
        createAudioResource('buffer-metrics', AudioResourceType.AUDIO_BUFFER),
        createAudioResource('gain-metrics', AudioResourceType.GAIN_NODE),
        createAudioResource('tone-metrics', AudioResourceType.TONE_INSTRUMENT),
      ];

      resources.forEach((resource) => disposer.registerResource(resource));

      await disposer.disposeResource('buffer-metrics');
      await disposer.disposeResource('gain-metrics');
      await disposer.disposeResource('tone-metrics');

      const metrics = disposer.getMetrics();

      expect(
        metrics.disposalsByType[AudioResourceType.AUDIO_BUFFER],
      ).toBeGreaterThan(0);
      expect(
        metrics.disposalsByType[AudioResourceType.GAIN_NODE],
      ).toBeGreaterThan(0);
      expect(
        metrics.disposalsByType[AudioResourceType.TONE_INSTRUMENT],
      ).toBeGreaterThan(0);
    });

    test('should track artifact detection metrics', async () => {
      const resource = createAudioResource(
        'artifact-test',
        AudioResourceType.GAIN_NODE,
        {
          metadata: {
            createdAt: Date.now(),
            lastUsed: Date.now(),
            isPlaying: true,
            hasActiveConnections: true,
            fadeInProgress: false,
            priority: 'high' as const,
          },
        },
      );
      disposer.registerResource(resource);

      await disposer.disposeResource('artifact-test');

      const metrics = disposer.getMetrics();
      expectValidMetrics(metrics);
      expect(metrics.artifactsDetected).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Bulk Operations Behaviors', () => {
    test('should dispose all resources', async () => {
      const resources = [
        createAudioResource('bulk-1', AudioResourceType.GAIN_NODE),
        createAudioResource('bulk-2', AudioResourceType.AUDIO_BUFFER),
      ];

      resources.forEach((resource) => disposer.registerResource(resource));

      const results = await disposer.disposeAllResources();

      expect(results.length).toBe(2);
      results.forEach((result) => expectValidDisposalResult(result));
    });

    test('should handle empty resource list', async () => {
      const results = await disposer.disposeAllResources();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Error Handling Behaviors', () => {
    test('should handle non-existent resource disposal', async () => {
      const result = await disposer.disposeResource('non-existent');

      expectValidDisposalResult(result);
      expect(result.success).toBe(false);
    });

    test('should handle cleanup failures gracefully', async () => {
      const resource = createAudioResource(
        'cleanup-failure',
        AudioResourceType.GAIN_NODE,
        {
          cleanup: vi.fn().mockRejectedValue(new Error('Cleanup failed')),
        },
      );
      disposer.registerResource(resource);

      const result = await disposer.disposeResource('cleanup-failure');

      expectValidDisposalResult(result);
    });

    test('should continue after disposal failures', async () => {
      const failingResource = createAudioResource(
        'failing',
        AudioResourceType.TONE_INSTRUMENT,
        {
          resource: null,
        },
      );
      const normalResource = createAudioResource(
        'normal',
        AudioResourceType.GAIN_NODE,
      );

      disposer.registerResource(failingResource);
      disposer.registerResource(normalResource);

      await disposer.disposeResource('failing');
      const result = await disposer.disposeResource('normal');

      expectValidDisposalResult(result);
      expect(result.success).toBe(true);
    });

    test('should handle disposal timeout', async () => {
      const slowResource = createAudioResource(
        'slow-disposal',
        AudioResourceType.TONE_INSTRUMENT,
        {
          resource: {
            dispose: vi
              .fn()
              .mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 10000)),
              ),
            volume: { rampTo: vi.fn() },
          },
        },
      );
      disposer.registerResource(slowResource);

      const result = await disposer.disposeResource('slow-disposal');

      expectValidDisposalResult(result);
    });

    test('should handle disposal errors gracefully', async () => {
      const errorResource = createAudioResource(
        'error-disposal',
        AudioResourceType.TONE_INSTRUMENT,
        {
          resource: {
            dispose: vi.fn().mockImplementation(() => {
              throw new Error('Disposal error');
            }),
            volume: { rampTo: vi.fn() },
          },
        },
      );
      disposer.registerResource(errorResource);

      const result = await disposer.disposeResource('error-disposal');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Disposal error');
    });

    test('should handle custom cleanup function errors', async () => {
      const failingCleanup = vi
        .fn()
        .mockRejectedValue(new Error('Cleanup failed'));

      const resource = createAudioResource(
        'failing-cleanup',
        AudioResourceType.AUDIO_BUFFER,
        {
          cleanup: failingCleanup,
        },
      );
      disposer.registerResource(resource);

      const result = await disposer.disposeResource('failing-cleanup');

      expect(failingCleanup).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('Configuration Behaviors', () => {
    test('should update configuration', () => {
      const newConfig = {
        maxDisposalTime: 3000,
        batchSize: 5,
      };

      expect(() => disposer.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('Lifecycle Behaviors', () => {
    test('should destroy cleanly', () => {
      expect(() => disposer.destroy()).not.toThrow();
      expect(mockTimerService.clearInterval).toHaveBeenCalled();
    });

    test('should handle operations after destruction', () => {
      disposer.destroy();

      const resource = createAudioResource(
        'post-destroy',
        AudioResourceType.GAIN_NODE,
      );
      expect(() => disposer.registerResource(resource)).not.toThrow();
    });
  });
});
