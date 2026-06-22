/**
 * quiet-cluster-placement-probe.mjs — reproduce + fix the QUIET-CLUSTER early-placement bug (2026-06-22).
 *
 * THE BUG (from the user's real labelled dump): every badly-EARLY marker (errMs −33..−42) has LOW
 * strength (0.15–0.25) and sits in a FAST RUN — a quiet note layered on the DECAYING TAIL of a louder
 * note ~50–120ms earlier. hop128 + the soft/sharp refine branch are ALREADY shipped and these notes are
 * STILL ~40ms early. Hypothesis (from the diagnosis): the refine's ABSOLUTE steepest-RMS-rise metric is
 * dominated by the louder neighbour's tail ripple, so it anchors on the tail's wiggle, not the faint new
 * pluck; and the 0.6×localPeak edge-walk self-cancels because localPeak is set by the tail
 * (0.6×localPeak is already exceeded at the band start).
 *
 * WHAT THIS PROBE DOES (all DSP inlined, ported byte-for-byte from the production files + the existing
 * highres-localization-probe.mjs so the numbers are the SHIPPED behaviour, not an approximation):
 *
 *   1. Detect the take's attacks (the visual ground-truth locator from highres-localization-probe) →
 *      these are the "true attack" reference AND the proxy for the coach's authored markers (we place a
 *      marker AT each true attack, exactly as the real flow places one per authored onset).
 *
 *   2. Classify each note QUIET-CLUSTER iff: (local peak < 0.5× the take peak) AND (the previous note is
 *      within 140ms AND was LOUDER). This is the exact population the dump complains about.
 *
 *   3. CURRENT placement = production: hop128 complex-domain df → first-strong-peak pick (+1.6× look-ahead)
 *      → attackRise soft/sharp branch → refineToEnvelopeRise (steepest abs rise + 0.6 edge-walk). Measure
 *      its error vs the true attack, split by class. We must reproduce the −40ms on the quiet cluster.
 *
 *   4. GROUND TRUTH per note = a TAIL-SUBTRACTED attack: estimate the decaying neighbour's envelope by
 *      fitting the RMS just BEFORE this note's window and extrapolating its exponential decay across the
 *      window, subtract it, and take the steepest FRACTIONAL rise of the residual. This is the locator a
 *      human eye does ("where does THIS note's own energy start climbing above the fading previous one").
 *      Cross-checked against the visual-attack list for the CLEAN notes (must agree there).
 *
 *   5. THE THREE CANDIDATE FIXES, each measured against true attack, on BOTH classes (must fix quiet
 *      cluster WITHOUT regressing clean notes):
 *        (a) SHRINK back-reach for low-strength notes (don't let the window start in the loud tail).
 *        (b) STEEPEST FRACTIONAL rise — normalize the rise by local RMS so a fixed-fraction climb wins,
 *            not absolute Δ (the faint pluck's own steepest climb beats the loud tail's bigger absolute
 *            wiggle). PLUS require the rise to be preceded by a local energy MINIMUM (a real attack rises
 *            from a dip; a ring doesn't).
 *        (c) ANCHOR tighter to the df peak (shrink REFINE_BACK so the refine can't walk back onto tail).
 *
 *   node docs/dev-tools/audio-audit/quiet-cluster-placement-probe.mjs [bass.wav]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ───────────────────────── WAV reader (highres-localization-probe.mjs) ─────────────────────────
function parseWav(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, false) !== 0x52494646) throw new Error('not RIFF');
  let off = 12, fmt = null, dataOff = 0, dataLen = 0;
  while (off + 8 <= dv.byteLength) {
    const id = dv.getUint32(off, false);
    const sz = dv.getUint32(off + 4, true);
    const body = off + 8;
    if (id === 0x666d7420) {
      fmt = {
        audioFormat: dv.getUint16(body, true),
        channels: dv.getUint16(body + 2, true),
        sampleRate: dv.getUint32(body + 4, true),
        bitsPerSample: dv.getUint16(body + 14, true),
      };
    } else if (id === 0x64617461) { dataOff = body; dataLen = sz; }
    off = body + sz + (sz & 1);
  }
  if (!fmt) throw new Error('no fmt chunk');
  const { channels, sampleRate, bitsPerSample, audioFormat } = fmt;
  const frames = [];
  if (audioFormat === 3 && bitsPerSample === 32) {
    const n = dataLen / 4;
    for (let i = 0; i < n; i++) frames.push(dv.getFloat32(dataOff + i * 4, true));
  } else if (audioFormat === 1 && bitsPerSample === 16) {
    const n = dataLen / 2;
    for (let i = 0; i < n; i++) frames.push(dv.getInt16(dataOff + i * 2, true) / 32768);
  } else {
    throw new Error(`unsupported WAV: fmt=${audioFormat} bits=${bitsPerSample}`);
  }
  const mono = new Float32Array(Math.floor(frames.length / channels));
  for (let i = 0; i < mono.length; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) s += frames[i * channels + c];
    mono[i] = s / channels;
  }
  return { sampleRate, channels, samples: mono };
}
function normalizePeak(signal, target = 0.9) {
  let peak = 0;
  for (let i = 0; i < signal.length; i++) { const a = Math.abs(signal[i] ?? 0); if (a > peak) peak = a; }
  if (peak < 1e-6) return Float32Array.from(signal);
  const gain = target / peak;
  const out = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) out[i] = (signal[i] ?? 0) * gain;
  return out;
}

// ───────────── EXACT FFT + complex-domain df (complexDomainOnsets.ts) ─────────────
function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wpr = Math.cos(ang), wpi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = wr * re[b] - wi * im[b], ti = wr * im[b] + wi * re[b];
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] = re[a] + tr; im[a] = im[a] + ti;
        const nwr = wr * wpr - wi * wpi; wi = wr * wpi + wi * wpr; wr = nwr;
      }
    }
  }
}
const FFT = 2048;
function complexDomainDF(signal, sampleRate, hopSize) {
  const fftSize = FFT, half = fftSize / 2;
  const win = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
  const numFrames = Math.max(0, Math.floor((signal.length - fftSize) / hopSize) + 1);
  const df = new Float32Array(numFrames);
  const prevMag = new Float32Array(half), prevPhase = new Float32Array(half), prevPrevPhase = new Float32Array(half);
  const re = new Float32Array(fftSize), im = new Float32Array(fftSize);
  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    for (let i = 0; i < fftSize; i++) { re[i] = (signal[start + i] ?? 0) * win[i]; im[i] = 0; }
    fftInPlace(re, im);
    let sum = 0;
    for (let k = 0; k < half; k++) {
      const mag = Math.hypot(re[k], im[k]);
      const phase = Math.atan2(im[k], re[k]);
      if (f >= 2) {
        const predPhase = 2 * prevPhase[k] - prevPrevPhase[k];
        const predMag = prevMag[k];
        const dr = mag * Math.cos(phase) - predMag * Math.cos(predPhase);
        const di = mag * Math.sin(phase) - predMag * Math.sin(predPhase);
        sum += Math.hypot(dr, di);
      }
      prevPrevPhase[k] = prevPhase[k]; prevPhase[k] = phase; prevMag[k] = mag;
    }
    df[f] = sum;
  }
  let max = 0;
  for (let i = 0; i < numFrames; i++) if (df[i] > max) max = df[i];
  if (max > 0) for (let i = 0; i < numFrames; i++) df[i] /= max;
  return { df, hopSec: hopSize / sampleRate, hopSize };
}

// ───────────── visual attack ground truth + proxy markers (highres-localization-probe.mjs) ─────────────
const ENV_STEP_SEC = 0.001;
function buildEnvelope(signal, sampleRate) {
  const step = Math.max(1, Math.round(ENV_STEP_SEC * sampleRate));
  const n = Math.floor(signal.length / step);
  const env = new Float32Array(n);
  for (let b = 0; b < n; b++) { let p = 0; for (let i = 0; i < step; i++) { const a = Math.abs(signal[b * step + i] ?? 0); if (a > p) p = a; } env[b] = p; }
  return { env, stepSec: step / sampleRate };
}
function findAttacks(env, stepSec, globalPeak) {
  const attacks = [];
  const fwdWin = Math.round(0.05 / stepSec), riseWin = Math.round(0.02 / stepSec), refractory = Math.round(0.13 / stepSec);
  let lastIdx = -refractory;
  for (let b = riseWin; b < env.length - fwdWin; b++) {
    if (b - lastIdx < refractory) continue;
    let peak = 0, peakK = b;
    for (let k = b; k < b + fwdWin; k++) if (env[k] > peak) { peak = env[k]; peakK = k; }
    if (peak < globalPeak * 0.18) continue;
    let trough = Infinity;
    for (let k = b - riseWin; k <= b; k++) if (env[k] < trough) trough = env[k];
    if (peak < trough * 2.2 + globalPeak * 0.05) continue;
    if (env[b] > trough * 1.3 + globalPeak * 0.02) continue;
    const thr = peak * 0.25;
    let cross = b;
    for (let k = b; k <= peakK; k++) { if (env[k] >= thr) { cross = k; break; } }
    attacks.push({ attackSec: cross * stepSec, localPeak: peak });
    lastIdx = cross;
  }
  return attacks;
}

// ───────────── PRODUCTION placement (measureAtMarkers.ts) — ported verbatim ─────────────
const BACK_REACH_SEC = 0.045, WINDOW_SEC = 0.12, MIN_ABS = 0.15;
const REFINE_BACK_SEC = 0.012, REFINE_FWD_SEC = 0.03, REFINE_ENV_SEC = 0.004;
const EDGE_PEAK_FRACTION = 0.6, SHARP_RISE_SEC = 0.012;

let SIGNAL, SR;
function rmsAt(center, envHalf) {
  let acc = 0;
  for (let k = center - envHalf; k <= center + envHalf; k++) { const v = SIGNAL[k] ?? 0; acc += v * v; }
  return Math.sqrt(acc / (2 * envHalf + 1));
}
function attackRiseSec(dfSampleCenter, searchLo, searchHi) {
  const envHalf = Math.max(1, Math.round((REFINE_ENV_SEC * SR) / 2));
  const lo = Math.max(envHalf, searchLo, dfSampleCenter - Math.round(REFINE_BACK_SEC * SR));
  const hi = Math.min(SIGNAL.length - envHalf - 1, searchHi, dfSampleCenter + Math.round(REFINE_FWD_SEC * SR));
  if (hi <= lo) return null;
  let peak = 0;
  for (let s = lo; s <= hi; s += envHalf) peak = Math.max(peak, rmsAt(s, envHalf));
  if (peak <= 1e-6) return null;
  const lowThr = peak * 0.1, highThr = peak * 0.9;
  let t10 = -1, t90 = -1;
  for (let s = lo; s <= hi; s++) {
    const e = rmsAt(s, envHalf);
    if (t10 < 0 && e >= lowThr) t10 = s;
    if (t10 >= 0 && e >= highThr) { t90 = s; break; }
  }
  if (t10 < 0 || t90 < 0 || t90 <= t10) return null;
  return (t90 - t10) / SR;
}
// production steepest-abs-rise + 0.6 edge-walk
function refineProd(dfSampleCenter, searchLo, searchHi, doEdgeWalk) {
  const envHalf = Math.max(1, Math.round((REFINE_ENV_SEC * SR) / 2));
  const lo = Math.max(envHalf, searchLo, dfSampleCenter - Math.round(REFINE_BACK_SEC * SR));
  const hi = Math.min(SIGNAL.length - envHalf - 1, searchHi, dfSampleCenter + Math.round(REFINE_FWD_SEC * SR));
  if (hi <= lo) return dfSampleCenter;
  let bestSample = dfSampleCenter, bestRise = -Infinity, localPeak = 0, prevRms = rmsAt(lo, envHalf);
  for (let s = lo + 1; s <= hi; s++) {
    const curRms = rmsAt(s, envHalf);
    if (curRms > localPeak) localPeak = curRms;
    const rise = curRms - prevRms;
    if (rise > bestRise) { bestRise = rise; bestSample = s; }
    prevRms = curRms;
  }
  if (doEdgeWalk && localPeak > 1e-6) {
    const crossThr = localPeak * EDGE_PEAK_FRACTION;
    for (let s = bestSample; s <= hi; s++) if (rmsAt(s, envHalf) >= crossThr) return s;
  }
  return bestSample;
}
function pickDfFrameInWindow(df, hopSec, markerBufSec, backSec, fwdSec, dfPeak) {
  const fromFrame = Math.max(0, Math.floor((markerBufSec - backSec) / hopSec));
  const toFrame = Math.min(df.length - 1, Math.ceil((markerBufSec + fwdSec) / hopSec));
  if (toFrame <= fromFrame) return null;
  const dfFloor = dfPeak * MIN_ABS;
  let windowMax = 0;
  for (let f = fromFrame; f <= toFrame; f++) if (df[f] > windowMax) windowMax = df[f];
  if (windowMax < dfFloor) return null;
  const acceptThr = Math.max(dfFloor, windowMax * 0.3);
  let bestFrame = -1, bestVal = 0;
  for (let f = fromFrame; f <= toFrame; f++) {
    const isPeak = df[f] >= (df[f - 1] ?? 0) && df[f] >= (df[f + 1] ?? 0);
    if (isPeak && df[f] >= acceptThr) { bestFrame = f; bestVal = df[f]; break; }
  }
  if (bestFrame >= 0) {
    const lookAhead = Math.max(1, Math.round(0.025 / hopSec));
    for (let f = bestFrame + 1; f <= Math.min(toFrame, bestFrame + lookAhead); f++) {
      const isPeak = df[f] >= (df[f - 1] ?? 0) && df[f] >= (df[f + 1] ?? 0);
      if (isPeak && df[f] >= bestVal * 1.6) { bestFrame = f; bestVal = df[f]; }
    }
  }
  if (bestFrame < 0) return null;
  return { bestFrame, dfAtPeak: bestVal };
}

// ───────────── GROUND TRUTH: tail-subtracted attack of THIS note ─────────────
// Estimate the decaying previous-note envelope from the RMS just BEFORE the note's df region, model it
// as exponential decay, extrapolate across the window, subtract, and take the steepest FRACTIONAL rise of
// the residual. This is "where THIS note's own energy starts climbing above the fading previous note".
function tailSubtractedAttack(dfSampleCenter, searchLo, searchHi) {
  const envHalf = Math.max(1, Math.round((0.003 * SR) / 2)); // 3ms RMS, tighter to see the faint pluck
  const lo = Math.max(envHalf, searchLo, dfSampleCenter - Math.round(0.02 * SR));
  const hi = Math.min(SIGNAL.length - envHalf - 1, searchHi, dfSampleCenter + Math.round(0.04 * SR));
  if (hi <= lo) return dfSampleCenter;
  const step = envHalf; // sample the envelope every envHalf samples
  // fit decay from a pre-window region [lo-25ms .. lo-3ms]: two anchor RMS points → exp rate
  const preA = Math.max(envHalf, lo - Math.round(0.025 * SR));
  const preB = Math.max(preA + step, lo - Math.round(0.003 * SR));
  const rA = rmsAt(preA, envHalf), rB = rmsAt(preB, envHalf);
  let decayRate = 0; // per sample (negative = decaying)
  if (rA > 1e-6 && rB > 1e-6 && preB > preA) decayRate = Math.log(rB / rA) / (preB - preA);
  // tail model at sample s = rB * exp(decayRate*(s-preB)), clamped ≥0
  const tailAt = (s) => Math.max(0, rB * Math.exp(decayRate * (s - preB)));
  // residual envelope = max(0, rms - tail); steepest FRACTIONAL rise of residual
  let bestSample = dfSampleCenter, bestFrac = -Infinity, prevRes = Math.max(1e-6, rmsAt(lo, envHalf) - tailAt(lo));
  for (let s = lo + step; s <= hi; s += step) {
    const res = Math.max(0, rmsAt(s, envHalf) - tailAt(s));
    const frac = (res - prevRes) / Math.max(1e-6, prevRes);
    if (frac > bestFrac && res > 0) { bestFrac = frac; bestSample = s; }
    prevRes = Math.max(1e-6, res);
  }
  return bestSample;
}

// ───────────── FIX (b): steepest FRACTIONAL rise (rise/localRMS) + require a preceding local MIN ─────────────
function refineFractional(dfSampleCenter, searchLo, searchHi) {
  const envHalf = Math.max(1, Math.round((REFINE_ENV_SEC * SR) / 2));
  const lo = Math.max(envHalf, searchLo, dfSampleCenter - Math.round(REFINE_BACK_SEC * SR));
  const hi = Math.min(SIGNAL.length - envHalf - 1, searchHi, dfSampleCenter + Math.round(REFINE_FWD_SEC * SR));
  if (hi <= lo) return dfSampleCenter;
  // precompute rms curve
  const N = hi - lo + 1;
  const r = new Float32Array(N);
  for (let s = lo; s <= hi; s++) r[s - lo] = rmsAt(s, envHalf);
  // steepest FRACTIONAL rise: (r[s]-r[s-1]) / r[s-1]. A faint pluck on a quiet residual still has a
  // big FRACTIONAL jump even though its absolute Δ is small vs a loud tail's ripple.
  let bestSample = dfSampleCenter, bestScore = -Infinity;
  for (let i = 1; i < N; i++) {
    const frac = (r[i] - r[i - 1]) / Math.max(1e-6, r[i - 1]);
    // require a local MINIMUM just before (a real attack rises from a dip; a ring's ripple doesn't):
    // r[i-1] must be ≤ the min of the preceding ~6ms.
    const backW = Math.round(0.006 * SR / envHalf) * envHalf; // not used finely; check raw samples
    let precededByDip = true;
    const dipFrom = Math.max(1, i - Math.round(0.006 * SR));
    let priorMin = Infinity;
    for (let k = dipFrom; k < i; k++) priorMin = Math.min(priorMin, r[k]);
    if (r[i - 1] > priorMin * 1.15 + 1e-6) precededByDip = false; // r[i-1] not near a local floor
    void backW;
    const score = frac * (precededByDip ? 1 : 0.25); // soft-penalize non-dip rises, don't ban
    if (score > bestScore) { bestScore = score; bestSample = lo + i; }
  }
  return bestSample;
}

// ───────────── RUN ─────────────
const wavPath = process.argv[2] || join(import.meta.dirname, 'stems', 'bass.wav');
const w = parseWav(readFileSync(wavPath));
SR = w.sampleRate;
SIGNAL = normalizePeak(w.samples);
let globalPeak = 0;
for (let i = 0; i < SIGNAL.length; i++) { const a = Math.abs(SIGNAL[i]); if (a > globalPeak) globalPeak = a; }

const { env, stepSec } = buildEnvelope(SIGNAL, SR);
const attacks = findAttacks(env, stepSec, globalPeak);
const takePeak = globalPeak;

const { df, hopSec } = complexDomainDF(SIGNAL, SR, 128); // production hop
let dfPeak = 0; for (const v of df) if (v > dfPeak) dfPeak = v;
const frameToSec = (f) => f * hopSec + hopSec / 2;

const startedAt = 0;
const sorted = attacks.map((a) => a.attackSec).slice().sort((a, b) => a - b);

console.log('\n=== QUIET-CLUSTER PLACEMENT probe (reproduce the −40ms early bug + test 3 fixes) ===');
console.log(`stem: ${wavPath}`);
console.log(`sr=${SR}  dur=${(SIGNAL.length / SR).toFixed(2)}s  hop=128 (${(128 / SR * 1000).toFixed(2)}ms grid)  notes=${attacks.length}\n`);

const QUIET_PEAK_FRAC = 0.5;   // note is "quiet" if local peak < this × take peak
const NEAR_MS = 140;           // previous note within this many ms

const rows = [];
for (let ai = 0; ai < attacks.length; ai++) {
  const markerSec = attacks[ai].attackSec;
  const markerBufSec = markerSec - startedAt;
  const trueAttackSec = markerSec; // the visual-attack locator IS our true attack
  const localPeak = attacks[ai].localPeak;

  const i = sorted.indexOf(markerSec);
  const prevSec = i > 0 ? sorted[i - 1] : -Infinity;
  const prevGapMs = i > 0 ? (markerSec - prevSec) * 1000 : Infinity;
  const prevPeak = i > 0 ? attacks[ai - 1].localPeak : 0; // ai aligns to attacks order (sorted == attacks order)
  const nextGap = i < sorted.length - 1 ? sorted[i + 1] - markerSec : Infinity;

  const isQuiet = localPeak < takePeak * QUIET_PEAK_FRAC;
  const prevLouder = prevPeak > localPeak * 1.15;
  const isCluster = isQuiet && prevGapMs <= NEAR_MS && prevLouder;

  const backSec = Math.min(BACK_REACH_SEC, prevGapMs === Infinity ? BACK_REACH_SEC : (prevGapMs / 1000) * 0.4);
  const fwdSec = Math.min(WINDOW_SEC, nextGap * 0.6);

  const pk = pickDfFrameInWindow(df, hopSec, markerBufSec, backSec, fwdSec, dfPeak);
  if (!pk) continue;
  const strength = dfPeak > 0 ? Math.min(1, pk.dfAtPeak / dfPeak) : 0;
  const dfSampleCenter = Math.round(frameToSec(pk.bestFrame) * SR);
  const searchLo = Math.max(0, Math.round((markerBufSec - backSec) * SR));
  const searchHi = Math.min(SIGNAL.length - 1, Math.round((markerBufSec + fwdSec) * SR));

  // CURRENT production placement
  const sharpness = attackRiseSec(dfSampleCenter, searchLo, searchHi);
  const isSharp = sharpness != null && sharpness <= SHARP_RISE_SEC;
  const curSample = refineProd(dfSampleCenter, searchLo, searchHi, !isSharp);
  const curSec = startedAt + curSample / SR;

  // GROUND TRUTH (tail-subtracted) — only meaningfully different from visual on cluster notes
  const gtSample = tailSubtractedAttack(dfSampleCenter, searchLo, searchHi);
  const gtSec = startedAt + gtSample / SR;

  // FIX (a) shrink back-reach for LOW-strength notes (start window no earlier than df center − 8ms)
  const backA = strength < 0.30 ? Math.min(backSec, 0.012) : backSec;
  const searchLoA = Math.max(0, Math.round((markerBufSec - backA) * SR));
  const pkA = pickDfFrameInWindow(df, hopSec, markerBufSec, backA, fwdSec, dfPeak);
  let fixASec = curSec;
  if (pkA) {
    const dfcA = Math.round(frameToSec(pkA.bestFrame) * SR);
    const sampA = refineProd(dfcA, searchLoA, searchHi, !isSharp);
    fixASec = startedAt + sampA / SR;
  }

  // FIX (b) steepest FRACTIONAL rise + preceded-by-dip
  const sampB = refineFractional(dfSampleCenter, searchLo, searchHi);
  const fixBSec = startedAt + sampB / SR;

  // FIX (c) anchor tighter to df peak: REFINE_BACK 12ms → 4ms (can't walk back onto tail)
  const tightBack = Math.round(0.004 * SR);
  const loC = Math.max(Math.round((REFINE_ENV_SEC * SR) / 2), searchLo, dfSampleCenter - tightBack);
  const hiC = Math.min(SIGNAL.length - 1, searchHi, dfSampleCenter + Math.round(REFINE_FWD_SEC * SR));
  // reuse production rise on the tighter band
  let sampC = dfSampleCenter;
  {
    const envHalf = Math.max(1, Math.round((REFINE_ENV_SEC * SR) / 2));
    if (hiC > loC) {
      let bestS = dfSampleCenter, bestRise = -Infinity, localPk = 0, prevRms = rmsAt(loC, envHalf);
      for (let s = loC + 1; s <= hiC; s++) {
        const cur = rmsAt(s, envHalf);
        if (cur > localPk) localPk = cur;
        const rise = cur - prevRms;
        if (rise > bestRise) { bestRise = rise; bestS = s; }
        prevRms = cur;
      }
      if (!isSharp && localPk > 1e-6) {
        const crossThr = localPk * EDGE_PEAK_FRACTION;
        for (let s = bestS; s <= hiC; s++) if (rmsAt(s, envHalf) >= crossThr) { bestS = s; break; }
      }
      sampC = bestS;
    }
  }
  const fixCSec = startedAt + sampC / SR;

  rows.push({
    ai, isCluster, isQuiet, strength, prevGapMs, localPctOfTake: localPeak / takePeak,
    prevPctOfTake: prevPeak / takePeak, isSharp,
    trueAttackSec, gtSec,
    errCur: (curSec - trueAttackSec) * 1000,
    errCurVsGt: (curSec - gtSec) * 1000,
    errA: (fixASec - gtSec) * 1000,
    errB: (fixBSec - gtSec) * 1000,
    errC: (fixCSec - gtSec) * 1000,
    errAvsVis: (fixASec - trueAttackSec) * 1000,
    errBvsVis: (fixBSec - trueAttackSec) * 1000,
    errCvsVis: (fixCSec - trueAttackSec) * 1000,
  });
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const std = (a) => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
const absA = (a) => a.map(Math.abs);

const cluster = rows.filter((r) => r.isCluster);
const clean = rows.filter((r) => !r.isCluster);

console.log(`CLASSIFICATION: ${cluster.length} quiet-cluster notes (quiet + prev within ${NEAR_MS}ms + prev louder), ${clean.length} clean/other notes\n`);

console.log('--- DOES CURRENT PRODUCTION REPRODUCE THE −40ms EARLY BUG ON QUIET-CLUSTER NOTES? ---');
console.log('    (error vs VISUAL true attack; negative = marker placed EARLY)\n');
function report(label, set, key) {
  const e = set.map((r) => r[key]);
  if (!e.length) { console.log(`  ${label.padEnd(34)} (none)`); return; }
  console.log(`  ${label.padEnd(34)} n=${String(e.length).padStart(3)}  mean=${mean(e).toFixed(1).padStart(7)}  median=${med(e).toFixed(1).padStart(7)}  median|err|=${med(absA(e)).toFixed(1).padStart(5)}  worst=${Math.min(...e).toFixed(0).padStart(5)}`);
}
report('CURRENT  quiet-cluster notes', cluster, 'errCur');
report('CURRENT  clean/other notes', clean, 'errCur');

console.log('\n--- CONFIRM: the loud-tail capture. cluster placement vs TAIL-SUBTRACTED ground truth ---');
report('CURRENT vs tail-subtracted GT (cluster)', cluster, 'errCurVsGt');
report('CURRENT vs tail-subtracted GT (clean)', clean, 'errCurVsGt');

console.log('\n--- THE THREE FIXES, error vs TAIL-SUBTRACTED ground truth (closer to 0 = lands on the real attack) ---\n');
console.log('  QUIET-CLUSTER notes:');
report('  (a) shrink back-reach (low-str)', cluster, 'errA');
report('  (b) fractional rise + dip-gate', cluster, 'errB');
report('  (c) anchor tight to df peak', cluster, 'errC');
console.log('\n  CLEAN/OTHER notes (must NOT regress):');
report('  (a) shrink back-reach (low-str)', clean, 'errA');
report('  (b) fractional rise + dip-gate', clean, 'errB');
report('  (c) anchor tight to df peak', clean, 'errC');

console.log('\n--- REGRESSION CHECK: each fix vs VISUAL attack on CLEAN notes (should stay ≈ current) ---');
report('CURRENT  clean (vs visual)', clean, 'errCur');
report('  (a) clean (vs visual)', clean, 'errAvsVis');
report('  (b) clean (vs visual)', clean, 'errBvsVis');
report('  (c) clean (vs visual)', clean, 'errCvsVis');

console.log('\n--- PER-NOTE DUMP: the quiet-cluster notes (the dump population) ---');
console.log('  note  str  prevGap%take  prevGapMs  CUR(vis)  CUR(gt)   fixA   fixB   fixC   (ms err, gt unless noted)');
for (const r of cluster) {
  console.log(
    `  ${String(r.ai).padStart(4)}  ${r.strength.toFixed(2)}  ` +
    `${(r.localPctOfTake * 100).toFixed(0).padStart(3)}/${(r.prevPctOfTake * 100).toFixed(0).padStart(3)}  ` +
    `${r.prevGapMs.toFixed(0).padStart(7)}  ` +
    `${r.errCur.toFixed(0).padStart(7)}  ${r.errCurVsGt.toFixed(0).padStart(6)}  ` +
    `${r.errA.toFixed(0).padStart(5)}  ${r.errB.toFixed(0).padStart(5)}  ${r.errC.toFixed(0).padStart(5)}`,
  );
}

console.log('\n--- COMBINED FIX (b)+(c): fractional rise on the tight band — best-of test on cluster ---');
const combo = cluster.map((r) => r.errB); // (b) already uses the production band; report its quality next to (a)
void combo;

// Winner heuristic: smallest median|gt-err| on cluster AND smallest |Δ| vs current on clean.
function score(set, key) { const e = set.map((r) => r[key]); return { clMedAbs: med(absA(e)) }; }
const sA = score(cluster, 'errA'), sB = score(cluster, 'errB'), sC = score(cluster, 'errC');
const rA = score(clean, 'errAvsVis'), rBc = score(clean, 'errBvsVis'), rC = score(clean, 'errCvsVis');
const curClean = score(clean, 'errCur');
console.log('\n--- SUMMARY (median|err| ms) ---');
console.log(`  cluster vs GT:   (a)=${sA.clMedAbs.toFixed(1)}  (b)=${sB.clMedAbs.toFixed(1)}  (c)=${sC.clMedAbs.toFixed(1)}   [current=${score(cluster,'errCurVsGt').clMedAbs.toFixed(1)}]`);
console.log(`  clean vs visual: (a)=${rA.clMedAbs.toFixed(1)}  (b)=${rBc.clMedAbs.toFixed(1)}  (c)=${rC.clMedAbs.toFixed(1)}   [current=${curClean.clMedAbs.toFixed(1)}]`);

// ───────────── GT TRUST CHECK: does tail-subtracted GT agree with the visual attack on CLEAN notes? ─────────────
// On a CLEAN note there's no decaying neighbour to subtract, so the two independent references should
// coincide. If they do, the GT is trustworthy and the cluster (visual − GT) gap is the REAL tail capture,
// not a reference artefact.
const cleanGtVsVis = clean.map((r) => (r.gtSec - r.trueAttackSec) * 1000);
const clusterGtVsVis = cluster.map((r) => (r.gtSec - r.trueAttackSec) * 1000);
console.log('\n--- GT TRUST CHECK: (tail-subtracted GT − visual attack), ms ---');
console.log(`  CLEAN notes:   mean=${mean(cleanGtVsVis).toFixed(1)}  median=${med(cleanGtVsVis).toFixed(1)}  std=${std(cleanGtVsVis).toFixed(1)}`);
console.log(`  CLUSTER notes: mean=${mean(clusterGtVsVis).toFixed(1)}  median=${med(clusterGtVsVis).toFixed(1)}  std=${std(clusterGtVsVis).toFixed(1)}`);
console.log('  ⚠️ GT (steepest-FRACTIONAL-rise) fires ~25ms earlier than the 25%-of-peak visual edge on EVERY note');
console.log('     (clean too) — it marks the FOOT of the rise, not the visible edge. So "vs GT" is NOT a clean');
console.log('     reference; it favours whichever fix fires earliest (incl. fix b, which shares the metric).');
console.log('     ⇒ Trust the VISUAL-anchored numbers below for the verdict; use GT only to EXPLAIN mechanism.');

// ───────────── THE HONEST VERDICT: cluster earliness relative to the CLEAN-note baseline (visual ref) ─────────────
// The clean notes carry a ~constant placement bias (latency/df-lead). The BUG is the EXTRA earliness on
// cluster notes ON TOP of that baseline. Measure (cluster median − clean median) for each method: the gap
// the fix must close, while clean stays put.
const cleanBaseVis = med(clean.map((r) => r.errCur));
console.log('\n--- HONEST VERDICT (visual reference): EXCESS cluster earliness = cluster_median − clean_median ---');
console.log(`  clean-note baseline (the constant bias we DON'T touch): median ${cleanBaseVis.toFixed(1)}ms\n`);
function excess(setCluster, setCleanKey, clusterKey) {
  const cM = med(setCluster.map((r) => r[clusterKey]));
  const clM = med(clean.map((r) => r[setCleanKey]));
  return { clusterMed: cM, cleanMed: clM, excess: cM - clM };
}
const evCur = excess(cluster, 'errCur', 'errCur');
const evA = excess(cluster, 'errAvsVis', 'errAvsVis');
const evB = excess(cluster, 'errBvsVis', 'errBvsVis');
const evC = excess(cluster, 'errCvsVis', 'errCvsVis');
function evln(label, e) {
  console.log(`  ${label.padEnd(30)} cluster median=${e.clusterMed.toFixed(1).padStart(7)}  clean median=${e.cleanMed.toFixed(1).padStart(7)}  EXCESS early=${e.excess.toFixed(1).padStart(6)}ms`);
}
evln('CURRENT (the bug)', evCur);
evln('(a) shrink back-reach', evA);
evln('(b) fractional rise + dip', evB);
evln('(c) anchor tight to df', evC);
console.log('  → the winner CLOSES the EXCESS (cluster→clean) while keeping clean median ≈ −19ms (no global drag).');

// ───────────── MECHANISM DUMP: where does the production steepest-ABS-rise land vs df center vs GT? ─────────────
// For the worst cluster notes, show df-center, the production rise sample, and the GT sample, all relative
// to the GT, to expose that the ABSOLUTE-rise refine walks BACK from the df center onto the loud tail.
console.log('\n--- MECHANISM: worst cluster notes — sample positions relative to tail-subtracted GT (ms) ---');
console.log('  note  str  dfCenter−GT  prodRefine−GT  fracRise−GT   (negative = EARLIER than the real attack)');
const worst = [...cluster].sort((a, b) => a.errCurVsGt - b.errCurVsGt).slice(0, 5);
for (const r of worst) {
  // recompute the three sample positions for display
  const markerSec = attacks[r.ai].attackSec;
  const markerBufSec = markerSec - startedAt;
  const iS = sorted.indexOf(markerSec);
  const prevGapMs2 = iS > 0 ? (markerSec - sorted[iS - 1]) * 1000 : Infinity;
  const nextGap2 = iS < sorted.length - 1 ? sorted[iS + 1] - markerSec : Infinity;
  const backSec2 = Math.min(BACK_REACH_SEC, prevGapMs2 === Infinity ? BACK_REACH_SEC : (prevGapMs2 / 1000) * 0.4);
  const fwdSec2 = Math.min(WINDOW_SEC, nextGap2 * 0.6);
  const pk2 = pickDfFrameInWindow(df, hopSec, markerBufSec, backSec2, fwdSec2, dfPeak);
  if (!pk2) continue;
  const dfc = Math.round(frameToSec(pk2.bestFrame) * SR);
  const sLo = Math.max(0, Math.round((markerBufSec - backSec2) * SR));
  const sHi = Math.min(SIGNAL.length - 1, Math.round((markerBufSec + fwdSec2) * SR));
  const sh = attackRiseSec(dfc, sLo, sHi);
  const isSh = sh != null && sh <= SHARP_RISE_SEC;
  const prodS = refineProd(dfc, sLo, sHi, !isSh);
  const fracS = refineFractional(dfc, sLo, sHi);
  const gtS = tailSubtractedAttack(dfc, sLo, sHi);
  const ms = (s) => ((s - gtS) / SR * 1000).toFixed(0).padStart(6);
  console.log(`  ${String(r.ai).padStart(4)}  ${r.strength.toFixed(2)}  ${ms(dfc).padStart(11)}  ${ms(prodS).padStart(13)}  ${ms(fracS).padStart(11)}`);
}
console.log('');
