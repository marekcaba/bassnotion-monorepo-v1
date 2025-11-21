import { useMemo } from 'react';
import { ExerciseRepository } from '../repositories/exercise.repository';

/**
 * Hook to get an exercise repository instance
 * @returns {ExerciseRepository} Exercise repository instance
 */
export function useExerciseRepository() {
  return useMemo(() => new ExerciseRepository(), []);
}