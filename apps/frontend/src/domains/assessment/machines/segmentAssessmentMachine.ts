/**
 * Segment Assessment State Machine (XState v5)
 *
 * Manages the segment-based branching assessment flow with:
 * - Multiple short video segments
 * - Branching based on user answers
 * - 5-level skill bucket determination
 * - Skill verification with feedback
 * - Session persistence for resume
 * - Personalized coach insights
 */

import { setup, assign, fromPromise } from 'xstate';
import type {
  AssessmentFlowGraph,
  FlowNode,
  FlowEdge,
  VideoSegment,
  SegmentQuestion,
  SkillBucket,
  CoachInsightTemplate,
  AssessmentSession,
  SegmentAssessmentResult,
  EdgeConditionType,
} from '@bassnotion/contracts';

// =============================================================================
// Types
// =============================================================================

export interface SegmentAssessmentContext {
  // Flow graph
  flowGraph: AssessmentFlowGraph | null;
  currentNode: FlowNode | null;
  visitedNodeIds: string[];

  // Content cache
  segments: Map<string, VideoSegment>;
  questions: Map<string, SegmentQuestion>;

  // Current segment/question
  currentSegment: VideoSegment | null;
  currentQuestion: SegmentQuestion | null;

  // Video state
  videoReady: boolean;
  videoDuration: number;
  videoCurrentTime: number;

  // Answers
  answers: Record<string, unknown>;
  currentAnswer: unknown;

  // Skill verification
  selfReportedLevel: string | null;
  determinedBucket: SkillBucket | null;
  skillCheckPassed: boolean | null;
  skillCheckScore: number;
  showingWrongFeedback: boolean;
  wrongFeedbackText: string | null;

  // Session
  sessionId: string | null;
  savedSession: AssessmentSession | null;

  // Results
  coachInsight: CoachInsightTemplate | null;
  result: SegmentAssessmentResult | null;

  // Error handling
  error: string | null;
  isLoading: boolean;
}

export type SegmentAssessmentEvent =
  // Initialization
  | { type: 'LOAD_FLOW' }
  | { type: 'FLOW_LOADED'; flowGraph: AssessmentFlowGraph }
  | { type: 'SESSION_FOUND'; session: AssessmentSession }
  | { type: 'NO_SESSION' }
  | { type: 'RESUME_SESSION' }
  | { type: 'START_FRESH' }
  | { type: 'START_PLAYBACK' } // User clicks play button to start assessment
  // Video events
  | { type: 'VIDEO_READY'; duration: number }
  | { type: 'VIDEO_TIME_UPDATE'; currentTime: number }
  | { type: 'VIDEO_ENDED' }
  | { type: 'SEGMENT_LOADED'; segment: VideoSegment }
  // Question events
  | { type: 'QUESTION_LOADED'; question: SegmentQuestion }
  | { type: 'ANSWER_SELECTED'; answer: unknown }
  | { type: 'SUBMIT_ANSWER' }
  | { type: 'DISMISS_FEEDBACK' }
  // Navigation
  | { type: 'NEXT_NODE' }
  | { type: 'GO_BACK' }
  // Results
  | { type: 'SHOW_RESULTS' }
  | { type: 'INSIGHT_MATCHED'; insight: CoachInsightTemplate }
  | { type: 'COMPLETE_ASSESSMENT' }
  | { type: 'ASSESSMENT_COMPLETED'; result: SegmentAssessmentResult }
  // Error handling
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' };

// =============================================================================
// Helper Functions
// =============================================================================

const STORAGE_KEY = 'bassnotion_segment_assessment_session';

const saveSessionToStorage = (context: SegmentAssessmentContext): void => {
  if (!context.sessionId) return;

  const sessionState = {
    sessionId: context.sessionId,
    currentNodeId: context.currentNode?.id,
    answers: context.answers,
    visitedNodeIds: context.visitedNodeIds,
    selfReportedLevel: context.selfReportedLevel,
    determinedBucket: context.determinedBucket,
    skillCheckPassed: context.skillCheckPassed,
    lastActivityAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionState));
};

const loadSessionFromStorage = (): Partial<AssessmentSession> | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const clearSessionFromStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

/**
 * Evaluate edge conditions to find the next node.
 */
const evaluateEdgeCondition = (
  edge: FlowEdge,
  context: SegmentAssessmentContext,
): boolean => {
  const { conditionType, conditionValue } = edge;

  switch (conditionType) {
    case 'always':
      return true;

    case 'answer_equals': {
      if (!conditionValue?.questionKey || conditionValue.value === undefined) {
        return false;
      }
      const answer = context.answers[conditionValue.questionKey];
      return answer === conditionValue.value;
    }

    case 'bucket_equals': {
      if (!conditionValue?.bucket) return false;
      return context.determinedBucket === conditionValue.bucket;
    }

    case 'skill_verified':
      return context.skillCheckPassed === true;

    case 'skill_failed':
      return context.skillCheckPassed === false;

    default:
      return false;
  }
};

/**
 * Find the next node based on current node and context.
 */
const findNextNode = (context: SegmentAssessmentContext): FlowNode | null => {
  if (!context.flowGraph || !context.currentNode) return null;

  const { edges, nodes } = context.flowGraph;
  const currentNodeId = context.currentNode.id;

  // Get all edges from current node, sorted by priority (lower = higher priority)
  const outgoingEdges = edges
    .filter((e) => e.fromNodeId === currentNodeId)
    .sort((a, b) => a.priority - b.priority);

  // Find first edge whose condition is met
  for (const edge of outgoingEdges) {
    if (evaluateEdgeCondition(edge, context)) {
      const nextNode = nodes.find((n) => n.id === edge.toNodeId);
      if (nextNode && nextNode.isActive) {
        return nextNode;
      }
    }
  }

  return null;
};

/**
 * Determine skill bucket from self-reported level and skill check results.
 */
const determineBucket = (
  selfReportedLevel: string | null,
  skillCheckPassed: boolean | null,
): SkillBucket => {
  // If no self-report, default to true beginner
  if (!selfReportedLevel) {
    return 'true_beginner';
  }

  // Map self-reported level + skill check to bucket
  switch (selfReportedLevel) {
    case 'never_played':
      return 'true_beginner';

    case 'just_starting':
      // Skill check determines if truly beginner or has gaps
      if (skillCheckPassed === true) {
        return 'solid_beginner';
      }
      return 'true_beginner';

    case 'know_basics':
      if (skillCheckPassed === true) {
        return 'solid_beginner';
      }
      return 'beginner_with_gaps';

    case 'play_songs':
      if (skillCheckPassed === true) {
        return 'solid_intermediate';
      }
      return 'intermediate_theory_gaps';

    case 'intermediate':
      if (skillCheckPassed === true) {
        return 'solid_intermediate';
      }
      return 'intermediate_theory_gaps';

    default:
      return 'beginner_with_gaps';
  }
};

// =============================================================================
// API Helpers
// =============================================================================

const getApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const fetchFlowGraph = async (): Promise<AssessmentFlowGraph> => {
  const response = await fetch(`${getApiUrl()}/api/v1/assessment/v2/flow`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to load assessment flow');
  const data = await response.json();
  return data.flow;
};

const fetchSegment = async (segmentId: string): Promise<VideoSegment> => {
  const response = await fetch(
    `${getApiUrl()}/api/v1/assessment/v2/segments/${segmentId}`,
    { credentials: 'include' },
  );
  if (!response.ok) throw new Error('Failed to load segment');
  const data = await response.json();
  return data.segment;
};

const fetchQuestion = async (questionKey: string): Promise<SegmentQuestion> => {
  const response = await fetch(
    `${getApiUrl()}/api/v1/assessment/v2/questions/${questionKey}`,
    { credentials: 'include' },
  );
  if (!response.ok) throw new Error('Failed to load question');
  const data = await response.json();
  return data.question;
};

const createSession = async (userId?: string): Promise<AssessmentSession> => {
  const response = await fetch(`${getApiUrl()}/api/v1/assessment/v2/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) throw new Error('Failed to create session');
  const data = await response.json();
  return data.session;
};

const updateSession = async (
  sessionId: string,
  updates: {
    currentNodeId: string;
    answers: Record<string, unknown>;
    visitedNodeIds?: string[];
    determinedBucket?: SkillBucket;
    skillCheckPassed?: boolean;
  },
): Promise<AssessmentSession> => {
  const response = await fetch(
    `${getApiUrl()}/api/v1/assessment/v2/sessions/${sessionId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    },
  );
  if (!response.ok) throw new Error('Failed to update session');
  const data = await response.json();
  return data.session;
};

const matchInsight = async (criteria: {
  bucket: SkillBucket;
  goal?: string;
  struggle?: string;
  practiceTime?: string;
}): Promise<CoachInsightTemplate> => {
  const response = await fetch(
    `${getApiUrl()}/api/v1/assessment/v2/insights/match`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(criteria),
    },
  );
  if (!response.ok) throw new Error('Failed to match insight');
  const data = await response.json();
  return data.insight;
};

const completeAssessment = async (
  sessionId: string,
  bucket: SkillBucket,
  answers: Record<string, unknown>,
  skillCheckScore?: number,
): Promise<SegmentAssessmentResult> => {
  const response = await fetch(`${getApiUrl()}/api/v1/assessment/v2/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sessionId, bucket, answers, skillCheckScore }),
  });
  if (!response.ok) throw new Error('Failed to complete assessment');
  const data = await response.json();
  return data.result;
};

// =============================================================================
// State Machine
// =============================================================================

export const segmentAssessmentMachine = setup({
  types: {
    context: {} as SegmentAssessmentContext,
    events: {} as SegmentAssessmentEvent,
  },

  guards: {
    hasFlowGraph: ({ context }) => context.flowGraph !== null,
    hasSavedSession: ({ context }) => context.savedSession !== null,
    isResultNode: ({ context }) => context.currentNode?.nodeType === 'result',
    isSegmentNode: ({ context }) => context.currentNode?.nodeType === 'segment',
    isQuestionNode: ({ context }) =>
      context.currentNode?.nodeType === 'question' ||
      context.currentNode?.nodeType === 'skill_verification',
    isBranchNode: ({ context }) => context.currentNode?.nodeType === 'branch',
    hasNextNode: ({ context }) => findNextNode(context) !== null,
    isSkillVerification: ({ context }) =>
      context.currentNode?.nodeType === 'skill_verification',
    isAnswerCorrect: ({ context }) => {
      if (!context.currentQuestion?.verificationConfig) return true;
      const correctAnswer =
        context.currentQuestion.verificationConfig.correctAnswer;
      return context.currentAnswer === correctAnswer;
    },
    canGoBack: ({ context }) => context.visitedNodeIds.length > 1,
  },

  actions: {
    setFlowGraph: assign({
      flowGraph: ({ event }) =>
        event.type === 'FLOW_LOADED' ? event.flowGraph : null,
      currentNode: ({ event }) => {
        if (event.type !== 'FLOW_LOADED') return null;
        const entryNode = event.flowGraph.nodes.find(
          (n) => n.id === event.flowGraph.entryNodeId,
        );
        return entryNode || null;
      },
    }),

    setSavedSession: assign({
      savedSession: ({ event }) =>
        event.type === 'SESSION_FOUND' ? event.session : null,
    }),

    restoreSession: assign(({ context }) => {
      if (!context.savedSession || !context.flowGraph) return {};

      const savedNode = context.flowGraph.nodes.find(
        (n) => n.id === context.savedSession?.currentNodeId,
      );

      return {
        sessionId: context.savedSession.id,
        currentNode: savedNode || context.currentNode,
        answers: context.savedSession.answers || {},
        visitedNodeIds: context.savedSession.visitedNodeIds || [],
        selfReportedLevel: context.savedSession.selfReportedLevel || null,
        determinedBucket: context.savedSession.determinedBucket || null,
        skillCheckPassed: context.savedSession.skillCheckPassed ?? null,
      };
    }),

    clearSavedSession: assign({
      savedSession: () => null,
    }),

    setSegment: assign({
      currentSegment: ({ event }) =>
        event.type === 'SEGMENT_LOADED' ? event.segment : null,
      videoReady: () => false,
      videoDuration: () => 0,
      videoCurrentTime: () => 0,
    }),

    setQuestion: assign({
      currentQuestion: ({ event }) =>
        event.type === 'QUESTION_LOADED' ? event.question : null,
      currentAnswer: () => null,
    }),

    setVideoReady: assign({
      videoReady: () => true,
      videoDuration: ({ event }) =>
        event.type === 'VIDEO_READY' ? event.duration : 0,
    }),

    updateVideoTime: assign({
      videoCurrentTime: ({ event }) =>
        event.type === 'VIDEO_TIME_UPDATE' ? event.currentTime : 0,
    }),

    selectAnswer: assign({
      currentAnswer: ({ event }) =>
        event.type === 'ANSWER_SELECTED' ? event.answer : null,
    }),

    recordAnswer: assign(({ context }) => {
      if (!context.currentQuestion || context.currentAnswer === null) {
        return {};
      }

      const questionKey = context.currentQuestion.questionKey;
      const newAnswers = {
        ...context.answers,
        [questionKey]: context.currentAnswer,
      };

      // Check if this is a level question
      let selfReportedLevel = context.selfReportedLevel;
      if (context.currentQuestion.category === 'level') {
        selfReportedLevel = context.currentAnswer as string;
      }

      // Check if this is a skill verification
      let skillCheckPassed = context.skillCheckPassed;
      let skillCheckScore = context.skillCheckScore;
      if (context.currentQuestion.questionType === 'skill-verification') {
        const isCorrect =
          context.currentAnswer ===
          context.currentQuestion.verificationConfig?.correctAnswer;
        skillCheckPassed = isCorrect;
        skillCheckScore = isCorrect ? skillCheckScore + 1 : skillCheckScore;
      }

      // Determine bucket if we have enough info
      const determinedBucket = determineBucket(
        selfReportedLevel,
        skillCheckPassed,
      );

      return {
        answers: newAnswers,
        selfReportedLevel,
        skillCheckPassed,
        skillCheckScore,
        determinedBucket,
      };
    }),

    showWrongFeedback: assign({
      showingWrongFeedback: () => true,
      wrongFeedbackText: ({ context }) =>
        context.currentQuestion?.verificationConfig?.wrongAnswerFeedback ||
        null,
    }),

    hideWrongFeedback: assign({
      showingWrongFeedback: () => false,
      wrongFeedbackText: () => null,
    }),

    moveToNextNode: assign(({ context }) => {
      const nextNode = findNextNode(context);
      if (!nextNode) return {};

      const newVisitedNodeIds = context.currentNode
        ? [...context.visitedNodeIds, context.currentNode.id]
        : context.visitedNodeIds;

      return {
        currentNode: nextNode,
        visitedNodeIds: newVisitedNodeIds,
        currentSegment: null,
        currentQuestion: null,
        currentAnswer: null,
        videoReady: false,
      };
    }),

    goToPreviousNode: assign(({ context }) => {
      if (context.visitedNodeIds.length < 2) return {};

      const newVisitedNodeIds = [...context.visitedNodeIds];
      newVisitedNodeIds.pop(); // Remove current
      const previousNodeId = newVisitedNodeIds[newVisitedNodeIds.length - 1];

      const previousNode = context.flowGraph?.nodes.find(
        (n) => n.id === previousNodeId,
      );

      return {
        currentNode: previousNode || context.currentNode,
        visitedNodeIds: newVisitedNodeIds,
        currentSegment: null,
        currentQuestion: null,
        currentAnswer: null,
        videoReady: false,
      };
    }),

    setCoachInsight: assign({
      coachInsight: ({ event }) =>
        event.type === 'INSIGHT_MATCHED' ? event.insight : null,
    }),

    setResult: assign({
      result: ({ event }) =>
        event.type === 'ASSESSMENT_COMPLETED' ? event.result : null,
    }),

    saveProgress: ({ context }) => {
      saveSessionToStorage(context);
    },

    clearProgress: () => {
      clearSessionFromStorage();
    },

    setError: assign({
      error: ({ event }) => (event.type === 'ERROR' ? event.message : null),
    }),

    clearError: assign({
      error: () => null,
    }),

    setLoading: assign({
      isLoading: () => true,
    }),

    clearLoading: assign({
      isLoading: () => false,
    }),

    setSessionId: assign({
      sessionId: (_, params: { sessionId: string }) => params.sessionId,
    }),
  },

  actors: {
    loadFlowGraph: fromPromise(async () => {
      return await fetchFlowGraph();
    }),

    checkExistingSession: fromPromise(async () => {
      const saved = loadSessionFromStorage();
      if (!saved?.sessionId) return null;
      // Could optionally verify with server here
      return saved as AssessmentSession;
    }),

    createNewSession: fromPromise(async () => {
      return await createSession();
    }),

    loadSegment: fromPromise<VideoSegment, { segmentId: string }>(
      async ({ input }) => {
        return await fetchSegment(input.segmentId);
      },
    ),

    loadQuestion: fromPromise<SegmentQuestion, { questionKey: string }>(
      async ({ input }) => {
        return await fetchQuestion(input.questionKey);
      },
    ),

    saveSessionToServer: fromPromise<
      AssessmentSession,
      {
        sessionId: string;
        currentNodeId: string;
        answers: Record<string, unknown>;
        visitedNodeIds: string[];
        determinedBucket?: SkillBucket;
        skillCheckPassed?: boolean;
      }
    >(async ({ input }) => {
      return await updateSession(input.sessionId, {
        currentNodeId: input.currentNodeId,
        answers: input.answers,
        visitedNodeIds: input.visitedNodeIds,
        determinedBucket: input.determinedBucket,
        skillCheckPassed: input.skillCheckPassed,
      });
    }),

    matchCoachInsight: fromPromise<
      CoachInsightTemplate,
      {
        bucket: SkillBucket;
        goal?: string;
        struggle?: string;
        practiceTime?: string;
      }
    >(async ({ input }) => {
      return await matchInsight(input);
    }),

    submitAssessment: fromPromise<
      SegmentAssessmentResult,
      {
        sessionId: string;
        bucket: SkillBucket;
        answers: Record<string, unknown>;
        skillCheckScore?: number;
      }
    >(async ({ input }) => {
      return await completeAssessment(
        input.sessionId,
        input.bucket,
        input.answers,
        input.skillCheckScore,
      );
    }),
  },
}).createMachine({
  id: 'segmentAssessment',
  initial: 'idle',

  context: {
    flowGraph: null,
    currentNode: null,
    visitedNodeIds: [],
    segments: new Map(),
    questions: new Map(),
    currentSegment: null,
    currentQuestion: null,
    videoReady: false,
    videoDuration: 0,
    videoCurrentTime: 0,
    answers: {},
    currentAnswer: null,
    selfReportedLevel: null,
    determinedBucket: null,
    skillCheckPassed: null,
    skillCheckScore: 0,
    showingWrongFeedback: false,
    wrongFeedbackText: null,
    sessionId: null,
    savedSession: null,
    coachInsight: null,
    result: null,
    error: null,
    isLoading: false,
  },

  states: {
    idle: {
      on: {
        LOAD_FLOW: {
          target: 'loadingFlow',
          actions: 'setLoading',
        },
      },
    },

    loadingFlow: {
      invoke: {
        src: 'loadFlowGraph',
        onDone: {
          target: 'checkingSession',
          actions: [
            'clearLoading',
            assign({
              flowGraph: ({ event }) => event.output,
              currentNode: ({ event }) => {
                const entryNode = event.output.nodes.find(
                  (n: FlowNode) => n.id === event.output.entryNodeId,
                );
                return entryNode || null;
              },
            }),
          ],
        },
        onError: {
          target: 'error',
          actions: [
            'clearLoading',
            assign({
              error: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : 'Failed to load assessment',
            }),
          ],
        },
      },
    },

    checkingSession: {
      invoke: {
        src: 'checkExistingSession',
        onDone: [
          {
            guard: ({ event }) => event.output !== null,
            target: 'resumePrompt',
            actions: assign({
              savedSession: ({ event }) => event.output,
            }),
          },
          { target: 'creatingSession' },
        ],
        onError: {
          target: 'creatingSession',
        },
      },
    },

    resumePrompt: {
      on: {
        RESUME_SESSION: {
          target: 'restoringSession',
          actions: 'restoreSession',
        },
        START_FRESH: {
          target: 'creatingSession',
          actions: ['clearSavedSession', 'clearProgress'],
        },
      },
    },

    restoringSession: {
      always: [
        { guard: 'isSegmentNode', target: 'loadingSegment' },
        { guard: 'isQuestionNode', target: 'loadingQuestion' },
        { guard: 'isBranchNode', target: 'evaluatingBranch' },
        { guard: 'isResultNode', target: 'loadingInsight' },
        { target: 'error' },
      ],
    },

    creatingSession: {
      invoke: {
        src: 'createNewSession',
        onDone: {
          // Go to waitingToStart to require user interaction before first video
          target: 'waitingToStart',
          actions: assign({
            sessionId: ({ event }) => event.output.id,
            visitedNodeIds: ({ context }) =>
              context.currentNode ? [context.currentNode.id] : [],
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: () => 'Failed to create assessment session',
          }),
        },
      },
    },

    // Wait for user to click play button before starting first video
    waitingToStart: {
      on: {
        START_PLAYBACK: {
          target: 'routingNode',
        },
      },
    },

    routingNode: {
      always: [
        { guard: 'isSegmentNode', target: 'loadingSegment' },
        { guard: 'isQuestionNode', target: 'loadingQuestion' },
        { guard: 'isBranchNode', target: 'evaluatingBranch' },
        { guard: 'isResultNode', target: 'loadingInsight' },
        {
          target: 'error',
          actions: assign({ error: () => 'Unknown node type' }),
        },
      ],
    },

    loadingSegment: {
      entry: 'setLoading',
      invoke: {
        src: 'loadSegment',
        input: ({ context }) => ({
          segmentId: context.currentNode?.segmentId || '',
        }),
        onDone: {
          target: 'playingSegment',
          actions: [
            'clearLoading',
            assign({
              currentSegment: ({ event }) => event.output,
            }),
          ],
        },
        onError: {
          target: 'error',
          actions: [
            'clearLoading',
            assign({ error: () => 'Failed to load video segment' }),
          ],
        },
      },
    },

    playingSegment: {
      on: {
        VIDEO_READY: {
          actions: 'setVideoReady',
        },
        VIDEO_TIME_UPDATE: {
          actions: 'updateVideoTime',
        },
        VIDEO_ENDED: {
          target: 'transitioningNode',
        },
      },
    },

    loadingQuestion: {
      entry: 'setLoading',
      invoke: {
        src: 'loadQuestion',
        input: ({ context }) => ({
          questionKey: context.currentNode?.questionKey || '',
        }),
        onDone: {
          target: 'showingQuestion',
          actions: [
            'clearLoading',
            assign({
              currentQuestion: ({ event }) => event.output,
            }),
          ],
        },
        onError: {
          target: 'error',
          actions: [
            'clearLoading',
            assign({ error: () => 'Failed to load question' }),
          ],
        },
      },
    },

    showingQuestion: {
      entry: 'saveProgress',
      on: {
        ANSWER_SELECTED: {
          actions: 'selectAnswer',
        },
        SUBMIT_ANSWER: {
          // All answers go directly to transitioningNode
          // For skill verification wrong answers, the flow graph edges
          // with 'skill_failed' condition will route to video segments
          // that have the "wrong answer" acknowledgment baked in
          target: 'transitioningNode',
          actions: 'recordAnswer',
        },
        GO_BACK: {
          guard: 'canGoBack',
          target: 'routingNode',
          actions: 'goToPreviousNode',
        },
      },
    },

    // Note: showingWrongFeedback state removed - wrong answer feedback is now
    // baked into video segments that are routed to via 'skill_failed' edge conditions

    evaluatingBranch: {
      // Branch nodes immediately route to next node
      always: [
        {
          guard: 'hasNextNode',
          target: 'routingNode',
          actions: 'moveToNextNode',
        },
        {
          target: 'error',
          actions: assign({ error: () => 'No valid path from branch node' }),
        },
      ],
    },

    transitioningNode: {
      entry: 'saveProgress',
      always: [
        {
          guard: 'hasNextNode',
          target: 'routingNode',
          actions: 'moveToNextNode',
        },
        // No next node means we're at the end
        { target: 'loadingInsight' },
      ],
    },

    loadingInsight: {
      entry: 'setLoading',
      invoke: {
        src: 'matchCoachInsight',
        input: ({ context }) => ({
          bucket: context.determinedBucket || 'beginner_with_gaps',
          goal: context.answers['goal'] as string | undefined,
          struggle: context.answers['struggle'] as string | undefined,
          practiceTime: context.answers['practice_time'] as string | undefined,
        }),
        onDone: {
          target: 'showingResults',
          actions: [
            'clearLoading',
            assign({
              coachInsight: ({ event }) => event.output,
            }),
          ],
        },
        onError: {
          // Still show results even without insight
          target: 'showingResults',
          actions: 'clearLoading',
        },
      },
    },

    showingResults: {
      on: {
        COMPLETE_ASSESSMENT: {
          target: 'submitting',
          actions: 'setLoading',
        },
      },
    },

    submitting: {
      invoke: {
        src: 'submitAssessment',
        input: ({ context }) => ({
          sessionId: context.sessionId || '',
          bucket: context.determinedBucket || 'beginner_with_gaps',
          answers: context.answers,
          skillCheckScore: context.skillCheckScore,
        }),
        onDone: {
          target: 'complete',
          actions: [
            'clearLoading',
            'clearProgress',
            assign({
              result: ({ event }) => event.output,
            }),
          ],
        },
        onError: {
          target: 'error',
          actions: [
            'clearLoading',
            assign({
              error: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : 'Failed to complete assessment',
            }),
          ],
        },
      },
    },

    complete: {
      type: 'final',
    },

    error: {
      on: {
        RETRY: {
          target: 'idle',
          actions: 'clearError',
        },
      },
    },
  },
});

export type SegmentAssessmentMachine = typeof segmentAssessmentMachine;
