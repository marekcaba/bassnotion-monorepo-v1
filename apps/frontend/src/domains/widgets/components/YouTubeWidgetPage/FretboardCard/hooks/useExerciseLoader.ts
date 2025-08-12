import { useRef, useCallback, useEffect } from 'react';
import type { SyncedWidgetRenderProps } from '../../../base';
import type { SelectedDotsMap } from '../types/fretboardTypes';

interface UseExerciseLoaderProps {
  syncProps: SyncedWidgetRenderProps;
  manualSelectionTracking: {
    hasManuallyReset: () => boolean;
    hasManualSelections: () => boolean;
    getCurrentExerciseId: () => string | null;
    setCurrentExerciseId: (id: string | null) => void;
    isNewExercise: (id: string) => boolean;
    clearManualFlags: () => void;
  };
  fretboardExercise: {
    forcePopulateExercise: () => void;
    convertExerciseNotesToSelectedDots: (notes: any[]) => SelectedDotsMap;
    emitBasslineEvent: (dots: SelectedDotsMap) => void;
  };
  onExerciseLoad: (exerciseDotsMap: SelectedDotsMap, exercise: any) => void;
}

/**
 * Hook to manage exercise loading logic
 * Handles exercise change events, prevents duplicate loads, and respects user modifications
 */
export function useExerciseLoader({
  syncProps,
  manualSelectionTracking,
  fretboardExercise,
  onExerciseLoad,
}: UseExerciseLoaderProps) {
  // Track exercise loading state
  const lastProcessedExerciseId = useRef<string | null>(null);
  const lastForceReloadTime = useRef<number>(0);
  const lastResetTime = useRef<number>(0);
  const lastClickTimestamp = useRef<number>(0);

  // Ref for loadExercise to avoid stale closures
  const loadExerciseRef = useRef<
    ((exercise: any, isAfterReset?: boolean) => void) | null
  >(null);

  /**
   * Central function for loading exercises
   * Handles all the complex logic around when to load and when to skip
   */
  const loadExercise = useCallback(
    (exercise: any, isAfterReset = false) => {
      if (!exercise?.notes?.length) return;

      try {
        // Check if this is the same exercise being clicked again
        const isSameExercise =
          manualSelectionTracking.getCurrentExerciseId() === exercise.id;

        // Clear manual reset flag if loading after reset
        if (isAfterReset) {
          manualSelectionTracking.clearManualFlags();
        }

        // If user has made manual selections AND it's the same exercise, don't reload
        // If it's a different exercise, always reload (replacing user modifications)
        if (
          manualSelectionTracking.hasManualSelections() &&
          isSameExercise &&
          !isAfterReset
        ) {
          return;
        }

        // When loading a new exercise or reloading same exercise, clear manual selections flag
        // This means user modifications are replaced with fresh exercise data
        if (!isSameExercise || isAfterReset) {
          manualSelectionTracking.clearManualFlags();
        }

        // Update current exercise ID
        manualSelectionTracking.setCurrentExerciseId(exercise.id);

        // Immediate population - no delays
        fretboardExercise.forcePopulateExercise();

        // Convert exercise notes to dots map
        const exerciseDotsMap =
          fretboardExercise.convertExerciseNotesToSelectedDots(exercise.notes);

        // Notify parent to update all states
        onExerciseLoad(exerciseDotsMap, exercise);

        // Update tracking refs
        lastProcessedExerciseId.current = exercise.id;
        lastForceReloadTime.current = Date.now();
      } catch (error) {
        console.error('❌ Error loading exercise:', error);
      }
    },
    [manualSelectionTracking, fretboardExercise, onExerciseLoad],
  );

  // Keep ref up to date with the latest loadExercise function
  useEffect(() => {
    loadExerciseRef.current = loadExercise;
  }, [loadExercise]);

  /**
   * Mark that a reset occurred
   */
  const markReset = useCallback(() => {
    lastResetTime.current = Date.now();
  }, []);

  // Listen for exercise clicks via sync events - PRIMARY path
  useEffect(() => {
    if (!syncProps.sync) return;

    const handleExerciseChange = (event: any) => {
      const { exercise, clickTimestamp } = event.payload || {};

      if (
        exercise &&
        clickTimestamp &&
        clickTimestamp > lastClickTimestamp.current
      ) {
        lastClickTimestamp.current = clickTimestamp;

        const currentTime = Date.now();
        const timeSinceLastReset = currentTime - lastResetTime.current;

        // Get current state values using refs to avoid stale closures
        const hasReset = lastResetTime.current > 0;
        const isAfterReset = hasReset && timeSinceLastReset > 100;

        // Call loadExercise using the latest ref
        if (loadExerciseRef.current) {
          loadExerciseRef.current(exercise, isAfterReset);
        }
      }
    };

    // Import and use the sync service directly for event subscription
    let unsubscribe: (() => void) | undefined;
    let isSubscribed = true;

    import('../../../../services/WidgetSyncService').then(
      ({ widgetSyncService }) => {
        if (!isSubscribed) return; // Component unmounted

        widgetSyncService.subscribe('EXERCISE_CHANGE', handleExerciseChange);
        unsubscribe = () => {
          widgetSyncService.unsubscribe(
            'EXERCISE_CHANGE',
            handleExerciseChange,
          );
        };
      },
    );

    return () => {
      isSubscribed = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [syncProps.sync]); // Remove loadExercise and manualSelectionTracking from deps

  // FALLBACK: Handle initial exercise load when page loads (not user clicks)
  useEffect(() => {
    if (
      syncProps.selectedExercise &&
      !manualSelectionTracking.hasManuallyReset() &&
      lastProcessedExerciseId.current !== syncProps.selectedExercise.id &&
      lastClickTimestamp.current === 0 // Only if no user clicks yet
    ) {
      loadExercise(syncProps.selectedExercise);
    }
  }, [syncProps.selectedExercise?.id, loadExercise, manualSelectionTracking]);

  /**
   * Clear exercise tracking to allow re-selection
   */
  const clearExerciseTracking = useCallback(() => {
    lastProcessedExerciseId.current = null;
    lastForceReloadTime.current = 0;
  }, []);

  return {
    loadExercise,
    markReset,
    clearExerciseTracking,
    isExerciseLoaded: (exerciseId: string) =>
      lastProcessedExerciseId.current === exerciseId,
  };
}
