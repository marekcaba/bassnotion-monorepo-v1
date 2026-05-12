/**
 * useSegmentAssessment Hook
 *
 * Provides a React interface to the segment assessment state machine.
 */

import { useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import {
  segmentAssessmentMachine,
  type SegmentAssessmentContext,
} from '../machines/segmentAssessmentMachine';
import type {
  VideoSegment,
  SegmentQuestion,
  CoachInsightTemplate,
  SkillBucket,
  SegmentAssessmentResult,
} from '@bassnotion/contracts';

export interface UseSegmentAssessmentReturn {
  // State
  state: string;
  isLoading: boolean;
  error: string | null;

  // Flow state
  currentNode: SegmentAssessmentContext['currentNode'];
  visitedNodeIds: string[];

  // Content
  currentSegment: VideoSegment | null;
  currentQuestion: SegmentQuestion | null;

  // Video state
  videoReady: boolean;
  videoDuration: number;
  videoCurrentTime: number;

  // Answers
  answers: Record<string, unknown>;
  currentAnswer: unknown;

  // Skill state
  selfReportedLevel: string | null;
  determinedBucket: SkillBucket | null;
  skillCheckPassed: boolean | null;
  skillCheckScore: number;

  // Feedback
  showingWrongFeedback: boolean;
  wrongFeedbackText: string | null;

  // Results
  coachInsight: CoachInsightTemplate | null;
  result: SegmentAssessmentResult | null;

  // Resume prompt
  hasSavedSession: boolean;

  // Actions
  start: () => void;
  startPlayback: () => void;
  resumeSession: () => void;
  startFresh: () => void;
  onVideoReady: (duration: number) => void;
  onVideoTimeUpdate: (currentTime: number) => void;
  onVideoEnded: () => void;
  selectAnswer: (answer: unknown) => void;
  submitAnswer: () => void;
  dismissFeedback: () => void;
  goBack: () => void;
  completeAssessment: () => void;
  retry: () => void;

  // Derived state
  canGoBack: boolean;
  isComplete: boolean;
  isShowingResults: boolean;
  isPlayingSegment: boolean;
  isShowingQuestion: boolean;
  isResumePrompt: boolean;
  isWaitingToStart: boolean;
  progress: number; // Percentage of visited nodes
}

export function useSegmentAssessment(): UseSegmentAssessmentReturn {
  const [snapshot, send] = useMachine(segmentAssessmentMachine);

  const context = snapshot.context;
  const stateValue = snapshot.value as string;

  // Actions
  const start = useCallback(() => {
    send({ type: 'LOAD_FLOW' });
  }, [send]);

  const resumeSession = useCallback(() => {
    send({ type: 'RESUME_SESSION' });
  }, [send]);

  const startFresh = useCallback(() => {
    send({ type: 'START_FRESH' });
  }, [send]);

  const startPlayback = useCallback(() => {
    send({ type: 'START_PLAYBACK' });
  }, [send]);

  const onVideoReady = useCallback(
    (duration: number) => {
      send({ type: 'VIDEO_READY', duration });
    },
    [send],
  );

  const onVideoTimeUpdate = useCallback(
    (currentTime: number) => {
      send({ type: 'VIDEO_TIME_UPDATE', currentTime });
    },
    [send],
  );

  const onVideoEnded = useCallback(() => {
    send({ type: 'VIDEO_ENDED' });
  }, [send]);

  const selectAnswer = useCallback(
    (answer: unknown) => {
      send({ type: 'ANSWER_SELECTED', answer });
    },
    [send],
  );

  const submitAnswer = useCallback(() => {
    send({ type: 'SUBMIT_ANSWER' });
  }, [send]);

  const dismissFeedback = useCallback(() => {
    send({ type: 'DISMISS_FEEDBACK' });
  }, [send]);

  const goBack = useCallback(() => {
    send({ type: 'GO_BACK' });
  }, [send]);

  const completeAssessment = useCallback(() => {
    send({ type: 'COMPLETE_ASSESSMENT' });
  }, [send]);

  const retry = useCallback(() => {
    send({ type: 'RETRY' });
  }, [send]);

  // Derived state
  const canGoBack = context.visitedNodeIds.length > 1;
  const isComplete = stateValue === 'complete';
  const isShowingResults = stateValue === 'showingResults';
  const isPlayingSegment = stateValue === 'playingSegment';
  // Note: showingWrongFeedback state removed - wrong answer feedback is now baked into video segments
  const isShowingQuestion = stateValue === 'showingQuestion';
  const isResumePrompt = stateValue === 'resumePrompt';
  const isWaitingToStart = stateValue === 'waitingToStart';
  const hasSavedSession = context.savedSession !== null;

  // Calculate progress based on visited nodes
  const progress = useMemo(() => {
    if (!context.flowGraph) return 0;
    const totalNodes = context.flowGraph.nodes.filter(
      (n) => n.nodeType !== 'branch',
    ).length;
    if (totalNodes === 0) return 0;
    const visitedCount = context.visitedNodeIds.length;
    return Math.min(100, Math.round((visitedCount / totalNodes) * 100));
  }, [context.flowGraph, context.visitedNodeIds]);

  return {
    // State
    state: stateValue,
    isLoading: context.isLoading,
    error: context.error,

    // Flow state
    currentNode: context.currentNode,
    visitedNodeIds: context.visitedNodeIds,

    // Content
    currentSegment: context.currentSegment,
    currentQuestion: context.currentQuestion,

    // Video state
    videoReady: context.videoReady,
    videoDuration: context.videoDuration,
    videoCurrentTime: context.videoCurrentTime,

    // Answers
    answers: context.answers,
    currentAnswer: context.currentAnswer,

    // Skill state
    selfReportedLevel: context.selfReportedLevel,
    determinedBucket: context.determinedBucket,
    skillCheckPassed: context.skillCheckPassed,
    skillCheckScore: context.skillCheckScore,

    // Feedback
    showingWrongFeedback: context.showingWrongFeedback,
    wrongFeedbackText: context.wrongFeedbackText,

    // Results
    coachInsight: context.coachInsight,
    result: context.result,

    // Resume prompt
    hasSavedSession,

    // Actions
    start,
    startPlayback,
    resumeSession,
    startFresh,
    onVideoReady,
    onVideoTimeUpdate,
    onVideoEnded,
    selectAnswer,
    submitAnswer,
    dismissFeedback,
    goBack,
    completeAssessment,
    retry,

    // Derived state
    canGoBack,
    isComplete,
    isShowingResults,
    isPlayingSegment,
    isShowingQuestion,
    isResumePrompt,
    isWaitingToStart,
    progress,
  };
}
