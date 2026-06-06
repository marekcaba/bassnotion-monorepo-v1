'use client';

/**
 * DrumGapFillAdminPanel — a floating, dev-only tuning panel for the drum
 * time-stretch gap-fill engine (LAUNCH-06).
 *
 * WHY THIS EXISTS. The granular hi-hat tail-fill (see buildExtendedTail.ts) has
 * a genuine design tension: a faithful natural decay (short τ) is honest but
 * doesn't bridge the silent gaps a slowdown opens, while a long sustain fills
 * the gap but risks an unnatural noise pad. There is no analytically "correct"
 * value — it's an ear call. This panel exposes every knob LIVE on the playing
 * DrumSlicePlayer (via PlaybackEngine.setDrumGapFillParams) so the behaviour can
 * be dialled in by ear, in real time, A/B'd against the dry slicer with the
 * Solo Drums toggle.
 *
 * It is intentionally self-contained: it reaches the engine through
 * WindowRegistry (the same accessor the groove-card hook uses) rather than
 * threading props through the control tree, because it's a transient dev tool,
 * not product UI. Mount it behind a dev gate (see isAdminPanelEnabled()).
 *
 * Scheduling knobs (gap/guard/min/fade) take effect on the next scheduled slice
 * with zero rebuild. DSP knobs (maxFillConfidence, τ, grain) re-precompute the
 * per-slice fill buffers synchronously (tens of ms) — fine while tuning.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { WindowRegistry } from '../services/WindowRegistry';

/** Mirrors DrumSlicePlayer.GapFillParams (kept local so this component doesn't
 *  pull the player type — the engine is `any` through WindowRegistry anyway). */
interface GapFillParams {
  gapFill: boolean;
  minGapToFillSeconds: number;
  fillTransientGuardSeconds: number;
  minFillSeconds: number;
  fadeOutSeconds: number;
  maxFillConfidence: number;
  sustainTauSeconds: number | undefined;
  sustainGrainSeconds: number | undefined;
  // Hybrid WSOLA continuous-bed stretch (the real slow-tempo hi-hat fix).
  wsola: boolean;
  strongConfidenceThreshold: number;
  wsolaWindowSeconds: number;
  wsolaHopFraction: number;
  wsolaSearchSeconds: number;
  transientBodySeconds: number;
  transientDuckDepth: number;
  bedTransientNotch: number;
  bedNotchSeconds: number;
  transientBlendSeconds: number;
  transientDuckAttackSeconds: number;
  // Big-hit region — overlay span + bed-notch span (independent).
  bigHitPreSeconds: number;
  bigHitTailSeconds: number;
  bedNotchPreSeconds: number;
  bedNotchTailSeconds: number;
  // BIG-HIT envelope (continuous levels + nudgeable start/end).
  hitPreRollSeconds: number;
  hitStartLevel: number;
  hitPeakLevel: number;
  hitEndLevel: number;
  hitAttackSeconds: number;
  hitReleaseSeconds: number;
  hitStartNudgeSeconds: number;
  hitEndNudgeSeconds: number;
  transientLengthSeconds: number;
  // SLICE seam (home-tempo / while-nudging flam controls).
  slicePreRollSeconds: number;
  sliceFadeInSeconds: number;
  sliceFadeOutSeconds: number;
  sliceTailTrimSeconds: number;
  // SLICES↔BED transition timing (the state machine).
  settleMs: number;
  xfadeToBedSeconds: number;
  xfadeToSlicesSeconds: number;
}

interface EngineLike {
  getDrumGapFillState?: () => {
    params: GapFillParams;
    qualifyingFills: number;
    textureRegions?: number;
  } | null;
  setDrumGapFillParams?: (p: Partial<GapFillParams>) => void;
  setDrumGapFill?: (on: boolean) => void;
  setDrumWsola?: (on: boolean) => void;
  setDrumDiagnosticSolo?: (opts: {
    muteBed?: boolean;
    muteOverlays?: boolean;
  }) => void;
  setInstrumentMuted?: (instrument: string, muted: boolean) => void;
  // Per-instrument output gain nodes — the scope taps 'audio-drums' to record the
  // REAL engine output (bed + overlays) for the waveform display.
  instrumentGainNodes?: Map<string, AudioNode>;
}

function getEngine(): EngineLike | null {
  return (WindowRegistry.getPlaybackEngine() as EngineLike | null) ?? null;
}

/** Gate: show the panel only when explicitly opted in. Set
 *  NEXT_PUBLIC_DRUM_ADMIN_PANEL=true in .env.local, or append ?drumadmin=1 to
 *  the URL (handy on the deployed waitlist without an env change). */
export function isDrumAdminPanelEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (
      typeof process !== 'undefined' &&
      process.env?.NEXT_PUBLIC_DRUM_ADMIN_PANEL === 'true'
    ) {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('drumadmin') === '1';
  } catch {
    return false;
  }
}

/** One labelled slider row that patches a single numeric param on change. */
function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  format,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const shown = format ? format(value) : value.toFixed(3);
  return (
    <div style={{ marginBottom: 10, opacity: disabled ? 0.45 : 1 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: 11,
          marginBottom: 2,
        }}
      >
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#9be9a8' }}>
          {shown}
          {unit ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#22c55e' }}
      />
      {hint ? (
        <div style={{ fontSize: 9.5, color: '#8a8a8a', lineHeight: 1.25 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

const MS = (v: number) => `${Math.round(v * 1000)}`;

/** Clamp a canvas Y so an amplitude-zoomed waveform can't draw off the box. */
function clampY(y: number, H: number): number {
  return y < 0 ? 0 : y > H ? H : y;
}

/** Encode mono Float32 PCM to a 32-bit-float WAV and trigger a browser download. */
function downloadWav(
  samples: Float32Array,
  sampleRate: number,
  filename: string,
): void {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 4);
  const dv = new DataView(buf);
  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  dv.setUint32(4, 36 + n * 4, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 3, true); // IEEE float
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 4, true);
  dv.setUint16(32, 4, true);
  dv.setUint16(34, 32, true);
  w(36, 'data');
  dv.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) dv.setFloat32(44 + i * 4, samples[i]!, true);
  const blob = new Blob([buf], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * WaveformScope — records the REAL drum engine output and draws it, so you can SEE
 * (not theorize) what's in the bed vs the big-hit overlays. The whole point: the
 * leaked START-TRANSIENTS of the big hits living in the bed show up as visible
 * spikes in the BED-ONLY capture, lined up against the BIG-HITS-ONLY capture.
 *
 * It taps engine.instrumentGainNodes.get('audio-drums') with a ScriptProcessor
 * (the same tap the headless audits use) and stores up to a few seconds of mono
 * PCM. You record one layer, solo-switch, record the other, and the canvas overlays
 * them (bed in one colour, big hits in another) so the misalignment is obvious.
 */
function WaveformScope({
  getEngine,
  setSolo,
}: {
  getEngine: () => EngineLike | null;
  setSolo: (opts: { muteBed?: boolean; muteOverlays?: boolean }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Two stored captures we overlay: 'bed' (overlays muted) and 'hits' (bed muted).
  const capturesRef = useRef<{
    bed: Float32Array | null;
    hits: Float32Array | null;
    both: Float32Array | null;
  }>({ bed: null, hits: null, both: null });
  const tapRef = useRef<{
    proc: ScriptProcessorNode;
    ctx: AudioContext;
    node: AudioNode;
    sink: GainNode;
  } | null>(null);
  const recRef = useRef<{ chunks: Float32Array[]; on: boolean }>({
    chunks: [],
    on: false,
  });
  const [status, setStatus] = useState('idle');
  // Horizontal zoom is LOGARITHMIC: slider 0 = fully zoomed OUT (whole capture),
  // higher = zoom IN. Actual zoom factor = 2^(sliderH/10) so the range 0..70 spans
  // 1× (whole 2.5s) to ~128× (a single hit). Smooth in both directions.
  const [zoomH, setZoomH] = useState(0);
  const [vGain, setVGain] = useState(1); // vertical (amplitude) zoom — see small leaks
  const [offset, setOffset] = useState(0); // scroll 0..1 across the capture
  const [show, setShow] = useState({ bed: true, hits: true, both: false });
  const srRef = useRef(48000);
  const zoom = Math.pow(2, zoomH / 10); // 1× … ~128×

  // Attach the tap once (and clean up on unmount).
  const ensureTap = useCallback(() => {
    if (tapRef.current) return tapRef.current;
    const eng = getEngine();
    const ctx = WindowRegistry.getAudioContext();
    const node = eng?.instrumentGainNodes?.get?.('audio-drums');
    if (!eng || !ctx || !node) return null;
    srRef.current = ctx.sampleRate;
    let proc: ScriptProcessorNode;
    try {
      proc = ctx.createScriptProcessor(2048, 2, 1);
    } catch {
      return null;
    }
    proc.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!recRef.current.on) return;
      const l = e.inputBuffer.getChannelData(0);
      const r =
        e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : l;
      const o = new Float32Array(l.length);
      for (let i = 0; i < l.length; i++) o[i] = (l[i]! + r[i]!) / 2;
      recRef.current.chunks.push(o);
    };
    try {
      // The ScriptProcessor only fires while it's pulled by the graph, so it must
      // connect onward — but through a ZERO-gain sink so it adds NOTHING audible
      // (we're only reading its input, not summing its output back into the mix).
      const sink = ctx.createGain();
      sink.gain.value = 0;
      (node as AudioNode).connect(proc);
      proc.connect(sink);
      sink.connect(ctx.destination);
      tapRef.current = { proc, ctx, node, sink };
    } catch {
      return null;
    }
    return tapRef.current;
  }, [getEngine]);

  useEffect(() => {
    return () => {
      const t = tapRef.current;
      if (t) {
        try {
          t.node.disconnect(t.proc);
        } catch {
          /* ignore */
        }
        try {
          t.proc.disconnect();
        } catch {
          /* ignore */
        }
        try {
          t.sink.disconnect();
        } catch {
          /* ignore */
        }
        tapRef.current = null;
      }
    };
  }, []);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx2d = cv.getContext('2d');
    if (!ctx2d) return;
    const W = cv.width;
    const H = cv.height;
    ctx2d.clearRect(0, 0, W, H);
    // background + zero line
    ctx2d.fillStyle = '#0b0e16';
    ctx2d.fillRect(0, 0, W, H);
    ctx2d.strokeStyle = '#243';
    ctx2d.beginPath();
    ctx2d.moveTo(0, H / 2);
    ctx2d.lineTo(W, H / 2);
    ctx2d.stroke();

    const layers: Array<[keyof typeof show, Float32Array | null, string]> = [
      ['both', capturesRef.current.both, '#6b7280'],
      ['bed', capturesRef.current.bed, '#3fa0ff'],
      ['hits', capturesRef.current.hits, '#ff5d5d'],
    ];
    for (const [key, data, color] of layers) {
      if (!show[key] || !data || data.length === 0) continue;
      const total = data.length;
      const visible = Math.max(1, Math.round(total / zoom));
      const start = Math.min(total - visible, Math.round(offset * (total - visible)));
      ctx2d.strokeStyle = color;
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      // min/max per pixel column so transient spikes don't alias away.
      for (let px = 0; px < W; px++) {
        const s0 = start + Math.floor((px / W) * visible);
        const s1 = start + Math.floor(((px + 1) / W) * visible);
        let mn = 1;
        let mx = -1;
        for (let i = s0; i < Math.max(s0 + 1, s1) && i < total; i++) {
          const v = data[i]!;
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        // vGain amplifies the DISPLAY only (so tiny leaked transients become
        // visible), clamped to the canvas so loud hits don't draw off-screen.
        const yTop = clampY(H / 2 - mx * vGain * (H / 2) * 0.95, H);
        const yBot = clampY(H / 2 - mn * vGain * (H / 2) * 0.95, H);
        ctx2d.moveTo(px, yTop);
        ctx2d.lineTo(px, yBot);
      }
      ctx2d.stroke();
    }
  }, [show, zoom, vGain, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  const record = useCallback(
    async (which: 'bed' | 'hits' | 'both') => {
      const tap = ensureTap();
      if (!tap) {
        setStatus('no drum tap — START the groove first');
        return;
      }
      // Set the solo for this capture.
      if (which === 'bed') setSolo({ muteBed: false, muteOverlays: true });
      else if (which === 'hits') setSolo({ muteBed: true, muteOverlays: false });
      else setSolo({ muteBed: false, muteOverlays: false });
      setStatus(`recording ${which}…`);
      // small delay so the solo applies on the next iteration
      await new Promise((r) => setTimeout(r, 350));
      recRef.current.chunks = [];
      recRef.current.on = true;
      await new Promise((r) => setTimeout(r, 2500));
      recRef.current.on = false;
      // concat
      const chunks = recRef.current.chunks;
      let n = 0;
      for (const c of chunks) n += c.length;
      const all = new Float32Array(n);
      let o = 0;
      for (const c of chunks) {
        all.set(c, o);
        o += c.length;
      }
      capturesRef.current[which] = all;
      setStatus(`${which}: ${(n / srRef.current).toFixed(1)}s captured`);
      // restore "both" so playback sounds normal again after a solo capture
      setSolo({ muteBed: false, muteOverlays: false });
      draw();
    },
    [ensureTap, setSolo, draw],
  );

  const btn = (label: string, on: () => void, bg = '#1f2937') => (
    <button
      onClick={on}
      style={{
        flex: 1,
        padding: '6px 4px',
        fontSize: 11,
        borderRadius: 5,
        border: 0,
        background: bg,
        color: '#fff',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        margin: '8px 0 12px',
        padding: 8,
        background: '#0b0e16',
        borderRadius: 8,
        border: '1px solid #243049',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
        🔬 Waveform scope — real engine output
      </div>
      <canvas
        ref={canvasRef}
        width={420}
        height={140}
        style={{ width: '100%', height: 140, borderRadius: 4, display: 'block' }}
      />
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {btn('● Rec BED', () => record('bed'), '#1e4e7a')}
        {btn('● Rec BIG HITS', () => record('hits'), '#7a2e2e')}
        {btn('● Rec BOTH', () => record('both'), '#374151')}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {btn(
          show.bed ? 'BED ✓' : 'BED',
          () => setShow((s) => ({ ...s, bed: !s.bed })),
          show.bed ? '#1e4e7a' : '#1f2937',
        )}
        {btn(
          show.hits ? 'HITS ✓' : 'HITS',
          () => setShow((s) => ({ ...s, hits: !s.hits })),
          show.hits ? '#7a2e2e' : '#1f2937',
        )}
        {btn(
          show.both ? 'BOTH ✓' : 'BOTH',
          () => setShow((s) => ({ ...s, both: !s.both })),
          show.both ? '#374151' : '#1f2937',
        )}
      </div>
      {/* Download the captured WAVs so they can be inspected / shared. */}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {btn('⤓ bed.wav', () => {
          const d = capturesRef.current.bed;
          if (d) downloadWav(d, srRef.current, 'drum-bed.wav');
          else setStatus('record BED first');
        }, '#13324d')}
        {btn('⤓ hits.wav', () => {
          const d = capturesRef.current.hits;
          if (d) downloadWav(d, srRef.current, 'drum-bighits.wav');
          else setStatus('record BIG HITS first');
        }, '#4d1d1d')}
        {btn('⤓ both.wav', () => {
          const d = capturesRef.current.both;
          if (d) downloadWav(d, srRef.current, 'drum-both.wav');
          else setStatus('record BOTH first');
        }, '#262b33')}
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>
          H-zoom {zoom < 2 ? zoom.toFixed(2) : zoom.toFixed(0)}× (left = OUT / whole,
          right = IN / one hit)
        </div>
        <input
          type="range"
          min={0}
          max={70}
          step={0.5}
          value={zoomH}
          onChange={(e) => setZoomH(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#22c55e' }}
        />
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
          V-zoom (amplitude) {vGain.toFixed(1)}× — see tiny leaked transients
        </div>
        <input
          type="range"
          min={1}
          max={40}
          step={0.5}
          value={vGain}
          onChange={(e) => setVGain(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#e0b020' }}
        />
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
          scroll {(offset * 100).toFixed(0)}%
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.0005}
          value={offset}
          onChange={(e) => setOffset(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#3fa0ff' }}
        />
      </div>
      <div style={{ fontSize: 10, opacity: 0.65, marginTop: 4, lineHeight: 1.4 }}>
        {status}. Blue = BED (overlays muted), Red = BIG HITS (bed muted). Record
        each, then ZOOM into a hit: the bed&apos;s leaked start-transient shows as a
        blue spike where only red should be. Settle into the bed first (nudge to a
        slow tempo, let it land). Use ⤓ to download a capture and send me the path.
      </div>
    </div>
  );
}

export function DrumGapFillAdminPanel() {
  // Gate decision depends on `window` (URL query / env), so it MUST NOT run
  // during SSR or the first client render — doing so renders the panel on the
  // client but null on the server → a hydration mismatch. Start disabled
  // (matches the server's null), then enable after mount.
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (isDrumAdminPanelEnabled()) setEnabled(true);
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const [armed, setArmed] = useState(false); // is a DrumSlicePlayer present?
  const [qualifying, setQualifying] = useState(0); // legacy fill count
  const [textureRegions, setTextureRegions] = useState(0); // WSOLA region count
  const [solo, setSolo] = useState(false);
  const [soloBigHits, setSoloBigHits] = useState(false); // mute bed → hear overlays
  const [soloBed, setSoloBed] = useState(false); // mute overlays → hear bed
  const [showLegacy, setShowLegacy] = useState(false); // collapse old synth fill
  // τ / grain "auto" means: send undefined → buildExtendedTail fits per-slice.
  const [tauAuto, setTauAuto] = useState(true);
  const [grainAuto, setGrainAuto] = useState(true);
  // Link the OVERLAY span and the BED-NOTCH span (move together). ON = the "glued"
  // unified behaviour (notch = overlay); OFF = blend the two layers independently.
  const [linkBigHit, setLinkBigHit] = useState(true);
  const [p, setP] = useState<GapFillParams>({
    gapFill: false,
    minGapToFillSeconds: 0.04,
    fillTransientGuardSeconds: 0.018,
    minFillSeconds: 0.03,
    fadeOutSeconds: 0.012,
    maxFillConfidence: 0.6,
    sustainTauSeconds: 0.06,
    sustainGrainSeconds: 0.045,
    wsola: true,
    strongConfidenceThreshold: 0.3,
    wsolaWindowSeconds: 0.025,
    wsolaHopFraction: 0.1,
    wsolaSearchSeconds: 0.006,
    transientBodySeconds: 0.21,
    transientDuckDepth: 1.0,
    bedTransientNotch: 1.0,
    bedNotchSeconds: 0.09,
    transientBlendSeconds: 0.115,
    transientDuckAttackSeconds: 0,
    bigHitPreSeconds: 0.012,
    bigHitTailSeconds: 0.18,
    bedNotchPreSeconds: 0.012,
    bedNotchTailSeconds: 0.18,
    hitPreRollSeconds: 0,
    hitStartLevel: 0,
    hitPeakLevel: 1,
    hitEndLevel: 0,
    hitAttackSeconds: 0,
    hitReleaseSeconds: 0,
    hitStartNudgeSeconds: 0,
    hitEndNudgeSeconds: 0,
    transientLengthSeconds: 0,
    slicePreRollSeconds: 0.003,
    sliceFadeInSeconds: 0.002,
    sliceFadeOutSeconds: 0.012,
    sliceTailTrimSeconds: 0,
    settleMs: 350,
    xfadeToBedSeconds: 0.15,
    xfadeToSlicesSeconds: 0.15,
  });

  // Mirror the full applied config in a ref so the poll loop can re-push it onto
  // a freshly-armed player WITHOUT a stale closure (settings survive a re-play).
  const appliedRef = useRef<{
    p: GapFillParams;
    tauAuto: boolean;
    grainAuto: boolean;
    solo: boolean;
  }>({ p, tauAuto, grainAuto, solo });
  appliedRef.current = { p, tauAuto, grainAuto, solo };

  // Push the panel's current config onto whatever player is live now.
  const reapply = useCallback(() => {
    const engine = getEngine();
    if (!engine) return;
    const { p: cur, tauAuto: ta, grainAuto: ga, solo: so } = appliedRef.current;
    engine.setDrumWsola?.(cur.wsola);
    engine.setDrumGapFill?.(cur.gapFill);
    engine.setDrumGapFillParams?.({
      minGapToFillSeconds: cur.minGapToFillSeconds,
      fillTransientGuardSeconds: cur.fillTransientGuardSeconds,
      minFillSeconds: cur.minFillSeconds,
      fadeOutSeconds: cur.fadeOutSeconds,
      maxFillConfidence: cur.maxFillConfidence,
      sustainTauSeconds: ta ? undefined : cur.sustainTauSeconds,
      sustainGrainSeconds: ga ? undefined : cur.sustainGrainSeconds,
      strongConfidenceThreshold: cur.strongConfidenceThreshold,
      wsolaWindowSeconds: cur.wsolaWindowSeconds,
      wsolaHopFraction: cur.wsolaHopFraction,
      wsolaSearchSeconds: cur.wsolaSearchSeconds,
      transientBodySeconds: cur.transientBodySeconds,
      transientDuckDepth: cur.transientDuckDepth,
      bedTransientNotch: cur.bedTransientNotch,
      bedNotchSeconds: cur.bedNotchSeconds,
      transientBlendSeconds: cur.transientBlendSeconds,
      transientDuckAttackSeconds: cur.transientDuckAttackSeconds,
      bigHitPreSeconds: cur.bigHitPreSeconds,
      bigHitTailSeconds: cur.bigHitTailSeconds,
      bedNotchPreSeconds: cur.bedNotchPreSeconds,
      bedNotchTailSeconds: cur.bedNotchTailSeconds,
      hitPreRollSeconds: cur.hitPreRollSeconds,
      hitStartLevel: cur.hitStartLevel,
      hitPeakLevel: cur.hitPeakLevel,
      hitEndLevel: cur.hitEndLevel,
      hitAttackSeconds: cur.hitAttackSeconds,
      hitReleaseSeconds: cur.hitReleaseSeconds,
      hitStartNudgeSeconds: cur.hitStartNudgeSeconds,
      hitEndNudgeSeconds: cur.hitEndNudgeSeconds,
      transientLengthSeconds: cur.transientLengthSeconds,
      slicePreRollSeconds: cur.slicePreRollSeconds,
      sliceFadeInSeconds: cur.sliceFadeInSeconds,
      sliceFadeOutSeconds: cur.sliceFadeOutSeconds,
      sliceTailTrimSeconds: cur.sliceTailTrimSeconds,
      settleMs: cur.settleMs,
      xfadeToBedSeconds: cur.xfadeToBedSeconds,
      xfadeToSlicesSeconds: cur.xfadeToSlicesSeconds,
    });
    engine.setInstrumentMuted?.('audio-bass', so);
    engine.setInstrumentMuted?.('audio-harmony', so);
  }, []);

  // Poll the engine: detect arm/re-arm, refresh the qualifying-fill count. On
  // the FIRST ever arm, seed our controls from the engine's live values; on
  // every SUBSEQUENT (re)arm — a fresh player from a re-play — re-push our
  // config so the user's tuning isn't lost.
  const everSeededRef = useRef(false);
  const wasArmedRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const engine = getEngine();
      const state = engine?.getDrumGapFillState?.() ?? null;
      if (!state) {
        setArmed(false);
        wasArmedRef.current = false;
        return;
      }
      setArmed(true);
      setQualifying(state.qualifyingFills);
      setTextureRegions(state.textureRegions ?? 0);
      if (!everSeededRef.current) {
        everSeededRef.current = true;
        wasArmedRef.current = true;
        const live = state.params;
        setP((prev) => ({
          ...prev,
          ...live,
          // keep our display defaults when the engine reports "auto" (undefined)
          sustainTauSeconds: live.sustainTauSeconds ?? prev.sustainTauSeconds,
          sustainGrainSeconds:
            live.sustainGrainSeconds ?? prev.sustainGrainSeconds,
        }));
        setTauAuto(live.sustainTauSeconds == null);
        setGrainAuto(live.sustainGrainSeconds == null);
      } else if (!wasArmedRef.current) {
        // Re-armed (new player) after a previous arm — re-push our config.
        wasArmedRef.current = true;
        reapply();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled, reapply]);

  // Push a partial patch to the live engine + mirror into local state.
  const patch = useCallback((next: Partial<GapFillParams>) => {
    setP((prev) => ({ ...prev, ...next }));
    getEngine()?.setDrumGapFillParams?.(next);
  }, []);

  const toggleGapFill = useCallback(
    (on: boolean) => {
      setP((prev) => ({ ...prev, gapFill: on }));
      const engine = getEngine();
      // setDrumGapFill builds fills lazily on first enable; setDrumGapFillParams
      // also accepts gapFill, but use the dedicated toggle to match its lazy path.
      engine?.setDrumGapFill?.(on);
    },
    [],
  );

  const toggleWsola = useCallback((on: boolean) => {
    setP((prev) => ({ ...prev, wsola: on }));
    getEngine()?.setDrumWsola?.(on);
  }, []);

  // Diagnostic solo: mute bed (hear only crisp overlaid kicks/snares) or mute
  // overlays (hear only the stretched bed texture). Mutually exclusive.
  const toggleSoloBigHits = useCallback((on: boolean) => {
    setSoloBigHits(on);
    if (on) setSoloBed(false);
    getEngine()?.setDrumDiagnosticSolo?.({
      muteBed: on,
      muteOverlays: on ? false : undefined,
    });
  }, []);
  const toggleSoloBed = useCallback((on: boolean) => {
    setSoloBed(on);
    if (on) setSoloBigHits(false);
    getEngine()?.setDrumDiagnosticSolo?.({
      muteOverlays: on,
      muteBed: on ? false : undefined,
    });
  }, []);
  // Raw solo passthrough for the WaveformScope (it manages its own bed/hits/both
  // capture sequencing; just forward the diagnostic solo to the engine).
  const scopeSolo = useCallback(
    (opts: { muteBed?: boolean; muteOverlays?: boolean }) => {
      getEngine()?.setDrumDiagnosticSolo?.(opts);
    },
    [],
  );

  const toggleSolo = useCallback((on: boolean) => {
    setSolo(on);
    const engine = getEngine();
    engine?.setInstrumentMuted?.('audio-bass', on);
    engine?.setInstrumentMuted?.('audio-harmony', on);
  }, []);

  const setTauAutoMode = useCallback(
    (auto: boolean) => {
      setTauAuto(auto);
      // auto → clear the override (undefined); manual → send the slider value.
      getEngine()?.setDrumGapFillParams?.({
        sustainTauSeconds: auto ? undefined : p.sustainTauSeconds,
      });
    },
    [p.sustainTauSeconds],
  );

  const setGrainAutoMode = useCallback(
    (auto: boolean) => {
      setGrainAuto(auto);
      getEngine()?.setDrumGapFillParams?.({
        sustainGrainSeconds: auto ? undefined : p.sustainGrainSeconds,
      });
    },
    [p.sustainGrainSeconds],
  );

  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 2147483000,
        width: collapsed ? 'auto' : 300,
        maxHeight: '85vh',
        overflowY: 'auto',
        background: 'rgba(17,17,20,0.96)',
        color: '#e6e6e6',
        border: '1px solid #2e2e36',
        borderRadius: 10,
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12,
        padding: collapsed ? '8px 12px' : 14,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          gap: 10,
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ fontWeight: 700, letterSpacing: 0.3 }}>
          🥁 Drum Stretch
        </span>
        <span style={{ color: '#8a8a8a', fontSize: 11 }}>
          {armed ? `${textureRegions} hits` : 'no player'}{' '}
          {collapsed ? '▸' : '▾'}
        </span>
      </div>

      {collapsed ? null : (
        <div style={{ marginTop: 12 }}>
          {!armed ? (
            <div style={{ color: '#d99', marginBottom: 10, fontSize: 11 }}>
              Press play on a Groove Card to arm the drum slicer, then tune here.
            </div>
          ) : null}

          {/* Live waveform scope — SEE the bed vs big-hit layers from the REAL
              engine output (the leaked start-transients show up here). */}
          <WaveformScope getEngine={getEngine} setSolo={scopeSolo} />

          {/* WSOLA master toggle — the real slow-tempo hi-hat fix */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={p.wsola}
              onChange={(e) => toggleWsola(e.target.checked)}
              style={{ accentColor: '#22c55e' }}
            />
            <span style={{ fontWeight: 600 }}>
              Smooth stretch (WSOLA) {p.wsola ? 'ON' : 'OFF'}
            </span>
          </label>
          <div
            style={{
              fontSize: 9.5,
              color: '#8a8a8a',
              marginBottom: 12,
              lineHeight: 1.3,
            }}
          >
            Stretches the WHOLE loop smoothly (no silent gaps) and overlays
            bit-exact kick/snare attacks on top — the big hits stay crisp,
            everything else slows/speeds continuously.
          </div>

          {/* Solo drums — A/B against the dry slicer */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={solo}
              onChange={(e) => toggleSolo(e.target.checked)}
              style={{ accentColor: '#22c55e' }}
            />
            <span style={{ fontWeight: 600 }}>Solo drums</span>
            <span style={{ color: '#8a8a8a', fontSize: 10 }}>
              (mutes bass + harmony)
            </span>
          </label>

          {/* DIAGNOSTIC: solo the bed vs the overlays to localize a double */}
          <div
            style={{
              border: '1px solid #3a3320',
              background: 'rgba(224,161,6,0.06)',
              borderRadius: 6,
              padding: '8px 10px',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#e0a106',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Diagnose a double (solo a layer)
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={soloBigHits}
                onChange={(e) => toggleSoloBigHits(e.target.checked)}
                style={{ accentColor: '#e0a106' }}
              />
              <span style={{ fontWeight: 600 }}>Only big hits</span>
              <span style={{ color: '#8a8a8a', fontSize: 10 }}>
                (mute bed → crisp kicks/snares only)
              </span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={soloBed}
                onChange={(e) => toggleSoloBed(e.target.checked)}
                style={{ accentColor: '#e0a106' }}
              />
              <span style={{ fontWeight: 600 }}>Only bed</span>
              <span style={{ color: '#8a8a8a', fontSize: 10 }}>
                (mute overlays → stretched texture only)
              </span>
            </label>
            <div style={{ fontSize: 9.5, color: '#8a8a8a', marginTop: 6, lineHeight: 1.3 }}>
              If the double is in &ldquo;Only bed&rdquo; → the bed isn&rsquo;t
              removing the hit. If &ldquo;Only big hits&rdquo; is clean but the
              full mix doubles → bed/overlay timing.
            </div>
          </div>

          {/* WSOLA tuning */}
          <div
            style={{
              borderTop: '1px solid #2e2e36',
              paddingTop: 10,
              marginBottom: 14,
              opacity: p.wsola ? 1 : 0.5,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#8a8a8a',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Transient overlay (live — no rebuild)
            </div>

            <SliderRow
              label="Big-hit threshold"
              hint="Which onsets get a crisp BIT-EXACT attack overlaid on the smooth bed. At/above = kick/snare (overlaid sharp). Lower → more hits get the crisp overlay; raise if a hat starts sounding doubled. The headline knob."
              value={p.strongConfidenceThreshold}
              min={0.1}
              max={1}
              step={0.05}
              format={(v) => v.toFixed(2)}
              disabled={!p.wsola}
              onChange={(v) => patch({ strongConfidenceThreshold: v })}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                margin: '12px 0 4px',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: '#8a8a8a',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                ★ Big-hit region (overlay vs bed notch)
              </span>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  cursor: 'pointer',
                  color: linkBigHit ? '#9be9a8' : '#9a9a9a',
                }}
              >
                <input
                  type="checkbox"
                  checked={linkBigHit}
                  onChange={(e) => setLinkBigHit(e.target.checked)}
                  style={{ accentColor: '#22c55e' }}
                />
                🔗 link
              </label>
            </div>
            <div
              style={{
                fontSize: 10,
                color: '#9a9a9a',
                margin: '0 0 8px',
                lineHeight: 1.4,
              }}
            >
              Two layers: the OVERLAY (the crisp hit you hear) and the BED NOTCH (the
              hole cut in the bed). 🔗 link ON = they move together (notch = overlay,
              the &quot;glued&quot; clean default). 🔗 OFF = blend them independently —
              e.g. notch a wider hole than the overlay tail, or let the hit ring past
              the notch. PRE catches the attack blip; TAIL swallows the body. (Bed
              notch rebuilds on change.)
            </div>

            <div style={{ fontSize: 10, color: '#7a9', margin: '4px 0 2px' }}>
              OVERLAY — the crisp big hit
            </div>
            <SliderRow
              label="① Overlay PRE (lead-in)"
              hint="How far BEFORE the onset the OVERLAY begins reading. Raise to let more of the attack front into the hit."
              value={p.bigHitPreSeconds}
              min={0}
              max={0.04}
              step={0.001}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) =>
                patch(
                  linkBigHit
                    ? { bigHitPreSeconds: v, bedNotchPreSeconds: v }
                    : { bigHitPreSeconds: v },
                )
              }
            />
            <SliderRow
              label="② Overlay TAIL (length)"
              hint="How long the OVERLAY plays — the hit + its tail the user hears. Independent of the notch when unlinked: make it shorter (snappier hit) or longer (more ring) than the bed hole."
              value={p.bigHitTailSeconds}
              min={0.02}
              max={0.3}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) =>
                patch(
                  linkBigHit
                    ? { bigHitTailSeconds: v, bedNotchTailSeconds: v }
                    : { bigHitTailSeconds: v },
                )
              }
            />

            <div style={{ fontSize: 10, color: '#7a9', margin: '6px 0 2px' }}>
              BED NOTCH — the hole cut in the bed (rebuilds)
            </div>
            <SliderRow
              label="③ Notch PRE (start before onset)"
              hint="How far BEFORE the onset the bed is notched. Raise until the little attack-front BLIP at the start of the bed dip is gone (the kick/snare front the notch started too late to remove)."
              value={p.bedNotchPreSeconds}
              min={0}
              max={0.04}
              step={0.001}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) =>
                patch(
                  linkBigHit
                    ? { bedNotchPreSeconds: v, bigHitPreSeconds: v }
                    : { bedNotchPreSeconds: v },
                )
              }
            />
            <SliderRow
              label="④ Notch TAIL (length)"
              hint="How far AFTER the onset the bed is notched out. Raise until the big slow BODY-WAVE in the bed (the sub-bass kick tail) is gone. Independent of the overlay when unlinked — you can cut a wider hole than the hit fills, or vice-versa, to blend the seam."
              value={p.bedNotchTailSeconds}
              min={0.02}
              max={0.3}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) =>
                patch(
                  linkBigHit
                    ? { bedNotchTailSeconds: v, bigHitTailSeconds: v }
                    : { bedNotchTailSeconds: v },
                )
              }
            />

            <div style={{ fontSize: 10, color: '#7a9', margin: '6px 0 2px' }}>
              BIG-HIT envelope — START side
            </div>
            <SliderRow
              label="Look-ahead (pre-transient)"
              hint="How much audio BEFORE the onset the big hit reads — the pre-attack material. Raise to let in more of the kick's body before the hit. 0 = engine default."
              value={p.hitPreRollSeconds}
              min={0}
              max={0.06}
              step={0.001}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ hitPreRollSeconds: v })}
            />
            <SliderRow
              label="Start nudge (± time)"
              hint="Move WHEN the big hit BEGINS, relative to the onset. Negative = start earlier (anticipate), positive = start later (delay). ± in time."
              value={p.hitStartNudgeSeconds}
              min={-0.05}
              max={0.05}
              step={0.002}
              unit="ms"
              format={(v) => `${v >= 0 ? '+' : ''}${Math.round(v * 1000)}`}
              disabled={!p.wsola}
              onChange={(v) => patch({ hitStartNudgeSeconds: v })}
            />
            <SliderRow
              label="Start level"
              hint="Gain the big hit STARTS at (0–100%). 0% = fade up from silence; raise to start partway up (less of an attack ramp)."
              value={p.hitStartLevel}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              disabled={!p.wsola}
              onChange={(v) => patch({ hitStartLevel: v })}
            />
            <SliderRow
              label="Attack (fade-in length)"
              hint="How LONG the big hit ramps from Start level up to Peak — the attack slope. Short = sharp/clicky (blip), longer = softer. THE blip shaper."
              value={p.hitAttackSeconds}
              min={0}
              max={0.06}
              step={0.001}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ hitAttackSeconds: v })}
            />
            <SliderRow
              label="Peak level"
              hint="The TOP gain the big hit reaches after the attack (0–100%). Lower it to make the big hits sit quieter under the bed."
              value={p.hitPeakLevel}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              disabled={!p.wsola}
              onChange={(v) => patch({ hitPeakLevel: v })}
            />
            <div style={{ fontSize: 10, color: '#7a9', margin: '6px 0 2px' }}>
              BIG-HIT envelope — END side
            </div>
            <SliderRow
              label="Length (let-through)"
              hint="How long the big hit plays before it ends. 0 = AUTO (covers the bed notch). >0 = manual exact length. Sets where the END point sits (then nudge/release below shape it)."
              value={p.transientLengthSeconds}
              min={0}
              max={0.4}
              step={0.005}
              unit="ms"
              format={(v) => (v === 0 ? 'auto' : `${Math.round(v * 1000)}`)}
              disabled={!p.wsola}
              onChange={(v) => patch({ transientLengthSeconds: v })}
            />
            <SliderRow
              label="End nudge (± time)"
              hint="Move WHEN the big hit ENDS. Negative = cut sooner, positive = ring longer (prolong the tail in time). ± in time."
              value={p.hitEndNudgeSeconds}
              min={-0.1}
              max={0.2}
              step={0.005}
              unit="ms"
              format={(v) => `${v >= 0 ? '+' : ''}${Math.round(v * 1000)}`}
              disabled={!p.wsola}
              onChange={(v) => patch({ hitEndNudgeSeconds: v })}
            />
            <SliderRow
              label="Release (tail fade length)"
              hint="How LONG the big hit fades from Peak down to End level — the TAIL fade. Long = a gradual ring-out (prolonged tail); short = a quick cut. 0 = use the bed blend."
              value={p.hitReleaseSeconds}
              min={0}
              max={0.3}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ hitReleaseSeconds: v })}
            />
            <SliderRow
              label="End level"
              hint="Gain the big hit ENDS at (0–100%). 0% = fades fully out; raise to leave the hit sustaining at a level into the bed instead of dropping to silence."
              value={p.hitEndLevel}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              disabled={!p.wsola}
              onChange={(v) => patch({ hitEndLevel: v })}
            />
            <SliderRow
              label="Bed duck depth"
              hint="How far the bed dips UNDER each crisp attack (the floor of the crossfade). 100% = no dip (full blend, bed stays up); lower = bed drops more. Raise toward 100% if the ducking sounds too prominent / holey."
              value={p.transientDuckDepth}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              disabled={!p.wsola}
              onChange={(v) => patch({ transientDuckDepth: v })}
            />
            <SliderRow
              label="④ Bed duck-in (going-in)"
              hint="BED side: how slowly the bed ducks DOWN going INTO each hit. 0 = symmetric with the bed fade-in below. Raise to ease the bed out of the way gently before the kick (no spike going in). Shapes the BED, not the kick — pair with ① ② to fully smooth the entry."
              value={p.transientDuckAttackSeconds}
              min={0}
              max={0.2}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ transientDuckAttackSeconds: v })}
            />
            <SliderRow
              label="⑤ Bed fade-in (to transient)"
              hint="BED side: how much / how gradually the bed fades BACK UP after the hit, blending the END of the transient into the bed. Wider = the bed recovers more gradually. This is 'how much bed we fade into the transient' — the coming-out blend."
              value={p.transientBlendSeconds}
              min={0.005}
              max={0.15}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ transientBlendSeconds: v })}
            />
            <SliderRow
              label="Remove hits from bed"
              hint="Cuts the kick/snare BODY out of the smooth bed before stretching, so the stretch can't duplicate it elsewhere (the 'doubled body, no transient' artifact). 100% = bodies fully removed; the crisp overlays carry all the punch. Drop toward 0% to hear the old full-bed behavior. (rebuilds)"
              value={p.bedTransientNotch}
              min={0}
              max={1}
              step={0.1}
              format={(v) => `${Math.round(v * 100)}%`}
              disabled={!p.wsola}
              onChange={(v) => patch({ bedTransientNotch: v })}
            />

            <div
              style={{
                fontSize: 10,
                color: '#8a8a8a',
                margin: '14px 0 8px',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              SLICES ↔ BED transition (live — no rebuild)
            </div>
            <SliderRow
              label="Settle delay"
              hint="How long after you STOP nudging before the drums cross from the crisp per-slice draft into the smooth bed. Shorter = bed comes back faster after you let go; longer = stays on slices a bit so quick re-nudges don't keep flipping to the bed."
              value={p.settleMs}
              min={100}
              max={800}
              step={25}
              unit="ms"
              format={(v) => `${Math.round(v)}`}
              disabled={!p.wsola}
              onChange={(v) => patch({ settleMs: v })}
            />
            <SliderRow
              label="Settle crossfade (SLICES→BED)"
              hint="Length of the equal-power crossfade when SETTLING into the bed (after you stop nudging). Longer = a more gradual landing; shorter (≈20ms) = a near-instant switch that's less likely to dip a kick/snare landing mid-fade — but can snap. The settle-in 'feel' knob."
              value={p.xfadeToBedSeconds}
              min={0.01}
              max={0.3}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ xfadeToBedSeconds: v })}
            />
            <SliderRow
              label="Nudge crossfade (BED→SLICES)"
              hint="Length of the crossfade when you START nudging again (leaving the bed → back to slices). Keep SHORT (≈40-80ms) so slices take over instantly and track the tempo without lag. The 'coming OUT of bed' knob — raise it if the exit clicks, lower it if slices feel laggy when you grab the tempo."
              value={p.xfadeToSlicesSeconds}
              min={0.02}
              max={0.2}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ xfadeToSlicesSeconds: v })}
            />

            <div
              style={{
                fontSize: 10,
                color: '#8a8a8a',
                margin: '14px 0 8px',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              SLICE seam — the home-tempo / while-nudging flam
            </div>
            <div
              style={{
                fontSize: 10,
                color: '#9a9a9a',
                margin: '0 0 8px',
                lineHeight: 1.4,
              }}
            >
              These shape the join BETWEEN adjacent bit-exact slices — the path
              that plays at the ORIGINAL tempo and WHILE you drag tempo (NOT the
              bed). The &quot;two hits / flam&quot; at 109 lives here: each slice
              reads a little BEFORE its onset (pre-roll) and its tail runs toward
              the next onset, so the few ms before every hit can get played twice.
              Always active (independent of the bed / Smooth-stretch toggle).
            </div>
            <SliderRow
              label="Slice tail trim (flam killer)"
              hint="THE flam knob. Cuts the END off each slice so it can't overlap the NEXT slice's pre-roll. 0 = tail meets the next slice exactly (where the doubling comes from). Raise it to open a small gap before each hit → the doubled pre-attack disappears. Too high = you start hearing the cut / lose tail. Dial up from 0 until the flam at home tempo is gone."
              value={p.sliceTailTrimSeconds}
              min={-0.01}
              max={0.05}
              step={0.001}
              unit="ms"
              format={MS}
              onChange={(v) => patch({ sliceTailTrimSeconds: v })}
            />
            <SliderRow
              label="Slice pre-roll (lead-in)"
              hint="How much audio each slice reads BEFORE its onset so the attack front survives the fade-in. Smaller = less of the pre-attack overlaps the previous tail (less flam, but the very front of the hit can soften). 0 = no lead-in. Works together with tail trim — they define the seam width."
              value={p.slicePreRollSeconds}
              min={0}
              max={0.012}
              step={0.0005}
              unit="ms"
              format={MS}
              onChange={(v) => patch({ slicePreRollSeconds: v })}
            />
            <SliderRow
              label="Slice fade-in (declick)"
              hint="Attack declick ramp at the START of each slice. Tiny (≈2ms). Too long softens the punch; 0 can click. Mostly leave alone — it's here so you can rule it out as the flam source."
              value={p.sliceFadeInSeconds}
              min={0}
              max={0.02}
              step={0.0005}
              unit="ms"
              format={MS}
              onChange={(v) => patch({ sliceFadeInSeconds: v })}
            />
            <SliderRow
              label="Slice fade-out (declick)"
              hint="Tail declick ramp at the END of each slice (the crossfade into the next). Wider = smoother seam but more overlap with the next slice (can thicken / double); narrower = tighter but can click. Pair with tail trim: trim opens the gap, fade-out smooths the edge."
              value={p.sliceFadeOutSeconds}
              min={0}
              max={0.04}
              step={0.0005}
              unit="ms"
              format={MS}
              onChange={(v) => patch({ sliceFadeOutSeconds: v })}
            />

            <div
              style={{
                fontSize: 10,
                color: '#8a8a8a',
                margin: '14px 0 8px',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Bed quality (rebuilds on change)
            </div>
            <SliderRow
              label="Window"
              hint="WSOLA analysis window. Bigger = smoother bed; smaller = crisper but more flutter risk."
              value={p.wsolaWindowSeconds}
              min={0.02}
              max={0.08}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ wsolaWindowSeconds: v })}
            />
            <SliderRow
              label="Overlap (hop fraction)"
              hint="Synthesis hop as a fraction of the window. 0.25 = 75% overlap (COLA, no flutter). Smaller = denser/smoother, heavier."
              value={p.wsolaHopFraction}
              min={0.1}
              max={0.5}
              step={0.05}
              format={(v) => `${Math.round((1 - v) * 100)}% ov`}
              disabled={!p.wsola}
              onChange={(v) => patch({ wsolaHopFraction: v })}
            />
            <SliderRow
              label="Search radius"
              hint="Cross-correlation lag search. Bigger finds a better in-phase window (less comb) but costs CPU."
              value={p.wsolaSearchSeconds}
              min={0.004}
              max={0.02}
              step={0.002}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ wsolaSearchSeconds: v })}
            />
          </div>

          {/* Legacy synth fill — superseded by WSOLA, collapsed by default */}
          <div
            style={{
              fontSize: 10,
              color: '#6a6a6a',
              cursor: 'pointer',
              marginBottom: showLegacy ? 8 : 0,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
            onClick={() => setShowLegacy((s) => !s)}
          >
            {showLegacy ? '▾' : '▸'} Legacy synth fill (superseded)
          </div>

          {!showLegacy ? null : (
          <>
          {/* gapFill master toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={p.gapFill}
              onChange={(e) => toggleGapFill(e.target.checked)}
              style={{ accentColor: '#22c55e' }}
            />
            <span style={{ fontWeight: 600 }}>
              Gap-fill {p.gapFill ? 'ON' : 'OFF'}{' '}
              <span style={{ color: '#8a8a8a', fontWeight: 400 }}>
                ({qualifying} fills)
              </span>
            </span>
          </label>

          <div
            style={{
              borderTop: '1px solid #2e2e36',
              paddingTop: 10,
              opacity: p.gapFill ? 1 : 0.5,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#8a8a8a',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Sustain (DSP — rebuilds fills)
            </div>

            {/* τ — the headline knob */}
            <div style={{ marginBottom: 4 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  color: '#8a8a8a',
                  marginBottom: 2,
                }}
              >
                <input
                  type="checkbox"
                  checked={tauAuto}
                  onChange={(e) => setTauAutoMode(e.target.checked)}
                  style={{ accentColor: '#22c55e' }}
                />
                decay τ: fit per-slice (auto)
              </label>
            </div>
            <SliderRow
              label="Decay τ"
              hint="Bigger = the fill sustains longer (bridges the gap) but risks a noise pad. Smaller = a short natural-decay wisp."
              value={p.sustainTauSeconds ?? 0.06}
              min={0.02}
              max={0.6}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.gapFill || tauAuto}
              onChange={(v) => patch({ sustainTauSeconds: v })}
            />

            <div style={{ marginBottom: 4 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  color: '#8a8a8a',
                  marginBottom: 2,
                }}
              >
                <input
                  type="checkbox"
                  checked={grainAuto}
                  onChange={(e) => setGrainAutoMode(e.target.checked)}
                  style={{ accentColor: '#22c55e' }}
                />
                grain: default (auto)
              </label>
            </div>
            <SliderRow
              label="Grain size"
              hint="Granular window. Bigger = smoother/denser bed; too big colours the noise."
              value={p.sustainGrainSeconds ?? 0.045}
              min={0.01}
              max={0.12}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.gapFill || grainAuto}
              onChange={(v) => patch({ sustainGrainSeconds: v })}
            />

            <SliderRow
              label="Max fill confidence"
              hint="Skip fills on hits LOUDER than this (kicks/snares). Higher = more slices qualify; too high fills primary transients = false pulse."
              value={p.maxFillConfidence}
              min={0.1}
              max={1}
              step={0.05}
              format={(v) => v.toFixed(2)}
              disabled={!p.gapFill}
              onChange={(v) => patch({ maxFillConfidence: v })}
            />

            <div
              style={{
                fontSize: 10,
                color: '#8a8a8a',
                margin: '12px 0 8px',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Scheduling (live — no rebuild)
            </div>

            <SliderRow
              label="Min gap to fill"
              hint="Only fill when the real silent gap after a slice exceeds this."
              value={p.minGapToFillSeconds}
              min={0.01}
              max={0.3}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.gapFill}
              onChange={(v) => patch({ minGapToFillSeconds: v })}
            />
            <SliderRow
              label="Transient guard"
              hint="Stop the fill this long before the next onset so its fade-out clears the next hit's attack."
              value={p.fillTransientGuardSeconds}
              min={0.004}
              max={0.06}
              step={0.002}
              unit="ms"
              format={MS}
              disabled={!p.gapFill}
              onChange={(v) => patch({ fillTransientGuardSeconds: v })}
            />
            <SliderRow
              label="Min fill length"
              hint="Don't bother filling a hole shorter than this."
              value={p.minFillSeconds}
              min={0.01}
              max={0.2}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.gapFill}
              onChange={(v) => patch({ minFillSeconds: v })}
            />
            <SliderRow
              label="Crossfade (fade in/out)"
              hint="Fade-in overlaps the slice's fade-out; fade-out ducks before the next onset."
              value={p.fadeOutSeconds}
              min={0.002}
              max={0.05}
              step={0.002}
              unit="ms"
              format={MS}
              disabled={!p.gapFill}
              onChange={(v) => patch({ fadeOutSeconds: v })}
            />
          </div>
          </>
          )}

          <div style={{ fontSize: 9.5, color: '#6a6a6a', marginTop: 12 }}>
            Slow the tempo below default (ratio &lt; 1) to hear the texture
            stretch — it only acts on a slowdown. Toggle Solo drums to A/B WSOLA
            on vs off.
          </div>
        </div>
      )}
    </div>
  );
}

export default DrumGapFillAdminPanel;
