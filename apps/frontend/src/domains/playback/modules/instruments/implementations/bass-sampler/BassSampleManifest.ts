/**
 * Bass Sample Manifest
 *
 * Handles URL generation and sample metadata for bass samples.
 * Samples are stored in Supabase at: audio-samples/Bass/BassMods/Fingers-f/
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  BassSamplerManifest,
  BassSampleConfig,
  BassString,
  BassStringConfig,
} from './types.js';
import {
  BASS_TUNING,
  midiNoteToName,
  noteNameToMidi,
} from './types.js';

const logger = createStructuredLogger('BassSampleManifest');

/**
 * Supabase base URL for audio samples
 */
const SUPABASE_BASE_URL =
  'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples';

/**
 * Default manifest for the BassMods finger samples
 */
export const DEFAULT_BASS_MANIFEST: BassSamplerManifest = {
  name: 'BassMods Finger',
  version: '1.0.0',
  description: '5-string bass samples, finger technique, forte velocity',
  baseUrl: SUPABASE_BASE_URL,
  technique: 'finger',
  velocity: 'f',
  strings: [
    {
      name: 'B',
      openNote: 'B0',
      openMidiNote: 23,
      maxFret: 21,
      sampleCount: 22,
    },
    {
      name: 'E',
      openNote: 'E1',
      openMidiNote: 28,
      maxFret: 21,
      sampleCount: 22,
    },
    {
      name: 'A',
      openNote: 'A1',
      openMidiNote: 33,
      maxFret: 21,
      sampleCount: 22,
    },
    {
      name: 'D',
      openNote: 'D2',
      openMidiNote: 38,
      maxFret: 21,
      sampleCount: 22,
    },
    {
      name: 'G',
      openNote: 'G2',
      openMidiNote: 43,
      maxFret: 21,
      sampleCount: 22,
    },
  ],
  totalSamples: 110, // 22 samples × 5 strings
};

/**
 * Build the sample URL for a specific note
 *
 * URL Pattern:
 * {baseUrl}/Bass/BassMods/Fingers-f/{String}%20string/{Note}{Octave}_f_finger_{String}string.ogg
 *
 * Example:
 * .../Bass/BassMods/Fingers-f/A%20string/A1_f_finger_Astring.ogg
 */
export function buildSampleUrl(
  midiNote: number,
  string: BassString,
  manifest: BassSamplerManifest = DEFAULT_BASS_MANIFEST,
): string {
  const noteName = midiNoteToName(midiNote);
  const velocity = manifest.velocity;
  const technique = manifest.technique;

  // URL encode the space in string folder name
  const stringFolder = `${string}%20string`;

  // Build filename: {Note}{Octave}_{velocity}_{technique}_{String}string.ogg
  const filename = `${noteName}_${velocity}_${technique}_${string}string.ogg`;

  return `${manifest.baseUrl}/Bass/BassMods/Fingers-f/${stringFolder}/${filename}`;
}

/**
 * Get all sample configurations for a string
 */
export function getSamplesForString(
  stringConfig: BassStringConfig,
  manifest: BassSamplerManifest = DEFAULT_BASS_MANIFEST,
): BassSampleConfig[] {
  const samples: BassSampleConfig[] = [];
  const { name: string, openMidiNote, maxFret } = stringConfig;

  for (let fret = 0; fret <= maxFret; fret++) {
    const midiNote = openMidiNote + fret;
    const noteName = midiNoteToName(midiNote);

    samples.push({
      note: noteName,
      midiNote,
      fret,
      string,
      url: buildSampleUrl(midiNote, string, manifest),
    });
  }

  return samples;
}

/**
 * Get all sample configurations for the entire bass
 */
export function getAllSamples(
  manifest: BassSamplerManifest = DEFAULT_BASS_MANIFEST,
): BassSampleConfig[] {
  const allSamples: BassSampleConfig[] = [];

  for (const stringConfig of manifest.strings) {
    const stringSamples = getSamplesForString(stringConfig, manifest);
    allSamples.push(...stringSamples);
  }

  logger.info('Generated all bass sample configs', {
    totalSamples: allSamples.length,
    strings: manifest.strings.map((s) => s.name),
  });

  return allSamples;
}

/**
 * Get sample configuration for a specific MIDI note
 * Returns the first available string position (lowest string preferred)
 */
export function getSampleForMidiNote(
  midiNote: number,
  preferredString?: BassString,
  manifest: BassSamplerManifest = DEFAULT_BASS_MANIFEST,
): BassSampleConfig | null {
  // If preferred string is specified and valid, use it
  if (preferredString) {
    const stringConfig = manifest.strings.find(
      (s) => s.name === preferredString,
    );
    if (stringConfig) {
      const fret = midiNote - stringConfig.openMidiNote;
      if (fret >= 0 && fret <= stringConfig.maxFret) {
        return {
          note: midiNoteToName(midiNote),
          midiNote,
          fret,
          string: preferredString,
          url: buildSampleUrl(midiNote, preferredString, manifest),
        };
      }
    }
  }

  // Find first valid string position
  for (const stringConfig of manifest.strings) {
    const fret = midiNote - stringConfig.openMidiNote;
    if (fret >= 0 && fret <= stringConfig.maxFret) {
      return {
        note: midiNoteToName(midiNote),
        midiNote,
        fret,
        string: stringConfig.name,
        url: buildSampleUrl(midiNote, stringConfig.name, manifest),
      };
    }
  }

  logger.warn('No sample available for MIDI note', { midiNote });
  return null;
}

/**
 * Get sample configurations for a list of MIDI notes
 * Used for smart loading (FAANG) - only load what's needed
 */
export function getSamplesForMidiNotes(
  midiNotes: number[],
  manifest: BassSamplerManifest = DEFAULT_BASS_MANIFEST,
): BassSampleConfig[] {
  const samples: BassSampleConfig[] = [];
  const uniqueNotes = [...new Set(midiNotes)].sort((a, b) => a - b);

  for (const midiNote of uniqueNotes) {
    const sample = getSampleForMidiNote(midiNote, undefined, manifest);
    if (sample) {
      samples.push(sample);
    }
  }

  logger.info('Generated sample configs for exercise', {
    requestedNotes: midiNotes.length,
    uniqueNotes: uniqueNotes.length,
    samplesFound: samples.length,
  });

  return samples;
}

/**
 * Get the buffer key for a MIDI note (used by BassScheduler)
 */
export function getBufferKey(midiNote: number): string {
  return String(midiNote);
}

/**
 * Parse a buffer key back to MIDI note number
 */
export function parseBufferKey(key: string): number {
  return parseInt(key, 10);
}

/**
 * Validate that a MIDI note is within the bass range
 */
export function isValidBassMidiNote(midiNote: number): boolean {
  // B0 (23) to highest playable note (G2 + 21 frets = 64)
  return midiNote >= 23 && midiNote <= 64;
}

/**
 * Get the note range for the bass
 */
export function getBassNoteRange(): { min: number; max: number } {
  return { min: 23, max: 64 };
}

/**
 * Export the manifest for use by other modules
 */
export { DEFAULT_BASS_MANIFEST as manifest };
