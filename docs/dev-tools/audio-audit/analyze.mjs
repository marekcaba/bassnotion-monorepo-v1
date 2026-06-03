/**
 * Offline analysis of a captured groove-card audio render.
 *
 * Input: a mono/stereo Float32 PCM WAV (44.1 or 48 kHz) recorded from the
 * engine's master bus during a scripted scenario (play → key change → tempo
 * change). Output: objective seam/click/pitch metrics that can be correlated
 * with the ear (the ground truth).
 *
 * Pure Node, no deps — parses WAV, runs the DSP. Run:
 *   node docs/dev-tools/audio-audit/analyze.mjs <capture.wav> [--json]
 */
import { readFileSync } from 'node:fs';

// ── WAV parse (PCM16 or Float32) ─────────────────────────────────────────────
function parseWav(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, false) !== 0x52494646) throw new Error('not RIFF');
  let off = 12,
    fmt = null,
    dataOff = 0,
    dataLen = 0;
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
    } else if (id === 0x64617461) {
      dataOff = body;
      dataLen = sz;
    }
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
  // Downmix to mono.
  const mono = new Float32Array(Math.floor(frames.length / channels));
  for (let i = 0; i < mono.length; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) s += frames[i * channels + c];
    mono[i] = s / channels;
  }
  return { sampleRate, channels, samples: mono };
}

// ── Click / discontinuity detection ──────────────────────────────────────────
// A click is a sudden inter-sample jump far above the local signal slope. We
// flag samples where |x[n]-x[n-1]| exceeds a multiple of the local RMS slope.
function detectClicks(x, sr, { winMs = 20, factor = 8, floor = 0.02 } = {}) {
  const win = Math.max(1, Math.round((winMs / 1000) * sr));
  const clicks = [];
  let i = win;
  while (i < x.length) {
    // local mean |delta| over preceding window
    let acc = 0;
    for (let k = i - win; k < i; k++) acc += Math.abs(x[k] - x[k - 1]);
    const localSlope = acc / win;
    const jump = Math.abs(x[i] - x[i - 1]);
    const thresh = Math.max(floor, localSlope * factor);
    if (jump > thresh) {
      clicks.push({ sample: i, timeSec: i / sr, jump, localSlope });
      i += win; // don't double-count the same transient
    } else {
      i++;
    }
  }
  return clicks;
}

// ── Short-time RMS envelope (for finding silence / event regions) ────────────
function rmsEnvelope(x, sr, hopMs = 5, winMs = 25) {
  const hop = Math.max(1, Math.round((hopMs / 1000) * sr));
  const win = Math.max(1, Math.round((winMs / 1000) * sr));
  const out = [];
  for (let start = 0; start + win <= x.length; start += hop) {
    let acc = 0;
    for (let k = start; k < start + win; k++) acc += x[k] * x[k];
    out.push({ timeSec: (start + win / 2) / sr, rms: Math.sqrt(acc / win) });
  }
  return out;
}

// ── Goertzel: power at a target frequency over a window (cheap pitch probe) ───
function goertzelPower(x, start, len, freq, sr) {
  const w = (2 * Math.PI * freq) / sr;
  const cw = Math.cos(w);
  const coeff = 2 * cw;
  let s0 = 0,
    s1 = 0,
    s2 = 0;
  for (let n = 0; n < len; n++) {
    s0 = (x[start + n] || 0) + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return power / len;
}

// Estimate dominant pitch in a window via parabolic-interpolated autocorrelation.
function estimatePitchHz(x, start, len, sr, fmin = 50, fmax = 600) {
  const lagMin = Math.floor(sr / fmax);
  const lagMax = Math.ceil(sr / fmin);
  let best = -1,
    bestLag = -1;
  // normalized autocorrelation
  let energy = 0;
  for (let n = 0; n < len; n++) energy += (x[start + n] || 0) ** 2;
  if (energy < 1e-7) return null;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let acc = 0;
    for (let n = 0; n < len - lag; n++) acc += (x[start + n] || 0) * (x[start + n + lag] || 0);
    const norm = acc / energy;
    if (norm > best) {
      best = norm;
      bestLag = lag;
    }
  }
  if (bestLag < 0 || best < 0.3) return null;
  return sr / bestLag;
}

// ── Main ─────────────────────────────────────────────────────────────────────
function analyze(path) {
  const buf = readFileSync(path);
  const { sampleRate, channels, samples } = parseWav(buf);
  const durSec = samples.length / sampleRate;

  // Peak / RMS
  let peak = 0,
    sumSq = 0;
  for (const s of samples) {
    const a = Math.abs(s);
    if (a > peak) peak = a;
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / samples.length);

  const clicks = detectClicks(samples, sampleRate);
  const env = rmsEnvelope(samples, sampleRate);

  // Find the loudest clicks (most likely audible)
  const topClicks = [...clicks].sort((a, b) => b.jump - a.jump).slice(0, 12);

  // Detect dropouts: env regions where RMS falls below 5% of median for >15ms
  const med = [...env.map((e) => e.rms)].sort((a, b) => a - b)[
    Math.floor(env.length / 2)
  ];
  const dropouts = [];
  let dropStart = null;
  for (const e of env) {
    const isLow = e.rms < med * 0.05;
    if (isLow && dropStart === null) dropStart = e.timeSec;
    else if (!isLow && dropStart !== null) {
      if (e.timeSec - dropStart > 0.015)
        dropouts.push({ startSec: dropStart, endSec: e.timeSec });
      dropStart = null;
    }
  }

  return {
    file: path,
    sampleRate,
    channels,
    durationSec: +durSec.toFixed(3),
    peak: +peak.toFixed(4),
    rms: +rms.toFixed(4),
    clipping: peak >= 0.999,
    clickCount: clicks.length,
    topClicks: topClicks.map((c) => ({
      timeSec: +c.timeSec.toFixed(4),
      jump: +c.jump.toFixed(4),
      localSlope: +c.localSlope.toFixed(5),
      ratio: +(c.jump / Math.max(1e-6, c.localSlope)).toFixed(1),
    })),
    dropouts: dropouts.map((d) => ({
      startSec: +d.startSec.toFixed(3),
      endSec: +d.endSec.toFixed(3),
      durMs: +((d.endSec - d.startSec) * 1000).toFixed(1),
    })),
  };
}

export { parseWav, detectClicks, rmsEnvelope, estimatePitchHz, goertzelPower, analyze };

// CLI — only when invoked directly (not when imported by compare.mjs).
import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('usage: node analyze.mjs <capture.wav> [--json]');
    process.exit(1);
  }
  const result = analyze(file);
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n── Audio audit: ${result.file} ──`);
    console.log(`  ${result.durationSec}s @ ${result.sampleRate}Hz, ${result.channels}ch`);
    console.log(`  peak=${result.peak}  rms=${result.rms}  clipping=${result.clipping}`);
    console.log(`  clicks: ${result.clickCount} total`);
    if (result.topClicks.length) {
      console.log('  loudest discontinuities (jump / local-slope ratio):');
      for (const c of result.topClicks)
        console.log(`    t=${c.timeSec}s  jump=${c.jump}  ratio=${c.ratio}×`);
    }
    console.log(`  dropouts: ${result.dropouts.length}`);
    for (const d of result.dropouts)
      console.log(`    t=${d.startSec}–${d.endSec}s  (${d.durMs}ms)`);
    console.log('');
  }
}
