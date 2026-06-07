/**
 * Drum Realtime/Rendered tempo machine — A/B + live state monitor.
 *
 * THE BUILD: drums now switch engine by what you're doing (mirrors Adobe Audition
 * Realtime↔Rendered + élastique transient-handling):
 *   • WHILE you nudge tempo  → per-slice path (smooth, no jump, bit-exact hits).
 *   • WHEN tempo SETTLES (~350ms) → cross-fade to the full WSOLA bed + transient
 *     overlays (correct hi-hat placement at the held tempo — the sound you loved).
 *   • Nudge again → instantly back to slices; the bed re-renders in the background
 *     so the swap-in never has the "jump".
 *
 * This panel:
 *   • shows the LIVE state (SLICES / XFADE_TO_BED / BED / XFADE_TO_SLICES) + ratio
 *   • toggles the whole machine ON/OFF (OFF = pure slices, for A/B)
 *
 * USE: start the groove → paste this. Watch the state readout while you:
 *   1. Nudge tempo down to ~94 BPM (−15) one BPM at a time. State should stay
 *      SLICES while you click, then flip to XFADE_TO_BED → BED ~350ms after you
 *      STOP. Listen: smooth during the nudges, correct hi-hats once settled.
 *   2. Nudge again → state snaps back to (XFADE_TO_)SLICES instantly, smooth.
 *   3. Toggle the machine OFF → pure slices (hats rush at slow tempo, the old way).
 */
(() => {
  const eng =
    window.__bassnotion_playbackEngine ||
    window.__bassnotion_serviceRegistry?.getPlaybackEngine?.();
  if (
    !eng ||
    typeof eng.setDrumAutoTempoMode !== 'function' ||
    typeof eng.getDrumTempoDebugState !== 'function'
  ) {
    console.warn(
      '[drum-auto] engine/setDrumAutoTempoMode not found — start the groove first, re-paste.',
    );
    return;
  }
  document.getElementById('bn-drum-auto')?.remove();

  let on = true;
  const wrap = document.createElement('div');
  wrap.id = 'bn-drum-auto';
  wrap.style.cssText =
    'position:fixed;bottom:16px;left:16px;z-index:99999;background:rgba(20,20,28,.94);' +
    'color:#eee;font:12px/1.4 system-ui;padding:12px 14px;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.5);backdrop-filter:blur(6px);width:280px';
  wrap.innerHTML =
    '<div style="font-weight:600;margin-bottom:6px">drum tempo machine</div>' +
    '<button id="bn-da-btn" style="width:100%;padding:8px;font:13px system-ui;cursor:pointer;border-radius:6px;border:0"></button>' +
    '<div id="bn-da-state" style="margin-top:8px;font:600 14px ui-monospace,monospace;text-align:center"></div>' +
    '<div id="bn-da-ratio" style="margin-top:2px;font:12px ui-monospace,monospace;text-align:center;opacity:.7"></div>' +
    '<div style="opacity:.6;margin-top:8px">Nudge to −15 BPM: SLICES while clicking → BED ~350ms after you stop. Nudge again → back to SLICES.</div>';
  document.body.appendChild(wrap);

  const btn = wrap.querySelector('#bn-da-btn');
  const stateEl = wrap.querySelector('#bn-da-state');
  const ratioEl = wrap.querySelector('#bn-da-ratio');
  const apply = () => {
    eng.setDrumAutoTempoMode(on);
    btn.textContent = on ? 'MACHINE ON ✓' : 'MACHINE OFF (pure slices)';
    btn.style.background = on ? '#2e7d4f' : '#8a3b3b';
    btn.style.color = '#fff';
    // eslint-disable-next-line no-console
    console.log('[drum-auto] machine =', on);
  };
  btn.addEventListener('click', () => {
    on = !on;
    apply();
  });
  const COLORS = {
    SLICES: '#d0a020',
    XFADE_TO_BED: '#6aa0d0',
    BED: '#3fa05f',
    XFADE_TO_SLICES: '#d08050',
  };
  const tick = () => {
    const s = eng.getDrumTempoDebugState?.();
    if (s) {
      stateEl.textContent = s.mode;
      stateEl.style.color = COLORS[s.mode] ?? '#eee';
      const pct = (s.ratio - 1) * 100;
      ratioEl.textContent =
        `ratio ${s.ratio.toFixed(3)}  (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)` +
        (s.bedReady ? '  • bed ready' : '  • bed pending');
    } else {
      stateEl.textContent = '(no drums armed)';
      ratioEl.textContent = '';
    }
    requestAnimationFrame(tick);
  };
  apply();
  tick();
  // eslint-disable-next-line no-console
  console.log('[drum-auto] ready — watch the state while you nudge tempo.');
})();
