/**
 * SoundTouchInsert — WSOLA time-stretch INSERT for the drum stem (LAUNCH-06).
 *
 * Why a separate adapter from {@link PitchShiftAdapter} (Signalsmith): drums
 * are transient-heavy, and a phase-vocoder (Signalsmith) softens percussive
 * attacks. WSOLA (SoundTouch) preserves them — pristine kick/snare transients
 * are the whole point of routing drums through this instead. Different engine,
 * different WASM, so it lives behind its own tiny adapter.
 *
 * Topology — unlike the bass/harmony buffer-streaming source (which IS the
 * source), this is an INSERT: the drum AudioBufferSourceNode plays as usual
 * and streams THROUGH the SoundTouch node:
 *
 *     drumSource → soundtouchNode → drumGain
 *
 * Time-stretch (tempo without pitch): set the SOURCE node's playbackRate to
 * the ratio R AND mirror R onto the node's `playbackRate` param. The processor
 * then divides pitch by R, cancelling the resampling pitch shift — so tempo
 * changes, pitch stays. `pitch`/`pitchSemitones` stay at unity (drums never
 * transpose). See SoundTouchNode docs:
 *   effectivePitch = (pitch * 2^(semitones/12)) / playbackRate
 *
 * The node is created once per stem and reused; R changes are k-rate param
 * writes. Lifecycle (silence/dispose) mirrors the pitch-shift adapter's
 * click-free discipline.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SoundTouchLogger {
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  debug(msg: string, data?: unknown): void;
}

/** Served worklet path (copied into public/ by scripts/copy-soundtouch-worklet.js). */
const SOUNDTOUCH_WORKLET_URL = '/worklets/soundtouch-processor.js';

/** Nominal WSOLA output latency (s) for the default overlapMs:6 / auto-sequence
 *  tuning, used to compensate bass/harmony when the drum insert is active.
 *  Calibrate by ear / cross-correlation against the direct drum; the live
 *  metric (framesBuffered) refines it once the insert has primed. */
const SOUNDTOUCH_NOMINAL_LATENCY_SECONDS = 0.05;

export class SoundTouchInsert {
  readonly library = 'soundtouch' as const;

  private SoundTouchNodeCtor:
    | (new (opts: {
        context: BaseAudioContext;
        outputChannelCount?: number;
      }) => AudioWorkletNode)
    | null = null;
  private registeredContexts = new WeakSet<BaseAudioContext>();

  constructor(private readonly log: SoundTouchLogger) {}

  /**
   * Load the module class + register the worklet processor for this context.
   * Idempotent per context. Resolves true on success; false (never throws)
   * means the drum stem should play un-stretched (graceful degrade).
   */
  async register(audioContext: AudioContext): Promise<boolean> {
    try {
      if (!this.SoundTouchNodeCtor) {
        const mod = await import('@soundtouchjs/audio-worklet');
        this.SoundTouchNodeCtor = (mod as any).SoundTouchNode ?? null;
        if (typeof this.SoundTouchNodeCtor !== 'function') {
          this.log.warn('SoundTouchNode export missing; drum stretch disabled');
          this.SoundTouchNodeCtor = null;
          return false;
        }
      }
      if (!this.registeredContexts.has(audioContext)) {
        await (this.SoundTouchNodeCtor as any).register(
          audioContext,
          SOUNDTOUCH_WORKLET_URL,
        );
        this.registeredContexts.add(audioContext);
      }
      this.log.info('SoundTouch worklet registered');
      return true;
    } catch (err) {
      this.log.warn('SoundTouch register failed; drum stretch disabled', err);
      return false;
    }
  }

  /**
   * Create a SoundTouch insert node and connect its OUTPUT to `gain`
   * (drumSource → node → gain — the caller connects the source to the node).
   * Pitch stays at unity; only tempo (playbackRate) is driven. Returns null
   * if not registered / construction fails.
   *
   * For pristine drum transients, WSOLA timing is tuned toward quick seeking
   * and a short overlap so attacks aren't doubled/flammed.
   */
  createInsert(audioContext: AudioContext, gain: AudioNode): AudioNode | null {
    if (!this.SoundTouchNodeCtor) {
      this.log.debug('SoundTouch not registered; deferring insert');
      return null;
    }
    try {
      const node = new this.SoundTouchNodeCtor({ context: audioContext });
      node.connect(gain);
      // Lock pitch at unity (drums never transpose); tempo handled via rate.
      const pitch = (node as any).parameters?.get?.('pitch');
      if (pitch) pitch.value = 1;
      const semis = (node as any).parameters?.get?.('pitchSemitones');
      if (semis) semis.value = 0;
      // Transient-friendly WSOLA tuning: quickSeek on, short overlap → keeps
      // percussive attacks crisp (vs the default which favours tonal pop/rock).
      try {
        (node as any).setStretchParameters?.({
          quickSeek: true,
          overlapMs: 6,
        });
      } catch {
        /* defaults are fine if tuning is unavailable */
      }
      return node as AudioNode;
    } catch (err) {
      this.log.warn('SoundTouch createInsert failed; drum plays dry', err);
      return null;
    }
  }

  /**
   * Set the time-stretch ratio R (tempo; 1 = original speed). The caller must
   * ALSO set the drum source node's playbackRate to the same R (the source
   * resamples; the node cancels the resulting pitch shift). Pitch unchanged.
   */
  setRate(node: AudioNode, rate: number): void {
    try {
      const pr = (node as any).parameters?.get?.('playbackRate');
      if (pr) pr.value = rate;
    } catch (err) {
      this.log.warn('SoundTouch setRate failed', err);
    }
  }

  /**
   * The insert's output latency in seconds — how long after a sample enters
   * the insert it emerges. The WSOLA processor buffers ~one sequence/overlap
   * window plus its output FIFO; it reports the live fill via
   * `node.metrics.framesBuffered`, but that's only posted every ~100 blocks
   * and is 0 before the insert primes. We therefore return a calibrated
   * nominal (empirically ~0.05s for the default overlapMs:6 / auto-sequence
   * tuning) and prefer the live metric only when it's a sane non-zero value.
   * Used by the engine to compensate bass/harmony so drums stay aligned when
   * the insert is in the path.
   */
  latencySeconds(node: AudioNode): number {
    try {
      const m = (node as any).metrics;
      const sr = (node as any).context?.sampleRate ?? 48000;
      if (m && typeof m.framesBuffered === 'number' && m.framesBuffered > 0) {
        const live = m.framesBuffered / sr;
        if (live > 0.005 && live < 0.5) return live;
      }
    } catch {
      /* fall through to nominal */
    }
    return SOUNDTOUCH_NOMINAL_LATENCY_SECONDS;
  }

  /** Silence the insert's output immediately (cut at stop, before dispose). */
  silenceNode(node: AudioNode): void {
    try {
      (node as any).disconnect?.();
    } catch {
      /* best-effort */
    }
    (node as any).__silenced = true;
  }

  /** Fully tear down the insert node. Idempotent, never throws. */
  disposeNode(node: AudioNode): void {
    try {
      (node as any).port && ((node as any).port.onmessage = null);
    } catch {
      /* best-effort */
    }
    try {
      (node as any).disconnect?.();
    } catch {
      /* best-effort */
    }
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export function createSoundTouchInsert(
  log: SoundTouchLogger,
): SoundTouchInsert {
  return new SoundTouchInsert(log);
}
