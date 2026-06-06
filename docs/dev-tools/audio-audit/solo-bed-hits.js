/**
 * SOLO BED / BIG HITS — independent layer mute for the clean two-track drum engine.
 *
 * Two buttons, each toggles its layer on/off independently:
 *   • BED      = the notched, stretched texture (hats/room — NO kicks, they're
 *                physically removed from this audio).
 *   • BIG HITS = the bit-exact, re-gridded kicks/snares.
 *
 *   BED ✓  HITS ✓  → both (normal playback)
 *   BED ✓  HITS ✗  → bed only      (is the texture clean? no kicks should leak)
 *   BED ✗  HITS ✓  → big hits only (are the kicks present + on the grid?)
 *   BED ✗  HITS ✗  → silence
 *
 * Maps to the engine's setDrumDiagnosticSolo({ muteBed, muteOverlays }):
 *   BED off  → muteBed = true
 *   HITS off → muteOverlays = true
 *
 * USE: groove card → START → paste this. A panel appears (bottom-left). Click to
 *   solo. Works at any tempo (home or nudged).
 */
(() => {
  const eng =
    window.__bassnotion_playbackEngine ||
    window.__bassnotion_serviceRegistry?.getPlaybackEngine?.();
  if (!eng || typeof eng.setDrumDiagnosticSolo !== 'function') {
    console.warn('[solo] engine not ready — start the groove first, re-paste.');
    return;
  }
  document.getElementById('bn-solo-bh')?.remove();

  const state = { bed: true, hits: true, bedSig: true };

  const wrap = document.createElement('div');
  wrap.id = 'bn-solo-bh';
  wrap.style.cssText =
    'position:fixed;bottom:16px;left:16px;z-index:99999;background:rgba(16,20,30,.96);' +
    'color:#eee;font:13px/1.4 system-ui;padding:14px;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.55);backdrop-filter:blur(6px);width:260px';
  wrap.innerHTML =
    '<div style="font-weight:600;margin-bottom:10px">drum layer solo</div>' +
    '<div style="display:flex;gap:8px">' +
    '<button id="bn-solo-bed" style="flex:1;padding:14px 8px;font:600 14px system-ui;cursor:pointer;border-radius:8px;border:0"></button>' +
    '<button id="bn-solo-hits" style="flex:1;padding:14px 8px;font:600 14px system-ui;cursor:pointer;border-radius:8px;border:0"></button>' +
    '</div>' +
    '<button id="bn-solo-bedeng" style="width:100%;margin-top:8px;padding:11px;font:600 13px system-ui;cursor:pointer;border-radius:8px;border:0"></button>' +
    '<div id="bn-solo-info" style="margin-top:10px;font:12px ui-monospace,monospace;text-align:center;opacity:.7"></div>' +
    '<div style="opacity:.55;margin-top:8px;font-size:11px">BED = stretched texture (no kicks). ' +
    'BIG HITS = bit-exact kicks/snares. Bed engine: SIGNALSMITH = in tune at any tempo; ' +
    'RATE = pitch-bends (vinyl). Slow the tempo + solo BED to hear the difference.</div>';
  document.body.appendChild(wrap);

  const bedBtn = wrap.querySelector('#bn-solo-bed');
  const hitsBtn = wrap.querySelector('#bn-solo-hits');
  const bedEngBtn = wrap.querySelector('#bn-solo-bedeng');
  const info = wrap.querySelector('#bn-solo-info');

  const apply = () => {
    // BED off → muteBed; HITS off → muteOverlays.
    eng.setDrumDiagnosticSolo({ muteBed: !state.bed, muteOverlays: !state.hits });
    eng.setDrumBedEngine?.(state.bedSig ? 'signalsmith' : 'rate');
    bedBtn.textContent = state.bed ? 'BED ✓' : 'BED muted';
    bedBtn.style.background = state.bed ? '#1e5e8a' : '#2a2a2a';
    bedBtn.style.color = '#fff';
    hitsBtn.textContent = state.hits ? 'BIG HITS ✓' : 'HITS muted';
    hitsBtn.style.background = state.hits ? '#8a2e2e' : '#2a2a2a';
    hitsBtn.style.color = '#fff';
    bedEngBtn.textContent = state.bedSig
      ? 'bed: SIGNALSMITH (in tune)'
      : 'bed: RATE (pitch-bends)';
    bedEngBtn.style.background = state.bedSig ? '#2e7d4f' : '#7a5a1f';
    bedEngBtn.style.color = '#fff';
    const label =
      state.bed && state.hits
        ? 'both layers'
        : state.bed
          ? 'BED only (texture)'
          : state.hits
            ? 'BIG HITS only (kicks/snares)'
            : 'silence';
    info.textContent = label;
    // eslint-disable-next-line no-console
    console.log('[solo]', label);
  };
  bedBtn.addEventListener('click', () => {
    state.bed = !state.bed;
    apply();
  });
  hitsBtn.addEventListener('click', () => {
    state.hits = !state.hits;
    apply();
  });
  bedEngBtn.addEventListener('click', () => {
    state.bedSig = !state.bedSig;
    apply();
  });
  apply();
  // eslint-disable-next-line no-console
  console.log('[solo] ready — toggle BED / BIG HITS independently.');
})();
