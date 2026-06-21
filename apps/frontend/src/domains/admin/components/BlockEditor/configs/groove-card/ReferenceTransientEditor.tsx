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
import {
  detectBassOnsets,
  snapOnsetTimesToAttack,
} from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/timing-mirror/bassOnsetDetector';
import { supabase } from '@/infrastructure/supabase/client';

/**
 * Resolve a stem ref to a fetchable URL. Public audio-samples urls fetch directly;
 * a private premium-bassline / groove-stem ref (Bass B, Fill 1, premium grooves)
 * 400s if fetched raw — it must be SIGNED first via the gated signer. (Same split
 * the player's preload uses; without this, a variant stem fails with HTTP 400.)
 */
async function resolveStemUrl(refUrl: string): Promise<string> {
  const isPrivate =
    refUrl.includes('/premium-basslines/') || refUrl.includes('/groove-stems/');
  if (!isPrivate) return refUrl;
  const signer = refUrl.includes('/premium-basslines/')
    ? 'bassline-url'
    : 'stem-url';
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(
    `${apiUrl}/api/v1/grooves/${signer}?path=${encodeURIComponent(refUrl)}`,
    { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} },
  );
  if (!res.ok) throw new Error(`${signer} signer failed: HTTP ${res.status}`);
  const { url } = (await res.json()) as { url: string };
  return url;
}

import type {
  PluckStyle,
  MarkerRole,
  MarkerConnection,
  TechniqueType,
  ReferenceAnalysis,
} from '@bassnotion/contracts';
import { sortMarkers, toAnalysis, fromAnalysis } from './refMarkers';
import { ReferenceMarkerTable } from './ReferenceMarkerTable';

/**
 * A marker as the EDITOR holds it internally: one OBJECT carrying its time AND its
 * per-marker annotations, plus a stable editor-local `id`. This is the desync fix —
 * because the editor re-sorts markers on every add/drag/delete, storing annotations in
 * parallel arrays keyed by INDEX would scramble them the instant the sort permutes
 * indices. With an object, every field rides the sort atomically and `id` keeps a
 * selection stable across re-sorts. `id` is NOT persisted (assigned fresh on load); the
 * annotations are zipped to ReferenceAnalysis parallel arrays only at the save boundary.
 */
export interface RefMarker {
  /** Editor-local stable id (from a counter). Never persisted. */
  id: number;
  /** Marker time, stem-buffer seconds. (Was the bare number.) */
  timeSec: number;
  // ── per-marker authored annotation (all optional; null/empty = unannotated) ──
  string?: 1 | 2 | 3 | 4 | 5 | 6 | null;
  fret?: number | null;
  pluckStyle?: PluckStyle | null;
  techniques?: TechniqueType[];
  role?: MarkerRole | null;
  connectionFromPrev?: MarkerConnection | null;
}

interface Props {
  /** The bass stem URL (config.stems.bass). */
  stemUrl: string;
  /** Currently-saved approved reference analysis (onsets + per-marker authoring), if any. */
  value: ReferenceAnalysis | undefined;
  /** Called with the edited+approved analysis (onsetsSec + per-marker arrays). */
  onChange: (analysis: Partial<ReferenceAnalysis>) => void;
  /** Bass type the string/fret author against (default '4'). */
  bassType?: '4' | '5' | '6';
}

const WAVE_H = 220;
const CLICK_DELETE_PX = 6; // a press that moves less than this = a click (not a drag)
const DELETE_Y = 10; // y of the red × delete handle (top of each marker)
const DRAG_Y = WAVE_H - 12; // y of the green drag handle (bottom of each marker)
const HANDLE_R = 9; // hit radius for the top/bottom handles

/** Monotonic editor-local id source for markers (stable across re-sorts). */
function makeIdGen() {
  let n = 0;
  return () => ++n;
}

export function ReferenceTransientEditor({
  stemUrl,
  value,
  onChange,
  bassType = '4',
}: Props) {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [status, setStatus] = useState<string>('');
  const nextId = useRef(makeIdGen()).current;
  // markers carry their authored annotations; fromAnalysis unzips a stored blob and
  // assigns fresh editor-local ids (and length-asserts the parallel arrays).
  const [markers, setMarkers] = useState<RefMarker[]>(() =>
    fromAnalysis(value, nextId),
  );
  const [zoom, setZoom] = useState(1); // 1 = fit; higher = wider (scrollable)
  const [clickOnMarkers, setClickOnMarkers] = useState(true);
  const [playhead, setPlayhead] = useState<number | null>(null); // sec, null = stopped
  const [selectedId, setSelectedId] = useState<number | null>(null); // table↔canvas sync
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // playback engine
  const playCtxRef = useRef<AudioContext | null>(null);
  const playSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const markersRef = useRef<RefMarker[]>(markers);
  markersRef.current = markers;

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
        // private variant refs (Bass B / fills) must be signed before fetch.
        const fetchUrl = await resolveStemUrl(stemUrl);
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const buf = await ctx.decodeAudioData(arr);
        await ctx.close();
        if (cancelled) return;
        setBuffer(buf);
        // auto-detect only if nothing approved yet
        if (!value || !value.onsetsSec?.length) {
          const mono = toMono(buf);
          const detected = snapOnsetTimesToAttack(
            detectBassOnsets(mono, buf.sampleRate).map((o) => o.time),
            mono,
            buf.sampleRate,
          );
          const fresh = detected.map((t) => ({ id: nextId(), timeSec: t }));
          setMarkers(fresh);
          onChangeRef.current(toAnalysis(fresh, bassType));
          setStatus(`Auto-detected ${detected.length} transients — drag/add/delete to correct, then it saves.`);
        } else {
          setMarkers(fromAnalysis(value, nextId));
          setStatus(`Loaded ${value.onsetsSec.length} approved transients.`);
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

  // re-detect button (e.g. after replacing the stem, or to start over). Fresh markers =
  // any existing annotations are discarded (new transients are new notes).
  const redetect = useCallback(() => {
    if (!buffer || !mono) return;
    const detected = snapOnsetTimesToAttack(
      detectBassOnsets(mono, buffer.sampleRate).map((o) => o.time),
      mono,
      buffer.sampleRate,
    );
    const fresh = detected.map((t) => ({ id: nextId(), timeSec: t }));
    setMarkers(fresh);
    onChangeRef.current(toAnalysis(fresh, bassType));
    setStatus(`Re-detected ${detected.length} transients (snapped to attack).`);
  }, [buffer, mono, nextId, bassType]);

  /** Commit a marker list: sort OBJECTS by time (each carries its own annotations, so
   *  nothing desyncs across the sort) and emit the FULL authored analysis (onsetsSec +
   *  per-marker arrays). toAnalysis zips at this save boundary. */
  const commit = useCallback(
    (next: RefMarker[]) => {
      const sorted = sortMarkers(next);
      setMarkers(sorted);
      onChangeRef.current(toAnalysis(sorted, bassType));
    },
    [bassType],
  );

  /** Patch one marker's authored fields (by id) and re-commit (saves). */
  const updateMarker = useCallback(
    (id: number, patch: Partial<RefMarker>) => {
      commit(markersRef.current.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    },
    [commit],
  );

  // ---- playback ----
  const stop = useCallback(() => {
    try {
      playSrcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    playSrcRef.current = null;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlayhead(null);
  }, []);

  /** Play the stem from `fromSec` to `toSec` (whole stem if omitted). A short click
   *  fires on each marker within the played range (so the markers are AUDIBLE against
   *  the bass) when clickOnMarkers is on. The playhead sweeps the waveform. */
  const play = useCallback(
    (fromSec = 0, toSec?: number) => {
      if (!buffer) return;
      stop();
      const ctx = playCtxRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      playCtxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const end = toSec ?? buffer.duration;
      const dur = Math.max(0.02, end - fromSec);

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const startAt = ctx.currentTime + 0.03;
      src.start(startAt, fromSec, dur);
      playSrcRef.current = src;

      // schedule a click on each marker in range
      if (clickOnMarkers) {
        for (const m of markersRef.current) {
          const t = m.timeSec;
          if (t < fromSec - 0.001 || t > end + 0.001) continue;
          const when = startAt + (t - fromSec);
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.frequency.value = 2000;
          g.gain.setValueAtTime(0.0001, when);
          g.gain.exponentialRampToValueAtTime(0.3, when + 0.001);
          g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(when);
          osc.stop(when + 0.04);
        }
      }

      // playhead RAF
      const t0 = startAt;
      const tick = () => {
        const elapsed = ctx.currentTime - t0;
        const pos = fromSec + elapsed;
        if (elapsed < 0) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        if (pos >= end) {
          stop();
          return;
        }
        setPlayhead(pos);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      src.onended = () => {
        if (playSrcRef.current === src) stop();
      };
    },
    [buffer, stop, clickOnMarkers],
  );

  /** Play just the note at a marker: from the marker to the next marker (or +0.5s). */
  const playNote = useCallback(
    (index: number) => {
      const list = markersRef.current;
      const from = list[index]!.timeSec;
      const next = list[index + 1]?.timeSec;
      const to = Math.min(from + 0.6, next != null ? next : from + 0.6);
      play(from, to);
    },
    [play],
  );

  // clean up audio on unmount
  useEffect(
    () => () => {
      stop();
      void playCtxRef.current?.close();
    },
    [stop],
  );

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

    // transient markers: a line, a DELETE handle (red ×) at the TOP, and a DRAG
    // handle (green dot) at the BOTTOM — two clear, separate hit zones.
    for (const m of markers) {
      const px = (m.timeSec / duration) * w;
      const isSel = m.id === selectedId;
      // selected marker = brighter + thicker line (row↔canvas sync)
      ctx.strokeStyle = isSel ? '#aef0c4' : '#6ad08c';
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(px, DELETE_Y + 6);
      ctx.lineTo(px, DRAG_Y - 6);
      ctx.stroke();
      // delete handle (×) at top
      ctx.strokeStyle = '#e0604a';
      ctx.lineWidth = 2;
      const r = 5;
      ctx.beginPath();
      ctx.moveTo(px - r, DELETE_Y - r);
      ctx.lineTo(px + r, DELETE_Y + r);
      ctx.moveTo(px + r, DELETE_Y - r);
      ctx.lineTo(px - r, DELETE_Y + r);
      ctx.stroke();
      // drag handle (●) at bottom
      ctx.fillStyle = '#6ad08c';
      ctx.beginPath();
      ctx.arc(px, DRAG_Y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // playhead
    if (playhead != null) {
      const px = (playhead / duration) * w;
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, WAVE_H);
      ctx.stroke();
    }
  }, [mono, duration, markers, zoom, playhead, selectedId]);

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

  /** Canvas-local Y (0..WAVE_H) for hit-testing the top/bottom handles. */
  const canvasY = useCallback((clientY: number): number => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return ((clientY - rect.top) / rect.height) * WAVE_H;
  }, []);

  const nearestMarker = useCallback(
    (clientX: number): number | null => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      let best = -1;
      let bestDist = 7; // grab radius px
      markers.forEach((m, i) => {
        const mpx = (m.timeSec / duration) * rect.width;
        const d = Math.abs(mpx - px);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      return best >= 0 ? best : null;
    },
    [markers, duration],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!buffer) return;
      const hit = nearestMarker(e.clientX);
      const y = canvasY(e.clientY);
      if (hit != null) {
        // TOP zone (the red ×) → DELETE. Also alt/right-click anywhere on a marker.
        // Filter by index drops the object AND its annotations together — no off-by-one.
        if (Math.abs(y - DELETE_Y) < HANDLE_R || e.altKey || e.button === 2) {
          commit(markers.filter((_, i) => i !== hit));
          return;
        }
        // anywhere else on the marker (incl. the bottom drag dot) → drag, or PLAY
        // the note on a plain click (hear if it's a real attack or noise).
        dragRef.current = { index: hit, downX: e.clientX, moved: false };
      } else {
        // empty space → ADD a marker here immediately (a fresh, unannotated marker)
        commit([...markers, { id: nextId(), timeSec: xToTime(e.clientX) }]);
      }
    },
    [buffer, nearestMarker, canvasY, markers, commit, xToTime, nextId],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (Math.abs(e.clientX - d.downX) > CLICK_DELETE_PX) d.moved = true;
      if (d.moved) {
        // mutate only the dragged object's time; its annotations ride along untouched.
        const next = markers.map((m, i) =>
          i === d.index ? { ...m, timeSec: xToTime(e.clientX) } : m,
        );
        setMarkers(next); // live update while dragging (commit on up)
      }
    },
    [markers, xToTime],
  );

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      commit(markers); // persist the dragged position (objects sorted by time)
    } else {
      // a click without a drag = PLAY this note AND SELECT it (sync the table row)
      const m = markers[d.index];
      if (m) setSelectedId(m.id);
      playNote(d.index);
    }
  }, [markers, commit, playNote]);

  if (!stemUrl) {
    return (
      <p style={{ fontSize: 12, color: '#9aa0ad' }}>
        Upload a bass stem above to analyse its transients.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => (playhead != null ? stop() : play(0))}
          style={{ ...smallBtn, background: playhead != null ? '#e0604a' : '#6ad08c', color: '#0a0a0a', fontWeight: 600 }}
        >
          {playhead != null ? '■ Stop' : '▶ Play stem'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9aa0ad' }}>
          <input type="checkbox" checked={clickOnMarkers} onChange={(e) => setClickOnMarkers(e.target.checked)} />
          click on markers
        </label>
        <span style={{ fontSize: 12, color: '#9aa0ad' }}>{markers.length} transients</span>
        <button type="button" onClick={redetect} style={smallBtn}>
          Re-detect
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9aa0ad' }}>zoom</span>
        <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 1))} style={smallBtn} disabled={zoom <= 1}>
          −
        </button>
        <span style={{ fontSize: 12, color: '#e7e9ee', width: 28, textAlign: 'center' }}>{zoom}×</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(20, z + 1))} style={smallBtn} disabled={zoom >= 20}>
          +
        </button>
      </div>
      <div
        ref={scrollRef}
        style={{
          overflowX: zoom > 1 ? 'auto' : 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6,
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            width: `${zoom * 100}%`,
            display: 'block',
            cursor: 'crosshair',
            touchAction: 'none',
          }}
        />
      </div>

      {/* The per-marker authoring matrix — string+fret+technique per note (the ground
          truth the student is graded against). Row ↔ canvas marker stay in sync. */}
      <ReferenceMarkerTable
        markers={markers}
        bassType={bassType}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onUpdate={updateMarker}
        onPlay={playNote}
      />

      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
        {status}
        <br />
        <b style={{ color: '#e0604a' }}>Top × handle</b> = delete ·{' '}
        <b style={{ color: '#6ad08c' }}>bottom ● handle</b> = drag to move ·{' '}
        <b>click the line</b> to HEAR that note (real attack, or noise?) ·{' '}
        <b>click empty space</b> to add · <b>▶ Play stem</b> to hear the whole part
        with a click on each marker · <b>zoom</b> in to place precisely. Auto-saves.
      </p>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  fontSize: 11,
  padding: '3px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e7e9ee',
  cursor: 'pointer',
};

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
