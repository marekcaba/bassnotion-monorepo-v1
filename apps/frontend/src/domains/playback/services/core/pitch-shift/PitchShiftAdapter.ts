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
   *
   * `seamAudibleOffset` (seconds) is added to a re-quantised PENDING key
   * change's recomputed seam so it matches the audible-downbeat offset the
   * change was originally scheduled with (see getStemNextSeamTime); pass the
   * engine's key-seam offset. Defaults to 0 for callers without a pending key.
   *
   * `keyBoundaryOverride` (audio-ctx seconds, already incl. the audible offset)
   * is the loop "one" a PENDING key should land on — the engine passes the DRUM
   * downbeat so the key locks to the same musical seam the drums land on, stable
   * across many incremental tempo clicks. When present (and in the future), the
   * re-thread uses it directly instead of re-deriving the seam from the read-head
   * (the re-derivation drifts per click). Omit / null → read-head fallback.
   */
  setRate(
    node: AudioNode,
    rate: number,
    audioContext: AudioContext,
    applyAtAudioTime?: number,
    seamAudibleOffset?: number,
    keyBoundaryOverride?: number,
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
   * Output-time of the NEXT loop seam at `rate`, read from the node's actual
   * read-head. A seam is where the read-head (input time) wraps at the buffer
   * length; that input position is tempo-invariant, but the output time it maps
   * to scales with the rate (output advances at `rate` per input second).
   * Returns undefined if the read-head/buffer aren't known yet.
   *
   * This is the AUTHORITATIVE next-seam used to quantise deferred key changes
   * (and the engine exposes it so the Groove Card can schedule a key swap on the
   * REAL wrap instead of a React-state clock that drifts after a tempo change).
   */
  nextSeamOutputTime(
    node: AudioNode,
    audioContext: AudioContext,
    rate: number,
  ): number | undefined;

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
          // The node arms at `semitones` → that's the audible key from the
          // first start; seed it so an early tempo change carries the right key
          // (see setRate's deferred-key preservation).
          (relay as any).__audibleSemitones = semitones;
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

  /**
   * Build a `schedule()` change for a semitones value, carrying the per-stem
   * formant profile (schedule() doesn't inherit formant fields, so they must
   * ride every pitch change).
   */
  private semitonesChange(
    node: AudioNode,
    semitones: number,
  ): Record<string, unknown> {
    const profile: SignalsmithStemProfile | undefined = (node as any).__profile;
    return {
      semitones,
      formantCompensation: profile?.formantCompensation ?? true,
      formantBaseHz: profile?.formantBaseHz ?? 0,
      tonalityHz: profile?.tonalityHz,
    };
  }

  /**
   * The semitones value currently AUDIBLE on the node at `now`. If a deferred
   * key change's boundary has already passed, it has taken effect — promote it
   * to audible and clear the deferral so subsequent tempo changes carry the
   * RIGHT key. Returns the effective audible semitones.
   */
  private audibleSemitonesAt(node: AudioNode, now: number): number {
    const n = node as any;
    if (
      typeof n.__deferredSemitones === 'number' &&
      typeof n.__deferredSemitonesOutput === 'number' &&
      n.__deferredSemitonesOutput <= now
    ) {
      n.__audibleSemitones = n.__deferredSemitones;
      n.__deferredSemitones = undefined;
      n.__deferredSemitonesOutput = undefined;
    }
    return typeof n.__audibleSemitones === 'number' ? n.__audibleSemitones : 0;
  }

  setRate(
    node: AudioNode,
    rate: number,
    audioContext: AudioContext,
    applyAtAudioTime?: number,
    seamAudibleOffset = 0,
    keyBoundaryOverride?: number,
  ): void {
    const sg = (node as any).__signalsmith;
    if (!sg?.schedule) {
      (node as any).__pendingRate = rate;
      return;
    }

    // Snapshot R_old BEFORE we overwrite __currentRate — the deferred-key seam
    // re-derivation below needs it (the worklet runs the applyAhead window at the
    // OLD rate; see the "BLEND" note there).
    const prevRate =
      typeof (node as any).__currentRate === 'number'
        ? (node as any).__currentRate
        : 1;

    // CONTINUOUS read-head, computed ONCE here at the rate change and reused for
    // both the stamp re-anchor and the deferred-key seam. We interpolate the
    // last stamp at the OLD rate up to `now` (the input the worklet has actually
    // consumed so far). Critically we do NOT then read raw sg.inputTime: that
    // value is ~8ms-quantized, output-latency-shifted, AND gets overwritten by
    // every schedule()'s ['time'] post — so re-sampling it on each of many rapid
    // tempo clicks made the pending key's seam NON-IDEMPOTENT (it drifted by the
    // click pattern). Using the continuous interpolation keeps the seam stable
    // across N clicks.
    const now = audioContext.currentTime;
    const stampForRead = (node as any).__phaseStamp as
      | { inputTime: number; atTime: number; rate: number }
      | undefined;
    const inputNow =
      stampForRead &&
      typeof sg.inputTime === 'number' &&
      stampForRead.inputTime === sg.inputTime &&
      now >= stampForRead.atTime
        ? stampForRead.inputTime + (now - stampForRead.atTime) * stampForRead.rate
        : typeof sg.inputTime === 'number'
          ? sg.inputTime
          : null;

    // Track the current rate so the playhead-phase interpolation advances at
    // the right speed between worklet inputTime posts.
    (node as any).__currentRate = rate;

    // Re-anchor the stamp at the rate change: freeze the input position computed
    // above (at the OLD rate, up to `now`), then advance at the NEW rate forward.
    // Keeps getStemReadHead / nextSeamOutputTime in one rate domain across the
    // change (prevents the seam jumping by seconds on a big tempo step).
    if (inputNow != null) {
      (node as any).__phaseStamp = { inputTime: inputNow, atTime: now, rate };
    }
    try {
      // CRITICAL — preserve a pending (seam-deferred) KEY change across a tempo
      // change. signalsmith's schedule() models pitch+rate on ONE segment
      // timeline: a new segment at time T POPS every segment whose output >= T
      // and INHERITS the latest popped segment's fields. So a bare
      // schedule({rate, output: now}) pops a key change queued at a FUTURE
      // boundary and folds its semitones into the immediate segment — the key
      // jumps NOW (the bug). Fix: (1) carry the currently-AUDIBLE semitones on
      // the rate segment so the immediate part stays in the old key, then
      // (2) re-schedule the deferred key at its boundary so it survives.
      const audible = this.audibleSemitonesAt(node, audioContext.currentTime);
      const change: Record<string, unknown> = {
        rate,
        ...this.semitonesChange(node, audible),
      };
      const deferToFuture =
        typeof applyAtAudioTime === 'number' &&
        applyAtAudioTime > audioContext.currentTime;
      // The audio-time at which the rate segment lands (now, or the requested
      // apply-ahead time). The deferred-key re-insert below must NOT pop this.
      const rateOutput = deferToFuture
        ? (applyAtAudioTime as number)
        : audioContext.currentTime;
      if (deferToFuture) {
        change.output = applyAtAudioTime;
      }
      sg.schedule(change);

      // Re-establish the deferred KEY change that the rate schedule above just
      // popped — but RECOMPUTE its boundary for the NEW rate. The key was meant
      // to land at the next LOOP SEAM. A seam is tempo-invariant in INPUT time
      // (the read-head wrapping at bufferDuration), but its OUTPUT time depends
      // on the rate. Re-using the originally-stored output time would be stale
      // after a tempo change (the seam moved) — the key would flip mid-loop and
      // sound out of sync with the drums. Map "next input-wrap" → output time at
      // the new rate so pitch and the loop wrap stay aligned at any tempo.
      const defSemi = (node as any).__deferredSemitones;
      const bufferDuration = (node as any).__bufferDuration;
      // PREFERRED: anchor the pending key to the DRUM downbeat the engine passed
      // (keyBoundaryOverride, already incl. the audible offset). The drum loop
      // grid is a STATE re-anchored by exact algebra each tempo click, so it's
      // stable across many incremental BPM steps — the key lands exactly where
      // the drums land. We only re-derive from the read-head (the fallback below)
      // when no override is available (drums absent), since that re-derivation
      // drifts by the click pattern.
      const overrideOk =
        typeof keyBoundaryOverride === 'number' &&
        keyBoundaryOverride > rateOutput;
      const canReadHead =
        inputNow != null &&
        typeof bufferDuration === 'number' &&
        bufferDuration > 0;
      if (typeof defSemi === 'number' && (overrideOk || canReadHead)) {
        let newOut: number;
        if (overrideOk) {
          newOut = keyBoundaryOverride as number;
        } else {
          // FALLBACK — re-derive the seam for the NEW rate from the CONTINUOUS
          // read-head (inputNow) computed above — NOT a fresh raw sg.inputTime
          // read (that re-sampling is what made it drift per click).
          const r = rate > 0 ? rate : 1;
          const rOld = prevRate > 0 ? prevRate : 1;
          const inputInLoop =
            ((inputNow! % bufferDuration) + bufferDuration) % bufferDuration;
          const inputUntilSeam = bufferDuration - inputInLoop;
          // BLEND: the worklet runs the applyAhead window [now, rateOutput) at the
          // OLD rate, then the NEW rate. The true output seam is
          //   rateOutput + (inputUntilSeam − (rateOutput − now)·rOld) / r
          // (charging the whole inputUntilSeam at the new rate from `now` landed
          // it 0.02·(1 − rOld/r) off — sign by tempo direction).
          const applyAheadSec = Math.max(0, rateOutput - now);
          const rawSeam =
            rateOutput + (inputUntilSeam - applyAheadSec * rOld) / r;
          // + the audible-downbeat offset the key was originally deferred with.
          newOut = rawSeam + seamAudibleOffset;
        }
        (node as any).__deferredSemitonesOutput = newOut;
        {
          // Re-insert the deferred key WITHOUT disturbing the rate segment just
          // scheduled above, and WITHOUT applying the key now. signalsmith's
          // schedule keys two things off `outputTime`: (1) it POPS segments with
          // output >= outputTime, and (2) it SHIFTS the "current" segment up to
          // outputTime. We want it to spare the rate and NOT make the key
          // current. So:
          //   - `output: newOut`  → STORE the key segment at the future seam.
          //   - `outputTime: rateOutput + ε` → pop/shift threshold just AFTER
          //     where the RATE segment sits, so the rate is spared (its output
          //     == rateOutput < threshold) and the shift makes the rate the
          //     current segment (applying the new tempo now), while the key at
          //     newOut ≫ threshold stays deferred.
          // Using `output` alone pops the rate (threshold falls to now); using
          // `outputTime: newOut` alone shifts the key into the current slot
          // (jumps the key immediately). Both fields, with the threshold pinned
          // just past the rate, thread the needle.
          sg.schedule({
            ...this.semitonesChange(node, defSemi),
            output: newOut,
            outputTime: rateOutput + 0.001,
          });
        }
      }
    } catch (err) {
      this.log.warn('Signalsmith setRate schedule failed', err);
    }
  }

  /**
   * Output-time of the NEXT loop seam at `rate`. A seam is where the read-head
   * (input time) wraps at `bufferDuration`; that input position is tempo-
   * invariant, but the output time it maps to scales with the rate. Returns
   * undefined if the read-head/buffer aren't known yet.
   *
   * CONTINUOUS read-head: `sg.inputTime` is posted by the worklet only ~every 8ms
   * (setUpdateInterval 1/120) and carries the WRAPPED value, so reading it raw
   * near the seam can land on the wrong side of the wrap → `inputUntilSeam` ≈ a
   * FULL bufferDuration → the boundary lands a whole loop late (the intermittent
   * "key plays through the next loop's first beat" bug). We interpolate from the
   * last posted value using the audio clock — the SAME `__phaseStamp` the engine's
   * getStemReadHead writes — which is monotonic-within-loop and never lies across
   * the wrap. We then refresh the stamp here too, so this path keeps it fresh even
   * if nothing else is polling the read-head this tick.
   *
   * SEAM-IMMINENT GUARD: the continuous interpolation already disambiguates which
   * side of the wrap we're on (it advances monotonically; only the modulo wraps),
   * so a genuine "just wrapped, full loop to go" reads correctly as ~bufferDuration
   * away — we must NOT snap that to now. The ONLY ambiguous case left is "about to
   * wrap" (inputUntilSeam ≈ 0): the seam is genuinely imminent, so snap it to now
   * (clamped to now+ε by the caller) rather than risk a tiny-positive value that a
   * sub-ms clock jitter could flip to a full loop.
   */
  nextSeamOutputTime(
    node: AudioNode,
    audioContext: AudioContext,
    rate: number,
  ): number | undefined {
    const relay = node as any;
    const sg = relay.__signalsmith;
    const bufferDuration = relay.__bufferDuration;
    if (!sg || typeof sg.inputTime !== 'number' || !bufferDuration) {
      return undefined;
    }
    const r = rate > 0 ? rate : 1;
    const now = audioContext.currentTime;

    // Continuous interpolated read-head (shared __phaseStamp logic). The
    // `stamp.rate === r` guard is defense-in-depth against extrapolating the
    // INPUT position with a stale rate while dividing the OUTPUT by the new rate
    // (setRate re-anchors the stamp at a rate change, but if a reader ever races
    // ahead of that, this forces a fresh stamp rather than a multi-second seam).
    const stamp = relay.__phaseStamp as
      | { inputTime: number; atTime: number; rate: number }
      | undefined;
    let inputSeconds: number;
    if (
      stamp &&
      stamp.inputTime === sg.inputTime &&
      stamp.rate === r &&
      now >= stamp.atTime
    ) {
      inputSeconds = stamp.inputTime + (now - stamp.atTime) * stamp.rate;
    } else {
      relay.__phaseStamp = { inputTime: sg.inputTime, atTime: now, rate: r };
      inputSeconds = sg.inputTime;
    }

    const inputInLoop =
      ((inputSeconds % bufferDuration) + bufferDuration) % bufferDuration;
    let inputUntilSeam = bufferDuration - inputInLoop;

    // SEAM-IMMINENT GUARD: only the "about to wrap" case (inputUntilSeam ≈ 0). The
    // interpolation already places a just-wrapped read-head correctly ~a full loop
    // away, so we must NOT collapse that. A near-zero inputUntilSeam means the seam
    // is genuinely now → snap to now (caller clamps to now+ε).
    const guardInputSeconds = (1 / 120) * r * 1.5; // ~1.5 post intervals, scaled
    if (inputUntilSeam <= guardInputSeconds) {
      inputUntilSeam = 0;
    }

    // output time advances at `rate` per input second.
    return now + inputUntilSeam / r;
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
      // FIRST settle any PREVIOUS deferred key whose boundary has already
      // passed — it's now the audible key. Without this, a key set, landed at
      // the seam, then a SECOND key set before any tempo change would leave
      // __audibleSemitones stale at the old value (e.g. 0): the next tempo
      // change would carry that stale audible and REVERT the (already audible)
      // first key to default until the new seam. audibleSemitonesAt promotes a
      // passed-boundary deferral to audible and clears it.
      this.audibleSemitonesAt(node, audioContext.currentTime);

      // Carry the per-stem formant profile on every change (see semitonesChange).
      const change: Record<string, unknown> = this.semitonesChange(
        node,
        semitones,
      );
      // Defer the change to the requested boundary, else apply now. `output`
      // stores the segment at the boundary while leaving the read-head readout
      // untouched (a lone key change has nothing to coexist with, so the
      // pop-at-now is harmless). The setRate re-apply uses `outputTime` instead
      // because it must NOT pop the concurrent rate segment.
      const deferToFuture =
        typeof applyAtAudioTime === 'number' &&
        applyAtAudioTime > audioContext.currentTime;
      if (deferToFuture) {
        change.output = applyAtAudioTime;
        // Remember this deferred key + its boundary so a tempo change before
        // the boundary can re-establish it (see setRate). The AUDIBLE key is
        // still the previous value until the boundary is reached.
        (node as any).__deferredSemitones = semitones;
        (node as any).__deferredSemitonesOutput = applyAtAudioTime;
      } else {
        // Applied immediately → this IS the audible key now; no deferral stands.
        (node as any).__audibleSemitones = semitones;
        (node as any).__deferredSemitones = undefined;
        (node as any).__deferredSemitonesOutput = undefined;
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
