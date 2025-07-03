/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchTutorials,
  fetchTutorialExercises,
  TutorialsApiError,
} from '../tutorials.js';

// Create a more robust mock setup
const createMockResponse = (data: any, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Error',
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
});

describe('Tutorials API', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('fetchTutorials', () => {
    it('should make correct API call for tutorials list', async () => {
      const mockData = {
        tutorials: [
          {
            id: '1',
            slug: 'test-tutorial',
            title: 'Test Tutorial',
            artist: 'Test Artist',
            difficulty: 'beginner',
            exercise_count: 2,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
      };

      (global.fetch as any).mockResolvedValue(createMockResponse(mockData));

      const result = await fetchTutorials();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/tutorials',
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
      expect(result).toEqual(mockData);
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(fetchTutorials()).rejects.toThrow(TutorialsApiError);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle HTTP error status codes', async () => {
      const errorData = { message: 'Server error' };
      (global.fetch as any).mockResolvedValue(
        createMockResponse(errorData, false, 500),
      );

      await expect(fetchTutorials()).rejects.toThrow(TutorialsApiError);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('fetchTutorialExercises', () => {
    it('should make correct API call for tutorial exercises', async () => {
      const mockData = {
        tutorial: {
          id: '1',
          slug: 'billie-jean',
          title: 'Billie Jean',
          artist: 'Michael Jackson',
          difficulty: 'beginner',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        exercises: [
          {
            id: 'ex1',
            title: 'Basic Pattern',
            difficulty: 'beginner',
            duration: 120000,
            bpm: 117,
            key: 'F#',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          } as any,
        ],
      };

      (global.fetch as any).mockResolvedValue(createMockResponse(mockData));

      const result = await fetchTutorialExercises('billie-jean');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/tutorials/billie-jean/exercises',
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
      expect(result).toEqual(mockData);
    });

    it('should validate slug parameter', async () => {
      await expect(fetchTutorialExercises('')).rejects.toThrow(
        'Tutorial slug is required',
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle tutorial not found errors', async () => {
      const errorData = { message: 'Tutorial not found' };
      (global.fetch as any).mockResolvedValue(
        createMockResponse(errorData, false, 404),
      );

      await expect(fetchTutorialExercises('non-existent')).rejects.toThrow(
        TutorialsApiError,
      );
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle empty exercises response', async () => {
      const mockData = {
        tutorial: {
          id: '2',
          slug: 'new-tutorial',
          title: 'New Tutorial',
          artist: 'Test Artist',
          difficulty: 'beginner',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        exercises: [],
      };

      (global.fetch as any).mockResolvedValue(createMockResponse(mockData));

      const result = await fetchTutorialExercises('new-tutorial');

      expect(result).toEqual(mockData);
      expect(result.exercises).toHaveLength(0);
    });
  });

  describe('TutorialsApiError', () => {
    it('should create error with message and status', () => {
      const error = new TutorialsApiError('Not found', 404);

      expect(error.message).toBe('Not found');
      expect(error.status).toBe(404);
      expect(error.name).toBe('TutorialsApiError');
      expect(error instanceof Error).toBe(true);
    });

    it('should create error with just message', () => {
      const error = new TutorialsApiError('Generic error');

      expect(error.message).toBe('Generic error');
      expect(error.status).toBeUndefined();
      expect(error.name).toBe('TutorialsApiError');
    });
  });
});
