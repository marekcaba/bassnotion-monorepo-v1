/**
 * @vitest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useWidgetPageState } from '../useWidgetPageState';

describe('useWidgetPageState', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWidgetPageState());

    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.currentTime).toBe(0);
    expect(result.current.state.tempo).toBe(100);
    expect(result.current.state.volume.master).toBe(80);
    expect(result.current.state.widgets.metronome.bpm).toBe(100);
    expect(result.current.state.widgets.harmony.progression).toEqual([
      'Dm7',
      'G7',
      'CMaj7',
    ]);
    expect(result.current.state.syncEnabled).toBe(true);
  });

  it('should toggle playback state', () => {
    const { result } = renderHook(() => useWidgetPageState());

    act(() => {
      result.current.togglePlayback();
    });

    expect(result.current.state.isPlaying).toBe(true);

    act(() => {
      result.current.togglePlayback();
    });

    expect(result.current.state.isPlaying).toBe(false);
  });

  it('should update current time', () => {
    const { result } = renderHook(() => useWidgetPageState());

    act(() => {
      result.current.setCurrentTime(50);
    });

    expect(result.current.state.currentTime).toBe(50);
  });

  it('should update tempo and sync with metronome', () => {
    const { result } = renderHook(() => useWidgetPageState());

    act(() => {
      result.current.setTempo(120);
    });

    expect(result.current.state.tempo).toBe(120);
    expect(result.current.state.widgets.metronome.bpm).toBe(120);
  });

  it('should update volume for different sources', () => {
    const { result } = renderHook(() => useWidgetPageState());

    act(() => {
      result.current.setVolume('master', 90);
    });

    expect(result.current.state.volume.master).toBe(90);

    act(() => {
      result.current.setVolume('metronome', 60);
    });

    expect(result.current.state.volume.metronome).toBe(60);
  });

  it('should toggle widget visibility', () => {
    const { result } = renderHook(() => useWidgetPageState());

    expect(result.current.state.widgets.metronome.isVisible).toBe(true);

    act(() => {
      result.current.toggleWidgetVisibility('metronome');
    });

    expect(result.current.state.widgets.metronome.isVisible).toBe(false);
  });

  it('should advance to next chord in progression', () => {
    const { result } = renderHook(() => useWidgetPageState());

    expect(result.current.state.widgets.harmony.currentChord).toBe(0);

    act(() => {
      result.current.nextChord();
    });

    expect(result.current.state.widgets.harmony.currentChord).toBe(1);

    // Test wrap-around
    act(() => {
      result.current.nextChord();
    });
    act(() => {
      result.current.nextChord();
    });

    expect(result.current.state.widgets.harmony.currentChord).toBe(0);
  });

  it('should toggle synchronization', () => {
    const { result } = renderHook(() => useWidgetPageState());

    expect(result.current.state.syncEnabled).toBe(true);

    act(() => {
      result.current.toggleSync();
    });

    expect(result.current.state.syncEnabled).toBe(false);
  });

  it('should set selected exercise', () => {
    const { result } = renderHook(() => useWidgetPageState());
    const mockExercise = {
      id: 'test-1',
      title: 'Test Exercise',
      difficulty: 'beginner' as const,
      duration: 16000,
      bpm: 120,
      key: 'C',
      description: 'Test description',
      notes: [],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    act(() => {
      result.current.setSelectedExercise(mockExercise);
    });

    expect(result.current.state.selectedExercise).toEqual(mockExercise);
  });

  it('should update tempo when exercise with BPM is selected', () => {
    const { result } = renderHook(() => useWidgetPageState());
    const mockExercise = {
      id: 'test-1',
      title: 'Test Exercise',
      difficulty: 'beginner' as const,
      duration: 16000,
      bpm: 140,
      key: 'D',
      description: 'Test description',
      notes: [],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    act(() => {
      result.current.setSelectedExercise(mockExercise);
    });

    expect(result.current.state.tempo).toBe(140);
    expect(result.current.state.widgets.metronome.bpm).toBe(140);
  });

  it('should update harmony progression from exercise chord_progression', () => {
    const { result } = renderHook(() => useWidgetPageState());
    const mockExercise = {
      id: 'test-1',
      title: 'Test Exercise',
      difficulty: 'intermediate' as const,
      duration: 16000,
      bpm: 100,
      key: 'D',
      chord_progression: ['Dm7', 'G7', 'Am7', 'Dm7'],
      description: 'Test description',
      notes: [],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    act(() => {
      result.current.setSelectedExercise(mockExercise);
    });

    expect(result.current.state.widgets.harmony.progression).toEqual([
      'Dm7',
      'G7',
      'Am7',
      'Dm7',
    ]);
    expect(result.current.state.widgets.harmony.currentChord).toBe(0);
  });

  it('should generate harmony progression from key when no chord_progression', () => {
    const { result } = renderHook(() => useWidgetPageState());
    const mockExercise = {
      id: 'test-1',
      title: 'Test Exercise',
      difficulty: 'beginner' as const,
      duration: 16000,
      bpm: 100,
      key: 'G',
      description: 'Test description',
      notes: [],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    act(() => {
      result.current.setSelectedExercise(mockExercise);
    });

    expect(result.current.state.widgets.harmony.progression).toEqual([
      'G',
      'Em',
      'C',
      'D',
    ]);
    expect(result.current.state.widgets.harmony.currentChord).toBe(0);
  });

  it('should reset state to initial values', () => {
    const { result } = renderHook(() => useWidgetPageState());

    // Modify state
    act(() => {
      result.current.togglePlayback();
      result.current.setTempo(150);
      result.current.setCurrentTime(30);
    });

    // Reset state
    act(() => {
      result.current.resetState();
    });

    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.tempo).toBe(100);
    expect(result.current.state.currentTime).toBe(0);
  });
});
