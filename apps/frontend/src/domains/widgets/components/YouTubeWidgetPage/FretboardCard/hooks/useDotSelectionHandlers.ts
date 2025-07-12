import { useCallback } from 'react';
import type { SelectedDotsMap, StringCount } from '../types/fretboardTypes';

interface UseDotSelectionHandlersProps {
  // State getters
  selectedDots: SelectedDotsMap;
  sharedSelectedDots: SelectedDotsMap;
  draggedDot: any;

  // State setters
  setSelectedDots: (
    dots: SelectedDotsMap | ((prev: SelectedDotsMap) => SelectedDotsMap),
  ) => void;
  sharedSetSelectedDots: (dots: SelectedDotsMap) => void;
  setSelectionOrder: (order: number) => void;

  // Callbacks
  markManualReset: () => void;
  markManualSelection: () => void;
  triggerNote: (stringIndex: number, fret: number | 'open') => void;
  emitBasslineEvent: (dots: SelectedDotsMap) => void;
  clearExerciseTracking: () => void;
  handleDragEnd: () => void;
}

/**
 * Hook to handle all dot selection and manipulation logic
 * Provides unified handlers for dot clicks, drag-drop, and reset operations
 */
export function useDotSelectionHandlers({
  selectedDots,
  sharedSelectedDots,
  draggedDot,
  setSelectedDots,
  sharedSetSelectedDots,
  setSelectionOrder,
  markManualReset,
  markManualSelection,
  triggerNote,
  emitBasslineEvent,
  clearExerciseTracking,
  handleDragEnd,
}: UseDotSelectionHandlersProps) {
  /**
   * Unified reset function that works for both 2D and 3D modes
   */
  const handleUnifiedReset = useCallback(() => {
    // Mark that user has manually reset to prevent auto-population
    markManualReset();

    // ALWAYS clear both 2D and 3D states regardless of current mode

    // Clear 2D local state
    setSelectedDots(new Map());
    setSelectionOrder(0);

    // Clear shared state (used by both modes, but especially 3D)
    sharedSetSelectedDots(new Map());

    // Always emit bassline event for synchronization
    emitBasslineEvent(new Map());

    // Clear exercise tracking to allow re-selection of the same exercise
    clearExerciseTracking();
  }, [
    markManualReset,
    setSelectedDots,
    setSelectionOrder,
    sharedSetSelectedDots,
    emitBasslineEvent,
    clearExerciseTracking,
  ]);

  /**
   * 3D mode dot click handler
   */
  const handleDotClick3D = useCallback(
    (stringIndex: number, fret: number | 'open') => {
      // Mark that user has made manual selections
      markManualSelection();

      // The 3D component uses absolute string indices
      const absoluteStringIndex = stringIndex;

      // Validate that the absolute string index is within bounds
      if (absoluteStringIndex < 0 || absoluteStringIndex >= 6) {
        return;
      }

      // Use comma format to match shared state format (absolute index)
      const key = `${absoluteStringIndex},${fret}`;

      // Create a new map and pass that directly
      const newDotsMap = new Map(sharedSelectedDots);

      if (newDotsMap.has(key)) {
        // Deselect the dot and renumber remaining dots
        newDotsMap.delete(key);

        // Get all remaining orders and sort them
        const allRemainingOrders: number[] = [];
        for (const orders of newDotsMap.values()) {
          allRemainingOrders.push(...orders);
        }
        allRemainingOrders.sort((a, b) => a - b);

        // Renumber to maintain consecutive sequence
        const orderMapping = new Map<number, number>();
        allRemainingOrders.forEach((oldOrder, index) => {
          orderMapping.set(oldOrder, index + 1);
        });

        // Apply new numbering
        for (const [dotKey, orders] of newDotsMap.entries()) {
          const updatedOrders = orders.map(
            (order: number) => orderMapping.get(order) || order,
          );
          newDotsMap.set(dotKey, updatedOrders);
        }
      } else {
        // Add new dot with next sequential number
        // Find the highest existing order number
        const allOrders = Array.from(sharedSelectedDots.values()).flat();
        const nextOrder = allOrders.length > 0 ? Math.max(...allOrders) + 1 : 1;

        newDotsMap.set(key, [nextOrder]);
      }

      // Call the setter with our new map
      sharedSetSelectedDots(newDotsMap);
    },
    [sharedSelectedDots, sharedSetSelectedDots, markManualSelection],
  );

  /**
   * 2D mode dot click handler
   */
  const handleDotClick2D = useCallback(
    (stringIndex: number, fret: number | 'open') => {
      // Mark that user has made manual selections
      markManualSelection();

      // Custom dot click handler that ensures proper sequencing
      const key = `${stringIndex},${fret}`;

      setSelectedDots((prev) => {
        const newDots = new Map(prev);

        if (newDots.has(key)) {
          // Deselect the dot and renumber remaining dots
          newDots.delete(key);

          // Get all remaining orders and sort them
          const allRemainingOrders: number[] = [];
          for (const orders of newDots.values()) {
            allRemainingOrders.push(...orders);
          }
          allRemainingOrders.sort((a, b) => a - b);

          // Renumber to maintain consecutive sequence
          const orderMapping = new Map<number, number>();
          allRemainingOrders.forEach((oldOrder, index) => {
            orderMapping.set(oldOrder, index + 1);
          });

          // Apply new numbering
          for (const [dotKey, orders] of newDots.entries()) {
            const updatedOrders = orders.map(
              (order) => orderMapping.get(order) || order,
            );
            newDots.set(dotKey, updatedOrders);
          }

          // Update selection order counter
          setSelectionOrder(allRemainingOrders.length);
        } else {
          // Add new dot with next sequential number
          // Find the highest existing order number
          const allOrders = Array.from(prev.values()).flat();
          const nextOrder =
            allOrders.length > 0 ? Math.max(...allOrders) + 1 : 1;

          newDots.set(key, [nextOrder]);
          setSelectionOrder(nextOrder);
        }

        return newDots;
      });

      // Trigger audio
      triggerNote(stringIndex, fret);
    },
    [setSelectedDots, setSelectionOrder, triggerNote, markManualSelection],
  );

  /**
   * Drag and drop handler
   */
  const handleDragDrop = useCallback(
    (targetStringIndex: number, targetFret: number | 'open') => {
      // Custom drag drop handler that preserves order numbers
      if (!draggedDot) return;

      const { stringIndex: sourceString, fret: sourceFret, order } = draggedDot;

      // Don't do anything if dropping on the same position
      if (sourceString === targetStringIndex && sourceFret === targetFret) {
        handleDragEnd();
        return;
      }

      // Mark that user has made manual selections
      markManualSelection();

      // Update the position while preserving the order number
      setSelectedDots((prev) => {
        const newDots = new Map(prev);

        // Remove the dot from source position
        const sourceKey = `${sourceString},${sourceFret}`;
        newDots.delete(sourceKey);

        // Add the dot to target position with the same order number
        const targetKey = `${targetStringIndex},${targetFret}`;
        const targetOrders = newDots.get(targetKey) || [];

        // If target position is empty, place the dot there with its original order
        if (targetOrders.length === 0) {
          newDots.set(targetKey, [order]);
        } else {
          // If target position has dots, add this order to the list
          if (!targetOrders.includes(order)) {
            newDots.set(
              targetKey,
              [...targetOrders, order].sort((a, b) => a - b),
            );
          }
        }

        return newDots;
      });

      // Trigger audio for the target position
      triggerNote(targetStringIndex, targetFret);

      // Clear drag state
      handleDragEnd();
    },
    [
      draggedDot,
      setSelectedDots,
      triggerNote,
      handleDragEnd,
      markManualSelection,
    ],
  );

  /**
   * Handle adding a second note to an already selected dot (2D mode)
   */
  const handleDotSecondSelection2D = useCallback(
    (stringIndex: number, fret: number | 'open') => {
      markManualSelection();

      const key = `${stringIndex},${fret}`;

      setSelectedDots((prev) => {
        const newDots = new Map(prev);
        const existingOrders = newDots.get(key) || [];

        if (existingOrders.length > 0) {
          // Find the highest existing order number across all dots
          const allOrders = Array.from(prev.values()).flat();
          const nextOrder =
            allOrders.length > 0 ? Math.max(...allOrders) + 1 : 1;

          // Add the new order to this dot
          newDots.set(
            key,
            [...existingOrders, nextOrder].sort((a, b) => a - b),
          );
          setSelectionOrder(nextOrder);
        }

        return newDots;
      });

      // Trigger audio
      triggerNote(stringIndex, fret);
    },
    [setSelectedDots, setSelectionOrder, triggerNote, markManualSelection],
  );

  /**
   * Handle adding a second note to an already selected dot (3D mode)
   */
  const handleDotSecondSelection3D = useCallback(
    (stringIndex: number, fret: number | 'open') => {
      markManualSelection();

      const absoluteStringIndex = stringIndex;

      if (absoluteStringIndex < 0 || absoluteStringIndex >= 6) {
        return;
      }

      const key = `${absoluteStringIndex},${fret}`;

      const newDotsMap = new Map(sharedSelectedDots);
      const existingOrders = newDotsMap.get(key) || [];

      if (existingOrders.length > 0) {
        // Find the highest existing order number across all dots
        const allOrders = Array.from(sharedSelectedDots.values()).flat();
        const nextOrder = allOrders.length > 0 ? Math.max(...allOrders) + 1 : 1;

        // Add the new order to this dot
        newDotsMap.set(
          key,
          [...existingOrders, nextOrder].sort((a, b) => a - b),
        );
      }

      sharedSetSelectedDots(newDotsMap);
    },
    [sharedSelectedDots, sharedSetSelectedDots, markManualSelection],
  );

  /**
   * Handle removing a note from a selected dot (2D mode)
   */
  const handleDotRemoval2D = useCallback(
    (stringIndex: number, fret: number | 'open') => {
      markManualSelection();

      const key = `${stringIndex},${fret}`;

      setSelectedDots((prev) => {
        const newDots = new Map(prev);
        const existingOrders = newDots.get(key) || [];

        if (existingOrders.length > 1) {
          // Remove the highest order number from this dot
          const updatedOrders = [...existingOrders];
          updatedOrders.pop(); // Remove the last (highest) order
          newDots.set(key, updatedOrders);
        } else if (existingOrders.length === 1) {
          // Remove the entire dot and renumber remaining dots
          newDots.delete(key);

          // Get all remaining orders and sort them
          const allRemainingOrders: number[] = [];
          for (const orders of newDots.values()) {
            allRemainingOrders.push(...orders);
          }
          allRemainingOrders.sort((a, b) => a - b);

          // Renumber to maintain consecutive sequence
          const orderMapping = new Map<number, number>();
          allRemainingOrders.forEach((oldOrder, index) => {
            orderMapping.set(oldOrder, index + 1);
          });

          // Apply new numbering
          for (const [dotKey, orders] of newDots.entries()) {
            const updatedOrders = orders.map(
              (order) => orderMapping.get(order) || order,
            );
            newDots.set(dotKey, updatedOrders);
          }

          setSelectionOrder(allRemainingOrders.length);
        }

        return newDots;
      });
    },
    [setSelectedDots, setSelectionOrder, markManualSelection],
  );

  /**
   * Handle removing a note from a selected dot (3D mode)
   */
  const handleDotRemoval3D = useCallback(
    (stringIndex: number, fret: number | 'open') => {
      markManualSelection();

      const absoluteStringIndex = stringIndex;

      if (absoluteStringIndex < 0 || absoluteStringIndex >= 6) {
        return;
      }

      const key = `${absoluteStringIndex},${fret}`;

      const newDotsMap = new Map(sharedSelectedDots);
      const existingOrders = newDotsMap.get(key) || [];

      if (existingOrders.length > 1) {
        // Remove the highest order number from this dot
        const updatedOrders = [...existingOrders];
        updatedOrders.pop(); // Remove the last (highest) order
        newDotsMap.set(key, updatedOrders);
      } else if (existingOrders.length === 1) {
        // Remove the entire dot and renumber remaining dots
        newDotsMap.delete(key);

        // Get all remaining orders and sort them
        const allRemainingOrders: number[] = [];
        for (const orders of newDotsMap.values()) {
          allRemainingOrders.push(...orders);
        }
        allRemainingOrders.sort((a, b) => a - b);

        // Renumber to maintain consecutive sequence
        const orderMapping = new Map<number, number>();
        allRemainingOrders.forEach((oldOrder, index) => {
          orderMapping.set(oldOrder, index + 1);
        });

        // Apply new numbering
        for (const [dotKey, orders] of newDotsMap.entries()) {
          const updatedOrders = orders.map(
            (order: number) => orderMapping.get(order) || order,
          );
          newDotsMap.set(dotKey, updatedOrders);
        }
      }

      sharedSetSelectedDots(newDotsMap);
    },
    [sharedSelectedDots, sharedSetSelectedDots, markManualSelection],
  );

  return {
    handleUnifiedReset,
    handleDotClick3D,
    handleDotClick2D,
    handleDragDrop,
    handleDotSecondSelection2D,
    handleDotSecondSelection3D,
    handleDotRemoval2D,
    handleDotRemoval3D,
  };
}
