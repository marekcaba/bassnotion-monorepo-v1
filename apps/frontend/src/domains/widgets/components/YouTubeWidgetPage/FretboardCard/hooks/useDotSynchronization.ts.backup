import { useEffect, useCallback } from 'react';
import type { SelectedDotsMap, StringCount } from '../types/fretboardTypes';

interface UseDotSynchronizationProps {
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
 * Hook to handle dot synchronization between local and shared state
 * Manages dot state and string count synchronization
 */
export function useDotSynchronization({
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

  // Real-time synchronization: local → shared state
  useEffect(() => {
    if (!areDotsEqual(localDots, sharedDots)) {
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
    areDotsEqual,
    setSharedDots,
    setSelectionOrder,
    calculateMaxOrder,
    onUserManualSelection,
  ]);

  // REMOVED: String count synchronization - NO AUTOMATIC SYNCING
  // String count comes from parent (profile settings) as the SINGLE SOURCE OF TRUTH
  // User can manually change it via UI controls, but it flows DOWN from parent only

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
