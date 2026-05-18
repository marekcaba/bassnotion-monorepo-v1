'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { cn } from '@/lib/utils';
import { useBunnyPlayer } from '../hooks/useBunnyPlayer';
import { useAssessmentAudioPreloader } from '../hooks/useAssessmentAudioPreloader';
import { assessmentMachine } from '../machines/assessmentMachine';
import { QuestionOverlay } from './QuestionOverlay';
import { ResultsScreen } from './ResultsScreen';
import { ResumePrompt } from './ResumePrompt';
import type {
  AssessmentQuestion,
  AssessmentProgress,
} from '@bassnotion/contracts';

/**
 * Distributes questions evenly throughout the video duration.
 * Ensures the last question appears at least `endBuffer` seconds before video end.
 *
 * @param questions - Original questions array
 * @param videoDuration - Total video duration in seconds
 * @param startOffset - Seconds from start before first question (default: 15)
 * @param endBuffer - Seconds before end for last question (default: 12)
 * @returns Questions with recalculated timestamps
 */
function distributeQuestionsOverVideo(
  questions: AssessmentQuestion[],
  videoDuration: number,
  startOffset = 15,
  endBuffer = 12,
): AssessmentQuestion[] {
  if (questions.length === 0 || videoDuration <= 0) {
    return questions;
  }

  // Available window for questions: from startOffset to (videoDuration - endBuffer)
  const availableWindow = videoDuration - startOffset - endBuffer;

  if (availableWindow <= 0 || questions.length === 1) {
    // Not enough time or only one question - place first question at startOffset
    return questions.map((q, i) => ({
      ...q,
      timestamp: i === 0 ? startOffset : startOffset + i * 10, // Fallback spacing
    }));
  }

  // Calculate interval between questions
  const interval = availableWindow / (questions.length - 1 || 1);

  return questions.map((question, index) => ({
    ...question,
    timestamp: Math.round(startOffset + index * interval),
  }));
}

interface BunnyQuizPlayerProps {
  libraryId: string; // Bunny Stream video library ID
  videoId: string; // Bunny Stream video ID
  questions: AssessmentQuestion[];
  onComplete?: (assignedJourneyId: string | null) => void;
  onProgressChange?: (answeredCount: number, totalCount: number) => void;
  onFirstQuestion?: () => void; // Called when first question appears
}

export function BunnyQuizPlayer({
  libraryId,
  videoId,
  questions: originalQuestions,
  onComplete,
  onProgressChange,
  onFirstQuestion,
}: BunnyQuizPlayerProps) {
  const hasCalledComplete = useRef(false);
  const hasCalledFirstQuestion = useRef(false);
  const pendingSeekRef = useRef<number | null>(null); // Track pending seek position after video ready
  const [hasUserStarted, setHasUserStarted] = useState(false); // Track if user has clicked to start
  const [isOverlayFading, setIsOverlayFading] = useState(false); // Track fade-out animation
  const [videoDuration, setVideoDuration] = useState<number>(0);

  // Preload all question audio files for instant playback (FAANG pattern)
  useAssessmentAudioPreloader({
    questions: originalQuestions,
    preloadOnMount: true,
  });

  // Initialize state machine with original questions (will be updated once video duration is known)
  const [state, send] = useMachine(assessmentMachine, {
    input: { questions: originalQuestions },
  });

  // Keep a ref to originalQuestions so we can access it synchronously in callbacks
  const originalQuestionsRef = useRef(originalQuestions);
  useEffect(() => {
    originalQuestionsRef.current = originalQuestions;
  }, [originalQuestions]);

  // Use distributed questions for display (from state machine context)
  const questions = state.context.questions;

  const {
    currentQuestionIndex,
    answers,
    selectedOptionId,
    selectedOptionIds,
    textAnswer,
    dragDropMapping,
    skillLevel,
    percentageScore,
    assignedJourneyId,
    savedProgress,
  } = state.context;

  const currentQuestion = questions[currentQuestionIndex];
  const isShowingQuestion = state.matches('showingQuestion');
  const isComplete = state.matches('complete');
  const isResumePrompt = state.matches('resumePrompt');
  const isLoading = state.matches('loading');
  const isSubmitting = state.matches('submitting');
  const isError = state.matches('error');
  const isWaitingForVideoEnd = state.matches('waitingForVideoEnd');

  // Bunny Stream player
  const {
    containerRef,
    play,
    playWithFade,
    pause,
    pauseWithFade,
    seekTo,
    isReady,
    isPlaying,
  } = useBunnyPlayer({
    libraryId,
    videoId,
    onReady: (duration) => {
      // CRITICAL: Update questions with distributed timestamps BEFORE transitioning to playing state
      // This prevents the race condition where TIME_UPDATE events arrive with old timestamps
      const distributed = distributeQuestionsOverVideo(
        originalQuestionsRef.current,
        duration,
        15,
        12,
      );
      console.log(
        '[Assessment] Distributing questions for video duration:',
        duration,
      );
      console.log(
        '[Assessment] Distributed timestamps:',
        JSON.stringify(
          distributed.map((q) => ({ id: q.id, timestamp: q.timestamp })),
        ),
      );

      // Send UPDATE_QUESTIONS first, then VIDEO_READY to transition to playing
      send({ type: 'UPDATE_QUESTIONS', questions: distributed });

      // Store duration for React state (used by other components if needed)
      setVideoDuration(duration);
      send({ type: 'VIDEO_READY', duration });
    },
    onTimeUpdate: (seconds) => {
      send({ type: 'TIME_UPDATE', seconds });
    },
    onEnded: () => {
      send({ type: 'VIDEO_ENDED' });
    },
    onError: (error) => {
      send({ type: 'ERROR', message: error.message });
    },
  });

  // Pause video with audio fade when showing question
  useEffect(() => {
    if (isShowingQuestion && isPlaying) {
      pauseWithFade(500); // 500ms fade out for smooth transition
    }
  }, [isShowingQuestion, isPlaying, pauseWithFade]);

  // Submit answer - the play effect will handle resuming with fade
  const handleSubmitAnswer = useCallback(() => {
    send({ type: 'SUBMIT_ANSWER' });
  }, [send]);

  // Go back to previous question
  const handleGoBack = useCallback(async () => {
    send({ type: 'GO_BACK' });
    // Seek video to previous question's timestamp
    const prevQuestion = questions[currentQuestionIndex - 1];
    if (prevQuestion) {
      await seekTo(prevQuestion.timestamp);
    }
  }, [send, questions, currentQuestionIndex, seekTo]);

  // Handle resume/start fresh
  const handleRestore = useCallback(
    (progress: AssessmentProgress) => {
      // Set pending seek to saved position - will be applied when video becomes ready
      pendingSeekRef.current = progress.videoCurrentTime;
      send({ type: 'RESTORE_PROGRESS', progress });
      // If video is already ready, re-send VIDEO_READY since the state machine
      // is now in 'loading' state waiting for it
      if (isReady) {
        setTimeout(() => {
          send({ type: 'VIDEO_READY', duration: 0 });
        }, 50);
      }
    },
    [send, isReady],
  );

  const handleStartFresh = useCallback(() => {
    // Set pending seek to 0 - will be applied when video becomes ready
    pendingSeekRef.current = 0;
    send({ type: 'START_FRESH' });
    // If video is already ready, re-send VIDEO_READY since the state machine
    // is now in 'loading' state waiting for it
    if (isReady) {
      // Small delay to ensure state transition completes first
      setTimeout(() => {
        send({ type: 'VIDEO_READY', duration: 0 });
      }, 50);
    }
  }, [send, isReady]);

  // Notify parent when complete
  useEffect(() => {
    if (isComplete && !hasCalledComplete.current) {
      hasCalledComplete.current = true;
      onComplete?.(assignedJourneyId);
    }
  }, [isComplete, assignedJourneyId, onComplete]);

  // Notify parent of progress changes
  // Include tentative progress: if user has selected an option for current question, count it
  useEffect(() => {
    // Determine if current question has a tentative answer
    let hasTentativeAnswer = false;
    if (currentQuestion && isShowingQuestion) {
      switch (currentQuestion.type) {
        case 'multiple-choice':
          hasTentativeAnswer = selectedOptionId !== null;
          break;
        case 'multi-select':
          hasTentativeAnswer = selectedOptionIds.length > 0;
          break;
        case 'text-input':
          hasTentativeAnswer = textAnswer.trim().length > 0;
          break;
        case 'drag-drop':
          // Count as tentative if all drop zones are filled
          const requiredZones =
            currentQuestion.dragDropConfig?.dropZones.length || 0;
          hasTentativeAnswer =
            Object.keys(dragDropMapping).length >= requiredZones;
          break;
      }
    }

    // Progress = submitted answers + tentative (if any)
    const progressCount = answers.length + (hasTentativeAnswer ? 1 : 0);
    onProgressChange?.(progressCount, questions.length);
  }, [
    answers.length,
    questions.length,
    onProgressChange,
    currentQuestion,
    isShowingQuestion,
    selectedOptionId,
    selectedOptionIds,
    textAnswer,
    dragDropMapping,
  ]);

  // Notify parent when first question appears
  useEffect(() => {
    if (isShowingQuestion && !hasCalledFirstQuestion.current) {
      hasCalledFirstQuestion.current = true;
      onFirstQuestion?.();
    }
  }, [isShowingQuestion, onFirstQuestion]);

  // Track if user has answered at least one question (for fade-in logic)
  const hasAnsweredQuestionRef = useRef(false);

  // Update ref when answers change
  useEffect(() => {
    if (answers.length > 0) {
      hasAnsweredQuestionRef.current = true;
    }
  }, [answers.length]);

  // Handle pending seek and start playing when ready (only after user has started)
  // Also resume video when waiting for video to end after last question
  useEffect(() => {
    const shouldPlay =
      isReady &&
      hasUserStarted &&
      !isResumePrompt &&
      !isShowingQuestion &&
      !isComplete;

    if (shouldPlay) {
      // Check if there's a pending seek
      if (pendingSeekRef.current !== null) {
        const seekPosition = pendingSeekRef.current;
        pendingSeekRef.current = null;
        // Resuming from saved progress - use fade-in for smoother experience
        seekTo(seekPosition).then(() => playWithFade(500));
      } else if (hasAnsweredQuestionRef.current || isWaitingForVideoEnd) {
        // Coming back from a question or waiting for video end - use fade-in
        playWithFade(500);
      } else {
        // Initial start - play at full volume immediately
        play();
      }
    }

    // Ensure video is paused when assessment is complete (prevent looping)
    if (isComplete && isPlaying) {
      pause();
    }
  }, [
    isReady,
    hasUserStarted,
    isResumePrompt,
    isShowingQuestion,
    isComplete,
    isWaitingForVideoEnd,
    isPlaying,
    play,
    playWithFade,
    pause,
    seekTo,
  ]);

  // Handle user clicking to start the assessment
  const handleStartAssessment = useCallback(() => {
    // Start fade-out animation and play video immediately
    setIsOverlayFading(true);
    setHasUserStarted(true);
  }, []);

  // Results screen is now rendered as an overlay inside the video container (see below)
  // This ensures it matches the same size and styling as the question overlays

  return (
    <div className="relative w-full">
      {/* Video container - acts as the positioning context for all overlays */}
      <div
        className={cn(
          'relative w-full aspect-video rounded-xl overflow-hidden',
          'bg-gray-900',
        )}
      >
        {/* Video player - always rendered so it can load in background */}
        <div
          ref={containerRef}
          className={cn(
            'w-full h-full',
            (isShowingQuestion || isResumePrompt) && 'pointer-events-none',
          )}
        />

        {/* Start overlay - shown before user clicks to start (covers video controls) */}
        {(!hasUserStarted || isOverlayFading) && !isResumePrompt && (
          <div
            className={cn(
              'absolute inset-0 z-10',
              'flex items-center justify-center',
              isOverlayFading ? 'pointer-events-none' : 'cursor-pointer',
            )}
            style={{
              backgroundColor: '#0b0b0b',
              backgroundImage: `url(https://vz-17cd914d-63d.b-cdn.net/${videoId}/thumbnail.jpg)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: isOverlayFading ? 0 : 1,
              transition: 'opacity 2000ms ease-out',
            }}
            onClick={!isOverlayFading ? handleStartAssessment : undefined}
            role="button"
            aria-label="Start assessment"
            tabIndex={isOverlayFading ? -1 : 0}
            onKeyDown={(e) => {
              if (!isOverlayFading && (e.key === 'Enter' || e.key === ' ')) {
                handleStartAssessment();
              }
            }}
          >
            {/* Dark overlay for better contrast */}
            <div className="absolute inset-0 bg-black/50" />

            <div className="relative flex flex-col items-center gap-4">
              {/* Play button */}
              <div className="relative group">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl group-hover:bg-amber-500/30 transition-all duration-300" />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 group-hover:scale-105 transition-all duration-300">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              {/* Text */}
              <p
                className="text-white/90 text-sm sm:text-base drop-shadow-lg"
                style={{ fontFamily: 'var(--font-inter), sans-serif' }}
              >
                Click to start
              </p>
            </div>
          </div>
        )}

        {/* Loading overlay - shown when video is loading */}
        {(isLoading || isSubmitting) &&
          !isReady &&
          !isResumePrompt &&
          hasUserStarted && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400">
                  {isSubmitting ? 'Saving your results...' : 'Loading video...'}
                </p>
              </div>
            </div>
          )}

        {/* Resume prompt overlay - styled like a question overlay */}
        {isResumePrompt && savedProgress && (
          <ResumePrompt
            savedProgress={savedProgress}
            totalQuestions={questions.length}
            onRestore={() => handleRestore(savedProgress)}
            onStartFresh={handleStartFresh}
          />
        )}

        {/* Error overlay */}
        {isError && (
          <div
            className={cn(
              'absolute inset-0 z-10',
              'flex items-center justify-center',
              'bg-black/90 backdrop-blur-sm',
              'animate-fade-in',
            )}
          >
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">
                Something went wrong
              </h2>
              <p className="text-gray-400 text-sm">{state.context.error}</p>
              <button
                onClick={() => send({ type: 'RETRY' })}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-semibold transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Question overlay - positioned within video container */}
        {currentQuestion && (
          <QuestionOverlay
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            selectedOptionId={selectedOptionId}
            selectedOptionIds={selectedOptionIds}
            textAnswer={textAnswer}
            dragDropMapping={dragDropMapping}
            onOptionSelect={(optionId) =>
              send({ type: 'OPTION_SELECTED', optionId })
            }
            onOptionsSelect={(optionIds) =>
              send({ type: 'OPTIONS_SELECTED', optionIds })
            }
            onTextChange={(text) => send({ type: 'TEXT_ENTERED', text })}
            onDragDropChange={(mapping) =>
              send({ type: 'DRAG_DROP_UPDATED', mapping })
            }
            onSubmit={handleSubmitAnswer}
            onBack={handleGoBack}
            canGoBack={currentQuestionIndex > 0}
            isVisible={isShowingQuestion}
          />
        )}

        {/* Results screen overlay - positioned within video container (same as questions) */}
        {isComplete && (
          <ResultsScreen
            skillLevel={skillLevel!}
            percentageScore={percentageScore}
            totalQuestions={
              questions.filter((q) => q.category === 'knowledge').length
            }
            correctAnswers={answers.filter((a) => a.isCorrect).length}
            assignedJourneyId={assignedJourneyId}
            asOverlay
          />
        )}
      </div>
    </div>
  );
}
