/**
 * weak-note-wobble-probe2.mjs — follow-up: run the production marker-pick AND all 4 fixes
 * directly on REAL bass.wav attacks, scoring each against the audible (steepest-amp-rise)
 * ground truth, split by note strength. Probe1 proved the df leads the audible attack more
 * on weak notes than strong; this quantifies the fix candidates on real audio.
 *
 * Run:  node docs/dev-tools/audio-audit/weak-note-wobble-probe2.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));

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

const FFT = 2048, HOP = 512, HALF = FFT / 2;

function computeDF(signal) {
  const win = new Float32Array(FFT);
  for (let i = 0; i < FFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT - 1));
  const numFrames = Math.max(0, Math.floor((signal.length - FFT) / HOP) + 1);
  const df = new Float32Array(numFrames);
  const pM = new Float32Array(HALF), pP = new Float32Array(HALF), ppP = new Float32Array(HALF);
  const re = new Float32Array(FFT), im = new Float32Array(FFT);
  for (let f = 0; f < numFrames; f++) {
    const start = f * HOP;
    for (let i = 0; i < FFT; i++) { re[i] = (signal[start + i] ?? 0) * win[i]; im[i] = 0; }
    fftInPlace(re, im);
    let sum = 0;
    for (let k = 0; k < HALF; k++) {
      const mag = Math.hypot(re[k], im[k]), phase = Math.atan2(im[k], re[k]);
      if (f >= 2) { const pp = 2 * pP[k] - ppP[k], pm = pM[k]; const dr = mag * Math.cos(phase) - pm * Math.cos(pp), di = mag * Math.sin(phase) - pm * Math.sin(pp); sum += Math.hypot(dr, di); }
      ppP[k] = pP[k]; pP[k] = phase; pM[k] = mag;
    }
    df[f] = sum;
  }
  let max = 0; for (let i = 0; i < numFrames; i++) if (df[i] > max) max = df[i];
  if (max > 0) for (let i = 0; i < numFrames; i++) df[i] /= max;
  return df;
}

// ── load real bass.wav ──
const wav = readFileSync(join(__dir, 'stems', 'bass.wav'));
const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
let off = 12, fmt = null, dataOff = 0, dataLen = 0;
while (off + 8 <= dv.byteLength) {
  const id = dv.getUint32(off, false), sz = dv.getUint32(off + 4, true), body = off + 8;
  if (id === 0x666d7420) fmt = { audioFormat: dv.getUint16(body, true), channels: dv.getUint16(body + 2, true), sampleRate: dv.getUint32(body + 4, true), bitsPerSample: dv.getUint16(body + 14, true) };
  else if (id === 0x64617461) { dataOff = body; dataLen = sz; }
  off = body + sz + (sz & 1);
}
const ch = fmt.channels, SR = fmt.sampleRate;
const frames = [];
if (fmt.audioFormat === 3 && fmt.bitsPerSample === 32) { const n = dataLen / 4; for (let i = 0; i < n; i++) frames.push(dv.getFloat32(dataOff + i * 4, true)); }
else { const n = dataLen / 2; for (let i = 0; i < n; i++) frames.push(dv.getInt16(dataOff + i * 2, true) / 32768); }
const mono = new Float32Array(Math.floor(frames.length / ch));
for (let i = 0; i < mono.length; i++) { let acc = 0; for (let c = 0; c < ch; c++) acc += frames[i * ch + c]; mono[i] = acc / ch; }

const HOPSEC = HOP / SR;
const frameToSec = (f) => f * HOPSEC + HOPSEC / 2;
const df = computeDF(mono);
let dfPeak = 0; for (let f = 0; f < df.length; f++) if (df[f] > dfPeak) dfPeak = df[f];

// ── audible ground-truth: steepest RMS-envelope rise near a time ──
const envHalf = Math.round(0.004 * SR);
const envAt = (i) => { let a = 0; for (let k = i - envHalf; k < i + envHalf; k++) a += (mono[k] ?? 0) ** 2; return Math.sqrt(a / (2 * envHalf)); };
function steepestRise(centerSec, reachMs = 25) {
  const center = Math.round(centerSec * SR), reach = Math.round((reachMs / 1000) * SR), st = 48;
  let bi = -1, bd = -Infinity;
  for (let i = Math.max(envHalf, center - reach); i <= Math.min(mono.length - envHalf - st, center + reach); i += st) {
    const d = envAt(i + st) - envAt(i); if (d > bd) { bd = d; bi = i; }
  }
  return bi / SR;
}

// ── production pick over a window [from,to] ──
function prodPick(from, to) {
  let windowMax = 0; for (let f = from; f <= to; f++) if (df[f] > windowMax) windowMax = df[f];
  const dfFloor = dfPeak * 0.15;
  if (windowMax < dfFloor) return null;
  const acceptThr = Math.max(dfFloor, windowMax * 0.3);
  let bf = -1, bv = 0;
  for (let f = from; f <= to; f++) { const isPk = df[f] >= (df[f - 1] ?? 0) && df[f] >= (df[f + 1] ?? 0); if (isPk && df[f] >= acceptThr) { bf = f; bv = df[f]; break; } }
  if (bf >= 0) { const la = Math.max(1, Math.round(0.025 / HOPSEC)); for (let f = bf + 1; f <= Math.min(to, bf + la); f++) { const isPk = df[f] >= (df[f - 1] ?? 0) && df[f] >= (df[f + 1] ?? 0); if (isPk && df[f] >= bv * 1.6) { bf = f; bv = df[f]; } } }
  return bf < 0 ? null : { frame: bf, val: bv };
}
function parabolic(bf) { const y0 = df[bf - 1] ?? df[bf], y1 = df[bf], y2 = df[bf + 1] ?? df[bf]; const dn = y0 - 2 * y1 + y2; const d = dn !== 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (y0 - y2) / dn)) : 0; return (bf + d) * HOPSEC + HOPSEC / 2; }
function foot(bf, frac = 0.2) { let f = bf; const fl = df[bf] * frac; while (f > 0 && df[f - 1] < df[f] && df[f - 1] > fl) f--; if (f > 0 && df[f - 1] <= fl) f--; return frameToSec(f); }
function ampRefine(prodSec, winMs = 25) {
  const center = Math.round(prodSec * SR), reach = Math.round((winMs / 1000) * SR), st = 48;
  let bi = -1, bd = -Infinity;
  for (let i = Math.max(envHalf, center - reach); i <= Math.min(mono.length - envHalf - st, center + reach); i += st) { const d = envAt(i + st) - envAt(i); if (d > bd) { bd = d; bi = i; } }
  return bi / SR;
}

// ── find real onsets: every well-separated local df peak above floor = a "marker" ──
const onsets = [];
for (let f = 3; f < df.length - 2; f++) {
  if (df[f] >= df[f - 1] && df[f] >= df[f + 1] && df[f] > 0.08) {
    if (onsets.length === 0 || f - onsets[onsets.length - 1] >= 8) onsets.push(f);
    else if (df[f] > df[onsets[onsets.length - 1]]) onsets[onsets.length - 1] = f;
  }
}

console.log('REAL bass.wav — per-onset: production pick & 4 fixes vs audible steepest-rise');
console.log('SR=' + SR + ' hopSec=' + (HOPSEC * 1000).toFixed(2) + 'ms  dfPeak=' + dfPeak.toFixed(3) + '  onsets=' + onsets.length);
console.log('errMs = locatorTime − audibleAttackTime  (negative = EARLY = the bug)\n');
console.log('  onset@ms  str   audible    PROD    PARA    FOOT     AMP');

const acc = { prod: [], para: [], foot: [], amp: [] };
const accW = { prod: [], para: [], foot: [], amp: [] };
const accS = { prod: [], para: [], foot: [], amp: [] };
for (const f0 of onsets) {
  const markerSec = frameToSec(f0);
  // production neighbour-bounded window around the marker (45ms back, 120ms fwd)
  const from = Math.max(0, Math.floor((markerSec - 0.045) / HOPSEC));
  const to = Math.min(df.length - 1, Math.ceil((markerSec + 0.12) / HOPSEC));
  const p = prodPick(from, to);
  if (!p) continue;
  const str = Math.min(1, p.val / dfPeak);
  // GROUND TRUTH anchored on the MARKER (NOT the prod pick) so it can't be circular with
  // AMP-REFINE: steepest audible rise in a wide +/-40ms window around the authored marker.
  const audible = steepestRise(markerSec, 40);
  const prodSec = frameToSec(p.frame);
  const paraSec = parabolic(p.frame);
  const footSec = foot(p.frame);
  const ampSec = ampRefine(prodSec);
  const e = (s) => (s - audible) * 1000;
  const ms = (v) => v.toFixed(1).padStart(6);
  console.log(`  ${(markerSec * 1000).toFixed(0).padStart(7)} ${str.toFixed(2)} ${(audible * 1000).toFixed(0).padStart(7)}ms ${ms(e(prodSec))} ${ms(e(paraSec))} ${ms(e(footSec))} ${ms(e(ampSec))}`);
  acc.prod.push(e(prodSec)); acc.para.push(e(paraSec)); acc.foot.push(e(footSec)); acc.amp.push(e(ampSec));
  const bin = str < 0.35 ? accW : accS;
  bin.prod.push(e(prodSec)); bin.para.push(e(paraSec)); bin.foot.push(e(footSec)); bin.amp.push(e(ampSec));
}

const stat = (a) => { if (!a.length) return 'n/a'; const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); const mn = Math.min(...a), mx = Math.max(...a); return `mean=${m.toFixed(1)} sd=${sd.toFixed(1)} range[${mn.toFixed(0)},${mx.toFixed(0)}]`; };
console.log('\nALL onsets (n=' + acc.prod.length + '):');
for (const k of ['prod', 'para', 'foot', 'amp']) console.log(`  ${k.padEnd(5)} ${stat(acc[k])}`);
console.log('\nWEAK onsets str<0.35 (n=' + accW.prod.length + '):');
for (const k of ['prod', 'para', 'foot', 'amp']) console.log(`  ${k.padEnd(5)} ${stat(accW[k])}`);
console.log('\nSTRONG onsets str>=0.35 (n=' + accS.prod.length + '):');
for (const k of ['prod', 'para', 'foot', 'amp']) console.log(`  ${k.padEnd(5)} ${stat(accS[k])}`);
