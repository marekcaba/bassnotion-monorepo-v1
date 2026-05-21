/**
 * Public surface of the progress domain.
 *
 * Consumers should import from here, not from individual files — this is
 * the seam we'll preserve when (per CLAUDE.md) Practice Bridge extracts
 * into its own service. Today the hooks call the in-process backend; at
 * extraction time, only the underlying api module will need to change.
 */

export {
  useProgress,
  useCompleteBlock,
  useRecordPractice,
  useUserTutorialCompletions,
  useTutorialCompletionSummary,
  progressKeys,
} from './hooks/useProgress';

export {
  fetchTutorialProgress,
  completeBlock,
  recordPractice,
  fetchUserTutorialCompletions,
} from './api/progress.api';

export {
  toLegacyBlockProgress,
  toLegacyPracticeCompletions,
  findBlockEntry,
  type LegacyBlockProgress,
  type LegacyPracticeCompletions,
} from './utils/derive';
