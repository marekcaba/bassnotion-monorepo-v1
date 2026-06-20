'use client';

/**
 * TimingMirrorPanel — dev-only end-to-end timing-mirror spike (Step 4).
 * Mounted by GrooveCardBlockView ONLY when NEXT_PUBLIC_BASS_RECORDER_PROBE='true'.
 * NOT a member-facing feature — the in-app proving ground for "hear the player,
 * score their timing vs the groove grid." See docs/TIMING_MIRROR_SPIKE_PLAN.md.
 *
 * Pipeline (all three modules wired):
 *   captureBassInput (mic on engine ctx) → detectBassOnsets (HPF + spectral-flux)
 *   → scoreOnsetsAgainstGrid (clock bridge → BeatTimingAnalyzer) → numbers.
 *
 * Step 4 is NUMBERS-ONLY (no visualization yet — that's Step 6) to prove the
 * pipeline end-to-end before investing in the canvas. Trust gate G1 (offset/jitter
 * split) is shown from the start: the constant offset (rig latency, punch-in
 * correctable) is reported SEPARATELY from the jitter (the timing-quality metric),
 * because raw onset−T0 is pure system latency and reporting it as "you drag" is the
 * impressive-but-wrong trap.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startBassCapture,
  type BassCapture,
} from './timing-mirror/captureBassInput';
import { detectBassOnsets } from './timing-mirror/bassOnsetDetector';
import {
  scoreOnsetsAgainstGrid,
  type GridParams,
} from './timing-mirror/scoreAgainstGrid';
import type { TimingStatistics } from '@/domains/playback/utils/BeatTimingAnalyzer';

interface TimingMirrorPanelProps {
  audioContext: AudioContext | null;
  loopStartAudioTime: number | null;
  loopDurationSeconds: number;
  lengthBars: number;
  isPlaying: boolean;
  isBassMuted: boolean;
  setStemMuted: (stem: 'audio-bass', muted: boolean) => void;
}

// Flow built around how a musician actually plays: you can't press a button on
// the downbeat. So you ARM once (mic opens, bass auto-mutes), then just hit the
// card's ▶ Play and play — capture is already listening and auto-starts the moment
// playback begins, auto-scores when playback stops. No button in the heat of it.
//   idle → armed (mic open, waiting) → recording (auto, on play) → scoring → done
type Phase = 'idle' | 'arming' | 'armed' | 'recording' | 'scoring' | 'done' | 'error';

interface Outcome {
  stats: TimingStatistics;
  detectedCount: number;
  scoredCount: number;
  skippedBeforeGrid: number;
}

export function TimingMirrorPanel({
  audioContext,
  loopStartAudioTime,
  loopDurationSeconds,
  lengthBars,
  isPlaying,
  isBassMuted,
  setStemMuted,
}: TimingMirrorPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const captureRef = useRef<BassCapture | null>(null);
  // Live-tunable onset params — a real hot DI bass over-triggers vs the synthetic
  // test signal, so we dial these against the ACTUAL bass (ear-first) instead of
  // guessing. The last recorded take is kept so re-scoring is instant on a change.
  // Defaults below were dialed against a real Clarett DI bass take (2026-06-20):
  // detected-count matched the played notes at sensitivity 2.1 / gap 120 / floor 0.25.
  const [sensitivity, setSensitivity] = useState(2.1);
  const [minGapMs, setMinGapMs] = useState(120);
  const [minRelStrength, setMinRelStrength] = useState(0.25);
  const lastSignalRef = useRef<{ signal: Float32Array; sampleRate: number; startedAt: number } | null>(null);
  // Grid captured at the play transition (loopStartAudioTime re-anchors / nulls on stop).
  const gridRef = useRef<GridParams | null>(null);
  // phase mirror for effects (avoids stale closures in the isPlaying watcher).
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  const onContextLost = useCallback(() => {
    captureRef.current?.dispose();
    captureRef.current = null;
    setPhase('error');
    setError('Engine audio context restarted — press the card ▶ Play again, then re-arm.');
  }, []);

  /** ARM: open the mic once + auto-mute the bass, then WAIT. The actual recording
   *  auto-starts when playback begins (see the isPlaying effect) so you never have
   *  to press a button on the downbeat. */
  const arm = useCallback(async () => {
    setError(null);
    setOutcome(null);
    setPhase('arming');
    try {
      if (!isBassMuted) setStemMuted('audio-bass', true); // play along to backing only
      captureRef.current = await startBassCapture(onContextLost);
      setPhase('armed');
    } catch (err) {
      captureRef.current = null;
      setError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [isBassMuted, setStemMuted, onContextLost]);

  // Pure re-scoring of the last captured take with the CURRENT tuning params.
  // Re-runs on a slider change — no re-recording needed.
  const analyze = useCallback(
    (
      signal: Float32Array,
      sampleRate: number,
      startedAt: number,
      grid: GridParams,
    ) => {
      const onsets = detectBassOnsets(signal, sampleRate, {
        sensitivity,
        minOnsetGapSeconds: minGapMs / 1000,
        minRelativeStrength: minRelStrength,
      });
      const absOnsets = onsets.map((o) => o.time + startedAt);
      const { stats, slots, skippedBeforeGrid } = scoreOnsetsAgainstGrid(
        absOnsets,
        grid,
      );
      setOutcome({
        stats,
        detectedCount: onsets.length,
        scoredCount: slots.length - skippedBeforeGrid,
        skippedBeforeGrid,
      });
    },
    [sensitivity, minGapMs, minRelStrength],
  );

  const score = useCallback(async () => {
    const capture = captureRef.current;
    const grid = gridRef.current;
    if (!capture) return;
    setPhase('scoring');
    try {
      const captured = await capture.stop();
      captureRef.current = null;
      if (!captured) {
        setError('No audio captured — check the Clarett is the macOS input device.');
        setPhase('error');
        return;
      }
      if (!grid) {
        setError('No groove grid was captured — make sure the groove played while armed.');
        setPhase('error');
        return;
      }
      // Keep the raw take so slider changes re-score instantly.
      lastSignalRef.current = {
        signal: captured.signal,
        sampleRate: captured.sampleRate,
        startedAt: capture.startedAtCtxTime,
      };
      analyze(captured.signal, captured.sampleRate, capture.startedAtCtxTime, grid);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [analyze]);

  // Re-score the existing take when a tuning param changes (no re-record).
  useEffect(() => {
    if (phase === 'done' && lastSignalRef.current && gridRef.current) {
      const s = lastSignalRef.current;
      analyze(s.signal, s.sampleRate, s.startedAt, gridRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensitivity, minGapMs, minRelStrength]);

  // Auto-start on PLAY, auto-score on STOP — driven by the engine's isPlaying.
  useEffect(() => {
    if (isPlaying && phaseRef.current === 'armed') {
      // Capture the grid the instant playback begins. loopStartAudioTime is the
      // (future) bar-1 downbeat anchor; bpm derived from live loop geometry so it
      // agrees with the grid snap (4/4 → beatsPerBar 4).
      if (loopStartAudioTime != null && loopDurationSeconds > 0 && lengthBars > 0) {
        const BEATS_PER_BAR = 4;
        gridRef.current = {
          loopStartAudioTime,
          loopDurationSeconds,
          lengthBars,
          bpm: (BEATS_PER_BAR * 60) / (loopDurationSeconds / lengthBars),
        };
        setPhase('recording');
      }
    } else if (!isPlaying && phaseRef.current === 'recording') {
      // Playback stopped → that's the end of the take. Score automatically.
      void score();
    }
  }, [isPlaying, loopStartAudioTime, loopDurationSeconds, lengthBars, score]);

  const reset = useCallback(() => {
    captureRef.current?.dispose();
    captureRef.current = null;
    gridRef.current = null;
    setOutcome(null);
    setError(null);
    setPhase('idle');
  }, []);

  // Release the mic if the panel unmounts mid-arm.
  useEffect(() => () => captureRef.current?.dispose(), []);

  const o = outcome;
  const offsetMs = o ? o.stats.averageDrift : null;
  const jitterMs = o ? o.stats.jitter : null;

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ color: '#6ad08c', letterSpacing: '.05em' }}>
          🪞 TIMING MIRROR (spike · step 4 — numbers only)
        </strong>
        <span style={{ fontSize: 11, color: isPlaying ? '#6ad08c' : '#9aa0ad' }}>
          {isPlaying ? '● groove playing' : '○ stopped'}
        </span>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          style={primaryBtn}
          onClick={arm}
          disabled={phase === 'arming' || phase === 'armed' || phase === 'recording' || phase === 'scoring'}
        >
          {phase === 'arming' ? 'Arming…' : '1 · Arm'}
        </button>
        <button style={btn} onClick={reset} disabled={phase === 'idle'}>
          Reset
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: '#9aa0ad', lineHeight: 1.5 }}>
        {phase === 'idle' && (
          <>
            <b>How:</b> press <b>1 · Arm</b> (opens the mic, mutes the bass) → then
            press the card&apos;s <b>▶ Play</b> and play the bassline through the count-in.
            It records automatically and scores when the groove stops. No button to press while you play.
          </>
        )}
        {phase === 'arming' && 'Opening the mic… allow the permission prompt.'}
        {phase === 'armed' && (
          <span style={{ color: '#6ad08c' }}>
            ✅ Armed &amp; listening — now press the card&apos;s ▶ Play and play the bassline.
          </span>
        )}
        {phase === 'recording' && (
          <span style={{ color: '#e0604a' }}>● Recording — play along; stop the groove when done.</span>
        )}
        {phase === 'scoring' && 'Scoring…'}
        {phase === 'error' && <span style={{ color: '#e0604a' }}>⛔ {error}</span>}
      </div>

      {phase === 'done' && (
        <div style={{ marginTop: 12, padding: 10, background: '#0e1014', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#9aa0ad', marginBottom: 6 }}>
            ONSET TUNING (re-scores the same take live — dial until “detected” ≈ the
            notes you actually played)
          </div>
          <Slider
            label="sensitivity"
            value={sensitivity}
            min={0.5}
            max={6}
            step={0.1}
            onChange={setSensitivity}
            hint="higher = fewer onsets"
          />
          <Slider
            label="min gap (ms)"
            value={minGapMs}
            min={40}
            max={400}
            step={10}
            onChange={setMinGapMs}
            hint="one note can't re-fire within this"
          />
          <Slider
            label="strength floor"
            value={minRelStrength}
            min={0.02}
            max={0.6}
            step={0.01}
            onChange={setMinRelStrength}
            hint="drop weak flux below this × loudest"
          />
        </div>
      )}

      {o && offsetMs != null && jitterMs != null && (
        <>
          <div style={{ marginTop: 12, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Stat
              label="jitter (timing quality)"
              value={`${jitterMs.toFixed(1)} ms`}
              color={jitterMs < 25 ? '#6ad08c' : jitterMs < 45 ? '#e0b24a' : '#e0604a'}
              sub={`syncScore ${o.stats.syncScore.toFixed(0)} · ${o.stats.driftTrend}`}
            />
            <Stat
              label="offset (rig latency)"
              value={`${offsetMs >= 0 ? '+' : ''}${offsetMs.toFixed(1)} ms`}
              color="#9aa0ad"
              sub="NOT player error — calibrate out (G2, step 5)"
            />
            <Stat
              label="notes detected / scored"
              value={`${o.detectedCount} / ${o.scoredCount}`}
              color="#e7e9ee"
              sub={o.skippedBeforeGrid > 0 ? `${o.skippedBeforeGrid} in count-in` : 'onsets → grid'}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#9aa0ad', lineHeight: 1.5 }}>
            ⚠️ Step 4 = pipeline proof only. The offset is uncalibrated rig latency
            (round-trip calibration is step 5); the headline jitter number is not
            trustworthy until note-count sanity (G3) + ear A/B (G4) are wired. Numbers
            here are for validating the pipeline, not for showing a player yet.
          </div>
        </>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <span style={{ width: 110, color: '#9aa0ad', fontSize: 12 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, minWidth: 120 }}
      />
      <span style={{ width: 56, textAlign: 'right', color: '#e7e9ee', fontSize: 12 }}>
        {value}
      </span>
      <span style={{ flex: '1 1 140px', color: '#6b7280', fontSize: 11 }}>{hint}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ color: '#9aa0ad', fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: '#9aa0ad', fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

const panel: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 10,
  border: '1px solid #2a2d36',
  background: '#13151b',
  color: '#e7e9ee',
  font: '13px/1.5 ui-monospace, Menlo, monospace',
};
const btn: React.CSSProperties = {
  background: '#2a2f3a',
  color: '#e7e9ee',
  border: '1px solid #2a2d36',
  borderRadius: 7,
  padding: '8px 13px',
  font: 'inherit',
  cursor: 'pointer',
};
const primaryBtn: React.CSSProperties = {
  ...btn,
  background: '#6ad08c',
  color: '#0a0a0a',
  borderColor: '#6ad08c',
  fontWeight: 600,
};
