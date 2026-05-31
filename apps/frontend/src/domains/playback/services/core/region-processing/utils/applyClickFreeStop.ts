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
  /**
   * The gain node's known resting volume (0..1). When provided, this is the
   * value the node is restored to AFTER the fade — instead of re-reading the
   * live `gain.gain.value`. Pass this whenever the caller knows the canonical
   * resting level (e.g. PlaybackEngine's per-instrument volume), because the
   * live read is unreliable: if a PRIOR click-free stop's fade-to-0 ramp is
   * still in flight, `gain.gain.value` returns the mid-ramp value (≈0), and
   * restoring to that pins the node silent for every subsequent play. That is
   * exactly the "rapid play/stop drops a stem" failure mode. Omitting it falls
   * back to the live read, floored so a mid-ramp ≈0 can't pin the node silent.
   */
  restingVolume?: number;
}

// Below this, a "resting volume" read from a live AudioParam is treated as a
// mid-ramp artifact rather than a real resting level. Real stem volumes are
// >= ~0.05; a fade-to-0 ramp is the only thing that parks the value here.
const MIN_TRUSTWORTHY_RESTING = 0.01;

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
    // Resolve the volume to restore to AFTER the fade, in priority order:
    //   1. The caller-supplied canonical resting volume (most authoritative).
    //   2. A `__restingVolume` stamp the engine writes onto the gain node
    //      whenever it sets volume/mute (see PlaybackEngine). This is the
    //      effective resting level (muted ⇒ 0) and is ALWAYS correct
    //      regardless of any in-flight ramp — it's what closes the cumulative
    //      decay: across many stop/transpose reps the live AudioParam can be
    //      read mid-ramp (≈0) and re-pinned lower each time, ratcheting the
    //      stem quieter until a page reload. The stamp removes that dependence.
    //   3. Fallback: read the live value but FLOOR it — a mid-ramp read during
    //      a prior fade-to-0 would otherwise capture ≈0 and pin the node
    //      silent. Below the trust threshold we assume unity rather than
    //      silence (audibly safe; never leaves a stem stuck at 0).
    const stamped = (gain as { __restingVolume?: number }).__restingVolume;
    const liveValue = gain.gain.value;
    const restingVolume =
      options.restingVolume ??
      (typeof stamped === 'number'
        ? stamped
        : liveValue >= MIN_TRUSTWORTHY_RESTING
          ? liveValue
          : 1);
    // Cancel any in-flight automation (e.g. a prior stop's fade still running)
    // so our ramp + restore replace it cleanly instead of interleaving on the
    // same timeline — overlapping triples were what made the corruption sticky.
    // Optional-chained so unit mocks that omit cancelScheduledValues don't
    // divert the rest of the schedule into the catch.
    gain.gain.cancelScheduledValues?.(now);
    gain.gain.setValueAtTime(restingVolume, now);
    gain.gain.linearRampToValueAtTime(0, now + rampSeconds);
    gain.gain.setValueAtTime(restingVolume, stopAt);
  } catch (err) {
    options.onError?.(err);
  }

  return { stopAt };
}
