/**
 * Phase 2 Integration Tests
 *
 * Validates that RegionProcessor correctly delegates to:
 * - ScheduleCache (3 methods: get/set/clear)
 * - TimingMetricsCollector (5 methods: track/start/stop/reset/get)
 *
 * Tests ensure:
 * 1. 1:1 functional equivalence with original implementation
 * 2. Proper state synchronization (sampleRate, transportStartTime, countdownOffsetBeats)
 * 3. No regressions in existing functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegionProcessor } from '../RegionProcessor.js';
import { EventBus } from '@/domains/playback/services/core/EventBus.js';

// Mock dependencies
vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/domains/playback/modules/storage/cache/GlobalSampleCache.js', () => ({
  GlobalSampleCache: {
    getInstance: () => ({
      getCachedMetadata: vi.fn().mockReturnValue(null),
    }),
    getCachedBuffer: vi.fn().mockReturnValue(null),
  },
}));

// Mock Tone.js
vi.mock('tone', () => ({
  Transport: {
    bpm: {
      value: 120,
    },
    seconds: 0,
    state: 'stopped',
    cancel: vi.fn(),
    stop: vi.fn(),
  },
  context: {
    currentTime: 0,
    sampleRate: 48000,
  },
}));

describe('RegionProcessor - Phase 2 Integration', () => {
  let regionProcessor: RegionProcessor;
  let eventBus: EventBus;
  let mockAudioContext: AudioContext;

  beforeEach(() => {
    eventBus = new EventBus();
    regionProcessor = new RegionProcessor(eventBus);

    // Mock AudioContext
    mockAudioContext = {
      currentTime: 0,
      sampleRate: 48000,
      createGain: vi.fn(),
      createBufferSource: vi.fn(),
    } as any;
  });

  // ============================================================================
  // SCHEDULE CACHE DELEGATION TESTS
  // ============================================================================

  describe('ScheduleCache delegation', () => {
    it('should delegate getCachedSchedule() to ScheduleCache', () => {
      const exerciseId = 'test-exercise-123';

      // Call private method (testing internal delegation)
      const result = (regionProcessor as any).getCachedSchedule(exerciseId);

      // Should return null (cache is empty)
      expect(result).toBeNull();
    });

    it('should delegate setCachedSchedule() to ScheduleCache', async () => {
      const exerciseId = 'test-exercise-123';

      // Import Tone and set BPM to match schedule
      const Tone = await import('tone');
      (Tone.Transport.bpm as any).value = 120;

      // Enable countdown to set countdown offset
      const timeSignature = { numerator: 4, denominator: 4 };
      regionProcessor.enableCountdown(timeSignature);

      const schedule = {
        cc64Timeline: new Map<number, boolean>(),
        calculatedEvents: [],
        cachedAt: Date.now(),
        bpm: 120,
        countdownBeats: 4,
      };

      // Call private method (testing internal delegation)
      (regionProcessor as any).setCachedSchedule(exerciseId, schedule);

      // Verify cache has the schedule
      const cached = (regionProcessor as any).getCachedSchedule(exerciseId);
      expect(cached).toBeDefined();
      expect(cached.bpm).toBe(120);
      expect(cached.countdownBeats).toBe(4);
    });

    it('should delegate clearExerciseCache() to ScheduleCache', () => {
      const exerciseId = 'test-exercise-123';
      const schedule = {
        cc64Timeline: new Map<number, boolean>(),
        calculatedEvents: [],
        cachedAt: Date.now(),
        bpm: 120,
        countdownBeats: 4,
      };

      // Set a schedule
      (regionProcessor as any).setCachedSchedule(exerciseId, schedule);

      // Verify it's cached
      let cached = (regionProcessor as any).getCachedSchedule(exerciseId);
      expect(cached).toBeDefined();

      // Clear cache
      (regionProcessor as any).clearExerciseCache(exerciseId);

      // Verify cache is cleared
      cached = (regionProcessor as any).getCachedSchedule(exerciseId);
      expect(cached).toBeNull();
    });

    it('should sync countdownOffsetBeats to ScheduleCache when enabled', () => {
      const timeSignature = { numerator: 4, denominator: 4 };

      regionProcessor.enableCountdown(timeSignature);

      // Access private scheduleCache to verify sync
      const scheduleCache = (regionProcessor as any).scheduleCache;
      const countdownOffsetBeats = (scheduleCache as any).countdownOffsetBeats;

      expect(countdownOffsetBeats).toBe(4);
    });

    it('should sync countdownOffsetBeats to ScheduleCache when disabled', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      regionProcessor.enableCountdown(timeSignature);
      regionProcessor.disableCountdown();

      // Access private scheduleCache to verify sync
      const scheduleCache = (regionProcessor as any).scheduleCache;
      const countdownOffsetBeats = (scheduleCache as any).countdownOffsetBeats;

      expect(countdownOffsetBeats).toBe(0);
    });

    it('should cache schedules with different BPM separately', async () => {
      const exerciseId = 'test-exercise-123';

      // Import Tone dynamically to modify mock
      const Tone = await import('tone');

      // Set BPM to 120
      (Tone.Transport.bpm as any).value = 120;

      const schedule120 = {
        cc64Timeline: new Map<number, boolean>(),
        calculatedEvents: [],
        cachedAt: Date.now(),
        bpm: 120,
        countdownBeats: 4,
      };

      (regionProcessor as any).setCachedSchedule(exerciseId, schedule120);

      // Change BPM to 140
      (Tone.Transport.bpm as any).value = 140;

      // Should not find cache (different BPM)
      const cached = (regionProcessor as any).getCachedSchedule(exerciseId);
      expect(cached).toBeNull();
    });
  });

  // ============================================================================
  // TIMING METRICS COLLECTOR DELEGATION TESTS
  // ============================================================================

  describe('TimingMetricsCollector delegation', () => {
    it('should delegate trackTimingAccuracy() to TimingMetricsCollector', () => {
      // Set audio context first
      regionProcessor.setAudioContext(mockAudioContext);

      // Call private method
      (regionProcessor as any).trackTimingAccuracy(24000, 0.5);

      // Get metrics and verify tracking occurred
      const metrics = regionProcessor.getTimingMetrics();
      expect(metrics.totalEvents).toBe(1);
    });

    it('should delegate startMetricsReporting() to TimingMetricsCollector', () => {
      // Call private method
      (regionProcessor as any).startMetricsReporting();

      // Access private timingMetricsCollector to verify reporting started
      const collector = (regionProcessor as any).timingMetricsCollector;
      const metricsInterval = (collector as any).metricsInterval;

      expect(metricsInterval).toBeDefined();
      expect(metricsInterval).not.toBeNull();

      // Cleanup
      (regionProcessor as any).stopMetricsReporting();
    });

    it('should delegate stopMetricsReporting() to TimingMetricsCollector', () => {
      // Start reporting first
      (regionProcessor as any).startMetricsReporting();

      // Stop reporting
      (regionProcessor as any).stopMetricsReporting();

      // Access private timingMetricsCollector to verify reporting stopped
      const collector = (regionProcessor as any).timingMetricsCollector;
      const metricsInterval = (collector as any).metricsInterval;

      expect(metricsInterval).toBeNull();
    });

    it('should delegate resetMetrics() to TimingMetricsCollector', () => {
      // Set audio context first
      regionProcessor.setAudioContext(mockAudioContext);

      // Track some events
      (regionProcessor as any).trackTimingAccuracy(24000, 0.5);
      (regionProcessor as any).trackTimingAccuracy(48000, 1.0);

      // Verify events were tracked
      let metrics = regionProcessor.getTimingMetrics();
      expect(metrics.totalEvents).toBe(2);

      // Reset metrics
      (regionProcessor as any).resetMetrics();

      // Verify metrics were reset
      metrics = regionProcessor.getTimingMetrics();
      expect(metrics.totalEvents).toBe(0);
      expect(metrics.perfectFrames).toBe(0);
      expect(metrics.avgJitterMs).toBe(0);
      expect(metrics.maxJitterMs).toBe(0);
    });

    it('should delegate getTimingMetrics() to TimingMetricsCollector', () => {
      // Set audio context first
      regionProcessor.setAudioContext(mockAudioContext);

      // Track some events
      (regionProcessor as any).trackTimingAccuracy(24000, 0.5);
      (regionProcessor as any).trackTimingAccuracy(48000, 1.0);

      // Get metrics
      const metrics = regionProcessor.getTimingMetrics();

      // Verify structure
      expect(metrics).toHaveProperty('totalEvents');
      expect(metrics).toHaveProperty('perfectFrames');
      expect(metrics).toHaveProperty('accuracy');
      expect(metrics).toHaveProperty('avgJitterMs');
      expect(metrics).toHaveProperty('maxJitterMs');
      expect(metrics).toHaveProperty('grade');
      expect(metrics).toHaveProperty('isStable');

      // Verify values
      expect(metrics.totalEvents).toBe(2);
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(100);
    });

    it('should sync sampleRate to TimingMetricsCollector when AudioContext is set', () => {
      regionProcessor.setAudioContext(mockAudioContext);

      // Access private timingMetricsCollector to verify sync
      const collector = (regionProcessor as any).timingMetricsCollector;
      const sampleRate = (collector as any).sampleRate;

      expect(sampleRate).toBe(48000);
    });

    it('should sync transportStartTime to TimingMetricsCollector on start()', async () => {
      regionProcessor.setAudioContext(mockAudioContext);

      // Start transport (this sets transportStartTime)
      await regionProcessor.start();

      // Access private timingMetricsCollector to verify sync
      const collector = (regionProcessor as any).timingMetricsCollector;
      const transportStartTime = (collector as any).transportStartTime;

      expect(transportStartTime).toBeGreaterThan(0);

      // Cleanup
      regionProcessor.stop();
    });

    it('should maintain timing metrics across multiple tracking calls', () => {
      regionProcessor.setAudioContext(mockAudioContext);

      // Track multiple events
      for (let i = 0; i < 10; i++) {
        (regionProcessor as any).trackTimingAccuracy(24000 * i, 0.5 * i);
      }

      const metrics = regionProcessor.getTimingMetrics();
      expect(metrics.totalEvents).toBe(10);
    });
  });

  // ============================================================================
  // MODULE INSTANTIATION TESTS
  // ============================================================================

  describe('Module instantiation', () => {
    it('should instantiate ScheduleCache in constructor', () => {
      const scheduleCache = (regionProcessor as any).scheduleCache;
      expect(scheduleCache).toBeDefined();
      expect(scheduleCache.constructor.name).toBe('ScheduleCache');
    });

    it('should instantiate TimingMetricsCollector in constructor', () => {
      const timingMetricsCollector = (regionProcessor as any)
        .timingMetricsCollector;
      expect(timingMetricsCollector).toBeDefined();
      expect(timingMetricsCollector.constructor.name).toBe(
        'TimingMetricsCollector',
      );
    });
  });

  // ============================================================================
  // INTEGRATION SMOKE TESTS
  // ============================================================================

  describe('Integration smoke tests', () => {
    it('should handle full cache workflow', async () => {
      const exerciseId = 'smoke-test-exercise';

      // Import Tone and set BPM to match schedule
      const Tone = await import('tone');
      (Tone.Transport.bpm as any).value = 120;

      // Enable countdown to set countdown offset
      const timeSignature = { numerator: 4, denominator: 4 };
      regionProcessor.enableCountdown(timeSignature);

      const schedule = {
        cc64Timeline: new Map<number, boolean>([
          [0.5, true],
          [2.0, false],
        ]),
        calculatedEvents: [
          {
            absoluteTime: 1.0,
            event: { position: '0:0:0', type: 'test' },
            instrumentType: 'harmony',
            eventKey: 'test-key',
            regionId: 'test-region',
          },
        ],
        cachedAt: Date.now(),
        bpm: 120,
        countdownBeats: 4,
      };

      // Set cache
      (regionProcessor as any).setCachedSchedule(exerciseId, schedule);

      // Get cache
      const cached = (regionProcessor as any).getCachedSchedule(exerciseId);
      expect(cached).toBeDefined();
      expect(cached.calculatedEvents.length).toBe(1);

      // Clear cache
      (regionProcessor as any).clearExerciseCache(exerciseId);

      // Verify cleared
      const afterClear = (regionProcessor as any).getCachedSchedule(exerciseId);
      expect(afterClear).toBeNull();
    });

    it('should handle full timing metrics workflow', () => {
      regionProcessor.setAudioContext(mockAudioContext);

      // Start reporting
      (regionProcessor as any).startMetricsReporting();

      // Track events
      (regionProcessor as any).trackTimingAccuracy(24000, 0.5);
      (regionProcessor as any).trackTimingAccuracy(48000, 1.0);
      (regionProcessor as any).trackTimingAccuracy(72000, 1.5);

      // Get metrics
      let metrics = regionProcessor.getTimingMetrics();
      expect(metrics.totalEvents).toBe(3);

      // Reset metrics
      (regionProcessor as any).resetMetrics();
      metrics = regionProcessor.getTimingMetrics();
      expect(metrics.totalEvents).toBe(0);

      // Stop reporting
      (regionProcessor as any).stopMetricsReporting();

      const collector = (regionProcessor as any).timingMetricsCollector;
      expect((collector as any).metricsInterval).toBeNull();
    });

    it('should sync countdown changes to cache', () => {
      const timeSignature4_4 = { numerator: 4, denominator: 4 };
      const timeSignature3_4 = { numerator: 3, denominator: 4 };

      // Enable with 4/4
      regionProcessor.enableCountdown(timeSignature4_4);
      let scheduleCache = (regionProcessor as any).scheduleCache;
      expect((scheduleCache as any).countdownOffsetBeats).toBe(4);

      // Change to 3/4
      regionProcessor.disableCountdown();
      regionProcessor.enableCountdown(timeSignature3_4);
      scheduleCache = (regionProcessor as any).scheduleCache;
      expect((scheduleCache as any).countdownOffsetBeats).toBe(3);

      // Disable
      regionProcessor.disableCountdown();
      scheduleCache = (regionProcessor as any).scheduleCache;
      expect((scheduleCache as any).countdownOffsetBeats).toBe(0);
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS
  // ============================================================================

  describe('Backward compatibility', () => {
    it('should maintain public getTimingMetrics() API', () => {
      const metrics = regionProcessor.getTimingMetrics();

      // Verify API shape hasn't changed
      expect(metrics).toHaveProperty('totalEvents');
      expect(metrics).toHaveProperty('perfectFrames');
      expect(metrics).toHaveProperty('accuracy');
      expect(metrics).toHaveProperty('avgJitterMs');
      expect(metrics).toHaveProperty('maxJitterMs');
      expect(metrics).toHaveProperty('grade');
      expect(metrics).toHaveProperty('isStable');

      // Verify grade is one of expected values
      expect(['EXCELLENT', 'GOOD', 'NEEDS_IMPROVEMENT']).toContain(
        metrics.grade,
      );
    });

    it('should maintain cache behavior with BPM and countdown variations', async () => {
      const exerciseId = 'compat-test';

      // Import Tone dynamically to modify mock
      const Tone = await import('tone');

      // Set BPM to 120
      (Tone.Transport.bpm as any).value = 120;

      const schedule1 = {
        cc64Timeline: new Map<number, boolean>(),
        calculatedEvents: [],
        cachedAt: Date.now(),
        bpm: 120,
        countdownBeats: 4,
      };

      (regionProcessor as any).setCachedSchedule(exerciseId, schedule1);

      // Should find cache with same params
      let cached = (regionProcessor as any).getCachedSchedule(exerciseId);
      expect(cached).toBeDefined();

      // Change BPM - should not find cache
      (Tone.Transport.bpm as any).value = 140;
      cached = (regionProcessor as any).getCachedSchedule(exerciseId);
      expect(cached).toBeNull();
    });
  });
});
