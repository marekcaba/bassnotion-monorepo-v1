/**
 * key-analyze.mjs — offline analysis of a key-record.js capture.
 *
 * Reads a bass WAV + its markers JSON (from key-record.js), tracks the bass
 * FUNDAMENTAL over time, and for each KEY change reports exactly where the pitch
 * actually flipped relative to the loop seam — with an ASCII pitch contour around
 * each change so you can SEE it.
 *
 * Run:
 *   node docs/dev-tools/audio-audit/key-analyze.mjs <capture.json>
 *   (the .json points at its .wav; both must be in the same folder)
 *
 * Output per key change:
 *   - the expected pitch RATIO (2^(Δsemi/12))
 *   - the measured fundamental before vs after
 *   - the SAMPLE the pitch actually flipped
 *   - flipVsSeam_ms: <0 = pitch changed BEFORE the loop seam (EARLY), >0 = AFTER
 *   - an ASCII Hz contour spanning ~1s around the change, with | at the seam and
 *     ▲ at the detected flip.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const jsonPath = process.argv[2];
if (!jsonPath) { console.error('usage: node key-analyze.mjs <capture.json>'); process.exit(1); }
const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
const wavPath = resolve(dirname(jsonPath), meta.wav);

// ── WAV parse (PCM16 mono) ──────────────────────────────────────────────────
function parseWav(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 12, dataOff = 0, dataLen = 0, fmt = 1, ch = 1, sr = 48000, bits = 16;
  while (off + 8 <= dv.byteLength) {
    const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
    const sz = dv.getUint32(off + 4, true);
    if (id === 'fmt ') { fmt = dv.getUint16(off + 8, true); ch = dv.getUint16(off + 10, true); sr = dv.getUint32(off + 12, true); bits = dv.getUint16(off + 22, true); }
    else if (id === 'data') { dataOff = off + 8; dataLen = sz; }
    off += 8 + sz + (sz & 1);
  }
  const n = Math.floor(dataLen / (bits / 8) / ch);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (bits === 16) out[i] = dv.getInt16(dataOff + i * 2 * ch, true) / 32768;
    else out[i] = dv.getFloat32(dataOff + i * 4 * ch, true);
  }
  return { samples: out, sr };
}

const { samples, sr } = parseWav(readFileSync(wavPath));

// ── pitch track: autocorrelation fundamental, 5ms hop, 50ms window ──────────
function detectHz(s, start, len) {
  const end = Math.min(s.length, start + len);
  let rms = 0; for (let i = start; i < end; i++) rms += s[i] * s[i];
  rms = Math.sqrt(rms / Math.max(1, end - start));
  if (rms < 0.0008) return null;
  const minLag = Math.floor(sr / 400), maxLag = Math.ceil(sr / 30);
  let bestLag = -1, best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0; for (let i = start; i < end - lag; i++) acc += s[i] * s[i + lag];
    // normalize a touch so longer lags aren't penalized
    if (acc > best) { best = acc; bestLag = lag; }
  }
  return bestLag > 0 ? sr / bestLag : null;
}
const hop = Math.round(0.005 * sr), win = Math.round(0.050 * sr);
const track = []; // { sample, hz }
for (let i = 0; i + win < samples.length; i += hop) track.push({ sample: i + (win >> 1), hz: detectHz(samples, i, win) });

function hzAt(sample) {
  // nearest tracked window
  let best = null, bd = Infinity;
  for (const p of track) { if (p.hz == null) continue; const d = Math.abs(p.sample - sample); if (d < bd) { bd = d; best = p.hz; } }
  return best;
}
function medianHzRange(fromS, toS) {
  const hzs = track.filter((p) => p.sample >= fromS && p.sample <= toS && p.hz != null).map((p) => p.hz);
  if (!hzs.length) return null;
  hzs.sort((a, b) => a - b); return hzs[Math.floor(hzs.length / 2)];
}

// seam nearest to a sample
function nearestSeam(sample) {
  let best = null, bd = Infinity;
  for (const s of meta.seam_samples) { if (s == null) continue; const d = Math.abs(s - sample); if (d < bd) { bd = d; best = s; } }
  return best;
}

const fmtMs = (samp) => (samp / sr * 1000).toFixed(1);
console.log(`\nWAV ${meta.wav}  ${(samples.length / sr).toFixed(1)}s  sr=${sr}`);
console.log(`seams: ${meta.seam_samples.length}, keyChanges: ${meta.keyChanges.length}, tempoClicks: ${meta.tempoChanges.length}\n`);

let prevSemis = 0;
for (let k = 0; k < meta.keyChanges.length; k++) {
  const kc = meta.keyChanges[k];
  const dSemi = kc.semis - prevSemis;
  prevSemis = kc.semis;
  if (dSemi === 0) continue;
  const ratio = Math.pow(2, dSemi / 12);
  const boundary = kc.boundary_sample ?? kc.seamAtClick_sample;
  const seam = nearestSeam(boundary);

  // baseline = median Hz in the 0.4s BEFORE the boundary; target = base*ratio.
  const base = medianHzRange(boundary - Math.round(0.45 * sr), boundary - Math.round(0.08 * sr));
  let flip = null;
  if (base) {
    const mid = base * Math.sqrt(ratio), up = ratio > 1;
    for (const p of track) {
      if (p.sample < boundary - Math.round(0.3 * sr) || p.sample > boundary + Math.round(1.2 * sr) || p.hz == null) continue;
      const crossed = up ? p.hz >= mid : p.hz <= mid;
      if (crossed) {
        // require persistence
        let ok = true; let cnt = 0;
        for (const q of track) { if (q.sample < p.sample || q.sample > p.sample + Math.round(0.08 * sr) || q.hz == null) continue; cnt++; if (!(up ? q.hz >= mid : q.hz <= mid)) { ok = false; break; } }
        if (ok && cnt >= 4) { flip = p.sample; break; }
      }
    }
  }

  const flipVsSeam = flip != null && seam != null ? ((flip - seam) / sr * 1000).toFixed(1) : '—';
  const flipVsBoundary = flip != null && boundary != null ? ((flip - boundary) / sr * 1000).toFixed(1) : '—';
  console.log(`── key change #${k}: ${prevSemis - dSemi} → ${kc.semis}  (Δ${dSemi}, ratio ${ratio.toFixed(3)})`);
  console.log(`   base ${base ? base.toFixed(1) : '—'}Hz → target ${base ? (base * ratio).toFixed(1) : '—'}Hz`);
  console.log(`   boundary @ ${fmtMs(boundary)}ms   nearest seam @ ${seam != null ? fmtMs(seam) : '—'}ms   flip @ ${flip != null ? fmtMs(flip) : '—'}ms`);
  console.log(`   flip vs SEAM:     ${flipVsSeam} ms   (<0 early / >0 late)`);
  console.log(`   flip vs boundary: ${flipVsBoundary} ms`);

  // ASCII contour ±0.6s around the boundary
  const from = boundary - Math.round(0.6 * sr), to = boundary + Math.round(0.6 * sr);
  const cols = 70;
  const pts = track.filter((p) => p.sample >= from && p.sample <= to && p.hz != null);
  if (pts.length && base) {
    const lo = Math.min(base, base * ratio) * 0.9, hi = Math.max(base, base * ratio) * 1.1;
    const rows = 6;
    const grid = Array.from({ length: rows }, () => new Array(cols).fill(' '));
    for (const p of pts) {
      const x = Math.round(((p.sample - from) / (to - from)) * (cols - 1));
      const y = Math.round((1 - (p.hz - lo) / (hi - lo)) * (rows - 1));
      if (x >= 0 && x < cols && y >= 0 && y < rows) grid[y][x] = '·';
    }
    const markCol = (samp, chr) => { if (samp == null) return; const x = Math.round(((samp - from) / (to - from)) * (cols - 1)); if (x >= 0 && x < cols) for (let y = 0; y < rows; y++) if (grid[y][x] === ' ') grid[y][x] = chr; };
    markCol(seam, '|');      // loop seam
    markCol(flip, '▲');      // detected pitch flip
    console.log('   ' + `${hi.toFixed(0)}Hz`.padStart(6));
    for (const row of grid) console.log('   ' + row.join(''));
    console.log('   ' + `${lo.toFixed(0)}Hz`.padStart(6) + `   (| = seam, ▲ = pitch flip, span ±0.6s)`);
  }
  console.log('');
}

console.log('Legend: flip vs SEAM <0 = pitch changed BEFORE the loop boundary (EARLY); >0 = AFTER (LATE); ~0 = on the seam.\n');
