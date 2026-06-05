/**
 * Drum DOUBLE LOCATOR — finds doubled hits and says WHERE each echo comes from.
 *
 * Paste into the DevTools console on the Groove Card page while PLAYING and
 * SLOWED (e.g. 94 BPM). It does NOT count peaks in the mixed output (that was
 * noise). Instead it inspects each drum hit in ISOLATION across the engine's
 * actual signal sources — the raw original loop, the WSOLA bed, and the
 * transient-overlay positions — and for every hit that has a phantom SECOND body
 * it attributes the echo to its source:
 *
 *   ORIGINAL  — the second body is ALSO in the source loop (not the engine's
 *               fault; the recording itself has it).
 *   BED       — WSOLA duplicated the hit's body in the stretched bed (the real
 *               artifact; this is the "doubled kick" you hear).
 *   OVERLAY   — a bit-exact transient overlay landed near the echo time.
 *
 * For each doubled hit it prints: onset, confidence, whether it's protected
 * (overlaid), the echo's offset (ms after the hit) and level, and the SOURCE.
 * Read-only — it analyzes buffers the player already built; it doesn't record or
 * mutate anything.
 */
(async () => {
  const sp = window.__bassnotion_playbackEngine?.drumSlicePlayer;
  if (!sp) return console.warn('[locate] No drum player. Press play first.');
  const sr = sp.buffer.sampleRate;
  const ratio = sp.ratio || 1;
  if (Math.abs(ratio - 1) < 1e-3)
    return console.warn('[locate] ratio≈1 — slow down to inspect a stretch.');

  // make sure the bed is current for this ratio
  if (!sp.bedAnalysis) sp.precomputeBedAnalysis();
  sp.resynthesizeBed(true);
  const bed = sp.bedBuffer ? sp.bedBuffer.getChannelData(0) : null;
  const orig = sp.buffer.getChannelData(0);
  const onsets = sp.onsets, conf = sp.confidences;
  const strong = new Set(sp.strongIndices);
  const body = sp.transientBodySeconds || 0.05;
  const loopOrig = sp.loopDuration;

  console.log(
    `[locate] ratio=${ratio.toFixed(3)} onsets=${onsets.length} protected=${strong.size} body=${(body * 1000) | 0}ms bed=${bed ? 'yes' : 'NO'}`,
  );

  // 5ms-bin peak envelope over [t0,t1) of a channel.
  const STEP = Math.round(0.005 * sr);
  const envWin = (buf, t0, t1) => {
    const a = Math.max(0, Math.round(t0 * sr)), b = Math.min(buf.length, Math.round(t1 * sr));
    const out = [];
    for (let s = a; s < b; s += STEP) {
      let m = 0;
      for (let i = s; i < Math.min(b, s + STEP); i++) { const v = Math.abs(buf[i]); if (v > m) m = v; }
      out.push(m);
    }
    return out;
  };

  // Given an envelope (5ms bins), find a SECOND body: after the main attack
  // decays to a trough, does it rise again to >= rel*peak? Returns the echo's
  // bin offset + level, or null.
  const findEcho = (env, rel = 0.4) => {
    if (!env.length) return null;
    let peak = 0, peakI = 0;
    for (let i = 0; i < Math.min(env.length, 12); i++) if (env[i] > peak) { peak = env[i]; peakI = i; }
    if (peak < 1e-3) return null;
    // find the trough after the attack
    let troughI = peakI, trough = peak;
    for (let i = peakI; i < env.length; i++) {
      if (env[i] < trough) { trough = env[i]; troughI = i; }
      if (env[i] > peak * 0.6 && i > peakI + 3) break; // a clear rise — stop scanning for trough
    }
    if (trough > peak * 0.5) return null; // never really decayed → no distinct echo
    // after the trough, look for a rise back up
    let echo = 0, echoI = -1;
    for (let i = troughI + 1; i < env.length; i++) {
      if (env[i] > echo) { echo = env[i]; echoI = i; }
    }
    if (echoI < 0 || echo < peak * rel) return null;
    if (echo < trough * 1.8) return null; // not a real bump above the floor
    return { offsetMs: echoI * 5, level: +echo.toFixed(3), peak: +peak.toFixed(3), rel: +(echo / peak).toFixed(2) };
  };

  const SPAN = 0.32; // inspect 320ms after each onset
  const rows = [];
  for (let i = 0; i < onsets.length; i++) {
    if ((conf[i] ?? 1) < 0.45) continue; // only hits with real body energy
    const t = onsets[i];
    const origEnv = envWin(orig, t, t + SPAN);
    const origEcho = findEcho(origEnv);
    if (!bed) continue;
    const bt = t / ratio;
    const bedEnv = envWin(bed, bt, bt + SPAN); // same musical span, stretched is fine for shape
    const bedEcho = findEcho(bedEnv);

    // attribute
    let source = '';
    if (bedEcho && !origEcho) source = 'BED'; // engine invented it
    else if (bedEcho && origEcho) {
      // both have an echo — is the bed's noticeably stronger/relatively bigger?
      source = bedEcho.rel > origEcho.rel + 0.12 ? 'BED (amplified)' : 'ORIGINAL';
    } else if (origEcho && !bedEcho) source = 'ORIGINAL (bed cleaned it)';
    else source = ''; // no echo anywhere

    // overlay check: is there a protected hit within ±60ms of the echo's musical time?
    if (bedEcho) {
      const echoMusicalMs = t * 1000 + bedEcho.offsetMs * ratio; // approx orig-time of the echo
      for (let j = 0; j < onsets.length; j++) {
        if (!strong.has(j)) continue;
        if (Math.abs(onsets[j] * 1000 - echoMusicalMs) < 60) { source = 'OVERLAY (hit ' + j + ')'; break; }
      }
    }

    if (bedEcho && source && source !== 'ORIGINAL') {
      rows.push({
        onsetMs: +(t * 1000).toFixed(0),
        conf: +(conf[i]).toFixed(2),
        protected: strong.has(i) ? 'yes' : 'NO',
        echoOffsetMs: bedEcho.offsetMs,
        echoRel: bedEcho.rel,
        SOURCE: source,
      });
    }
  }

  console.log(`[locate] doubled hits found: ${rows.length}`);
  console.table(rows);
  const bySource = {};
  for (const r of rows) { const k = r.SOURCE.split(' ')[0]; bySource[k] = (bySource[k] || 0) + 1; }
  console.log('[locate] by source:', JSON.stringify(bySource));
  const unprotectedBed = rows.filter((r) => r.SOURCE.startsWith('BED') && r.protected === 'NO').length;
  const protectedBed = rows.filter((r) => r.SOURCE.startsWith('BED') && r.protected === 'yes').length;
  console.log(
    `[locate] BED doubles on UNPROTECTED hits=${unprotectedBed} (would be fixed by protecting them), on PROTECTED hits=${protectedBed} (the notch isn't removing the body — real bug).`,
  );
})();
