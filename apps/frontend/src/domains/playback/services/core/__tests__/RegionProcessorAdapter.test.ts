/**
 * RegionProcessorAdapter.test.ts
 *
 * Verification tests for RegionProcessorAdapter backward compatibility.
 *
 * Purpose: Ensure adapter correctly maps RegionProcessor API to PlaybackEngine
 * without breaking existing widget integrations during migration.
 *
 * Test Coverage:
 * - All public RegionProcessor methods mapped correctly
 * - Deprecation warnings logged for each method
 * - No functional regressions in widget workflows
 * - Adapter provides escape hatch (getPlaybackEngine)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RegionProcessorAdapter } from '../RegionProcessorAdapter.js';
import { PlaybackEngine } from '../PlaybackEngine.js';
import type { EventBus } from '../EventBus.js';
import type { PluginManager } from '../PluginManager.js';

// Mock dependencies
const createMockEventBus = (): EventBus => ({
  emit: vi.fn(),
  on: vi.fn(() => vi.fn()),
  off: vi.fn(),
});

const createMockAudioContext = (): AudioContext => {
  const mockContext = {
    sampleRate: 48000,
    currentTime: 0,
    state: 'running',
    createBufferSource: vi.fn(),
    createGain: vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    destination: {
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
  return mockContext as unknown as AudioContext;
};

const createMockAudioDestination = (): AudioNode => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  context: createMockAudioContext(),
  numberOfInputs: 1,
  numberOfOutputs: 1,
  channelCount: 2,
  channelCountMode: 'max',
  channelInterpretation: 'speakers',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

const createMockPluginManager = (): PluginManager => ({
  getPlugin: vi.fn(() => ({
    unwrap: vi.fn(() => ({
      keyboard: {} as any,
    })),
  })),
  loadPlugin: vi.fn(),
  hasPlugin: vi.fn(),
  dispose: vi.fn(),
});

describe('RegionProcessorAdapter', () => {
  let eventBus: EventBus;
  let audioContext: AudioContext;
  let audioDestination: AudioNode;
  let playbackEngine: PlaybackEngine;
  let adapter: RegionProcessorAdapter;
  let consoleWarnSpy: any;

  beforeEach(async () => {
    eventBus = createMockEventBus();
    audioContext = createMockAudioContext();
    audioDestination = createMockAudioDestination();
    playbackEngine = new PlaybackEngine(eventBus);
    await playbackEngine.initialize(audioContext, audioDestination);

    adapter = new RegionProcessorAdapter(playbackEngine);

    // Spy on console.warn to verify deprecation warnings
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.clearAllMocks();
  });

  afterEach(() => {
    if (adapter) {
      adapter.dispose();
    }
    if (playbackEngine) {
      playbackEngine.dispose();
    }
    consoleWarnSpy.mockRestore();
  });

  // ============================================================================
  // Test 1: Adapter Initialization
  // ============================================================================

  describe('Adapter Initialization', () => {
    it('should wrap PlaybackEngine instance', () => {
      const wrappedEngine = adapter.getPlaybackEngine();
      expect(wrappedEngine).toBe(playbackEngine);
    });

    it('should provide escape hatch for direct PlaybackEngine access', () => {
      const directEngine = adapter.getPlaybackEngine();
      expect(directEngine).toBeInstanceOf(PlaybackEngine);
      expect(directEngine.isReady()).toBe(true);
    });
  });

  // ============================================================================
  // Test 2: Countdown Configuration
  // ============================================================================

  describe('Countdown Configuration', () => {
    it('should map disableCountdown() to setCountdownConfig()', () => {
      const setCountdownSpy = vi.spyOn(playbackEngine, 'setCountdownConfig');

      adapter.disableCountdown();

      expect(setCountdownSpy).toHaveBeenCalledWith(0, false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEPRECATED]'),
      );
    });

    it('should log deprecation warning for disableCountdown()', () => {
      adapter.disableCountdown();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('disableCountdown()'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('setCountdownConfig'),
      );
    });
  });

  // ============================================================================
  // Test 3: AudioContext Configuration
  // ============================================================================

  describe('AudioContext Configuration', () => {
    it('should handle setAudioContext() as no-op', () => {
      const mockContext = createMockAudioContext();

      // Should not throw, just warn
      expect(() => {
        adapter.setAudioContext(mockContext);
      }).not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('setAudioContext()'),
      );
    });

    it('should log deprecation warning for setAudioContext()', () => {
      adapter.setAudioContext(audioContext);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEPRECATED]'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('initialize()'),
      );
    });
  });

  // ============================================================================
  // Test 4: Harmony Buffers Configuration
  // ============================================================================

  describe('Harmony Buffers Configuration', () => {
    it('should handle setHarmonyBuffers() as no-op', async () => {
      const mockBuffers = new Map<string, Map<string, AudioBuffer>>();
      const mockVelocityRanges = {};
      const mockKeyboardMap = {};

      // Should not throw, just warn
      await expect(
        adapter.setHarmonyBuffers(
          mockBuffers,
          mockVelocityRanges,
          'grand-piano',
          mockKeyboardMap,
        ),
      ).resolves.not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('setHarmonyBuffers()'),
      );
    });

    it('should log deprecation warning for setHarmonyBuffers()', async () => {
      const mockBuffers = new Map();
      await adapter.setHarmonyBuffers(mockBuffers);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEPRECATED]'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('managed internally'),
      );
    });
  });

  // ============================================================================
  // Test 5: PluginManager Integration
  // ============================================================================

  describe('PluginManager Integration', () => {
    it('should map setPluginManager() to PlaybackEngine', () => {
      const mockPluginManager = createMockPluginManager();
      const setPluginSpy = vi.spyOn(playbackEngine, 'setPluginManager');

      adapter.setPluginManager(mockPluginManager);

      expect(setPluginSpy).toHaveBeenCalledWith(mockPluginManager);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('setPluginManager()'),
      );
    });

    it('should map getWamKeyboard() to PlaybackEngine', () => {
      const mockPluginManager = createMockPluginManager();
      playbackEngine.setPluginManager(mockPluginManager);

      vi.clearAllMocks(); // Clear setup calls

      const keyboard = adapter.getWamKeyboard();

      expect(keyboard).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('getWamKeyboard()'),
      );
    });
  });

  // ============================================================================
  // Test 6: Track Registration
  // ============================================================================

  describe('Track Registration', () => {
    it('should map registerTracks() to individual registerTrack() calls', () => {
      const registerTrackSpy = vi.spyOn(playbackEngine, 'registerTrack');

      const tracks = [
        {
          id: 'track-1',
          name: 'Metronome',
          regions: [],
          instrumentType: 'metronome',
        },
        {
          id: 'track-2',
          name: 'Drums',
          regions: [],
          instrumentType: 'drums',
        },
      ];

      adapter.registerTracks(tracks);

      expect(registerTrackSpy).toHaveBeenCalledTimes(2);
      expect(registerTrackSpy).toHaveBeenNthCalledWith(1, {
        id: 'track-1',
        name: 'Metronome',
        regions: [],
        instrumentType: 'metronome',
        exerciseId: undefined,
        audioNode: undefined,
      });
      expect(registerTrackSpy).toHaveBeenNthCalledWith(2, {
        id: 'track-2',
        name: 'Drums',
        regions: [],
        instrumentType: 'drums',
        exerciseId: undefined,
        audioNode: undefined,
      });
    });

    it('should handle tracks with nested track.id structure', () => {
      const registerTrackSpy = vi.spyOn(playbackEngine, 'registerTrack');

      const tracks = [
        {
          track: { id: 'nested-track-1' },
          name: 'Harmony',
          regions: [],
          instrumentType: 'harmony',
        },
      ];

      adapter.registerTracks(tracks);

      expect(registerTrackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'nested-track-1',
          name: 'Harmony',
        }),
      );
    });

    it('should generate track ID if none provided', () => {
      const registerTrackSpy = vi.spyOn(playbackEngine, 'registerTrack');

      const tracks = [
        {
          name: 'Voice Cue',
          regions: [],
          instrumentType: 'voiceCue',
        },
      ];

      adapter.registerTracks(tracks);

      expect(registerTrackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringContaining('track-'),
          name: 'Voice Cue',
        }),
      );
    });

    it('should log deprecation warning for registerTracks()', () => {
      adapter.registerTracks([]);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEPRECATED]'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('registerTrack()'),
      );
    });
  });

  // ============================================================================
  // Test 7: Playback Control
  // ============================================================================

  describe('Playback Control', () => {
    it('should map start() to PlaybackEngine', () => {
      const startSpy = vi.spyOn(playbackEngine, 'start');

      adapter.start();

      expect(startSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('start()'),
      );
    });

    it('should map stop() to PlaybackEngine', () => {
      const stopSpy = vi.spyOn(playbackEngine, 'stop');

      adapter.stop();

      expect(stopSpy).toHaveBeenCalledWith(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('stop()'),
      );
    });

    it('should map stop(graceful=true) to PlaybackEngine', () => {
      const stopSpy = vi.spyOn(playbackEngine, 'stop');

      adapter.stop(true);

      expect(stopSpy).toHaveBeenCalledWith(true);
    });
  });

  // ============================================================================
  // Test 8: Lifecycle Management
  // ============================================================================

  describe('Lifecycle Management', () => {
    it('should map dispose() to PlaybackEngine', () => {
      const disposeSpy = vi.spyOn(playbackEngine, 'dispose');

      adapter.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('dispose()'),
      );
    });

    it('should allow multiple dispose() calls safely', () => {
      expect(() => {
        adapter.dispose();
        adapter.dispose();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Test 9: Widget Integration Workflow
  // ============================================================================

  describe('Widget Integration Workflow', () => {
    it('should support complete widget setup workflow', () => {
      // Simulate widget initialization sequence
      const mockPluginManager = createMockPluginManager();

      // 1. Set plugin manager
      adapter.setPluginManager(mockPluginManager);

      // 2. Register tracks
      adapter.registerTracks([
        {
          id: 'widget-track',
          name: 'Widget Track',
          regions: [
            {
              id: 'region-1',
              trackId: 'widget-track',
              startTime: 0,
              duration: 4,
              pattern: {
                events: [
                  { position: '0:0:0', type: 'accent', velocity: 1.0 },
                ],
              },
            },
          ],
          instrumentType: 'metronome',
        },
      ]);

      // 3. Start playback
      adapter.start();

      // 4. Get keyboard (if needed)
      const keyboard = adapter.getWamKeyboard();

      // 5. Stop playback
      adapter.stop();

      // All operations should succeed
      expect(playbackEngine.getState()).toBe('stopped');
      expect(keyboard).toBeDefined();
    });

    it('should support bypass to PlaybackEngine for advanced usage', () => {
      // Widget can bypass adapter for direct access
      const directEngine = adapter.getPlaybackEngine();

      // Use PlaybackEngine API directly
      expect(directEngine.isReady()).toBe(true);
      expect(directEngine.getState()).toBe('ready');

      // Register track directly
      directEngine.registerTrack({
        id: 'direct-track',
        name: 'Direct Track',
        regions: [],
        instrumentType: 'drums',
      });

      expect(directEngine.getTracks().has('direct-track')).toBe(true);
    });
  });

  // ============================================================================
  // Test 10: Deprecation Warnings
  // ============================================================================

  describe('Deprecation Warnings', () => {
    it('should log deprecation warning for all adapter methods', () => {
      // Call all deprecated methods
      adapter.disableCountdown();
      adapter.setAudioContext(audioContext);
      adapter.setPluginManager(createMockPluginManager());
      adapter.getWamKeyboard();
      adapter.registerTracks([]);
      adapter.start();
      adapter.stop();
      adapter.dispose();

      // Should have 8 deprecation warnings (skip setHarmonyBuffers - async)
      expect(consoleWarnSpy).toHaveBeenCalledTimes(8);

      // All should contain [DEPRECATED] tag
      consoleWarnSpy.mock.calls.forEach((call: any[]) => {
        expect(call[0]).toContain('[DEPRECATED]');
      });
    });

    it('should provide migration guidance in warnings', () => {
      adapter.registerTracks([]);

      const warningMessage = consoleWarnSpy.mock.calls[0][0];
      expect(warningMessage).toContain('Use PlaybackEngine');
      expect(warningMessage).toContain('registerTrack()');
    });
  });
});
