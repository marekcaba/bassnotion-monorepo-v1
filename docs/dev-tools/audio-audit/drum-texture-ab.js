/**
 * Drum texture A/B (dev-only, ear-test for the continuous-glide build decision).
 *
 * WHY: a continuous tempo glide cannot re-render the WSOLA bed during the ramp —
 * the bed synth costs ~145ms (M1 Pro) to ~400ms+ (mid-tier) per ratio, and a
 * glide samples the ratio ~30×/sec. So during a glide the drums MUST fall back
 * to the bit-exact per-slice path (no synth cost). The whole effort estimate
 * hinges on ONE ear question:
 *
 *   "Is the per-slice (WSOLA-OFF) drum texture acceptable as the mid-glide sound?"
 *
 *   YES → the recommended ~1-week build works (dry-but-sharp slices during the
 *         ramp, WSOLA bed re-rendered once when tempo settles).
 *   NO  → we'd need a real-time streaming-WSOLA worklet instead (+2-3 weeks).
 *
 * This toggles engine.setDrumWsola(bool) live:
 *   WSOLA ON  = the current shipped bed (smooth texture; can't be used mid-glide)
 *   WSOLA OFF = the per-slice path (bit-exact transients; the mid-glide candidate)
 *
 * USE: homepage → START the groove → paste this into DevTools console.
 *   1. Leave WSOLA = ON, listen to the groove (your reference).
 *   2. Flip to WSOLA = OFF. Listen to the SAME groove on the per-slice path.
 *      ALSO nudge the tempo a few times in each mode.
 *   3. Verdict by ear: is OFF acceptable as a brief (<1s) mid-glide texture?
 *      (It will sound slightly drier/less "filled" between hits — that's expected.
 *       The question is whether it's acceptable for the ~half-second of a ramp.)
 *
 * The change applies on the NEXT loop iteration (let it loop once to hear it).
 */
(() => {
  const eng =
    window.__bassnotion_playbackEngine ||
    window.__bassnotion_serviceRegistry?.getPlaybackEngine?.();
  if (!eng || typeof eng.setDrumWsola !== 'function') {
    console.warn(
      '[drum-texture-ab] engine not found or no setDrumWsola — start the groove first, then re-paste.',
    );
    return;
  }
  document.getElementById('bn-drumtex-ab')?.remove();

  let wsolaOn = true; // shipped default
  const wrap = document.createElement('div');
  wrap.id = 'bn-drumtex-ab';
  wrap.style.cssText =
    'position:fixed;bottom:16px;left:16px;z-index:99999;background:rgba(20,20,28,.92);' +
    'color:#eee;font:12px/1.4 system-ui;padding:12px 14px;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.5);backdrop-filter:blur(6px);width:260px';
  wrap.innerHTML =
    '<div style="font-weight:600;margin-bottom:6px">drum texture A/B (glide decision)</div>' +
    '<button id="bn-tex-btn" style="width:100%;padding:8px;font:13px system-ui;cursor:pointer;border-radius:6px;border:0"></button>' +
    '<div style="opacity:.6;margin-top:8px">' +
    'WSOLA = current bed (can\'t use mid-glide).<br>' +
    'SLICES = the mid-glide candidate.<br>' +
    'Toggle, let it loop once, also nudge tempo. Is SLICES OK for a ~½s ramp?' +
    '</div>';
  document.body.appendChild(wrap);

  const btn = wrap.querySelector('#bn-tex-btn');
  const render = () => {
    btn.textContent = wsolaOn
      ? 'WSOLA bed  ✓  (smooth)'
      : 'SLICES  (mid-glide candidate)';
    btn.style.background = wsolaOn ? '#2e7d4f' : '#9a6a1f';
    btn.style.color = '#fff';
  };
  const apply = () => {
    eng.setDrumWsola(wsolaOn);
    // eslint-disable-next-line no-console
    console.log(
      '[drum-texture-ab] WSOLA =',
      wsolaOn,
      wsolaOn ? '(bed)' : '(per-slice — the mid-glide texture)',
      '— heard on the next loop iteration',
    );
    render();
  };
  btn.addEventListener('click', () => {
    wsolaOn = !wsolaOn;
    apply();
  });
  apply();
  // eslint-disable-next-line no-console
  console.log('[drum-texture-ab] ready — toggle, let it loop, judge SLICES by ear.');
})();
