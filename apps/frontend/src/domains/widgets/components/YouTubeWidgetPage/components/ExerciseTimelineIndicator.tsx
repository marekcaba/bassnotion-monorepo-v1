/**
 * ExerciseTimelineIndicator Component
 * Story 3.17c: Exercise Timeline Integration
 *
 * Visual indicator showing exercise timeline progress, current position,
 * and section information for user feedback.
 */

import React, { useEffect, useState, useMemo } from 'react';
// Epic 3.18: ExerciseTimelineIntegrator and UnifiedTransportController removed
// import { exerciseTimelineIntegrator } from '@/domains/playback/services/ExerciseTimelineIntegrator';
// import { UnifiedTransportController } from '@/domains/playback/services/UnifiedTransportController/index';
// import type { ExerciseStatus } from '@/domains/playback/services/ExerciseTimelineIntegrator';

// Stub types and implementations
interface ExerciseStatus {
  isActive: boolean;
  currentSection: string | null;
  currentMeasure: number;
  totalMeasures: number;
  progress: number;
  nextSection: string | null;
}

const exerciseTimelineIntegrator = {
  getStatus: (): ExerciseStatus => ({
    isActive: false,
    currentSection: null,
    currentMeasure: 0,
    totalMeasures: 0,
    progress: 0,
    nextSection: null,
  }),
};

// Import hooks to get UnifiedTransport from AudioProvider
import { useAudioServices } from '@/domains/playback/providers/AudioProvider.js';

interface ExerciseTimelineIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function ExerciseTimelineIndicator({
  className = '',
  showDetails = true,
}: ExerciseTimelineIndicatorProps) {
  const [status, setStatus] = useState<ExerciseStatus | null>(null);

  // Get UnifiedTransport from AudioProvider - this ensures we get the correct singleton instance
  const { transportController, isInitialized } = useAudioServices();

  // Update status periodically when playing
  useEffect(() => {
    const updateStatus = () => {
      const currentStatus = exerciseTimelineIntegrator.getStatus();
      setStatus(currentStatus);
    };

    // Initial update
    updateStatus();

    // Update every 100ms when playing
    const interval = setInterval(() => {
      if (isInitialized && transportController) {
        const state = transportController.getState();
        if (state === 'playing') {
          updateStatus();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isInitialized, transportController]);

  // Calculate display values
  const displayValues = useMemo(() => {
    if (!status || !status.isLoaded || !status.timeline) {
      return null;
    }

    const position = status.currentPosition.split(':');
    const currentBar = parseInt(position[0]) + 1; // 1-based for display
    const currentBeat = parseInt(position[1]) + 1;
    const totalBars = status.timeline.totalBars;
    const progressPercent = status.progress * 100;

    return {
      currentBar,
      currentBeat,
      totalBars,
      progressPercent,
      timeSignature: status.timeline.timeSignature,
      tempo: status.timeline.tempo,
      exerciseName: status.currentExercise?.title || 'No Exercise',
    };
  }, [status]);

  if (!displayValues) {
    return (
      <div
        className={`flex items-center gap-2 text-sm text-slate-500 ${className}`}
      >
        <span>No exercise loaded</span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Progress Bar */}
      <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-100"
          style={{ width: `${displayValues.progressPercent}%` }}
        />

        {/* Section markers */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: displayValues.totalBars }, (_, i) => (
            <div
              key={i}
              className="flex-1 border-r border-slate-600 last:border-r-0"
            />
          ))}
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="flex items-center justify-between text-sm">
          {/* Exercise Name */}
          <div className="text-slate-300 font-medium">
            {displayValues.exerciseName}
          </div>

          {/* Position Info */}
          <div className="flex items-center gap-4 text-slate-400">
            {/* Bar/Beat */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Bar</span>
              <span className="font-mono text-white">
                {displayValues.currentBar}/{displayValues.totalBars}
              </span>
              <span className="text-xs text-slate-500 ml-2">Beat</span>
              <span className="font-mono text-white">
                {displayValues.currentBeat}/
                {displayValues.timeSignature.numerator}
              </span>
            </div>

            {/* Tempo */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Tempo</span>
              <span className="font-mono text-white">
                {displayValues.tempo}
              </span>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-1">
              <span className="font-mono text-white">
                {displayValues.progressPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
