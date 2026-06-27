/**
 * droneStem — load the sustained backing DRONE for a scale as a pre-rendered audio stem,
 * the SAME way the groove card loads its bass/drums/harmony stems (fetch → decodeAudioData
 * → loop an AudioBufferSourceNode). No synth, no WAM piano: just an .ogg the engine loops.
 *
 * The stem is keyed by the drone CHORD SYMBOL the scale derives (A7, Cmaj7, Em7 …), at:
 *   audio-samples/drones/{symbol}.ogg
 *
 * GRACEFUL DEGRADATION: the drone files are produced + uploaded separately. Until a given
 * symbol's .ogg exists, the fetch 404s and we return null — playback proceeds WITHOUT a
 * drone (the scale notes + metronome still sound). The moment the file is uploaded, the
 * drone appears with no code change.
 */

import { getLogger } from '@/utils/logger.js';

const logger = getLogger('ScalesDroneStem');

// Same bucket convention as the groove stems (waitlistGrooveCard.config.ts).
const SUPABASE_PROJECT_REF = 'iuuplfrktnzsbzibpfjm';
const BUCKET_BASE = `https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public/audio-samples`;

/** Public URL for a drone chord symbol's stem. Symbols are filename-safe (letters,
 *  digits, '#'/'b' are the only specials; we encode to be safe). */
export function droneStemUrl(chordSymbol: string): string {
  return `${BUCKET_BASE}/drones/${encodeURIComponent(chordSymbol)}.ogg`;
}

// Decoded-buffer cache keyed by symbol, so re-selecting a key doesn't re-download. A
// null entry means "we tried and it isn't there" (don't re-fetch a known-missing file).
const cache = new Map<string, AudioBuffer | null>();

/**
 * Fetch + decode the drone stem for a chord symbol. Returns the AudioBuffer, or null if
 * the file doesn't exist (404) or fails to load/decode — the caller treats null as
 * "no drone this round" and plays on.
 */
export async function loadDroneStem(
  chordSymbol: string,
  audioContext: AudioContext,
): Promise<AudioBuffer | null> {
  if (cache.has(chordSymbol)) return cache.get(chordSymbol)!;

  try {
    const res = await fetch(droneStemUrl(chordSymbol));
    if (!res.ok) {
      // 404 = stem not produced yet. Expected during rollout; log once, cache the miss.
      logger.info(
        `No drone stem for "${chordSymbol}" (${res.status}); playing dry.`,
      );
      cache.set(chordSymbol, null);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    cache.set(chordSymbol, buffer);
    return buffer;
  } catch (err) {
    logger.warn(`Drone stem "${chordSymbol}" failed to load`, err);
    cache.set(chordSymbol, null);
    return null;
  }
}

/** Test/HMR seam: forget cached buffers + misses. */
export function clearDroneStemCache(): void {
  cache.clear();
}
