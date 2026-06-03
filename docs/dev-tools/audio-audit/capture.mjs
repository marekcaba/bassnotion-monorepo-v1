/**
 * Headless-Chromium capture of the REAL groove-card engine output.
 *
 * Loads the public homepage (waitlist groove card — no auth), taps the live
 * Web Audio master bus with a recorder worklet, drives a scripted scenario
 * via the real DOM controls (so the full seam/time-stretch path runs), and
 * writes a Float32 WAV for offline analysis (analyze.mjs).
 *
 * Chromium has full Web Audio + AudioWorklet (signalsmith / soundtouch WASM
 * run for real), so the captured signal is what a user actually hears.
 *
 * Run (frontend must be up on :3001):
 *   node docs/dev-tools/audio-audit/capture.mjs <scenario> <out.wav>
 * scenarios: baseline | keychange | tempochange | keythentempo
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const SCENARIO = process.argv[2] || 'keychange';
const OUT = process.argv[3] || `docs/dev-tools/audio-audit/capture-${SCENARIO}.wav`;
const BASE = process.env.AUDIT_URL || 'http://localhost:3001';
// Optional: tap a single stem's gain node instead of the master bus, e.g.
//   --stem audio-bass   → records bass in isolation (clean pitch tracking).
const stemArgIdx = process.argv.indexOf('--stem');
const STEM = stemArgIdx > -1 ? process.argv[stemArgIdx + 1] : null;

// Write a Float32 mono WAV.
function writeWav(path, samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); // IEEE float
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(32, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) buf.writeFloatLE(samples[i], 44 + i * 4);
  writeFileSync(path, buf);
}

const log = (...a) => console.log('[capture]', ...a);

const browser = await chromium.launch({
  headless: true,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--mute-audio=false',
  ],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (/\[(cap|GrooveCard|PlaybackEngine|signalsmith)\]/i.test(t)) log('page>', t);
});

log(`loading ${BASE} …`);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });

// Install an audio tap: monkeypatch AudioContext.destination connect so any
// graph that reaches the destination is mirrored into a recorder worklet.
// We register the recorder lazily once the persistent context exists.
await page.addInitScript(() => {
  // marker so we know the init script ran
  window.__auditReady = true;
});

// Wait for the play control to exist.
const playSel = 'button[aria-label*="Play" i], button[aria-label*="play" i]';
await page.waitForSelector(playSel, { timeout: 30000 });
log('groove card present.');

// Install the recorder tap inside the page once the persistent AudioContext
// is available (WindowRegistry stores it on window.__bassnotion_audioContext).
const tapInstalled = await page.evaluate(async (STEM) => {
  function getCtx() {
    return (
      window.__bassnotion_audioContext ||
      window.__persistentAudioContext ||
      null
    );
  }
  // Poll briefly for the context (created on first user gesture / bootstrap).
  let actx = getCtx();
  if (!actx) {
    // Force creation: some bootstraps create it only after a gesture, but the
    // waitlist prewarm usually has it ready. Give it a moment.
    for (let i = 0; i < 20 && !actx; i++) {
      await new Promise((r) => setTimeout(r, 100));
      actx = getCtx();
    }
  }
  if (!actx) return { ok: false, reason: 'no AudioContext yet' };

  // Recorder via ScriptProcessor (works without worklet module loading).
  const SR = actx.sampleRate;
  window.__auditSR = SR;
  window.__auditChunks = [];
  window.__auditNonSilentChunks = 0;
  window.__auditMirrors = 0;
  const rec = actx.createScriptProcessor(8192, 2, 1);
  rec.onaudioprocess = (e) => {
    if (!window.__auditRecording) return;
    // Stamp the audio-time of the FIRST captured sample so we can map any
    // engine event time → sample index: sample = (eventTime - recStart) * SR.
    if (window.__auditRecStart == null) {
      window.__auditRecStart = e.playbackTime ?? actx.currentTime;
    }
    const l = e.inputBuffer.getChannelData(0);
    const r =
      e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : l;
    const out = new Float32Array(l.length);
    let nonZero = 0;
    for (let i = 0; i < l.length; i++) {
      out[i] = (l[i] + r[i]) / 2;
      if (out[i] !== 0) nonZero++;
    }
    if (nonZero > 0) window.__auditNonSilentChunks++;
    window.__auditChunks.push(out);
  };
  // ScriptProcessor must reach the destination to be pulled by the graph.
  rec.connect(actx.destination);

  // Tap strategy A: intercept connect() to destination and mirror into rec.
  const dest = actx.destination;
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    if (target === dest && this !== rec) {
      try {
        origConnect.call(this, rec);
        window.__auditMirrors++;
      } catch (_) {}
    }
    return origConnect.call(this, target, ...rest);
  };

  // Tap strategy B (robust): directly mirror a known engine node.
  //  - stem given → that stem's gain node (isolated render for pitch tracking)
  //  - else        → the master bus (full mix)
  // private fields aren't enforced at runtime.
  try {
    const reg = window.__bassnotion_serviceRegistry || window.__serviceRegistry;
    const eng =
      (reg && (reg.getPlaybackEngine?.() || reg.playbackEngine)) ||
      window.__bassnotion_playbackEngine ||
      null;
    let tapNode = null;
    if (STEM && eng?.instrumentGainNodes?.get) {
      tapNode = eng.instrumentGainNodes.get(STEM) || null;
      window.__auditTapTarget = tapNode ? `stem:${STEM}` : `stem:${STEM}:MISSING`;
    }
    if (!tapNode) {
      tapNode = eng?.masterVolumeGain || eng?.masterGain || null;
      if (!window.__auditTapTarget) window.__auditTapTarget = 'master';
    }
    if (tapNode && typeof tapNode.connect === 'function') {
      origConnect.call(tapNode, rec);
      window.__auditMasterTap = true;
    } else {
      window.__auditMasterTap = false;
    }

    // Instrument the engine's pitch/rate writes so we know the EXACT audio-time
    // each change was scheduled to apply at (the seam boundary), plus the
    // recorder's own clock so we can map seam time → sample index.
    window.__auditEvents = [];
    window.__auditCtx = actx;
    if (eng) {
      const wrap = (name) => {
        const orig = eng[name];
        if (typeof orig !== 'function') return;
        eng[name] = function (...a) {
          window.__auditEvents.push({
            method: name,
            now: actx.currentTime,
            args: a.map((x) =>
              typeof x === 'number' || typeof x === 'string' ? x : String(x),
            ),
          });
          return orig.apply(this, a);
        };
      };
      wrap('setInstrumentPitchShift');
      wrap('setStretchRatio');
    }
  } catch (err) {
    window.__auditMasterTap = 'err:' + (err && err.message);
  }

  return { ok: true, sampleRate: SR };
}, STEM);
log('tap install:', JSON.stringify(tapInstalled));
if (!tapInstalled.ok) {
  log('FATAL: could not install audio tap —', tapInstalled.reason);
  await browser.close();
  process.exit(2);
}

const clickByLabel = async (label) => {
  const el = page.locator(`[aria-label="${label}"]`).first();
  await el.click({ timeout: 5000 });
};
const stepN = async (label, n, gapMs = 30) => {
  for (let i = 0; i < n; i++) {
    await clickByLabel(label);
    await page.waitForTimeout(gapMs);
  }
};

// Start recording, then run the scenario.
await page.evaluate(() => {
  window.__auditChunks = [];
  window.__auditRecording = true;
});

log(`scenario: ${SCENARIO}`);
// Press play (user gesture).
await page.click(playSel);
await page.waitForTimeout(3500); // let it loop a couple of bars cleanly

// The key change defers to the next loop seam, which can be a FULL loop away
// (~14.4s here). Wait long enough to capture the actual transition + settle.
const POST_KEY_MS = 17000;
const POST_TEMPO_MS = 8000;
if (SCENARIO === 'baseline') {
  await page.waitForTimeout(5000);
} else if (SCENARIO === 'keychange') {
  await stepN('Key up', 3, 20); // +3 semitones (one decisive change)
  await page.waitForTimeout(POST_KEY_MS); // capture across the (deferred) seam
} else if (SCENARIO === 'tempochange') {
  await stepN('Tempo up', 20, 15); // +20 BPM
  await page.waitForTimeout(POST_TEMPO_MS);
} else if (SCENARIO === 'keythentempo') {
  await stepN('Key up', 3, 20);
  await page.waitForTimeout(2500);
  await stepN('Tempo up', 20, 15);
  await page.waitForTimeout(4000);
}

// Stop recording, pull the PCM out.
const { sr, samples, diag, events } = await page.evaluate(() => {
  window.__auditRecording = false;
  const chunks = window.__auditChunks || [];
  let total = 0;
  for (const c of chunks) total += c.length;
  const all = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  // Map each engine event's audio-time to a sample index in the WAV.
  const recStart = window.__auditRecStart ?? 0;
  const SR = window.__auditSR;
  const events = (window.__auditEvents || []).map((ev) => ({
    ...ev,
    sampleIndex: Math.round((ev.now - recStart) * SR),
    seamSec: ev.now - recStart, // event time relative to WAV start
  }));
  return {
    sr: window.__auditSR,
    samples: Array.from(all),
    events,
    recStart,
    diag: {
      chunks: chunks.length,
      nonSilentChunks: window.__auditNonSilentChunks,
      mirrors: window.__auditMirrors,
      masterTap: window.__auditMasterTap,
      tapTarget: window.__auditTapTarget,
      eventCount: events.length,
    },
  };
});
log('diag:', JSON.stringify(diag));

await browser.close();

if (!samples || samples.length === 0) {
  log('FATAL: captured 0 samples (engine may not have routed to destination).');
  process.exit(3);
}
const f32 = Float32Array.from(samples);
writeWav(OUT, f32, sr);
log(`wrote ${OUT}: ${(f32.length / sr).toFixed(2)}s @ ${sr}Hz (${f32.length} samples)`);

// Sidecar: the exact seam times (engine pitch/rate writes), mapped to samples.
const sidecar = OUT.replace(/\.wav$/, '.events.json');
writeFileSync(
  sidecar,
  JSON.stringify({ scenario: SCENARIO, sampleRate: sr, events }, null, 2),
);
log(`wrote ${sidecar}: ${events.length} engine events`);
if (events.length) {
  for (const ev of events.slice(0, 8))
    log(
      `  ${ev.method}(${ev.args.join(', ')}) @ ${ev.seamSec.toFixed(4)}s  sample=${ev.sampleIndex}`,
    );
}
