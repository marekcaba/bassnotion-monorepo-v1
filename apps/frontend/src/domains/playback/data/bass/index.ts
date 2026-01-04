/**
 * Bass Data Module
 *
 * Exports bass sampler configuration and manifest data.
 */

import bassSamplerManifest from './bass-sampler-manifest.json';

/**
 * Bass sampler manifest with all sample metadata
 */
export { bassSamplerManifest };

/**
 * Type for the manifest structure
 */
export interface BassSamplerManifestJson {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  technique: 'finger' | 'pick' | 'slap';
  velocity: 'f' | 'mf' | 'p';
  format: {
    type: string;
    codec: string;
    sampleRate: number;
    quality: number;
  };
  strings: Array<{
    name: string;
    displayName: string;
    openNote: string;
    openMidiNote: number;
    maxFret: number;
    sampleCount: number;
    noteRange: {
      low: string;
      high: string;
      lowMidi: number;
      highMidi: number;
    };
  }>;
  totalSamples: number;
  urlPattern: string;
  noteNaming: {
    convention: string;
    sharpSymbol: string;
    examples: string[];
  };
  midiRange: {
    min: number;
    max: number;
    description: string;
  };
}

/**
 * Get the bass sampler manifest
 */
export function getBassSamplerManifest(): BassSamplerManifestJson {
  return bassSamplerManifest as BassSamplerManifestJson;
}

/**
 * Get string configuration by name
 */
export function getStringConfig(
  stringName: 'B' | 'E' | 'A' | 'D' | 'G',
): BassSamplerManifestJson['strings'][0] | undefined {
  return bassSamplerManifest.strings.find((s) => s.name === stringName);
}

/**
 * Get the MIDI note range for the bass
 */
export function getMidiRange(): { min: number; max: number } {
  return bassSamplerManifest.midiRange;
}
