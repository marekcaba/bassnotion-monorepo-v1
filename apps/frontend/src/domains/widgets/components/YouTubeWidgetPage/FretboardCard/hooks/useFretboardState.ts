import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  StringCount,
  SelectedDotsMap,
  DraggedDot,
  DragOverTarget,
  FretboardState,
  Fret,
} from '../types/fretboardTypes';
import {
  addSelectedDot,
  removeSelectedDot,
  // toggleSelectedDot, // Unused but kept for reference
  clearSelectedDots,
  isDotSelected,
  getDotOrder,
  hasSelectedDots,
  createPositionKey,
} from '../utils/connectionDetection';

/**
 * Hook to manage fretboard state including string count, tilt, selected dots, and drag state
 */
export const useFretboardState = (initialConfig?: {
  stringCount?: StringCount;
  maxFrets?: number;
  tiltAngle?: number;
}) => {
  // SINGLE SOURCE OF TRUTH: Use parent config values directly
  // Parent is responsible for managing these values (from profile settings)
  const stringCount = initialConfig?.stringCount || 4;
  const tiltAngle = initialConfig?.tiltAngle || 35;
  const maxFrets = initialConfig?.maxFrets || 25;

  // Selected dots state - stores position keys with order numbers
  // PERFORMANCE FIX: Combine selectedDots and selectionOrder into single state to avoid double renders
  const [dotsState, setDotsState] = useState<{
    selectedDots: SelectedDotsMap;
    selectionOrder: number;
  }>({
    selectedDots: new Map(),
    selectionOrder: 0,
  });

  // Drag and drop state
  const [draggedDot, setDraggedDot] = useState<DraggedDot | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget | null>(
    null,
  );

  // REMOVED: Automatic syncing from parent config
  // Parent config is the SINGLE SOURCE OF TRUTH - we just use initialConfig directly
  // No useEffect needed - React will re-render with new initialConfig values

  // Generate frets array based on maxFrets setting
  const frets = useMemo(
    () => Array.from({ length: maxFrets }, (_, i) => i + 1),
    [maxFrets],
  );

  // Get current fretboard state as a single object
  const fretboardState: FretboardState = useMemo(
    () => ({
      stringCount,
      tiltAngle,
      maxFrets,
      selectedDots: dotsState.selectedDots,
      selectionOrder: dotsState.selectionOrder,
      draggedDot,
      dragOverTarget,
    }),
    [
      stringCount,
      tiltAngle,
      maxFrets,
      dotsState, // Single dependency for both selectedDots and selectionOrder
      draggedDot,
      dragOverTarget,
    ],
  );

  // Helper function to check if there are dots on strings that would be hidden
  const hasDotsOnHiddenStrings = useCallback(
    (
      currentStringCount: StringCount,
      newStringCount: StringCount,
      selectedDots: SelectedDotsMap,
    ): boolean => {
      // Get the range of strings that would be hidden
      const hiddenStringIndices: number[] = [];

      if (currentStringCount === 5 && newStringCount === 4) {
        // B string (index 0) would be hidden
        hiddenStringIndices.push(0);
      } else if (currentStringCount === 6 && newStringCount === 5) {
        // C string (index 5) would be hidden
        hiddenStringIndices.push(5);
      } else if (currentStringCount === 6 && newStringCount === 4) {
        // B string (index 0) and C string (index 5) would be hidden
        hiddenStringIndices.push(0, 5);
      }

      // Check if any selected dots are on the strings that would be hidden
      for (const [key, orders] of selectedDots.entries()) {
        const parts = key.split(',');
        if (parts.length !== 2 || !parts[0]) continue; // Skip invalid keys
        const stringIndexStr = parts[0];
        const stringIndex = parseInt(stringIndexStr, 10);

        if (hiddenStringIndices.includes(stringIndex) && orders.length > 0) {
          return true;
        }
      }

      return false;
    },
    [],
  );

  // REMOVED: Local state change handlers
  // Config changes (stringCount, tiltAngle, maxFrets) are handled by PARENT only
  // This component just receives and displays the config from parent (profile settings)

  // Selected dots handlers
  const handleDotClick = useCallback(
    (stringIndex: number, fret: Fret) => {
      // PERFORMANCE FIX: Single state update for both selectedDots and selectionOrder
      setDotsState((prevState) => {
        const prev = prevState.selectedDots;
        const currentSelectionOrder = prevState.selectionOrder;

        const isCurrentlySelected = isDotSelected(stringIndex, fret, prev);

        if (isCurrentlySelected) {
          // Deselect the dot and renumber remaining dots to maintain sequence
          const newMap = new Map(prev);
          const positionKey = createPositionKey(stringIndex, fret);
          // const removedOrders = newMap.get(positionKey) || []; // Unused but kept for debugging
          newMap.delete(positionKey);

          // Get all remaining order numbers and sort them
          const allRemainingOrders: number[] = [];
          for (const orders of newMap.values()) {
            allRemainingOrders.push(...orders);
          }
          allRemainingOrders.sort((a, b) => a - b);

          // Renumber all dots to maintain consecutive sequence starting from 1
          // This ensures that when dot #1 is removed, #2 becomes #1, #3 becomes #2, etc.
          const orderMapping = new Map<number, number>();
          allRemainingOrders.forEach((oldOrder, index) => {
            orderMapping.set(oldOrder, index + 1); // New order starts from 1
          });

          // Apply the new numbering to all dots
          for (const [key, orders] of newMap.entries()) {
            const updatedOrders = orders.map(
              (order) => orderMapping.get(order) || order,
            );
            newMap.set(key, updatedOrders);
          }

          // Return both updates in single state change
          return {
            selectedDots: newMap,
            selectionOrder: allRemainingOrders.length,
          };
        } else {
          // Select the dot with next sequential order number
          const newOrder = currentSelectionOrder + 1;
          const newMap = addSelectedDot(stringIndex, fret, newOrder, prev);

          // Return both updates in single state change
          return {
            selectedDots: newMap,
            selectionOrder: newOrder,
          };
        }
      });
    },
    [], // No dependencies needed - we're using functional state update
  );

  const handleRemoveDot = useCallback((stringIndex: number, fret: Fret) => {
    setDotsState((prevState) => ({
      ...prevState,
      selectedDots: removeSelectedDot(
        stringIndex,
        fret,
        prevState.selectedDots,
      ),
    }));
  }, []);

  const handleClearSelectedDots = useCallback(() => {
    // PERFORMANCE FIX: Single state update
    setDotsState({
      selectedDots: clearSelectedDots(),
      selectionOrder: 0,
    });
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (stringIndex: number, fret: Fret, order: number) => {
      setDraggedDot({ stringIndex, fret, order });
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedDot(null);
    setDragOverTarget(null);
  }, []);

  const handleDragEnter = useCallback(
    (targetStringIndex: number, targetFret: Fret) => {
      setDragOverTarget({ stringIndex: targetStringIndex, fret: targetFret });
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDragDrop = useCallback(
    (targetStringIndex: number, targetFret: Fret) => {
      if (!draggedDot) return;

      const { stringIndex: sourceString, fret: sourceFret, order } = draggedDot;

      // Don't do anything if dropping on the same position
      if (sourceString === targetStringIndex && sourceFret === targetFret) {
        setDraggedDot(null);
        setDragOverTarget(null);
        return;
      }

      // Update the position while maintaining the order number
      setDotsState((prevState) => {
        const newDots = new Map(prevState.selectedDots);

        // Get the order number from the source position
        const sourceKey = createPositionKey(sourceString, sourceFret);
        // const sourceOrders = newDots.get(sourceKey) || []; // Unused but kept for debugging

        // Remove the dot from source position
        newDots.delete(sourceKey);

        // Check if target position already has dots
        const targetKey = createPositionKey(targetStringIndex, targetFret);
        const targetOrders = newDots.get(targetKey) || [];

        // Add the dragged dot's order to the target position
        // Maintain the same order number to preserve sequence
        if (!targetOrders.includes(order)) {
          newDots.set(
            targetKey,
            [...targetOrders, order].sort((a, b) => a - b),
          );
        }

        return {
          ...prevState,
          selectedDots: newDots,
        };
      });

      // Clear drag state
      setDraggedDot(null);
      setDragOverTarget(null);
    },
    [draggedDot],
  );

  // Utility functions for checking dot state
  const checkIsDotSelected = useCallback(
    (stringIndex: number, fret: Fret): boolean => {
      return isDotSelected(stringIndex, fret, dotsState.selectedDots);
    },
    [dotsState.selectedDots],
  );

  const checkGetDotOrder = useCallback(
    (stringIndex: number, fret: Fret): number[] => {
      return getDotOrder(stringIndex, fret, dotsState.selectedDots);
    },
    [dotsState.selectedDots],
  );

  const checkHasSelectedDots = useCallback((): boolean => {
    return hasSelectedDots(dotsState.selectedDots);
  }, [dotsState.selectedDots]);

  // Reset all state
  const handleResetFretboard = useCallback(() => {
    // PERFORMANCE FIX: Single state update
    setDotsState({
      selectedDots: clearSelectedDots(),
      selectionOrder: 0,
    });
    setDraggedDot(null);
    setDragOverTarget(null);
  }, []);

  // Create setters for compatibility
  const setSelectedDots = useCallback(
    (dots: SelectedDotsMap | ((prev: SelectedDotsMap) => SelectedDotsMap)) => {
      setDotsState((prevState) => ({
        ...prevState,
        selectedDots:
          typeof dots === 'function' ? dots(prevState.selectedDots) : dots,
      }));
    },
    [],
  );

  const setSelectionOrder = useCallback((order: number) => {
    setDotsState((prevState) => ({
      ...prevState,
      selectionOrder: order,
    }));
  }, []);

  return {
    // State values
    stringCount,
    tiltAngle,
    maxFrets,
    selectedDots: dotsState.selectedDots,
    selectionOrder: dotsState.selectionOrder,
    draggedDot,
    dragOverTarget,
    frets,
    fretboardState,

    // String count validation (for parent to use before changing)
    hasDotsOnHiddenStrings,

    // Selected dots handlers
    handleDotClick,
    handleRemoveDot,
    handleClearSelectedDots,
    setSelectedDots,
    setSelectionOrder,

    // Drag and drop handlers
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragDrop,

    // Utility functions
    checkIsDotSelected,
    checkGetDotOrder,
    checkHasSelectedDots,

    // Reset
    handleResetFretboard,
  };
};
