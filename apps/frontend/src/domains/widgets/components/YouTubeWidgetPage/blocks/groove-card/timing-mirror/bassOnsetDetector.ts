/**
 * bassOnsetDetector — bass-tuned onset detection for the timing-mirror spike.
 *
 * Wraps the production drum-slicer detector (`detectOnsetsDetailed`,
 * spectral-flux + own FFT + per-onset confidence, 10 unit tests) READ-ONLY.
 * We pass per-call options and a pre-filtered buffer; we NEVER mutate the
 * drum-tuned DEFAULTS (that detector is the live slicer's analysis path, ear-
 * tuned against Ableton's transient density).
 *
 * Three bass-specific adaptations (the removed amplitude probe over-triggered on
 * bass sustain — 92 onsets on a 14s line vs ~75 real; spectral-flux + these fixes
 * is categorically stronger):
 *   1. HIGH-PASS the input first. A held ~41 Hz E1 sustains low-frequency energy
 *      that an amplitude gate re-triggers on; the ATTACK transient (pluck / finger
 *      noise) is broadband and survives the HPF, the sustain doesn't. So HPF keeps
 *      attack flux, kills sustain flux → one onset per note.
 *   2. minOnsetGapSeconds ~0.08 (one bass note = one onset; drum default 0.035 is
 *      too fast and splits a single note).
 *   3. SKIP suppressBodyFragments (a 140ms drum-body MERGE — the opposite of what
 *      sustained bass wants). We call detectOnsetsDetailed directly, never via
 *      DrumBeatsPlayer.analyze().
 *
 * Also drops the detector's synthetic origin onset (it always emits {time:0,
 * confidence:1}); a real first note is never exactly at sample 0.
 *
 * Pure (no AudioContext): the HPF is a direct biquad over the samples, so this is
 * unit-testable offline — Step 2 of the build order.
 */

import {
  detectOnsetsDetailed,
  type OnsetInfo,
} from '@/domains/playback/services/core/drum-slicer/detectOnsets.js';

export interface BassOnsetOptions {
  /** High-pass cutoff (Hz). Cuts sustain fundamentals below it, keeps attacks.
   *  CAUTION: too high cuts the ATTACK energy of very low notes too — an 80 Hz
   *  cutoff under-detects a 41 Hz low-E (its attack flux drops below threshold).
   *  ~45 Hz sits just under a low-E fundamental, taming the steady-state sustain
   *  drone while preserving the broadband pluck transient. Tune by ear; the
   *  spectral-flux's half-wave-rectified rising-energy bias does most of the
   *  sustain rejection anyway. 0 disables the HPF. */
  highPassHz?: number;
  /** Min gap between onsets (s). One bass note = one onset. */
  minOnsetGapSeconds?: number;
  /** Spectral-flux sensitivity (passed through). Higher = fewer onsets. */
  sensitivity?: number;
  /** Global confidence floor — drop onsets below this fraction of the loudest
   *  onset's flux. Tune by ear against the note-count guard (see defaults note). */
  minRelativeStrength?: number;
}

// Defaults RE-TUNED against a real Clarett DI bass take (2026-06-20). The earlier
// values (sensitivity 0.6, floor 0.05) were derived from a SYNTHETIC test signal
// and over-triggered ~10x on real audio (219 onsets for ~16-32 played notes) — a
// hot DI bass has far more sustain/flux energy than the generated signal. The ear
// is ground truth; these match the played note count on real bass:
//   sensitivity 2.1 — flux peak must clear localMean*(1+2.1); the big over-trigger lever
//   minOnsetGap 0.12s — one note can't re-fire within 120ms
//   minRelativeStrength 0.25 — drop the weak sustain fragments (they sit well below 0.25)
const BASS_DEFAULTS: Required<BassOnsetOptions> = {
  highPassHz: 45,
  minOnsetGapSeconds: 0.12,
  sensitivity: 2.1,
  minRelativeStrength: 0.25,
};

/**
 * A 2nd-order Butterworth high-pass biquad, applied in-place over a mono signal.
 * Standard RBJ cookbook coefficients (Q = 1/√2). Pure JS so the wrapper needs no
 * AudioContext and stays unit-testable.
 */
export function highPassInPlace(
  signal: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): Float32Array {
  if (cutoffHz <= 0) return signal;
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const Q = Math.SQRT1_2; // Butterworth
  const alpha = sinw0 / (2 * Q);

  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = (1 + cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  // normalize
  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < signal.length; i++) {
    const x0 = signal[i]!;
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    signal[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return signal;
}

/** Build a single-channel AudioBuffer-shaped object from a Float32Array.
 *  detectOnsetsDetailed only reads getChannelData(0) + sampleRate + length, so a
 *  minimal duck-typed buffer avoids needing a real AudioContext in tests. */
function asMonoBuffer(signal: Float32Array, sampleRate: number): AudioBuffer {
  return {
    sampleRate,
    length: signal.length,
    duration: signal.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => signal,
  } as unknown as AudioBuffer;
}

/**
 * Detect bass note onsets in a mono signal. Returns onsets in seconds (ascending),
 * WITHOUT the synthetic origin, high-pass-filtered to suppress sustain re-triggers.
 *
 * Takes a Float32Array (not an AudioBuffer) so it's pure/testable; the caller
 * decodes the recorded take to mono samples first.
 */
export function detectBassOnsets(
  signal: Float32Array,
  sampleRate: number,
  options: BassOnsetOptions = {},
): OnsetInfo[] {
  const opt = { ...BASS_DEFAULTS, ...options };

  // HPF on a COPY (don't clobber the caller's buffer — they may want it for the
  // visualizer / waveform-zoom cross-check).
  const filtered = highPassInPlace(
    Float32Array.from(signal),
    sampleRate,
    opt.highPassHz,
  );

  const onsets = detectOnsetsDetailed(asMonoBuffer(filtered, sampleRate), {
    minOnsetGapSeconds: opt.minOnsetGapSeconds,
    sensitivity: opt.sensitivity,
    minRelativeStrength: opt.minRelativeStrength,
  });

  // Drop the detector's synthetic origin onset (it always prepends {time:0}).
  // A real first note is never exactly at sample 0; > ~1ms is safe.
  return onsets.filter((o) => o.time > 0.001);
}

/**
 * Peak-normalize a signal to near full-scale (a COPY — never mutates the input). A
 * quiet take hurts onset detection AND the attack-snap (a soft attack ramps to its
 * threshold late). Scaling to ~0.97 peak gives detection a loud, punchy signal
 * regardless of input gain. No-op on silence.
 */
export function normalizePeak(signal: Float32Array, target = 0.97): Float32Array {
  let peak = 0;
  for (let i = 0; i < signal.length; i++) {
    const a = Math.abs(signal[i] ?? 0);
    if (a > peak) peak = a;
  }
  if (peak <= 1e-6) return Float32Array.from(signal);
  const gain = target / peak;
  const out = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) out[i] = (signal[i] ?? 0) * gain;
  return out;
}

/**
 * Snap onset TIMES to the actual ATTACK EDGE — the point of STEEPEST ENERGY RISE.
 *
 * THE BUG this replaces: the old version walked FORWARD to "50% of the window's PEAK
 * sample". On a sustaining bass note the BODY swells LOUDER than the pluck (the
 * fundamental builds after the transient), so "50% of peak" landed DEEP IN THE BODY,
 * not on the attack — the visible "blue ticks sit in the middle of the note" bug.
 * Same flaw produced multiple ticks reading as noise.
 *
 * THE FIX: a transient is where energy RISES FASTEST, regardless of how loud the body
 * later becomes. We build a short-time energy envelope around the onset and return the
 * sample of MAXIMUM POSITIVE SLOPE (the leading edge of the pluck). The window is
 * CENTERED on the detector's onset (look back a little + forward), so the snap can pull
 * the tick EARLIER toward the true pluck — not only later. Loudness-invariant: a quiet
 * pluck before a loud body still wins on slope. Used for BOTH the reference (admin
 * editor) and the live player take, so the two align on the same convention.
 */
export function snapOnsetTimesToAttack(
  onsetsSec: number[],
  signal: Float32Array,
  sampleRate: number,
  lookSec = 0.03,
): number[] {
  // Short-time energy envelope step (~1ms) — smooths sample-to-sample wobble so the
  // slope reflects the note's RISE, not zero-crossing noise.
  const envStep = Math.max(1, Math.floor(0.001 * sampleRate));
  const lookFwd = Math.floor(lookSec * sampleRate);
  // Look BACK ~12ms too: the detector's flux peak can sit just AFTER the true pluck
  // edge, so the steepest rise may be slightly before the reported onset.
  const lookBack = Math.floor(0.012 * sampleRate);

  // Local RMS energy at sample i (over [i, i+envStep)).
  const energyAt = (i: number): number => {
    let s = 0;
    const end = Math.min(signal.length, i + envStep);
    for (let k = i; k < end; k++) {
      const v = signal[k] ?? 0;
      s += v * v;
    }
    return Math.sqrt(s / Math.max(1, end - i));
  };

  return onsetsSec.map((t) => {
    const center = Math.floor(t * sampleRate);
    const start = Math.max(0, center - lookBack);
    const end = Math.min(signal.length - envStep, center + lookFwd);
    if (end <= start) return t;

    // Build the envelope across the window + find its PEAK (so the threshold is
    // relative to THIS note, loudness-invariant).
    const idxs: number[] = [];
    const envs: number[] = [];
    let envMax = 0;
    for (let i = start; i <= end; i += envStep) {
      const e = energyAt(i);
      idxs.push(i);
      envs.push(e);
      if (e > envMax) envMax = e;
    }
    if (envMax <= 0) return t;

    // The attack EDGE = the FIRST place energy crosses a low fraction of the note's
    // own peak (the foot of the rise). Scanning for the FIRST crossing — not the
    // steepest/loudest — is what keeps us on the sharp pluck and OFF the louder body
    // swell that comes after it. 12% of the note peak clears the pre-note floor while
    // still catching the very start of the transient.
    const thr = envMax * 0.12;
    for (let n = 0; n < envs.length; n++) {
      if (envs[n]! >= thr) {
        // step back one env-hop to the foot of the rise (where it left the floor)
        const foot = n > 0 ? idxs[n - 1]! : idxs[n]!;
        return foot / sampleRate;
      }
    }
    return t;
  });
}

/**
 * Reject onsets that are BODY RIPPLE, not real attacks — the decisive over-trigger fix.
 *
 * PROVEN on a real Clarett DI take (2026-06-21, ogg-padding-probe sibling): a held bass
 * note's body PULSES (~7-8 Hz amplitude ripple from the note's decay/beating), and
 * spectral-flux fires on EVERY up-pulse → 5+ false onsets per note, spaced ~125ms (just
 * over the 120ms gap floor, so the gap guard misses them). In the take, only 7 energy
 * rises were preceded by near-silence (TRUE attacks) vs 211 preceded by loud energy
 * (RIPPLES).
 *
 * THE PHYSICS: a real pluck rises from a QUIET/decaying lead-in (the gap or tail before
 * the note); a body ripple rises from ALREADY-LOUD energy (the sustaining note). So keep
 * an onset only if the energy in the window JUST BEFORE it is low relative to the energy
 * AT it — i.e. there was a real quiet-to-loud jump. This separates attacks from ripples
 * by physics, not by a timing threshold (which can't, since ripples clear the gap floor).
 *
 * @param preSec    how far back to look for the "before" energy (~40ms). 40 (not 25)
 *                  because the snap lands the onset ON the attack edge, so a 25ms window
 *                  clips into the note's own rise; 40ms reaches the genuine lead-in.
 * @param riseRatio pre-energy must be below this fraction of onset-energy to qualify as a
 *                  real attack. Calibrated on the real DI take: a true attack's 40ms-before
 *                  is ~0.40× its onset energy; a body ripple's is ~0.93× (before≈onset, no
 *                  jump). 0.6 sits cleanly between, with margin on both sides.
 */
export function rejectBodyRipple(
  onsetsSec: number[],
  signal: Float32Array,
  sampleRate: number,
  preSec = 0.04,
  riseRatio = 0.6,
): number[] {
  const preSamples = Math.floor(preSec * sampleRate);
  const atSamples = Math.floor(0.01 * sampleRate); // 10ms at-onset window
  const rms = (from: number, len: number): number => {
    const start = Math.max(0, from);
    const end = Math.min(signal.length, start + len);
    let s = 0;
    for (let i = start; i < end; i++) {
      const v = signal[i] ?? 0;
      s += v * v;
    }
    return Math.sqrt(s / Math.max(1, end - start));
  };
  return onsetsSec.filter((t) => {
    const at = Math.floor(t * sampleRate);
    const before = rms(at - preSamples, preSamples);
    const onset = rms(at, atSamples);
    if (onset <= 1e-5) return false; // silence — not a note
    // Real attack: the lead-in was clearly quieter than the attack (a true jump).
    return before <= onset * riseRatio;
  });
}

/**
 * Merge onsets that landed within `minGapSec` of each other — the cleanup after
 * snapping. Spectral-flux can fire 2-3 times across one bass note's swelling body;
 * the slope-snap pulls those back toward the SAME attack edge, so they become near-
 * duplicates. Collapse each cluster to its EARLIEST member (the true attack). This is
 * what kills the "one note, two or three blue ticks" over-trigger that read as noise.
 * Expects ascending input; returns ascending.
 */
export function dedupNearbyOnsets(onsetsSec: number[], minGapSec = 0.155): number[] {
  if (onsetsSec.length === 0) return [];
  const sorted = [...onsetsSec].sort((a, b) => a - b);
  const out: number[] = [sorted[0]!];
  let lastSeen = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    // Chain against the PREVIOUS onset (last seen), not the last KEPT one: a slow
    // multi-trigger across one note (0.10, 0.135, 0.17 — each ~35ms apart) is one
    // note and must fully collapse, even though 0.17 is >minGap from the kept 0.10.
    if (sorted[i]! - lastSeen >= minGapSec) out.push(sorted[i]!);
    lastSeen = sorted[i]!;
  }
  return out;
}

/**
 * ADAPTIVE bass onset detection — finds the strength floor from the take's OWN
 * onset-confidence distribution, so it works on a loud OR quiet player without a
 * fixed threshold or a slider. The core of the bass-coach v2 redesign: the only
 * runtime unknown is the player's signal, and we adapt to it automatically.
 *
 * How: detect permissively (catch everything), then find the natural CUTOFF in the
 * sorted confidences that separates real notes (a strong cluster) from noise /
 * sustain fragments (a weak tail). We use the largest RELATIVE gap in the sorted
 * confidences — a parameter-free split point — clamped to a sane floor band.
 *
 * `expectedCount` (optional) nudges the cutoff toward a known target (e.g. the
 * stored reference's note count) without forcing it.
 */
export function detectBassOnsetsAdaptive(
  signal: Float32Array,
  sampleRate: number,
  opts: { highPassHz?: number; minOnsetGapSeconds?: number; expectedCount?: number } = {},
): OnsetInfo[] {
  // Permissive pass: catch every candidate (real notes + noise tail) with a
  // near-zero strength floor, then let the adaptive floor split them below.
  // Sensitivity (peak-picking) is signal-dependent — hot DI ~2.1, quiet/clean ~0.6
  // — so we sweep and take the richest result, giving the floor the full candidate
  // set. This is what lets ONE call adapt across loud and quiet players.
  const gap = opts.minOnsetGapSeconds ?? BASS_DEFAULTS.minOnsetGapSeconds;
  // Use the default HPF unless explicitly overridden. NEVER pass `undefined` — the
  // detector spreads options over BASS_DEFAULTS, so an undefined highPassHz would
  // OVERRIDE the 45Hz default with undefined → NaN biquad coeffs → wrecks the
  // signal → 0 onsets. (This was the live "0% coverage" bug.)
  const highPassHz = opts.highPassHz ?? BASS_DEFAULTS.highPassHz;
  let all: OnsetInfo[] = [];
  for (const sensitivity of [2.1, 1.4, 0.9, 0.6]) {
    const got = detectBassOnsets(signal, sampleRate, {
      highPassHz,
      minOnsetGapSeconds: gap,
      sensitivity,
      minRelativeStrength: 0.005,
    });
    if (got.length > all.length) all = got;
  }
  if (all.length <= 1) return all;
  // If the candidate set is already at or below the target, there's no noise tail
  // to cull — keep everything (culling would drop real notes).
  if (opts.expectedCount != null && all.length <= opts.expectedCount) return all;

  const cutoff = adaptiveConfidenceFloor(
    all.map((o) => o.confidence),
    opts.expectedCount,
  );
  return all.filter((o) => o.confidence >= cutoff);
}

/**
 * Find the confidence floor that separates the real-note cluster from the noise
 * tail. Sorts confidences descending and looks for the largest DROP (relative gap)
 * — real notes sit above it, fragments below. Clamped to [0.04, 0.9] (a wide band:
 * only an absurd all-or-nothing cutoff is prevented). If expectedCount is given,
 * the cutoff keeps ~that many onsets.
 */
export function adaptiveConfidenceFloor(
  confidences: number[],
  expectedCount?: number,
): number {
  const sorted = [...confidences].sort((a, b) => b - a); // descending
  if (sorted.length <= 1) return 0.04;

  // If we know roughly how many notes to expect, the cutoff is just below the
  // confidence of the expectedCount-th onset — robust and simple.
  if (expectedCount != null && expectedCount >= 1 && expectedCount < sorted.length) {
    const atTarget = sorted[expectedCount - 1]!;
    const nextDown = sorted[expectedCount] ?? 0;
    const mid = (atTarget + nextDown) / 2;
    return clamp(mid, 0.04, 0.9);
  }

  // Otherwise: find the largest gap between consecutive sorted confidences. But
  // ONLY cut if that gap is SIGNIFICANT — on a clean take all onsets are real
  // (tight cluster, no noise tail), and an insignificant gap must NOT invent a
  // split that culls real notes. "Significant" = the gap is a large fraction of
  // the total confidence spread AND the lower side is genuinely weak.
  let bestGap = 0;
  let bestCut = 0;
  for (let i = 1; i < sorted.length - 1; i++) {
    const hi = sorted[i]!;
    const lo = sorted[i + 1]!;
    const gap = hi - lo;
    if (gap > bestGap) {
      bestGap = gap;
      bestCut = (hi + lo) / 2;
    }
  }
  const spread = sorted[0]! - sorted[sorted.length - 1]!;
  // require the gap to be a clear majority of the spread AND below it to be weak,
  // else there's no note/noise boundary → keep everything (floor at the minimum).
  const significant = bestGap > spread * 0.4 && bestCut < 0.5;
  return significant ? clamp(bestCut, 0.04, 0.9) : 0.04;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
