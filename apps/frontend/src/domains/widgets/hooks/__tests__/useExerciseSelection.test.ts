/**
 * @vitest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useExerciseSelection } from '../useExerciseSelection.js';
import type { DatabaseExercise } from '@bassnotion/contracts';

// Mock the exercises API
const mockExercises: DatabaseExercise[] = [
  {
    id: 'ex-1',
    title: 'Modal Interchange Exercise',
    description: 'Practice modal interchange concepts',
    difficulty: 'intermediate',
    duration: 16000,
    bpm: 100,
    key: 'D',
    chord_progression: ['Dm7', 'G7', 'Am7', 'Dm7'],
    notes: [],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ex-2',
    title: 'Blues Scale Mastery',
    description: 'Master the blues scale',
    difficulty: 'beginner',
    duration: 18000,
    bpm: 80,
    key: 'A',
    chord_progression: ['A7', 'D7', 'A7', 'E7'],
    notes: [],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ex-3',
    title: 'Funk Slap Technique',
    description: 'Build your funk slap technique',
    difficulty: 'advanced',
    duration: 14000,
    bpm: 95,
    key: 'E',
    chord_progression: ['Em7', 'Am7', 'Em7', 'Bm7'],
    notes: [],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Mock default exercise
const mockDefaultExercise: DatabaseExercise = {
  id: 'default-exercise-1',
  title: 'Basic Bass Exercise',
  description: 'A simple bass exercise to get you started',
  difficulty: 'beginner',
  duration: 30000,
  bpm: 80,
  key: 'C',
  chord_progression: ['C', 'F', 'G', 'C'],
  notes: [],
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock the API functions
vi.mock('../../api/exercises.js', () => ({
  getExercises: vi.fn(),
  searchExercises: vi.fn(),
  getExercisesByDifficulty: vi.fn(),
  getDefaultExercise: vi.fn(),
}));

import {
  getExercises,
  searchExercises,
  getExercisesByDifficulty,
  getDefaultExercise,
} from '../../api/exercises.js';

import { __clearCache } from '../useExerciseSelection.js';

const mockGetExercises = vi.mocked(getExercises);
const mockSearchExercises = vi.mocked(searchExercises);
const mockGetExercisesByDifficulty = vi.mocked(getExercisesByDifficulty);
const mockGetDefaultExercise = vi.mocked(getDefaultExercise);

describe('useExerciseSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();

    // Clear the module-level cache before each test
    __clearCache();

    // Default mock responses
    mockGetExercises.mockResolvedValue({ exercises: mockExercises });
    mockSearchExercises.mockResolvedValue({ exercises: [] });
    mockGetExercisesByDifficulty.mockResolvedValue({ exercises: [] });
    mockGetDefaultExercise.mockReturnValue(mockDefaultExercise);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should initialize with default state', async () => {
    const { result } = renderHook(() => useExerciseSelection());

    expect(result.current.exercises).toEqual([]);
    expect(result.current.selectedExercise).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.searchQuery).toBe('');
    expect(result.current.selectedDifficulty).toBe('all');
    expect(result.current.usingFallback).toBe(false);

    // Wait for the initial load to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should load exercises on mount', async () => {
    const { result } = renderHook(() => useExerciseSelection());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetExercises).toHaveBeenCalledTimes(1);
    expect(result.current.exercises).toEqual(mockExercises);
    expect(result.current.error).toBeNull();
    expect(result.current.usingFallback).toBe(false);
  });

  it('should handle API errors gracefully', async () => {
    const errorMessage = 'Failed to fetch exercises';
    mockGetExercises.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useExerciseSelection());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.exercises).toEqual([mockDefaultExercise]);
    expect(result.current.error).toBe(errorMessage);
    expect(result.current.usingFallback).toBe(true);
  });

  it('should detect fallback exercises', async () => {
    // Mock API to return only the default exercise (simulating fallback)
    mockGetExercises.mockResolvedValue({ exercises: [mockDefaultExercise] });

    const { result } = renderHook(() => useExerciseSelection());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.exercises).toEqual([mockDefaultExercise]);
    expect(result.current.usingFallback).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should allow manual selection of default exercise', async () => {
    const { result } = renderHook(() => useExerciseSelection());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.selectDefaultExercise();
    });

    expect(result.current.selectedExercise).toEqual(mockDefaultExercise);
    expect(result.current.exercises).toEqual([mockDefaultExercise]);
    expect(result.current.usingFallback).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should auto-select first exercise when available', async () => {
    const { result } = renderHook(() => useExerciseSelection());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should auto-select the first exercise
    expect(result.current.selectedExercise).toEqual(mockExercises[0]);
  });

  it('should select an exercise', async () => {
    const { result } = renderHook(() => useExerciseSelection());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const exercise = mockExercises[0]!;

    await act(async () => {
      result.current.selectExercise(exercise);
    });

    expect(result.current.selectedExercise).toEqual(exercise);
  });

  it('should clear selected exercise', async () => {
    const { result } = renderHook(() => useExerciseSelection());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const exercise = mockExercises[0]!;

    await act(async () => {
      result.current.selectExercise(exercise);
    });

    expect(result.current.selectedExercise).toEqual(exercise);

    await act(async () => {
      result.current.selectExercise(null);
    });

    expect(result.current.selectedExercise).toBeNull();
  });

  it('should search exercises with debouncing', async () => {
    const searchResults = [mockExercises[0]!];
    mockSearchExercises.mockResolvedValue({ exercises: searchResults });

    const { result } = renderHook(() => useExerciseSelection());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Use fake timers
    vi.useFakeTimers();

    await act(async () => {
      result.current.setSearchQuery('modal');
    });

    expect(result.current.searchQuery).toBe('modal');

    // Fast forward past debounce delay and let promises resolve
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Give React time to process the state updates
    await act(async () => {
      vi.runAllTimers();
    });

    // Use real timers for waitFor
    vi.useRealTimers();

    await waitFor(() => {
      expect(mockSearchExercises).toHaveBeenCalledWith('modal');
      expect(result.current.exercises).toEqual(searchResults);
    });
  });

  it('should filter by difficulty', async () => {
    const difficultyResults = [mockExercises[1]!]; // beginner exercise
    mockGetExercisesByDifficulty.mockResolvedValue({
      exercises: difficultyResults,
    });

    const { result } = renderHook(() => useExerciseSelection());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.setSelectedDifficulty('beginner');
    });

    await waitFor(() => {
      expect(mockGetExercisesByDifficulty).toHaveBeenCalledWith('beginner');
      expect(result.current.exercises).toEqual(difficultyResults);
    });
  });

  it('should clear error', async () => {
    const errorMessage = 'Test error';
    mockGetExercises.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useExerciseSelection());

    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage);
    });

    await act(async () => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should refresh exercises and clear cache', async () => {
    const { result } = renderHook(() => useExerciseSelection());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetExercises).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refreshExercises();
    });

    // Should have been called again after refresh
    expect(mockGetExercises).toHaveBeenCalledTimes(2);
  });

  it('should use cached results when available', async () => {
    const { result } = renderHook(() => useExerciseSelection());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetExercises).toHaveBeenCalledTimes(1);

    // Unmount and remount (simulating navigation)
    const { result: result2 } = renderHook(() => useExerciseSelection());

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    // Should use cache, so API should still only have been called once
    expect(mockGetExercises).toHaveBeenCalledTimes(1);
    expect(result2.current.exercises).toEqual(mockExercises);
  });

  it('should filter exercises client-side when searching', async () => {
    // Mock the search API to fall back to client-side filtering
    mockSearchExercises.mockRejectedValue(new Error('API not available'));

    const { result } = renderHook(() => useExerciseSelection());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Use fake timers for debouncing
    vi.useFakeTimers();

    // Set search query that matches one of the mock exercises
    await act(async () => {
      result.current.setSearchQuery('modal');
    });

    // Fast forward past debounce delay
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Process all pending timers and promises
    await act(async () => {
      vi.runAllTimers();
    });

    // Use real timers for waitFor
    vi.useRealTimers();

    await waitFor(() => {
      // Should filter client-side to exercises matching "modal"
      expect(result.current.exercises.length).toBe(1);
      expect(result.current.exercises[0]?.title).toContain('Modal');
    });
  });

  it('should handle empty search results', async () => {
    mockSearchExercises.mockResolvedValue({ exercises: [] });

    const { result } = renderHook(() => useExerciseSelection());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vi.useFakeTimers();

    await act(async () => {
      result.current.setSearchQuery('nonexistent');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Process all pending timers and promises
    await act(async () => {
      vi.runAllTimers();
    });

    // Use real timers for waitFor
    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.exercises).toEqual([]);
    });
  });

  // New test for retry and fallback integration
  it('should use fallback after retries fail', async () => {
    // Mock consecutive failures followed by fallback
    mockGetExercises
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useExerciseSelection());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fallback to default exercise
    expect(result.current.exercises).toEqual([mockDefaultExercise]);
    expect(result.current.usingFallback).toBe(true);
    expect(result.current.error).toContain('Network error');
  });
});
