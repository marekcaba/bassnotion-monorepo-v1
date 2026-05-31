/**
 * Pitch-shift engine adapter (LAUNCH-02.5f A/B).
 *
 * The PlaybackEngine's key-stepper only couples to its pitch-shift
 * library in three places:
 *
 *   1. one-time worklet registration per AudioContext,
 *   2. constructing the per-stem AudioWorkletNode, and
 *   3. writing a semitone offset onto that node.
 *
 * Plus a fixed end-to-end latency it compensates for on the dry
 * (drums/click) stems. Everything else — routing through
 * AudioPlayerScheduler, the silent pre-warm loop, gain wiring, stop/
 * dispose — operates on a plain `AudioNode` and is engine-agnostic.
 *
 * This module hides those three coupling points behind
 * {@link PitchShiftAdapter} so the engine can be swapped at runtime
 * (see {@link resolvePitchShiftLibrary}) without forking PlaybackEngine.
 *
 *   SoundTouchAdapter  — wraps `@soundtouchjs/audio-worklet` exactly as
 *                        the engine used it before the A/B: registers the
 *                        served processor file, constructs SoundTouchNode,
 *                        locks the WSOLA stretch params, writes the
 *                        `pitchSemitones` AudioParam.
 *
 *   SignalsmithAdapter — wraps `signalsmith-stretch`. Self-injects its
 *                        worklet (no served file), constructs the node via
 *                        the async factory, and drives pitch via
 *                        `schedule({ semitones, formantCompensation })`.
 *                        Formant compensation is ON — that's the whole
 *                        point of trialling it (no "chipmunk").
 *
 * Both return real native AudioWorkletNodes, so the downstream
 * `source → node → gain` routing is identical.
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
  /** Stable id for logging / the `?pitch=` toggle. */
  readonly library: 'soundtouch' | 'signalsmith';

  /**
   * Register the worklet processor once per AudioContext. Resolves true
   * on success; false (never throws) means "engine unavailable" and the
   * caller falls back to dry playback. Idempotent per context.
   */
  register(audioContext: AudioContext): Promise<boolean>;

  /**
   * Construct one pitch-shift node for a stem and connect it to `gain`
   * (source → node → gain). Returns null if the engine isn't registered
   * or construction fails — caller plays the stem dry.
   *
   * `stemProfile` selects per-stem tuning ('bass' vs 'harmony'): bass and
   * harmony have very different spectra, so Signalsmith gets different
   * formant/block settings per stem. SoundTouch ignores it (its WSOLA
   * params are stem-agnostic). The returned node is a native
   * AudioWorkletNode; the caller owns its lifecycle (pre-warm, disconnect).
   */
  createNode(
    audioContext: AudioContext,
    gain: AudioNode,
    stemProfile: PitchStemProfile,
  ): AudioNode | null;

  /**
   * Apply a semitone offset to a node previously returned by
   * {@link createNode}. When `applyAtAudioTime` is in the future the
   * change is scheduled sample-accurately at that time (next loop
   * boundary); otherwise it applies immediately. Never throws.
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
   * SoundTouch is a fixed measured constant; Signalsmith reports its own
   * via `node.latency()` — pass the node to read the live value, or omit
   * for the engine's nominal default.
   */
  latencySeconds(node?: AudioNode): number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// SoundTouch — the shipped default. Behaviour preserved bit-for-bit from
// the inline code that used to live in PlaybackEngine.
// ---------------------------------------------------------------------------

/**
 * Measured WSOLA end-to-end latency at the locked stretch params
 * (sequenceMs 110 + seekWindowMs 23 + overlapMs 8 @ tempo 1.0). Tunable
 * by ear at runtime via `window.__SOUNDTOUCH_LATENCY_OVERRIDE_SECONDS`
 * (read by the engine's DelayNode code, not here).
 */
const SOUNDTOUCH_LATENCY_SECONDS = 0.14;

export class SoundTouchAdapter implements PitchShiftAdapter {
  readonly library = 'soundtouch' as const;
  private registered = false;

  constructor(private readonly log: PitchShiftLogger) {}

  async register(audioContext: AudioContext): Promise<boolean> {
    try {
      const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet');
      // Processor served from /public (matches TimingProcessor convention).
      await SoundTouchNode.register(
        audioContext,
        '/worklets/soundtouch-processor.js',
      );
      this.registered = true;
      this.log.info('SoundTouch worklet registered');
      return true;
    } catch (err) {
      this.log.warn(
        'SoundTouch worklet registration failed; pitch shifting disabled',
        err,
      );
      return false;
    }
  }

  createNode(
    audioContext: AudioContext,
    gain: AudioNode,
    _stemProfile: PitchStemProfile,
  ): AudioNode | null {
    // SoundTouch's WSOLA params are stem-agnostic; profile ignored.
    if (!this.registered) {
      this.log.debug('SoundTouch not registered; deferring node creation');
      return null;
    }

    let SoundTouchNode: any;
    try {
      // Module is in cache after register() — synchronous resolution.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      SoundTouchNode = require('@soundtouchjs/audio-worklet').SoundTouchNode;
    } catch (err) {
      this.log.warn('SoundTouchNode module unavailable', err);
      return null;
    }

    let node: any;
    try {
      // v2 expects an options object — { context } — NOT a positional arg.
      node = new SoundTouchNode({ context: audioContext });
    } catch (err) {
      this.log.warn('SoundTouchNode construction failed', err);
      return null;
    }

    // Lock WSOLA stretch params to the tempo=1.0 autocalc values so
    // latency stays predictable across version/sample-rate changes.
    //   sequenceMs   = 130 - 20·1.0 = 110
    //   seekWindowMs = 25.67 - 2.67·1.0 = 23
    //   overlapMs    = DEFAULT_OVERLAP_MS = 8
    try {
      node.setStretchParameters({
        sequenceMs: 110,
        seekWindowMs: 23,
        overlapMs: 8,
        // quickSeek=true (SoundTouch default): the full search tripled
        // CPU per block and produced WORSE underrun spikes on cyclic
        // bass content.
        quickSeek: true,
      });
    } catch (err) {
      this.log.warn('setStretchParameters failed; falling back to autocalc', err);
    }

    try {
      node.connect(gain);
    } catch (err) {
      this.log.warn('SoundTouchNode → gain connect failed', err);
      try {
        node.disconnect?.();
      } catch {
        /* ignore */
      }
      return null;
    }

    return node as AudioNode;
  }

  setSemitones(
    node: AudioNode,
    semitones: number,
    audioContext: AudioContext,
    applyAtAudioTime?: number,
  ): void {
    const stNode = node as any;
    try {
      // pitchSemitones is a real AudioParam (range -24..+24).
      if (stNode.pitchSemitones?.value !== undefined) {
        const param = stNode.pitchSemitones as AudioParam;
        if (
          typeof applyAtAudioTime === 'number' &&
          applyAtAudioTime > audioContext.currentTime
        ) {
          try {
            param.cancelScheduledValues(audioContext.currentTime);
          } catch {
            /* ignore */
          }
          // Step change: holds current value until applyAtAudioTime, then
          // snaps. WSOLA picks up the new ratio at that block.
          param.setValueAtTime(semitones, applyAtAudioTime);
        } else {
          param.value = semitones;
        }
      } else {
        // Defensive: some builds expose a plain property.
        stNode.pitchSemitones = semitones;
      }
    } catch (err) {
      this.log.warn('SoundTouch setSemitones write failed', err);
    }
  }

  latencySeconds(): number {
    return SOUNDTOUCH_LATENCY_SECONDS;
  }
}

// ---------------------------------------------------------------------------
// Signalsmith — the A/B candidate. Phase-vocoder, formant-preserving.
// ---------------------------------------------------------------------------

/**
 * Nominal latency used before a node exists / if `node.latency()` is
 * unavailable. Signalsmith reports its true live-input latency per-node,
 * which the engine reads via {@link SignalsmithAdapter.latencySeconds};
 * this is only the bootstrap fallback for the DelayNode setup.
 */
const SIGNALSMITH_NOMINAL_LATENCY_SECONDS = 0.12;

export class SignalsmithAdapter implements PitchShiftAdapter {
  readonly library = 'signalsmith' as const;

  // The factory both registers the worklet AND builds a node, so there's
  // no separate register step. We keep the imported factory hot after
  // first use; per-node construction is async, so the engine's sync
  // createNode() kicks off construction and back-fills the node when the
  // promise resolves (the pre-warm loop tolerates a null-then-ready node).
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

  createNode(
    audioContext: AudioContext,
    gain: AudioNode,
    stemProfile: PitchStemProfile,
  ): AudioNode | null {
    if (!this.registered || !this.factory) {
      this.log.debug('Signalsmith not registered; deferring node creation');
      return null;
    }

    const profile = SIGNALSMITH_PROFILES[stemProfile] ?? SIGNALSMITH_PROFILES.harmony;

    // The factory is async but createNode is sync (the engine's call
    // chain is sync). We return a lightweight relay GainNode immediately
    // and connect it to `gain`; once the real Signalsmith node resolves
    // we splice it in front of the relay (source → relay → gain becomes
    // source → relay → signalsmith → gain is NOT possible after the fact,
    // so instead we make the relay the node the engine holds and route
    // the resolved Signalsmith node through it).
    //
    // Simpler and correct: the engine connects `source → node`. We give
    // it a passthrough input node now, and when Signalsmith resolves we
    // insert it between the passthrough and gain:
    //
    //   source → [passthrough input] → signalsmith → gain
    //
    // The passthrough is a GainNode(1.0); Signalsmith's own latency
    // compensation handles timing. Until Signalsmith resolves (a few ms,
    // module already cached) the passthrough feeds gain directly so audio
    // is never silent — it's just briefly un-pitched, which only matters
    // for the very first block after construction.
    const input = audioContext.createGain();
    input.gain.value = 1;

    // Temporary direct connection so audio flows before Signalsmith lands.
    let tempConnected = true;
    try {
      input.connect(gain);
    } catch (err) {
      this.log.warn('Signalsmith relay → gain connect failed', err);
      return null;
    }

    this.factory(audioContext)
      .then((sg: any) => {
        try {
          // Splice Signalsmith between the relay and gain.
          if (tempConnected) {
            try {
              input.disconnect(gain);
            } catch {
              /* ignore */
            }
            tempConnected = false;
          }
          input.connect(sg);
          sg.connect(gain);

          // Node-level config (set once): block size + CPU spreading per
          // the stem profile. configure() is separate from schedule().
          try {
            sg.configure?.({
              blockMs: profile.blockMs,
              splitComputation: profile.splitComputation,
            });
          } catch (cfgErr) {
            this.log.warn('Signalsmith configure failed; using defaults', cfgErr);
          }

          // Live-input mode: input/rate/loop are ignored, only semitones
          // + formant matter. Must call start() (== schedule active) to
          // begin processing.
          //
          // CRITICAL: fold any semitone offset requested BEFORE the node
          // resolved into this initial schedule. The engine calls
          // setInstrumentPitchShift during pre-play transpose, which stashed
          // the value in __pendingSemitones because `sg` didn't exist yet.
          // Without applying it here, a pre-play key change is silently lost
          // and the groove plays in the default key.
          const pending = (input as any).__pendingSemitones;
          const initialSemitones =
            typeof pending === 'number' ? pending : 0;
          sg.schedule?.({
            active: true,
            semitones: initialSemitones,
            formantCompensation: profile.formantCompensation,
            formantBaseHz: profile.formantBaseHz,
            tonalityHz: profile.tonalityHz,
          });
          sg.start?.();
          // Stash the live node + profile on the relay so setSemitones can
          // re-apply the per-stem formant fields on every key change, and
          // latency() can reach the node. Clear the applied pending value.
          (input as any).__signalsmith = sg;
          (input as any).__profile = profile;
          delete (input as any).__pendingSemitones;
          this.log.info('Signalsmith node spliced in', {
            stemProfile,
            initialSemitones,
            formantBaseHz: profile.formantBaseHz,
            blockMs: profile.blockMs,
          });
        } catch (err) {
          this.log.warn('Signalsmith splice failed; staying dry', err);
          // Restore the direct passthrough so audio still plays.
          try {
            input.connect(gain);
            tempConnected = true;
          } catch {
            /* ignore */
          }
        }
      })
      .catch((err: unknown) => {
        this.log.warn('Signalsmith factory rejected; staying dry', err);
      });

    // The engine holds the relay; source.connect(relay) works immediately.
    return input as AudioNode;
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
  library: 'soundtouch' | 'signalsmith',
  log: PitchShiftLogger,
): PitchShiftAdapter {
  return library === 'signalsmith'
    ? new SignalsmithAdapter(log)
    : new SoundTouchAdapter(log);
}
