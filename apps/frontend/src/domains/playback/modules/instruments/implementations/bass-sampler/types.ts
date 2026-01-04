/**
 * Bass Sampler Types
 *
 * TypeScript definitions for bass sample configuration and playback.
 * Follows the pattern established by drum-kit.types.ts
 */

import type { Note } from '../../architecture/IInstrumentCore.js';

/**
 * Bass string identifiers (5-string bass)
 */
export type BassString = 'B' | 'E' | 'A' | 'D' | 'G';

/**
 * Technique types available for bass samples
 */
export type BassTechnique = 'finger' | 'pick' | 'slap';

/**
 * Velocity layer (currently only forte available)
 */
export type BassVelocity = 'f' | 'mf' | 'p';

/**
 * Configuration for a single bass string
 */
export interface BassStringConfig {
  /** String name */
  name: BassString;
  /** Open note name (e.g., "B0", "E1") */
  openNote: string;
  /** Open string MIDI note number */
  openMidiNote: number;
  /** Highest fret available (typically 21-24) */
  maxFret: number;
  /** Sample count for this string */
  sampleCount: number;
}

/**
 * Configuration for a single bass sample
 */
export interface BassSampleConfig {
  /** Note name (e.g., "Cs2" for C#2) */
  note: string;
  /** MIDI note number (23-67 for 5-string bass) */
  midiNote: number;
  /** Fret position on the string */
  fret: number;
  /** Which string this sample is from */
  string: BassString;
  /** Full URL to the sample file */
  url: string;
}

/**
 * Complete bass sampler manifest
 */
export interface BassSamplerManifest {
  /** Manifest name */
  name: string;
  /** Semantic version */
  version: string;
  /** Description */
  description: string;
  /** Base URL for samples (Supabase storage) */
  baseUrl: string;
  /** Technique used for this sample set */
  technique: BassTechnique;
  /** Velocity layer (currently only 'f') */
  velocity: BassVelocity;
  /** Configuration for each string */
  strings: BassStringConfig[];
  /** Total sample count */
  totalSamples: number;
}

/**
 * Bass note for triggering samples
 * Extends the base Note interface with bass-specific properties
 */
export interface BassNote extends Note {
  /** MIDI note number (primary lookup key) */
  midiNote: number;
  /** Note name (e.g., "E2", "A1") */
  noteName?: string;
  /** String number (1-5, where 1=B, 5=G) */
  string?: number;
  /** Fret position */
  fret?: number;
  /** Technique (affects sample selection if multiple available) */
  technique?: BassTechnique;
}

/**
 * Bass event data structure for PatternEvent
 */
export interface BassEventData {
  /** Note name (e.g., "E2", "A1") */
  note: string;
  /** String number (1-5) */
  string: number;
  /** Fret position (0-24) */
  fret: number;
  /** MIDI pitch number (23-67) */
  midiNote: number;
}

/**
 * Runtime sample map - keyed by MIDI note number
 */
export type BassSampleMap = Map<number, AudioBuffer>;

/**
 * Sample loading status
 */
export interface BassSampleStatus {
  /** MIDI note number */
  midiNote: number;
  /** Note name */
  noteName: string;
  /** Loading status */
  status: 'pending' | 'loading' | 'ready' | 'error';
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Bass sampler engine options
 */
export interface BassSamplerOptions {
  /** Volume in dB (default: -6) */
  volume?: number;
  /** Pan position -1 (left) to 1 (right) (default: 0) */
  pan?: number;
  /** Reverb wet amount 0-1 (default: 0) */
  reverb?: number;
  /** Enable compression (default: true) */
  compression?: boolean;
  /** Attack time in seconds (default: 0.005) */
  attack?: number;
  /** Decay time in seconds (default: 0.1) */
  decay?: number;
  /** Sustain level 0-1 (default: 0.8) */
  sustain?: number;
  /** Release time in seconds (default: 0.3) */
  release?: number;
  /** Enable round-robin for repeated notes (default: true) */
  roundRobin?: boolean;
  /** Maximum samples to keep in memory per note (default: 2 for round-robin) */
  maxSamplesPerNote?: number;
  /** Memory limit in MB (default: 50) */
  memoryLimitMB?: number;
}

/**
 * Round-robin state for a single note
 */
export interface RoundRobinState {
  /** Available sample indices for this note */
  indices: number[];
  /** Current index in the round-robin sequence */
  currentIndex: number;
  /** Last trigger time to prevent too-fast retriggering */
  lastTriggerTime: number;
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  /** Total samples loaded */
  totalSamples: number;
  /** Estimated memory usage in bytes */
  estimatedBytes: number;
  /** Estimated memory usage in MB */
  estimatedMB: number;
  /** Samples per note breakdown */
  samplesPerNote: Map<number, number>;
  /** Least recently used notes */
  lruNotes: number[];
}

/**
 * 5-string bass tuning (open string MIDI notes)
 * Standard tuning: B0, E1, A1, D2, G2
 */
export const BASS_TUNING: Record<BassString, number> = {
  B: 23, // B0
  E: 28, // E1
  A: 33, // A1
  D: 38, // D2
  G: 43, // G2
};

/**
 * String number to name mapping (1-indexed)
 */
export const STRING_NUMBER_TO_NAME: Record<number, BassString> = {
  1: 'B',
  2: 'E',
  3: 'A',
  4: 'D',
  5: 'G',
};

/**
 * String name to number mapping
 */
export const STRING_NAME_TO_NUMBER: Record<BassString, number> = {
  B: 1,
  E: 2,
  A: 3,
  D: 4,
  G: 5,
};

/**
 * MIDI note range for 5-string bass (B0 to ~E4)
 * Each string has 22 frets available
 */
export const BASS_NOTE_RANGE = {
  min: 23, // B0 (open B string)
  max: 64, // E4 (22nd fret of G string)
};

/**
 * Convert MIDI note number to note name
 */
export function midiNoteToName(midiNote: number): string {
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

/**
 * Convert note name to MIDI note number
 */
export function noteNameToMidi(noteName: string): number {
  const noteMap: Record<string, number> = {
    C: 0,
    Cs: 1,
    'C#': 1,
    D: 2,
    Ds: 3,
    'D#': 3,
    E: 4,
    F: 5,
    Fs: 6,
    'F#': 6,
    G: 7,
    Gs: 8,
    'G#': 8,
    A: 9,
    As: 10,
    'A#': 10,
    B: 11,
  };

  // Parse note name (e.g., "Cs2" -> note="Cs", octave=2)
  const match = noteName.match(/^([A-G]s?#?)(-?\d+)$/);
  if (!match) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  const noteValue = noteMap[note];

  if (noteValue === undefined) {
    throw new Error(`Unknown note: ${note}`);
  }

  return (octave + 1) * 12 + noteValue;
}

/**
 * Get the string and fret for a MIDI note
 * Returns the most playable position (prefers middle strings, lower frets)
 */
export function getPositionForMidiNote(
  midiNote: number,
): { string: BassString; fret: number } | null {
  // Check each string from lowest to highest
  const strings: BassString[] = ['B', 'E', 'A', 'D', 'G'];

  for (const string of strings) {
    const openNote = BASS_TUNING[string];
    const fret = midiNote - openNote;

    // Valid fret range is 0-21 (22 frets)
    if (fret >= 0 && fret <= 21) {
      return { string, fret };
    }
  }

  return null;
}

/**
 * Get all possible positions for a MIDI note
 */
export function getAllPositionsForMidiNote(
  midiNote: number,
): Array<{ string: BassString; fret: number }> {
  const positions: Array<{ string: BassString; fret: number }> = [];
  const strings: BassString[] = ['B', 'E', 'A', 'D', 'G'];

  for (const string of strings) {
    const openNote = BASS_TUNING[string];
    const fret = midiNote - openNote;

    if (fret >= 0 && fret <= 21) {
      positions.push({ string, fret });
    }
  }

  return positions;
}
