/**
 * weak-note-wobble-probe.mjs — Suspect B probe for the bass-coach timing visualizer.
 *
 * THE QUESTION: on a QUIET bass note (optionally preceded by a tiny finger-noise tick),
 * does the complex-domain detection function (df) ramp up GRADUALLY before the true
 * attack — so the production "first local peak >= 30% of window max" rule fires EARLY on
 * that ramp — and is the ramp longer / relatively bigger for quiet notes than loud ones?
 *
 * Then: measure, with GROUND-TRUTH attack samples, where four candidate fixes land:
 *   (1) production: first peak >= 30% of windowMax  [+ 25ms/1.6x look-ahead]
 *   (2) parabolic peak interpolation around the chosen df peak
 *   (3) df rising-edge backtrack: from the df peak, walk DOWN-LEFT to the foot of the rise
 *   (4) raw-amplitude refine: after the df pick, snap to the steepest raw-amplitude rise
 *       (envelope derivative max) in a small window around it
 *
 * All df math is INLINED from complexDomainOnsets.ts (node can't import .ts). The window /
 * peak-pick / look-ahead are INLINED from measureAtMarkers.ts. Verified against the real
 * docs/dev-tools/audio-audit/stems/bass.wav as a sanity check that synthetic df ~ real df.
 *
 * Run:  node docs/dev-tools/audio-audit/weak-note-wobble-probe.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const SR = 48000;

// ───────────────────────── INLINED from complexDomainOnsets.ts ─────────────────────────
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
    const wpr = Math.cos(ang), wpi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
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

const FFT = 2048, HOP = 512, HALF = FFT / 2;
const HOPSEC = HOP / SR;

function complexDomainDF(signal) {
  const win = new Float32Array(FFT);
  for (let i = 0; i < FFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT - 1));
  const numFrames = Math.max(0, Math.floor((signal.length - FFT) / HOP) + 1);
  const df = new Float32Array(numFrames);
  const prevMag = new Float32Array(HALF);
  const prevPhase = new Float32Array(HALF);
  const prevPrevPhase = new Float32Array(HALF);
  const re = new Float32Array(FFT), im = new Float32Array(FFT);
  for (let f = 0; f < numFrames; f++) {
    const start = f * HOP;
    for (let i = 0; i < FFT; i++) { re[i] = (signal[start + i] ?? 0) * win[i]; im[i] = 0; }
    fftInPlace(re, im);
    let sum = 0;
    for (let k = 0; k < HALF; k++) {
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
  return df;
}

// frameToSec EXACTLY as measureAtMarkers.ts:100
const frameToSec = (f) => f * HOPSEC + HOPSEC / 2;

// ───────────────────────── candidate locators ─────────────────────────
// Production window pick (measureAtMarkers.ts:160-201), given an already-bounded
// [fromFrame,toFrame] window and global dfPeak/dfFloor.
function pickProduction(df, fromFrame, toFrame, dfPeak, minAbsLevel = 0.15) {
  const dfFloor = dfPeak * minAbsLevel;
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
    const lookAhead = Math.max(1, Math.round(0.025 / HOPSEC));
    for (let f = bestFrame + 1; f <= Math.min(toFrame, bestFrame + lookAhead); f++) {
      const isPeak = df[f] >= (df[f - 1] ?? 0) && df[f] >= (df[f + 1] ?? 0);
      if (isPeak && df[f] >= bestVal * 1.6) { bestFrame = f; bestVal = df[f]; }
    }
  }
  return bestFrame < 0 ? null : { frame: bestFrame, sec: frameToSec(bestFrame) };
}

// Parabolic interpolation of the sub-frame peak position around an integer frame.
function pickParabolic(df, prod) {
  if (!prod) return null;
  const f = prod.frame;
  const y0 = df[f - 1] ?? df[f], y1 = df[f], y2 = df[f + 1] ?? df[f];
  const denom = y0 - 2 * y1 + y2;
  const delta = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  const fInterp = f + Math.max(-0.5, Math.min(0.5, delta));
  return { frame: fInterp, sec: fInterp * HOPSEC + HOPSEC / 2 };
}

// Rising-edge backtrack: from the chosen df peak, walk LEFT while df is descending toward
// its foot (where the rise began). The "foot" = first frame (going left) where df stops
// decreasing OR drops below a small fraction of the peak. Reports the foot frame.
function pickFootBacktrack(df, prod, footFrac = 0.2) {
  if (!prod) return null;
  let f = prod.frame;
  const peakVal = df[f];
  const floor = peakVal * footFrac;
  while (f > 0 && df[f - 1] < df[f] && df[f - 1] > floor) f--;
  // include one more step down to where it crosses the floor (the true rise foot)
  if (f > 0 && df[f - 1] <= floor) f--;
  return { frame: f, sec: frameToSec(f) };
}

// Raw-amplitude refine: build a short-time energy envelope, and within ±20ms of the df
// pick find the sample of MAX positive envelope derivative (steepest rise = the audible
// transient onset). NO grid. Returns time in take seconds.
function pickAmpRefine(signal, prodSec, winMs = 20) {
  if (prodSec == null) return null;
  const step = Math.round(0.001 * SR); // 1ms envelope step
  const half = Math.round(0.004 * SR); // 4ms RMS half-window
  const center = Math.round(prodSec * SR);
  const reach = Math.round((winMs / 1000) * SR);
  const lo = Math.max(half, center - reach);
  const hi = Math.min(signal.length - half - step, center + reach);
  const env = (i) => {
    let acc = 0;
    for (let k = i - half; k < i + half; k++) acc += (signal[k] ?? 0) ** 2;
    return Math.sqrt(acc / (2 * half));
  };
  let bestI = -1, bestD = -Infinity;
  for (let i = lo; i <= hi; i += step) {
    const d = env(i + step) - env(i);
    if (d > bestD) { bestD = d; bestI = i; }
  }
  return bestI < 0 ? null : { sample: bestI, sec: bestI / SR };
}

// ───────────────────────── synthetic note builder ─────────────────────────
// A bass note = decaying sum of a fundamental + a few harmonics, with a short attack ramp.
// trueAttackSample = first sample where amplitude becomes audible (end of the ~2ms ramp).
function makeNote(buf, atSample, { f0 = 55, amp = 1, decay = 2.5, attackMs = 3 } = {}) {
  const attack = Math.round((attackMs / 1000) * SR);
  const len = Math.round(0.5 * SR);
  for (let n = 0; n < len; n++) {
    const i = atSample + n;
    if (i >= buf.length) break;
    const t = n / SR;
    const env = (n < attack ? n / attack : 1) * Math.exp(-decay * t);
    const s =
      Math.sin(2 * Math.PI * f0 * t) +
      0.5 * Math.sin(2 * Math.PI * 2 * f0 * t) +
      0.3 * Math.sin(2 * Math.PI * 3 * f0 * t);
    buf[i] += amp * env * s;
  }
  // the audible onset is where the attack ramp reaches a usable level; use ramp midpoint
  return atSample;
}

function fingerTick(buf, atSample, amp = 0.02) {
  // a tiny broadband click ~1ms before the note — the "finger noise" pre-attack
  const len = Math.round(0.0015 * SR);
  for (let n = 0; n < len; n++) {
    const i = atSample + n;
    if (i >= buf.length) break;
    buf[i] += amp * (Math.random() * 2 - 1) * Math.exp(-n / (len * 0.4));
  }
}

function reportLane(label, signal, markerSec, trueAttackSample, dfPeak) {
  const trueSec = trueAttackSample / SR;
  const markerBuf = markerSec; // probe uses startedAt=0 so buf==ctx
  // production neighbour-bounded window (isolated note → big neighbour gaps)
  const backSec = 0.045, fwdSec = 0.12;
  const df = signal.__df; // attached
  const fromFrame = Math.max(0, Math.floor((markerBuf - backSec) / HOPSEC));
  const toFrame = Math.min(df.length - 1, Math.ceil((markerBuf + fwdSec) / HOPSEC));

  const prod = pickProduction(df, fromFrame, toFrame, dfPeak);
  const para = pickParabolic(df, prod);
  const foot = pickFootBacktrack(df, prod);
  const ampR = pickAmpRefine(signal, prod ? prod.sec : null);

  const errMs = (sec) => (sec == null ? null : ((sec - trueSec) * 1000).toFixed(1));
  const strength = prod ? Math.min(1, df[prod.frame] / dfPeak) : 0;

  // df dump around the true attack frame
  const attackFrame = Math.round(trueSec / HOPSEC);
  const dump = [];
  for (let f = attackFrame - 5; f <= attackFrame + 6; f++) {
    if (f < 0 || f >= df.length) continue;
    const mark = f === prod?.frame ? ' <-PICK' : f === attackFrame ? ' <-trueATK' : '';
    dump.push(`    f=${f} t=${(frameToSec(f) * 1000).toFixed(1)}ms df=${df[f].toFixed(4)}${mark}`);
  }

  console.log(`\n  ${label}  (strength=${strength.toFixed(2)}, trueAttack=${(trueSec * 1000).toFixed(1)}ms)`);
  console.log(`    PRODUCTION  err=${errMs(prod?.sec)}ms`);
  console.log(`    PARABOLIC   err=${errMs(para?.sec)}ms`);
  console.log(`    FOOT-BTRACK err=${errMs(foot?.sec)}ms`);
  console.log(`    AMP-REFINE  err=${errMs(ampR?.sec)}ms`);
  console.log(`    df ramp around true attack:`);
  dump.forEach((d) => console.log(d));
  return {
    label, strength: +strength.toFixed(2),
    prod: +errMs(prod?.sec), para: +errMs(para?.sec),
    foot: +errMs(foot?.sec), amp: +errMs(ampR?.sec),
  };
}

// ───────────────────────── build cases ─────────────────────────
console.log('='.repeat(78));
console.log('SUSPECT B PROBE — weak-note df ramp & candidate fixes (SR=48k, FFT=2048, HOP=512)');
console.log(`hopSec=${(HOPSEC * 1000).toFixed(2)}ms, FFT window span=${((FFT / SR) * 1000).toFixed(1)}ms`);
console.log('='.repeat(78));

const TAKE = Math.round(3.0 * SR);
function freshBuf() { return new Float32Array(TAKE); }

// We need ONE take whose global df peak comes from a STRONG note (matching the production
// global-normalization). Put a strong, a medium, and several weak notes in one take, all
// well separated (>500ms) so neighbour bounding is identical and isolated.
const buf = freshBuf();
const cases = [];

// strong note at 0.5s  (amp 1.0)
let s;
s = Math.round(0.5 * SR); makeNote(buf, s, { amp: 1.0, decay: 2.5 }); cases.push({ label: 'STRONG amp=1.0', atk: s, marker: s / SR, tick: false });
// medium note at 1.0s (amp 0.5)
s = Math.round(1.0 * SR); makeNote(buf, s, { amp: 0.5, decay: 2.5 }); cases.push({ label: 'MEDIUM amp=0.5', atk: s, marker: s / SR, tick: false });
// weak note at 1.5s (amp 0.18, NO tick)
s = Math.round(1.5 * SR); makeNote(buf, s, { amp: 0.18, decay: 2.5 }); cases.push({ label: 'WEAK amp=0.18 noTick', atk: s, marker: s / SR, tick: false });
// weak note + finger tick at 2.0s (amp 0.18, tick 1.5ms before)
s = Math.round(2.0 * SR);
const tickAt = s - Math.round(0.002 * SR);
fingerTick(buf, tickAt, 0.025);
makeNote(buf, s, { amp: 0.18, decay: 2.5 });
cases.push({ label: 'WEAK amp=0.18 +fingerTick', atk: s, marker: s / SR, tick: true });
// very weak note at 2.5s (amp 0.12)
s = Math.round(2.5 * SR); makeNote(buf, s, { amp: 0.12, decay: 2.5 }); cases.push({ label: 'VWEAK amp=0.12 noTick', atk: s, marker: s / SR, tick: false });

const df = complexDomainDF(buf);
buf.__df = df;
let dfPeak = 0;
for (let f = 0; f < df.length; f++) if (df[f] > dfPeak) dfPeak = df[f];
console.log(`\nglobal dfPeak frame value = ${dfPeak.toFixed(4)} (normalized to 1.0 internally)`);

const rows = [];
for (const c of cases) {
  rows.push(reportLane(c.label, buf, c.marker, c.atk, dfPeak));
}

// ───────────────────────── summary table ─────────────────────────
console.log('\n' + '='.repeat(78));
console.log('SUMMARY  (errMs vs TRUE attack; negative = EARLY, the bug)');
console.log('='.repeat(78));
console.log('  case                         str    PROD    PARA    FOOT     AMP');
for (const r of rows) {
  const p = (v) => (v == null || Number.isNaN(v) ? '  --- ' : String(v).padStart(6));
  console.log(`  ${r.label.padEnd(28)} ${String(r.strength).padStart(4)} ${p(r.prod)} ${p(r.para)} ${p(r.foot)} ${p(r.amp)}`);
}

// ───────────────────────── REAL bass.wav sanity ─────────────────────────
console.log('\n' + '='.repeat(78));
console.log('REAL bass.wav sanity — does df ramp/peak behave like the synthetic on real audio?');
console.log('='.repeat(78));
try {
  const wav = readFileSync(join(__dir, 'stems', 'bass.wav'));
  const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let off = 12, fmt = null, dataOff = 0, dataLen = 0;
  while (off + 8 <= dv.byteLength) {
    const id = dv.getUint32(off, false), sz = dv.getUint32(off + 4, true), body = off + 8;
    if (id === 0x666d7420) fmt = { audioFormat: dv.getUint16(body, true), channels: dv.getUint16(body + 2, true), sampleRate: dv.getUint32(body + 4, true), bitsPerSample: dv.getUint16(body + 14, true) };
    else if (id === 0x64617461) { dataOff = body; dataLen = sz; }
    off = body + sz + (sz & 1);
  }
  const ch = fmt.channels, rsr = fmt.sampleRate;
  const frames = [];
  if (fmt.audioFormat === 3 && fmt.bitsPerSample === 32) { const n = dataLen / 4; for (let i = 0; i < n; i++) frames.push(dv.getFloat32(dataOff + i * 4, true)); }
  else { const n = dataLen / 2; for (let i = 0; i < n; i++) frames.push(dv.getInt16(dataOff + i * 2, true) / 32768); }
  const mono = new Float32Array(Math.floor(frames.length / ch));
  for (let i = 0; i < mono.length; i++) { let acc = 0; for (let c = 0; c < ch; c++) acc += frames[i * ch + c]; mono[i] = acc / ch; }
  console.log(`  loaded bass.wav: sr=${rsr}, ${(mono.length / rsr).toFixed(2)}s, ${mono.length} samples (probe df uses SR=${SR}; real sr=${rsr})`);
  // recompute hopSec for the real sr; reuse df fn but note it hardcodes SR for frameToSec.
  // We only need to OBSERVE df shape, so compute df with the real sr inside a local fn.
  const realHopSec = HOP / rsr;
  const win = new Float32Array(FFT);
  for (let i = 0; i < FFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT - 1));
  const numFrames = Math.max(0, Math.floor((mono.length - FFT) / HOP) + 1);
  const rdf = new Float32Array(numFrames);
  const pM = new Float32Array(HALF), pP = new Float32Array(HALF), ppP = new Float32Array(HALF);
  const re = new Float32Array(FFT), im = new Float32Array(FFT);
  for (let f = 0; f < numFrames; f++) {
    const start = f * HOP;
    for (let i = 0; i < FFT; i++) { re[i] = (mono[start + i] ?? 0) * win[i]; im[i] = 0; }
    fftInPlace(re, im);
    let sum = 0;
    for (let k = 0; k < HALF; k++) {
      const mag = Math.hypot(re[k], im[k]), phase = Math.atan2(im[k], re[k]);
      if (f >= 2) { const pp = 2 * pP[k] - ppP[k], pm = pM[k]; const dr = mag * Math.cos(phase) - pm * Math.cos(pp), di = mag * Math.sin(phase) - pm * Math.sin(pp); sum += Math.hypot(dr, di); }
      ppP[k] = pP[k]; pP[k] = phase; pM[k] = mag;
    }
    rdf[f] = sum;
  }
  let rmax = 0; for (let i = 0; i < numFrames; i++) if (rdf[i] > rmax) rmax = rdf[i];
  if (rmax > 0) for (let i = 0; i < numFrames; i++) rdf[i] /= rmax;
  // find the strongest peak and a WEAK peak; print the ramp-up frames before each.
  // build raw envelope to locate audible attack
  const envHalf = Math.round(0.004 * rsr);
  const envAt = (i) => { let a = 0; for (let k = i - envHalf; k < i + envHalf; k++) a += (mono[k] ?? 0) ** 2; return Math.sqrt(a / (2 * envHalf)); };
  // detect local df peaks
  const peaks = [];
  for (let f = 2; f < numFrames - 1; f++) if (rdf[f] >= rdf[f - 1] && rdf[f] >= rdf[f + 1] && rdf[f] > 0.05) peaks.push({ f, v: rdf[f] });
  peaks.sort((a, b) => b.v - a.v);
  const strongP = peaks[0];
  const weakP = peaks.find((p) => p.v < 0.25) ?? peaks[peaks.length - 1];
  for (const [name, p] of [['STRONGEST', strongP], ['WEAK', weakP]]) {
    if (!p) continue;
    console.log(`\n  ${name} real df peak: frame ${p.f}, df=${p.v.toFixed(4)}, t≈${((p.f * HOP + HOP / 2) / rsr * 1000).toFixed(0)}ms`);
    // where is the audible attack? steepest env rise within ±25ms of the df peak center
    const center = Math.round((p.f * HOP + HOP / 2));
    const reach = Math.round(0.025 * rsr);
    let bi = -1, bd = -Infinity;
    for (let i = Math.max(envHalf, center - reach); i <= Math.min(mono.length - envHalf - 48, center + reach); i += 48) {
      const d = envAt(i + 48) - envAt(i);
      if (d > bd) { bd = d; bi = i; }
    }
    const dfPeakSec = (p.f * HOP + HOP / 2) / rsr;
    const ampSec = bi / rsr;
    console.log(`    df-peak time=${(dfPeakSec * 1000).toFixed(1)}ms  vs  steepest-amp-rise=${(ampSec * 1000).toFixed(1)}ms  → df leads amp by ${((ampSec - dfPeakSec) * 1000).toFixed(1)}ms`);
    console.log(`    df ramp (frames before/at peak):`);
    for (let f = p.f - 5; f <= p.f + 2; f++) {
      if (f < 0 || f >= numFrames) continue;
      const mk = f === p.f ? ' <-PEAK' : '';
      console.log(`      f=${f} df=${rdf[f].toFixed(4)} (${(rdf[f] / p.v * 100).toFixed(0)}% of peak)${mk}`);
    }
  }
} catch (e) {
  console.log('  could not load/parse bass.wav: ' + e.message);
}
