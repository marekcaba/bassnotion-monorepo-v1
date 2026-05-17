'use client';

import React, { useMemo } from 'react';
import { UnderstandQuestionOverlay } from './UnderstandQuestionOverlay';
import { GenericOverlay } from './GenericOverlay';
import type {
  AnyVideoOverlayEvent,
  UnderstandQuestion,
  VideoOverlayEvent,
} from '@bassnotion/contracts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OverlayRouterProps {
  /** The current overlay event to display */
  event: AnyVideoOverlayEvent;
  /** Position in timeline (1-based) */
  eventNumber: number;
  /** Total overlay events */
  totalEvents: number;
  /** Quiz-specific: currently selected option ID */
  selectedOptionId: string | null;
  /** Quiz-specific: called when user selects an option */
  onOptionSelect: (optionId: string) => void;
  /** Quiz-specific: called when user submits their answer */
  onSubmitAnswer: () => void;
  /** Non-quiz: called when user clicks Continue */
  onContinue: () => void;
  /** Controls visibility */
  isVisible: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a QUIZ overlay event's content into the UnderstandQuestion
 * shape expected by UnderstandQuestionOverlay.
 */
function toUnderstandQuestion(
  event: VideoOverlayEvent<'QUIZ'>,
): UnderstandQuestion {
  return {
    id: event.id,
    question: event.content.question,
    options: event.content.options,
    correct_option_id: event.content.correct_option_id,
    timestamp: event.timestamp,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Routes an overlay event to the appropriate overlay component based on type.
 *
 * - QUIZ events render UnderstandQuestionOverlay (multiple-choice quiz card)
 * - All other types render GenericOverlay (glassmorphic instruction card)
 */
export const OverlayRouter = React.memo(function OverlayRouter({
  event,
  eventNumber,
  totalEvents,
  selectedOptionId,
  onOptionSelect,
  onSubmitAnswer,
  onContinue,
  isVisible,
}: OverlayRouterProps) {
  const question = useMemo(
    () => (event.type === 'QUIZ' ? toUnderstandQuestion(event) : null),
    [event],
  );

  if (event.type === 'QUIZ' && question) {
    return (
      <UnderstandQuestionOverlay
        question={question}
        questionNumber={eventNumber}
        totalQuestions={totalEvents}
        selectedOptionId={selectedOptionId}
        onOptionSelect={onOptionSelect}
        onSubmit={onSubmitAnswer}
        isVisible={isVisible}
      />
    );
  }

  return (
    <GenericOverlay
      event={event}
      eventNumber={eventNumber}
      totalEvents={totalEvents}
      onContinue={onContinue}
      isVisible={isVisible}
    />
  );
});
