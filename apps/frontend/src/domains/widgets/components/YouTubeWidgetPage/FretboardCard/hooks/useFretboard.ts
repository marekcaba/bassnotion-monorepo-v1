import { useCallback } from 'react';
import type { SyncedWidgetRenderProps } from '../../../base';
import type { Fret } from '../types/fretboardTypes';
import { useFretboardState } from './useFretboardState';
import { useFretboardConnections } from './useFretboardConnections';
import { useFretboardExercise } from './useFretboardExercise';

/**
 * Main fretboard hook that combines all fretboard functionality
 * This is the primary hook that components should use
 */
export const useFretboard = (syncProps: SyncedWidgetRenderProps) => {
  // State management
  const state = useFretboardState();

  // Connection highlighting
  const connections = useFretboardConnections(
    state.selectedDots,
    state.stringCount,
  );

  // Exercise integration without auto-population (handled by FretboardCard)
  const exercise = useFretboardExercise(syncProps, {
    setSelectedDots: state.setSelectedDots,
    autoPopulateOnExerciseLoad: false,
    stringCount: state.stringCount, // Pass string count to audio system
  });

  // Enhanced dot click handler that integrates audio and sync
  const handleDotClickWithAudio = useCallback(
    (stringIndex: number, fret: Fret) => {
      // Handle selection state
      state.handleDotClick(stringIndex, fret);

      // Trigger audio feedback
      exercise.triggerNote(stringIndex, fret);

      // Emit sync event after a short delay to include this new dot
      setTimeout(() => {
        exercise.emitBasslineEvent(state.selectedDots);
      }, 10);
    },
    [state.handleDotClick, state.selectedDots, exercise],
  );

  // Enhanced clear handler that also emits sync event
  const handleClearWithSync = useCallback(() => {
    state.handleClearSelectedDots();
    // Emit empty bassline event
    exercise.emitBasslineEvent(new Map());
  }, [state.handleClearSelectedDots, exercise.emitBasslineEvent]);

  // Enhanced drag drop handler with audio and sync
  const handleDragDropWithAudio = useCallback(
    (targetStringIndex: number, targetFret: Fret) => {
      state.handleDragDrop(targetStringIndex, targetFret);

      // Trigger audio for new position
      exercise.triggerNote(targetStringIndex, targetFret);

      // Emit sync event after drag is complete
      setTimeout(() => {
        exercise.emitBasslineEvent(state.selectedDots);
      }, 10);
    },
    [state.handleDragDrop, state.selectedDots, exercise],
  );

  return {
    // State management
    state,

    // Connection highlighting
    connections,

    // Exercise integration
    exercise,

    // Enhanced handlers
    handleDotClickWithAudio,
    handleClearWithSync,
    handleDragDropWithAudio,

    // Direct access to key state values for convenience
    stringCount: state.stringCount,
    tiltAngle: state.tiltAngle,
    maxFrets: state.maxFrets,
    selectedDots: state.selectedDots,
    frets: state.frets,

    // Direct access to key functions for convenience
    handleStringCountChange: state.handleStringCountChange,
    handleTiltAngleChange: state.handleTiltAngleChange,
    handleMaxFretsChange: state.handleMaxFretsChange,
    checkIsDotSelected: state.checkIsDotSelected,
    checkGetDotOrder: state.checkGetDotOrder,
    checkHasSelectedDots: state.checkHasSelectedDots,

    // Drag and drop handlers
    handleDragStart: state.handleDragStart,
    handleDragEnd: state.handleDragEnd,
    handleDragEnter: state.handleDragEnter,
    handleDragLeave: state.handleDragLeave,

    // Connection highlighting
    highlightingFunctions: connections.highlightingFunctions,
    segmentFunctions: connections.segmentFunctions,
    allConnections: connections.allConnections,

    // Exercise functions
    isExerciseNote: exercise.isExerciseNote,
    isCurrentNote: exercise.isCurrentNote,
    exerciseData: exercise.exerciseData,
  };
};
