'use client';

/**
 * PlaybackControlsBar Component
 *
 * Renders the main playback control bar with:
 * - Countdown dots display
 * - Loop/Favorite buttons with sparkle animations
 * - Previous/Next exercise navigation
 * - Play/Stop button with countdown state
 * - Like/Comment buttons with sparkle animations
 */

import React from 'react';
import {
  Play,
  Square,
  Heart,
  Loader2,
  SkipBack,
  SkipForward,
  Star,
  Repeat,
} from 'lucide-react';
import type { MusicalExercise as Exercise } from '@bassnotion/contracts';
import type { SparkleParticle } from '../types.js';

/**
 * Countdown state for the playback controls
 */
export interface PlaybackCountdownState {
  isCountingDown: boolean;
  currentBeat: number;
  totalBeats: number;
}

/**
 * Props for the PlaybackControlsBar component
 */
export interface PlaybackControlsBarProps {
  /** Currently selected exercise */
  selectedExercise: Exercise | null | undefined;
  /** List of available exercises for navigation */
  exercises: Exercise[];
  /** Current countdown state */
  countdownState: PlaybackCountdownState;
  /** Whether transport is playing */
  isPlaying: boolean;
  /** Whether loop is enabled */
  isLoopEnabled: boolean;

  // Social interaction state
  isLiked: boolean;
  likeCount: number;
  isLikePending: boolean;
  likeSparkles: SparkleParticle[];
  isFavorited: boolean;
  isFavoritePending: boolean;
  favoriteSparkles: SparkleParticle[];
  loopSparkles: SparkleParticle[];
  isLooped: boolean;
  loopBump: boolean;
  commentSparkles: SparkleParticle[];
  isCommented: boolean;
  commentBump: boolean;

  // Event handlers
  handlePlayButtonClick: () => void;
  handlePreviousExercise: () => void;
  handleNextExercise: () => void;
  handleLikeClick: () => void;
  handleFavoriteClick: () => void;
  handleLoopClick: () => void;
  handleCommentClick: () => void;
  handleLoopMouseLeave: () => void;
  handleCommentMouseLeave: () => void;
  onToggleLoop?: () => void;

  /** Whether to show countdown dots internally (default: true for backwards compatibility) */
  showCountdownDots?: boolean;
  /** Compact mode for bottom bar (smaller play button, reduced padding) */
  compact?: boolean;
  /**
   * True while play handler is waiting for samples to load, an exercise is
   * loading, or a play/stop toggle is in flight. Renders a spinner inside
   * the play button and disables clicks to prevent double-taps that
   * triggered race conditions in the old toast-cascade flow.
   */
  isPlayButtonBusy?: boolean;
}

/**
 * PlaybackControlsBar - Main playback control bar component
 */
export const PlaybackControlsBar: React.FC<PlaybackControlsBarProps> = ({
  selectedExercise,
  exercises,
  countdownState,
  isPlaying,
  isLoopEnabled,
  isLiked,
  likeCount,
  isLikePending,
  likeSparkles,
  isFavorited,
  isFavoritePending,
  favoriteSparkles,
  loopSparkles,
  loopBump,
  commentSparkles,
  isCommented,
  commentBump,
  handlePlayButtonClick,
  handlePreviousExercise,
  handleNextExercise,
  handleLikeClick,
  handleFavoriteClick,
  handleLoopClick,
  handleCommentClick,
  handleLoopMouseLeave,
  handleCommentMouseLeave,
  onToggleLoop,
  showCountdownDots = false, // Default to false - dots now rendered externally
  compact = false,
  isPlayButtonBusy = false,
}) => {
  const playButtonSize = compact ? 60 : 78;
  // Disable the play button while loading/toggling, but never block STOP —
  // when transport is playing the user must always be able to stop it.
  const playButtonDisabled =
    isPlayButtonBusy && !isPlaying && !countdownState.isCountingDown;

  return (
    <div className={`bg-transparent rounded-2xl ${compact ? 'p-2' : 'p-4'}`}>
      {/* Two-Row Player Layout */}
      <div className="flex flex-col gap-3">
        {/* First Row - Mode Button, Playback Controls, View Button */}
        <div className="flex items-center justify-between">
          {/* Left Side - Spacer for layout balance */}
          <div className="flex justify-center items-center py-2 w-24">
            {/* Empty spacer to maintain layout symmetry */}
          </div>

          {/* Center - Playback Controls */}
          <div className="flex flex-col items-center justify-center gap-2">
            {/* Countdown Dots - shown above play button (only if showCountdownDots is true) */}
            {showCountdownDots && selectedExercise && (
              <div className="flex items-center justify-center gap-2 mb-1">
                {Array.from({ length: countdownState.totalBeats }).map(
                  (_, index) => {
                    const beatNumber = index + 1;
                    return (
                      <div
                        key={index}
                        className={`w-3 h-3 rounded-full transition-all duration-200 ${
                          countdownState.isCountingDown &&
                          beatNumber === countdownState.currentBeat
                            ? 'bg-blue-400 shadow-lg shadow-blue-400/50 scale-125'
                            : countdownState.isCountingDown &&
                                beatNumber < countdownState.currentBeat
                              ? 'bg-blue-600'
                              : 'bg-blue-500/30'
                        }`}
                      />
                    );
                  },
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-2">
              {/* Loop button */}
              <div className="relative">
                <button
                  onClick={() => {
                    handleLoopClick();
                    onToggleLoop?.();
                  }}
                  onMouseLeave={handleLoopMouseLeave}
                  className={`p-3 rounded-full bg-slate-800 transition-all duration-200 ${isLoopEnabled ? 'shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]' : loopBump ? 'shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)]' : 'shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]'}`}
                  title={isLoopEnabled ? 'Disable loop' : 'Enable loop'}
                >
                  <Repeat
                    className={`w-5 h-5 transition-all duration-300 ease-out ${isLoopEnabled ? 'text-green-500 scale-110' : 'text-slate-400'}`}
                  />
                </button>
                {/* Sparkle loop animation */}
                {loopSparkles.map((sparkle) => (
                  <Repeat
                    key={sparkle.id}
                    className="absolute w-2 h-2 text-green-400 pointer-events-none animate-sparkle-burst"
                    style={
                      {
                        top: '50%',
                        left: '50%',
                        '--sparkle-x': `${sparkle.x}px`,
                        '--sparkle-y': `${sparkle.y}px`,
                        '--sparkle-scale': sparkle.scale,
                        '--sparkle-rotation': `${sparkle.rotation}deg`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>

              {/* Favorite button */}
              <div className="relative ml-8 mr-8">
                <button
                  onClick={handleFavoriteClick}
                  disabled={isFavoritePending}
                  className={`p-3 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 ${isFavorited ? 'shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]' : ''} ${isFavoritePending ? 'opacity-70' : ''}`}
                  title={
                    isFavorited ? 'Remove from favorites' : 'Add to favorites'
                  }
                >
                  <Star
                    className={`w-5 h-5 transition-all duration-300 ease-out ${isFavorited ? 'text-amber-400 fill-amber-400 scale-110' : 'text-slate-400'}`}
                  />
                </button>
                {/* Sparkle stars animation */}
                {favoriteSparkles.map((sparkle) => (
                  <Star
                    key={sparkle.id}
                    className="absolute w-2 h-2 text-amber-300 fill-amber-300 pointer-events-none animate-sparkle-burst"
                    style={
                      {
                        top: '50%',
                        left: '50%',
                        '--sparkle-x': `${sparkle.x}px`,
                        '--sparkle-y': `${sparkle.y}px`,
                        '--sparkle-scale': sparkle.scale,
                        '--sparkle-rotation': `${sparkle.rotation}deg`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>

              {/* Previous button */}
              <button
                onClick={handlePreviousExercise}
                disabled={exercises.length === 0}
                className={`p-3 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 ${exercises.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={
                  exercises.length === 0
                    ? 'No exercises available'
                    : 'Previous exercise'
                }
              >
                <SkipBack className="w-6 h-6 text-slate-300" />
              </button>

              {/* Play button */}
              <button
                onClick={handlePlayButtonClick}
                disabled={!selectedExercise || playButtonDisabled}
                aria-busy={isPlayButtonBusy}
                aria-label={
                  !selectedExercise
                    ? 'Select an exercise to play'
                    : isPlayButtonBusy && !isPlaying
                      ? 'Loading samples'
                      : isPlaying
                        ? 'Stop'
                        : 'Play'
                }
                aria-keyshortcuts="Space"
                className={`mx-2 rounded-full shadow-[4px_4px_8px_rgba(0,0,0,0.5),-4px_-4px_8px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 flex items-center justify-center relative ${
                  !selectedExercise
                    ? 'bg-slate-600 opacity-50 cursor-not-allowed'
                    : playButtonDisabled
                      ? 'bg-blue-500 opacity-70 cursor-wait'
                      : 'bg-blue-500'
                }`}
                style={{
                  width: `${playButtonSize}px`,
                  height: `${playButtonSize}px`,
                }}
                title={
                  !selectedExercise
                    ? 'Please select an exercise first'
                    : isPlayButtonBusy && !isPlaying
                      ? 'Loading samples…'
                      : countdownState.isCountingDown
                        ? 'Counting down...'
                        : ''
                }
              >
                {/* While loading samples (and not already playing), show a
                    spinner inside the button — this replaces the old 4-toast
                    cascade ("Loading Sounds…" → "Ready!" → "Loading Bass
                    Sounds…" → "Ready!") with a single visible signal. */}
                {isPlayButtonBusy && !isPlaying ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : countdownState.isCountingDown &&
                  countdownState.currentBeat > 0 ? (
                  <div className="text-3xl font-bold text-white">
                    {countdownState.currentBeat}
                  </div>
                ) : countdownState.isCountingDown ? (
                  <Play className="w-5 h-5 ml-0.5 text-white" />
                ) : isPlaying ? (
                  <Square className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5 text-white" />
                )}
              </button>

              {/* Next button */}
              <button
                onClick={handleNextExercise}
                disabled={exercises.length === 0}
                className={`p-3 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 ${exercises.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={
                  exercises.length === 0
                    ? 'No exercises available'
                    : 'Next exercise'
                }
              >
                <SkipForward className="w-6 h-6 text-slate-300" />
              </button>

              {/* Like button */}
              <div className="relative ml-8">
                <button
                  onClick={handleLikeClick}
                  disabled={isLikePending}
                  className={`p-3 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 ${isLiked ? 'shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]' : ''} ${isLikePending ? 'opacity-70' : ''}`}
                  title={isLiked ? 'Unlike' : 'Like'}
                >
                  <Heart
                    className={`w-5 h-5 transition-all duration-300 ease-out ${isLiked ? 'text-red-500 fill-red-500 scale-110' : 'text-slate-400'}`}
                  />
                </button>
                {/* Like count badge */}
                {likeCount > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 text-xs font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md transition-colors duration-300 ${isLiked ? 'bg-red-500 text-white' : 'bg-slate-600 text-slate-200'}`}
                  >
                    {likeCount > 99 ? '99+' : likeCount}
                  </span>
                )}
                {/* Sparkle hearts animation */}
                {likeSparkles.map((sparkle) => (
                  <Heart
                    key={sparkle.id}
                    className="absolute w-2 h-2 text-red-400 fill-red-400 pointer-events-none animate-sparkle-burst"
                    style={
                      {
                        top: '50%',
                        left: '50%',
                        '--sparkle-x': `${sparkle.x}px`,
                        '--sparkle-y': `${sparkle.y}px`,
                        '--sparkle-scale': sparkle.scale,
                        '--sparkle-rotation': `${sparkle.rotation}deg`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>

              {/* Comment button hidden until comments ship — clicking it
                  previously fired a "coming soon" toast on every tap even
                  after the bump animation, which was noisy and dishonest. */}
            </div>

            {/* Show message when no exercise selected */}
            {!selectedExercise && (
              <div className="text-xs text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                Please select an exercise to start playback
              </div>
            )}
          </div>

          {/* Right Side - Spacer for layout balance */}
          <div className="flex justify-center items-center py-2 w-24">
            {/* Empty spacer to maintain layout symmetry */}
          </div>
        </div>
      </div>
    </div>
  );
};
