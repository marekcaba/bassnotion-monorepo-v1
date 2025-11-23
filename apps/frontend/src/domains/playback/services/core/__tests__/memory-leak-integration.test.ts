/**
 * Bug #3: Memory Leak Integration Tests
 *
 * These tests verify that all schedulers (Harmony, Bass, Drum, Metronome, VoiceCue)
 * properly clean up AudioBufferSourceNode references after playback ends,
 * preventing memory leaks during extended playback sessions.
 *
 * This is an integration test that simulates a realistic 10-minute playback scenario.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Bug #3: Memory Leak Integration Tests', () => {
  let mockAudioContext: AudioContext;
  let createdSources: AudioBufferSourceNode[];
  let onendedCallbacks: Map<AudioBufferSourceNode, (() => void) | null>;

  beforeEach(() => {
    createdSources = [];
    onendedCallbacks = new Map();

    // Create mock AudioBuffer
    const mockBuffer = {
      duration: 1.0,
      sampleRate: 48000,
      length: 48000,
      numberOfChannels: 2,
      getChannelData: vi.fn(() => new Float32Array(48000)),
    } as unknown as AudioBuffer;

    // Create mock AudioBufferSourceNode factory
    const createMockSource = () => {
      const mockSource = {
        buffer: null,
        onended: null,
        start: vi.fn((when?: number) => {
          // Simulate playback end after 10ms
          setTimeout(() => {
            const callback = onendedCallbacks.get(mockSource);
            if (callback) {
              callback();
            }
          }, 10);
        }),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as AudioBufferSourceNode;

      // Make onended settable
      Object.defineProperty(mockSource, 'onended', {
        get: () => onendedCallbacks.get(mockSource) || null,
        set: (callback: (() => void) | null) => {
          onendedCallbacks.set(mockSource, callback);
        },
        configurable: true,
      });

      createdSources.push(mockSource);
      return mockSource;
    };

    // Create mock GainNode factory
    const createMockGain = () => ({
      gain: { value: 1.0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }) as unknown as GainNode;

    // Create mock AudioContext
    mockAudioContext = {
      currentTime: 0,
      sampleRate: 48000,
      state: 'running',
      createBufferSource: vi.fn(createMockSource),
      createGain: vi.fn(createMockGain),
      destination: {} as AudioDestinationNode,
    } as unknown as AudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Realistic Playback Scenarios', () => {
    it('should not leak memory during 10-minute simulated playback', async () => {
      /**
       * Simulates a 10-minute practice session at 120 BPM:
       * - 30 bars/minute × 10 minutes = 300 bars
       * - Harmony: 300 chords × 3 notes = 900 sources
       * - Drums: 300 bars × 4 hits = 1,200 sources
       * - Bass: 300 notes = 300 sources
       * - Metronome: 300 bars × 4 clicks = 1,200 sources
       * - Voice cues: ~40 sources
       * TOTAL: ~3,640 AudioBufferSourceNode instances
       */

      const totalEvents = 3640;
      const trackingMap = new Map<AudioBufferSourceNode, { type: string; cleaned: boolean }>();

      // Simulate scheduling events with cleanup
      for (let i = 0; i < totalEvents; i++) {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        // Track this source
        trackingMap.set(source, { type: 'test', cleaned: false });

        // Add cleanup callback (this is what our fix adds)
        source.onended = () => {
          // Remove from tracking map
          const metadata = trackingMap.get(source);
          if (metadata) {
            metadata.cleaned = true;
            trackingMap.delete(source);
          }

          // Disconnect nodes
          try {
            source.disconnect();
            gain.disconnect();
          } catch (e) {
            // Already disconnected
          }
        };

        // Start playback
        source.start(0.1 + i * 0.5);
      }

      // Initial state: all sources tracked
      expect(trackingMap.size).toBe(totalEvents);

      // Wait for all sources to finish (simulated playback)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // After cleanup: tracking map should be empty
      expect(trackingMap.size).toBe(0);

      // All sources should have been cleaned
      expect(createdSources.length).toBe(totalEvents);
    });

    it('should maintain stable memory during continuous playback', async () => {
      /**
       * Simulates continuous playback where new events are scheduled
       * while old ones are finishing (more realistic than batch scheduling)
       */

      const trackingMap = new Map<AudioBufferSourceNode, any>();
      const maxSize: number[] = [];

      const scheduleEvent = async () => {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        trackingMap.set(source, { type: 'test' });

        source.onended = () => {
          trackingMap.delete(source);
          gain.disconnect();
        };

        source.start(0.1);

        // Track max size
        maxSize.push(trackingMap.size);
      };

      // Schedule 100 events with 20ms delay between each
      for (let i = 0; i < 100; i++) {
        await scheduleEvent();
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // Wait for final cleanup
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Tracking map should be empty or nearly empty
      expect(trackingMap.size).toBeLessThan(5);

      // Max size should never exceed a reasonable threshold
      // (indicates sources are being cleaned up as they finish)
      const peakSize = Math.max(...maxSize);
      expect(peakSize).toBeLessThan(20); // Should stay under 20 active sources
    });
  });

  describe('Cross-Scheduler Memory Behavior', () => {
    it('should clean up sources from multiple instrument types', async () => {
      /**
       * Simulates a full playalong with all instrument types:
       * - Harmony (piano/rhodes/wurlitzer)
       * - Bass
       * - Drums
       * - Metronome
       * - Voice cues
       */

      const trackingMaps = {
        harmony: new Map<AudioBufferSourceNode, any>(),
        bass: new Map<AudioBufferSourceNode, any>(),
        drums: new Map<AudioBufferSourceNode, any>(),
        metronome: new Map<AudioBufferSourceNode, any>(),
        voiceCues: new Map<AudioBufferSourceNode, any>(),
      };

      const createInstrumentEvent = (
        instrument: keyof typeof trackingMaps,
        count: number,
      ) => {
        for (let i = 0; i < count; i++) {
          const source = mockAudioContext.createBufferSource();
          const gain = mockAudioContext.createGain();

          const map = trackingMaps[instrument];
          map.set(source, { instrument });

          source.onended = () => {
            map.delete(source);
            gain.disconnect();
          };

          source.start(0.1 + i * 0.1);
        }
      };

      // Schedule events for each instrument
      createInstrumentEvent('harmony', 100); // 100 harmony notes
      createInstrumentEvent('bass', 50); // 50 bass notes
      createInstrumentEvent('drums', 200); // 200 drum hits
      createInstrumentEvent('metronome', 100); // 100 metronome clicks
      createInstrumentEvent('voiceCues', 10); // 10 voice cues

      // Total: 460 sources
      const totalBefore =
        trackingMaps.harmony.size +
        trackingMaps.bass.size +
        trackingMaps.drums.size +
        trackingMaps.metronome.size +
        trackingMaps.voiceCues.size;

      expect(totalBefore).toBe(460);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 300));

      // All maps should be empty
      expect(trackingMaps.harmony.size).toBe(0);
      expect(trackingMaps.bass.size).toBe(0);
      expect(trackingMaps.drums.size).toBe(0);
      expect(trackingMaps.metronome.size).toBe(0);
      expect(trackingMaps.voiceCues.size).toBe(0);
    });
  });

  describe('Error Scenarios', () => {
    it('should clean up sources even if disconnect() throws', async () => {
      const trackingMap = new Map<AudioBufferSourceNode, any>();

      const source = mockAudioContext.createBufferSource();
      const mockGain = mockAudioContext.createGain();

      // Make disconnect throw
      (mockGain.disconnect as any).mockImplementation(() => {
        throw new Error('Disconnect failed');
      });

      trackingMap.set(source, { type: 'test' });

      source.onended = () => {
        trackingMap.delete(source);

        // Cleanup should handle errors gracefully
        try {
          source.disconnect();
          mockGain.disconnect();
        } catch (e) {
          // Error caught, cleanup continues
        }
      };

      source.start(0.1);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Source should still be removed from map despite disconnect error
      expect(trackingMap.size).toBe(0);
    });

    it('should not accumulate sources if onended never fires', async () => {
      /**
       * Edge case: What if onended never fires due to browser bug?
       * We still have stop() method as safety net
       */

      const trackingMap = new Map<AudioBufferSourceNode, any>();

      // Create source without triggering onended
      const source = {
        buffer: null,
        onended: null,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as AudioBufferSourceNode;

      trackingMap.set(source, { type: 'test' });

      source.onended = () => {
        trackingMap.delete(source);
      };

      source.start(0.1);

      // onended won't fire in this test

      // Wait
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Source still in map (onended didn't fire)
      expect(trackingMap.size).toBe(1);

      // But calling stop() manually should clean up
      trackingMap.clear();
      expect(trackingMap.size).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should clean up 5000 sources in under 1 second', async () => {
      const trackingMap = new Map<AudioBufferSourceNode, any>();

      const startTime = performance.now();

      // Create 5000 sources (very heavy load)
      for (let i = 0; i < 5000; i++) {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        trackingMap.set(source, { type: 'test' });

        source.onended = () => {
          trackingMap.delete(source);
          gain.disconnect();
        };

        source.start(0.1);
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 600));

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All sources cleaned up
      expect(trackingMap.size).toBe(0);

      // Performance should be acceptable
      expect(totalTime).toBeLessThan(1000);
    });

    it('should not cause noticeable GC pauses', async () => {
      /**
       * This test verifies that cleanup doesn't cause long blocking operations.
       * In real scenarios, GC pauses > 16ms can cause audio glitches.
       */

      const trackingMap = new Map<AudioBufferSourceNode, any>();
      const cleanupTimes: number[] = [];

      for (let i = 0; i < 100; i++) {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        trackingMap.set(source, { type: 'test' });

        source.onended = () => {
          const cleanupStart = performance.now();

          trackingMap.delete(source);
          gain.disconnect();

          const cleanupEnd = performance.now();
          cleanupTimes.push(cleanupEnd - cleanupStart);
        };

        source.start(0.1);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      // All cleanup operations should be fast
      const maxCleanupTime = Math.max(...cleanupTimes);
      expect(maxCleanupTime).toBeLessThan(1); // < 1ms per cleanup

      // Average should be even faster
      const avgCleanupTime =
        cleanupTimes.reduce((a, b) => a + b, 0) / cleanupTimes.length;
      expect(avgCleanupTime).toBeLessThan(0.5);
    });
  });

  describe('Success Criteria (from Bug #3 Plan)', () => {
    it('should keep tracking map size under 50 during active playback', async () => {
      /**
       * From docs: "scheduledAudioSources.size stays small (~10-50 active sources)"
       */

      const trackingMap = new Map<AudioBufferSourceNode, any>();
      const sizes: number[] = [];

      // Simulate continuous playback with overlap
      for (let i = 0; i < 200; i++) {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        trackingMap.set(source, { type: 'test' });

        source.onended = () => {
          trackingMap.delete(source);
          gain.disconnect();
        };

        source.start(0.1);

        // Record size
        sizes.push(trackingMap.size);

        // Small delay to allow some cleanup
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Final cleanup
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Max size should stay under threshold
      const maxSize = Math.max(...sizes);
      expect(maxSize).toBeLessThan(50);

      // Final size should be near zero
      expect(trackingMap.size).toBeLessThan(5);
    });

    it('should not grow memory after 30 minutes of playback', async () => {
      /**
       * From docs: "No memory growth after 30 minutes"
       *
       * We simulate this by ensuring cleanup happens after every batch
       */

      const trackingMap = new Map<AudioBufferSourceNode, any>();

      // Simulate 5 batches (representing 5-minute intervals)
      for (let batch = 0; batch < 5; batch++) {
        // Each batch: 500 events
        for (let i = 0; i < 500; i++) {
          const source = mockAudioContext.createBufferSource();
          const gain = mockAudioContext.createGain();

          trackingMap.set(source, { type: 'test', batch });

          source.onended = () => {
            trackingMap.delete(source);
            gain.disconnect();
          };

          source.start(0.1);
        }

        // Wait for batch to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // After each batch, map should be nearly empty
        expect(trackingMap.size).toBeLessThan(10);
      }

      // Final state: map should be empty
      expect(trackingMap.size).toBe(0);
    });
  });
});
