import type { StringCount, SelectedDotsMap } from '../types/fretboardTypes';

/**
 * String count validation utilities for the fretboard
 * Ensures that changing string count doesn't hide selected dots
 */

/**
 * Checks if changing from current to new string count would hide any selected dots
 * @param currentStringCount - Current number of strings
 * @param newStringCount - Target number of strings
 * @param selectedDots - Currently selected dots on the fretboard
 * @returns true if the change would hide dots, false otherwise
 */
export function hasDotsOnHiddenStrings(
  currentStringCount: StringCount,
  newStringCount: StringCount,
  selectedDots: SelectedDotsMap,
): boolean {
  // If increasing string count, no dots will be hidden
  if (newStringCount >= currentStringCount) {
    return false;
  }

  // Check if any selected dots are on strings that would be hidden
  for (const key of selectedDots.keys()) {
    const [stringIndexStr] = key.split(',');
    const stringIndex = parseInt(stringIndexStr || '0', 10);

    // Check based on the string count change
    if (currentStringCount === 5 && newStringCount === 4) {
      // Switching from 5 to 4 strings: B string (index 0) would be hidden
      if (stringIndex === 0) return true;
    } else if (currentStringCount === 6 && newStringCount === 5) {
      // Switching from 6 to 5 strings: C string (index 5) would be hidden
      if (stringIndex === 5) return true;
    } else if (currentStringCount === 6 && newStringCount === 4) {
      // Switching from 6 to 4 strings: B (index 0) and C (index 5) would be hidden
      if (stringIndex === 0 || stringIndex === 5) return true;
    }
  }

  return false;
}

/**
 * Generates a warning message for string count changes that would hide dots
 * @param currentStringCount - Current number of strings
 * @param newStringCount - Target number of strings
 * @returns Warning message or null if no warning needed
 */
export function getStringCountWarningMessage(
  currentStringCount: StringCount,
  newStringCount: StringCount,
): string | null {
  // No warning if increasing string count
  if (newStringCount >= currentStringCount) {
    return null;
  }

  let hiddenStrings = '';

  if (currentStringCount === 5 && newStringCount === 4) {
    hiddenStrings = 'B string (lowest)';
  } else if (currentStringCount === 6 && newStringCount === 5) {
    hiddenStrings = 'C string (highest)';
  } else if (currentStringCount === 6 && newStringCount === 4) {
    hiddenStrings = 'B string (lowest) and C string (highest)';
  }

  if (hiddenStrings) {
    return `Cannot switch to ${newStringCount} strings while there are selected dots on the ${hiddenStrings}. Please clear those dots first or reset the fretboard.`;
  }

  return null;
}

/**
 * Generates a tooltip message for string count buttons
 * @param currentStringCount - Current number of strings
 * @param targetStringCount - Target number of strings
 * @param wouldHideDots - Whether the change would hide dots
 * @returns Tooltip message
 */
export function getStringCountTooltipMessage(
  currentStringCount: StringCount,
  targetStringCount: StringCount,
  wouldHideDots: boolean,
): string {
  let tooltipMessage = `Switch to ${targetStringCount} string mode`;

  if (wouldHideDots) {
    if (currentStringCount === 5 && targetStringCount === 4) {
      tooltipMessage =
        'Please remove notes from the B string (lowest) to switch to 4-string mode';
    } else if (currentStringCount === 6 && targetStringCount === 5) {
      tooltipMessage =
        'Please remove notes from the C string (highest) to switch to 5-string mode';
    } else if (currentStringCount === 6 && targetStringCount === 4) {
      tooltipMessage =
        'Please remove notes from the B string (lowest) and C string (highest) to switch to 4-string mode';
    }
  }

  return tooltipMessage;
}

/**
 * Gets the absolute string indices that would be hidden when changing string count
 * @param currentStringCount - Current number of strings
 * @param newStringCount - Target number of strings
 * @returns Array of string indices that would be hidden
 */
export function getHiddenStringIndices(
  currentStringCount: StringCount,
  newStringCount: StringCount,
): number[] {
  const hiddenIndices: number[] = [];

  if (currentStringCount === 5 && newStringCount === 4) {
    hiddenIndices.push(0); // B string
  } else if (currentStringCount === 6 && newStringCount === 5) {
    hiddenIndices.push(5); // C string
  } else if (currentStringCount === 6 && newStringCount === 4) {
    hiddenIndices.push(0, 5); // B and C strings
  }

  return hiddenIndices;
}
