/**
 * ABLETON DECODE — extract ground truth from a real Ableton Live warp, so we can
 * match the Beats engine to it EXACTLY instead of guessing (2026-06-06).
 *
 * Two ground-truth sources Ableton gives us, and what each reveals:
 *
 *   1. The `.asd` sidecar  →  WHERE Ableton puts its transient + warp markers
 *      (seconds↔beats). Tells us if our onset detector matches Ableton's slicing.
 *      Format is the WarpMarker(seconds,beats) layout from DBraun/AbletonParsing.
 *
 *   2. A RENDERED WAV of the loop warped to a slower tempo (Beats mode)  →  the
 *      actual SEAM DSP: where the clicks/spikes are (or aren't), the crossfade
 *      shape at each segment join, whether segments overlap. THIS is what cracks
 *      the "spikes at slow tempo" question — the .asd does NOT contain seam DSP.
 *
 * USAGE:
 *   # 1) Decode transient/warp markers from an .asd:
 *   node ableton-decode.mjs asd <file.wav.asd> [sampleRate]
 *
 *   # 2) Click/spike scan + seam zoom of a rendered Ableton warp:
 *   node ableton-decode.mjs scan <ableton-89bpm.wav>
 *
 *   # 3) Zoom one seam to see the exact crossfade samples (pipe to a file):
 *   node ableton-decode.mjs seam <ableton-89bpm.wav> <timeSeconds> [windowMs]
 *
 * WHAT TO EXPORT FROM ABLETON (the decisive artifact):
 *   - Drop the SAME drum loop we use (test-groove) into a new Live Set.
 *   - Warp = ON, mode = Beats, Preserve = Transients, Transient Envelope = 100,
 *     Loop = the mode you want to copy (Loop Fwd / Back-and-Forth).
 *   - Set the Set tempo to 89 BPM (loop's native is 109) so it SLOWS.
 *   - Export Audio/Video → render the clip. Hand me the WAV + its .asd.
 */
import { readFileSync } from 'node:fs';
import { parseWav, detectClicks } from './analyze.mjs';

// ── .asd warp-marker parser (port of DBraun/AbletonParsing, Live 9/10 layout) ──
function parseAsd(filepath, sr = 48000) {
  const bin = readFileSync(filepath);
  const readDouble = (i) => [bin.readDoubleLE(i), i + 8];

  const markers = [];
  let idx = bin.indexOf(Buffer.from('WarpMarker'));
  let last = -1;
  while (true) {
    idx = bin.indexOf(Buffer.from('WarpMarker'), idx + 1);
    if (idx < 0) {
      idx = last;
      break;
    }
    idx += 14; // 'WarpMarker' (10) + 4
    const [seconds, i2] = readDouble(idx);
    const [beats, i3] = readDouble(i2);
    markers.push({ seconds, beats, sample: Math.round(seconds * sr) });
    idx = i3;
    last = idx;
  }
  return markers;
}

function cmdAsd(file, sr) {
  const markers = parseAsd(file, sr);
  console.log(`\n[asd] ${markers.length} warp markers (sr=${sr}):`);
  let prev = null;
  for (const m of markers) {
    const gap = prev ? ((m.seconds - prev.seconds) * 1000).toFixed(1) + 'ms' : '—';
    console.log(
      `  beat ${m.beats.toFixed(3).padStart(8)}  @ ${m.seconds.toFixed(4)}s  ` +
        `(sample ${m.sample})  Δ${gap}`,
    );
    prev = m;
  }
  // Derive native BPM from the last two markers.
  if (markers.length >= 2) {
    const a = markers[markers.length - 2];
    const b = markers[markers.length - 1];
    const bpm = ((b.beats - a.beats) / (b.seconds - a.seconds)) * 60;
    console.log(`\n[asd] implied native BPM ≈ ${bpm.toFixed(2)}`);
  }
}

// ── click/spike scan of a rendered warp ────────────────────────────────────────
function cmdScan(file) {
  const buf = readFileSync(file);
  const { sampleRate, channels, samples } = parseWav(buf);
  const x = samples; // mono mix from parseWav
  const clicks = detectClicks(x, sampleRate, { winMs: 15, factor: 6, floor: 0.02 });
  console.log(`\n[scan] ${file}`);
  console.log(`  sr=${sampleRate} ch=${channels} dur=${(x.length / sampleRate).toFixed(3)}s`);
  console.log(`  ${clicks.length} click/spike candidate(s):`);
  for (const c of clicks.slice(0, 60)) {
    console.log(
      `    @ ${c.timeSec.toFixed(4)}s  jump=${c.jump.toFixed(3)} ` +
        `(localSlope≈${c.localSlope.toFixed(3)})`,
    );
  }
  if (clicks.length === 0) {
    console.log('    NONE — Ableton joins these seams click-free. Zoom one to see how.');
  }
}

// ── seam zoom: dump samples around a time so we can SEE the crossfade ───────────
function cmdSeam(file, timeSec, windowMs = 8) {
  const buf = readFileSync(file);
  const { sampleRate, samples } = parseWav(buf);
  const center = Math.round(parseFloat(timeSec) * sampleRate);
  const half = Math.round((windowMs / 1000) * sampleRate);
  const lo = Math.max(0, center - half);
  const hi = Math.min(samples.length, center + half);
  console.log(
    `\n[seam] ${file} @ ${timeSec}s (±${windowMs}ms), samples ${lo}..${hi}:`,
  );
  // Print a coarse amplitude sparkline so a crossfade dip/overlap is visible.
  const blocks = ' ▁▂▃▄▅▆▇█';
  let line = '';
  let peak = 0;
  for (let i = lo; i < hi; i++) peak = Math.max(peak, Math.abs(samples[i]));
  for (let i = lo; i < hi; i += Math.max(1, Math.round((hi - lo) / 120))) {
    const a = Math.abs(samples[i]) / (peak || 1);
    line += blocks[Math.min(8, Math.floor(a * 8))];
  }
  console.log('  |' + line + '|  peak=' + peak.toFixed(3));
  console.log('  (a smooth dip→rise = crossfade; an abrupt vertical step = a click)');
}

const [cmd, file, a, b] = process.argv.slice(2);
if (cmd === 'asd') cmdAsd(file, a ? parseInt(a, 10) : 48000);
else if (cmd === 'scan') cmdScan(file);
else if (cmd === 'seam') cmdSeam(file, a, b ? parseFloat(b) : 8);
else {
  console.log('usage: node ableton-decode.mjs <asd|scan|seam> <file> [args]');
  console.log('  asd  <file.asd> [sr]            — dump warp/transient markers');
  console.log('  scan <warp.wav>                 — click/spike candidates');
  console.log('  seam <warp.wav> <sec> [winMs]   — zoom one seam (crossfade shape)');
}
