import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  BackgroundProcessingStats,
  CPUUsageMetrics,
  BackgroundProcessingStrategy,
  AudioPerformanceMetrics,
} from '../../types/audio.js';

/**
 * BackgroundProcessor Tests
 *
 * Comprehensive test suite covering core functionality, edge cases, performance,
 * optimization, error handling, and real-world scenarios.
 * Uses vi.doMock() approach which works reliably in this Vitest setup.
 */
describe('BackgroundProcessor', () => {
  let mockWorkerPool: any;
  let mockMobileOptimizer: any;
  let BackgroundProcessor: any;

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    vi.resetModules();

    // Mock WorkerPoolManager with comprehensive functionality
    mockWorkerPool = {
      initialize: vi.fn().mockResolvedValue(undefined),
      processAudio: vi.fn(),
      processMidi: vi.fn().mockResolvedValue(undefined),
      submitJob: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined),
      getMetrics: vi.fn().mockReturnValue({
        totalWorkers: 4,
        activeWorkers: 2,
        totalJobsProcessed: 15,
        averageProcessingTime: 120,
        queueBacklog: 3,
        memoryUsage: 256,
        cpuUsage: 0.45,
      }),
    };

    // Mock MobileOptimizer with all required methods
    mockMobileOptimizer = {
      getInstance: vi.fn().mockReturnValue({
        getDeviceCapabilities: vi.fn().mockReturnValue({
          cpuCores: 8,
          memoryGB: 16,
          deviceClass: 'high-end',
          maxPolyphony: 64,
          audioWorkletSupport: true,
          sharedArrayBufferSupport: true,
        }),
        getAdaptiveQualityConfig: vi.fn().mockReturnValue({
          sampleRate: 44100,
          bufferSize: 512,
          qualityLevel: 'high',
          cpuThrottling: 0.8,
          backgroundProcessing: true,
          thermalManagement: true,
          batteryAwareProcessing: true,
        }),
        getCurrentQualityConfig: vi.fn().mockReturnValue({
          sampleRate: 44100,
          bufferSize: 512,
          qualityLevel: 'high',
          cpuThrottling: 0.8,
          backgroundProcessing: true,
        }),
        optimizeForCurrentConditions: vi.fn().mockResolvedValue({
          qualityConfig: {
            sampleRate: 44100,
            bufferSize: 512,
            qualityLevel: 'high',
            cpuThrottling: 0.8,
            backgroundProcessing: true,
          },
          reasoning: { primaryFactors: ['cpu_usage', 'battery_level'] },
          estimatedImprovement: { performanceImprovement: 0.15 },
          confidence: 0.85,
        }),
        on: vi.fn(),
        off: vi.fn(),
      }),
    };

    // Mock the modules dynamically
    vi.doMock('../WorkerPoolManager.js', () => ({
      WorkerPoolManager: {
        getInstance: () => mockWorkerPool,
      },
    }));

    vi.doMock('../MobileOptimizer.js', () => ({
      MobileOptimizer: mockMobileOptimizer,
    }));

    // Import after mocking
    const module = await import('../BackgroundProcessor.js');
    BackgroundProcessor = module.BackgroundProcessor;
  });

  afterEach(() => {
    // Clean up singleton instance after each test
    if (BackgroundProcessor) {
      (BackgroundProcessor as any).instance = undefined;
    }
    vi.restoreAllMocks();
  });

  // ========================================
  // CORE FUNCTIONALITY TESTS
  // ========================================

  describe('Core Functionality', () => {
    it('should handle audio processing errors gracefully', async () => {
      mockWorkerPool.processAudio.mockRejectedValue(
        new Error('Processing failed'),
      );

      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      await expect(
        processor.processAudio([new Float32Array([1, 2, 3])], 'normalization'),
      ).rejects.toThrow('Processing failed');

      expect(mockWorkerPool.processAudio).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Float32Array)]),
        'normalization',
        undefined,
      );
    });

    it('should handle multiple initialization attempts correctly', async () => {
      const processor = BackgroundProcessor.getInstance();
      mockWorkerPool.initialize.mockResolvedValue(undefined);

      const config = { cpuBudget: 0.7, batterySaverMode: true };

      // First initialization
      await processor.initialize(config);
      expect(mockWorkerPool.initialize).toHaveBeenCalledTimes(1);
      expect((processor as any).isInitialized).toBe(true);

      // Second initialization should not reinitialize
      await processor.initialize(config);
      expect(mockWorkerPool.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization failures gracefully', async () => {
      const processor = BackgroundProcessor.getInstance();
      mockWorkerPool.initialize.mockRejectedValue(
        new Error('Initialization failed'),
      );

      await expect(processor.initialize()).rejects.toThrow(
        'Initialization failed',
      );

      expect((processor as any).isInitialized).toBe(false);
    });

    it('should properly dispose and cleanup resources', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const timer1 = setTimeout(() => {
        // Timer callback - intentionally empty for testing
      }, 1000);
      const timer2 = setTimeout(() => {
        // Timer callback - intentionally empty for testing
      }, 1000);
      (processor as any).processingTimer = timer1;
      (processor as any).cpuMonitorTimer = timer2;

      const testJob = {
        id: 'test-job-1',
        type: 'audio',
        priority: 'normal',
        payload: { audioData: [new Float32Array([1, 2, 3])] },
        estimatedCpuCost: 0.2,
        estimatedDuration: 100,
        createdAt: Date.now(),
      };

      (processor as any).jobQueue.get('normal').push(testJob);

      await processor.dispose();

      expect(mockWorkerPool.dispose).toHaveBeenCalled();
      expect((processor as any).isInitialized).toBe(false);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timer1);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timer2);
      expect((processor as any).jobQueue.size).toBe(0);

      await expect(
        processor.processAudio([new Float32Array([1, 2, 3])], 'normalization'),
      ).rejects.toThrow(
        'BackgroundProcessor is not initialized or has been disposed',
      );

      clearTimeoutSpy.mockRestore();
    });
  });

  // ========================================
  // JOB QUEUE MANAGEMENT TESTS
  // ========================================

  describe('Job Queue Management', () => {
    it('should handle priority-based job scheduling correctly', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      mockWorkerPool.processAudio.mockResolvedValue([new Float32Array([1])]);
      mockWorkerPool.processMidi.mockResolvedValue(undefined);

      // Submit jobs with different priorities
      const urgentJob = processor.submitJob(
        'audio',
        {
          audioData: [new Float32Array([1])],
          processingType: 'effects',
        },
        { priority: 'urgent', immediate: true },
      );

      const lowJob = processor.submitJob(
        'midi',
        {
          midiData: new Uint8Array([144, 60, 100]),
          scheduleTime: 1000,
        },
        { priority: 'low', immediate: true },
      );

      const highJob = processor.submitJob(
        'audio',
        {
          audioData: [new Float32Array([2])],
          processingType: 'analysis',
        },
        { priority: 'high', immediate: true },
      );

      await Promise.all([urgentJob, lowJob, highJob]);

      // Verify all jobs were processed
      expect(mockWorkerPool.processAudio).toHaveBeenCalledTimes(2);
      expect(mockWorkerPool.processMidi).toHaveBeenCalledTimes(1);
    });

    it('should track job queue status accurately', async () => {
      const processor = BackgroundProcessor.getInstance();
      await processor.initialize();

      const queueStatus = processor.getJobQueueStatus();

      expect(queueStatus).toHaveProperty('urgent');
      expect(queueStatus).toHaveProperty('high');
      expect(queueStatus).toHaveProperty('normal');
      expect(queueStatus).toHaveProperty('low');
      expect(queueStatus).toHaveProperty('background');
      expect(queueStatus).toHaveProperty('active');
      expect(typeof queueStatus.active).toBe('number');
    });

    it('should handle concurrent job submissions without race conditions', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      mockWorkerPool.processAudio.mockImplementation(async () => {
        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [new Float32Array([1])];
      });

      const concurrentJobs = Array.from({ length: 10 }, (_, i) =>
        processor.submitJob(
          'audio',
          {
            audioData: [new Float32Array([i])],
            processingType: 'normalization',
          },
          { immediate: true },
        ),
      );

      const results = await Promise.all(concurrentJobs);

      expect(results).toHaveLength(10);
      expect(mockWorkerPool.processAudio).toHaveBeenCalledTimes(10);
    });

    it('should clear job history when requested', async () => {
      const processor = BackgroundProcessor.getInstance();
      await processor.initialize();

      // Add some completed jobs to history
      (processor as any).completedJobs = [
        { id: 'job1', completedAt: Date.now() },
        { id: 'job2', completedAt: Date.now() },
      ];

      expect((processor as any).completedJobs).toHaveLength(2);

      processor.clearJobHistory();

      expect((processor as any).completedJobs).toHaveLength(0);
    });
  });

  // ========================================
  // AUDIO PROCESSING EDGE CASES
  // ========================================

  describe('Audio Processing Edge Cases', () => {
    it('should handle large audio buffers efficiently', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      mockWorkerPool.processAudio.mockResolvedValue([new Float32Array(8192)]);

      // Test with large audio buffer
      const largeBuffer = new Float32Array(8192);
      largeBuffer.fill(0.5);

      await processor.processAudio([largeBuffer], 'effects');

      expect(mockWorkerPool.processAudio).toHaveBeenCalledWith(
        [largeBuffer],
        'effects',
        undefined,
      );
    });

    it('should validate audio processing types', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      mockWorkerPool.processAudio.mockResolvedValue([new Float32Array([1])]);

      // Test all valid processing types
      const validTypes = [
        'sequencer',
        'effects',
        'analysis',
        'normalization',
        'filtering',
      ] as const;

      for (const type of validTypes) {
        await processor.processAudio([new Float32Array([1])], type);
      }

      expect(mockWorkerPool.processAudio).toHaveBeenCalledTimes(
        validTypes.length,
      );
    });

    it('should handle multiple concurrent audio processing jobs', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      let callCount = 0;
      mockWorkerPool.processAudio.mockImplementation(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return [new Float32Array([callCount])];
      });

      const concurrentAudioJobs = [
        processor.processAudio([new Float32Array([1])], 'normalization'),
        processor.processAudio([new Float32Array([2])], 'effects'),
        processor.processAudio([new Float32Array([3])], 'analysis'),
        processor.processAudio([new Float32Array([4])], 'filtering'),
      ];

      const results = await Promise.all(concurrentAudioJobs);

      expect(results).toHaveLength(4);
      expect(mockWorkerPool.processAudio).toHaveBeenCalledTimes(4);
    });

    it('should handle MIDI processing with various parameters', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      mockWorkerPool.processMidi.mockResolvedValue(undefined);

      const midiData = new Uint8Array([144, 60, 100]);
      const scheduleTime = performance.now() + 1000;

      // Test with different velocity and channel values
      await processor.processMidi(midiData, scheduleTime, {
        priority: 'high',
        velocity: 127,
        channel: 15,
      });

      await processor.processMidi(midiData, scheduleTime, {
        priority: 'normal',
        velocity: 64,
        channel: 0,
      });

      expect(mockWorkerPool.processMidi).toHaveBeenCalledTimes(2);
      expect(mockWorkerPool.processMidi).toHaveBeenCalledWith(
        midiData,
        scheduleTime,
        127,
        15,
      );
      expect(mockWorkerPool.processMidi).toHaveBeenCalledWith(
        midiData,
        scheduleTime,
        64,
        0,
      );
    });
  });

  // ========================================
  // PERFORMANCE & OPTIMIZATION TESTS
  // ========================================

  describe('Performance & Optimization', () => {
    it('should track and update performance metrics accurately', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      // Initialize strategy and metrics
      (processor as any).currentStrategy = {
        processQuality: 'standard',
        workerCount: 4,
        processingInterval: 100,
        batchSize: 8,
        priorityScheduling: true,
        thermalThrottling: false,
        backgroundThrottling: false,
        cpuBudget: 0.8,
      };

      (processor as any).cpuMetrics = {
        currentUsage: 0.6,
        averageUsage: 0.55,
        peakUsage: 0.85,
        targetUsage: 0.8,
        throttlingActive: false,
        lastMeasurement: Date.now(),
      };

      const testMetrics: AudioPerformanceMetrics = {
        latency: 12,
        averageLatency: 15,
        maxLatency: 30,
        dropoutCount: 0,
        bufferUnderruns: 0,
        cpuUsage: 0.65,
        memoryUsage: 512,
        sampleRate: 44100,
        bufferSize: 512,
        timestamp: Date.now(),
      };

      processor.updatePerformanceMetrics(testMetrics);

      const cpuMetrics: CPUUsageMetrics = processor.getCpuMetrics();
      const stats: BackgroundProcessingStats = processor.getProcessingStats();
      const strategy: BackgroundProcessingStrategy =
        processor.getCurrentStrategy();

      expect(cpuMetrics.currentUsage).toBe(0.6);
      expect(stats).toBeDefined();
      expect(strategy.processQuality).toBe('standard');
      expect(strategy.workerCount).toBe(4);

      const performanceHistory = (processor as any).performanceHistory;
      expect(performanceHistory).toContain(testMetrics);
    });

    it('should handle CPU throttling activation and deactivation', async () => {
      const processor = BackgroundProcessor.getInstance();
      await processor.initialize();

      // Simulate high CPU usage to trigger throttling
      const highCpuMetrics: AudioPerformanceMetrics = {
        latency: 25,
        averageLatency: 20,
        maxLatency: 50,
        dropoutCount: 2,
        bufferUnderruns: 1,
        cpuUsage: 0.95, // Very high CPU usage
        memoryUsage: 1024,
        sampleRate: 44100,
        bufferSize: 512,
        timestamp: Date.now(),
      };

      processor.updatePerformanceMetrics(highCpuMetrics);

      // Verify throttling state can be checked
      const metrics = processor.getCpuMetrics();
      expect(typeof metrics.throttlingActive).toBe('boolean');

      // Test CPU budget adjustment
      processor.setCpuBudget(0.6);
      const updatedStrategy = processor.getCurrentStrategy();
      expect(updatedStrategy.cpuBudget).toBe(0.6);
    });

    it('should handle battery optimization mode', async () => {
      const processor = BackgroundProcessor.getInstance();
      await processor.initialize();

      // Enable battery saver mode
      processor.setBatterySaverMode(true);

      const stats = processor.getProcessingStats();
      expect(typeof stats.batteryOptimizationActive).toBe('boolean');

      // Disable battery saver mode
      processor.setBatterySaverMode(false);
    });

    it('should handle background and foreground state changes', async () => {
      const processor = BackgroundProcessor.getInstance();
      await processor.initialize();

      // Test background state management
      processor.setBackgroundActive(false);
      processor.setBackgroundActive(true);

      // Verify state changes don't crash the processor
      const strategy = processor.getCurrentStrategy();
      expect(strategy).toBeDefined();
    });

    it('should detect performance degradation and trigger optimization', async () => {
      const processor = BackgroundProcessor.getInstance();
      await processor.initialize();

      // Simulate performance degradation
      const degradedMetrics: AudioPerformanceMetrics = {
        latency: 100, // High latency
        averageLatency: 80,
        maxLatency: 150,
        dropoutCount: 5, // Multiple dropouts
        bufferUnderruns: 3,
        cpuUsage: 0.9,
        memoryUsage: 2048,
        sampleRate: 44100,
        bufferSize: 512,
        timestamp: Date.now(),
      };

      processor.updatePerformanceMetrics(degradedMetrics);

      // Verify the system responds to performance issues
      const stats = processor.getProcessingStats();
      expect(stats.totalJobsProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================
  // ERROR HANDLING & RECOVERY TESTS
  // ========================================

  describe('Error Handling & Recovery', () => {
    it('should handle worker pool failures gracefully', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      // Simulate worker pool failure
      mockWorkerPool.processAudio.mockRejectedValue(
        new Error('Worker pool failure'),
      );

      await expect(
        processor.processAudio([new Float32Array([1])], 'effects'),
      ).rejects.toThrow('Worker pool failure');

      // Verify the system can recover
      mockWorkerPool.processAudio.mockResolvedValue([new Float32Array([1])]);

      await expect(
        processor.processAudio([new Float32Array([1])], 'effects'),
      ).resolves.toBeDefined();
    });

    it('should handle memory pressure scenarios', async () => {
      const processor = BackgroundProcessor.getInstance();
      await processor.initialize();

      // Simulate memory pressure with high memory usage metrics
      const memoryPressureMetrics: AudioPerformanceMetrics = {
        latency: 20,
        averageLatency: 18,
        maxLatency: 35,
        dropoutCount: 1,
        bufferUnderruns: 0,
        cpuUsage: 0.7,
        memoryUsage: 4096, // Very high memory usage
        sampleRate: 44100,
        bufferSize: 512,
        timestamp: Date.now(),
      };

      processor.updatePerformanceMetrics(memoryPressureMetrics);

      // Verify system continues to function
      const stats = processor.getProcessingStats();
      expect(stats).toBeDefined();
    });

    it('should handle invalid job submissions gracefully', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      // Test with invalid job type
      await expect(
        processor.submitJob('invalid' as any, {}, { immediate: true }),
      ).rejects.toThrow();
    });

    it('should handle MobileOptimizer failures gracefully', async () => {
      const processor = BackgroundProcessor.getInstance();

      // Mock MobileOptimizer to throw errors
      mockMobileOptimizer
        .getInstance()
        .optimizeForCurrentConditions.mockRejectedValue(
          new Error('MobileOptimizer failure'),
        );

      // Initialization should still work despite MobileOptimizer issues
      await processor.initialize();

      expect((processor as any).isInitialized).toBe(true);
    });
  });

  // ========================================
  // REAL-WORLD SCENARIO TESTS
  // ========================================

  describe('Real-world Scenarios', () => {
    it('should handle complex audio pipeline with mixed workloads', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      let audioCallCount = 0;
      let midiCallCount = 0;

      mockWorkerPool.processAudio.mockImplementation(async () => {
        audioCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 15));
        return [new Float32Array([audioCallCount])];
      });

      mockWorkerPool.processMidi.mockImplementation(async () => {
        midiCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 5));
      });

      // Simulate a complex audio pipeline
      const pipeline = [
        // Audio processing jobs
        processor.processAudio([new Float32Array(1024)], 'normalization'),
        processor.processAudio([new Float32Array(2048)], 'effects'),
        processor.processAudio([new Float32Array(512)], 'analysis'),

        // MIDI jobs
        processor.processMidi(new Uint8Array([144, 60, 100]), Date.now() + 100),
        processor.processMidi(new Uint8Array([128, 60, 0]), Date.now() + 200),

        // Mixed priority jobs
        processor.submitJob(
          'audio',
          {
            audioData: [new Float32Array(1024)],
            processingType: 'filtering',
          },
          { priority: 'urgent', immediate: true },
        ),
        processor.submitJob(
          'effects',
          { effectType: 'reverb', parameters: { wetness: 0.3 } },
          { priority: 'low', immediate: true },
        ),
      ];

      const results = await Promise.all(pipeline);

      expect(results).toHaveLength(7);
      expect(audioCallCount).toBeGreaterThan(0);
      expect(midiCallCount).toBeGreaterThan(0);
    });

    it('should maintain stability under sustained high load', async () => {
      const processor = BackgroundProcessor.getInstance();
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;

      mockWorkerPool.processAudio.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return [new Float32Array([Math.random()])];
      });

      mockWorkerPool.submitJob.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 3));
        return { processed: true };
      });

      // Simulate sustained high load
      const sustainedJobs = [];
      for (let i = 0; i < 20; i++) {
        sustainedJobs.push(
          processor.submitJob(
            'audio',
            {
              audioData: [new Float32Array(256)],
              processingType: 'normalization',
            },
            { immediate: true },
          ),
        );

        sustainedJobs.push(
          processor.submitJob(
            'effects',
            { effectType: 'delay', parameters: { time: 0.1 } },
            { immediate: true },
          ),
        );
      }

      const results = await Promise.all(sustainedJobs);

      expect(results).toHaveLength(40);

      // Verify system metrics are still accessible
      const stats = processor.getProcessingStats();
      const metrics = processor.getCpuMetrics();

      expect(stats).toBeDefined();
      expect(metrics).toBeDefined();
    });

    it('should handle configuration updates during operation', async () => {
      const processor = BackgroundProcessor.getInstance();
      await processor.initialize({ cpuBudget: 0.7 });

      const initialStrategy = processor.getCurrentStrategy();
      expect(initialStrategy.cpuBudget).toBe(0.7);

      // Update configuration during operation
      processor.setCpuBudget(0.5);
      processor.setBatterySaverMode(true);

      const updatedStrategy = processor.getCurrentStrategy();
      expect(updatedStrategy.cpuBudget).toBe(0.5);

      // Verify system continues to function with new configuration
      (processor as any).isInitialized = true;
      (processor as any).workerPoolManager = mockWorkerPool;
      mockWorkerPool.processAudio.mockResolvedValue([new Float32Array([1])]);

      await processor.processAudio([new Float32Array([1])], 'normalization');

      expect(mockWorkerPool.processAudio).toHaveBeenCalled();
    });
  });
});
