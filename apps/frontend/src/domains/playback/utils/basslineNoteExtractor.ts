/**
 * Bassline MIDI Note Extractor
 *
 * Extracts unique bass note names from bassline MIDI files
 * Used for FAANG smart sample loading - only load samples for notes actually used in the exercise
 */

import { Midi } from '@tonejs/midi';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('BasslineNoteExtractor');

/**
 * Extract unique bass note names from a bassline MIDI file
 *
 * @param midiUrl - URL to the bassline MIDI file (Supabase storage URL)
 * @returns Array of unique note names sorted by pitch (e.g., ['E1', 'A1', 'D2', 'G2'])
 *
 * @example
 * const notes = await extractNotesFromBasslineMidi('https://...bassline.mid');
 * // Returns: ['E1', 'A1', 'D2', 'G2']
 * // Only 4 unique notes instead of loading all 24 bass notes!
 */
export async function extractNotesFromBasslineMidi(
  midiUrl: string
): Promise<string[]> {
  const startTime = performance.now();

  try {
    logger.info('📥 Fetching bassline MIDI file...', { midiUrl });

    // 1. Fetch MIDI file from URL
    const response = await fetch(midiUrl, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch MIDI file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    logger.debug('MIDI file fetched', { sizeBytes: arrayBuffer.byteLength });

    // 2. Parse MIDI file with @tonejs/midi
    const midi = new Midi(arrayBuffer);

    // Validate MIDI file
    if (!midi.tracks || midi.tracks.length === 0) {
      throw new Error('MIDI file contains no tracks');
    }

    // 3. Extract all notes from all tracks
    const allNoteNames = new Set<string>();

    for (const track of midi.tracks) {
      if (track.notes && track.notes.length > 0) {
        for (const note of track.notes) {
          // note.name is like "E1", "A1", "D2", etc.
          if (note.name) {
            allNoteNames.add(note.name);
          }
        }
      }
    }

    // 4. Convert Set to sorted array
    // Sort by MIDI note number (pitch) for better organization
    const uniqueNotes = Array.from(allNoteNames).sort((a, b) => {
      // Parse note name to MIDI number for sorting
      const midiA = noteNameToMidiNumber(a);
      const midiB = noteNameToMidiNumber(b);
      return midiA - midiB;
    });

    const duration = (performance.now() - startTime).toFixed(2);

    logger.info('✅ Bassline MIDI note extraction complete', {
      totalTracks: midi.tracks.length,
      uniqueNotes: uniqueNotes.length,
      durationMs: duration,
      lowestNote: uniqueNotes[0],
      highestNote: uniqueNotes[uniqueNotes.length - 1],
      noteRange: uniqueNotes.join(', ')
    });

    return uniqueNotes;

  } catch (error) {
    logger.error('❌ Failed to extract notes from bassline MIDI file', error);

    // Return empty array on error - preloader will handle gracefully
    // Better to load nothing than to fail entire page load
    return [];
  }
}

/**
 * Convert note name (e.g., "E1") to MIDI note number for sorting
 *
 * @param noteName - Note name like "E1", "A1", "D2", "G2"
 * @returns MIDI note number (0-127)
 */
function noteNameToMidiNumber(noteName: string): number {
  // Note to semitone mapping
  const noteToSemitone: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };

  // Extract note and octave (e.g., "E1" → "E" and "1")
  const match = noteName.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) {
    logger.warn('Invalid note name format', { noteName });
    return 40; // Default to bass E (E1)
  }

  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);

  // MIDI note number = (octave + 1) * 12 + semitone
  // E1 (Bass E) = 40
  const semitone = noteToSemitone[note] ?? 0;
  const midiNumber = (octave + 1) * 12 + semitone;

  return midiNumber;
}

/**
 * Group bass notes by string for debugging/logging
 * Standard 4-string bass tuning: E1, A1, D2, G2
 *
 * @param notes - Array of note names
 * @returns Object with string names as keys
 *
 * @example
 * groupNotesByString(['E1', 'F1', 'A1', 'G2'])
 * // Returns: { 'E-string': ['E1', 'F1'], 'A-string': ['A1'], 'G-string': ['G2'] }
 */
export function groupNotesByString(notes: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {
    'E-string (E1-G1)': [],
    'A-string (A1-C2)': [],
    'D-string (D2-F2)': [],
    'G-string (G2-B2)': []
  };

  for (const note of notes) {
    const midiNum = noteNameToMidiNumber(note);

    // E string: E1 (28) to G1 (31)
    if (midiNum >= 28 && midiNum <= 31) {
      grouped['E-string (E1-G1)'].push(note);
    }
    // A string: A1 (33) to C2 (36)
    else if (midiNum >= 33 && midiNum <= 36) {
      grouped['A-string (A1-C2)'].push(note);
    }
    // D string: D2 (38) to F2 (41)
    else if (midiNum >= 38 && midiNum <= 41) {
      grouped['D-string (D2-F2)'].push(note);
    }
    // G string: G2 (43) to B2 (47)
    else if (midiNum >= 43 && midiNum <= 47) {
      grouped['G-string (G2-B2)'].push(note);
    }
  }

  return grouped;
}
