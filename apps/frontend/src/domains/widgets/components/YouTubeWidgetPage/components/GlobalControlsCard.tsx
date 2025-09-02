'use client';

import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
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
    <Card className="bg-transparent border-transparent shadow-none overflow-visible">
      <CardContent className="p-0 overflow-visible">
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
        />
      </CardContent>
    </Card>
  );
}
