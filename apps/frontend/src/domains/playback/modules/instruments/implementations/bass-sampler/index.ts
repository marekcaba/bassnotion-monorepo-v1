/**
 * Bass Sampler Module
 *
 * Exports all bass sampler functionality.
 */

// Types
export * from './types.js';

// Manifest and URL generation
export {
  buildSampleUrl,
  getSamplesForString,
  getAllSamples,
  getSampleForMidiNote,
  getSamplesForMidiNotes,
  getBufferKey,
  parseBufferKey,
  isValidBassMidiNote,
  getBassNoteRange,
  DEFAULT_BASS_MANIFEST,
  manifest,
} from './BassSampleManifest.js';

// Sample loader
export {
  BassSampleLoader,
  createBassSampleLoader,
  type LoadProgressCallback,
  type LoadResult,
} from './BassSampleLoader.js';

// Sampler engine
export {
  BassSamplerEngine,
  createBassSamplerEngine,
} from './BassSamplerEngine.js';
