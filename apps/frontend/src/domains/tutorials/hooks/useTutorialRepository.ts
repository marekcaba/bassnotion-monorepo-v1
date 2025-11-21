import { useMemo } from 'react';
import { TutorialRepository } from '../repositories/tutorial.repository';

/**
 * Hook to get a tutorial repository instance
 * @returns {TutorialRepository} Tutorial repository instance
 */
export function useTutorialRepository() {
  return useMemo(() => new TutorialRepository(), []);
}