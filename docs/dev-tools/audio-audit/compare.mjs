/**
 * Seam-aware comparative analysis: captured engine output vs. ground-truth
 * source stems.
 *
 * The naive click-counter flags real drum transients as "clicks". The source
 * drum stem shows real hits are ~0.5 inter-sample jumps; the captured output's
 * largest discontinuities are ~0.03 — two orders smaller. So a raw count is
 * meaningless. This tool instead:
 *
 *   1. Detects source drum onsets (ground-truth transient times within the
 *      14.436s loop) — the legitimate-discontinuity mask.
 *   2. Pitch-tracks the captured BASS to locate WHEN the key change took
 *      effect (the audible seam).
 *   3. Measures discontinuity energy in a tight window AT the seam and compares
 *      it to the same metric in quiet (non-onset) regions elsewhere — so a seam
 *      artifact stands out only if it exceeds the engine's own noise floor.
 *
 * Run:
 *   node compare.mjs <capture.wav> [--stem stems/drums.wav] [--loop 14.436] [--json]
 */
import { readFileSync } from 'node:fs';
import {
  parseWav,
  detectClicks,
  rmsEnvelope,
  estimatePitchHz,
} from './analyze.mjs';

function load(path) {
  return parseWav(readFileSync(path));
}

// Source onset times via spectral-flux-ish energy rise (simple, robust enough
// for "where are the loud hits").
function sourceOnsets(x, sr, { hopMs = 5, winMs = 20, riseFactor = 2.5 } = {}) {
  const env = rmsEnvelope(x, sr, hopMs, winMs);
  const onsets = [];
  for (let i = 1; i < env.length - 1; i++) {
    const prev = env[i - 1].rms;
    const cur = env[i].rms;
    const next = env[i + 1].rms;
    // local peak in the rising edge, above a relative jump
    if (cur > next && cur > prev * riseFactor && cur > 0.05) {
      onsets.push(env[i].timeSec);
    }
  }
  return onsets;
}

// Track bass pitch over time → returns [{t, hz}] so we can find the key change.
function pitchTrack(x, sr, { hopMs = 50, winMs = 120 } = {}) {
  const hop = Math.round((hopMs / 1000) * sr);
  const win = Math.round((winMs / 1000) * sr);
  const out = [];
  for (let start = 0; start + win <= x.length; start += hop) {
    const hz = estimatePitchHz(x, start, win, sr, 40, 500);
    out.push({ t: (start + win / 2) / sr, hz });
  }
  return out;
}

// Find the largest pitch step in the track (where the key change took effect).
function findKeyChange(track) {
  let best = null;
  for (let i = 3; i < track.length - 3; i++) {
    const before = median(track.slice(i - 3, i).map((p) => p.hz).filter(Boolean));
    const after = median(track.slice(i, i + 3).map((p) => p.hz).filter(Boolean));
    if (before && after && before > 0) {
      const semis = 12 * Math.log2(after / before);
      if (best === null || Math.abs(semis) > Math.abs(best.semis)) {
        best = { t: track[i].t, before, after, semis };
      }
    }
  }
  return best;
}

function median(a) {
  const v = a.filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}

// Max inter-sample jump within a time window, ignoring samples near a known
// onset (those are legitimate transients).
function windowDiscontinuity(x, sr, t0, t1, onsetTimes, guardMs = 15) {
  const a = Math.max(1, Math.floor(t0 * sr));
  const b = Math.min(x.length, Math.floor(t1 * sr));
  const guard = (guardMs / 1000) * sr;
  let maxJump = 0,
    maxAt = -1,
    sumJump = 0,
    cnt = 0;
  for (let i = a; i < b; i++) {
    const tSec = i / sr;
    const nearOnset = onsetTimes.some((o) => Math.abs(o - tSec) * sr < guard);
    if (nearOnset) continue;
    const jump = Math.abs(x[i] - x[i - 1]);
    sumJump += jump;
    cnt++;
    if (jump > maxJump) {
      maxJump = jump;
      maxAt = tSec;
    }
  }
  return { maxJump, maxAt: +maxAt.toFixed(4), meanJump: cnt ? sumJump / cnt : 0 };
}

function main() {
  const args = process.argv.slice(2);
  const cap = args.find((a) => !a.startsWith('--'));
  const stemPath =
    args[args.indexOf('--stem') + 1] ||
    'docs/dev-tools/audio-audit/stems/drums.wav';
  const loopSec = parseFloat(args[args.indexOf('--loop') + 1]) || 14.436;
  const asJson = args.includes('--json');

  const c = load(cap);
  const drum = load(stemPath);

  // 1. Ground-truth onsets in the source loop.
  const srcOnsets = sourceOnsets(drum.samples, drum.sampleRate);

  // 2. Project source onsets onto the captured timeline (the capture has a
  //    count-in + repeats). We detect the captured output's own onsets and use
  //    them as the legitimate-transient mask directly (tempo may differ).
  const capOnsets = sourceOnsets(c.samples, c.sampleRate, { riseFactor: 2.0 });

  // 3. Pitch-track the capture to find the key change.
  const track = pitchTrack(c.samples, c.sampleRate);
  const keyChange = findKeyChange(track);

  // 4. Discontinuity AT the seam vs. a quiet control region.
  let seamMetric = null;
  let controlMetric = null;
  if (keyChange) {
    seamMetric = windowDiscontinuity(
      c.samples,
      c.sampleRate,
      keyChange.t - 0.06,
      keyChange.t + 0.06,
      capOnsets,
    );
    // control: a 120ms window 1.5s before the key change (steady playback)
    const ct = Math.max(0.5, keyChange.t - 1.5);
    controlMetric = windowDiscontinuity(
      c.samples,
      c.sampleRate,
      ct - 0.06,
      ct + 0.06,
      capOnsets,
    );
  }

  // Whole-file stats
  let peak = 0,
    sq = 0;
  for (const s of c.samples) {
    const a = Math.abs(s);
    if (a > peak) peak = a;
    sq += s * s;
  }

  const result = {
    capture: cap,
    durationSec: +(c.samples.length / c.sampleRate).toFixed(3),
    peak: +peak.toFixed(4),
    rms: +Math.sqrt(sq / c.samples.length).toFixed(4),
    sourceOnsetCount: srcOnsets.length,
    captureOnsetCount: capOnsets.length,
    keyChange: keyChange
      ? {
          atSec: +keyChange.t.toFixed(3),
          beforeHz: +keyChange.before.toFixed(1),
          afterHz: +keyChange.after.toFixed(1),
          semitones: +keyChange.semis.toFixed(2),
        }
      : null,
    seam: seamMetric
      ? {
          maxJump: +seamMetric.maxJump.toFixed(4),
          maxAt: seamMetric.maxAt,
          meanJump: +seamMetric.meanJump.toFixed(5),
        }
      : null,
    control: controlMetric
      ? {
          maxJump: +controlMetric.maxJump.toFixed(4),
          meanJump: +controlMetric.meanJump.toFixed(5),
        }
      : null,
    seamVsControlRatio:
      seamMetric && controlMetric && controlMetric.maxJump > 0
        ? +(seamMetric.maxJump / controlMetric.maxJump).toFixed(2)
        : null,
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`\n── Seam-aware audit: ${result.capture} ──`);
  console.log(`  ${result.durationSec}s  peak=${result.peak} rms=${result.rms}`);
  console.log(`  source drum onsets: ${result.sourceOnsetCount}  |  capture onsets: ${result.captureOnsetCount}`);
  if (result.keyChange) {
    console.log(
      `  KEY CHANGE detected @ ${result.keyChange.atSec}s: ${result.keyChange.beforeHz}Hz → ${result.keyChange.afterHz}Hz  (${result.keyChange.semitones} semitones)`,
    );
    console.log(
      `  seam discontinuity (transients masked): maxJump=${result.seam.maxJump} @ ${result.seam.maxAt}s  meanJump=${result.seam.meanJump}`,
    );
    console.log(
      `  control region (steady):                maxJump=${result.control.maxJump}  meanJump=${result.control.meanJump}`,
    );
    console.log(
      `  ► seam/control maxJump ratio = ${result.seamVsControlRatio}×  (≈1 = seam as smooth as steady playback; >>1 = artifact)`,
    );
  } else {
    console.log('  (no key change detected — baseline/tempo scenario)');
  }
  console.log('');
}

main();
