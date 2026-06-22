#!/usr/bin/env node
/**
 * lownote-pitch-error-probe2.mjs  (follow-up)
 *
 * Probe-1 showed: a 50-60ms window returns NULL (guard window.length < 2*maxLag, where
 * maxLag = SR/28). At 48kHz that floor is 2*(48000/28)=3428 samp = 71ms. So a short cluster
 * window can't even RUN — yet the dump shows CONFIDENT wrong reads (pConf .91-.99).
 *
 * So the +2st error must come from a window that PASSES the guard. This probe:
 *  (A) Sweeps the boundary 70-110ms finely to find where a low note first reads, and whether
 *      it reads WRONG right at the edge (few integration periods of a 35Hz fundamental).
 *  (B) Models the "body marker" harder: fundamental nearly gone, 2nd/3rd partial dominant —
 *      does YIN then lock to the 2nd partial (+12st octave, forgiven) or a NON-octave partial?
 *  (C) Tests the panel's ACTUAL window bound: onset+12ms → nextMarker. In a fast run the next
 *      marker is ~60-120ms later, so the window is ~50-110ms. Sweep that and report reads.
 *  (D) maxHz=400 sensitivity: does lowering the ceiling change low-note reads?
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULTS = { minHz: 28, maxHz: 400, threshold: 0.15, minConfidence: 0.5 };
function hzToMidiFloat(hz) { return 69 + 12 * Math.log2(hz / 440); }
function verifyPitch(window, sampleRate, opts = {}) {
  const minHz = opts.minHz ?? DEFAULTS.minHz;
  const maxHz = opts.maxHz ?? DEFAULTS.maxHz;
  const threshold = opts.threshold ?? DEFAULTS.threshold;
  const minConfidence = opts.minConfidence ?? DEFAULTS.minConfidence;
  const maxLag = Math.floor(sampleRate / minHz);
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  if (window.length < 2 * maxLag) return { rejected: 'short-guard', need: 2 * maxLag, have: window.length };
  const N = maxLag;
  const diff = new Float32Array(N + 1);
  const integ = window.length - maxLag;
  for (let tau = minLag; tau <= maxLag; tau++) {
    let sum = 0;
    for (let j = 0; j < integ; j++) { const d = (window[j] ?? 0) - (window[j + tau] ?? 0); sum += d * d; }
    diff[tau] = sum;
  }
  const cmnd = new Float32Array(N + 1); cmnd[0] = 1; let run = 0;
  for (let tau = 1; tau <= maxLag; tau++) { run += diff[tau]; cmnd[tau] = run > 0 ? (diff[tau] * tau) / run : 1; }
  let bestTau = -1;
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (cmnd[tau] < threshold) { while (tau + 1 <= maxLag && cmnd[tau + 1] < cmnd[tau]) tau++; bestTau = tau; break; }
  }
  if (bestTau < 0) { let mv = Infinity; for (let tau = minLag; tau <= maxLag; tau++) if (cmnd[tau] < mv) { mv = cmnd[tau]; bestTau = tau; } if (bestTau < 0) return null; }
  let tauI = bestTau;
  if (bestTau > minLag && bestTau < maxLag) {
    const a = cmnd[bestTau - 1], b = cmnd[bestTau], c = cmnd[bestTau + 1];
    const den = a + c - 2 * b; if (Math.abs(den) > 1e-9) tauI = bestTau + (a - c) / (2 * den);
  }
  const hz = sampleRate / tauI;
  if (hz < minHz || hz > maxHz) return { rejected: 'hz-range', hz };
  const confidence = Math.max(0, Math.min(1, 1 - cmnd[bestTau]));
  if (confidence < minConfidence) return { rejected: 'low-conf', confidence, hz };
  const midiFloat = hzToMidiFloat(hz);
  const midi = Math.round(midiFloat);
  return { midi, hz, confidence, cents: Math.round((midiFloat - midi) * 100) };
}

const SR = 48000; // bass.wav is 48k; the app's AudioContext is also typically 48k
function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiName(m) { return `${NN[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`; }

// synth with controllable fundamental-vs-partial balance & decay
function synth(f0, durSec, { fundAmp = 1, p2 = 0.85, p3 = 0.7, fundTau = 0.18, partTau = 0.55, bodyStart = 0 } = {}) {
  const n = Math.floor(durSec * SR); const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR + bodyStart;
    let s = fundAmp * Math.exp(-t / fundTau) * Math.sin(2 * Math.PI * f0 * 1 * (i / SR));
    s += p2 * Math.exp(-t / partTau) * Math.sin(2 * Math.PI * f0 * 2 * (i / SR));
    s += p3 * Math.exp(-t / partTau) * Math.sin(2 * Math.PI * f0 * 3 * (i / SR));
    s += 0.35 * Math.exp(-t / (partTau * 0.8)) * Math.sin(2 * Math.PI * f0 * 4 * (i / SR));
    out[i] = s;
  }
  return out;
}
function fmt(r, trueMidi) {
  if (!r) return 'null';
  if (r.rejected) return `rej:${r.rejected}`;
  const e = r.midi - trueMidi;
  return `${midiName(r.midi)}(${e >= 0 ? '+' : ''}${e}st,c=${r.confidence.toFixed(2)})`;
}

console.log('SR =', SR, ' short-guard floor = 2*floor(SR/28) =', 2 * Math.floor(SR / 28), 'samp =', (2 * Math.floor(SR / 28) / SR * 1000).toFixed(0), 'ms');

const notes = [
  { name: 'C#1', midi: 25 }, { name: 'G#1', midi: 32 }, { name: 'F#1', midi: 30 },
  { name: 'B1', midi: 35 }, { name: 'E1', midi: 28 }, { name: 'B0', midi: 23 },
];

console.log('\n(A) BOUNDARY SWEEP — pitch window opens at onset+12ms (attack), fine window sweep');
const sweep = [70, 72, 74, 76, 78, 80, 85, 90, 100, 120, 150];
console.log('note   ' + sweep.map((w) => (w + 'ms').padStart(11)).join(''));
for (const nt of notes) {
  const f0 = midiToHz(nt.midi);
  const full = synth(f0, 0.7, {});
  const s = Math.floor(0.012 * SR);
  let row = nt.name.padEnd(6);
  for (const w of sweep) {
    const len = Math.floor((w / 1000) * SR);
    const r = verifyPitch(full.subarray(s, s + len), SR);
    row += fmt(r, nt.midi).padStart(11);
  }
  console.log(row);
}

console.log('\n(B) BODY MARKER — fundamental nearly GONE (fundAmp 0.15, deep body +200ms), partials dominate');
console.log('note   ' + sweep.map((w) => (w + 'ms').padStart(11)).join(''));
for (const nt of notes) {
  const f0 = midiToHz(nt.midi);
  const full = synth(f0, 0.9, { fundAmp: 0.15, p2: 1.0, p3: 0.8, bodyStart: 0.2 });
  let row = nt.name.padEnd(6);
  for (const w of sweep) {
    const len = Math.floor((w / 1000) * SR);
    const r = verifyPitch(full.subarray(0, len), SR);
    row += fmt(r, nt.midi).padStart(11);
  }
  console.log(row);
}

console.log('\n(C) QUIET-OVER-LOUD: this note (quiet) layered on the DECAY TAIL of a louder neighbour');
console.log('    (neighbour 4 semitones below, 3x louder, started 90ms earlier and decaying)');
console.log('note   ' + sweep.map((w) => (w + 'ms').padStart(11)).join(''));
for (const nt of notes) {
  const f0 = midiToHz(nt.midi);
  const neighbourF0 = midiToHz(nt.midi - 4);
  const this_ = synth(f0, 0.7, {});
  const neigh = synth(neighbourF0, 0.9, {});
  // mix: neighbour started 90ms earlier (so it's into its decay), 3x louder
  const mix = new Float32Array(this_.length);
  const lead = Math.floor(0.09 * SR);
  for (let i = 0; i < mix.length; i++) {
    const nv = (neigh[i + lead] ?? 0) * 3.0;
    mix[i] = (this_[i] ?? 0) + nv;
  }
  const s = Math.floor(0.012 * SR);
  let row = nt.name.padEnd(6);
  for (const w of sweep) {
    const len = Math.floor((w / 1000) * SR);
    const r = verifyPitch(mix.subarray(s, s + len), SR);
    row += fmt(r, nt.midi).padStart(11);
  }
  console.log(row);
}

console.log('\n(D) maxHz CEILING sensitivity on C#1 body window (does 400 vs 200 vs 120 change it?)');
{
  const f0 = midiToHz(25);
  const full = synth(f0, 0.9, { fundAmp: 0.2, p2: 1.0, p3: 0.85, bodyStart: 0.2 });
  for (const w of [80, 120, 200]) {
    const len = Math.floor((w / 1000) * SR);
    const win = full.subarray(0, len);
    for (const mh of [400, 200, 140, 100]) {
      const r = verifyPitch(win, SR, { maxHz: mh });
      console.log(`  C#1 ${String(w).padStart(3)}ms maxHz=${String(mh).padStart(3)} → ${fmt(r, 25)}`);
    }
  }
}

// ── REAL bass.wav: now with a window that PASSES the guard (80ms) and the panel-realistic bound
function loadWav(file) {
  const buf = fs.readFileSync(file);
  let off = 12, fmt = null, dOff = -1, dLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4); const sz = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { audioFormat: buf.readUInt16LE(off + 8), channels: buf.readUInt16LE(off + 10), sampleRate: buf.readUInt32LE(off + 12), bitsPerSample: buf.readUInt16LE(off + 22) };
    else if (id === 'data') { dOff = off + 8; dLen = sz; }
    off += 8 + sz + (sz & 1);
  }
  const { channels, bitsPerSample, audioFormat, sampleRate } = fmt;
  const bps = bitsPerSample / 8; const frames = Math.floor(dLen / (bps * channels));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) {
      const p = dOff + (i * channels + c) * bps; let v;
      if (audioFormat === 3 && bitsPerSample === 32) v = buf.readFloatLE(p);
      else if (bitsPerSample === 16) v = buf.readInt16LE(p) / 32768;
      else if (bitsPerSample === 24) { let val = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16); if (val & 0x800000) val |= ~0xffffff; v = val / 8388608; }
      else if (bitsPerSample === 32) v = buf.readInt32LE(p) / 2147483648; else v = 0;
      acc += v;
    }
    mono[i] = acc / channels;
  }
  return { samples: mono, sampleRate };
}
console.log('\n(E) REAL bass.wav — quiet onsets, 80ms (just-passes-guard) vs 250ms');
const { samples, sampleRate } = loadWav(path.join(__dirname, 'stems', 'bass.wav'));
const fr = Math.floor(0.01 * sampleRate); const nf = Math.floor(samples.length / fr);
const rms = new Float32Array(nf);
for (let f = 0; f < nf; f++) { let s = 0; for (let i = 0; i < fr; i++) { const v = samples[f * fr + i] ?? 0; s += v * v; } rms[f] = Math.sqrt(s / fr); }
let mx = 0; for (const r of rms) if (r > mx) mx = r;
const onsets = [];
for (let f = 2; f < nf - 2; f++) {
  if (rms[f] > 0.04 * mx && rms[f] - rms[f - 1] > 0.02 * mx && rms[f - 1] < rms[f] && rms[f] >= rms[f + 1] * 0.8) {
    const t = (f * fr) / sampleRate; if (!onsets.length || t - onsets[onsets.length - 1].t > 0.09) onsets.push({ t, rms: rms[f] });
  }
}
const quiet = [...onsets].sort((a, b) => a.rms - b.rms).slice(0, 14).sort((a, b) => a.t - b.t);
console.log(`guard floor at ${sampleRate}Hz = ${(2 * Math.floor(sampleRate / 28) / sampleRate * 1000).toFixed(0)}ms`);
console.log('onset(s)  80ms                  250ms                 agree?');
let dis = 0, tot = 0;
for (const o of quiet) {
  const s = Math.floor((o.t + 0.012) * sampleRate);
  const r80 = verifyPitch(samples.subarray(s, s + Math.floor(0.08 * sampleRate)), sampleRate);
  const r250 = verifyPitch(samples.subarray(s, s + Math.floor(0.25 * sampleRate)), sampleRate);
  const f80 = r80 && !r80.rejected ? `${midiName(r80.midi)} ${r80.hz.toFixed(1)}Hz c=${r80.confidence.toFixed(2)}` : (r80 && r80.rejected ? `rej:${r80.rejected}` : 'null');
  const f250 = r250 && !r250.rejected ? `${midiName(r250.midi)} ${r250.hz.toFixed(1)}Hz c=${r250.confidence.toFixed(2)}` : (r250 && r250.rejected ? `rej:${r250.rejected}` : 'null');
  let ag = '—';
  if (r80 && !r80.rejected && r250 && !r250.rejected) { tot++; const d = r80.midi - r250.midi; if (d === 0) ag = 'yes'; else { ag = `NO ${d >= 0 ? '+' : ''}${d}st`; dis++; } }
  console.log(`${o.t.toFixed(3).padStart(7)}   ${f80.padEnd(22)}${f250.padEnd(22)}${ag}`);
}
console.log(`\nReal quiet-onset 80ms-vs-250ms disagreement: ${dis}/${tot}${tot ? ` (${((100 * dis) / tot).toFixed(0)}%)` : ''}`);
