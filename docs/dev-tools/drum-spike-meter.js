  /**
   * Drum output SPIKE METER — empirical before/after on the REAL playback audio.
   *
   * Paste into the DevTools console on the Groove Card page
   * (http://localhost:3001/app/tutorials/test-groove-2?drumadmin=1) while the
   * groove is PLAYING and SLOWED to the tempo you want to inspect (e.g. 94 BPM).
   *
   * It taps the LIVE drum gain node (sp.output) with a recorder and captures the
   * ACTUAL rendered audio — bed + transient overlays, exactly what you hear — for
   * a couple of loops, FIRST with the body-notch fix ON (bedTransientNotch=1) and
   * THEN with it OFF (=0). For each capture it:
   *   - finds every output peak (onset) via a simple energy/threshold detector,
   *   - classifies each peak as ON-GRID (near where a real hit should be, ±35ms)
   *     or a SPIKE (a transient between the grid hits — a doubled body),
   *   - reports spike count, total spike energy, and the peak-crest factor.
   *
   * The verdict is the SPIKE count + spike energy: FIX ON should have far fewer /
   * quieter spikes than FIX OFF. Restores your live notch setting afterward.
   *
   * NOTE: it changes the notch live and waits a beat for the bed to rebuild, so
   * the groove will audibly shift during the test — that's expected.
   */
  (async () => {
    const eng = window.__bassnotion_playbackEngine;
    const sp = eng && eng.drumSlicePlayer;
    if (!sp) return console.warn('[spike] No drum player. Press play first.');
    const ctx = sp.ctx;
    const out = sp.output; // drum gain — everything flows through here
    const sr = ctx.sampleRate;
    const ratio = sp.ratio || 1;
    if (Math.abs(ratio - 1) < 1e-3)
      return console.warn('[spike] ratio≈1 — slow the tempo down first.');

    const loopRealS = sp.loopDuration / ratio; // one stretched loop, seconds
    const captureS = Math.min(8, loopRealS * 1.5 + 0.3); // ~1.5 loops
    const liveNotch = sp.bedTransientNotch;

    // Expected grid: every STRONG hit, at its stretched real-time position, folded
    // into the capture (it repeats each loop). Used to classify on-grid vs spike.
    // GRID = ALL detected onsets (every real hit, not just the loud "strong" ones),
    // so a "spike" is a peak that's near NO real hit — a genuine phantom. (Using
    // only strong hits mislabels every medium hit as a spike.)
    const onsets = sp.onsets;
    const grid = onsets.map((t) => t / ratio); // every real onset, stretched s
    const strong = sp.strongIndices.map((i) => onsets[i] / ratio); // for the draw
    const conf = sp.confidences || [];
    const protectedSet = new Set(sp.strongIndices);
    console.log(
      `[spike] onsets=${onsets.length}  protected(strong, threshold ${(sp.strongConfidenceThreshold * 100) | 0}%)=${sp.strongIndices.length}  ` +
        `→ ${onsets.length - sp.strongIndices.length} hits ride the bed UNPROTECTED`,
    );

    // ---- recorder: ScriptProcessor tap (deterministic sample capture) ----
    function record(seconds) {
      return new Promise((resolve) => {
        const buf = [];
        const node = ctx.createScriptProcessor(2048, 1, 1);
        let got = 0;
        const need = Math.ceil(seconds * sr);
        node.onaudioprocess = (e) => {
          const ch = e.inputBuffer.getChannelData(0);
          const slice = new Float32Array(ch.length);
          slice.set(ch);
          buf.push(slice);
          got += ch.length;
          // pass-through silence to keep the node pulled
          e.outputBuffer.getChannelData(0).fill(0);
          if (got >= need) {
            try { out.disconnect(node); } catch {}
            try { node.disconnect(); } catch {}
            const all = new Float32Array(got);
            let o = 0;
            for (const s of buf) { all.set(s, o); o += s.length; }
            resolve(all);
          }
        };
        out.connect(node);
        node.connect(ctx.destination); // SP needs a sink; we output silence
      });
    }

    // ---- onset/peak detector on a captured signal ----
    function detectPeaks(sig) {
      // short-time energy, then pick local maxima above an adaptive threshold
      const win = Math.round(0.005 * sr);
      const hop = Math.round(0.0025 * sr);
      const frames = [];
      for (let s = 0; s + win < sig.length; s += hop) {
        let acc = 0;
        for (let i = 0; i < win; i++) acc += sig[s + i] * sig[s + i];
        frames.push({ t: (s + win / 2) / sr, e: Math.sqrt(acc / win) });
      }
      let maxE = 0;
      for (const f of frames) if (f.e > maxE) maxE = f.e;
      const thr = maxE * 0.18; // peak if above 18% of loudest
      const minGap = 0.04; // 40ms debounce
      const peaks = [];
      let last = -1;
      for (let i = 1; i < frames.length - 1; i++) {
        const f = frames[i];
        if (
          f.e > thr &&
          f.e >= frames[i - 1].e &&
          f.e > frames[i + 1].e &&
          f.t - last > minGap
        ) {
          peaks.push({ t: f.t, e: f.e });
          last = f.t;
        }
      }
      return { peaks, maxE };
    }

    // classify each output peak vs the FULL onset grid (every real hit), folded
    // per loop. A peak near any real onset (±tol) is on-grid; one near NONE is a
    // SPIKE (a phantom the stretch invented between hits — the doubling artifact).
    function classify(peaks) {
      const tol = 0.035; // 35ms = "on grid"
      let onGrid = 0,
        spikeCount = 0,
        spikeEnergy = 0,
        gridEnergy = 0;
      const spikes = [];
      for (const p of peaks) {
        const phase = ((p.t % loopRealS) + loopRealS) % loopRealS;
        let near = Infinity;
        for (const g of grid) {
          const d = Math.min(
            Math.abs(phase - g),
            Math.abs(phase - g + loopRealS),
            Math.abs(phase - g - loopRealS),
          );
          if (d < near) near = d;
        }
        if (near <= tol) {
          onGrid++;
          gridEnergy += p.e;
        } else {
          spikeCount++;
          spikeEnergy += p.e;
          spikes.push({ atMs: +(p.t * 1000).toFixed(0), level: +p.e.toFixed(4), offGridMs: +(near * 1000).toFixed(0) });
        }
      }
      return { onGrid, spikeCount, spikeEnergy: +spikeEnergy.toFixed(4), gridEnergy: +gridEnergy.toFixed(4), spikes };
    }

    async function measure(notch, label) {
      sp.bedTransientNotch = notch;
      sp.precomputeBedAnalysis();
      sp.resynthesizeBed(true);
      if (sp.playing) sp.restartAtCurrentPhase?.();
      await new Promise((r) => setTimeout(r, 400)); // settle
      const sig = await record(captureS);
      const { peaks, maxE } = detectPeaks(sig);
      const cls = classify(peaks);
      // crest factor of the whole capture (peakiness)
      let peak = 0,
        rmsAcc = 0;
      for (let i = 0; i < sig.length; i++) {
        const a = Math.abs(sig[i]);
        if (a > peak) peak = a;
        rmsAcc += sig[i] * sig[i];
      }
      const rms = Math.sqrt(rmsAcc / sig.length);
      const crest = rms > 1e-9 ? +(peak / rms).toFixed(2) : 0;
      console.log(
        `[spike] ${label}: peaks=${peaks.length} onGrid=${cls.onGrid} ` +
          `SPIKES=${cls.spikeCount} spikeEnergy=${cls.spikeEnergy} ` +
          `(spike/grid=${cls.gridEnergy > 0 ? (cls.spikeEnergy / cls.gridEnergy).toFixed(2) : '∞'}) crest=${crest} peak=${peak.toFixed(3)}`,
      );
      return { label, sig, ...cls, peaks, crest, peak };
    }

    console.log(
      `[spike] ratio=${ratio.toFixed(4)} loop=${loopRealS.toFixed(2)}s capture=${captureS.toFixed(1)}s strongHits=${strong.length} threshold=${(sp.strongConfidenceThreshold * 100) | 0}%`,
    );
    const off = await measure(0, 'FIX OFF (notch 0%)  ');
    const on = await measure(1, 'FIX ON  (notch 100%)');

    console.log('--- SPIKES (off-grid transients) ---');
    console.log('FIX OFF:', JSON.stringify(off.spikes.slice(0, 12)));
    console.log('FIX ON :', JSON.stringify(on.spikes.slice(0, 12)));
    const verdict =
      on.spikeCount < off.spikeCount || on.spikeEnergy < off.spikeEnergy * 0.7
        ? '✅ FIX REDUCES SPIKES'
        : '⚠️ no clear improvement';
    console.log(
      `[spike] VERDICT ${verdict} — spikes ${off.spikeCount}→${on.spikeCount}, spikeEnergy ${off.spikeEnergy}→${on.spikeEnergy}`,
    );

    // ---- draw both captured waveforms with grid + spike marks ----
    const N = 1500;
    const env = (a) => {
      const o = new Float32Array(N);
      const bin = a.length / N;
      for (let p = 0; p < N; p++) {
        let m = 0;
        const s = Math.floor(p * bin),
          e = Math.floor((p + 1) * bin);
        for (let i = s; i < e; i++) { const v = Math.abs(a[i]); if (v > m) m = v; }
        o[p] = m;
      }
      return o;
    };
    const W = 1320,
      H = 360,
      pad = 30;
    document.getElementById('drum-spike-canvas')?.remove();
    const cv = document.createElement('canvas');
    cv.id = 'drum-spike-canvas';
    cv.width = W;
    cv.height = H;
    Object.assign(cv.style, { position: 'fixed', left: '12px', top: '12px', zIndex: 2147483600, background: '#0c0c10', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,.6)' });
    cv.onclick = () => cv.remove();
    document.body.appendChild(cv);
    const c = cv.getContext('2d');
    c.fillStyle = '#0c0c10';
    c.fillRect(0, 0, W, H);
    c.font = '11px ui-monospace, monospace';
    const innerW = W - 2 * pad;
    const drawCap = (cap, y0, h, color, label) => {
      const e = env(cap.sig);
      const dur = cap.sig.length / sr;
      c.strokeStyle = color;
      c.beginPath();
      for (let p = 0; p < N; p++) {
        const x = pad + (p / N) * innerW;
        const v = e[p];
        c.moveTo(x, y0 + h / 2 - (v * h) / 2);
        c.lineTo(x, y0 + h / 2 + (v * h) / 2);
      }
      c.stroke();
      // ALL real onsets (faint green) + protected/strong onsets (bright green),
      // folded across the whole capture.
      for (let loop = 0; loop * loopRealS < dur; loop++) {
        c.strokeStyle = 'rgba(34,197,94,0.25)';
        for (const g of grid) {
          const t = loop * loopRealS + g;
          if (t > dur) continue;
          const x = pad + (t / dur) * innerW;
          c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + h); c.stroke();
        }
        c.strokeStyle = 'rgba(34,197,94,0.85)';
        for (const g of strong) {
          const t = loop * loopRealS + g;
          if (t > dur) continue;
          const x = pad + (t / dur) * innerW;
          c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + h); c.stroke();
        }
      }
      // spikes (red)
      c.strokeStyle = '#ef4444';
      for (const s of cap.spikes) {
        const x = pad + (s.atMs / 1000 / dur) * innerW;
        c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + h); c.stroke();
      }
      c.fillStyle = '#aaa';
      c.fillText(label, pad, y0 + 12);
    };
    drawCap(off, pad, 130, '#e0a106', `FIX OFF — ${off.spikeCount} red spikes between green grid hits`);
    drawCap(on, pad + 150, 130, '#9be9a8', `FIX ON — ${on.spikeCount} red spikes`);
    c.fillStyle = '#888';
    c.fillText(`green = real grid hits · red = off-grid spikes (doubled bodies) · ${verdict} · click to close`, pad, H - 8);

    // restore live notch
    sp.bedTransientNotch = liveNotch;
    sp.precomputeBedAnalysis();
    sp.resynthesizeBed(true);
    if (sp.playing) sp.restartAtCurrentPhase?.();
    console.log('[spike] live notch restored to', (liveNotch * 100) | 0, '%. Canvas top-left.');
  })();
