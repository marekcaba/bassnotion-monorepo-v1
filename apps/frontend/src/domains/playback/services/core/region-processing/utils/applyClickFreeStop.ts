/**
 * Shared click-free-stop gain ramp.
 *
 * Used by every stem-audio stop path (PlaybackEngine.stopAudioStems,
 * RegionScheduler.stopAllInfiniteAudio, AudioPlayerScheduler.stopStem) to
 * avoid the click that a hard `source.stop()` produces.
 *
 * The ramp is:
 *   - set gain to current value at `now` (snap, so any pending ramps end)
 *   - linearly ramp to 0 over `rampSeconds` (5ms by default)
 *   - restore gain to its pre-ramp resting value at `stopAt` so the cached
 *     gain node remains usable for the next playback. (Without the restore,
 *     re-using the same gain node — which the engine does — produces a
 *     silent next-play because the gain is pinned at 0.)
 *
 * Pure utility, no class state. Catches AudioParam errors and reports via
 * the optional `onError` callback so call sites can plug in their own
 * structured logger without this util importing one.
 */

const DEFAULT_RAMP_SECONDS = 0.005;
const POST_RAMP_PADDING = 0.001;

export interface ApplyClickFreeStopOptions {
  /** Length of the gain fade-out, in seconds. Default 5ms. */
  rampSeconds?: number;
  /** Hook for logging the AudioParam scheduling error if any. */
  onError?: (err: unknown) => void;
}

export interface ClickFreeStopResult {
  /** The audio-context time at which sources should call `.stop()`. */
  stopAt: number;
}

/**
 * Apply the click-free stop ramp to `gain`. Returns the audio-context
 * `stopAt` time the caller should pass to each source's `.stop(stopAt)`.
 */
export function applyClickFreeStop(
  gain: GainNode | null | undefined,
  audioContext: AudioContext | null | undefined,
  options: ApplyClickFreeStopOptions = {},
): ClickFreeStopResult {
  const rampSeconds = options.rampSeconds ?? DEFAULT_RAMP_SECONDS;
  const now = audioContext?.currentTime ?? 0;
  const stopAt = now + rampSeconds + POST_RAMP_PADDING;

  if (!audioContext || !gain) {
    return { stopAt };
  }

  try {
    const restingVolume = gain.gain.value;
    gain.gain.setValueAtTime(restingVolume, now);
    gain.gain.linearRampToValueAtTime(0, now + rampSeconds);
    gain.gain.setValueAtTime(restingVolume, stopAt);
  } catch (err) {
    options.onError?.(err);
  }

  return { stopAt };
}
