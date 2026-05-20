'use client';

import React, { useMemo, useCallback } from 'react';
import { GlobalControls } from './GlobalControls';
import { CountdownIndicator } from '../GlobalControls/components/CountdownIndicator.js';
import { getExerciseId, calculateDuration } from '../utils';
import { getLogger } from '@/utils/logger.js';
import type { LegacyPracticeCompletions as PracticeCompletions } from '@/domains/progress';

const logger = getLogger('bottom-playback-bar');

/**
 * Countdown state for visual indicators
 */
interface CountdownState {
  isCountingDown: boolean;
  currentBeat: number;
  totalBeats: number;
}

interface BottomPlaybackBarProps {
  selectedExercise?: any;
  exercises?: any[];
  onExerciseSelect?: (exerciseId: string) => void;
  hasSelectedDots?: boolean;
  loopRegion?: {
    startMeasure: number;
    endMeasure: number;
    startBeat?: number;
    endBeat?: number;
  } | null;
  isLoopEnabled?: boolean;
  onToggleLoop?: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  countdownState: CountdownState;
  onCountdownStateChange?: (state: CountdownState) => void;
  practiceCompletions?: PracticeCompletions;
  onPracticeCompletion?: (exerciseId: string) => void;
}

export const BottomPlaybackBar = React.memo(function BottomPlaybackBar({
  selectedExercise,
  exercises = [],
  onExerciseSelect,
  hasSelectedDots,
  loopRegion,
  isLoopEnabled,
  onToggleLoop,
  onPlayStateChange,
  countdownState,
  onCountdownStateChange,
  practiceCompletions = {},
  onPracticeCompletion,
}: BottomPlaybackBarProps) {
  // Get selected exercise ID for practice tracking
  const selectedExerciseId = useMemo(() => {
    if (!selectedExercise) return null;
    return getExerciseId(selectedExercise);
  }, [selectedExercise]);

  // Calculate duration from exercise data
  const duration = useMemo(
    () => calculateDuration(selectedExercise),
    [selectedExercise],
  );

  // Wrapped play state change handler that tracks practice completions
  const handlePlayStateChangeWithTracking = useCallback(
    (isPlaying: boolean) => {
      if (isPlaying && selectedExerciseId) {
        logger.info(
          `Practice completion tracked for exercise ${selectedExerciseId}`,
        );
        onPracticeCompletion?.(selectedExerciseId);
      }
      onPlayStateChange?.(isPlaying);
    },
    [selectedExerciseId, onPlayStateChange, onPracticeCompletion],
  );

  return (
    <div className="sticky bottom-0 left-0 right-0 z-50">
      {/* Countdown dots above the control bar */}
      {selectedExercise && (
        <div className="flex justify-center pb-1">
          <CountdownIndicator
            totalBeats={countdownState.totalBeats}
            currentBeat={countdownState.currentBeat}
            isCountingDown={countdownState.isCountingDown}
          />
        </div>
      )}

      {/* Semi-transparent backdrop with blur */}
      <div className="bg-gradient-to-t from-slate-900/95 via-slate-900/90 to-slate-900/70 backdrop-blur-xl border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        <div className="mx-auto max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[800px] px-4 py-2">
          {/* GlobalControls renders PlaybackControlsBar */}
          <GlobalControls
            selectedExercise={selectedExercise}
            duration={duration}
            exercises={exercises}
            onExerciseSelect={onExerciseSelect}
            hasSelectedDots={hasSelectedDots}
            loopRegion={loopRegion}
            isLoopEnabled={isLoopEnabled}
            onToggleLoop={onToggleLoop}
            onPlayStateChange={handlePlayStateChangeWithTracking}
            onCountdownStateChange={onCountdownStateChange}
            compact
          />
        </div>

        {/* iOS safe area bottom padding */}
        <div className="pb-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
});
