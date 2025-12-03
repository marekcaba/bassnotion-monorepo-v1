/**
 * MIDI Utility Functions
 *
 * Shared utilities for MIDI note manipulation used across the playback domain.
 * Extracted during Phase 4 cleanup to eliminate code duplication.
 */

/**
 * Convert MIDI note number to note name with 's' for sharps
 *
 * Uses 's' suffix for sharps (not '#') to match buffer cache keys.
 * Grand Piano keyboard map uses: 'Cs4', 'Ds4', 'Fs4', 'Gs4', 'As4'
 *
 * @param midiNote - MIDI note number (0-127)
 * @returns Note name with octave (e.g., 'C4', 'Cs4', 'D4')
 *
 * @example
 * midiToNoteName(60) // 'C4' (Middle C)
 * midiToNoteName(61) // 'Cs4' (C# above middle C)
 * midiToNoteName(62) // 'D4'
 */
export function midiToNoteName(midiNote: number): string {
  const noteNames = [
    'C',
    'Cs',
    'D',
    'Ds',
    'E',
    'F',
    'Fs',
    'G',
    'Gs',
    'A',
    'As',
    'B',
  ];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  return `${noteNames[noteIndex]}${octave}`;
}
