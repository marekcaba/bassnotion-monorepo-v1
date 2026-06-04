/**
 * key-record.js — RECORD the bass output to a WAV while you (or a scripted
 * sequence) change KEY and TEMPO the way a real user does: TEMPO clicked ONE BPM
 * AT A TIME (a rapid series of small steps), not big jumps. Exports the WAV +
 * a markers JSON (loop seams, key-change times, every tempo click) so the pitch
 * flips can be lined up against the loop boundary — visually in any audio editor
 * AND offline via docs/dev-tools/audio-audit/key-analyze.mjs.
 *
 * USE: start the groove, KEEP THE TAB FOREGROUNDED, paste this whole file, then:
 *
 *   __keyRec.scripted()   // a hands-off sequence: key jumps + ONE-BPM-AT-A-TIME
 *                         // tempo ramps. Records ~40s, downloads WAV + markers.
 *
 *   __keyRec.manual()     // YOU drive: it starts recording + marking. Click the
 *                         // key/tempo controls in the UI yourself, then call
 *                         // __keyRec.stop() to finish + download. Markers capture
 *                         // your real clicks (it hooks setInstrumentPitchShift +
 *                         // setStretchRatio so every click is timestamped).
 *
 * Then SAVE both files into docs/dev-tools/audio-audit/ (the WAV + the .json) and
 * tell me — I analyze them node-side and you can open the WAV in an editor.
 *
 * NOTE: hard-reload (Cmd+Shift+R) after a frontend restart.
 */
(() => {
  const E = window.__bassnotion_playbackEngine;
  const ctx = E?.audioContext;
  if (!E || !ctx) { console.warn('[key-rec] start the groove + hard-reload first.'); return; }
  for (const m of ['getStemNextSeamTime', 'setInstrumentPitchShift', 'setStretchRatio', 'getStemPlayheadPhase', 'instrumentGainNodes']) {
    if (E[m] == null) { console.warn('[key-rec] engine missing', m, '— hard reload + replay.'); return; }
  }
  const ORIGINAL_BPM = 109;

  const bassGain = () => E.instrumentGainNodes.get('audio-bass') || null;
  const phase = () => E.getStemPlayheadPhase?.();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function paint(t) {
    let w = document.getElementById('bn-key-rec');
    if (!w) {
      w = document.createElement('div');
      w.id = 'bn-key-rec';
      w.style.cssText =
        'position:fixed;top:16px;right:16px;z-index:99999;background:rgba(10,8,16,.96);color:#fec;' +
        'font:11px/1.4 ui-monospace,monospace;padding:12px 14px;border-radius:10px;max-width:560px;white-space:pre;max-height:92vh;overflow:auto';
      document.body.appendChild(w);
    }
    w.textContent = t;
  }

  // ── raw-sample recorder (mono bass) ─────────────────────────────────────────
  let rec = null;
  function startRecorder(node) {
    const sr = ctx.sampleRate;
    const sp = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = []; let total = 0;
    const startCtx = ctx.currentTime;
    sp.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      total += 4096;
      e.outputBuffer.getChannelData(0).fill(0);
    };
    node.connect(sp); sp.connect(ctx.destination);
    return {
      sr, startCtx,
      stop() {
        try { node.disconnect(sp); sp.disconnect(); } catch {}
        const out = new Float32Array(total); let o = 0;
        for (const c of chunks) { out.set(c, o); o += c.length; }
        return out;
      },
    };
  }

  // ── markers: loop seams + every key/tempo change, on the recording clock ────
  const markers = { keyChanges: [], tempoChanges: [], seams: [] };
  let seamWatch = null, lastPhase = null;
  function startSeamWatch() {
    lastPhase = phase();
    seamWatch = setInterval(() => {
      const p = phase(); if (p == null) return;
      if (lastPhase != null && p < lastPhase - 0.5) markers.seams.push(ctx.currentTime);
      lastPhase = p;
    }, 6);
  }

  // Hook the engine calls so manual UI clicks are timestamped too.
  let origPitch = null, origRatio = null;
  function hookEngine() {
    origPitch = E.setInstrumentPitchShift.bind(E);
    origRatio = E.setStretchRatio.bind(E);
    E.setInstrumentPitchShift = (stem, semis, boundary) => {
      if (stem === 'audio-bass') {
        markers.keyChanges.push({ ctx: ctx.currentTime, semis, boundary, seamAtClick: safe(() => E.getStemNextSeamTime()) });
      }
      return origPitch(stem, semis, boundary);
    };
    E.setStretchRatio = (ratio, region) => {
      markers.tempoChanges.push({ ctx: ctx.currentTime, ratio: Math.round(ratio * 1e4) / 1e4, bpm: Math.round(ratio * ORIGINAL_BPM), seamAtClick: safe(() => E.getStemNextSeamTime()) });
      return origRatio(ratio, region);
    };
  }
  function unhookEngine() {
    if (origPitch) E.setInstrumentPitchShift = origPitch;
    if (origRatio) E.setStretchRatio = origRatio;
    origPitch = origRatio = null;
  }
  const safe = (f) => { try { return f(); } catch { return null; } };

  function waitWrap() {
    return new Promise((res) => { let last = phase(); const id = setInterval(() => { const p = phase(); if (p == null) return; if (last != null && p < last - 0.5) { clearInterval(id); res(); } last = p; }, 6); });
  }
  function waitPhase(t) {
    return new Promise((res) => { let last = phase(); const id = setInterval(() => { const p = phase(); if (p == null) return; if (last != null && last < t && p >= t) { clearInterval(id); res(); } last = p; }, 6); });
  }
  const setKey = (s) => { const b = E.getStemNextSeamTime(); E.setInstrumentPitchShift('audio-bass', s, b); E.setInstrumentPitchShift('audio-harmony', s, b); };
  // ONE BPM at a time, like clicking the stepper.
  async function rampTempo(fromBpm, toBpm, perClickMs = 250) {
    const dir = toBpm > fromBpm ? 1 : -1;
    for (let bpm = fromBpm + dir; dir > 0 ? bpm <= toBpm : bpm >= toBpm; bpm += dir) {
      E.setStretchRatio(bpm / ORIGINAL_BPM, 'rec-region');
      await sleep(perClickMs);
    }
  }

  function encodeWav(samples, sr) {
    const buf = new ArrayBuffer(44 + samples.length * 2); const v = new DataView(buf);
    const ws = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, samples.length * 2, true);
    let off = 44; for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2; }
    return new Blob([buf], { type: 'audio/wav' });
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  function finish() {
    if (seamWatch) { clearInterval(seamWatch); seamWatch = null; }
    unhookEngine();
    const samples = rec.stop();
    const sr = rec.sr, start = rec.startCtx;
    const toS = (t) => (t == null ? null : Math.round((t - start) * sr));
    const ts = Math.round(performance.now());
    const base = `key-record-${ts}`;
    download(encodeWav(samples, sr), `${base}.wav`);
    const sidecar = {
      wav: `${base}.wav`, sampleRate: sr, durationSec: Math.round((samples.length / sr) * 100) / 100, originalBpm: ORIGINAL_BPM,
      seam_samples: markers.seams.map(toS),
      keyChanges: markers.keyChanges.map((k) => ({ sample: toS(k.ctx), semis: k.semis, boundary_sample: toS(k.boundary), seamAtClick_sample: toS(k.seamAtClick) })),
      tempoChanges: markers.tempoChanges.map((t) => ({ sample: toS(t.ctx), bpm: t.bpm, ratio: t.ratio, seamAtClick_sample: toS(t.seamAtClick) })),
    };
    download(new Blob([JSON.stringify(sidecar, null, 2)], { type: 'application/json' }), `${base}.json`);
    window.__keyRecMarkers = sidecar;
    paint(
      `[key-rec] DONE — downloaded TWO files:\n  ${base}.wav  (${sidecar.durationSec}s bass audio)\n  ${base}.json (markers)\n\n` +
        `key changes: ${sidecar.keyChanges.length}, tempo clicks: ${sidecar.tempoChanges.length}, seams: ${sidecar.seam_samples.length}\n\n` +
        `→ Move BOTH files into docs/dev-tools/audio-audit/ and tell me the filenames.\n` +
        `  I analyze them node-side; you can also open the WAV in any audio editor\n` +
        `  and see where the pitch flips vs. the loop seams.`,
    );
    // eslint-disable-next-line no-console
    console.log('[key-rec] markers', sidecar);
  }

  async function scripted() {
    const node = bassGain();
    if (!node) { paint('[key-rec] no bass gain node — is it playing?'); return; }
    // settle at key 0 / original tempo
    E.setStretchRatio(1, 'rec-region'); setKey(0);
    await waitWrap(); await waitWrap();

    rec = startRecorder(node);
    startSeamWatch();
    hookEngine();
    paint('[key-rec] recording scripted sequence (key jumps + 1-BPM-at-a-time tempo)…');

    // 1) a couple of plain key jumps at default tempo
    await waitPhase(0.4); setKey(5); await waitWrap(); await waitWrap();
    await waitPhase(0.4); setKey(-3); await waitWrap(); await waitWrap();
    // 2) ramp tempo UP one BPM at a time (109→125), THEN change key mid-ramp
    await waitPhase(0.4); setKey(2);
    await rampTempo(109, 125, 220); // 16 single-BPM clicks during the pending key
    await waitWrap(); await waitWrap();
    // 3) ramp tempo DOWN one BPM at a time (125→95) with a key change partway
    setKey(-5);
    await rampTempo(125, 110, 220);
    await waitPhase(0.5); setKey(4); // key change in the middle of the down-ramp
    await rampTempo(110, 95, 220);
    await waitWrap(); await waitWrap();
    // back to neutral
    await waitPhase(0.4); setKey(0);
    await rampTempo(95, 109, 150);
    await waitWrap();

    E.setStretchRatio(1, 'rec-region');
    finish();
  }

  function manual() {
    const node = bassGain();
    if (!node) { paint('[key-rec] no bass gain node — is it playing?'); return; }
    rec = startRecorder(node);
    startSeamWatch();
    hookEngine();
    paint(
      '[key-rec] RECORDING + MARKING. Now click the KEY and TEMPO controls in the\n' +
        'UI however you like (tempo one BPM at a time is the real pattern). Every\n' +
        'click is timestamped. When done, run:\n\n  __keyRec.stop()\n\n' +
        '…to finish + download the WAV + markers.',
    );
  }
  function stop() { if (rec) finish(); }

  window.__keyRec = { scripted, manual, stop };
  // eslint-disable-next-line no-console
  console.log(
    '[key-rec] ready. Groove playing + tab foregrounded, then:\n' +
      '  __keyRec.scripted()  // hands-off: key jumps + 1-BPM-at-a-time tempo ramps\n' +
      '  __keyRec.manual()    // YOU click the controls; then __keyRec.stop()\n' +
      'Downloads a .wav (bass) + .json (seam/key/tempo markers). Save both into\n' +
      'docs/dev-tools/audio-audit/ and tell me the filenames.',
  );
})();
