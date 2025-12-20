/**
 * Drum Editor Playback Hook - Unit Tests
 *
 * Tests the audio playback functionality for the drum pattern editor.
 * Uses mocked Web Audio API for testing sample loading and playback.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { DrumHit, MidiDrumType } from '../../types.js';

// Mock environment variable BEFORE any imports that use it
vi.stubGlobal('process', {
  ...process,
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  },
});

// Mock AudioContext and related Web Audio API
const mockAudioBuffer = {
  duration: 1,
  length: 44100,
  numberOfChannels: 2,
  sampleRate: 44100,
  getChannelData: vi.fn(() => new Float32Array(44100)),
  copyFromChannel: vi.fn(),
  copyToChannel: vi.fn(),
};

const createMockGainNode = () => ({
  connect: vi.fn().mockReturnThis(),
  disconnect: vi.fn(),
  gain: { value: 1, setValueAtTime: vi.fn() },
});

const createMockBufferSource = () => ({
  connect: vi.fn().mockReturnThis(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  buffer: null as any,
  loop: false,
  onended: null as any,
});

const createMockAudioContext = () => ({
  state: 'running' as AudioContextState,
  currentTime: 0,
  sampleRate: 44100,
  destination: {
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
  createGain: vi.fn(() => createMockGainNode()),
  createBufferSource: vi.fn(() => createMockBufferSource()),
  decodeAudioData: vi.fn().mockResolvedValue(mockAudioBuffer),
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
});

let mockAudioContext: ReturnType<typeof createMockAudioContext>;

// Mock fetch globally using vi.stubGlobal
const mockFetchResponse = () =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
  });

// Now import the hook
import { useDrumEditorPlayback } from '../useDrumEditorPlayback.js';

describe('useDrumEditorPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock for each test
    mockAudioContext = createMockAudioContext();

    // Mock AudioContext constructor
    vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));

    // Mock fetch
    vi.stubGlobal('fetch', vi.fn(mockFetchResponse));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Re-stub the process.env for next test
    vi.stubGlobal('process', {
      ...process,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      },
    });
  });

  describe('Initialization', () => {
    it('should initialize with loading state', async () => {
      const { result } = renderHook(() => useDrumEditorPlayback());

      // Initially loading
      expect(result.current.state.isLoading).toBe(true);
    });

    it('should become ready after samples load', async () => {
      const { result } = renderHook(() => useDrumEditorPlayback());

      await waitFor(
        () => {
          expect(result.current.state.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      // Should be ready with no error if fetch succeeded
      expect(result.current.state.isReady).toBe(true);
      expect(result.current.state.error).toBeNull();
    });

    it('should handle sample loading errors gracefully', async () => {
      // Override fetch to fail
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 404,
          })
        )
      );

      const { result } = renderHook(() => useDrumEditorPlayback());

      await waitFor(
        () => {
          expect(result.current.state.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      // Should not be ready when fetch fails
      expect(result.current.state.isReady).toBe(false);
    });
  });

  describe('previewHit', () => {
    it('should call createBufferSource when previewing a hit', async () => {
      const { result } = renderHook(() => useDrumEditorPlayback());

      await waitFor(
        () => {
          expect(result.current.state.isReady).toBe(true);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        result.current.previewHit('kick');
      });

      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });

    it('should create gain node for velocity control', async () => {
      const { result } = renderHook(() => useDrumEditorPlayback());

      await waitFor(
        () => {
          expect(result.current.state.isReady).toBe(true);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        result.current.previewHit('snare', 64);
      });

      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should resume AudioContext if suspended', async () => {
      // Set AudioContext to suspended state
      mockAudioContext.state = 'suspended';

      const { result } = renderHook(() => useDrumEditorPlayback());

      await waitFor(
        () => {
          expect(result.current.state.isReady).toBe(true);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        result.current.previewHit('kick');
      });

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });
  });

  describe('Pattern Playback', () => {
    const testPattern: DrumHit[] = [
      {
        id: 'hit-1',
        drum: 'kick',
        velocity: 100,
        position: { measure: 0, beat: 0, subdivision: 0, tick: 0 },
        durationTicks: 120,
        midiNote: 36,
      },
      {
        id: 'hit-2',
        drum: 'snare',
        velocity: 100,
        position: { measure: 0, beat: 1, subdivision: 0, tick: 0 },
        durationTicks: 120,
        midiNote: 38,
      },
    ];

    it('should set isPlaying to true when play is called', async () => {
      const { result } = renderHook(() => useDrumEditorPlayback());

      await waitFor(
        () => {
          expect(result.current.state.isReady).toBe(true);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        result.current.play(testPattern, 120);
      });

      expect(result.current.state.isPlaying).toBe(true);
    });

    it('should stop playback and reset state', async () => {
      const { result } = renderHook(() => useDrumEditorPlayback());

      await waitFor(
        () => {
          expect(result.current.state.isReady).toBe(true);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        result.current.play(testPattern, 120);
      });

      expect(result.current.state.isPlaying).toBe(true);

      await act(async () => {
        result.current.stop();
      });

      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.playheadTick).toBe(0);
    });

    it('should not play empty pattern', async () => {
      const { result } = renderHook(() => useDrumEditorPlayback());

      await waitFor(
        () => {
          expect(result.current.state.isReady).toBe(true);
        },
        { timeout: 3000 }
      );

      // Clear mocks to count only calls from empty pattern play
      vi.clearAllMocks();

      await act(async () => {
        result.current.play([], 120);
      });

      // Should not have scheduled any buffer sources for empty pattern
      expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should close AudioContext on unmount', async () => {
      const { result, unmount } = renderHook(() => useDrumEditorPlayback());

      await waitFor(
        () => {
          expect(result.current.state.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      unmount();

      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });

  describe('Drum Type Mapping', () => {
    it('should support various drum types', async () => {
      const { result } = renderHook(() => useDrumEditorPlayback());

      await waitFor(
        () => {
          expect(result.current.state.isReady).toBe(true);
        },
        { timeout: 3000 }
      );

      const drumTypes: MidiDrumType[] = ['kick', 'snare', 'hihat_closed'];

      for (const drum of drumTypes) {
        await act(async () => {
          result.current.previewHit(drum);
        });
      }

      // Should have created buffer sources for each preview
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });
  });
});
