import { useState, useCallback } from 'react';
import type { StringCount, SelectedDotsMap } from '../types/fretboardTypes';
import {
  hasDotsOnHiddenStrings,
  getStringCountWarningMessage,
  getStringCountTooltipMessage,
} from '../utils/stringCountValidation';

interface UseStringCountHandlersProps {
  currentStringCount: StringCount;
  selectedDots: SelectedDotsMap;
  setStringCount: (count: StringCount) => void;
}

/**
 * Hook to handle string count changes with validation
 * Prevents hiding strings that have selected dots
 */
export function useStringCountHandlers({
  currentStringCount,
  selectedDots,
  setStringCount,
}: UseStringCountHandlersProps) {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  /**
   * Handle string count changes with validation
   */
  const handleStringCountChangeWithValidation = useCallback(
    (newStringCount: StringCount) => {
      if (currentStringCount === newStringCount) return;

      // Check if this change would hide strings with selected dots
      if (
        hasDotsOnHiddenStrings(currentStringCount, newStringCount, selectedDots)
      ) {
        // Show warning message
        const warningMsg = getStringCountWarningMessage(
          currentStringCount,
          newStringCount,
        );
        setWarningMessage(warningMsg);

        // Auto-hide warning after 5 seconds
        setTimeout(() => setWarningMessage(null), 5000);
        return;
      }

      // Clear any existing warning
      setWarningMessage(null);

      // Update the string count
      setStringCount(newStringCount);
    },
    [currentStringCount, selectedDots, setStringCount],
  );

  /**
   * Check if a string count change would hide dots (for button styling)
   */
  const wouldHideDotsOnStringCountChange = useCallback(
    (newStringCount: StringCount) => {
      return hasDotsOnHiddenStrings(
        currentStringCount,
        newStringCount,
        selectedDots,
      );
    },
    [currentStringCount, selectedDots],
  );

  /**
   * Get tooltip message for a string count button
   */
  const getTooltipMessage = useCallback(
    (targetStringCount: StringCount) => {
      const wouldHideDots = wouldHideDotsOnStringCountChange(targetStringCount);
      return getStringCountTooltipMessage(
        currentStringCount,
        targetStringCount,
        wouldHideDots,
      );
    },
    [currentStringCount, wouldHideDotsOnStringCountChange],
  );

  /**
   * Clear the warning message
   */
  const clearWarningMessage = useCallback(() => {
    setWarningMessage(null);
  }, []);

  return {
    warningMessage,
    handleStringCountChangeWithValidation,
    wouldHideDotsOnStringCountChange,
    getTooltipMessage,
    clearWarningMessage,
  };
}
