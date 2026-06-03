/**
 * Precise seam analysis — timestamp-driven (no pitch detection).
 *
 * Reads a capture WAV + its .events.json sidecar (engine pitch/rate writes with
 * exact apply-at times), locates the EXACT sample where the deferred key change
 * lands, and measures continuity right there vs. control windows. Because we
 * know the seam time from the engine itself, this is exact, not inferred.
 *
 * Metrics at the seam (a ±30ms window around the apply-at boundary):
 *   - maxJump      : largest |x[n]-x[n-1]| in the window (a click shows here)
 *   - rmsBefore/After: short-time RMS just before/after (level continuity)
 *   - specFlux     : positive spectral change across the boundary (a glitch
 *                    injects broadband energy → high flux; a clean key swap is
 *                    a smooth harmonic shift → modest flux)
 * Compared against a control window 1 loop earlier (steady playback) so a seam
 * artifact only counts if it exceeds the engine's own running noise floor.
 *
 * Run:
 *   node seam.mjs <capture.wav>            (expects <capture>.events.json)
 */
import { readFileSync } from 'node:fs';
import { parseWav } from './analyze.mjs';

function dft(x, start, len) {
  // magnitude spectrum via naive DFT on a Hann-windowed frame (len small).
  const re = new Float64Array(len),
    im = new Float64Array(len);
  for (let k = 0; k < len; k++) {
    let sre = 0,
      sim = 0;
    for (let n = 0; n < len; n++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (len - 1)); // Hann
      const s = (x[start + n] || 0) * w;
      const a = (2 * Math.PI * k * n) / len;
      sre += s * Math.cos(a);
      sim -= s * Math.sin(a);
    }
    re[k] = sre;
    im[k] = sim;
  }
  const mag = new Float64Array(len / 2);
  for (let k = 0; k < len / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}

function spectralFlux(x, a, b, len = 1024) {
  // positive spectral change from frame ending at `a` to frame starting at `b`
  const m1 = dft(x, Math.max(0, a - len), len);
  const m2 = dft(x, b, len);
  let flux = 0;
  for (let k = 0; k < m1.length; k++) {
    const d = m2[k] - m1[k];
    if (d > 0) flux += d;
  }
  return flux;
}

function windowStats(x, sr, centerSample, halfMs = 30) {
  const half = Math.round((halfMs / 1000) * sr);
  const a = Math.max(1, centerSample - half);
  const b = Math.min(x.length, centerSample + half);
  let maxJump = 0,
    maxAt = -1;
  for (let i = a; i < b; i++) {
    const j = Math.abs(x[i] - x[i - 1]);
    if (j > maxJump) {
      maxJump = j;
      maxAt = i;
    }
  }
  const rms = (s, e) => {
    let acc = 0;
    for (let i = s; i < e; i++) acc += x[i] * x[i];
    return Math.sqrt(acc / Math.max(1, e - s));
  };
  const rmsBefore = rms(Math.max(0, centerSample - half), centerSample);
  const rmsAfter = rms(centerSample, Math.min(x.length, centerSample + half));
  const flux =
    centerSample > 1100 && centerSample + 1100 < x.length
      ? spectralFlux(x, centerSample, centerSample)
      : null;
  return {
    maxJump: +maxJump.toFixed(5),
    maxAtSec: +(maxAt / sr).toFixed(4),
    rmsBefore: +rmsBefore.toFixed(4),
    rmsAfter: +rmsAfter.toFixed(4),
    rmsRatio: +(rmsAfter / Math.max(1e-6, rmsBefore)).toFixed(3),
    specFlux: flux != null ? +flux.toFixed(3) : null,
  };
}

function main() {
  const cap = process.argv.find((a) => a.endsWith('.wav'));
  if (!cap) {
    console.error('usage: node seam.mjs <capture.wav>');
    process.exit(1);
  }
  const { sampleRate: sr, samples: x } = parseWav(readFileSync(cap));
  const sidecar = cap.replace(/\.wav$/, '.events.json');
  const meta = JSON.parse(readFileSync(sidecar, 'utf8'));

  // The deferred seam = the apply-at time (3rd arg) of the LAST pitch write
  // that carries a future boundary. All stems share it.
  const pitchEvents = meta.events.filter(
    (e) => e.method === 'setInstrumentPitchShift' && e.args[2] != null,
  );
  if (!pitchEvents.length) {
    console.log('No deferred key change found in events. (baseline/tempo?)');
    return;
  }
  const last = pitchEvents[pitchEvents.length - 1];
  const seamSec = Number(last.args[2]); // engine apply-at (audio-context time)
  // Map engine audio-time → WAV sample. recStart is implicit in sampleIndex
  // already (events carry sampleIndex computed from recStart). The apply-at is
  // an absolute ctx time; convert using the same offset the events used:
  // sampleIndex(firedAt) was (firedAt - recStart)*SR, so
  // recStart = firedAt - sampleIndex/SR.
  const recStart = last.now - last.sampleIndex / sr;
  const seamSample = Math.round((seamSec - recStart) * sr);

  const finalSemis = Number(last.args[1]);
  console.log(`\n── Seam analysis: ${cap} ──`);
  console.log(`  capture: ${(x.length / sr).toFixed(2)}s @ ${sr}Hz`);
  console.log(
    `  key change: final offset ${finalSemis} st, applied at engine seam ${seamSec.toFixed(4)}s`,
  );
  console.log(
    `  → seam at WAV sample ${seamSample} (${(seamSample / sr).toFixed(3)}s); fired at ${last.seamSec.toFixed(2)}s → deferred ${(seamSec - last.now).toFixed(2)}s`,
  );
  if (seamSample < 0 || seamSample >= x.length) {
    console.log(
      `  ⚠ seam sample ${seamSample} is OUTSIDE the captured ${x.length}-sample WAV — extend capture window.`,
    );
    return;
  }

  const seam = windowStats(x, sr, seamSample);
  // Control: a STEADY, non-silent window. Probe several candidate offsets
  // before the seam and pick the first with real signal (rms > 1% of peak), so
  // we never compare against the count-in silence.
  let peak = 0;
  for (const s of x) if (Math.abs(s) > peak) peak = Math.abs(s);
  const rmsAt = (c) => {
    const h = Math.round(0.03 * sr);
    let acc = 0;
    for (let i = Math.max(0, c - h); i < Math.min(x.length, c + h); i++) acc += x[i] * x[i];
    return Math.sqrt(acc / (2 * h));
  };
  const candidates = [2.0, 1.0, 3.0, 4.0, 0.5].map((d) =>
    seamSample - Math.round(d * sr),
  );
  let ctlCenter = candidates.find((c) => c > 2000 && rmsAt(c) > peak * 0.05);
  if (ctlCenter == null) ctlCenter = Math.max(2000, seamSample - Math.round(2 * sr));
  const ctl = windowStats(x, sr, ctlCenter);

  console.log(`\n  SEAM window (±30ms @ ${(seamSample / sr).toFixed(3)}s):`);
  console.log(`    maxJump=${seam.maxJump}  rmsBefore=${seam.rmsBefore} rmsAfter=${seam.rmsAfter} (ratio ${seam.rmsRatio})  specFlux=${seam.specFlux}`);
  console.log(`  CONTROL window (±30ms @ ${(ctlCenter / sr).toFixed(3)}s, steady):`);
  console.log(`    maxJump=${ctl.maxJump}  rmsBefore=${ctl.rmsBefore} rmsAfter=${ctl.rmsAfter} (ratio ${ctl.rmsRatio})  specFlux=${ctl.specFlux}`);
  const jr = seam.maxJump / Math.max(1e-6, ctl.maxJump);
  const fr = seam.specFlux && ctl.specFlux ? seam.specFlux / ctl.specFlux : null;
  console.log(`\n  ► seam/control  maxJump ratio = ${jr.toFixed(2)}×` + (fr ? `   specFlux ratio = ${fr.toFixed(2)}×` : ''));
  console.log(`    (≈1× = seam indistinguishable from steady playback; ≫1× = audible artifact)\n`);
}

main();
