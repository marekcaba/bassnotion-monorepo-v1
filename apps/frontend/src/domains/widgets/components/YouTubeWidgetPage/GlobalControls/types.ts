/**
 * GlobalControls Type Definitions
 *
 * Shared types and interfaces for the GlobalControls component
 * and its sub-components.
 */

import type { MusicalExercise as Exercise } from '@bassnotion/contracts';

/**
 * Loop region configuration for exercise playback
 */
export interface LoopRegion {
  startMeasure: number;
  endMeasure: number;
  startBeat?: number;
  endBeat?: number;
}

/**
 * Countdown state for visual indicators
 */
export interface CountdownState {
  /** Whether countdown is currently active */
  isCountingDown: boolean;
  /** Current beat number (1-indexed, 0 when not counting) */
  currentBeat: number;
  /** Total number of beats in countdown */
  totalBeats: number;
}

/**
 * Props for the GlobalControls component
 */
export interface GlobalControlsProps {
  /** The currently selected exercise */
  selectedExercise?: Exercise;
  /** Duration of the exercise in seconds */
  duration: number;
  /** List of available exercises for navigation */
  exercises?: Exercise[];
  /** Callback when an exercise is selected */
  onExerciseSelect?: (exerciseId: string) => void;
  /** Whether there are selected dots on the fretboard */
  hasSelectedDots?: boolean;
  /** Loop region configuration */
  loopRegion?: LoopRegion | null;
  /** Whether loop mode is enabled */
  isLoopEnabled?: boolean;
  /** Callback when play state changes */
  onPlayStateChange?: (isPlaying: boolean) => void;
  /** Callback when countdown state changes (for external rendering of countdown dots) */
  onCountdownStateChange?: (state: CountdownState) => void;
  /** Callback to toggle loop mode */
  onToggleLoop?: () => void;
  /** Compact mode for bottom bar (smaller play button, reduced padding) */
  compact?: boolean;
}

/**
 * Sparkle particle for button animations
 */
export interface SparkleParticle {
  id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/**
 * State for social interactions (like, favorite, comment)
 */
export interface SocialState {
  /** Whether the current user has liked the exercise */
  isLiked: boolean;
  /** Total like count for the exercise */
  likeCount: number;
  /** Whether the current user has favorited the exercise */
  isFavorited: boolean;
  /** Whether like mutation is pending */
  isLikePending: boolean;
  /** Whether favorite mutation is pending */
  isFavoritePending: boolean;
  /** Active sparkle particles for like button animation */
  likeSparkles: SparkleParticle[];
  /** Active sparkle particles for favorite button animation */
  favoriteSparkles: SparkleParticle[];
  /** Active sparkle particles for loop button animation */
  loopSparkles: SparkleParticle[];
  /** Active sparkle particles for comment button animation */
  commentSparkles: SparkleParticle[];
}

/**
 * Playback control state
 */
export interface PlaybackControlState {
  /** Whether a playback toggle is in progress */
  isTogglingPlayback: boolean;
  /** Whether the audio system is initialized */
  systemInitialized: boolean;
  /** Whether the audio context is initialized */
  audioInitialized: boolean;
}

/**
 * Exercise loader state
 */
export interface ExerciseLoaderState {
  /** Whether an exercise is currently loading */
  isLoadingExercise: boolean;
  /** ID of the last successfully loaded exercise */
  lastLoadedExerciseId: string | null;
}

/**
 * Tempo control state
 */
export interface TempoControlState {
  /** Current local tempo value (for UI responsiveness) */
  localTempo: number;
  /** Whether the tempo slider is being dragged */
  isDragging: boolean;
}

/**
 * Props for the CountdownIndicator component
 */
export interface CountdownIndicatorProps {
  /** Total number of beats in the countdown */
  totalBeats: number;
  /** Current beat number (1-indexed) */
  currentBeat: number;
  /** Whether countdown is active */
  isCountingDown: boolean;
}

/**
 * Props for the SparkleAnimation component
 */
export interface SparkleAnimationProps {
  /** Array of sparkle particles to render */
  sparkles: SparkleParticle[];
  /** Icon component to use for sparkles */
  Icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  /** Tailwind color class for the sparkles */
  colorClass: string;
}

/**
 * Props for social action buttons
 */
export interface SocialActionsBarProps {
  /** Exercise ID for social actions */
  exerciseId: string;
  /** Social state from useSocialInteractions hook */
  socialState: SocialState;
  /** Handler for like button click */
  onLikeClick: () => void;
  /** Handler for favorite button click */
  onFavoriteClick: () => void;
  /** Handler for loop button click */
  onLoopClick: () => void;
  /** Handler for comment button click */
  onCommentClick: () => void;
  /** Whether loop mode is active */
  isLooped: boolean;
  /** Whether comment mode is active */
  isCommented: boolean;
}

/**
 * Props for the PlaybackControlsSection component
 */
export interface PlaybackControlsSectionProps {
  /** The currently selected exercise */
  selectedExercise?: Exercise;
  /** List of available exercises */
  exercises: Exercise[];
  /** Countdown state */
  countdownState: {
    isCountingDown: boolean;
    currentBeat: number;
    totalBeats: number;
  };
  /** Whether transport is playing */
  isPlaying: boolean;
  /** Whether playback toggle is in progress */
  isTogglingPlayback: boolean;
  /** Handler for play button click */
  onPlayClick: () => void;
  /** Handler for previous exercise */
  onPreviousExercise: () => void;
  /** Handler for next exercise */
  onNextExercise: () => void;
  /** Social state from useSocialInteractions hook */
  socialState: SocialState;
  /** Handler for like button click */
  onLikeClick: () => void;
  /** Handler for favorite button click */
  onFavoriteClick: () => void;
  /** Handler for loop button click */
  onLoopClick: () => void;
  /** Handler for comment button click */
  onCommentClick: () => void;
  /** Whether loop mode is active */
  isLooped: boolean;
  /** Whether comment mode is active */
  isCommented: boolean;
}
