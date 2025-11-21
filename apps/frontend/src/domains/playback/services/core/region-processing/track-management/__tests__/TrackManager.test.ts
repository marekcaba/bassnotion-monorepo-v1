/**
 * TrackManager Tests
 *
 * Tests track registration, replacement, and dynamic updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrackManager } from '../TrackManager.js';

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Types
interface PatternEvent {
  position: string | { measure: number; beat: number; subdivision?: number; tick?: number };
  type: string;
  velocity?: number;
  duration?: string | number;
  data?: any;
}

interface Region {
  id: string;
  startTime: number;
  duration: number;
  skipCountdownOffset?: boolean;
  pattern?: {
    events: PatternEvent[];
  };
  events?: PatternEvent[];
}

interface Track {
  id?: string;
  name?: string;
  track?: { id: string };
  regions: Region[];
  instrumentType?: string;
  exerciseId?: string;
}

describe('TrackManager', () => {
  let manager: TrackManager;
  let tracksMap: Map<string, Track>;
  let scheduledEvents: Map<string, Set<string>>;
  let mockClearTrackEvents: ReturnType<typeof vi.fn>;
  let mockClearHarmonyState: ReturnType<typeof vi.fn>;
  let mockLogDebugMessage: ReturnType<typeof vi.fn>;
  let mockRegisterTracksFunc: ReturnType<typeof vi.fn>;
  let mockScheduleAllRegions: ReturnType<typeof vi.fn>;
  let mockLoadGrandPianoKeyboardMap: ReturnType<typeof vi.fn>;
  let mockGetGrandPianoKeyboardMap: ReturnType<typeof vi.fn>;
  let mockSetHarmonyInstrument: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    manager = new TrackManager('test-instance');
    tracksMap = new Map();
    scheduledEvents = new Map();
    mockClearTrackEvents = vi.fn();
    mockClearHarmonyState = vi.fn();
    mockLogDebugMessage = vi.fn();
    mockRegisterTracksFunc = vi.fn();
    mockScheduleAllRegions = vi.fn();
    mockLoadGrandPianoKeyboardMap = vi.fn(() => Promise.resolve());
    mockGetGrandPianoKeyboardMap = vi.fn(() => null);
    mockSetHarmonyInstrument = vi.fn();

    // Suppress console.log for cleaner test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  // ============================================================================
  // REGISTER TRACKS TESTS
  // ============================================================================

  describe('registerTracks', () => {
    it('should add new track to empty map', () => {
      const track: Track = {
        id: 'track-1',
        instrumentType: 'metronome',
        regions: [
          {
            id: 'region-1',
            startTime: 0,
            duration: 4,
            pattern: { events: [] },
          },
        ],
      };

      manager.registerTracks(
        [track],
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      expect(tracksMap.size).toBe(1);
      expect(tracksMap.get('track-1')).toBe(track);
      expect(mockClearTrackEvents).not.toHaveBeenCalled();
    });

    it('should add multiple tracks', () => {
      const tracks: Track[] = [
        { id: 'track-1', instrumentType: 'metronome', regions: [] },
        { id: 'track-2', instrumentType: 'drums', regions: [] },
        { id: 'track-3', instrumentType: 'harmony', regions: [] },
      ];

      manager.registerTracks(
        tracks,
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      expect(tracksMap.size).toBe(3);
      expect(tracksMap.has('track-1')).toBe(true);
      expect(tracksMap.has('track-2')).toBe(true);
      expect(tracksMap.has('track-3')).toBe(true);
    });

    it('should replace existing track with same instrumentType', () => {
      // Add initial track
      const oldTrack: Track = {
        id: 'old-metronome',
        instrumentType: 'metronome',
        regions: [],
      };
      tracksMap.set('old-metronome', oldTrack);

      // Register new track with same instrumentType
      const newTrack: Track = {
        id: 'new-metronome',
        instrumentType: 'metronome',
        regions: [],
      };

      manager.registerTracks(
        [newTrack],
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      expect(tracksMap.size).toBe(1);
      expect(tracksMap.has('old-metronome')).toBe(false);
      expect(tracksMap.has('new-metronome')).toBe(true);
      expect(mockClearTrackEvents).toHaveBeenCalledWith('old-metronome');
    });

    it('should clear harmony state when replacing harmony track', () => {
      // Add initial harmony track
      tracksMap.set('old-harmony', {
        id: 'old-harmony',
        instrumentType: 'harmony',
        regions: [],
      });

      // Register new harmony track
      manager.registerTracks(
        [{ id: 'new-harmony', instrumentType: 'harmony', regions: [] }],
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      expect(mockClearHarmonyState).toHaveBeenCalled();
    });

    it('should not clear harmony state when replacing non-harmony track', () => {
      // Add initial drums track
      tracksMap.set('old-drums', {
        id: 'old-drums',
        instrumentType: 'drums',
        regions: [],
      });

      // Register new drums track
      manager.registerTracks(
        [{ id: 'new-drums', instrumentType: 'drums', regions: [] }],
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      expect(mockClearHarmonyState).not.toHaveBeenCalled();
    });

    it('should handle track with different ID but same instrumentType', () => {
      // This simulates exercise change where trackId stays same but exerciseId changes
      tracksMap.set('harmony-widget-track', {
        id: 'harmony-widget-track',
        instrumentType: 'harmony',
        exerciseId: 'exercise-1',
        regions: [],
      });

      // New track with same ID but different exercise
      manager.registerTracks(
        [
          {
            id: 'harmony-widget-track',
            instrumentType: 'harmony',
            exerciseId: 'exercise-2',
            regions: [],
          },
        ],
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      expect(tracksMap.size).toBe(1);
      expect(tracksMap.get('harmony-widget-track')?.exerciseId).toBe('exercise-2');
      expect(mockClearTrackEvents).toHaveBeenCalledWith('harmony-widget-track');
    });

    it('should handle tracks without ID using name', () => {
      const track: Track = {
        name: 'my-track',
        instrumentType: 'bass',
        regions: [],
      };

      manager.registerTracks(
        [track],
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      expect(tracksMap.has('my-track')).toBe(true);
    });

    it('should handle tracks with nested track.id', () => {
      const track: Track = {
        track: { id: 'nested-id' },
        instrumentType: 'voice-cue',
        regions: [],
      };

      manager.registerTracks(
        [track],
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      expect(tracksMap.has('nested-id')).toBe(true);
    });
  });

  // ============================================================================
  // UPDATE TRACKS TESTS
  // ============================================================================

  describe('updateTracks', () => {
    it('should call registerTracks when not running', () => {
      const tracks: Track[] = [
        { id: 'track-1', instrumentType: 'metronome', regions: [] },
      ];

      manager.updateTracks(
        tracks,
        undefined,
        false, // not running
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockRegisterTracksFunc,
        mockScheduleAllRegions,
        mockLoadGrandPianoKeyboardMap,
        mockGetGrandPianoKeyboardMap,
        mockSetHarmonyInstrument,
        mockLogDebugMessage,
      );

      expect(mockRegisterTracksFunc).toHaveBeenCalledWith(tracks);
      expect(mockScheduleAllRegions).not.toHaveBeenCalled();
    });

    it('should dynamically add tracks when running', () => {
      const tracks: Track[] = [
        { id: 'track-1', instrumentType: 'metronome', regions: [] },
      ];

      manager.updateTracks(
        tracks,
        undefined,
        true, // running
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockRegisterTracksFunc,
        mockScheduleAllRegions,
        mockLoadGrandPianoKeyboardMap,
        mockGetGrandPianoKeyboardMap,
        mockSetHarmonyInstrument,
        mockLogDebugMessage,
      );

      expect(tracksMap.has('track-1')).toBe(true);
      expect(mockScheduleAllRegions).toHaveBeenCalled();
      expect(mockRegisterTracksFunc).not.toHaveBeenCalled();
    });

    it('should clear existing track events when running', () => {
      // Add existing track
      tracksMap.set('track-1', {
        id: 'track-1',
        instrumentType: 'metronome',
        regions: [],
      });

      // Update with same track ID
      const tracks: Track[] = [
        { id: 'track-1', instrumentType: 'metronome', regions: [] },
      ];

      manager.updateTracks(
        tracks,
        undefined,
        true,
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockRegisterTracksFunc,
        mockScheduleAllRegions,
        mockLoadGrandPianoKeyboardMap,
        mockGetGrandPianoKeyboardMap,
        mockSetHarmonyInstrument,
        mockLogDebugMessage,
      );

      expect(mockClearTrackEvents).toHaveBeenCalledWith('track-1');
    });

    it('should clear harmony state when updating harmony track while running', () => {
      // Add existing harmony track
      tracksMap.set('harmony-1', {
        id: 'harmony-1',
        instrumentType: 'harmony',
        regions: [],
      });

      // Update with same track ID
      manager.updateTracks(
        [{ id: 'harmony-1', instrumentType: 'harmony', regions: [] }],
        undefined,
        true,
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockRegisterTracksFunc,
        mockScheduleAllRegions,
        mockLoadGrandPianoKeyboardMap,
        mockGetGrandPianoKeyboardMap,
        mockSetHarmonyInstrument,
        mockLogDebugMessage,
      );

      expect(mockClearHarmonyState).toHaveBeenCalled();
    });

    it('should set harmony instrument from metadata', () => {
      manager.updateTracks(
        [],
        { harmonyInstrument: 'rhodes' },
        false,
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockRegisterTracksFunc,
        mockScheduleAllRegions,
        mockLoadGrandPianoKeyboardMap,
        mockGetGrandPianoKeyboardMap,
        mockSetHarmonyInstrument,
        mockLogDebugMessage,
      );

      expect(mockSetHarmonyInstrument).toHaveBeenCalledWith('rhodes');
    });

    it('should load Grand Piano keyboard map when needed', async () => {
      mockGetGrandPianoKeyboardMap.mockReturnValue(null); // Not loaded yet

      manager.updateTracks(
        [],
        { harmonyInstrument: 'grandpiano' },
        false,
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockRegisterTracksFunc,
        mockScheduleAllRegions,
        mockLoadGrandPianoKeyboardMap,
        mockGetGrandPianoKeyboardMap,
        mockSetHarmonyInstrument,
        mockLogDebugMessage,
      );

      // Wait for async load
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLoadGrandPianoKeyboardMap).toHaveBeenCalled();
    });

    it('should not load Grand Piano keyboard map if already loaded', () => {
      mockGetGrandPianoKeyboardMap.mockReturnValue({ some: 'data' }); // Already loaded

      manager.updateTracks(
        [],
        { harmonyInstrument: 'grandpiano' },
        false,
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockRegisterTracksFunc,
        mockScheduleAllRegions,
        mockLoadGrandPianoKeyboardMap,
        mockGetGrandPianoKeyboardMap,
        mockSetHarmonyInstrument,
        mockLogDebugMessage,
      );

      expect(mockLoadGrandPianoKeyboardMap).not.toHaveBeenCalled();
    });

    it('should not load keyboard map for non-Grand Piano instruments', () => {
      manager.updateTracks(
        [],
        { harmonyInstrument: 'rhodes' },
        false,
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockRegisterTracksFunc,
        mockScheduleAllRegions,
        mockLoadGrandPianoKeyboardMap,
        mockGetGrandPianoKeyboardMap,
        mockSetHarmonyInstrument,
        mockLogDebugMessage,
      );

      expect(mockLoadGrandPianoKeyboardMap).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // CLEAR TRACK EVENTS TESTS
  // ============================================================================

  describe('clearTrackEvents', () => {
    it('should remove track from scheduledEvents map', () => {
      scheduledEvents.set('track-1', new Set(['event-1', 'event-2']));

      manager.clearTrackEvents('track-1', scheduledEvents);

      expect(scheduledEvents.has('track-1')).toBe(false);
    });

    it('should handle clearing non-existent track', () => {
      expect(() => {
        manager.clearTrackEvents('non-existent', scheduledEvents);
      }).not.toThrow();
    });

    it('should only clear specific track, not others', () => {
      scheduledEvents.set('track-1', new Set(['event-1']));
      scheduledEvents.set('track-2', new Set(['event-2']));

      manager.clearTrackEvents('track-1', scheduledEvents);

      expect(scheduledEvents.has('track-1')).toBe(false);
      expect(scheduledEvents.has('track-2')).toBe(true);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration scenarios', () => {
    it('should handle complete workflow: register → update → clear', () => {
      // 1. Register initial track
      manager.registerTracks(
        [{ id: 'track-1', instrumentType: 'metronome', regions: [] }],
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      scheduledEvents.set('track-1', new Set(['event-1', 'event-2']));

      // 2. Update while running (should clear and re-add)
      manager.updateTracks(
        [{ id: 'track-1', instrumentType: 'metronome', regions: [] }],
        undefined,
        true,
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockRegisterTracksFunc,
        mockScheduleAllRegions,
        mockLoadGrandPianoKeyboardMap,
        mockGetGrandPianoKeyboardMap,
        mockSetHarmonyInstrument,
        mockLogDebugMessage,
      );

      expect(mockClearTrackEvents).toHaveBeenCalledWith('track-1');
      expect(tracksMap.has('track-1')).toBe(true);
      expect(mockScheduleAllRegions).toHaveBeenCalled();

      // 3. Clear track events
      manager.clearTrackEvents('track-1', scheduledEvents);
      expect(scheduledEvents.has('track-1')).toBe(false);
    });

    it('should handle exercise change scenario', () => {
      // Initial exercise
      manager.registerTracks(
        [
          {
            id: 'harmony-widget-track',
            instrumentType: 'harmony',
            exerciseId: 'come-together-v100',
            regions: [],
          },
        ],
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      // Change exercise (different exercise, same track ID, same instrument type)
      manager.registerTracks(
        [
          {
            id: 'harmony-widget-track',
            instrumentType: 'harmony',
            exerciseId: 'come-together-v104',
            regions: [],
          },
        ],
        tracksMap,
        scheduledEvents,
        mockClearTrackEvents,
        mockClearHarmonyState,
        mockLogDebugMessage,
      );

      expect(tracksMap.size).toBe(1);
      expect(tracksMap.get('harmony-widget-track')?.exerciseId).toBe(
        'come-together-v104',
      );
      expect(mockClearTrackEvents).toHaveBeenCalledWith('harmony-widget-track');
      expect(mockClearHarmonyState).toHaveBeenCalled();
    });
  });
});
