/**
 * Spectral-flux onset detection for drum stems (LAUNCH-06, Beats-mode slicer).
 *
 * Finds where the drum hits ACTUALLY are (kick/snare/hat attacks), so the
 * slice player can cut the loop at the real onsets — preserving the groove
 * (shuffle, push/pull, ghost notes) instead of quantising to a grid. Each
 * detected onset becomes a slice boundary; slices play bit-exact at
 * playbackRate 1, so transients are never DSP-smeared (the WSOLA/phase-vocoder
 * artifact). This is the analysis half of Ableton "Beats" / "Preserve =
 * Transients".
 *
 * Algorithm (classic, percussion onset detection is a near-solved problem):
 *   1. STFT: Hann-windowed FFT over short hop frames (~5.8ms hop, 1024 FFT).
 *   2. Spectral flux: per frame, sum of POSITIVE magnitude differences vs the
 *      previous frame across bins (energy RISING = an attack).
 *   3. Adaptive threshold: a frame is a peak if its flux exceeds a local
 *      moving-average (± window) times a sensitivity multiplier, AND is a local
 *      maximum, AND respects a minimum inter-onset gap (debounce).
 *
 * Pure, dependency-free (own radix-2 FFT), runs ONCE at load. Mono-mixes the
 * buffer. Returns onset times in seconds, ascending, always including 0.
 */

export interface DetectOnsetsOptions {
  /** FFT size (power of 2). 1024 @ 48k ≈ 21ms window — fine for drum attacks. */
  fftSize?: number;
  /** Hop size in samples. Default fftSize/4 (75% overlap). */
  hopSize?: number;
  /** Peak threshold = localMean * (1 + sensitivity). Higher = fewer onsets. */
  sensitivity?: number;
  /** Half-width (frames) of the local-mean window for the adaptive threshold. */
  meanWindowFrames?: number;
  /** Minimum gap between onsets (s) — debounce so one hit isn't split. */
  minOnsetGapSeconds?: number;
}

const DEFAULTS: Required<DetectOnsetsOptions> = {
  fftSize: 1024,
  hopSize: 256,
  sensitivity: 0.6,
  meanWindowFrames: 6,
  minOnsetGapSeconds: 0.035, // ~35ms: faster than a 32nd at 200bpm; debounces flams
};

/** In-place iterative radix-2 Cooley–Tukey FFT. re/im length must be a pow2. */
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wpr = Math.cos(ang);
    const wpi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1;
      let wi = 0;
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

/** Mono mix of an AudioBuffer's channels into one Float32Array. */
function monoMix(buffer: AudioBuffer): Float32Array {
  const ch = buffer.numberOfChannels;
  const len = buffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) out[i]! += data[i]!;
  }
  if (ch > 1) for (let i = 0; i < len; i++) out[i]! /= ch;
  return out;
}

/**
 * Detect drum onset times (seconds, ascending, includes 0) in an AudioBuffer.
 */
export function detectOnsets(
  buffer: AudioBuffer,
  options: DetectOnsetsOptions = {},
): number[] {
  const opt = { ...DEFAULTS, ...options };
  const { fftSize, hopSize } = opt;
  const sampleRate = buffer.sampleRate;
  const signal = monoMix(buffer);
  const n = signal.length;
  if (n < fftSize) return [0];

  // Precompute a Hann window.
  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  const numBins = fftSize / 2;
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  let prevMag = new Float32Array(numBins);
  let curMag = new Float32Array(numBins);

  const numFrames = 1 + Math.floor((n - fftSize) / hopSize);
  const flux = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    for (let i = 0; i < fftSize; i++) {
      re[i] = signal[start + i]! * window[i]!;
      im[i] = 0;
    }
    fftInPlace(re, im);
    let sum = 0;
    for (let b = 0; b < numBins; b++) {
      const mag = Math.hypot(re[b]!, im[b]!);
      curMag[b] = mag;
      const diff = mag - prevMag[b]!;
      if (diff > 0) sum += diff; // half-wave rectify: only rising energy
    }
    flux[f] = sum;
    const tmp = prevMag;
    prevMag = curMag;
    curMag = tmp;
  }

  // Adaptive peak-picking over the flux curve.
  const onsets: number[] = [];
  const w = opt.meanWindowFrames;
  const minGapFrames = Math.max(
    1,
    Math.round((opt.minOnsetGapSeconds * sampleRate) / hopSize),
  );
  let lastOnsetFrame = -minGapFrames;

  for (let f = 1; f < numFrames - 1; f++) {
    // Local mean over [f-w, f+w].
    let mean = 0;
    let count = 0;
    for (let k = Math.max(0, f - w); k <= Math.min(numFrames - 1, f + w); k++) {
      mean += flux[k]!;
      count++;
    }
    mean = count > 0 ? mean / count : 0;
    const threshold = mean * (1 + opt.sensitivity);

    const fluxF = flux[f]!;
    if (
      fluxF > threshold &&
      fluxF >= flux[f - 1]! &&
      fluxF > flux[f + 1]! &&
      fluxF > 0 &&
      f - lastOnsetFrame >= minGapFrames
    ) {
      // Onset time = frame centre (start of the FFT window is the attack edge;
      // using the frame start is the conventional onset time for slicing).
      onsets.push((f * hopSize) / sampleRate);
      lastOnsetFrame = f;
    }
  }

  // Always anchor the loop start at 0 (the downbeat / loop origin).
  if (onsets.length === 0 || onsets[0]! > 0.001) onsets.unshift(0);
  return onsets;
}
