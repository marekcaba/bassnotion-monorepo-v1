/**
 * DrumBeatsPlayer — a faithful Ableton-"Beats"-mode drum slicer (2026-06-06).
 *
 * THE STATE-OF-THE-ART INSIGHT (Ableton Beats, ReCycle/REX, élastique, the
 * transient-preservation literature all agree): a transient is NEVER stretched.
 * Only the material BETWEEN transients is. The previous two-track engine obeyed
 * this for the BIG hits but VIOLATED it for the small ones — hats/room went into a
 * continuous stretched bed and smeared/rushed. This engine fixes that structurally:
 *
 *   1. Slice the loop at EVERY transient (kick, snare, AND hats) → each slice =
 *      [transient_i, transient_{i+1}). A slice carries its own attack + its own tail.
 *   2. Re-grid: place each slice's attack at its grid position scaled to the new
 *      tempo, played at playbackRate = 1 (sample-exact, pitch-perfect — NOTHING is
 *      stretched, no transient can smear or pitch-bend, ever).
 *   3. Fill the GAP (only when slowing down, where the slice is shorter than its new
 *      grid slot) by LOOPING the slice's own tail with a short crossfade, plus a
 *      per-slice decay envelope — exactly Ableton's "Transient Loop Mode" +
 *      "Transient Envelope". When speeding up, slices simply overlap/truncate.
 *
 * No bed. No phase-vocoder on drums. No mode switching, no crossfade-to-bed state
 * machine. Drums lock to bass/harmony purely through the SHARED GRID (one loop
 * length + a shared pivot T re-anchor) — the drum-sync contract — never through a
 * shared stretch. This is reliable BY CONSTRUCTION: percussion never enters a
 * stretcher, so the "sometimes leaks / smears / rushes" class of bug is impossible.
 *
 * Drop-in surface for the existing PlaybackEngine wiring (DrumSliceControls):
 * start / stop / setRatio, plus getNextDownbeat / setDiagnosticSolo / getDebugState
 * / textureRegionCount for the admin/dev tooling.
 *
 * Output: one AudioNode (the 'audio-drums' gain). Every slice connects to it.
 */
import { detectOnsetsDetailed } from './detectOnsets.js';

/** How the gap after a slice is filled when the tempo is slowed below original. */
export type GapFillMode = 'loop-pingpong' | 'loop-forward' | 'gate';

export interface DrumBeatsOptions {
  /** Musical loop length (s) — the grid slices re-space against. */
  loopDurationSeconds: number;
  /** How to fill the gap when a slice is shorter than its grid slot (slowing down). */
  gapFillMode?: GapFillMode;
  /** Transient Envelope (0..1): per-slice decay. 1 = no fade (slice rings to its
   *  natural end / loop); 0 = hard gate right after the attack. Masks gap seams. */
  transientEnvelope?: number;
  /** Crossfade (s) used when looping a slice's tail to fill a gap (declick the seam).
   *  ONLY affects gap-fill loops (slowing down); never touches verbatim playback. */
  loopCrossfadeSeconds?: number;
  /** Look-ahead for scheduling slices (s). */
  scheduleAheadSeconds?: number;
  /** Scheduler tick (ms). */
  tickMs?: number;
  /** Onset detector sensitivity passthrough — LOWER picks up MORE (hats too). */
  onsetSensitivity?: number;
  /** Drop onsets below this fraction of the loudest (keeps slice boundaries clean). */
  onsetMinRelativeStrength?: number;
  /** Onset FFT size — SMALLER = finer time resolution for closely-spaced hats. */
  onsetFftSize?: number;
  /** Min gap between detected onsets (s) — small so fast hats aren't merged. */
  onsetMinGapSeconds?: number;
}

const DEFAULTS: Required<Omit<DrumBeatsOptions, 'loopDurationSeconds'>> = {
  gapFillMode: 'loop-pingpong',
  transientEnvelope: 1,
  loopCrossfadeSeconds: 0.006,
  scheduleAheadSeconds: 0.08,
  tickMs: 25,
  // DETECTION calibrated to ABLETON'S TRANSIENT DENSITY (~90 transient markers on this
  // loop), measured by A/B'ing our render against Ableton's 89 BPM warp. The goal is to
  // keep the GHOST/HAT transients Ableton preserves (~30-50ms apart) — they fill the
  // gaps between big hits and keep the waveform continuous — WITHOUT fragmenting a
  // single kick/snare body into multiple slices (that caused the "double kick" smear).
  //   - 60ms min-gap MERGED real ghosts → silence between hits + missing/misplaced
  //     small transients (the 3 problems seen in the waveform). 30ms keeps the ghosts.
  //   - The remaining over-segmentation (wiggles inside a decaying kick body) is killed
  //     by the relative-strength floor + the post-attack refractory in DrumBeatsPlayer,
  //     not by a blunt min-gap. ~1024 FFT localizes attacks without chasing flutter.
  onsetSensitivity: 0.5, // adaptive-threshold margin: real attacks, fewer body wiggles
  onsetMinRelativeStrength: 0.035, // keep quiet ghosts; drop near-silent flutter
  onsetFftSize: 1024, // ~21ms @ 48k — stable; localizes drum attacks
  onsetMinGapSeconds: 0.022, // 22ms — Ableton keeps ghost clusters ~40-45ms apart; a
  // tighter gap is needed to resolve the 3rd ghost in each cluster (measured: 30ms
  // merged it, leaving −53ms drift + silence in the gap). The refractory below still
  // prevents kick-body fragmentation, so a tight gap doesn't reintroduce double-kicks.
};

/** One slice = EXACTLY the audio of [onset_i, onset_{i+1}) — no pre-roll, no edge
 *  fades, no padding. Laid back-to-back the slices tile the original loop sample-for-
 *  sample (the bit-exact reconstruction guarantee at ratio 1.0). The slice's own tail
 *  is what gap-fill loops when slowing down; the attack is index 0. */
interface Slice {
  /** Input-domain onset (s) on the musical loop — its grid anchor. */
  onsetSec: number;
  /** Bit-exact PCM for [onset_i, onset_{i+1}), per channel. Verbatim — no fades. */
  channels: Float32Array[];
  /** Slice length in samples (== onset_{i+1} − onset_i). The attack is at index 0. */
  bodySamples: number;
  /** RMS of the slice's TAIL (last ~40% / the loopable region) relative to its peak,
   *  0..1. LOW ⇒ the slice has decayed to near-silence by its end → looping it would
   *  manufacture grainy texture in what should be a gap (the spike source). HIGH ⇒
   *  sustained energy worth looping. Drives the energy-aware gap-fill decision. */
  tailEnergy: number;
  /** Tail-RMS ÷ head-RMS, 0..∞. <<1 ⇒ the slice DECAYS (a hit: kick/snare/clap) → must
   *  RING OUT, never loop (looping its body re-fires the attack = a "double kick"). ≈1
   *  or higher ⇒ SUSTAINED energy (cymbal wash, room, held tone) → safe to loop. This,
   *  not raw tailEnergy, decides ring-out vs loop. */
  decayRatio: number;
}

export class DrumBeatsPlayer {
  private readonly ctx: AudioContext;
  private readonly buffer: AudioBuffer; // the raw drum loop
  private readonly output: AudioNode;
  private readonly opt: Required<DrumBeatsOptions>;
  private readonly sr: number;
  private readonly numCh: number;
  private readonly loopDuration: number; // musical loop length (s, input domain)

  private onsets: number[] = []; // ascending, includes 0
  private slices: Slice[] = []; // one per onset, built once

  private playing = false;
  private ratio = 1; // target/original tempo (ratio<1 = slower)
  private loopStartTime = 0; // audio time of input-position 0 of the current iteration

  // SINGLE-BUFFER ARCHITECTURE: the whole loop is rendered into ONE buffer at the
  // current ratio (every seam crossfade controlled in-array) and played as ONE looping
  // source. No per-slice sources → no inter-source seam clicks (the measured spike
  // source). Re-rendered on tempo change. `loopSrc` loops `loopBuffer` forever.
  private loopBuffer: AudioBuffer | null = null;
  private loopSrc: AudioBufferSourceNode | null = null;
  private loopGain: GainNode | null = null;
  /** Real-time length (s) of the currently-rendered loop buffer (= loopDuration/ratio). */
  private renderedPeriod = 0;

  // Diagnostic solo (admin). For a pure slicer there is no bed/overlay split, so the
  // two flags map to: muteBed → mute ALL but the strongest (big-hit) slices;
  // muteOverlays → mute only the big-hit slices (hear the texture/hats). Lets the old
  // BED/HITS solo panel keep working: "BED only" ≈ texture (no big hits), "HITS only"
  // ≈ big hits only. Strength comes from the per-slice confidence.
  private muteBig = false; // muteOverlays in the panel → drop big hits
  private muteTexture = false; // muteBed in the panel → drop everything but big hits
  private confidences: number[] = [];
  private strongConfidenceThreshold = 0.3;

  constructor(
    ctx: AudioContext,
    buffer: AudioBuffer,
    output: AudioNode,
    options: DrumBeatsOptions,
  ) {
    this.ctx = ctx;
    this.buffer = buffer;
    this.output = output;
    this.opt = { ...DEFAULTS, ...options };
    this.sr = buffer.sampleRate;
    this.numCh = buffer.numberOfChannels;
    this.loopDuration = this.opt.loopDurationSeconds;
    this.analyze();
  }

  // ── BUILD (once, at load) ───────────────────────────────────────────────────

  /** Raw detection (time s → confidence 0..1), before slice canonicalization. */
  private rawOnsets: { time: number; confidence: number }[] = [];

  /** Detect EVERY transient, then cut the loop into one slice per transient.
   *  buildSlices canonicalizes the onset list (clamp/dedup/anchor-0) and rebuilds
   *  `this.onsets` + `this.confidences` aligned 1:1 with the final slices, so the
   *  scheduler's index into onsets/confidences/slices always matches. */
  private analyze(): void {
    try {
      this.rawOnsets = detectOnsetsDetailed(this.buffer, {
        sensitivity: this.opt.onsetSensitivity,
        minRelativeStrength: this.opt.onsetMinRelativeStrength,
        fftSize: this.opt.onsetFftSize,
        hopSize: Math.max(64, this.opt.onsetFftSize / 4),
        minOnsetGapSeconds: this.opt.onsetMinGapSeconds,
      });
    } catch {
      this.rawOnsets = [{ time: 0, confidence: 1 }];
    }
    if (this.rawOnsets.length === 0) this.rawOnsets = [{ time: 0, confidence: 1 }];
    this.rawOnsets = this.suppressBodyFragments(this.rawOnsets);
    this.buildSlices();
  }

  /**
   * ANTI-FRAGMENTATION: after a STRONG onset (a kick/snare attack), the next ~70ms is
   * that hit's loud body — full of spectral flutter the detector can mistake for new
   * onsets (this fragmented a single kick into 3-6 slices → the "double kick" smear). We
   * drop any onset that falls inside a strong onset's body window UNLESS it is itself
   * strong (a real layered hit) — so genuine ghost/hat transients that arrive AFTER the
   * body settles survive (they fill the gaps, keeping the waveform continuous like
   * Ableton), but mid-kick wiggles don't become slices. Calibrated against Ableton's
   * ~90-transient density on the test loop. */
  private suppressBodyFragments(
    onsets: { time: number; confidence: number }[],
  ): { time: number; confidence: number }[] {
    if (onsets.length < 2) return onsets;
    const STRONG = 0.35; // confidence ≥ this ⇒ a big hit whose body follows
    // 140ms loud-body window: a kick/snare body runs well past 70ms, and a flux wiggle
    // ~90-130ms into the body would otherwise split the hit into a loud head + a quiet
    // tail-fragment → the quiet fragment drops the body out (the "missing waves" on the
    // 2nd kick). 140ms keeps the whole body as ONE slice while still letting genuine
    // ghosts (which Ableton spaces ~beat-fractions later, and which are themselves
    // strong enough, or arrive after the body) survive.
    const BODY_SEC = 0.14;
    const WEAK_IN_BODY = 0.6; // inside a body, only keep onsets ≥ 60% of the body-opener
    const kept: { time: number; confidence: number }[] = [];
    let bodyUntil = -1;
    let bodyOpenerConf = 0;
    for (const o of onsets) {
      if (o.time < bodyUntil) {
        // Inside a strong hit's body: keep only if it's a comparably strong layered hit.
        if (o.confidence >= Math.max(STRONG, bodyOpenerConf * WEAK_IN_BODY)) {
          kept.push(o);
          bodyUntil = o.time + BODY_SEC; // extend the body from the layered hit
          bodyOpenerConf = Math.max(bodyOpenerConf, o.confidence);
        }
        // else: a mid-body wiggle → drop (don't fragment the hit).
      } else {
        kept.push(o);
        if (o.confidence >= STRONG) {
          bodyUntil = o.time + BODY_SEC;
          bodyOpenerConf = o.confidence;
        }
      }
    }
    return kept;
  }

  /**
   * Cut the loop into one VERBATIM slice per transient: slice k = exactly
   * [onset_k, onset_{k+1}) (the last wraps to the loop end). No pre-roll, no minimum
   * length, NO edge fades — so the slices laid back-to-back equal the original buffer
   * sample-for-sample. This is the bit-exact reconstruction guarantee: at ratio 1.0
   * the grid slot equals the slice length, gap-fill never triggers, and the engine
   * reproduces the source with no dips, no doubles, no seams. (Earlier versions added
   * a pre-roll + per-slice edge fades + a 30ms min-tail; all three carved a notch or
   * forced an overlap at every transient boundary — "slices don't add up". Removed.)
   *
   * To avoid a hard sample-step where one slice ends and the next begins (only audible
   * when a slice is looped/repeated to fill a gap, or at a stop), we snap each slice's
   * START to a zero-crossing ONLY for the gap-fill loop math — the verbatim playback
   * boundary itself stays on the exact onset so tiling is bit-exact.
   */
  private buildSlices(): void {
    const end = Math.min(this.buffer.length, Math.round(this.loopDuration * this.sr));
    if (end <= 0) {
      this.slices = [];
      this.onsets = [];
      this.confidences = [];
      return;
    }

    // Onset sample positions (clamped to the loop), de-duplicated, sorted, anchored
    // at 0. Keep each point's confidence so the LOUD/QUIET solo still works; the
    // anchored origin (if it wasn't itself detected) gets confidence 1 (downbeat).
    const pts: { s: number; conf: number }[] = [];
    for (const o of this.rawOnsets) {
      const s = Math.round(o.time * this.sr);
      if (s >= 0 && s < end) pts.push({ s, conf: o.confidence });
    }
    if (pts.length === 0 || pts[0]!.s > 0) pts.unshift({ s: 0, conf: 1 });
    pts.sort((a, b) => a.s - b.s);
    const uniq: { s: number; conf: number }[] = [];
    for (const p of pts) {
      if (uniq.length === 0 || p.s > uniq[uniq.length - 1]!.s) uniq.push(p);
      else uniq[uniq.length - 1]!.conf = Math.max(uniq[uniq.length - 1]!.conf, p.conf);
    }

    this.slices = [];
    this.onsets = [];
    this.confidences = [];
    for (let k = 0; k < uniq.length; k++) {
      const onset = uniq[k]!.s;
      const nextOnset = k + 1 < uniq.length ? uniq[k + 1]!.s : end;
      const len = nextOnset - onset; // EXACT tile; no padding, no overlap
      if (len <= 0) continue;
      const sliceChannels: Float32Array[] = [];
      for (let c = 0; c < this.numCh; c++) {
        const src = this.buffer.getChannelData(c);
        const region = new Float32Array(len);
        for (let i = 0; i < len; i++) region[i] = src[onset + i]!; // verbatim copy
        sliceChannels.push(region);
      }
      this.slices.push({
        onsetSec: onset / this.sr,
        channels: sliceChannels,
        bodySamples: len,
        tailEnergy: this.computeTailEnergy(sliceChannels[0]!),
        decayRatio: this.computeDecayRatio(sliceChannels[0]!),
      });
      this.onsets.push(onset / this.sr);
      this.confidences.push(uniq[k]!.conf);
    }
  }

  /** RMS of the slice's last ~40% (the loopable tail) ÷ its peak, 0..1. Low ⇒ the
   *  slice has decayed to near-silence by its end → looping it manufactures grain in a
   *  gap; let it ring out instead. High ⇒ sustained, worth looping. */
  private computeTailEnergy(ch: Float32Array): number {
    const n = ch.length;
    if (n < 8) return 0;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.abs(ch[i]!);
      if (a > peak) peak = a;
    }
    if (peak <= 1e-6) return 0;
    const tailStart = Math.floor(n * 0.6); // last 40%
    let acc = 0;
    let cnt = 0;
    for (let i = tailStart; i < n; i++) {
      acc += ch[i]! * ch[i]!;
      cnt++;
    }
    const rms = cnt > 0 ? Math.sqrt(acc / cnt) : 0;
    return Math.min(1, rms / peak);
  }

  /** Tail-RMS ÷ head-RMS. <<1 ⇒ the slice decays (a hit → ring out); ≈1+ ⇒ sustained
   *  (texture → loopable). The discriminator that keeps kicks from being looped. */
  private computeDecayRatio(ch: Float32Array): number {
    const n = ch.length;
    if (n < 16) return 1;
    const rms = (lo: number, hi: number) => {
      let a = 0;
      let c = 0;
      for (let i = lo; i < hi; i++) {
        a += ch[i]! * ch[i]!;
        c++;
      }
      return c > 0 ? Math.sqrt(a / c) : 0;
    };
    const head = rms(0, Math.floor(n * 0.25));
    const tail = rms(Math.floor(n * 0.6), n);
    if (head <= 1e-9) return 1; // silent head → treat as sustained (no attack to protect)
    return tail / head;
  }

  // ── TRANSPORT (single-buffer architecture) ──────────────────────────────────

  /** Real-time loop period at the current ratio (= the rendered buffer length). */
  private get period(): number {
    return this.loopDuration / (this.ratio || 1);
  }

  start(when?: number): void {
    if (this.playing) return;
    this.playing = true;
    this.loopStartTime = when ?? this.ctx.currentTime;
    this.renderAndArm(this.loopStartTime, /*phaseSec*/ 0);
  }

  stop(when?: number): void {
    this.playing = false;
    const now = this.ctx.currentTime;
    const at = when ?? now;
    this.teardownSource(at);
  }

  /**
   * Tempo change. Re-anchor the grid at the SHARED pivot `atTime` so the drums stay
   * locked to bass/harmony, RE-RENDER the whole loop at the new ratio into one buffer,
   * and swap the looping source in at the correct phase (continuous — no jump). The
   * re-render is the only cost; at loop sizes it's a few ms of array work, off the
   * audio thread. No per-slice scheduling, so there are no inter-source seams to click.
   */
  setRatio(ratio: number, atTime?: number): void {
    const newRatio = ratio > 0 ? ratio : 1;
    if (!this.playing) {
      this.ratio = newRatio;
      return;
    }
    if (newRatio === this.ratio) return;
    const pivot = atTime ?? this.ctx.currentTime;
    // Where in the loop (input seconds) are we at the pivot, under the OLD ratio?
    const inputPos = this.currentInputPos(pivot);
    this.ratio = newRatio;
    // Re-anchor so that input position stays continuous across the rate change.
    this.loopStartTime = pivot - inputPos / newRatio;
    // Phase (real seconds) into the NEW loop period at the pivot.
    const phaseSec = (inputPos / newRatio) % this.period;
    this.renderAndArm(Math.max(this.ctx.currentTime + 0.005, pivot), phaseSec);
  }

  /** Input position (s, [0,loopDuration)) at audio time `now`, folded over the loop. */
  private currentInputPos(now: number): number {
    const period = this.period;
    if (period <= 0) return 0;
    let rel = (now - this.loopStartTime) % period;
    if (rel < 0) rel += period;
    return rel * (this.ratio || 1);
  }

  /** Render the loop at the current ratio and (re)arm the single looping source so it
   *  is at `phaseSec` into the buffer at audio time `startAt`. Swaps cleanly under a
   *  tiny gain ramp so a re-render mid-play doesn't click. */
  private renderAndArm(startAt: number, phaseSec: number): void {
    let buf: AudioBuffer;
    try {
      buf = this.renderLoopBuffer(this.ratio);
    } catch {
      return;
    }
    this.loopBuffer = buf;
    this.renderedPeriod = buf.length / this.sr;
    // Tear down any existing source quickly (we're swapping).
    this.teardownSource(this.ctx.currentTime);
    try {
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = 1; // the buffer is ALREADY at the target tempo
      gain.gain.value = 1;
      src.connect(gain);
      gain.connect(this.output);
      const period = this.renderedPeriod;
      const offset = period > 0 ? ((phaseSec % period) + period) % period : 0;
      const at = Math.max(this.ctx.currentTime, startAt);
      src.start(at, offset);
      this.loopSrc = src;
      this.loopGain = gain;
    } catch {
      this.loopSrc = null;
      this.loopGain = null;
    }
  }

  private teardownSource(at: number): void {
    if (this.loopSrc) {
      try {
        this.loopGain?.gain.cancelScheduledValues(this.ctx.currentTime);
        this.loopGain?.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {
        /* ignore */
      }
      try {
        this.loopSrc.stop(at);
      } catch {
        /* ignore */
      }
      this.loopSrc = null;
    }
    this.loopGain = null;
  }

  // ── LOOP RENDER (the whole loop → ONE buffer, every seam controlled in-array) ────

  /**
   * Render the entire loop at `ratio` into ONE buffer. Each slice's attack is placed at
   * its grid position (scaled by ratio, un-stretched), and the space until the next
   * slice is filled — by the slice's own decay (energy-aware: a decayed slice just
   * rings out into silence, Ableton "Loop Off") or, for sustained slices, by looping
   * the attack-excluding body with zero-crossing-snapped seams. Crucially, ALL slices
   * write into one shared array with EQUAL-POWER CROSSFADES at every boundary — so
   * there are no inter-source discontinuities (the measured spike source). At ratio 1.0
   * the placement is sample-aligned and the writes reconstruct the original.
   *
   * Target (measured from Ableton's own 89 BPM render): ≤~3 audible seam spikes / 10s,
   * max single-sample jump ≤~0.13, zero spikes in quiet gaps.
   */
  private renderLoopBuffer(ratio: number): AudioBuffer {
    const r = ratio > 0 ? ratio : 1;
    const outLen = Math.max(1, Math.round((this.loopDuration / r) * this.sr));
    // STRETCH-SCALED equal-power crossfade (research Stage-1.2): ~5ms at 1×, growing
    // toward ~25ms as we slow down (1/r grows), so deeper slowdown leans on a longer
    // seam fade. Base is the user's loopCrossfadeSeconds. Clamped to a sane range.
    const slowFactor = Math.max(1, 1 / r); // 1 at unity, >1 when slowing
    const baseXf = this.opt.loopCrossfadeSeconds;
    const xfSec = Math.min(0.03, baseXf * slowFactor);
    const xf = Math.max(1, Math.round(xfSec * this.sr));
    // LOOP ONLY genuinely SUSTAINED slices. A slice may loop its body to fill a gap ONLY
    // if its energy does NOT decay across its length (decayRatio ≥ this). A kick/snare
    // DECAYS (decayRatio << 1) → it must RING OUT, never loop — looping a kick's body
    // re-fires the attack mid-tail = the "double kick" the ear hears. (Earlier this used
    // raw tailEnergy, which is HIGH for a loud kick → wrongly looped it. decayRatio is
    // the correct discriminator: it asks "is this still going, or dying out?")
    const SUSTAIN_DECAY_RATIO = 0.5; // tail must be ≥50% of head energy to count as sustained

    const out: Float32Array[] = [];
    for (let c = 0; c < this.numCh; c++) out.push(new Float32Array(outLen));

    for (let k = 0; k < this.slices.length; k++) {
      const slice = this.slices[k]!;
      // Solo gates (one stream; LOUD/QUIET filter).
      const isBig = (this.confidences[k] ?? 1) >= this.strongConfidenceThreshold;
      if (isBig && this.muteBig) continue;
      if (!isBig && this.muteTexture) continue;

      // Grid position of this slice's attack in the OUTPUT buffer.
      const gridStart = Math.round((slice.onsetSec / r) * this.sr);
      if (gridStart >= outLen) continue;
      // Slot = up to the next slice's grid position (last wraps to loop end).
      const nextOnsetSec =
        k + 1 < this.slices.length ? this.slices[k + 1]!.onsetSec : this.loopDuration;
      const slotLen = Math.max(1, Math.round((nextOnsetSec / r) * this.sr) - gridStart);
      const natLen = slice.channels[0]!.length;

      // Build this slice's CONTRIBUTION region (slot + overlap into the next slot so
      // its tail crossfades under the next attack instead of cutting).
      const overlap = Math.min(xf, Math.round(0.02 * this.sr));
      const contribLen = Math.min(outLen - gridStart, slotLen + overlap);

      // LOOP only if the slice is genuinely SUSTAINED (energy not decaying), long enough
      // to contain a real sustain body, AND LOUD enough to be a real held element. A
      // kick/snare decays (decayRatio << 1) → ring out, never loop. A SHORT slice
      // (<120ms) is all attack → ring out. And crucially, a QUIET slice (decay flutter /
      // room tone between hits — like the spurious onset in the end fill) must NEVER
      // loop: looping its quiet tail RE-ENERGISES it into an audible blip Ableton
      // doesn't have (measured at the end-fill @19.53s). Only loud, long, non-decaying
      // slices (a held cymbal wash, a sustained crash) get the back-and-forth loop.
      let slicePeak = 0;
      const ref0 = slice.channels[0]!;
      for (let i = 0; i < natLen; i++) {
        const a = ref0[i]! < 0 ? -ref0[i]! : ref0[i]!;
        if (a > slicePeak) slicePeak = a;
      }
      const MIN_LOOPABLE_SAMPLES = Math.round(0.12 * this.sr); // 120ms
      const LOOP_MIN_PEAK = 0.15; // quieter than this ⇒ decay flutter/room → ring out
      const sustained =
        slice.decayRatio >= SUSTAIN_DECAY_RATIO &&
        slice.tailEnergy >= 0.06 &&
        natLen >= MIN_LOOPABLE_SAMPLES &&
        slicePeak >= LOOP_MIN_PEAK &&
        this.opt.gapFillMode !== 'gate' &&
        slotLen > natLen + 1;

      for (let c = 0; c < this.numCh; c++) {
        const src = slice.channels[c]!;
        const dst = out[c]!;
        const region = sustained
          ? this.buildSustainedRegion(src, contribLen, xf)
          : this.buildDecayRegion(src, contribLen, slowFactor, isBig);
        // Write the region. At the seam (first `xf` samples) we DUCK the previous
        // slice's ring-out tail that's already there, but the NEW slice plays at FULL
        // level — its first sample is a TRANSIENT (the kick/snare attack) and fading it
        // in from 0 would soften every hit and halve the downbeat (the measured bug:
        // kick1 peaked 0.324 vs Ableton 0.486 with a leading bump). So it's an
        // ASYMMETRIC crossfade: old tail fades out (cos), new attack is added at unity.
        // This keeps transients razor-sharp (Ableton's signature) with no summed spike.
        for (let i = 0; i < region.length && gridStart + i < outLen; i++) {
          const di = gridStart + i;
          if (i < xf && di < outLen) {
            const t = i / xf;
            const fadeOut = Math.cos((t * Math.PI) / 2); // existing tail ducks under
            dst[di] = dst[di]! * fadeOut + region[i]!; // new attack at FULL level
          } else {
            dst[di] = region[i]!;
          }
        }
      }
    }

    const buf = this.ctx.createBuffer(this.numCh, outLen, this.sr);
    for (let c = 0; c < this.numCh; c++) buf.copyToChannel(out[c]!, c);
    return buf;
  }

  /**
   * DECAY region (Ableton "Transient Envelope" analog, research Stage-1.3): the verbatim
   * slice padded with silence, shaped by an EXPONENTIAL decay envelope so it rings out
   * naturally into the gap (no looping → no grain → matches Ableton's zero gap-spikes).
   *
   * The decay is applied from a hold point onward, NOT from the start (the attack +
   * early body always survive). The envelope is:
   *   - controlled by transientEnvelope (1 = no decay / full hold; 0 = fast gate),
   *   - AUTO-SHORTENED as slowdown deepens (slowFactor) so deeper slowdown decays sooner
   *     into silence before the larger gap — Ableton's documented click remedy,
   *   - CONFIDENCE-GATED: loud slices (kick/snare) get a longer decay (let them ring);
   *     quiet slices (hats/ghosts) get a short decay so they don't buzz in the gap.
   */
  private buildDecayRegion(
    src: Float32Array,
    len: number,
    slowFactor: number,
    isBig: boolean,
  ): Float32Array {
    const region = new Float32Array(len);
    const copyLen = Math.min(src.length, len);
    // 1) The slice's own audio, VERBATIM (attack + full natural decay).
    for (let i = 0; i < copyLen; i++) region[i] = src[i]!;

    // 2) CONTINUOUS-TAIL GAP FILL (matches measured Ableton behavior). At slow tempo the
    //    grid slot is LONGER than the slice's source. The source's late decay went quiet/
    //    silent by its end, but ABLETON keeps a continuous low-level tail all the way to
    //    the next hit (measured: source @109 silent by ~0.3s, but Ableton @89 holds
    //    ~0.012 RMS to 0.66s). It does this by LOOPING the quiet late-decay region at its
    //    NATURAL level (not silence, not extra-decayed). We do the same: take the last
    //    quiet decay window [ls,le) (zero-cross-snapped, well past the attack so it can't
    //    re-fire it), and loop it forward to fill the gap, with equal-power seams. Only
    //    when there's a meaningful gap (>10ms) and the slice has real tail content.
    const GAP_MIN = Math.round(0.01 * this.sr);
    if (len - copyLen > GAP_MIN && copyLen > 64) {
      const xf = Math.max(1, Math.round(0.006 * this.sr));
      const zr = Math.max(8, Math.round(0.004 * this.sr));
      // Quiet decay window = last ~30% of the slice, after the attack/body.
      const winStart = Math.max(Math.floor(copyLen * 0.7), copyLen - Math.round(0.12 * this.sr));
      let ls = this.nearestZeroCrossing(src, winStart, zr, Math.floor(copyLen * 0.5), copyLen - xf - 2);
      let le = this.nearestZeroCrossing(src, copyLen - 1, zr, ls + xf + 1, copyLen);
      let ll = le - ls;
      if (ll > xf * 2) {
        // Loop [ls,le) forward from copyLen onward, equal-power crossfade at each seam.
        let writePos = copyLen;
        let rep = 0;
        while (writePos < len) {
          const seamStart = writePos - xf;
          for (let i = 0; i < ll && seamStart + i < len; i++) {
            const s = src[ls + i]!;
            const di = seamStart + i;
            if (di < 0) continue;
            if (i < xf) {
              const t = i / xf;
              region[di] = region[di]! * Math.cos((t * Math.PI) / 2) + s * Math.sin((t * Math.PI) / 2);
            } else {
              region[di] = s;
            }
          }
          writePos = seamStart + ll;
          if (++rep > 8192) break;
        }
      }
    }

    // 3) Optional Transient-Envelope shaping (only when the user lowers it below 1).
    const e = Math.min(1, Math.max(0, this.opt.transientEnvelope));
    if (e < 1) {
      const confHold = isBig ? 0.9 : 0.55;
      const holdFrac = Math.max(0.1, Math.min(1, (e * confHold) / Math.max(1, slowFactor * 0.6)));
      const holdEnd = Math.max(1, Math.floor(copyLen * holdFrac));
      if (holdEnd < len) {
        const span = len - holdEnd;
        const tau = span / 6.9;
        for (let i = holdEnd; i < len; i++) region[i]! *= Math.exp(-(i - holdEnd) / tau);
      }
    }
    // 4) Tiny end declick on the very last samples of the whole region.
    const fade = Math.min(Math.floor(len / 4), Math.max(1, Math.round(0.004 * this.sr)));
    for (let i = 0; i < fade; i++) region[len - 1 - i]! *= i / fade;
    return region;
  }

  /**
   * SUSTAINED region (research Stage-1.1): verbatim head, then fill the gap by looping
   * the attack-EXCLUDING tail. Default mode is BACK-AND-FORTH, implemented exactly as
   * the Live 12 manual documents: "playback reverses until it reaches a zero-crossing
   * near the middle of the segment, and proceeds again towards the end". The reflection
   * makes the pivot join C0-continuous (the reflected waveform meets itself), so there
   * is NO wrap discontinuity — this is why Ableton calls it high-quality at slow tempo.
   *
   * Geometry: loop window [loopStart, loopEnd) past the attack; a mid pivot M (a zero-
   * crossing near the middle). Motion: …→loopEnd, then reverse loopEnd→M, then forward
   * M→loopEnd, repeat. loop-forward mode instead repeats loopStart→loopEnd with an
   * equal-power wrap crossfade (REX-style). gate mode never reaches here.
   */
  private buildSustainedRegion(src: Float32Array, len: number, xf: number): Float32Array {
    const natLen = src.length;
    const region = new Float32Array(len);
    const zRadius = Math.max(8, Math.round(0.004 * this.sr));
    const attackGuard = Math.min(natLen - 1, Math.round(0.008 * this.sr));

    // Attack-excluding loop window, ends snapped to rising-edge zero-crossings.
    const rawStart = Math.max(attackGuard, Math.round(natLen * 0.35));
    let loopStart = this.nearestZeroCrossing(
      src,
      rawStart,
      zRadius,
      attackGuard,
      Math.max(attackGuard + 1, natLen - xf - 1),
    );
    let loopEnd = this.nearestZeroCrossing(src, natLen - 1, zRadius, loopStart + xf + 1, natLen);
    if (loopEnd - loopStart <= xf * 2) {
      loopStart = attackGuard;
      loopEnd = natLen;
    }
    const loopLen = Math.max(1, loopEnd - loopStart);

    // 1) Verbatim head up to loopEnd.
    const headLen = Math.min(loopEnd, natLen, len);
    for (let i = 0; i < headLen; i++) region[i] = src[i]!;

    if (this.opt.gapFillMode === 'loop-pingpong') {
      // BACK-AND-FORTH: pivot at a zero-crossing near the MIDDLE of the loop window.
      const mid = loopStart + Math.floor(loopLen / 2);
      const pivot = this.nearestZeroCrossing(
        src,
        mid,
        zRadius,
        loopStart + 1,
        loopEnd - 1,
      );
      // Build the continuous back-and-forth sample path. The head already wrote up to
      // loopEnd, so the NEXT sample must be loopEnd-2 going backward (loopEnd-1 was just
      // written) — advance position BEFORE writing so the turning-point sample is never
      // duplicated and we never overshoot past pivot/loopEnd (a duplicate or overshoot
      // is a one-sample step = a click). Bounds [pivot, loopEnd-1] inclusive.
      const hi = loopEnd - 1;
      const lo = pivot;
      let writePos = headLen;
      let pos = hi; // last sample written by the head
      let dir = -1;
      let guard = 0;
      while (writePos < len && guard++ < 8_000_000) {
        pos += dir;
        if (pos > hi) {
          pos = hi - 1;
          dir = -1;
        } else if (pos < lo) {
          pos = lo + 1;
          dir = 1;
        }
        region[writePos++] = src[pos]!;
      }
    } else {
      // FORWARD (REX-style): repeat loopStart→loopEnd, equal-power wrap crossfade.
      let writePos = headLen;
      let rep = 0;
      while (writePos < len) {
        const seamStart = writePos - xf;
        for (let i = 0; i < loopLen && seamStart + i < len; i++) {
          const s = src[loopStart + i]!;
          const di = seamStart + i;
          if (di < 0) continue;
          if (i < xf) {
            const t = i / xf;
            region[di] = region[di]! * Math.cos((t * Math.PI) / 2) + s * Math.sin((t * Math.PI) / 2);
          } else {
            region[di] = s;
          }
        }
        writePos = seamStart + loopLen;
        if (++rep > 4096) break;
      }
    }

    // Tail-fade the very end so it crossfades under the next slice's attack.
    const fade = Math.min(Math.floor(len / 4), Math.max(1, Math.round(0.008 * this.sr)));
    for (let i = 0; i < fade; i++) region[len - 1 - i]! *= i / fade;
    return region;
  }

  /** Nearest rising-edge zero-crossing to `target` within ±`radius`, clamped to
   *  [lo,hi). Used to snap loop ends so the wrap joins +0→+0 (click-free). */
  private nearestZeroCrossing(
    ref: Float32Array,
    target: number,
    radius: number,
    lo: number,
    hi: number,
  ): number {
    const clampedTarget = Math.min(hi - 1, Math.max(lo, target));
    for (let d = 0; d <= radius; d++) {
      for (const cand of d === 0 ? [clampedTarget] : [clampedTarget - d, clampedTarget + d]) {
        if (cand <= lo || cand >= hi - 1) continue;
        if (ref[cand - 1]! <= 0 && ref[cand]! > 0) return cand;
      }
    }
    return clampedTarget;
  }

  // ── DIAGNOSTICS / ENGINE GLUE ───────────────────────────────────────────────

  /** Solo, mapped to the existing BED/HITS panel:
   *   muteBed (panel "BED off")      → drop the TEXTURE slices, keep big hits.
   *   muteOverlays (panel "HITS off") → drop the BIG-HIT slices, keep texture.
   *  (A pure slicer has no bed; "BED" ≈ the quiet/texture slices, "HITS" ≈ big hits.)
   *  Applied to FUTURE slices as they're armed (slices are short — effectively live). */
  setDiagnosticSolo(opts: { muteBed?: boolean; muteOverlays?: boolean }): void {
    if (opts.muteBed !== undefined) this.muteTexture = opts.muteBed;
    if (opts.muteOverlays !== undefined) this.muteBig = opts.muteOverlays;
  }

  /** The next loop downbeat at/after `now` — the musical "one" (key-change seam). */
  getNextDownbeat(now: number): number | null {
    const period = this.period;
    if (!this.playing || !(period > 0)) return null;
    const k = Math.floor((now - this.loopStartTime) / period);
    let next = this.loopStartTime + k * period;
    while (next < now - 1e-6) next += period;
    return next;
  }

  /** Live state for the dev tool. */
  getDebugState(): {
    ratio: number;
    sliceCount: number;
    onsetCount: number;
    gapFillMode: GapFillMode;
    transientEnvelope: number;
    sensitivity: number;
    loopCrossfadeMs: number;
  } {
    return {
      ratio: this.ratio,
      sliceCount: this.slices.length,
      onsetCount: this.onsets.length,
      gapFillMode: this.opt.gapFillMode,
      transientEnvelope: this.opt.transientEnvelope,
      sensitivity: this.opt.onsetSensitivity,
      loopCrossfadeMs: this.opt.loopCrossfadeSeconds * 1000,
    };
  }

  /**
   * ENGINE BEHAVIOR REPORT (JSON) — exactly what the renderer does to each slice at a
   * given tempo: where it lands on the grid, whether it RINGS OUT (decay) or LOOPS the
   * tail (and which loop mode + region), the crossfade/declick fade lengths, and the
   * per-slice peak/decay metrics. This is the "what is the engine doing underneath the
   * audio" view. Mirrors renderLoopBuffer's decision logic exactly (kept in sync).
   */
  getEngineBehavior(ratio?: number): {
    ratio: number;
    sampleRate: number;
    loopDurationSec: number;
    renderedLoopSec: number;
    crossfadeMs: number;
    gapFillMode: GapFillMode;
    transientEnvelope: number;
    slices: Array<{
      index: number;
      onsetSec: number;
      gridStartSec: number;
      sliceLenMs: number;
      slotLenMs: number;
      gapMs: number;
      confidence: number;
      class: 'loud' | 'quiet';
      peak: number;
      tailEnergy: number;
      decayRatio: number;
      fill: 'verbatim' | 'ring-out (decay)' | 'loop back-and-forth' | 'loop forward';
      reason: string;
      decayStartMs: number | null;
      tailFadeMs: number;
    }>;
  } {
    const r = (ratio ?? this.ratio) > 0 ? (ratio ?? this.ratio) : 1;
    const slowFactor = Math.max(1, 1 / r);
    const xfSec = Math.min(0.03, this.opt.loopCrossfadeSeconds * slowFactor);
    const e = Math.min(1, Math.max(0, this.opt.transientEnvelope));
    const sliceReports = this.slices.map((slice, k) => {
      const ch = slice.channels[0]!;
      const natLen = ch.length;
      let peak = 0;
      for (let i = 0; i < natLen; i++) peak = Math.max(peak, Math.abs(ch[i]!));
      // Decay ratio = tail-RMS / head-RMS. <<1 ⇒ the slice decays (a hit, ring it out);
      // ≈1 ⇒ sustained energy (texture, safe to loop).
      const rms = (lo: number, hi: number) => {
        let a = 0;
        let n = 0;
        for (let i = lo; i < hi; i++) {
          a += ch[i]! * ch[i]!;
          n++;
        }
        return n > 0 ? Math.sqrt(a / n) : 0;
      };
      const head = rms(0, Math.floor(natLen * 0.25)) || 1e-9;
      const tail = rms(Math.floor(natLen * 0.6), natLen);
      const decayRatio = tail / head;
      const onsetSec = slice.onsetSec;
      const nextOnsetSec =
        k + 1 < this.slices.length ? this.slices[k + 1]!.onsetSec : this.loopDuration;
      const slotLenSamp = Math.round(((nextOnsetSec - onsetSec) / r) * this.sr);
      const gapSamp = slotLenSamp - natLen;
      const isBig = (this.confidences[k] ?? 1) >= this.strongConfidenceThreshold;
      const SUSTAIN_DECAY_RATIO = 0.5;
      const MIN_LOOPABLE_SAMPLES = Math.round(0.12 * this.sr);
      const LOOP_MIN_PEAK = 0.15;
      const sustained =
        decayRatio >= SUSTAIN_DECAY_RATIO &&
        slice.tailEnergy >= 0.06 &&
        natLen >= MIN_LOOPABLE_SAMPLES &&
        peak >= LOOP_MIN_PEAK &&
        this.opt.gapFillMode !== 'gate' &&
        slotLenSamp > natLen + 1;
      let fill: 'verbatim' | 'ring-out (decay)' | 'loop back-and-forth' | 'loop forward';
      let reason: string;
      if (gapSamp <= 1) {
        fill = 'verbatim';
        reason = 'slot fits slice (no gap to fill)';
      } else if (sustained) {
        fill =
          this.opt.gapFillMode === 'loop-pingpong' ? 'loop back-and-forth' : 'loop forward';
        reason = `decayRatio ${decayRatio.toFixed(2)} ≥ ${SUSTAIN_DECAY_RATIO} (sustained) → looped`;
      } else {
        fill = 'ring-out (decay)';
        reason =
          this.opt.gapFillMode === 'gate'
            ? 'gate mode'
            : `decayRatio ${decayRatio.toFixed(2)} < ${SUSTAIN_DECAY_RATIO} (decays) → ring out`;
      }
      const confHold = isBig ? 0.9 : 0.55;
      const holdFrac = Math.max(0.1, Math.min(1, (e * confHold) / Math.max(1, slowFactor * 0.6)));
      return {
        index: k,
        onsetSec: +onsetSec.toFixed(4),
        gridStartSec: +(onsetSec / r).toFixed(4),
        sliceLenMs: +((natLen / this.sr) * 1000).toFixed(1),
        slotLenMs: +((slotLenSamp / this.sr) * 1000).toFixed(1),
        gapMs: +((gapSamp / this.sr) * 1000).toFixed(1),
        confidence: +(this.confidences[k] ?? 1).toFixed(3),
        class: (isBig ? 'loud' : 'quiet') as 'loud' | 'quiet',
        peak: +peak.toFixed(3),
        tailEnergy: +slice.tailEnergy.toFixed(3),
        decayRatio: +decayRatio.toFixed(3),
        fill,
        reason,
        decayStartMs:
          fill === 'ring-out (decay)' && e < 1
            ? +((((natLen * holdFrac) / this.sr) * 1000)).toFixed(1)
            : null,
        tailFadeMs: +((8).toFixed(1)),
      };
    });
    return {
      ratio: +r.toFixed(4),
      sampleRate: this.sr,
      loopDurationSec: +this.loopDuration.toFixed(4),
      renderedLoopSec: +(this.loopDuration / r).toFixed(4),
      crossfadeMs: +(xfSec * 1000).toFixed(2),
      gapFillMode: this.opt.gapFillMode,
      transientEnvelope: this.opt.transientEnvelope,
      slices: sliceReports,
    };
  }

  /** Re-render the loop at the current ratio and re-arm at the live phase (for a live
   *  tuning change while playing). Continuous — no jump. */
  private rerenderInPlace(): void {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    const inputPos = this.currentInputPos(now);
    const phaseSec = this.period > 0 ? (inputPos / (this.ratio || 1)) % this.period : 0;
    this.renderAndArm(now + 0.005, phaseSec);
  }

  /** Tweak gap-fill character live (dev panel). */
  setGapFillMode(mode: GapFillMode): void {
    this.opt.gapFillMode = mode;
    this.rerenderInPlace();
  }

  /** Tweak the per-slice decay live (dev panel), 0..1. */
  setTransientEnvelope(value: number): void {
    this.opt.transientEnvelope = Math.min(1, Math.max(0, value));
    this.rerenderInPlace();
  }

  /**
   * LIVE transient SENSITIVITY (dev panel) — the "how many grey markers" knob.
   * LOWER = more onsets detected (catches quieter hats/ghosts → finer slices → less
   * gap to fill); HIGHER = only the big kicks/snares. Re-runs detection + rebuilds the
   * slices, then re-renders the loop buffer. One FFT pass — instant at drum-loop sizes.
   */
  setOnsetSensitivity(sensitivity: number): void {
    const s = Math.min(2, Math.max(0, sensitivity));
    if (s === this.opt.onsetSensitivity) return;
    this.opt.onsetSensitivity = s;
    this.analyze(); // re-detect onsets + rebuild slices at the new sensitivity
    this.rerenderInPlace();
  }

  /** LIVE loop-seam CROSSFADE length (dev panel), milliseconds. Longer = smoother but
   *  blurrier tail loop; shorter = tighter. */
  setLoopCrossfadeMs(ms: number): void {
    this.opt.loopCrossfadeSeconds = Math.max(0.001, Math.min(0.05, ms / 1000));
    this.rerenderInPlace();
  }

  /** How many slices/transients (admin count). */
  textureRegionCount(): number {
    return this.slices.length;
  }
}
