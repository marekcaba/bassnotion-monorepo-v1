import type { StringCount } from '../types/fretboardTypes';

/**
 * Convert between 2D format (Map<string, number[]>) and 3D format (Map<string, number>)
 * The 2D format uses comma-separated keys (e.g., "1,3" for string 1, fret 3)
 * The 3D format uses dash-separated keys (e.g., "1-3" for string 1, fret 3)
 */

/**
 * Converts 2D fretboard dot format to 3D format
 * @param selectedDots2D - Map with comma-separated keys and array of order numbers
 * @param stringCount - Current string count configuration
 * @returns Map with dash-separated keys and single order numbers
 */
export function convertTo3DFormat(
  selectedDots2D: Map<string, number[]>,
  stringCount: StringCount,
): Map<string, number> {
  const result = new Map<string, number>();

  for (const [key, orders] of selectedDots2D.entries()) {
    if (orders.length > 0) {
      // Parse the key to get string index and fret
      const parts = key.split(',');
      if (parts.length !== 2) continue;
      const stringIndexStr = parts[0];
      const fretStr = parts[1];
      if (stringIndexStr === undefined || fretStr === undefined) continue;
      const absoluteStringIndex = parseInt(stringIndexStr, 10);

      // Validate that the absolute string index is within the full 6-string bounds
      if (absoluteStringIndex < 0 || absoluteStringIndex >= 6) {
        continue; // Skip invalid absolute string indices
      }

      // Use the same absolute string indices for 3D as 2D
      // 4-string: E(1), A(2), D(3), G(4) - keep same indices
      // 5-string: B(0), E(1), A(2), D(3), G(4) - keep same indices
      // 6-string: B(0), E(1), A(2), D(3), G(4), C(5) - keep same indices

      // Determine if this absolute index is visible for the current string count
      let isVisible = false;

      if (stringCount === 4) {
        // 4-string: shows E(1), A(2), D(3), G(4)
        isVisible = absoluteStringIndex >= 1 && absoluteStringIndex <= 4;
      } else if (stringCount === 5) {
        // 5-string: shows B(0), E(1), A(2), D(3), G(4)
        isVisible = absoluteStringIndex >= 0 && absoluteStringIndex <= 4;
      } else if (stringCount === 6) {
        // 6-string: shows B(0), E(1), A(2), D(3), G(4), C(5)
        isVisible = absoluteStringIndex >= 0 && absoluteStringIndex <= 5;
      }

      // Skip if string is not visible in current configuration
      if (!isVisible) {
        continue;
      }

      // Create 3D format key (dash format) using the same absolute string index
      const dashKey = `${absoluteStringIndex}-${fretStr}`;
      if (orders[0] !== undefined) {
        result.set(dashKey, orders[0]); // Take the first order number
      }
    }
  }

  return result;
}

/**
 * Converts 3D fretboard dot format to 2D format
 * @param selectedDots3D - Map with dash-separated keys and single order numbers
 * @returns Map with comma-separated keys and arrays of order numbers
 */
export function convertFrom3DFormat(
  selectedDots3D: Map<string, number>,
): Map<string, number[]> {
  const result = new Map<string, number[]>();

  for (const [key, order] of selectedDots3D.entries()) {
    // Parse the 3D key to get absolute string index and fret
    const parts = key.split('-');
    if (parts.length !== 2) continue;
    const stringIndexStr = parts[0];
    const fretStr = parts[1];
    if (stringIndexStr === undefined || fretStr === undefined) continue;
    const absoluteStringIndex = parseInt(stringIndexStr, 10);

    // Validate that the absolute string index is within the full 6-string bounds
    if (absoluteStringIndex < 0 || absoluteStringIndex >= 6) {
      continue; // Skip invalid absolute string indices
    }

    // The 3D format now uses the same absolute indices as 2D, so no conversion needed
    // Just create the 2D format key (comma format) using the same absolute string index
    const commaKey = `${absoluteStringIndex},${fretStr}`;
    result.set(commaKey, [order]); // Wrap single order in array
  }

  return result;
}
