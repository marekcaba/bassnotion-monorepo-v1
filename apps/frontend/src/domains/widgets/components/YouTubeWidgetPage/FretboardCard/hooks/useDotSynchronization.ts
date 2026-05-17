import { useEffect, useCallback, useRef } from 'react';
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
 *
 * FAANG-STYLE FIX: Uses refs for unstable callbacks to prevent infinite loops
 * caused by callback recreation triggering useEffect dependencies.
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
  // =============================================================================
  // STABLE CALLBACK PATTERN - Store callbacks in refs
  // =============================================================================
  // Problem: Parent callbacks (setSharedDots, setSelectionOrder, onUserManualSelection)
  // may recreate on every render, causing this hook's useEffect to run infinitely.
  //
  // Solution: Store callbacks in refs and update them in separate useEffects.
  // The main synchronization useEffect depends only on stable refs, not the callbacks.
  // =============================================================================
  const setSharedDotsRef = useRef(setSharedDots);
  const setSelectionOrderRef = useRef(setSelectionOrder);
  const onUserManualSelectionRef = useRef(onUserManualSelection);

  // CRITICAL FIX: Track last synced state to prevent infinite sync loops
  // When we sync localDots → sharedDots, sharedDots changes, which triggers
  // the effect again. This ref tracks what we just synced to break the loop.
  const lastSyncedStateRef = useRef<string>('');

  // Update refs when callbacks change (separate effects prevent infinite loops)
  useEffect(() => {
    setSharedDotsRef.current = setSharedDots;
  }, [setSharedDots]);

  useEffect(() => {
    setSelectionOrderRef.current = setSelectionOrder;
  }, [setSelectionOrder]);

  useEffect(() => {
    onUserManualSelectionRef.current = onUserManualSelection;
  }, [onUserManualSelection]);

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
    // Guard 1: Skip sync if both maps are empty (prevents initial empty sync loop)
    if (localDots.size === 0 && sharedDots.size === 0) {
      return;
    }

    // Guard 2: Create a stable string representation of current state
    // This allows us to detect if we're about to sync the exact same state we just synced
    const currentStateKey = JSON.stringify({
      localKeys: Array.from(localDots.keys()).sort(),
      sharedKeys: Array.from(sharedDots.keys()).sort(),
      localSize: localDots.size,
      sharedSize: sharedDots.size,
    });

    // Guard 3: CRITICAL - Prevent infinite loop by checking if we just synced this state
    // If we just synced this exact state, don't sync again (breaks the loop)
    if (lastSyncedStateRef.current === currentStateKey) {
      return;
    }

    // Guard 4: Only sync if dots are actually different
    if (!areDotsEqual(localDots, sharedDots)) {
      // Mark that user has made manual selections if this is a user-initiated change
      if (localDots.size > 0) {
        onUserManualSelectionRef.current();
      }

      // Use ref to avoid dependency on unstable callback
      setSharedDotsRef.current(localDots);

      // Also sync the selection order counter
      const maxOrder = calculateMaxOrder(localDots);
      if (maxOrder > 0) {
        setSelectionOrderRef.current(maxOrder);
      }

      // CRITICAL: Remember that we just synced this state
      lastSyncedStateRef.current = currentStateKey;
    }
  }, [
    localDots,
    sharedDots,
    areDotsEqual,
    calculateMaxOrder,
    // ✅ Removed unstable callback dependencies - using refs instead
    // This prevents infinite loops when parent callbacks recreate
  ]);

  // REMOVED: String count synchronization - NO AUTOMATIC SYNCING
  // String count comes from parent (profile settings) as the SINGLE SOURCE OF TRUTH
  // User can manually change it via UI controls, but it flows DOWN from parent only

  /**
   * Force sync from local to shared (used after exercise load)
   */
  const forceSyncToShared = useCallback(() => {
    setSharedDotsRef.current(localDots);
    setSharedStringCount(localStringCount);
  }, [localDots, localStringCount, setSharedStringCount]);

  /**
   * Force sync from shared to local (used after 3D changes)
   */
  const forceSyncFromShared = useCallback(() => {
    setLocalDots(sharedDots);
    setLocalStringCount(sharedStringCount);
    const maxOrder = calculateMaxOrder(sharedDots);
    setSelectionOrderRef.current(maxOrder);
  }, [
    sharedDots,
    sharedStringCount,
    setLocalDots,
    setLocalStringCount,
    calculateMaxOrder,
  ]);

  return {
    forceSyncToShared,
    forceSyncFromShared,
    calculateMaxOrder,
    areDotsEqual,
  };
}
