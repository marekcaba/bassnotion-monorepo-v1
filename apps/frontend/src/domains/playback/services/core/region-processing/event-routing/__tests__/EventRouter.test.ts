/**
 * EventRouter Tests
 *
 * Tests event routing, time conversion, and scheduling delegation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EventRouter,
  EventBus,
  Scheduler,
  PatternEvent,
} from '../EventRouter.js';

describe('EventRouter', () => {
  let router: EventRouter;
  let mockEventBus: EventBus;
  let mockMetronomeScheduler: Scheduler;
  let mockDrumScheduler: Scheduler;
  let mockHarmonyScheduler: Scheduler;
  let mockBassScheduler: Scheduler;
  let mockVoiceCueScheduler: Scheduler;
  // LAUNCH-02.5b: optional audio-stem scheduler routed via the
  // `instrumentType.startsWith('audio-')` branch in scheduleAudioDirect().
  let mockAudioPlayerScheduler: Scheduler;
  let mockTrackTimingAccuracy: ReturnType<typeof vi.fn>;
  let mockAudioContext: AudioContext;

  beforeEach(() => {
    router = new EventRouter('test-instance');

    // Mock event bus
    mockEventBus = {
      emit: vi.fn(),
    };

    // Mock schedulers
    mockMetronomeScheduler = {
      schedule: vi.fn(() => true),
    };
    mockDrumScheduler = {
      schedule: vi.fn(() => true),
    };
    mockHarmonyScheduler = {
      schedule: vi.fn(() => true),
    };
    mockBassScheduler = {
      schedule: vi.fn(() => true),
    };
    mockVoiceCueScheduler = {
      schedule: vi.fn(() => true),
    };
    mockAudioPlayerScheduler = {
      schedule: vi.fn(() => true),
    };

    // Mock timing callback
    mockTrackTimingAccuracy = vi.fn();

    // Mock audio context
    mockAudioContext = {
      sampleRate: 48000,
    } as AudioContext;

    // Initialize router
    router.initialize(
      mockAudioContext,
      48000,
      mockEventBus,
      mockMetronomeScheduler,
      mockDrumScheduler,
      mockHarmonyScheduler,
      mockBassScheduler,
      mockVoiceCueScheduler,
      mockTrackTimingAccuracy,
      mockAudioPlayerScheduler,
    );
  });

  // ============================================================================
  // TIME CONVERSION TESTS
  // ============================================================================

  describe('Time conversion', () => {
    it('should convert transport time to audio time using transportStartTime', () => {
      router.setTransportStartTime(10.0); // Start at 10s

      const event: PatternEvent = {
        type: 'metronome-click',
        position: '0:0:0',
      };
      router.emitEvent('metronome', event, 2.0); // Event at 2s transport time

      // Should schedule at 10 + 2 = 12s audio time
      expect(mockMetronomeScheduler.schedule).toHaveBeenCalledWith(
        event,
        12.0,
        expect.any(Number),
      );
    });

    it('should perform sample-accurate rounding', () => {
      router.setTransportStartTime(0);

      const event: PatternEvent = {
        type: 'metronome-click',
        position: '0:0:0',
      };
      // 2.123456789s should round to exact frame boundary
      router.emitEvent('metronome', event, 2.123456789);

      // Calculate expected frame-rounded time
      const frame = Math.round(2.123456789 * 48000);
      const expectedTime = frame / 48000;

      expect(mockMetronomeScheduler.schedule).toHaveBeenCalledWith(
        event,
        expectedTime,
        frame,
      );
    });

    it('should track timing accuracy', () => {
      router.setTransportStartTime(0);

      const event: PatternEvent = {
        type: 'metronome-click',
        position: '0:0:0',
      };
      router.emitEvent('metronome', event, 1.5);

      const frame = Math.round(1.5 * 48000);
      expect(mockTrackTimingAccuracy).toHaveBeenCalledWith(frame, 1.5);
    });
  });

  // ============================================================================
  // DIRECT SCHEDULING TESTS
  // ============================================================================

  describe('Direct scheduling', () => {
    it('should route metronome to metronome scheduler', () => {
      router.setTransportStartTime(0);

      const event: PatternEvent = {
        type: 'metronome-click',
        position: '0:0:0',
      };
      router.emitEvent('metronome', event, 1.0);

      expect(mockMetronomeScheduler.schedule).toHaveBeenCalledWith(
        event,
        1.0,
        48000,
      );
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should route drums to drum scheduler', () => {
      router.setTransportStartTime(0);

      const event: PatternEvent = { type: 'kick', position: '0:0:0' };
      router.emitEvent('drums', event, 1.0);

      expect(mockDrumScheduler.schedule).toHaveBeenCalledWith(
        event,
        1.0,
        48000,
      );
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should route harmony to harmony scheduler', () => {
      router.setTransportStartTime(0);

      const event: PatternEvent = { type: 'note', position: '0:0:0' };
      router.emitEvent('harmony', event, 1.0);

      expect(mockHarmonyScheduler.schedule).toHaveBeenCalledWith(
        event,
        1.0,
        48000,
      );
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should route bass to bass scheduler', () => {
      router.setTransportStartTime(0);

      const event: PatternEvent = { type: 'note', position: '0:0:0' };
      router.emitEvent('bass', event, 1.0);

      expect(mockBassScheduler.schedule).toHaveBeenCalledWith(
        event,
        1.0,
        48000,
      );
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should route voice-cue to voice cue scheduler', () => {
      router.setTransportStartTime(0);

      const event: PatternEvent = { type: 'cue', position: '0:0:0' };
      router.emitEvent('voice-cue', event, 1.0);

      expect(mockVoiceCueScheduler.schedule).toHaveBeenCalledWith(
        event,
        1.0,
        48000,
      );
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    // LAUNCH-02.5b — audio-stem routing
    it.each([
      'audio-bass',
      'audio-drums',
      'audio-harmony',
      'audio-click',
    ] as const)(
      'should route %s through the audio player scheduler',
      (instrumentType) => {
        router.setTransportStartTime(0);
        const event: PatternEvent = {
          type: 'audio-stem',
          position: '0:0:0',
          data: { stemKey: instrumentType.slice('audio-'.length) },
        };
        router.emitEvent(instrumentType, event, 1.0);

        expect(mockAudioPlayerScheduler.schedule).toHaveBeenCalledWith(
          event,
          1.0,
          48000,
        );
        // None of the MIDI schedulers should see this event.
        expect(mockDrumScheduler.schedule).not.toHaveBeenCalled();
        expect(mockBassScheduler.schedule).not.toHaveBeenCalled();
        expect(mockHarmonyScheduler.schedule).not.toHaveBeenCalled();
        expect(mockMetronomeScheduler.schedule).not.toHaveBeenCalled();
        expect(mockVoiceCueScheduler.schedule).not.toHaveBeenCalled();
        expect(mockEventBus.emit).not.toHaveBeenCalled();
      },
    );

    it('should NOT route MIDI "drums" through the audio player scheduler', () => {
      router.setTransportStartTime(0);
      const event: PatternEvent = { type: 'drum-hit', position: '0:0:0' };
      router.emitEvent('drums', event, 1.0);

      expect(mockDrumScheduler.schedule).toHaveBeenCalledTimes(1);
      expect(mockAudioPlayerScheduler.schedule).not.toHaveBeenCalled();
    });

    it('does NOT call audioPlayerScheduler.schedule when no audio scheduler was provided', () => {
      // Re-initialize WITHOUT the audio scheduler (omit 10th arg).
      const bareRouter = new EventRouter('test-bare');
      bareRouter.initialize(
        mockAudioContext,
        48000,
        mockEventBus,
        mockMetronomeScheduler,
        mockDrumScheduler,
        mockHarmonyScheduler,
        mockBassScheduler,
        mockVoiceCueScheduler,
        mockTrackTimingAccuracy,
        // no audioPlayerScheduler
      );
      bareRouter.setTransportStartTime(0);

      const event: PatternEvent = {
        type: 'audio-stem',
        position: '0:0:0',
        data: { stemKey: 'bass' },
      };
      bareRouter.emitEvent('audio-bass', event, 1.0);

      // The mock audio scheduler we set up for the parent describe must not
      // see this event (we passed undefined as the 10th arg).
      expect(mockAudioPlayerScheduler.schedule).not.toHaveBeenCalled();
      // No MIDI scheduler should be tricked into handling it either.
      expect(mockDrumScheduler.schedule).not.toHaveBeenCalled();
      expect(mockBassScheduler.schedule).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // EVENT BUS FALLBACK TESTS
  // ============================================================================

  describe('Event bus fallback', () => {
    it('should fall back to event bus when scheduler returns false', () => {
      router.setTransportStartTime(0);

      // Make metronome scheduler return false (not handled)
      vi.mocked(mockMetronomeScheduler.schedule).mockReturnValue(false);

      const event: PatternEvent = { type: 'accent', position: '0:0:0' };
      router.emitEvent('metronome', event, 1.0);

      // Should emit to event bus
      expect(mockEventBus.emit).toHaveBeenCalledWith('metronome-trigger', {
        beat: 1, // accent = downbeat
        isDownbeat: true,
        audioTime: 1.0,
        timestamp: expect.any(Number),
        velocity: 0.8,
      });
    });

    it('should emit metronome click to event bus', () => {
      router.setTransportStartTime(0);
      vi.mocked(mockMetronomeScheduler.schedule).mockReturnValue(false);

      const event: PatternEvent = { type: 'click', position: '0:0:0' };
      router.emitEvent('metronome', event, 1.0);

      expect(mockEventBus.emit).toHaveBeenCalledWith('metronome-trigger', {
        beat: 2, // click = not downbeat
        isDownbeat: false,
        audioTime: 1.0,
        timestamp: expect.any(Number),
        velocity: 0.8,
      });
    });

    it('should emit drum events to event bus', () => {
      router.setTransportStartTime(0);
      vi.mocked(mockDrumScheduler.schedule).mockReturnValue(false);

      const event: PatternEvent = {
        type: 'kick',
        position: '0:0:0',
        velocity: 0.9,
      };
      router.emitEvent('drums', event, 1.0);

      expect(mockEventBus.emit).toHaveBeenCalledWith('drum-trigger', {
        drum: 'kick',
        audioTime: 1.0,
        timestamp: expect.any(Number),
        velocity: 0.9,
      });
    });

    it('should map drum event types correctly', () => {
      router.setTransportStartTime(0);
      vi.mocked(mockDrumScheduler.schedule).mockReturnValue(false);

      const drumMap = [
        { type: 'kick', expected: 'kick' },
        { type: 'snare', expected: 'snare' },
        { type: 'hihat', expected: 'hihat' },
        { type: 'openhat', expected: 'openHihat' },
        { type: 'crash', expected: 'crash' },
        { type: 'ride', expected: 'ride' },
      ];

      drumMap.forEach(({ type, expected }) => {
        vi.mocked(mockEventBus.emit).mockClear();
        const event: PatternEvent = { type, position: '0:0:0' };
        router.emitEvent('drums', event, 1.0);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          'drum-trigger',
          expect.objectContaining({ drum: expected }),
        );
      });
    });

    it('should emit bass events to event bus', () => {
      router.setTransportStartTime(0);
      vi.mocked(mockBassScheduler.schedule).mockReturnValue(false);

      const event: PatternEvent = {
        type: 'E2',
        position: '0:0:0',
        velocity: 0.85,
      };
      router.emitEvent('bass', event, 1.0);

      expect(mockEventBus.emit).toHaveBeenCalledWith('bass-trigger', {
        note: 'E2',
        audioTime: 1.0,
        timestamp: expect.any(Number),
        velocity: 0.85,
      });
    });

    it('should emit harmony events to event bus', () => {
      router.setTransportStartTime(0);
      vi.mocked(mockHarmonyScheduler.schedule).mockReturnValue(false);

      const event: PatternEvent = {
        type: 'Cmaj7',
        position: '0:0:0',
        velocity: 0.7,
      };
      router.emitEvent('harmony', event, 1.0);

      expect(mockEventBus.emit).toHaveBeenCalledWith('chord-trigger', {
        chord: 'Cmaj7',
        notes: [],
        audioTime: 1.0,
        timestamp: expect.any(Number),
        velocity: 0.7,
      });
    });

    it('should use default velocity when not provided', () => {
      router.setTransportStartTime(0);
      vi.mocked(mockMetronomeScheduler.schedule).mockReturnValue(false);

      const event: PatternEvent = { type: 'click', position: '0:0:0' };
      router.emitEvent('metronome', event, 1.0);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'metronome-trigger',
        expect.objectContaining({ velocity: 0.8 }),
      );
    });
  });

  // ============================================================================
  // UNKNOWN INSTRUMENT TESTS
  // ============================================================================

  describe('Unknown instruments', () => {
    it('should not emit to event bus for unknown instruments', () => {
      router.setTransportStartTime(0);

      const event: PatternEvent = { type: 'note', position: '0:0:0' };
      router.emitEvent('unknown-instrument', event, 1.0);

      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration scenarios', () => {
    it('should handle multiple events with different instruments', () => {
      router.setTransportStartTime(5.0);

      const events = [
        {
          instrument: 'metronome',
          event: { type: 'click', position: '0:0:0' },
        },
        { instrument: 'drums', event: { type: 'kick', position: '0:1:0' } },
        { instrument: 'bass', event: { type: 'E2', position: '0:2:0' } },
        {
          instrument: 'harmony',
          event: { type: 'Cmaj7', position: '0:3:0' },
        },
      ];

      events.forEach(({ instrument, event }, index) => {
        router.emitEvent(instrument, event as PatternEvent, index * 0.5);
      });

      expect(mockMetronomeScheduler.schedule).toHaveBeenCalledTimes(1);
      expect(mockDrumScheduler.schedule).toHaveBeenCalledTimes(1);
      expect(mockBassScheduler.schedule).toHaveBeenCalledTimes(1);
      expect(mockHarmonyScheduler.schedule).toHaveBeenCalledTimes(1);
    });

    it('should handle harmony-control-change events', () => {
      router.setTransportStartTime(0);

      const event: PatternEvent = {
        type: 'harmony-control-change',
        position: '0:0:0',
        data: { cc: 64, value: 127 },
      };

      // The earlier verbose '[EMIT EVENT]' console.log was removed in the
      // logging cleanup. The real contract is that the harmony scheduler
      // receives the event — that's the only thing worth asserting here.
      router.emitEvent('harmony', event, 1.0);

      expect(mockHarmonyScheduler.schedule).toHaveBeenCalled();
    });
  });
});
