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
  /** Extra gap cut off each slice's TAIL beyond the pre-roll handoff (s). 0 =
   *  tail meets the next slice's pre-roll exactly; >0 opens a gap (kills seam
   *  overlap / flam); <0 overlaps the tails. Live-tunable seam control. */
  sliceTailTrimSeconds?: number;
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
  /** Duck-IN (going-into-the-hit) ramp length (s). 0 = symmetric with
   *  transientBlendSeconds. >0 = ease into the duck more slowly than the release
   *  — softens the "spikes going in" at heavy notch. */
  transientDuckAttackSeconds?: number;
  /** UNIFIED BIG-HIT REGION (the clean fix). When bigHitTailSeconds > 0, the span
   *  [onset − bigHitPre, onset + bigHitTail] is BOTH notched out of the bed AND
   *  played as the bit-exact overlay — one region, so the overlay refills exactly
   *  the bed's hole. bigHitPre catches the attack-front blip; bigHitTail (≤0.3s)
   *  swallows the kick/snare sub-bass body. Overrides the legacy split params. */
  bigHitPreSeconds?: number;
  bigHitTailSeconds?: number;
  /** BED NOTCH region (decoupled from the overlay). Independent pre/tail so the bed
   *  hole and the overlay can be blended separately. Default to the overlay values. */
  bedNotchPreSeconds?: number;
  bedNotchTailSeconds?: number;
  /** BIG-HIT overlay ENVELOPE — continuous levels (0..1) + nudgeable start/end.
   *  preRoll = look-ahead read; levels = start/peak/end gain; attack/release =
   *  ramp lengths; startNudge/endNudge = ± shift the begin/finish in time. */
  hitPreRollSeconds?: number;
  hitStartLevel?: number;
  hitPeakLevel?: number;
  hitEndLevel?: number;
  hitAttackSeconds?: number;
  hitReleaseSeconds?: number;
  hitStartNudgeSeconds?: number;
  hitEndNudgeSeconds?: number;
  /** Big-hit LENGTH (s) — explicit hit duration (drives bodyDur). 0 = auto. */
  transientLengthSeconds?: number;

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
  transientDuckAttackSeconds?: number;
  // Big-hit region — overlay span (independent from the bed notch).
  bigHitPreSeconds?: number;
  bigHitTailSeconds?: number;
  // Bed notch span (independent from the overlay).
  bedNotchPreSeconds?: number;
  bedNotchTailSeconds?: number;
  hitPreRollSeconds?: number;
  hitStartLevel?: number;
  hitPeakLevel?: number;
  hitEndLevel?: number;
  hitAttackSeconds?: number;
  hitReleaseSeconds?: number;
  hitStartNudgeSeconds?: number;
  hitEndNudgeSeconds?: number;
  transientLengthSeconds?: number;
  // SLICE-PATH seam controls (home tempo + while nudging). The flam between
  // adjacent bit-exact slices lives here.
  slicePreRollSeconds?: number;
  sliceFadeInSeconds?: number;
  sliceFadeOutSeconds?: number;
  sliceTailTrimSeconds?: number;
  // State-machine TIMING (the SLICES↔BED transitions). Live, no rebuild.
  settleMs?: number;
  xfadeToBedSeconds?: number;
  xfadeToSlicesSeconds?: number;
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
  transientDuckAttackSeconds: number;
  bigHitPreSeconds: number;
  bigHitTailSeconds: number;
  bedNotchPreSeconds: number;
  bedNotchTailSeconds: number;
  hitPreRollSeconds: number;
  hitStartLevel: number;
  hitPeakLevel: number;
  hitEndLevel: number;
  hitAttackSeconds: number;
  hitReleaseSeconds: number;
  hitStartNudgeSeconds: number;
  hitEndNudgeSeconds: number;
  transientLengthSeconds: number;
  slicePreRollSeconds: number;
  sliceFadeInSeconds: number;
  sliceFadeOutSeconds: number;
  sliceTailTrimSeconds: number;
  settleMs: number;
  xfadeToBedSeconds: number;
  xfadeToSlicesSeconds: number;
}

/** A scheduling region: either ONE bit-exact strong-transient slice, or a span
 *  of texture onsets to be WSOLA-stretched as a single continuous piece. Both
 *  carry the onset-index half-open range [startIndex, endIndex) so the
 *  scheduler can reuse the EXACT same `loopStartTime + onset/ratio` grid math
 *  as the flat slicer (region boundaries are a subset of the onset grid). */
export type DrumRegion =
  | { kind: 'transient'; startIndex: number; endIndex: number }
  | { kind: 'texture'; startIndex: number; endIndex: number };

/** TWO-TRACK (2026-06-06): the BIG-HITS track is the complement of the bed notch —
 *  only the kick/snare regions, kept bit-exact, to be RE-GRIDDED (not stretched) at
 *  each ratio and played as a 2nd continuous source. Unlike the bed it needs NO
 *  WSOLA analysis (the hits aren't stretched, just repositioned). This holds one
 *  pre-extracted region per strong hit, ratio-independent (built once at load). */
interface DrumHit {
  /** Input-domain onset position of this hit (seconds, on the musical loop). */
  readonly onsetSec: number;
  /** Bit-exact PCM of [onset − pre, onset + tail], one Float32Array per channel,
   *  already edge-faded (declick). Copied straight into the hits buffer at the
   *  re-gridded position onsetSec/ratio. */
  readonly channels: Float32Array[];
  /** Where the onset sits INSIDE `channels` (= round(pre*sr)). The region starts
   *  `leadSamples` before the onset, so placement aligns the onset to the grid. */
  readonly leadSamples: number;
}
interface HitsAnalysis {
  readonly hits: DrumHit[];
  readonly sampleRate: number;
  readonly numChannels: number;
}

/** State of the Realtime/Rendered drum tempo machine. SLICES = the user is
 *  nudging (per-slice path, smooth); BED = settled (full WSOLA bed + overlays);
 *  the two XFADE_* are the in-flight equal-power crossfades between them. */
export type DrumTempoMode =
  | 'SLICES'
  | 'XFADE_TO_BED'
  | 'BED'
  | 'XFADE_TO_SLICES';

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
    sliceTailTrimSeconds: 0, // 0 = tail meets next slice's pre-roll exactly
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
    bedTransientNotch: 1.0, // FULL notch — remove the kick/snare body ENTIRELY from
    // the bed so the bit-exact overlay is the ONLY copy of each hit. Any residual
    // (e.g. 0.7 = 30% kept) plays UNDER the overlay and, being WSOLA-smeared, lands
    // slightly off the grid-exact overlay → an audible DOUBLE. Removing it fully is
    // the only way the two layers glue into one hit (user's ear, 2026-06-06). The
    // overlay body (transientBodySeconds/bodyDur) must span the resulting hole so
    // the bed doesn't gap — that's what the overlay length controls are for.
    bedNotchSeconds: 0.09, // NARROWER notch (was 0.14): the overlay body must span
    // the notch hole after it stretches at slow ratio. 0.09 ≈ transient core, still
    // > 1 WSOLA window (0.025), so the bed seam stays clean.
    transientBlendSeconds: 0.115, // (4) bed FADE-IN to the transient (release width)
    // (3) Duck-IN (bed ramps DOWN going into the hit). 0 = symmetric with the blend.
    transientDuckAttackSeconds: 0,
    // ── UNIFIED BIG-HIT REGION (notch + overlay = same span). ON by default so the
    // bed is clean of the kick/snare and the overlay carries the whole hit. ──
    bigHitPreSeconds: 0.039, // OVERLAY lead-in — catches the attack-front blip (ear)
    bigHitTailSeconds: 0.2, // OVERLAY tail length (the hit the user hears)
    bedNotchPreSeconds: 0.037, // BED notch start (dialed by ear)
    bedNotchTailSeconds: 0.13, // BED notch length — swallows the body out of the bed
    // ── BIG-HIT overlay ENVELOPE (continuous levels + nudgeable start/end) ──
    hitPreRollSeconds: 0, // look-ahead: audio read BEFORE the onset (0 = opt default)
    hitStartLevel: 0, // gain at the start point (0..1)
    hitPeakLevel: 1, // gain at the top of the attack (0..1)
    hitEndLevel: 0, // gain at the end point (0..1)
    hitAttackSeconds: 0, // attack ramp length (0 = opt.fadeInSeconds)
    hitReleaseSeconds: 0, // release/tail ramp length (0 = use blend)
    hitStartNudgeSeconds: 0, // ± shift START point in time
    hitEndNudgeSeconds: 0, // ± shift END point in time
    transientLengthSeconds: 0, // explicit hit length (drives bodyDur; 0 = auto)
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

  // ── REALTIME/RENDERED TEMPO STATE MACHINE ──────────────────────────────────
  // Drums switch engine by what the USER is doing, mirroring DAWs (Adobe Audition
  // Realtime↔Rendered) + the élastique transient-handling scheme:
  //   • WHILE NUDGING tempo  → the per-slice path (smooth, no jump, bit-exact).
  //   • WHEN SETTLED (~350ms) → the full WSOLA bed + transient overlays (correct
  //     hat placement at the held tempo — the sound the user prefers).
  // Cross-faded via two sub-mix gains (sliceGain ⇄ bedGain). The bed re-renders in
  // the BACKGROUND during the slice phase, so the swap-in never has the "jump"
  // (restartAtCurrentPhase) the old always-bed path had on every nudge.
  /** Master switch: true → the state machine drives the mode; false → legacy
   *  manual behaviour (admin "Smooth stretch" A/B), exactly as before. */
  private autoMode: boolean;
  /** Current state. SLICES = nudging; BED = settled; the two XFADE_* are the
   *  in-flight equal-power crossfades between them. */
  private mode: DrumTempoMode = 'SLICES';
  /** Sub-mix buses: per-slice sources → sliceGain, bed+overlays → bedGain; the
   *  crossfade rides these two gain params. Null only if createGain throws. */
  private sliceGain: GainNode | null = null;
  private bedGain: GainNode | null = null;
  /** Debounce: every nudge bumps the generation + restarts the timer; only the
   *  latest generation's timer fires onSettled. */
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private settleGeneration = 0;
  /** Monotonic cursor: the NEXT bed iteration's start time to arm (advances by
   *  period as each enters the horizon). null when not in a bed phase → re-seeded
   *  to the iteration containing `now` on entry. This is the single authority for
   *  bed arming; it never moves backward, so the active set can't leak. */
  private bedIterStart: number | null = null;
  /** Audio time the in-flight crossfade finishes — checked at the top of
   *  scheduleTick to flip XFADE_* → terminal SLICES/BED (never flip synchronously
   *  mid-ramp, or the outgoing engine cuts out before the incoming reaches full). */
  private xfadeDoneAt = 0;
  /** Settle debounce window (ms) — UI-interaction concept, not sample-accurate.
   *  Also the gate that keeps the bed synth OUT of active nudging: the heavy synth
   *  runs only once nudging has paused (in crossfadeToBed at settle). */
  private static readonly SETTLE_MS_DEFAULT = 350;
  /** Equal-power crossfade length (s), SLICES → BED (settle). Longer = a gentler,
   *  more gradual landing into the bed once the tempo settles; shorter = a transient
   *  is less likely to land mid-fade (where it can dip). */
  private static readonly XFADE_TO_BED_S_DEFAULT = 0.15;
  /** Equal-power crossfade length (s), BED → SLICES (nudge). SHORT — the user is
   *  interacting, slices must take over near-instantly to track the tempo. */
  private static readonly XFADE_TO_SLICES_S_DEFAULT = 0.15;
  /** LIVE-tunable copies (admin panel). Defaults from the *_DEFAULT statics. */
  private settleMs = DrumSlicePlayer.SETTLE_MS_DEFAULT;
  private xfadeToBedS = DrumSlicePlayer.XFADE_TO_BED_S_DEFAULT;
  private xfadeToSlicesS = DrumSlicePlayer.XFADE_TO_SLICES_S_DEFAULT;

  private strongConfidenceThreshold: number;
  private wsolaOpt: WsolaOptions;
  private transientBodySeconds: number;
  private transientDuckDepth: number;
  private bedTransientNotch: number;
  private bedNotchSeconds: number;
  private transientBlendSeconds: number;
  /** Duck-IN ramp length (s). 0 = symmetric with transientBlendSeconds. */
  private transientDuckAttackSeconds = 0;
  /** UNIFIED BIG-HIT REGION (2026-06-06, user design). ONE span per strong hit,
   *  [onset − bigHitPre, onset + bigHitTail], that is BOTH (a) notched OUT of the
   *  bed and (b) played as the bit-exact overlay — so the overlay refills EXACTLY
   *  the hole the notch leaves: no leak (kick body in the bed), no chopped-bed hole.
   *   - bigHitPreSeconds: how far BEFORE the detected onset to start (catches the
   *     attack-front blip the old notch started too late to remove).
   *   - bigHitTailSeconds: how far AFTER (up to ~0.3s) — long enough to swallow the
   *     kick/snare sub-bass BODY that rings ~250ms (the big slow wave in the bed).
   *  When > 0 these OVERRIDE the legacy split params (bedNotchSeconds for the notch,
   *  transientBodySeconds/preRollSeconds for the overlay). Live-tunable; the notch
   *  side triggers a bed re-analyze.
   *
   *  DECOUPLED (2026-06-06): the bigHit* pair now drives the OVERLAY only; the bed
   *  notch has its OWN pair (bedNotchPre/TailSeconds) so the two layers can be blended
   *  INDEPENDENTLY (e.g. notch a wide hole but let the overlay tail ring shorter, or
   *  vice-versa). The panel "link" keeps them equal when you want the glued behaviour.
   *  Notch defaults mirror the overlay so out-of-the-box they're still matched. */
  private bigHitPreSeconds = 0; // OVERLAY lead-in
  private bigHitTailSeconds = 0; // OVERLAY tail length
  private bedNotchPreSeconds = 0; // BED notch start before onset
  private bedNotchTailSeconds = 0; // BED notch length after onset
  /** SLICE-PATH tuning (the bit-exact per-onset path = home tempo + while nudging).
   *  These shape the seam BETWEEN adjacent slices, where the home-tempo flam lives.
   *  Live-tunable so the seam can be dialed by ear. */
  private slicePreRollSeconds: number; // audio read before each onset (declick lead-in)
  private sliceFadeInSeconds: number; // slice attack declick ramp
  private sliceFadeOutSeconds: number; // slice tail declick ramp
  /** Extra gap cut off each slice's TAIL beyond the pre-roll handoff (s). 0 = tail
   *  meets the next slice's pre-roll exactly; >0 opens a gap (kills seam overlap /
   *  flam); <0 lets the tails overlap (fatter, but can double). */
  private sliceTailTrimSeconds = 0;
  /** BIG-HIT overlay ENVELOPE (continuous levels 0..1 + nudgeable start/end).
   *  Replaces the old binary 0→1→0. Length (how long the hit plays before the
   *  bed) is still transientLengthSeconds (drives bodyDur); these shape the gain. */
  private hitPreRollSeconds = 0; // look-ahead: audio read BEFORE the onset
  private hitStartLevel = 0; // gain at the start point
  private hitPeakLevel = 1; // gain at the top of the attack
  private hitEndLevel = 0; // gain at the end point
  private hitAttackSeconds = 0; // attack ramp (0 = use fadeInSeconds)
  private hitReleaseSeconds = 0; // release/tail ramp (0 = use blend)
  private hitStartNudgeSeconds = 0; // ± shift the START point in time
  private hitEndNudgeSeconds = 0; // ± shift the END point in time
  private transientLengthSeconds = 0; // explicit length (drives bodyDur; 0 = auto)
  /** DIAGNOSTIC solo flags (admin panel): mute the bed to hear ONLY the crisp
   *  overlaid kicks/snares, or mute the overlays to hear ONLY the bed texture —
   *  so the ear can localize where a double lives. Not shipped to users. */
  private muteBed = false;
  private muteOverlays = false;
  /** TWO-TRACK A/B: true → play the pre-rendered hitsBuffer as a 2nd continuous
   *  source (no live per-hit overlays = no nudge spill). false → the legacy live
   *  per-hit overlay scheduling. Default ON; toggle via setTwoTrack for A/B. */
  private useTwoTrack = true;
  /** TWO-TRACK: high-pass cutoff (Hz) applied to the BED so it carries only texture
   *  (mids/highs); the bit-exact hits track carries the low end. Kills any sub-bass
   *  that leaks past the notch/WSOLA so it can't double the kick. 0 = off. */
  private bedHighpassHz = 90;

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
  private active = new Set<{
    src: AudioBufferSourceNode;
    env: GainNode;
    /** Which scheduling layer armed this source — so a new BED phase can fade-stop
     *  the PREVIOUS bed's sources (one-shot + overlays) and not leave them ringing
     *  under the new bed (the overlapping-drum-loops bug). 'bedOverlay' = the
     *  bit-exact kick/snare overlay on the bed bus; distinguished from the
     *  continuous 'bed' texture so a nudge-out can HARD-kill the overlay (its
     *  transient would spill a kick into the bed during the fade) while gently
     *  fading the texture. */
    kind: 'bed' | 'bedOverlay' | 'slice';
  }>();

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
  /** TWO-TRACK: pre-extracted bit-exact hit regions (complement of the bed notch),
   *  built ONCE at load. Re-gridded per ratio into `hitsBuffer`. null ⇒ no hits. */
  private hitsAnalysis: HitsAnalysis | null = null;
  /** The synthesized continuous bed for the CURRENT ratio (the whole loop
   *  stretched, one buffer). null ⇒ not synthesized / play raw. Rebuilt
   *  (coalesced) on a ratio change. */
  private bedBuffer: AudioBuffer | null = null;
  /** TWO-TRACK: the BIG-HITS buffer for the CURRENT ratio — bit-exact hits placed
   *  at their re-gridded positions, silence between. Built alongside bedBuffer. */
  private hitsBuffer: AudioBuffer | null = null;
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
    // Sub-mix buses for the Realtime/Rendered crossfade: per-slice sources route
    // to sliceGain, the bed one-shot + its transient overlays route to bedGain;
    // a crossfade is just an equal-power ramp on these two. Start on SLICES
    // (sliceGain=1, bedGain=0). If createGain throws, sliceOut/bedOut fall back to
    // the raw output (the machine then no-ops the crossfade — degrades to slices).
    try {
      this.sliceGain = ctx.createGain();
      this.bedGain = ctx.createGain();
      this.sliceGain.gain.value = 1;
      this.bedGain.gain.value = 0;
      this.sliceGain.connect(output);
      this.bedGain.connect(output);
    } catch {
      this.sliceGain = null;
      this.bedGain = null;
    }
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
    // The Realtime/Rendered state machine drives the mode by default. If the
    // player is constructed with WSOLA forced ON (admin/env A/B), start in manual
    // mode so the legacy always-bed behaviour is preserved exactly.
    this.autoMode = !this.opt.wsola;
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
    this.transientDuckAttackSeconds =
      this.opt.transientDuckAttackSeconds ?? 0;
    this.bigHitPreSeconds = this.opt.bigHitPreSeconds ?? 0;
    this.bigHitTailSeconds = this.opt.bigHitTailSeconds ?? 0;
    // Bed notch defaults to the overlay values (matched out of the box); decoupled
    // once the user moves the bed-notch sliders independently.
    this.bedNotchPreSeconds =
      this.opt.bedNotchPreSeconds ?? this.bigHitPreSeconds;
    this.bedNotchTailSeconds =
      this.opt.bedNotchTailSeconds ?? this.bigHitTailSeconds;
    // Slice-path seam controls default to the existing opt values (no behaviour
    // change until the panel moves them).
    this.slicePreRollSeconds = this.opt.preRollSeconds;
    this.sliceFadeInSeconds = this.opt.fadeInSeconds;
    this.sliceFadeOutSeconds = this.opt.fadeOutSeconds;
    this.sliceTailTrimSeconds = this.opt.sliceTailTrimSeconds ?? 0;
    this.hitPreRollSeconds = this.opt.hitPreRollSeconds ?? 0;
    this.hitStartLevel = this.opt.hitStartLevel ?? 0;
    this.hitPeakLevel = this.opt.hitPeakLevel ?? 1;
    this.hitEndLevel = this.opt.hitEndLevel ?? 0;
    this.hitAttackSeconds = this.opt.hitAttackSeconds ?? 0;
    this.hitReleaseSeconds = this.opt.hitReleaseSeconds ?? 0;
    this.hitStartNudgeSeconds = this.opt.hitStartNudgeSeconds ?? 0;
    this.hitEndNudgeSeconds = this.opt.hitEndNudgeSeconds ?? 0;
    this.transientLengthSeconds = this.opt.transientLengthSeconds ?? 0;
    // Derive which onsets get a bit-exact overlay (cheap). The bed analysis +
    // legacy fills are only built when their feature is on (lazy, like before).
    this.buildStrongIndices();
    if (this.wsolaEnabled) this.precomputeBedAnalysis();
    // WSOLA wins when both flags are on; only build legacy fills if WSOLA is off.
    if (!this.wsolaEnabled && this.opt.gapFill) this.precomputeFills();
  }

  /** Sub-mix sink for per-slice sources (falls back to the raw output if the
   *  crossfade gains couldn't be created). */
  private get sliceOut(): AudioNode {
    return this.sliceGain ?? this.output;
  }
  /** Sub-mix sink for the bed one-shot + its transient overlays. */
  private get bedOut(): AudioNode {
    return this.bedGain ?? this.output;
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
    let reextractHits = false; // TWO-TRACK: hit span changed → re-extract + re-grid
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
    if (p.transientDuckAttackSeconds !== undefined) {
      this.transientDuckAttackSeconds = p.transientDuckAttackSeconds; // next iter
    }
    // OVERLAY span (bigHit*) — TWO-TRACK: now defines the BIG-HITS buffer (extracted
    // regions). Changing it re-extracts the hits + rebuilds the hits buffer, but does
    // NOT re-run the (expensive) bed WSOLA analysis — only the cheap hit extraction.
    if (
      p.bigHitPreSeconds !== undefined &&
      p.bigHitPreSeconds !== this.bigHitPreSeconds
    ) {
      this.bigHitPreSeconds = p.bigHitPreSeconds;
      reextractHits = true;
    }
    if (
      p.bigHitTailSeconds !== undefined &&
      p.bigHitTailSeconds !== this.bigHitTailSeconds
    ) {
      this.bigHitTailSeconds = p.bigHitTailSeconds;
      reextractHits = true;
    }
    // BED NOTCH span (bedNotch*) — baked into the bed → RE-ANALYZE on change.
    if (
      p.bedNotchPreSeconds !== undefined &&
      p.bedNotchPreSeconds !== this.bedNotchPreSeconds
    ) {
      this.bedNotchPreSeconds = p.bedNotchPreSeconds;
      if (this.bedNotchTailSeconds > 0) reanalyze = true;
    }
    if (
      p.bedNotchTailSeconds !== undefined &&
      p.bedNotchTailSeconds !== this.bedNotchTailSeconds
    ) {
      this.bedNotchTailSeconds = p.bedNotchTailSeconds;
      reanalyze = true; // notch span changed (or toggled) → rebuild the bed
    }
    // SLICE-PATH seam controls — all live, applied to the next scheduled slice.
    if (p.slicePreRollSeconds !== undefined) {
      this.slicePreRollSeconds = p.slicePreRollSeconds;
    }
    if (p.sliceFadeInSeconds !== undefined) {
      this.sliceFadeInSeconds = p.sliceFadeInSeconds;
    }
    if (p.sliceFadeOutSeconds !== undefined) {
      this.sliceFadeOutSeconds = p.sliceFadeOutSeconds;
    }
    if (p.sliceTailTrimSeconds !== undefined) {
      this.sliceTailTrimSeconds = p.sliceTailTrimSeconds;
    }
    // BIG-HIT envelope — all live, applied to the next overlay.
    if (p.hitPreRollSeconds !== undefined) this.hitPreRollSeconds = p.hitPreRollSeconds;
    if (p.hitStartLevel !== undefined) this.hitStartLevel = p.hitStartLevel;
    if (p.hitPeakLevel !== undefined) this.hitPeakLevel = p.hitPeakLevel;
    if (p.hitEndLevel !== undefined) this.hitEndLevel = p.hitEndLevel;
    if (p.hitAttackSeconds !== undefined) this.hitAttackSeconds = p.hitAttackSeconds;
    if (p.hitReleaseSeconds !== undefined)
      this.hitReleaseSeconds = p.hitReleaseSeconds;
    if (p.hitStartNudgeSeconds !== undefined)
      this.hitStartNudgeSeconds = p.hitStartNudgeSeconds;
    if (p.hitEndNudgeSeconds !== undefined)
      this.hitEndNudgeSeconds = p.hitEndNudgeSeconds;
    if (p.transientLengthSeconds !== undefined) {
      this.transientLengthSeconds = p.transientLengthSeconds; // next iteration
    }
    // ── State-machine TIMING (live, no rebuild — used on the next transition) ──
    if (p.settleMs !== undefined) this.settleMs = p.settleMs;
    if (p.xfadeToBedSeconds !== undefined) this.xfadeToBedS = p.xfadeToBedSeconds;
    if (p.xfadeToSlicesSeconds !== undefined)
      this.xfadeToSlicesS = p.xfadeToSlicesSeconds;
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
    // The bed is used in BOTH the legacy WSOLA path AND the auto state machine
    // (the BED phase), so its rebuild must trigger in EITHER — gating on
    // wsolaEnabled alone silently no-op'd panel tuning in the default auto mode.
    const bedActive = this.wsolaEnabled || this.autoMode;
    if (reanalyze && bedActive) {
      this.precomputeBedAnalysis();
      this.resynthesizeBed(true);
      // In LEGACY mode restart so the new bed takes over from the current phase.
      // In AUTO mode DON'T restart — fade-stop the OLD bed sources (so the new
      // buffer doesn't stack under them) and re-seed the cursor so the next tick
      // arms the fresh bed at the live phase, keeping the SLICES↔BED flow intact.
      if (this.playing && !this.autoMode) {
        this.restartAtCurrentPhase();
      } else if (this.playing) {
        this.stopBedSources(this.ctx.currentTime + 0.02);
        this.bedIterStart = null; // re-arm fresh bed next tick
      }
    } else if (bedActive && !this.bedAnalysis) {
      // First enable: lazily build the bed analysis + synth for the live ratio.
      this.precomputeBedAnalysis();
      this.resynthesizeBed(true);
    } else if (reextractHits && bedActive) {
      // TWO-TRACK hits-only change: re-extract the bit-exact hit regions and rebuild
      // the hits buffer for the live ratio — WITHOUT the expensive bed WSOLA
      // re-analysis (the bed didn't change). Re-arm so the fresh hits buffer plays.
      this.hitsAnalysis = this.extractHits();
      this.resynthesizeBed(true); // rebuilds hitsBuffer (+ bed, cheap if same ratio)
      if (this.playing && !this.autoMode) {
        this.restartAtCurrentPhase();
      } else if (this.playing) {
        this.stopBedSources(this.ctx.currentTime + 0.02);
        this.bedIterStart = null;
      }
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
    const prevMuteOverlays = this.muteOverlays;
    const prevMuteBed = this.muteBed;
    if (opts.muteBed !== undefined) this.muteBed = opts.muteBed;
    if (opts.muteOverlays !== undefined) this.muteOverlays = opts.muteOverlays;
    // TWO-TRACK: the hits are a SINGLE ~15s one-shot (bedOverlay), armed up to a
    // whole loop ahead. The legacy per-hit overlays finished in ms, so a mute flag
    // read fresh next tick was enough; the long hits one-shot does NOT — once armed
    // it plays the whole loop regardless of the flag. So when a solo TOGGLES, stop
    // the in-flight bed sources and re-arm so the new mute state takes effect now
    // (else bed-solo still hears the already-armed hits = "bed too loud"). Auto mode
    // is fine to re-seed the bed cursor; it doesn't disrupt SLICES↔BED.
    const soloChanged =
      this.muteOverlays !== prevMuteOverlays || this.muteBed !== prevMuteBed;
    if (this.playing && this.useTwoTrack && soloChanged) {
      this.stopBedSources(this.ctx.currentTime + 0.02);
      this.bedIterStart = null; // re-arm the bed + hits at the new mute state
    }
    // The flags are read FRESH each tick by scheduleBedIteration, so the next
    // bed iteration applies them. In AUTO mode a restart would disrupt the live
    // SLICES↔BED flow (the whole point is to hear the solo IN the real playback,
    // settling from slices into the bed exactly as a user would). Only the legacy
    // always-bed path needs a restart to re-arm at the new mute state.
    if (this.playing && !this.autoMode && !this.useTwoTrack) {
      this.restartAtCurrentPhase();
    }
  }

  /** Manual WSOLA toggle (admin "Smooth stretch" A/B). Forces the legacy binary
   *  model and DISABLES the Realtime/Rendered state machine, so the two never
   *  fight over the sub-mix gains. Sets sliceGain/bedGain to match the manual
   *  choice (else, in auto-mode's resting state, bedGain=0 would silence the
   *  manually-enabled bed). */
  setWsola(on: boolean): void {
    const wasOn = this.wsolaEnabled;
    this.wsolaEnabled = on;
    this.autoMode = false; // manual A/B owns the mode now
    // Route the sub-mix to the manual choice: WSOLA on → bed bus, off → slice bus.
    if (this.sliceGain) this.sliceGain.gain.value = on ? 0 : 1;
    if (this.bedGain) this.bedGain.gain.value = on ? 1 : 0;
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

  /** Enable/disable the Realtime/Rendered state machine (the auto slices↔bed
   *  switch). ON re-arms it to the resting SLICES state. OFF hands control to the
   *  manual paths (setWsola), which set the sub-mix gains themselves. */
  setAutoMode(on: boolean): void {
    this.autoMode = on;
    if (!on) return;
    this.mode = 'SLICES';
    this.bedIterStart = null;
    if (this.sliceGain) this.sliceGain.gain.value = 1;
    if (this.bedGain) this.bedGain.gain.value = 0;
  }

  /** TWO-TRACK A/B (dev): true → pre-rendered hits buffer (no nudge spill); false →
   *  legacy live per-hit overlays. Re-seed the bed cursor so the next tick arms the
   *  chosen path cleanly. */
  setTwoTrack(on: boolean): void {
    if (this.useTwoTrack === on) return;
    this.useTwoTrack = on;
    if (this.playing) {
      this.stopBedSources(this.ctx.currentTime + 0.02);
      this.bedIterStart = null; // re-arm with the new path next tick
    }
  }

  /** Live state for the dev A/B tool + tests (not shipped UI). */
  getDebugState(): {
    autoMode: boolean;
    mode: DrumTempoMode;
    bedReady: boolean;
    ratio: number;
    twoTrack: boolean;
    hitsReady: boolean;
  } {
    return {
      autoMode: this.autoMode,
      mode: this.mode,
      bedReady: this.synthesizedForRatio === this.ratio && !!this.bedBuffer,
      ratio: this.ratio,
      twoTrack: this.useTwoTrack,
      hitsReady:
        this.synthesizedForRatio === this.ratio && !!this.hitsBuffer,
    };
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
      transientDuckAttackSeconds: this.transientDuckAttackSeconds,
      bigHitPreSeconds: this.bigHitPreSeconds,
      bigHitTailSeconds: this.bigHitTailSeconds,
      bedNotchPreSeconds: this.bedNotchPreSeconds,
      bedNotchTailSeconds: this.bedNotchTailSeconds,
      hitPreRollSeconds: this.hitPreRollSeconds,
      hitStartLevel: this.hitStartLevel,
      hitPeakLevel: this.hitPeakLevel,
      hitEndLevel: this.hitEndLevel,
      hitAttackSeconds: this.hitAttackSeconds,
      hitReleaseSeconds: this.hitReleaseSeconds,
      hitStartNudgeSeconds: this.hitStartNudgeSeconds,
      hitEndNudgeSeconds: this.hitEndNudgeSeconds,
      transientLengthSeconds: this.transientLengthSeconds,
      slicePreRollSeconds: this.slicePreRollSeconds,
      sliceFadeInSeconds: this.sliceFadeInSeconds,
      sliceFadeOutSeconds: this.sliceFadeOutSeconds,
      sliceTailTrimSeconds: this.sliceTailTrimSeconds,
      settleMs: this.settleMs,
      xfadeToBedSeconds: this.xfadeToBedS,
      xfadeToSlicesSeconds: this.xfadeToSlicesS,
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
    // TWO-TRACK: also extract the big-hits (complement of the notch) at load. Cheap
    // (a few array copies), ratio-independent, re-gridded per ratio in resynthesizeBed.
    this.hitsAnalysis = this.extractHits();
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
    const win = Math.round((this.wsolaOpt.windowSeconds ?? 0.05) * sr);
    // DECOUPLED BED NOTCH (bedNotchTailSeconds > 0): the notch span =
    // [onset − bedNotchPre, onset + bedNotchTail], INDEPENDENT of the overlay span.
    // Pre catches the attack-front blip; tail (≤300ms) swallows the sub-bass body.
    // Else fall back to the legacy split (preRoll + bedNotchSeconds).
    const usePre =
      this.bedNotchTailSeconds > 0
        ? this.bedNotchPreSeconds
        : this.opt.preRollSeconds;
    const pre = Math.round(usePre * sr);
    const notchSec =
      this.bedNotchTailSeconds > 0
        ? this.bedNotchTailSeconds
        : this.bedNotchSeconds > 0
          ? this.bedNotchSeconds
          : this.transientBodySeconds;
    // Width: at least the configured tail, but never narrower than one WSOLA window
    // + a margin (a single window must not straddle the gap with un-notched body on
    // both sides → WSOLA would rebuild the body downstream = the "doubled kick").
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
      // The ramp-down must REACH the floor BY the onset, so the attack itself is
      // fully dipped — not still near 1 mid-ramp. The down-ramp occupies the LAST
      // `downRamp` samples before the onset; if there isn't room (onset at the
      // buffer start, e.g. the downbeat), it shrinks to whatever lead exists — so a
      // hit with no pre-roll lead gets floor immediately at the onset (no leak).
      const leadAvail = onset - dipStart; // samples available before the onset
      const downRamp = Math.min(ramp, leadAvail);
      const downStart = onset - downRamp; // ramp 1→floor over [downStart, onset]
      for (let i = dipStart; i < dipEnd; i++) {
        let g: number;
        const outof = dipEnd - i;
        if (i < downStart) {
          g = 1; // before the down-ramp begins (untouched lead, if any)
        } else if (i < onset) {
          const x = (i - downStart) / Math.max(1, downRamp); // 0→1 over the ramp
          g = floor + (1 - floor) * 0.5 * (1 + Math.cos(Math.PI * x)); // 1→floor
        } else if (outof < ramp) {
          const x = outof / ramp;
          g = floor + (1 - floor) * 0.5 * (1 + Math.cos(Math.PI * x)); // floor→1 out
        } else {
          g = floor; // held at the floor across the body (incl. the attack)
        }
        out[i] = out[i]! * g;
      }
    }
    return out;
  }

  /**
   * TWO-TRACK (2026-06-06): extract the BIG-HITS as bit-exact regions — the
   * complement of the bed notch. For each strong hit, copy [onset − pre, onset +
   * tail] per channel from the RAW loop, edge-faded (declick), tagged with the input
   * onset position. These are re-gridded (NOT stretched) into the hits buffer at each
   * ratio. The span uses the OVERLAY params (bigHitPre/Tail) — the hits the user
   * hears; the bed notch (bedNotchPre/Tail) cuts the complementary hole, so
   * bed + hits ≈ the full loop with no leak and no double (Landmines L1/L3: keep them
   * matched, or the bed's residual combs with the hit). Pure; sets nothing.
   */
  private extractHits(): HitsAnalysis | null {
    const sr = this.buffer.sampleRate;
    const numCh = this.buffer.numberOfChannels;
    const end = Math.min(this.buffer.length, Math.round(this.loopDuration * sr));
    if (end <= 0 || this.strongIndices.length === 0) return null;
    // Span matches the overlay region (what the user hears). Fall back to the legacy
    // body/preRoll when the unified params are off.
    const preSec =
      this.bigHitTailSeconds > 0 ? this.bigHitPreSeconds : this.opt.preRollSeconds;
    const tailSec =
      this.bigHitTailSeconds > 0
        ? this.bigHitTailSeconds
        : this.transientBodySeconds;
    const lead = Math.max(0, Math.round(preSec * sr));
    const tail = Math.max(1, Math.round(tailSec * sr));
    // Declick fades at the region edges (short — the attack must survive).
    const fadeIn = Math.max(1, Math.round(this.opt.fadeInSeconds * sr));
    const fadeOut = Math.max(1, Math.round(this.opt.fadeOutSeconds * sr));
    const hits: DrumHit[] = [];
    for (const k of this.strongIndices) {
      const onsetSamp = Math.round(this.onsetAt(k) * sr);
      const readStart = Math.max(0, onsetSamp - lead);
      const readEnd = Math.min(end, onsetSamp + tail);
      const len = readEnd - readStart;
      if (len <= 1) continue;
      const leadSamples = onsetSamp - readStart; // where the onset sits in the region
      const channels: Float32Array[] = [];
      for (let c = 0; c < numCh; c++) {
        const src = this.buffer.getChannelData(c);
        const region = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          let g = 1;
          if (i < fadeIn) g = i / fadeIn; // ramp in
          const outFromEnd = len - 1 - i;
          if (outFromEnd < fadeOut) g = Math.min(g, outFromEnd / fadeOut); // ramp out
          region[i] = src[readStart + i]! * g;
        }
        channels.push(region);
      }
      hits.push({ onsetSec: this.onsetAt(k), channels, leadSamples });
    }
    if (hits.length === 0) return null;
    return { hits, sampleRate: sr, numChannels: numCh };
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
    this.hitsBuffer = null; // TWO-TRACK: clear stale hits too (rebuilt below)
    // The bed is needed by the legacy WSOLA path AND the auto state machine (which
    // crossfades to it on settle). At unity the raw loop already IS the continuous
    // bed with perfect bit-exact transients — skip WSOLA entirely (no coloration).
    // (At unity the raw loop also carries the hits, so the hits track stays null.)
    if ((!this.wsolaEnabled && !this.autoMode) || Math.abs(ratio - 1) < 1e-4) {
      return;
    }
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
    // TWO-TRACK: HIGH-PASS the bed. The bed is TEXTURE (mids/highs); the bit-exact
    // hits track carries ALL the low end. Any sub-bass that survived the notch (a
    // kick body ringing past the window, WSOLA smear, an un-notched low hat) is
    // removed here at the SOURCE — the bed simply cannot contain lows to leak/double
    // against the hits. Cutoff = bedHighpassHz (0 ⇒ off). Applied per channel before
    // the buffer is built.
    if (this.bedHighpassHz > 0) {
      for (let c = 0; c < stretched.length; c++) {
        this.highpassInPlace(stretched[c]!, sr, this.bedHighpassHz);
      }
    }
    const buf = this.ctx.createBuffer(stretched.length, stretched[0]!.length, sr);
    for (let c = 0; c < stretched.length; c++) buf.copyToChannel(stretched[c]!, c);
    this.bedBuffer = buf;
    // TWO-TRACK: build the BIG-HITS buffer for this ratio alongside the bed.
    this.resynthesizeHits(outLen);
  }

  /** One-pole high-pass, in place. Removes sub-bass from the bed so only the
   *  bit-exact hits track carries the low end (two-track). Gentle (6 dB/oct) — just
   *  enough to kill the leaked kick body without thinning the texture. */
  private highpassInPlace(x: Float32Array, sr: number, fc: number): void {
    const dt = 1 / sr;
    const rc = 1 / (2 * Math.PI * fc);
    const a = rc / (rc + dt);
    let prevX = x[0] ?? 0;
    let prevY = 0;
    for (let i = 0; i < x.length; i++) {
      const cur = x[i]!;
      prevY = a * (prevY + cur - prevX);
      prevX = cur;
      x[i] = prevY;
    }
  }

  /**
   * TWO-TRACK: build the BIG-HITS buffer for the current ratio — the bit-exact hit
   * regions RE-GRIDDED (not stretched) to their slowed/sped positions, silence
   * between (the bed fills the gaps). Same length (`outLen`) and grid-lock as the
   * bed (Landmine L2), so the two continuous tracks stay phase-aligned: a hit's
   * ONSET lands at exactly `onsetSec/ratio` in real time, the same instant the bed's
   * notch hole sits. Overlapping regions (a long tail running into the next hit at a
   * fast tempo) are ADDED — they're the same recording, summing is correct. No live
   * per-hit scheduling = nothing to spill on a nudge.
   */
  private resynthesizeHits(outLen: number): void {
    this.hitsBuffer = null;
    const ha = this.hitsAnalysis;
    if (!ha || outLen <= 0) return;
    const ratio = this.ratio || 1;
    const sr = ha.sampleRate;
    const numCh = ha.numChannels;
    // Accumulate (sum) each hit's region at its re-gridded onset position.
    const out: Float32Array[] = [];
    for (let c = 0; c < numCh; c++) out.push(new Float32Array(outLen));
    for (const hit of ha.hits) {
      // The onset's real-time sample position at this ratio; the region starts
      // `leadSamples` before it so the onset lands exactly on the grid.
      const onsetPos = Math.round((hit.onsetSec / ratio) * sr);
      const start = onsetPos - hit.leadSamples;
      const regionLen = hit.channels[0]?.length ?? 0;
      for (let c = 0; c < numCh; c++) {
        const region = hit.channels[c]!;
        const dst = out[c]!;
        for (let i = 0; i < regionLen; i++) {
          const d = start + i;
          if (d < 0 || d >= outLen) continue;
          dst[d]! += region[i]!; // sum — bit-exact regions of the same recording
        }
      }
    }
    try {
      const buf = this.ctx.createBuffer(numCh, outLen, sr);
      for (let c = 0; c < numCh; c++) buf.copyToChannel(out[c]!, c);
      this.hitsBuffer = buf;
    } catch {
      this.hitsBuffer = null;
    }
  }

  /** The real-time loop period at the current ratio (on the MUSICAL loop). */
  private get loopPeriod(): number {
    return this.loopDuration / (this.ratio || 1);
  }

  /**
   * Audio-context time of the next loop DOWNBEAT (the loop "one") at or after
   * `now` — the SINGLE reliable musical seam the drums land on. The drum loop
   * grid is a STATE (`loopStartTime`) that `setRatio` re-anchors by exact
   * phase-continuity algebra at every tempo change, so this value is stable
   * across many incremental tempo clicks (it is NOT re-derived from a read-head
   * each call). A pending KEY change should quantise to THIS so the re-pitched
   * bass note lands on the same "one" the drums do (bass/harmony loop the same
   * musical length from the same T0, so the drum downbeat IS their seam too).
   *
   * `loopStartTime` is usually ALREADY one period in the FUTURE (scheduleTick
   * advances it when it arms an iteration), so we fold it back onto the grid
   * origin that precedes/contains `now`, then step to the first grid point ≥ now.
   * Returns null when not playing / no period.
   */
  getNextDownbeat(now: number): number | null {
    const period = this.loopPeriod;
    if (!this.playing || !(period > 0)) return null;
    const k = Math.floor((now - this.loopStartTime) / period);
    let next = this.loopStartTime + k * period; // grid point ≤ now (within ε)
    while (next < now - 1e-6) next += period; // first grid point ≥ now
    return next;
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
      // NORMAL case (SLICES): loopStartTime ≤ pivot and within one period — use the
      // ORIGINAL unfolded transform (`rel·oldRatio`) so an in-SLICES nudge is
      // byte-identical to the legacy smooth path (a modulo here can snap the grid
      // by up to a full period at the rel≈0 / rel≈period boundary → choppy).
      // BED case: BED mode leaves loopStartTime ~1 period AHEAD, so `rel` is large
      // negative — THERE fold modulo to recover the live phase.
      const period = this.loopPeriod;
      const rel = pivot - this.loopStartTime;
      const inputPos =
        rel >= 0 && rel < period
          ? rel * this.ratio // original, exact, no modulo
          : this.currentInputPos(pivot); // fold only when stale/future
      this.loopStartTime = pivot - inputPos / newRatio;
    }
    const changed = newRatio !== this.ratio;
    this.ratio = newRatio;
    // The GRID (loopStartTime/ratio above) updated synchronously so cross-stem
    // sync is never delayed, in BOTH modes.
    if (!changed) return;

    if (!this.autoMode) {
      // Legacy manual path: defer the WSOLA bed re-synth + restart to the next
      // tick (the "jump"), exactly as before.
      if (this.wsolaEnabled) this.bedResynthDirty = true;
      return;
    }

    // AUTO: this is a NUDGE — drive the Realtime/Rendered state machine.
    this.onNudge();
  }

  /** A tempo nudge: be on SLICES (smooth) while interacting — NO bed synth here —
   *  and (re)start the settle debounce. The bed is built once, at settle. */
  private onNudge(): void {
    if (!this.playing) return;
    // If we were showing (or fading to) the bed, get back to slices IMMEDIATELY
    // so the bit-exact path tracks the tempo — NEVER restartAtCurrentPhase.
    if (this.mode === 'BED' || this.mode === 'XFADE_TO_BED') {
      this.crossfadeToSlices();
    }
    const gen = ++this.settleGeneration;

    // NO bed synth DURING active nudging — that is the whole point of the SLICES
    // phase being as smooth as the original pure-slice mode. The heavy ~145-234ms
    // resynthesizeBed() blocks the main thread and starves the 25ms scheduler
    // (60ms horizon) → dropped slices → choppy nudging. A separate "pre-render"
    // timer (PRERENDER_MS) fired between deliberate clicks (gap > debounce) and
    // ran that block once PER click → exactly the chop the user heard. Removed.
    // The bed is synthesized ONCE, at SETTLE, in crossfadeToBed (masked by the
    // crossfade + the post-synth re-anchor). During nudging: zero heavy work.

    // (Re)start the settle timer; only the latest generation may fire onSettled.
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      if (gen === this.settleGeneration) this.onSettled();
    }, this.settleMs);
  }

  /** Tempo has settled — cross-fade from slices to the full WSOLA bed (correct
   *  hat placement at the held tempo). Stays on slices at unity (no bed). */
  private onSettled(): void {
    this.settleTimer = null;
    if (!this.playing || !this.autoMode) return;
    if (Math.abs(this.ratio - 1) < 1e-4) {
      this.mode = 'SLICES'; // unity: the raw loop IS correct; no bed to fade to
      return;
    }
    this.crossfadeToBed();
  }

  /** Equal-power (sin²/cos²) crossfade: ramp `up` 0→1 and `down` 1→0 over `dur`
   *  starting at `start`. Squares sum to 1 → constant power, no dip/bump at the
   *  seam. Mirrors the per-transient blend curves used in scheduleBedIteration. */
  private equalPowerXfade(
    up: AudioParam,
    down: AudioParam,
    start: number,
    dur: number,
  ): void {
    const STEPS = 16;
    const upCurve = new Float32Array(STEPS);
    const downCurve = new Float32Array(STEPS);
    for (let n = 0; n < STEPS; n++) {
      const x = n / (STEPS - 1);
      const s = Math.sin((Math.PI / 2) * x);
      const c = Math.cos((Math.PI / 2) * x);
      upCurve[n] = s * s; // 0→1
      downCurve[n] = c * c; // 1→0
    }
    const t0 = Math.max(this.ctx.currentTime, start);
    try {
      up.cancelScheduledValues(t0);
      down.cancelScheduledValues(t0);
      up.setValueCurveAtTime(upCurve, t0, dur);
      down.setValueCurveAtTime(downCurve, t0, dur);
    } catch {
      // Overlapping/past-time automation → hard switch (no crossfade).
      try {
        up.setValueAtTime(1, t0);
        down.setValueAtTime(0, t0);
      } catch {
        /* ignore */
      }
    }
  }

  /** Fade-stop every currently-scheduled BED source (the whole-loop one-shot + its
   *  transient overlays) by `stopAt`, with a tiny gain ramp to avoid a click. Used
   *  when a NEW bed phase begins so the old bed (a long ~15s one-shot at the OLD
   *  ratio) doesn't keep playing UNDER the new one. Slice sources are untouched. */
  private stopBedSources(stopAt: number): void {
    const now = this.ctx.currentTime;
    const fadeEnd = Math.max(now + 0.005, stopAt);
    // A bit-exact kick/snare OVERLAY armed AHEAD on the bed bus will still fire its
    // transient even mid-fade if the fade is long — that's the "kick spills into the
    // bed while nudging" bug. So overlays get a HARD, short kill (declick only); the
    // continuous bed TEXTURE (no transient to spill) fades gently over `stopAt`.
    const overlayKill = Math.min(fadeEnd, now + 0.008);
    for (const entry of this.active) {
      if (entry.kind !== 'bed' && entry.kind !== 'bedOverlay') continue;
      const isOverlay = entry.kind === 'bedOverlay';
      const end = isOverlay ? overlayKill : fadeEnd;
      try {
        const g = entry.env.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(0, end);
      } catch {
        /* ignore */
      }
      try {
        entry.src.stop(end + 0.005);
      } catch {
        /* already stopped, or future-armed (silenced via env above regardless) */
      }
    }
  }

  /** Settle → BED: ensure a fresh-ratio bed exists, arm it, and equal-power
   *  crossfade sliceGain↓ / bedGain↑ — aligned to the next loop downbeat so the
   *  bed's loud transient overlays enter on the "one", not mid-bar. */
  private crossfadeToBed(): void {
    if (!this.sliceGain || !this.bedGain || !this.playing) return;
    // GUARD: never arm the bed before the loop's first downbeat (T0, the count-in
    // end). If a settle timer somehow fires during the count-in, the bed would
    // re-anchor to `now` and play under the count. Re-arm the settle to just after
    // the downbeat instead of crossfading now. (Belt-and-suspenders for the T0-
    // anchored settle timer in start().)
    const beforeDownbeat = this.loopStartTime - this.ctx.currentTime;
    if (beforeDownbeat > 0.01) {
      const gen = this.settleGeneration;
      if (this.settleTimer) clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(
        () => {
          if (gen === this.settleGeneration) this.onSettled();
        },
        beforeDownbeat * 1000 + this.settleMs,
      );
      return;
    }
    // Synthesize the bed for the settled ratio HERE — once, after nudging has
    // paused (SETTLE_MS). This is the ONLY place the heavy ~145-234ms synth runs,
    // so it never touches the smooth SLICES nudging. Coalesced by
    // synthesizedForRatio (a no-op if the ratio was already built). The post-synth
    // re-anchor below folds out the synth's main-thread stall so the bed stays in
    // phase with bass.
    if (this.synthesizedForRatio !== this.ratio) {
      this.resynthesizeBed(); // NOT restartAtCurrentPhase
    }
    if (!this.bedBuffer) {
      this.mode = 'SLICES'; // no bed (unity / synth failed) → stay on slices
      return;
    }
    // CRITICAL — stop the PREVIOUS bed phase's sources before arming the new one.
    // The bed one-shot is a ~15s source; without this, the old bed keeps playing
    // under the new bed (a different ratio) → 2nd/3rd drum loops STACK on every
    // settle (the overlapping-loops bug). Fade them so the swap is clickless; the
    // crossfade then brings the fresh bed in over the (now ending) old tail.
    this.stopBedSources(
      this.ctx.currentTime + this.xfadeToBedS,
    );
    this.mode = 'XFADE_TO_BED';
    const now = this.ctx.currentTime;
    // CRITICAL — re-anchor the grid to the LIVE clock AFTER the synth block above.
    // resynthesizeBed is a ~234ms SYNCHRONOUS main-thread stall; during it the
    // audio clock advances and bass/harmony keep playing, but loopStartTime was
    // frozen. Without this fold, the bed arms ~234ms off the bass grid, and the
    // error ACCUMULATES one synth-block per settle (the "first slow-down fine,
    // second totally out of sync" bug). currentInputPos reads the post-block clock
    // and folds modulo the period, so this erases the stall and can't accumulate.
    const inputPos = this.currentInputPos(now);
    this.loopStartTime = now - inputPos / (this.ratio || 1);
    this.bedIterStart = null; // re-seed the bed cursor to the live iteration
    // Cross in promptly. The bed is phase-continuous (it arms partway through via
    // phaseSec), so crossing at `now` is seamless. Nudge it to the next downbeat
    // ONLY when that's imminent (≤ one crossfade away) so the loud transient
    // overlays land on the "one" — never defer by a whole loop (~18s) for it.
    const db = this.getNextDownbeat(now);
    const start =
      db != null && db - now <= this.xfadeToBedS ? db : now;
    this.equalPowerXfade(
      this.bedGain.gain,
      this.sliceGain.gain,
      start,
      this.xfadeToBedS,
    );
    this.xfadeDoneAt = start + this.xfadeToBedS;
  }

  /** Nudge → SLICES: equal-power crossfade bedGain↓ / sliceGain↑ from NOW (the
   *  user is interacting — slices must track the tempo without lag). */
  private crossfadeToSlices(): void {
    if (!this.sliceGain || !this.bedGain) return;
    const now = this.ctx.currentTime;
    // CRITICAL — fade-stop the bed's sources, symmetric to crossfadeToBed. The bed
    // schedules a WHOLE loop's worth of bit-exact kick/snare OVERLAYS up to ~15s
    // AHEAD. Fading bedGain alone does NOT stop those future overlay sources — they
    // fire at full volume during the slice phase = "loud kicks spitting through
    // from nothing", and they ACCUMULATE across settles (down→down→up). Stopping
    // them here is the missing counterpart: crossfadeToBed cleaned up on the way
    // IN; nothing cleaned up on the way OUT until now.
    this.stopBedSources(now + this.xfadeToSlicesS);
    this.bedIterStart = null; // bed phase ended; re-seed on next entry
    // CRITICAL re-anchor: pure BED mode advances loopStartTime per-period until
    // it's PAST the horizon (up to a full loop ~18s in the FUTURE). The slice path
    // schedules at loopStartTime + onset/ratio, so without re-anchoring, every
    // onsetReal would be far in the future → NO slices scheduled → silence until
    // the future loopStartTime is reached (the "drums go silent while speeding up
    // until I stop clicking" bug). Fold the grid back so the CURRENT input
    // position plays at `now`, then point nextSlice at the next onset.
    const inputPos = this.currentInputPos(now);
    this.loopStartTime = now - inputPos / (this.ratio || 1);
    let i = 0;
    while (i < this.onsets.length && this.onsetAt(i) < inputPos) i++;
    this.nextSlice = i % this.onsets.length;
    this.mode = 'XFADE_TO_SLICES';
    this.equalPowerXfade(
      this.sliceGain.gain,
      this.bedGain.gain,
      now,
      this.xfadeToSlicesS,
    );
    this.xfadeDoneAt = now + this.xfadeToSlicesS;
  }

  /** Start looping at audio time `when` (default: now). */
  start(when?: number): void {
    if (this.playing) return;
    this.playing = true;
    this.loopStartTime = when ?? this.ctx.currentTime;
    this.nextSlice = 0;
    // Ensure the bed exists for the live ratio before the first scheduleTick
    // reads it (the loop may start already at a non-unity tempo). Built for the
    // legacy WSOLA path AND auto mode (so a settle can crossfade to a ready bed).
    if (this.wsolaEnabled || this.autoMode) {
      if (!this.bedAnalysis) this.precomputeBedAnalysis();
      this.resynthesizeBed(true);
    }
    // AUTO start-at-held-tempo: if the loop STARTS at a non-unity tempo (replay
    // after nudging, or any pre-set tempo), there's no nudge coming — the tempo is
    // ALREADY settled. Start DIRECTLY in BED instead of SLICES-then-crossfade.
    // SLICES is for the smooth WHILE-nudging draft only; starting in it just to
    // crossfade to the bed adds a needless 250ms two-engine overlap at the very
    // first downbeat (the artifact risk the user flagged). The bed was rendered
    // above (resynthesizeBed) and the bed cursor seeds itself from the live grid in
    // scheduleTick, so the bed simply arms at T0 — clean, no slices, no crossfade.
    // At unity we stay on SLICES (the raw loop IS correct; there's no bed).
    if (this.autoMode && Math.abs(this.ratio - 1) >= 1e-4 && this.bedBuffer) {
      this.mode = 'BED';
      this.bedIterStart = null; // seed the bed cursor at the first tick
      this.xfadeDoneAt = 0; // not mid-crossfade
      if (this.sliceGain) this.sliceGain.gain.value = 0;
      if (this.bedGain) this.bedGain.gain.value = 1;
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
    // Invalidate any pending settle (the player is recreated, not reused, so a
    // late onSettled must be a no-op) and reset to the resting state.
    if (this.settleTimer != null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    this.settleGeneration++;
    this.mode = 'SLICES';
    this.bedIterStart = null;
    if (this.sliceGain) this.sliceGain.gain.value = 1;
    if (this.bedGain) this.bedGain.gain.value = 0;
    const now = this.ctx.currentTime;
    const stopAt = when ?? now;
    for (const { src, env } of this.active) {
      // ZERO the env gain immediately, THEN stop the source. The gain mute is the
      // load-bearing part: a bed one-shot armed ~60ms AHEAD (startAt in the future)
      // can't be stopped by src.stop(stopAt) when stopAt < startAt — that throws
      // InvalidStateError (esp. WebKit, our audio target), gets swallowed, and the
      // bed then plays its full ~15s period AFTER stop (the "drum loop keeps going
      // to the end of the loop after I hit stop" bug, un-masked by the master
      // restore). Muting env.gain to 0 NOW silences it regardless of whether
      // src.stop() succeeds, no-ops, or throws. Same technique as stopBedSources.
      try {
        const g = env.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(0, now);
      } catch {
        /* ignore */
      }
      try {
        src.stop(stopAt);
      } catch {
        /* already stopped, or future-armed (now silenced via env above) */
      }
    }
    this.active.clear();
  }

  /** Schedule every REGION whose start falls within the look-ahead window. */
  private scheduleTick(): void {
    if (!this.playing) return;

    const now = this.ctx.currentTime;

    // ── AUTO state machine: flip in-flight crossfades to their terminal state
    // once the equal-power ramp has finished. Done here (not synchronously when
    // the crossfade is started) so the OUTGOING engine keeps scheduling until the
    // INCOMING one is fully up — never a mid-ramp cut-out.
    if (this.autoMode && now >= this.xfadeDoneAt) {
      if (this.mode === 'XFADE_TO_BED') this.mode = 'BED';
      else if (this.mode === 'XFADE_TO_SLICES') this.mode = 'SLICES';
    }

    // ── AUTO bed re-render is NOT done on the tick (it's ~145-234ms of SYNCHRONOUS
    // main-thread work that would starve the scheduler and drop slices). It runs
    // exactly once, in crossfadeToBed, AFTER nudging settles — never during the
    // smooth SLICES nudging.

    // ── LEGACY (manual / admin A/B) bed re-synth + RESTART. Only when the state
    // machine is OFF; the auto path never sets bedResynthDirty, and even if it
    // did this gate keeps the jump out of auto mode.
    if (this.bedResynthDirty && !this.autoMode) {
      this.bedResynthDirty = false;
      this.resynthesizeBed();
      if (this.playing) {
        this.restartAtCurrentPhase();
        return; // restartAtCurrentPhase already called scheduleTick()
      }
    }

    const horizon = now + this.opt.scheduleAheadSeconds;

    if (!this.autoMode) {
      // ── LEGACY binary model (byte-for-byte as before): WSOLA bed OR per-slice,
      // selected by wsolaEnabled. Preserved exactly so the admin A/B is untouched.
      let guard = 0;
      while (guard++ < 512) {
        const period = this.loopPeriod;
        if (this.wsolaEnabled) {
          if (this.loopStartTime > horizon) break;
          const phaseSec = Math.max(0, now - this.loopStartTime);
          this.scheduleBedIteration(this.loopStartTime, period, phaseSec);
          this.loopStartTime += period;
          this.nextSlice = 0;
        } else {
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
      return;
    }

    // ── AUTO mode multiplexer.
    //   scheduleSlicesNow = mode != BED      (SLICES + both crossfades)
    //   scheduleBedNow     = mode != SLICES  (BED + both crossfades), bed exists
    const scheduleSlicesNow = this.mode !== 'BED';
    const scheduleBedNow = this.mode !== 'SLICES' && !!this.bedBuffer;

    // ── BED arming. CRITICAL FIX: the previous loop advanced loopStartTime by
    // period WHILE arming a bed each step, so when crossfadeToBed left
    // loopStartTime in the PAST (it re-anchors to ≤ now), one tick armed MANY
    // overlapping one-shots (active-source leak 27→63) AND beds armed at a far-past
    // anchor got phaseSec > bufferDuration → played past the buffer end → SILENCE.
    // Now: maintain a dedicated `bedIterStart` cursor that is the start of the
    // CURRENT bed iteration, arm each iteration exactly ONCE (guarded), and only
    // advance the cursor to the next iteration when the current one has elapsed —
    // arming the next one slightly AHEAD (within the horizon) so its downbeat plays.
    if (scheduleBedNow) {
      const period = this.loopPeriod;
      // `bedIterStart` is a MONOTONIC cursor = the next bed iteration to arm.
      // On (re)entry it's null → seed it to the iteration CONTAINING `now` (folded
      // to ≤ now, so its partial remainder plays from the live phase). Thereafter
      // it only ADVANCES by period — never re-anchored to the past — so each
      // iteration is armed exactly once and the active set can't leak.
      if (this.bedIterStart == null) {
        if (this.loopStartTime > now + 0.001) {
          // Loop hasn't STARTED yet (count-in: loopStartTime = T0, the downbeat in
          // the future). Seed the cursor AT T0 so the bed's first iteration begins
          // exactly on the downbeat — the `bedIterStart <= horizon` guard below
          // keeps it from arming until T0 is within the 60ms look-ahead, so the bed
          // never sounds during the count-in.
          this.bedIterStart = this.loopStartTime;
        } else {
          // Loop already running (mid-play re-entry): fold to the iteration
          // containing `now` so its partial remainder plays from the live phase.
          const inputPos = this.currentInputPos(now);
          this.bedIterStart = now - inputPos / (this.ratio || 1); // ≤ now
        }
      }
      // Arm every not-yet-armed iteration whose start is within the look-ahead
      // horizon, advancing the cursor. phaseSec>0 only for the first (partial)
      // iteration after a (re)sync; full iterations arm at phaseSec 0 (downbeat).
      let guard = 0;
      while (this.bedIterStart <= horizon && guard++ < 8) {
        const phaseSec = Math.max(0, now - this.bedIterStart);
        this.scheduleBedIteration(this.bedIterStart, period, phaseSec);
        this.bedIterStart += period;
      }
    }

    // ── SLICE scheduling (owns the cursor + grid advancement when it runs).
    if (scheduleSlicesNow) {
      const period = this.loopPeriod;
      // CRITICAL anti-FLOOD guard (parity with the bed cursor above). A stale
      // re-anchor — setRatio's currentInputPos fold leaving loopStartTime ~1 period
      // behind without re-pointing nextSlice, or a BED phase that froze
      // loopStartTime in the PAST — would otherwise make the loop below schedule
      // EVERY onset of each stale iteration, all clamped to `now` by scheduleSlice
      // → dozens of bit-exact kicks STACKED at full volume (the tempo-nudge
      // "explosion": 40-120 slices, peak 2.8, on every click). Fold the grid up to
      // the iteration containing `now` (whole periods → phase-neutral) and re-point
      // nextSlice at the first FUTURE onset, so we never replay the past.
      if (period > 0 && this.loopStartTime < now - period) {
        const behind = Math.floor((now - this.loopStartTime) / period);
        this.loopStartTime += behind * period;
        const inputPos = this.currentInputPos(now);
        let i = 0;
        while (i < this.onsets.length && this.onsetAt(i) < inputPos) i++;
        this.nextSlice = i % this.onsets.length;
      }
      let guard = 0;
      while (guard++ < 512) {
        const onsetReal =
          this.loopStartTime + this.onsetAt(this.nextSlice) / (this.ratio || 1);
        if (onsetReal > horizon) break;
        // SKIP — never STACK — onsets already in the past (sub-period stale anchor
        // / timer jitter). scheduleSlice would clamp them all to `now` and pile up.
        if (onsetReal < now - 1e-4) {
          this.nextSlice++;
          if (this.nextSlice >= this.onsets.length) {
            this.nextSlice = 0;
            this.loopStartTime += period;
          }
          continue;
        }
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

    // 1b) TWO-TRACK: the hits come from the pre-rendered hitsBuffer as a SECOND
    //     continuous one-shot (no live per-hit scheduling = no nudge spill). When
    //     two-track is ON we ALWAYS take this path and NEVER fall through to the
    //     legacy overlay loop (else bed-solo would still hear legacy overlays = the
    //     "bed too loud" bug). Play the hits unless soloing the bed (muteOverlays)
    //     or at unity (raw bed already has the hits).
    if (this.useTwoTrack) {
      if (!unity && this.hitsBuffer && !this.muteOverlays) {
        this.scheduleHits(iterStart, period, phaseSec);
      }
      return; // two-track owns the hits; the legacy loop never runs in this mode
    }

    // 2) LEGACY live overlays + ducks (only when two-track is OFF). Skipped at unity
    //    or when muteOverlays is on. When BED is muted we still want the overlays.
    if (unity || this.muteOverlays) return;
    if (!bed) return; // no synthesized bed (e.g. not yet ready) → nothing to overlay
    // NUDGING OUT (XFADE_TO_SLICES): do NOT arm fresh bit-exact overlay kicks/snares
    // on the bed bus — the SLICE path is already taking over the transients, so a
    // newly-armed bed overlay would just fire a SECOND kick/snare into the fading bed
    // (the "kick/snare spills through while nudging" bug). Let the texture fade alone;
    // the slices carry every hit. (XFADE_TO_BED and BED still arm overlays normally.)
    if (this.mode === 'XFADE_TO_SLICES') return;
    const bedMuted = this.muteBed;
    // OVERLAY span (bigHitTailSeconds > 0): the overlay plays [onset − bigHitPre,
    // onset + bigHitTail], INDEPENDENT of the bed-notch span — so the two layers can
    // be blended separately. body = the overlay tail (INPUT seconds); pre = lead-in.
    const overlayCustom = this.bigHitTailSeconds > 0;
    const body = overlayCustom
      ? this.bigHitTailSeconds
      : this.transientBodySeconds;
    const overlayPre = overlayCustom
      ? this.bigHitPreSeconds
      : this.opt.preRollSeconds;
    const blend = Math.max(0.002, this.transientBlendSeconds); // crossfade width
    const release = Math.max(0.015, this.opt.fadeOutSeconds * 2);
    const depth = Math.min(1, Math.max(0, this.transientDuckDepth)); // bed floor
    // GRACE window: a mid-loop re-anchor (tempo nudge restart) can push a strong
    // hit's tHit just behind `now`. The bed is NOTCHED at that hit, so dropping the
    // overlay too means the kick/snare vanishes entirely (BUG A: "missing hit on
    // tempo change"). Only skip hits well in the PAST; a hit within the grace window
    // still fires — playBuffer clamps its start to `now`, so its punch survives.
    const graceSec = 0.05;
    const minHit = this.ctx.currentTime - graceSec;
    // The BED notch hole (now its OWN params), stretched at the live ratio, is what
    // the overlay must cover so the texture has no gap (BUG B: "chopped bed"). With
    // decoupled layers the overlay tail can be SHORTER than the notch — the floor
    // below still makes the overlay at least span the hole so the bed never gaps.
    const notchSpan =
      this.bedNotchTailSeconds > 0
        ? this.bedNotchTailSeconds + this.bedNotchPreSeconds
        : this.bedNotchSeconds + this.opt.preRollSeconds;
    const stretchedNotch = notchSpan / (this.ratio || 1);
    for (let k = 0; k < this.strongIndices.length; k++) {
      const i = this.strongIndices[k]!;
      const onset = this.onsetAt(i);
      const tHit = iterStart + onset / (this.ratio || 1);
      if (tHit < minHit) continue;
      // Clamp the overlay body so it can't run into the next strong hit.
      const nextStrong =
        k + 1 < this.strongIndices.length
          ? iterStart + this.onsetAt(this.strongIndices[k + 1]!) / (this.ratio || 1)
          : iterStart + period;
      // BODY = the overlay tail. DECOUPLED (overlayCustom): exactly bigHitTail
      // (stretched) — the user's independent overlay length, NOT forced to match the
      // notch (that's the whole point of decoupling — blend the layers separately).
      // Legacy: cover the stretched notch, floored to 40ms. Clamp before the next hit.
      const wantBody = overlayCustom
        ? this.bigHitTailSeconds / (this.ratio || 1)
        : Math.max(body, stretchedNotch);
      const bodyDur = Math.max(
        overlayCustom ? 0.01 : 0.04,
        Math.min(wantBody, nextStrong - tHit - 0.005),
      );

      // 2a) CROSSFADE the bed under the hit (instead of a hard duck-and-hold).
      //     The bed fades DOWN to `depth` as the overlay fades IN over `attackBlend`,
      //     holds for the overlay body, then fades back UP over `blend` (release) —
      //     EQUAL-POWER (cosine) curves so bed+overlay sum to constant loudness.
      //     A SEPARATE attack ramp lets the bed ease INTO the duck slowly (no spike
      //     going in, esp. at heavy notch) while the release stays snappy.
      const attackBlend =
        this.transientDuckAttackSeconds > 0
          ? this.transientDuckAttackSeconds
          : blend;
      if (bedEnv && !bedMuted) {
        try {
          const g = bedEnv.gain;
          const downStart = Math.max(this.ctx.currentTime, tHit - attackBlend);
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

      // 2b) The crisp bit-exact attack on its OWN source. overlayPre reads audio
      //     BEFORE the onset (UNIFIED: bigHitPre — the same lead-in the notch used,
      //     so the overlay covers the attack-front blip too); fadeIn declicks, and
      //     `blend` (release) fades the tail back into the bed. bodyDur already holds
      //     the big-hit tail (UNIFIED: the full sub-bass body removed from the bed).
      const readStart = Math.max(0, onset - overlayPre);
      this.playBuffer(
        this.buffer,
        Math.max(this.ctx.currentTime, tHit - overlayPre),
        readStart,
        bodyDur + overlayPre,
        this.opt.fadeInSeconds,
        blend,
        this.bedOut, // overlays are part of the bed sound → ride the bed crossfade
      );
    }
  }

  /**
   * TWO-TRACK: schedule the pre-rendered BIG-HITS buffer as a continuous one-shot,
   * phase-locked to the bed (same `when`/`period`/`phaseSec`). The hits are baked
   * into the buffer at their grid positions (silence between), so this is a single
   * continuous source — NO per-hit scheduling, nothing to spill on a nudge. Rides
   * `bedOut` so it follows the SLICES↔BED crossfade with the bed. Tagged
   * 'bedOverlay' so a nudge-out hard-kills it (it carries transients) in lockstep
   * with the bed (Landmines L6/L7). Plays exactly `period` real seconds (grid-lock).
   */
  private scheduleHits(when: number, period: number, phaseSec = 0): void {
    const hits = this.hitsBuffer;
    if (!hits) return;
    let src: AudioBufferSourceNode;
    let env: GainNode;
    try {
      src = this.ctx.createBufferSource();
      env = this.ctx.createGain();
      src.connect(env);
      env.connect(this.bedOut);
    } catch {
      return;
    }
    const offset = Math.max(0, phaseSec); // partial first iteration after re-anchor
    const playDur = Math.max(0.001, period - offset);
    const startAt = Math.max(this.ctx.currentTime, when + offset);
    src.buffer = hits;
    src.playbackRate.value = 1; // BIT-EXACT — hits are re-gridded, never stretched.
    // The hits buffer already has per-hit edge fades baked in and silence between,
    // so the envelope only needs tiny declicks at the iteration seam (start/end).
    const fadeIn = this.opt.fadeInSeconds;
    const fadeOut = this.opt.fadeOutSeconds;
    const peak = this.muteOverlays ? 0 : 1; // (we don't schedule it when muteOverlays;
    // peak stays 1 — kept for symmetry / future per-track gain.)
    try {
      const audibleEnd = startAt + playDur;
      const foutStart = Math.max(startAt + fadeIn, audibleEnd - fadeOut);
      const g = env.gain;
      g.setValueAtTime(0, startAt);
      g.linearRampToValueAtTime(peak, startAt + fadeIn);
      g.setValueAtTime(peak, foutStart);
      g.linearRampToValueAtTime(0, audibleEnd);
    } catch {
      /* leave at unity if the schedule fails */
    }
    try {
      src.start(startAt, offset, playDur + 0.001);
    } catch {
      try {
        env.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }
    const entry = { src, env, kind: 'bedOverlay' as const };
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
    // Peak gain the envelope holds at (default 1 = the WSOLA-bed path, where the
    // caller ducks it per transient). The texture-bed prototype passes a LOW peak
    // so the additive bed sits quietly under the bit-exact slices.
    peakGain = 1,
  ): GainNode | null {
    let src: AudioBufferSourceNode;
    let env: GainNode;
    try {
      src = this.ctx.createBufferSource();
      env = this.ctx.createGain();
      src.connect(env);
      env.connect(this.bedOut); // the bed one-shot rides the bed crossfade bus
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
        g.linearRampToValueAtTime(peakGain, startAt + fadeIn);
        // NOTE: per-transient ducks are scheduled by the caller AFTER this, on
        // top of the (peakGain) hold — they slot between fadeIn end and foutStart.
        g.setValueAtTime(peakGain, foutStart);
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
    const entry = { src, env, kind: 'bed' as const };
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
    const preRoll = this.slicePreRollSeconds;
    // Buffer region this slice covers. Read a little before the onset so the
    // attack front survives the fade-in; clamp to the buffer.
    const readStart = Math.max(0, onset - preRoll);
    // END the tail at (nextOnset − preRoll − tailTrim). The next slice reads from
    // (nextOnset − preRoll), so:
    //   tailTrim = 0  → tails meet the next slice's pre-roll exactly (contiguous).
    //   tailTrim > 0  → opens a GAP before the next slice (kills any seam overlap /
    //                   the home-tempo flam, at the cost of a touch of tail).
    //   tailTrim < 0  → tails OVERLAP into the next slice (fatter, but doubles).
    // The flam at home tempo is the [nextOnset − preRoll, nextOnset] window being
    // played by BOTH this tail AND the next pre-roll; tailTrim is the live lever to
    // dial that seam out by ear. Floor at a hair past the onset so a slice has body.
    const tailEnd = Math.max(
      onset + 0.002,
      nextOnset - preRoll - this.sliceTailTrimSeconds,
    );
    const sliceBufferDur = Math.max(0.001, tailEnd - readStart);

    // Don't schedule in the past (timer jitter).
    const when = Math.max(this.ctx.currentTime, startReal);

    // The slice itself: bit-exact transient + natural tail. fade-in declick,
    // fade-out declick — both live-tunable (the seam crossfade width).
    const audibleEnd = when + sliceBufferDur;
    this.playBuffer(
      this.buffer,
      when,
      readStart,
      sliceBufferDur,
      this.sliceFadeInSeconds,
      this.sliceFadeOutSeconds,
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
   * Apply a CONTINUOUS-LEVEL, time-NUDGEABLE gain envelope to `g`, replacing the
   * old binary 0→1→0 trapezoid. The envelope has four movable points:
   *
   *   startLevel ──attack──▶ peakLevel ──(hold)── ──release──▶ endLevel
   *   ▲ at `start`+startNudge          ▲ until end−release   ▲ at `end`+endNudge
   *
   * All levels are 0..1 (any value, not just 0/1) so you can start at 70%, sustain
   * at 40%, fade to 20%, etc. start/end NUDGE shift the envelope's begin/finish in
   * time (±s) so you can anticipate or delay the hit/bed. Returns the actual
   * [start, end] audio times so the caller can size the source's play window.
   */
  private applyEnvelope(
    g: AudioParam,
    start: number,
    end: number,
    env: {
      startLevel: number;
      peakLevel: number;
      endLevel: number;
      attack: number;
      release: number;
      startNudge: number;
      endNudge: number;
    },
  ): { start: number; end: number } {
    const now = this.ctx.currentTime;
    const s = Math.max(now, start + env.startNudge);
    const e = Math.max(s + 0.002, end + env.endNudge);
    const total = e - s;
    // Clamp attack + release so they fit inside the window (leave ≥1ms of hold).
    let atk = Math.max(0, env.attack);
    let rel = Math.max(0, env.release);
    if (atk + rel > total - 0.001) {
      const scale = (total - 0.001) / (atk + rel || 1);
      atk *= scale;
      rel *= scale;
    }
    const peakAt = s + atk;
    const relStart = Math.max(peakAt, e - rel);
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(env.startLevel, s);
      g.linearRampToValueAtTime(env.peakLevel, peakAt); // attack
      g.setValueAtTime(env.peakLevel, relStart); // hold peak
      g.linearRampToValueAtTime(env.endLevel, e); // release
    } catch {
      /* automation past-time / out-of-order — leave at unity */
    }
    return { start: s, end: e };
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
    // Sub-mix sink: slice-path sources pass sliceOut; bed transient overlays pass
    // bedOut (so they ride the bed crossfade with the bed one-shot). Defaults to
    // the slice bus.
    target?: AudioNode,
    // CONTINUOUS-LEVEL envelope override (the big-hit shaper). When given, the
    // gain is shaped by applyEnvelope (movable levels + start/end nudges) instead
    // of the binary 0→1→0 declick. The source play window is widened to cover the
    // nudges. Omit → the legacy trapezoid (slices/fills unchanged).
    envSpec?: {
      startLevel: number;
      peakLevel: number;
      endLevel: number;
      attack: number;
      release: number;
      startNudge: number;
      endNudge: number;
    },
  ): void {
    let src: AudioBufferSourceNode;
    let env: GainNode;
    const sink = target ?? this.sliceOut;
    // Overlays route to bedOut (they're part of the bed sound) → tag 'bedOverlay' so
    // a nudge-out can HARD-kill them (their bit-exact transient would otherwise spill
    // a kick into the bed during the gentle texture fade); slice sources tag 'slice'.
    const kind: 'bedOverlay' | 'slice' =
      sink === this.bedOut ? 'bedOverlay' : 'slice';
    try {
      src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = 1; // BIT-EXACT — the whole point.
      env = this.ctx.createGain();
      src.connect(env);
      env.connect(sink);
    } catch {
      return;
    }

    let playWhen = when;
    let playOffset = offset;
    let playDur = duration;
    if (envSpec) {
      // Continuous, nudgeable envelope. Returns the real audio start/end after the
      // nudges; widen the source play window (and shift its buffer offset) to match
      // so the (possibly earlier-starting / later-ending) envelope has audio under it.
      const { start: s, end: e } = this.applyEnvelope(
        env.gain,
        when,
        when + duration,
        envSpec,
      );
      const startShift = s - when; // <0 if start nudged earlier
      playWhen = s;
      playOffset = Math.max(0, offset + startShift);
      playDur = Math.max(0.002, e - s);
    } else {
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
    }

    try {
      // start(when, offset, duration) — play exactly this region.
      src.start(playWhen, playOffset, playDur + 0.001);
    } catch {
      try {
        env.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }

    const entry = { src, env, kind };
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
