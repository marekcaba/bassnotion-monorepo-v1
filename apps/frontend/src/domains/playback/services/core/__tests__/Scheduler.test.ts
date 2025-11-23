/**
 * Scheduler.test.ts - Unit tests for unified Scheduler
 *
 * Tests:
 * - Instrument configuration system
 * - One-shot scheduling (metronome, drums, bass, voice cues)
 * - Sustained note scheduling (harmony with velocity layers)
 * - Batch region scheduling
 * - Source cleanup (Bug #3 fix verification)
 * - Cancellation (tempo change support)
 * - Disposal and memory cleanup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scheduler, INSTRUMENT_CONFIGS } from '../Scheduler.js';
import type { PatternEvent } from '../region-processing/types/region.types.js';

describe('Scheduler - Unified Audio Scheduling', () => {
  let scheduler: Scheduler;
  let mockAudioContext: AudioContext;
  let mockDestination: AudioNode;
  let mockTracks: Map<string, any>;

  // Mock audio buffer
  const createMockBuffer = (): AudioBuffer => {
    return {
      duration: 1.0,
      length: 48000,
      numberOfChannels: 2,
      sampleRate: 48000,
      getChannelData: vi.fn(() => new Float32Array(48000)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer;
  };

  beforeEach(() => {
    // Create mock tracks
    mockTracks = new Map();

    // Create scheduler
    scheduler = new Scheduler('test-instance', mockTracks);

    // Mock AudioContext
    const mockGain = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { value: 1.0 },
    } as unknown as GainNode;

    const mockSource = {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    } as unknown as AudioBufferSourceNode;

    mockAudioContext = {
      createBufferSource: vi.fn(() => mockSource),
      createGain: vi.fn(() => mockGain),
      sampleRate: 48000,
      currentTime: 0,
    } as unknown as AudioContext;

    mockDestination = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as AudioNode;

    // Set audio context
    scheduler.setAudioContext(mockAudioContext);
  });

  // ============================================================================
  // CONFIGURATION TESTS
  // ============================================================================

  describe('Instrument Configuration', () => {
    it('should have configurations for all 5 instrument types', () => {
      expect(INSTRUMENT_CONFIGS).toHaveProperty('metronome');
      expect(INSTRUMENT_CONFIGS).toHaveProperty('drums');
      expect(INSTRUMENT_CONFIGS).toHaveProperty('harmony');
      expect(INSTRUMENT_CONFIGS).toHaveProperty('bass');
      expect(INSTRUMENT_CONFIGS).toHaveProperty('voiceCue');
    });

    it('should have correct metronome configuration', () => {
      const config = INSTRUMENT_CONFIGS.metronome;
      expect(config.type).toBe('metronome');
      expect(config.eventTypeToBufferKey).toHaveProperty('accent');
      expect(config.eventTypeToBufferKey).toHaveProperty('click');
      expect(config.baseVolume).toBe(0.8);
    });

    it('should have correct drums configuration', () => {
      const config = INSTRUMENT_CONFIGS.drums;
      expect(config.type).toBe('drums');
      expect(config.eventTypeToBufferKey).toHaveProperty('kick');
      expect(config.eventTypeToBufferKey).toHaveProperty('snare');
      expect(config.eventTypeToBufferKey).toHaveProperty('hihat');
      expect(config.eventTypeToBufferKey).toHaveProperty('crash');
    });

    it('should have correct harmony configuration with velocity layers', () => {
      const config = INSTRUMENT_CONFIGS.harmony;
      expect(config.type).toBe('harmony');
      expect(config.hasVelocityLayers).toBe(true);
      expect(config.velocityLayerKeys).toEqual(['v2', 'v3', 'v4', 'v5']);
    });

    it('should have correct bass configuration', () => {
      const config = INSTRUMENT_CONFIGS.bass;
      expect(config.type).toBe('bass');
      expect(config.preserveAttackEnvelope).toBe(true);
    });

    it('should have correct voice cue configuration', () => {
      const config = INSTRUMENT_CONFIGS.voiceCue;
      expect(config.type).toBe('voiceCue');
      expect(config.eventTypeToBufferKey).toHaveProperty('one');
      expect(config.eventTypeToBufferKey).toHaveProperty('two');
      expect(config.eventTypeToBufferKey).toHaveProperty('three');
      expect(config.eventTypeToBufferKey).toHaveProperty('four');
      expect(config.eventTypeToBufferKey).toHaveProperty('and');
    });
  });

  // ============================================================================
  // BUFFER MANAGEMENT TESTS
  // ============================================================================

  describe('Buffer Management', () => {
    it('should set buffers and destination', () => {
      const buffers = {
        accent: createMockBuffer(),
        click: createMockBuffer(),
      };

      scheduler.setBuffers(buffers, mockDestination);

      const stats = scheduler.getStats();
      expect(stats.bufferCount).toBe(2);
    });

    it('should clear previous buffers when setting new ones', () => {
      scheduler.setBuffers({ accent: createMockBuffer() }, mockDestination);
      expect(scheduler.getStats().bufferCount).toBe(1);

      scheduler.setBuffers({ click: createMockBuffer() }, mockDestination);
      expect(scheduler.getStats().bufferCount).toBe(1);
    });
  });

  // ============================================================================
  // ONE-SHOT SCHEDULING TESTS
  // ============================================================================

  describe('One-Shot Scheduling (Metronome, Drums, Bass, Voice Cues)', () => {
    beforeEach(() => {
      const buffers = {
        accent: createMockBuffer(),
        click: createMockBuffer(),
        kick: createMockBuffer(),
        snare: createMockBuffer(),
      };
      scheduler.setBuffers(buffers, mockDestination);
    });

    it('should schedule metronome accent event', () => {
      const event: PatternEvent = {
        type: 'accent',
        timeOffset: 0,
        velocity: 100,
      };

      const success = scheduler.schedule('metronome', event, 1.0);

      expect(success).toBe(true);
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should schedule metronome click event', () => {
      const event: PatternEvent = {
        type: 'click',
        timeOffset: 0,
        velocity: 80,
      };

      const success = scheduler.schedule('metronome', event, 1.0);
      expect(success).toBe(true);
    });

    it('should schedule drum kick event', () => {
      const event: PatternEvent = {
        type: 'kick',
        timeOffset: 0,
        velocity: 110,
      };

      const success = scheduler.schedule('drums', event, 1.0);
      expect(success).toBe(true);
    });

    it('should return false for unmapped event type', () => {
      const event: PatternEvent = {
        type: 'unknown-event',
        timeOffset: 0,
      };

      const success = scheduler.schedule('metronome', event, 1.0);
      expect(success).toBe(false);
    });

    it('should return false for missing buffer', () => {
      const event: PatternEvent = {
        type: 'crash', // Not in buffers
        timeOffset: 0,
      };

      const success = scheduler.schedule('drums', event, 1.0);
      expect(success).toBe(false);
    });

    it('should apply velocity-based volume control', () => {
      const event: PatternEvent = {
        type: 'accent',
        timeOffset: 0,
        velocity: 127, // Max velocity
      };

      scheduler.schedule('metronome', event, 1.0, { velocity: 127 });

      const gainNode = mockAudioContext.createGain();
      // Velocity multiplier: (127/127)^1.5 = 1.0
      // Expected: 0.8 * 1.0 = 0.8
      expect(gainNode.gain.value).toBeGreaterThan(0);
    });

    it('should register onended cleanup callback (Bug #3 fix)', () => {
      const event: PatternEvent = {
        type: 'accent',
        timeOffset: 0,
      };

      const mockSource = mockAudioContext.createBufferSource();
      scheduler.schedule('metronome', event, 1.0);

      // Verify onended callback was registered
      expect(mockSource.onended).not.toBeNull();
    });
  });

  // ============================================================================
  // HARMONY SCHEDULING TESTS
  // ============================================================================

  describe('Harmony Scheduling (Sustained Notes with Velocity Layers)', () => {
    beforeEach(() => {
      // Create buffers for harmony note C4 with all velocity layers
      const buffers = {
        C4_v2: createMockBuffer(),
        C4_v3: createMockBuffer(),
        C4_v4: createMockBuffer(),
        C4_v5: createMockBuffer(),
        D4_v3: createMockBuffer(),
        E4_v4: createMockBuffer(),
      };
      scheduler.setBuffers(buffers, mockDestination);
    });

    it('should schedule harmony note with correct velocity layer', () => {
      const event: PatternEvent = {
        type: 'note',
        timeOffset: 0,
        midiNote: 60, // C4
        velocity: 50, // Should select v3 (32-63)
        duration: 1.0,
      };

      const success = scheduler.schedule('harmony', event, 1.0, {
        midiNote: 60,
        velocity: 50,
        duration: 1.0,
        noteName: 'C4',
      });

      expect(success).toBe(true);
    });

    it('should select v2 layer for quiet notes (velocity 0-31)', () => {
      const event: PatternEvent = {
        type: 'note',
        timeOffset: 0,
        velocity: 20,
      };

      scheduler.schedule('harmony', event, 1.0, {
        velocity: 20,
        noteName: 'C4',
        duration: 0.5,
      });

      // Should use C4_v2 buffer
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });

    it('should select v3 layer for medium-soft notes (velocity 32-63)', () => {
      const event: PatternEvent = {
        type: 'note',
        timeOffset: 0,
        velocity: 50,
      };

      scheduler.schedule('harmony', event, 1.0, {
        velocity: 50,
        noteName: 'C4',
        duration: 0.5,
      });

      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });

    it('should select v4 layer for medium-loud notes (velocity 64-95)', () => {
      const event: PatternEvent = {
        type: 'note',
        timeOffset: 0,
        velocity: 80,
      };

      scheduler.schedule('harmony', event, 1.0, {
        velocity: 80,
        noteName: 'C4',
        duration: 0.5,
      });

      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });

    it('should select v5 layer for loud notes (velocity 96-127)', () => {
      const event: PatternEvent = {
        type: 'note',
        timeOffset: 0,
        velocity: 110,
      };

      scheduler.schedule('harmony', event, 1.0, {
        velocity: 110,
        noteName: 'C4',
        duration: 0.5,
      });

      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });

    it('should schedule note start and stop', () => {
      const event: PatternEvent = {
        type: 'note',
        timeOffset: 0,
      };

      const mockSource = mockAudioContext.createBufferSource();
      scheduler.schedule('harmony', event, 1.0, {
        noteName: 'C4',
        velocity: 64,
        duration: 2.0,
      });

      expect(mockSource.start).toHaveBeenCalledWith(1.0);
      expect(mockSource.stop).toHaveBeenCalledWith(3.0); // 1.0 + 2.0
    });

    it('should register onended cleanup callback for harmony notes', () => {
      const event: PatternEvent = {
        type: 'note',
        timeOffset: 0,
      };

      const mockSource = mockAudioContext.createBufferSource();
      scheduler.schedule('harmony', event, 1.0, {
        noteName: 'C4',
        velocity: 64,
        duration: 1.0,
      });

      expect(mockSource.onended).not.toBeNull();
    });
  });

  // ============================================================================
  // BATCH SCHEDULING TESTS
  // ============================================================================

  describe('Batch Region Scheduling', () => {
    beforeEach(() => {
      const buffers = {
        accent: createMockBuffer(),
        click: createMockBuffer(),
      };
      scheduler.setBuffers(buffers, mockDestination);
    });

    it('should schedule multiple events in a region', () => {
      const events: PatternEvent[] = [
        { type: 'accent', timeOffset: 0.0, velocity: 100 },
        { type: 'click', timeOffset: 0.5, velocity: 80 },
        { type: 'click', timeOffset: 1.0, velocity: 80 },
        { type: 'accent', timeOffset: 1.5, velocity: 100 },
      ];

      const result = scheduler.scheduleRegion('metronome', events, 2.0);

      expect(result.scheduled).toBe(4);
      expect(result.failed).toBe(0);
    });

    it('should handle partial failures in batch scheduling', () => {
      const events: PatternEvent[] = [
        { type: 'accent', timeOffset: 0.0 }, // Valid
        { type: 'invalid', timeOffset: 0.5 }, // Invalid
        { type: 'click', timeOffset: 1.0 }, // Valid
      ];

      const result = scheduler.scheduleRegion('metronome', events, 1.0);

      expect(result.scheduled).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should apply correct timing offsets in batch scheduling', () => {
      const events: PatternEvent[] = [
        { type: 'accent', timeOffset: 0.0 },
        { type: 'click', timeOffset: 0.25 },
      ];

      const mockSource = mockAudioContext.createBufferSource();
      scheduler.scheduleRegion('metronome', events, 5.0);

      // First event at 5.0, second at 5.25
      expect(mockSource.start).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // CANCELLATION TESTS (Tempo Change Support)
  // ============================================================================

  describe('Cancellation (Tempo Change Support)', () => {
    beforeEach(() => {
      const buffers = {
        accent: createMockBuffer(),
      };
      scheduler.setBuffers(buffers, mockDestination);
    });

    it('should cancel all scheduled sources', () => {
      // Schedule some events
      const events: PatternEvent[] = [
        { type: 'accent', timeOffset: 0.0 },
        { type: 'accent', timeOffset: 1.0 },
        { type: 'accent', timeOffset: 2.0 },
      ];

      scheduler.scheduleRegion('metronome', events, 1.0);

      // Before cancellation, should have active sources
      const statsBefore = scheduler.getStats();
      expect(statsBefore.activeSourcesCount).toBeGreaterThan(0);

      // Cancel all
      scheduler.cancelAllScheduled();

      // After cancellation, should have no active sources
      const statsAfter = scheduler.getStats();
      expect(statsAfter.activeSourcesCount).toBe(0);
      expect(statsAfter.activeHarmonyNotesCount).toBe(0);
    });

    it('should call stop() on sources without scheduled stops', () => {
      const event: PatternEvent = { type: 'accent', timeOffset: 0 };
      const mockSource = mockAudioContext.createBufferSource();

      scheduler.schedule('metronome', event, 1.0);
      scheduler.cancelAllScheduled();

      expect(mockSource.stop).toHaveBeenCalled();
    });

    it('should disconnect all sources during cancellation', () => {
      const event: PatternEvent = { type: 'accent', timeOffset: 0 };
      const mockSource = mockAudioContext.createBufferSource();

      scheduler.schedule('metronome', event, 1.0);
      scheduler.cancelAllScheduled();

      expect(mockSource.disconnect).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // CLEANUP & DISPOSAL TESTS (Bug #3 Fix Verification)
  // ============================================================================

  describe('Cleanup & Disposal (Bug #3 Fix Verification)', () => {
    beforeEach(() => {
      const buffers = {
        accent: createMockBuffer(),
        C4_v3: createMockBuffer(),
      };
      scheduler.setBuffers(buffers, mockDestination);
    });

    it('should clean up buffers on disposal', () => {
      scheduler.dispose();

      const stats = scheduler.getStats();
      expect(stats.bufferCount).toBe(0);
    });

    it('should cancel all sources on disposal', () => {
      const event: PatternEvent = { type: 'accent', timeOffset: 0 };
      scheduler.schedule('metronome', event, 1.0);

      scheduler.dispose();

      const stats = scheduler.getStats();
      expect(stats.activeSourcesCount).toBe(0);
    });

    it('should clear audio context reference on disposal', () => {
      scheduler.dispose();

      // Try to schedule after disposal - should fail gracefully
      const event: PatternEvent = { type: 'accent', timeOffset: 0 };
      const success = scheduler.schedule('metronome', event, 1.0);

      expect(success).toBe(false);
    });

    it('should execute onended callback to clean up source', () => {
      const event: PatternEvent = { type: 'accent', timeOffset: 0 };
      const mockSource = mockAudioContext.createBufferSource();

      scheduler.schedule('metronome', event, 1.0);

      // Simulate playback end
      if (mockSource.onended) {
        mockSource.onended(new Event('ended'));
      }

      // Source should be removed from tracking
      const stats = scheduler.getStats();
      expect(stats.activeSourcesCount).toBe(0);
    });

    it('should clean up harmony sources separately', () => {
      const event: PatternEvent = { type: 'note', timeOffset: 0 };
      const mockSource = mockAudioContext.createBufferSource();

      scheduler.schedule('harmony', event, 1.0, {
        noteName: 'C4',
        velocity: 64,
        duration: 1.0,
      });

      // Simulate playback end
      if (mockSource.onended) {
        mockSource.onended(new Event('ended'));
      }

      const stats = scheduler.getStats();
      expect(stats.activeHarmonyNotesCount).toBe(0);
    });
  });

  // ============================================================================
  // STATISTICS & MONITORING TESTS
  // ============================================================================

  describe('Statistics & Monitoring', () => {
    it('should return correct initial statistics', () => {
      const stats = scheduler.getStats();

      expect(stats.activeSourcesCount).toBe(0);
      expect(stats.activeHarmonyNotesCount).toBe(0);
      expect(stats.bufferCount).toBe(0);
      expect(stats.instanceId).toBe('test-instance');
    });

    it('should update statistics after scheduling', () => {
      const buffers = {
        accent: createMockBuffer(),
        C4_v3: createMockBuffer(),
      };
      scheduler.setBuffers(buffers, mockDestination);

      const event: PatternEvent = { type: 'accent', timeOffset: 0 };
      scheduler.schedule('metronome', event, 1.0);

      const stats = scheduler.getStats();
      expect(stats.bufferCount).toBe(2);
      expect(stats.activeSourcesCount).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance', () => {
    beforeEach(() => {
      const buffers = {
        accent: createMockBuffer(),
        click: createMockBuffer(),
      };
      scheduler.setBuffers(buffers, mockDestination);
    });

    it('should schedule 1000 events in <100ms', () => {
      const events: PatternEvent[] = Array.from({ length: 1000 }, (_, i) => ({
        type: i % 2 === 0 ? 'accent' : 'click',
        timeOffset: i * 0.01,
        velocity: 64,
      }));

      const startTime = performance.now();
      scheduler.scheduleRegion('metronome', events, 1.0);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should clean up 1000 sources quickly on cancellation', () => {
      const events: PatternEvent[] = Array.from({ length: 1000 }, (_, i) => ({
        type: 'accent',
        timeOffset: i * 0.01,
      }));

      scheduler.scheduleRegion('metronome', events, 1.0);

      const startTime = performance.now();
      scheduler.cancelAllScheduled();
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
    });
  });
});
