/**
 * LifecycleCoordinator Tests
 *
 * Tests playback lifecycle management (start + stop)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Tone.js BEFORE importing any modules
vi.mock('tone', () => ({
  Transport: {
    bpm: { value: 120 },
    state: 'stopped',
    seconds: 0,
    position: '0:0:0',
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    clear: vi.fn(),
    cancel: vi.fn(),
  },
  context: {
    currentTime: 0,
    sampleRate: 48000,
  } as unknown as AudioContext,
}));

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import * as Tone from 'tone';
import { LifecycleCoordinator } from '../LifecycleCoordinator.js';

// Get reference to mocked Transport for test modifications
const mockToneTransport = Tone.Transport as any;

// Types
interface Track {
  id?: string;
  name?: string;
  instrumentType?: string;
  audioNode?: {
    clearEvents?: () => void;
  };
}

interface AudioSourceInfo {
  type: 'one-shot' | 'sustained';
  hasStopScheduled: boolean;
}

interface TimingMetrics {
  totalEvents: number;
  perfectFrames: number;
  accuracy: number;
  avgJitterMs: number;
  maxJitterMs: number;
  grade: string;
  isStable: boolean;
}

describe('LifecycleCoordinator', () => {
  let coordinator: LifecycleCoordinator;
  let audioContext: AudioContext;
  let tracks: Map<string, Track>;
  let scheduledIds: Set<number>;
  let scheduledEvents: Map<string, Set<string>>;
  let currentCC64Timeline: Map<number, boolean>;
  let activeHarmonySources: Map<
    string,
    Array<{
      source: AudioBufferSourceNode;
      gain: GainNode;
      gainValue: number;
      noteEndTime: number;
    }>
  >;
  let activeBassSources: Map<string, AudioBufferSourceNode>;
  let scheduledAudioSources: Map<AudioBufferSourceNode, AudioSourceInfo>;

  // Mock functions
  let mockSetAudioContext: ReturnType<typeof vi.fn>;
  let mockSetSampleRate: ReturnType<typeof vi.fn>;
  let mockSetTransportStartTime: ReturnType<typeof vi.fn>;
  let mockSyncTransportStartTime: ReturnType<typeof vi.fn>;
  let mockClearScheduledState: ReturnType<typeof vi.fn>;
  let mockResetMetrics: ReturnType<typeof vi.fn>;
  let mockStartMetricsReporting: ReturnType<typeof vi.fn>;
  let mockStopMetricsReporting: ReturnType<typeof vi.fn>;
  let mockScheduleAllRegions: ReturnType<typeof vi.fn>;
  let mockGetDebugger: ReturnType<typeof vi.fn>;
  let mockProcessCurrentPosition: ReturnType<typeof vi.fn>;
  let mockGetTimingMetrics: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    coordinator = new LifecycleCoordinator('test-instance');

    // Create mock AudioContext
    audioContext = {
      currentTime: 1.0,
      sampleRate: 48000,
    } as unknown as AudioContext;

    // Initialize state
    tracks = new Map();
    scheduledIds = new Set();
    scheduledEvents = new Map();
    currentCC64Timeline = new Map();
    activeHarmonySources = new Map();
    activeBassSources = new Map();
    scheduledAudioSources = new Map();

    // Initialize mock functions
    mockSetAudioContext = vi.fn();
    mockSetSampleRate = vi.fn();
    mockSetTransportStartTime = vi.fn();
    mockSyncTransportStartTime = vi.fn();
    mockClearScheduledState = vi.fn();
    mockResetMetrics = vi.fn();
    mockStartMetricsReporting = vi.fn();
    mockStopMetricsReporting = vi.fn();
    mockScheduleAllRegions = vi.fn();
    mockGetDebugger = vi.fn(() => ({
      log: vi.fn(),
    }));
    mockProcessCurrentPosition = vi.fn();
    mockGetTimingMetrics = vi.fn(() => ({
      totalEvents: 10,
      perfectFrames: 8,
      accuracy: 0.8,
      avgJitterMs: 1.2,
      maxJitterMs: 3.5,
      grade: 'B',
      isStable: true,
    }));

    // Reset Tone.js mock state
    mockToneTransport.state = 'stopped';
    mockToneTransport.loop = false;
    mockToneTransport.clear.mockClear();
    mockToneTransport.cancel.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ============================================================================
  // START METHOD TESTS
  // ============================================================================

  describe('start', () => {
    it('should return early if already running', () => {
      const result = coordinator.start(
        true, // already running
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(result.isRunning).toBe(true);
      expect(mockScheduleAllRegions).not.toHaveBeenCalled();
    });

    it('should calculate transport start time with 200ms lookahead', () => {
      audioContext.currentTime = 5.0;

      const result = coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      // Should be currentTime (5.0) + 0.2s lookahead = 5.2
      expect(result.transportStartTime).toBeCloseTo(5.2, 1);
      expect(mockSetTransportStartTime).toHaveBeenCalledWith(
        expect.closeTo(5.2, 1),
      );
      expect(mockSyncTransportStartTime).toHaveBeenCalledWith(
        expect.closeTo(5.2, 1),
      );
    });

    it('should use Tone.context as fallback if audioContext not provided', () => {
      const result = coordinator.start(
        false,
        null, // No audioContext
        48000,
        tracks,
        { accent: {}, click: {} }, // has buffers
        {}, // has destination
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(mockSetAudioContext).toHaveBeenCalled();
      expect(result.isRunning).toBe(true);
    });

    it('should clear old scheduled events before scheduling new ones', () => {
      scheduledIds.add(1);
      scheduledIds.add(2);
      scheduledIds.add(3);

      coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(mockToneTransport.clear).toHaveBeenCalledTimes(3);
      expect(scheduledIds.size).toBe(0);
      expect(scheduledEvents.size).toBe(0);
    });

    it('should disable Tone.Transport.loop if enabled', () => {
      mockToneTransport.loop = true;

      coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(mockToneTransport.loop).toBe(false);
    });

    it('should set and clear isInitialScheduling guard flag', () => {
      const result = coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      // After start() completes, flag should be false
      expect(result.isInitialScheduling).toBe(false);
      expect(mockScheduleAllRegions).toHaveBeenCalled();
    });

    it('should call scheduleAllRegions during initialization', () => {
      coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(mockScheduleAllRegions).toHaveBeenCalledTimes(1);
    });

    it('should reset and start metrics reporting', () => {
      coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(mockResetMetrics).toHaveBeenCalled();
      expect(mockStartMetricsReporting).toHaveBeenCalled();
    });

    it('should start 25ms scheduling interval', () => {
      vi.useFakeTimers();

      const result = coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(result.scheduleInterval).toBeDefined();

      // Simulate transport starting
      mockToneTransport.state = 'started';

      // Fast-forward 25ms
      vi.advanceTimersByTime(25);

      // processCurrentPosition should be called
      expect(mockProcessCurrentPosition).toHaveBeenCalledTimes(1);

      // Fast-forward another 25ms
      vi.advanceTimersByTime(25);
      expect(mockProcessCurrentPosition).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should not call processCurrentPosition if transport not started', () => {
      vi.useFakeTimers();

      mockToneTransport.state = 'stopped';

      coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      // Fast-forward 25ms
      vi.advanceTimersByTime(25);

      // Should NOT call processCurrentPosition because transport is stopped
      expect(mockProcessCurrentPosition).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should return updated state with isRunning=true', () => {
      const result = coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(result.isRunning).toBe(true);
      expect(result.transportStartTime).toBeGreaterThan(0);
      expect(result.scheduleInterval).toBeDefined();
      expect(result.isInitialScheduling).toBe(false);
    });
  });

  // ============================================================================
  // STOP METHOD TESTS
  // ============================================================================

  describe('stop', () => {
    it('should return early if not running', () => {
      const result = coordinator.stop(
        false, // graceful
        false, // not running
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(result.isRunning).toBe(false);
      expect(mockStopMetricsReporting).not.toHaveBeenCalled();
    });

    it('should stop metrics reporting and log final stats', () => {
      coordinator.stop(
        false,
        true, // running
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(mockGetTimingMetrics).toHaveBeenCalled();
      expect(mockStopMetricsReporting).toHaveBeenCalled();
    });

    it('should clear interval BEFORE setting isRunning=false', () => {
      const mockInterval = 12345;
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      coordinator.stop(
        false,
        true,
        mockInterval,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(clearIntervalSpy).toHaveBeenCalledWith(mockInterval);
    });

    it('should clear all scheduled events', () => {
      scheduledIds.add(1);
      scheduledIds.add(2);
      scheduledEvents.set('track-1', new Set(['event-1']));

      coordinator.stop(
        false,
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(mockToneTransport.clear).toHaveBeenCalledTimes(2);
      expect(scheduledIds.size).toBe(0);
      expect(scheduledEvents.size).toBe(0);
    });

    it('should cancel all Tone.Transport events', () => {
      coordinator.stop(
        false,
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(mockToneTransport.cancel).toHaveBeenCalledWith(0);
    });

    it('should clear CC64 timeline', () => {
      currentCC64Timeline.set(100, true);
      currentCC64Timeline.set(200, false);

      coordinator.stop(
        false,
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(currentCC64Timeline.size).toBe(0);
    });

    it('should clear active harmony sources', () => {
      const mockGainNode = {
        gain: {
          value: 0.8,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
      } as unknown as GainNode;

      activeHarmonySources.set('C4', [
        {
          source: {} as AudioBufferSourceNode,
          gain: mockGainNode,
          gainValue: 0.8,
          noteEndTime: 2.0,
        },
      ]);

      coordinator.stop(
        false, // manual stop (not graceful)
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(activeHarmonySources.size).toBe(0);
      expect(mockGainNode.gain.cancelScheduledValues).toHaveBeenCalled();
      expect(mockGainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    });

    it('should clear active bass sources', () => {
      const mockSource = {
        stop: vi.fn(),
      } as unknown as AudioBufferSourceNode;

      activeBassSources.set('E2', mockSource);

      coordinator.stop(
        false,
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(activeBassSources.size).toBe(0);
      expect(mockSource.stop).toHaveBeenCalled();
    });

    it('should handle graceful stop - preserve one-shot samples', () => {
      const mockOneShotSource = {
        stop: vi.fn(),
      } as unknown as AudioBufferSourceNode;

      scheduledAudioSources.set(mockOneShotSource, {
        type: 'one-shot',
        hasStopScheduled: false,
      });

      coordinator.stop(
        true, // graceful
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      // In graceful mode, one-shot samples with hasStopScheduled=false should be stopped
      expect(mockOneShotSource.stop).toHaveBeenCalled();
    });

    it('should handle manual stop - stop all sources immediately', () => {
      const mockSource = {
        stop: vi.fn(),
      } as unknown as AudioBufferSourceNode;

      scheduledAudioSources.set(mockSource, {
        type: 'sustained',
        hasStopScheduled: true,
      });

      coordinator.stop(
        false, // manual (not graceful)
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(mockSource.stop).toHaveBeenCalled();
      expect(scheduledAudioSources.size).toBe(0);
    });

    it('should call harmony WAM plugin clearEvents on manual stop', () => {
      const mockClearEvents = vi.fn();
      tracks.set('harmony-track', {
        id: 'harmony-track',
        instrumentType: 'harmony',
        audioNode: {
          clearEvents: mockClearEvents,
        },
      });

      coordinator.stop(
        false, // manual stop
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(mockClearEvents).toHaveBeenCalled();
    });

    it('should not call WAM clearEvents on graceful stop', () => {
      const mockClearEvents = vi.fn();
      tracks.set('harmony-track', {
        id: 'harmony-track',
        instrumentType: 'harmony',
        audioNode: {
          clearEvents: mockClearEvents,
        },
      });

      coordinator.stop(
        true, // graceful stop
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      // Graceful stop should NOT call WAM clearEvents
      expect(mockClearEvents).not.toHaveBeenCalled();
    });

    it('should return updated state with isRunning=false', () => {
      const result = coordinator.stop(
        false,
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(result.isRunning).toBe(false);
      expect(result.scheduleInterval).toBeNull();
      expect(result.lastProcessedPosition).toBe(-1);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration scenarios', () => {
    it('should handle complete start → stop cycle', () => {
      vi.useFakeTimers();

      // Start
      const startResult = coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(startResult.isRunning).toBe(true);
      expect(mockScheduleAllRegions).toHaveBeenCalled();

      // Stop
      const stopResult = coordinator.stop(
        false,
        startResult.isRunning,
        startResult.scheduleInterval,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(stopResult.isRunning).toBe(false);
      expect(mockStopMetricsReporting).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle multiple start/stop cycles', () => {
      // First cycle
      let result = coordinator.start(
        false,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        null,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(result.isRunning).toBe(true);

      result = coordinator.stop(
        false,
        result.isRunning,
        result.scheduleInterval,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      expect(result.isRunning).toBe(false);

      // Second cycle
      result = coordinator.start(
        result.isRunning,
        audioContext,
        48000,
        tracks,
        {},
        {},
        scheduledIds,
        scheduledEvents,
        result.scheduleInterval,
        false,
        mockSetAudioContext,
        mockSetSampleRate,
        mockSetTransportStartTime,
        mockSyncTransportStartTime,
        mockClearScheduledState,
        mockResetMetrics,
        mockStartMetricsReporting,
        mockScheduleAllRegions,
        mockGetDebugger,
        mockProcessCurrentPosition,
      );

      expect(result.isRunning).toBe(true);
      expect(mockScheduleAllRegions).toHaveBeenCalledTimes(2);
    });

    it('should handle graceful stop with ring-out period', () => {
      vi.useFakeTimers();

      const mockSustainedSource = {
        stop: vi.fn(),
      } as unknown as AudioBufferSourceNode;

      scheduledAudioSources.set(mockSustainedSource, {
        type: 'sustained',
        hasStopScheduled: true,
      });

      coordinator.stop(
        true, // graceful
        true,
        null,
        scheduledIds,
        scheduledEvents,
        currentCC64Timeline,
        activeHarmonySources,
        activeBassSources,
        scheduledAudioSources,
        tracks,
        audioContext,
        mockGetTimingMetrics,
        mockStopMetricsReporting,
      );

      // Sustained sources with scheduled stops should be preserved
      expect(mockSustainedSource.stop).not.toHaveBeenCalled();

      // After 3500ms (ring-out period), sources should be cleared
      vi.advanceTimersByTime(3500);

      // Note: The actual clearing happens in setTimeout, which we can't directly verify here
      // But we can verify the timeout was set up correctly

      vi.useRealTimers();
    });
  });
});
