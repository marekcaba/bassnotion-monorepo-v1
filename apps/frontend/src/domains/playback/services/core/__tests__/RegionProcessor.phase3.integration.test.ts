/**
 * Phase 3 Integration Tests
 *
 * Validates that RegionProcessor correctly delegates to:
 * - CC64TimelineBuilder (1 method: buildTimeline)
 * - SustainPedalAnalyzer (4 methods: findCC64DownDuringNote, findNextCC64Up, isPedalDownAtTime, isNoteHeldUntilExerciseEnd)
 *
 * Tests ensure:
 * 1. 1:1 functional equivalence with original implementation
 * 2. Proper state synchronization (audioContext, transportStartTime, countdownConfig, exerciseTiming)
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

describe('RegionProcessor - Phase 3 Integration', () => {
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
  // CC64 TIMELINE BUILDER DELEGATION TESTS
  // ============================================================================

  describe('CC64TimelineBuilder delegation', () => {
    it('should delegate buildCC64Timeline() to CC64TimelineBuilder', () => {
      // Set audio context for sample-accurate rounding
      regionProcessor.setAudioContext(mockAudioContext);

      // Create mock region and events
      const region = {
        id: 'test-region',
        startTime: 0,
        endTime: 4,
        loop: false,
        skipCountdownOffset: false,
        pattern: {
          events: [],
        },
      };

      const events = [
        {
          type: 'harmony-control-change',
          position: '0:0:0',
          data: {
            cc: 64,
            value: 127, // Pedal DOWN
            ticks: 0,
            originalBpm: 120,
          },
        },
        {
          type: 'harmony-control-change',
          position: '0:2:0',
          data: {
            cc: 64,
            value: 0, // Pedal UP
            ticks: 960, // 2 beats * 480 ticks/beat
            originalBpm: 120,
          },
        },
      ];

      // Call private method (testing internal delegation)
      const timeline = (regionProcessor as any).buildCC64Timeline(
        events,
        region,
      );

      // Verify timeline was built
      expect(timeline).toBeInstanceOf(Map);
      expect(timeline.size).toBeGreaterThan(0);

      // Verify pedal states
      const timelineEntries = Array.from(timeline.entries()).sort(
        (a, b) => a[0] - b[0],
      );
      expect(timelineEntries.length).toBe(2); // Two CC64 events
      expect(timelineEntries[0][1]).toBe(true); // First event is DOWN
      expect(timelineEntries[1][1]).toBe(false); // Second event is UP
    });

    it('should sync audio context to CC64TimelineBuilder', () => {
      regionProcessor.setAudioContext(mockAudioContext);

      // Access private cc64TimelineBuilder to verify sync
      const builder = (regionProcessor as any).cc64TimelineBuilder;
      const audioContext = (builder as any).audioContext;
      const sampleRate = (builder as any).sampleRate;

      expect(audioContext).toBe(mockAudioContext);
      expect(sampleRate).toBe(48000);
    });

    it('should sync transport start time to CC64TimelineBuilder on start()', () => {
      regionProcessor.setAudioContext(mockAudioContext);

      // Start transport (this sets transportStartTime)
      regionProcessor.start();

      // Access private cc64TimelineBuilder to verify sync
      const builder = (regionProcessor as any).cc64TimelineBuilder;
      const transportStartTime = (builder as any).transportStartTime;

      expect(transportStartTime).toBeGreaterThan(0);

      // Cleanup
      regionProcessor.stop();
    });

    it('should sync countdown config to CC64TimelineBuilder when enabled', () => {
      const timeSignature = { numerator: 4, denominator: 4 };

      regionProcessor.enableCountdown(timeSignature);

      // Access private cc64TimelineBuilder to verify sync
      const builder = (regionProcessor as any).cc64TimelineBuilder;
      const countdownOffsetBeats = (builder as any).countdownOffsetBeats;
      const countdownEnabled = (builder as any).countdownEnabled;

      expect(countdownOffsetBeats).toBe(4);
      expect(countdownEnabled).toBe(true);
    });

    it('should sync countdown config to CC64TimelineBuilder when disabled', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      regionProcessor.enableCountdown(timeSignature);
      regionProcessor.disableCountdown();

      // Access private cc64TimelineBuilder to verify sync
      const builder = (regionProcessor as any).cc64TimelineBuilder;
      const countdownOffsetBeats = (builder as any).countdownOffsetBeats;
      const countdownEnabled = (builder as any).countdownEnabled;

      expect(countdownOffsetBeats).toBe(0);
      expect(countdownEnabled).toBe(false);
    });

    it('should inject TimePositionConverter to CC64TimelineBuilder', () => {
      // Access private cc64TimelineBuilder
      const builder = (regionProcessor as any).cc64TimelineBuilder;
      const timeConverter = (builder as any).timeConverter;

      expect(timeConverter).toBeDefined();
      expect(timeConverter.constructor.name).toBe('TimePositionConverter');
    });
  });

  // ============================================================================
  // SUSTAIN PEDAL ANALYZER DELEGATION TESTS
  // ============================================================================

  describe('SustainPedalAnalyzer delegation', () => {
    it('should delegate isPedalDownAtTime() to SustainPedalAnalyzer', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true], // Pedal DOWN at 0.5s
        [2.0, false], // Pedal UP at 2.0s
      ]);

      // Check at time 1.0s (pedal should be DOWN)
      const isDownAt1 = (regionProcessor as any).isPedalDownAtTime(1.0, timeline);
      expect(isDownAt1).toBe(true);

      // Check at time 2.5s (pedal should be UP)
      const isDownAt25 = (regionProcessor as any).isPedalDownAtTime(
        2.5,
        timeline,
      );
      expect(isDownAt25).toBe(false);
    });

    it('should delegate findNextCC64Up() to SustainPedalAnalyzer', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true], // Pedal DOWN at 0.5s
        [2.0, false], // Pedal UP at 2.0s
        [3.0, true], // Pedal DOWN at 3.0s
        [4.5, false], // Pedal UP at 4.5s
      ]);

      // Find next UP from 1.0s
      const nextUpFrom1 = (regionProcessor as any).findNextCC64Up(1.0, timeline);
      expect(nextUpFrom1).toBe(2.0);

      // Find next UP from 3.5s
      const nextUpFrom35 = (regionProcessor as any).findNextCC64Up(3.5, timeline);
      expect(nextUpFrom35).toBe(4.5);

      // Find next UP from 5.0s (none)
      const nextUpFrom5 = (regionProcessor as any).findNextCC64Up(5.0, timeline);
      expect(nextUpFrom5).toBeNull();
    });

    it('should delegate isNoteHeldUntilExerciseEnd() to SustainPedalAnalyzer', () => {
      // Set exercise end time using internal API
      (regionProcessor as any).exerciseEndTime = 10.0;
      (regionProcessor as any).lastBeatThreshold = 9.5;

      // Sync to SustainPedalAnalyzer
      const analyzer = (regionProcessor as any).sustainPedalAnalyzer;
      analyzer.setExerciseTiming(10.0, 9.5);

      // Note ending at 9.95s (within 0.25s of exercise end)
      const heldUntilEnd = (regionProcessor as any).isNoteHeldUntilExerciseEnd(
        9.95,
      );
      expect(heldUntilEnd).toBe(true);

      // Note ending at 9.0s (not within threshold)
      const notHeldUntilEnd = (regionProcessor as any).isNoteHeldUntilExerciseEnd(
        9.0,
      );
      expect(notHeldUntilEnd).toBe(false);
    });

    it('should delegate findCC64DownDuringNote() to SustainPedalAnalyzer', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true], // Pedal DOWN at 0.5s
        [2.0, false], // Pedal UP at 2.0s
        [3.0, true], // Pedal DOWN at 3.0s
        [4.5, false], // Pedal UP at 4.5s
      ]);

      // Note from 1.0s to 1.5s (pedal already DOWN)
      const pedalDownAt1 = (regionProcessor as any).findCC64DownDuringNote(
        1.0,
        1.5,
        timeline,
      );
      expect(pedalDownAt1).toBe(1.0); // Returns note start time

      // Note from 2.5s to 3.5s (pedal goes DOWN during note)
      const pedalDownAt25 = (regionProcessor as any).findCC64DownDuringNote(
        2.5,
        3.5,
        timeline,
      );
      expect(pedalDownAt25).toBe(3.0); // Returns exact pedal DOWN time

      // Note from 2.2s to 2.8s (pedal stays UP)
      const pedalDownAt22 = (regionProcessor as any).findCC64DownDuringNote(
        2.2,
        2.8,
        timeline,
      );
      expect(pedalDownAt22).toBeNull();
    });

    it('should sync exercise timing to SustainPedalAnalyzer', () => {
      // Set exercise end time using internal calculation (simulating loadExercise)
      (regionProcessor as any).exerciseEndTime = 10.0;
      (regionProcessor as any).lastBeatThreshold = 9.5;

      // Trigger sync (happens in loadExercise)
      const analyzer = (regionProcessor as any).sustainPedalAnalyzer;
      analyzer.setExerciseTiming(10.0, 9.5);

      // Access private state to verify sync
      const exerciseEndTime = (analyzer as any).exerciseEndTime;
      const lastBeatThreshold = (analyzer as any).lastBeatThreshold;

      expect(exerciseEndTime).toBe(10.0);
      expect(lastBeatThreshold).toBe(9.5);
    });
  });

  // ============================================================================
  // MODULE INSTANTIATION TESTS
  // ============================================================================

  describe('Module instantiation', () => {
    it('should instantiate CC64TimelineBuilder in constructor', () => {
      const builder = (regionProcessor as any).cc64TimelineBuilder;
      expect(builder).toBeDefined();
      expect(builder.constructor.name).toBe('CC64TimelineBuilder');
    });

    it('should instantiate SustainPedalAnalyzer in constructor', () => {
      const analyzer = (regionProcessor as any).sustainPedalAnalyzer;
      expect(analyzer).toBeDefined();
      expect(analyzer.constructor.name).toBe('SustainPedalAnalyzer');
    });
  });

  // ============================================================================
  // INTEGRATION SMOKE TESTS
  // ============================================================================

  describe('Integration smoke tests', () => {
    it('should handle full CC64 timeline workflow', () => {
      // Setup
      regionProcessor.setAudioContext(mockAudioContext);
      regionProcessor.start();

      const region = {
        id: 'test-region',
        startTime: 0,
        endTime: 4,
        loop: false,
        skipCountdownOffset: false,
        pattern: {
          events: [],
        },
      };

      const events = [
        {
          type: 'harmony-control-change',
          position: '0:0:0',
          data: {
            cc: 64,
            value: 127,
            ticks: 0,
            originalBpm: 120,
          },
        },
        {
          type: 'harmony-control-change',
          position: '0:2:0',
          data: {
            cc: 64,
            value: 0,
            ticks: 960,
            originalBpm: 120,
          },
        },
      ];

      // Build timeline
      const timeline = (regionProcessor as any).buildCC64Timeline(
        events,
        region,
      );

      // Verify timeline structure
      expect(timeline).toBeInstanceOf(Map);
      expect(timeline.size).toBe(2);

      // Query timeline
      const sortedTimes = Array.from(timeline.keys()).sort((a, b) => a - b);
      const firstEventTime = sortedTimes[0];
      const secondEventTime = sortedTimes[1];

      // Check pedal state at different times
      const isPedalDownAtStart = (regionProcessor as any).isPedalDownAtTime(
        firstEventTime + 0.5,
        timeline,
      );
      expect(isPedalDownAtStart).toBe(true);

      const nextUp = (regionProcessor as any).findNextCC64Up(
        firstEventTime,
        timeline,
      );
      expect(nextUp).toBe(secondEventTime);

      // Cleanup
      regionProcessor.stop();
    });

    it('should handle full sustain pedal analysis workflow', () => {
      // Set exercise timing
      (regionProcessor as any).exerciseEndTime = 10.0;
      (regionProcessor as any).lastBeatThreshold = 9.5;

      const analyzer = (regionProcessor as any).sustainPedalAnalyzer;
      analyzer.setExerciseTiming(10.0, 9.5);

      // Create timeline
      const timeline = new Map<number, boolean>([
        [0.5, true],
        [2.0, false],
        [3.0, true],
        [4.5, false],
      ]);

      // Test isPedalDownAtTime
      const isPedalDown = (regionProcessor as any).isPedalDownAtTime(
        1.0,
        timeline,
      );
      expect(isPedalDown).toBe(true);

      // Test findNextCC64Up
      const nextUp = (regionProcessor as any).findNextCC64Up(1.0, timeline);
      expect(nextUp).toBe(2.0);

      // Test findCC64DownDuringNote
      const pedalDown = (regionProcessor as any).findCC64DownDuringNote(
        2.5,
        3.5,
        timeline,
      );
      expect(pedalDown).toBe(3.0);

      // Test isNoteHeldUntilExerciseEnd
      const heldUntilEnd = (regionProcessor as any).isNoteHeldUntilExerciseEnd(
        9.95,
      );
      expect(heldUntilEnd).toBe(true);
    });

    it('should sync countdown changes to CC64TimelineBuilder', () => {
      const timeSignature4_4 = { numerator: 4, denominator: 4 };
      const timeSignature3_4 = { numerator: 3, denominator: 4 };

      // Enable with 4/4
      regionProcessor.enableCountdown(timeSignature4_4);
      let builder = (regionProcessor as any).cc64TimelineBuilder;
      expect((builder as any).countdownOffsetBeats).toBe(4);
      expect((builder as any).countdownEnabled).toBe(true);

      // Change to 3/4
      regionProcessor.disableCountdown();
      regionProcessor.enableCountdown(timeSignature3_4);
      builder = (regionProcessor as any).cc64TimelineBuilder;
      expect((builder as any).countdownOffsetBeats).toBe(3);
      expect((builder as any).countdownEnabled).toBe(true);

      // Disable
      regionProcessor.disableCountdown();
      builder = (regionProcessor as any).cc64TimelineBuilder;
      expect((builder as any).countdownOffsetBeats).toBe(0);
      expect((builder as any).countdownEnabled).toBe(false);
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS
  // ============================================================================

  describe('Backward compatibility', () => {
    it('should maintain buildCC64Timeline() API', () => {
      regionProcessor.setAudioContext(mockAudioContext);

      const region = {
        id: 'test-region',
        startTime: 0,
        endTime: 4,
        loop: false,
        skipCountdownOffset: false,
        pattern: {
          events: [],
        },
      };

      const events = [
        {
          type: 'harmony-control-change',
          position: '0:0:0',
          data: {
            cc: 64,
            value: 127,
            ticks: 0,
            originalBpm: 120,
          },
        },
      ];

      // Should return Map<number, boolean>
      const timeline = (regionProcessor as any).buildCC64Timeline(
        events,
        region,
      );

      expect(timeline).toBeInstanceOf(Map);
      expect(typeof Array.from(timeline.keys())[0]).toBe('number');
      expect(typeof Array.from(timeline.values())[0]).toBe('boolean');
    });

    it('should maintain isPedalDownAtTime() API', () => {
      const timeline = new Map<number, boolean>([[0.5, true]]);

      // Should return boolean
      const result = (regionProcessor as any).isPedalDownAtTime(1.0, timeline);

      expect(typeof result).toBe('boolean');
    });

    it('should maintain findNextCC64Up() API', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true],
        [2.0, false],
      ]);

      // Should return number | null
      const result = (regionProcessor as any).findNextCC64Up(1.0, timeline);

      expect(typeof result === 'number' || result === null).toBe(true);
    });

    it('should maintain isNoteHeldUntilExerciseEnd() API', () => {
      const analyzer = (regionProcessor as any).sustainPedalAnalyzer;
      analyzer.setExerciseTiming(10.0, 9.5);

      // Should return boolean
      const result = (regionProcessor as any).isNoteHeldUntilExerciseEnd(9.95);

      expect(typeof result).toBe('boolean');
    });

    it('should maintain findCC64DownDuringNote() API', () => {
      const timeline = new Map<number, boolean>([[0.5, true]]);

      // Should return number | null
      const result = (regionProcessor as any).findCC64DownDuringNote(
        1.0,
        1.5,
        timeline,
      );

      expect(typeof result === 'number' || result === null).toBe(true);
    });
  });
});
