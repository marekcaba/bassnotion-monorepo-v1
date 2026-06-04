/**
 * key-seam-tuner.js — ear-tune WHERE the key change lands at the loop seam.
 *
 * The deferred key change is quantised to the bass read-head seam, then pushed
 * LATER by the device output latency so it lands on the AUDIBLE downbeat (the
 * read-head leads the speaker by ~100ms). This slider overrides that push so you
 * can dial the exact value by ear: change the key while it plays, listen for the
 * new key to snap in exactly on the downbeat (not before it, not after).
 *
 * USE: start the groove, paste this whole file into the DevTools console. A
 * slider appears bottom-right. Drag it, then trigger a key change (UI transpose
 * or just wait — it applies to the NEXT key change / next loop). The value that
 * makes the key land ON the beat is the number to bake into getStemNextSeamTime
 * (currently defaults to audioContext.outputLatency).
 *
 *   + (right) = key change LATER  (push past an early landing)
 *   − (left)  = key change EARLIER
 */
(() => {
  const eng = window.__bassnotion_playbackEngine;
  if (!eng) {
    console.warn(
      '[key-seam-tuner] window.__bassnotion_playbackEngine is null — start the groove (press play) first, then re-paste.',
    );
    return;
  }
  if (typeof eng.setKeySeamOffsetOverride !== 'function') {
    console.warn(
      '[key-seam-tuner] engine has NO setKeySeamOffsetOverride — your browser is running a STALE bundle from before this method was added.\n' +
        '→ HARD-RELOAD the page (Cmd+Shift+R), press play, then re-paste this script.\n' +
        'engine methods present:',
      Object.getOwnPropertyNames(Object.getPrototypeOf(eng)).filter((m) =>
        /seam|key|stretch|pitch/i.test(m),
      ),
    );
    return;
  }
  document.getElementById('bn-keyseam-tuner')?.remove();

  const ctx = eng.audioContext;
  const measured =
    (typeof ctx?.outputLatency === 'number'
      ? ctx.outputLatency
      : ctx?.baseLatency) || 0.1;
  const init = Math.round((eng.keySeamOffsetOverride ?? measured) * 1000);

  const wrap = document.createElement('div');
  wrap.id = 'bn-keyseam-tuner';
  wrap.style.cssText =
    'position:fixed;bottom:16px;right:16px;z-index:99999;background:rgba(20,16,28,.93);' +
    'color:#eee;font:12px/1.4 system-ui;padding:12px 14px;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.5);backdrop-filter:blur(6px);width:260px';
  wrap.innerHTML =
    '<div style="font-weight:600;margin-bottom:6px">key-change seam offset (ms)</div>' +
    '<input id="bn-ks-range" type="range" min="-100" max="350" step="5" value="' +
    init +
    '" style="width:100%">' +
    '<div style="display:flex;justify-content:space-between;margin-top:6px">' +
    '<span id="bn-ks-val">' +
    init +
    ' ms</span>' +
    '<button id="bn-ks-reset" style="font:11px system-ui;cursor:pointer">reset (measured ' +
    Math.round(measured * 1000) +
    'ms)</button>' +
    '</div>' +
    '<div style="opacity:.6;margin-top:6px">+ = key change LATER · − = EARLIER.<br>' +
    'Change the key, listen at the seam.</div>';
  document.body.appendChild(wrap);

  const range = wrap.querySelector('#bn-ks-range');
  const val = wrap.querySelector('#bn-ks-val');
  const apply = (ms) => {
    val.textContent = ms + ' ms';
    eng.setKeySeamOffsetOverride(ms / 1000);
    // eslint-disable-next-line no-console
    console.log('[key-seam-tuner] override =', (ms / 1000).toFixed(3), 's');
  };
  range.addEventListener('input', (e) => apply(+e.target.value));
  wrap.querySelector('#bn-ks-reset').addEventListener('click', () => {
    eng.setKeySeamOffsetOverride(null);
    range.value = Math.round(measured * 1000);
    val.textContent = Math.round(measured * 1000) + ' ms';
    // eslint-disable-next-line no-console
    console.log('[key-seam-tuner] cleared → back to measured outputLatency');
  });
  // eslint-disable-next-line no-console
  console.log(
    '[key-seam-tuner] ready — current offset',
    init,
    'ms (measured outputLatency',
    Math.round(measured * 1000),
    'ms). Drag, then change the key to hear it.',
  );
})();
