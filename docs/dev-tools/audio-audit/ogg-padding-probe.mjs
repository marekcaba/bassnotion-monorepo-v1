/**
 * ogg-padding-probe.mjs — bass-coach sync de-risk (Open Q2, 2026-06-21).
 *
 * THE QUESTION: the bass-coach reference markers (ReferenceAnalysis.onsetsSec) are
 * authored in the admin editor on ONE decode of the bass stem. At grade time the
 * browser RE-DECODES the (OGG) stem and we map onset t → ctx via
 * loopStartAudioTime + t/R. If OGG/Vorbis decode adds HEAD PADDING (encoder/decoder
 * delay), the runtime buffer's sample 0 is NOT the WAV's sample 0 → every stored
 * marker is shifted by a constant the sync proof doesn't account for, and
 * estimateGrossOffset would silently absorb it as "mic latency".
 *
 * THE TEST (offline, deterministic): decode the shipped bass.ogg the way the
 * browser would (libvorbis via ffmpeg) and compare its FIRST real onset to the
 * first onset of the source bass.wav. Equal (within ~1ms) → no padding, the sync
 * proof holds, sample 0 == sample 0. Constant shift → padding is real, and the
 * fix is to subtract it (or detect-on-the-decoded-buffer, never the WAV).
 *
 * Also reports the raw sample-count delta — Vorbis commonly carries the true length
 * in the granulepos so a correct decoder trims padding to 0; ffmpeg does this, and
 * the browser's decodeAudioData is expected to match. This probe proves it for OUR
 * file rather than trusting "expected".
 *
 *   node docs/dev-tools/audio-audit/ogg-padding-probe.mjs [bass.wav] [bass.ogg]
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── reuse parseWav by importing analyze.mjs's internals is not exported, so inline
//    a tiny PCM16/Float32 WAV reader (same logic as analyze.mjs parseWav). ──
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

/**
 * First real onset, in seconds. We want the leading-edge of the FIRST note —
 * the moment energy first rises above a noise floor and stays up. RMS over a
 * short window, threshold at a fraction of the global peak RMS, return the first
 * crossing. Same definition for both files so a constant head-shift is exposed.
 */
function firstOnsetSec(x, sr, { winMs = 5 } = {}) {
  const win = Math.max(1, Math.round((winMs / 1000) * sr));
  const rms = new Float32Array(Math.floor(x.length / win));
  let peak = 0;
  for (let b = 0; b < rms.length; b++) {
    let s = 0;
    for (let i = 0; i < win; i++) { const v = x[b * win + i] || 0; s += v * v; }
    rms[b] = Math.sqrt(s / win);
    if (rms[b] > peak) peak = rms[b];
  }
  const thr = peak * 0.15; // 15% of peak RMS = clearly into the attack, above floor
  for (let b = 0; b < rms.length; b++) {
    if (rms[b] >= thr) return (b * win) / sr;
  }
  return 0;
}

/** Index of the first sample whose |amp| exceeds a tiny floor — the literal first
 *  non-silent sample (catches head padding even before the onset). */
function firstNonSilentSample(x, floor = 1e-4) {
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > floor) return i;
  return -1;
}

const wavPath = process.argv[2] || join(import.meta.dirname, 'stems', 'bass.wav');
const oggPath = process.argv[3] || join(import.meta.dirname, 'stems', 'bass.ogg');

// Decode the OGG to a float WAV with ffmpeg (libvorbis decoder — same family the
// browser uses). -ar keeps the native rate; we read it back from the WAV header.
const decoded = join(tmpdir(), 'bass-ogg-decoded.wav');
execFileSync('ffmpeg', ['-y', '-i', oggPath, '-c:a', 'pcm_f32le', decoded], {
  stdio: ['ignore', 'ignore', 'ignore'],
});

const w = parseWav(readFileSync(wavPath));
const o = parseWav(readFileSync(decoded));

const wOnset = firstOnsetSec(w.samples, w.sampleRate);
const oOnset = firstOnsetSec(o.samples, o.sampleRate);
const wFirst = firstNonSilentSample(w.samples);
const oFirst = firstNonSilentSample(o.samples);

const onsetDeltaMs = (oOnset - wOnset) * 1000;
const lenDeltaSamples = o.samples.length - w.samples.length;
const firstSampleDeltaMs =
  ((oFirst / o.sampleRate) - (wFirst / w.sampleRate)) * 1000;

console.log('\n=== OGG decode-padding probe (bass-coach sync Open Q2) ===\n');
console.log(`WAV  : ${wavPath}`);
console.log(`       sr=${w.sampleRate}  samples=${w.samples.length}  dur=${(w.samples.length / w.sampleRate).toFixed(3)}s`);
console.log(`OGG→ : ${oggPath}`);
console.log(`       sr=${o.sampleRate}  samples=${o.samples.length}  dur=${(o.samples.length / o.sampleRate).toFixed(3)}s`);
console.log('');
console.log(`first non-silent sample : WAV @${wFirst} (${(wFirst / w.sampleRate * 1000).toFixed(2)}ms)  OGG @${oFirst} (${(oFirst / o.sampleRate * 1000).toFixed(2)}ms)  Δ=${firstSampleDeltaMs.toFixed(2)}ms`);
console.log(`first ONSET (15% RMS)   : WAV ${(wOnset * 1000).toFixed(2)}ms   OGG ${(oOnset * 1000).toFixed(2)}ms   Δ=${onsetDeltaMs.toFixed(2)}ms`);
console.log(`length delta            : ${lenDeltaSamples} samples (${(lenDeltaSamples / o.sampleRate * 1000).toFixed(2)}ms)`);
console.log('');

const VERDICT_MS = 1.5;
if (Math.abs(onsetDeltaMs) <= VERDICT_MS && Math.abs(firstSampleDeltaMs) <= VERDICT_MS) {
  console.log(`✅ NO head padding (|Δ| ≤ ${VERDICT_MS}ms). The runtime-decoded OGG shares sample 0`);
  console.log(`   with the source. The sync proof holds: stored onsetsSec map straight onto`);
  console.log(`   loopStartAudioTime + t/R. No hidden offset for estimateGrossOffset to absorb.\n`);
} else {
  console.log(`⚠️  HEAD SHIFT DETECTED (Δonset=${onsetDeltaMs.toFixed(2)}ms, Δfirst=${firstSampleDeltaMs.toFixed(2)}ms).`);
  console.log(`   The OGG decode shifts the buffer vs the source → stored markers authored on a`);
  console.log(`   different decode are off by this constant. FIX: author the markers on the SAME`);
  console.log(`   runtime decode (already true if the editor decodes the OGG), OR subtract this`);
  console.log(`   constant. Confirm the editor and the grade path both decode the OGG, not the WAV.\n`);
}
