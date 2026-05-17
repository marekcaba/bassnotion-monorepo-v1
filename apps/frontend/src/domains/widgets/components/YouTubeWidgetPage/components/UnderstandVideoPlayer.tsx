'use client';

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { cn } from '@/lib/utils';
import type {
  AnyVideoOverlayEvent,
  UnderstandQuestion,
} from '@bassnotion/contracts';
import { useBunnyPlayer } from '@/domains/assessment/hooks/useBunnyPlayer';
import {
  understandMachine,
  distributeOverlayTimestamps,
} from '@/domains/widgets/hooks/useUnderstandMachine';
import { OverlayRouter } from './OverlayRouter';
import { VideoErrorOverlay } from './VideoErrorOverlay';

// Debug flag for video player
const DEBUG_VIDEO = true;

interface UnderstandVideoPlayerProps {
  /** Bunny Stream video ID */
  videoUrl: string;
  /** Bunny Stream library ID */
  libraryId: string;
  /** Unified overlay events (preferred) */
  overlayEvents?: AnyVideoOverlayEvent[];
  /** Legacy quiz questions (used if overlayEvents not provided) */
  questions?: UnderstandQuestion[];
  /** Called when a quiz question is answered with whether it was correct */
  onQuestionAnswered?: (isCorrect: boolean) => void;
  /** Called when video + all overlay events complete */
  onComplete: () => void;
  /** Called if user skips due to errors */
  onSkip?: () => void;
  /** Optional className for container */
  className?: string;
}

/**
 * Video player with interactive overlay events for the Understand block.
 *
 * Features:
 * - Bunny Stream video playback
 * - Overlay events pause video at specific timestamps
 * - QUIZ overlays show multiple-choice questions
 * - Non-QUIZ overlays show type-specific instruction cards
 * - Audio fade in/out for smooth transitions
 * - Error handling with retry and skip options
 */
export function UnderstandVideoPlayer({
  videoUrl,
  libraryId,
  overlayEvents: overlayEventsProp,
  questions = [],
  onQuestionAnswered,
  onComplete,
  onSkip,
  className,
}: UnderstandVideoPlayerProps) {
  // Normalize: prefer overlayEvents prop, fall back to legacy questions
  const normalizedEvents = useMemo(() => {
    if (overlayEventsProp && overlayEventsProp.length > 0) {
      return overlayEventsProp;
    }
    if (questions.length > 0) {
      return questions.map(
        (q): AnyVideoOverlayEvent => ({
          id: q.id,
          type: 'QUIZ' as const,
          timestamp: q.timestamp ?? 0,
          label: q.question.slice(0, 50),
          content: {
            question: q.question,
            options: q.options,
            correct_option_id: q.correct_option_id,
          },
        }),
      );
    }
    return [];
  }, [overlayEventsProp, questions]);

  const [hasStarted, setHasStarted] = useState(false);
  // Track if we need to resume after an overlay (not for manual pause)
  const shouldResumeAfterOverlayRef = useRef(false);
  // Track if user clicked start before player was ready
  const pendingPlayRef = useRef(false);

  // Initialize state machine
  const [state, send] = useMachine(understandMachine, {
    input: { overlayEvents: normalizedEvents },
  });

  const {
    currentQuestionIndex,
    completedEventIds,
    selectedOptionId,
    error,
    retryCount,
  } = state.context;

  // Get current overlay event (next incomplete)
  const currentEvent = state.context.overlayEvents.find(
    (e) => !completedEventIds.has(e.id),
  );

  const isShowingOverlay = state.matches('showingOverlay');
  const isComplete = state.matches('complete');
  const isSkipped = state.matches('skipped');
  const isError = state.matches('error');
  const isPlaying =
    state.matches('playing') || state.matches('waitingForVideoEnd');

  // Initialize Bunny player
  const {
    containerRef,
    play,
    playWithFade,
    pauseWithFade,
    isPlaying: playerIsPlaying,
    isReady: playerIsReady,
  } = useBunnyPlayer({
    libraryId,
    videoId: videoUrl,
    onReady: (duration) => {
      send({ type: 'VIDEO_READY', duration });
      // Distribute overlay events across video duration
      if (normalizedEvents.length > 0) {
        const distributed = distributeOverlayTimestamps(
          normalizedEvents,
          duration,
        );
        send({ type: 'UPDATE_OVERLAY_EVENTS', overlayEvents: distributed });
      }
    },
    onTimeUpdate: (seconds) => {
      send({ type: 'TIME_UPDATE', seconds });
    },
    onEnded: () => {
      send({ type: 'VIDEO_ENDED' });
    },
    onError: (err) => {
      send({ type: 'ERROR', message: err.message });
    },
  });

  // Handle user clicking to start
  const handleStart = useCallback(() => {
    if (DEBUG_VIDEO) {
      console.log(
        '[UnderstandVideoPlayer] handleStart called, playerIsReady:',
        playerIsReady,
      );
    }
    setHasStarted(true);
    if (playerIsReady) {
      play();
    } else {
      pendingPlayRef.current = true;
      if (DEBUG_VIDEO) {
        console.log(
          '[UnderstandVideoPlayer] Player not ready, queuing play action',
        );
      }
    }
  }, [play, playerIsReady]);

  // Play video when player becomes ready if user already clicked start
  useEffect(() => {
    if (playerIsReady && pendingPlayRef.current) {
      if (DEBUG_VIDEO) {
        console.log(
          '[UnderstandVideoPlayer] Player now ready, executing queued play',
        );
      }
      pendingPlayRef.current = false;
      play();
    }
  }, [playerIsReady, play]);

  // Pause video when showing overlay
  useEffect(() => {
    if (isShowingOverlay && playerIsPlaying) {
      shouldResumeAfterOverlayRef.current = true;
      pauseWithFade(500);
    }
  }, [isShowingOverlay, playerIsPlaying, pauseWithFade]);

  // Resume video only after completing an overlay (not when user manually pauses)
  useEffect(() => {
    if (isPlaying && !playerIsPlaying && shouldResumeAfterOverlayRef.current) {
      shouldResumeAfterOverlayRef.current = false;
      playWithFade(500);
    }
  }, [isPlaying, playerIsPlaying, playWithFade]);

  // Notify parent when complete
  useEffect(() => {
    if (isComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  // Notify parent when skipped
  useEffect(() => {
    if (isSkipped) {
      onSkip?.();
    }
  }, [isSkipped, onSkip]);

  // Handle quiz option selection
  const handleOptionSelect = useCallback(
    (optionId: string) => {
      send({ type: 'OPTION_SELECTED', optionId });
    },
    [send],
  );

  // Handle quiz answer submission
  const handleSubmitAnswer = useCallback(() => {
    if (currentEvent && currentEvent.type === 'QUIZ' && selectedOptionId) {
      const isCorrect =
        selectedOptionId === currentEvent.content.correct_option_id;
      onQuestionAnswered?.(isCorrect);
    }
    send({ type: 'SUBMIT_ANSWER' });
  }, [send, currentEvent, selectedOptionId, onQuestionAnswered]);

  // Handle non-quiz overlay continue
  const handleOverlayContinue = useCallback(() => {
    send({ type: 'OVERLAY_CONTINUE' });
  }, [send]);

  // Handle retry
  const handleRetry = useCallback(() => {
    send({ type: 'RETRY' });
  }, [send]);

  // Handle skip to practice
  const handleSkipToPractice = useCallback(() => {
    send({ type: 'SKIP_TO_PRACTICE' });
  }, [send]);

  return (
    <div
      className={cn(
        'relative w-full max-w-[64rem] mx-auto',
        'rounded-xl overflow-hidden',
        'bg-gray-900',
        'shadow-[0_20px_60px_10px_rgba(0,0,0,0.7)]',
        className,
      )}
    >
      {/* Video container - 16:9 aspect ratio */}
      <div className="relative w-full aspect-video">
        {/* Bunny Stream player */}
        <div
          ref={containerRef}
          className={cn(
            'w-full h-full',
            isShowingOverlay && 'pointer-events-none',
          )}
        />

        {/* Start overlay - covers video controls until user clicks to start */}
        {!hasStarted && !isError && (
          <div
            className={cn(
              'absolute inset-0 z-10',
              'flex items-center justify-center',
              'cursor-pointer',
            )}
            style={{
              backgroundColor: '#0b0b0b',
              backgroundImage: `url(https://vz-17cd914d-63d.b-cdn.net/${videoUrl}/thumbnail.jpg)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            onClick={handleStart}
            role="button"
            aria-label="Start video"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleStart();
              }
            }}
          >
            {/* Dark overlay for better contrast */}
            <div className="absolute inset-0 bg-black/50" />

            <div className="relative flex flex-col items-center gap-4">
              {/* Play button */}
              <div className="relative group">
                <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl group-hover:bg-purple-500/30 transition-all duration-300" />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 group-hover:scale-105 transition-all duration-300">
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
              <p className="text-white/90 text-sm sm:text-base drop-shadow-lg">
                Click to start
              </p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {!playerIsReady && !isError && hasStarted && (
          <div
            className={cn(
              'absolute inset-0 z-10',
              'flex items-center justify-center',
              'bg-gray-900',
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-white/50 text-sm">Loading video...</span>
            </div>
          </div>
        )}

        {/* Overlay event (quiz or generic) */}
        {currentEvent && (
          <OverlayRouter
            event={currentEvent}
            eventNumber={currentQuestionIndex + 1}
            totalEvents={state.context.overlayEvents.length}
            selectedOptionId={selectedOptionId}
            onOptionSelect={handleOptionSelect}
            onSubmitAnswer={handleSubmitAnswer}
            onContinue={handleOverlayContinue}
            isVisible={isShowingOverlay}
          />
        )}

        {/* Error overlay */}
        {isError && (
          <VideoErrorOverlay
            error={error || 'Video failed to load'}
            retryCount={retryCount}
            onRetry={handleRetry}
            onSkip={handleSkipToPractice}
          />
        )}
      </div>
    </div>
  );
}
