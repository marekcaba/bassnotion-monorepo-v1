/**
 * Bass/harmony ↔ drums latency tuner (dev-only, ear-tuning).
 *
 * The groove card pulls bass/harmony starts EARLIER by `stretchLatencySeconds`
 * so their worklet-delayed output lands on the drum grid. The exact value is
 * ear-set (the auto drift metric aliases on the beat). This paints a floating
 * slider that calls engine.setStretchLatencyOverride(seconds) live — nudge it
 * while a groove plays until the bass locks to the kick, then read off the ms.
 *
 * USE: open the homepage, start the groove, paste this whole file into the
 * browser DevTools console. Drag the slider. The value that locks it is the
 * number to bake into the seed (currently signalsmith-nominal ~0.175s).
 *
 * NOTE: the change applies to the NEXT scheduled loop iteration / next play —
 * so after moving the slider, let it loop once (or stop→play) to hear it.
 */
(() => {
  const eng = window.__bassnotion_playbackEngine;
  if (!eng || typeof eng.setStretchLatencyOverride !== 'function') {
    console.warn(
      '[latency-tuner] engine not found or no setStretchLatencyOverride — start the groove first.',
    );
    return;
  }
  document.getElementById('bn-lat-tuner')?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'bn-lat-tuner';
  wrap.style.cssText =
    'position:fixed;bottom:16px;right:16px;z-index:99999;background:rgba(20,20,28,.92);' +
    'color:#eee;font:12px/1.4 system-ui;padding:12px 14px;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.5);backdrop-filter:blur(6px);width:240px';

  const init = Math.round((eng.stretchLatencySeconds || 0.175) * 1000);
  wrap.innerHTML =
    '<div style="font-weight:600;margin-bottom:6px">bass/harmony pull (ms)</div>' +
    '<input id="bn-lat-range" type="range" min="0" max="350" step="5" value="' +
    init +
    '" style="width:100%">' +
    '<div style="display:flex;justify-content:space-between;margin-top:6px">' +
    '<span id="bn-lat-val">' +
    init +
    ' ms</span>' +
    '<button id="bn-lat-reset" style="font:11px system-ui;cursor:pointer">reset</button>' +
    '</div>' +
    '<div style="opacity:.6;margin-top:6px">↑ = bass earlier vs drums.<br>Let it loop once to hear each change.</div>';
  document.body.appendChild(wrap);

  const range = wrap.querySelector('#bn-lat-range');
  const val = wrap.querySelector('#bn-lat-val');
  const apply = (ms) => {
    val.textContent = ms + ' ms';
    eng.setStretchLatencyOverride(ms / 1000);
    // eslint-disable-next-line no-console
    console.log('[latency-tuner] override =', (ms / 1000).toFixed(3), 's');
  };
  range.addEventListener('input', (e) => apply(+e.target.value));
  wrap.querySelector('#bn-lat-reset').addEventListener('click', () => {
    eng.setStretchLatencyOverride(null);
    // eslint-disable-next-line no-console
    console.log('[latency-tuner] cleared override → back to measured value');
  });
  // eslint-disable-next-line no-console
  console.log(
    '[latency-tuner] ready — current pull',
    init,
    'ms. Drag to tune by ear.',
  );
})();
