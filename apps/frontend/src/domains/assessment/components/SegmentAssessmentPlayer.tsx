'use client';

/**
 * SegmentAssessmentPlayer
 *
 * Main orchestrator component for the segment-based assessment.
 * Manages the flow between video segments, questions, and results.
 * Styled to match V1 assessment with warm amber theme.
 *
 * Uses a unified layout to prevent page reloads during transitions.
 */

import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useSegmentAssessment } from '../hooks/useSegmentAssessment';
import { SegmentVideoPlayer } from './SegmentVideoPlayer';
import { SegmentQuestionOverlay } from './SegmentQuestionOverlay';
// SkillVerificationFeedback removed - wrong answer feedback is now baked into video segments
import { SessionResumePrompt } from './SessionResumePrompt';
import { BucketResultsScreen } from './BucketResultsScreen';
import { AssessmentProgress } from './AssessmentProgress';
import { AssessmentError } from './AssessmentError';
import { AssessmentLoading } from './AssessmentLoading';
import type { VideoSegment } from '@bassnotion/contracts';

export interface SegmentAssessmentPlayerProps {
  onComplete?: (bucket: string, journeyId?: string) => void;
}

/**
 * Assessment Header Component
 * Displays the "Let's Build Your Plan" headline and decorative elements
 */
function AssessmentHeader() {
  return (
    <div className="text-center mb-8 sm:mb-10">
      {/* Subtle decorative element */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
        <span
          className="text-xs uppercase tracking-[0.2em] text-amber-500/70"
          style={{ fontFamily: 'var(--font-inter), sans-serif' }}
        >
          Takes less than 5 minutes
        </span>
        <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
      </div>

      {/* Main headline */}
      <h1
        className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight leading-tight"
        style={{ fontFamily: 'var(--font-inter), sans-serif' }}
      >
        Let's Build{' '}
        <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
          Your Plan
        </span>
      </h1>

      {/* Subtitle */}
      <p
        className="mt-4 text-neutral-400 max-w-lg mx-auto leading-relaxed"
        style={{ fontFamily: 'var(--font-inter), sans-serif' }}
      >
        Watch the video and answer questions as they appear to get your
        personalized path.
      </p>
    </div>
  );
}

/**
 * Persistent Video Player - keeps the video player mounted to avoid reloads
 */
interface PersistentVideoPlayerProps {
  segment: VideoSegment | null;
  isVisible: boolean;
  onReady: (duration: number) => void;
  onTimeUpdate: (currentTime: number) => void;
  onEnded: () => void;
}

function PersistentVideoPlayer({
  segment,
  isVisible,
  onReady,
  onTimeUpdate,
  onEnded,
}: PersistentVideoPlayerProps) {
  // Store the last valid segment so we can keep rendering when transitioning
  const lastSegmentRef = useRef<VideoSegment | null>(null);

  if (segment) {
    lastSegmentRef.current = segment;
  }

  const activeSegment = segment || lastSegmentRef.current;

  if (!activeSegment) {
    return null;
  }

  return (
    <div className="absolute inset-0">
      <SegmentVideoPlayer
        segment={activeSegment}
        onReady={onReady}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />
    </div>
  );
}

export function SegmentAssessmentPlayer({
  onComplete,
}: SegmentAssessmentPlayerProps) {
  const {
    // State
    state,
    error,

    // Content
    currentSegment,
    currentQuestion,

    // Answers
    currentAnswer,
    answers,

    // Note: showingWrongFeedback removed - wrong answer feedback is now baked into video segments

    // Results
    coachInsight,
    result,

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
    goBack,
    completeAssessment,
    retry,

    // Derived
    canGoBack,
    isComplete,
    isShowingResults,
    isPlayingSegment,
    isShowingQuestion,
    isResumePrompt,
    isWaitingToStart,
  } = useSegmentAssessment();

  // Calculate question count for progress display
  // 8 questions in V2 assessment flow
  const totalQuestions = 8;
  const answeredQuestions = useMemo(() => {
    return Object.keys(answers).length;
  }, [answers]);

  // Calculate progress percentage based on answered questions only (like V1)
  // Progress is 0 until at least one question is answered
  const progressPercent = useMemo(() => {
    if (answeredQuestions === 0) return 0;
    return (answeredQuestions / totalQuestions) * 100;
  }, [answeredQuestions, totalQuestions]);

  // Stable callbacks for the video player
  const handleVideoReady = useCallback(
    (duration: number) => {
      onVideoReady(duration);
    },
    [onVideoReady],
  );

  const handleVideoTimeUpdate = useCallback(
    (currentTime: number) => {
      onVideoTimeUpdate(currentTime);
    },
    [onVideoTimeUpdate],
  );

  const handleVideoEnded = useCallback(() => {
    onVideoEnded();
  }, [onVideoEnded]);

  // Start loading flow on mount
  useEffect(() => {
    if (state === 'idle') {
      start();
    }
  }, [state, start]);

  // Notify parent when complete
  useEffect(() => {
    if (isComplete && result && onComplete) {
      onComplete(result.bucket, result.assignedJourneyId);
    }
  }, [isComplete, result, onComplete]);

  // Error state
  if (error) {
    return <AssessmentError error={error} onRetry={retry} />;
  }

  // Loading states (initial)
  if (
    state === 'idle' ||
    state === 'loadingFlow' ||
    state === 'checkingSession'
  ) {
    return <AssessmentLoading message="Preparing your session..." />;
  }

  if (state === 'creatingSession') {
    return <AssessmentLoading message="Starting assessment..." />;
  }

  // Resume prompt
  if (isResumePrompt) {
    return (
      <SessionResumePrompt onResume={resumeSession} onStartFresh={startFresh} />
    );
  }

  // Waiting for user to click play - show start screen
  if (isWaitingToStart) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8 md:py-12">
          <div className="w-full max-w-[95%] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
            <AssessmentHeader />

            {/* Video container with play button overlay */}
            <div className="relative w-full">
              {/* Subtle glow behind container */}
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 rounded-2xl blur-xl opacity-50" />

              {/* Main container - 16:9 aspect ratio, black background */}
              <div className="relative rounded-xl overflow-hidden ring-1 ring-white/10">
                <div className="relative w-full aspect-video bg-black flex items-center justify-center">
                  {/* Play button */}
                  <button
                    onClick={startPlayback}
                    className="group relative flex flex-col items-center gap-4 transition-transform duration-300 hover:scale-105"
                  >
                    {/* Play icon circle */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30 group-hover:shadow-amber-500/50 transition-all duration-300">
                      <svg
                        className="w-10 h-10 sm:w-12 sm:h-12 text-white ml-1"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>

                    {/* Start text */}
                    <span
                      className="text-lg sm:text-xl font-semibold text-white"
                      style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                    >
                      Start Assessment
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Progress section - positioned at bottom of container */}
            <div className="mt-8">
              <AssessmentProgress
                progress={0}
                current={0}
                total={totalQuestions}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Results screen - separate layout
  if (isShowingResults || isComplete) {
    return (
      <BucketResultsScreen
        coachInsight={coachInsight}
        result={result}
        onComplete={completeAssessment}
        isSubmitting={state === 'submitting'}
      />
    );
  }

  // Note: Wrong answer feedback screen removed - wrong answer acknowledgment is now
  // baked into video segments that are routed to via 'skill_failed' edge conditions

  // Loading insight - separate layout
  if (state === 'loadingInsight') {
    return <AssessmentLoading message="Preparing your results..." />;
  }

  // ============================================================================
  // Main Assessment Layout - unified for video and questions
  // Video remains visible, question overlay appears on top (like V1)
  // ============================================================================

  // Check if we're in an active assessment state (video or question)
  const isActiveAssessment =
    isPlayingSegment ||
    isShowingQuestion ||
    state === 'loadingSegment' ||
    state === 'loadingQuestion' ||
    state === 'routingNode' ||
    state === 'transitioningNode' ||
    state === 'evaluatingBranch';

  if (isActiveAssessment) {
    // Determine what to show
    const showVideo = isPlayingSegment && currentSegment;
    const showQuestion = isShowingQuestion && currentQuestion;
    const showLoading =
      state === 'loadingSegment' ||
      state === 'loadingQuestion' ||
      state === 'routingNode' ||
      state === 'transitioningNode' ||
      state === 'evaluatingBranch';

    return (
      <div className="min-h-screen flex flex-col">
        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8 md:py-12">
          {/* Content container - scales up through breakpoints */}
          <div className="w-full max-w-[95%] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
            <AssessmentHeader />

            {/* Video/Question container with 16:9 aspect ratio */}
            <div className="relative w-full">
              {/* Subtle glow behind container */}
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 rounded-2xl blur-xl opacity-50" />

              {/* Main container - 16:9 aspect ratio, black background */}
              <div className="relative rounded-xl overflow-hidden ring-1 ring-white/10">
                <div className="relative w-full aspect-video bg-black">
                  {/* Video Player - only shown when playing a segment */}
                  {showVideo && (
                    <PersistentVideoPlayer
                      segment={currentSegment}
                      isVisible={true}
                      onReady={handleVideoReady}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onEnded={handleVideoEnded}
                    />
                  )}

                  {/* Question Overlay - shown on black background after video fades out */}
                  {showQuestion && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center animate-fade-in">
                      {/* Glassmorphism card - centered in the black container */}
                      <div className="w-[90%] max-w-4xl max-h-[90%] overflow-y-auto rounded-2xl sm:rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5 sm:p-6 md:p-8">
                        {/* Back button */}
                        {canGoBack && (
                          <button
                            onClick={goBack}
                            className="mb-4 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                              />
                            </svg>
                            <span>Back</span>
                          </button>
                        )}

                        {/* Question content */}
                        <SegmentQuestionOverlay
                          question={currentQuestion}
                          selectedAnswer={currentAnswer}
                          onSelectAnswer={selectAnswer}
                          onSubmit={submitAnswer}
                          onGoBack={goBack}
                          canGoBack={false}
                        />
                      </div>
                    </div>
                  )}

                  {/* Loading indicator overlay */}
                  {showLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                      <div className="w-12 h-12 relative">
                        <div className="absolute inset-0 rounded-full border-2 border-amber-500/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-t-amber-500 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Progress section - positioned at bottom of container */}
            <div className="mt-8">
              <AssessmentProgress
                progress={progressPercent}
                current={answeredQuestions}
                total={totalQuestions}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Fallback - shouldn't normally reach here
  return <AssessmentLoading message="Preparing your session..." />;
}
