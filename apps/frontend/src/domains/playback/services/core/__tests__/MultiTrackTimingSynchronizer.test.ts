import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MultiTrackTimingSynchronizer } from '../MultiTrackTimingSynchronizer.js';
import { UnifiedTransport } from '../UnifiedTransport.js';
import { Track } from '../Track.js';
import type {
  MusicalPosition,
  TransportPosition,
} from '../UnifiedTransport.js';

// Mock dependencies
vi.mock('../UnifiedTransport.js');
vi.mock('../ServiceRegistry.js', () => ({
  serviceRegistry: {
    get: vi.fn(),
  },
}));

// Import mocked serviceRegistry
import { serviceRegistry } from '../ServiceRegistry.js';

// Mock Tone.js
const mockTone = {
  Transport: {
    schedule: vi.fn(),
    clear: vi.fn(),
  },
};

describe('MultiTrackTimingSynchronizer', () => {
  let synchronizer: MultiTrackTimingSynchronizer;
  let mockTransport: any;
  let mockEventBus: any;
  let mockTrack: Track;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    (MultiTrackTimingSynchronizer as any).instance = null;

    // Setup mock transport
    mockTransport = {
      on: vi.fn(),
      off: vi.fn(),
      getCurrentTime: vi.fn(() => 1.0),
      getTempo: vi.fn(() => 120),
    };

    // Setup UnifiedTransport mock
    vi.mocked(UnifiedTransport.getInstance).mockReturnValue(mockTransport);

    // Setup mock event bus
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
    };

    // Configure service registry
    vi.mocked(serviceRegistry.get).mockImplementation((key: string) => {
      if (key === 'eventBus') return mockEventBus;
      throw new Error(`Service ${key} not found`);
    });

    // Create mock track
    mockTrack = {
      id: 'track-1',
      name: 'Test Track',
      instrumentType: 'drums',
      state: 'READY',
    } as Track;

    // Reset Tone.js mocks
    mockTone.Transport.schedule.mockReset();
    mockTone.Transport.clear.mockReset();

    synchronizer = MultiTrackTimingSynchronizer.getInstance();
    synchronizer.initializeTone(mockTone as any);
  });

  afterEach(() => {
    synchronizer.dispose();
  });

  describe('initialization', () => {
    it('should be a singleton', () => {
      const instance1 = MultiTrackTimingSynchronizer.getInstance();
      const instance2 = MultiTrackTimingSynchronizer.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should subscribe to transport position updates', () => {
      expect(mockTransport.on).toHaveBeenCalledWith(
        'position',
        expect.any(Function),
      );
    });
  });

  describe('track registration', () => {
    it('should register a track with priority', () => {
      synchronizer.registerTrack(mockTrack, 75);

      const timingState = synchronizer.getTrackTimingState('track-1');

      expect(timingState).toBeDefined();
      expect(timingState?.trackId).toBe('track-1');
      expect(timingState?.priority).toBe(75);
      expect(timingState?.isActive).toBe(true);
      expect(timingState?.errorCount).toBe(0);

      expect(mockEventBus.emit).toHaveBeenCalledWith('timing:trackRegistered', {
        trackId: 'track-1',
        priority: 75,
      });
    });

    it('should unregister a track', () => {
      synchronizer.registerTrack(mockTrack);
      synchronizer.unregisterTrack('track-1');

      const timingState = synchronizer.getTrackTimingState('track-1');
      expect(timingState).toBeUndefined();
    });
  });

  describe('event scheduling', () => {
    beforeEach(() => {
      synchronizer.registerTrack(mockTrack);
    });

    it('should schedule track events with sample-accurate timing', () => {
      const callback = vi.fn();
      const musicalPosition: MusicalPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };

      const eventId = synchronizer.scheduleTrackEvent(
        'track-1',
        callback,
        musicalPosition,
      );

      expect(eventId).toBeDefined();
      expect(mockTone.Transport.schedule).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Number),
      );
    });

    it('should apply compensation offset', () => {
      const timingState = synchronizer.getTrackTimingState('track-1');
      if (timingState) {
        timingState.compensationOffset = -5; // -5ms compensation
      }

      const callback = vi.fn();
      const musicalPosition: MusicalPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };

      synchronizer.scheduleTrackEvent('track-1', callback, musicalPosition);

      // Should apply compensation
      const scheduledTime = mockTone.Transport.schedule.mock.calls[0][1];
      expect(scheduledTime).toBeLessThan(2); // 2 seconds without compensation
    });

    it('should throw error for unregistered track', () => {
      const callback = vi.fn();
      const musicalPosition: MusicalPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };

      expect(() => {
        synchronizer.scheduleTrackEvent(
          'unknown-track',
          callback,
          musicalPosition,
        );
      }).toThrow('Track unknown-track not registered for timing sync');
    });

    it('should throw error for isolated track', () => {
      const timingState = synchronizer.getTrackTimingState('track-1');
      if (timingState) {
        timingState.isActive = false;
      }

      const callback = vi.fn();
      const musicalPosition: MusicalPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };

      expect(() => {
        synchronizer.scheduleTrackEvent('track-1', callback, musicalPosition);
      }).toThrow('Track track-1 is isolated due to timing errors');
    });
  });

  describe('drift monitoring', () => {
    beforeEach(() => {
      synchronizer.registerTrack(mockTrack);
    });

    it('should track drift measurements', () => {
      const callback = vi.fn();
      const musicalPosition: MusicalPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };

      synchronizer.scheduleTrackEvent('track-1', callback, musicalPosition);

      // Simulate event execution
      const scheduledCallback = mockTone.Transport.schedule.mock.calls[0][0];
      scheduledCallback(2.001); // 1ms drift

      const timingState = synchronizer.getTrackTimingState('track-1');
      expect(timingState?.driftMeasurement).toBeCloseTo(1, 1);
      expect(timingState?.driftHistory).toContain(1);
    });

    it('should emit drift violation for excessive drift', () => {
      const callback = vi.fn();
      const musicalPosition: MusicalPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };

      synchronizer.scheduleTrackEvent('track-1', callback, musicalPosition);

      // Simulate event with excessive drift
      const scheduledCallback = mockTone.Transport.schedule.mock.calls[0][0];
      scheduledCallback(2.002); // 2ms drift (exceeds 1ms tolerance)

      expect(mockEventBus.emit).toHaveBeenCalledWith('timing:driftViolation', {
        trackId: 'track-1',
        drift: 2,
        errorCount: 1,
      });
    });
  });

  describe('drift compensation', () => {
    beforeEach(() => {
      synchronizer.registerTrack(mockTrack);
    });

    it('should apply drift compensation after violations', () => {
      const callback = vi.fn();
      const musicalPosition: MusicalPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };

      // Simulate multiple drift measurements
      for (let i = 0; i < 3; i++) {
        synchronizer.scheduleTrackEvent('track-1', callback, musicalPosition);
        const scheduledCallback = mockTone.Transport.schedule.mock.calls[i][0];
        scheduledCallback(2.002); // Consistent 2ms drift
      }

      const timingState = synchronizer.getTrackTimingState('track-1');
      expect(timingState?.compensationOffset).toBeCloseTo(-2, 1);
    });
  });

  describe('track isolation', () => {
    beforeEach(() => {
      synchronizer.registerTrack(mockTrack);
    });

    it('should isolate track after error threshold', () => {
      const callback = vi.fn();
      const musicalPosition: MusicalPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };

      // Simulate multiple errors
      for (let i = 0; i < 6; i++) {
        synchronizer.scheduleTrackEvent('track-1', callback, musicalPosition);
        const scheduledCallback = mockTone.Transport.schedule.mock.calls[i][0];
        scheduledCallback(2.01); // 10ms drift each time
      }

      const timingState = synchronizer.getTrackTimingState('track-1');
      expect(timingState?.isActive).toBe(false);
      expect(timingState?.errorCount).toBeGreaterThanOrEqual(5);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'timing:trackIsolated',
        expect.any(Object),
      );
    });

    it('should handle callback errors gracefully', () => {
      const callback = vi.fn(() => {
        throw new Error('Callback error');
      });

      const musicalPosition: MusicalPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };

      synchronizer.scheduleTrackEvent('track-1', callback, musicalPosition);

      // Should not throw
      const scheduledCallback = mockTone.Transport.schedule.mock.calls[0][0];
      expect(() => scheduledCallback(2.0)).not.toThrow();

      const timingState = synchronizer.getTrackTimingState('track-1');
      expect(timingState?.errorCount).toBe(1);
      expect(timingState?.lastError).toBe('Callback error');
    });
  });

  describe('sync monitoring', () => {
    it('should generate sync reports', (done) => {
      synchronizer.registerTrack(mockTrack, 100);

      const track2 = {
        id: 'track-2',
        name: 'Track 2',
        instrumentType: 'bass',
      } as Track;
      synchronizer.registerTrack(track2, 50);

      // Wait for sync check interval
      setTimeout(() => {
        const report = synchronizer.getSyncReport();

        expect(report).toBeDefined();
        expect(report?.tracks).toHaveLength(2);
        expect(report?.syncHealth).toBeGreaterThan(0);
        expect(report?.warnings).toBeDefined();

        done();
      }, 150);
    });

    it('should validate multi-track synchronization', () => {
      synchronizer.registerTrack(mockTrack);

      const track2 = {
        id: 'track-2',
        name: 'Track 2',
        instrumentType: 'bass',
      } as Track;
      synchronizer.registerTrack(track2);

      // Initially should be valid
      expect(synchronizer.validateSync()).toBe(true);
    });
  });

  describe('transport position handling', () => {
    it('should update AudioWorklet time for all tracks', () => {
      synchronizer.registerTrack(mockTrack);

      const track2 = {
        id: 'track-2',
        name: 'Track 2',
        instrumentType: 'bass',
      } as Track;
      synchronizer.registerTrack(track2);

      // Get position handler
      const positionHandler = mockTransport.on.mock.calls.find(
        (call) => call[0] === 'position',
      )?.[1];

      const position: TransportPosition = {
        bars: 1,
        beats: 2,
        sixteenths: 0,
        ticks: 0,
        seconds: 2.5,
      };

      positionHandler(position);

      const state1 = synchronizer.getTrackTimingState('track-1');
      const state2 = synchronizer.getTrackTimingState('track-2');

      expect(state1?.lastAudioWorkletTime).toBe(2.5);
      expect(state2?.lastAudioWorkletTime).toBe(2.5);
    });
  });

  describe('error recovery', () => {
    it('should reset track errors', () => {
      synchronizer.registerTrack(mockTrack);

      const timingState = synchronizer.getTrackTimingState('track-1');
      if (timingState) {
        timingState.errorCount = 5;
        timingState.lastError = 'Test error';
        timingState.isActive = false;
      }

      synchronizer.resetTrackErrors('track-1');

      const resetState = synchronizer.getTrackTimingState('track-1');
      expect(resetState?.errorCount).toBe(0);
      expect(resetState?.lastError).toBeUndefined();
      expect(resetState?.isActive).toBe(true);
    });
  });
});
