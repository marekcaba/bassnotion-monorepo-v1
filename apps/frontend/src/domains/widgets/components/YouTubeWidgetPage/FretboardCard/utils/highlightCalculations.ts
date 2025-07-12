import type {
  Connection,
  StringCount,
  DiagonalDirection,
  CrossFretboardDirection,
} from '../types/fretboardTypes';

/**
 * Checks if a long diagonal line should be highlighted
 * Pattern: 2 frets forward/backward, 1 string up/down
 */
export const shouldHighlightLongDiagonal = (
  stringIndex: number,
  fret: number,
  direction: DiagonalDirection,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
    const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

    // Only draw from the position with lower string index to avoid double-drawing
    if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'right') {
        // Long down-right diagonal (2 frets forward, 1 string down)
        if (
          targetString === stringIndex + 1 &&
          targetFret === currentFret + 2
        ) {
          return true;
        }
      } else if (direction === 'left') {
        // Long down-left diagonal (2 frets backward, 1 string down)
        if (
          targetString === stringIndex + 1 &&
          targetFret === currentFret - 2
        ) {
          return true;
        }
      }
    }

    if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'up-right') {
        // Long up-right diagonal (2 frets forward, 1 string up)
        if (
          targetString === stringIndex - 1 &&
          targetFret === currentFret + 2
        ) {
          return true;
        }
      } else if (direction === 'up-left') {
        // Long up-left diagonal (2 frets backward, 1 string up)
        if (
          targetString === stringIndex - 1 &&
          targetFret === currentFret - 2
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if a vertical long diagonal line should be highlighted
 * Pattern: 1 fret forward/backward, 2 strings up/down
 */
export const shouldHighlightVerticalLongDiagonal = (
  stringIndex: number,
  fret: number,
  direction: DiagonalDirection,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
    const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

    // Only draw from the position with lower string index to avoid double-drawing
    if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'right') {
        // Vertical long down-right diagonal (1 fret forward, 2 strings down)
        if (
          targetString === stringIndex + 2 &&
          targetFret === currentFret + 1
        ) {
          return true;
        }
      } else if (direction === 'left') {
        // Vertical long down-left diagonal (1 fret backward, 2 strings down)
        if (
          targetString === stringIndex + 2 &&
          targetFret === currentFret - 1
        ) {
          return true;
        }
      }
    }

    if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'up-right') {
        // Vertical long up-right diagonal (1 fret forward, 2 strings up)
        if (
          targetString === stringIndex - 2 &&
          targetFret === currentFret + 1
        ) {
          return true;
        }
      } else if (direction === 'up-left') {
        // Vertical long up-left diagonal (1 fret backward, 2 strings up)
        if (
          targetString === stringIndex - 2 &&
          targetFret === currentFret - 1
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if an up diagonal line should be highlighted
 * Pattern: 2 frets forward/backward, 2 strings up
 */
export const shouldHighlightUpDiagonal = (
  stringIndex: number,
  fret: number,
  direction: DiagonalDirection,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;

    if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'up-right') {
        // Up-right diagonal (2 frets forward, 2 strings up)
        if (
          targetString === stringIndex - 2 &&
          targetFret === currentFret + 2
        ) {
          return true;
        }
      } else if (direction === 'up-left') {
        // Up-left diagonal (2 frets backward, 2 strings up)
        if (
          targetString === stringIndex - 2 &&
          targetFret === currentFret - 2
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if a down diagonal line should be highlighted
 * Pattern: 2 frets forward/backward, 2 strings down
 */
export const shouldHighlightDownDiagonal = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;

    if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'down-right') {
        // Down-right diagonal (2 frets forward, 2 strings down)
        if (
          targetString === stringIndex + 2 &&
          targetFret === currentFret + 2
        ) {
          return true;
        }
      } else if (direction === 'down-left') {
        // Down-left diagonal (2 frets backward, 2 strings down)
        if (
          targetString === stringIndex + 2 &&
          targetFret === currentFret - 2
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if an extra long diagonal line should be highlighted
 * Pattern: 3 frets forward/backward, 1 string up/down
 */
export const shouldHighlightExtraLongDiagonal = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;

    if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'down-right') {
        // Extra long down-right diagonal (3 frets forward, 1 string down)
        if (
          targetString === stringIndex + 1 &&
          targetFret === currentFret + 3
        ) {
          return true;
        }
      } else if (direction === 'down-left') {
        // Extra long down-left diagonal (3 frets backward, 1 string down)
        if (
          targetString === stringIndex + 1 &&
          targetFret === currentFret - 3
        ) {
          return true;
        }
      }
    }

    if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'up-right') {
        // Extra long up-right diagonal (3 frets forward, 1 string up)
        if (
          targetString === stringIndex - 1 &&
          targetFret === currentFret + 3
        ) {
          return true;
        }
      } else if (direction === 'up-left') {
        // Extra long up-left diagonal (3 frets backward, 1 string up)
        if (
          targetString === stringIndex - 1 &&
          targetFret === currentFret - 3
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if a 3-string 1-fret diagonal should be highlighted
 * Pattern: 1 fret forward/backward, 3 strings up/down
 */
export const shouldHighlight3String1FretDiagonal = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;

    if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'down-right') {
        // 3-string down-right diagonal (1 fret forward, 3 strings down)
        if (
          targetString === stringIndex + 3 &&
          targetFret === currentFret + 1
        ) {
          return true;
        }
      } else if (direction === 'down-left') {
        // 3-string down-left diagonal (1 fret backward, 3 strings down)
        if (
          targetString === stringIndex + 3 &&
          targetFret === currentFret - 1
        ) {
          return true;
        }
      }
    }

    if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'up-right') {
        // 3-string up-right diagonal (1 fret forward, 3 strings up)
        if (
          targetString === stringIndex - 3 &&
          targetFret === currentFret + 1
        ) {
          return true;
        }
      } else if (direction === 'up-left') {
        // 3-string up-left diagonal (1 fret backward, 3 strings up)
        if (
          targetString === stringIndex - 3 &&
          targetFret === currentFret - 1
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if a 3x3 diagonal should be highlighted
 * Pattern: 3 frets forward/backward, 3 strings up/down
 */
export const shouldHighlight3x3Diagonal = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;

    if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'down-right') {
        // 3x3 down-right diagonal (3 frets forward, 3 strings down)
        if (
          targetString === stringIndex + 3 &&
          targetFret === currentFret + 3
        ) {
          return true;
        }
      } else if (direction === 'down-left') {
        // 3x3 down-left diagonal (3 frets backward, 3 strings down)
        if (
          targetString === stringIndex + 3 &&
          targetFret === currentFret - 3
        ) {
          return true;
        }
      }
    }

    if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'up-right') {
        // 3x3 up-right diagonal (3 frets forward, 3 strings up)
        if (
          targetString === stringIndex - 3 &&
          targetFret === currentFret + 3
        ) {
          return true;
        }
      } else if (direction === 'up-left') {
        // 3x3 up-left diagonal (3 frets backward, 3 strings up)
        if (
          targetString === stringIndex - 3 &&
          targetFret === currentFret - 3
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if a basic cross-fretboard diagonal should be highlighted
 * Pattern: From open top string to 2nd fret bottom string (or vice versa)
 */
export const shouldHighlightBasicCrossFretboardDiagonal = (
  stringIndex: number,
  fret: number,
  stringCount: StringCount,
  direction: 'down' | 'up',
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;

    if (isPos1) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'down') {
        // Cross-fretboard down diagonal
        if (
          stringIndex === 0 &&
          currentFret === 0 &&
          targetString === stringCount - 1 &&
          targetFret === 2
        ) {
          return true;
        }
      } else if (direction === 'up') {
        // Cross-fretboard up diagonal
        if (
          stringIndex === stringCount - 1 &&
          currentFret === 2 &&
          targetString === 0 &&
          targetFret === 0
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if a generalized cross-fretboard diagonal should be highlighted
 * Pattern: 3 strings apart, 2 frets apart
 */
export const shouldHighlightBasicCrossFretboardDiagonalAnyFret = (
  stringIndex: number,
  fret: number,
  stringCount: StringCount,
  direction: 'down' | 'up',
  fretDirection: 'forward' | 'backward',
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;

    if (isPos1) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'down' && fretDirection === 'forward') {
        // Cross-fretboard down-forward diagonal (3 strings down, 2 frets forward)
        if (
          targetString === stringIndex + 3 &&
          targetFret === currentFret + 2
        ) {
          return true;
        }
      } else if (direction === 'down' && fretDirection === 'backward') {
        // Cross-fretboard down-backward diagonal (3 strings down, 2 frets backward)
        if (
          targetString === stringIndex + 3 &&
          targetFret === currentFret - 2
        ) {
          return true;
        }
      } else if (direction === 'up' && fretDirection === 'forward') {
        // Cross-fretboard up-forward diagonal (3 strings up, 2 frets forward)
        if (
          targetString === stringIndex - 3 &&
          targetFret === currentFret + 2
        ) {
          return true;
        }
      } else if (direction === 'up' && fretDirection === 'backward') {
        // Cross-fretboard up-backward diagonal (3 strings up, 2 frets backward)
        if (
          targetString === stringIndex - 3 &&
          targetFret === currentFret - 2
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if a 4x2 diagonal should be highlighted
 * Pattern: 4 frets forward/backward, 2 strings up/down
 */
export const shouldHighlight4x2Diagonal = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;

    if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'down-right') {
        // 4x2 down-right diagonal (4 frets forward, 2 strings down)
        if (
          targetString === stringIndex + 2 &&
          targetFret === currentFret + 4
        ) {
          return true;
        }
      } else if (direction === 'down-left') {
        // 4x2 down-left diagonal (4 frets backward, 2 strings down)
        if (
          targetString === stringIndex + 2 &&
          targetFret === currentFret - 4
        ) {
          return true;
        }
      }
    }

    if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'up-right') {
        // 4x2 up-right diagonal (4 frets forward, 2 strings up)
        if (
          targetString === stringIndex - 2 &&
          targetFret === currentFret + 4
        ) {
          return true;
        }
      } else if (direction === 'up-left') {
        // 4x2 up-left diagonal (4 frets backward, 2 strings up)
        if (
          targetString === stringIndex - 2 &&
          targetFret === currentFret - 4
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if a 3x2 diagonal should be highlighted
 * Pattern: 2 frets forward/backward, 3 strings up/down
 */
export const shouldHighlight3x2Diagonal = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;

    if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'down-right') {
        // 3x2 down-right diagonal (2 frets forward, 3 strings down)
        if (
          targetString === stringIndex + 3 &&
          targetFret === currentFret + 2
        ) {
          return true;
        }
      } else if (direction === 'down-left') {
        // 3x2 down-left diagonal (2 frets backward, 3 strings down)
        if (
          targetString === stringIndex + 3 &&
          targetFret === currentFret - 2
        ) {
          return true;
        }
      }
    }

    if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'up-right') {
        // 3x2 up-right diagonal (2 frets forward, 3 strings up)
        if (
          targetString === stringIndex - 3 &&
          targetFret === currentFret + 2
        ) {
          return true;
        }
      } else if (direction === 'up-left') {
        // 3x2 up-left diagonal (2 frets backward, 3 strings up)
        if (
          targetString === stringIndex - 3 &&
          targetFret === currentFret - 2
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if a 2x3 diagonal should be highlighted
 * Pattern: 3 frets forward/backward, 2 strings up/down
 */
export const shouldHighlight2x3Diagonal = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
  allConnections: Connection[],
): boolean => {
  if (allConnections.length === 0) return false;

  for (const connection of allConnections) {
    const { pos1, pos2 } = connection;
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    const currentFret = fret;
    const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;

    if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'down-right') {
        // 2x3 down-right diagonal (3 frets forward, 2 strings down)
        if (
          targetString === stringIndex + 2 &&
          targetFret === currentFret + 3
        ) {
          return true;
        }
      } else if (direction === 'down-left') {
        // 2x3 down-left diagonal (3 frets backward, 2 strings down)
        if (
          targetString === stringIndex + 2 &&
          targetFret === currentFret - 3
        ) {
          return true;
        }
      }
    }

    if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
      const targetString = pos2.stringIndex;
      const targetFret = fret2;

      if (direction === 'up-right') {
        // 2x3 up-right diagonal (3 frets forward, 2 strings up)
        if (
          targetString === stringIndex - 2 &&
          targetFret === currentFret + 3
        ) {
          return true;
        }
      } else if (direction === 'up-left') {
        // 2x3 up-left diagonal (3 frets backward, 2 strings up)
        if (
          targetString === stringIndex - 2 &&
          targetFret === currentFret - 3
        ) {
          return true;
        }
      }
    }
  }

  return false;
};
