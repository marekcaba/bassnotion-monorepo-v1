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
 * split) is shown from the start: the constant offset (CAPTURE latency — the input
 * round-trip that shifts the recorded file later than what the player monitored
 * zero-latency through their interface; calibratable, not audible) is reported
 * SEPARATELY from the jitter (the timing-quality metric), because that constant is
 * pure system latency and reporting it as "you drag" is the impressive-but-wrong
 * trap. The player hears themselves in sync in their phones; the lag exists only in
 * the captured file.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startBassCapture,
  toMono,
  type BassCapture,
} from './timing-mirror/captureBassInput';
import {
  detectBassOnsets,
  detectBassOnsetsAdaptive,
  snapOnsetTimesToAttack,
  dedupNearbyOnsets,
  normalizePeak,
} from './timing-mirror/bassOnsetDetector';
import {
  scoreOnsetsAgainstGrid,
  type GridParams,
} from './timing-mirror/scoreAgainstGrid';
import { gradeTiming, type TimingGrade } from './timing-mirror/timingGrade';
import { TimingMirrorVisualizer, type VizData } from './TimingMirrorVisualizer';
import {
  scoreAgainstReference,
  type ReferenceScore,
} from './timing-mirror/scoreAgainstReference';
import type { TimingStatistics } from '@/domains/playback/utils/BeatTimingAnalyzer';

// G3: if more than this fraction of onsets collide on a subdivision, the detector
// is over-triggering and the score is untrustworthy → refuse to grade.
const COLLISION_REFUSE_THRESHOLD = 0.2;

interface TimingMirrorPanelProps {
  audioContext: AudioContext | null;
  loopStartAudioTime: number | null;
  loopDurationSeconds: number;
  lengthBars: number;
  isPlaying: boolean;
  isBassMuted: boolean;
  setStemMuted: (stem: 'audio-bass', muted: boolean) => void;
  // Step 0 (bass coach): the reference stem + the authored notes, to validate that
  // detectBassOnsets finds the right ATTACKS in a CLEAN stem (BASS_DEFAULTS were
  // tuned for hot DI — a different signal class). See docs/BASS_COACH_BUILD_PLAN.md.
  bassBuffer: AudioBuffer | null;
  /** Authored notes — we compare detected onsets to the count of notes that START
   *  a fresh ATTACK (excluding legato continuations: hammer-on/pull-off/slide, which
   *  sound with no new pluck), NOT the raw note count. */
  authoredNotes: { techniques?: string[] }[] | null;
  // Step 4/7 (bass coach reference mode): map reference-stem onsets to ctx time via
  // R = currentBpm / originalBpm (the stem is detected at original tempo, scaled live).
  currentBpm: number;
  originalBpm: number;
  // v2: STORED admin-approved reference transients (stem-buffer seconds) for the
  // active bassline. When present, the coach grades against THESE (ground truth),
  // not a live re-detection of the stem.
  storedReferenceOnsets: number[] | null;
}

// Flow built around how a musician actually plays: you can't press a button on
// the downbeat. So you ARM once (mic opens, bass auto-mutes), then just hit the
// card's ▶ Play and play — capture is already listening and auto-starts the moment
// playback begins, auto-scores when playback stops. No button in the heat of it.
//   idle → armed (mic open, waiting) → recording (auto, on play) → scoring → done
type Phase = 'idle' | 'arming' | 'armed' | 'recording' | 'scoring' | 'done' | 'error';

interface Outcome {
  stats: TimingStatistics;
  grade: TimingGrade;
  detectedCount: number;
  scoredCount: number;
  skippedBeforeGrid: number;
  collisionRate: number;
  untrustworthy: boolean;
}

export function TimingMirrorPanel({
  audioContext,
  loopStartAudioTime,
  loopDurationSeconds,
  lengthBars,
  isPlaying,
  isBassMuted,
  setStemMuted,
  bassBuffer,
  authoredNotes,
  currentBpm,
  originalBpm,
  storedReferenceOnsets,
}: TimingMirrorPanelProps) {
  // Coach mode: grade vs the ideal GRID, or vs the REFERENCE stem (the bass coach).
  const [coachMode, setCoachMode] = useState<'grid' | 'reference'>('grid');
  const [collapsed, setCollapsed] = useState(false);
  // Draggable floating panel — drag the header to move it off the groove card.
  // pos is top/left in px once dragged; null = default bottom-right anchor.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const onDragMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    setPos({ left: e.clientX - dragRef.current.dx, top: e.clientY - dragRef.current.dy });
  }, []);
  const onDragEnd = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
  }, [onDragMove]);
  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      // grab from the element's current screen rect so the cursor stays put
      const rect = (e.currentTarget as HTMLElement)
        .closest('[data-timing-mirror-panel]')!
        .getBoundingClientRect();
      dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
      window.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onDragEnd);
    },
    [onDragMove, onDragEnd],
  );
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [refScore, setRefScore] = useState<ReferenceScore | null>(null);
  const [vizData, setVizData] = useState<VizData | null>(null);
  // The input latency we measured + already subtracted from the start anchor — so
  // we can SEE how much of the old +77ms was capture latency (vs real anticipation).
  const [measuredLatencyMs, setMeasuredLatencyMs] = useState<number | null>(null);
  const captureRef = useRef<BassCapture | null>(null);
  // Live-tunable onset params — a real hot DI bass over-triggers vs the synthetic
  // test signal, so we dial these against the ACTUAL bass (ear-first) instead of
  // guessing. The last recorded take is kept so re-scoring is instant on a change.
  // Defaults below were dialed against a real Clarett DI bass take (2026-06-20):
  // detected-count matched the played notes at sensitivity 2.1 / gap 120 / floor 0.25.
  // PLAYER preset — your hot Clarett DI take (the 219-over-trigger rig).
  const [sensitivity, setSensitivity] = useState(2.1);
  const [minGapMs, setMinGapMs] = useState(120);
  const [minRelStrength, setMinRelStrength] = useState(0.25);
  // v2: ADAPTIVE player detection (no slider — floor found from the take's own
  // signal). On by default; the sliders below are a fallback for comparison.
  const [adaptivePlayer, setAdaptivePlayer] = useState(true);
  // REFERENCE preset — the recorded stem (different signal class: a quiet stem
  // needs a lower strength floor, ~0.06). Player and reference CANNOT share one
  // preset — that was making the coach mis-align (low coverage, score 0).
  const [refSensitivity, setRefSensitivity] = useState(2.1);
  const [refMinGapMs, setRefMinGapMs] = useState(120);
  const [refMinRelStrength, setRefMinRelStrength] = useState(0.06);
  const refOnsetOpts = {
    sensitivity: refSensitivity,
    minOnsetGapSeconds: refMinGapMs / 1000,
    minRelativeStrength: refMinRelStrength,
  };
  const lastSignalRef = useRef<{ signal: Float32Array; sampleRate: number; startedAt: number } | null>(null);

  // Expected ATTACK count = authored notes MINUS legato continuations. A hammer-on /
  // pull-off / slide sounds with NO fresh pluck, so it produces no onset — comparing
  // detected onsets to the raw note count would always under-read. This is the honest
  // target: how many notes actually start an attack.
  const LEGATO = new Set(['hammer_on', 'pull_off', 'slide_up', 'slide_down']);
  const expectedAttacks =
    authoredNotes == null
      ? null
      : authoredNotes.filter(
          (n) => !(n.techniques ?? []).some((t) => LEGATO.has(t)),
        ).length;
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
      rawSignal: Float32Array,
      sampleRate: number,
      startedAt: number,
      grid: GridParams,
    ) => {
      // NORMALIZE the captured take: a DI/mic take is often quiet, and a quiet signal
      // hurts BOTH detection AND attack-snap (the snap walks to 70% of the LOCAL peak
      // — a soft attack ramps up slowly, so the onset lands LATE). Peak-normalize to
      // near full-scale so detection + snapping work on a loud, punchy signal
      // regardless of input gain. (This is the "the waveform should be bigger" fix.)
      const signal = normalizePeak(rawSignal);
      // PLAYER onsets — adaptive (floor from the take's own signal, no slider) or
      // the manual slider preset as a fallback. expectedCount = the reference's
      // attack count, which nudges the adaptive floor toward the right target.
      const onsets = adaptivePlayer
        ? detectBassOnsetsAdaptive(signal, sampleRate, {
            minOnsetGapSeconds: minGapMs / 1000,
            expectedCount: expectedAttacks ?? undefined,
          })
        : detectBassOnsets(signal, sampleRate, {
            sensitivity,
            minOnsetGapSeconds: minGapMs / 1000,
            minRelativeStrength: minRelStrength,
          });
      // Snap player onsets to the ATTACK EDGE (steepest energy RISE), then DEDUP the
      // ones that collapsed onto the same attack. Fixes (1) ticks landing in the loud
      // note BODY instead of the sharp pluck, and (2) one note getting 2-3 ticks (the
      // flux fires across the swelling body → snap pulls them to the same edge → merge).
      // Same convention for reference markers + player take.
      const snapped = snapOnsetTimesToAttack(
        onsets.map((o) => o.time),
        signal,
        sampleRate,
      );
      // KILL body-ripple over-trigger by GAP, not energy. PROVEN on the real DI take:
      // a held bass note pulses at a FIXED ~128ms period (its ripple), so flux fires
      // clusters spaced 122-144ms; REAL note spacing in the take is ≥200ms. There's a
      // clean valley between them, so dedup at 155ms collapses each ripple cluster to
      // its FIRST onset (the true attack) without touching real notes. (The earlier
      // energy gate `rejectBodyRipple` mis-fired in busy passages — a new note after a
      // loud TAIL looks like a ripple to it — so we rely on the gap, which doesn't.)
      const deduped = dedupNearbyOnsets(snapped, 0.155);
      const absOnsets = deduped.map((t) => t + startedAt);

      // DEBUG DUMP (dev probe): stash the take + each detection stage on window so we
      // can verify where attacks vs ticks land on the REAL signal instead of guessing.
      // In console: copy(window.__bassTakeDebug) → paste back. Downsampled envelope +
      // raw onset/snap/dedup times. No-op unless the probe flag is on (panel is gated).
      try {
        const dsStep = Math.max(1, Math.floor(sampleRate * 0.002)); // ~2ms env
        const env: number[] = [];
        for (let i = 0; i + dsStep <= signal.length; i += dsStep) {
          let p = 0;
          for (let k = i; k < i + dsStep; k++) {
            const a = Math.abs(signal[k] ?? 0);
            if (a > p) p = a;
          }
          env.push(Math.round(p * 1000) / 1000);
        }
        (window as unknown as Record<string, unknown>).__bassTakeDebug = JSON.stringify({
          sampleRate,
          envStepSec: dsStep / sampleRate,
          envPeakPerStep: env,
          rawOnsetsSec: onsets.map((o) => Math.round(o.time * 1000) / 1000),
          snappedSec: snapped.map((t) => Math.round(t * 1000) / 1000),
          dedupedSec: deduped.map((t) => Math.round(t * 1000) / 1000),
        });
      } catch {
        /* dump is best-effort */
      }

      // GRID score (always — the baseline, and the grid-mode result).
      const { stats, slots, skippedBeforeGrid, collisionRate } =
        scoreOnsetsAgainstGrid(absOnsets, grid);
      setOutcome({
        stats,
        grade: gradeTiming(stats.jitter, stats.averageDrift),
        detectedCount: onsets.length,
        scoredCount: slots.length - skippedBeforeGrid,
        skippedBeforeGrid,
        collisionRate,
        untrustworthy: collisionRate > COLLISION_REFUSE_THRESHOLD,
      });

      // REFERENCE score (the coach) — grade vs the reference's note positions,
      // mapped to ctx time via loopStart + t/R (R = currentBpm/originalBpm).
      if (coachMode === 'reference' && bassBuffer) {
        const R = originalBpm > 0 ? currentBpm / originalBpm : 1;
        const refMono = toMono(bassBuffer);
        // GROUND TRUTH: if the admin approved a stored reference analysis for this
        // bassline, grade against THOSE markers — deterministic, human-verified, no
        // live re-detection (which was the source of every reference-side problem).
        // Fall back to live detection only when nothing is approved yet.
        const refBufSec =
          storedReferenceOnsets && storedReferenceOnsets.length > 0
            ? storedReferenceOnsets
            : detectBassOnsets(refMono, bassBuffer.sampleRate, refOnsetOpts).map(
                (o) => o.time,
              );
        // reference onset (buffer-relative seconds) → ctx time: loopStart + t/R
        const refAbs = refBufSec.map((t) => grid.loopStartAudioTime + t / R);
        const usingStored =
          storedReferenceOnsets != null && storedReferenceOnsets.length > 0;
        const score = scoreAgainstReference(absOnsets, refAbs, grid, {
          // the stored set is approved-by-definition → skip the ref-count trust guard
          expectedReferenceCount: usingStored ? null : expectedAttacks,
        });
        setRefScore(score);
        // Capture everything the visualizer needs to SHOW the analysis.
        setVizData({
          grid,
          playerSignal: signal,
          playerSampleRate: sampleRate,
          playerStartedAt: startedAt,
          playerOnsetsSec: absOnsets,
          refSignal: refMono,
          refSampleRate: bassBuffer.sampleRate,
          refOnsetsSec: refAbs,
          R,
          score,
        });
      } else {
        setRefScore(null);
        setVizData(null);
      }
    },
    [
      sensitivity,
      minGapMs,
      minRelStrength,
      adaptivePlayer,
      refSensitivity,
      refMinGapMs,
      refMinRelStrength,
      coachMode,
      bassBuffer,
      currentBpm,
      originalBpm,
      expectedAttacks,
      storedReferenceOnsets,
    ],
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
      // Record how much input latency we compensated (for the debug readout).
      setMeasuredLatencyMs(Math.round(capture.inputLatencySec * 1000));
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
  }, [
    sensitivity,
    minGapMs,
    minRelStrength,
    adaptivePlayer,
    refSensitivity,
    refMinGapMs,
    refMinRelStrength,
    coachMode,
  ]);

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
    setRefScore(null);
    setError(null);
    setPhase('idle');
  }, []);

  // Release the mic if the panel unmounts mid-arm.
  useEffect(() => () => captureRef.current?.dispose(), []);

  // Clean up any dangling drag listeners on unmount.
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragEnd);
    },
    [onDragMove, onDragEnd],
  );

  const o = outcome;
  const offsetMs = o ? o.stats.averageDrift : null;
  const jitterMs = o ? o.stats.jitter : null;

  return (
    <div
      data-timing-mirror-panel
      style={
        pos
          ? { ...panel, left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' }
          : panel
      }
    >
      <div
        onPointerDown={onDragStart}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          cursor: 'move',
          touchAction: 'none',
        }}
      >
        <strong style={{ color: '#6ad08c', letterSpacing: '.05em' }}>
          ⠿ 🪞 TIMING MIRROR (spike)
        </strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: isPlaying ? '#6ad08c' : '#9aa0ad' }}>
            {isPlaying ? '● playing' : '○ stopped'}
          </span>
          <button
            style={{ ...btn, padding: '2px 8px' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▢' : '—'}
          </button>
        </div>
      </div>

      {collapsed ? null : (
      <>

      {/* Coach mode: grade vs the ideal GRID or vs the REFERENCE recording. */}
      <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#9aa0ad' }}>grade vs:</span>
        {(['grid', 'reference'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setCoachMode(m)}
            style={{
              ...btn,
              padding: '4px 10px',
              // Use the `border` shorthand (not borderColor) to match btn's
              // shorthand — mixing the two makes React warn on toggle.
              ...(coachMode === m
                ? { background: '#6ad08c', color: '#0a0a0a', border: '1px solid #6ad08c' }
                : {}),
            }}
          >
            {m === 'grid' ? 'the grid (timing)' : 'the recording (coach)'}
          </button>
        ))}
      </div>

      {/* The reference is the admin-APPROVED stored markers (authored in the block
          editor). No live re-detection here — this just reports whether this
          bassline has an approved set the coach will grade against. */}
      <div style={{ marginTop: 10, padding: 10, background: '#0e1014', borderRadius: 8, fontSize: 13 }}>
        {storedReferenceOnsets && storedReferenceOnsets.length > 0 ? (
          <span style={{ color: '#6ad08c' }}>
            ✓ Reference: {storedReferenceOnsets.length} approved markers — the coach
            grades against these (authored in the admin block editor).
          </span>
        ) : (
          <span style={{ color: '#e0b24a' }}>
            ⚠ No approved reference for this bassline. The coach falls back to
            live-detecting the stem (less reliable). Author + save markers in the
            admin block editor (Bass coach → Reference) for ground-truth grading.
          </span>
        )}
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

      {/* PLAYER detection — the adaptive toggle shows ALWAYS (so you set it before
          recording); the manual sliders only appear after a take (they re-score it
          live) and only when adaptive is off. */}
      <div style={{ marginTop: 12, padding: 10, background: '#0e1014', borderRadius: 8 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: '#e7e9ee',
          }}
        >
          <input
            type="checkbox"
            checked={adaptivePlayer}
            onChange={(e) => setAdaptivePlayer(e.target.checked)}
          />
          <b>Adaptive player detection</b> (v2 — floor from the take&apos;s own signal,
          no slider). Uncheck to use the manual sliders.
        </label>

        {!adaptivePlayer && phase === 'done' && (
          <>
            <div style={{ fontSize: 11, color: '#9aa0ad', margin: '8px 0 6px' }}>
              PLAYER ONSET TUNING (manual fallback — dial until “detected” ≈ the notes
              you actually played; re-scores live)
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
          </>
        )}
        {!adaptivePlayer && phase !== 'done' && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
            Manual sliders appear after you record a take.
          </div>
        )}
      </div>

      {coachMode === 'grid' && o && offsetMs != null && jitterMs != null && (
        <>
          {o.untrustworthy ? (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#331a16',
                border: '1px solid #6b352a',
                color: '#e0b24a',
                lineHeight: 1.5,
              }}
            >
              ⛔ Can&apos;t trust this take — {Math.round(o.collisionRate * 100)}% of onsets
              piled onto the same beats (the detector is over-triggering, likely sustain
              or bleed). Nudge <b>sensitivity</b> up, or check the input, and re-record.
              No score shown rather than a false one.
            </div>
          ) : (
            <div style={{ marginTop: 14, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
              {/* HEADLINE — human grade, not the machine "erratic" */}
              <div style={{ minWidth: 200 }}>
                <div style={{ color: '#9aa0ad', fontSize: 11 }}>your timing</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: o.grade.color, lineHeight: 1.1 }}>
                  {o.grade.label}
                </div>
                <div style={{ color: '#9aa0ad', fontSize: 12 }}>
                  {jitterMs.toFixed(0)}ms spread
                  {o.grade.feel !== 'centered' && ` · you tend to ${o.grade.feel}`}
                </div>
              </div>
              <Stat
                label="pocket score"
                value={`${o.grade.score}`}
                color={o.grade.color}
                sub="human-scaled (0–100)"
              />
              <Stat
                label="notes detected / scored"
                value={`${o.detectedCount} / ${o.scoredCount}`}
                color="#e7e9ee"
                sub={o.skippedBeforeGrid > 0 ? `${o.skippedBeforeGrid} in count-in` : 'onsets → grid'}
              />
            </div>
          )}

          {/* honest detail (always shown, even when graded) */}
          <div style={{ marginTop: 10, fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
            raw: jitter {jitterMs.toFixed(1)}ms · offset{' '}
            {offsetMs >= 0 ? '+' : ''}
            {offsetMs.toFixed(1)}ms (capture latency — the recorded file lags what you
            monitored; you can&apos;t hear it. Calibrated out, not your error) ·
            collisions {Math.round(o.collisionRate * 100)}%. The pocket grade is human-scaled;
            BeatTimingAnalyzer&apos;s own &quot;{o.stats.driftTrend}&quot;/syncScore{' '}
            {o.stats.syncScore.toFixed(0)} are machine-tuned and not used for the headline.
          </div>
        </>
      )}

      {/* REFERENCE-mode result — the bass coach: how close to the recording. */}
      {coachMode === 'reference' && refScore && (
        <div style={{ marginTop: 14 }}>
          {refScore.untrustworthy ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: '#331a16',
                border: '1px solid #6b352a',
                color: '#e0b24a',
                lineHeight: 1.5,
              }}
            >
              ⛔ {refScore.untrustworthyReason}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div style={{ minWidth: 200 }}>
                <div style={{ color: '#9aa0ad', fontSize: 11 }}>
                  vs the recording{' '}
                  {storedReferenceOnsets && storedReferenceOnsets.length > 0 ? (
                    <span style={{ color: '#6ad08c' }}>· ✓ approved markers</span>
                  ) : (
                    <span style={{ color: '#e0b24a' }}>· live-detected (no approved set)</span>
                  )}
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, color: refScore.grade.color, lineHeight: 1.1 }}>
                  {refScore.grade.label}
                </div>
                <div style={{ color: '#9aa0ad', fontSize: 12 }}>
                  {refScore.jitterMs.toFixed(0)}ms spread
                  {refScore.grade.feel !== 'centered' && ` · you tend to ${refScore.grade.feel}`}
                </div>
              </div>
              <Stat
                label="match score"
                value={`${refScore.grade.score}`}
                color={refScore.grade.color}
                sub="how close to the record"
              />
              <Stat
                label="coverage"
                value={`${Math.round(refScore.coverage * 100)}%`}
                color={refScore.coverage > 0.85 ? '#6ad08c' : '#e0b24a'}
                sub={`${refScore.matchedCount} hit · ${refScore.missedCount} missed · ${refScore.noiseCount} noise`}
              />
            </div>
          )}
          {/* THE VISUALIZER — see the take over the reference, the transients, the
              alignment, the matched/missed/noise. */}
          {vizData && <TimingMirrorVisualizer data={vizData} />}

          <div style={{ marginTop: 10, fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
            {measuredLatencyMs != null && (
              <>
                <span style={{ color: '#7aa2ff' }}>
                  input latency auto-corrected: −{measuredLatencyMs}ms
                </span>{' '}
                (subtracted from the take BEFORE detection — this is why the blue ticks
                should now sit ON your attacks, not after them). <br />
              </>
            )}
            residual offset{' '}
            {refScore.offsetMs >= 0 ? '+' : ''}
            {refScore.offsetMs.toFixed(1)}ms — what's LEFT after the auto-correction.
            Near 0 = the latency fully explained the lag. A real non-zero residual =
            genuine anticipation/drag in your playing. It's still calibrated out before
            grading. The grade is the de-meaned spread (your actual feel). Step 4 =
            timing only; length + dynamics are steps 5-6.
          </div>
        </div>
      )}

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
  // FLOATING overlay, fixed to the viewport with its own scroll — the inline panel
  // grew the page past its scroll limit and the results at the bottom were
  // unreachable. Fixed-positioning decouples it from the page's scroll entirely.
  position: 'fixed',
  bottom: 12,
  right: 12,
  width: 'min(820px, 62vw)',
  maxHeight: '92vh',
  overflowY: 'auto',
  zIndex: 9999,
  padding: 14,
  borderRadius: 10,
  border: '1px solid #2a2d36',
  background: '#13151bf2', // slightly translucent
  boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
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
  border: '1px solid #6ad08c', // shorthand (not borderColor) to match btn's `border`
  fontWeight: 600,
};
