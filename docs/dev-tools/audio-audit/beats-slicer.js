/**
 * BEATS SLICER — dev panel for the Ableton-"Beats"-style drum engine (2026-06-06).
 *
 * The Beats engine slices the loop at EVERY transient (kick, snare, hats), re-grids
 * each slice un-stretched (rate 1 — transients NEVER smear or pitch-bend), and fills
 * the gap when slowing down by looping each slice's own tail. No bed, no stretcher on
 * drums. This panel lets you:
 *
 *   • Switch engine: BEATS (default) ↔ TWO-TRACK (old notched bed) ↔ SLICES (legacy).
 *     Engine switch applies on the NEXT start — STOP then START the groove to hear it.
 *   • Sensitivity (live slider): how many transients get sliced (Ableton's grey-marker
 *     density). LEFT = more hits/hats sliced (finer, less gap to fill); RIGHT = only big
 *     hits. Re-detects live; watch slices:N update.
 *   • Gap fill (live): PINGPONG (loop tail back-and-forth, best for decay tails) /
 *     FORWARD (REX-style) / GATE (no loop, just fade — leaves natural space).
 *   • Transient Envelope (live slider, 0..1): per-slice decay. 1 = ring naturally;
 *     lower = fade each slice down before the next hit (masks gap seams).
 *   • Loop crossfade (live slider, ms): tail-loop seam smoothness. Short = tight,
 *     long = smoother but blurrier.
 *   • Solo (confidence FILTER, not two tracks): there is ONE slice stream; each slice
 *     has a detected confidence. LOUD = play only the strong slices (kicks/snares);
 *     QUIET = play only the weak slices (hats/ghosts). It's the SAME stream, just
 *     skipping one side of the loudness threshold — to localize what's rushing/leaking.
 *
 * USE: groove card → START → paste this. Panel appears bottom-RIGHT. Nudge the tempo
 * down to ~70 BPM and listen: transients should stay sharp and IN TUNE, hats should
 * NOT rush, drums in sync with bass, drag smooth.
 */
(() => {
  const eng =
    window.__bassnotion_playbackEngine ||
    window.__bassnotion_serviceRegistry?.getPlaybackEngine?.();
  if (!eng || typeof eng.setDrumEngineMode !== 'function') {
    console.warn('[beats] engine not ready — START the groove, then re-paste.');
    return;
  }
  document.getElementById('bn-beats')?.remove();

  const dbg0 = eng.getDrumTempoDebugState?.() || {};
  const state = {
    engine: eng.getDrumEngineMode ? eng.getDrumEngineMode() : 'beats',
    sens: typeof dbg0.sensitivity === 'number' ? dbg0.sensitivity : 0.3,
    gap: dbg0.gapFillMode || 'loop-pingpong',
    env: typeof dbg0.transientEnvelope === 'number' ? dbg0.transientEnvelope : 1,
    xfade: typeof dbg0.loopCrossfadeMs === 'number' ? dbg0.loopCrossfadeMs : 6,
    soloBig: false,
    soloTexture: false,
  };

  const wrap = document.createElement('div');
  wrap.id = 'bn-beats';
  wrap.style.cssText =
    'position:fixed;bottom:16px;right:16px;z-index:99999;background:rgba(14,18,28,.97);' +
    'color:#eee;font:13px/1.45 system-ui;padding:14px;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.55);backdrop-filter:blur(6px);width:300px';
  wrap.innerHTML =
    '<div style="font-weight:600;margin-bottom:10px">drum engine — Beats slicer</div>' +
    '<div style="opacity:.6;font-size:11px;margin-bottom:6px">ENGINE (applies on next START)</div>' +
    '<div id="bn-beats-eng" style="display:flex;gap:6px;margin-bottom:12px"></div>' +
    '<div style="opacity:.6;font-size:11px;margin-bottom:4px">SENSITIVITY ' +
    '<span style="opacity:.5">(left=more hits)</span>' +
    '<span id="bn-beats-sensval" style="float:right;font-family:ui-monospace,monospace"></span></div>' +
    '<input id="bn-beats-sensslider" type="range" min="0" max="120" value="30" ' +
    'style="width:100%;margin-bottom:12px">' +
    '<div style="opacity:.6;font-size:11px;margin-bottom:6px">GAP FILL (live)</div>' +
    '<div id="bn-beats-gap" style="display:flex;gap:6px;margin-bottom:12px"></div>' +
    '<div style="opacity:.6;font-size:11px;margin-bottom:4px">TRANSIENT ENVELOPE ' +
    '<span id="bn-beats-envval" style="float:right;font-family:ui-monospace,monospace"></span></div>' +
    '<input id="bn-beats-envslider" type="range" min="0" max="100" value="100" ' +
    'style="width:100%;margin-bottom:12px">' +
    '<div style="opacity:.6;font-size:11px;margin-bottom:4px">LOOP CROSSFADE ' +
    '<span id="bn-beats-xfval" style="float:right;font-family:ui-monospace,monospace"></span></div>' +
    '<input id="bn-beats-xfslider" type="range" min="1" max="40" value="6" ' +
    'style="width:100%;margin-bottom:12px">' +
    '<div style="opacity:.6;font-size:11px;margin-bottom:6px">SOLO ' +
    '<span style="opacity:.5">(one stream, confidence filter)</span></div>' +
    '<div style="display:flex;gap:6px;margin-bottom:10px">' +
    '<button id="bn-beats-solobig" style="flex:1;padding:11px 6px;font:600 12px system-ui;cursor:pointer;border-radius:7px;border:0"></button>' +
    '<button id="bn-beats-solotex" style="flex:1;padding:11px 6px;font:600 12px system-ui;cursor:pointer;border-radius:7px;border:0"></button>' +
    '</div>' +
    '<div id="bn-beats-info" style="font:11px ui-monospace,monospace;opacity:.7;text-align:center"></div>';
  document.body.appendChild(wrap);

  const mkBtns = (host, items, getActive, onPick) => {
    host.innerHTML = '';
    items.forEach(([val, label]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText =
        'flex:1;padding:9px 4px;font:600 11px system-ui;cursor:pointer;border-radius:7px;border:0;color:#fff';
      b.addEventListener('click', () => onPick(val));
      b.dataset.val = val;
      host.appendChild(b);
    });
    const paint = () => {
      [...host.children].forEach((b) => {
        b.style.background = b.dataset.val === getActive() ? '#2e7d4f' : '#33384a';
      });
    };
    paint();
    return paint;
  };

  const info = wrap.querySelector('#bn-beats-info');
  const envVal = wrap.querySelector('#bn-beats-envval');
  const envSlider = wrap.querySelector('#bn-beats-envslider');
  const sensVal = wrap.querySelector('#bn-beats-sensval');
  const sensSlider = wrap.querySelector('#bn-beats-sensslider');
  const xfVal = wrap.querySelector('#bn-beats-xfval');
  const xfSlider = wrap.querySelector('#bn-beats-xfslider');
  const soloBigBtn = wrap.querySelector('#bn-beats-solobig');
  const soloTexBtn = wrap.querySelector('#bn-beats-solotex');

  const refreshInfo = () => {
    const dbg = eng.getDrumTempoDebugState?.();
    const parts = [`engine:${state.engine}`];
    if (dbg) {
      if ('sliceCount' in dbg) parts.push(`slices:${dbg.sliceCount}`, `ratio:${dbg.ratio?.toFixed?.(3)}`);
      else if ('hitCount' in dbg) parts.push(`hits:${dbg.hitCount}`, `bed:${dbg.bedEngine}`);
    }
    info.textContent = parts.join('  ');
  };

  const paintEng = mkBtns(
    wrap.querySelector('#bn-beats-eng'),
    [
      ['beats', 'BEATS'],
      ['two-track', 'TWO-TRK'],
      ['slices', 'SLICES'],
    ],
    () => state.engine,
    (v) => {
      state.engine = eng.setDrumEngineMode(v);
      paintEng();
      refreshInfo();
      console.log('[beats] engine →', state.engine, '(STOP then START to apply)');
    },
  );

  const paintGap = mkBtns(
    wrap.querySelector('#bn-beats-gap'),
    [
      ['loop-pingpong', 'PINGPONG'],
      ['loop-forward', 'FORWARD'],
      ['gate', 'GATE'],
    ],
    () => state.gap,
    (v) => {
      state.gap = v;
      eng.setDrumGapFillMode?.(v);
      paintGap();
      console.log('[beats] gap fill →', v);
    },
  );

  envSlider.addEventListener('input', () => {
    state.env = envSlider.value / 100;
    envVal.textContent = state.env.toFixed(2);
    eng.setDrumTransientEnvelope?.(state.env);
  });

  sensSlider.addEventListener('input', () => {
    state.sens = sensSlider.value / 100; // 0.00 .. 1.20
    sensVal.textContent = state.sens.toFixed(2);
    eng.setDrumOnsetSensitivity?.(state.sens);
    refreshInfo(); // slice count updates after re-detect
  });

  xfSlider.addEventListener('input', () => {
    state.xfade = Number(xfSlider.value);
    xfVal.textContent = state.xfade + 'ms';
    eng.setDrumLoopCrossfadeMs?.(state.xfade);
  });

  const applySolo = () => {
    // The engine's solo is a confidence filter on ONE slice stream (no tracks):
    //   muteBed      → skip QUIET slices  → LOUD only (kicks/snares)
    //   muteOverlays → skip LOUD slices   → QUIET only (hats/ghosts)
    eng.setDrumDiagnosticSolo?.({
      muteBed: state.soloBig, // LOUD solo = mute the quiet slices
      muteOverlays: state.soloTexture, // QUIET solo = mute the loud slices
    });
    soloBigBtn.textContent = state.soloBig ? 'LOUD ✓' : 'loud slices';
    soloBigBtn.style.background = state.soloBig ? '#8a2e2e' : '#33384a';
    soloBigBtn.style.color = '#fff';
    soloTexBtn.textContent = state.soloTexture ? 'QUIET ✓' : 'quiet slices';
    soloTexBtn.style.background = state.soloTexture ? '#1e5e8a' : '#33384a';
    soloTexBtn.style.color = '#fff';
  };
  soloBigBtn.addEventListener('click', () => {
    state.soloBig = !state.soloBig;
    if (state.soloBig) state.soloTexture = false;
    applySolo();
  });
  soloTexBtn.addEventListener('click', () => {
    state.soloTexture = !state.soloTexture;
    if (state.soloTexture) state.soloBig = false;
    applySolo();
  });

  // Initialize slider positions + labels from the engine's current state.
  envSlider.value = String(Math.round(state.env * 100));
  envVal.textContent = state.env.toFixed(2);
  sensSlider.value = String(Math.round(state.sens * 100));
  sensVal.textContent = state.sens.toFixed(2);
  xfSlider.value = String(Math.round(state.xfade));
  xfVal.textContent = Math.round(state.xfade) + 'ms';
  applySolo();
  refreshInfo();
  setInterval(refreshInfo, 700);
  console.log('[beats] ready — engine:', state.engine, '(default BEATS slicer).');
})();
