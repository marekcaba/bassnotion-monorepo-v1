/**
 * Granular hi-hat tail extension for the drum slicer (LAUNCH-06).
 *
 * THE PROBLEM. The beat slicer plays each onset slice bit-exact and re-spaces
 * the GAPS to change tempo. At slow tempos a hi-hat plays its short "tick" then
 * SILENCE until the next onset (only the gap stretches, not the hat's tail) —
 * the subdivision loses its flow. This module synthesizes a natural CONTINUED
 * hi-hat decay to bridge that gap, from the slice's own post-transient tail.
 *
 * WHY GRANULAR, NOT WSOLA. Hi-hat tails are broadband metallic NOISE. WSOLA's
 * waveform-similarity search only helps PERIODIC content; on noise it degrades
 * to plain overlap-add, and OLA-on-noise (re-reading the same window) is a comb
 * filter → metallic/"underwater" coloration. The fix is a continuous bed of
 * grains read from RANDOM (decorrelated) offsets within the tail: independent
 * noise slices → flat broadband spectrum (no comb) and NO repeating unit (no
 * secondary rhythm — the exact failure mode of an earlier grain-LOOP attempt,
 * which repeated a FIXED grain and so created a pulse).
 *
 * THE RECIPE (parameters justified by COLA + granular-synthesis-of-noise DSP):
 *  - root-Hann window, 45ms grains, 50% hop → Σw² = 1 exactly (power-COLA), so
 *    the decorrelated-grain bed has constant expected power: no flutter, no
 *    edge clicks, no grain-rate AM tone.
 *  - each grain reads from a uniform-random offset in [0, tailLen−grain], with a
 *    ≥grain/2 anti-repeat from the previous grain so the two overlapping grains
 *    never share source → no short-term self-correlation (no comb).
 *  - a continuing exponential decay (τ fit from the tail's log-RMS, clamped
 *    40–80ms, seeded to the tail's trailing level) so it keeps falling like a
 *    real hat instead of a sustained pad.
 *
 * Pure, synchronous array DSP (no Web Audio, no deps). Per-channel (stereo
 * preserved: same random offset across channels keeps the L/R image). Runs once
 * at load per qualifying slice.
 */

export interface ExtendedTailOptions {
  /** Grain length (s). 45ms reads as smooth noise without a distinct pitch and
   *  is short enough to randomize even a ~60ms tail. */
  grainSeconds?: number;
  /** Decay time constant (s) override. If omitted, fit from the tail's log-RMS
   *  envelope and clamped to [minTau, maxTau]. */
  tau?: number;
  /** Clamp bounds + fallback for the fitted decay τ (s). Hats decay fast. */
  minTauSeconds?: number;
  maxTauSeconds?: number;
  /** RMS window (s) for splice-level + decay estimation. */
  rmsWindowSeconds?: number;
  /** Seed for a deterministic PRNG so a slice's fill is reproducible across
   *  reloads/tests. Omit ⇒ Math.random(). */
  seed?: number;
}

const DEFAULTS: Required<Omit<ExtendedTailOptions, 'tau' | 'seed'>> = {
  grainSeconds: 0.045,
  minTauSeconds: 0.04,
  maxTauSeconds: 0.08,
  rmsWindowSeconds: 0.005,
};

const TAU_DEFAULT = 0.06; // fallback when the log-RMS fit is degenerate
const SPLICE_FLOOR = 1e-3; // ~ −60 dBFS — below this the tail is "silent"
const MIN_TAIL_SECONDS = 0.02; // need ≥20ms of tail to make a clean bed
const ENERGY_GATE = 0.15; // tailRMS ≥ 0.15 × post-attack peak
const TRANSIENT_GUARD_SECONDS = 0.012; // hat attack 1–2ms; 12ms clears it

/** mulberry32 — tiny deterministic PRNG. Seeded ⇒ reproducible fills. */
function makeRng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periodic root-Hann: sqrt(0.5·(1 − cos(2π·n/L))). Σ over 50%-hop = 1 (power
 *  COLA), so a decorrelated-grain bed has constant expected power. */
function rootHann(L: number): Float32Array {
  const w = new Float32Array(L);
  for (let n = 0; n < L; n++) {
    w[n] = Math.sqrt(0.5 * (1 - Math.cos((2 * Math.PI * n) / L)));
  }
  return w;
}

/** Mono-summed RMS over [start, start+len) of the per-channel arrays. */
function monoRms(channels: Float32Array[], start: number, len: number): number {
  const ch = channels.length;
  let acc = 0;
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let c = 0; c < ch; c++) s += channels[c]![start + i]!;
    s /= ch;
    acc += s * s;
  }
  return Math.sqrt(acc / Math.max(1, len));
}

/**
 * Transient-end offset within a slice (samples from the slice start). Fixed
 * 12ms guard — hat attacks are 1–2ms, so 12ms reliably clears the attack while
 * leaving tail even on short closed hats. Kept as a function so a smarter knee
 * detector can replace it later without touching callers.
 */
export function transientEndOffset(sampleRate: number): number {
  return Math.round(TRANSIENT_GUARD_SECONDS * sampleRate);
}

/**
 * Gate: is this slice's post-transient tail worth (and safe to) extend?
 * Requires ≥20ms of tail AND tailRMS ≥ 15% of the tail's peak (so decayed
 * transients — kicks, closed ticks — are rejected; only sustaining hits pass).
 */
export function tailIsUsable(
  tailChannels: Float32Array[],
  sampleRate: number,
): boolean {
  const tailLen = tailChannels[0]?.length ?? 0;
  if (tailLen < Math.round(MIN_TAIL_SECONDS * sampleRate)) return false;
  let peak = 0;
  for (let c = 0; c < tailChannels.length; c++) {
    const x = tailChannels[c]!;
    for (let i = 0; i < tailLen; i++) {
      const a = Math.abs(x[i]!);
      if (a > peak) peak = a;
    }
  }
  if (peak <= 0) return false;
  return monoRms(tailChannels, 0, tailLen) >= ENERGY_GATE * peak;
}

/** Linear least-squares slope of ln(frameRMS) vs time ⇒ τ = −1/slope, clamped.
 *  Falls back to TAU_DEFAULT when the fit is degenerate (flat/rising/too short). */
function estimateTau(
  channels: Float32Array[],
  sampleRate: number,
  opt: Required<Omit<ExtendedTailOptions, 'tau' | 'seed'>>,
): number {
  const len = channels[0]!.length;
  const win = Math.max(1, Math.round(opt.rmsWindowSeconds * sampleRate));
  const hop = Math.max(1, win >> 1);
  const floor = 1e-4;
  const ts: number[] = [];
  const ys: number[] = [];
  for (let start = 0; start + win <= len; start += hop) {
    const r = monoRms(channels, start, win);
    if (r < floor) continue;
    ts.push((start + win / 2) / sampleRate);
    ys.push(Math.log(r));
  }
  if (ts.length < 3) return TAU_DEFAULT;
  let st = 0;
  let sy = 0;
  let stt = 0;
  let sty = 0;
  const N = ts.length;
  for (let i = 0; i < N; i++) {
    st += ts[i]!;
    sy += ys[i]!;
    stt += ts[i]! * ts[i]!;
    sty += ts[i]! * ys[i]!;
  }
  const denom = N * stt - st * st;
  if (denom <= 0) return TAU_DEFAULT;
  const slope = (N * sty - st * sy) / denom;
  if (slope >= 0) return TAU_DEFAULT; // not decaying
  const tau = -1 / slope;
  if (!Number.isFinite(tau)) return TAU_DEFAULT;
  return Math.min(opt.maxTauSeconds, Math.max(opt.minTauSeconds, tau));
}

/**
 * Synthesize `outSeconds` of continued hi-hat decay from a slice's POST-
 * TRANSIENT tail. `tailChannels` is the tail region only (per channel). Returns
 * channels of length round(outSeconds·sr), or an empty array `[]` if the tail
 * is unusable / essentially silent (caller skips the fill for that slice).
 */
export function buildExtendedTail(
  tailChannels: Float32Array[],
  sampleRate: number,
  outSeconds: number,
  options: ExtendedTailOptions = {},
): Float32Array[] {
  const opt = { ...DEFAULTS, ...options };
  const numCh = tailChannels.length;
  const tailLen = tailChannels[0]?.length ?? 0;
  if (numCh === 0 || tailLen === 0) return [];
  if (!tailIsUsable(tailChannels, sampleRate)) return [];

  // Splice level = RMS of the tail's trailing window. The fill begins at this
  // level so there's no step at the seam.
  const spliceWin = Math.min(
    tailLen,
    Math.max(1, Math.round(opt.rmsWindowSeconds * sampleRate)),
  );
  const A0 = monoRms(tailChannels, tailLen - spliceWin, spliceWin);
  if (A0 < SPLICE_FLOOR) return []; // near-silent → don't manufacture hiss

  const outLen = Math.max(0, Math.round(outSeconds * sampleRate));
  if (outLen === 0) return [];

  // Grain geometry. Shrink the grain if the source is shorter than nominal so
  // we never read past the tail. Even L ⇒ clean 50% hop.
  let L = Math.round(opt.grainSeconds * sampleRate);
  if (L > tailLen) L = tailLen;
  if (L < 2) return [];
  if (L % 2 !== 0) L -= 1;
  const H = L >> 1; // 50% hop
  const R = tailLen - L; // max legal random read offset
  const minSep = H; // anti-repeat: overlapping grains never share source
  const w = rootHann(L);
  const rng = makeRng(opt.seed);

  // Overlap-add the decorrelated-grain bed (un-enveloped).
  const bed: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) bed.push(new Float32Array(outLen));

  let prevOffset = -(1 << 20);
  for (let outStart = 0; outStart < outLen; outStart += H) {
    let off = 0;
    if (R > 0) {
      for (let tries = 0; tries < 4; tries++) {
        off = (rng() * (R + 1)) | 0;
        if (off > R) off = R;
        if (Math.abs(off - prevOffset) >= Math.min(minSep, R)) break;
      }
    }
    prevOffset = off;
    const span = Math.min(L, outLen - outStart);
    for (let c = 0; c < numCh; c++) {
      const src = tailChannels[c]!;
      const dst = bed[c]!;
      for (let n = 0; n < span; n++) {
        dst[outStart + n]! += w[n]! * src[off + n]!;
      }
    }
  }

  // Measure the bed's RMS over a central region (avoid the partial-overlap
  // edges) so we can renormalize it to the splice level.
  const edge = Math.min(H, outLen >> 2);
  const measLen = Math.max(1, outLen - 2 * edge);
  const bedRms = monoRms(bed, edge, measLen);
  if (bedRms < 1e-9) return [];

  // Continuing exponential decay seeded to A0: g(t) = (A0/bedRms)·e^(−t/τ).
  // Plus a short equal-power (sin) fade-in so a caller butting this against the
  // slice's faded-out tail gets a constant-power splice.
  const tau = opt.tau ?? estimateTau(tailChannels, sampleRate, opt);
  const k = 1 / (tau * sampleRate);
  const baseGain = A0 / bedRms;
  const fadeLen = Math.min(outLen, Math.round(0.01 * sampleRate));

  const out: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) {
    const dst = bed[c]!;
    for (let i = 0; i < outLen; i++) {
      let g = baseGain * Math.exp(-k * i);
      if (i < fadeLen) g *= Math.sin((Math.PI / 2) * (i / fadeLen));
      dst[i]! *= g;
    }
    out.push(dst);
  }
  return out;
}
