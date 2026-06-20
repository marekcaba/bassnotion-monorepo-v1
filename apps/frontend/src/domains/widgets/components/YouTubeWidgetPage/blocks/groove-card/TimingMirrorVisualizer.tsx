'use client';

/**
 * TimingMirrorVisualizer — SHOW the bass-coach analysis, don't just print numbers.
 * Two stacked waveform lanes (reference stem on top, your take below) over a shared
 * time axis (the loop, in audio-ctx seconds), with:
 *   - the beat grid (faint vertical lines)
 *   - detected TRANSIENTS as ticks on each lane (what the onset detector found)
 *   - the ALIGNMENT: green = matched pair (line connecting ref↔player), amber =
 *     reference note MISSED, red = player onset rejected as NOISE.
 * So you can see exactly where things line up, where the detector over/under-fired,
 * and why the score is what it is. Dev tool — drawn to a <canvas>.
 */

import { useEffect, useRef, useState } from 'react';
import type { GridParams } from './timing-mirror/scoreAgainstGrid';
import type { ReferenceScore } from './timing-mirror/scoreAgainstReference';

export interface VizData {
  grid: GridParams;
  playerSignal: Float32Array;
  playerSampleRate: number;
  /** audioContext.currentTime when the player capture started (buffer-rel → ctx). */
  playerStartedAt: number;
  /** player onsets in ctx-time seconds (already absolute). */
  playerOnsetsSec: number[];
  refSignal: Float32Array;
  refSampleRate: number;
  /** reference onsets in ctx-time seconds (loopStart + bufferTime/R). */
  refOnsetsSec: number[];
  /** stretch ratio currentBpm/originalBpm — maps ref buffer time → ctx time. */
  R: number;
  score: ReferenceScore;
}

const LANE_H = 90;
const GAP = 26;
const PAD = 8;
const COL = {
  bg: '#0a0b0e',
  grid: '#23262f',
  beat: '#33384a',
  wave: '#5b657a',
  refTick: '#6ad08c',
  playerTick: '#7aa2ff',
  matched: '#6ad08c',
  missed: '#e0b24a',
  noise: '#e0604a',
  text: '#9aa0ad',
};

export function TimingMirrorVisualizer({ data }: { data: VizData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = 2 * LANE_H + GAP + 2 * PAD + 28; // +label strip
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, cssW, cssH);

    const { grid } = data;
    const t0 = grid.loopStartAudioTime;
    // Show one full loop (or a bit more to catch trailing notes).
    const loopDur = grid.loopDurationSeconds;
    const tEnd = t0 + loopDur * 1.02;
    const span = tEnd - t0;
    const x = (tSec: number) => PAD + ((tSec - t0) / span) * (cssW - 2 * PAD);

    const refTop = PAD + 14;
    const playerTop = refTop + LANE_H + GAP;

    // ---- beat grid ----
    const barSeconds = loopDur / grid.lengthBars;
    const beatSeconds = barSeconds / (grid.beatsPerBar ?? 4);
    ctx.lineWidth = 1;
    for (let b = 0; ; b++) {
      const tb = t0 + b * beatSeconds;
      if (tb > tEnd) break;
      const isBar = b % (grid.beatsPerBar ?? 4) === 0;
      ctx.strokeStyle = isBar ? COL.beat : COL.grid;
      ctx.beginPath();
      ctx.moveTo(x(tb), refTop - 6);
      ctx.lineTo(x(tb), playerTop + LANE_H + 6);
      ctx.stroke();
    }

    // ---- waveforms ----
    drawWave(ctx, data.refSignal, data.refSampleRate, refTop, LANE_H, cssW, x, refBufSec(data));
    drawWave(ctx, data.playerSignal, data.playerSampleRate, playerTop, LANE_H, cssW, x, playerBufSec(data));

    // ---- detected transient ticks ----
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COL.refTick;
    for (const tSec of data.refOnsetsSec) tick(ctx, x(tSec), refTop, LANE_H);
    ctx.strokeStyle = COL.playerTick;
    for (const tSec of data.playerOnsetsSec) tick(ctx, x(tSec), playerTop, LANE_H);

    // ---- alignment ----
    // matched: connect ref tick → player tick
    ctx.lineWidth = 1.5;
    for (const m of data.score.alignment.matched) {
      ctx.strokeStyle = COL.matched;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(x(m.referenceSec), refTop + LANE_H);
      ctx.lineTo(x(m.playerSec), playerTop);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // missed reference notes: amber marker on the ref lane
    for (const tSec of data.score.alignment.missed) marker(ctx, x(tSec), refTop, LANE_H, COL.missed);
    // noise player onsets: red marker on the player lane
    for (const tSec of data.score.alignment.noise) marker(ctx, x(tSec), playerTop, LANE_H, COL.noise);

    // ---- labels ----
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillStyle = COL.text;
    ctx.fillText('REFERENCE (Bass B)  ·  green ticks = detected', PAD, refTop - 4);
    ctx.fillText('YOUR TAKE  ·  blue ticks = detected', PAD, playerTop - 4);
    ctx.fillStyle = COL.matched;
    ctx.fillText(
      `● matched ${data.score.matchedCount}`,
      PAD,
      cssH - 8,
    );
    ctx.fillStyle = COL.missed;
    ctx.fillText(`● missed ${data.score.missedCount}`, PAD + 110, cssH - 8);
    ctx.fillStyle = COL.noise;
    ctx.fillText(`● noise ${data.score.noiseCount}`, PAD + 210, cssH - 8);
  }, [data, zoom]);

  const playerDur = data.playerSignal.length / data.playerSampleRate;
  const refDur = data.refSignal.length / data.refSampleRate;
  const playerSpan =
    data.playerOnsetsSec.length > 1
      ? data.playerOnsetsSec[data.playerOnsetsSec.length - 1]! - data.playerOnsetsSec[0]!
      : 0;
  const refSpan =
    data.refOnsetsSec.length > 1
      ? data.refOnsetsSec[data.refOnsetsSec.length - 1]! - data.refOnsetsSec[0]!
      : 0;

  const zbtn: React.CSSProperties = {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 5,
    border: '1px solid #2a2d36',
    background: '#1a1d24',
    color: '#e7e9ee',
    cursor: 'pointer',
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: COL.text }}>zoom</span>
        <button style={zbtn} onClick={() => setZoom((z) => Math.max(1, z - 2))} disabled={zoom <= 1}>−</button>
        <span style={{ fontSize: 11, color: '#e7e9ee', width: 26, textAlign: 'center' }}>{zoom}×</span>
        <button style={zbtn} onClick={() => setZoom((z) => Math.min(30, z + 2))} disabled={zoom >= 30}>+</button>
      </div>
      <div style={{ overflowX: zoom > 1 ? 'auto' : 'hidden', borderRadius: 6 }}>
        <canvas
          ref={canvasRef}
          style={{ width: `${zoom * 100}%`, display: 'block', borderRadius: 6 }}
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: COL.text, lineHeight: 1.5 }}>
        R={data.R.toFixed(3)} · loop={data.grid.loopDurationSeconds.toFixed(2)}s ·
        player-take={playerDur.toFixed(2)}s, ref-buf={refDur.toFixed(2)}s ·
        first→last onset: player {playerSpan.toFixed(2)}s vs ref {refSpan.toFixed(2)}s
        {' '}
        {Math.abs(playerSpan - refSpan) > 0.15 && (
          <span style={{ color: COL.noise }}>
            ⚠ spans differ by {((playerSpan - refSpan) * 1000).toFixed(0)}ms — timelines run at
            different rates (this fans out the alignment)
          </span>
        )}
      </div>
    </>
  );
}

/** Where (in ctx seconds) does the reference BUFFER start/scale to on the axis? */
function refBufSec(d: VizData) {
  // ref onset ctx = loopStart + bufferTime / R  →  bufferTime = (ctx - loopStart)*R
  // so sample i (at i/sr buffer seconds) maps to loopStart + (i/sr)/R.
  return (bufSec: number) => d.grid.loopStartAudioTime + bufSec / d.R;
}
function playerBufSec(d: VizData) {
  return (bufSec: number) => d.playerStartedAt + bufSec;
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  signal: Float32Array,
  sampleRate: number,
  top: number,
  h: number,
  cssW: number,
  xOfCtx: (t: number) => number,
  bufToCtx: (bufSec: number) => number,
) {
  const mid = top + h / 2;
  ctx.strokeStyle = COL.wave;
  ctx.lineWidth = 1;
  // Peak-downsample the buffer to ~cssW columns and place each by its buffer time
  // mapped to the ctx-time axis (so the player + reference align in time).
  const n = signal.length;
  const step = Math.max(1, Math.floor(n / cssW));
  ctx.beginPath();
  for (let i = 0; i < n; i += step) {
    let peak = 0;
    for (let j = i; j < Math.min(n, i + step); j++) {
      const a = Math.abs(signal[j] ?? 0);
      if (a > peak) peak = a;
    }
    const bufSec = i / sampleRate;
    const px = xOfCtx(bufToCtx(bufSec));
    const y = mid - peak * (h / 2) * 0.95;
    const y2 = mid + peak * (h / 2) * 0.95;
    ctx.moveTo(px, y);
    ctx.lineTo(px, y2);
  }
  ctx.stroke();
}

function tick(ctx: CanvasRenderingContext2D, px: number, top: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(px, top);
  ctx.lineTo(px, top + h);
  ctx.stroke();
}

function marker(ctx: CanvasRenderingContext2D, px: number, top: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, top + h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(px, top);
  ctx.lineTo(px, top + h);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
