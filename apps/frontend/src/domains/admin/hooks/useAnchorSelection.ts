import { useState, useCallback } from 'react';
import type { MeasureAnchor } from './useMidiConversion';

/**
 * Hook for managing anchor selection state across all measures
 */
export function useAnchorSelection(totalMeasures: number) {
  const [anchors, setAnchors] = useState<Map<number, MeasureAnchor>>(new Map());

  /**
   * Set anchor for a specific measure
   */
  const setAnchor = useCallback(
    (measureNumber: number, string: number, fret: number) => {
      setAnchors((prev) => {
        const next = new Map(prev);
        next.set(measureNumber, { measureNumber, string, fret });
        return next;
      });
    },
    [],
  );

  /**
   * Remove anchor for a specific measure
   */
  const removeAnchor = useCallback((measureNumber: number) => {
    setAnchors((prev) => {
      const next = new Map(prev);
      next.delete(measureNumber);
      return next;
    });
  }, []);

  /**
   * Clear all anchors
   */
  const clearAll = useCallback(() => {
    setAnchors(new Map());
  }, []);

  /**
   * Get anchor for a specific measure
   */
  const getAnchor = useCallback(
    (measureNumber: number): MeasureAnchor | undefined => {
      return anchors.get(measureNumber);
    },
    [anchors],
  );

  /**
   * Check if all measures have anchors
   */
  const isComplete = useCallback(() => {
    return anchors.size === totalMeasures;
  }, [anchors.size, totalMeasures]);

  /**
   * Get completion percentage
   */
  const getCompletionPercentage = useCallback(() => {
    return Math.round((anchors.size / totalMeasures) * 100);
  }, [anchors.size, totalMeasures]);

  /**
   * Get all anchors as an array
   */
  const getAnchorsArray = useCallback((): MeasureAnchor[] => {
    return Array.from(anchors.values()).sort(
      (a, b) => a.measureNumber - b.measureNumber,
    );
  }, [anchors]);

  /**
   * Get missing measure numbers
   */
  const getMissingMeasures = useCallback((): number[] => {
    const missing: number[] = [];
    for (let i = 1; i <= totalMeasures; i++) {
      if (!anchors.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }, [anchors, totalMeasures]);

  return {
    anchors,
    setAnchor,
    removeAnchor,
    clearAll,
    getAnchor,
    isComplete,
    getCompletionPercentage,
    getAnchorsArray,
    getMissingMeasures,
    anchorCount: anchors.size,
    totalMeasures,
  };
}
