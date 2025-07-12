import type {
  FretboardPosition,
  DotPosition,
  ConnectionLine,
  Connection,
  Fret,
  StringCount,
  LineType,
  DiagonalDirection,
} from '../types/fretboardTypes';

/**
 * Calculates the pixel position of a dot on the fretboard
 * @param stringIndex - The string index (0-based)
 * @param fret - The fret number or 'open'
 * @returns Object with x,y coordinates
 */
export const getDotPosition = (
  stringIndex: number,
  fret: Fret,
): DotPosition => {
  // Use the exact same spacing as the grid lines
  // Strings should be positioned with padding from the top
  const y = 21 + stringIndex * 42; // Start with 21px padding, then 42px spacing
  let x;

  if (fret === 'open') {
    // Open string center: 26px width / 2 = 13px from left edge
    x = 13;
  } else {
    // Grid uses 38px horizontal spacing between fret centers (from diagonal calculations)
    x = 46 + (fret - 1) * 38 + 13; // 46px offset + fret spacing + center
  }

  return { x, y };
};

/**
 * Calculates the connection line properties between two positions
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Object with line properties (x, y, length, angle)
 */
export const getConnectionLine = (
  pos1: FretboardPosition,
  pos2: FretboardPosition,
): ConnectionLine => {
  const dotPos1 = getDotPosition(pos1.stringIndex, pos1.fret);
  const dotPos2 = getDotPosition(pos2.stringIndex, pos2.fret);

  const deltaX = dotPos2.x - dotPos1.x;
  const deltaY = dotPos2.y - dotPos1.y;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  return {
    x: dotPos1.x,
    y: dotPos1.y,
    length,
    angle,
  };
};

/**
 * Gets horizontal line segments for a string
 * @param stringIndex - The string index
 * @param allConnections - Array of all connections
 * @returns Array of segments with start and width
 */
export const getHorizontalSegments = (
  stringIndex: number,
  allConnections: Connection[],
) => {
  const segments = [];

  // Find all horizontal connections on this string
  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    if (pos1.stringIndex === stringIndex && pos2.stringIndex === stringIndex) {
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;
      const minFret = Math.min(fret1, fret2);
      const maxFret = Math.max(fret1, fret2);

      const startX = minFret === 0 ? 13 : 46 + (minFret - 1) * 38 + 13;
      const endX = maxFret === 0 ? 13 : 46 + (maxFret - 1) * 38 + 13;

      segments.push({
        start: startX,
        width: endX - startX,
      });
    }
  }

  return segments;
};

/**
 * Gets vertical line segments for a fret
 * @param fret - The fret number
 * @param allConnections - Array of all connections
 * @returns Array of segments with start and height
 */
export const getVerticalSegments = (
  fret: number,
  allConnections: Connection[],
) => {
  const segments = [];

  // Find all vertical connections at this fret (including open strings at fret 0)
  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    if (fret1 === fret && fret2 === fret) {
      const minString = Math.min(pos1.stringIndex, pos2.stringIndex);
      const maxString = Math.max(pos1.stringIndex, pos2.stringIndex);

      segments.push({
        start: 13 + minString * 42,
        height: (maxString - minString) * 42,
      });
    }
  }

  return segments;
};

/**
 * Checks if a line should be highlighted based on connections
 * @param lineType - Type of line (horizontal, vertical, diagonal)
 * @param stringIndex - String index
 * @param fret - Fret number (optional)
 * @param direction - Direction for diagonal lines
 * @param allConnections - Array of all connections
 * @returns True if line should be highlighted
 */
export const shouldHighlightLine = (
  lineType: LineType,
  stringIndex: number,
  fret: number | undefined,
  direction: DiagonalDirection | undefined,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    if (lineType === 'horizontal') {
      // Horizontal line on this string
      if (
        pos1.stringIndex === stringIndex &&
        pos2.stringIndex === stringIndex
      ) {
        return true;
      }
    }

    if (lineType === 'vertical') {
      // Vertical line at this fret
      if (fret1 === fret2 && fret1 === fret) {
        return true;
      }
    }

    if (lineType === 'diagonal' && fret !== undefined) {
      // Diagonal line from this position
      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      if (isPos1) {
        // Check if this diagonal goes to pos2
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'right') {
          // Only down-right diagonal (1 string down, 1 fret forward)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret + 1
          ) {
            return true;
          }
        } else if (direction === 'left') {
          // Only down-left diagonal (1 string down, 1 fret backward)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret - 1
          ) {
            return true;
          }
        } else if (direction === 'up-right') {
          // Up-right diagonal (1 string up, 1 fret forward)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret + 1
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // Up-left diagonal (1 string up, 1 fret backward)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret - 1
          ) {
            return true;
          }
        }
      }

      if (isPos2) {
        // Check if this diagonal goes to pos1
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'right') {
          // Only down-right diagonal (1 string down, 1 fret forward)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret + 1
          ) {
            return true;
          }
        } else if (direction === 'left') {
          // Only down-left diagonal (1 string down, 1 fret backward)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret - 1
          ) {
            return true;
          }
        } else if (direction === 'up-right') {
          // Up-right diagonal (1 string up, 1 fret forward)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret + 1
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // Up-left diagonal (1 string up, 1 fret backward)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret - 1
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
};
