import { supabase } from '@/infrastructure/supabase';
import { apiClient } from '@/lib/api-client';
import type {
  DatabaseExercise as Exercise,
  GetExercisesResponse,
  GetExerciseResponse,
} from '@bassnotion/contracts';

// Feature flag for gradual migration
const USE_BACKEND_API = process.env.NEXT_PUBLIC_USE_BACKEND_API === 'true';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 5000, // 5 seconds
  backoffMultiplier: 2,
};

// Default exercise fallback when no exercises are available
const DEFAULT_EXERCISE: Exercise = {
  id: 'default-exercise-1',
  title: 'Basic Bass Exercise',
  description: 'A simple bass exercise to get you started',
  difficulty: 'beginner',
  duration: 30000, // 30 seconds
  bpm: 80,
  key: 'C',
  chord_progression: ['C', 'F', 'G', 'C'],
  notes: [],
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = RETRY_CONFIG.maxRetries,
  baseDelay = RETRY_CONFIG.baseDelay,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
        RETRY_CONFIG.maxDelay,
      );

      // Add random jitter (±25%)
      const jitter = delay * 0.25 * (Math.random() - 0.5);
      const finalDelay = Math.max(0, delay + jitter);

      console.log(
        `🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(finalDelay)}ms:`,
        lastError.message,
      );

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  throw lastError;
}

/**
 * Create a fallback response with default exercise
 */
function createFallbackResponse(): GetExercisesResponse {
  console.log('🎯 Using default exercise fallback');
  return {
    exercises: [DEFAULT_EXERCISE],
  };
}

/**
 * Fetch all active exercises with retry logic and fallback
 * Uses backend API by default, falls back to Supabase if feature flag is disabled
 */
export async function getExercises(): Promise<GetExercisesResponse> {
  try {
    return await retryWithBackoff(async () => {
      if (USE_BACKEND_API) {
        try {
          const response = await apiClient.get<{
            exercises: Exercise[];
            total: number;
            cached?: boolean;
          }>('/api/exercises');

          if (!response.exercises || response.exercises.length === 0) {
            throw new Error('No exercises returned from backend API');
          }

          return {
            exercises: response.exercises,
          };
        } catch (error: any) {
          console.error('Backend API error, falling back to Supabase:', error);
          // Fall through to Supabase implementation
        }
      }

      // Original Supabase implementation (fallback)
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .order('title', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(`Failed to fetch exercises: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No exercises found in database');
      }

      return {
        exercises: data as Exercise[],
      };
    });
  } catch (error) {
    console.error(
      '🚨 All exercise fetch attempts failed, using fallback:',
      error,
    );
    return createFallbackResponse();
  }
}

/**
 * Fetch a specific exercise by ID with retry logic
 * Uses backend API by default, falls back to Supabase if feature flag is disabled
 */
export async function getExercise(
  exerciseId: string,
): Promise<GetExerciseResponse> {
  // If requesting the default exercise ID, return it directly
  if (exerciseId === DEFAULT_EXERCISE.id) {
    return { exercise: DEFAULT_EXERCISE };
  }

  try {
    return await retryWithBackoff(async () => {
      if (USE_BACKEND_API) {
        try {
          const response = await apiClient.get<{ exercise: Exercise }>(
            `/api/exercises/${exerciseId}`,
          );
          return response;
        } catch (error: any) {
          console.error('Backend API error, falling back to Supabase:', error);
          // Fall through to Supabase implementation
        }
      }

      // Original Supabase implementation (fallback)
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching exercise:', error);
        throw new Error(`Failed to fetch exercise: ${error.message}`);
      }

      if (!data) {
        throw new Error(`Exercise with ID ${exerciseId} not found`);
      }

      return {
        exercise: data as Exercise,
      };
    });
  } catch (error) {
    console.error(
      `🚨 Failed to fetch exercise ${exerciseId}, using default:`,
      error,
    );
    return { exercise: DEFAULT_EXERCISE };
  }
}

/**
 * Backward compatibility alias
 */
export const getExerciseWithNotes = getExercise;

/**
 * Get exercises filtered by difficulty with retry logic
 * Uses backend API by default, falls back to Supabase if feature flag is disabled
 */
export async function getExercisesByDifficulty(
  difficulty: 'beginner' | 'intermediate' | 'advanced',
): Promise<GetExercisesResponse> {
  try {
    return await retryWithBackoff(async () => {
      if (USE_BACKEND_API) {
        try {
          const response = await apiClient.get<{
            exercises: Exercise[];
            total: number;
          }>(`/api/exercises/difficulty/${difficulty}`);

          if (!response.exercises || response.exercises.length === 0) {
            throw new Error(
              `No ${difficulty} exercises returned from backend API`,
            );
          }

          return {
            exercises: response.exercises,
          };
        } catch (error: any) {
          console.error('Backend API error, falling back to Supabase:', error);
          // Fall through to Supabase implementation
        }
      }

      // Original Supabase implementation (fallback)
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .eq('difficulty', difficulty)
        .order('title', { ascending: true });

      if (error) {
        console.error('Error fetching exercises by difficulty:', error);
        throw new Error(
          `Failed to fetch exercises by difficulty: ${error.message}`,
        );
      }

      if (!data || data.length === 0) {
        throw new Error(`No ${difficulty} exercises found`);
      }

      return {
        exercises: data as Exercise[],
      };
    });
  } catch (error) {
    console.error(
      `🚨 Failed to fetch ${difficulty} exercises, using fallback:`,
      error,
    );
    // Return default exercise if it matches the difficulty, otherwise return empty
    const fallbackExercises =
      DEFAULT_EXERCISE.difficulty === difficulty ? [DEFAULT_EXERCISE] : [];
    return { exercises: fallbackExercises };
  }
}

/**
 * Search exercises by title or description with retry logic
 * Uses backend API by default, falls back to Supabase if feature flag is disabled
 */
export async function searchExercises(
  query: string,
): Promise<GetExercisesResponse> {
  try {
    return await retryWithBackoff(async () => {
      if (USE_BACKEND_API) {
        try {
          const response = await apiClient.get<{
            exercises: Exercise[];
            total: number;
          }>(`/api/exercises/search?q=${encodeURIComponent(query)}`);
          return {
            exercises: response.exercises,
          };
        } catch (error: any) {
          console.error('Backend API error, falling back to Supabase:', error);
          // Fall through to Supabase implementation
        }
      }

      // Original Supabase implementation (fallback)
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('title', { ascending: true });

      if (error) {
        console.error('Error searching exercises:', error);
        throw new Error(`Failed to search exercises: ${error.message}`);
      }

      return {
        exercises: data as Exercise[],
      };
    });
  } catch (error) {
    console.error(`🚨 Failed to search exercises for "${query}":`, error);
    // Return default exercise if it matches the search query
    const queryLower = query.toLowerCase();
    const matchesDefault =
      DEFAULT_EXERCISE.title.toLowerCase().includes(queryLower) ||
      DEFAULT_EXERCISE.description?.toLowerCase().includes(queryLower);

    const fallbackExercises = matchesDefault ? [DEFAULT_EXERCISE] : [];
    return { exercises: fallbackExercises };
  }
}

/**
 * Export the default exercise for testing and external use
 */
export const getDefaultExercise = (): Exercise => ({ ...DEFAULT_EXERCISE });
