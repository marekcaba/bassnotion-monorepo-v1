import { supabase } from '@/infrastructure/supabase';
import { apiClient } from '@/lib/api-client';
import type {
  Exercise,
  GetExercisesResponse,
  GetExerciseResponse,
  NoteDuration,
  MusicalPosition,
} from '@bassnotion/contracts';
import { MOCK_EXERCISES } from './mockExercises';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

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
  duration_beats: 8, // 2 bars at 4/4
  bpm: 80,
  key: 'C',
  timeSignature: { numerator: 4, denominator: 4 },
  chord_progression: ['C', 'F', 'G', 'C'],
  notes: [
    {
      id: 'note-1',
      timestamp: 0,
      string: 4, // E string (bottom string)
      fret: 0, // Open E
      duration: 'quarter' as NoteDuration,
      position: { measure: 1, beat: 1, subdivision: 0 } as MusicalPosition,
      note: 'E',
      color: 'blue',
    },
    {
      id: 'note-2',
      timestamp: 500,
      string: 4,
      fret: 3, // G note
      duration: 'quarter' as NoteDuration,
      position: { measure: 1, beat: 2, subdivision: 0 } as MusicalPosition,
      note: 'G',
      color: 'green',
    },
    {
      id: 'note-3',
      timestamp: 1000,
      string: 3, // A string
      fret: 0, // Open A
      duration: 'quarter' as NoteDuration,
      position: { measure: 1, beat: 3, subdivision: 0 } as MusicalPosition,
      note: 'A',
      color: 'yellow',
    },
    {
      id: 'note-4',
      timestamp: 1500,
      string: 3,
      fret: 3, // C note
      duration: 'quarter' as NoteDuration,
      position: { measure: 1, beat: 4, subdivision: 0 } as MusicalPosition,
      note: 'C',
      color: 'red',
    },
    {
      id: 'note-5',
      timestamp: 2000,
      string: 2, // D string
      fret: 0, // Open D
      duration: 'quarter' as NoteDuration,
      position: { measure: 2, beat: 1, subdivision: 0 } as MusicalPosition,
      note: 'D',
      color: 'purple',
    },
    {
      id: 'note-6',
      timestamp: 2500,
      string: 2,
      fret: 2, // E note
      duration: 'quarter' as NoteDuration,
      position: { measure: 2, beat: 2, subdivision: 0 } as MusicalPosition,
      note: 'E',
      color: 'blue',
    },
    {
      id: 'note-7',
      timestamp: 3000,
      string: 1, // G string
      fret: 0, // Open G
      duration: 'quarter' as NoteDuration,
      position: { measure: 2, beat: 3, subdivision: 0 } as MusicalPosition,
      note: 'G',
      color: 'green',
    },
    {
      id: 'note-8',
      timestamp: 3500,
      string: 1,
      fret: 2, // A note
      duration: 'quarter' as NoteDuration,
      position: { measure: 2, beat: 4, subdivision: 0 } as MusicalPosition,
      note: 'A',
      color: 'yellow',
    },
  ],
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

      logger.info(
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
  logger.info('🎯 Using default exercise fallback');
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

          // Check if exercises have notes, if not use mock data
          const hasNotes = response.exercises.some(
            (ex) => ex.notes && ex.notes.length > 0,
          );

          if (!hasNotes) {
            logger.info(
              '🎯 Backend exercises have no notes, using mock exercises with notes',
            );
            return {
              exercises: MOCK_EXERCISES,
            };
          }

          // Transform snake_case to camelCase for backend API response
          const transformedExercises = response.exercises.map(
            (exercise: any) => {
              if (
                exercise.drum_pattern &&
                Array.isArray(exercise.drum_pattern)
              ) {
                exercise.drumPattern = exercise.drum_pattern;
              }
              if (exercise.harmony_notes) {
                exercise.harmonyNotes = exercise.harmony_notes;
              }
              if (exercise.harmony_control_changes) {
                exercise.harmonyControlChanges =
                  exercise.harmony_control_changes;
              }
              if (exercise.harmony_instrument) {
                exercise.harmonyInstrument = exercise.harmony_instrument;
              }
              return exercise;
            },
          );

          return {
            exercises: transformedExercises,
          };
        } catch (error: any) {
          logger.error('Backend API error, falling back to Supabase:', error);
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
        logger.error('Supabase error:', error);
        throw new Error(`Failed to fetch exercises: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No exercises found in database');
      }

      logger.info('🎯 Raw Supabase data:', {
        count: data.length,
        firstExercise: data[0],
        firstExerciseKeys: Object.keys(data[0] || {}),
        notesField: data[0]?.notes,
        notesType: typeof data[0]?.notes,
        allExerciseKeys: data.map((ex: any) => Object.keys(ex)),
      });

      // Parse JSONB notes field from Supabase
      const exercises = data.map((exercise: any) => {
        logger.info(
          '🎯 Processing exercise:',
          exercise.title,
          'notes:',
          exercise.notes,
          'type:',
          typeof exercise.notes,
        );

        if (exercise.notes && typeof exercise.notes === 'string') {
          try {
            exercise.notes = JSON.parse(exercise.notes);
            logger.info(
              '🎯 Successfully parsed notes for exercise:',
              exercise.title,
              'count:',
              exercise.notes.length,
            );
          } catch (error) {
            logger.error(
              '🎯 Failed to parse notes for exercise:',
              exercise.title,
              error,
            );
            exercise.notes = [];
          }
        } else if (!exercise.notes) {
          logger.info(
            '🎯 No notes found for exercise:',
            exercise.title,
            'setting empty array',
          );
          exercise.notes = [];
        } else {
          logger.info(
            '🎯 Notes already parsed for exercise:',
            exercise.title,
            'count:',
            exercise.notes?.length,
          );
        }

        // Transform snake_case drum_pattern to camelCase drumPattern
        // The database stores drum_pattern but GlobalControls expects drumPattern
        if (exercise.drum_pattern && Array.isArray(exercise.drum_pattern)) {
          exercise.drumPattern = exercise.drum_pattern;
          logger.info(
            '🎯 Transformed drum_pattern to drumPattern for:',
            exercise.title,
            'hits:',
            exercise.drumPattern.length,
          );
        }

        // Also transform other snake_case fields that GlobalControls might need
        if (exercise.harmony_notes) {
          exercise.harmonyNotes = exercise.harmony_notes;
        }
        if (exercise.harmony_control_changes) {
          exercise.harmonyControlChanges = exercise.harmony_control_changes;
        }
        if (exercise.harmony_instrument) {
          exercise.harmonyInstrument = exercise.harmony_instrument;
        }

        logger.info('🎯 Final exercise data:', {
          id: exercise.id,
          title: exercise.title,
          notesCount: exercise.notes?.length || 0,
          hasNotes: !!(exercise.notes && exercise.notes.length > 0),
          hasDrumPattern: !!(
            exercise.drumPattern && exercise.drumPattern.length > 0
          ),
          drumPatternHits: exercise.drumPattern?.length || 0,
        });

        return exercise;
      }) as Exercise[];

      // Check if exercises have notes, if not use mock data
      const hasNotes = exercises.some((ex) => ex.notes && ex.notes.length > 0);

      if (!hasNotes) {
        logger.info(
          '🎯 Database exercises have no notes, using mock exercises with notes',
        );
        return {
          exercises: MOCK_EXERCISES,
        };
      }

      return {
        exercises,
      };
    });
  } catch (error) {
    logger.error(
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
          // Transform snake_case to camelCase for backend API response
          const exercise = response.exercise as any;
          if (exercise.drum_pattern && Array.isArray(exercise.drum_pattern)) {
            exercise.drumPattern = exercise.drum_pattern;
          }
          if (exercise.harmony_notes) {
            exercise.harmonyNotes = exercise.harmony_notes;
          }
          if (exercise.harmony_control_changes) {
            exercise.harmonyControlChanges = exercise.harmony_control_changes;
          }
          if (exercise.harmony_instrument) {
            exercise.harmonyInstrument = exercise.harmony_instrument;
          }
          return { exercise };
        } catch (error: any) {
          logger.error('Backend API error, falling back to Supabase:', error);
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
        logger.error('Error fetching exercise:', error);
        throw new Error(`Failed to fetch exercise: ${error.message}`);
      }

      if (!data) {
        throw new Error(`Exercise with ID ${exerciseId} not found`);
      }

      // Parse JSONB notes field from Supabase
      if (data.notes && typeof data.notes === 'string') {
        try {
          data.notes = JSON.parse(data.notes);
        } catch (error) {
          logger.error(
            '🎯 Failed to parse notes for exercise:',
            data.title,
            error,
          );
          data.notes = [];
        }
      } else if (!data.notes) {
        data.notes = [];
      }

      // Transform snake_case to camelCase for Supabase response
      if (data.drum_pattern && Array.isArray(data.drum_pattern)) {
        data.drumPattern = data.drum_pattern;
        logger.info(
          '🎯 Transformed drum_pattern to drumPattern for:',
          data.title,
          'hits:',
          data.drumPattern.length,
        );
      }
      if (data.harmony_notes) {
        data.harmonyNotes = data.harmony_notes;
      }
      if (data.harmony_control_changes) {
        data.harmonyControlChanges = data.harmony_control_changes;
      }
      if (data.harmony_instrument) {
        data.harmonyInstrument = data.harmony_instrument;
      }

      return {
        exercise: data as Exercise,
      };
    });
  } catch (error) {
    logger.error(
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
          logger.error('Backend API error, falling back to Supabase:', error);
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
        logger.error('Error fetching exercises by difficulty:', error);
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
    logger.error(
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
          logger.error('Backend API error, falling back to Supabase:', error);
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
        logger.error('Error searching exercises:', error);
        throw new Error(`Failed to search exercises: ${error.message}`);
      }

      return {
        exercises: data as Exercise[],
      };
    });
  } catch (error) {
    logger.error(`🚨 Failed to search exercises for "${query}":`, error);
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
