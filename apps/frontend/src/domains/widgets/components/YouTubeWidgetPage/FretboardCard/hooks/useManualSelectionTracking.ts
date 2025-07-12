import { useRef, useCallback } from 'react';

/**
 * Hook to track user manual interactions vs automatic updates
 * Helps distinguish between user-initiated changes and system-initiated changes
 */
export function useManualSelectionTracking() {
  // Track if user has manually reset the fretboard
  const userHasManuallyReset = useRef<boolean>(false);

  // Track if user has made any manual selections
  const userHasManualSelections = useRef<boolean>(false);

  // Track the current exercise ID to detect changes
  const currentExerciseId = useRef<string | null>(null);

  /**
   * Mark that the user has manually reset the fretboard
   */
  const markManualReset = useCallback(() => {
    userHasManuallyReset.current = true;
    userHasManualSelections.current = false; // Clear manual selections flag on reset
    currentExerciseId.current = null; // Clear current exercise ID
  }, []);

  /**
   * Mark that the user has made a manual selection
   */
  const markManualSelection = useCallback(() => {
    userHasManualSelections.current = true;
  }, []);

  /**
   * Clear all manual flags (typically used after loading an exercise)
   */
  const clearManualFlags = useCallback(() => {
    userHasManuallyReset.current = false;
    userHasManualSelections.current = false;
  }, []);

  /**
   * Check if user has made manual selections
   */
  const hasManualSelections = useCallback(() => {
    return userHasManualSelections.current;
  }, []);

  /**
   * Check if user has manually reset
   */
  const hasManuallyReset = useCallback(() => {
    return userHasManuallyReset.current;
  }, []);

  /**
   * Update the current exercise ID
   */
  const setCurrentExerciseId = useCallback((exerciseId: string | null) => {
    currentExerciseId.current = exerciseId;
  }, []);

  /**
   * Get the current exercise ID
   */
  const getCurrentExerciseId = useCallback(() => {
    return currentExerciseId.current;
  }, []);

  /**
   * Check if this is a new exercise (different from current)
   */
  const isNewExercise = useCallback((exerciseId: string) => {
    return currentExerciseId.current !== exerciseId;
  }, []);

  return {
    // Actions
    markManualReset,
    markManualSelection,
    clearManualFlags,

    // Getters
    hasManualSelections,
    hasManuallyReset,

    // Exercise tracking
    setCurrentExerciseId,
    getCurrentExerciseId,
    isNewExercise,

    // Direct ref access (for special cases)
    refs: {
      userHasManuallyReset,
      userHasManualSelections,
      currentExerciseId,
    },
  };
}
