/**
 * MIDI Note Extractor
 *
 * Extracts unique piano note names from harmony MIDI files
 * Used for FAANG smart sample loading - only load samples for notes actually used in the exercise
 */

import { Midi } from '@tonejs/midi';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('MidiNoteExtractor');

/**
 * Extract unique piano note names from a harmony MIDI file
 *
 * @param midiUrl - URL to the harmony MIDI file (Supabase storage URL)
 * @returns Array of unique note names sorted by pitch (e.g., ['C3', 'D3', 'E3', ...])
 *
 * @example
 * const notes = await extractNotesFromHarmonyMidi('https://...harmony.mid');
 * // Returns: ['C3', 'D#3', 'F3', 'G3', 'A#3', 'C4', 'D#4', 'F4']
 * // Only 8 unique notes instead of loading all 88 piano keys!
 */
export async function extractNotesFromHarmonyMidi(
  midiUrl: string
): Promise<string[]> {
  const startTime = performance.now();

  try {
    logger.info('📥 Fetching harmony MIDI file...', { midiUrl });

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
          // note.name is like "C4", "D#5", "F3", etc.
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

    logger.info('✅ MIDI note extraction complete', {
      totalTracks: midi.tracks.length,
      uniqueNotes: uniqueNotes.length,
      durationMs: duration,
      lowestNote: uniqueNotes[0],
      highestNote: uniqueNotes[uniqueNotes.length - 1],
      noteRange: uniqueNotes.join(', ')
    });

    return uniqueNotes;

  } catch (error) {
    logger.error('❌ Failed to extract notes from MIDI file', error);

    // Return empty array on error - preloader will handle gracefully
    // Better to load nothing than to fail entire page load
    return [];
  }
}

/**
 * Convert note name (e.g., "C4") to MIDI note number for sorting
 *
 * @param noteName - Note name like "C4", "D#5", "Gb3"
 * @returns MIDI note number (0-127)
 */
function noteNameToMidiNumber(noteName: string): number {
  // Note to semitone mapping
  const noteToSemitone: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };

  // Extract note and octave (e.g., "C#4" → "C#" and "4")
  const match = noteName.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) {
    logger.warn('Invalid note name format', { noteName });
    return 60; // Default to Middle C
  }

  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);

  // MIDI note number = (octave + 1) * 12 + semitone
  // C4 (Middle C) = 60
  const semitone = noteToSemitone[note] ?? 0;
  const midiNumber = (octave + 1) * 12 + semitone;

  return midiNumber;
}

/**
 * Group notes by octave for debugging/logging
 *
 * @param notes - Array of note names
 * @returns Object with octaves as keys
 *
 * @example
 * groupNotesByOctave(['C3', 'D3', 'C4', 'D4'])
 * // Returns: { '3': ['C3', 'D3'], '4': ['C4', 'D4'] }
 */
export function groupNotesByOctave(notes: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const note of notes) {
    const match = note.match(/(-?\d+)$/);
    if (match) {
      const octave = match[1];
      if (!grouped[octave]) {
        grouped[octave] = [];
      }
      grouped[octave].push(note);
    }
  }

  return grouped;
}
