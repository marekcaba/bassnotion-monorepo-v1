/**
 * LoopController Tests
 *
 * Comprehensive test suite for the Advanced Section Looping System
 * covering loop management, crossfades, boundary detection, nested loops,
 * practice progression tracking, and auto-punch recording.
 *
 * Part of Story 2.3: Real-time Playback Controls & Advanced Manipulation
 * Task 8: Develop Advanced Section Looping Core
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LoopController,
  CrossfadeType,
  BoundaryDetectionMode,
  MusicalTime,
  LoopRegion,
} from '../LoopController.js';

// Mock dependencies
vi.mock('../CorePlaybackEngine.js', () => ({
  CorePlaybackEngine: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      on: vi.fn(),
      getTransport: vi.fn(() => ({
        bpm: { value: 120 },
        seconds: 0,
      })),
    })),
  },
}));

vi.mock('../PrecisionSynchronizationEngine.js', () => ({
  PrecisionSynchronizationEngine: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      on: vi.fn(),
      getCurrentTempo: vi.fn(() => 120),
      getCurrentMusicalPosition: vi.fn(() => ({
        bars: 1,
        beats: 1,
        subdivisions: 0,
        totalBeats: 1,
      })),
    })),
  },
}));

vi.mock('../AnalyticsEngine.js', () => ({
  AnalyticsEngine: vi.fn(() => ({
    initialize: vi.fn(),
    trackControlUsage: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('../ComprehensiveStateManager.js', () => ({
  ComprehensiveStateManager: {
    getInstance: vi.fn(() => ({
      registerComponent: vi.fn(),
    })),
  },
}));

vi.mock('../MixingConsole.js', () => ({
  MixingConsole: {
    getInstance: vi.fn(() => ({})),
  },
}));

vi.mock('../AudioContextManager.js', () => ({
  AudioContextManager: {
    getInstance: vi.fn(() => ({
      getContext: vi.fn(() => ({
        sampleRate: 44100,
        currentTime: 0,
      })),
    })),
  },
}));

// Mock Tone.js
vi.mock('tone', () => ({
  getTransport: vi.fn(() => ({
    bpm: { value: 120 },
    seconds: 0,
  })),
}));

describe('LoopController', () => {
  let controller: LoopController;

  // Test data
  const createTestMusicalTime = (
    bars = 1,
    beats = 1,
    subdivisions = 0,
    absoluteTime = 0,
    transportTime = 0,
  ): MusicalTime => ({
    bars,
    beats,
    subdivisions,
    totalBeats: (bars - 1) * 4 + beats,
    absoluteTime,
    transportTime,
  });

  const testStartTime = createTestMusicalTime(1, 1, 0, 0, 0);
  const testEndTime = createTestMusicalTime(2, 1, 0, 4, 4);

  beforeEach(async () => {
    controller = LoopController.getInstance();
    await controller.initialize();
  });

  afterEach(async () => {
    await controller.dispose();
    // Reset the singleton instance for clean tests
    (LoopController as any).instance = undefined;
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const newController = LoopController.getInstance();
      await expect(newController.initialize()).resolves.not.toThrow();
    });

    test('should be singleton', () => {
      const controller1 = LoopController.getInstance();
      const controller2 = LoopController.getInstance();
      expect(controller1).toBe(controller2);
    });

    test('should have default configuration', () => {
      const config = controller.getConfig();
      expect(config.defaultCrossfadeDuration).toBe(0.1);
      expect(config.defaultCrossfadeType).toBe('equal-power');
      expect(config.boundaryDetectionMode).toBe('intelligent');
      expect(config.maxNestedLoops).toBe(5);
      expect(config.maxActiveLoops).toBe(3);
    });
  });

  describe('Loop Creation', () => {
    test('should create a basic loop successfully', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);

      expect(loop).toBeDefined();
      expect(loop.id).toBeTruthy();
      expect(loop.name).toBe('Loop 1');
      expect(loop.state).toBe('inactive');
      expect(loop.enabled).toBe(true);
      expect(loop.nestingLevel).toBe(0);
      expect(loop.boundary.start).toEqual(testStartTime);
      expect(loop.boundary.end).toEqual(testEndTime);
    });

    test('should create loop with custom options', async () => {
      const options = {
        name: 'Custom Loop',
        crossfadeType: 'linear' as CrossfadeType,
        crossfadeDuration: 0.2,
        boundaryDetectionMode: 'manual' as BoundaryDetectionMode,
      };

      const loop = await controller.createLoop(
        testStartTime,
        testEndTime,
        options,
      );

      expect(loop.name).toBe('Custom Loop');
      expect(loop.crossfade.type).toBe('linear');
      expect(loop.crossfade.duration).toBe(0.2);
    });

    test('should validate loop boundaries', async () => {
      // Test invalid boundaries (start >= end)
      await expect(
        controller.createLoop(testEndTime, testStartTime),
      ).rejects.toThrow('Loop start time must be before end time');

      // Test too short duration
      const shortEnd = createTestMusicalTime(1, 1, 0, 0.05, 0.05);
      await expect(
        controller.createLoop(testStartTime, shortEnd),
      ).rejects.toThrow('Loop duration must be at least 100ms');

      // Test too long duration
      const longEnd = createTestMusicalTime(1, 1, 0, 301, 301);
      await expect(
        controller.createLoop(testStartTime, longEnd),
      ).rejects.toThrow('Loop duration cannot exceed 5 minutes');
    });

    test('should initialize practice data correctly', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);

      expect(loop.practiceData.totalPlaythroughs).toBe(0);
      expect(loop.practiceData.successfulPlaythroughs).toBe(0);
      expect(loop.practiceData.masteryLevel).toBe('learning');
      expect(loop.practiceData.tempoProgression.startTempo).toBe(120);
      expect(loop.practiceData.tempoProgression.currentTempo).toBe(120);
      expect(loop.practiceData.tempoProgression.targetTempo).toBe(144); // 20% faster
    });

    test('should initialize recording configuration', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);

      expect(loop.recordingConfig.mode).toBe('auto-punch');
      expect(loop.recordingConfig.inputSource).toBe('microphone');
      expect(loop.recordingConfig.quality.sampleRate).toBe(44100);
      expect(loop.recordingConfig.quality.bitDepth).toBe(24);
      expect(loop.recordingConfig.quality.channels).toBe(1);
    });

    test('should track loop creation in analytics', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);

      // Analytics tracking should be called
      expect(
        vi.mocked(LoopController as any).getInstance().analyticsEngine
          .trackControlUsage,
      ).toHaveBeenCalledWith(
        'loop_created',
        expect.objectContaining({
          loopId: loop.id,
          duration: expect.any(Number),
          nestingLevel: 0,
          creationTime: expect.any(Number),
        }),
      );
    });
  });

  describe('Nested Loops', () => {
    test('should create nested loops correctly', async () => {
      // Create parent loop
      const parentLoop = await controller.createLoop(
        testStartTime,
        testEndTime,
      );

      // Create child loop
      const childStart = createTestMusicalTime(1, 2, 0, 1, 1);
      const childEnd = createTestMusicalTime(1, 3, 0, 2, 2);
      const childLoop = await controller.createLoop(childStart, childEnd, {
        name: 'Child Loop',
        parentLoopId: parentLoop.id,
      });

      expect(childLoop.parentLoopId).toBe(parentLoop.id);
      expect(childLoop.nestingLevel).toBe(1);
      expect(parentLoop.childLoopIds).toContain(childLoop.id);
    });

    test('should enforce maximum nesting level', async () => {
      let currentParentId: string | undefined;

      // Create loops up to the maximum nesting level (0, 1, 2, 3, 4)
      for (let i = 0; i < 5; i++) {
        const start = createTestMusicalTime(1, i + 1, 0, i, i);
        const end = createTestMusicalTime(1, i + 2, 0, i + 1, i + 1);

        const loop = await controller.createLoop(start, end, {
          parentLoopId: currentParentId,
        });
        currentParentId = loop.id;
        expect(loop.nestingLevel).toBe(i);
      }

      // Now try to create a 6th level (level 5) which should fail
      const start = createTestMusicalTime(1, 6, 0, 5, 5);
      const end = createTestMusicalTime(1, 7, 0, 6, 6);

      await expect(
        controller.createLoop(start, end, {
          parentLoopId: currentParentId,
        }),
      ).rejects.toThrow('Maximum nesting level (5) exceeded');
    });

    test('should calculate nesting level correctly', async () => {
      const level0 = await controller.createLoop(testStartTime, testEndTime);

      const level1Start = createTestMusicalTime(1, 2, 0, 1, 1);
      const level1End = createTestMusicalTime(1, 3, 0, 2, 2);
      const level1 = await controller.createLoop(level1Start, level1End, {
        parentLoopId: level0.id,
      });

      const level2Start = createTestMusicalTime(1, 2, 2, 1.5, 1.5);
      const level2End = createTestMusicalTime(1, 2, 6, 1.75, 1.75);
      const level2 = await controller.createLoop(level2Start, level2End, {
        parentLoopId: level1.id,
      });

      expect(level0.nestingLevel).toBe(0);
      expect(level1.nestingLevel).toBe(1);
      expect(level2.nestingLevel).toBe(2);
    });
  });

  describe('Loop State Management', () => {
    let testLoop: LoopRegion;

    beforeEach(async () => {
      testLoop = await controller.createLoop(testStartTime, testEndTime);
    });

    test('should enable loop successfully', async () => {
      expect(testLoop.state).toBe('inactive');

      await controller.enableLoop(testLoop.id);

      const updatedLoop = controller.getLoop(testLoop.id);
      expect(updatedLoop?.state).toBe('active');
      expect(controller.getActiveLoops()).toHaveLength(1);
      expect(controller.getCurrentLoop()?.id).toBe(testLoop.id);
    });

    test('should disable loop successfully', async () => {
      await controller.enableLoop(testLoop.id);
      expect(controller.getActiveLoops()).toHaveLength(1);

      await controller.disableLoop(testLoop.id);

      const updatedLoop = controller.getLoop(testLoop.id);
      expect(updatedLoop?.state).toBe('inactive');
      expect(controller.getActiveLoops()).toHaveLength(0);
      expect(controller.getCurrentLoop()).toBeNull();
    });

    test('should handle loop not found error', async () => {
      await expect(controller.enableLoop('non-existent-loop')).rejects.toThrow(
        'Loop not found: non-existent-loop',
      );

      await expect(controller.disableLoop('non-existent-loop')).rejects.toThrow(
        'Loop not found: non-existent-loop',
      );
    });

    test('should enforce maximum active loops limit', async () => {
      // Create and enable loops up to the limit
      const loops: LoopRegion[] = [];
      for (let i = 0; i < 3; i++) {
        const start = createTestMusicalTime(i + 1, 1, 0, i * 4, i * 4);
        const end = createTestMusicalTime(
          i + 2,
          1,
          0,
          (i + 1) * 4,
          (i + 1) * 4,
        );
        const loop = await controller.createLoop(start, end, {
          name: `Loop ${i + 1}`,
        });
        loops.push(loop);
        await controller.enableLoop(loop.id);
      }

      expect(controller.getActiveLoops()).toHaveLength(3);

      // Try to enable one more loop (should fail)
      const extraStart = createTestMusicalTime(5, 1, 0, 16, 16);
      const extraEnd = createTestMusicalTime(6, 1, 0, 20, 20);
      const extraLoop = await controller.createLoop(extraStart, extraEnd);

      await expect(controller.enableLoop(extraLoop.id)).rejects.toThrow(
        'Maximum active loops (3) limit reached',
      );
    });

    test('should handle enabling already active loop', async () => {
      await controller.enableLoop(testLoop.id);

      // Should not throw when enabling already active loop
      await expect(controller.enableLoop(testLoop.id)).resolves.not.toThrow();
      expect(controller.getActiveLoops()).toHaveLength(1);
    });

    test('should handle disabling already inactive loop', async () => {
      expect(testLoop.state).toBe('inactive');

      // Should not throw when disabling already inactive loop
      await expect(controller.disableLoop(testLoop.id)).resolves.not.toThrow();
      expect(controller.getActiveLoops()).toHaveLength(0);
    });
  });

  describe('Crossfade Configuration', () => {
    test('should create default crossfade configuration', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);

      expect(loop.crossfade.type).toBe('equal-power');
      expect(loop.crossfade.duration).toBe(0.1);
      expect(loop.crossfade.curve).toBeInstanceOf(Float32Array);
      expect(loop.crossfade.preRoll).toBe(0.05);
      expect(loop.crossfade.postRoll).toBe(0.05);
    });

    test('should create custom crossfade configuration', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime, {
        crossfadeType: 'exponential',
        crossfadeDuration: 0.25,
      });

      expect(loop.crossfade.type).toBe('exponential');
      expect(loop.crossfade.duration).toBe(0.25);
      expect(loop.crossfade.preRoll).toBe(0.125);
      expect(loop.crossfade.postRoll).toBe(0.125);
    });

    test('should generate different crossfade curves for different types', async () => {
      const linearLoop = await controller.createLoop(
        testStartTime,
        testEndTime,
        {
          crossfadeType: 'linear',
        },
      );

      const exponentialLoop = await controller.createLoop(
        createTestMusicalTime(3, 1, 0, 8, 8),
        createTestMusicalTime(4, 1, 0, 12, 12),
        { crossfadeType: 'exponential' },
      );

      expect(linearLoop.crossfade.curve).not.toEqual(
        exponentialLoop.crossfade.curve,
      );
      expect(linearLoop.crossfade.curve.length).toBeGreaterThan(0);
      expect(exponentialLoop.crossfade.curve.length).toBeGreaterThan(0);
    });
  });

  describe('Practice Progression', () => {
    let testLoop: LoopRegion;

    beforeEach(async () => {
      testLoop = await controller.createLoop(testStartTime, testEndTime, {
        enableProgression: true,
      });
    });

    test('should initialize practice data with correct defaults', () => {
      expect(testLoop.practiceData.totalPlaythroughs).toBe(0);
      expect(testLoop.practiceData.successfulPlaythroughs).toBe(0);
      expect(testLoop.practiceData.averageAccuracy).toBe(0);
      expect(testLoop.practiceData.bestAccuracy).toBe(0);
      expect(testLoop.practiceData.practiceTime).toBe(0);
      expect(testLoop.practiceData.masteryLevel).toBe('learning');
      expect(testLoop.practiceData.mistakePatterns).toEqual([]);
      expect(testLoop.practiceData.progressionHistory).toEqual([]);
    });

    test('should initialize tempo progression correctly', () => {
      const tempoProgression = testLoop.practiceData.tempoProgression;

      expect(tempoProgression.startTempo).toBe(120);
      expect(tempoProgression.currentTempo).toBe(120);
      expect(tempoProgression.targetTempo).toBe(144); // 20% faster
      expect(tempoProgression.progressionStrategy).toBe('gradual');
      expect(tempoProgression.incrementSize).toBe(5);
      expect(tempoProgression.masteryThreshold).toBe(0.7); // practicing threshold
    });

    test('should have correct mastery thresholds in config', () => {
      const config = controller.getConfig();

      expect(config.masteryThresholds.learning).toBe(0.6);
      expect(config.masteryThresholds.practicing).toBe(0.7);
      expect(config.masteryThresholds.improving).toBe(0.8);
      expect(config.masteryThresholds.proficient).toBe(0.9);
      expect(config.masteryThresholds.mastered).toBe(0.95);
    });
  });

  describe('Recording Configuration', () => {
    test('should initialize recording config with defaults', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);
      const recordingConfig = loop.recordingConfig;

      expect(recordingConfig.mode).toBe('auto-punch');
      expect(recordingConfig.inputSource).toBe('microphone');
      expect(recordingConfig.quality.sampleRate).toBe(44100);
      expect(recordingConfig.quality.bitDepth).toBe(24);
      expect(recordingConfig.quality.channels).toBe(1);
    });

    test('should initialize punch configuration', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);
      const punchConfig = loop.recordingConfig.punchConfig;

      expect(punchConfig.preRoll).toBe(1.0);
      expect(punchConfig.postRoll).toBe(0.5);
      expect(punchConfig.threshold).toBe(0.01);
      expect(punchConfig.sensitivity).toBe(0.7);
    });

    test('should initialize overdub configuration', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);
      const overdubConfig = loop.recordingConfig.overdubConfig;

      expect(overdubConfig.enabled).toBe(false);
      expect(overdubConfig.mixLevel).toBe(0.5);
      expect(overdubConfig.fadeIn).toBe(0.1);
      expect(overdubConfig.fadeOut).toBe(0.1);
    });
  });

  describe('Event System', () => {
    test('should emit loopCreated event', async () => {
      const eventHandler = vi.fn();
      controller.on('loopCreated', eventHandler);

      const loop = await controller.createLoop(testStartTime, testEndTime);

      expect(eventHandler).toHaveBeenCalledWith(loop);
    });

    test('should emit loopStateChanged event', async () => {
      const eventHandler = vi.fn();
      const loop = await controller.createLoop(testStartTime, testEndTime);

      controller.on('loopStateChanged', eventHandler);
      await controller.enableLoop(loop.id);

      expect(eventHandler).toHaveBeenCalledWith(loop.id, 'inactive', 'active');
    });

    test('should return unsubscribe function', async () => {
      const eventHandler = vi.fn();
      const unsubscribe = controller.on('loopCreated', eventHandler);

      // Create loop - handler should be called
      await controller.createLoop(testStartTime, testEndTime);
      expect(eventHandler).toHaveBeenCalledTimes(1);

      // Unsubscribe and create another loop - handler should not be called
      unsubscribe();
      await controller.createLoop(
        createTestMusicalTime(3, 1, 0, 8, 8),
        createTestMusicalTime(4, 1, 0, 12, 12),
      );
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    test('should handle errors in event handlers gracefully', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Event handler error');
      });

      controller.on('loopCreated', errorHandler);

      // Should not throw despite handler error
      await expect(
        controller.createLoop(testStartTime, testEndTime),
      ).resolves.not.toThrow();

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    test('should return configuration copy', () => {
      const config1 = controller.getConfig();
      const config2 = controller.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different objects
    });

    test('should update configuration', () => {
      const eventHandler = vi.fn();
      controller.on('configurationChanged', eventHandler);

      const updates = {
        defaultCrossfadeDuration: 0.2,
        maxActiveLoops: 5,
        recordingEnabled: false,
      };

      controller.updateConfig(updates);

      const newConfig = controller.getConfig();
      expect(newConfig.defaultCrossfadeDuration).toBe(0.2);
      expect(newConfig.maxActiveLoops).toBe(5);
      expect(newConfig.recordingEnabled).toBe(false);

      expect(eventHandler).toHaveBeenCalledWith(newConfig);
    });

    test('should preserve unchanged configuration values', () => {
      const originalConfig = controller.getConfig();

      controller.updateConfig({ defaultCrossfadeDuration: 0.3 });

      const newConfig = controller.getConfig();
      expect(newConfig.defaultCrossfadeType).toBe(
        originalConfig.defaultCrossfadeType,
      );
      expect(newConfig.boundaryDetectionMode).toBe(
        originalConfig.boundaryDetectionMode,
      );
      expect(newConfig.defaultCrossfadeDuration).toBe(0.3); // Only this should change
    });
  });

  describe('State Management', () => {
    test('should get all loops', async () => {
      expect(controller.getAllLoops()).toHaveLength(0);

      const loop1 = await controller.createLoop(testStartTime, testEndTime);
      const loop2 = await controller.createLoop(
        createTestMusicalTime(3, 1, 0, 8, 8),
        createTestMusicalTime(4, 1, 0, 12, 12),
      );

      const allLoops = controller.getAllLoops();
      expect(allLoops).toHaveLength(2);
      expect(allLoops.map((l) => l.id)).toContain(loop1.id);
      expect(allLoops.map((l) => l.id)).toContain(loop2.id);
    });

    test('should get active loops only', async () => {
      const loop1 = await controller.createLoop(testStartTime, testEndTime);
      const loop2 = await controller.createLoop(
        createTestMusicalTime(3, 1, 0, 8, 8),
        createTestMusicalTime(4, 1, 0, 12, 12),
      );

      expect(controller.getActiveLoops()).toHaveLength(0);

      await controller.enableLoop(loop1.id);
      expect(controller.getActiveLoops()).toHaveLength(1);
      expect(controller.getActiveLoops()[0]?.id).toBe(loop1.id);

      await controller.enableLoop(loop2.id);
      expect(controller.getActiveLoops()).toHaveLength(2);
    });

    test('should track current loop correctly', async () => {
      expect(controller.getCurrentLoop()).toBeNull();

      const loop1 = await controller.createLoop(testStartTime, testEndTime);
      await controller.enableLoop(loop1.id);
      expect(controller.getCurrentLoop()?.id).toBe(loop1.id);

      const loop2 = await controller.createLoop(
        createTestMusicalTime(3, 1, 0, 8, 8),
        createTestMusicalTime(4, 1, 0, 12, 12),
      );
      await controller.enableLoop(loop2.id);
      expect(controller.getCurrentLoop()?.id).toBe(loop1.id); // Should still be first

      await controller.disableLoop(loop1.id);
      expect(controller.getCurrentLoop()?.id).toBe(loop2.id); // Should switch to second
    });

    test('should get specific loop by ID', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);

      expect(controller.getLoop(loop.id)).toEqual(loop);
      expect(controller.getLoop('non-existent')).toBeUndefined();
    });
  });

  describe('Performance Metrics', () => {
    test('should track loop creation metrics', async () => {
      const initialMetrics = controller.getPerformanceMetrics();
      expect(initialMetrics.totalLoopsCreated).toBe(0);

      await controller.createLoop(testStartTime, testEndTime);

      const updatedMetrics = controller.getPerformanceMetrics();
      expect(updatedMetrics.totalLoopsCreated).toBe(1);
      expect(updatedMetrics.lastMeasurement).toBeGreaterThan(
        initialMetrics.lastMeasurement,
      );
    });

    test('should return metrics copy', () => {
      const metrics1 = controller.getPerformanceMetrics();
      const metrics2 = controller.getPerformanceMetrics();

      expect(metrics1).toEqual(metrics2);
      expect(metrics1).not.toBe(metrics2); // Should be different objects
    });
  });

  describe('Integration with Core Systems', () => {
    test('should handle tempo changes', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);

      // Simulate tempo change from sync engine
      const tempoChangeHandler = vi
        .mocked(controller as any)
        .syncEngine.on.mock.calls.find(
          (call: any) => call[0] === 'tempoChange',
        )?.[1];

      if (tempoChangeHandler) {
        tempoChangeHandler(140);

        const updatedLoop = controller.getLoop(loop.id);
        expect(updatedLoop?.practiceData.tempoProgression.currentTempo).toBe(
          140,
        );
      }
    });

    test('should handle playback state changes', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);
      await controller.enableLoop(loop.id);

      // Simulate stopped state from core engine
      const stateChangeHandler = vi
        .mocked(controller as any)
        .coreEngine.on.mock.calls.find(
          (call: any) => call[0] === 'stateChange',
        )?.[1];

      if (stateChangeHandler) {
        stateChangeHandler('stopped');

        const updatedLoop = controller.getLoop(loop.id);
        expect(updatedLoop?.state).toBe('paused');
      }
    });
  });

  describe('Error Handling', () => {
    test('should throw error when not initialized', async () => {
      const newController = LoopController.getInstance();
      await newController.dispose(); // Ensure not initialized

      await expect(
        newController.createLoop(testStartTime, testEndTime),
      ).rejects.toThrow('LoopController not initialized');
    });

    test('should handle component initialization failures gracefully', async () => {
      // Create a fresh controller instance for this test
      (LoopController as any).instance = undefined;
      const failingController = LoopController.getInstance();

      // Mock component initialization failure
      vi.spyOn(
        failingController as any,
        'setupCoreSynchronization',
      ).mockImplementation(() => {
        throw new Error('Component initialization failed');
      });

      await expect(failingController.initialize()).rejects.toThrow(
        'Component initialization failed',
      );
    });
  });

  describe('Loop Analysis Integration', () => {
    test('should trigger loop analysis on creation', async () => {
      const analysisHandler = vi.fn();
      controller.on('analysisCompleted', analysisHandler);

      const loop = await controller.createLoop(testStartTime, testEndTime, {
        enableProgression: true,
      });

      // Allow time for async analysis
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(analysisHandler).toHaveBeenCalledWith(
        loop.id,
        expect.objectContaining({
          musicalStructure: expect.any(Object),
          difficulty: expect.any(Object),
          recommendations: expect.any(Object),
        }),
      );
    });

    test('should not trigger analysis when disabled', async () => {
      const analysisHandler = vi.fn();
      controller.on('analysisCompleted', analysisHandler);

      await controller.createLoop(testStartTime, testEndTime, {
        enableProgression: false,
      });

      // Allow time for potential async analysis
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(analysisHandler).not.toHaveBeenCalled();
    });
  });

  describe('Disposal and Cleanup', () => {
    test('should dispose successfully', async () => {
      const loop = await controller.createLoop(testStartTime, testEndTime);
      await controller.enableLoop(loop.id);

      await expect(controller.dispose()).resolves.not.toThrow();

      expect(controller.getAllLoops()).toHaveLength(0);
      expect(controller.getActiveLoops()).toHaveLength(0);
      expect(controller.getCurrentLoop()).toBeNull();
    });

    test('should disable all active loops during disposal', async () => {
      const loop1 = await controller.createLoop(testStartTime, testEndTime);
      const loop2 = await controller.createLoop(
        createTestMusicalTime(3, 1, 0, 8, 8),
        createTestMusicalTime(4, 1, 0, 12, 12),
      );

      await controller.enableLoop(loop1.id);
      await controller.enableLoop(loop2.id);
      expect(controller.getActiveLoops()).toHaveLength(2);

      await controller.dispose();

      expect(controller.getActiveLoops()).toHaveLength(0);
    });

    test('should handle disposal errors gracefully', async () => {
      // Mock a disposal error
      vi.spyOn(controller as any, 'disableLoop').mockRejectedValueOnce(
        new Error('Disposal error'),
      );

      const loop = await controller.createLoop(testStartTime, testEndTime);
      await controller.enableLoop(loop.id);

      await expect(controller.dispose()).rejects.toThrow('Disposal error');
    });
  });

  describe('Loop ID Generation', () => {
    test('should generate unique loop IDs', async () => {
      const loop1 = await controller.createLoop(testStartTime, testEndTime);
      const loop2 = await controller.createLoop(
        createTestMusicalTime(3, 1, 0, 8, 8),
        createTestMusicalTime(4, 1, 0, 12, 12),
      );

      expect(loop1.id).not.toBe(loop2.id);
      expect(loop1.id).toMatch(/^loop_\d+_[a-z0-9]+$/);
      expect(loop2.id).toMatch(/^loop_\d+_[a-z0-9]+$/);
    });
  });

  describe('Crossfade Curve Generation', () => {
    test('should generate valid curves for all crossfade types', async () => {
      const types: CrossfadeType[] = [
        'linear',
        'exponential',
        'equal-power',
        'custom',
      ];

      for (const type of types.slice(0, 3)) {
        // Skip 'custom' for now
        const loop = await controller.createLoop(testStartTime, testEndTime, {
          crossfadeType: type,
          crossfadeDuration: 0.1,
        });

        expect(loop.crossfade.curve).toBeInstanceOf(Float32Array);
        expect(loop.crossfade.curve.length).toBeGreaterThan(0);

        // Check curve starts at 0 and ends at 1 (or close)
        expect(loop.crossfade.curve[0]).toBeCloseTo(0, 2);
        expect(
          loop.crossfade.curve[loop.crossfade.curve.length - 1],
        ).toBeCloseTo(1, 2);
      }
    });

    test('should generate curves with correct sample count', async () => {
      const duration = 0.2; // 200ms
      const loop = await controller.createLoop(testStartTime, testEndTime, {
        crossfadeDuration: duration,
      });

      const expectedSamples = Math.floor(duration * 44100); // Sample rate is mocked as 44100
      expect(loop.crossfade.curve.length).toBe(expectedSamples);
    });
  });
});
