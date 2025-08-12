'use client';

import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { GlobalControls } from './GlobalControls';
import { SyncedWidget } from '../../base';
import type { SyncedWidgetRenderProps } from '../../base';

interface GlobalControlsCardProps {
  // Fretboard action props
  is3DMode?: boolean;
  tiltAngle?: number;
  hasSelectedDots?: boolean;
  cameraMode?: 'overview' | 'action';
  onToggle3DMode?: () => void;
  onTiltAngleChange?: (angle: number) => void;
  onCameraModeChange?: (mode: 'overview' | 'action') => void;
  onResetFretboard?: () => void;
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
  is3DMode,
  tiltAngle,
  hasSelectedDots,
  cameraMode,
  onToggle3DMode,
  onTiltAngleChange,
  onCameraModeChange,
  onResetFretboard,
  loopRegion,
  isLoopEnabled,
}: GlobalControlsCardProps) {
  return (
    <SyncedWidget
      widgetId="global-controls-card"
      widgetName="Global Playback Controls Card"
      syncOptions={{
        subscribeTo: [
          'PLAYBACK_STATE',
          'TIMELINE_UPDATE',
          'EXERCISE_CHANGE',
          'TEMPO_CHANGE',
        ],
        debugMode: false,
      }}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <GlobalControlsCardContent
          syncProps={syncProps}
          is3DMode={is3DMode}
          tiltAngle={tiltAngle}
          hasSelectedDots={hasSelectedDots}
          cameraMode={cameraMode}
          onToggle3DMode={onToggle3DMode}
          onTiltAngleChange={onTiltAngleChange}
          onCameraModeChange={onCameraModeChange}
          onResetFretboard={onResetFretboard}
          loopRegion={loopRegion}
          isLoopEnabled={isLoopEnabled}
        />
      )}
    </SyncedWidget>
  );
}

function GlobalControlsCardContent({
  syncProps,
  is3DMode,
  tiltAngle,
  hasSelectedDots,
  cameraMode,
  onToggle3DMode,
  onTiltAngleChange,
  onCameraModeChange,
  onResetFretboard,
  loopRegion,
  isLoopEnabled,
}: {
  syncProps: SyncedWidgetRenderProps;
  is3DMode?: boolean;
  tiltAngle?: number;
  hasSelectedDots?: boolean;
  cameraMode?: 'overview' | 'action';
  onToggle3DMode?: () => void;
  onTiltAngleChange?: (angle: number) => void;
  onCameraModeChange?: (mode: 'overview' | 'action') => void;
  onResetFretboard?: () => void;
  loopRegion?: {
    startMeasure: number;
    endMeasure: number;
    startBeat?: number;
    endBeat?: number;
  } | null;
  isLoopEnabled?: boolean;
}) {
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

  const duration = calculateDuration(syncProps.selectedExercise);

  return (
    <Card className="bg-transparent border-transparent shadow-none overflow-visible">
      <CardContent className="p-0 overflow-visible">
        <GlobalControls
          selectedExercise={syncProps.selectedExercise || undefined}
          duration={duration}
          is3DMode={is3DMode}
          tiltAngle={tiltAngle}
          hasSelectedDots={hasSelectedDots}
          cameraMode={cameraMode}
          onToggle3DMode={onToggle3DMode}
          onTiltAngleChange={onTiltAngleChange}
          onCameraModeChange={onCameraModeChange}
          onResetFretboard={onResetFretboard}
          loopRegion={loopRegion}
          isLoopEnabled={isLoopEnabled}
        />
      </CardContent>
    </Card>
  );
}
