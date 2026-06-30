/**
 * droneStem — load the sustained backing DRONE for a scale as a pre-rendered audio stem,
 * the SAME way the groove card loads its bass/drums/harmony stems (fetch → decodeAudioData
 * → loop an AudioBufferSourceNode). No synth, no WAM piano: just an .ogg the engine loops.
 *
 * The stem is keyed by the drone CHORD SYMBOL the scale derives (A7, Cmaj7, Em7 …). The
 * library is stored by QUALITY subfolder (the exported drone bounces are organised that way):
 *   audio-samples/drones/{quality}/{symbol}.ogg   e.g. drones/maj7/Cmaj7.ogg, drones/7/A7.ogg
 * The quality is the suffix after the root pitch class; droneStemUrl parses it out and routes
 * to the right subfolder.
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

/** The chord QUALITY (suffix after the root, AS THE APP EMITS IT — sharps as '#') → its
 *  storage subfolder under drones/. Mirrors the exported drone library's folders. Note the
 *  subfolder values are '#'-FREE: Supabase Storage rejects '#' in object keys, so the upload
 *  replaces every '#' with 's' (in both folders AND filenames). A plain major triad (empty
 *  quality) → 'maj'. The two m11 voicings keep distinct subfolders. */
const QUALITY_SUBFOLDER: Record<string, string> = {
  '': 'maj', // plain major triad (e.g. "C")
  maj7: 'maj7',
  '7': '7',
  '7alt': '7alt',
  '13': '13',
  '13#11': '13s11', // # → s for the Supabase-safe folder name
  sus13: 'sus13',
  m: 'm',
  m7: 'm7',
  m9: 'm9',
  m11_1: 'm11-1',
  m11_2: 'm11-2',
};

/** Make a chord symbol a Supabase-Storage-safe key: '#' is invalid in object keys, so we
 *  replace it with 's' (the same "sharp" substitution the upload uses + chordParser's spelling
 *  convention). e.g. "C#m7" → "Csm7", "A13#11" → "A13s11". */
function storageSafe(s: string): string {
  return s.replace(/#/g, 's');
}

/** Split a chord symbol into its ROOT pitch class (A–G + optional #/b) and the QUALITY
 *  suffix. e.g. "Cmaj7"→{root:'C',quality:'maj7'}, "F#7"→{root:'F#',quality:'7'},
 *  "A#m11_1"→{root:'A#',quality:'m11_1'}, "G"→{root:'G',quality:''}. */
function splitChordSymbol(symbol: string): { root: string; quality: string } {
  const m = /^([A-Ga-g][#b]?)(.*)$/.exec(symbol);
  if (!m) return { root: symbol, quality: '' };
  return { root: m[1]!, quality: m[2]! };
}

/** Public URL for a drone chord symbol's stem, routed to its quality subfolder
 *  (drones/{quality}/{symbol}.ogg). The filename + folder are made Supabase-safe (# → s).
 *  Falls back to a flat drones/{symbol}.ogg for an unknown quality (so a new chord type still
 *  resolves once its folder is added here). */
export function droneStemUrl(chordSymbol: string): string {
  const { quality } = splitChordSymbol(chordSymbol);
  const subfolder = QUALITY_SUBFOLDER[quality];
  const file = `${encodeURIComponent(storageSafe(chordSymbol))}.ogg`;
  const path = subfolder ? `drones/${subfolder}/${file}` : `drones/${file}`;
  return `${BUCKET_BASE}/${path}`;
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
