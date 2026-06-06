/**
 * Engine behavior recorder — paste into the browser console, interact with the
 * groove card freely (tempo, keys, anything), then click "⏹ STOP + DOWNLOAD".
 *
 * Records, focused on DRUM SYNC + STATE MACHINE and AUDIO HEALTH:
 *   • drum mode transitions (SLICES / XFADE_TO_BED / BED / XFADE_TO_SLICES) + ratio
 *   • drum-vs-bass phase delta (the in-sync ground truth) — flags drift
 *   • bed source counts (one-shots + overlays) — flags stacking / accumulation
 *   • drum-stem peak/RMS over time — flags dropouts (silence) and loud spits
 *   • main-thread blocks ('setTimeout handler took …') — flags scheduler stalls
 *   • console errors / exceptions
 * Sampled ~20×/s; transitions logged the instant they happen.
 *
 * USE: start the groove → paste this. A red REC panel appears (top-right). Do your
 * thing. Click STOP → a JSON file downloads (engine-recording-*.json). Send it to
 * me (or paste the on-screen summary) and I'll tell you if it all looks correct.
 */
(() => {
  const eng =
    window.__bassnotion_playbackEngine ||
    window.__bassnotion_serviceRegistry?.getPlaybackEngine?.();
  if (!eng || typeof eng.getDrumTempoDebugState !== 'function') {
    console.warn('[recorder] engine not found — start the groove first, re-paste.');
    return;
  }
  document.getElementById('bn-rec')?.remove();

  const ctx =
    window.__bassnotion_audioContext || window.__persistentAudioContext || eng.audioContext;
  const t0wall = performance.now();
  const log = {
    startedAt: new Date().toISOString(),
    sampleRate: ctx?.sampleRate ?? null,
    samples: [], // periodic snapshots
    events: [], // transitions, key changes, errors, blocks
  };
  const ev = (type, data) =>
    log.events.push({ t: +((performance.now() - t0wall) / 1000).toFixed(3), type, ...data });
  // expose the live log immediately (not just on stop) for debugging / mid-run reads
  window.__bnRecLog = log;

  // ── audio tap (peak/RMS over time) — RETRIES until a node is found, since the
  // drum gain node may not exist yet at paste-time (player arms after play).
  let level = { peak: 0, sumSq: 0, n: 0 };
  let tapState = 'pending';
  let tapTarget = null;
  const rec = ctx ? ctx.createScriptProcessor(2048, 2, 1) : null;
  if (rec) {
    rec.onaudioprocess = (e) => {
      const l = e.inputBuffer.getChannelData(0);
      const r = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : l;
      for (let i = 0; i < l.length; i++) {
        const v = (l[i] + r[i]) / 2;
        const a = Math.abs(v);
        if (a > level.peak) level.peak = a;
        level.sumSq += v * v;
        level.n++;
      }
    };
    try { rec.connect(ctx.destination); } catch {}
  }
  const findDrumNode = () => {
    try {
      // 1) the drum stem gain (preferred — isolates drums)
      const m = eng.instrumentGainNodes;
      if (m?.get) {
        for (const key of ['audio-drums', 'drums', 'audio_drums']) {
          const n = m.get(key);
          if (n) return { node: n, what: 'stem:' + key };
        }
        // any drum-ish key
        for (const [k, n] of m.entries?.() ?? []) {
          if (/drum/i.test(k) && n) return { node: n, what: 'stem:' + k };
        }
      }
    } catch {}
    // 2) fall back to the master bus (full mix — still catches dropouts/spits)
    const mb = eng.masterVolumeGain || eng.masterGain;
    return mb ? { node: mb, what: 'master' } : null;
  };
  const tryAttachTap = () => {
    if (!rec || tapState === 'attached') return;
    const found = findDrumNode();
    if (found) {
      try {
        AudioNode.prototype.connect.call(found.node, rec);
        tapState = 'attached';
        tapTarget = found.what;
        ev('tap', { ok: true, target: found.what });
      } catch (err) {
        ev('tap', { ok: false, reason: String(err) });
      }
    }
  };
  tryAttachTap();
  // keep retrying for the first ~6s until the drum node appears
  const tapRetry = setInterval(() => {
    if (tapState === 'attached') { clearInterval(tapRetry); return; }
    tryAttachTap();
  }, 250);
  setTimeout(() => clearInterval(tapRetry), 6000);

  // ── main-thread block + error capture ──────────────────────────────────────
  const origWarn = console.warn;
  console.warn = function (...a) {
    const s = a.join(' ');
    const m = /handler took (\d+)ms/.exec(s);
    if (m) ev('mainThreadBlock', { ms: +m[1] });
    return origWarn.apply(this, a);
  };
  const origErr = console.error;
  console.error = function (...a) {
    ev('consoleError', { msg: String(a[0]).slice(0, 200) });
    return origErr.apply(this, a);
  };
  const onPageErr = (e) => ev('pageError', { msg: String(e.message).slice(0, 200) });
  window.addEventListener('error', onPageErr);

  // ── periodic sampler ───────────────────────────────────────────────────────
  let lastMode = null;
  let lastSemis = null;
  const readBass = () => {
    try {
      const sg = eng.instrumentStretchNodes?.get?.('audio-bass');
      return typeof sg?.__currentRate === 'number' ? sg.__currentRate : null;
    } catch {
      return null;
    }
  };
  const sample = () => {
    const t = +((performance.now() - t0wall) / 1000).toFixed(3);
    const s = eng.getDrumTempoDebugState?.() ?? {};
    const d = eng.drumSlicePlayer;
    // bed source counts
    let bedOneShots = 0,
      bedOverlays = 0,
      slices = 0;
    try {
      const bb = d?.bedBuffer;
      for (const e of d?.active ?? []) {
        if (e.kind === 'bed') e.src?.buffer === bb ? bedOneShots++ : bedOverlays++;
        else slices++;
      }
    } catch {}
    // drum-vs-bass phase delta
    let drumPhase = null,
      bassPhase = null,
      dPhase = null;
    try {
      const ct = ctx?.currentTime;
      const ip = d?.currentInputPos?.(ct);
      const per = d?.loopPeriod;
      if (ip != null && per != null) drumPhase = ip / (d.ratio || 1) / per;
      bassPhase = eng.getStemPlayheadPhase?.();
      if (drumPhase != null && bassPhase != null)
        dPhase = Math.abs((((drumPhase - bassPhase) % 1) + 1) % 1);
    } catch {}
    // drum semitones (key)
    let semis = null;
    try {
      const sg = eng.instrumentStretchNodes?.get?.('audio-bass');
      semis = typeof sg?.__currentSemitones === 'number' ? sg.__currentSemitones : null;
    } catch {}

    // flush level accumulator
    const lvl = { peak: +level.peak.toFixed(4), rms: +Math.sqrt(level.sumSq / Math.max(1, level.n)).toFixed(4) };
    level = { peak: 0, sumSq: 0, n: 0 };

    log.samples.push({ t, mode: s.mode, ratio: s.ratio != null ? +s.ratio.toFixed(4) : null, bedOneShots, bedOverlays, slices, dPhase: dPhase != null ? +dPhase.toFixed(3) : null, semis, ...lvl });

    if (s.mode !== lastMode) {
      ev('modeChange', { from: lastMode, to: s.mode, ratio: s.ratio != null ? +s.ratio.toFixed(3) : null });
      lastMode = s.mode;
    }
    if (semis !== lastSemis) {
      ev('keyChange', { from: lastSemis, to: semis });
      lastSemis = semis;
    }
  };
  const interval = setInterval(sample, 50);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.id = 'bn-rec';
  wrap.style.cssText =
    'position:fixed;top:16px;right:16px;z-index:99999;background:rgba(40,10,10,.96);' +
    'color:#fee;font:12px/1.4 system-ui;padding:12px 14px;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.6);width:240px;border:1px solid #a33';
  wrap.innerHTML =
    '<div style="font-weight:700;color:#f88">● RECORDING engine</div>' +
    '<div id="bn-rec-live" style="margin-top:6px;font:600 12px ui-monospace,monospace"></div>' +
    '<button id="bn-rec-stop" style="margin-top:8px;width:100%;padding:8px;font:13px system-ui;cursor:pointer;border-radius:6px;border:0;background:#c33;color:#fff;font-weight:700">⏹ STOP + DOWNLOAD</button>' +
    '<div style="opacity:.7;margin-top:6px">Interact with the groove (tempo/keys). Click STOP when done.</div>';
  document.body.appendChild(wrap);
  const live = wrap.querySelector('#bn-rec-live');
  const liveTick = () => {
    const last = log.samples[log.samples.length - 1];
    const tapTxt =
      tapState === 'attached' ? `tap✓ ${tapTarget}` : 'tap… (waiting)';
    if (last)
      live.textContent =
        `${last.mode ?? '?'}  r${last.ratio ?? '?'}\nΔph ${last.dPhase ?? '?'}  beds ${last.bedOneShots}+${last.bedOverlays}\npk ${last.peak}  ${tapTxt}`;
    if (wrap.isConnected) requestAnimationFrame(liveTick);
  };
  liveTick();

  wrap.querySelector('#bn-rec-stop').addEventListener('click', () => {
    clearInterval(interval);
    console.warn = origWarn;
    console.error = origErr;
    window.removeEventListener('error', onPageErr);
    log.endedAt = new Date().toISOString();
    log.durationSec = +((performance.now() - t0wall) / 1000).toFixed(1);
    // on-screen summary
    const modes = {};
    for (const e of log.events) if (e.type === 'modeChange') modes[e.to] = (modes[e.to] || 0) + 1;
    const blocks = log.events.filter((e) => e.type === 'mainThreadBlock');
    const errs = log.events.filter((e) => e.type === 'consoleError' || e.type === 'pageError');
    const maxBeds = Math.max(0, ...log.samples.map((s) => s.bedOneShots));
    const maxDphase = Math.max(0, ...log.samples.map((s) => s.dPhase ?? 0));
    // audio health — only meaningful if the tap attached
    const playing = log.samples.filter((s) => s.mode); // samples while drums armed
    const peaks = playing.map((s) => s.peak).filter((p) => p > 0);
    const medianPeak = peaks.length
      ? [...peaks].sort((a, b) => a - b)[Math.floor(peaks.length / 2)]
      : 0;
    // dropout = a sample near-silent while playing (peak < 8% of median)
    const dropouts = medianPeak
      ? playing.filter((s) => s.peak < medianPeak * 0.08).length
      : 0;
    // loud spit = a peak > 1.8× the median (an abnormal transient)
    const loudSpits = medianPeak
      ? playing.filter((s) => s.peak > medianPeak * 1.8).map((s) => ({ t: s.t, peak: s.peak }))
      : [];
    const summary = {
      durationSec: log.durationSec,
      samples: log.samples.length,
      tap: tapState === 'attached' ? tapTarget : 'FAILED (no audio captured)',
      modeChanges: modes,
      maxConcurrentBedOneShots: maxBeds,
      maxDrumBassPhaseDelta: +maxDphase.toFixed(3),
      mainThreadBlocks: blocks.length,
      blockMs: blocks.map((b) => b.ms),
      errors: errs.length,
      audioHealth: {
        medianPeak: +medianPeak.toFixed(4),
        maxPeak: +Math.max(0, ...peaks).toFixed(4),
        dropoutSamples: dropouts,
        loudSpitCount: loudSpits.length,
        loudSpits: loudSpits.slice(0, 8),
      },
    };
    // eslint-disable-next-line no-console
    console.log('[recorder] SUMMARY:', JSON.stringify(summary, null, 2));
    // download full log
    try {
      const blob = new Blob([JSON.stringify(log)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `engine-recording-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('[recorder] download failed; copy the log from window.__bnRecLog', e);
    }
    window.__bnRecLog = log;
    wrap.querySelector('#bn-rec-live').textContent = 'STOPPED — file downloaded';
    wrap.querySelector('div').textContent = '■ stopped';
    setTimeout(() => wrap.remove(), 4000);
  });

  // eslint-disable-next-line no-console
  console.log('[recorder] recording… interact freely, then click STOP. Full log also at window.__bnRecLog');
})();
