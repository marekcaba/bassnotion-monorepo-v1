import { useMemo } from 'react';
import type {
  Connection,
  SelectedDotsMap,
  StringCount,
  LineType,
  DiagonalDirection,
  CrossFretboardDirection,
} from '../types/fretboardTypes';
import { findAllConnections } from '../utils/connectionDetection';
import {
  shouldHighlightLine,
  getHorizontalSegments,
  getVerticalSegments,
} from '../utils/fretboardGeometry';
import {
  shouldHighlightLongDiagonal,
  shouldHighlightVerticalLongDiagonal,
  shouldHighlightUpDiagonal,
  shouldHighlightDownDiagonal,
  shouldHighlightExtraLongDiagonal,
  shouldHighlight3String1FretDiagonal,
  shouldHighlight3x3Diagonal,
  shouldHighlightBasicCrossFretboardDiagonal,
  shouldHighlightBasicCrossFretboardDiagonalAnyFret,
  shouldHighlight4x2Diagonal,
  shouldHighlight3x2Diagonal,
  shouldHighlight2x3Diagonal,
} from '../utils/highlightCalculations';

/**
 * Hook to manage fretboard connections and highlighting logic
 */
export const useFretboardConnections = (
  selectedDots: SelectedDotsMap,
  stringCount: StringCount,
) => {
  // Calculate all connections between selected dots
  const allConnections = useMemo(() => {
    return findAllConnections(selectedDots);
  }, [selectedDots]);

  // Memoized highlighting functions to avoid recalculation
  const highlightingFunctions = useMemo(
    () => ({
      // Basic line highlighting
      shouldHighlightBasicLine: (
        lineType: LineType,
        stringIndex: number,
        fret?: number,
        direction?: DiagonalDirection,
      ) =>
        shouldHighlightLine(
          lineType,
          stringIndex,
          fret,
          direction,
          allConnections,
        ),

      // Specialized diagonal highlighting functions
      shouldHighlightLongDiagonal: (
        stringIndex: number,
        fret: number,
        direction: DiagonalDirection,
      ) =>
        shouldHighlightLongDiagonal(
          stringIndex,
          fret,
          direction,
          allConnections,
        ),

      shouldHighlightVerticalLongDiagonal: (
        stringIndex: number,
        fret: number,
        direction: DiagonalDirection,
      ) =>
        shouldHighlightVerticalLongDiagonal(
          stringIndex,
          fret,
          direction,
          allConnections,
        ),

      shouldHighlightUpDiagonal: (
        stringIndex: number,
        fret: number,
        direction: DiagonalDirection,
      ) =>
        shouldHighlightUpDiagonal(stringIndex, fret, direction, allConnections),

      shouldHighlightDownDiagonal: (
        stringIndex: number,
        fret: number,
        direction: CrossFretboardDirection,
      ) =>
        shouldHighlightDownDiagonal(
          stringIndex,
          fret,
          direction,
          allConnections,
        ),

      shouldHighlightExtraLongDiagonal: (
        stringIndex: number,
        fret: number,
        direction: CrossFretboardDirection,
      ) =>
        shouldHighlightExtraLongDiagonal(
          stringIndex,
          fret,
          direction,
          allConnections,
        ),

      shouldHighlight3String1FretDiagonal: (
        stringIndex: number,
        fret: number,
        direction: CrossFretboardDirection,
      ) =>
        shouldHighlight3String1FretDiagonal(
          stringIndex,
          fret,
          direction,
          allConnections,
        ),

      shouldHighlight3x3Diagonal: (
        stringIndex: number,
        fret: number,
        direction: CrossFretboardDirection,
      ) =>
        shouldHighlight3x3Diagonal(
          stringIndex,
          fret,
          direction,
          allConnections,
        ),

      shouldHighlightBasicCrossFretboardDiagonal: (
        stringIndex: number,
        fret: number,
        direction: 'down' | 'up',
      ) =>
        shouldHighlightBasicCrossFretboardDiagonal(
          stringIndex,
          fret,
          stringCount,
          direction,
          allConnections,
        ),

      shouldHighlightBasicCrossFretboardDiagonalAnyFret: (
        stringIndex: number,
        fret: number,
        direction: 'down' | 'up',
        fretDirection: 'forward' | 'backward',
      ) =>
        shouldHighlightBasicCrossFretboardDiagonalAnyFret(
          stringIndex,
          fret,
          stringCount,
          direction,
          fretDirection,
          allConnections,
        ),

      shouldHighlight4x2Diagonal: (
        stringIndex: number,
        fret: number,
        direction: CrossFretboardDirection,
      ) =>
        shouldHighlight4x2Diagonal(
          stringIndex,
          fret,
          direction,
          allConnections,
        ),

      shouldHighlight3x2Diagonal: (
        stringIndex: number,
        fret: number,
        direction: CrossFretboardDirection,
      ) =>
        shouldHighlight3x2Diagonal(
          stringIndex,
          fret,
          direction,
          allConnections,
        ),

      shouldHighlight2x3Diagonal: (
        stringIndex: number,
        fret: number,
        direction: CrossFretboardDirection,
      ) =>
        shouldHighlight2x3Diagonal(
          stringIndex,
          fret,
          direction,
          allConnections,
        ),
    }),
    [allConnections, stringCount],
  );

  // Segment calculation functions
  const segmentFunctions = useMemo(
    () => ({
      getHorizontalSegments: (stringIndex: number) =>
        getHorizontalSegments(stringIndex, allConnections),
      getVerticalSegments: (fret: number) =>
        getVerticalSegments(fret, allConnections),
    }),
    [allConnections],
  );

  // Connection statistics
  const connectionStats = useMemo(
    () => ({
      totalConnections: allConnections.length,
      hasConnections: allConnections.length > 0,
      connectionCount: allConnections.length,
    }),
    [allConnections],
  );

  return {
    allConnections,
    highlightingFunctions,
    segmentFunctions,
    connectionStats,
  };
};
