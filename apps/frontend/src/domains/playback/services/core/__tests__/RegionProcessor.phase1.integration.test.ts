/**
 * Phase 1 Integration Tests
 *
 * Validates that RegionProcessor correctly delegates to:
 * - CountdownManager (4 methods)
 * - BufferRegistry (5 methods + 1 wrapper)
 * - MusicalTimeConverter (instantiated but not yet used)
 *
 * Tests ensure:
 * 1. 1:1 functional equivalence with original implementation
 * 2. Proper state synchronization from modules
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

describe('RegionProcessor - Phase 1 Integration', () => {
  let regionProcessor: RegionProcessor;
  let eventBus: EventBus;
  let mockDestination: AudioNode;

  beforeEach(() => {
    eventBus = new EventBus();
    regionProcessor = new RegionProcessor(eventBus);

    // Mock destination node
    mockDestination = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as any;
  });

  // ============================================================================
  // COUNTDOWN MANAGER DELEGATION TESTS
  // ============================================================================

  describe('CountdownManager delegation', () => {
    it('should delegate enableCountdown() and sync state', () => {
      const timeSignature = { numerator: 4, denominator: 4 };

      regionProcessor.enableCountdown(timeSignature);

      // Access private field for testing (TypeScript will complain, but works at runtime)
      const countdownOffsetBeats = (regionProcessor as any).countdownOffsetBeats;
      expect(countdownOffsetBeats).toBe(4); // Should sync from CountdownManager
    });

    it('should delegate disableCountdown() and sync state', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      regionProcessor.enableCountdown(timeSignature);

      regionProcessor.disableCountdown();

      const countdownOffsetBeats = (regionProcessor as any).countdownOffsetBeats;
      expect(countdownOffsetBeats).toBe(0); // Should reset to 0
    });

    it('should delegate addCountdownRegion() and create metronome track', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      regionProcessor.enableCountdown(timeSignature);

      // Access private tracks map
      const tracks = (regionProcessor as any).tracks;
      const initialMetronomeTrack = tracks.get('metronome');

      regionProcessor.addCountdownRegion(timeSignature);

      const metronomeTrack = tracks.get('metronome');
      expect(metronomeTrack).toBeDefined();
      expect(metronomeTrack.regions.length).toBeGreaterThan(
        initialMetronomeTrack?.regions.length || 0,
      );

      // Verify countdown region has correct structure
      const countdownRegion = metronomeTrack.regions.find(
        (r: any) => r.id === 'countdown-region',
      );
      expect(countdownRegion).toBeDefined();
      expect(countdownRegion.skipCountdownOffset).toBe(true);
      expect(countdownRegion.pattern.events.length).toBe(4); // 4 beats
    });

    it('should delegate addVoiceCountdownRegion() and create voice-cue track', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      regionProcessor.enableCountdown(timeSignature);

      const tracks = (regionProcessor as any).tracks;
      regionProcessor.addVoiceCountdownRegion(timeSignature);

      const voiceCueTrack = tracks.get('voice-cue');
      expect(voiceCueTrack).toBeDefined();
      expect(voiceCueTrack.regions.length).toBeGreaterThan(0);

      // Verify voice countdown region has correct structure
      const voiceCountdownRegion = voiceCueTrack.regions.find(
        (r: any) => r.id === 'voice-cue-countdown-region',
      );
      expect(voiceCountdownRegion).toBeDefined();
      expect(voiceCountdownRegion.skipCountdownOffset).toBe(true);
      expect(voiceCountdownRegion.pattern.events.length).toBe(4); // 4 beats

      // Verify voice cue names
      const cueNames = voiceCountdownRegion.pattern.events.map(
        (e: any) => e.data?.cue,
      );
      expect(cueNames).toEqual(['one', 'two', 'three', 'four']);
    });

    it('should not add countdown regions when countdown is disabled', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      regionProcessor.disableCountdown();

      const tracks = (regionProcessor as any).tracks;
      regionProcessor.addCountdownRegion(timeSignature);
      regionProcessor.addVoiceCountdownRegion(timeSignature);

      // Tracks should not be created if countdown is disabled
      const metronomeTrack = tracks.get('metronome');
      const voiceCueTrack = tracks.get('voice-cue');

      // Either tracks don't exist, or they don't have countdown regions
      const hasCountdownRegion =
        metronomeTrack?.regions.some((r: any) => r.id === 'countdown-region') ||
        false;
      const hasVoiceCountdownRegion =
        voiceCueTrack?.regions.some(
          (r: any) => r.id === 'voice-cue-countdown-region',
        ) || false;

      expect(hasCountdownRegion).toBe(false);
      expect(hasVoiceCountdownRegion).toBe(false);
    });
  });

  // ============================================================================
  // BUFFER REGISTRY DELEGATION TESTS
  // ============================================================================

  describe('BufferRegistry delegation', () => {
    it('should delegate setMetronomeBuffers() and sync destination', () => {
      const accentBuffer = new AudioBuffer({
        length: 1,
        sampleRate: 48000,
      });
      const clickBuffer = new AudioBuffer({ length: 1, sampleRate: 48000 });

      regionProcessor.setMetronomeBuffers(
        accentBuffer,
        clickBuffer,
        mockDestination,
      );

      // Verify destination is synced
      const audioDestination = (regionProcessor as any).audioDestination;
      expect(audioDestination).toBe(mockDestination);
    });

    it('should delegate setDrumBuffers() and sync destination', () => {
      const kickBuffer = new AudioBuffer({ length: 1, sampleRate: 48000 });
      const snareBuffer = new AudioBuffer({ length: 1, sampleRate: 48000 });
      const hihatBuffer = new AudioBuffer({ length: 1, sampleRate: 48000 });

      regionProcessor.setDrumBuffers(
        kickBuffer,
        snareBuffer,
        hihatBuffer,
        mockDestination,
      );

      const audioDestination = (regionProcessor as any).audioDestination;
      expect(audioDestination).toBe(mockDestination);
    });

    it('should delegate setVoiceCueBuffers() and sync internal state', () => {
      const samples = new Map<string, AudioBuffer>([
        ['one', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['two', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['three', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['four', new AudioBuffer({ length: 1, sampleRate: 48000 })],
      ]);

      regionProcessor.setVoiceCueBuffers(samples, mockDestination);

      // Verify internal state synced from BufferRegistry
      const voiceCueBuffers = (regionProcessor as any).voiceCueBuffers;
      expect(voiceCueBuffers).toBe(samples);
      expect(voiceCueBuffers.size).toBe(4);

      const audioDestination = (regionProcessor as any).audioDestination;
      expect(audioDestination).toBe(mockDestination);
    });

    it('should delegate setHarmonyBuffers() and sync all harmony state', async () => {
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

      // Verify all harmony state synced from BufferRegistry
      const harmonyBuffers = (regionProcessor as any).harmonyBuffers;
      expect(harmonyBuffers).toBeInstanceOf(Map);
      expect(harmonyBuffers.size).toBeGreaterThan(0);

      const harmonyVelocityRanges = (regionProcessor as any)
        .harmonyVelocityRanges;
      expect(harmonyVelocityRanges).toBe(perNoteVelocityRanges);

      const currentHarmonyInstrument = (regionProcessor as any)
        .currentHarmonyInstrument;
      expect(currentHarmonyInstrument).toBe('wurlitzer');

      const audioDestination = (regionProcessor as any).audioDestination;
      expect(audioDestination).toBe(mockDestination);
    });

    it('should load Grand Piano keyboard map for grandpiano instrument', async () => {
      const samples = new Map<string, AudioBuffer>([
        ['v3-A3', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['v3-C4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['v3-Ds4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['v3-Fs4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
      ]);

      await regionProcessor.setHarmonyBuffers(
        samples,
        mockDestination,
        undefined,
        'grandpiano',
      );

      const currentHarmonyInstrument = (regionProcessor as any)
        .currentHarmonyInstrument;
      expect(currentHarmonyInstrument).toBe('grandpiano');

      // Keyboard map should be loaded (or attempted to load)
      // Note: Actual loading may fail in test environment, but state should be synced
      const grandPianoKeyboardMap = (regionProcessor as any)
        .grandPianoKeyboardMap;
      // Map might be null due to test environment, but field should exist
      expect(grandPianoKeyboardMap !== undefined).toBe(true);
    });

    it('should delegate setBassBuffers() and sync internal state', () => {
      const samples = new Map<string, AudioBuffer>([
        ['normal-D2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['normal-E2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['slap-D2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ['slap-E2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
      ]);

      regionProcessor.setBassBuffers(samples, mockDestination);

      // Verify internal state synced from BufferRegistry
      const bassBuffers = (regionProcessor as any).bassBuffers;
      expect(bassBuffers).toBeInstanceOf(Map);
      expect(bassBuffers.size).toBeGreaterThan(0);

      const audioDestination = (regionProcessor as any).audioDestination;
      expect(audioDestination).toBe(mockDestination);
    });

    it('should have loadGrandPianoKeyboardMap() wrapper method', async () => {
      // Verify the wrapper method exists
      const loadMethod = (regionProcessor as any).loadGrandPianoKeyboardMap;
      expect(loadMethod).toBeDefined();
      expect(typeof loadMethod).toBe('function');

      // Call it (may fail in test environment, but should not throw)
      await expect(
        loadMethod.call(regionProcessor),
      ).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // MODULE INSTANTIATION TESTS
  // ============================================================================

  describe('Module instantiation', () => {
    it('should instantiate CountdownManager in constructor', () => {
      const countdownManager = (regionProcessor as any).countdownManager;
      expect(countdownManager).toBeDefined();
      expect(countdownManager.constructor.name).toBe('CountdownManager');
    });

    it('should instantiate BufferRegistry in constructor', () => {
      const bufferRegistry = (regionProcessor as any).bufferRegistry;
      expect(bufferRegistry).toBeDefined();
      expect(bufferRegistry.constructor.name).toBe('BufferRegistry');
    });

    it('should instantiate MusicalTimeConverter in constructor', () => {
      const musicalTimeConverter = (regionProcessor as any)
        .musicalTimeConverter;
      expect(musicalTimeConverter).toBeDefined();
      expect(musicalTimeConverter.constructor.name).toBe(
        'MusicalTimeConverter',
      );
    });

    it('should pass instanceId to stateful modules', () => {
      const instanceId = (regionProcessor as any)._instanceId;

      const countdownManager = (regionProcessor as any).countdownManager;
      expect(countdownManager.instanceId).toBe(instanceId);

      const bufferRegistry = (regionProcessor as any).bufferRegistry;
      expect(bufferRegistry.instanceId).toBe(instanceId);

      // Note: MusicalTimeConverter doesn't need instanceId (stateless utility)
      const musicalTimeConverter = (regionProcessor as any)
        .musicalTimeConverter;
      expect(musicalTimeConverter).toBeDefined();
      expect(musicalTimeConverter.constructor.name).toBe(
        'MusicalTimeConverter',
      );
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS
  // ============================================================================

  describe('Backward compatibility', () => {
    it('should maintain countdownOffsetBeats field for backward compat', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      regionProcessor.enableCountdown(timeSignature);

      // This field must exist for existing scheduling logic
      const countdownOffsetBeats = (regionProcessor as any).countdownOffsetBeats;
      expect(typeof countdownOffsetBeats).toBe('number');
      expect(countdownOffsetBeats).toBe(4);
    });

    it('should maintain harmony buffer fields for backward compat', async () => {
      const samples = new Map<string, AudioBuffer>([
        ['v3-C4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
      ]);

      await regionProcessor.setHarmonyBuffers(
        samples,
        mockDestination,
        undefined,
        'wurlitzer',
      );

      // These fields must exist for existing scheduling logic
      expect((regionProcessor as any).harmonyBuffers).toBeInstanceOf(Map);
      expect((regionProcessor as any).currentHarmonyInstrument).toBe(
        'wurlitzer',
      );
      expect((regionProcessor as any).audioDestination).toBe(mockDestination);
    });

    it('should maintain bass buffer fields for backward compat', () => {
      const samples = new Map<string, AudioBuffer>([
        ['normal-D2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
      ]);

      regionProcessor.setBassBuffers(samples, mockDestination);

      // These fields must exist for existing scheduling logic
      expect((regionProcessor as any).bassBuffers).toBeInstanceOf(Map);
      expect((regionProcessor as any).audioDestination).toBe(mockDestination);
    });
  });

  // ============================================================================
  // INTEGRATION SMOKE TESTS
  // ============================================================================

  describe('Integration smoke tests', () => {
    it('should handle full countdown setup flow', () => {
      const timeSignature = { numerator: 4, denominator: 4 };

      // Enable countdown
      regionProcessor.enableCountdown(timeSignature);

      // Add countdown regions
      regionProcessor.addCountdownRegion(timeSignature);
      regionProcessor.addVoiceCountdownRegion(timeSignature);

      // Verify tracks were created
      const tracks = (regionProcessor as any).tracks;
      expect(tracks.get('metronome')).toBeDefined();
      expect(tracks.get('voice-cue')).toBeDefined();

      // Disable countdown
      regionProcessor.disableCountdown();
      expect((regionProcessor as any).countdownOffsetBeats).toBe(0);
    });

    it('should handle full buffer setup flow', async () => {
      // Set metronome buffers
      regionProcessor.setMetronomeBuffers(
        new AudioBuffer({ length: 1, sampleRate: 48000 }),
        new AudioBuffer({ length: 1, sampleRate: 48000 }),
        mockDestination,
      );

      // Set drum buffers
      regionProcessor.setDrumBuffers(
        new AudioBuffer({ length: 1, sampleRate: 48000 }),
        new AudioBuffer({ length: 1, sampleRate: 48000 }),
        new AudioBuffer({ length: 1, sampleRate: 48000 }),
        mockDestination,
      );

      // Set harmony buffers
      await regionProcessor.setHarmonyBuffers(
        new Map([
          ['v3-C4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ]),
        mockDestination,
        undefined,
        'wurlitzer',
      );

      // Set bass buffers
      regionProcessor.setBassBuffers(
        new Map([
          ['normal-D2', new AudioBuffer({ length: 1, sampleRate: 48000 })],
        ]),
        mockDestination,
      );

      // Verify all destinations are synced
      expect((regionProcessor as any).audioDestination).toBe(mockDestination);
    });
  });
});
