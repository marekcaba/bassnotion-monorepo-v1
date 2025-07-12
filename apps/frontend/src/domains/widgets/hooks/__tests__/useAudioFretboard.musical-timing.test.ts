/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAudioFretboard } from '../useAudioFretboard';
import type { DatabaseExercise } from '@bassnotion/contracts';

describe('useAudioFretboard - Musical Timing System', () => {
  it('should detect musical timing exercises correctly', () => {
    const musicalExercise: DatabaseExercise = {
      id: 'test-musical-exercise',
      title: 'Musical Timing Exercise',
      difficulty: 'beginner',
      duration: 4000,
      bpm: 120,
      key: 'C',
      timeSignature: { numerator: 4, denominator: 4 },
      notes: [
        {
          id: 'note-1',
          string: 4 as const,
          fret: 0,
          note: 'E',
          color: 'green',
          duration: 'quarter',
          position: { measure: 1, beat: 1, subdivision: 0 },
        },
        {
          id: 'note-2',
          string: 3 as const,
          fret: 2,
          note: 'F#',
          color: 'green',
          duration: 'quarter',
          position: { measure: 1, beat: 2, subdivision: 0 },
        },
      ],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const { result } = renderHook(() =>
      useAudioFretboard({
        stringCount: 4,
        exercise: musicalExercise,
        syncProps: { isPlaying: false, currentTime: 0 },
      }),
    );

    expect(result.current).toBeDefined();
    expect(result.current.playbackPosition.isMusicalTiming).toBe(true);
  });

  it('should detect legacy timing exercises correctly', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const legacyExercise = {
      id: 'test-legacy-exercise',
      title: 'Legacy Exercise',
      notes: [
        {
          id: 'note-1',
          timestamp: 0,
          duration: 500,
          string: 4,
          fret: 0,
          note: 'E',
        },
        {
          id: 'note-2',
          timestamp: 500,
          duration: 500,
          string: 3,
          fret: 2,
          note: 'F#',
        },
      ],
    };

    const { result } = renderHook(() =>
      useAudioFretboard({
        stringCount: 4,
        exercise: legacyExercise,
        syncProps: { isPlaying: false, currentTime: 0 },
      }),
    );

    expect(result.current).toBeDefined();

    // Verify that the system correctly identifies this as a legacy exercise
    // We can verify this by checking the console output
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Exercise timing system: Legacy'),
    );

    // The hook should be working even if the initial state has timing issues
    expect(result.current.playbackPosition).toBeDefined();

    consoleSpy.mockRestore();
  });

  it('should convert musical timing to milliseconds for playback', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const musicalExercise: DatabaseExercise = {
      id: 'test-musical-exercise',
      title: 'Musical Timing Exercise',
      difficulty: 'beginner',
      duration: 2000,
      bpm: 120, // 500ms per quarter note
      key: 'C',
      timeSignature: { numerator: 4, denominator: 4 },
      notes: [
        {
          id: 'note-1',
          string: 4 as const,
          fret: 0,
          note: 'E',
          color: 'green',
          duration: 'quarter',
          position: { measure: 1, beat: 1, subdivision: 0 }, // 0ms
        },
        {
          id: 'note-2',
          string: 3 as const,
          fret: 2,
          note: 'F#',
          color: 'green',
          duration: 'quarter',
          position: { measure: 1, beat: 2, subdivision: 0 }, // 500ms
        },
      ],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    renderHook(() =>
      useAudioFretboard({
        stringCount: 4,
        exercise: musicalExercise,
        syncProps: { isPlaying: false, currentTime: 0 },
      }),
    );

    // Check if the console log shows the conversion was detected
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Exercise timing system: Musical'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Time signature: 4/4'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('BPM: 120'),
    );

    consoleSpy.mockRestore();
  });

  it('should create note events with both timing systems', () => {
    const { result } = renderHook(() =>
      useAudioFretboard({
        stringCount: 4,
        defaultNoteDuration: 'eighth',
        syncProps: { isPlaying: false, currentTime: 0 },
      }),
    );

    const noteEvent = result.current.createNoteEvent(0, 2);

    expect(noteEvent).toBeDefined();
    expect(noteEvent?.duration).toBe('eighth'); // Musical duration
    expect(noteEvent?.timestamp).toBeDefined(); // Legacy timestamp
    expect(noteEvent?.duration_ms).toBe(500); // Legacy duration
    expect(noteEvent?.note).toBe('A'); // Should calculate correct note (G string, 2nd fret = A)
    expect(noteEvent?.string).toBe(0);
    expect(noteEvent?.fret).toBe(2);
  });

  it('should track musical position during playback', () => {
    const musicalExercise: DatabaseExercise = {
      id: 'test-musical-exercise',
      title: 'Musical Timing Exercise',
      difficulty: 'beginner',
      duration: 2000,
      bpm: 120,
      key: 'C',
      timeSignature: { numerator: 4, denominator: 4 },
      notes: [
        {
          id: 'note-1',
          string: 4 as const,
          fret: 0,
          note: 'E',
          color: 'green',
          duration: 'quarter',
          position: { measure: 1, beat: 1, subdivision: 0 },
        },
      ],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const { result, rerender: _rerender } = renderHook(
      (props) =>
        useAudioFretboard({
          stringCount: 4,
          exercise: musicalExercise,
          syncProps: props.syncProps,
        }),
      {
        initialProps: {
          syncProps: { isPlaying: true, currentTime: 250 }, // Mid-way through first beat
        },
      },
    );

    expect(result.current.playbackPosition.isMusicalTiming).toBe(true);
    expect(result.current.playbackPosition.musicalPosition).toBeDefined();
    expect(result.current.playbackPosition.musicalPosition?.measure).toBe(1);
    expect(result.current.playbackPosition.musicalPosition?.beat).toBe(1);
  });
});
