/**
 * RecoveryEventHandlers Tests
 *
 * Tests for the central handler that wires up all recovery events
 * from ErrorRecoveryRegistry. This fixes the "dead recovery strategies"
 * issue where events were emitted but nobody was listening.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RecoveryEventHandlers } from '../RecoveryEventHandlers.js';
import { EventBus } from '../EventBus.js';

// Mock GlobalSampleCache
const mockCacheInstance = {
  evictToSize: vi.fn(),
  evictOldest: vi.fn(),
  setOfflineMode: vi.fn(),
};

vi.mock('../../../modules/storage/cache/GlobalSampleCache.js', () => ({
  GlobalSampleCache: {
    getInstance: () => mockCacheInstance,
  },
}));

// Mock AdaptiveQualityScaler and DeviceCapabilityDetector
const mockCalculateOptimalSettings = vi.fn().mockResolvedValue({
  audio: { sampleRate: 44100, bufferSize: 512 },
  instruments: { polyphony: 12, velocityLayers: 4 },
  processing: { humanization: false, microTiming: false },
  visual: { frameRate: 30, animations: true },
});

const mockDetect = vi.fn().mockResolvedValue({
  platform: 'desktop',
  cpu: { performance: 'medium', cores: 4 },
  memory: { total: 8192, usage: 50 },
  battery: { level: 100, charging: true },
  network: { speed: 'fast', type: 'wifi' },
  audio: { sampleRate: 48000 },
});

vi.mock('../../../modules/optimization/AdaptiveQualityScaler.js', () => ({
  AdaptiveQualityScaler: vi.fn().mockImplementation(() => ({
    calculateOptimalSettings: mockCalculateOptimalSettings,
  })),
}));

vi.mock('../../../modules/optimization/DeviceCapabilityDetector.js', () => ({
  DeviceCapabilityDetector: vi.fn().mockImplementation(() => ({
    detect: mockDetect,
  })),
}));

describe('RecoveryEventHandlers', () => {
  let eventBus: EventBus;
  let handlers: RecoveryEventHandlers;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus();
    handlers = new RecoveryEventHandlers(eventBus);
  });

  afterEach(() => {
    handlers.dispose();
  });

  describe('register', () => {
    it('should register all recovery event handlers', () => {
      const onSpy = vi.spyOn(eventBus, 'on');

      handlers.register();

      // Should register 6 handlers for the 6 dead recovery events
      expect(onSpy).toHaveBeenCalledWith(
        'cache:evict-old-entries',
        expect.any(Function),
      );
      expect(onSpy).toHaveBeenCalledWith(
        'storage:use-fallback-service',
        expect.any(Function),
      );
      expect(onSpy).toHaveBeenCalledWith(
        'storage:use-direct-access',
        expect.any(Function),
      );
      expect(onSpy).toHaveBeenCalledWith(
        'transport:increase-buffer-size',
        expect.any(Function),
      );
      expect(onSpy).toHaveBeenCalledWith(
        'transport:use-script-processor',
        expect.any(Function),
      );
      expect(onSpy).toHaveBeenCalledWith(
        'system:reduce-quality',
        expect.any(Function),
      );

      expect(onSpy).toHaveBeenCalledTimes(6);
    });

    it('should not register handlers twice', () => {
      const onSpy = vi.spyOn(eventBus, 'on');

      handlers.register();
      handlers.register(); // Second call should be ignored

      // Should still only have 6 registrations
      expect(onSpy).toHaveBeenCalledTimes(6);
    });

    it('should set isActive to true after registration', () => {
      expect(handlers.isActive()).toBe(false);
      handlers.register();
      expect(handlers.isActive()).toBe(true);
    });
  });

  describe('cache:evict-old-entries handler', () => {
    beforeEach(() => {
      handlers.register();
    });

    it('should call evictToSize when targetSize is provided', () => {
      eventBus.emit('cache:evict-old-entries', { targetSize: 50000000 });

      expect(mockCacheInstance.evictToSize).toHaveBeenCalledWith(50000000);
      expect(mockCacheInstance.evictOldest).not.toHaveBeenCalled();
    });

    it('should call evictOldest with 25% when targetSize is not provided', () => {
      eventBus.emit('cache:evict-old-entries', {});

      expect(mockCacheInstance.evictOldest).toHaveBeenCalledWith(0.25);
      expect(mockCacheInstance.evictToSize).not.toHaveBeenCalled();
    });
  });

  describe('storage:use-fallback-service handler', () => {
    beforeEach(() => {
      handlers.register();
    });

    it('should enable offline mode in cache', () => {
      eventBus.emit('storage:use-fallback-service', {
        serviceName: 'sample-loader',
      });

      expect(mockCacheInstance.setOfflineMode).toHaveBeenCalledWith(true);
    });
  });

  describe('storage:use-direct-access handler', () => {
    beforeEach(() => {
      handlers.register();
    });

    it('should handle direct access event (logging only for now)', () => {
      // This handler currently just logs - no assertion needed
      // Just verify it doesn't throw
      expect(() => {
        eventBus.emit('storage:use-direct-access', { reason: 'CDN failure' });
      }).not.toThrow();
    });
  });

  describe('transport:increase-buffer-size handler', () => {
    beforeEach(() => {
      handlers.register();
    });

    it('should emit UI notification for latency issues', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      eventBus.emit('transport:increase-buffer-size', {
        currentLatency: 50,
        targetLatency: 20,
      });

      expect(emitSpy).toHaveBeenCalledWith('ui:show-notification', {
        type: 'warning',
        message:
          'Audio latency detected. Refresh page if audio issues persist.',
      });
    });
  });

  describe('transport:use-script-processor handler', () => {
    beforeEach(() => {
      handlers.register();
    });

    it('should emit error notification for worklet fallback', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      eventBus.emit('transport:use-script-processor', {
        reason: 'AudioWorklet not supported',
      });

      expect(emitSpy).toHaveBeenCalledWith('ui:show-notification', {
        type: 'error',
        message: 'Audio processing error. Please refresh the page.',
      });
    });
  });

  describe('system:reduce-quality handler', () => {
    beforeEach(() => {
      handlers.register();
    });

    it('should calculate reduced quality settings', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      eventBus.emit('system:reduce-quality', {
        reason: 'CPU overload',
        targetCpuUsage: 70,
      });

      // Wait for async handler
      await vi.waitFor(() => {
        expect(mockDetect).toHaveBeenCalled();
      });

      expect(mockCalculateOptimalSettings).toHaveBeenCalled();

      // Should emit quality:reduced event
      await vi.waitFor(() => {
        expect(emitSpy).toHaveBeenCalledWith(
          'quality:reduced',
          expect.objectContaining({
            reason: 'CPU overload',
          }),
        );
      });
    });

    it('should use default reason when not provided', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      eventBus.emit('system:reduce-quality', {});

      await vi.waitFor(() => {
        expect(emitSpy).toHaveBeenCalledWith(
          'quality:reduced',
          expect.objectContaining({
            reason: 'performance',
          }),
        );
      });
    });
  });

  describe('dispose', () => {
    it('should unsubscribe all handlers on dispose', () => {
      handlers.register();
      expect(handlers.isActive()).toBe(true);

      handlers.dispose();

      expect(handlers.isActive()).toBe(false);
    });

    it('should not respond to events after dispose', () => {
      handlers.register();
      handlers.dispose();

      // Emit event after dispose - should not call handler
      eventBus.emit('cache:evict-old-entries', { targetSize: 50000000 });

      expect(mockCacheInstance.evictToSize).not.toHaveBeenCalled();
    });
  });
});

describe('RecoveryEventHandlers Integration', () => {
  it('should handle all 6 recovery events in sequence', () => {
    const eventBus = new EventBus();
    const handlers = new RecoveryEventHandlers(eventBus);
    handlers.register();

    // Verify none throw when emitted
    expect(() => {
      eventBus.emit('cache:evict-old-entries', {});
      eventBus.emit('storage:use-fallback-service', {});
      eventBus.emit('storage:use-direct-access', {});
      eventBus.emit('transport:increase-buffer-size', {});
      eventBus.emit('transport:use-script-processor', {});
      eventBus.emit('system:reduce-quality', {});
    }).not.toThrow();

    handlers.dispose();
  });
});
