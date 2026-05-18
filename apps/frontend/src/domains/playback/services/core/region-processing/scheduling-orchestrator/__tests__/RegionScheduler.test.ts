/**
 * RegionScheduler Tests
 *
 * Tests region scheduling orchestration, event batching, and CC64 timeline integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegionScheduler } from '../RegionScheduler.js';

// Mock Tone.js
vi.mock('tone', () => {
  const Transport = {
    bpm: {
      value: 120,
    },
  };
  return {
    Transport,
    getTransport: () => Transport,
  };
});

describe('RegionScheduler', () => {
  let scheduler: RegionScheduler;
  let mockTracks: Map<string, any>;
  let mockScheduledEvents: Map<string, Set<string>>;
  let mockGetInstrumentType: ReturnType<typeof vi.fn>;
  let mockParsePositionToObject: ReturnType<typeof vi.fn>;
  let mockParsePosition: ReturnType<typeof vi.fn>;
  let mockBuildCC64Timeline: ReturnType<typeof vi.fn>;
  let mockLogCC64DiagnosticTable: ReturnType<typeof vi.fn>;
  let mockGetCachedSchedule: ReturnType<typeof vi.fn>;
  let mockSetCachedSchedule: ReturnType<typeof vi.fn>;
  let mockEmitEvent: ReturnType<typeof vi.fn>;
  let mockSetCurrentCC64Timeline: ReturnType<typeof vi.fn>;
  let mockCalculateExerciseDuration: ReturnType<typeof vi.fn>;
  let mockAudioContext: AudioContext;

  beforeEach(() => {
    scheduler = new RegionScheduler('test-instance');
    mockTracks = new Map();
    mockScheduledEvents = new Map();

    // Mock dependencies
    mockGetInstrumentType = vi.fn((track) => track.instrumentType || 'unknown');
    mockParsePositionToObject = vi.fn((position) => {
      if (typeof position === 'object') return position;
      const [measure, beat, subdivision = 0, tick = 0] = position
        .split(':')
        .map(Number);
      return { measure, beat, subdivision, tick };
    });
    mockParsePosition = vi.fn((position) => {
      const [measure, beat, subdivision = 0] = position.split(':').map(Number);
      return measure * 2 + beat * 0.5 + subdivision * 0.125; // Simple conversion
    });
    mockBuildCC64Timeline = vi.fn(() => new Map());
    mockLogCC64DiagnosticTable = vi.fn();
    mockGetCachedSchedule = vi.fn(() => null);
    mockSetCachedSchedule = vi.fn();
    mockEmitEvent = vi.fn();
    mockSetCurrentCC64Timeline = vi.fn();
    mockCalculateExerciseDuration = vi.fn();
    mockAudioContext = {
      currentTime: 0,
    } as AudioContext;
  });

  // ============================================================================
  // BASIC SCHEDULING TESTS
  // ============================================================================

  describe('Basic scheduling', () => {
    it('should schedule events from a single track', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                { position: '0:0:0', type: 'harmony-note', data: { ticks: 0 } },
                {
                  position: '0:1:0',
                  type: 'harmony-note',
                  data: { ticks: 240 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      const result = scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      expect(result.totalEvents).toBe(2);
      expect(mockEmitEvent).toHaveBeenCalledTimes(2);
      expect(mockCalculateExerciseDuration).toHaveBeenCalled();
    });

    it('should schedule events from multiple tracks', () => {
      mockTracks.set('track-1', {
        instrumentType: 'drums',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [{ position: '0:0:0', type: 'kick' }],
            },
          },
        ],
      });
      mockTracks.set('track-2', {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-2',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [{ position: '0:0:0', type: 'harmony-note' }],
            },
          },
        ],
      });

      const result = scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      expect(result.totalEvents).toBe(2);
      expect(mockEmitEvent).toHaveBeenCalledWith(
        'drums',
        expect.any(Object),
        0,
      );
      expect(mockEmitEvent).toHaveBeenCalledWith(
        'harmony',
        expect.any(Object),
        0,
      );
    });

    it('should skip tracks with no regions', () => {
      mockTracks.set('track-1', {
        instrumentType: 'drums',
        regions: [],
      });

      const result = scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      expect(result.totalEvents).toBe(0);
      expect(mockEmitEvent).not.toHaveBeenCalled();
    });

    it('should skip regions with no pattern', () => {
      mockTracks.set('track-1', {
        instrumentType: 'drums',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            // No pattern
          },
        ],
      });

      const result = scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      expect(result.totalEvents).toBe(0);
      expect(mockEmitEvent).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // EVENT SORTING TESTS
  // ============================================================================

  describe('Event sorting', () => {
    it('should sort events by position', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:2:0',
                  type: 'harmony-note',
                  data: { ticks: 960 },
                },
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 0 },
                },
                {
                  position: '0:1:0',
                  type: 'harmony-note',
                  data: { ticks: 480 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      // Verify events scheduled in order (0, 480, 960 ticks)
      const calls = mockEmitEvent.mock.calls;
      expect(calls[0][1].data.ticks).toBe(0);
      expect(calls[1][1].data.ticks).toBe(480);
      expect(calls[2][1].data.ticks).toBe(960);
    });

    it('should place control changes before notes at same position', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                { position: '0:0:0', type: 'harmony-note', data: { ticks: 0 } },
                {
                  position: '0:0:0',
                  type: 'harmony-control-change',
                  data: { ticks: 0, cc: 64 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      // Verify CC64 scheduled before note
      const calls = mockEmitEvent.mock.calls;
      expect(calls[0][1].type).toBe('harmony-control-change');
      expect(calls[1][1].type).toBe('harmony-note');
    });
  });

  // ============================================================================
  // TIME CALCULATION TESTS
  // ============================================================================

  describe('Time calculation', () => {
    it('should use absolute ticks for event time', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 480, originalBpm: 120 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      // 480 ticks = 1 beat at 120 BPM = 0.5s
      expect(mockEmitEvent).toHaveBeenCalledWith(
        'harmony',
        expect.any(Object),
        0.5,
      );
    });

    it('should apply countdown offset when enabled', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 0, originalBpm: 120 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      // parsePosition('0:4:0') should return 2.0 (4 beats @ 120 BPM)
      mockParsePosition.mockImplementation((pos) => {
        if (pos === '0:4:0') return 2.0;
        return 0;
      });

      scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        true, // countdown enabled
        4, // 4 beats offset
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      // Event at 0 + 2.0s offset = 2.0s
      expect(mockEmitEvent).toHaveBeenCalledWith(
        'harmony',
        expect.any(Object),
        2.0,
      );
    });

    it('should skip countdown offset when region has skipCountdownOffset flag', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            skipCountdownOffset: true,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 0, originalBpm: 120 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        true, // countdown enabled
        4, // 4 beats offset
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      // Event at 0 (no offset)
      expect(mockEmitEvent).toHaveBeenCalledWith(
        'harmony',
        expect.any(Object),
        0,
      );
    });

    it('should apply region startTime offset', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 4.0, // Region starts at 4s
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 0, originalBpm: 120 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      // Event at 4.0s (region start) + 0 (event time) = 4.0s
      expect(mockEmitEvent).toHaveBeenCalledWith(
        'harmony',
        expect.any(Object),
        4.0,
      );
    });
  });

  // ============================================================================
  // CC64 TIMELINE TESTS
  // ============================================================================

  describe('CC64 timeline', () => {
    it('should build CC64 timeline for harmony track', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-control-change',
                  data: { ticks: 0, cc: 64, value: 127 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      const mockTimeline = new Map([[0, true]]);
      mockBuildCC64Timeline.mockReturnValue(mockTimeline);

      const result = scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      expect(mockBuildCC64Timeline).toHaveBeenCalled();
      expect(mockSetCurrentCC64Timeline).toHaveBeenCalledWith(mockTimeline);
      expect(result.currentCC64Timeline).toBe(mockTimeline);
    });

    it('should use cached CC64 timeline when available', () => {
      const track = {
        instrumentType: 'harmony',
        exerciseId: 'exercise-123',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-control-change',
                  data: { ticks: 0, cc: 64 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      const cachedTimeline = new Map([[0, true]]);
      mockGetCachedSchedule.mockReturnValue({
        cc64Timeline: cachedTimeline,
        calculatedEvents: [],
        cachedAt: Date.now(),
        bpm: 120,
        countdownBeats: 0,
      });

      scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      // Should NOT build new timeline
      expect(mockBuildCC64Timeline).not.toHaveBeenCalled();
      expect(mockSetCurrentCC64Timeline).toHaveBeenCalledWith(cachedTimeline);
    });

    it('should cache CC64 timeline for future use', () => {
      const track = {
        instrumentType: 'harmony',
        exerciseId: 'exercise-123',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-control-change',
                  data: { ticks: 0, cc: 64 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      const mockTimeline = new Map([[0, true]]);
      mockBuildCC64Timeline.mockReturnValue(mockTimeline);

      scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      // Should cache timeline
      expect(mockSetCachedSchedule).toHaveBeenCalledWith(
        'exercise-123',
        expect.objectContaining({
          cc64Timeline: expect.any(Map),
        }),
      );
    });
  });

  // ============================================================================
  // DUPLICATE PREVENTION TESTS
  // ============================================================================

  describe('Duplicate prevention', () => {
    it('should skip already scheduled events', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 0 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      // Mark event as already scheduled. Production's event-key format is
      // `${region.id}_${eventIndex}_loop${loopNum}` (added when looping
      // support landed), so the dedup key for the first event in region-1
      // on loop 0 is `region-1_0_loop0`.
      mockScheduledEvents.set('track-1', new Set(['region-1_0_loop0']));

      const result = scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      expect(result.totalEvents).toBe(0);
      expect(mockEmitEvent).not.toHaveBeenCalled();
    });

    it('should mark events as scheduled', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 0 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      const trackEvents = mockScheduledEvents.get('track-1');
      expect(trackEvents).toBeDefined();
      // Production event-key format: `${region.id}_${eventIndex}_loop${loopNum}`
      expect(trackEvents!.has('region-1_0_loop0')).toBe(true);
    });
  });

  // ============================================================================
  // PAST EVENT FILTERING TESTS
  // ============================================================================

  describe('Past event filtering', () => {
    it('should skip events in the past', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 0 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      // Set current time ahead of event
      mockAudioContext.currentTime = 10.0;

      const result = scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0, // transportStartTime = 0, so event is at 0, which is < 10.0
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      // Event should be marked as scheduled but not emitted
      expect(result.totalEvents).toBe(1);
      expect(mockEmitEvent).not.toHaveBeenCalled();
    });

    it('should schedule future events', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 10.0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 0 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      // Set current time before event
      mockAudioContext.currentTime = 5.0;

      const result = scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0, // transportStartTime = 0, so event is at 10.0, which is > 5.0
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      expect(result.totalEvents).toBe(1);
      expect(mockEmitEvent).toHaveBeenCalledWith(
        'harmony',
        expect.any(Object),
        10.0,
      );
    });
  });

  // ============================================================================
  // BATCH STATISTICS TESTS
  // ============================================================================

  describe('Batch statistics', () => {
    it('should return correct batch count', () => {
      const track = {
        instrumentType: 'harmony',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 0 },
                },
                {
                  position: '0:0:0',
                  type: 'harmony-note',
                  data: { ticks: 0 },
                }, // Same time
                {
                  position: '0:1:0',
                  type: 'harmony-note',
                  data: { ticks: 480 },
                },
              ],
            },
          },
        ],
      };
      mockTracks.set('track-1', track);

      const result = scheduler.scheduleAll(
        mockTracks,
        mockScheduledEvents,
        false,
        0,
        0,
        mockAudioContext,
        mockGetInstrumentType,
        mockParsePositionToObject,
        mockParsePosition,
        mockBuildCC64Timeline,
        mockLogCC64DiagnosticTable,
        mockGetCachedSchedule,
        mockSetCachedSchedule,
        mockEmitEvent,
        mockSetCurrentCC64Timeline,
        mockCalculateExerciseDuration,
      );

      // 2 events at time 0, 1 event at time 0.5 = 2 batches
      expect(result.batchCount).toBe(2);
      expect(result.totalEvents).toBe(3);
    });
  });
});
