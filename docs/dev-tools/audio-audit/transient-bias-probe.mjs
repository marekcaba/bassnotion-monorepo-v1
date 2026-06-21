/**
 * transient-bias-probe.mjs — DECISIVE real-data measurement of the bass-coach
 * "blue marker lands BEFORE the played transient" bug (2026-06-21).
 *
 * It loads the real bass stem (docs/dev-tools/audio-audit/stems/bass.wav), inlines
 * the EXACT production complex-domain detection function (complexDomainOnsets.ts) and
 * the EXACT measureAtMarkers per-marker pick logic, places markers ON visible attacks
 * in the stem, and for each reports:
 *   - the RAW-AMPLITUDE attack (visual onset = where |env| first crosses 25% of the
 *     local note peak) — this is what the eye/the waveform shows.
 *   - the DF-PEAK time (strongest df in the window).
 *   - what measureAtMarkers actually RETURNS (its first-peak-≥30%-of-window-max pick).
 * Then it QUANTIFIES df-pick − raw-attack (negative = pick is EARLY = before the note)
 * and CORRELATES that gap with the note's strength (df peak / global df peak ≈ loudness).
 *
 *   node docs/dev-tools/audio-audit/transient-bias-probe.mjs [bass.wav]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ───────────────────────── WAV reader (from ogg-padding-probe.mjs) ─────────────────────────
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

// ───────────── normalizePeak (bassOnsetDetector.ts:167-178) — length-preserving ─────────────
function normalizePeak(signal, target = 0.9) {
  let peak = 0;
  for (let i = 0; i < signal.length; i++) {
    const a = Math.abs(signal[i] ?? 0);
    if (a > peak) peak = a;
  }
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
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] = re[a] + tr;
        im[a] = im[a] + ti;
        const nwr = wr * wpr - wi * wpi;
        wi = wr * wpi + wi * wpr;
        wr = nwr;
      }
    }
  }
}

// ───────────── EXACT complex-domain df (complexDomainOnsets.ts:124-191) ─────────────
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
      prevPrevPhase[k] = prevPhase[k];
      prevPhase[k] = phase;
      prevMag[k] = mag;
    }
    df[f] = sum;
  }
  let max = 0;
  for (let i = 0; i < numFrames; i++) if (df[i] > max) max = df[i];
  if (max > 0) for (let i = 0; i < numFrames; i++) df[i] /= max;
  return { df, hopSec: hopSize / sampleRate };
}

// ───────────── EXACT measureAtMarkers (measureAtMarkers.ts:82-209) ─────────────
const BACK_REACH_SEC = 0.045;
const M_DEFAULTS = { windowSec: 0.12, minStrength: 0.18, minAbsLevel: 0.15, envStepSec: 0.002 };
function measureAtMarkers(signal, sampleRate, startedAtSec, markersSec, opts = {}) {
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
    if (toFrame <= fromFrame) return { markerSec, playerSec: null, errorSec: null, strength: 0, _dbg: 'window' };
    let winAmp = 0;
    const ampFrom = Math.max(0, Math.round((markerBufSec - backSec) * sampleRate));
    const ampTo = Math.min(signal.length, Math.round((markerBufSec + fwdSec) * sampleRate));
    for (let k = ampFrom; k < ampTo; k++) { const a = Math.abs(signal[k] ?? 0); if (a > winAmp) winAmp = a; }
    if (winAmp < ampFloor) return { markerSec, playerSec: null, errorSec: null, strength: 0, _dbg: 'ampgate' };
    let windowMax = 0, windowMaxFrame = fromFrame;
    for (let f = fromFrame; f <= toFrame; f++) if (df[f] > windowMax) { windowMax = df[f]; windowMaxFrame = f; }
    if (windowMax < dfFloor)
      return { markerSec, playerSec: null, errorSec: null, strength: dfPeak > 0 ? Math.min(1, windowMax / dfPeak) : 0, _dbg: 'dffloor' };
    const acceptThr = Math.max(dfFloor, windowMax * 0.3);
    let bestFrame = -1, bestVal = 0;
    for (let f = fromFrame; f <= toFrame; f++) {
      const isPeak = df[f] >= (df[f - 1] ?? 0) && df[f] >= (df[f + 1] ?? 0);
      if (isPeak && df[f] >= acceptThr) { bestFrame = f; bestVal = df[f]; break; }
    }
    const firstPickFrame = bestFrame;
    if (bestFrame >= 0) {
      const lookAhead = Math.max(1, Math.round(0.025 / hopSec));
      for (let f = bestFrame + 1; f <= Math.min(toFrame, bestFrame + lookAhead); f++) {
        const isPeak = df[f] >= (df[f - 1] ?? 0) && df[f] >= (df[f + 1] ?? 0);
        if (isPeak && df[f] >= bestVal * 1.6) { bestFrame = f; bestVal = df[f]; }
      }
    }
    const strength = dfPeak > 0 ? Math.min(1, bestVal / dfPeak) : 0;
    if (bestFrame < 0) return { markerSec, playerSec: null, errorSec: null, strength, _dbg: 'nopeak' };
    const playerSec = startedAtSec + frameToSec(bestFrame);
    return {
      markerSec, playerSec, errorSec: playerSec - markerSec, strength,
      _dfPeakFrame: windowMaxFrame, _dfPeakSec: startedAtSec + frameToSec(windowMaxFrame),
      _firstPickFrame: firstPickFrame, _bestFrame: bestFrame,
      _jumped: firstPickFrame !== bestFrame, _acceptThr: acceptThr, _windowMax: windowMax,
    };
  });
}

// ───────────── raw-amplitude envelope + per-note VISUAL attack (25% of local note peak) ─────────────
// envelope: short-time peak |amp|, step ENV_STEP. Visual attack of a note near time t:
// scan a local region [t-pre, t+post], find the local peak, then walk BACK from the peak to
// the first env crossing of 25% of that peak — the audible leading edge in the waveform.
const ENV_STEP_SEC = 0.001; // 1ms envelope resolution
function buildEnvelope(signal, sampleRate) {
  const step = Math.max(1, Math.round(ENV_STEP_SEC * sampleRate));
  const n = Math.floor(signal.length / step);
  const env = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    let p = 0;
    for (let i = 0; i < step; i++) { const a = Math.abs(signal[b * step + i] ?? 0); if (a > p) p = a; }
    env[b] = p;
  }
  return { env, stepSec: step / sampleRate };
}

// Auto-find note attacks: scan the envelope for a RISE — a point where env climbs steeply
// from a local trough to a local peak. The VISUAL attack = the sample where env first crosses
// 25% of that rise's peak (the audible leading edge). Captures notes-in-succession too: we key
// on the steep climb, not on prior silence.
function findAttacks(env, stepSec, globalPeak) {
  const attacks = [];
  const fwdWin = Math.round(0.05 / stepSec);       // 50ms — note's local peak
  const riseWin = Math.round(0.02 / stepSec);      // 20ms — look-back for the trough before the rise
  const refractory = Math.round(0.13 / stepSec);   // ≥130ms between attacks
  let lastIdx = -refractory;
  for (let b = riseWin; b < env.length - fwdWin; b++) {
    if (b - lastIdx < refractory) continue;
    // local peak forward
    let peak = 0, peakK = b;
    for (let k = b; k < b + fwdWin; k++) if (env[k] > peak) { peak = env[k]; peakK = k; }
    if (peak < globalPeak * 0.18) continue;        // ignore quiet sections / tails
    // trough just before b
    let trough = Infinity;
    for (let k = b - riseWin; k <= b; k++) if (env[k] < trough) trough = env[k];
    // require a real RISE: peak must be ≥2.2× the pre-trough AND b must be at/just-after the trough
    if (peak < trough * 2.2 + globalPeak * 0.05) continue;
    if (env[b] > trough * 1.3 + globalPeak * 0.02) continue; // b should still be near the trough (pre-attack)
    // visual attack = first 25%-of-peak crossing from b forward
    const thr = peak * 0.25;
    let cross = b;
    for (let k = b; k <= peakK; k++) { if (env[k] >= thr) { cross = k; break; } }
    attacks.push({ attackSec: cross * stepSec, localPeak: peak });
    lastIdx = cross;
  }
  return attacks;
}

// For a known marker, recompute the visual attack independently (25% of local note peak),
// using the same env, anchored at the marker (the marker sits on/near the attack).
function visualAttackNear(env, stepSec, tSec, globalPeak) {
  const c = Math.round(tSec / stepSec);
  const fwd = Math.round(0.06 / stepSec);
  const back = Math.round(0.03 / stepSec);
  let localPeak = 0;
  for (let k = Math.max(0, c - back); k < Math.min(env.length, c + fwd); k++) if (env[k] > localPeak) localPeak = env[k];
  const thr = localPeak * 0.25;
  // first crossing scanning forward from (c-back)
  for (let k = Math.max(0, c - back); k < Math.min(env.length, c + fwd); k++) {
    if (env[k] >= thr) return { attackSec: k * stepSec, localPeak };
  }
  return { attackSec: tSec, localPeak };
}

// ───────────────────────────────── RUN ─────────────────────────────────
const wavPath = process.argv[2] || join(import.meta.dirname, 'stems', 'bass.wav');
const w = parseWav(readFileSync(wavPath));
const SR = w.sampleRate;
const signal = normalizePeak(w.samples); // production normalizes first

let globalPeak = 0;
for (let i = 0; i < signal.length; i++) { const a = Math.abs(signal[i]); if (a > globalPeak) globalPeak = a; }
const { env, stepSec } = buildEnvelope(signal, SR);

// Auto-detected attacks become our markers (placed ON the visible transients).
const attacks = findAttacks(env, stepSec, globalPeak);

// startedAt = 0 (the WAV's sample 0 is the take's t=0; the whole anchor question is settled —
// we measure WITHIN the take, so startedAt is just an additive constant that cancels in gaps).
const startedAt = 0;
// Marker placed exactly on the visual attack; the note's own local peak travels with it so the
// strength↔gap correlation uses the SAME peak that defined the attack (no re-derivation drift).
const markers = attacks.map((a) => a.attackSec);

const measured = measureAtMarkers(signal, SR, startedAt, markers);

console.log('\n=== transient-bias probe: df-pick vs RAW-AMPLITUDE attack vs strength ===');
console.log(`stem: ${wavPath}`);
console.log(`sr=${SR}  dur=${(signal.length / SR).toFixed(2)}s  FFT=${FFT} HOP=${HOP}  hopSec=${(HOP / SR * 1000).toFixed(2)}ms  attacks found=${attacks.length}\n`);

const hdr = ['#', 'visAttack', 'marker', 'dfPeak', 'measured', 'measured-vis', 'dfPeak-vis', 'strength', 'jumped', 'notePeak%'];
console.log(hdr.map((h) => h.padStart(11)).join(' '));

const rows = [];
for (let i = 0; i < measured.length; i++) {
  const m = measured[i];
  // visual attack = the SAME leading edge findAttacks locked onto (marker sits on it), with the
  // note's own local peak — so the gap is df-pick vs the audible transient, no re-derivation.
  const va = { attackSec: attacks[i].attackSec, localPeak: attacks[i].localPeak };
  const visMs = va.attackSec * 1000;
  if (m.playerSec == null) {
    console.log([
      String(i).padStart(11),
      visMs.toFixed(1).padStart(11),
      (markers[i] * 1000).toFixed(1).padStart(11),
      ('MISS:' + m._dbg).padStart(11),
      ''.padStart(11), ''.padStart(11), ''.padStart(11),
      m.strength.toFixed(2).padStart(11),
      ''.padStart(11),
      (va.localPeak / globalPeak * 100).toFixed(0).padStart(11),
    ].join(' '));
    continue;
  }
  const measMs = m.playerSec * 1000;
  const dfMs = m._dfPeakSec * 1000;
  const measMinusVis = measMs - visMs;   // negative = measured marker is EARLY (before the note)
  const dfMinusVis = dfMs - visMs;       // negative = df peak itself is before the note
  rows.push({ strength: m.strength, measMinusVis, dfMinusVis, jumped: m._jumped, notePct: va.localPeak / globalPeak });
  console.log([
    String(i).padStart(11),
    visMs.toFixed(1).padStart(11),
    (markers[i] * 1000).toFixed(1).padStart(11),
    dfMs.toFixed(1).padStart(11),
    measMs.toFixed(1).padStart(11),
    (measMinusVis >= 0 ? '+' : '') + measMinusVis.toFixed(1).padStart(measMinusVis >= 0 ? 10 : 11),
    (dfMinusVis >= 0 ? '+' : '') + dfMinusVis.toFixed(1).padStart(dfMinusVis >= 0 ? 10 : 11),
    m.strength.toFixed(2).padStart(11),
    (m._jumped ? 'YES' : '-').padStart(11),
    (va.localPeak / globalPeak * 100).toFixed(0).padStart(11),
  ].join(' '));
}

// ───────────── correlation: gap (measured − visual attack) vs strength ─────────────
console.log('\n--- correlation: (measured − visual attack) ms, bucketed by strength ---');
const buckets = [
  { lo: 0.0, hi: 0.35, label: 'WEAK   (0.00-0.35)' },
  { lo: 0.35, hi: 0.6, label: 'MID    (0.35-0.60)' },
  { lo: 0.6, hi: 1.01, label: 'STRONG (0.60-1.00)' },
];
for (const bk of buckets) {
  const inb = rows.filter((r) => r.strength >= bk.lo && r.strength < bk.hi);
  if (!inb.length) { console.log(`${bk.label}: (none)`); continue; }
  const meas = inb.map((r) => r.measMinusVis);
  const dfo = inb.map((r) => r.dfMinusVis);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const minv = (a) => Math.min(...a), maxv = (a) => Math.max(...a);
  console.log(
    `${bk.label}: n=${inb.length}  measured−vis mean=${mean(meas).toFixed(1)}ms [${minv(meas).toFixed(1)}..${maxv(meas).toFixed(1)}]   ` +
    `dfPeak−vis mean=${mean(dfo).toFixed(1)}ms [${minv(dfo).toFixed(1)}..${maxv(dfo).toFixed(1)}]`,
  );
}

// CLEAN subset: only notes whose local peak is unambiguously a real note (≥50% of global) so
// the "visual attack" is trustworthy — removes faint/ambiguous markers from the picture.
console.log('\n--- CLEAN subset (notePeak ≥ 50% of global): df-pick vs visual attack by strength ---');
for (const bk of buckets) {
  const inb = rows.filter((r) => r.strength >= bk.lo && r.strength < bk.hi && r.notePct >= 0.5);
  if (!inb.length) { console.log(`${bk.label}: (none)`); continue; }
  const meas = inb.map((r) => r.measMinusVis);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const minv = (a) => Math.min(...a), maxv = (a) => Math.max(...a);
  const early = meas.filter((v) => v < -10).length;
  console.log(
    `${bk.label}: n=${inb.length}  measured−vis mean=${mean(meas).toFixed(1)}ms [${minv(meas).toFixed(1)}..${maxv(meas).toFixed(1)}]  ` +
    `(${early}/${inb.length} land >10ms EARLY)`,
  );
}

// Pearson r between strength and (measured − visual attack)
if (rows.length > 2) {
  const xs = rows.map((r) => r.strength), ys = rows.map((r) => r.measMinusVis);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const r = sxy / Math.sqrt(sxx * syy);
  console.log(`\nPearson r(strength, measured−visAttack) = ${r.toFixed(3)}  (positive ⇒ weaker notes land MORE early)`);
}
console.log('');
