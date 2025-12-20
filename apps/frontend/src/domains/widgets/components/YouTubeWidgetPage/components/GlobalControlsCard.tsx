'use client';

import React from 'react';
import { ZoneCard, ZoneCardContent } from '@/ui-libraries';
import { GlobalControls } from './GlobalControls';

interface GlobalControlsCardProps {
  // Exercise data
  selectedExercise?: any;
  exercises?: any[];
  // Fretboard action props
  is3DMode?: boolean;
  tiltAngle?: number;
  hasSelectedDots?: boolean;
  cameraMode?: 'overview' | 'action';
  onToggle3DMode?: () => void;
  onTiltAngleChange?: (angle: number) => void;
  onCameraModeChange?: (mode: 'overview' | 'action') => void;
  // Loop settings
  loopRegion?: {
    startMeasure: number;
    endMeasure: number;
    startBeat?: number;
    endBeat?: number;
  } | null;
  isLoopEnabled?: boolean;
  // Play state callback
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export function GlobalControlsCard({
  selectedExercise,
  exercises,
  is3DMode,
  tiltAngle,
  hasSelectedDots,
  cameraMode,
  onToggle3DMode,
  onTiltAngleChange,
  onCameraModeChange,
  loopRegion,
  isLoopEnabled,
  onPlayStateChange,
}: GlobalControlsCardProps) {
  // Calculate duration from exercise data
  const calculateDuration = (exercise: any): number => {
    if (
      !exercise?.notes ||
      !Array.isArray(exercise.notes) ||
      exercise.notes.length === 0
    ) {
      return 0;
    }

    // Find the maximum timestamp + duration from all notes
    const maxEndTime = exercise.notes.reduce((max: number, note: any) => {
      // Validate and sanitize timestamp
      const timestamp =
        typeof note.timestamp === 'number' && isFinite(note.timestamp)
          ? note.timestamp
          : 0;

      // Validate and sanitize duration
      const duration_ms =
        typeof note.duration_ms === 'number' && isFinite(note.duration_ms)
          ? note.duration_ms
          : typeof note.duration === 'number' && isFinite(note.duration)
            ? note.duration
            : 500; // Default 500ms if no valid duration

      const endTime = timestamp + duration_ms;
      return Math.max(max, endTime);
    }, 0);

    // Convert to seconds if the value is in milliseconds (> 1000 suggests milliseconds)
    const result =
      maxEndTime > 1000 ? Math.floor(maxEndTime / 1000) : maxEndTime;

    // Ensure we never return NaN
    return isFinite(result) ? result : 0;
  };

  const duration = calculateDuration(selectedExercise);

  return (
    <ZoneCard className="zone-card overflow-visible border-0 shadow-none bg-transparent">
      <ZoneCardContent className="p-0 overflow-visible">
        <GlobalControls
          selectedExercise={selectedExercise}
          duration={duration}
          is3DMode={is3DMode}
          tiltAngle={tiltAngle}
          hasSelectedDots={hasSelectedDots}
          cameraMode={cameraMode}
          onToggle3DMode={onToggle3DMode}
          onTiltAngleChange={onTiltAngleChange}
          onCameraModeChange={onCameraModeChange}
          loopRegion={loopRegion}
          isLoopEnabled={isLoopEnabled}
          onPlayStateChange={onPlayStateChange}
        />
      </ZoneCardContent>
    </ZoneCard>
  );
}

/**
 * Skeleton loading state for GlobalControlsCard
 * Matches the neumorphic design of GlobalControls
 */
export function GlobalControlsCardSkeleton() {
  return (
    <ZoneCard className="zone-card overflow-visible border-0 shadow-none bg-transparent">
      <ZoneCardContent className="p-0 overflow-visible">
        {/* Neumorphic container matching GlobalControls */}
        <div className="bg-slate-800 rounded-2xl p-4 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)]">
          <div className="flex flex-col gap-3">
            {/* First Row - Mode Button, Playback Controls, View Button */}
            <div className="flex items-center justify-between">
              {/* Left - 3D Mode Toggle (w-24 to match actual) */}
              <div className="flex justify-center items-center py-2 w-24">
                <div className="skeleton-shimmer w-20 h-10 rounded-xl" />
              </div>

              {/* Center - Playback Controls */}
              <div className="flex flex-col items-center justify-center gap-2">
                {/* Countdown dots placeholder */}
                <div className="flex items-center justify-center gap-2 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="skeleton-shimmer w-3 h-3 rounded-full"
                    />
                  ))}
                </div>
                {/* Transport buttons - 5 buttons matching actual layout */}
                <div className="flex items-center justify-center gap-4">
                  <div className="skeleton-shimmer w-10 h-10 rounded-full" />
                  <div className="skeleton-shimmer w-10 h-10 rounded-full" />
                  <div className="skeleton-shimmer w-[78px] h-[78px] rounded-full" />
                  <div className="skeleton-shimmer w-10 h-10 rounded-full" />
                  <div className="skeleton-shimmer w-10 h-10 rounded-full" />
                </div>
              </div>

              {/* Right - View Button (w-24 to match actual) */}
              <div className="flex justify-center items-center py-2 w-24">
                <div className="skeleton-shimmer w-20 h-10 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Sheet Music Section - matches actual: mt-4 border-t pt-4 */}
          <div className="mt-4 border-t border-slate-700/30 pt-4">
            {/* Sheet music display placeholder - 150px height with neumorphic paper style */}
            <div
              className="skeleton-shimmer w-full"
              style={{
                height: '150px',
                borderRadius: '28px',
              }}
            />
            {/* SheetPlayerToolbar placeholder - small toolbar below */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
            </div>
          </div>
        </div>
      </ZoneCardContent>
      <span className="sr-only">Loading playback controls...</span>
    </ZoneCard>
  );
}
