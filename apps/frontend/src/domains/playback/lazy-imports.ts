/**
 * Lazy Imports for Playback Domain
 *
 * Optimized imports with code splitting for better performance
 */

import { lazyWithPreload } from '@/shared/utils/lazyWithPreload';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('lazy-imports');

// Audio Engine Components (Core - Load Early)
export const AudioEngine = lazyWithPreload(() =>
  import(
    /* webpackChunkName: "audio-engine" */ './modules/audio-engine/core/AudioEngine'
  ).then((m) => ({ default: m.AudioEngine })),
);

export const ToneWrapper = lazyWithPreload(() =>
  import(
    /* webpackChunkName: "tone-wrapper" */ './modules/audio-engine/core/ToneWrapper'
  ).then((m) => ({ default: m.ToneWrapper })),
);

// Transport Components (Core - Load Early)
export const Transport = lazyWithPreload(() =>
  import(
    /* webpackChunkName: "transport" */ './modules/transport/core/Transport'
  ).then((m) => ({ default: m.Transport })),
);

// Instrument Components (Load on Demand)
export const BassInstrument = lazyWithPreload(() =>
  import(
    /* webpackChunkName: "bass-instrument" */
    './modules/instruments/implementations/bass/BassInstrument'
  ).then((m) => ({ default: m.BassInstrument })),
);

export const DrumInstrument = lazyWithPreload(() =>
  import(
    /* webpackChunkName: "drum-instrument" */
    './modules/instruments/implementations/drums/DrumInstrument'
  ).then((m) => ({ default: m.DrumInstrument })),
);

export const HarmonyInstrument = lazyWithPreload(() =>
  import(
    /* webpackChunkName: "harmony-instrument" */
    './modules/instruments/implementations/harmony/HarmonyInstrument'
  ).then((m) => ({ default: m.HarmonyInstrument })),
);

export const Metronome = lazyWithPreload(() =>
  import(
    /* webpackChunkName: "metronome" */
    './modules/instruments/implementations/metronome/Metronome'
  ).then((m) => ({ default: m.Metronome })),
);

// Track Components
export const Track = lazyWithPreload(() =>
  import(/* webpackChunkName: "track" */ './modules/tracks/core/Track').then(
    (m) => ({ default: m.Track }),
  ),
);

export const Mixer = lazyWithPreload(() =>
  import(/* webpackChunkName: "mixer" */ './modules/tracks/mixing/Mixer').then(
    (m) => ({ default: m.Mixer }),
  ),
);

// Storage Components (Load on Demand)
export const SampleLoader = lazyWithPreload(() =>
  import(
    /* webpackChunkName: "sample-loader" */
    './modules/storage/loaders/SampleLoader'
  ).then((m) => ({ default: m.SampleLoader })),
);

export const GlobalSampleCache = lazyWithPreload(() =>
  import(
    /* webpackChunkName: "sample-cache" */
    './modules/storage/cache/GlobalSampleCache'
  ).then((m) => ({ default: m.GlobalSampleCache })),
);

/**
 * Preload core audio components
 * Call this when user is likely to use audio features soon
 */
export async function preloadCoreAudio() {
  await Promise.all([
    AudioEngine.preload(),
    ToneWrapper.preload(),
    Transport.preload(),
  ]);
}

/**
 * Preload instrument based on type
 */
export async function preloadInstrument(type: string) {
  switch (type) {
    case 'bass':
      return BassInstrument.preload();
    case 'drums':
    case 'drummer':
      return DrumInstrument.preload();
    case 'harmony':
    case 'keyboard':
    case 'piano':
      return HarmonyInstrument.preload();
    case 'metronome':
      return Metronome.preload();
    default:
      logger.warn('Unknown instrument type', { type });
  }
}

/**
 * Preload all instruments (for performance)
 */
export async function preloadAllInstruments() {
  await Promise.all([
    BassInstrument.preload(),
    DrumInstrument.preload(),
    HarmonyInstrument.preload(),
    Metronome.preload(),
  ]);
}

/**
 * Dynamic import factory for plugins
 */
export function createPluginImport(pluginType: string) {
  return lazyWithPreload(
    () =>
      import(
        /* webpackChunkName: "[request]" */
        `./modules/instruments/plugins/${pluginType}`
      ),
  );
}
