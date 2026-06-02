/**
 * Original vs Stretched waveform overlay — how far has each hit drifted?
 *
 * Paste into the DevTools console on the Groove Card page
 * (http://localhost:3001/app/tutorials/test-groove-2?drumadmin=1) while the
 * groove is PLAYING and SLOWED to the tempo you want (e.g. 94 BPM).
 *
 * It captures the REAL rendered drum output (bed + crisp overlays — exactly what
 * you hear) and draws it against the ORIGINAL loop, with the original's time
 * axis SCALED by 1/ratio so a perfect linear stretch would line the two up
 * exactly. Any horizontal gap between an original hit (top) and where the output
 * actually put its energy (bottom) is REAL DRIFT. It marks each original onset,
 * finds the nearest output peak, and reports the per-hit drift in ms + the mean.
 *
 * NOTE: it records a couple of loops of live audio (a few seconds). Nothing is
 * mutated — it only listens.
 */
(async () => {
  const eng = window.__bassnotion_playbackEngine;
  const sp = eng && eng.drumSlicePlayer;
  if (!sp) return console.warn('[wave] No drum player. Press play first.');
  const ctx = sp.ctx;
  const out = sp.output;
  const sr = ctx.sampleRate;
  const ratio = sp.ratio || 1;
  if (Math.abs(ratio - 1) < 1e-3)
    return console.warn('[wave] ratio≈1 — slow the tempo down to compare a stretch.');

  const loopOrigS = sp.loopDuration; // original loop length (s)
  const loopRealS = loopOrigS / ratio; // stretched loop length (s)
  const onsets = sp.onsets; // original onset times (s)
  const strongSet = new Set(sp.strongIndices);

  console.log(
    `[wave] ratio=${ratio.toFixed(4)}  origLoop=${loopOrigS.toFixed(3)}s  stretchedLoop=${loopRealS.toFixed(3)}s  onsets=${onsets.length}`,
  );

  // --- record ~2 stretched loops of the LIVE output ---
  const captureS = Math.min(9, loopRealS * 2 + 0.3);
  const cap = await new Promise((resolve) => {
    const chunks = [];
    const node = ctx.createScriptProcessor(2048, 1, 1);
    let got = 0;
    const need = Math.ceil(captureS * sr);
    node.onaudioprocess = (e) => {
      const ch = e.inputBuffer.getChannelData(0);
      const s = new Float32Array(ch.length);
      s.set(ch);
      chunks.push(s);
      got += ch.length;
      e.outputBuffer.getChannelData(0).fill(0);
      if (got >= need) {
        try { out.disconnect(node); } catch {}
        try { node.disconnect(); } catch {}
        const all = new Float32Array(got);
        let o = 0;
        for (const c of chunks) { all.set(c, o); o += c.length; }
        resolve(all);
      }
    };
    out.connect(node);
    node.connect(ctx.destination);
  });

  // --- align the capture to a loop boundary: find the first strong hit and use
  //     it as t=0 so the original and capture share phase. We fold by loopRealS. ---
  const orig = sp.buffer.getChannelData(0).subarray(0, Math.round(loopOrigS * sr));

  // peak detector on the captured output
  const detect = (sig) => {
    const win = Math.round(0.005 * sr), hop = Math.round(0.0025 * sr);
    const fr = [];
    for (let s = 0; s + win < sig.length; s += hop) {
      let a = 0;
      for (let i = 0; i < win; i++) a += sig[s + i] * sig[s + i];
      fr.push({ t: (s + win / 2) / sr, e: Math.sqrt(a / win) });
    }
    let mx = 0; for (const f of fr) if (f.e > mx) mx = f.e;
    const thr = mx * 0.16; const ps = []; let last = -1;
    for (let i = 1; i < fr.length - 1; i++) {
      const f = fr[i];
      if (f.e > thr && f.e >= fr[i - 1].e && f.e > fr[i + 1].e && f.t - last > 0.04) {
        ps.push(f); last = f.t;
      }
    }
    return ps;
  };
  const outPeaks = detect(cap);

  // CRITICAL: the capture does NOT start at bar-1 — recording begins at a random
  // moment, so the whole peak set is phase-shifted vs the original grid by some
  // constant `phi`. Measuring drift without removing `phi` produces a fake
  // accumulating sawtooth (it's matching the wrong hit). Solve for the phi (in
  // [0,loopRealS)) that MINIMIZES total drift, then measure relative to it — that
  // isolates real per-hit drift from the capture's arbitrary start offset.
  const ideals = onsets.map((t) => t / ratio);
  const phasesOut = outPeaks.map((p) => ((p.t % loopRealS) + loopRealS) % loopRealS);
  const driftFor = (phi) => {
    let tot = 0;
    for (const ideal of ideals) {
      const target = ((ideal + phi) % loopRealS + loopRealS) % loopRealS;
      let near = Infinity;
      for (const ph of phasesOut) {
        const d = Math.min(
          Math.abs(ph - target),
          Math.abs(ph - target + loopRealS),
          Math.abs(ph - target - loopRealS),
        );
        if (d < near) near = d;
      }
      tot += near;
    }
    return tot;
  };
  // coarse scan for the best alignment phi, then refine
  let bestPhi = 0, bestTot = Infinity;
  for (let phi = 0; phi < loopRealS; phi += 0.002) {
    const tot = driftFor(phi);
    if (tot < bestTot) { bestTot = tot; bestPhi = phi; }
  }
  for (let phi = bestPhi - 0.002; phi <= bestPhi + 0.002; phi += 0.0002) {
    const tot = driftFor(phi);
    if (tot < bestTot) { bestTot = tot; bestPhi = phi; }
  }
  console.log(`[wave] aligned capture to grid (phi=${(bestPhi * 1000).toFixed(0)}ms removed)`);

  const rep = onsets.map((t, i) => {
    const ideal = t / ratio;
    const target = ((ideal + bestPhi) % loopRealS + loopRealS) % loopRealS;
    let near = Infinity;
    for (const ph of phasesOut) {
      const d = Math.min(
        Math.abs(ph - target),
        Math.abs(ph - target + loopRealS),
        Math.abs(ph - target - loopRealS),
      );
      if (d < near) near = d;
    }
    return {
      idx: i,
      strong: strongSet.has(i) ? '★' : '',
      origMs: +(t * 1000).toFixed(0),
      idealMs: +(ideal * 1000).toFixed(0),
      driftMs: +(near * 1000).toFixed(0),
    };
  });
  console.table(rep);
  const meanDrift = rep.reduce((s, r) => s + r.driftMs, 0) / rep.length;
  const strongDrift = rep.filter((r) => r.strong).reduce((s, r) => s + r.driftMs, 0) / Math.max(1, rep.filter((r) => r.strong).length);
  console.log(
    `[wave] mean drift (output peak vs ideal linear position): ALL hits=${meanDrift.toFixed(1)}ms  ★strong(overlaid)=${strongDrift.toFixed(1)}ms`,
  );
  console.log('[wave] ★ = a protected (bit-exact overlaid) hit — should be ~0ms. Others ride the bed.');

  // --- draw: ORIGINAL (time ×1/ratio) over OUTPUT, same axis (one stretched loop) ---
  const N = 1500;
  const env = (arr, t0, t1) => {
    const a = Math.max(0, Math.round(t0 * sr)), b = Math.min(arr.length, Math.round(t1 * sr));
    const o = new Float32Array(N);
    const bin = (b - a) / N;
    for (let p = 0; p < N; p++) {
      let m = 0;
      const s = a + Math.floor(p * bin), e = a + Math.floor((p + 1) * bin);
      for (let i = s; i < e; i++) { const v = Math.abs(arr[i]); if (v > m) m = v; }
      o[p] = m;
    }
    return o;
  };
  // original envelope spans [0, loopOrigS]; we plot it across the SAME width as
  // one stretched loop, which IS the ×1/ratio time-scaling.
  const origEnv = env(orig, 0, loopOrigS);
  // Draw the output starting at the alignment point so the waveform sits under
  // the markers. The capture began mid-loop; bestPhi is how far the original
  // grid is offset INTO the capture, so the loop that lines up with the original
  // bar-1 starts at (loopRealS − bestPhi) into the capture.
  const outStart = ((loopRealS - bestPhi) % loopRealS + loopRealS) % loopRealS;
  const outEnv = env(cap, outStart, outStart + loopRealS);

  const W = 1320, H = 360, pad = 30;
  document.getElementById('wsola-compare-canvas')?.remove();
  const cv = document.createElement('canvas');
  cv.id = 'wsola-compare-canvas';
  cv.width = W; cv.height = H;
  Object.assign(cv.style, { position: 'fixed', left: '12px', top: '12px', zIndex: 2147483600, background: '#0c0c10', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,.6)' });
  cv.onclick = () => cv.remove();
  document.body.appendChild(cv);
  const c = cv.getContext('2d');
  c.fillStyle = '#0c0c10'; c.fillRect(0, 0, W, H);
  c.font = '11px ui-monospace, monospace';
  const innerW = W - 2 * pad;

  const draw = (e, y0, h, color, label) => {
    c.strokeStyle = color; c.beginPath();
    for (let p = 0; p < N; p++) {
      const x = pad + (p / N) * innerW; const v = e[p];
      c.moveTo(x, y0 + h / 2 - (v * h) / 2); c.lineTo(x, y0 + h / 2 + (v * h) / 2);
    }
    c.stroke();
    c.fillStyle = '#aaa'; c.fillText(label, pad, y0 + 12);
  };
  draw(origEnv, pad, 130, '#4aa3ff', 'ORIGINAL loop (time ×1/ratio — perfect stretch would line up below)');
  draw(outEnv, pad + 150, 130, '#9be9a8', 'STRETCHED output (bed + crisp overlays — what you hear)');

  // markers: each original onset at its grid-aligned stretched x (ideal + phi),
  // so the lines sit where the measurement actually compared.
  for (const r of rep) {
    const target = (((r.idealMs / 1000) + bestPhi) % loopRealS + loopRealS) % loopRealS;
    const x = pad + (target / loopRealS) * innerW;
    // top: original hit (blue panel)
    c.strokeStyle = r.strong ? 'rgba(34,197,94,0.9)' : 'rgba(74,163,255,0.5)';
    c.beginPath(); c.moveTo(x, pad); c.lineTo(x, pad + 130); c.stroke();
    // bottom: ideal position (green panel) + red if drift > 25ms
    c.strokeStyle = r.driftMs > 25 ? '#ef4444' : (r.strong ? 'rgba(34,197,94,0.9)' : 'rgba(155,233,168,0.5)');
    c.beginPath(); c.moveTo(x, pad + 150); c.lineTo(x, pad + 280); c.stroke();
  }
  c.fillStyle = '#888';
  c.fillText(
    `★ green = protected hits (should align) · blue/faint = bed hits · red = drift >25ms · mean drift all=${meanDrift.toFixed(0)}ms strong=${strongDrift.toFixed(0)}ms · click to close`,
    pad, H - 8,
  );
  console.log('[wave] canvas drawn (top-left). Click to dismiss.');
})();
