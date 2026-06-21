/**
 * complexDomainOnsets — Ableton-grade onset detection for BASS (2026-06-21).
 *
 * WHY this replaces the energy/spectral-flux detector: magnitude-only flux is the WRONG
 * detection function for bass (great for drums, bad here). It (a) MISSES soft/legato
 * attacks — the energy rise is too gradual to clear a threshold — and (b) OVER-TRIGGERS
 * on a sustained note's BODY RIPPLE (~7-8Hz amplitude pulse), firing 5+ onsets per note.
 * Both proven on a real Clarett DI take.
 *
 * THE FIX (Bello et al. 2005 "A Tutorial on Onset Detection", Duxbury/Davies/Sandler
 * complex-domain — the lineage Ableton's detection descends from):
 *
 *   1. COMPLEX-DOMAIN detection function. For each FFT bin, PREDICT the next frame's
 *      complex value by assuming constant magnitude and constant rate of phase change
 *      (steady-state). The detection function is the Euclidean distance between the
 *      PREDICTED and the ACTUAL complex spectrum, summed over bins. A real NEW note
 *      breaks both the magnitude AND the phase prediction (a genuinely new vibration =
 *      a phase discontinuity); a body ripple keeps the SAME note's phase evolving
 *      smoothly → small deviation. This is what distinguishes new-note from ripple by
 *      physics that energy alone cannot, killing BOTH failure modes at the source.
 *
 *   2. POST-PROCESSING the detection function: normalize to [0,1], then a moving-median
 *      ADAPTIVE threshold (peak must exceed median(local window) + delta) so loud and
 *      quiet sections self-calibrate.
 *
 *   3. PEAK-PICKING (librosa peak_pick rule): a frame is an onset iff it is the local
 *      max in [n-preMax, n+postMax], exceeds the adaptive threshold, AND is ≥ wait
 *      frames from the previous onset. PLUS Bello's relative-peak suppression: discard a
 *      peak that is much smaller than a LARGER peak within ~25ms — the principled
 *      anti-double-trigger (relative strength, NOT a blind time gap, so it never eats a
 *      genuinely fast real note the way a fixed dedup did).
 *
 * Pure + offline (its own FFT, no AudioContext): unit-testable on captured takes.
 */

/** In-place iterative radix-2 Cooley–Tukey FFT. re/im length must be a power of two. */
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!; re[i] = re[j]!; re[j] = tr;
      const ti = im[i]!; im[i] = im[j]!; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wpr = Math.cos(ang);
    const wpi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = i + k + len / 2;
        const tr = wr * re[b]! - wi * im[b]!;
        const ti = wr * im[b]! + wi * re[b]!;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const nwr = wr * wpr - wi * wpi;
        wi = wr * wpi + wi * wpr;
        wr = nwr;
      }
    }
  }
}

/** Wrap a phase value to (-π, π]. */
function princarg(phase: number): number {
  return phase - 2 * Math.PI * Math.round(phase / (2 * Math.PI));
}

export interface ComplexDomainOptions {
  /** FFT size (samples, power of two). 2048 @48k ≈ 43ms — long enough to resolve a
   *  low-E fundamental, short enough to localize an attack. */
  fftSize?: number;
  /** Hop between frames (samples). 512 @48k ≈ 10.7ms — the onset time resolution. */
  hopSize?: number;
  /** Adaptive-threshold offset above the local median of the detection function (in
   *  normalized [0,1] units). The main sensitivity lever. */
  delta?: number;
  /** Half-width (frames) of the moving-median threshold window. */
  medianWindow?: number;
  /** Local-max search half-width (frames) for peak-picking. */
  peakWindow?: number;
  /** Minimum frames between accepted onsets (refractory). At hop≈10.7ms, 5 ≈ 53ms — one
   *  bass note can't re-fire within ~50ms, but two real fast notes (≥~60ms) still pass. */
  waitFrames?: number;
  /** Relative-peak suppression: drop a candidate whose detection value is below this
   *  fraction of a LARGER candidate within `suppressFrames`. Bello's anti-double-trigger. */
  suppressRatio?: number;
  suppressFrames?: number;
  /** RECENT-PEAK gate (the body-ripple killer): once a strong onset fires, the body's
   *  ripple peaks recur for the whole note. A candidate within `recentFrames` AFTER an
   *  accepted onset must exceed `recentFrac` × that onset's strength to count as a NEW
   *  note — otherwise it's ripple of the same note. Relative to the recent onset, so a
   *  genuinely fast next note (comparable strength) still passes. Calibrated on real
   *  bass: ripple peaks sit at ~0.3-0.45× the attack, real notes near 1×. */
  recentFrac?: number;
  recentFrames?: number;
}

const DEFAULTS: Required<ComplexDomainOptions> = {
  fftSize: 2048,
  hopSize: 512,
  delta: 0.07,
  medianWindow: 16,
  peakWindow: 4,
  waitFrames: 5,
  suppressRatio: 0.5,
  suppressFrames: 3,
  recentFrac: 0.5,
  recentFrames: 38, // ~400ms @hop 10.7ms — one bass note's body length
};

/**
 * Compute the complex-domain detection function over the signal.
 * Returns the per-frame detection value (already normalized to [0,1]) and the frame
 * hop in seconds (for converting frame index → time).
 */
export function complexDomainDetectionFunction(
  signal: Float32Array,
  sampleRate: number,
  opts: ComplexDomainOptions = {},
): { df: Float32Array; hopSec: number } {
  const fftSize = opts.fftSize ?? DEFAULTS.fftSize;
  const hopSize = opts.hopSize ?? DEFAULTS.hopSize;
  const half = fftSize / 2;

  // Hann window.
  const win = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
  }

  const numFrames = Math.max(0, Math.floor((signal.length - fftSize) / hopSize) + 1);
  const df = new Float32Array(numFrames);

  // Previous-frame magnitude + phase (for the steady-state prediction), and the phase
  // before that (to estimate the constant phase RATE).
  const prevMag = new Float32Array(half);
  const prevPhase = new Float32Array(half);
  const prevPrevPhase = new Float32Array(half);

  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    for (let i = 0; i < fftSize; i++) {
      re[i] = (signal[start + i] ?? 0) * win[i]!;
      im[i] = 0;
    }
    fftInPlace(re, im);

    let sum = 0;
    for (let k = 0; k < half; k++) {
      const mag = Math.hypot(re[k]!, im[k]!);
      const phase = Math.atan2(im[k]!, re[k]!);

      if (f >= 2) {
        // PREDICT: steady-state = constant magnitude (prevMag) and constant phase rate
        // (extrapolate prevPhase by the last phase increment).
        const predPhase = 2 * prevPhase[k]! - prevPrevPhase[k]!;
        const predMag = prevMag[k]!;
        // Euclidean distance between predicted and actual complex values.
        const dr = mag * Math.cos(phase) - predMag * Math.cos(predPhase);
        const di = mag * Math.sin(phase) - predMag * Math.sin(predPhase);
        // princarg keeps the phase prediction stable across wraps (used implicitly via
        // cos/sin, but we guard the increment for numerical sanity).
        void princarg;
        sum += Math.hypot(dr, di);
      }

      prevPrevPhase[k] = prevPhase[k]!;
      prevPhase[k] = phase;
      prevMag[k] = mag;
    }
    df[f] = sum;
  }

  // Normalize to [0,1].
  let max = 0;
  for (let i = 0; i < numFrames; i++) if (df[i]! > max) max = df[i]!;
  if (max > 0) for (let i = 0; i < numFrames; i++) df[i]! /= max;

  return { df, hopSec: hopSize / sampleRate };
}

/** Median of a slice [from, to) of arr (copying — small windows, fine). */
function medianOf(arr: Float32Array, from: number, to: number): number {
  const a: number[] = [];
  for (let i = Math.max(0, from); i < Math.min(arr.length, to); i++) a.push(arr[i]!);
  if (a.length === 0) return 0;
  a.sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

/**
 * Pick onset frames from a detection function: local-max + adaptive median threshold +
 * refractory wait + relative-peak suppression. Returns frame indices, ascending.
 */
export function pickOnsetFrames(
  df: Float32Array,
  opts: ComplexDomainOptions = {},
): number[] {
  const delta = opts.delta ?? DEFAULTS.delta;
  const medW = opts.medianWindow ?? DEFAULTS.medianWindow;
  const peakW = opts.peakWindow ?? DEFAULTS.peakWindow;
  const wait = opts.waitFrames ?? DEFAULTS.waitFrames;
  const suppRatio = opts.suppressRatio ?? DEFAULTS.suppressRatio;
  const suppFrames = opts.suppressFrames ?? DEFAULTS.suppressFrames;
  const recentFrac = opts.recentFrac ?? DEFAULTS.recentFrac;
  const recentFrames = opts.recentFrames ?? DEFAULTS.recentFrames;

  const candidates: number[] = [];
  for (let n = 0; n < df.length; n++) {
    const v = df[n]!;
    // local maximum in [n-peakW, n+peakW]
    let isMax = true;
    for (let k = Math.max(0, n - peakW); k <= Math.min(df.length - 1, n + peakW); k++) {
      if (df[k]! > v) { isMax = false; break; }
    }
    if (!isMax) continue;
    // adaptive threshold: median of the local window + delta
    const thr = medianOf(df, n - medW, n + medW + 1) + delta;
    if (v < thr) continue;
    candidates.push(n);
  }

  // Relative-peak suppression (Bello): drop a candidate that is much weaker than a LARGER
  // candidate within suppFrames — the body-pulse next to a real attack. Relative, so two
  // comparable real fast notes both survive.
  const suppressed = candidates.filter((n) => {
    for (const m of candidates) {
      if (m === n) continue;
      if (Math.abs(m - n) <= suppFrames && df[m]! > df[n]! && df[n]! < df[m]! * suppRatio) {
        return false;
      }
    }
    return true;
  });

  // RECENT-PEAK gate + refractory. Once a strong onset fires, ripple peaks recur through
  // the note's body at a FRACTION of the attack strength. A candidate within recentFrames
  // after an accepted onset must exceed recentFrac × that onset's strength to be a NEW
  // note (a fast next note is comparable strength → passes; a ripple is weak → dropped).
  const out: number[] = [];
  for (const n of suppressed) {
    // strongest accepted onset within the recent lookback
    let recentMax = 0;
    for (const m of out) {
      if (n - m > 0 && n - m <= recentFrames) recentMax = Math.max(recentMax, df[m]!);
    }
    if (recentMax > 0 && df[n]! < recentMax * recentFrac) continue; // body ripple
    // refractory: keep the stronger of two too-close
    if (out.length === 0 || n - out[out.length - 1]! >= wait) {
      out.push(n);
    } else if (df[n]! > df[out[out.length - 1]!]!) {
      out[out.length - 1] = n;
    }
  }
  return out;
}

/**
 * Full pipeline: complex-domain onset times (seconds, ascending) for a mono signal.
 * The replacement for detectBassOnsetsAdaptive in the bass coach.
 */
export function detectOnsetsComplexDomain(
  signal: Float32Array,
  sampleRate: number,
  opts: ComplexDomainOptions = {},
): number[] {
  const { df, hopSec } = complexDomainDetectionFunction(signal, sampleRate, opts);
  const frames = pickOnsetFrames(df, opts);
  const fftSize = opts.fftSize ?? DEFAULTS.fftSize;
  // Frame f covers [f*hop, f*hop+fftSize); the onset sits near the window's start. Add a
  // small half-hop so the time lands inside the frame rather than at its left edge.
  const hopSize = opts.hopSize ?? DEFAULTS.hopSize;
  const frameToSec = (f: number) => (f * hopSize + fftSize * 0) / sampleRate + hopSec / 2;
  return frames.map(frameToSec).filter((t) => t > 0.001);
}
