/**
 * Pitch-shift engine selector (LAUNCH-02.5f).
 *
 * Picks which pitch-shift engine the PlaybackEngine constructs for the
 * groove-card key stepper, for EVERY groove-card surface (waitlist, /app,
 * admin preview, tutorial editor — they all go through the same engine).
 * Two engines exist behind a common adapter ({@link PitchShiftAdapter}):
 *
 *   - 'signalsmith' — `signalsmith-stretch`, phase-vocoder with formant
 *                     preservation + our per-stem bass/harmony profiles.
 *                     THE DEFAULT as of the A/B win: kills the WSOLA
 *                     "chipmunk" colouration and cleans up transients.
 *   - 'soundtouch'  — `@soundtouchjs/audio-worklet`, WSOLA time-domain.
 *                     The previous engine; kept behind the `?pitch=`
 *                     override so we can still A/B back to it if a
 *                     regression surfaces.
 *
 * Selection precedence (highest first):
 *   1. `?pitch=soundtouch` / `?pitch=signalsmith` URL query param — flips
 *      the engine live per-tab without a rebuild (A/B the SAME groove
 *      card, or fall back to SoundTouch on a specific device).
 *   2. `NEXT_PUBLIC_PITCH_LIB` env var — overrides the default for a build.
 *   3. Hard default: 'signalsmith'.
 *
 * Read once per engine init (it's cheap and the query param can't change
 * mid-session anyway). SSR-safe: when `window` is absent we fall back to
 * the env var / default.
 */

export type PitchShiftLibrary = 'soundtouch' | 'signalsmith';

const DEFAULT_LIBRARY: PitchShiftLibrary = 'signalsmith';

function isPitchShiftLibrary(value: unknown): value is PitchShiftLibrary {
  return value === 'soundtouch' || value === 'signalsmith';
}

/**
 * Resolve the active pitch-shift engine for this session. See module
 * docstring for precedence. Safe to call on the server (returns the env
 * default; the URL param only applies in the browser).
 */
export function resolvePitchShiftLibrary(): PitchShiftLibrary {
  // 1. URL query param — browser only, wins so you can A/B live.
  if (typeof window !== 'undefined') {
    try {
      const param = new URLSearchParams(window.location.search).get('pitch');
      if (isPitchShiftLibrary(param)) return param;
    } catch {
      // location/URL unavailable (some embed sandboxes) — fall through.
    }
  }

  // 2. Build-time env default. NEXT_PUBLIC_ is inlined at build, so this
  //    is a literal string by the time it runs.
  const envValue = process.env.NEXT_PUBLIC_PITCH_LIB;
  if (isPitchShiftLibrary(envValue)) return envValue;

  // 3. Known-good default.
  return DEFAULT_LIBRARY;
}
