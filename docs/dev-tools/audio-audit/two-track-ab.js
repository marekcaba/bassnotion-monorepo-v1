/**
 * TWO-TRACK A/B + LAYER SOLO — diagnose the two-track drum engine by ear.
 *
 * Three independent controls:
 *   • TWO-TRACK ON/OFF  — new pre-rendered tracks vs legacy live per-hit overlays.
 *   • BED on/off        — the stretched notched texture track (mutes via muteBed).
 *   • BIG HITS on/off   — the re-gridded bit-exact kick/snare track (mutes via
 *                         muteOverlays).
 *
 * So you can hear: BED alone (is the texture clean / no kicks leaking?), BIG HITS
 * alone (are the kicks/snares present, in the right place, full punch?), or both
 * (do they glue?). This is how we find what's "not working properly".
 *
 * USE: groove card → START → settle to a slow tempo (nudge down ~10 BPM, into the
 *   BED). Paste this. A panel appears (bottom-left). Toggle the layers and listen.
 *
 * Mapping (the engine's diagnostic solo):
 *   BED on,  HITS on  → both (normal)
 *   BED on,  HITS off → bed only      (muteOverlays = true)
 *   BED off, HITS on  → big hits only (muteBed = true)
 *   BED off, HITS off → silence
 */
(() => {
  const eng =
    window.__bassnotion_playbackEngine ||
    window.__bassnotion_serviceRegistry?.getPlaybackEngine?.();
  if (
    !eng ||
    typeof eng.setDrumTwoTrack !== 'function' ||
    typeof eng.setDrumDiagnosticSolo !== 'function' ||
    typeof eng.getDrumTempoDebugState !== 'function'
  ) {
    console.warn(
      '[two-track-ab] engine not ready — start the groove first, then re-paste.',
    );
    return;
  }
  document.getElementById('bn-twotrack-ab')?.remove();

  const state = { twoTrack: true, bed: true, hits: true };

  const wrap = document.createElement('div');
  wrap.id = 'bn-twotrack-ab';
  wrap.style.cssText =
    'position:fixed;bottom:16px;left:16px;z-index:99999;background:rgba(16,20,30,.96);' +
    'color:#eee;font:12px/1.4 system-ui;padding:12px 14px;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.55);backdrop-filter:blur(6px);width:300px';
  wrap.innerHTML =
    '<div style="font-weight:600;margin-bottom:8px">two-track — layer solo</div>' +
    '<button id="bn-tt-engine" style="width:100%;padding:9px;font:13px system-ui;cursor:pointer;border-radius:6px;border:0;margin-bottom:8px"></button>' +
    '<div style="display:flex;gap:6px">' +
    '<button id="bn-tt-bed" style="flex:1;padding:9px;font:13px system-ui;cursor:pointer;border-radius:6px;border:0"></button>' +
    '<button id="bn-tt-hits" style="flex:1;padding:9px;font:13px system-ui;cursor:pointer;border-radius:6px;border:0"></button>' +
    '</div>' +
    '<div id="bn-tt-state" style="margin-top:8px;font:600 13px ui-monospace,monospace;text-align:center"></div>' +
    '<div id="bn-tt-info" style="margin-top:2px;font:11px ui-monospace,monospace;text-align:center;opacity:.7"></div>' +
    '<div style="opacity:.6;margin-top:8px">Settle into the BED (slow tempo). Solo BED (is texture clean, no kicks?) ' +
    'and BIG HITS (kicks present + placed right?). Then both. Nudge to test spill.</div>';
  document.body.appendChild(wrap);

  const engineBtn = wrap.querySelector('#bn-tt-engine');
  const bedBtn = wrap.querySelector('#bn-tt-bed');
  const hitsBtn = wrap.querySelector('#bn-tt-hits');
  const stateEl = wrap.querySelector('#bn-tt-state');
  const infoEl = wrap.querySelector('#bn-tt-info');

  const apply = () => {
    eng.setDrumTwoTrack(state.twoTrack);
    // BED off → muteBed; HITS off → muteOverlays.
    eng.setDrumDiagnosticSolo({ muteBed: !state.bed, muteOverlays: !state.hits });
    engineBtn.textContent = state.twoTrack
      ? 'TWO-TRACK ON ✓'
      : 'LIVE OVERLAYS (legacy)';
    engineBtn.style.background = state.twoTrack ? '#2e7d4f' : '#8a5a1f';
    engineBtn.style.color = '#fff';
    bedBtn.textContent = state.bed ? 'BED ✓' : 'BED off';
    bedBtn.style.background = state.bed ? '#1e4e7a' : '#333';
    bedBtn.style.color = '#fff';
    hitsBtn.textContent = state.hits ? 'BIG HITS ✓' : 'HITS off';
    hitsBtn.style.background = state.hits ? '#7a2e2e' : '#333';
    hitsBtn.style.color = '#fff';
    // eslint-disable-next-line no-console
    console.log('[two-track-ab]', JSON.stringify(state));
  };
  engineBtn.addEventListener('click', () => {
    state.twoTrack = !state.twoTrack;
    apply();
  });
  bedBtn.addEventListener('click', () => {
    state.bed = !state.bed;
    apply();
  });
  hitsBtn.addEventListener('click', () => {
    state.hits = !state.hits;
    apply();
  });

  const COLORS = {
    SLICES: '#d0a020',
    XFADE_TO_BED: '#6aa0d0',
    BED: '#3fa05f',
    XFADE_TO_SLICES: '#d08050',
  };
  const tick = () => {
    if (!wrap.isConnected) return;
    const s = eng.getDrumTempoDebugState?.();
    if (s) {
      stateEl.textContent = s.mode;
      stateEl.style.color = COLORS[s.mode] ?? '#eee';
      const pct = (s.ratio - 1) * 100;
      infoEl.textContent =
        `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` +
        `  ·  ${s.twoTrack ? 'two-track' : 'live'}` +
        `  ·  bed ${s.bedReady ? '✓' : '…'} hits ${s.hitsReady ? '✓' : '…'}`;
    } else {
      stateEl.textContent = '(no drums armed)';
      infoEl.textContent = '';
    }
    requestAnimationFrame(tick);
  };
  apply();
  tick();
  // eslint-disable-next-line no-console
  console.log('[two-track-ab] ready — solo BED / BIG HITS to diagnose by ear.');
})();
