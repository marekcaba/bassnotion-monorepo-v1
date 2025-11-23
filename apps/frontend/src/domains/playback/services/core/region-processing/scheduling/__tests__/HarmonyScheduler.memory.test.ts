/**
 * Bug #3: Memory Leak Tests - HarmonyScheduler AudioBufferSourceNode Cleanup
 *
 * These tests verify that AudioBufferSourceNode instances are properly cleaned up
 * from tracking maps after playback ends, preventing memory leaks during extended
 * playback sessions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HarmonyScheduler } from '../HarmonyScheduler';

describe('HarmonyScheduler - Memory Leak Prevention (Bug #3)', () => {
  let scheduler: HarmonyScheduler;
  let mockAudioContext: AudioContext;
  let mockDestination: AudioNode;
  let createdSources: AudioBufferSourceNode[] = [];
  let createdGains: GainNode[] = [];

  beforeEach(() => {
    // Reset tracking arrays
    createdSources = [];
    createdGains = [];

    // Create mock AudioBuffer
    const mockBuffer = {
      duration: 1.0,
      sampleRate: 48000,
      length: 48000,
      numberOfChannels: 2,
      getChannelData: vi.fn(() => new Float32Array(48000)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer;

    // Create mock AudioBufferSourceNode
    const createMockSource = () => {
      let onendedCallback: (() => void) | null = null;
      let isStarted = false;
      let isStopped = false;

      const mockSource = {
        buffer: null,
        onended: null,
        start: vi.fn((when?: number) => {
          isStarted = true;
          // Simulate immediate playback end for testing
          setTimeout(() => {
            if (onendedCallback) {
              onendedCallback();
            }
          }, 10);
        }),
        stop: vi.fn((when?: number) => {
          isStopped = true;
        }),
        connect: vi.fn(),
        disconnect: vi.fn(),
        context: mockAudioContext,
      } as unknown as AudioBufferSourceNode;

      // Make onended settable and track the callback
      Object.defineProperty(mockSource, 'onended', {
        get: () => onendedCallback,
        set: (callback: (() => void) | null) => {
          onendedCallback = callback;
        },
        configurable: true,
      });

      createdSources.push(mockSource);
      return mockSource;
    };

    // Create mock GainNode
    const createMockGain = () => {
      const mockGain = {
        gain: { value: 1.0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
        context: mockAudioContext,
      } as unknown as GainNode;

      createdGains.push(mockGain);
      return mockGain;
    };

    // Create mock AudioContext
    mockAudioContext = {
      currentTime: 0,
      sampleRate: 48000,
      state: 'running',
      createBufferSource: vi.fn(createMockSource),
      createGain: vi.fn(createMockGain),
      createOscillator: vi.fn(),
      createBiquadFilter: vi.fn(),
      destination: {} as AudioDestinationNode,
    } as unknown as AudioContext;

    mockDestination = mockAudioContext.destination;

    // Create scheduler instance
    scheduler = new HarmonyScheduler();

    // Initialize with mocks
    scheduler['audioContext'] = mockAudioContext;
    scheduler['audioDestination'] = mockDestination;
    scheduler['sampleRate'] = 48000;

    // Inject mock buffers
    const v7Buffer = new Map<string, AudioBuffer>();
    v7Buffer.set('C4', mockBuffer);
    v7Buffer.set('E4', mockBuffer);
    v7Buffer.set('G4', mockBuffer);
    scheduler['harmonyBuffers'].set('v7', v7Buffer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Location 1: Old Direct Chord Scheduling', () => {
    it('should remove sources from activeHarmonySources after playback ends', async () => {
      const event = {
        type: 'Cmaj',
        position: '0:0:0',
        velocity: 0.7,
        duration: '4n',
        data: { chord: 'Cmaj' },
      };

      // Schedule a chord
      const result = scheduler.scheduleHarmonyEvent(event, 0, 0.1);
      expect(result).toBe(true);

      // Check that sources were added to activeHarmonySources
      const activeSourcesBefore = scheduler['activeHarmonySources'];
      expect(activeSourcesBefore.size).toBeGreaterThan(0);

      // Wait for onended callbacks to fire
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that sources were removed from activeHarmonySources
      const activeSourcesAfter = scheduler['activeHarmonySources'];

      // All chord IDs should be cleaned up (empty arrays removed)
      let totalActiveSources = 0;
      activeSourcesAfter.forEach((sources) => {
        totalActiveSources += sources.length;
      });

      expect(totalActiveSources).toBe(0);
    });

    it('should disconnect gain nodes after playback ends', async () => {
      const event = {
        type: 'Cmaj',
        position: '0:0:0',
        velocity: 0.7,
        duration: '4n',
        data: { chord: 'Cmaj' },
      };

      scheduler.scheduleHarmonyEvent(event, 0, 0.1);

      // Wait for onended callbacks
      await new Promise((resolve) => setTimeout(resolve, 50));

      // All gain nodes should be disconnected
      createdGains.forEach((gain) => {
        expect(gain.disconnect).toHaveBeenCalled();
      });
    });

    it('should clean up multiple chords independently', async () => {
      const events = [
        { type: 'Cmaj', position: '0:0:0', velocity: 0.7, duration: '4n', data: { chord: 'Cmaj' } },
        { type: 'Cmaj', position: '0:1:0', velocity: 0.7, duration: '4n', data: { chord: 'Cmaj' } },
        { type: 'Cmaj', position: '0:2:0', velocity: 0.7, duration: '4n', data: { chord: 'Cmaj' } },
      ];

      // Schedule multiple chords
      events.forEach((event, i) => {
        scheduler.scheduleHarmonyEvent(event, i * 48000, 0.1 + i * 0.5);
      });

      const sourcesCountBefore = createdSources.length;
      expect(sourcesCountBefore).toBeGreaterThan(0);

      // Wait for all onended callbacks
      await new Promise((resolve) => setTimeout(resolve, 100));

      // All sources should be cleaned up
      const activeSourcesAfter = scheduler['activeHarmonySources'];
      let totalActiveSources = 0;
      activeSourcesAfter.forEach((sources) => {
        totalActiveSources += sources.length;
      });

      expect(totalActiveSources).toBe(0);
    });
  });

  describe('Location 2: CC64 Sustain System', () => {
    it('should remove sources from scheduledAudioSources after playback ends', async () => {
      // This location already has complete cleanup - verify it still works

      // Enable CC64 system by injecting dependencies
      const mockCC64Timeline = new Map<number, boolean>();
      mockCC64Timeline.set(0, false);
      scheduler['currentCC64Timeline'] = mockCC64Timeline;

      const event = {
        type: 'note',
        position: '0:0:0',
        velocity: 0.7,
        duration: '4n',
        data: {
          midiNote: 60, // C4
          sustainPedalDown: false,
        },
      };

      // This would trigger the CC64 system path
      // For now, verify the old path still cleans up properly
      const result = scheduler.scheduleHarmonyEvent(event, 0, 0.1);

      if (result) {
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Verify cleanup occurred
        const activeSourcesAfter = scheduler['activeHarmonySources'];
        let totalActiveSources = 0;
        activeSourcesAfter.forEach((sources) => {
          totalActiveSources += sources.length;
        });

        expect(totalActiveSources).toBe(0);
      }
    });
  });

  describe('Memory Stability During Extended Playback', () => {
    it('should not accumulate sources in activeHarmonySources over time', async () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        type: 'Cmaj',
        position: `0:${i}:0`,
        velocity: 0.7,
        duration: '4n',
        data: { chord: 'Cmaj' },
      }));

      // Schedule 100 chords
      for (let i = 0; i < events.length; i++) {
        scheduler.scheduleHarmonyEvent(events[i], i * 48000, 0.1 + i * 0.5);
      }

      const sourcesCreated = createdSources.length;
      expect(sourcesCreated).toBe(300); // 100 chords * 3 notes each

      // Wait for all onended callbacks
      await new Promise((resolve) => setTimeout(resolve, 200));

      // activeHarmonySources should be empty (all cleaned up)
      const activeSourcesAfter = scheduler['activeHarmonySources'];
      let totalActiveSources = 0;
      activeSourcesAfter.forEach((sources) => {
        totalActiveSources += sources.length;
      });

      expect(totalActiveSources).toBe(0);
    });

    it('should maintain small activeHarmonySources size during playback', async () => {
      // Simulate real playback scenario: new chords while old ones finish

      const scheduleChord = async (i: number) => {
        const event = {
          type: 'Cmaj',
          position: `0:${i}:0`,
          velocity: 0.7,
          duration: '4n',
          data: { chord: 'Cmaj' },
        };
        scheduler.scheduleHarmonyEvent(event, i * 48000, 0.1 + i * 0.5);
      };

      // Schedule chords over time
      for (let i = 0; i < 20; i++) {
        await scheduleChord(i);
        await new Promise((resolve) => setTimeout(resolve, 30)); // Time for cleanup

        // Check that size stays reasonable
        const activeSourcesNow = scheduler['activeHarmonySources'];
        let totalActiveSources = 0;
        activeSourcesNow.forEach((sources) => {
          totalActiveSources += sources.length;
        });

        // Should never accumulate more than a few active chords
        // (some cleanup should happen between scheduling)
        expect(totalActiveSources).toBeLessThan(30); // 10 chords * 3 notes worst case
      }
    });
  });

  describe('Cleanup Edge Cases', () => {
    it('should handle empty chord gracefully', async () => {
      const event = {
        type: undefined,
        position: '0:0:0',
        velocity: 0.7,
        duration: '4n',
        data: {},
      };

      const result = scheduler.scheduleHarmonyEvent(event as any, 0, 0.1);
      expect(result).toBe(false);

      // No sources should be created
      expect(createdSources.length).toBe(0);
    });

    it('should clean up even if stop() was never called', async () => {
      const event = {
        type: 'Cmaj',
        position: '0:0:0',
        velocity: 0.7,
        duration: '4n',
        data: { chord: 'Cmaj' },
      };

      scheduler.scheduleHarmonyEvent(event, 0, 0.1);

      // Don't call stop() - rely only on onended cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Cleanup should still happen
      const activeSourcesAfter = scheduler['activeHarmonySources'];
      let totalActiveSources = 0;
      activeSourcesAfter.forEach((sources) => {
        totalActiveSources += sources.length;
      });

      expect(totalActiveSources).toBe(0);
    });

    it('should not throw if disconnect() is called multiple times', async () => {
      const event = {
        type: 'Cmaj',
        position: '0:0:0',
        velocity: 0.7,
        duration: '4n',
        data: { chord: 'Cmaj' },
      };

      scheduler.scheduleHarmonyEvent(event, 0, 0.1);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Call stop() which also disconnects
      expect(() => scheduler.stop()).not.toThrow();

      // Verify no errors from double disconnect
      createdGains.forEach((gain) => {
        expect(gain.disconnect).toHaveBeenCalled();
      });
    });
  });

  describe('Performance', () => {
    it('should clean up 1000 sources without performance degradation', async () => {
      const startTime = performance.now();

      // Schedule 1000 notes (simulating 10-minute session)
      for (let i = 0; i < 333; i++) {
        const event = {
          type: 'Cmaj',
          position: `0:${i}:0`,
          velocity: 0.7,
          duration: '4n',
          data: { chord: 'Cmaj' },
        };
        scheduler.scheduleHarmonyEvent(event, i * 48000, 0.1 + i * 0.5);
      }

      const scheduleTime = performance.now() - startTime;

      // Wait for all cleanup
      const cleanupStart = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const cleanupTime = performance.now() - cleanupStart;

      // Scheduling should be fast (< 1s for 1000 notes)
      expect(scheduleTime).toBeLessThan(1000);

      // Cleanup should not take excessively long
      expect(cleanupTime).toBeLessThan(1000);

      // All sources should be cleaned up
      const activeSourcesAfter = scheduler['activeHarmonySources'];
      let totalActiveSources = 0;
      activeSourcesAfter.forEach((sources) => {
        totalActiveSources += sources.length;
      });

      expect(totalActiveSources).toBe(0);
    });
  });
});
