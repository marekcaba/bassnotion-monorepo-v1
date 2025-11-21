/**
 * BackupScheduler Tests
 *
 * Tests backup event scheduling logic and duplicate prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Tone.js with factory function
vi.mock('tone', () => {
  const mockSchedule = vi.fn((callback: any, time: number) => {
    return Math.random(); // Return random tone ID
  });

  return {
    Transport: {
      seconds: 0,
      bpm: {
        value: 120,
      },
      schedule: mockSchedule,
    },
  };
});

import { BackupScheduler } from '../BackupScheduler.js';
import * as Tone from 'tone';

describe('BackupScheduler', () => {
  let scheduler: BackupScheduler;
  let mockScheduledEvents: Map<number, Set<string>>;
  let mockScheduledIds: Set<number>;
  let mockParsePosition: ReturnType<typeof vi.fn>;
  let mockGetInstrumentType: ReturnType<typeof vi.fn>;
  let mockEmitEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scheduler = new BackupScheduler('test-instance');
    mockScheduledEvents = new Map();
    mockScheduledIds = new Set();
    mockParsePosition = vi.fn((position: string) => {
      // Simple parser: "0:0:0" → 0, "0:2:0" → 1.0 (2 beats @ 120 BPM)
      const [bars, beats] = position.split(':');
      return parseFloat(bars) * 2 + parseFloat(beats) * 0.5;
    });
    mockGetInstrumentType = vi.fn(() => 'bass');
    mockEmitEvent = vi.fn();

    // Clear mock schedule
    vi.mocked(Tone.Transport.schedule).mockClear();

    // Reset Tone.Transport.seconds for each test
    Tone.Transport.seconds = 0;
  });

  // ============================================================================
  // BASIC SCHEDULING TESTS
  // ============================================================================

  describe('Basic scheduling', () => {
    it('should not schedule when isRunning is false', () => {
      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 4,
              pattern: {
                events: [{ position: '0:0:0', type: 'note' }],
              },
            },
          ],
        },
      ];

      scheduler.processPosition(
        false, // isRunning = false
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        false,
        0,
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      expect(Tone.Transport.schedule).not.toHaveBeenCalled();
    });

    it('should schedule event within lookahead window', () => {
      // Set current time to 0
      Tone.Transport.seconds = 0;

      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 4,
              pattern: {
                events: [{ position: '0:0:0', type: 'note' }], // Event at 0s
              },
            },
          ],
        },
      ];

      scheduler.processPosition(
        true,
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        false,
        0,
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      // Should schedule event at time 0
      expect(Tone.Transport.schedule).toHaveBeenCalledWith(expect.any(Function), 0);
    });

    it('should not schedule event outside lookahead window', () => {
      // Set current time to 0
      Tone.Transport.seconds = 0;

      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 4,
              pattern: {
                events: [{ position: '0:2:0', type: 'note' }], // Event at 1.0s (outside 0.1s lookahead)
              },
            },
          ],
        },
      ];

      scheduler.processPosition(
        true,
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        false,
        0,
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      // Should NOT schedule (outside lookahead window)
      expect(Tone.Transport.schedule).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // DUPLICATE PREVENTION TESTS
  // ============================================================================

  describe('Duplicate prevention', () => {
    it('should not schedule event already scheduled by main scheduler', () => {
      Tone.Transport.seconds = 0;

      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 4,
              pattern: {
                events: [{ position: '0:0:0', type: 'note' }],
              },
            },
          ],
        },
      ];

      // Mark event as already scheduled by main scheduler
      mockScheduledEvents.set(0, new Set(['region-1_0']));

      scheduler.processPosition(
        true,
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        false,
        0,
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      // Should NOT schedule (already scheduled)
      expect(Tone.Transport.schedule).not.toHaveBeenCalled();
    });

    it('should not schedule event already scheduled by backup scheduler', () => {
      Tone.Transport.seconds = 0;

      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 4,
              pattern: {
                events: [{ position: '0:0:0', type: 'note' }],
              },
            },
          ],
        },
      ];

      // Mark event as already scheduled by backup scheduler
      mockScheduledEvents.set(0, new Set(['backup_region-1_0:0:0_0']));

      scheduler.processPosition(
        true,
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        false,
        0,
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      // Should NOT schedule (already scheduled)
      expect(Tone.Transport.schedule).not.toHaveBeenCalled();
    });

    it('should add both main and backup keys when scheduling', () => {
      Tone.Transport.seconds = 0;

      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 4,
              pattern: {
                events: [{ position: '0:0:0', type: 'note' }],
              },
            },
          ],
        },
      ];

      scheduler.processPosition(
        true,
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        false,
        0,
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      // Should add both keys
      const trackEvents = mockScheduledEvents.get(0);
      expect(trackEvents).toBeDefined();
      expect(trackEvents!.has('region-1_0')).toBe(true); // Main key
      expect(trackEvents!.has('backup_region-1_0:0:0_0')).toBe(true); // Backup key
    });
  });

  // ============================================================================
  // COUNTDOWN OFFSET TESTS
  // ============================================================================

  describe('Countdown offset', () => {
    it('should apply countdown offset when enabled', () => {
      // Set current time to 1.95s so event at 2.0s is within lookahead (2.05s)
      Tone.Transport.seconds = 1.95;

      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 8, // 4s duration so region is active at current time
              pattern: {
                events: [{ position: '0:0:0', type: 'note' }],
              },
            },
          ],
        },
      ];

      // Enable countdown with 4 beats offset
      scheduler.processPosition(
        true,
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        true, // countdown enabled
        4, // 4 beats
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      // Should schedule at 0 + 2.0s (4 beats @ 120 BPM = 2s)
      expect(Tone.Transport.schedule).toHaveBeenCalledWith(expect.any(Function), 2.0);
    });

    it('should skip countdown offset when region has skipCountdownOffset flag', () => {
      Tone.Transport.seconds = 0;

      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 4,
              skipCountdownOffset: true,
              pattern: {
                events: [{ position: '0:0:0', type: 'note' }],
              },
            },
          ],
        },
      ];

      scheduler.processPosition(
        true,
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        true, // countdown enabled
        4, // 4 beats
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      // Should schedule at 0 (no offset applied)
      expect(Tone.Transport.schedule).toHaveBeenCalledWith(expect.any(Function), 0);
    });
  });

  // ============================================================================
  // REGION FILTERING TESTS
  // ============================================================================

  describe('Region filtering', () => {
    it('should only process regions within time range', () => {
      // Current time = 4.9s, lookahead window = 4.9 + 0.1 = 5.0s
      // Region 2 starts at 4.9s, event at position "0:0:0" = 0s, absolute time = 4.9s
      // Event at 4.9s is equal to current time (within lookahead)
      // Current time is at region start (4.9s - 6.9s)
      Tone.Transport.seconds = 4.9;

      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 4, // Ends at 2s (before current time)
              pattern: {
                events: [{ position: '0:0:0', type: 'note' }],
              },
            },
            {
              id: 'region-2',
              startTime: 4.9,
              duration: 4, // 2s duration, active at current time
              pattern: {
                events: [{ position: '0:0:0', type: 'note' }], // At region start
              },
            },
          ],
        },
      ];

      scheduler.processPosition(
        true,
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        false,
        0,
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      // Should only schedule region-2 event at 4.9s
      expect(Tone.Transport.schedule).toHaveBeenCalledTimes(1);
      expect(Tone.Transport.schedule).toHaveBeenCalledWith(expect.any(Function), 4.9);
    });

    it('should skip regions with no pattern or events', () => {
      Tone.Transport.seconds = 0;

      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 4,
              // No pattern
            },
            {
              id: 'region-2',
              startTime: 0,
              duration: 4,
              pattern: {
                events: [], // Empty events
              },
            },
          ],
        },
      ];

      scheduler.processPosition(
        true,
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        false,
        0,
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      // Should not schedule anything
      expect(Tone.Transport.schedule).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // CALLBACK INVOCATION TESTS
  // ============================================================================

  describe('Scheduled callback behavior', () => {
    it('should call emitEvent with correct parameters', () => {
      Tone.Transport.seconds = 0;

      const event = { position: '0:0:0', type: 'note', velocity: 100 };
      const tracks = [
        {
          regions: [
            {
              id: 'region-1',
              startTime: 0,
              duration: 4,
              pattern: {
                events: [event],
              },
            },
          ],
        },
      ];

      mockGetInstrumentType.mockReturnValue('harmony');

      scheduler.processPosition(
        true,
        tracks,
        mockScheduledEvents,
        mockScheduledIds,
        false,
        0,
        mockParsePosition,
        mockGetInstrumentType,
        mockEmitEvent,
      );

      // Execute the scheduled callback
      const callback = vi.mocked(Tone.Transport.schedule).mock.calls[0][0];
      callback(0.2); // Tone passes lookahead time

      // Should call emitEvent with absoluteTime (not lookahead time)
      expect(mockEmitEvent).toHaveBeenCalledWith('harmony', event, 0);
    });

    // Note: isRunning check in callback uses closure variable captured at schedule time
    // In real usage, RegionProcessor would not call processPosition if already stopped
    // So this edge case is not tested here
  });
});
