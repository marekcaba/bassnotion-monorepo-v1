import { useEffect, useCallback } from 'react';
import type { SelectedDotsMap, StringCount } from '../types/fretboardTypes';

interface UseDotSynchronizationProps {
  is3DMode: boolean;
  localDots: SelectedDotsMap;
  sharedDots: SelectedDotsMap;
  localStringCount: StringCount;
  sharedStringCount: StringCount;
  setLocalDots: (dots: SelectedDotsMap) => void;
  setSharedDots: (dots: SelectedDotsMap) => void;
  setLocalStringCount: (count: StringCount) => void;
  setSharedStringCount: (count: StringCount) => void;
  setSelectionOrder: (order: number) => void;
  onUserManualSelection: () => void;
}

/**
 * Hook to handle bidirectional synchronization between 2D and 3D modes
 * Manages dot state and string count synchronization
 */
export function useDotSynchronization({
  is3DMode,
  localDots,
  sharedDots,
  localStringCount,
  sharedStringCount,
  setLocalDots,
  setSharedDots,
  setLocalStringCount,
  setSharedStringCount,
  setSelectionOrder,
  onUserManualSelection,
}: UseDotSynchronizationProps) {
  /**
   * Calculate the maximum order number from a dots map
   */
  const calculateMaxOrder = useCallback((dots: SelectedDotsMap): number => {
    try {
      const allOrders = Array.from(dots.values())
        .flat()
        .filter((order) => typeof order === 'number');
      return allOrders.length > 0 ? Math.max(...allOrders) : 0;
    } catch (error) {
      console.error('Error calculating selection order:', error);
      return 0;
    }
  }, []);

  /**
   * Compare two dot maps to see if they're equal
   */
  const areDotsEqual = useCallback(
    (dots1: SelectedDotsMap, dots2: SelectedDotsMap): boolean => {
      const keys1 = Array.from(dots1.keys()).sort().join(',');
      const keys2 = Array.from(dots2.keys()).sort().join(',');
      return keys1 === keys2;
    },
    [],
  );

  // Real-time synchronization: 2D → shared state (when in 2D mode)
  useEffect(() => {
    if (!is3DMode && !areDotsEqual(localDots, sharedDots)) {
      // Mark that user has made manual selections if this is a user-initiated change
      if (localDots.size > 0) {
        onUserManualSelection();
      }
      setSharedDots(localDots);

      // Also sync the selection order counter
      const maxOrder = calculateMaxOrder(localDots);
      if (maxOrder > 0) {
        setSelectionOrder(maxOrder);
      }
    }
  }, [
    localDots,
    sharedDots,
    is3DMode,
    areDotsEqual,
    setSharedDots,
    setSelectionOrder,
    calculateMaxOrder,
    onUserManualSelection,
  ]);

  // Real-time synchronization: shared state → 2D (when in 3D mode)
  useEffect(() => {
    if (is3DMode && !areDotsEqual(sharedDots, localDots)) {
      // Mark that user has made manual selections if this is a user-initiated change
      if (sharedDots.size > 0) {
        onUserManualSelection();
      }

      setLocalDots(sharedDots);

      // Calculate and set the selection order counter based on the highest order number
      const maxOrder = calculateMaxOrder(sharedDots);
      setSelectionOrder(maxOrder);
    }
  }, [
    sharedDots,
    localDots,
    is3DMode,
    areDotsEqual,
    setLocalDots,
    setSelectionOrder,
    calculateMaxOrder,
    onUserManualSelection,
  ]);

  // String count synchronization: 2D → shared (when in 2D mode)
  useEffect(() => {
    if (!is3DMode && localStringCount !== sharedStringCount) {
      setSharedStringCount(localStringCount);
    }
  }, [localStringCount, sharedStringCount, is3DMode, setSharedStringCount]);

  // String count synchronization: shared → 2D (when in 3D mode)
  useEffect(() => {
    if (is3DMode && sharedStringCount !== localStringCount) {
      setLocalStringCount(sharedStringCount);
    }
  }, [sharedStringCount, localStringCount, is3DMode, setLocalStringCount]);

  // Mode switching synchronization
  useEffect(() => {
    // Only sync when mode changes, not during normal operation
    if (!is3DMode) {
      // When switching from 3D to 2D, sync shared state to 2D local state
      if (!areDotsEqual(sharedDots, localDots)) {
        setLocalDots(sharedDots);

        // Calculate and set the selection order counter to maintain proper sequencing
        const maxOrder = calculateMaxOrder(sharedDots);
        setSelectionOrder(maxOrder);
      }
    } else {
      // When switching from 2D to 3D, sync 2D local state to shared state
      if (!areDotsEqual(localDots, sharedDots)) {
        setSharedDots(localDots);
      }
    }
  }, [is3DMode]); // Only trigger when mode changes

  /**
   * Force sync from local to shared (used after exercise load)
   */
  const forceSyncToShared = useCallback(() => {
    setSharedDots(localDots);
    setSharedStringCount(localStringCount);
  }, [localDots, localStringCount, setSharedDots, setSharedStringCount]);

  /**
   * Force sync from shared to local (used after 3D changes)
   */
  const forceSyncFromShared = useCallback(() => {
    setLocalDots(sharedDots);
    setLocalStringCount(sharedStringCount);
    const maxOrder = calculateMaxOrder(sharedDots);
    setSelectionOrder(maxOrder);
  }, [
    sharedDots,
    sharedStringCount,
    setLocalDots,
    setLocalStringCount,
    setSelectionOrder,
    calculateMaxOrder,
  ]);

  return {
    forceSyncToShared,
    forceSyncFromShared,
    calculateMaxOrder,
    areDotsEqual,
  };
}
