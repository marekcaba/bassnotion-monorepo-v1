'use client';

/**
 * /drum-record — dead-simple device recorder for the drum tempo engine.
 *
 * For non-technical testers: open on any phone/laptop, tap one button, it plays AND
 * records ONE full loop automatically and stops itself. Two versions: 89 BPM (slowed)
 * and 119 BPM (sped up). After both are recorded, ONE "Download all 4 files" button
 * grabs every file (each version's audio + device/warp JSON). No settings, no jargon.
 *
 * It loads the same test-groove-2 Drums stem (a static asset, no login) and runs it
 * through DrumBeatsPlayer so testers hear/record exactly how the engine behaves on
 * their real device hardware, CPU, and output latency.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { DrumBeatsPlayer } from '@/domains/playback/services/core/drum-slicer/DrumBeatsPlayer';

const DRUMS_URL = '/drum-record/test-groove-2-drums.ogg';
const ORIGINAL_BPM = 109; // the stem's native tempo (8 bars = the file length)

type Result = {
  url: string;
  name: string;
  bpm: number;
  jsonUrl: string;
  jsonName: string;
};

/** Read whatever device/engine introspection is available off the player, without
 *  hard-failing if a method is missing. */
function buildReport(
  ctx: AudioContext,
  player: DrumBeatsPlayer,
  bpm: number,
  ratio: number,
  perf: { buildMs: number } | null,
  mimeType: string | null,
): unknown {
  const p = player as unknown as {
    getEngineBehavior?: (r: number) => unknown;
    getDebugState?: () => unknown;
    textureRegionCount?: () => number;
  };
  const nav = navigator as unknown as {
    platform?: string;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    maxTouchPoints?: number;
    language?: string;
    connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  };
  const conn = nav.connection;
  let timeZone: string | null = null;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    /* ignore */
  }
  return {
    recordedAt: new Date().toISOString(),
    version: { bpm, originalBpm: ORIGINAL_BPM, ratio },
    device: {
      userAgent: navigator.userAgent,
      platform: nav.platform ?? null,
      // CPU/RAM — where main-thread stalls (GC, slow render) come from on weak phones.
      hardwareConcurrency: nav.hardwareConcurrency ?? null,
      deviceMemoryGB: nav.deviceMemory ?? null,
      // Device class disambiguation when the UA is ambiguous.
      maxTouchPoints: nav.maxTouchPoints ?? null,
      devicePixelRatio:
        typeof window !== 'undefined' ? window.devicePixelRatio : null,
      screen:
        typeof window !== 'undefined'
          ? { w: window.screen.width, h: window.screen.height }
          : null,
      viewport:
        typeof window !== 'undefined'
          ? { w: window.innerWidth, h: window.innerHeight }
          : null,
      language: nav.language ?? null,
      timeZone,
      network: conn
        ? {
            effectiveType: conn.effectiveType ?? null,
            downlinkMbps: conn.downlink ?? null,
            rttMs: conn.rtt ?? null,
          }
        : null,
    },
    // AudioContext conditions — the things that actually vary across devices and drive
    // the engine's scheduling margin + the playhead latency comp.
    audio: {
      sampleRate: ctx.sampleRate,
      state: ctx.state,
      baseLatencyMs:
        typeof (ctx as { baseLatency?: number }).baseLatency === 'number'
          ? (ctx as { baseLatency?: number }).baseLatency! * 1000
          : null,
      outputLatencyMs:
        typeof ctx.outputLatency === 'number' ? ctx.outputLatency * 1000 : null,
      audioWorkletSupported:
        typeof (ctx as { audioWorklet?: unknown }).audioWorklet !== 'undefined',
      recorderMimeType: mimeType,
    },
    // PERF: how long the slicer build (analyze + slicing) took ON THIS DEVICE — the
    // best single signal of whether the CPU can keep up with the engine's main-thread
    // work. A high value on a phone flags a device at risk of stalls.
    perf: { sliceBuildMs: perf ? +perf.buildMs.toFixed(2) : null },
    // The ENGINE's actual decisions for this render: transient markers, where each
    // slice lands on the grid, what it did to fill the gap (loop / ring-out), the
    // crossfade length, the rendered loop period, etc. Lets us line up the audio
    // against what the engine intended.
    engineState: player.getDebugState?.() ?? null,
    warp: p.getEngineBehavior?.(ratio) ?? null,
  };
}

export default function DrumRecordPage() {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const playerRef = useRef<DrumBeatsPlayer | null>(null);
  const outGainRef = useRef<GainNode | null>(null);
  const perfRef = useRef<{ buildMs: number } | null>(null);
  const mimeRef = useRef<string | null>(null);

  const [busyBpm, setBusyBpm] = useState<number | null>(null); // which version is running
  const [phase, setPhase] = useState<'idle' | 'recording'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [results, setResults] = useState<Record<number, Result>>({});
  const [error, setError] = useState<string | null>(null);

  // Lazily create the AudioContext + decode the stem on first tap (needs a gesture).
  const ensureReady = useCallback(async (): Promise<boolean> => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      if (!bufferRef.current) {
        const res = await fetch(DRUMS_URL);
        if (!res.ok) throw new Error(`couldn't load the drum sound (${res.status})`);
        const arr = await res.arrayBuffer();
        bufferRef.current = await ctx.decodeAudioData(arr.slice(0));
      }
      if (!outGainRef.current) {
        const g = ctx.createGain();
        g.gain.value = 1;
        g.connect(ctx.destination);
        outGainRef.current = g;
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);

  // One-tap: play + record exactly one full loop at `bpm`, then stop automatically.
  const recordVersion = useCallback(
    async (bpm: number) => {
      setError(null);
      if (busyBpm != null) return;
      setBusyBpm(bpm);
      setPhase('recording');

      const ok = await ensureReady();
      const ctx = ctxRef.current;
      const buf = bufferRef.current;
      const outGain = outGainRef.current;
      if (!ok || !ctx || !buf || !outGain) {
        setBusyBpm(null);
        setPhase('idle');
        return;
      }

      // Fresh player each run (clean state).
      try {
        playerRef.current?.stop();
      } catch {
        /* ignore */
      }
      // Time the slicer build (analyze + slicing) — how long the heavy main-thread work
      // takes ON THIS DEVICE. A slow value flags a CPU that may struggle to keep up.
      const buildT0 = performance.now();
      const player = new DrumBeatsPlayer(ctx, buf, outGain, {
        loopDurationSeconds: buf.duration,
      });
      const buildMs = performance.now() - buildT0;
      perfRef.current = { buildMs };
      playerRef.current = player;
      player.setRatio(bpm / ORIGINAL_BPM);

      // The audio starts a short lead-in after we hit start (so the first beat isn't
      // clipped). Capture EXACTLY one loop: stop the player just BEFORE the loop wraps
      // so it never replays beat 1 (a wrapped downbeat would otherwise be recorded as a
      // stray hit at the end — measured). A 0.08s guard absorbs the engine's own
      // device-aware start margin + scheduling jitter so the wrap can never sneak in.
      // Then keep recording a brief tail for the last hit's natural ring-out.
      const LEAD_IN = 0.12;
      const WRAP_GUARD = 0.08; // stop this far before the loop boundary
      const TAIL = 0.3; // ring-out of the final hit (NOT a second loop)
      const loopSec = buf.duration / (bpm / ORIGINAL_BPM);
      const playStopSec = LEAD_IN + loopSec - WRAP_GUARD;
      const totalSec = playStopSec + TAIL;

      // Tap output → MediaRecorder. Records the WebAudio graph (works on iOS Safari).
      let rec: MediaRecorder;
      const dest = ctx.createMediaStreamDestination();
      outGain.connect(dest);
      const chunks: BlobPart[] = [];
      try {
        const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''];
        const mime = mimes.find(
          (m) => m === '' || MediaRecorder.isTypeSupported(m),
        );
        rec =
          mime && mime !== ''
            ? new MediaRecorder(dest.stream, { mimeType: mime })
            : new MediaRecorder(dest.stream);
        mimeRef.current = rec.mimeType || mime || null;
      } catch (e) {
        setError('recording not supported on this browser');
        try {
          outGain.disconnect(dest);
        } catch {
          /* ignore */
        }
        setBusyBpm(null);
        setPhase('idle');
        return;
      }
      rec.ondataavailable = (ev) => ev.data.size > 0 && chunks.push(ev.data);
      rec.onstop = () => {
        try {
          outGain.disconnect(dest);
        } catch {
          /* ignore */
        }
        const type = rec.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        const url = URL.createObjectURL(blob);
        const ext = type.includes('mp4') ? 'm4a' : 'webm';
        const tag = (navigator.userAgent.match(
          /(iPhone|iPad|Android|Macintosh|Windows)/,
        ) || ['device'])[0];
        // Sidecar JSON: device conditions + the engine's warp/marker decisions for
        // this exact render (so the audio can be lined up against what the engine did).
        let jsonUrl = '';
        let jsonName = `drums-${bpm}bpm-${tag}.json`;
        try {
          const report = buildReport(
            ctx,
            player,
            bpm,
            bpm / ORIGINAL_BPM,
            perfRef.current,
            mimeRef.current ?? rec.mimeType ?? null,
          );
          jsonUrl = URL.createObjectURL(
            new Blob([JSON.stringify(report, null, 2)], {
              type: 'application/json',
            }),
          );
        } catch {
          /* best-effort — audio still saves */
        }
        setResults((r) => ({
          ...r,
          [bpm]: {
            url,
            name: `drums-${bpm}bpm-${tag}.${ext}`,
            bpm,
            jsonUrl,
            jsonName,
          },
        }));
        setBusyBpm(null);
        setPhase('idle');
        setSecondsLeft(0);
      };

      // Start audio + recording together, count down, then stop.
      const startAt = ctx.currentTime + LEAD_IN;
      player.start(startAt);
      rec.start();
      setSecondsLeft(Math.ceil(totalSec));
      const tick = setInterval(() => {
        setSecondsLeft((s) => (s > 1 ? s - 1 : 0));
      }, 1000);
      // Stop the PLAYER just before the loop boundary (no wrap → no stray downbeat).
      window.setTimeout(() => {
        try {
          player.stop();
        } catch {
          /* ignore */
        }
      }, playStopSec * 1000);
      // Stop the RECORDER after the short ring-out tail.
      window.setTimeout(() => {
        clearInterval(tick);
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }, totalSec * 1000);
    },
    [busyBpm, ensureReady],
  );

  // One tap downloads ALL recorded files (both versions: each is an audio + a JSON).
  // A synthetic anchor click per file, STAGGERED ~500ms apart so mobile browsers don't
  // drop downloads when several fire in quick succession.
  const saveAll = useCallback(() => {
    const click = (href: string, name: string) => {
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    // Collect every file across both versions in a stable order.
    const files: { href: string; name: string }[] = [];
    for (const bpm of [89, 119]) {
      const r = results[bpm];
      if (!r) continue;
      files.push({ href: r.url, name: r.name });
      if (r.jsonUrl) files.push({ href: r.jsonUrl, name: r.jsonName });
    }
    files.forEach((f, i) => {
      setTimeout(() => click(f.href, f.name), i * 500);
    });
  }, [results]);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.stop();
      } catch {
        /* ignore */
      }
      try {
        ctxRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const card: React.CSSProperties = {
    background: '#161c28',
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
  };
  const bigBtn = (running: boolean, bg: string): React.CSSProperties => ({
    width: '100%',
    fontSize: 20,
    fontWeight: 700,
    padding: '20px 16px',
    borderRadius: 14,
    border: 0,
    color: '#fff',
    cursor: running ? 'default' : 'pointer',
    background: bg,
    opacity: busyBpm != null && !running ? 0.4 : 1,
  });

  const versionCard = (bpm: number, label: string, bg: string) => {
    const running = busyBpm === bpm;
    const result = results[bpm];
    return (
      <div style={card} key={bpm}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ opacity: 0.6, fontSize: 13, marginBottom: 14 }}>
          Plays and records one loop, then stops by itself (~
          {Math.round(17.6 / (bpm / ORIGINAL_BPM))}s).
        </div>
        <button
          style={bigBtn(running, bg)}
          disabled={busyBpm != null}
          onClick={() => recordVersion(bpm)}
        >
          {running
            ? `● Recording… ${secondsLeft}s`
            : result
              ? `✓ Recorded — tap to redo ${bpm} BPM`
              : `▶ Play & record ${bpm} BPM`}
        </button>
      </div>
    );
  };

  return (
    <div
      style={{
        maxWidth: 460,
        margin: '0 auto',
        padding: 20,
        fontFamily: 'system-ui',
        color: '#e7eaf0',
        background: '#0e121c',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>🥁 Drum test</h1>
      <p style={{ opacity: 0.75, fontSize: 15, lineHeight: 1.5, marginTop: 0 }}>
        Tap a button below. It will <b>play the drums out loud and record them</b>,
        then stop on its own. Please do <b>both</b> versions, then tap{' '}
        <b>Download all 4 files</b> at the bottom and send them to me.
      </p>
      <p style={{ opacity: 0.55, fontSize: 13, marginBottom: 20 }}>
        Turn your volume up. Best with the phone speaker (not headphones).
      </p>

      {versionCard(89, 'Version 1 — slower (89 BPM)', '#1e5e8a')}
      {versionCard(119, 'Version 2 — faster (119 BPM)', '#8a2e2e')}

      {(() => {
        const done = [89, 119].filter((b) => results[b]);
        if (done.length === 0) return null;
        const bothDone = done.length === 2;
        return (
          <button
            onClick={saveAll}
            disabled={busyBpm != null}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              marginBottom: 8,
              textAlign: 'center',
              padding: '18px 16px',
              borderRadius: 14,
              border: 0,
              background: bothDone ? '#2e7d4f' : '#3a3f4a',
              color: '#fff',
              fontWeight: 700,
              fontSize: 18,
              cursor: busyBpm != null ? 'default' : 'pointer',
              opacity: busyBpm != null ? 0.4 : 1,
            }}
          >
            ⤓ Download {bothDone ? 'all 4 files' : `the ${done[0]} BPM files`}
          </button>
        );
      })()}
      {!(results[89] && results[119]) && (results[89] || results[119]) && (
        <p style={{ opacity: 0.6, fontSize: 13, textAlign: 'center', marginTop: 0 }}>
          Record the other version too, then download all 4 in one tap.
        </p>
      )}

      {error && (
        <p style={{ color: '#ff9b9b', fontSize: 14 }}>
          Something went wrong: {error}
        </p>
      )}

      <p style={{ marginTop: 10, fontSize: 12, opacity: 0.4 }}>
        Both recordings stay on your device until you share them. Nothing is uploaded
        automatically.
      </p>
    </div>
  );
}
