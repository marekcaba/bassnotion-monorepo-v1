/**
 * DrumSlicePlayer — transient-preserving drum time-stretch (LAUNCH-06).
 *
 * The playback half of the Ableton "Beats"-style slicer. Given a looping drum
 * buffer and its DETECTED onset times (see detectOnsets), it plays the loop by
 * scheduling each slice [onset[i], onset[i+1]) as its OWN AudioBufferSourceNode
 * at playbackRate = 1 — so every drum hit's attack is BIT-EXACT (no WSOLA /
 * phase-vocoder smearing). Tempo change = re-space the slices: the inter-onset
 * GAPS scale by 1/ratio, but the hits themselves never change. Because slicing
 * follows the real onsets, the groove (shuffle, push/pull, ghost notes) is
 * preserved — it is NOT quantised to a grid.
 *
 *   - Slowing down (ratio<1): gaps widen; a slice plays its natural buffer
 *     length then rings out / is silent until the next onset (drums decay, so
 *     this is clean).
 *   - Speeding up (ratio>1): gaps shrink; the next slice can start before the
 *     previous ends — a short fade-out on the outgoing slice (the "Transient
 *     Envelope") keeps overlap of decaying tails benign.
 *   - Each slice gets a tiny fade-in/out at its cut points to avoid clicks at
 *     non-zero crossings.
 *
 * Driven by a look-ahead scheduler (the "Tale of Two Clocks" pattern): a timer
 * schedules only the slices whose start falls in the next look-ahead window, so
 * the live node count stays tiny regardless of how many onsets the loop has.
 */

export interface DrumSlicePlayerOptions {
  /** Look-ahead window (s): schedule slices starting within this of now. */
  scheduleAheadSeconds?: number;
  /** Timer tick (ms) for the look-ahead scheduler. */
  tickMs?: number;
  /** Slice fade-in (s) — declick the cut at the slice start. */
  fadeInSeconds?: number;
  /** Slice fade-out (s) — declick + the "Transient Envelope" for overlaps. */
  fadeOutSeconds?: number;
  /** Read a bit before the onset so the very front of the attack survives the
   *  fade-in. Trimmed from the previous slice's tail. */
  preRollSeconds?: number;
  /** The MUSICAL loop length (s) the drums must wrap on — same value
   *  bass/harmony loop on (the beat-grid length), which can be a hair SHORTER
   *  than the raw drum buffer. Looping on the raw buffer instead makes the
   *  drums fall ~bufferDur−loopDur behind every loop (a structural desync that
   *  worsens at faster tempos). Defaults to the buffer duration (no trim). */
  loopDurationSeconds?: number;
}

const DEFAULTS: Required<Omit<DrumSlicePlayerOptions, 'loopDurationSeconds'>> =
  {
    // Small look-ahead: only ~60ms of drum is committed to the audio clock ahead
    // of now, so a tempo change (which re-spaces from the next unscheduled slice)
    // takes effect within ~60ms — tight enough to stay locked to bass/harmony
    // even under rapid clicking. The 25ms tick refills it comfortably.
    scheduleAheadSeconds: 0.06,
    tickMs: 25,
    fadeInSeconds: 0.002,
    fadeOutSeconds: 0.012,
    preRollSeconds: 0.003,
  };

export class DrumSlicePlayer {
  private readonly ctx: AudioContext;
  private readonly buffer: AudioBuffer;
  private readonly output: AudioNode;
  private readonly onsets: number[];
  /** Raw PCM duration — used only for buffer-read BOUNDS, never for the loop. */
  private readonly bufferDuration: number;
  /** The MUSICAL loop length the drums wrap on (≤ bufferDuration). All loop /
   *  wrap / phase math uses THIS so drums stay locked to bass/harmony, which
   *  loop on the same musical length. */
  private readonly loopDuration: number;
  private readonly opt: Required<
    Omit<DrumSlicePlayerOptions, 'loopDurationSeconds'>
  >;

  private ratio = 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private timerId: any = null;
  private playing = false;

  /** Audio-context time at which the CURRENT loop iteration started. */
  private loopStartTime = 0;
  /** Index of the next slice to schedule within the loop. */
  private nextSlice = 0;
  /** Live slices (source + its envelope gain) so stop() can stop + tidy them. */
  private active = new Set<{ src: AudioBufferSourceNode; env: GainNode }>();

  constructor(
    ctx: AudioContext,
    buffer: AudioBuffer,
    onsets: number[],
    output: AudioNode,
    options: DrumSlicePlayerOptions = {},
  ) {
    this.ctx = ctx;
    this.buffer = buffer;
    this.output = output;
    this.bufferDuration = buffer.duration;
    const { loopDurationSeconds, ...rest } = options;
    // Wrap on the MUSICAL loop length (clamped to the buffer), defaulting to the
    // full buffer when not given. Onsets are clipped to this so the last slice
    // ends at the musical seam, not the buffer end.
    this.loopDuration =
      loopDurationSeconds != null && loopDurationSeconds > 0
        ? Math.min(loopDurationSeconds, this.bufferDuration)
        : this.bufferDuration;
    // Sanitize onsets: ascending, in [0, loopDuration), starting at 0.
    const cleaned = onsets
      .filter((t) => t >= 0 && t < this.loopDuration)
      .sort((a, b) => a - b);
    if (cleaned.length === 0 || cleaned[0]! > 1e-4) cleaned.unshift(0);
    this.onsets = cleaned;
    this.opt = { ...DEFAULTS, ...rest };
  }

  /** The real-time loop period at the current ratio (on the MUSICAL loop). */
  private get loopPeriod(): number {
    return this.loopDuration / (this.ratio || 1);
  }

  /** Onset time (s) for slice i; the wrap sentinel is the MUSICAL loop end. */
  private onsetAt(i: number): number {
    return i < this.onsets.length ? this.onsets[i]! : this.loopDuration;
  }

  /**
   * Set the stretch ratio (1 = original) with PHASE CONTINUITY — the loop's
   * current playback position is preserved across the change (it just plays
   * faster/slower from here), exactly like signalsmith's read-head. Without
   * this re-anchor the next slice would jump (the old `loopStartTime` anchor
   * was computed for the old period), drifting drums off bass/harmony on every
   * click of a rapid tempo drag.
   *
   * `atTime` (default now) is the instant the new rate takes effect — pass the
   * SAME shared time the engine uses for bass/harmony so all three pivot
   * together. We re-anchor `loopStartTime` so the next-to-schedule slice keeps
   * its real-time position at `atTime`; everything after it is spaced at the
   * new ratio.
   */
  setRatio(ratio: number, atTime?: number): void {
    const newRatio = ratio > 0 ? ratio : 1;
    if (this.playing && newRatio !== this.ratio && newRatio > 0) {
      // Re-anchor for phase continuity AT THE SHARED PIVOT TIME `atTime` — the
      // SAME instant the engine applies the bass/harmony rate change. This is
      // critical: if the drums pivot at a different time than bass/harmony,
      // every tempo change injects (drumPivot − atTime) of phase error, which
      // accumulates over many clicks and reverses on a sweep-back (the
      // tempo-dependent desync). Keep the loop INPUT position continuous at
      // `atTime`: position = (atTime − loopStartTime)·oldRatio; choose a new
      // loopStartTime so the same position holds under newRatio at `atTime`.
      const pivot = atTime ?? this.ctx.currentTime;
      const inputPos = (pivot - this.loopStartTime) * this.ratio;
      this.loopStartTime = pivot - inputPos / newRatio;
    }
    this.ratio = newRatio;
  }

  /** Start looping at audio time `when` (default: now). */
  start(when?: number): void {
    if (this.playing) return;
    this.playing = true;
    this.loopStartTime = when ?? this.ctx.currentTime;
    this.nextSlice = 0;
    this.scheduleTick();
    this.timerId = setInterval(() => this.scheduleTick(), this.opt.tickMs);
  }

  /**
   * Stop all playback at `when` (default: now). Hard-stops the live slice
   * sources — click-safety is the caller's responsibility: the PlaybackEngine
   * stops the drum stem via its MASTER BUS, calling this only AFTER the master
   * has faded to 0, so any mid-buffer truncation here is silent. (Per-slice or
   * per-player fades were tried and removed — they couldn't beat the
   * engine→audio-thread latency that landed truncations at full amplitude; the
   * master-bus fade sidesteps it entirely.)
   */
  stop(when?: number): void {
    this.playing = false;
    if (this.timerId != null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    const stopAt = when ?? this.ctx.currentTime;
    for (const { src } of this.active) {
      try {
        src.stop(stopAt);
      } catch {
        /* already stopped */
      }
    }
    this.active.clear();
  }

  /** Schedule every slice whose start falls within the look-ahead window. */
  private scheduleTick(): void {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    const horizon = now + this.opt.scheduleAheadSeconds;

    // Schedule forward until the next slice's start is beyond the horizon.
    // Bounded so a pathological ratio can't spin (≤ a few hundred per tick).
    let guard = 0;
    while (guard++ < 512) {
      const period = this.loopPeriod;
      const sliceStartReal =
        this.loopStartTime + this.onsetAt(this.nextSlice) / (this.ratio || 1);
      if (sliceStartReal > horizon) break;

      this.scheduleSlice(this.nextSlice, sliceStartReal);

      this.nextSlice++;
      if (this.nextSlice >= this.onsets.length) {
        // Wrap to the next loop iteration.
        this.nextSlice = 0;
        this.loopStartTime += period;
      }
    }
  }

  /** Create + schedule one slice source with a declick/overlap envelope. */
  private scheduleSlice(index: number, startReal: number): void {
    const onset = this.onsetAt(index);
    const nextOnset = this.onsetAt(index + 1);
    // Buffer region this slice covers. Read a little before the onset so the
    // attack front survives the fade-in; clamp to the buffer.
    const readStart = Math.max(0, onset - this.opt.preRollSeconds);
    const sliceBufferDur = Math.max(0.001, nextOnset - readStart);

    // Don't schedule in the past (timer jitter).
    const when = Math.max(this.ctx.currentTime, startReal);

    // The slice itself: bit-exact transient + natural tail (up to the next
    // onset). fade-in declick, fade-out declick/overlap envelope.
    this.playBuffer(
      this.buffer,
      when,
      readStart,
      sliceBufferDur,
      this.opt.fadeInSeconds,
      this.opt.fadeOutSeconds,
    );
  }

  /**
   * Schedule one AudioBufferSource → env(GainNode) → output with a trapezoidal
   * declick envelope, registered in `active` for stop()/teardown. Shared by the
   * slice and the sustain fill so both honour the master-bus stop discipline.
   */
  private playBuffer(
    buffer: AudioBuffer,
    when: number,
    offset: number,
    duration: number,
    fadeIn: number,
    fadeOut: number,
  ): void {
    let src: AudioBufferSourceNode;
    let env: GainNode;
    try {
      src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = 1; // BIT-EXACT — the whole point.
      env = this.ctx.createGain();
      src.connect(env);
      env.connect(this.output);
    } catch {
      return;
    }

    const audibleEnd = when + duration;
    const foutStart = Math.max(when + fadeIn, audibleEnd - fadeOut);
    try {
      const g = env.gain;
      g.setValueAtTime(0, when);
      g.linearRampToValueAtTime(1, when + fadeIn);
      g.setValueAtTime(1, foutStart);
      g.linearRampToValueAtTime(0, audibleEnd);
    } catch {
      /* if the param schedule fails, it still plays at unity */
    }

    try {
      // start(when, offset, duration) — play exactly this region.
      src.start(when, offset, duration + 0.001);
    } catch {
      try {
        env.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }

    const entry = { src, env };
    this.active.add(entry);
    src.addEventListener('ended', () => {
      this.active.delete(entry);
      try {
        env.disconnect();
      } catch {
        /* ignore */
      }
    });
  }
}
