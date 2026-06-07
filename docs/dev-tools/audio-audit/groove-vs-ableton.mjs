/**
 * GROOVE-vs-ABLETON one-shot comparator.
 *
 * For a NEW groove: decode the original drum stem + the Ableton-warped render,
 * render OURS at the same ratio, then report the full robustness diagnostic
 * (blips, hard-cuts, click artifacts, transient alignment) — the same metrics
 * we hardened tg2 + waitlist against. This is the per-groove check when adding
 * Ableton reference material.
 *
 * It does NOT render ours itself (that needs the TS engine via vitest); it
 * compares two already-rendered mono wavs: OURS and ABLETON, both at the target
 * tempo. Use the vitest render harness first to produce ours-<name>.wav, then:
 *
 *   node groove-vs-ableton.mjs ours-<name>-mono.wav ableton-<name>-mono.wav
 *
 * Both inputs must be the SAME warped tempo. Leading-silence offset between the
 * two (Ableton often pads ~50ms) is auto-detected and compensated.
 */
import { readFileSync } from 'node:fs';
import { parseWav } from './analyze.mjs';

const [oursPath, abletonPath, originalPath, ratioArg] = process.argv.slice(2);
if (!oursPath || !abletonPath) {
  console.error('usage: node groove-vs-ableton.mjs <ours-mono.wav> <ableton-mono.wav> [original-mono.wav <ratio=target/orig>]');
  process.exit(1);
}

const ours = parseWav(readFileSync(oursPath));
const abl = parseWav(readFileSync(abletonPath));
const sr = ours.sampleRate;
const X = ours.samples;
const A = abl.samples;

const env = (x, t, d) => {
  let v = 0, n = 0;
  for (let i = Math.round(t * sr); i < Math.round((t + d) * sr) && i < x.length; i++) { v += x[i] * x[i]; n++; }
  return Math.sqrt(v / (n || 1));
};
// Leading-silence/latency offset (ableton is `offset` later than ours). The first-loud-
// sample estimate works for most files but is unreliable on QUIET beats. So: estimate it
// from the first-loud-sample, then REFINE by NORMALISED envelope cross-correlation in a
// tight ±25ms window around that estimate (normalised so it finds the best SHAPE match, not
// just max overlap — a raw dot-product favours the boundary lag, which faked −50ms).
const firstHit = (x) => { for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > 0.1) return i / sr; return 0; };
const offset = (() => {
  const coarse = firstHit(A) - firstHit(X);
  const hop = Math.round(0.001 * sr), win = Math.round(0.006 * sr);
  const env1 = (s, t0) => { const v = []; for (let i = Math.round(t0 * sr); i < Math.round((t0 + 1.5) * sr) && i + win < s.length; i += hop) { let e = 0; for (let k = i; k < i + win; k++) e += s[k] * s[k]; v.push(Math.sqrt(e / win)); } return v; };
  const base = firstHit(X);
  const eo = env1(X, base);
  let best = -Infinity, bestLag = coarse;
  for (let d = -0.025; d <= 0.025; d += 0.001) {
    const ea = env1(A, base + coarse + d);
    let dot = 0, no = 0, na = 0;
    for (let i = 0; i < Math.min(eo.length, ea.length); i++) { dot += eo[i] * ea[i]; no += eo[i] * eo[i]; na += ea[i] * ea[i]; }
    const corr = dot / (Math.sqrt(no * na) || 1);
    if (corr > best) { best = corr; bestLag = coarse + d; }
  }
  return bestLag;
})();

// 1) HARD-CUT-TO-SILENCE — a substantial sample slammed to ~0 (the worst click class).
let hardCuts = 0, hardCutWorst = 0;
for (let i = 1; i < X.length; i++) {
  if (Math.abs(X[i - 1]) > 0.08 && Math.abs(X[i]) < 0.001) {
    // confirm it stays silent ~2ms (a real cut, not a zero-crossing)
    let silent = true;
    for (let k = i; k < i + Math.round(0.002 * sr) && k < X.length; k++) if (Math.abs(X[k]) > 0.01) { silent = false; break; }
    if (silent) { hardCuts++; hardCutWorst = Math.max(hardCutWorst, Math.abs(X[i - 1])); i += Math.round(0.002 * sr); }
  }
}

// 2) BLIPS — ours spikes from quiet where Ableton is GENUINELY SILENT nearby (an isolated
//    needle Ableton doesn't have at all). Critically, a blip is only a DEFECT if Ableton
//    has NO comparable hit within ±30ms — otherwise it's just the same real transient
//    placed a few ms differently (common on dense beats; NOT a defect). Without this guard
//    the detector cries wolf on every dense-beat secondary. (Confirmed: all 16 it flagged
//    on the dense waitlist beat were real hits Ableton also has.)
let blips = 0; const blipList = [];
const ablSilentNearby = (t) => {
  let aMax = 0;
  for (let dt = -0.03; dt <= 0.03; dt += 0.002) aMax = Math.max(aMax, env(A, t + offset + dt, 0.004));
  return aMax < 0.05; // ableton truly has nothing within ±30ms
};
for (let t = 0.02; t < X.length / sr - 0.02; t += 0.005) {
  const oE = env(X, t, 0.004), oB = env(X, t - 0.012, 0.006);
  if (oE > 0.10 && oB < oE * 0.3 && ablSilentNearby(t)) { blips++; blipList.push(+t.toFixed(2)); t += 0.02; }
}

// 3) TRUE CLICK ARTIFACTS — a hard discontinuity NOT rising into a transient.
const rms = (x, s, n) => { let a = 0, c = 0; for (let i = Math.max(0, s); i < s + n && i < x.length; i++) { a += x[i] * x[i]; c++; } return Math.sqrt(a / (c || 1)); };
const scanArtifacts = (x) => {
  let i = Math.round(0.015 * sr), win = i, art = 0, worst = 0;
  while (i < x.length) {
    let acc = 0; for (let k = i - win; k < i; k++) acc += Math.abs(x[k] - x[k - 1]);
    const slope = acc / win, jump = Math.abs(x[i] - x[i - 1]);
    if (jump > 0.05 && jump > slope * 8) {
      // A jump is only an ARTIFACT if it is NOT a legitimate transient attack. Two tells of
      // a real onset (exclude both): (a) the region AFTER is much louder than before — the
      // hit is starting; (b) the absolute level is high — a real drum attack is a steep
      // single-sample edge by nature (kick attacks measure ~0.8 inter-sample on BOTH ours
      // and Ableton). Only count low-level steps in steady/decaying regions = true clicks.
      const pre = rms(x, i - Math.round(0.03 * sr), Math.round(0.02 * sr)), post = rms(x, i + Math.round(0.005 * sr), Math.round(0.02 * sr));
      const risingIntoHit = post > pre * 2.0;
      const loudAttackEdge = post > 0.3; // a genuine transient onset, not a seam click
      if (!risingIntoHit && !loudAttackEdge) { art++; worst = Math.max(worst, jump); }
      i += win;
    } else i++;
  }
  return { art, worst: +worst.toFixed(3) };
};
const oursArt = scanArtifacts(X), ablArt = scanArtifacts(A);

// 4) TRANSIENT ALIGNMENT — big-hit onset offset (ours vs ableton, offset-compensated).
const bigHits = (x, maxT) => {
  const win = Math.round(0.002 * sr); const on = []; let last = -1;
  for (let s = win; s + win < x.length && s / sr < maxT; s++) {
    let pre = 0, post = 0; for (let k = s - win; k < s; k++) pre += x[k] * x[k]; for (let k = s; k < s + win; k++) post += x[k] * x[k];
    if (Math.sqrt(post / win) - Math.sqrt(pre / win) > 0.25 && s / sr - last > 0.1) { on.push(s / sr); last = s / sr; }
  }
  return on;
};
const oh = bigHits(X, 8), ah = bigHits(A, 8).map((t) => t - offset);
const n = Math.min(oh.length, ah.length); let sumAbs = 0, cnt = 0, worstAlign = 0;
for (let k = 0; k < n; k++) { const d = (oh[k] - ah[k]) * 1000; if (Math.abs(d) < 60) { sumAbs += Math.abs(d); cnt++; worstAlign = Math.max(worstAlign, Math.abs(d)); } }

console.log(`\n=== GROOVE vs ABLETON  (${oursPath.split('/').pop()} vs ${abletonPath.split('/').pop()}) ===`);
console.log(`leading-silence offset (ableton − ours): ${(offset * 1000).toFixed(0)}ms  (auto-compensated)\n`);
console.log(`HARD-CUTS to silence:   ${hardCuts}  (worst ${hardCutWorst.toFixed(3)})        ${hardCuts === 0 ? 'PASS' : 'FAIL — audible clicks'}`);
console.log(`BLIPS (needle vs Ableton smooth): ${blips}   ${blipList.length ? 'at ' + blipList.join(' ') : ''}  ${blips <= 2 ? 'PASS' : 'FAIL'}`);
console.log(`CLICK ARTIFACTS:  ours ${oursArt.art}/worst ${oursArt.worst}   ableton ${ablArt.art}/worst ${ablArt.worst}   ${oursArt.worst <= ablArt.worst + 0.04 ? 'PASS (≈ Ableton)' : 'CHECK'}`);
console.log(`ALIGNMENT:  mean |offset| ${cnt ? (sumAbs / cnt).toFixed(1) : '?'}ms  worst ${worstAlign.toFixed(1)}ms  (${cnt} hits)  ${cnt && sumAbs / cnt < 15 ? 'PASS' : 'CHECK'}`);

// 5) ORIGINAL-PLACEMENT FIDELITY (the rigorous correctness test — does NOT trust Ableton as
//    ground truth). Detect transients in the ORIGINAL stem, project each to its IDEAL warped
//    position (onset / ratio), then measure how far OURS and ABLETON each place it from that
//    ideal. Only on ISOLATED transients (>150ms from neighbours) so pairing is unambiguous.
//    Requires the original mono wav + ratio (= target/orig BPM). Skipped if not provided.
if (originalPath && ratioArg) {
  const ratio = Number(ratioArg);
  const orig = parseWav(readFileSync(originalPath)).samples;
  const detect = (x, thr) => {
    const win = Math.round(0.002 * sr); const on = []; let last = -1;
    for (let s = win; s + win < x.length; s++) {
      let pre = 0, post = 0; for (let k = s - win; k < s; k++) pre += x[k] * x[k]; for (let k = s; k < s + win; k++) post += x[k] * x[k];
      if (Math.sqrt(post / win) - Math.sqrt(pre / win) > thr && s / sr - last > 0.08) { on.push(s / sr); last = s / sr; }
    }
    return on;
  };
  const oT = detect(orig, 0.06), ourT = detect(X, 0.06), aT = detect(A, 0.06).map((t) => t - offset);
  const nearest = (arr, t) => { let best = 1e9; for (const a of arr) if (Math.abs(a - t) < Math.abs(best)) best = a - t; return best; };
  const oursD = [], ablD = [];
  for (let i = 0; i < oT.length; i++) {
    const prev = i > 0 ? oT[i - 1] : -1, next = i < oT.length - 1 ? oT[i + 1] : 1e9;
    if (oT[i] - prev < 0.15 || next - oT[i] < 0.15) continue; // skip clustered (ambiguous pairing)
    const ideal = oT[i] / ratio; // where this original transient SHOULD land after the stretch
    const oOff = nearest(ourT, ideal) * 1000, aOff = nearest(aT, ideal) * 1000;
    if (Math.abs(oOff) < 40 && Math.abs(aOff) < 40) { oursD.push(Math.abs(oOff)); ablD.push(Math.abs(aOff)); }
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const om = mean(oursD), am = mean(ablD);
  console.log(`PLACEMENT vs ORIGINAL (ideal = onset/ratio, ${oursD.length} isolated hits):  ours ${om.toFixed(1)}ms   ableton ${am.toFixed(1)}ms   ${om < am + 4 ? 'PASS (tracks original ≈ Ableton)' : 'CHECK'}`);
}
console.log('');
