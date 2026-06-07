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
  /** GLOBAL confidence floor (Tier 1c): drop accepted peaks whose flux is below
   *  this fraction of the LOUDEST onset's flux. The local adaptive threshold
   *  can pass globally-insignificant peaks in quiet sections — those create
   *  slice boundaries mid-decay (a seam + a weak fill source). 0 disables. */
  minRelativeStrength?: number;
}

const DEFAULTS: Required<DetectOnsetsOptions> = {
  fftSize: 1024,
  hopSize: 256,
  sensitivity: 0.6,
  meanWindowFrames: 6,
  minOnsetGapSeconds: 0.035, // ~35ms: faster than a 32nd at 200bpm; debounces flams
  minRelativeStrength: 0.12, // drop peaks < 12% of the loudest onset
};

/** A detected onset with its strength relative to the loudest onset (0..1). */
export interface OnsetInfo {
  /** Onset time in seconds. */
  time: number;
  /** Confidence: this onset's flux / the loudest onset's flux (1 = loudest). */
  confidence: number;
}

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
 * Thin wrapper over {@link detectOnsetsDetailed} returning just the times — the
 * shape the slicer's existing scheduling path consumes.
 */
export function detectOnsets(
  buffer: AudioBuffer,
  options: DetectOnsetsOptions = {},
): number[] {
  return detectOnsetsDetailed(buffer, options).map((o) => o.time);
}

/**
 * Detect drum onsets WITH a per-onset confidence (Tier 1c). Same spectral-flux
 * peak-picking as before, plus: each accepted peak carries its flux relative to
 * the loudest onset, and globally-weak peaks (below `minRelativeStrength` of the
 * loudest) are dropped so the slicer doesn't cut a boundary mid-decay. Returns
 * ascending, always includes the origin (0) at confidence 1.
 */
export function detectOnsetsDetailed(
  buffer: AudioBuffer,
  options: DetectOnsetsOptions = {},
): OnsetInfo[] {
  const opt = { ...DEFAULTS, ...options };
  const { fftSize, hopSize } = opt;
  const sampleRate = buffer.sampleRate;
  const signal = monoMix(buffer);
  const n = signal.length;
  if (n < fftSize) return [{ time: 0, confidence: 1 }];

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

  // Adaptive peak-picking over the flux curve — collect candidates with their
  // flux so we can apply a GLOBAL strength floor afterwards.
  const candidates: { time: number; flux: number }[] = [];
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
      candidates.push({ time: (f * hopSize) / sampleRate, flux: fluxF });
      lastOnsetFrame = f;
    }
  }

  // PRE-ATTACK GHOST MERGE — the greedy minGap debounce keeps the FIRST candidate
  // in a cluster, so a hit with a slow spectral pre-rise fires an early WEAK peak,
  // then the true STRONG peak ~40-50ms LATER also passes the gap → a ghost onset
  // just BEFORE every loud hit (measured: conf 0.04-0.11 leading into 0.67). Those
  // ghosts add slice boundaries Ableton doesn't mark.
  //
  // CRITICAL ASYMMETRY: the merge must be DIRECTIONAL. A weak peak FOLLOWED by a
  // much louder one is a pre-attack ghost → drop it (snap to the loud attack). But a
  // weak peak that FOLLOWS a much louder one is NOT a ghost — it's a real SECONDARY
  // transient sitting in the loud hit's decaying tail (a hi-hat/ghost-note ~60-75ms
  // after a kick). Ableton gives those their own warp marker; dropping them buries
  // the secondary inside the kick slice, where the tail-stretch drags it EARLY and
  // attenuates it (the exact "2nd transient too soon + too quiet" artifact). So we
  // ONLY remove the earlier weak peak, and only within a TIGHT window (real pre-rises
  // are <~45ms; a 50ms cap protects genuine fast doubles and post-hit secondaries).
  const ghostWindow = 0.05; // ≤50ms: pre-attack rise span; beyond this is a real hit
  const mergeRatio = 1.8; // the following peak must be ≥1.8× louder to be the "true" attack
  const merged: { time: number; flux: number }[] = [];
  for (const c of candidates) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      c.time - prev.time < ghostWindow &&
      c.flux >= prev.flux * mergeRatio // current is the loud true-attack; prev was its pre-rise ghost
    ) {
      merged[merged.length - 1] = c; // replace the ghost with the true attack
    } else {
      merged.push(c); // keep everything else — including weak SECONDARIES after a loud hit
    }
  }

  // TRANSIENT PEAK-SNAP — spectral flux peaks on the attack's LEADING EDGE, ~10-12ms
  // BEFORE the waveform's actual energy transient (measured: median +10.6ms on the busy
  // waitlist beat, p25 9 / p75 12). Slicing at the flux peak therefore places every hit
  // slightly EARLY, and 1/ratio stretching amplifies that to a visible left-shift vs
  // Ableton (whose warp markers sit AT the transient). Snap each onset FORWARD to the
  // steepest short-window energy rise within a small look-ahead so the slice boundary —
  // and thus its on-grid placement — lands on the true transient, like Ableton. The
  // slices still tile gap-free (the prior slice just keeps the few ms of pre-attack), so
  // the attack is never clipped. Snap is forward-only and capped so it can't cross into
  // the next hit.
  const snapAhead = Math.round(0.022 * sampleRate); // look up to ~22ms forward
  const eWin = Math.max(1, Math.round(0.0015 * sampleRate)); // ~1.5ms energy window
  // Loop peak — so "is there a real attack here" is material-relative, not absolute.
  let sigPeak = 0;
  for (let i = 0; i < signal.length; i++) {
    const a = signal[i]! < 0 ? -signal[i]! : signal[i]!;
    if (a > sigPeak) sigPeak = a;
  }
  const snapOnset = (t: number): number => {
    if (t < 0.001) return t; // pin the downbeat
    const s0 = Math.round(t * sampleRate);
    let bestS = s0, bestRise = -Infinity;
    const hi = Math.min(signal.length - eWin, s0 + snapAhead);
    for (let s = s0; s <= hi; s++) {
      let pre = 0, post = 0;
      for (let i = s - eWin; i < s; i++) pre += signal[i]! * signal[i]!;
      for (let i = s; i < s + eWin; i++) post += signal[i]! * signal[i]!;
      const rise = Math.sqrt(post / eWin) - Math.sqrt(pre / eWin);
      if (rise > bestRise) { bestRise = rise; bestS = s; }
    }
    // Only snap when a REAL attack was found in the look-ahead. In a quiet decay region
    // the "best rise" is just noise flutter — snapping there pointlessly moves the slice
    // boundary onto a non-zero-crossing in near-silence, manufacturing a small step (a
    // click) where the un-snapped boundary was fine. Gate the snap on a material-relative
    // rise so it fires only on genuine transients (the case it was built for) and leaves
    // quiet boundaries alone.
    if (bestRise < sigPeak * 0.06) return t;
    // Land the boundary on the nearest ZERO-CROSSING to the energy peak (within ±2ms) so
    // the slice splice joins ~0→~0 and can't step — Ableton zero-crossing-snaps every
    // slice boundary for exactly this reason. Keeps the true-transient timing (the peak)
    // while guaranteeing a click-free cut.
    const zr = Math.round(0.002 * sampleRate);
    let zS = bestS, zBest = Infinity;
    for (let s = Math.max(1, bestS - zr); s <= Math.min(signal.length - 1, bestS + zr); s++) {
      if ((signal[s - 1]! <= 0 && signal[s]! > 0) || (signal[s - 1]! >= 0 && signal[s]! < 0)) {
        const d = Math.abs(s - bestS);
        if (d < zBest) { zBest = d; zS = s; }
      }
    }
    return zS / sampleRate;
  };
  for (const c of merged) c.time = snapOnset(c.time);

  // Global confidence: normalise by the loudest candidate's flux, then drop the
  // globally-weak ones (false positives in quiet sections). Origin (0) is kept
  // unconditionally at confidence 1 as the loop downbeat.
  let maxFlux = 0;
  for (const c of merged) if (c.flux > maxFlux) maxFlux = c.flux;
  const floor = Math.max(0, opt.minRelativeStrength);
  const result: OnsetInfo[] = [];
  for (const c of merged) {
    const confidence = maxFlux > 0 ? c.flux / maxFlux : 1;
    if (confidence >= floor) result.push({ time: c.time, confidence });
  }

  if (result.length === 0 || result[0]!.time > 0.001) {
    result.unshift({ time: 0, confidence: 1 });
  }
  return result;
}
