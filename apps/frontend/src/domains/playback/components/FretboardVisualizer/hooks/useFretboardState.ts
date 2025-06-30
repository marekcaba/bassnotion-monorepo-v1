'use client';

import { useState, useCallback, useMemo } from 'react';
import { FretboardState, ExerciseNote } from '../types/fretboard';
import { getVisibleNotes, sortNotesByTiming } from '../utils/notePositioning';

interface UseFretboardStateProps {
  notes: ExerciseNote[];
  bpm: number;
  isPlaying: boolean;
  currentTime: number;
}

export function useFretboardState({
  notes,
  bpm,
  isPlaying,
  currentTime,
}: UseFretboardStateProps) {
  const [performance, setPerformance] = useState({
    fps: 60,
    frameTime: 16.67,
  });

  // Get visible notes for current time
  const visibleNotes = useMemo(() => {
    return getVisibleNotes(notes, currentTime);
  }, [notes, currentTime]);

  // Sort notes by timing for proper rendering order
  const sortedNotes = useMemo(() => {
    return sortNotesByTiming(visibleNotes);
  }, [visibleNotes]);

  // Calculate play strip position for Guitar Hero style visualization
  const playStripPosition = useMemo(() => {
    // The play strip is the line where notes should be played
    // For Guitar Hero style, this is typically at the bottom of the screen
    return { x: 0, y: 0, z: 0 }; // Position at fretboard origin
  }, []);

  // Update performance metrics
  const updatePerformance = useCallback((fps: number, frameTime: number) => {
    setPerformance({ fps, frameTime });
  }, []);

  // Create fretboard state object
  const fretboardState: FretboardState = useMemo(
    () => ({
      isPlaying,
      currentTime,
      notes: sortedNotes,
      bpm,
      camera: {
        position: { x: 0, y: 200, z: 400 } as any,
        target: { x: 0, y: 0, z: -200 } as any,
        zoom: 1,
        enablePan: true,
        enableZoom: true,
        enableRotate: true,
      },
      performance,
    }),
    [isPlaying, currentTime, sortedNotes, bpm, performance],
  );

  return {
    fretboardState,
    visibleNotes: sortedNotes,
    playStripPosition,
    updatePerformance,
  };
}
