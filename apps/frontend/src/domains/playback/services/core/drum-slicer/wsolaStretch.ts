/**
 * WSOLA time-stretch for the drum slicer's TEXTURE regions (LAUNCH-06, hybrid).
 *
 * THE PROBLEM IT SOLVES. The beat slicer plays each onset slice bit-exact and
 * re-spaces the GAPS to change tempo. That's perfect for kick/snare (they decay
 * to silence, so a stretched gap is just more silence). But the SHUFFLE HI-HAT
 * texture between the big hits is CONTINUOUS — slicing it and stretching the gap
 * inserts silence into something that was never silent and cuts the tail bleed
 * that defines the shuffle feel ("displaced / recounted hats"). The hybrid keeps
 * the strong transients bit-exact and instead TIME-STRETCHES the in-between
 * texture to fill the slowed gap. This module is that stretch.
 *
 * WHY WSOLA (waveform-similarity overlap-add). Plain OLA re-reads source windows
 * at a fixed analysis hop and overlap-adds them at a (different) synthesis hop;
 * on quasi-periodic / transient-y content the windows fall out of phase and comb
 * (metallic flange). WSOLA fixes this by, for each output frame, SEARCHING a
 * small lag window around the ideal read for the source window that best
 * CORRELATES with the audio already laid down — so successive windows stay phase
 * aligned. On a hat groove that preserves the tick texture and the relative
 * placement of the soft hats inside the segment instead of smearing them.
 *
 * EXACT OUTPUT LENGTH IS AUTHORITATIVE. synthesizeWsola fills EXACTLY `outLen`
 * samples (caller computes it from the musical grid: the next strong transient's
 * re-spaced position). The stretch factor is implicit in outLen/inputLen and is
 * never passed as a ratio — so the next bit-exact transient always lands on the
 * grid regardless of any per-frame rounding here. WSOLA fills only the interior;
 * it can never accumulate timing error.
 *
 * Split into a cheap one-time ANALYSIS (copy PCM + build window) and a per-ratio
 * SYNTHESIS (the only thing re-run when the tempo changes), mirroring how the
 * granular fill precomputes once. Pure, dependency-free, per-channel array DSP
 * (stereo preserved: the lag is chosen from the mono-sum correlation and applied
 * to all channels, keeping the L/R image). Same conventions as buildExtendedTail.
 */

export interface WsolaOptions {
  /** Analysis/synthesis window length (s). ~50ms reads broadband drum texture
   *  without imposing a pitch; long enough to find a good correlation lag. */
  windowSeconds?: number;
  /** Synthesis hop as a fraction of the window. overlap = 1 − this. 0.25 → 75%
   *  overlap → a periodic Hann sums to unity (COLA): no amplitude flutter. */
  hopFraction?: number;
  /** Half-width of the cross-correlation lag search (s) around the ideal read.
   *  Big enough to find the in-phase window, small enough to stay local. */
  searchSeconds?: number;
}

const DEFAULTS: Required<WsolaOptions> = {
  windowSeconds: 0.05,
  hopFraction: 0.25,
  searchSeconds: 0.012,
};

/** Immutable, ratio-independent analysis of one texture segment. Owns a COPY of
 *  the source PCM (so the player's buffer may change underneath) plus the
 *  precomputed window + geometry. Built ONCE per segment, reused at every
 *  ratio. */
export interface WsolaAnalysis {
  /** Copied source PCM for this segment, per channel. */
  readonly channels: Float32Array[];
  readonly sampleRate: number;
  /** Window length (samples, even). */
  readonly L: number;
  /** Synthesis hop (samples) = round(L * hopFraction). */
  readonly Hs: number;
  /** Periodic Hann window (COLA at Hs). */
  readonly window: Float32Array;
  /** Lag search half-width (samples). */
  readonly searchRadius: number;
  /** COLA normalization: 1 / (constant overlap-add sum of window²·... ). */
  readonly colaGain: number;
}

/** Periodic Hann window of length L. */
function hann(L: number): Float32Array {
  const w = new Float32Array(L);
  for (let n = 0; n < L; n++) {
    w[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / L));
  }
  return w;
}

/**
 * Analyze one texture segment (ratio-independent). `channels` is the segment's
 * PCM per channel (the caller's subarray view — we COPY it). Returns null-able
 * geometry; the synth handles a degenerate (too-short) segment by returning [].
 */
export function analyzeWsola(
  channels: Float32Array[],
  sampleRate: number,
  options: WsolaOptions = {},
): WsolaAnalysis {
  const opt = { ...DEFAULTS, ...options };
  const numCh = channels.length;
  const srcLen = channels[0]?.length ?? 0;

  let L = Math.round(opt.windowSeconds * sampleRate);
  if (L % 2 !== 0) L += 1;
  if (L < 2) L = 2;

  const window = hann(L);
  const Hs = Math.max(1, Math.round(L * opt.hopFraction));
  const searchRadius = Math.max(0, Math.round(opt.searchSeconds * sampleRate));

  // COLA gain: a periodic Hann at 75% overlap sums to a constant. Compute that
  // constant empirically over one window span so any hopFraction renormalizes
  // to unity (no amplitude flutter / DC ripple in the overlap-add bed).
  let colaSum = 0;
  for (let k = -Math.ceil(L / Hs); k <= Math.ceil(L / Hs); k++) {
    const idx = (L >> 1) - k * Hs; // sample at the window centre
    if (idx >= 0 && idx < L) colaSum += window[idx]!;
  }
  const colaGain = colaSum > 1e-9 ? 1 / colaSum : 1;

  // Copy the source PCM so the analysis is self-contained.
  const copied: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) {
    const src = channels[c]!;
    const dst = new Float32Array(srcLen);
    dst.set(src.subarray(0, srcLen));
    copied.push(dst);
  }

  return {
    channels: copied,
    sampleRate,
    L,
    Hs,
    window,
    searchRadius,
    colaGain,
  };
}

/** Is this analysis long enough to WSOLA usefully (≥ ~1.5 windows)? Below that
 *  there's no room to search a lag / tile frames — caller should fall back to
 *  bit-exact playback. */
export function wsolaIsUsable(analysis: WsolaAnalysis): boolean {
  const srcLen = analysis.channels[0]?.length ?? 0;
  return srcLen >= Math.round(1.5 * analysis.L);
}

/**
 * Synthesize a time-stretched version of an analyzed segment to EXACTLY `outLen`
 * samples (authoritative — caller derives it from the grid). The stretch factor
 * is implicit in outLen/inputLen. Returns one Float32Array per input channel,
 * each length === outLen. Returns [] for a degenerate input (empty / too short).
 *
 * For each output frame we OLA a Hann-windowed source window; WSOLA picks the
 * source read offset by maximizing the normalized cross-correlation between the
 * audio already written into the overlap region and the candidate source window
 * (mono-sum score, same offset applied to all channels → stereo preserved).
 */
export function synthesizeWsola(
  analysis: WsolaAnalysis,
  outLen: number,
  options: WsolaOptions = {},
): Float32Array[] {
  void options; // synthesis geometry comes from the analysis; options reserved.
  const { channels, L, Hs, window, searchRadius, colaGain } = analysis;
  const numCh = channels.length;
  const srcLen = channels[0]?.length ?? 0;
  const wantLen = Math.max(0, Math.round(outLen));
  if (numCh === 0 || srcLen === 0 || wantLen === 0) return [];

  const out: Float32Array[] = [];
  const norm = new Float32Array(wantLen); // accumulated window weight per sample
  for (let c = 0; c < numCh; c++) out.push(new Float32Array(wantLen));

  // PERFORMANCE: the lag search dominates. Precompute a MONO source once (so the
  // correlation reads a flat Float32Array, not a per-sample channel-mix function
  // call) and maintain a MONO output incrementally. This + hoisting the output
  // energy out of the candidate-offset loop (it doesn't depend on the offset)
  // takes a 17s loop from ~22s to well under a second.
  const invCh = 1 / Math.max(1, numCh);
  const monoSrc = new Float32Array(srcLen);
  for (let c = 0; c < numCh; c++) {
    const x = channels[c]!;
    for (let i = 0; i < srcLen; i++) monoSrc[i]! += x[i]! * invCh;
  }
  const monoOutBuf = new Float32Array(wantLen); // mono of `out`, kept in sync

  // Number of synthesis frames to cover wantLen (last one truncated).
  const numFrames = Math.max(1, Math.ceil((wantLen - L) / Hs) + 1);
  const lastFrame = Math.max(1, numFrames - 1);
  const Ha = (srcLen - L) / lastFrame; // may be < Hs (slowdown) — that's the point

  const ov = L - Hs; // overlap length with the previous frame
  // Subsample the correlation: ~64 points across the overlap is plenty to pick
  // the lag on broadband texture (the bed has no transients after the notch), and
  // keeps the search cheap. The OLA itself still uses every sample.
  const stride = Math.max(1, Math.floor(ov / 64));

  for (let f = 0; f < numFrames; f++) {
    const outStart = f * Hs;
    if (outStart >= wantLen) break;
    const ideal = Math.round(f * Ha);

    let chosen;
    if (f === 0 || searchRadius <= 0) {
      chosen = Math.max(0, Math.min(srcLen - L, f === 0 ? 0 : ideal));
    } else {
      // Output energy over the overlap is INDEPENDENT of the candidate offset —
      // compute it ONCE per frame instead of per candidate (the big win). Also
      // read from the flat mono buffers, no function calls.
      const ovLen = Math.min(ov, wantLen - outStart);
      let eOut = 0;
      for (let n = 0; n < ovLen; n += stride) {
        const o = monoOutBuf[outStart + n]!;
        eOut += o * o;
      }
      const lo = Math.max(0, ideal - searchRadius);
      const hi = Math.min(srcLen - L, ideal + searchRadius);
      chosen = Math.max(0, Math.min(srcLen - L, ideal));
      if (eOut >= 1e-12) {
        // COARSE-TO-FINE lag search: scan the radius at a coarse step, then refine
        // ±coarse around the winner at step 1. Cuts the candidate count ~coarse×
        // vs a full per-sample scan while landing on the same lag.
        const scoreAt = (off: number): number => {
          let dot = 0;
          let eSrc = 0;
          for (let n = 0; n < ovLen; n += stride) {
            const o = monoOutBuf[outStart + n]!;
            const s = monoSrc[off + n]! * window[n]!;
            dot += o * s;
            eSrc += s * s;
          }
          // maximize dot/√(eOut·eSrc); eOut constant → maximize dot²/eSrc (no sqrt,
          // monotonic with dot/√eSrc for dot>0). Sign-preserve so anticorrelation
          // never wins.
          const m = eSrc > 1e-12 ? (dot * dot) / eSrc : 0;
          return dot > 0 ? m : -m;
        };
        const coarse = 8;
        let bestScore = -Infinity;
        for (let off = lo; off <= hi; off += coarse) {
          const s = scoreAt(off);
          if (s > bestScore) {
            bestScore = s;
            chosen = off;
          }
        }
        const rlo = Math.max(lo, chosen - coarse);
        const rhi = Math.min(hi, chosen + coarse);
        for (let off = rlo; off <= rhi; off++) {
          const s = scoreAt(off);
          if (s > bestScore) {
            bestScore = s;
            chosen = off;
          }
        }
      }
    }

    // Overlap-add this Hann-windowed source window into the output (+ mono).
    const span = Math.min(L, wantLen - outStart);
    for (let n = 0; n < span; n++) {
      const wv = window[n]!;
      const si = chosen + n;
      const monoV = si >= 0 && si < srcLen ? monoSrc[si]! * wv : 0;
      monoOutBuf[outStart + n]! += monoV;
      for (let c = 0; c < numCh; c++) {
        const src = channels[c]!;
        const sv = si >= 0 && si < src.length ? src[si]! : 0;
        out[c]![outStart + n] += sv * wv;
      }
      norm[outStart + n]! += wv;
    }
  }

  // Normalize by the accumulated window weight (COLA), guarding thin edges where
  // only one window contributed (norm < 1) so the head/tail don't dip.
  for (let i = 0; i < wantLen; i++) {
    const w = norm[i]!;
    const g = w > 1e-6 ? 1 / w : colaGain;
    for (let c = 0; c < numCh; c++) out[c]![i] *= g;
  }

  return out;
}
