/**
 * Overlay probe — run on YOUR groove (test-groove-2) while PLAYING, slowed.
 * Tells us why "Only big hits" is silent for you: how many overlays fire, and
 * how loud the audio they read actually is. Pure read — schedules nothing.
 */
(() => {
  const sp = window.__bassnotion_playbackEngine?.drumSlicePlayer;
  if (!sp) return console.warn('[probe] press play first');
  const sr = sp.buffer.sampleRate;
  const ratio = sp.ratio || 1;
  const buf = sp.buffer.getChannelData(0);
  const body = sp.transientBodySeconds || 0.05;
  const pre = (sp.opt?.preRollSeconds) || 0.003;
  const rows = sp.strongIndices.map((i) => {
    const onset = sp.onsets[i];
    const readStart = Math.max(0, onset - pre);
    const a = Math.round(readStart * sr), b = Math.round((readStart + body + pre) * sr);
    let peak = 0, rms = 0, c = 0;
    for (let j = a; j < Math.min(buf.length, b); j++) { const v = Math.abs(buf[j]); if (v > peak) peak = v; rms += buf[j] * buf[j]; c++; }
    rms = Math.sqrt(rms / Math.max(1, c));
    return { onsetMs: Math.round(onset * 1000), conf: +sp.confidences[i].toFixed(2), readPeak: +peak.toFixed(3), readRms: +rms.toFixed(4) };
  });
  console.log(`[probe] ratio=${ratio.toFixed(3)} strongIndices(overlays)=${sp.strongIndices.length} threshold=${sp.strongConfidenceThreshold} body=${(body*1000)|0}ms muteBed=${sp.muteBed} muteOverlays=${sp.muteOverlays}`);
  console.table(rows);
  const loud = rows.filter(r => r.readPeak > 0.1).length;
  console.log(`[probe] overlays reading LOUD audio (peak>0.1): ${loud} of ${rows.length}. If this is 0, the overlays are reading silence → that's why "only big hits" is silent.`);
})();
