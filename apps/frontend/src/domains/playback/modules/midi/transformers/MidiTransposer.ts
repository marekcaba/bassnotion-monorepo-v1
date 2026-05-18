/**
 * MIDI Transposer
 *
 * Transposes MIDI notes by semitones or to different keys
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { ParsedMidiFile, MidiEvent, MidiTrack } from '../parser/index.js';
import type { TypedMidiEvent } from '../parser/index.js';

const logger = createStructuredLogger('MidiTransposer');

export interface TransposeOptions {
  // Semitones to transpose (positive = up, negative = down)
  semitones?: number;

  // Target key (e.g., 'C', 'G', 'F#')
  targetKey?: string;

  // Source key for key-based transposition
  sourceKey?: string;

  // Octave adjustment
  octaveShift?: number;

  // Constrain to scale
  constrainToScale?: boolean;

  // Scale to constrain to (if constrainToScale is true)
  scale?: string; // 'major', 'minor', 'dorian', etc.

  // Only transpose specific channels
  channels?: number[];

  // Only transpose specific note ranges
  noteRange?: {
    min: number;
    max: number;
  };

  // Preserve drum channel (channel 9)
  preserveDrumChannel?: boolean;
}

export interface TransposeResult {
  transposedFile: ParsedMidiFile;
  statistics: {
    totalNotes: number;
    transposedNotes: number;
    outOfRangeNotes: number;
    keyChanges: number;
  };
}

interface KeyInfo {
  tonic: number; // MIDI note number of tonic
  mode: 'major' | 'minor';
  sharpsOrFlats: number; // Positive = sharps, negative = flats
}

/**
 * Transposes MIDI notes
 */
export class MidiTransposer {
  // Note names for reference
  private static readonly NOTE_NAMES = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];

  // Scale intervals
  private static readonly SCALES: Record<string, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
  };

  // Key signatures
  private static readonly KEY_SIGNATURES: Record<string, KeyInfo> = {
    // Major keys
    C: { tonic: 60, mode: 'major', sharpsOrFlats: 0 },
    G: { tonic: 67, mode: 'major', sharpsOrFlats: 1 },
    D: { tonic: 62, mode: 'major', sharpsOrFlats: 2 },
    A: { tonic: 69, mode: 'major', sharpsOrFlats: 3 },
    E: { tonic: 64, mode: 'major', sharpsOrFlats: 4 },
    B: { tonic: 71, mode: 'major', sharpsOrFlats: 5 },
    'F#': { tonic: 66, mode: 'major', sharpsOrFlats: 6 },
    'C#': { tonic: 61, mode: 'major', sharpsOrFlats: 7 },
    F: { tonic: 65, mode: 'major', sharpsOrFlats: -1 },
    Bb: { tonic: 70, mode: 'major', sharpsOrFlats: -2 },
    Eb: { tonic: 63, mode: 'major', sharpsOrFlats: -3 },
    Ab: { tonic: 68, mode: 'major', sharpsOrFlats: -4 },
    Db: { tonic: 61, mode: 'major', sharpsOrFlats: -5 },
    Gb: { tonic: 66, mode: 'major', sharpsOrFlats: -6 },
    Cb: { tonic: 71, mode: 'major', sharpsOrFlats: -7 },
    // Minor keys
    Am: { tonic: 57, mode: 'minor', sharpsOrFlats: 0 },
    Em: { tonic: 64, mode: 'minor', sharpsOrFlats: 1 },
    Bm: { tonic: 59, mode: 'minor', sharpsOrFlats: 2 },
    'F#m': { tonic: 66, mode: 'minor', sharpsOrFlats: 3 },
    'C#m': { tonic: 61, mode: 'minor', sharpsOrFlats: 4 },
    'G#m': { tonic: 68, mode: 'minor', sharpsOrFlats: 5 },
    'D#m': { tonic: 63, mode: 'minor', sharpsOrFlats: 6 },
    'A#m': { tonic: 58, mode: 'minor', sharpsOrFlats: 7 },
    Dm: { tonic: 62, mode: 'minor', sharpsOrFlats: -1 },
    Gm: { tonic: 67, mode: 'minor', sharpsOrFlats: -2 },
    Cm: { tonic: 60, mode: 'minor', sharpsOrFlats: -3 },
    Fm: { tonic: 65, mode: 'minor', sharpsOrFlats: -4 },
    Bbm: { tonic: 70, mode: 'minor', sharpsOrFlats: -5 },
    Ebm: { tonic: 63, mode: 'minor', sharpsOrFlats: -6 },
    Abm: { tonic: 68, mode: 'minor', sharpsOrFlats: -7 },
  };

  /**
   * Transpose a parsed MIDI file
   */
  static transpose(
    parsedFile: ParsedMidiFile,
    options: TransposeOptions,
  ): TransposeResult {
    const startTime = performance.now();

    const {
      semitones = 0,
      targetKey,
      sourceKey,
      octaveShift = 0,
      constrainToScale = false,
      scale = 'major',
      channels,
      noteRange,
      preserveDrumChannel = true,
    } = options;

    // Calculate total transposition
    let totalSemitones = semitones + octaveShift * 12;

    // Handle key-based transposition
    if (targetKey && sourceKey) {
      const keyTransposition = this.calculateKeyTransposition(
        sourceKey,
        targetKey,
      );
      totalSemitones += keyTransposition;
    }

    logger.info('Starting transposition', {
      semitones: totalSemitones,
      targetKey,
      sourceKey,
      constrainToScale,
      scale,
    });

    // Clone the file
    const transposedFile = this.cloneMidiFile(parsedFile);

    // Statistics
    let totalNotes = 0;
    let transposedNotes = 0;
    let outOfRangeNotes = 0;
    let keyChanges = 0;

    // Process each track
    for (const track of transposedFile.tracks) {
      for (const event of track.events) {
        // Handle note events
        if (
          (event.type === 'channelNoteOn' || event.type === 'channelNoteOff') &&
          event.data
        ) {
          totalNotes++;

          // Skip drum channel if preserving
          if (preserveDrumChannel && event.channel === 9) {
            continue;
          }

          // Check channel filter
          if (channels && !channels.includes(event.channel)) {
            continue;
          }

          // Check note range
          const originalNote = event.data[0];
          if (
            noteRange &&
            (originalNote < noteRange.min || originalNote > noteRange.max)
          ) {
            continue;
          }

          // Transpose the note
          let newNote = originalNote + totalSemitones;

          // Constrain to scale if requested
          if (constrainToScale && targetKey) {
            newNote = this.constrainToScale(newNote, targetKey, scale);
          }

          // Check MIDI note range (0-127)
          if (newNote < 0 || newNote > 127) {
            outOfRangeNotes++;
            // Clamp to valid range
            newNote = Math.max(0, Math.min(127, newNote));
          }

          event.data[0] = newNote;
          transposedNotes++;
        }

        // Handle key signature events
        if (event.type === 'keySignature' && targetKey) {
          const targetKeyInfo = this.KEY_SIGNATURES[targetKey];
          if (targetKeyInfo) {
            const keyEvent = event as {
              sharpsOrFlats?: number;
              scale?: string;
            };
            keyEvent.sharpsOrFlats = targetKeyInfo.sharpsOrFlats;
            keyEvent.scale = targetKeyInfo.mode;
            keyChanges++;
          }
        }
      }
    }

    const duration = performance.now() - startTime;
    logger.info('Transposition complete', {
      totalNotes,
      transposedNotes,
      outOfRangeNotes,
      keyChanges,
      duration,
    });

    return {
      transposedFile,
      statistics: {
        totalNotes,
        transposedNotes,
        outOfRangeNotes,
        keyChanges,
      },
    };
  }

  /**
   * Calculate semitones between two keys
   */
  private static calculateKeyTransposition(
    sourceKey: string,
    targetKey: string,
  ): number {
    const source = this.KEY_SIGNATURES[sourceKey];
    const target = this.KEY_SIGNATURES[targetKey];

    if (!source || !target) {
      logger.warn('Invalid key signature', { sourceKey, targetKey });
      return 0;
    }

    // Calculate the difference between tonics
    let semitones = (target.tonic - source.tonic) % 12;

    // Ensure positive result
    if (semitones < 0) {
      semitones += 12;
    }

    // Choose the shorter distance
    if (semitones > 6) {
      semitones -= 12;
    }

    return semitones;
  }

  /**
   * Constrain a note to a scale
   */
  private static constrainToScale(
    note: number,
    key: string,
    scaleName: string,
  ): number {
    const keyInfo = this.KEY_SIGNATURES[key];
    if (!keyInfo) return note;

    const scale = this.SCALES[scaleName] || this.SCALES.major;
    const tonic = keyInfo.tonic % 12;

    // Get note's position relative to tonic
    const noteClass = note % 12;
    const octave = Math.floor(note / 12);
    const relativeNote = (noteClass - tonic + 12) % 12;

    // Find nearest scale degree
    let nearestDegree = scale[0];
    let minDistance = Math.abs(relativeNote - nearestDegree);

    for (const degree of scale) {
      const distance = Math.abs(relativeNote - degree);
      if (distance < minDistance) {
        minDistance = distance;
        nearestDegree = degree;
      }
    }

    // Reconstruct the note
    return octave * 12 + ((tonic + nearestDegree) % 12);
  }

  /**
   * Clone a MIDI file
   */
  private static cloneMidiFile(file: ParsedMidiFile): ParsedMidiFile {
    return {
      header: { ...file.header },
      tracks: file.tracks.map((track) => ({
        ...track,
        events: track.events.map((event) => ({
          ...event,
          data: event.data ? [...event.data] : undefined,
        })),
      })),
    };
  }

  /**
   * Transpose by interval
   */
  static transposeByInterval(
    parsedFile: ParsedMidiFile,
    interval: 'octave' | 'fifth' | 'fourth' | 'third' | 'second',
    direction: 'up' | 'down' = 'up',
  ): TransposeResult {
    const intervalMap = {
      octave: 12,
      fifth: 7,
      fourth: 5,
      third: 4,
      second: 2,
    };

    const semitones = intervalMap[interval] * (direction === 'up' ? 1 : -1);
    return this.transpose(parsedFile, { semitones });
  }

  /**
   * Auto-transpose to fit range
   */
  static autoTransposeToRange(
    parsedFile: ParsedMidiFile,
    targetRange: { min: number; max: number },
  ): TransposeResult {
    // Find current range
    let lowestNote = 127;
    let highestNote = 0;

    for (const track of parsedFile.tracks) {
      for (const event of track.events) {
        if (event.type === 'channelNoteOn' && event.data && event.data[1] > 0) {
          const note = event.data[0];
          lowestNote = Math.min(lowestNote, note);
          highestNote = Math.max(highestNote, note);
        }
      }
    }

    if (lowestNote > highestNote) {
      // No notes found
      return {
        transposedFile: parsedFile,
        statistics: {
          totalNotes: 0,
          transposedNotes: 0,
          outOfRangeNotes: 0,
          keyChanges: 0,
        },
      };
    }

    // Calculate optimal transposition
    const currentRange = highestNote - lowestNote;
    const targetRangeSize = targetRange.max - targetRange.min;

    if (currentRange > targetRangeSize) {
      logger.warn('Current range exceeds target range', {
        currentRange,
        targetRangeSize,
      });
    }

    // Center the notes in the target range
    const currentCenter = (lowestNote + highestNote) / 2;
    const targetCenter = (targetRange.min + targetRange.max) / 2;
    const semitones = Math.round(targetCenter - currentCenter);

    logger.info('Auto-transposing to fit range', {
      currentRange: { min: lowestNote, max: highestNote },
      targetRange,
      semitones,
    });

    return this.transpose(parsedFile, { semitones });
  }
}
