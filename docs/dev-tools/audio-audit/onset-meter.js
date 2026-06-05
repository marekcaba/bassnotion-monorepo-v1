/**
 * onset-meter.js — count-in ↔ stem ALIGNMENT MEASUREMENT (dev-only).
 *
 * THE PROBLEM: on the count-in's "beat 5" there is T0, and every track (the 4
 * count-in clicks, then bass/harmony/drums) should be HEARD landing on the
 * grid: click n at T0 − (4−n)·beat, and all 3 stems' first sample AT T0.
 * Models kept disagreeing with the ear, so this measures the REAL audio.
 *
 * HOW: taps each track's actual output GainNode with an AnalyserNode and records
 * the AudioContext time of the first frame whose RMS crosses a threshold — i.e.
 * the true audible onset of each track, through its real signal path (signalsmith
 * worklet latency, drum slice player, WAM click — everything). Then prints a
 * table of each onset vs T0 (the ideal downbeat) and vs each click.
 *
 * USE:
 *   1. Open the groove card, let it sit ~10s (so signalsmith latency() refines
 *      and the worklet warms — the first play after a restart is unreliable).
 *   2. Paste this whole file into the DevTools console. It auto-finds the engine.
 *   3. Press PLAY. The meter arms taps on press, listens through the count-in +
 *      first ~2 loop iterations, then prints the report (also returns it on
 *      window.__onsetReport for copy-out).
 *   4. Copy the printed "REPORT JSON" block back to the dev so it can be diffed
 *      against the scheduler's intended times.
 *
 * No audio is altered — analysers are silent taps (no output connected).
 */
(() => {
  const E = window.__bassnotion_playbackEngine;
  const ctx =
    window.__bassnotion_audioContext || window.__persistentAudioContext;
  const cs = window.__globalCoreServices;
  if (!E || !ctx) {
    console.warn(
      '[onset-meter] engine/context not found — start the app + groove first.',
    );
    return;
  }
  document.getElementById('bn-onset-meter')?.remove();

  // ── per-track output taps (paths verified against PlaybackEngine) ──────────
  const gains = () => ({
    bass: E.instrumentGainNodes?.get?.('audio-bass') || null,
    harmony: E.instrumentGainNodes?.get?.('audio-harmony') || null,
    drums: E.instrumentGainNodes?.get?.('audio-drums') || null,
    // The metronome lives on a SEPARATE WAM/Tone graph, not the engine master,
    // and its node isn't reliably reachable. Instead we capture the click
    // SCHEDULED times straight off the EventBus 'metronome-trigger' events
    // (the WAM click is zero-latency, so scheduled time == audible time). See
    // captureClicksViaEventBus() below.
    click: null,
  });

  // Click times via EventBus: subscribe to 'metronome-trigger' and record the
  // audioTime each click is scheduled at. Works regardless of how the WAM node
  // is wired. Returns a getter for the collected times.
  const clickTimes = [];
  let clickUnsub = null;
  function captureClicksViaEventBus() {
    const bus =
      cs?.getEventBus?.() ||
      cs?.eventBus ||
      window.__bassnotion_eventBus ||
      null;
    if (!bus?.on && !bus?.subscribe) return false;
    const handler = (payload) => {
      // payload.time / payload.audioTime is the scheduled audio-ctx time.
      const t = payload?.audioTime ?? payload?.time ?? payload?.scheduledTime;
      if (typeof t === 'number') clickTimes.push(t);
    };
    if (bus.on) {
      bus.on('metronome-trigger', handler);
      clickUnsub = () => bus.off?.('metronome-trigger', handler);
    } else {
      const sub = bus.subscribe('metronome-trigger', handler);
      clickUnsub = () => sub?.unsubscribe?.();
    }
    return true;
  }

  const RMS_THRESHOLD = 0.003; // onset = first frame above this (silence floor)
  const POLL_MS = 5;

  // ── onset detector: silent AnalyserNode tap + RMS poll ─────────────────────
  function makeOnsetTap(node, label) {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    const buf = new Float32Array(analyser.fftSize);
    try {
      node.connect(analyser); // analyser has no output → silent tap
    } catch (e) {
      return { label, error: 'connect failed: ' + e.message };
    }
    const rec = { label, onset: null, peakRms: 0, node };
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      if (rms > rec.peakRms) rec.peakRms = rms;
      if (rec.onset === null && rms > RMS_THRESHOLD) {
        rec.onset = ctx.currentTime;
      }
    };
    rec._stop = () => {
      try {
        node.disconnect(analyser);
      } catch {}
    };
    rec._tick = tick;
    return rec;
  }

  // ── click onset capture: clicks share ONE node, so record EVERY crossing ───
  function makeClickTap(node, label) {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const buf = new Float32Array(analyser.fftSize);
    try {
      node.connect(analyser);
    } catch (e) {
      return { label, error: 'connect failed: ' + e.message };
    }
    const rec = { label, onsets: [], peakRms: 0, node, _armed: true };
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      if (rms > rec.peakRms) rec.peakRms = rms;
      // Re-arm on silence so each discrete click registers once.
      if (rms > RMS_THRESHOLD && rec._armed) {
        rec.onsets.push(ctx.currentTime);
        rec._armed = false;
      } else if (rms < RMS_THRESHOLD * 0.3) {
        rec._armed = true;
      }
    };
    rec._stop = () => {
      try {
        node.disconnect(analyser);
      } catch {}
    };
    rec._tick = tick;
    return rec;
  }

  // ── small floating UI ──────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.id = 'bn-onset-meter';
  wrap.style.cssText =
    'position:fixed;bottom:16px;left:16px;z-index:99999;background:rgba(10,12,20,.95);' +
    'color:#dfe;font:12px/1.5 ui-monospace,monospace;padding:12px 14px;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.6);max-width:520px;white-space:pre';
  wrap.textContent =
    '[onset-meter] armed. Press PLAY now.\nWaiting for transport start…';
  document.body.appendChild(wrap);

  let taps = null;
  let clickTap = null;
  let pollId = null;
  let started = false;
  let T0 = 0;
  let transportStartTime = 0;
  let bpm = 0;
  let beat = 0;
  let countdownBeats = 0;

  function armTaps() {
    const g = gains();
    taps = {
      bass: g.bass ? makeOnsetTap(g.bass, 'bass') : { label: 'bass', error: 'no gain node' },
      harmony: g.harmony
        ? makeOnsetTap(g.harmony, 'harmony')
        : { label: 'harmony', error: 'no gain node' },
      drums: g.drums
        ? makeOnsetTap(g.drums, 'drums')
        : { label: 'drums', error: 'no gain node' },
    };
    clickTap = g.click
      ? makeClickTap(g.click, 'click')
      : { label: 'click', error: 'no metronome node' };
  }

  function report() {
    const fmt = (t) => (t == null ? '   —   ' : t.toFixed(4));
    const vsT0 = (t) =>
      t == null ? '   —   ' : ((t - T0) * 1000).toFixed(1) + 'ms';
    const lines = [];
    lines.push('═══ ONSET MEASUREMENT ═══');
    lines.push(
      `bpm=${bpm.toFixed(2)} beat=${beat.toFixed(4)}s countdownBeats=${countdownBeats}`,
    );
    lines.push(
      `transportStartTime=${transportStartTime.toFixed(4)}  T0(beat5)=${T0.toFixed(4)}`,
    );
    lines.push('');
    lines.push('track     audibleOnset   vs T0(beat5)');
    const stemRows = [];
    for (const k of ['drums', 'bass', 'harmony']) {
      const r = taps[k];
      if (r.error) {
        lines.push(`${k.padEnd(9)} ERROR: ${r.error}`);
      } else {
        lines.push(
          `${k.padEnd(9)} ${fmt(r.onset)}     ${vsT0(r.onset)}  (peak ${r.peakRms.toFixed(3)})`,
        );
        stemRows.push({ track: k, onset: r.onset, vsT0ms: r.onset == null ? null : (r.onset - T0) * 1000 });
      }
    }
    lines.push('');
    // Clicks: expected at T0 − (countdownBeats−n)·beat for n=1..countdownBeats.
    const clickRows = [];
    if (clickTap.error) {
      lines.push(`clicks    ERROR: ${clickTap.error}`);
    } else {
      lines.push('click#  audibleOnset   expected      err');
      clickTap.onsets.forEach((t, i) => {
        const expected = T0 - (countdownBeats - (i + 1)) * beat;
        const err = ((t - expected) * 1000).toFixed(1);
        lines.push(
          `  ${i + 1}     ${fmt(t)}     ${fmt(expected)}   ${err}ms`,
        );
        clickRows.push({ click: i + 1, onset: t, expected, errMs: (t - expected) * 1000 });
      });
      // The implied beat-5 = last click + 1 beat; that's where stems SHOULD land.
      const last = clickTap.onsets[clickTap.onsets.length - 1];
      if (last != null) {
        const beat5 = last + beat;
        lines.push('');
        lines.push(
          `last click + 1 beat = ${beat5.toFixed(4)} (this is where stems should land; T0=${T0.toFixed(4)})`,
        );
      }
    }
    lines.push('');
    lines.push('REPORT JSON (copy this back):');
    const json = {
      bpm,
      beat,
      countdownBeats,
      transportStartTime,
      T0,
      stems: stemRows,
      clicks: clickRows,
    };
    lines.push(JSON.stringify(json));
    wrap.textContent = lines.join('\n');
    // eslint-disable-next-line no-console
    console.log('%c[onset-meter] REPORT', 'font-weight:bold', json);
    window.__onsetReport = json;
  }

  // ── main loop: detect transport start, arm taps, listen, then report ───────
  let listenUntil = Infinity;
  const loop = () => {
    const tst = E.getTransportStartTime?.() || 0;
    if (!started && tst > 0) {
      started = true;
      transportStartTime = tst;
      // Prefer the live Tone.Transport BPM (authoritative); fall back to the
      // engine mirror. They should agree once start() has synced.
      const Tone = window.Tone || window.__globalTone;
      const toneBpm = Tone?.getTransport?.()?.bpm?.value;
      bpm = toneBpm || E.currentTempo || 120;
      countdownBeats = E.countdownBeats || 4;
      beat = 60 / bpm;
      T0 = transportStartTime + countdownBeats * beat;
      armTaps();
      // Listen through the count-in + ~2 loop iterations, then report.
      const loopLen = (E.stemLoopDurationSeconds || countdownBeats * beat) * 2;
      listenUntil = T0 + loopLen + 0.5;
      wrap.textContent =
        `[onset-meter] STARTED. T0=${T0.toFixed(4)}\nlistening until ${listenUntil.toFixed(2)}…`;
    }
    if (started) {
      for (const k of ['bass', 'harmony', 'drums']) taps[k]?._tick?.();
      clickTap?._tick?.();
      if (ctx.currentTime >= listenUntil) {
        clearInterval(pollId);
        for (const k of ['bass', 'harmony', 'drums']) taps[k]?._stop?.();
        clickTap?._stop?.();
        report();
      }
    }
  };
  pollId = setInterval(loop, POLL_MS);

  // eslint-disable-next-line no-console
  console.log(
    '[onset-meter] armed. Press PLAY. Report prints after the count-in + 2 loops.',
  );
  // Manual stop/report if you want it early:
  window.__onsetMeterStop = () => {
    clearInterval(pollId);
    if (started) {
      for (const k of ['bass', 'harmony', 'drums']) taps[k]?._stop?.();
      clickTap?._stop?.();
      report();
    }
  };
})();
