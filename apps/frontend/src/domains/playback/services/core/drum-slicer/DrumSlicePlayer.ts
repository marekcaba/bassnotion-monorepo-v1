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

import {
  buildExtendedTail,
  tailIsUsable,
  transientEndOffset,
} from './buildExtendedTail.js';
import {
  analyzeWsola,
  synthesizeWsola,
  wsolaIsUsable,
  type WsolaAnalysis,
  type WsolaOptions,
} from './wsolaStretch.js';

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
  /** SUSTAIN GAP-FILL (LAUNCH-06): when slowing down opens a silent gap after a
   *  sustaining hit (a hi-hat), synthesize a continued decay (granular, see
   *  buildExtendedTail) to bridge it so the subdivision keeps its flow. OFF by
   *  default — ship dark, flip after the ear/metric A/B. */
  gapFill?: boolean;
  /** Only fill when the REAL silent gap after a slice exceeds this. Below it
   *  there's no audible hole. (gate A) */
  minGapToFillSeconds?: number;
  /** Stop the fill this long before the next onset so its fade-out clears the
   *  next transient (the duck-out). (gate D) */
  fillTransientGuardSeconds?: number;
  /** Don't bother filling a hole shorter than this. (gate D) */
  minFillSeconds?: number;
  /** Hard cap on synthesized fill length (s) — bounds the pre-rendered buffer
   *  per slice; the slowest tempo never reads more than this. */
  maxFillSeconds?: number;
  /** Confidence ceiling (0..1, from detectOnsetsDetailed): skip fills on hits
   *  LOUDER than this (primary transients — kicks/snares). (gate C) */
  maxFillConfidence?: number;
  /** Decay time constant (s) for the synthesized fill. Larger = the fill SUSTAINS
   *  longer (bridges bigger gaps / more flow) but risks an unnatural noise pad;
   *  smaller = a short natural-decay wisp. The single most important tuning knob.
   *  Undefined ⇒ fit from the slice's own tail (clamped 40–80ms). */
  sustainTauSeconds?: number;
  /** Grain length (s) for the granular fill — bigger = smoother/denser. */
  sustainGrainSeconds?: number;

  /** HYBRID WSOLA TEXTURE STRETCH (LAUNCH-06, supersedes the granular gap-fill
   *  for hi-hat continuity): when ON, the audio BETWEEN strong transients (the
   *  shuffle-hat texture) is WSOLA time-stretched to fill a slowed gap instead
   *  of playing bit-exact then going silent. Strong transients (kick/snare) stay
   *  bit-exact. OFF by default — ship dark, flip after the ear A/B. Mutually
   *  exclusive with the granular gapFill (WSOLA wins when both on). */
  wsola?: boolean;
  /** Confidence (0..1) at/above which an onset is a STRONG transient that gets a
   *  BIT-EXACT attack overlaid on the continuous WSOLA bed (kick/snare); below
   *  it the onset just rides the bed. The headline WSOLA knob. */
  strongConfidenceThreshold?: number;
  /** WSOLA analysis/synthesis window length (s). */
  wsolaWindowSeconds?: number;
  /** WSOLA synthesis hop as a fraction of the window (overlap = 1 − this). */
  wsolaHopFraction?: number;
  /** WSOLA cross-correlation lag-search half-width (s). */
  wsolaSearchSeconds?: number;
  /** Length (s) of the bit-exact transient overlay slice (attack + short body)
   *  placed over the bed for each strong transient. SHORT — just enough to cover
   *  the attack; the bed carries everything after it. */
  transientBodySeconds?: number;
  /** How far the bed gain is DUCKED under each transient overlay (0..1; e.g.
   *  0.2 = bed drops to 20% while the crisp attack plays on top). NOT 0 — leave
   *  some bed so the duck isn't an audible hole. "Duck-and-replace" — summing a
   *  sharp attack onto the bed's smeared copy of the same hit would flam/comb. */
  transientDuckDepth?: number;
  /** How much of each strong transient's BODY is removed from the BED before
   *  WSOLA (0 = full loop in the bed — old behavior; 1 = bodies fully notched
   *  out). WSOLA's slowdown duplicates windows and accumulates lag (~40ms
   *  mid-loop, 60–110ms by the loop end), so a loud snare/kick body left in the
   *  bed gets copied to the WRONG place at full gain → the "doubled body, no
   *  transient" artifact. Notch them out so the bed carries only inter-hit
   *  texture; the bit-exact overlays carry all transient energy on the grid. */
  bedTransientNotch?: number;
  /** Width (s) of the bed notch per strong hit. MUST exceed one WSOLA window or
   *  the stretch reads un-notched body audio across the gap and rebuilds the
   *  body downstream (a double even on protected hits). Clamped up to ≥ window +
   *  margin internally. Default covers the kick/snare body decay (~140ms). */
  bedNotchSeconds?: number;
  /** Crossfade width (s) between the crisp overlay and the bed around each hit.
   *  Instead of the bed hard-ducking to a floor and holding (an audible hole),
   *  the bed fades DOWN as the overlay fades IN and fades back UP as the overlay
   *  fades OUT, equal-power, so they BLEND with no gap. Wider = smoother/gentler
   *  blend. The fix for the "prominent ducking" the ear flags. */
  transientBlendSeconds?: number;

  /** The MUSICAL loop length (s) the drums must wrap on — same value
   *  bass/harmony loop on (the beat-grid length), which can be a hair SHORTER
   *  than the raw drum buffer. Looping on the raw buffer instead makes the
   *  drums fall ~bufferDur−loopDur behind every loop (a structural desync that
   *  worsens at faster tempos). Defaults to the buffer duration (no trim). */
  loopDurationSeconds?: number;
}

/** The subset of options the admin tuning panel can change LIVE on a playing
 *  player (every field optional → patch only what moved). `sustainTauSeconds` /
 *  `sustainGrainSeconds` may be `undefined` to clear an override and fall back
 *  to the per-slice fit — so they're modelled as `number | undefined`, and the
 *  setter uses `'key' in p` to distinguish "unset" from "absent". */
export interface GapFillParams {
  gapFill?: boolean;
  minGapToFillSeconds?: number;
  fillTransientGuardSeconds?: number;
  minFillSeconds?: number;
  fadeOutSeconds?: number;
  maxFillConfidence?: number;
  sustainTauSeconds?: number | undefined;
  sustainGrainSeconds?: number | undefined;
  // Hybrid WSOLA texture stretch (supersedes the granular fill).
  wsola?: boolean;
  strongConfidenceThreshold?: number;
  wsolaWindowSeconds?: number;
  wsolaHopFraction?: number;
  wsolaSearchSeconds?: number;
  transientBodySeconds?: number;
  transientDuckDepth?: number;
  bedTransientNotch?: number;
  bedNotchSeconds?: number;
  transientBlendSeconds?: number;
}

/** A fully-populated snapshot of the live params. Every numeric knob is set,
 *  but the two sustain DSP overrides stay nullable (`undefined` = "fit from the
 *  slice's own tail"), so we can't use `Required<GapFillParams>` (which would
 *  drop that `undefined`). */
export interface GapFillParamsSnapshot {
  gapFill: boolean;
  minGapToFillSeconds: number;
  fillTransientGuardSeconds: number;
  minFillSeconds: number;
  fadeOutSeconds: number;
  maxFillConfidence: number;
  sustainTauSeconds: number | undefined;
  sustainGrainSeconds: number | undefined;
  wsola: boolean;
  strongConfidenceThreshold: number;
  wsolaWindowSeconds: number;
  wsolaHopFraction: number;
  wsolaSearchSeconds: number;
  transientBodySeconds: number;
  transientDuckDepth: number;
  bedTransientNotch: number;
  bedNotchSeconds: number;
  transientBlendSeconds: number;
}

/** A scheduling region: either ONE bit-exact strong-transient slice, or a span
 *  of texture onsets to be WSOLA-stretched as a single continuous piece. Both
 *  carry the onset-index half-open range [startIndex, endIndex) so the
 *  scheduler can reuse the EXACT same `loopStartTime + onset/ratio` grid math
 *  as the flat slicer (region boundaries are a subset of the onset grid). */
export type DrumRegion =
  | { kind: 'transient'; startIndex: number; endIndex: number }
  | { kind: 'texture'; startIndex: number; endIndex: number };

/**
 * Group a sanitized onset list into scheduling regions using the confidence
 * gate. An onset at/above `threshold` is a STRONG transient (bit-exact). The
 * run of WEAK onsets after a strong one collapses into a single TEXTURE region
 * (the shuffle-hat texture, WSOLA-stretched as a whole — its internal soft
 * onsets ride the stretch, never sliced). Index 0 is always strong (the
 * downbeat). Pure + exported for unit testing.
 *
 * Emits, walking left→right: for each strong onset s, a `transient` region for
 * s's own slice [s, s+1); then if the onsets between s+1 and the NEXT strong
 * onset are weak, ONE `texture` region [s+1, nextStrong). Adjacent strong
 * onsets ⇒ no texture region (pure bit-exact, identical to today).
 */
export function buildRegions(
  confidences: number[],
  threshold: number,
): DrumRegion[] {
  const n = confidences.length;
  if (n === 0) return [];
  const isStrong = (i: number) => i === 0 || (confidences[i] ?? 1) >= threshold;
  const regions: DrumRegion[] = [];
  let i = 0;
  while (i < n) {
    if (isStrong(i)) {
      // Bit-exact slice for the strong transient itself.
      regions.push({ kind: 'transient', startIndex: i, endIndex: i + 1 });
      // Collect the run of weak onsets after it into one texture region, up to
      // (but not including) the next strong onset or the loop end.
      let j = i + 1;
      while (j < n && !isStrong(j)) j++;
      if (j > i + 1) {
        regions.push({ kind: 'texture', startIndex: i + 1, endIndex: j });
      }
      i = j;
    } else {
      // Shouldn't happen (index 0 is strong), but stay safe: lone weak onset →
      // its own texture region.
      let j = i;
      while (j < n && !isStrong(j)) j++;
      regions.push({ kind: 'texture', startIndex: i, endIndex: j });
      i = j;
    }
  }
  return regions;
}

type DefaultedOptions = Omit<
  DrumSlicePlayerOptions,
  'loopDurationSeconds' | 'sustainTauSeconds' | 'sustainGrainSeconds'
>;

const DEFAULTS: Required<DefaultedOptions> = {
    // Small look-ahead: only ~60ms of drum is committed to the audio clock ahead
    // of now, so a tempo change (which re-spaces from the next unscheduled slice)
    // takes effect within ~60ms — tight enough to stay locked to bass/harmony
    // even under rapid clicking. The 25ms tick refills it comfortably.
    scheduleAheadSeconds: 0.06,
    tickMs: 25,
    fadeInSeconds: 0.002,
    fadeOutSeconds: 0.012,
    preRollSeconds: 0.003,
    gapFill: false,
    minGapToFillSeconds: 0.04,
    fillTransientGuardSeconds: 0.018,
    minFillSeconds: 0.03,
    maxFillSeconds: 1.5,
    maxFillConfidence: 0.6,
    wsola: true, // continuous-bed smooth stretch ON by default
    // Tuned by ear (the panel) — these are the defaults the user dialed in.
    strongConfidenceThreshold: 0.3, // protect most kicks/snares incl. off-beats
    wsolaWindowSeconds: 0.025, // smaller window = crisper bed
    wsolaHopFraction: 0.1, // 90% overlap = denser/smoother bed
    wsolaSearchSeconds: 0.006,
    transientBodySeconds: 0.21, // longer crisp attack body over the bed
    transientDuckDepth: 1.0, // 100% = no dip (full blend, bed stays up)
    bedTransientNotch: 1.0, // bodies fully removed from the bed (the fix)
    bedNotchSeconds: 0.14, // notch wide enough to cover the body + exceed 1 window
    transientBlendSeconds: 0.115, // equal-power crossfade width bed↔overlay
  };

export class DrumSlicePlayer {
  private readonly ctx: AudioContext;
  private readonly buffer: AudioBuffer;
  private readonly output: AudioNode;
  private readonly onsets: number[];
  /** Per-onset confidence parallel to `onsets` (post-sanitize). Drives the
   *  gap-fill role gate (skip loud primary transients). */
  private readonly confidences: number[] = [];
  /** Raw PCM duration — used only for buffer-read BOUNDS, never for the loop. */
  private readonly bufferDuration: number;
  /** The MUSICAL loop length the drums wrap on (≤ bufferDuration). All loop /
   *  wrap / phase math uses THIS so drums stay locked to bass/harmony, which
   *  loop on the same musical length. */
  private readonly loopDuration: number;
  private readonly opt: Required<DefaultedOptions>;
  /** Sustain-DSP overrides for the fill synthesis (admin-tunable). Undefined ⇒
   *  buildExtendedTail fits the value from each slice's own tail. Changing
   *  either forces a re-precompute of the fill buffers. */
  private sustainTau: number | undefined;
  private sustainGrain: number | undefined;

  /** Live WSOLA tunables (admin-tunable). */
  private wsolaEnabled: boolean;
  private strongConfidenceThreshold: number;
  private wsolaOpt: WsolaOptions;
  private transientBodySeconds: number;
  private transientDuckDepth: number;
  private bedTransientNotch: number;
  private bedNotchSeconds: number;
  private transientBlendSeconds: number;
  /** DIAGNOSTIC solo flags (admin panel): mute the bed to hear ONLY the crisp
   *  overlaid kicks/snares, or mute the overlays to hear ONLY the bed texture —
   *  so the ear can localize where a double lives. Not shipped to users. */
  private muteBed = false;
  private muteOverlays = false;

  private ratio = 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private timerId: any = null;
  private playing = false;

  /** Audio-context time at which the CURRENT loop iteration started. */
  private loopStartTime = 0;
  /** Index of the next REGION to schedule within the loop (cursor into
   *  `this.regions`). Named nextSlice for history; it indexes regions now. */
  private nextSlice = 0;
  /** Live slices (source + its envelope gain) so stop() can stop + tidy them. */
  private active = new Set<{ src: AudioBufferSourceNode; env: GainNode }>();

  /** GAP-FILL (legacy, superseded by WSOLA): per-slice precomputed extended-tail
   *  buffer (null = slice doesn't qualify / no usable tail). Indexed by slice
   *  index. Kept as the A/B fallback when wsola is off and gapFill is on. */
  private fillBuffers: (AudioBuffer | null)[] = [];

  /** HYBRID (continuous-bed model): the onset indices that get a BIT-EXACT
   *  attack overlay (strong transients — kick/snare), derived from confidences
   *  via the threshold. Everything else just rides the bed. */
  private strongIndices: number[] = [];
  /** WSOLA analysis of the WHOLE loop, built ONCE (ratio-independent). The bed. */
  private bedAnalysis: WsolaAnalysis | null = null;
  /** The synthesized continuous bed for the CURRENT ratio (the whole loop
   *  stretched, one buffer). null ⇒ not synthesized / play raw. Rebuilt
   *  (coalesced) on a ratio change. */
  private bedBuffer: AudioBuffer | null = null;
  /** The ratio bedBuffer was synthesized for (skip redundant re-synth). */
  private synthesizedForRatio = 0;
  /** Set by setRatio when the ratio changed; the next scheduleTick flushes ONE
   *  bed re-synthesis for the latest ratio (coalesces a rapid tempo drag — many
   *  setRatio calls between two 25ms ticks → a single WSOLA synth). */
  private bedResynthDirty = false;

  constructor(
    ctx: AudioContext,
    buffer: AudioBuffer,
    onsets: number[],
    output: AudioNode,
    options: DrumSlicePlayerOptions = {},
    /** Per-onset confidence (0..1) parallel to `onsets`, from
     *  detectOnsetsDetailed — used by the fill role gate to skip loud primary
     *  transients (kicks/snares). Optional; absent ⇒ all treated as max conf. */
    confidences?: number[],
  ) {
    this.ctx = ctx;
    this.buffer = buffer;
    this.output = output;
    this.bufferDuration = buffer.duration;
    const {
      loopDurationSeconds,
      sustainTauSeconds,
      sustainGrainSeconds,
      ...rest
    } = options;
    this.sustainTau = sustainTauSeconds;
    this.sustainGrain = sustainGrainSeconds;
    // Wrap on the MUSICAL loop length (clamped to the buffer), defaulting to the
    // full buffer when not given. Onsets are clipped to this so the last slice
    // ends at the musical seam, not the buffer end.
    this.loopDuration =
      loopDurationSeconds != null && loopDurationSeconds > 0
        ? Math.min(loopDurationSeconds, this.bufferDuration)
        : this.bufferDuration;
    // Sanitize onsets: ascending, in [0, loopDuration), starting at 0. Carry the
    // confidence alongside each kept onset (by original index).
    const paired = onsets
      .map((t, i) => ({ t, c: confidences?.[i] ?? 1 }))
      .filter((p) => p.t >= 0 && p.t < this.loopDuration)
      .sort((a, b) => a.t - b.t);
    if (paired.length === 0 || paired[0]!.t > 1e-4) {
      paired.unshift({ t: 0, c: 1 });
    }
    this.onsets = paired.map((p) => p.t);
    this.confidences = paired.map((p) => p.c);
    this.opt = { ...DEFAULTS, ...rest };
    this.wsolaEnabled = this.opt.wsola;
    this.strongConfidenceThreshold = this.opt.strongConfidenceThreshold;
    this.wsolaOpt = {
      windowSeconds: this.opt.wsolaWindowSeconds,
      hopFraction: this.opt.wsolaHopFraction,
      searchSeconds: this.opt.wsolaSearchSeconds,
    };
    this.transientBodySeconds = this.opt.transientBodySeconds;
    this.transientDuckDepth = this.opt.transientDuckDepth;
    this.bedTransientNotch = this.opt.bedTransientNotch;
    this.bedNotchSeconds = this.opt.bedNotchSeconds;
    this.transientBlendSeconds = this.opt.transientBlendSeconds;
    // Derive which onsets get a bit-exact overlay (cheap). The bed analysis +
    // legacy fills are only built when their feature is on (lazy, like before).
    this.buildStrongIndices();
    if (this.wsolaEnabled) this.precomputeBedAnalysis();
    // WSOLA wins when both flags are on; only build legacy fills if WSOLA is off.
    if (!this.wsolaEnabled && this.opt.gapFill) this.precomputeFills();
  }

  /** (Re)derive the strong-transient overlay indices from the current
   *  confidences + threshold (index 0 — the downbeat — is always strong). Cheap;
   *  safe to re-run when the threshold changes. Does NOT invalidate the bed (the
   *  bed is the whole loop, threshold-independent) — only which hits overlay. */
  private buildStrongIndices(): void {
    const out: number[] = [];
    for (let i = 0; i < this.confidences.length; i++) {
      if (i === 0 || (this.confidences[i] ?? 1) >= this.strongConfidenceThreshold) {
        out.push(i);
      }
    }
    this.strongIndices = out;
  }

  /**
   * Toggle the sustain gap-fill at runtime (for A/B-by-ear). Building the fill
   * buffers lazily on first enable, once. Turning it off just stops scheduling
   * fills; existing buffers are kept (cheap) for a re-enable.
   */
  setGapFill(on: boolean): void {
    this.opt.gapFill = on;
    if (on && this.fillBuffers.length === 0) this.precomputeFills();
  }

  /**
   * Live-tune the gap-fill behaviour (admin panel, dial-in-by-ear). SCHEDULING
   * params (gap/guard/min/fade) take effect on the very next scheduled slice —
   * no rebuild. DSP params (maxFillConfidence, sustainTau, sustainGrain) change
   * WHICH slices qualify and the shape of each fill, so they force a synchronous
   * re-precompute of the fill buffers (~tens of ms, only while the panel is
   * open). Only re-precompute when a DSP param actually changed and fills exist
   * / gapFill is on — otherwise it's just a cheap field write.
   */
  setGapFillParams(p: GapFillParams): void {
    let dspChanged = false;
    if (p.gapFill !== undefined) {
      this.opt.gapFill = p.gapFill;
    }
    if (p.minGapToFillSeconds !== undefined) {
      this.opt.minGapToFillSeconds = p.minGapToFillSeconds;
    }
    if (p.fillTransientGuardSeconds !== undefined) {
      this.opt.fillTransientGuardSeconds = p.fillTransientGuardSeconds;
    }
    if (p.minFillSeconds !== undefined) {
      this.opt.minFillSeconds = p.minFillSeconds;
    }
    if (p.fadeOutSeconds !== undefined) {
      this.opt.fadeOutSeconds = p.fadeOutSeconds;
    }
    if (
      p.maxFillConfidence !== undefined &&
      p.maxFillConfidence !== this.opt.maxFillConfidence
    ) {
      this.opt.maxFillConfidence = p.maxFillConfidence;
      dspChanged = true;
    }
    if (
      'sustainTauSeconds' in p &&
      p.sustainTauSeconds !== this.sustainTau
    ) {
      this.sustainTau = p.sustainTauSeconds;
      dspChanged = true;
    }
    if (
      'sustainGrainSeconds' in p &&
      p.sustainGrainSeconds !== this.sustainGrain
    ) {
      this.sustainGrain = p.sustainGrainSeconds;
      dspChanged = true;
    }
    // Re-render fills only if a DSP knob moved AND we'd actually use them.
    if (dspChanged && (this.opt.gapFill || this.fillBuffers.length > 0)) {
      this.precomputeFills();
    } else if (this.opt.gapFill && this.fillBuffers.length === 0) {
      this.precomputeFills();
    }

    // ── WSOLA continuous-bed stretch ───────────────────────────────────────
    let reanalyze = false; // bed analysis geometry changed → re-analyze + synth
    if (p.wsola !== undefined) this.wsolaEnabled = p.wsola;
    if (
      p.strongConfidenceThreshold !== undefined &&
      p.strongConfidenceThreshold !== this.strongConfidenceThreshold
    ) {
      // Threshold changes WHICH hits overlay AND (when the bed notch is on)
      // which hits get notched OUT of the bed — so re-derive + re-analyze.
      this.strongConfidenceThreshold = p.strongConfidenceThreshold;
      this.buildStrongIndices();
      if (this.bedTransientNotch > 0) reanalyze = true;
    }
    if (
      p.transientBodySeconds !== undefined &&
      p.transientBodySeconds !== this.transientBodySeconds
    ) {
      // Body length sets both the overlay length AND the notch width in the bed.
      this.transientBodySeconds = p.transientBodySeconds;
      if (this.bedTransientNotch > 0) reanalyze = true;
    }
    if (
      p.transientDuckDepth !== undefined &&
      p.transientDuckDepth !== this.transientDuckDepth
    ) {
      this.transientDuckDepth = p.transientDuckDepth; // next iteration
    }
    if (
      p.bedTransientNotch !== undefined &&
      p.bedTransientNotch !== this.bedTransientNotch
    ) {
      // Changing how much of the transient bodies are removed from the bed
      // rebuilds the bed SOURCE → re-analyze + re-synth.
      this.bedTransientNotch = p.bedTransientNotch;
      reanalyze = true;
    }
    if (
      p.bedNotchSeconds !== undefined &&
      p.bedNotchSeconds !== this.bedNotchSeconds
    ) {
      // Notch WIDTH changes the bed source → re-analyze + re-synth.
      this.bedNotchSeconds = p.bedNotchSeconds;
      if (this.bedTransientNotch > 0) reanalyze = true;
    }
    if (
      p.transientBlendSeconds !== undefined &&
      p.transientBlendSeconds !== this.transientBlendSeconds
    ) {
      this.transientBlendSeconds = p.transientBlendSeconds; // next iteration
    }
    if (
      p.wsolaWindowSeconds !== undefined &&
      p.wsolaWindowSeconds !== this.wsolaOpt.windowSeconds
    ) {
      this.wsolaOpt.windowSeconds = p.wsolaWindowSeconds;
      reanalyze = true;
    }
    if (
      p.wsolaHopFraction !== undefined &&
      p.wsolaHopFraction !== this.wsolaOpt.hopFraction
    ) {
      this.wsolaOpt.hopFraction = p.wsolaHopFraction;
      reanalyze = true;
    }
    if (
      p.wsolaSearchSeconds !== undefined &&
      p.wsolaSearchSeconds !== this.wsolaOpt.searchSeconds
    ) {
      this.wsolaOpt.searchSeconds = p.wsolaSearchSeconds;
      reanalyze = true;
    }
    if (reanalyze && this.wsolaEnabled) {
      this.precomputeBedAnalysis();
      this.resynthesizeBed(true);
      // Rebuilt the bed mid-playback → restart cleanly so the new bed takes over
      // from the current phase (no old/new overlap).
      if (this.playing) this.restartAtCurrentPhase();
    } else if (this.wsolaEnabled && !this.bedAnalysis) {
      // First enable: lazily build the bed analysis + synth for the live ratio.
      this.precomputeBedAnalysis();
      this.resynthesizeBed(true);
    }
  }

  /** Runtime WSOLA on/off (panel A/B), mirroring setGapFill. Builds the bed
   *  analysis + synth lazily on first enable, then RESTARTS the scheduler at the
   *  current loop phase so the two scheduling models (per-slice vs bed) never
   *  overlap — without a clean restart the already-committed audio of the old
   *  model keeps playing UNDER the new one (the "double beat / different
   *  measures" bug). */

  /** DIAGNOSTIC: solo the bed vs the overlays (admin panel) so the ear can
   *  localize a double. muteBed → hear only the crisp overlaid kick/snare;
   *  muteOverlays → hear only the stretched bed texture. Restarts so it takes
   *  effect on the current iteration. */
  setDiagnosticSolo(opts: { muteBed?: boolean; muteOverlays?: boolean }): void {
    if (opts.muteBed !== undefined) this.muteBed = opts.muteBed;
    if (opts.muteOverlays !== undefined) this.muteOverlays = opts.muteOverlays;
    if (this.playing) this.restartAtCurrentPhase();
  }

  setWsola(on: boolean): void {
    const wasOn = this.wsolaEnabled;
    this.wsolaEnabled = on;
    if (on) {
      if (!this.bedAnalysis) this.precomputeBedAnalysis();
      this.resynthesizeBed(true);
    }
    if (this.playing && wasOn !== on) {
      // Switching models mid-playback: flush in-flight audio + re-anchor so the
      // next tick schedules a single fresh stream at the SAME loop phase.
      this.restartAtCurrentPhase();
    }
  }

  /**
   * Current INPUT position within the loop (seconds in [0, loopDuration)) at the
   * audio clock NOW — robust to both scheduling models. `loopStartTime` is the
   * audio time at which input-position 0 of the *current* iteration plays (the
   * legacy path holds it there; the WSOLA path advances it by a full period when
   * it arms an iteration, so subtract whole periods to fold back into the live
   * iteration). We compute it modulo the loop so it's correct either way.
   */
  private currentInputPos(now: number): number {
    const period = this.loopPeriod;
    if (period <= 0) return 0;
    // Real-time elapsed since the anchor, folded into one loop period.
    let rel = (now - this.loopStartTime) % period;
    if (rel < 0) rel += period;
    // Convert real-time offset into the loop to INPUT seconds.
    return rel * (this.ratio || 1);
  }

  /**
   * Stop every in-flight source with a short fade (no click) and re-anchor the
   * grid so the loop CONTINUES at its current phase from `now`: the next
   * scheduleTick arms one fresh iteration whose input-position lines up with
   * where we were. Used when switching scheduling models (WSOLA toggle) so the
   * old and new streams never overlap.
   */
  private restartAtCurrentPhase(): void {
    const now = this.ctx.currentTime;
    const inputPos = this.currentInputPos(now);
    // Fade out + stop everything currently scheduled, fast, to avoid a click.
    const fade = 0.02;
    for (const { src, env } of this.active) {
      try {
        const g = env.gain;
        g.cancelScheduledValues(now);
        // Hold whatever the current value is, then ramp to 0.
        try {
          g.setValueAtTime(g.value, now);
        } catch {
          /* ignore */
        }
        g.linearRampToValueAtTime(0, now + fade);
      } catch {
        /* ignore */
      }
      try {
        src.stop(now + fade + 0.005);
      } catch {
        /* already stopped */
      }
    }
    this.active.clear();
    // Re-anchor so input-position `inputPos` plays at `now`: the iteration that
    // contains `now` started at now − inputPos/ratio. The pending fade-in of the
    // new iteration crossfades over the old tail.
    this.loopStartTime = now - inputPos / (this.ratio || 1);
    this.nextSlice = 0;
    // Schedule the fresh stream immediately so there's no audible gap.
    this.scheduleTick();
  }

  /** Snapshot of the live gap-fill + WSOLA params (for the panel to read back). */
  getGapFillParams(): GapFillParamsSnapshot {
    return {
      gapFill: this.opt.gapFill,
      minGapToFillSeconds: this.opt.minGapToFillSeconds,
      fillTransientGuardSeconds: this.opt.fillTransientGuardSeconds,
      minFillSeconds: this.opt.minFillSeconds,
      fadeOutSeconds: this.opt.fadeOutSeconds,
      maxFillConfidence: this.opt.maxFillConfidence,
      sustainTauSeconds: this.sustainTau,
      sustainGrainSeconds: this.sustainGrain,
      wsola: this.wsolaEnabled,
      strongConfidenceThreshold: this.strongConfidenceThreshold,
      wsolaWindowSeconds: this.wsolaOpt.windowSeconds ?? DEFAULTS.wsolaWindowSeconds,
      wsolaHopFraction: this.wsolaOpt.hopFraction ?? DEFAULTS.wsolaHopFraction,
      wsolaSearchSeconds:
        this.wsolaOpt.searchSeconds ?? DEFAULTS.wsolaSearchSeconds,
      transientBodySeconds: this.transientBodySeconds,
      transientDuckDepth: this.transientDuckDepth,
      bedTransientNotch: this.bedTransientNotch,
      bedNotchSeconds: this.bedNotchSeconds,
      transientBlendSeconds: this.transientBlendSeconds,
    };
  }

  /** How many slices currently have a precomputed legacy fill (diagnostics). */
  qualifyingFillCount(): number {
    return this.fillBuffers.filter((b) => b != null).length;
  }

  /** Panel diagnostic: how many bit-exact transient overlays per loop (strong
   *  hits). The continuous bed is a single buffer; this is the meaningful count. */
  textureRegionCount(): number {
    return this.strongIndices.length;
  }

  /**
   * Pre-render one extended-tail buffer per QUALIFYING slice (synchronous, at
   * load). A slice qualifies when its post-transient tail is usable (sustaining
   * — see tailIsUsable) AND it isn't a loud primary transient (confidence ≤
   * maxFillConfidence; kicks/snares are skipped — filling those is the most
   * audible false pulse). Each buffer is sized to maxFillSeconds (the most any
   * tempo could need); scheduleSlice reads only [0, gapNeeded] at the live
   * ratio. Non-qualifying slices store null. Cost: ~1ms/tail, only on the few
   * sustaining hits — invisible inside the already-synchronous construction.
   */
  private precomputeFills(): void {
    const sr = this.buffer.sampleRate;
    const teOff = transientEndOffset(sr) / sr; // transient guard (s)
    const numCh = this.buffer.numberOfChannels;
    this.fillBuffers = new Array(this.onsets.length).fill(null);
    for (let i = 0; i < this.onsets.length; i++) {
      // Loud primary transients (high confidence) never get a fill.
      if ((this.confidences[i] ?? 1) > this.opt.maxFillConfidence) continue;
      const onset = this.onsetAt(i);
      const sliceEnd = this.onsetAt(i + 1);
      // The tail SOURCE region: [onset+transientGuard, sliceEnd). Skip if the
      // transient guard already eats the whole slice.
      const tailStartSec = onset + teOff;
      if (tailStartSec >= sliceEnd) continue;
      const tailStart = Math.round(tailStartSec * sr);
      const tailEnd = Math.min(this.buffer.length, Math.round(sliceEnd * sr));
      const tailLen = tailEnd - tailStart;
      if (tailLen <= 0) continue;
      const tailChannels: Float32Array[] = [];
      for (let c = 0; c < numCh; c++) {
        tailChannels.push(
          this.buffer.getChannelData(c).subarray(tailStart, tailEnd),
        );
      }
      if (!tailIsUsable(tailChannels, sr)) continue;
      // Deterministic per-slice fill (seed = index) so reloads/tests reproduce.
      // Sustain DSP knobs (τ, grain) come from the live overrides when the admin
      // panel has set them; undefined ⇒ buildExtendedTail fits them from the tail.
      const fill = buildExtendedTail(tailChannels, sr, this.opt.maxFillSeconds, {
        seed: i + 1,
        ...(this.sustainTau != null ? { tau: this.sustainTau } : {}),
        ...(this.sustainGrain != null
          ? { grainSeconds: this.sustainGrain }
          : {}),
      });
      if (fill.length === 0 || fill[0]!.length === 0) continue;
      const buf = this.ctx.createBuffer(fill.length, fill[0]!.length, sr);
      for (let c = 0; c < fill.length; c++) buf.copyToChannel(fill[c]!, c);
      this.fillBuffers[i] = buf;
    }
  }

  /**
   * WSOLA: build the ratio-INDEPENDENT analysis of the WHOLE loop (once). The
   * bed is the entire musical loop [0, loopDuration) — one continuous piece, so
   * stretching it can never open a per-onset silence. Cost: one window build +
   * a PCM copy of the loop.
   */
  private precomputeBedAnalysis(): void {
    const sr = this.buffer.sampleRate;
    const numCh = this.buffer.numberOfChannels;
    const end = Math.min(this.buffer.length, Math.round(this.loopDuration * sr));
    if (end <= 0) {
      this.bedAnalysis = null;
      return;
    }
    // Build the bed source from a TRANSIENT-NOTCHED copy of the loop: each strong
    // hit's BODY is gain-dipped out before WSOLA. This is the fix for the
    // "doubled body, no transient" artifact — WSOLA fills a slowdown by
    // duplicating windows, and that duplication accumulates LAG (measured ~40ms
    // mid-loop, 60-110ms by the end), so a loud snare BODY left in the bed gets
    // copied to the wrong place at full gain. With the body notched out, the bed
    // carries only the inter-hit TEXTURE (where tens of ms of drift is inaudible
    // wash), and the bit-exact OVERLAYS carry ALL the transient energy at the
    // exact grid positions. Notch OFF (depth 0) ⇒ the full loop (old behavior).
    const channels: Float32Array[] = [];
    const notch = Math.min(1, Math.max(0, this.bedTransientNotch));
    for (let c = 0; c < numCh; c++) {
      channels.push(
        notch > 0
          ? this.notchTransients(this.buffer.getChannelData(c), end, notch)
          : this.buffer.getChannelData(c).subarray(0, end),
      );
    }
    const analysis = analyzeWsola(channels, sr, this.wsolaOpt);
    this.bedAnalysis = wsolaIsUsable(analysis) ? analysis : null;
  }

  /**
   * Return a COPY of `src[0,end)` with each strong transient's body gain-dipped
   * by `depth` (1 = fully removed) over a click-free window.
   *
   * THE NOTCH MUST BE WIDER THAN ONE WSOLA WINDOW. The locator showed that a
   * narrow (~50ms) notch fails: WSOLA's stretch reads source audio from across
   * the gap (a single analysis window straddles the notch and overlap-adds
   * un-notched body audio from one side into the other), rebuilding the body
   * 50–75ms downstream — the "doubled kick" even on protected hits. So the dip
   * must (a) span at least one WSOLA window + a margin, and (b) extend far enough
   * past the onset to cover the kick/snare body's natural decay (they ring
   * 100–200ms, not 50ms), so no window can find loud body audio adjacent to the
   * gap. Wide cosine ramps remove edges for WSOLA to ring on.
   */
  private notchTransients(
    src: Float32Array,
    end: number,
    depth: number,
  ): Float32Array {
    const sr = this.buffer.sampleRate;
    const out = new Float32Array(end);
    out.set(src.subarray(0, end));
    const pre = Math.round(this.opt.preRollSeconds * sr);
    const win = Math.round((this.wsolaOpt.windowSeconds ?? 0.05) * sr);
    // Notch width: at least the configured body, but never narrower than one
    // WSOLA window + a margin (so a single window can't straddle the gap with
    // un-notched body on both sides). Clamp to a musical sanity bound.
    const notchSec =
      this.bedNotchSeconds > 0 ? this.bedNotchSeconds : this.transientBodySeconds;
    const body = Math.max(
      Math.round(notchSec * sr),
      win + Math.round(0.02 * sr),
    );
    // Ramp edges ~ half a window so there's no sharp body fragment at the seam
    // for WSOLA to copy; clamp so the ramps don't overrun the dip.
    const ramp = Math.max(1, Math.min(Math.floor(body / 3), Math.round(0.02 * sr)));
    const floor = 1 - depth; // gain at the bottom of the dip
    for (const k of this.strongIndices) {
      const onset = Math.round(this.onsetAt(k) * sr);
      const dipStart = Math.max(0, onset - pre);
      const dipEnd = Math.min(end, onset + body);
      // ramp DOWN into the dip, hold at `floor`, ramp UP out of it.
      for (let i = dipStart; i < dipEnd; i++) {
        let g: number;
        const into = i - dipStart;
        const outof = dipEnd - i;
        if (into < ramp) {
          const x = into / ramp;
          g = floor + (1 - floor) * 0.5 * (1 + Math.cos(Math.PI * x));
        } else if (outof < ramp) {
          const x = outof / ramp;
          g = floor + (1 - floor) * 0.5 * (1 + Math.cos(Math.PI * x));
        } else {
          g = floor;
        }
        out[i] = out[i]! * g;
      }
    }
    return out;
  }

  /**
   * WSOLA: synthesize the continuous BED for the CURRENT ratio — the whole loop
   * stretched from loopDuration to loopDuration/ratio (longer when slowing,
   * shorter when speeding). ONE buffer. At ratio ≈ 1 there's no stretch to do
   * (and WSOLA-at-unity would only add coloration) → bed = null, the scheduler
   * plays the raw loop. `force` re-synthesizes even at an unchanged ratio (after
   * a re-analyze). Coalesced by the caller; analysis is reused so only the OLA
   * runs.
   */
  private resynthesizeBed(force = false): void {
    const ratio = this.ratio || 1;
    if (!force && ratio === this.synthesizedForRatio) return;
    this.synthesizedForRatio = ratio;
    this.bedBuffer = null;
    // At unity the raw loop already IS the continuous bed with perfect bit-exact
    // transients — skip WSOLA entirely (no coloration, no overlay needed).
    if (!this.wsolaEnabled || Math.abs(ratio - 1) < 1e-4) return;
    if (!this.bedAnalysis) return;
    const sr = this.buffer.sampleRate;
    const srcLen = Math.round(this.loopDuration * sr);
    // Bed real-time length = the loop period at this ratio. Synthesize a hair
    // LONGER than the grid period (+ one window) so scheduling can clamp the
    // played duration to the exact grid period without ever reading past the end
    // — the seam stays locked to the grid, never to the rounded buffer length.
    const outLen =
      Math.round(srcLen / ratio) +
      Math.round((this.wsolaOpt.windowSeconds ?? 0.05) * sr);
    if (outLen <= 0) return;
    const stretched = synthesizeWsola(this.bedAnalysis, outLen, this.wsolaOpt);
    if (stretched.length === 0 || stretched[0]!.length === 0) return;
    const buf = this.ctx.createBuffer(stretched.length, stretched[0]!.length, sr);
    for (let c = 0; c < stretched.length; c++) buf.copyToChannel(stretched[c]!, c);
    this.bedBuffer = buf;
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
    const changed = newRatio !== this.ratio;
    this.ratio = newRatio;
    // The GRID (loopStartTime/ratio above) updates synchronously so sync is
    // never delayed. Only the heavy WSOLA BED synth is deferred + coalesced:
    // mark dirty; the next scheduleTick synthesizes once for this latest ratio.
    if (changed && this.wsolaEnabled) this.bedResynthDirty = true;
  }

  /** Start looping at audio time `when` (default: now). */
  start(when?: number): void {
    if (this.playing) return;
    this.playing = true;
    this.loopStartTime = when ?? this.ctx.currentTime;
    this.nextSlice = 0;
    // Ensure the bed exists for the live ratio before the first scheduleTick
    // reads it (the loop may start already at a non-unity tempo).
    if (this.wsolaEnabled) {
      if (!this.bedAnalysis) this.precomputeBedAnalysis();
      this.resynthesizeBed(true);
    }
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

  /** Schedule every REGION whose start falls within the look-ahead window. */
  private scheduleTick(): void {
    if (!this.playing) return;

    // Coalesced WSOLA bed re-synth: a tempo drag set bedResynthDirty; do ONE
    // synth here for the current ratio, then cleanly RESTART so the new bed takes
    // over from the current phase and the OLD (old-ratio) bed one-shot doesn't
    // keep playing under it (the same double-beat the toggle had). The grid was
    // already re-anchored in setRatio; restartAtCurrentPhase re-anchors again
    // from the live clock and reschedules — idempotent and click-safe.
    if (this.bedResynthDirty) {
      this.bedResynthDirty = false;
      this.resynthesizeBed();
      if (this.playing) {
        this.restartAtCurrentPhase();
        return; // restartAtCurrentPhase already called scheduleTick()
      }
    }

    const now = this.ctx.currentTime;
    const horizon = now + this.opt.scheduleAheadSeconds;

    // Two scheduling models, selected by WSOLA:
    //  - WSOLA ON: schedule the WHOLE loop iteration at once (the continuous bed
    //    one-shot + every bit-exact transient overlay + the bed duck under each).
    //    Per iteration, not per onset, so there is no per-onset gap to mishandle.
    //  - WSOLA OFF: the legacy per-onset slicer (bit-exact slices, gaps re-spaced).
    let guard = 0;
    while (guard++ < 512) {
      const period = this.loopPeriod;
      if (this.wsolaEnabled) {
        // The iteration starts at loopStartTime (onset[0] === 0). Schedule it
        // when its start enters the horizon, then advance a whole period.
        if (this.loopStartTime > horizon) break;
        // If loopStartTime is already in the PAST (we re-anchored mid-loop on a
        // model/tempo switch), start the bed PARTWAY through so it continues from
        // the current phase instead of jumping to bar 1. phaseSec = how far into
        // THIS iteration we already are, in real-time seconds (0 when on-grid).
        const phaseSec = Math.max(0, now - this.loopStartTime);
        this.scheduleBedIteration(this.loopStartTime, period, phaseSec);
        this.loopStartTime += period;
        this.nextSlice = 0;
      } else {
        // Legacy per-slice path (unchanged behavior when WSOLA is off).
        const onsetReal =
          this.loopStartTime + this.onsetAt(this.nextSlice) / (this.ratio || 1);
        if (onsetReal > horizon) break;
        this.scheduleSlice(this.nextSlice, onsetReal);
        this.nextSlice++;
        if (this.nextSlice >= this.onsets.length) {
          this.nextSlice = 0;
          this.loopStartTime += period;
        }
      }
    }
  }

  /**
   * WSOLA model — schedule ONE whole loop iteration starting at `iterStart`:
   *  1. The continuous BED one-shot (the whole loop WSOLA-stretched, or the raw
   *     loop at ratio≈1) for exactly `period` real seconds — so the seam locks
   *     to the GRID, never to the rounded buffer length. No per-onset silence is
   *     possible: the bed is one continuous buffer.
   *  2. A bit-exact ATTACK overlay for each strong transient at its stretched
   *     position iterStart + onset[i]/ratio, with the BED DUCKED underneath it
   *     (duck-and-replace — summing the sharp attack onto the bed's smeared copy
   *     of the same hit would flam/comb). At ratio≈1 the raw bed already has
   *     perfect transients, so no overlay/duck is scheduled.
   */
  private scheduleBedIteration(
    iterStart: number,
    period: number,
    phaseSec = 0,
  ): void {
    const unity = Math.abs(this.ratio - 1) < 1e-4;
    const bed = !unity && this.bedBuffer ? this.bedBuffer : null;

    // 1) The bed. Fresh source + env per iteration (so per-transient ducks on
    //    this env never collide with the next iteration's automation). phaseSec
    //    > 0 ⇒ this is a partial first iteration after a mid-loop re-anchor: the
    //    bed starts that far in so playback continues from the current phase.
    //    Always SCHEDULE it (keeps timing identical) — DIAGNOSTIC muteBed just
    //    zeroes its gain so there's no silent gap glitch when soloing.
    const bedEnv = this.scheduleBed(iterStart, period, bed, phaseSec);
    if (bedEnv && this.muteBed) {
      try {
        bedEnv.gain.cancelScheduledValues(this.ctx.currentTime);
        bedEnv.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {
        /* ignore */
      }
    }

    // 2) Transient overlays + ducks. Skipped at unity (raw bed already perfect)
    //    or when muteOverlays is on (hear only the bed). When the BED is muted we
    //    still want the overlays — so we don't early-return on a null bedEnv;
    //    instead we just skip the duck when there's no bed env to duck.
    if (unity || this.muteOverlays) return;
    if (!bed) return; // no synthesized bed (e.g. not yet ready) → nothing to overlay
    const bedMuted = this.muteBed;
    const body = this.transientBodySeconds;
    const blend = Math.max(0.002, this.transientBlendSeconds); // crossfade width
    const release = Math.max(0.015, this.opt.fadeOutSeconds * 2);
    const depth = Math.min(1, Math.max(0, this.transientDuckDepth)); // bed floor
    const minHit = this.ctx.currentTime - 0.001; // skip hits already in the past
    for (let k = 0; k < this.strongIndices.length; k++) {
      const i = this.strongIndices[k]!;
      const onset = this.onsetAt(i);
      const tHit = iterStart + onset / (this.ratio || 1);
      // After a mid-loop re-anchor, skip transients whose time already passed.
      if (tHit < minHit) continue;
      // Clamp the overlay body so it can't run into the next strong hit.
      const nextStrong =
        k + 1 < this.strongIndices.length
          ? iterStart + this.onsetAt(this.strongIndices[k + 1]!) / (this.ratio || 1)
          : iterStart + period;
      const bodyDur = Math.max(
        0.005,
        Math.min(body, nextStrong - tHit - 0.005),
      );

      // 2a) CROSSFADE the bed under the hit (instead of a hard duck-and-hold).
      //     The bed fades DOWN to `depth` as the overlay fades IN (over `blend`,
      //     centered so it bottoms at the attack), holds only as long as the
      //     overlay body, then fades back UP — using EQUAL-POWER (cosine) curves
      //     so bed+overlay sum to constant loudness with NO audible hole. This is
      //     the fix for the "prominent ducking" — they blend, not gate.
      if (bedEnv && !bedMuted) {
        try {
          const g = bedEnv.gain;
          const downStart = Math.max(this.ctx.currentTime, tHit - blend);
          const bottomAt = tHit; // bed lowest exactly at the attack
          const upStart = tHit + bodyDur;
          const upEnd = upStart + blend;
          // equal-power dip 1→depth: cos²-shaped so it pairs with the overlay's
          // sin² fade-in (their squared sum is constant).
          const STEPS = 16;
          const down = new Float32Array(STEPS);
          for (let n = 0; n < STEPS; n++) {
            const x = n / (STEPS - 1); // 0..1 over the blend
            const c = Math.cos((Math.PI / 2) * x); // 1→0
            down[n] = depth + (1 - depth) * c * c; // 1→depth, equal-power
          }
          const up = new Float32Array(STEPS);
          for (let n = 0; n < STEPS; n++) {
            const x = n / (STEPS - 1);
            const s = Math.sin((Math.PI / 2) * x); // 0→1
            up[n] = depth + (1 - depth) * s * s; // depth→1, equal-power
          }
          g.setValueAtTime(1, downStart);
          g.setValueCurveAtTime(down, downStart, bottomAt - downStart);
          g.setValueAtTime(depth, upStart);
          g.setValueCurveAtTime(up, upStart, upEnd - upStart);
        } catch {
          /* automation past-time / out-of-order — bed just stays at unity */
        }
      }

      // 2b) The crisp bit-exact attack on its OWN source, with an equal-power
      //     fade-in over `blend` (sin²) that pairs with the bed's cos² dip, and a
      //     fade-out over `blend` as the bed recovers — a true crossfade.
      const readStart = Math.max(0, onset - this.opt.preRollSeconds);
      this.playBuffer(
        this.buffer,
        Math.max(this.ctx.currentTime, tHit - this.opt.preRollSeconds),
        readStart,
        bodyDur + this.opt.preRollSeconds,
        this.opt.fadeInSeconds,
        blend, // fade out over the blend as the bed ramps back — crossfade
      );
    }
  }

  /**
   * Schedule the continuous bed one-shot and RETURN its env GainNode so the
   * caller can duck it under transients. `bed` null ⇒ play the RAW loop (ratio≈1
   * or no synth yet). Plays for exactly `period` real seconds (grid-locked seam).
   * Registered in `active` for stop()/teardown like every other source.
   */
  private scheduleBed(
    when: number,
    period: number,
    bed: AudioBuffer | null,
    phaseSec = 0,
  ): GainNode | null {
    let src: AudioBufferSourceNode;
    let env: GainNode;
    try {
      src = this.ctx.createBufferSource();
      env = this.ctx.createGain();
      src.connect(env);
      env.connect(this.output);
    } catch {
      return null;
    }
    // Partial first iteration (mid-loop re-anchor): start the bed `phaseSec` in
    // and play only the remainder, so playback continues from the current phase
    // instead of restarting the measure. The bed is already in stretched
    // real-time, so a real-time phase offset maps 1:1 to a buffer offset.
    const offset = Math.max(0, phaseSec);
    const playDur = Math.max(0.001, period - offset);
    const startAt = Math.max(this.ctx.currentTime, when + offset);
    const fadeIn = this.opt.fadeInSeconds;
    const fadeOut = this.opt.fadeOutSeconds;
    if (bed) {
      src.buffer = bed;
      src.playbackRate.value = 1;
      try {
        const audibleEnd = startAt + playDur;
        const foutStart = Math.max(startAt + fadeIn, audibleEnd - fadeOut);
        const g = env.gain;
        g.setValueAtTime(0, startAt);
        g.linearRampToValueAtTime(1, startAt + fadeIn);
        // NOTE: per-transient ducks are scheduled by the caller AFTER this, on
        // top of the (1) hold — they slot between fadeIn end and foutStart.
        g.setValueAtTime(1, foutStart);
        g.linearRampToValueAtTime(0, audibleEnd);
      } catch {
        /* unity fallback */
      }
      try {
        src.start(startAt, offset, playDur + 0.001);
      } catch {
        try {
          env.disconnect();
        } catch {
          /* ignore */
        }
        return null;
      }
    } else {
      // Raw loop (ratio≈1): play [offset, loopDuration) bit-exact.
      src.buffer = this.buffer;
      src.playbackRate.value = 1;
      try {
        const audibleEnd = startAt + playDur;
        const foutStart = Math.max(startAt + fadeIn, audibleEnd - fadeOut);
        const g = env.gain;
        g.setValueAtTime(0, startAt);
        g.linearRampToValueAtTime(1, startAt + fadeIn);
        g.setValueAtTime(1, foutStart);
        g.linearRampToValueAtTime(0, audibleEnd);
      } catch {
        /* unity fallback */
      }
      try {
        src.start(startAt, offset, playDur + 0.001);
      } catch {
        try {
          env.disconnect();
        } catch {
          /* ignore */
        }
        return null;
      }
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
    return env;
  }

  /** Create + schedule one slice source with a declick/overlap envelope (LEGACY
   *  per-onset slicer — used only when WSOLA is OFF). */
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
    const audibleEnd = when + sliceBufferDur;
    this.playBuffer(
      this.buffer,
      when,
      readStart,
      sliceBufferDur,
      this.opt.fadeInSeconds,
      this.opt.fadeOutSeconds,
    );

    // Legacy granular gap-fill (A/B fallback when WSOLA off + gapFill on).
    if (!this.wsolaEnabled && this.opt.gapFill && this.ratio < 1) {
      const fillBuf = this.fillBuffers[index];
      if (fillBuf) {
        const nextStartReal =
          this.loopStartTime + this.onsetAt(index + 1) / (this.ratio || 1);
        const gap = nextStartReal - audibleEnd;
        if (gap > this.opt.minGapToFillSeconds) {
          const fillStart = audibleEnd - this.opt.fadeOutSeconds;
          const dur = Math.min(
            gap + this.opt.fadeOutSeconds - this.opt.fillTransientGuardSeconds,
            fillBuf.duration,
          );
          if (dur >= this.opt.minFillSeconds) {
            this.playBuffer(
              fillBuf,
              Math.max(this.ctx.currentTime, fillStart),
              0,
              dur,
              this.opt.fadeOutSeconds,
              this.opt.fadeOutSeconds,
            );
          }
        }
      }
    }
  }

  /**
   * Schedule one AudioBufferSource → env(GainNode) → output with a trapezoidal
   * declick envelope, registered in `active` for stop()/teardown. Shared by the
   * slice, the transient overlay, and the legacy fill so all honour the
   * master-bus stop discipline.
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
