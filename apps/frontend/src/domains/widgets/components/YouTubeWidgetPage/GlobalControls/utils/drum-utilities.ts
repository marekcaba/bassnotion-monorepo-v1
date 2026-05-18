/**
 * Drum Utilities
 *
 * Functions for drum type normalization and Tone.js access.
 * Used by the GlobalControls component for drum pattern playback.
 */

/**
 * Mapping of detailed drum types to simplified buffer keys.
 *
 * The DrumScheduler only has three buffer types: kick, snare, hihat.
 * This mapping normalizes all drum variations to these core sounds.
 */
const DRUM_TYPE_TO_BUFFER_KEY: Record<string, string> = {
  // Kick variants
  kick: 'kick',

  // Snare variants
  snare: 'snare',
  snare_rimshot: 'snare',
  clap: 'snare',

  // Hi-hat variants - ALL map to 'hihat'
  hihat: 'hihat',
  hihat_closed: 'hihat',
  hihat_open: 'hihat',
  hihat_pedal: 'hihat',

  // Cymbals fallback to hihat
  crash: 'hihat',
  crash_1: 'hihat',
  crash_2: 'hihat',
  ride: 'hihat',
  ride_bell: 'hihat',
  splash: 'hihat',

  // Toms fallback based on pitch
  tom_high: 'snare',
  tom_mid: 'snare',
  tom_low: 'kick',
  tom_1: 'snare',
  tom_2: 'snare',
  tom_3: 'kick',
  floor_tom: 'kick',
};

/**
 * Normalizes a drum type to its corresponding buffer key.
 *
 * The DrumScheduler only has three buffer types: kick, snare, hihat.
 * This function maps detailed drum types to these simplified keys
 * for proper audio playback.
 *
 * @param drumType - The detailed drum type (e.g., 'hihat_closed', 'tom_high')
 * @returns The normalized buffer key: 'kick', 'snare', or 'hihat'
 *
 * @example
 * normalizeDrumTypeToBufferKey('hihat_closed') // Returns 'hihat'
 * normalizeDrumTypeToBufferKey('tom_high') // Returns 'snare'
 * normalizeDrumTypeToBufferKey('floor_tom') // Returns 'kick'
 */
export function normalizeDrumTypeToBufferKey(drumType: string): string {
  return DRUM_TYPE_TO_BUFFER_KEY[drumType] || 'kick'; // Default to kick
}

/**
 * Gets the Tone.js instance from the window object.
 *
 * Tone.js is initialized by the AudioEngine and stored globally.
 * This helper provides type-safe access to the Tone namespace.
 *
 * @throws Error if Tone.js is not yet initialized
 * @returns The Tone.js module
 *
 * @example
 * const Tone = getTone();
 * const synth = new Tone.Synth().toDestination();
 */
export function getTone(): typeof import('tone') {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone =
      (window as unknown as { Tone?: typeof import('tone') }).Tone ||
      (window as unknown as { __globalTone?: typeof import('tone') })
        .__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error(
    'GlobalControls: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}
