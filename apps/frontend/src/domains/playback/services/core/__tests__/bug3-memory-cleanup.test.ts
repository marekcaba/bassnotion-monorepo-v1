/**
 * Bug #3: Memory Leak Tests - Simple Integration Tests
 *
 * These tests verify the core behavior: AudioBufferSourceNode cleanup via onended callbacks.
 * We test the pattern, not the full scheduler implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Bug #3: Memory Leak Prevention', () => {
  let mockAudioContext: AudioContext;
  let createdSources: AudioBufferSourceNode[];
  let onendedCallbacks: Map<AudioBufferSourceNode, (() => void) | null>;

  beforeEach(() => {
    createdSources = [];
    onendedCallbacks = new Map();

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
    const createMockGain = () =>
      ({
        gain: { value: 1.0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }) as unknown as GainNode;

    // Create mock AudioContext
    mockAudioContext = {
      currentTime: 0,
      sampleRate: 48000,
      createBufferSource: vi.fn(createMockSource),
      createGain: vi.fn(createMockGain),
    } as unknown as AudioContext;
  });

  describe('Core Cleanup Pattern', () => {
    it('should remove sources from tracking map when onended fires', async () => {
      const trackingMap = new Map<AudioBufferSourceNode, any>();

      // Create source
      const source = mockAudioContext.createBufferSource();
      const gain = mockAudioContext.createGain();

      // Add to tracking map
      trackingMap.set(source, { type: 'harmony', noteId: 'C4' });

      // Register cleanup callback (THIS IS THE FIX)
      source.onended = () => {
        trackingMap.delete(source);
        gain.disconnect();
      };

      // Start playback
      source.start(0.1);

      // Before onended: source is tracked
      expect(trackingMap.size).toBe(1);

      // Wait for onended to fire
      await new Promise((resolve) => setTimeout(resolve, 50));

      // After onended: source removed
      expect(trackingMap.size).toBe(0);
      expect(gain.disconnect).toHaveBeenCalled();
    });

    it('should handle multiple sources independently', async () => {
      const trackingMap = new Map<AudioBufferSourceNode, any>();

      // Create 10 sources
      const sources = Array.from({ length: 10 }, () => {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        trackingMap.set(source, { type: 'test' });

        source.onended = () => {
          trackingMap.delete(source);
          gain.disconnect();
        };

        source.start(0.1);
        return source;
      });

      // All sources tracked
      expect(trackingMap.size).toBe(10);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));

      // All sources removed
      expect(trackingMap.size).toBe(0);
    });

    it('should clean up nested tracking structures', async () => {
      // Simulates activeHarmonySources structure
      const chordMap = new Map<
        string,
        Array<{ source: AudioBufferSourceNode; gain: GainNode }>
      >();

      const chordId = 'chord-0';
      const chordSources: Array<{
        source: AudioBufferSourceNode;
        gain: GainNode;
      }> = [];

      // Create 3 notes in a chord
      for (let i = 0; i < 3; i++) {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        chordSources.push({ source, gain });

        source.onended = () => {
          gain.disconnect();

          // Remove from chord array
          const sources = chordMap.get(chordId);
          if (sources) {
            const index = sources.findIndex((s) => s.source === source);
            if (index !== -1) {
              sources.splice(index, 1);
            }
            // Clean up empty chord
            if (sources.length === 0) {
              chordMap.delete(chordId);
            }
          }
        };

        source.start(0.1);
      }

      chordMap.set(chordId, chordSources);

      // Chord tracked
      expect(chordMap.size).toBe(1);
      expect(chordMap.get(chordId)?.length).toBe(3);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Chord completely removed
      expect(chordMap.size).toBe(0);
    });
  });

  describe('Memory Stability Simulation', () => {
    it('should not accumulate memory during 100 events', async () => {
      const trackingMap = new Map<AudioBufferSourceNode, any>();

      // Schedule 100 events
      for (let i = 0; i < 100; i++) {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        trackingMap.set(source, { event: i });

        source.onended = () => {
          trackingMap.delete(source);
          gain.disconnect();
        };

        source.start(0.1);
      }

      // All sources created
      expect(createdSources.length).toBe(100);

      // Wait for all to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // All cleaned up
      expect(trackingMap.size).toBe(0);
    });

    it('should maintain small map size during continuous playback', async () => {
      const trackingMap = new Map<AudioBufferSourceNode, any>();
      const maxSizes: number[] = [];

      // Simulate continuous playback
      for (let i = 0; i < 50; i++) {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        trackingMap.set(source, { event: i });

        source.onended = () => {
          trackingMap.delete(source);
          gain.disconnect();
        };

        source.start(0.1);

        // Record max size
        maxSizes.push(trackingMap.size);

        // Small delay to allow cleanup
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      // Wait for final cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Max size should stay reasonable (< 10)
      const peakSize = Math.max(...maxSizes);
      expect(peakSize).toBeLessThan(10);

      // Final size should be near zero
      expect(trackingMap.size).toBeLessThan(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle disconnect errors gracefully', async () => {
      const trackingMap = new Map<AudioBufferSourceNode, any>();

      const source = mockAudioContext.createBufferSource();
      const gain = mockAudioContext.createGain();

      // Make disconnect throw
      (gain.disconnect as any).mockImplementation(() => {
        throw new Error('Already disconnected');
      });

      trackingMap.set(source, { type: 'test' });

      source.onended = () => {
        trackingMap.delete(source);

        // Handle disconnect error
        try {
          gain.disconnect();
        } catch (e) {
          // Cleanup continues despite error
        }
      };

      source.start(0.1);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Source still removed despite disconnect error
      expect(trackingMap.size).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should clean up 1000 sources quickly', async () => {
      const trackingMap = new Map<AudioBufferSourceNode, any>();

      const startTime = performance.now();

      // Create 1000 sources
      for (let i = 0; i < 1000; i++) {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        trackingMap.set(source, { event: i });

        source.onended = () => {
          trackingMap.delete(source);
          gain.disconnect();
        };

        source.start(0.1);
      }

      const setupTime = performance.now() - startTime;

      // Setup should be fast
      expect(setupTime).toBeLessThan(500);

      // Wait for cleanup
      const cleanupStart = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const cleanupTime = performance.now() - cleanupStart;

      // All cleaned up
      expect(trackingMap.size).toBe(0);

      // Cleanup should be fast
      expect(cleanupTime).toBeLessThan(500);
    });
  });

  describe('Success Criteria (Bug #3 Plan)', () => {
    it('should keep active sources under 50 during playback', async () => {
      const trackingMap = new Map<AudioBufferSourceNode, any>();
      const sizes: number[] = [];

      // Simulate realistic playback with overlap
      for (let i = 0; i < 200; i++) {
        const source = mockAudioContext.createBufferSource();
        const gain = mockAudioContext.createGain();

        trackingMap.set(source, { event: i });

        source.onended = () => {
          trackingMap.delete(source);
          gain.disconnect();
        };

        source.start(0.1);

        sizes.push(trackingMap.size);

        // Very small delay
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Peak size should be under threshold
      const maxSize = Math.max(...sizes);
      expect(maxSize).toBeLessThan(50);

      // Final state nearly empty
      expect(trackingMap.size).toBeLessThan(5);
    });
  });
});
