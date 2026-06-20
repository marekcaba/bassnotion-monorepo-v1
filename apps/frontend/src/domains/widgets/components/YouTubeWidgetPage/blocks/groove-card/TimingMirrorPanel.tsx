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
  toMono,
  type BassCapture,
} from './timing-mirror/captureBassInput';
import {
  detectBassOnsets,
  detectBassOnsetsAdaptive,
} from './timing-mirror/bassOnsetDetector';
import {
  scoreOnsetsAgainstGrid,
  type GridParams,
} from './timing-mirror/scoreAgainstGrid';
import { gradeTiming, type TimingGrade } from './timing-mirror/timingGrade';
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

  // Step 0 (bass coach) — reference-stem onset check. Detected count vs the authored
  // note count tells us whether detectBassOnsets is trustworthy on a CLEAN stem (the
  // gate before building reference grading; BASS_DEFAULTS were tuned for hot DI).
  const [refResult, setRefResult] = useState<{ detected: number } | null>(null);
  const analyzeReference = useCallback(() => {
    if (!bassBuffer) {
      setRefResult(null);
      return;
    }
    const onsets = detectBassOnsets(toMono(bassBuffer), bassBuffer.sampleRate, {
      sensitivity: refSensitivity,
      minOnsetGapSeconds: refMinGapMs / 1000,
      minRelativeStrength: refMinRelStrength,
    });
    setRefResult({ detected: onsets.length });
  }, [bassBuffer, refSensitivity, refMinGapMs, refMinRelStrength]);

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
  const authoredTotal = authoredNotes?.length ?? null;
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
      const absOnsets = onsets.map((o) => o.time + startedAt);

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

      // REFERENCE score (the coach) — detect the stem's onsets at original tempo,
      // map to ctx time via R = currentBpm/originalBpm, align + grade vs the player.
      if (coachMode === 'reference' && bassBuffer) {
        const R = originalBpm > 0 ? currentBpm / originalBpm : 1;
        const refMono = toMono(bassBuffer);
        // The reference stem uses its OWN preset (refOnsetOpts) — a quiet stem
        // needs a lower floor than the hot DI take. Sharing one preset mis-detected
        // one side → mass mis-alignment (coverage 62%, score 0 on a clean take).
        const refOnsets = detectBassOnsets(refMono, bassBuffer.sampleRate, refOnsetOpts);
        // reference onset (buffer-relative seconds) → ctx time: loopStart + t/R
        const refAbs = refOnsets.map((o) => grid.loopStartAudioTime + o.time / R);
        setRefScore(
          scoreAgainstReference(absOnsets, refAbs, grid, {
            expectedReferenceCount: expectedAttacks,
          }),
        );
      } else {
        setRefScore(null);
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

      {/* Step 0 (bass coach): does detectBassOnsets find the right notes in the
          REFERENCE stem? Detected vs authored = the gate before reference grading. */}
      <div style={{ marginTop: 10, padding: 10, background: '#0e1014', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button style={btn} onClick={analyzeReference} disabled={!bassBuffer}>
            Analyze reference stem
          </button>
          {!bassBuffer && (
            <span style={{ fontSize: 12, color: '#9aa0ad' }}>
              no bass stem loaded (press ▶ Play once to preload it)
            </span>
          )}
          {refResult && (
            <span style={{ fontSize: 13 }}>
              stem onsets detected:{' '}
              <b
                style={{
                  color:
                    expectedAttacks == null
                      ? '#e7e9ee'
                      : Math.abs(refResult.detected - expectedAttacks) <= 2
                        ? '#6ad08c'
                        : '#e0b24a',
                }}
              >
                {refResult.detected}
              </b>
              {expectedAttacks != null && (
                <span style={{ color: '#9aa0ad' }}>
                  {' '}/ ~{expectedAttacks} expected attacks
                  {authoredTotal != null && authoredTotal !== expectedAttacks && (
                    <span> ({authoredTotal} notes − {authoredTotal - expectedAttacks} legato)</span>
                  )}
                </span>
              )}
            </span>
          )}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
          Compares to EXPECTED ATTACKS (notes minus hammer-on/pull-off/slide, which
          sound with no fresh pluck), not the raw note count. Tune the REFERENCE
          sliders below, then re-analyze, until detected ≈ expected (a quiet stem
          needs a lower strength floor than your hot DI take).
        </div>
        {/* REFERENCE-stem onset preset — separate from the PLAYER preset because the
            stem and your live DI are different signal classes. */}
        <div style={{ marginTop: 8 }}>
          <Slider
            label="ref sensitivity"
            value={refSensitivity}
            min={0.5}
            max={6}
            step={0.1}
            onChange={setRefSensitivity}
            hint="reference stem"
          />
          <Slider
            label="ref min gap (ms)"
            value={refMinGapMs}
            min={40}
            max={400}
            step={10}
            onChange={setRefMinGapMs}
            hint="reference stem"
          />
          <Slider
            label="ref strength floor"
            value={refMinRelStrength}
            min={0.02}
            max={0.6}
            step={0.01}
            onChange={setRefMinRelStrength}
            hint="↓ for a quiet stem"
          />
        </div>
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
            {offsetMs.toFixed(1)}ms (rig latency, not player error — G2 calibration pending) ·
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
                <div style={{ color: '#9aa0ad', fontSize: 11 }}>vs the recording</div>
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
          <div style={{ marginTop: 10, fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
            reference vs player onset-by-onset. offset{' '}
            {refScore.offsetMs >= 0 ? '+' : ''}
            {refScore.offsetMs.toFixed(1)}ms (your constant lean vs the record — latency/anticipation,
            calibratable). The grade is the de-meaned spread (feel). Step 4 = timing only;
            length + dynamics are steps 5-6.
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
  width: 'min(560px, 46vw)',
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
