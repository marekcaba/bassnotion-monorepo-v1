/**
 * Pitch + time-stretch engine adapter (LAUNCH-02.5f; buffer-streaming
 * time-stretch added in LAUNCH-06).
 *
 * The PlaybackEngine couples to its Signalsmith engine in a few places:
 *
 *   1. one-time worklet registration per AudioContext,
 *   2. constructing a per-stem BUFFER-STREAMING node (the node plays its own
 *      buffer and self-loops — it IS the source for bass/harmony),
 *   3. driving that node's pitch (semitones) AND tempo (rate) independently,
 *   4. starting/stopping it at transport-aligned times, plus stop/dispose.
 *
 * {@link PitchShiftAdapter} is the contract. The sole implementation is
 * {@link SignalsmithAdapter}, wrapping `signalsmith-stretch`: it self-injects
 * its worklet (no served file), constructs the node via the async factory,
 * loads PCM via `addBuffers`, and drives pitch+tempo via
 * `schedule({ semitones, rate, loopStart, loopEnd, formantCompensation })`
 * with per-stem profiles (see {@link SIGNALSMITH_PROFILES}). Formant
 * compensation is always on — that's what keeps shifts free of "chipmunk"
 * colouration. Buffer-streaming mode (input disconnected) is what makes the
 * `rate` field do true pitch-independent time-stretch.
 *
 * Drums are NOT handled here — they stretch via a separate WSOLA insert
 * (see SoundTouchInsert.ts) to keep percussive transients pristine.
 */

/**
 * Which per-stem tuning profile a node should use. Bass and harmony have
 * very different spectra (bass: single low fundamental ~40–150 Hz;
 * harmony: polyphonic, no single fundamental), so Signalsmith gets
 * different formant/block settings per stem. Anything else falls back to
 * the harmony (general-purpose) profile.
 */
export type PitchStemProfile = 'bass' | 'harmony';

/**
 * Per-stem Signalsmith tuning (LAUNCH-02.5f). "Balanced" voicing:
 * good quality with `splitComputation` on as a safety net against
 * audio-thread CPU spikes (important on mobile Safari).
 *
 * Drivers, per stem:
 *  - formantBaseHz: the rough fundamental the formant analyzer assumes.
 *    Bass gets an explicit low value so it preserves low-end body instead
 *    of letting auto-tracking wander on the bass line. Harmony is
 *    polyphonic — no single fundamental — so 0 (auto pitch-track) is
 *    correct.
 *  - blockMs: analysis window. Bass (sustained, tonal) likes a LARGER
 *    window for a smoother shift; harmony also benefits from a larger
 *    window to keep chords coherent. Both stay modest to cap latency/CPU.
 *  - tonalityHz: above this, content is treated as air/noise rather than
 *    tonal. Defaults (8000) are fine for both here.
 *
 * These are deliberately conservative starting points — tune by ear and
 * adjust the constants; there's no runtime override knob (hardcoded
 * defaults per the A/B decision).
 */
interface SignalsmithStemProfile {
  /** schedule() fields applied at splice + on every setSemitones. */
  formantCompensation: boolean;
  formantBaseHz: number;
  tonalityHz?: number;
  /** configure() fields applied once at construction. */
  blockMs: number;
  splitComputation: boolean;
}

const SIGNALSMITH_PROFILES: Record<PitchStemProfile, SignalsmithStemProfile> = {
  bass: {
    formantCompensation: true,
    // Explicit low fundamental: anchors formant analysis to the bass
    // register so the body/weight stays put under the shift.
    formantBaseHz: 90,
    tonalityHz: 8000,
    // Larger window → smoother on a sustained, single-note bass line.
    blockMs: 140,
    splitComputation: true,
  },
  harmony: {
    formantCompensation: true,
    // Polyphonic — let Signalsmith pitch-track rather than assume one
    // fundamental (0 = auto).
    formantBaseHz: 0,
    tonalityHz: 8000,
    // Slightly smaller than bass: chords have more movement; keeps it
    // from smearing while still coherent.
    blockMs: 120,
    splitComputation: true,
  },
};

export interface PitchShiftAdapter {
  /** Stable id for logging. */
  readonly library: 'signalsmith';

  /**
   * Register the worklet processor once per AudioContext. Resolves true
   * on success; false (never throws) means "engine unavailable" and the
   * caller falls back to dry playback. Idempotent per context.
   */
  register(audioContext: AudioContext): Promise<boolean>;

  /**
   * Construct a BUFFER-STREAMING node: the engine plays `channelData`
   * itself (it IS the source — nothing connects to its input) and loops
   * the whole buffer internally. This is the mode that does true
   * pitch-independent time-stretch: {@link setRate} changes tempo,
   * {@link setSemitones} changes pitch, independently.
   *
   * Connects the node's output to `output` (node → gain). The buffer is
   * loaded and the node armed (active, looping [0, bufferDuration]) but NOT
   * started — the caller drives playback via {@link startBufferStreaming}
   * at a scheduled audio time so it aligns with the transport.
   *
   * Returns null if the engine isn't registered or construction fails.
   */
  createBufferStreamingNode(
    audioContext: AudioContext,
    output: AudioNode,
    channelData: Float32Array[],
    bufferDuration: number,
    stemProfile: PitchStemProfile,
    initialSemitones?: number,
  ): AudioNode | null;

  /**
   * Start a buffer-streaming node (from {@link createBufferStreamingNode})
   * at audio time `when`, reading from buffer offset `offsetSeconds`.
   * No-op / queued if the node hasn't resolved yet. Never throws.
   */
  startBufferStreaming(
    node: AudioNode,
    when: number,
    offsetSeconds: number,
  ): void;

  /**
   * Stop a buffer-streaming node's playback at audio time `when` (the
   * worklet stops producing output). Does NOT tear the node down — the
   * owner still calls {@link disposeNode} afterwards. Never throws.
   */
  stopBufferStreaming(node: AudioNode, when: number): void;

  /**
   * Set the time-stretch ratio (tempo; 1 = original speed) on a
   * buffer-streaming node, independent of pitch. When `applyAtAudioTime`
   * is in the future the change is scheduled at that boundary. Never throws.
   */
  setRate(
    node: AudioNode,
    rate: number,
    audioContext: AudioContext,
    applyAtAudioTime?: number,
  ): void;

  /**
   * Apply a semitone offset to a node previously returned by
   * {@link createBufferStreamingNode}. When `applyAtAudioTime` is in the
   * future the change is scheduled sample-accurately at that time (next
   * loop boundary); otherwise it applies immediately. Never throws.
   */
  setSemitones(
    node: AudioNode,
    semitones: number,
    audioContext: AudioContext,
    applyAtAudioTime?: number,
  ): void;

  /**
   * End-to-end processing latency in seconds, used to delay the dry
   * stems (drums/click) so they stay in sync with the pitched ones.
   * Signalsmith reports its own latency via `node.latency()` — pass the
   * node to read the live value, or omit for the engine's nominal default.
   */
  latencySeconds(node?: AudioNode): number;

  /**
   * Silence a node's output synchronously at stop time, BEFORE the
   * deferred {@link disposeNode}. The engine calls this at t=0 on stop so
   * the worklet's residual-buffer flush (which happens ~latency ms later,
   * during disposal) passes through a muted node instead of an
   * already-restored instrument gain — killing the ~140ms stop spike.
   * Never throws.
   */
  silenceNode(node: AudioNode, audioContext: AudioContext): void;

  /**
   * Fully tear down a node from {@link createBufferStreamingNode}, including
   * any engine-internal nodes it owns that the caller can't see.
   *
   * This MUST exist as a distinct method (not just `node.disconnect()`)
   * because the node the caller holds may be a thin relay in front of the
   * real engine node — e.g. Signalsmith's async splice puts the live
   * worklet (`sg`) BEHIND the relay. A blind `relay.disconnect()` leaves
   * `sg` running and still connected to the instrument gain, so every
   * play would leak one live worklet into the shared gain — the
   * accumulating "spike after N plays" bug. `disposeNode` stops and
   * disconnects the whole sub-graph. Idempotent, never throws.
   */
  disposeNode(node: AudioNode): void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Signalsmith — the pitch-shift engine. Phase-vocoder, formant-preserving.
// ---------------------------------------------------------------------------

/**
 * Nominal latency used before a node exists / if `node.latency()` is
 * unavailable. Signalsmith reports its true latency per-node, which the engine
 * reads via {@link SignalsmithAdapter.latencySeconds}; this is the bootstrap
 * fallback used to SEED the drum compensation DelayNode before the exact value
 * resolves. Set to the EMPIRICALLY MEASURED value (~0.175s for the bass/harmony
 * blockMs 120–140 profiles; cross-correlation of rendered audio) so the seed is
 * already correct and the async refine doesn't jump the drum timing.
 */
const SIGNALSMITH_NOMINAL_LATENCY_SECONDS = 0.13;

export class SignalsmithAdapter implements PitchShiftAdapter {
  readonly library = 'signalsmith' as const;

  // The factory both registers the worklet AND builds a node, so there's
  // no separate register step. We keep the imported factory hot after
  // first use; per-node construction is async, so the engine's sync
  // createBufferStreamingNode() kicks off construction and back-fills the
  // node (via a relay) when the promise resolves.
  private factory:
    | ((ctx: AudioContext, opts?: AudioWorkletNodeOptions) => Promise<any>)
    | null = null;
  private registered = false;

  constructor(private readonly log: PitchShiftLogger) {}

  async register(_audioContext: AudioContext): Promise<boolean> {
    try {
      const mod = await import('signalsmith-stretch');
      // ESM default export is the factory function.
      this.factory = (mod.default ?? (mod as any)) as typeof this.factory;
      if (typeof this.factory !== 'function') {
        this.log.warn('signalsmith-stretch default export is not a factory');
        this.factory = null;
        return false;
      }
      this.registered = true;
      this.log.info('Signalsmith stretch module loaded');
      return true;
    } catch (err) {
      this.log.warn(
        'signalsmith-stretch load failed; pitch shifting disabled',
        err,
      );
      return false;
    }
  }

  createBufferStreamingNode(
    audioContext: AudioContext,
    output: AudioNode,
    channelData: Float32Array[],
    bufferDuration: number,
    stemProfile: PitchStemProfile,
    initialSemitones = 0,
  ): AudioNode | null {
    if (!this.registered || !this.factory) {
      this.log.debug(
        'Signalsmith not registered; deferring buffer-stream node',
      );
      return null;
    }
    if (!channelData.length || bufferDuration <= 0) {
      this.log.warn('createBufferStreamingNode: empty buffer; skipping');
      return null;
    }

    const profile =
      SIGNALSMITH_PROFILES[stemProfile] ?? SIGNALSMITH_PROFILES.harmony;

    // Async splice: the factory is async but this method is sync, so we
    // hand back a relay GainNode immediately and back-fill the worklet when
    // it resolves. The worklet is the SOURCE (it plays its own buffer), so
    // there is NO upstream input to connect — that disconnected input is
    // precisely what selects buffer-streaming mode (a connected input would
    // flip the WASM back to live-input and ignore rate/loop). The relay
    // gives the engine a stable AudioNode to wire into the stem gain
    // immediately; once the worklet resolves we route sg → relay → output.
    // Until then the relay is silent (correct — nothing is playing
    // pre-start anyway).
    const relay = audioContext.createGain();
    relay.gain.value = 1;
    try {
      relay.connect(output);
    } catch (err) {
      this.log.warn(
        'Signalsmith buffer-stream relay → gain connect failed',
        err,
      );
      return null;
    }

    this.factory(audioContext, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [Math.min(2, Math.max(1, channelData.length))],
    })
      .then(async (sg: any) => {
        try {
          if ((relay as any).__disposed) {
            try {
              sg.stop?.();
            } catch {
              /* ignore */
            }
            try {
              sg.disconnect?.();
            } catch {
              /* ignore */
            }
            return;
          }

          // CRITICAL: do NOT connect anything to sg's input — keeping the
          // input disconnected is what selects buffer-streaming mode.
          sg.connect(relay);

          try {
            sg.configure?.({
              blockMs: profile.blockMs,
              splitComputation: profile.splitComputation,
            });
          } catch (cfgErr) {
            this.log.warn(
              'Signalsmith buffer-stream configure failed; defaults',
              cfgErr,
            );
          }

          // Load the stem PCM into the worklet's internal buffer.
          try {
            await sg.addBuffers?.(channelData);
          } catch (bufErr) {
            this.log.warn(
              'Signalsmith addBuffers failed; staying silent',
              bufErr,
            );
            return;
          }

          // Arm INACTIVE: configure the loop + initial pitch/formant + any
          // pending rate, but keep the node SILENT (active:false) until the
          // scheduler calls startBufferStreaming() at the transport-aligned
          // T0. CRITICAL: scheduling active:true here (with no output time)
          // would activate the worklet at currentTime — i.e. play the stem
          // immediately on creation, during becomeActive(), before the
          // count-in. start() flips active:true at T0 and inherits these
          // loop/formant fields (signalsmith.schedule copies the latest
          // segment), so they only need to be set once here.
          const pendingSemis = (relay as any).__pendingSemitones;
          const semitones =
            typeof pendingSemis === 'number' ? pendingSemis : initialSemitones;
          const pendingRate = (relay as any).__pendingRate;
          const rate = typeof pendingRate === 'number' ? pendingRate : 1;
          sg.schedule?.({
            active: false,
            rate,
            semitones,
            formantCompensation: profile.formantCompensation,
            formantBaseHz: profile.formantBaseHz,
            tonalityHz: profile.tonalityHz,
            loopStart: 0,
            loopEnd: bufferDuration,
          });

          (relay as any).__signalsmith = sg;
          (relay as any).__profile = profile;
          (relay as any).__bufferStreaming = true;
          (relay as any).__bufferDuration = bufferDuration;
          (relay as any).__currentRate = rate;
          delete (relay as any).__pendingSemitones;
          delete (relay as any).__pendingRate;

          // Post inputTime (the read-head position) frequently so the visual
          // playhead — which reads it as the real audio clock — stays smooth.
          // ~120 Hz; the engine interpolates between posts with the audio clock.
          try {
            sg.setUpdateInterval?.(1 / 120);
          } catch {
            /* default interval is fine if unsupported */
          }

          // If start was requested before resolution, honor it now.
          const pendingStart = (relay as any).__pendingStart;
          if (pendingStart) {
            try {
              sg.start?.(pendingStart.when, pendingStart.offset);
            } catch (startErr) {
              this.log.warn('Signalsmith deferred start failed', startErr);
            }
            delete (relay as any).__pendingStart;
          }

          this.log.info('Signalsmith buffer-stream node ready', {
            stemProfile,
            semitones,
            rate,
            bufferDuration,
          });
        } catch (err) {
          this.log.warn('Signalsmith buffer-stream splice failed', err);
        }
      })
      .catch((err: unknown) => {
        this.log.warn('Signalsmith buffer-stream factory rejected', err);
      });

    return relay as AudioNode;
  }

  startBufferStreaming(
    node: AudioNode,
    when: number,
    offsetSeconds: number,
  ): void {
    const sg = (node as any).__signalsmith;
    if (!sg?.start) {
      // Not resolved yet — stash so the splice starts it on arrival.
      (node as any).__pendingStart = { when, offset: offsetSeconds };
      return;
    }
    try {
      sg.start(when, offsetSeconds);
    } catch (err) {
      this.log.warn('Signalsmith startBufferStreaming failed', err);
    }
  }

  stopBufferStreaming(node: AudioNode, when: number): void {
    const relay = node as any;
    const sg = relay.__signalsmith;
    if (!sg?.stop) {
      // Not resolved yet — cancel the queued start so it never plays.
      delete relay.__pendingStart;
      return;
    }
    try {
      sg.stop(when);
    } catch (err) {
      this.log.warn('Signalsmith stopBufferStreaming failed', err);
    }
  }

  setRate(
    node: AudioNode,
    rate: number,
    audioContext: AudioContext,
    applyAtAudioTime?: number,
  ): void {
    const sg = (node as any).__signalsmith;
    if (!sg?.schedule) {
      (node as any).__pendingRate = rate;
      return;
    }
    // Track the current rate so the playhead-phase interpolation advances at
    // the right speed between worklet inputTime posts.
    (node as any).__currentRate = rate;
    try {
      const change: Record<string, unknown> = { rate };
      if (
        typeof applyAtAudioTime === 'number' &&
        applyAtAudioTime > audioContext.currentTime
      ) {
        change.output = applyAtAudioTime;
      }
      sg.schedule(change);
    } catch (err) {
      this.log.warn('Signalsmith setRate schedule failed', err);
    }
  }

  setSemitones(
    node: AudioNode,
    semitones: number,
    audioContext: AudioContext,
    applyAtAudioTime?: number,
  ): void {
    const sg = (node as any).__signalsmith;
    if (!sg?.schedule) {
      // Signalsmith hasn't resolved yet — store the pending value so the
      // splice can apply it. Cheap: stash on the relay; the .then() above
      // already sets formant, and a subsequent setSemitones call after
      // resolution will land. For the very first tap before resolution we
      // re-read this on the next call. (In practice the module is cached
      // and resolves within a couple ms, well before the first key tap.)
      (node as any).__pendingSemitones = semitones;
      return;
    }
    try {
      // Carry the per-stem formant profile on every change — schedule()
      // changes don't inherit prior formant fields, so omitting these
      // would silently revert to engine defaults on each key tap.
      const profile: SignalsmithStemProfile | undefined = (node as any)
        .__profile;
      const change: Record<string, unknown> = {
        semitones,
        formantCompensation: profile?.formantCompensation ?? true,
        formantBaseHz: profile?.formantBaseHz ?? 0,
        tonalityHz: profile?.tonalityHz,
      };
      // schedule({output}) is latency-compensated; schedule the change at
      // the requested boundary, else apply now.
      if (
        typeof applyAtAudioTime === 'number' &&
        applyAtAudioTime > audioContext.currentTime
      ) {
        change.output = applyAtAudioTime;
      }
      sg.schedule(change);
    } catch (err) {
      this.log.warn('Signalsmith setSemitones schedule failed', err);
    }
  }

  latencySeconds(node?: AudioNode): number {
    const sg = node ? (node as any).__signalsmith : null;
    try {
      if (sg?.latency) {
        const l = sg.latency();
        if (typeof l === 'number' && l >= 0) return l;
      }
    } catch {
      /* fall through to nominal */
    }
    return SIGNALSMITH_NOMINAL_LATENCY_SECONDS;
  }

  /**
   * Silence the node's output IMMEDIATELY (synchronously, at stop time),
   * BEFORE the deferred {@link disposeNode} runs.
   *
   * TOPOLOGY (important — an earlier fix got this wrong): the splice is
   *   relay(input) → sg(worklet) → instrument gain
   * The WORKLET output goes STRAIGHT to the instrument gain; the relay is
   * UPSTREAM of the worklet. So silencing the relay does nothing about
   * audio already inside the worklet — that residual (~145ms of phase-
   * vocoder buffer) flushes `sg → gain` regardless. Measured: audio-bass
   * spike GROWING to 0.148 at ~172-180ms = the worklet draining into the
   * gain after stop.
   *
   * Fix: disconnect the WORKLET's output (`sg`) from the gain right now,
   * synchronously. The residual buffer then has nowhere to go — it never
   * reaches the speaker. We also stop the worklet so it quits processing.
   * Cutting sg→gain at t=0 is safe because the stem gain is already being
   * ramped to 0 by applyClickFreeStop over the same 5ms, so the cut lands
   * under cover of that fade. The relay is left connected to the (now
   * disconnected) sg; disposeNode tidies the rest later.
   */
  silenceNode(node: AudioNode, _audioContext: AudioContext): void {
    const relay = node as any;
    const sg = relay.__signalsmith;
    if (sg) {
      try {
        // Halt processing so no NEW residual is produced.
        sg.schedule?.({ active: false });
      } catch {
        /* best-effort */
      }
      try {
        // Cut the worklet's output from the instrument gain NOW so its
        // ~145ms residual buffer can't flush to the speaker.
        sg.disconnect?.();
      } catch {
        /* best-effort */
      }
      // Mark so disposeNode doesn't double-handle and the late-splice guard
      // knows this relay is being torn down.
      relay.__silenced = true;
    } else {
      // Worklet not spliced yet — mark so the async splice, when it
      // resolves, won't connect into the gain (handled in
      // createBufferStreamingNode's __disposed check; set that too for
      // belt-and-braces).
      relay.__disposed = true;
    }
  }

  disposeNode(node: AudioNode): void {
    const relay = node as any;
    // Mark disposed FIRST. If the async splice (.then in
    // createBufferStreamingNode) hasn't resolved yet, it reads this flag and
    // skips connecting a now-dead node into the gain — otherwise a late
    // splice would leak a live worklet into the shared instrument gain (the
    // spike-after-N-plays accumulation).
    relay.__disposed = true;

    // Tear down the real Signalsmith worklet if it already spliced in.
    const sg = relay.__signalsmith;
    if (sg) {
      try {
        sg.stop?.();
      } catch {
        /* best-effort */
      }
      try {
        // schedule({active:false}) halts processing so a residual buffer
        // doesn't get pushed when the graph is rewired on the next play.
        sg.schedule?.({ active: false });
      } catch {
        /* best-effort */
      }
      try {
        sg.disconnect?.();
      } catch {
        /* best-effort */
      }
    }

    // Disconnect the relay itself (relay → sg and relay → gain, whichever
    // it currently holds).
    try {
      relay.disconnect?.();
    } catch {
      /* best-effort */
    }

    // Drop expando references so nothing keeps the worklet alive.
    relay.__signalsmith = undefined;
    relay.__profile = undefined;
    relay.__pendingSemitones = undefined;
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface PitchShiftLogger {
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  debug(msg: string, data?: unknown): void;
}

export function createPitchShiftAdapter(
  log: PitchShiftLogger,
): PitchShiftAdapter {
  return new SignalsmithAdapter(log);
}
