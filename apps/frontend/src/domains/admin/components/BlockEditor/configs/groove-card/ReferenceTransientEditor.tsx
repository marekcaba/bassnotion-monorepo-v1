'use client';

/**
 * ReferenceTransientEditor — admin authoring of the bass-coach ground truth.
 *
 * When a bass stem is uploaded into the groove-card block editor, this auto-decodes
 * it, detects transients, and draws the waveform with the transients as markers the
 * admin has TOTAL CONTROL over:
 *   - DRAG a marker to reposition it
 *   - CLICK empty waveform to ADD a marker there
 *   - CLICK a marker (without dragging) to DELETE it
 * The edited set is the APPROVED reference analysis, saved onto the block
 * (referenceAnalysis.onsetsSec). The coach grades against THESE, not a live
 * re-detection — deterministic + human-verified.
 *
 * The stem is the PUBLIC audio-samples bucket URL (config.stems.bass), fetched
 * directly. Onset times are in the stem buffer's own seconds.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { detectBassOnsets } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/timing-mirror/bassOnsetDetector';

interface Props {
  /** The bass stem URL (config.stems.bass). */
  stemUrl: string;
  /** Currently-saved approved onset times (stem-seconds), if any. */
  value: number[] | undefined;
  /** Called with the edited+approved onset list. */
  onChange: (onsetsSec: number[]) => void;
}

const WAVE_H = 160;
const CLICK_DELETE_PX = 6; // a press that moves less than this = a click (delete)

export function ReferenceTransientEditor({ stemUrl, value, onChange }: Props) {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [status, setStatus] = useState<string>('');
  const [onsets, setOnsets] = useState<number[]>(value ?? []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Decode the stem + auto-detect transients whenever the URL changes. If the block
  // already has an approved set, KEEP it (don't clobber an admin's edits on reload);
  // only auto-detect when there's nothing saved yet.
  useEffect(() => {
    if (!stemUrl) {
      setBuffer(null);
      return;
    }
    let cancelled = false;
    setStatus('Decoding bass stem…');
    (async () => {
      try {
        const res = await fetch(stemUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const buf = await ctx.decodeAudioData(arr);
        await ctx.close();
        if (cancelled) return;
        setBuffer(buf);
        // auto-detect only if nothing approved yet
        if (!value || value.length === 0) {
          const mono = toMono(buf);
          const detected = detectBassOnsets(mono, buf.sampleRate).map((o) => o.time);
          setOnsets(detected);
          onChangeRef.current(detected);
          setStatus(`Auto-detected ${detected.length} transients — drag/add/delete to correct, then it saves.`);
        } else {
          setOnsets(value);
          setStatus(`Loaded ${value.length} approved transients.`);
        }
      } catch (err) {
        if (!cancelled) setStatus(`Failed to load stem: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stemUrl]);

  const duration = buffer ? buffer.duration : 0;
  const mono = useMemo(() => (buffer ? toMono(buffer) : null), [buffer]);

  // re-detect button (e.g. after replacing the stem, or to start over)
  const redetect = useCallback(() => {
    if (!buffer || !mono) return;
    const detected = detectBassOnsets(mono, buffer.sampleRate).map((o) => o.time);
    setOnsets(detected);
    onChangeRef.current(detected);
    setStatus(`Re-detected ${detected.length} transients.`);
  }, [buffer, mono]);

  const commit = useCallback((next: number[]) => {
    const sorted = [...next].sort((a, b) => a - b);
    setOnsets(sorted);
    onChangeRef.current(sorted);
  }, []);

  // ---- draw ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mono || duration <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    canvas.width = w * dpr;
    canvas.height = WAVE_H * dpr;
    canvas.style.height = WAVE_H + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, WAVE_H);
    ctx.fillStyle = '#0a0b0e';
    ctx.fillRect(0, 0, w, WAVE_H);

    // waveform (peak per column)
    const mid = WAVE_H / 2;
    ctx.strokeStyle = '#5b657a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const n = mono.length;
    const step = Math.max(1, Math.floor(n / w));
    for (let px = 0; px < w; px++) {
      const start = Math.floor((px / w) * n);
      let peak = 0;
      for (let j = start; j < Math.min(n, start + step); j++) {
        const a = Math.abs(mono[j] ?? 0);
        if (a > peak) peak = a;
      }
      ctx.moveTo(px, mid - peak * mid * 0.95);
      ctx.lineTo(px, mid + peak * mid * 0.95);
    }
    ctx.stroke();

    // transient markers
    for (const t of onsets) {
      const px = (t / duration) * w;
      ctx.strokeStyle = '#6ad08c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, WAVE_H);
      ctx.stroke();
      ctx.fillStyle = '#6ad08c';
      ctx.beginPath();
      ctx.arc(px, 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [mono, duration, onsets]);

  // ---- interaction ----
  const dragRef = useRef<{ index: number; downX: number; moved: boolean } | null>(null);

  const xToTime = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return frac * duration;
    },
    [duration],
  );

  const nearestMarker = useCallback(
    (clientX: number): number | null => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      let best = -1;
      let bestDist = 7; // grab radius px
      onsets.forEach((t, i) => {
        const mpx = (t / duration) * rect.width;
        const d = Math.abs(mpx - px);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      return best >= 0 ? best : null;
    },
    [onsets, duration],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!buffer) return;
      const hit = nearestMarker(e.clientX);
      if (hit != null) {
        // start a potential drag (or a click-to-delete if it doesn't move)
        dragRef.current = { index: hit, downX: e.clientX, moved: false };
      } else {
        // empty space → ADD a marker here immediately
        commit([...onsets, xToTime(e.clientX)]);
      }
    },
    [buffer, nearestMarker, onsets, commit, xToTime],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (Math.abs(e.clientX - d.downX) > CLICK_DELETE_PX) d.moved = true;
      if (d.moved) {
        const next = [...onsets];
        next[d.index] = xToTime(e.clientX);
        setOnsets(next); // live update while dragging (commit on up)
      }
    },
    [onsets, xToTime],
  );

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      commit(onsets); // persist the dragged position (sorted)
    } else {
      // a click without a drag = DELETE this marker
      commit(onsets.filter((_, i) => i !== d.index));
    }
  }, [onsets, commit]);

  if (!stemUrl) {
    return (
      <p style={{ fontSize: 12, color: '#9aa0ad' }}>
        Upload a bass stem above to analyse its transients.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#9aa0ad' }}>{onsets.length} transients</span>
        <button
          type="button"
          onClick={redetect}
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: '#e7e9ee',
            cursor: 'pointer',
          }}
        >
          Re-detect (reset)
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          width: '100%',
          display: 'block',
          borderRadius: 6,
          cursor: 'crosshair',
          touchAction: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />
      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
        {status}
        <br />
        <b>Click empty space</b> to add · <b>click a marker</b> to delete ·{' '}
        <b>drag a marker</b> to move. Changes auto-save onto the block.
      </p>
    </div>
  );
}

function toMono(buffer: AudioBuffer): Float32Array {
  const ch = buffer.numberOfChannels;
  if (ch === 1) return buffer.getChannelData(0).slice();
  const len = buffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) out[i]! += data[i]! / ch;
  }
  return out;
}
