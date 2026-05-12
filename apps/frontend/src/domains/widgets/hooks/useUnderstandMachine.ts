/**
 * Understand Overlay State Machine (XState v5)
 *
 * Manages the Act 1 video-first learning flow with pause points,
 * overlay events (quiz, prep, listen, record, upload, reflect),
 * and comprehension tracking.
 *
 * Overlay events are timed interruptions on the video timeline.
 * QUIZ overlays require answer submission; all other overlay types
 * are dismissed with a simple "Continue" action.
 */

import { setup, assign } from 'xstate';
import type { AnyVideoOverlayEvent } from '@bassnotion/contracts';

// =============================================================================
// Types
// =============================================================================

export interface UnderstandContext {
  // Video state
  videoReady: boolean;
  videoDuration: number;
  currentTime: number;

  // Overlay event state
  overlayEvents: AnyVideoOverlayEvent[];
  currentQuestionIndex: number;
  completedEventIds: Set<string>;

  // Quiz-specific state (only relevant when current overlay is QUIZ)
  correctCount: number;
  selectedOptionId: string | null;

  // Error handling
  error: string | null;
  retryCount: number;
}

export type UnderstandEvent =
  | { type: 'VIDEO_READY'; duration: number }
  | { type: 'TIME_UPDATE'; seconds: number }
  | { type: 'VIDEO_ENDED' }
  | { type: 'OPTION_SELECTED'; optionId: string }
  | { type: 'SUBMIT_ANSWER' }
  | { type: 'OVERLAY_CONTINUE' }
  | { type: 'RETRY' }
  | { type: 'SKIP_TO_PRACTICE' }
  | { type: 'ERROR'; message: string }
  | { type: 'UPDATE_OVERLAY_EVENTS'; overlayEvents: AnyVideoOverlayEvent[] };

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Finds the next incomplete overlay event from the list.
 * Returns undefined when all events have been completed.
 */
function findNextIncompleteEvent(
  events: AnyVideoOverlayEvent[],
  completedIds: Set<string>,
): AnyVideoOverlayEvent | undefined {
  return events.find((e) => !completedIds.has(e.id));
}

/**
 * Distributes overlay events evenly across video duration.
 * Only assigns timestamps to events that don't already have one.
 * Avoids first 10s (let user settle) and last 10s (awkward to interrupt at end).
 */
export function distributeOverlayTimestamps(
  events: AnyVideoOverlayEvent[],
  videoDuration: number,
  startOffset = 10,
  endBuffer = 10,
): AnyVideoOverlayEvent[] {
  if (events.length === 0) return [];

  const availableWindow = videoDuration - startOffset - endBuffer;

  // For very short videos, compress the window
  if (availableWindow <= 0) {
    return events.map((event, index) => ({
      ...event,
      timestamp:
        event.timestamp ?? Math.min(videoDuration * 0.5, 5 + index * 5),
    }));
  }

  const interval =
    events.length > 1 ? availableWindow / (events.length - 1) : 0;

  return events.map((event, index) => ({
    ...event,
    // Use existing timestamp if set, otherwise calculate
    timestamp: event.timestamp ?? Math.round(startOffset + index * interval),
  }));
}

// =============================================================================
// State Machine
// =============================================================================

export const understandMachine = setup({
  types: {
    context: {} as UnderstandContext,
    events: {} as UnderstandEvent,
    input: {} as { overlayEvents: AnyVideoOverlayEvent[] },
  },

  guards: {
    hasMoreEvents: ({ context }) =>
      context.currentQuestionIndex < context.overlayEvents.length - 1,

    allEventsCompleted: ({ context }) =>
      context.completedEventIds.size >= context.overlayEvents.length,

    shouldPauseForOverlay: ({ context, event }) => {
      if (event.type !== 'TIME_UPDATE') return false;
      if (context.overlayEvents.length === 0) return false;

      const nextEvent = findNextIncompleteEvent(
        context.overlayEvents,
        context.completedEventIds,
      );
      if (!nextEvent || nextEvent.timestamp === undefined) return false;

      // Pause if within 0.3 seconds of event timestamp
      return (
        event.seconds >= nextEvent.timestamp - 0.3 &&
        event.seconds <= nextEvent.timestamp + 0.3
      );
    },

    canRetry: ({ context }) => context.retryCount < 3,

    hasExceededRetries: ({ context }) => context.retryCount >= 3,
  },

  actions: {
    updateVideoTime: assign({
      currentTime: ({ event }) =>
        event.type === 'TIME_UPDATE' ? event.seconds : 0,
    }),

    setVideoReady: assign({
      videoReady: () => true,
      videoDuration: ({ event }) =>
        event.type === 'VIDEO_READY' ? event.duration : 0,
    }),

    selectOption: assign({
      selectedOptionId: ({ event }) =>
        event.type === 'OPTION_SELECTED' ? event.optionId : null,
    }),

    recordAnswer: assign(({ context }) => {
      const currentEvent = findNextIncompleteEvent(
        context.overlayEvents,
        context.completedEventIds,
      );
      if (!currentEvent) return {};

      // Only track quiz correctness for QUIZ overlay events
      const isQuiz = currentEvent.type === 'QUIZ';
      const isCorrect =
        isQuiz &&
        context.selectedOptionId === currentEvent.content.correct_option_id;

      return {
        completedEventIds: new Set([
          ...context.completedEventIds,
          currentEvent.id,
        ]),
        correctCount: isCorrect
          ? context.correctCount + 1
          : context.correctCount,
        selectedOptionId: null,
      };
    }),

    recordOverlayContinue: assign(({ context }) => {
      const currentEvent = findNextIncompleteEvent(
        context.overlayEvents,
        context.completedEventIds,
      );
      if (!currentEvent) return {};

      return {
        completedEventIds: new Set([
          ...context.completedEventIds,
          currentEvent.id,
        ]),
      };
    }),

    advanceToNextEvent: assign({
      currentQuestionIndex: ({ context }) => {
        const nextIndex = context.overlayEvents.findIndex(
          (e) => !context.completedEventIds.has(e.id),
        );
        return nextIndex >= 0 ? nextIndex : context.currentQuestionIndex + 1;
      },
      selectedOptionId: () => null,
    }),

    setError: assign({
      error: ({ event }) => (event.type === 'ERROR' ? event.message : null),
    }),

    clearError: assign({
      error: () => null,
    }),

    incrementRetryCount: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),

    updateOverlayEvents: assign({
      overlayEvents: ({ event, context }) => {
        if (event.type !== 'UPDATE_OVERLAY_EVENTS')
          return context.overlayEvents;
        // Distribute timestamps if video duration is known
        if (context.videoDuration > 0) {
          return distributeOverlayTimestamps(
            event.overlayEvents,
            context.videoDuration,
          );
        }
        return event.overlayEvents;
      },
    }),

    distributeTimestamps: assign({
      overlayEvents: ({ context }) =>
        distributeOverlayTimestamps(
          context.overlayEvents,
          context.videoDuration,
        ),
    }),
  },
}).createMachine({
  id: 'understand',
  initial: 'loading',

  context: ({ input }) => ({
    videoReady: false,
    videoDuration: 0,
    currentTime: 0,
    overlayEvents: input.overlayEvents || [],
    currentQuestionIndex: 0,
    completedEventIds: new Set<string>(),
    correctCount: 0,
    selectedOptionId: null,
    error: null,
    retryCount: 0,
  }),

  states: {
    loading: {
      on: {
        VIDEO_READY: {
          target: 'playing',
          actions: ['setVideoReady', 'distributeTimestamps'],
        },
        UPDATE_OVERLAY_EVENTS: {
          actions: 'updateOverlayEvents',
        },
        ERROR: {
          target: 'error',
          actions: 'setError',
        },
      },
    },

    playing: {
      on: {
        TIME_UPDATE: [
          {
            guard: 'shouldPauseForOverlay',
            target: 'showingOverlay',
            actions: 'updateVideoTime',
          },
          { actions: 'updateVideoTime' },
        ],
        VIDEO_ENDED: [
          {
            guard: 'allEventsCompleted',
            target: 'complete',
          },
          // If video ends but events remain (edge case), show next overlay
          { target: 'showingOverlay' },
        ],
        UPDATE_OVERLAY_EVENTS: {
          actions: 'updateOverlayEvents',
        },
        ERROR: {
          target: 'error',
          actions: 'setError',
        },
      },
    },

    showingOverlay: {
      on: {
        // Quiz overlay interactions
        OPTION_SELECTED: {
          actions: 'selectOption',
        },
        SUBMIT_ANSWER: {
          target: 'processingAnswer',
          actions: 'recordAnswer',
        },
        // Non-quiz overlay dismissal (PREP, LISTEN, RECORD, etc.)
        OVERLAY_CONTINUE: {
          target: 'processingAnswer',
          actions: 'recordOverlayContinue',
        },
      },
    },

    processingAnswer: {
      always: [
        {
          guard: 'allEventsCompleted',
          target: 'waitingForVideoEnd',
        },
        {
          target: 'playing',
          actions: 'advanceToNextEvent',
        },
      ],
    },

    // After all overlay events completed, wait for video to finish
    waitingForVideoEnd: {
      on: {
        TIME_UPDATE: {
          actions: 'updateVideoTime',
        },
        VIDEO_ENDED: {
          target: 'complete',
        },
      },
    },

    complete: {
      type: 'final',
    },

    error: {
      on: {
        RETRY: [
          {
            guard: 'canRetry',
            target: 'loading',
            actions: ['clearError', 'incrementRetryCount'],
          },
        ],
        SKIP_TO_PRACTICE: {
          target: 'skipped',
        },
      },
    },

    // User skipped due to video errors - track separately from complete
    skipped: {
      type: 'final',
    },
  },
});

export type UnderstandMachine = typeof understandMachine;
export type UnderstandState =
  | 'loading'
  | 'playing'
  | 'showingOverlay'
  | 'processingAnswer'
  | 'waitingForVideoEnd'
  | 'complete'
  | 'error'
  | 'skipped';
