/**
 * WSOLA drum-bed inspector — paste into the DevTools console on the Groove Card
 * page (e.g. http://localhost:3001/app/tutorials/test-groove-2?drumadmin=1) while
 * the groove is PLAYING with "Smooth stretch (WSOLA)" ON and slowed (e.g. 94 BPM).
 *
 * THE QUESTION IT ANSWERS: did the transient-NOTCH remove the kick/snare BODIES
 * from the bed? (If a body stays in the bed, WSOLA's accumulating lag copies it
 * to the wrong place → the "doubled body, no transient" artifact.)
 *
 * It synthesizes the bed TWICE — once with the notch FULLY OFF (the raw full
 * loop) and once with the notch FULLY ON (bodies removed) — and for each strong
 * hit measures RESIDUAL = (bed energy AT the hit position) ÷ (bed energy in the
 * TEXTURE just after it). >1 means a body is still sitting at the hit (bad, the
 * artifact); <1 means the hit position is quieter than the surrounding texture
 * (good, the body was removed). It then draws original vs notched-bed envelopes
 * so you can SEE the dips where the hits were.
 *
 * It restores the player's live notch/bed afterward — nothing is left mutated.
 */
(async () => {
  const eng = window.__bassnotion_playbackEngine;
  const sp = eng && eng.drumSlicePlayer;
  if (!sp) {
    console.warn('[wsola] No drum player. Press play first.');
    return;
  }
  const sr = sp.buffer.sampleRate;
  const loopDur = sp.loopDuration;
  const ratio = sp.ratio || 1;
  if (Math.abs(ratio - 1) < 1e-3) {
    console.warn('[wsola] ratio≈1 — slow the tempo down first (no bed at unity).');
    return;
  }
  const liveNotch = sp.bedTransientNotch; // restore later
  console.log(
    `[wsola] ratio=${ratio.toFixed(4)} loopDur=${loopDur.toFixed(3)}s ` +
      `window=${(sp.wsolaOpt.windowSeconds * 1000) | 0}ms ` +
      `liveNotch=${(liveNotch * 100) | 0}%`,
  );

  const onsets = sp.onsets;
  const strong = sp.strongIndices.map((i) => onsets[i]); // seconds (original)

  // Synthesize a bed at a given notch level and return its mono PCM.
  const bedAt = (notch) => {
    sp.bedTransientNotch = notch;
    sp.precomputeBedAnalysis();
    sp.resynthesizeBed(true);
    return sp.bedBuffer
      ? Float32Array.from(sp.bedBuffer.getChannelData(0))
      : null;
  };

  const bedFull = bedAt(0); // notch OFF = raw full loop in the bed
  const bedNotched = bedAt(1); // notch ON = bodies removed
  if (!bedFull || !bedNotched) {
    console.warn('[wsola] bed synth failed.');
    sp.bedTransientNotch = liveNotch;
    sp.precomputeBedAnalysis();
    sp.resynthesizeBed(true);
    return;
  }

  // RMS of a region [t0,t1) seconds in a bed buffer.
  const rms = (bed, t0, t1) => {
    const a = Math.max(0, Math.round(t0 * sr));
    const b = Math.min(bed.length, Math.round(t1 * sr));
    let acc = 0;
    for (let i = a; i < b; i++) acc += bed[i] * bed[i];
    return Math.sqrt(acc / Math.max(1, b - a));
  };

  // For each strong hit: RESIDUAL = energy AT the hit ÷ energy in the TEXTURE
  // window just after it, for both beds. Lower = body removed.
  const hitWin = 0.04; // 40ms window centered on the hit
  const texWin = 0.12; // texture window starting after the hit body
  const rep = strong.map((t) => {
    const ideal = t / ratio; // linear stretched position
    const hitFull = rms(bedFull, ideal - hitWin / 2, ideal + hitWin / 2);
    const texFull = rms(bedFull, ideal + 0.06, ideal + 0.06 + texWin);
    const hitNot = rms(bedNotched, ideal - hitWin / 2, ideal + hitWin / 2);
    const texNot = rms(bedNotched, ideal + 0.06, ideal + 0.06 + texWin);
    const resFull = texFull > 1e-6 ? hitFull / texFull : 0;
    const resNot = texNot > 1e-6 ? hitNot / texNot : 0;
    return {
      hitMs: +(ideal * 1000).toFixed(0),
      residualFull: +resFull.toFixed(2),
      residualNotched: +resNot.toFixed(2),
      removedPct: +((1 - hitNot / Math.max(1e-6, hitFull)) * 100).toFixed(0),
    };
  });
  console.table(rep);
  const meanFull =
    rep.reduce((s, r) => s + r.residualFull, 0) / rep.length;
  const meanNot =
    rep.reduce((s, r) => s + r.residualNotched, 0) / rep.length;
  const meanRemoved =
    rep.reduce((s, r) => s + r.removedPct, 0) / rep.length;
  console.log(
    `[wsola] mean residual (energy at hit ÷ texture):  FULL bed=${meanFull.toFixed(2)}  NOTCHED bed=${meanNot.toFixed(2)}`,
  );
  console.log(
    `[wsola] → notch removed on average ${meanRemoved.toFixed(0)}% of the body energy at the hit positions.`,
  );
  console.log(
    `[wsola] residual >1 = a transient body sits in the bed (the artifact). <1 = removed. Want NOTCHED ≪ FULL.`,
  );

  // ---- draw: original loop vs notched bed, with hit markers ----
  const N = 1400;
  const envOf = (arr) => {
    const out = new Float32Array(N);
    const bin = arr.length / N;
    for (let p = 0; p < N; p++) {
      let m = 0;
      const a = Math.floor(p * bin),
        b = Math.floor((p + 1) * bin);
      for (let i = a; i < b; i++) {
        const v = Math.abs(arr[i]);
        if (v > m) m = v;
      }
      out[p] = m;
    }
    return out;
  };
  const end = Math.round(loopDur * sr);
  const orig = sp.buffer.getChannelData(0).subarray(0, end);
  const origEnv = envOf(orig);
  const fullEnv = envOf(bedFull);
  const notchEnv = envOf(bedNotched);
  const bedDurS = bedNotched.length / sr;

  const W = 1300,
    H = 470,
    pad = 30;
  document.getElementById('wsola-compare-canvas')?.remove();
  const cv = document.createElement('canvas');
  cv.id = 'wsola-compare-canvas';
  cv.width = W;
  cv.height = H;
  Object.assign(cv.style, {
    position: 'fixed',
    left: '12px',
    top: '12px',
    zIndex: 2147483600,
    background: '#0c0c10',
    border: '1px solid #333',
    borderRadius: '8px',
    boxShadow: '0 8px 30px rgba(0,0,0,.6)',
  });
  cv.onclick = () => cv.remove();
  cv.title = 'click to dismiss';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0c0c10';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '11px ui-monospace, monospace';
  const innerW = W - 2 * pad;

  const draw = (env, y0, h, color, label) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let p = 0; p < N; p++) {
      const x = pad + (p / N) * innerW;
      const v = env[p];
      ctx.moveTo(x, y0 + h / 2 - (v * h) / 2);
      ctx.lineTo(x, y0 + h / 2 + (v * h) / 2);
    }
    ctx.stroke();
    ctx.fillStyle = '#aaa';
    ctx.fillText(label, pad, y0 + 12);
  };

  draw(origEnv, pad, 120, '#4aa3ff', 'ORIGINAL loop');
  draw(fullEnv, pad + 140, 120, '#e0a106', 'BED — notch OFF (bodies still in, the artifact source)');
  draw(notchEnv, pad + 280, 120, '#9be9a8', 'BED — notch ON (bodies removed → flat at green lines)');

  // hit markers on all three panels
  for (const t of strong) {
    const xOrig = pad + (t / loopDur) * innerW;
    const xBed = pad + (t / ratio / bedDurS) * innerW;
    ctx.strokeStyle = 'rgba(34,197,94,0.55)';
    ctx.beginPath();
    ctx.moveTo(xOrig, pad);
    ctx.lineTo(xOrig, pad + 120);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xBed, pad + 140);
    ctx.lineTo(xBed, pad + 400);
    ctx.stroke();
  }
  ctx.fillStyle = '#888';
  ctx.fillText(
    `green lines = kick/snare positions · GOOD = bottom panel is FLAT/quiet at the green lines (bodies gone) · ` +
      `mean residual full=${meanFull.toFixed(2)} notched=${meanNot.toFixed(2)} · click to close`,
    pad,
    H - 8,
  );

  // restore the live bed to whatever the panel had.
  sp.bedTransientNotch = liveNotch;
  sp.precomputeBedAnalysis();
  sp.resynthesizeBed(true);
  console.log('[wsola] live bed restored. Canvas top-left — click to dismiss.');
})();
