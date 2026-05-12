/**
 * Migration utility for converting between legacy UnderstandQuestion[]
 * and the new unified VideoOverlayEvent[] system.
 */

import type { UnderstandQuestion } from '../types/tutorial.js';
import type {
  AnyVideoOverlayEvent,
  VideoOverlayEvent,
  VideoBlockConfig,
} from '../types/block.js';

/**
 * Convert legacy UnderstandQuestion[] into VideoOverlayEvent<'QUIZ'>[].
 * Preserves IDs so stored progress references remain valid.
 */
export function migrateQuestionsToOverlayEvents(
  questions: UnderstandQuestion[],
): VideoOverlayEvent<'QUIZ'>[] {
  return questions.map((q) => ({
    id: q.id,
    type: 'QUIZ' as const,
    timestamp: q.timestamp ?? 0,
    label: q.question.slice(0, 50),
    content: {
      question: q.question,
      options: q.options,
      correct_option_id: q.correct_option_id,
    },
  }));
}

/**
 * Read overlay events from a VideoBlockConfig, transparently migrating
 * from legacy `questions` field if `overlayEvents` is not yet populated.
 */
export function resolveOverlayEvents(
  config: VideoBlockConfig,
): AnyVideoOverlayEvent[] {
  if (config.overlayEvents && config.overlayEvents.length > 0) {
    return config.overlayEvents;
  }

  if (config.questions && config.questions.length > 0) {
    return migrateQuestionsToOverlayEvents(config.questions);
  }

  return [];
}
