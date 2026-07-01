'use client';

/**
 * Assessment Quiz State Machine (XState v5)
 *
 * Manages the interactive video assessment flow with pause points,
 * question overlays, and answer tracking.
 */

import { setup, assign, fromPromise } from 'xstate';
import type {
  AssessmentQuestion,
  QuizAnswer,
  AssessmentResult,
  SkillLevel,
  PrimaryGoal,
  BassTechnique,
  MusicGenre,
  AssessmentProgress,
} from '@bassnotion/contracts';

// =============================================================================
// Types
// =============================================================================

export interface AssessmentContext {
  // Video state
  videoReady: boolean;
  videoDuration: number;
  currentTime: number;

  // Quiz state
  questions: AssessmentQuestion[];
  currentQuestionIndex: number;
  answers: QuizAnswer[];
  selectedOptionId: string | null;
  selectedOptionIds: string[];
  textAnswer: string;
  dragDropMapping: Record<string, string>;

  // Results
  skillLevel: SkillLevel | null;
  primaryGoal: PrimaryGoal | null;
  preferredTechniques: BassTechnique[];
  preferredGenres: MusicGenre[];
  totalScore: number;
  percentageScore: number;

  // Assigned journey
  assignedJourneyId: string | null;

  // Progress persistence
  savedProgress: AssessmentProgress | null;

  // Error handling
  error: string | null;
}

export type AssessmentEvent =
  | { type: 'VIDEO_READY'; duration: number }
  | { type: 'TIME_UPDATE'; seconds: number }
  | { type: 'VIDEO_ENDED' }
  | { type: 'PAUSE_FOR_QUESTION' }
  | { type: 'OPTION_SELECTED'; optionId: string | null }
  | { type: 'OPTIONS_SELECTED'; optionIds: string[] }
  | { type: 'TEXT_ENTERED'; text: string }
  | { type: 'DRAG_DROP_UPDATED'; mapping: Record<string, string> }
  | { type: 'SUBMIT_ANSWER' }
  | { type: 'GO_BACK' }
  | { type: 'RESUME_VIDEO' }
  | { type: 'SAVE_PROGRESS' }
  | { type: 'RESTORE_PROGRESS'; progress: AssessmentProgress }
  | { type: 'START_FRESH' }
  | { type: 'COMPLETE_ASSESSMENT' }
  | { type: 'RETRY' }
  | { type: 'ERROR'; message: string }
  | { type: 'UPDATE_QUESTIONS'; questions: AssessmentQuestion[] };

// =============================================================================
// Helper Functions
// =============================================================================

const STORAGE_KEY = 'bassnotion_assessment_progress';

const saveProgressToStorage = (context: AssessmentContext): void => {
  // SSR guard: this machine's context factory calls loadProgressFromStorage EAGERLY, so a server
  // render (once server components import this graph) must not touch localStorage. No-op on server.
  if (typeof window === 'undefined') return;
  const progress: AssessmentProgress = {
    currentQuestionIndex: context.currentQuestionIndex,
    answers: context.answers,
    videoCurrentTime: context.currentTime,
    startedAt: context.savedProgress?.startedAt || new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
};

const loadProgressFromStorage = (): AssessmentProgress | null => {
  if (typeof window === 'undefined') return null; // SSR: no saved progress on the server
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const clearProgressFromStorage = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};

const calculateSkillLevel = (
  answers: QuizAnswer[],
  questions: AssessmentQuestion[],
): { skillLevel: SkillLevel; totalScore: number; percentageScore: number } => {
  // Only count knowledge questions for skill level
  const knowledgeAnswers = answers.filter((a) => {
    const q = questions.find((q) => q.id === a.questionId);
    return q?.category === 'knowledge';
  });

  const totalScore = knowledgeAnswers.reduce(
    (sum, a) => sum + (a.pointsEarned || 0),
    0,
  );

  const maxScore = questions
    .filter((q) => q.category === 'knowledge')
    .reduce((sum, q) => sum + (q.points || 0), 0);

  const percentageScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  let skillLevel: SkillLevel;
  if (percentageScore >= 80) {
    skillLevel = 'advanced';
  } else if (percentageScore >= 50) {
    skillLevel = 'intermediate';
  } else {
    skillLevel = 'beginner';
  }

  return { skillLevel, totalScore, percentageScore };
};

const extractGoalAndPreferences = (
  answers: QuizAnswer[],
  questions: AssessmentQuestion[],
): {
  primaryGoal: PrimaryGoal;
  preferredTechniques: BassTechnique[];
  preferredGenres: MusicGenre[];
} => {
  // Find goal answer
  const goalAnswer = answers.find((a) => {
    const q = questions.find((q) => q.id === a.questionId);
    return q?.category === 'goal';
  });

  // Find preference answers (techniques and genres)
  const preferenceAnswers = answers.filter((a) => {
    const q = questions.find((q) => q.id === a.questionId);
    return q?.category === 'preference';
  });

  // Map goal option to PrimaryGoal
  const goalQuestion = questions.find((q) => q.category === 'goal');
  const selectedGoalOption = goalQuestion?.options?.find(
    (o) => o.id === goalAnswer?.selectedOptionId,
  );
  const primaryGoal =
    (selectedGoalOption?.text
      ?.toLowerCase()
      .replace(/\s+/g, '_') as PrimaryGoal) || 'jam_for_fun';

  // Extract techniques and genres from multi-select preference answers
  const preferredTechniques: BassTechnique[] = [];
  const preferredGenres: MusicGenre[] = [];

  preferenceAnswers.forEach((a) => {
    const q = questions.find((q) => q.id === a.questionId);
    if (!q?.options) return;

    // Check if this is a technique or genre question based on options
    const selectedIds =
      a.selectedOptionIds || [a.selectedOptionId].filter(Boolean);
    selectedIds.forEach((optId) => {
      const opt = q.options?.find((o) => o.id === optId);
      if (!opt) return;

      const text = opt.text.toLowerCase();
      // Simple heuristic to categorize
      if (
        ['fingerstyle', 'slap', 'pick', 'tapping', 'harmonics'].includes(text)
      ) {
        preferredTechniques.push(text as BassTechnique);
      } else if (
        ['funk', 'rock', 'jazz', 'metal', 'rnb', 'gospel', 'pop'].includes(text)
      ) {
        preferredGenres.push(text as MusicGenre);
      }
    });
  });

  return {
    primaryGoal,
    preferredTechniques,
    preferredGenres,
  };
};

// =============================================================================
// State Machine
// =============================================================================

export const assessmentMachine = setup({
  types: {
    context: {} as AssessmentContext,
    events: {} as AssessmentEvent,
    input: {} as { questions: AssessmentQuestion[] },
  },

  guards: {
    hasMoreQuestions: ({ context }) =>
      context.currentQuestionIndex < context.questions.length - 1,
    isQuizComplete: ({ context }) =>
      context.answers.length >= context.questions.length,
    shouldPauseForQuestion: ({ context, event }) => {
      if (event.type !== 'TIME_UPDATE') return false;
      const nextUnansweredIndex = context.answers.length;
      const nextQuestion = context.questions[nextUnansweredIndex];
      if (!nextQuestion) return false;
      // Pause if within 0.5 seconds of question timestamp
      return (
        event.seconds >= nextQuestion.timestamp - 0.5 &&
        event.seconds <= nextQuestion.timestamp + 0.5
      );
    },
    hasSavedProgress: ({ context }) => context.savedProgress !== null,
    canGoBack: ({ context }) => context.currentQuestionIndex > 0,
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

    selectMultipleOptions: assign({
      selectedOptionIds: ({ event }) =>
        event.type === 'OPTIONS_SELECTED' ? event.optionIds : [],
    }),

    updateTextAnswer: assign({
      textAnswer: ({ event }) =>
        event.type === 'TEXT_ENTERED' ? event.text : '',
    }),

    updateDragDropMapping: assign({
      dragDropMapping: ({ event }) =>
        event.type === 'DRAG_DROP_UPDATED' ? event.mapping : {},
    }),

    recordAnswer: assign({
      answers: ({ context }) => {
        const currentQuestion = context.questions[context.currentQuestionIndex];
        if (!currentQuestion) return context.answers;

        // Calculate if answer is correct (for knowledge questions)
        let isCorrect = false;
        let pointsEarned = 0;

        if (currentQuestion.category === 'knowledge') {
          if (
            currentQuestion.type === 'multiple-choice' &&
            currentQuestion.options
          ) {
            const correctOption = currentQuestion.options.find(
              (o) => o.isCorrect,
            );
            isCorrect = context.selectedOptionId === correctOption?.id;
          } else if (
            currentQuestion.type === 'text-input' &&
            currentQuestion.textInputConfig?.acceptableAnswers
          ) {
            const normalized = context.textAnswer.toLowerCase().trim();
            isCorrect = currentQuestion.textInputConfig.acceptableAnswers.some(
              (a) => normalized.includes(a.toLowerCase()),
            );
          } else if (
            currentQuestion.type === 'drag-drop' &&
            currentQuestion.dragDropConfig?.correctMapping
          ) {
            const correct = currentQuestion.dragDropConfig.correctMapping;
            isCorrect =
              Object.keys(correct).every(
                (zone) => context.dragDropMapping[zone] === correct[zone],
              ) &&
              Object.keys(correct).length ===
                Object.keys(context.dragDropMapping).length;
          }

          if (isCorrect) {
            pointsEarned = currentQuestion.points || 0;
          }
        }

        const newAnswer: QuizAnswer = {
          questionId: currentQuestion.id,
          questionType: currentQuestion.type,
          timestamp: Date.now(),
          selectedOptionId: context.selectedOptionId || undefined,
          selectedOptionIds:
            context.selectedOptionIds.length > 0
              ? context.selectedOptionIds
              : undefined,
          textAnswer: context.textAnswer || undefined,
          dragDropMapping:
            context.dragDropMapping &&
            Object.keys(context.dragDropMapping).length > 0
              ? context.dragDropMapping
              : undefined,
          isCorrect,
          pointsEarned,
        };

        // Replace existing answer if going back, otherwise add new
        const existingIndex = context.answers.findIndex(
          (a) => a.questionId === currentQuestion.id,
        );
        if (existingIndex >= 0) {
          const updated = [...context.answers];
          updated[existingIndex] = newAnswer;
          return updated;
        }

        return [...context.answers, newAnswer];
      },
    }),

    advanceQuestion: assign({
      currentQuestionIndex: ({ context }) => context.currentQuestionIndex + 1,
      // Reset selection state for next question
      selectedOptionId: () => null,
      selectedOptionIds: () => [],
      textAnswer: () => '',
      dragDropMapping: () => ({}),
    }),

    goToPreviousQuestion: assign({
      currentQuestionIndex: ({ context }) =>
        Math.max(0, context.currentQuestionIndex - 1),
      // Load previous answer if exists
      selectedOptionId: ({ context }) => {
        const prevIndex = Math.max(0, context.currentQuestionIndex - 1);
        const prevQuestion = context.questions[prevIndex];
        const prevAnswer = context.answers.find(
          (a) => a.questionId === prevQuestion?.id,
        );
        return prevAnswer?.selectedOptionId || null;
      },
      selectedOptionIds: ({ context }) => {
        const prevIndex = Math.max(0, context.currentQuestionIndex - 1);
        const prevQuestion = context.questions[prevIndex];
        const prevAnswer = context.answers.find(
          (a) => a.questionId === prevQuestion?.id,
        );
        return prevAnswer?.selectedOptionIds || [];
      },
      textAnswer: ({ context }) => {
        const prevIndex = Math.max(0, context.currentQuestionIndex - 1);
        const prevQuestion = context.questions[prevIndex];
        const prevAnswer = context.answers.find(
          (a) => a.questionId === prevQuestion?.id,
        );
        return prevAnswer?.textAnswer || '';
      },
      dragDropMapping: ({ context }) => {
        const prevIndex = Math.max(0, context.currentQuestionIndex - 1);
        const prevQuestion = context.questions[prevIndex];
        const prevAnswer = context.answers.find(
          (a) => a.questionId === prevQuestion?.id,
        );
        return prevAnswer?.dragDropMapping || {};
      },
    }),

    calculateResults: assign(({ context }) => {
      const { skillLevel, totalScore, percentageScore } = calculateSkillLevel(
        context.answers,
        context.questions,
      );

      const { primaryGoal, preferredTechniques, preferredGenres } =
        extractGoalAndPreferences(context.answers, context.questions);

      return {
        skillLevel,
        totalScore,
        percentageScore,
        primaryGoal,
        preferredTechniques,
        preferredGenres,
      };
    }),

    saveProgress: ({ context }) => {
      saveProgressToStorage(context);
    },

    restoreProgress: assign({
      currentQuestionIndex: ({ event }) =>
        event.type === 'RESTORE_PROGRESS'
          ? event.progress.currentQuestionIndex
          : 0,
      answers: ({ event }) =>
        event.type === 'RESTORE_PROGRESS' ? event.progress.answers : [],
      currentTime: ({ event }) =>
        event.type === 'RESTORE_PROGRESS' ? event.progress.videoCurrentTime : 0,
      savedProgress: ({ event }) =>
        event.type === 'RESTORE_PROGRESS' ? event.progress : null,
    }),

    clearSavedProgress: () => {
      clearProgressFromStorage();
    },

    resetToFresh: assign({
      currentQuestionIndex: () => 0,
      answers: () => [],
      currentTime: () => 0,
      selectedOptionId: () => null,
      selectedOptionIds: () => [],
      textAnswer: () => '',
      dragDropMapping: () => {},
      savedProgress: () => null,
    }),

    setError: assign({
      error: ({ event }) => (event.type === 'ERROR' ? event.message : null),
    }),

    setAssignedJourney: assign({
      assignedJourneyId: (_, params: { journeyId: string | null }) =>
        params.journeyId,
    }),

    updateQuestions: assign({
      questions: ({ event }) =>
        event.type === 'UPDATE_QUESTIONS' ? event.questions : [],
    }),
  },

  actors: {
    submitAssessment: fromPromise<
      { skillLevel: SkillLevel; assignedJourneyId: string | null },
      { result: AssessmentResult }
    >(async ({ input }) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/v1/assessment/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ result: input.result }),
      });

      if (!response.ok) {
        // If user is not authenticated, still show results locally
        if (response.status === 401) {
          console.warn(
            'User not authenticated - assessment results not saved to server',
          );
          return {
            skillLevel: input.result.skillLevel,
            assignedJourneyId: null,
          };
        }
        throw new Error('Failed to submit assessment');
      }

      const data = await response.json();
      return {
        skillLevel: data.skillLevel,
        assignedJourneyId: data.assignedJourneyId,
      };
    }),
  },
}).createMachine({
  id: 'assessment',
  initial: 'checkingProgress',

  context: ({ input }) => ({
    videoReady: false,
    videoDuration: 0,
    currentTime: 0,
    questions: input.questions,
    currentQuestionIndex: 0,
    answers: [],
    selectedOptionId: null,
    selectedOptionIds: [],
    textAnswer: '',
    dragDropMapping: {},
    skillLevel: null,
    primaryGoal: null,
    preferredTechniques: [],
    preferredGenres: [],
    totalScore: 0,
    percentageScore: 0,
    assignedJourneyId: null,
    savedProgress: loadProgressFromStorage(),
    error: null,
  }),

  states: {
    checkingProgress: {
      always: [
        {
          guard: 'hasSavedProgress',
          target: 'resumePrompt',
        },
        { target: 'loading' },
      ],
      // Handle UPDATE_QUESTIONS even in checkingProgress (video may load very fast)
      on: {
        UPDATE_QUESTIONS: {
          actions: 'updateQuestions',
        },
      },
    },

    resumePrompt: {
      on: {
        RESTORE_PROGRESS: {
          target: 'loading',
          actions: 'restoreProgress',
        },
        START_FRESH: {
          target: 'loading',
          actions: ['clearSavedProgress', 'resetToFresh'],
        },
        // Allow questions to be updated while showing resume prompt (video may load in background)
        UPDATE_QUESTIONS: {
          actions: 'updateQuestions',
        },
      },
    },

    loading: {
      on: {
        VIDEO_READY: {
          target: 'playing',
          actions: 'setVideoReady',
        },
        UPDATE_QUESTIONS: {
          actions: 'updateQuestions',
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
            guard: 'shouldPauseForQuestion',
            target: 'showingQuestion',
            actions: 'updateVideoTime',
          },
          { actions: 'updateVideoTime' },
        ],
        VIDEO_ENDED: [
          {
            guard: 'isQuizComplete',
            target: 'evaluating',
          },
          { target: 'showingQuestion' },
        ],
        // Allow questions to be updated while playing (for dynamic timestamp distribution)
        UPDATE_QUESTIONS: {
          actions: 'updateQuestions',
        },
      },
    },

    showingQuestion: {
      entry: 'saveProgress',
      on: {
        OPTION_SELECTED: { actions: 'selectOption' },
        OPTIONS_SELECTED: { actions: 'selectMultipleOptions' },
        TEXT_ENTERED: { actions: 'updateTextAnswer' },
        DRAG_DROP_UPDATED: { actions: 'updateDragDropMapping' },
        SUBMIT_ANSWER: {
          target: 'processingAnswer',
          actions: 'recordAnswer',
        },
        GO_BACK: {
          guard: 'canGoBack',
          actions: 'goToPreviousQuestion',
        },
      },
    },

    processingAnswer: {
      entry: 'saveProgress',
      always: [
        {
          guard: 'hasMoreQuestions',
          target: 'playing',
          actions: 'advanceQuestion',
        },
        // After last question, go to waitingForVideoEnd instead of directly to evaluating
        { target: 'waitingForVideoEnd' },
      ],
    },

    // Wait for video to finish playing before showing results
    // This allows the teacher to summarize after all questions are answered
    waitingForVideoEnd: {
      on: {
        TIME_UPDATE: {
          actions: 'updateVideoTime',
        },
        VIDEO_ENDED: {
          target: 'evaluating',
        },
      },
    },

    evaluating: {
      entry: ['calculateResults', 'clearSavedProgress'],
      always: { target: 'submitting' },
    },

    submitting: {
      invoke: {
        src: 'submitAssessment',
        input: ({ context }) => ({
          result: {
            answers: context.answers,
            totalScore: context.totalScore,
            maxPossibleScore: context.questions
              .filter((q) => q.category === 'knowledge')
              .reduce((sum, q) => sum + (q.points || 0), 0),
            percentageScore: context.percentageScore,
            skillLevel: context.skillLevel!,
            primaryGoal: context.primaryGoal!,
            preferredTechniques: context.preferredTechniques,
            preferredGenres: context.preferredGenres,
            completedAt: new Date().toISOString(),
            videoWatchedFully: true,
          } satisfies AssessmentResult,
        }),
        onDone: {
          target: 'complete',
          actions: assign({
            assignedJourneyId: ({ event }) => event.output.assignedJourneyId,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : 'Failed to submit assessment',
          }),
        },
      },
    },

    complete: {
      type: 'final',
    },

    error: {
      on: {
        RETRY: { target: 'loading' },
      },
    },
  },
});

export type AssessmentMachine = typeof assessmentMachine;
