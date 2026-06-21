/**
 * three-cue-fusion-probe.mjs — DECISIVE real-data test of THREE-CUE ONSET FUSION (2026-06-22).
 *
 * THE QUESTION (the user's "2+2 = one blue marker" insight): the placement today uses ONE cue
 * chain (phase df → envelope-rise refine). On soft/last notes that chain fires EARLY. The engine
 * ALSO computes a pitch onset and a raw energy rise — three independent cues that all spike at a
 * real attack. Does FUSING them (median / agreement / pitch-floor) beat the single envelope cue on
 * the exact notes where one cue is early?
 *
 * It loads the real bass stem (docs/dev-tools/audio-audit/stems/bass.wav), inlines the EXACT
 * production:
 *   - complex-domain df            (complexDomainOnsets.ts)            = CUE 2 (PHASE)
 *   - refineToEnvelopeRise         (measureAtMarkers.ts:100-142)       = CUE 1 (TRANSIENT)
 *   - YIN verifyPitch, stepped     (verifyPitch.ts)                    = CUE 3 (PITCH onset)
 * plus the full measureAtMarkers df-pick window logic (so t_phase is EXACTLY production's coarse
 * frame). It places markers ON visible attacks, then PER NOTE reports the four times + the visual
 * attack, tabulates each cue's error, correlates with strength, and evaluates fusion variants.
 *
 *   node docs/dev-tools/audio-audit/three-cue-fusion-probe.mjs [bass.wav]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ───────────────────────── WAV reader (from transient-bias-probe.mjs) ─────────────────────────
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

// ───────────── EXACT FFT (complexDomainOnsets.ts:37-69) ─────────────
function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
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
        const tr = wr * re[b] - wi * im[b];
        const ti = wr * im[b] + wi * re[b];
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] = re[a] + tr; im[a] = im[a] + ti;
        const nwr = wr * wpr - wi * wpi;
        wi = wr * wpi + wi * wpr; wr = nwr;
      }
    }
  }
}

// ───────────── EXACT complex-domain df (complexDomainOnsets.ts:124-191) = CUE 2 ─────────────
const FFT = 2048, HOP = 512;
function complexDomainDetectionFunction(signal, sampleRate, fftSize = FFT, hopSize = HOP) {
  const half = fftSize / 2;
  const win = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
  const numFrames = Math.max(0, Math.floor((signal.length - fftSize) / hopSize) + 1);
  const df = new Float32Array(numFrames);
  const prevMag = new Float32Array(half);
  const prevPhase = new Float32Array(half);
  const prevPrevPhase = new Float32Array(half);
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
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
  return { df, hopSec: hopSize / sampleRate };
}

// ───────────── EXACT refineToEnvelopeRise (measureAtMarkers.ts:100-142) = CUE 1 ─────────────
// CHANGED ONLY to ALSO return bestRise (the discarded transient-rise strength), per the design.
const REFINE_BACK_SEC = 0.012, REFINE_FWD_SEC = 0.03, REFINE_ENV_SEC = 0.004;
function refineToEnvelopeRise(signal, sampleRate, dfSampleCenter, searchLoSample, searchHiSample) {
  const envHalf = Math.max(1, Math.round((REFINE_ENV_SEC * sampleRate) / 2));
  const lo = Math.max(envHalf, searchLoSample, dfSampleCenter - Math.round(REFINE_BACK_SEC * sampleRate));
  const hi = Math.min(signal.length - envHalf - 1, searchHiSample, dfSampleCenter + Math.round(REFINE_FWD_SEC * sampleRate));
  if (hi <= lo) return { sample: dfSampleCenter, rise: 0 };
  const rmsAt = (center) => {
    let acc = 0;
    for (let k = center - envHalf; k <= center + envHalf; k++) { const v = signal[k] ?? 0; acc += v * v; }
    return Math.sqrt(acc / (2 * envHalf + 1));
  };
  let bestSample = dfSampleCenter, bestRise = -Infinity, prevRms = rmsAt(lo);
  for (let s = lo + 1; s <= hi; s++) {
    const curRms = rmsAt(s);
    const rise = curRms - prevRms;
    if (rise > bestRise) { bestRise = rise; bestSample = s; }
    prevRms = curRms;
  }
  return { sample: bestSample, rise: Math.max(0, bestRise) };
}

// ───────────── EXACT YIN (verifyPitch.ts:71-154) = CUE 3 source ─────────────
function hzToMidiFloat(hz) { return 69 + 12 * Math.log2(hz / 440); }
function verifyPitch(window, sampleRate, opts = {}) {
  const minHz = opts.minHz ?? 28, maxHz = opts.maxHz ?? 400, threshold = opts.threshold ?? 0.15;
  const minConfidence = opts.minConfidence ?? 0.5;
  const maxLag = Math.floor(sampleRate / minHz);
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  if (window.length < 2 * maxLag) return null;
  const N = maxLag;
  const diff = new Float32Array(N + 1);
  const integ = window.length - maxLag;
  for (let tau = minLag; tau <= maxLag; tau++) {
    let sum = 0;
    for (let j = 0; j < integ; j++) { const d = (window[j] ?? 0) - (window[j + tau] ?? 0); sum += d * d; }
    diff[tau] = sum;
  }
  const cmnd = new Float32Array(N + 1);
  cmnd[0] = 1; let running = 0;
  for (let tau = 1; tau <= maxLag; tau++) { running += diff[tau]; cmnd[tau] = running > 0 ? (diff[tau] * tau) / running : 1; }
  let bestTau = -1;
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (cmnd[tau] < threshold) { while (tau + 1 <= maxLag && cmnd[tau + 1] < cmnd[tau]) tau++; bestTau = tau; break; }
  }
  if (bestTau < 0) {
    let minVal = Infinity;
    for (let tau = minLag; tau <= maxLag; tau++) if (cmnd[tau] < minVal) { minVal = cmnd[tau]; bestTau = tau; }
    if (bestTau < 0) return null;
  }
  let tauInterp = bestTau;
  if (bestTau > minLag && bestTau < maxLag) {
    const a = cmnd[bestTau - 1], b = cmnd[bestTau], c = cmnd[bestTau + 1], denom = a + c - 2 * b;
    if (Math.abs(denom) > 1e-9) tauInterp = bestTau + (a - c) / (2 * denom);
  }
  const hz = sampleRate / tauInterp;
  if (hz < minHz || hz > maxHz) return null;
  const confidence = Math.max(0, Math.min(1, 1 - cmnd[bestTau]));
  if (confidence < minConfidence) return null;
  const midiFloat = hzToMidiFloat(hz);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  return { midi, hz, confidence, cents };
}

// ───────────── CUE 3: pitch-onset = first stable, confident, self-consistent YIN frame ─────────────
// Step verifyPitch across [center-25ms, center+45ms]; minHz:40 (E1) → ~50ms window floor → tighter
// onset; hop 256 (~5.8ms). Onset frame = first frame that returns non-null AND its hz agrees within
// 1 semitone with the NEXT frame (stabilization). Returns the window START time (period first holds).
const PITCH_HOP_SEC = 256 / 44100; // ~5.8ms (recomputed per-SR below)
function pitchOnsetSec(signal, sampleRate, centerSec) {
  const minHz = 40;
  const maxLag = Math.floor(sampleRate / minHz);
  const winLen = 2 * maxLag + 64; // clear the 2*maxLag guard with headroom (~50ms @44.1k)
  const hop = Math.max(1, Math.round(PITCH_HOP_SEC * sampleRate));
  const fromS = Math.max(0, Math.round((centerSec - 0.025) * sampleRate));
  const toS = Math.round((centerSec + 0.045) * sampleRate);
  const frames = [];
  for (let s = fromS; s <= toS; s += hop) {
    if (s + winLen > signal.length) break;
    const w = signal.subarray(s, s + winLen);
    const r = verifyPitch(w, sampleRate, { minHz, maxHz: 400, minConfidence: 0.5 });
    frames.push({ startS: s, r });
  }
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i].r, b = frames[i + 1].r;
    if (a && b) {
      const semis = Math.abs(hzToMidiFloat(a.hz) - hzToMidiFloat(b.hz));
      if (semis <= 1) return { sec: frames[i].startS / sampleRate, hz: a.hz, conf: a.confidence };
    }
  }
  // fallback: first confident frame at all (no successor agreement) — still a lower bound
  for (const f of frames) if (f.r) return { sec: f.startS / sampleRate, hz: f.r.hz, conf: f.r.confidence };
  return null;
}

// ───────────── measureAtMarkers, returning all THREE candidate times + confidences ─────────────
const BACK_REACH_SEC = 0.045;
const M_DEFAULTS = { windowSec: 0.12, minAbsLevel: 0.15 };
function measureAllCues(signal, sampleRate, startedAtSec, markersSec, opts = {}) {
  const windowSec = opts.windowSec ?? M_DEFAULTS.windowSec;
  const minAbsLevel = opts.minAbsLevel ?? M_DEFAULTS.minAbsLevel;
  const { df, hopSec } = complexDomainDetectionFunction(signal, sampleRate);
  const frameToSec = (f) => f * hopSec + hopSec / 2;
  let dfPeak = 0;
  for (let f = 0; f < df.length; f++) if (df[f] > dfPeak) dfPeak = df[f];
  const dfFloor = dfPeak * minAbsLevel;
  let takeAmp = 0;
  for (let k = 0; k < signal.length; k++) { const a = Math.abs(signal[k] ?? 0); if (a > takeAmp) takeAmp = a; }
  const ampFloor = Math.max(1e-4, takeAmp * minAbsLevel);
  const sorted = [...markersSec].sort((a, b) => a - b);
  const indexOf = new Map(sorted.map((t, i) => [t, i]));
  return markersSec.map((markerSec) => {
    const markerBufSec = markerSec - startedAtSec;
    const i = indexOf.get(markerSec) ?? 0;
    const prevGap = i > 0 ? markerSec - sorted[i - 1] : Infinity;
    const nextGap = i < sorted.length - 1 ? sorted[i + 1] - markerSec : Infinity;
    const backSec = Math.min(BACK_REACH_SEC, prevGap * 0.4);
    const fwdSec = Math.min(windowSec, nextGap * 0.6);
    const fromFrame = Math.max(0, Math.floor((markerBufSec - backSec) / hopSec));
    const toFrame = Math.min(df.length - 1, Math.ceil((markerBufSec + fwdSec) / hopSec));
    if (toFrame <= fromFrame) return { markerSec, miss: 'window' };
    let winAmp = 0;
    const ampFrom = Math.max(0, Math.round((markerBufSec - backSec) * sampleRate));
    const ampTo = Math.min(signal.length, Math.round((markerBufSec + fwdSec) * sampleRate));
    for (let k = ampFrom; k < ampTo; k++) { const a = Math.abs(signal[k] ?? 0); if (a > winAmp) winAmp = a; }
    if (winAmp < ampFloor) return { markerSec, miss: 'ampgate' };
    let windowMax = 0;
    for (let f = fromFrame; f <= toFrame; f++) if (df[f] > windowMax) windowMax = df[f];
    if (windowMax < dfFloor) return { markerSec, miss: 'dffloor' };
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
    const strength = dfPeak > 0 ? Math.min(1, bestVal / dfPeak) : 0;
    if (bestFrame < 0) return { markerSec, miss: 'nopeak' };

    // CUE 2 (PHASE): the df coarse frame.
    const tPhase = startedAtSec + frameToSec(bestFrame);
    const confPhase = strength;

    // CUE 1 (TRANSIENT): envelope-rise refine — THIS is what production returns today.
    const dfSampleCenter = Math.round(frameToSec(bestFrame) * sampleRate);
    const searchLoSample = Math.max(0, Math.round((markerBufSec - backSec) * sampleRate));
    const searchHiSample = Math.min(signal.length - 1, Math.round((markerBufSec + fwdSec) * sampleRate));
    const { sample: attackSample, rise } = refineToEnvelopeRise(signal, sampleRate, dfSampleCenter, searchLoSample, searchHiSample);
    const tTransient = startedAtSec + attackSample / sampleRate;

    // CUE 3 (PITCH onset): stepped YIN. Probe around the df frame region.
    const po = pitchOnsetSec(signal, sampleRate, frameToSec(bestFrame));
    const tPitch = po ? startedAtSec + po.sec : null;
    const confPitch = po ? po.conf : 0;

    return { markerSec, strength, tPhase, confPhase, tTransient, rise, tPitch, confPitch, _bestFrame: bestFrame };
  });
}

// ───────────── visual attack (25% of local note peak) — identical to transient-bias-probe ─────────────
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
  const fwdWin = Math.round(0.05 / stepSec);
  const riseWin = Math.round(0.02 / stepSec);
  const refractory = Math.round(0.13 / stepSec);
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

// ───────────────────────── FUSION VARIANTS ─────────────────────────
// All operate on the three candidate TIMES + confidences. Returns a fused time in seconds.
const median3 = (a, b, c) => [a, b, c].sort((x, y) => x - y)[1];

// V1 baseline: single envelope cue (= production today). For comparison.
function fuse_baseline(c) { return c.tTransient; }

// V2 MEDIAN: median of the three available cues (pitch may be null → fall back to median of 2 / the transient).
function fuse_median(c) {
  const xs = [c.tPhase, c.tTransient, c.tPitch].filter((x) => x != null).sort((a, b) => a - b);
  if (xs.length === 3) return xs[1];
  if (xs.length === 2) return (xs[0] + xs[1]) / 2;
  return xs[0];
}

// V3 PITCH-FLOOR + TRANSIENT-ANCHOR (the design's monotone-floor recipe):
//   anchor on the transient rise; but never earlier than the pitch-onset lower bound (minus a small
//   tolerance, since pitch-onset is late-biased). If the transient rise is WEAK (mushy soft note)
//   AND it sits clearly before the pitch floor, pull it to the pitch floor (the early-shoulder case).
const PITCH_TOL_SEC = 0.012; // pitch onset is late-biased; allow the true attack up to 12ms before it
function fuse_pitchFloor(c, riseMedian) {
  let t = c.tTransient;
  if (c.tPitch != null) {
    const floor = c.tPitch - PITCH_TOL_SEC;
    if (t < floor) {
      // transient landed before the pitch could have started — it's early. Pull up to the floor,
      // but no further than the phase frame if that's between (keep it physical).
      t = floor;
    }
  }
  return t;
}

// V4 CONFIDENCE-WEIGHTED with pitch floor: weighted average of the cues that are physically
//   incapable of being early (transient + pitch), weighted by their confidences; phase only used
//   when both others are absent. Then clamp to the pitch floor.
function fuse_weighted(c) {
  const parts = [];
  if (c.rise > 0) parts.push({ t: c.tTransient, w: c.rise });
  if (c.tPitch != null) parts.push({ t: c.tPitch - PITCH_TOL_SEC, w: c.confPitch });
  let t;
  if (parts.length) {
    let wsum = 0, tsum = 0;
    for (const p of parts) { wsum += p.w; tsum += p.t * p.w; }
    t = tsum / wsum;
  } else {
    t = c.tPhase;
  }
  if (c.tPitch != null) { const floor = c.tPitch - PITCH_TOL_SEC; if (t < floor) t = floor; }
  return t;
}

// ───────────────────────────────── RUN ─────────────────────────────────
const wavPath = process.argv[2] || join(import.meta.dirname, 'stems', 'bass.wav');
const w = parseWav(readFileSync(wavPath));
const SR = w.sampleRate;
const signal = normalizePeak(w.samples);
let globalPeak = 0;
for (let i = 0; i < signal.length; i++) { const a = Math.abs(signal[i]); if (a > globalPeak) globalPeak = a; }
const { env, stepSec } = buildEnvelope(signal, SR);
const attacks = findAttacks(env, stepSec, globalPeak);
const startedAt = 0;
const markers = attacks.map((a) => a.attackSec);
const cues = measureAllCues(signal, SR, startedAt, markers);

console.log('\n=== THREE-CUE FUSION probe: phase df + transient rise + pitch onset vs visual attack ===');
console.log(`stem: ${wavPath}`);
console.log(`sr=${SR}  dur=${(signal.length / SR).toFixed(2)}s  FFT=${FFT} HOP=${HOP}  hopSec=${(HOP / SR * 1000).toFixed(2)}ms  attacks=${attacks.length}\n`);

// median rise across all valid notes (to define "weak" rise relatively)
const validRise = cues.filter((c) => !c.miss && c.rise != null).map((c) => c.rise).sort((a, b) => a - b);
const riseMedian = validRise.length ? validRise[Math.floor(validRise.length / 2)] : 0;

const hdr = ['#', 'vis', 'phase', 'transient', 'pitch', 'strength', 'rise/med', 'pErr', 'tErr', 'phErr'];
console.log(hdr.map((h) => h.padStart(10)).join(' '));

const rows = [];
for (let i = 0; i < cues.length; i++) {
  const c = cues[i];
  const visMs = attacks[i].attackSec * 1000;
  if (c.miss) {
    console.log([String(i), visMs.toFixed(1), 'MISS:' + c.miss, '', '', '', '', '', '', ''].map((s) => String(s).padStart(10)).join(' '));
    continue;
  }
  const phMs = c.tPhase * 1000, trMs = c.tTransient * 1000, piMs = c.tPitch != null ? c.tPitch * 1000 : null;
  const phErr = phMs - visMs, trErr = trMs - visMs, piErr = piMs != null ? piMs - visMs : null;
  const riseRatio = riseMedian > 0 ? c.rise / riseMedian : 0;
  rows.push({
    i, vis: attacks[i].attackSec, strength: c.strength, rise: c.rise, riseRatio,
    notePct: attacks[i].localPeak / globalPeak,
    tPhase: c.tPhase, tTransient: c.tTransient, tPitch: c.tPitch, confPitch: c.confPitch, confPhase: c.confPhase,
    phErr, trErr, piErr,
  });
  console.log([
    String(i), visMs.toFixed(1), phMs.toFixed(1), trMs.toFixed(1), piMs != null ? piMs.toFixed(1) : '—',
    c.strength.toFixed(2), riseRatio.toFixed(2),
    piErr != null ? (piErr >= 0 ? '+' : '') + piErr.toFixed(1) : '—',
    (trErr >= 0 ? '+' : '') + trErr.toFixed(1),
    (phErr >= 0 ? '+' : '') + phErr.toFixed(1),
  ].map((s) => String(s).padStart(10)).join(' '));
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const minv = (a) => Math.min(...a), maxv = (a) => Math.max(...a);
const absA = (a) => a.map(Math.abs);

// ───────────── per-cue error summary ─────────────
console.log('\n--- per-cue error vs visual attack (ms) ---');
const phErrs = rows.map((r) => r.phErr);
const trErrs = rows.map((r) => r.trErr);
const piErrs = rows.filter((r) => r.piErr != null).map((r) => r.piErr);
function summ(name, arr) {
  if (!arr.length) { console.log(`${name}: (none)`); return; }
  const early = arr.filter((v) => v < -10).length;
  console.log(`${name.padEnd(12)} n=${arr.length}  mean=${mean(arr).toFixed(1)}  median=${med(arr).toFixed(1)}  median|err|=${med(absA(arr)).toFixed(1)}  range=[${minv(arr).toFixed(1)}..${maxv(arr).toFixed(1)}]  >10ms EARLY: ${early}`);
}
summ('PHASE df', phErrs);
summ('TRANSIENT', trErrs);
summ('PITCH onset', piErrs);

// ───────────── correlate cue error with strength ─────────────
console.log('\n--- by strength bucket: each cue mean error & #early (>10ms before visual) ---');
const buckets = [
  { lo: 0.0, hi: 0.35, label: 'WEAK   (0.00-0.35)' },
  { lo: 0.35, hi: 0.6, label: 'MID    (0.35-0.60)' },
  { lo: 0.6, hi: 1.01, label: 'STRONG (0.60-1.00)' },
];
for (const bk of buckets) {
  const inb = rows.filter((r) => r.strength >= bk.lo && r.strength < bk.hi);
  if (!inb.length) { console.log(`${bk.label}: (none)`); continue; }
  const ph = inb.map((r) => r.phErr), tr = inb.map((r) => r.trErr), pi = inb.filter((r) => r.piErr != null).map((r) => r.piErr);
  const earlyTr = tr.filter((v) => v < -10).length;
  console.log(
    `${bk.label}: n=${inb.length}  ` +
    `phase=${mean(ph).toFixed(1)}  transient=${mean(tr).toFixed(1)} (${earlyTr} early)  pitch=${pi.length ? mean(pi).toFixed(1) : '—'}`,
  );
}

// ───────────── THE EARLY NOTES: where the transient (production) is >10ms early ─────────────
console.log('\n--- NOTES WHERE PRODUCTION (transient) IS >10ms EARLY — do the OTHER cues agree with the attack? ---');
const earlyNotes = rows.filter((r) => r.trErr < -10);
if (!earlyNotes.length) {
  console.log('(no transient-early notes by the >10ms criterion — checking >5ms)');
}
const earlySet = (rows.filter((r) => r.trErr < -10).length ? rows.filter((r) => r.trErr < -10) : rows.filter((r) => r.trErr < -5));
console.log(`${'#'.padStart(4)} ${'strength'.padStart(8)} ${'transErr'.padStart(9)} ${'phaseErr'.padStart(9)} ${'pitchErr'.padStart(9)}  ${'medianErr'.padStart(9)}  ${'pitchFloorErr'.padStart(13)}`);
for (const r of earlySet) {
  const cobj = { tPhase: r.tPhase, tTransient: r.tTransient, tPitch: r.tPitch, rise: r.rise, confPitch: r.confPitch, confPhase: r.confPhase };
  const medT = fuse_median(cobj) * 1000;
  const pfT = fuse_pitchFloor(cobj, riseMedian) * 1000;
  const visMs = r.vis * 1000;
  console.log(
    `${String(r.i).padStart(4)} ${r.strength.toFixed(2).padStart(8)} ` +
    `${(r.trErr >= 0 ? '+' : '') + r.trErr.toFixed(1).padStart(8)} ` +
    `${(r.phErr >= 0 ? '+' : '') + r.phErr.toFixed(1).padStart(8)} ` +
    `${(r.piErr != null ? (r.piErr >= 0 ? '+' : '') + r.piErr.toFixed(1) : '—').padStart(8)}  ` +
    `${((medT - visMs >= 0 ? '+' : '') + (medT - visMs).toFixed(1)).padStart(9)}  ` +
    `${((pfT - visMs >= 0 ? '+' : '') + (pfT - visMs).toFixed(1)).padStart(13)}`,
  );
}

// ───────────── FUSION VARIANTS: overall error vs visual attack ─────────────
console.log('\n=== FUSION VARIANTS vs visual attack — does fusing beat the single envelope cue? ===');
function evalFusion(name, fn) {
  const errs = rows.map((r) => {
    const cobj = { tPhase: r.tPhase, tTransient: r.tTransient, tPitch: r.tPitch, rise: r.rise, confPitch: r.confPitch, confPhase: r.confPhase };
    return fn(cobj, riseMedian) * 1000 - r.vis * 1000;
  });
  const early10 = errs.filter((v) => v < -10).length;
  const early5 = errs.filter((v) => v < -5).length;
  const earlyAny = errs.filter((v) => v < 0).length;
  console.log(
    `${name.padEnd(22)} mean=${mean(errs).toFixed(1).padStart(6)}  median=${med(errs).toFixed(1).padStart(6)}  ` +
    `median|err|=${med(absA(errs)).toFixed(1).padStart(5)}  range=[${minv(errs).toFixed(1).padStart(6)}..${maxv(errs).toFixed(1).padStart(5)}]  ` +
    `EARLY: >10ms ${String(early10).padStart(2)} | >5ms ${String(early5).padStart(2)} | any<0 ${String(earlyAny).padStart(2)}`,
  );
}
evalFusion('V1 baseline (transient)', fuse_baseline);
evalFusion('V2 median-of-3', fuse_median);
evalFusion('V3 pitch-floor anchor', fuse_pitchFloor);
evalFusion('V4 conf-weighted+floor', fuse_weighted);

// ───────────── regression check: on the already-accurate notes (|transErr|≤3ms), does fusion move them? ─────────────
console.log('\n--- REGRESSION CHECK: accurate notes (|transient err| ≤ 3ms) — how far does each fusion MOVE them? ---');
const accurate = rows.filter((r) => Math.abs(r.trErr) <= 3);
function regressionShift(name, fn) {
  if (!accurate.length) { console.log(`${name}: (no accurate notes)`); return; }
  const shifts = accurate.map((r) => {
    const cobj = { tPhase: r.tPhase, tTransient: r.tTransient, tPitch: r.tPitch, rise: r.rise, confPitch: r.confPitch, confPhase: r.confPhase };
    return Math.abs(fn(cobj, riseMedian) * 1000 - r.tTransient * 1000);
  });
  console.log(`${name.padEnd(22)} n=${accurate.length}  mean shift=${mean(shifts).toFixed(2)}ms  max shift=${maxv(shifts).toFixed(2)}ms  (>3ms moved: ${shifts.filter((s) => s > 3).length})`);
}
regressionShift('V2 median-of-3', fuse_median);
regressionShift('V3 pitch-floor anchor', fuse_pitchFloor);
regressionShift('V4 conf-weighted+floor', fuse_weighted);

// ───────────── REFERENCE-INDEPENDENT: do the three cues AGREE or DISAGREE? ─────────────
// The visual-attack reference (25%-of-peak) sits LATE on slow soft attacks, so ALL cues read
// "early" against it — absolute error is contaminated. The cue-AGREEMENT spread is reference-
// FREE and is what decides whether fusion can help: if on the early notes the 3 cues are TIGHT
// (all within a few ms), they all picked the SAME onset → fusion has nothing to correct, the
// bias is shared (the reference is late, not the cue). If they're SPREAD, fusion (median/floor)
// can pull the outlier back toward the other two.
console.log('\n=== REFERENCE-INDEPENDENT: cue agreement spread (max−min of the 3 cue times, ms) ===');
function spread3(r) {
  const xs = [r.tPhase, r.tTransient, r.tPitch].filter((x) => x != null).map((x) => x * 1000);
  return Math.max(...xs) - Math.min(...xs);
}
function tpDelta(r) { // pitch − transient (ms): >0 means pitch LATER than transient (pitch can't pull transient back)
  return r.tPitch != null ? (r.tPitch - r.tTransient) * 1000 : null;
}
const allSpread = rows.map(spread3);
console.log(`ALL notes: median spread=${med(allSpread).toFixed(1)}ms  mean=${mean(allSpread).toFixed(1)}ms  range=[${minv(allSpread).toFixed(1)}..${maxv(allSpread).toFixed(1)}]`);
// On the notes where transient is most "early", is pitch EARLIER (would pull further early) or LATER?
console.log('\n--- on the EARLY-transient notes: is PITCH earlier or later than the transient? ---');
const tpDeltas = earlySet.map(tpDelta).filter((x) => x != null);
const pitchLater = tpDeltas.filter((d) => d > 0).length;
const pitchEarlier = tpDeltas.filter((d) => d < 0).length;
console.log(`pitch−transient: median=${med(tpDeltas).toFixed(1)}ms  ${pitchLater}/${tpDeltas.length} notes pitch is LATER (could anchor), ${pitchEarlier}/${tpDeltas.length} pitch is EARLIER (would worsen)`);
// phase vs transient on early notes
const phtDeltas = earlySet.map((r) => (r.tPhase - r.tTransient) * 1000);
const phaseLater = phtDeltas.filter((d) => d > 0).length;
console.log(`phase−transient: median=${med(phtDeltas).toFixed(1)}ms  ${phaseLater}/${phtDeltas.length} notes phase is LATER, ${phtDeltas.length - phaseLater} phase is EARLIER`);
// ───────────── DIAGNOSTIC: why does pitch-onset read EARLY? dump YIN ladder for a few notes ─────────────
if (process.env.PITCH_DIAG) {
  console.log('\n=== PITCH-ONSET DIAGNOSTIC: stepped-YIN ladder around a few early notes ===');
  const minHz = 40, maxLag = Math.floor(SR / minHz), winLen = 2 * maxLag + 64;
  const hop = Math.max(1, Math.round((256 / 44100) * SR));
  for (const r of earlySet.slice(0, 4)) {
    const centerSec = r.tPhase; // df frame center
    console.log(`\nnote #${r.i}  vis=${(r.vis * 1000).toFixed(1)}ms  transient=${(r.tTransient * 1000).toFixed(1)}ms  pitch=${r.tPitch != null ? (r.tPitch * 1000).toFixed(1) : '—'}ms`);
    const fromS = Math.max(0, Math.round((centerSec - 0.025) * SR));
    const toS = Math.round((centerSec + 0.045) * SR);
    for (let s = fromS; s <= toS; s += hop) {
      if (s + winLen > signal.length) break;
      const wn = signal.subarray(s, s + winLen);
      // local raw amplitude at this frame start (is there even a note yet?)
      let amp = 0; for (let k = s; k < Math.min(signal.length, s + hop); k++) { const a = Math.abs(signal[k]); if (a > amp) amp = a; }
      const pr = verifyPitch(wn, SR, { minHz, maxHz: 400, minConfidence: 0.5 });
      console.log(`  t=${(s / SR * 1000).toFixed(1)}ms  amp=${(amp / globalPeak * 100).toFixed(0)}%peak  ${pr ? `YIN hz=${pr.hz.toFixed(1)} midi=${pr.midi} conf=${pr.confidence.toFixed(2)}` : 'YIN null'}`);
    }
  }
}

console.log('\nINTERPRETATION GUIDE:');
console.log('  If on early notes BOTH phase & pitch are EARLIER than the transient → the transient is the LATEST/best cue;');
console.log('  fusing would pull it FURTHER early (the wrong way). Fusion CANNOT fix the early-marker bug here.');
console.log('  If phase/pitch are LATER → they disagree upward and median/floor pulls the early transient back.');
console.log('');
