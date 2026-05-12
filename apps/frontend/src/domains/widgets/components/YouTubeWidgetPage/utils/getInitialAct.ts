import type { TutorialProgress } from '@/domains/platform/hooks/useTutorialProgress';
import type { ActName } from '../hooks/useCurrentAct';

/**
 * Determines which act should be shown first when opening a tutorial,
 * based on the user's progress.
 *
 * Logic:
 * - If understand is not complete → Act 1 (Understand)
 * - If understand is complete but practice is not → Act 2 (Practice)
 * - If both understand and practice are complete → Act 3 (Apply)
 *
 * @param progress - The tutorial progress from useSingleTutorialProgress
 * @returns The act name to initially scroll to
 */
export function getInitialAct(progress: TutorialProgress): ActName {
  // If understood is not complete, start at Act 1 (Understand)
  if (!progress.understood) {
    return 'understand';
  }

  // If understood is complete but practiced is not, start at Act 2 (Practice)
  if (progress.understood && !progress.practiced) {
    return 'practice';
  }

  // If both understood and practiced are complete, start at Act 3 (Apply)
  // Note: We don't check `applied` because the user should be able to replay Act 3
  return 'apply';
}
