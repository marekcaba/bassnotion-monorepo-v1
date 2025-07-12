import { useState, useCallback, useMemo } from 'react';
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
export const useFretboardState = () => {
  // Basic fretboard configuration
  const [stringCount, setStringCount] = useState<StringCount>(4);
  const [tiltAngle, setTiltAngle] = useState<number>(35);

  // Selected dots state - stores position keys with order numbers
  const [selectedDots, setSelectedDots] = useState<SelectedDotsMap>(new Map());
  const [selectionOrder, setSelectionOrder] = useState<number>(0);

  // Drag and drop state
  const [draggedDot, setDraggedDot] = useState<DraggedDot | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget | null>(
    null,
  );

  // Generate frets array (1-25 for full bass guitar range)
  const frets = useMemo(() => Array.from({ length: 25 }, (_, i) => i + 1), []);

  // Get current fretboard state as a single object
  const fretboardState: FretboardState = useMemo(
    () => ({
      stringCount,
      tiltAngle,
      selectedDots,
      selectionOrder,
      draggedDot,
      dragOverTarget,
    }),
    [
      stringCount,
      tiltAngle,
      selectedDots,
      selectionOrder,
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

  // String count handlers with validation
  const handleStringCountChange = useCallback(
    (newStringCount: StringCount) => {
      // Check if there are dots on strings that would be hidden
      if (hasDotsOnHiddenStrings(stringCount, newStringCount, selectedDots)) {
        // Don't allow the change - the UI should handle showing an error message
        return false;
      }

      // Simply update the string count - dots should already use consistent indices
      // The rendering system handles showing/hiding strings based on string count
      setStringCount(newStringCount);
      return true;
    },
    [stringCount, selectedDots, hasDotsOnHiddenStrings],
  );

  // Tilt angle handlers
  const handleTiltAngleChange = useCallback((newTiltAngle: number) => {
    setTiltAngle(newTiltAngle);
  }, []);

  // Selected dots handlers
  const handleDotClick = useCallback(
    (stringIndex: number, fret: Fret) => {
      setSelectedDots((prev) => {
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

          // Update the selection order counter to the next available number
          setSelectionOrder(allRemainingOrders.length);

          return newMap;
        } else {
          // Select the dot with next sequential order number
          const newOrder = selectionOrder + 1;
          setSelectionOrder(newOrder);
          return addSelectedDot(stringIndex, fret, newOrder, prev);
        }
      });
    },
    [selectionOrder],
  );

  const handleRemoveDot = useCallback((stringIndex: number, fret: Fret) => {
    setSelectedDots((prev) => removeSelectedDot(stringIndex, fret, prev));
  }, []);

  const handleClearSelectedDots = useCallback(() => {
    setSelectedDots(clearSelectedDots());
    setSelectionOrder(0);
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
      setSelectedDots((prev) => {
        const newDots = new Map(prev);

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

        return newDots;
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
      return isDotSelected(stringIndex, fret, selectedDots);
    },
    [selectedDots],
  );

  const checkGetDotOrder = useCallback(
    (stringIndex: number, fret: Fret): number[] => {
      return getDotOrder(stringIndex, fret, selectedDots);
    },
    [selectedDots],
  );

  const checkHasSelectedDots = useCallback((): boolean => {
    return hasSelectedDots(selectedDots);
  }, [selectedDots]);

  // Reset all state
  const handleResetFretboard = useCallback(() => {
    setSelectedDots(clearSelectedDots());
    setSelectionOrder(0);
    setDraggedDot(null);
    setDragOverTarget(null);
  }, []);

  return {
    // State values
    stringCount,
    tiltAngle,
    selectedDots,
    selectionOrder,
    draggedDot,
    dragOverTarget,
    frets,
    fretboardState,

    // String count handlers
    handleStringCountChange,
    hasDotsOnHiddenStrings,

    // Tilt angle handlers
    handleTiltAngleChange,

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
