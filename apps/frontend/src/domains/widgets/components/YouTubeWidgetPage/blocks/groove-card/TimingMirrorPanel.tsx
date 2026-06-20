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

import { useCallback, useRef, useState } from 'react';
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

type Phase = 'idle' | 'recording' | 'scoring' | 'done' | 'error';

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

  // The grid is recordable only while the groove is looping past the count-in.
  const gridReady =
    isPlaying &&
    audioContext != null &&
    loopStartAudioTime != null &&
    loopDurationSeconds > 0 &&
    audioContext.currentTime - loopStartAudioTime >= 0;

  const onContextLost = useCallback(() => {
    captureRef.current = null;
    setPhase('error');
    setError('Engine audio context restarted mid-take — press ▶ Play again, then re-record.');
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setOutcome(null);
    if (!gridReady) {
      setError('Press the card ▶ Play and let the count-in finish, then Record.');
      setPhase('error');
      return;
    }
    try {
      captureRef.current = await startBassCapture(onContextLost);
      setPhase('recording');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [gridReady, onContextLost]);

  const stopAndScore = useCallback(async () => {
    const capture = captureRef.current;
    if (!capture) return;
    setPhase('scoring');
    // Snapshot the grid NOW (loopStartAudioTime re-anchors per loop / nulls on stop).
    // Derive bpm from the LIVE loop geometry so it agrees with the grid snap:
    //   barSeconds = loopDurationSeconds / lengthBars
    //   bpm = beatsPerBar * 60 / barSeconds   (4/4 → beatsPerBar = 4)
    const BEATS_PER_BAR = 4;
    const barSeconds = loopDurationSeconds / lengthBars;
    const grid: GridParams | null =
      loopStartAudioTime != null && loopDurationSeconds > 0 && lengthBars > 0
        ? {
            loopStartAudioTime,
            loopDurationSeconds,
            lengthBars,
            bpm: (BEATS_PER_BAR * 60) / barSeconds,
          }
        : null;
    try {
      const captured = await capture.stop();
      captureRef.current = null;
      if (!captured) {
        setError('No audio captured — check the input reached the browser.');
        setPhase('error');
        return;
      }
      if (!grid) {
        setError('Lost the groove grid before scoring — keep playing through Stop.');
        setPhase('error');
        return;
      }
      // buffer-relative onset seconds → absolute engine-clock seconds.
      const onsets = detectBassOnsets(captured.signal, captured.sampleRate);
      const absOnsets = onsets.map(
        (o) => o.time + capture.startedAtCtxTime,
      );
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
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [loopStartAudioTime, loopDurationSeconds, lengthBars]);

  const reset = useCallback(() => {
    captureRef.current?.dispose();
    captureRef.current = null;
    setOutcome(null);
    setError(null);
    setPhase('idle');
  }, []);

  const o = outcome;
  const offsetMs = o ? o.stats.averageDrift : null;
  const jitterMs = o ? o.stats.jitter : null;

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ color: '#6ad08c', letterSpacing: '.05em' }}>
          🪞 TIMING MIRROR (spike · step 4 — numbers only)
        </strong>
        <span style={{ fontSize: 11, color: gridReady ? '#6ad08c' : '#9aa0ad' }}>
          {gridReady ? '● grid ready' : '○ play the groove first'}
        </span>
      </div>

      {!isBassMuted && (
        <div style={{ marginTop: 8, color: '#e0b24a', fontSize: 12 }}>
          Mute the bass so you play along to the backing only.{' '}
          <button style={linkBtn} onClick={() => setStemMuted('audio-bass', true)}>
            mute bass
          </button>
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          style={primaryBtn}
          onClick={startRecording}
          disabled={phase === 'recording' || phase === 'scoring' || !gridReady}
          title={!gridReady ? 'Press ▶ Play and let the count-in finish' : undefined}
        >
          Record
        </button>
        <button style={btn} onClick={stopAndScore} disabled={phase !== 'recording'}>
          Stop &amp; score
        </button>
        <button style={btn} onClick={reset}>
          Reset
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: '#9aa0ad' }}>
        {phase === 'idle' && 'Mute bass → ▶ Play → Record → play the bassline on the beats → Stop & score.'}
        {phase === 'recording' && <span style={{ color: '#e0604a' }}>● Recording — play the bassline…</span>}
        {phase === 'scoring' && 'Scoring…'}
        {phase === 'error' && <span style={{ color: '#e0604a' }}>⛔ {error}</span>}
      </div>

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
const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6ad08c',
  textDecoration: 'underline',
  cursor: 'pointer',
  font: 'inherit',
  padding: 0,
};
