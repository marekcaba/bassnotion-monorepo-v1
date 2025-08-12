import { useCallback, useEffect, useRef } from 'react';
import type { SyncedWidgetRenderProps } from '../../../base';
import type { Fret } from '../types/fretboardTypes';
import { useFretboardState } from './useFretboardState';
import { useFretboardConnections } from './useFretboardConnections';
import { useFretboardExercise } from './useFretboardExercise';

/**
 * Main fretboard hook that combines all fretboard functionality
 * This is the primary hook that components should use
 */
export const useFretboard = (
  syncProps: SyncedWidgetRenderProps,
  config?: {
    stringCount?: 4 | 5 | 6;
    maxFrets?: number;
    tiltAngle?: number;
  },
) => {
  // State management with config from user profile
  const state = useFretboardState(config);

  // Connection highlighting
  const connections = useFretboardConnections(
    state.selectedDots,
    state.stringCount,
  );

  // Exercise integration with auto-population enabled
  const exercise = useFretboardExercise(syncProps, {
    setSelectedDots: state.setSelectedDots,
    autoPopulateOnExerciseLoad: true, // Enable auto-population when exercises change
    stringCount: state.stringCount, // Pass string count to audio system
  });

  // Enhanced dot click handler that integrates audio and sync
  const handleDotClickWithAudio = useCallback(
    (stringIndex: number, fret: Fret) => {
      // Handle selection state
      state.handleDotClick(stringIndex, fret);

      // Trigger audio feedback
      exercise.triggerNote(stringIndex, fret);
    },
    [state.handleDotClick, exercise.triggerNote],
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
    },
    [state.handleDragDrop, exercise.triggerNote],
  );

  // Track previous selectedDots to detect changes
  const prevSelectedDotsRef = useRef(state.selectedDots);
  const isManualChangeRef = useRef(false);

  // Emit bassline event when selectedDots changes due to user interaction
  useEffect(() => {
    // Compare Map sizes first for quick check
    const prevSize = prevSelectedDotsRef.current.size;
    const currentSize = state.selectedDots.size;

    // Check if maps are different
    let hasChanged = prevSize !== currentSize;

    if (!hasChanged && prevSize === currentSize && currentSize > 0) {
      // If sizes are the same, check if content is different
      for (const [key, orders] of state.selectedDots) {
        const prevOrders = prevSelectedDotsRef.current.get(key);
        if (
          !prevOrders ||
          orders.length !== prevOrders.length ||
          orders.some((o, i) => o !== prevOrders[i])
        ) {
          hasChanged = true;
          break;
        }
      }
    }

    // If selectedDots changed and we recently had a manual change, emit the event
    if (hasChanged && isManualChangeRef.current) {
      exercise.emitBasslineEvent(state.selectedDots);
      isManualChangeRef.current = false;
    }

    // Update the ref for next comparison
    prevSelectedDotsRef.current = new Map(state.selectedDots);
  }, [state.selectedDots, exercise.emitBasslineEvent]);

  // Mark manual changes in our handlers
  const handleDotClickWithAudioEnhanced = useCallback(
    (stringIndex: number, fret: Fret) => {
      isManualChangeRef.current = true;
      handleDotClickWithAudio(stringIndex, fret);
    },
    [handleDotClickWithAudio],
  );

  const handleDragDropWithAudioEnhanced = useCallback(
    (targetStringIndex: number, targetFret: Fret) => {
      isManualChangeRef.current = true;
      handleDragDropWithAudio(targetStringIndex, targetFret);
    },
    [handleDragDropWithAudio],
  );

  const handleClearWithSyncEnhanced = useCallback(() => {
    isManualChangeRef.current = true;
    handleClearWithSync();
  }, [handleClearWithSync]);

  return {
    // State management
    state,

    // Connection highlighting
    connections,

    // Exercise integration
    exercise,

    // Enhanced handlers
    handleDotClickWithAudio: handleDotClickWithAudioEnhanced,
    handleClearWithSync: handleClearWithSyncEnhanced,
    handleDragDropWithAudio: handleDragDropWithAudioEnhanced,

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
