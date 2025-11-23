/**
 * BufferCoordinator Tests
 *
 * Tests buffer management and scheduler synchronization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BufferCoordinator } from '../BufferCoordinator.js';

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('BufferCoordinator', () => {
  let coordinator: BufferCoordinator;
  let mockAudioContext: AudioContext;
  let mockBufferRegistry: any;
  let mockSchedulers: any;
  let mockEventRouter: any;
  let mockEventBus: any;
  let mockHarmonyScheduler: any;
  let mockTimingMetricsCollector: any;
  let mockCC64TimelineBuilder: any;
  let mockVelocityLayerSelector: any;
  let mockTrackTimingAccuracy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    coordinator = new BufferCoordinator('test-instance');

    mockAudioContext = {
      sampleRate: 48000,
    } as unknown as AudioContext;

    mockBufferRegistry = {
      setMetronomeBuffers: vi.fn(),
      setDrumBuffers: vi.fn(),
      setVoiceCueBuffers: vi.fn(),
      setHarmonyBuffers: vi.fn(() => Promise.resolve()),
      setBassBuffers: vi.fn(),
      ensureGrandPianoKeyboardMap: vi.fn(() => Promise.resolve()),
      getAudioDestination: vi.fn(() => ({} as AudioNode)),
      getHarmonyBuffers: vi.fn(() => new Map()),
      getHarmonyVelocityRanges: vi.fn(() => ({})),
      getCurrentHarmonyInstrument: vi.fn(() => 'wurlitzer'),
      getGrandPianoKeyboardMap: vi.fn(() => null),
      getBassBuffers: vi.fn(() => new Map()),
    };

    mockSchedulers = {
      voiceCue: {
        setAudioContext: vi.fn(),
        setBuffers: vi.fn(),
      },
      metronome: {
        setAudioContext: vi.fn(),
        setBuffers: vi.fn(),
      },
      drum: {
        setAudioContext: vi.fn(),
        setBuffers: vi.fn(),
      },
      bass: {
        setAudioContext: vi.fn(),
        setBuffers: vi.fn(),
      },
    };

    mockHarmonyScheduler = {
      setAudioContext: vi.fn(),
      setBuffers: vi.fn(() => Promise.resolve()),
    };

    mockEventRouter = {
      initialize: vi.fn(),
    };

    mockEventBus = {};

    mockTimingMetricsCollector = {
      setSampleRate: vi.fn(),
    };

    mockCC64TimelineBuilder = {
      setAudioContext: vi.fn(),
    };

    mockVelocityLayerSelector = {
      setInstrument: vi.fn(),
      setVelocityRanges: vi.fn(),
      setHarmonyBuffers: vi.fn(),
    };

    mockTrackTimingAccuracy = vi.fn();
  });

  // ============================================================================
  // SET AUDIO CONTEXT TESTS
  // ============================================================================

  describe('setAudioContext', () => {
    it('should sync sample rate to timing metrics collector', () => {
      coordinator.setAudioContext(
        mockAudioContext,
        mockBufferRegistry,
        mockSchedulers,
        mockEventRouter,
        mockEventBus,
        mockHarmonyScheduler,
        mockTrackTimingAccuracy,
        mockTimingMetricsCollector,
        mockCC64TimelineBuilder,
      );

      expect(mockTimingMetricsCollector.setSampleRate).toHaveBeenCalledWith(48000);
    });

    it('should sync audio context to CC64 timeline builder', () => {
      coordinator.setAudioContext(
        mockAudioContext,
        mockBufferRegistry,
        mockSchedulers,
        mockEventRouter,
        mockEventBus,
        mockHarmonyScheduler,
        mockTrackTimingAccuracy,
        mockTimingMetricsCollector,
        mockCC64TimelineBuilder,
      );

      expect(mockCC64TimelineBuilder.setAudioContext).toHaveBeenCalledWith(mockAudioContext);
    });

    it('should sync audio context to all schedulers', () => {
      coordinator.setAudioContext(
        mockAudioContext,
        mockBufferRegistry,
        mockSchedulers,
        mockEventRouter,
        mockEventBus,
        mockHarmonyScheduler,
        mockTrackTimingAccuracy,
        mockTimingMetricsCollector,
        mockCC64TimelineBuilder,
      );

      expect(mockSchedulers.voiceCue.setAudioContext).toHaveBeenCalledWith(mockAudioContext);
      expect(mockSchedulers.metronome.setAudioContext).toHaveBeenCalledWith(mockAudioContext);
      expect(mockSchedulers.drum.setAudioContext).toHaveBeenCalledWith(mockAudioContext);
      expect(mockSchedulers.bass.setAudioContext).toHaveBeenCalledWith(mockAudioContext);
    });

    it('should initialize event router with all dependencies', () => {
      coordinator.setAudioContext(
        mockAudioContext,
        mockBufferRegistry,
        mockSchedulers,
        mockEventRouter,
        mockEventBus,
        mockHarmonyScheduler,
        mockTrackTimingAccuracy,
        mockTimingMetricsCollector,
        mockCC64TimelineBuilder,
      );

      expect(mockEventRouter.initialize).toHaveBeenCalledWith(
        mockAudioContext,
        48000,
        mockEventBus,
        mockSchedulers.metronome,
        mockSchedulers.drum,
        mockHarmonyScheduler,
        mockSchedulers.bass,
        mockSchedulers.voiceCue,
        mockTrackTimingAccuracy,
      );
    });

    it('should return sample rate', () => {
      const sampleRate = coordinator.setAudioContext(
        mockAudioContext,
        mockBufferRegistry,
        mockSchedulers,
        mockEventRouter,
        mockEventBus,
        mockHarmonyScheduler,
        mockTrackTimingAccuracy,
        mockTimingMetricsCollector,
        mockCC64TimelineBuilder,
      );

      expect(sampleRate).toBe(48000);
    });
  });

  // ============================================================================
  // METRONOME BUFFERS TESTS
  // ============================================================================

  describe('setMetronomeBuffers', () => {
    it('should sync buffers to registry and scheduler', () => {
      const accent = {} as AudioBuffer;
      const click = {} as AudioBuffer;
      const destination = {} as AudioNode;

      coordinator.setMetronomeBuffers(
        accent,
        click,
        destination,
        mockBufferRegistry,
        mockSchedulers.metronome,
      );

      expect(mockBufferRegistry.setMetronomeBuffers).toHaveBeenCalledWith(
        accent,
        click,
        destination,
      );
      expect(mockSchedulers.metronome.setBuffers).toHaveBeenCalledWith(
        accent,
        click,
        destination,
      );
    });
  });

  // ============================================================================
  // DRUM BUFFERS TESTS
  // ============================================================================

  describe('setDrumBuffers', () => {
    it('should sync buffers to registry and scheduler', () => {
      const kick = {} as AudioBuffer;
      const snare = {} as AudioBuffer;
      const hihat = {} as AudioBuffer;
      const destination = {} as AudioNode;

      coordinator.setDrumBuffers(
        kick,
        snare,
        hihat,
        destination,
        mockBufferRegistry,
        mockSchedulers.drum,
      );

      expect(mockBufferRegistry.setDrumBuffers).toHaveBeenCalledWith(
        kick,
        snare,
        hihat,
        destination,
      );
      expect(mockSchedulers.drum.setBuffers).toHaveBeenCalledWith(
        kick,
        snare,
        hihat,
        destination,
      );
    });
  });

  // ============================================================================
  // VOICE CUE BUFFERS TESTS
  // ============================================================================

  describe('setVoiceCueBuffers', () => {
    it('should sync buffers to registry and scheduler', () => {
      const samples = new Map<string, AudioBuffer>();
      const destination = {} as AudioNode;

      coordinator.setVoiceCueBuffers(
        samples,
        destination,
        mockBufferRegistry,
        mockSchedulers.voiceCue,
      );

      expect(mockBufferRegistry.setVoiceCueBuffers).toHaveBeenCalledWith(
        samples,
        destination,
      );
      expect(mockSchedulers.voiceCue.setBuffers).toHaveBeenCalledWith(
        samples,
        destination,
      );
    });
  });

  // ============================================================================
  // HARMONY BUFFERS TESTS
  // ============================================================================

  describe('setHarmonyBuffers', () => {
    it('should sync buffers to registry and scheduler', async () => {
      const samples = new Map<string, AudioBuffer>();
      const destination = {} as AudioNode;
      const velocityRanges = { C4: [{ min: 0, max: 127 }] };

      await coordinator.setHarmonyBuffers(
        samples,
        destination,
        velocityRanges,
        'wurlitzer',
        mockBufferRegistry,
        mockHarmonyScheduler,
        mockVelocityLayerSelector,
      );

      expect(mockBufferRegistry.setHarmonyBuffers).toHaveBeenCalledWith(
        samples,
        destination,
        velocityRanges,
        'wurlitzer',
      );
      expect(mockHarmonyScheduler.setBuffers).toHaveBeenCalledWith(
        samples,
        destination,
        velocityRanges,
        'wurlitzer',
      );
    });

    it('should sync to velocity layer selector', async () => {
      const samples = new Map<string, AudioBuffer>();
      const destination = {} as AudioNode;
      const velocityRanges = { C4: [{ min: 0, max: 127 }] };
      const harmonyBuffers = new Map();

      mockBufferRegistry.getHarmonyBuffers.mockReturnValue(harmonyBuffers);

      await coordinator.setHarmonyBuffers(
        samples,
        destination,
        velocityRanges,
        'rhodes',
        mockBufferRegistry,
        mockHarmonyScheduler,
        mockVelocityLayerSelector,
      );

      expect(mockVelocityLayerSelector.setInstrument).toHaveBeenCalledWith('rhodes');
      expect(mockVelocityLayerSelector.setVelocityRanges).toHaveBeenCalledWith(velocityRanges);
      expect(mockVelocityLayerSelector.setHarmonyBuffers).toHaveBeenCalledWith(harmonyBuffers);
    });

    it('should use current instrument if not provided', async () => {
      const samples = new Map<string, AudioBuffer>();
      const destination = {} as AudioNode;

      mockBufferRegistry.getCurrentHarmonyInstrument.mockReturnValue('grandpiano');

      await coordinator.setHarmonyBuffers(
        samples,
        destination,
        undefined,
        undefined,
        mockBufferRegistry,
        mockHarmonyScheduler,
        mockVelocityLayerSelector,
      );

      expect(mockVelocityLayerSelector.setInstrument).toHaveBeenCalledWith('grandpiano');
    });

    it('should default to wurlitzer if no instrument set', async () => {
      const samples = new Map<string, AudioBuffer>();
      const destination = {} as AudioNode;

      mockBufferRegistry.getCurrentHarmonyInstrument.mockReturnValue(null);

      await coordinator.setHarmonyBuffers(
        samples,
        destination,
        undefined,
        undefined,
        mockBufferRegistry,
        mockHarmonyScheduler,
        mockVelocityLayerSelector,
      );

      expect(mockVelocityLayerSelector.setInstrument).toHaveBeenCalledWith('wurlitzer');
    });

    it('should return harmony state for backward compatibility', async () => {
      const samples = new Map<string, AudioBuffer>();
      const destination = {} as AudioNode;
      const harmonyBuffers = new Map();
      const velocityRanges = { C4: [{ min: 0, max: 127 }] };
      const keyboardMap = { C4: 'sample-1' };

      mockBufferRegistry.getHarmonyBuffers.mockReturnValue(harmonyBuffers);
      mockBufferRegistry.getHarmonyVelocityRanges.mockReturnValue(velocityRanges);
      mockBufferRegistry.getCurrentHarmonyInstrument.mockReturnValue('rhodes');
      mockBufferRegistry.getGrandPianoKeyboardMap.mockReturnValue(keyboardMap);

      const result = await coordinator.setHarmonyBuffers(
        samples,
        destination,
        undefined,
        undefined,
        mockBufferRegistry,
        mockHarmonyScheduler,
        mockVelocityLayerSelector,
      );

      expect(result).toEqual({
        harmonyBuffers,
        harmonyVelocityRanges: velocityRanges,
        currentHarmonyInstrument: 'rhodes',
        grandPianoKeyboardMap: keyboardMap,
      });
    });
  });

  // ============================================================================
  // BASS BUFFERS TESTS
  // ============================================================================

  describe('setBassBuffers', () => {
    it('should sync buffers to registry and scheduler', () => {
      const samples = new Map<string, AudioBuffer>();
      const destination = {} as AudioNode;
      const bassBuffers = new Map();

      mockBufferRegistry.getBassBuffers.mockReturnValue(bassBuffers);

      const result = coordinator.setBassBuffers(
        samples,
        destination,
        mockBufferRegistry,
        mockSchedulers.bass,
      );

      expect(mockBufferRegistry.setBassBuffers).toHaveBeenCalledWith(
        samples,
        destination,
      );
      expect(mockSchedulers.bass.setBuffers).toHaveBeenCalledWith(
        samples,
        destination,
      );
      expect(result.bassBuffers).toBe(bassBuffers);
    });
  });

  // ============================================================================
  // GRAND PIANO KEYBOARD MAP TESTS
  // ============================================================================

  describe('loadGrandPianoKeyboardMap', () => {
    it('should ensure keyboard map is loaded', async () => {
      await coordinator.loadGrandPianoKeyboardMap(mockBufferRegistry);

      expect(mockBufferRegistry.ensureGrandPianoKeyboardMap).toHaveBeenCalled();
    });

    it('should return keyboard map', async () => {
      const keyboardMap = { C4: 'sample-1' };
      mockBufferRegistry.getGrandPianoKeyboardMap.mockReturnValue(keyboardMap);

      const result = await coordinator.loadGrandPianoKeyboardMap(mockBufferRegistry);

      expect(result).toBe(keyboardMap);
    });

    it('should return null if no keyboard map', async () => {
      mockBufferRegistry.getGrandPianoKeyboardMap.mockReturnValue(null);

      const result = await coordinator.loadGrandPianoKeyboardMap(mockBufferRegistry);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration scenarios', () => {
    it('should handle complete buffer setup workflow', async () => {
      // 1. Set AudioContext
      coordinator.setAudioContext(
        mockAudioContext,
        mockBufferRegistry,
        mockSchedulers,
        mockEventRouter,
        mockEventBus,
        mockHarmonyScheduler,
        mockTrackTimingAccuracy,
        mockTimingMetricsCollector,
        mockCC64TimelineBuilder,
      );

      // 2. Set metronome buffers
      coordinator.setMetronomeBuffers(
        {} as AudioBuffer,
        {} as AudioBuffer,
        {} as AudioNode,
        mockBufferRegistry,
        mockSchedulers.metronome,
      );

      // 3. Set harmony buffers
      await coordinator.setHarmonyBuffers(
        new Map(),
        {} as AudioNode,
        { C4: [{ min: 0, max: 127 }] },
        'rhodes',
        mockBufferRegistry,
        mockHarmonyScheduler,
        mockVelocityLayerSelector,
      );

      // Verify all coordination happened
      expect(mockTimingMetricsCollector.setSampleRate).toHaveBeenCalled();
      expect(mockEventRouter.initialize).toHaveBeenCalled();
      expect(mockBufferRegistry.setMetronomeBuffers).toHaveBeenCalled();
      expect(mockBufferRegistry.setHarmonyBuffers).toHaveBeenCalled();
      expect(mockVelocityLayerSelector.setInstrument).toHaveBeenCalledWith('rhodes');
    });
  });
});
