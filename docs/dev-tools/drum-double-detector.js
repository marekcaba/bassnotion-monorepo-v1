/**
 * Kick/snare DOUBLE detector — finds audibly-doubled hits in the live output.
 *
 * Paste into the DevTools console on the Groove Card page while PLAYING and
 * SLOWED (e.g. 94 BPM). It records the real drum output and looks for the thing
 * you actually hear: a strong hit followed by a SECOND peak shortly after that
 * isn't a real onset — a "double." For each protected (overlaid) hit it checks
 * whether there's a phantom peak 30–300ms later, reports its level relative to
 * the main hit, and draws the output zoomed on the doublers.
 *
 * No folding, no phase-alignment guesswork — it just reads the waveform and
 * flags echoes. Restores nothing (listen-only).
 */
(async () => {
  const eng = window.__bassnotion_playbackEngine;
  const sp = eng && eng.drumSlicePlayer;
  if (!sp) return console.warn('[double] No drum player. Press play first.');
  const ctx = sp.ctx, out = sp.output, sr = ctx.sampleRate;
  const ratio = sp.ratio || 1;
  if (Math.abs(ratio - 1) < 1e-3)
    return console.warn('[double] ratio≈1 — slow down first.');

  const loopRealS = sp.loopDuration / ratio;
  const captureS = Math.min(11, loopRealS * 2.2 + 0.3);
  console.log(`[double] ratio=${ratio.toFixed(3)} loop=${loopRealS.toFixed(2)}s capture=${captureS.toFixed(1)}s`);

  // record live output
  const cap = await new Promise((res) => {
    const chunks = []; let got = 0; const need = Math.ceil(captureS * sr);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (e) => {
      const ch = e.inputBuffer.getChannelData(0); const s = new Float32Array(ch.length);
      s.set(ch); chunks.push(s); got += ch.length; e.outputBuffer.getChannelData(0).fill(0);
      if (got >= need) {
        try { out.disconnect(node); } catch {} try { node.disconnect(); } catch {}
        const all = new Float32Array(got); let o = 0;
        for (const c of chunks) { all.set(c, o); o += c.length; } res(all);
      }
    };
    out.connect(node); node.connect(ctx.destination);
  });

  // energy envelope + peak pick
  const win = Math.round(0.004 * sr), hop = Math.round(0.002 * sr);
  const fr = [];
  for (let s = 0; s + win < cap.length; s += hop) {
    let a = 0; for (let i = 0; i < win; i++) a += cap[s + i] * cap[s + i];
    fr.push({ t: (s + win / 2) / sr, e: Math.sqrt(a / win) });
  }
  let mx = 0; for (const f of fr) if (f.e > mx) mx = f.e;
  const peaks = [];
  const thr = mx * 0.12; let last = -1;
  for (let i = 1; i < fr.length - 1; i++) {
    const f = fr[i];
    if (f.e > thr && f.e >= fr[i - 1].e && f.e > fr[i + 1].e && f.t - last > 0.03) {
      peaks.push({ t: f.t, e: f.e }); last = f.t;
    }
  }

  // A "double" = a peak that follows a LOUDER peak within [minGap,maxGap] and is
  // a decent fraction of it (i.e. an echo of that hit, not the next real hit).
  const minGap = 0.03, maxGap = 0.30, minRel = 0.18;
  const doubles = [];
  for (let i = 1; i < peaks.length; i++) {
    const cur = peaks[i];
    // find the nearest LOUDER preceding peak within maxGap
    for (let j = i - 1; j >= 0; j--) {
      const prev = peaks[j];
      const gap = cur.t - prev.t;
      if (gap > maxGap) break;
      if (gap >= minGap && prev.e >= cur.e && cur.e >= prev.e * minRel) {
        doubles.push({
          afterMs: +(prev.t * 1000).toFixed(0),
          gapMs: +(gap * 1000).toFixed(0),
          mainLevel: +prev.e.toFixed(3),
          echoLevel: +cur.e.toFixed(3),
          echoPct: +((cur.e / prev.e) * 100).toFixed(0),
        });
        break;
      }
    }
  }
  console.log(`[double] peaks=${peaks.length}  DOUBLES found=${doubles.length}`);
  console.table(doubles);
  if (doubles.length) {
    const avg = doubles.reduce((s, d) => s + d.echoPct, 0) / doubles.length;
    const avgGap = doubles.reduce((s, d) => s + d.gapMs, 0) / doubles.length;
    console.log(`[double] avg echo = ${avg.toFixed(0)}% of the main hit, ~${avgGap.toFixed(0)}ms after it.`);
    console.log(`[double] → ${doubles.length} doubled hits in ${captureS.toFixed(0)}s. Gap ~${avgGap.toFixed(0)}ms is what you hear as the second kick.`);
  } else {
    console.log('[double] No doublers detected at this threshold. (Try a slower tempo, or echo may be subtler than 18%.)');
  }

  // ---- draw: full output envelope, peaks marked, doubles in red ----
  const N = 1600;
  const e2 = new Float32Array(N); const bin = cap.length / N;
  for (let p = 0; p < N; p++) { let m = 0; const s = Math.floor(p * bin), en = Math.floor((p + 1) * bin); for (let i = s; i < en; i++) { const v = Math.abs(cap[i]); if (v > m) m = v; } e2[p] = m; }
  const W = 1500, H = 240, pad = 30;
  document.getElementById('dbl-canvas')?.remove();
  const cv = document.createElement('canvas'); cv.id = 'dbl-canvas'; cv.width = W; cv.height = H;
  Object.assign(cv.style, { position: 'fixed', left: '12px', top: '12px', zIndex: 2147483600, background: '#0c0c10', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,.6)' });
  cv.onclick = () => cv.remove(); document.body.appendChild(cv);
  const c = cv.getContext('2d'); c.fillStyle = '#0c0c10'; c.fillRect(0, 0, W, H); c.font = '11px ui-monospace, monospace';
  const innerW = W - 2 * pad, dur = cap.length / sr;
  c.strokeStyle = '#9be9a8'; c.beginPath();
  for (let p = 0; p < N; p++) { const x = pad + (p / N) * innerW; const v = e2[p]; c.moveTo(x, pad + 90 - v * 80); c.lineTo(x, pad + 90 + v * 80); }
  c.stroke();
  // all peaks faint, doubles red
  c.strokeStyle = 'rgba(120,120,140,0.5)';
  for (const pk of peaks) { const x = pad + (pk.t / dur) * innerW; c.beginPath(); c.moveTo(x, pad); c.lineTo(x, pad + 180); c.stroke(); }
  c.strokeStyle = '#ef4444';
  for (const d of doubles) { const x = pad + ((d.afterMs / 1000 + d.gapMs / 1000) / dur) * innerW; c.beginPath(); c.moveTo(x, pad); c.lineTo(x, pad + 180); c.stroke(); }
  c.fillStyle = '#aaa'; c.fillText('Live drum output — gray = all peaks · RED = doubled hits (echo of a louder hit)', pad, pad - 12);
  c.fillStyle = '#888'; c.fillText(`${doubles.length} doubles detected · click to close`, pad, H - 8);
  console.log('[double] canvas top-left. Click to dismiss.');
})();
