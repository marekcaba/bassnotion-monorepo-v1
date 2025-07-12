import React from 'react';
import type { StringCount } from '../../types/fretboardTypes';

interface DiagonalLinesProps {
  stringCount: StringCount;
  frets: number[];
  gridWidth?: number;
  highlightingFunctions: {
    shouldHighlightBasicLine: (
      lineType: 'diagonal',
      stringIndex: number,
      fret: number,
      direction:
        | 'right'
        | 'left'
        | 'up-right'
        | 'up-left'
        | 'down-right'
        | 'down-left',
    ) => boolean;
    shouldHighlightLongDiagonal: (
      stringIndex: number,
      fret: number,
      direction:
        | 'right'
        | 'left'
        | 'up-right'
        | 'up-left'
        | 'down-right'
        | 'down-left',
    ) => boolean;
    shouldHighlightVerticalLongDiagonal: (
      stringIndex: number,
      fret: number,
      direction:
        | 'right'
        | 'left'
        | 'up-right'
        | 'up-left'
        | 'down-right'
        | 'down-left',
    ) => boolean;
    shouldHighlightUpDiagonal: (
      stringIndex: number,
      fret: number,
      direction: 'up-right' | 'up-left' | 'down-right' | 'down-left',
    ) => boolean;
    shouldHighlightDownDiagonal: (
      stringIndex: number,
      fret: number,
      direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
    ) => boolean;
    shouldHighlightExtraLongDiagonal: (
      stringIndex: number,
      fret: number,
      direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
    ) => boolean;
    shouldHighlight3String1FretDiagonal: (
      stringIndex: number,
      fret: number,
      direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
    ) => boolean;
    shouldHighlight3x3Diagonal: (
      stringIndex: number,
      fret: number,
      direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
    ) => boolean;
    shouldHighlight4x2Diagonal: (
      stringIndex: number,
      fret: number,
      direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
    ) => boolean;
    shouldHighlight3x2Diagonal: (
      stringIndex: number,
      fret: number,
      direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
    ) => boolean;
    shouldHighlight2x3Diagonal: (
      stringIndex: number,
      fret: number,
      direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
    ) => boolean;
  };
}

export const DiagonalLines: React.FC<DiagonalLinesProps> = ({
  stringCount,
  frets,
  gridWidth = 568,
  highlightingFunctions,
}) => {
  const stringIndices = Array.from({ length: stringCount }, (_, i) => i);
  const allFrets = [0, ...frets]; // Include open string (fret 0)

  // Calculate position for any fret (including 0 for open string) - must match dot centers
  const DOT_RADIUS = 13;
  const STRING_SPACING = 42;
  const FRET_SPACING = 38;
  const FRET_OFFSET = 46;
  const CENTER_OFFSET = 15;

  const getX = (fret: number) =>
    fret === 0
      ? CENTER_OFFSET + DOT_RADIUS
      : CENTER_OFFSET + FRET_OFFSET + (fret - 1) * FRET_SPACING + DOT_RADIUS;
  const getY = (stringIndex: number) =>
    stringIndex * STRING_SPACING + DOT_RADIUS;

  const renderDiagonalLine = (
    startStringIndex: number,
    startFret: number,
    endStringIndex: number,
    endFret: number,
    key: string,
    isHighlighted: boolean,
  ) => {
    // Boundary checks
    if (startStringIndex < 0 || startStringIndex >= stringCount) return null;
    if (endStringIndex < 0 || endStringIndex >= stringCount) return null;
    if (startFret < 0 || startFret > 12) return null;
    if (endFret < 0 || endFret > 12) return null;

    const startX = getX(startFret);
    const startY = getY(startStringIndex);
    const endX = getX(endFret);
    const endY = getY(endStringIndex);

    return (
      <line
        key={key}
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={isHighlighted ? 'rgba(34, 197, 94, 1)' : 'white'}
        strokeWidth={isHighlighted ? 4 : 1}
        style={{ zIndex: isHighlighted ? 15 : 1 }}
        opacity={isHighlighted ? 1 : 0.05}
      />
    );
  };

  const renderDiagonalsFromPosition = (stringIndex: number, fret: number) => {
    const lines: React.ReactElement[] = [];

    // Render diagonal lines in both directions to ensure all connections work
    // Each line is only rendered once by checking both ends for highlighting
    const patterns = [
      // 1×1 patterns - both directions
      { stringOffset: 1, fretOffset: 1, key: 'down-right' },
      { stringOffset: 1, fretOffset: -1, key: 'down-left' },
      { stringOffset: -1, fretOffset: 1, key: 'up-right' },
      { stringOffset: -1, fretOffset: -1, key: 'up-left' },

      // 1×2 Long Diagonals - both directions
      { stringOffset: 1, fretOffset: 2, key: 'long-down-right' },
      { stringOffset: 1, fretOffset: -2, key: 'long-down-left' },
      { stringOffset: -1, fretOffset: 2, key: 'long-up-right' },
      { stringOffset: -1, fretOffset: -2, key: 'long-up-left' },

      // 2×1 Vertical Long Diagonals - both directions
      { stringOffset: 2, fretOffset: 1, key: 'vlong-down-right' },
      { stringOffset: 2, fretOffset: -1, key: 'vlong-down-left' },
      { stringOffset: -2, fretOffset: 1, key: 'vlong-up-right' },
      { stringOffset: -2, fretOffset: -1, key: 'vlong-up-left' },

      // 2×2 Diagonals - both directions
      { stringOffset: 2, fretOffset: 2, key: '2x2-down-right' },
      { stringOffset: 2, fretOffset: -2, key: '2x2-down-left' },
      { stringOffset: -2, fretOffset: 2, key: '2x2-up-right' },
      { stringOffset: -2, fretOffset: -2, key: '2x2-up-left' },

      // 1×3 Extra Long Diagonals - both directions
      { stringOffset: 1, fretOffset: 3, key: 'extra-down-right' },
      { stringOffset: 1, fretOffset: -3, key: 'extra-down-left' },
      { stringOffset: -1, fretOffset: 3, key: 'extra-up-right' },
      { stringOffset: -1, fretOffset: -3, key: 'extra-up-left' },

      // 3×1 Diagonals - both directions
      { stringOffset: 3, fretOffset: 1, key: '3x1-down-right' },
      { stringOffset: 3, fretOffset: -1, key: '3x1-down-left' },
      { stringOffset: -3, fretOffset: 1, key: '3x1-up-right' },
      { stringOffset: -3, fretOffset: -1, key: '3x1-up-left' },

      // 3×3 Diagonals - both directions
      { stringOffset: 3, fretOffset: 3, key: '3x3-down-right' },
      { stringOffset: 3, fretOffset: -3, key: '3x3-down-left' },
      { stringOffset: -3, fretOffset: 3, key: '3x3-up-right' },
      { stringOffset: -3, fretOffset: -3, key: '3x3-up-left' },

      // 3×2 Diagonals - both directions
      { stringOffset: 3, fretOffset: 2, key: '3x2-down-right' },
      { stringOffset: 3, fretOffset: -2, key: '3x2-down-left' },
      { stringOffset: -3, fretOffset: 2, key: '3x2-up-right' },
      { stringOffset: -3, fretOffset: -2, key: '3x2-up-left' },

      // 2×3 Diagonals - both directions
      { stringOffset: 2, fretOffset: 3, key: '2x3-down-right' },
      { stringOffset: 2, fretOffset: -3, key: '2x3-down-left' },
      { stringOffset: -2, fretOffset: 3, key: '2x3-up-right' },
      { stringOffset: -2, fretOffset: -3, key: '2x3-up-left' },

      // 2×4 Diagonals - both directions
      { stringOffset: 2, fretOffset: 4, key: '2x4-down-right' },
      { stringOffset: 2, fretOffset: -4, key: '2x4-down-left' },
      { stringOffset: -2, fretOffset: 4, key: '2x4-up-right' },
      { stringOffset: -2, fretOffset: -4, key: '2x4-up-left' },
    ];

    patterns.forEach(({ stringOffset, fretOffset, key }) => {
      const endStringIndex = stringIndex + stringOffset;
      const endFret = fret + fretOffset;

      // Check if this diagonal line should be highlighted based on connections
      // We need to check both directions since the line can be highlighted from either end
      let isHighlighted = false;

      // Determine direction based on offset pattern
      const absStringOffset = Math.abs(stringOffset);
      const absFretOffset = Math.abs(fretOffset);
      let direction: 'down-right' | 'down-left' | 'up-right' | 'up-left';

      if (stringOffset > 0) {
        direction = fretOffset > 0 ? 'down-right' : 'down-left';
      } else {
        direction = fretOffset > 0 ? 'up-right' : 'up-left';
      }

      // Helper function to get the reverse direction
      const getReverseDirection = (
        dir: 'down-right' | 'down-left' | 'up-right' | 'up-left',
      ) => {
        switch (dir) {
          case 'down-right':
            return 'up-left';
          case 'down-left':
            return 'up-right';
          case 'up-right':
            return 'down-left';
          case 'up-left':
            return 'down-right';
        }
      };

      // Check highlighting based on pattern type - check both ends of the connection
      if (absStringOffset === 1 && absFretOffset === 1) {
        // Basic 1×1 diagonal
        isHighlighted =
          highlightingFunctions.shouldHighlightBasicLine(
            'diagonal',
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlightBasicLine(
            'diagonal',
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          );
      } else if (absStringOffset === 1 && absFretOffset === 2) {
        // 1×2 Long diagonal
        isHighlighted =
          highlightingFunctions.shouldHighlightLongDiagonal(
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlightLongDiagonal(
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          );
      } else if (absStringOffset === 2 && absFretOffset === 1) {
        // 2×1 Vertical long diagonal
        isHighlighted =
          highlightingFunctions.shouldHighlightVerticalLongDiagonal(
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlightVerticalLongDiagonal(
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          );
      } else if (absStringOffset === 2 && absFretOffset === 2) {
        // 2×2 Diagonal
        isHighlighted =
          highlightingFunctions.shouldHighlightDownDiagonal(
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlightDownDiagonal(
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          ) ||
          highlightingFunctions.shouldHighlightUpDiagonal(
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlightUpDiagonal(
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          );
      } else if (absStringOffset === 1 && absFretOffset === 3) {
        // 1×3 Extra long diagonal
        isHighlighted =
          highlightingFunctions.shouldHighlightExtraLongDiagonal(
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlightExtraLongDiagonal(
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          );
      } else if (absStringOffset === 3 && absFretOffset === 1) {
        // 3×1 Diagonal
        isHighlighted =
          highlightingFunctions.shouldHighlight3String1FretDiagonal(
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlight3String1FretDiagonal(
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          );
      } else if (absStringOffset === 3 && absFretOffset === 3) {
        // 3×3 Diagonal
        isHighlighted =
          highlightingFunctions.shouldHighlight3x3Diagonal(
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlight3x3Diagonal(
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          );
      } else if (absStringOffset === 3 && absFretOffset === 2) {
        // 3×2 Diagonal
        isHighlighted =
          highlightingFunctions.shouldHighlight3x2Diagonal(
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlight3x2Diagonal(
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          );
      } else if (absStringOffset === 2 && absFretOffset === 4) {
        // 2×4 Diagonal
        isHighlighted =
          highlightingFunctions.shouldHighlight4x2Diagonal(
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlight4x2Diagonal(
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          );
      } else if (absStringOffset === 2 && absFretOffset === 3) {
        // 2×3 Diagonal
        isHighlighted =
          highlightingFunctions.shouldHighlight2x3Diagonal(
            stringIndex,
            fret,
            direction,
          ) ||
          highlightingFunctions.shouldHighlight2x3Diagonal(
            endStringIndex,
            endFret,
            getReverseDirection(direction),
          );
      }

      const line = renderDiagonalLine(
        stringIndex,
        fret,
        endStringIndex,
        endFret,
        `${key}-${stringIndex}-${fret}`,
        isHighlighted,
      );

      if (line) {
        lines.push(line);
      }
    });

    return lines;
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
      viewBox={`0 0 ${gridWidth} ${stringCount * STRING_SPACING + 26}`}
    >
      {/* Render all diagonal lines from every position */}
      {stringIndices.flatMap((stringIndex) =>
        allFrets.flatMap((fret) =>
          renderDiagonalsFromPosition(stringIndex, fret),
        ),
      )}
    </svg>
  );
};
