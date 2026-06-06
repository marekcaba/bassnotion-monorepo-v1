/**
 * TWO-TRACK A/B — flip the new pre-rendered two-track engine vs the legacy live
 * per-hit overlays, BY EAR, while the groove plays.
 *
 * THE QUESTION: does the two-track engine (bed buffer + big-hits buffer, both
 * continuous, re-rendered per ratio) eliminate the kick/snare SPILL when you nudge
 * tempo — without losing punch or sync? The spill happens in the live engine because
 * it schedules each hit as its own source ahead of time, and a nudge races them. The
 * two-track bakes the hits into a buffer, so there are NO per-hit sources to race.
 *
 *   TWO-TRACK ON  = bed buffer + big-hits buffer (no per-hit scheduling). The new way.
 *   TWO-TRACK OFF = legacy live per-hit overlays (the spill-prone way).
 *
 * USE: groove card → START → settle to a slow tempo (nudge down ~10 BPM) so you're in
 *   the BED. Paste this. Then:
 *     1. Listen at the held tempo — both should sound full (kicks/snares + texture).
 *     2. NUDGE the tempo around fast (the spill-prone motion). On OFF you may hear a
 *        kick/snare spill into the bed; on ON it should be clean.
 *     3. A/B a few times. Pick the one that's clean under a fast nudge.
 */
(() => {
  const eng =
    window.__bassnotion_playbackEngine ||
    window.__bassnotion_serviceRegistry?.getPlaybackEngine?.();
  if (
    !eng ||
    typeof eng.setDrumTwoTrack !== 'function' ||
    typeof eng.getDrumTempoDebugState !== 'function'
  ) {
    console.warn(
      '[two-track-ab] engine/setDrumTwoTrack not found — start the groove first, re-paste.',
    );
    return;
  }
  document.getElementById('bn-twotrack-ab')?.remove();

  let on = true; // default ON (matches the engine default)
  const wrap = document.createElement('div');
  wrap.id = 'bn-twotrack-ab';
  wrap.style.cssText =
    'position:fixed;bottom:16px;left:16px;z-index:99999;background:rgba(16,20,30,.96);' +
    'color:#eee;font:12px/1.4 system-ui;padding:12px 14px;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.55);backdrop-filter:blur(6px);width:300px';
  wrap.innerHTML =
    '<div style="font-weight:600;margin-bottom:6px">two-track vs live overlays (by ear)</div>' +
    '<button id="bn-tt-btn" style="width:100%;padding:9px;font:13px system-ui;cursor:pointer;border-radius:6px;border:0"></button>' +
    '<div id="bn-tt-state" style="margin-top:8px;font:600 13px ui-monospace,monospace;text-align:center"></div>' +
    '<div id="bn-tt-info" style="margin-top:2px;font:11px ui-monospace,monospace;text-align:center;opacity:.7"></div>' +
    '<div style="opacity:.6;margin-top:8px">Settle to a slow tempo (in the BED), then NUDGE fast. ' +
    'ON = pre-rendered tracks (no per-hit scheduling). OFF = live overlays (spill-prone). ' +
    'Listen for a kick/snare spilling into the bed while nudging.</div>';
  document.body.appendChild(wrap);

  const btn = wrap.querySelector('#bn-tt-btn');
  const stateEl = wrap.querySelector('#bn-tt-state');
  const infoEl = wrap.querySelector('#bn-tt-info');
  const apply = () => {
    eng.setDrumTwoTrack(on);
    btn.textContent = on ? 'TWO-TRACK ON ✓' : 'LIVE OVERLAYS (legacy)';
    btn.style.background = on ? '#2e7d4f' : '#8a5a1f';
    btn.style.color = '#fff';
    // eslint-disable-next-line no-console
    console.log('[two-track-ab] twoTrack =', on);
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
  console.log(
    '[two-track-ab] ready — settle to a slow tempo, then NUDGE fast and A/B by ear.',
  );
})();
