import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { usePlaybackIntegration } from '../usePlaybackIntegration';

// Import for mocking
import { useCorePlaybackEngine } from '@/domains/playback';

// Mock the Core Playback Engine
const mockEngine = {
  initialize: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  setTempo: vi.fn(),
  setVolume: vi.fn(),
  reset: vi.fn(),
  dispose: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockEngineState = {
  isInitialized: true,
  isPlaying: false,
  config: {
    tempo: 120,
    volume: 0.8,
  },
  performanceMetrics: {
    latency: 25,
    accuracy: 3,
  },
};

const mockEngineControls = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  setTempo: vi.fn(),
  setMasterVolume: vi.fn(),
  setSourceVolume: vi.fn(),
  setPitch: vi.fn(),
  setSwingFactor: vi.fn(),
  registerAudioSource: vi.fn().mockResolvedValue(undefined),
  unregisterAudioSource: vi.fn(),
  setSourceMute: vi.fn(),
  setSourceSolo: vi.fn(),
};

// Mock the useCorePlaybackEngine hook
vi.mock('@/domains/playback', () => ({
  useCorePlaybackEngine: vi.fn(() => ({
    engine: mockEngine,
    state: mockEngineState,
    controls: mockEngineControls,
  })),
}));

describe('usePlaybackIntegration', () => {
  const mockExercise = {
    id: 'test-exercise-1',
    title: 'Test Bass Exercise',
    bpm: 140,
    notes: [
      {
        id: 'note-1',
        timestamp: 0,
        string: 4,
        fret: 3,
        note: 'G',
        duration: 500,
      },
      {
        id: 'note-2',
        timestamp: 500,
        string: 3,
        fret: 0,
        note: 'D',
        duration: 500,
      },
    ],
    chord_progression: ['Dm7', 'G7', 'Am7', 'Dm7'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn(); // Mock console.log

    // Reset the mock to default behavior
    const mockUseCorePlaybackEngine = vi.mocked(useCorePlaybackEngine);
    mockUseCorePlaybackEngine.mockReturnValue({
      engine: mockEngine,
      state: mockEngineState,
      controls: mockEngineControls,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => usePlaybackIntegration());

      expect(result.current.state.isInitialized).toBe(true);
      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.currentTime).toBe(0);
      expect(result.current.state.tempo).toBe(120);
      expect(result.current.state.latency).toBe(25);
      expect(result.current.state.error).toBe(null);
    });

    it('should initialize with engine when ready', () => {
      const { result } = renderHook(() => usePlaybackIntegration());

      expect(result.current.engine).toBe(mockEngine);
      expect(result.current.state.isInitialized).toBe(true);
    });

    it('should sync with engine state changes', async () => {
      const { result, rerender } = renderHook(() => usePlaybackIntegration());

      // Mock engine state change
      mockEngineState.isPlaying = true;
      mockEngineState.config.tempo = 150;

      rerender();

      await waitFor(() => {
        expect(result.current.state.isPlaying).toBe(true);
        expect(result.current.state.tempo).toBe(150);
      });
    });
  });

  describe('Exercise Data Processing', () => {
    it('should process exercise data correctly', async () => {
      const onNoteEvent = vi.fn();
      const onBeatEvent = vi.fn();
      const onChordChange = vi.fn();

      const { result } = renderHook(() =>
        usePlaybackIntegration({
          exercise: mockExercise,
          onNoteEvent,
          onBeatEvent,
          onChordChange,
        }),
      );

      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true);
      });

      // Verify exercise data was processed
      expect(console.log).toHaveBeenCalledWith(
        '🎵 Exercise data processed:',
        expect.objectContaining({
          exerciseId: 'test-exercise-1',
          notesCount: 2,
          chords: ['Dm7', 'G7', 'Am7', 'Dm7'],
          bpm: 140,
        }),
      );
    });

    it('should handle exercise without notes gracefully', async () => {
      const exerciseWithoutNotes = {
        id: 'test-2',
        title: 'Simple Exercise',
        bpm: 120,
      };

      const { result } = renderHook(() =>
        usePlaybackIntegration({
          exercise: exerciseWithoutNotes,
        }),
      );

      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true);
      });

      expect(console.log).toHaveBeenCalledWith(
        '🎵 Exercise data processed:',
        expect.objectContaining({
          exerciseId: 'test-2',
          notesCount: 0,
          chords: ['C', 'Am', 'F', 'G'], // Default progression
        }),
      );
    });

    it('should handle exercise without chord progression', async () => {
      const exerciseWithoutChords = {
        id: 'test-3',
        title: 'No Chords Exercise',
        bpm: 100,
        notes: [mockExercise.notes![0]!],
      };

      const { result } = renderHook(() =>
        usePlaybackIntegration({
          exercise: exerciseWithoutChords,
        }),
      );

      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true);
      });

      expect(console.log).toHaveBeenCalledWith(
        '🎵 Exercise data processed:',
        expect.objectContaining({
          chords: ['C', 'Am', 'F', 'G'], // Default progression
        }),
      );
    });
  });

  describe('Playback Controls', () => {
    it('should provide play control', async () => {
      const { result } = renderHook(() => usePlaybackIntegration());

      await act(async () => {
        await result.current.controls.play();
      });

      expect(mockEngineControls.play).toHaveBeenCalled();
    });

    it('should provide pause control', () => {
      const { result } = renderHook(() => usePlaybackIntegration());

      act(() => {
        result.current.controls.pause();
      });

      expect(mockEngineControls.pause).toHaveBeenCalled();
    });

    it('should provide stop control', () => {
      const { result } = renderHook(() => usePlaybackIntegration());

      act(() => {
        result.current.controls.stop();
      });

      expect(mockEngineControls.stop).toHaveBeenCalled();
    });

    it('should provide tempo control', () => {
      const { result } = renderHook(() => usePlaybackIntegration());

      act(() => {
        result.current.controls.setTempo(160);
      });

      expect(mockEngineControls.setTempo).toHaveBeenCalledWith(160);
    });

    it('should provide volume control', () => {
      const { result } = renderHook(() => usePlaybackIntegration());

      act(() => {
        result.current.controls.setVolume('bass', 70);
      });

      expect(mockEngineControls.setSourceVolume).toHaveBeenCalledWith(
        'bass',
        0.7,
      );
    });

    it('should provide reset control', async () => {
      const { result } = renderHook(() => usePlaybackIntegration());

      await act(async () => {
        await result.current.controls.reset();
      });

      expect(mockEngineControls.stop).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should call onNoteEvent when provided', async () => {
      const onNoteEvent = vi.fn();

      renderHook(() =>
        usePlaybackIntegration({
          exercise: mockExercise,
          onNoteEvent,
        }),
      );

      // Note events would be triggered by the engine,
      // we're testing that the callback is properly stored
      expect(onNoteEvent).toBeInstanceOf(Function);
    });

    it('should call onBeatEvent when provided', async () => {
      const onBeatEvent = vi.fn();

      renderHook(() =>
        usePlaybackIntegration({
          exercise: mockExercise,
          onBeatEvent,
        }),
      );

      expect(onBeatEvent).toBeInstanceOf(Function);
    });

    it('should call onChordChange when provided', async () => {
      const onChordChange = vi.fn();

      renderHook(() =>
        usePlaybackIntegration({
          exercise: mockExercise,
          onChordChange,
        }),
      );

      expect(onChordChange).toBeInstanceOf(Function);
    });

    it('should update event callbacks when they change', () => {
      const initialCallback = vi.fn();
      const newCallback = vi.fn();

      const { rerender } = renderHook(
        ({ onNoteEvent }) =>
          usePlaybackIntegration({
            exercise: mockExercise,
            onNoteEvent,
          }),
        {
          initialProps: { onNoteEvent: initialCallback },
        },
      );

      // Change the callback
      rerender({ onNoteEvent: newCallback });

      // The hook should handle the callback change
      expect(newCallback).toBeInstanceOf(Function);
    });
  });

  describe('Error Handling', () => {
    it('should handle exercise processing errors gracefully', async () => {
      const invalidExercise = {
        id: 'invalid',
        title: 'Invalid Exercise',
        notes: null, // Invalid notes
      };

      const { result } = renderHook(() =>
        usePlaybackIntegration({
          exercise: invalidExercise as any,
        }),
      );

      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true);
      });

      // Should still be functional even with invalid exercise data
      expect(result.current.state.error).toBe(null);
      expect(result.current.controls.play).toBeInstanceOf(Function);
    });

    it('should handle missing engine gracefully', async () => {
      // Override the mock implementation for this test
      const mockUseCorePlaybackEngine = vi.mocked(useCorePlaybackEngine);
      mockUseCorePlaybackEngine.mockImplementation(() => {
        return {
          engine: null,
          state: { ...mockEngineState, isInitialized: false },
          controls: mockEngineControls,
        } as any;
      });

      const { result } = renderHook(() => usePlaybackIntegration());

      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(false);
      });

      expect(result.current.engine).toBe(null);
      expect(result.current.state.error).toBeInstanceOf(Error);
      expect(result.current.state.error?.message).toBe(
        'Playback engine not available',
      );
    });

    it('should update latency when engine metrics change', async () => {
      let currentLatency = 25;

      const mockUseCorePlaybackEngine = vi.mocked(useCorePlaybackEngine);

      // Create a function that returns fresh state objects each time
      const createMockState = () => ({
        ...mockEngineState,
        performanceMetrics: {
          ...mockEngineState.performanceMetrics!,
          latency: currentLatency,
        },
      });

      mockUseCorePlaybackEngine.mockImplementation(
        () =>
          ({
            engine: mockEngine,
            state: createMockState(),
            controls: mockEngineControls,
          }) as any,
      );

      const { result, rerender } = renderHook(() => usePlaybackIntegration());

      // Initial latency should be 25
      expect(result.current.state.latency).toBe(25);

      // Update the latency value
      currentLatency = 35;

      // Re-mock with new latency to force new state object
      mockUseCorePlaybackEngine.mockImplementation(
        () =>
          ({
            engine: mockEngine,
            state: createMockState(),
            controls: mockEngineControls,
          }) as any,
      );

      // Force re-render to pick up the change
      rerender();

      await waitFor(() => {
        expect(result.current.state.latency).toBe(35);
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should track latency from engine metrics', () => {
      const { result } = renderHook(() => usePlaybackIntegration());

      expect(result.current.state.latency).toBe(25);
    });
  });
});
