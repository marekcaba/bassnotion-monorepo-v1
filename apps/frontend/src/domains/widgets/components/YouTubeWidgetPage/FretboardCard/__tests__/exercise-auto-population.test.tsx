import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ExerciseNote } from '@bassnotion/contracts';
import { useFretboardExercise } from '../hooks/useFretboardExercise';

// Mock the useAudioFretboard hook
vi.mock('../../../hooks/useAudioFretboard', () => ({
  useAudioFretboard: () => ({
    stringConfigs: {
      4: ['G', 'D', 'A', 'E'],
      5: ['G', 'D', 'A', 'E', 'B'],
    },
    triggerNote: vi.fn(),
    createNoteEvent: vi.fn(),
    isCurrentNote: vi.fn().mockReturnValue(false),
    playbackIntegration: {},
  }),
}));

describe('Exercise Auto-Population', () => {
  const mockExercise = {
    id: 'test-exercise-1',
    title: 'Test Exercise',
    bpm: 120,
    notes: [
      {
        id: 'note-1',
        string: 4, // G string (0-indexed: 3)
        fret: 3, // 3rd fret
        note: 'C',
        color: 'blue',
        duration: 'quarter',
        position: { measure: 1, beat: 1, subdivision: 0 },
      },
      {
        id: 'note-2',
        string: 3, // D string (0-indexed: 2)
        fret: 0, // Open string
        note: 'D',
        color: 'green',
        duration: 'quarter',
        position: { measure: 1, beat: 2, subdivision: 0 },
      },
      {
        id: 'note-3',
        string: 2, // A string (0-indexed: 1)
        fret: 5, // 5th fret
        note: 'D',
        color: 'red',
        duration: 'quarter',
        position: { measure: 1, beat: 3, subdivision: 0 },
      },
    ] as ExerciseNote[],
  };

  const mockSyncProps = {
    selectedExercise: mockExercise,
    sync: {
      actions: {
        emitEvent: vi.fn(),
      },
    },
  };

  let mockSetSelectedDots: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetSelectedDots = vi.fn();
    vi.clearAllMocks();
  });

  it('should automatically populate fretboard with exercise notes', async () => {
    const { result: _result } = renderHook(() =>
      useFretboardExercise(mockSyncProps as any, {
        setSelectedDots: mockSetSelectedDots,
        autoPopulateOnExerciseLoad: true,
      }),
    );

    // Wait for useEffect to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Should have called setSelectedDots with converted exercise notes
    expect(mockSetSelectedDots).toHaveBeenCalledWith(
      new Map([
        ['3,3', [1]], // G string (index 3), 3rd fret, order 1
        ['2,open', [2]], // D string (index 2), open, order 2
        ['1,5', [3]], // A string (index 1), 5th fret, order 3
      ]),
    );
  });

  it('should convert exercise notes to fretboard format correctly', () => {
    const { result } = renderHook(() =>
      useFretboardExercise(mockSyncProps as any, {
        setSelectedDots: mockSetSelectedDots,
        autoPopulateOnExerciseLoad: false, // Disable auto-population for this test
      }),
    );

    const convertedDots = result.current.convertExerciseNotesToSelectedDots(
      mockExercise.notes,
    );

    expect(convertedDots).toEqual(
      new Map([
        ['3,3', [1]], // string 4 -> index 3, fret 3, order 1
        ['2,open', [2]], // string 3 -> index 2, fret 0 -> 'open', order 2
        ['1,5', [3]], // string 2 -> index 1, fret 5, order 3
      ]),
    );
  });

  it('should handle empty exercise notes', () => {
    const emptySyncProps = {
      selectedExercise: { ...mockExercise, notes: [] },
      sync: mockSyncProps.sync,
    };

    const { result } = renderHook(() =>
      useFretboardExercise(emptySyncProps as any, {
        setSelectedDots: mockSetSelectedDots,
        autoPopulateOnExerciseLoad: true,
      }),
    );

    const convertedDots = result.current.convertExerciseNotesToSelectedDots([]);
    expect(convertedDots).toEqual(new Map());
  });

  it('should handle no exercise selected', async () => {
    const noExerciseSyncProps = {
      selectedExercise: null,
      sync: mockSyncProps.sync,
    };

    renderHook(() =>
      useFretboardExercise(noExerciseSyncProps as any, {
        setSelectedDots: mockSetSelectedDots,
        autoPopulateOnExerciseLoad: true,
      }),
    );

    // Wait for useEffect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Should not call setSelectedDots when no exercise is selected
    expect(mockSetSelectedDots).not.toHaveBeenCalled();
  });

  it('should disable auto-population when flag is false', async () => {
    renderHook(() =>
      useFretboardExercise(mockSyncProps as any, {
        setSelectedDots: mockSetSelectedDots,
        autoPopulateOnExerciseLoad: false,
      }),
    );

    // Wait for useEffect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Should not call setSelectedDots when auto-population is disabled
    expect(mockSetSelectedDots).not.toHaveBeenCalled();
  });

  it('should emit bassline sync event after auto-population', async () => {
    const { result: _result } = renderHook(() =>
      useFretboardExercise(mockSyncProps as any, {
        setSelectedDots: mockSetSelectedDots,
        autoPopulateOnExerciseLoad: true,
      }),
    );

    // Wait for useEffect and timeout
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    // Should have called the sync emit function
    expect(mockSyncProps.sync.actions.emitEvent).toHaveBeenCalledWith(
      'CUSTOM_BASSLINE',
      expect.objectContaining({
        source: 'interactive-fretboard',
        bassline: expect.any(Array),
      }),
    );
  });

  it('should handle string conversion correctly', () => {
    const testNotes: ExerciseNote[] = [
      {
        id: '1',
        string: 1,
        fret: 0,
        note: 'E',
        color: 'blue',
        duration: 'quarter',
        position: { measure: 1, beat: 1, subdivision: 0 },
      }, // E string (index 0), open
      {
        id: '2',
        string: 2,
        fret: 2,
        note: 'F#',
        color: 'green',
        duration: 'quarter',
        position: { measure: 1, beat: 2, subdivision: 0 },
      }, // A string (index 1), 2nd fret
      {
        id: '3',
        string: 3,
        fret: 7,
        note: 'A',
        color: 'red',
        duration: 'quarter',
        position: { measure: 1, beat: 3, subdivision: 0 },
      }, // D string (index 2), 7th fret
      {
        id: '4',
        string: 4,
        fret: 12,
        note: 'G',
        color: 'yellow',
        duration: 'quarter',
        position: { measure: 1, beat: 4, subdivision: 0 },
      }, // G string (index 3), 12th fret
      {
        id: '5',
        string: 5,
        fret: 5,
        note: 'D#',
        color: 'purple',
        duration: 'quarter',
        position: { measure: 2, beat: 1, subdivision: 0 },
      }, // B string (index 4), 5th fret
    ];

    const { result } = renderHook(() =>
      useFretboardExercise(mockSyncProps as any, {
        setSelectedDots: mockSetSelectedDots,
        autoPopulateOnExerciseLoad: false,
      }),
    );

    const convertedDots =
      result.current.convertExerciseNotesToSelectedDots(testNotes);

    expect(convertedDots).toEqual(
      new Map([
        ['0,open', [1]], // string 1 -> index 0, fret 0 -> 'open'
        ['1,2', [2]], // string 2 -> index 1, fret 2
        ['2,7', [3]], // string 3 -> index 2, fret 7
        ['3,12', [4]], // string 4 -> index 3, fret 12
        ['4,5', [5]], // string 5 -> index 4, fret 5
      ]),
    );
  });
});
