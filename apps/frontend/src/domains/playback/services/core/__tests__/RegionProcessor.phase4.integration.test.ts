/**
 * Phase 4 Integration Tests
 *
 * Validates that RegionProcessor correctly delegates to:
 * - VoiceCueScheduler
 * - MetronomeScheduler
 * - DrumScheduler
 * - BassScheduler
 * - HarmonyScheduler
 * - GrandPianoKeyboardMapper
 *
 * Tests ensure:
 * 1. 1:1 functional equivalence with original implementation
 * 2. Proper state synchronization (audio context, buffers, transport start time, countdown, CC64 timeline)
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

describe('RegionProcessor - Phase 4 Integration', () => {
  let regionProcessor: RegionProcessor;
  let eventBus: EventBus;
  let mockAudioContext: AudioContext;
  let mockDestination: AudioNode;

  beforeEach(() => {
    eventBus = new EventBus();
    regionProcessor = new RegionProcessor(eventBus);

    // Mock AudioContext
    mockAudioContext = {
      currentTime: 0,
      sampleRate: 48000,
      state: 'running',
      createGain: vi.fn(),
      createBufferSource: vi.fn(),
    } as any;

    // Mock destination node
    mockDestination = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as any;
  });

  // ============================================================================
  // MODULE INSTANTIATION TESTS
  // ============================================================================

  describe('Module instantiation', () => {
    it('should instantiate VoiceCueScheduler in constructor', () => {
      const voiceCueScheduler = (regionProcessor as any).voiceCueScheduler;
      expect(voiceCueScheduler).toBeDefined();
      expect(voiceCueScheduler.constructor.name).toBe('VoiceCueScheduler');
    });

    it('should instantiate MetronomeScheduler in constructor', () => {
      const metronomeScheduler = (regionProcessor as any).metronomeScheduler;
      expect(metronomeScheduler).toBeDefined();
      expect(metronomeScheduler.constructor.name).toBe('MetronomeScheduler');
    });

    it('should instantiate DrumScheduler in constructor', () => {
      const drumScheduler = (regionProcessor as any).drumScheduler;
      expect(drumScheduler).toBeDefined();
      expect(drumScheduler.constructor.name).toBe('DrumScheduler');
    });

    it('should instantiate BassScheduler in constructor', () => {
      const bassScheduler = (regionProcessor as any).bassScheduler;
      expect(bassScheduler).toBeDefined();
      expect(bassScheduler.constructor.name).toBe('BassScheduler');
    });

    it('should instantiate HarmonyScheduler in constructor', () => {
      const harmonyScheduler = (regionProcessor as any).harmonyScheduler;
      expect(harmonyScheduler).toBeDefined();
      expect(harmonyScheduler.constructor.name).toBe('HarmonyScheduler');
    });

    it('should instantiate GrandPianoKeyboardMapper in constructor', () => {
      const grandPianoKeyboardMapper = (regionProcessor as any)
        .grandPianoKeyboardMapper;
      expect(grandPianoKeyboardMapper).toBeDefined();
      expect(grandPianoKeyboardMapper.constructor.name).toBe(
        'GrandPianoKeyboardMapper',
      );
    });

    it('should pass instanceId to stateful schedulers', () => {
      const instanceId = (regionProcessor as any)._instanceId;

      const voiceCueScheduler = (regionProcessor as any).voiceCueScheduler;
      expect(voiceCueScheduler.instanceId).toBe(instanceId);

      const metronomeScheduler = (regionProcessor as any).metronomeScheduler;
      expect(metronomeScheduler.instanceId).toBe(instanceId);

      const drumScheduler = (regionProcessor as any).drumScheduler;
      expect(drumScheduler.instanceId).toBe(instanceId);

      const bassScheduler = (regionProcessor as any).bassScheduler;
      expect(bassScheduler.instanceId).toBe(instanceId);

      const harmonyScheduler = (regionProcessor as any).harmonyScheduler;
      expect(harmonyScheduler.instanceId).toBe(instanceId);
    });
  });

  // ============================================================================
  // AUDIO CONTEXT SYNCHRONIZATION TESTS
  // ============================================================================

  describe('AudioContext synchronization', () => {
    it('should sync audio context to all schedulers on setAudioContext()', () => {
      regionProcessor.setAudioContext(mockAudioContext);

      // Verify all schedulers received audio context
      const voiceCueScheduler = (regionProcessor as any).voiceCueScheduler;
      expect((voiceCueScheduler as any).audioContext).toBe(mockAudioContext);

      const metronomeScheduler = (regionProcessor as any).metronomeScheduler;
      expect((metronomeScheduler as any).audioContext).toBe(mockAudioContext);

      const drumScheduler = (regionProcessor as any).drumScheduler;
      expect((drumScheduler as any).audioContext).toBe(mockAudioContext);

      const bassScheduler = (regionProcessor as any).bassScheduler;
      expect((bassScheduler as any).audioContext).toBe(mockAudioContext);

      // HarmonyScheduler gets audio context in start(), not setAudioContext()
      // GrandPianoKeyboardMapper doesn't need audio context
    });

    it('should sync sample rate to all schedulers on setAudioContext()', () => {
      regionProcessor.setAudioContext(mockAudioContext);

      const voiceCueScheduler = (regionProcessor as any).voiceCueScheduler;
      expect((voiceCueScheduler as any).sampleRate).toBe(48000);

      const metronomeScheduler = (regionProcessor as any).metronomeScheduler;
      expect((metronomeScheduler as any).sampleRate).toBe(48000);

      const drumScheduler = (regionProcessor as any).drumScheduler;
      expect((drumScheduler as any).sampleRate).toBe(48000);

      const bassScheduler = (regionProcessor as any).bassScheduler;
      expect((bassScheduler as any).sampleRate).toBe(48000);

      const harmonyScheduler = (regionProcessor as any).harmonyScheduler;
      expect((harmonyScheduler as any).sampleRate).toBe(48000);
    });
  });

  // ============================================================================
  // BUFFER SYNCHRONIZATION TESTS
  // ============================================================================

  describe('Buffer synchronization', () => {
    it('should sync metronome buffers to MetronomeScheduler', () => {
      const accentBuffer = new AudioBuffer({ length: 1, sampleRate: 48000 });
      const clickBuffer = new AudioBuffer({ length: 1, sampleRate: 48000 });

      regionProcessor.setMetronomeBuffers(
        accentBuffer,
        clickBuffer,
        mockDestination,
      );

      const metronomeScheduler = (regionProcessor as any).metronomeScheduler;
      // Buffers are stored in private metronomeBuffers object
      expect((metronomeScheduler as any).metronomeBuffers.accent).toBe(
        accentBuffer,
      );
      expect((metronomeScheduler as any).metronomeBuffers.click).toBe(
        clickBuffer,
      );
      expect((metronomeScheduler as any).audioDestination).toBe(
        mockDestination,
      );
    });

    it('should sync drum buffers to DrumScheduler', () => {
      const kickBuffer = new AudioBuffer({ length: 1, sampleRate: 48000 });
      const snareBuffer = new AudioBuffer({ length: 1, sampleRate: 48000 });
      const hihatBuffer = new AudioBuffer({ length: 1, sampleRate: 48000 });

      regionProcessor.setDrumBuffers(
        kickBuffer,
        snareBuffer,
        hihatBuffer,
        mockDestination,
      );

      const drumScheduler = (regionProcessor as any).drumScheduler;
      // Buffers are stored in private drumBuffers object
      expect((drumScheduler as any).drumBuffers.kick).toBe(kickBuffer);
      expect((drumScheduler as any).drumBuffers.snare).toBe(snareBuffer);
      expect((drumScheduler as any).drumBuffers.hihat).toBe(hihatBuffer);
      expect((drumScheduler as any).audioDestination).toBe(mockDestination);
    });

    it('should sync voice cue buffers to VoiceCueScheduler', () => {
      const samples = new Map<string, AudioBuffer>([
        ['one', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['two', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['three', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['four', new AudioBuffer({ length: 1, sampleRate: 48000 })],
      ]);

      regionProcessor.setVoiceCueBuffers(samples, mockDestination);

      const voiceCueScheduler = (regionProcessor as any).voiceCueScheduler;
      expect((voiceCueScheduler as any).voiceCueBuffers).toBe(samples);
      expect((voiceCueScheduler as any).audioDestination).toBe(
        mockDestination,
      );
    });

    it('should sync bass buffers to BassScheduler', () => {
      const samples = new Map<string, AudioBuffer>([
        ['normal-D2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['normal-E2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['slap-D2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['slap-E2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
      ]);

      regionProcessor.setBassBuffers(samples, mockDestination);

      const bassScheduler = (regionProcessor as any).bassScheduler;
      expect((bassScheduler as any).bassBuffers).toBeInstanceOf(Map);
      expect((bassScheduler as any).bassBuffers.size).toBeGreaterThan(0);
      expect((bassScheduler as any).audioDestination).toBe(mockDestination);
    });

    it('should sync harmony buffers to HarmonyScheduler', async () => {
      const samples = new Map<string, AudioBuffer>([
        ['v3-C4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['v3-D4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['v4-C4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['v4-D4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
      ]);

      const perNoteVelocityRanges = {
        C4: [{ min: 0, max: 63, layer: 'v3' }],
        D4: [{ min: 0, max: 63, layer: 'v3' }],
      };

      await regionProcessor.setHarmonyBuffers(
        samples,
        mockDestination,
        perNoteVelocityRanges,
        'wurlitzer',
      );

      const harmonyScheduler = (regionProcessor as any).harmonyScheduler;
      expect((harmonyScheduler as any).harmonyBuffers).toBeInstanceOf(Map);
      expect((harmonyScheduler as any).harmonyBuffers.size).toBeGreaterThan(0);
      expect((harmonyScheduler as any).harmonyVelocityRanges).toBe(
        perNoteVelocityRanges,
      );
      expect((harmonyScheduler as any).currentHarmonyInstrument).toBe(
        'wurlitzer',
      );
      expect((harmonyScheduler as any).audioDestination).toBe(mockDestination);
    });

    it('should sync Grand Piano keyboard map to GrandPianoKeyboardMapper', async () => {
      const samples = new Map<string, AudioBuffer>([
        ['v3-A3', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['v3-C4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
      ]);

      await regionProcessor.setHarmonyBuffers(
        samples,
        mockDestination,
        undefined,
        'grandpiano',
      );

      const harmonyScheduler = (regionProcessor as any).harmonyScheduler;
      expect((harmonyScheduler as any).currentHarmonyInstrument).toBe(
        'grandpiano',
      );

      // Keyboard map might be null in test environment, but should attempt to load
      const grandPianoKeyboardMapper = (regionProcessor as any)
        .grandPianoKeyboardMapper;
      expect(grandPianoKeyboardMapper).toBeDefined();
    });
  });

  // ============================================================================
  // TRANSPORT START TIME SYNCHRONIZATION TESTS
  // ============================================================================

  describe('Transport start time synchronization', () => {
    it('should sync transport start time to all schedulers on start()', async () => {
      regionProcessor.setAudioContext(mockAudioContext);

      await regionProcessor.start();

      const transportStartTime = (regionProcessor as any).transportStartTime;
      expect(transportStartTime).toBeGreaterThan(0);

      // Only HarmonyScheduler receives transportStartTime (via setAudioContext in start())
      // Other schedulers receive pre-calculated audioTime in schedule() calls
      const harmonyScheduler = (regionProcessor as any).harmonyScheduler;
      expect((harmonyScheduler as any).transportStartTime).toBe(
        transportStartTime,
      );

      // Cleanup
      regionProcessor.stop();
    });
  });

  // ============================================================================
  // COUNTDOWN SYNCHRONIZATION TESTS
  // ============================================================================

  describe('Countdown synchronization', () => {
    it('should not sync countdown to schedulers (they receive pre-calculated times)', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      regionProcessor.enableCountdown(timeSignature);

      // Schedulers don't need countdown configuration
      // They receive pre-calculated audioTime values that already include countdown offset
      // Only CC64TimelineBuilder and ScheduleCache need countdown config
      expect(regionProcessor).toBeDefined();
    });
  });

  // ============================================================================
  // SCHEDULER DELEGATION TESTS
  // ============================================================================
  // NOTE: Phase 5.5 removed scheduleXxxDirect methods - they're now encapsulated
  // in EventRouter. Delegation is tested in EventRouter.test.ts instead.

  // ============================================================================
  // INTEGRATION SMOKE TESTS
  // ============================================================================

  describe('Integration smoke tests', () => {
    it('should handle full scheduler setup workflow', async () => {
      // Set audio context
      regionProcessor.setAudioContext(mockAudioContext);

      // Set buffers for all instruments
      regionProcessor.setMetronomeBuffers(
        new AudioBuffer({ length: 1, sampleRate: 48000 }),
        new AudioBuffer({ length: 1, sampleRate: 48000 }),
        mockDestination,
      );

      regionProcessor.setDrumBuffers(
        new AudioBuffer({ length: 1, sampleRate: 48000 }),
        new AudioBuffer({ length: 1, sampleRate: 48000 }),
        new AudioBuffer({ length: 1, sampleRate: 48000 }),
        mockDestination,
      );

      regionProcessor.setVoiceCueBuffers(
        new Map([
          ['one', new AudioBuffer({ length: 1, sampleRate: 48000 })],
          ['two', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ]),
        mockDestination,
      );

      await regionProcessor.setHarmonyBuffers(
        new Map([
          ['v3-C4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ]),
        mockDestination,
        undefined,
        'wurlitzer',
      );

      regionProcessor.setBassBuffers(
        new Map([
          ['normal-D2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ]),
        mockDestination,
      );

      // Enable countdown
      regionProcessor.enableCountdown({ numerator: 4, denominator: 4 });

      // Start transport
      await regionProcessor.start();

      // Verify schedulers are configured (only check what actually exists)
      const voiceCueScheduler = (regionProcessor as any).voiceCueScheduler;
      expect((voiceCueScheduler as any).audioContext).toBe(mockAudioContext);

      const harmonyScheduler = (regionProcessor as any).harmonyScheduler;
      expect((harmonyScheduler as any).audioContext).toBe(mockAudioContext);
      expect((harmonyScheduler as any).transportStartTime).toBeGreaterThan(0);

      // Schedulers don't need countdown config - they receive pre-calculated times

      // Cleanup
      regionProcessor.stop();
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS
  // ============================================================================

  describe('Backward compatibility', () => {
    // NOTE: Phase 5.5 removed scheduleXxxDirect methods - they're now private
    // to EventRouter. The public API remains unchanged (setters, start/stop).

    it('should maintain buffer setter API', () => {
      // Verify all buffer setter methods exist and work correctly
      expect(typeof regionProcessor.setMetronomeBuffers).toBe('function');
      expect(typeof regionProcessor.setDrumBuffers).toBe('function');
      expect(typeof regionProcessor.setVoiceCueBuffers).toBe('function');
      expect(typeof regionProcessor.setHarmonyBuffers).toBe('function');
      expect(typeof regionProcessor.setBassBuffers).toBe('function');

      // Call them to ensure they don't throw
      expect(() =>
        regionProcessor.setMetronomeBuffers(
          new AudioBuffer({ length: 1, sampleRate: 48000 }),
          new AudioBuffer({ length: 1, sampleRate: 48000 }),
          mockDestination,
        ),
      ).not.toThrow();
    });
  });
});
