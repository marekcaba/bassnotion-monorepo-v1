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
  snapOnsetTimesToAttack,
  dedupNearbyOnsets,
  normalizePeak,
} from './timing-mirror/bassOnsetDetector';
import { detectOnsetsComplexDomain } from './timing-mirror/complexDomainOnsets';
import {
  measureAtMarkers,
  scoreMarkerMeasurements,
} from './timing-mirror/measureAtMarkers';
import { verifyPitch } from './timing-mirror/verifyPitch';
import { pitchVerdict } from './timing-mirror/pitchVerdict';
import { midiPitchToNoteName } from '@/domains/admin/utils/fretboardCalculations';
import type { ReferenceAnalysis } from '@bassnotion/contracts';
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
  // The FULL authored analysis (string+fret+technique per marker), for grading PITCH
  // ("right note?") and routing technique. null when nothing authored.
  storedReferenceAnalysis: ReferenceAnalysis | null;
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
  storedReferenceAnalysis,
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
  // Pitch summary (the WHAT): right-note % across markers with an authored pitch + a
  // confident detection. null = nothing to grade (no authored pitches yet).
  const [pitchSummary, setPitchSummary] = useState<{
    accuracy: number;
    right: number;
    graded: number;
    wrong: number;
  } | null>(null);
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
      // PLAYER onsets — COMPLEX-DOMAIN detection (Bello/Duxbury, the Ableton lineage).
      // Phase-aware: a real new note breaks the phase prediction; a sustained note's
      // BODY RIPPLE keeps the same phase evolving smoothly → not an onset. This replaced
      // the energy/spectral-flux detector that MISSED soft attacks and OVER-TRIGGERED on
      // ripple (proven on real DI; see memory bass-onset-complex-domain). Built-in
      // recent-peak gate + adaptive median threshold + refractory — no downstream gap/
      // energy band-aids needed.
      const onsetTimes = detectOnsetsComplexDomain(signal, sampleRate);
      // Light attack-snap for sub-frame precision (the FFT window localizes to ~10ms;
      // snap nudges onto the exact pluck edge). Same convention as the reference markers.
      const snapped = snapOnsetTimesToAttack(onsetTimes, signal, sampleRate);
      // NO blind player dedup. The coach's HAND-AUTHORED reference markers are the source
      // of truth for HOW MANY notes and WHERE — the matcher (alignToReference, coach-
      // anchored) claims the nearest player attack per marker. The complex-domain detector
      // already gives clean one-per-note onsets, so the matcher just measures distance.
      const absOnsets = snapped.map((t) => t + startedAt);
      // GRID mode has no reference to anchor on, so without a dedup it would score each
      // body ripple as a separate (colliding) onset against the grid. Give the grid
      // scorer a deduped set — but NEVER the reference matcher (which protects fast
      // authored notes itself). 155ms = above the ~128ms ripple period.
      const gridOnsets = dedupNearbyOnsets(snapped, 0.155).map((t) => t + startedAt);

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
          rawOnsetsSec: onsetTimes.map((t) => Math.round(t * 1000) / 1000),
          snappedSec: snapped.map((t) => Math.round(t * 1000) / 1000),
          // player onsets fed to the REFERENCE matcher = raw snapped (no dedup).
          playerForMatchSec: snapped.map((t) => Math.round(t * 1000) / 1000),
        });
      } catch {
        /* dump is best-effort */
      }

      // GRID score (always — the baseline, and the grid-mode result). Uses the DEDUPED
      // set (no reference to protect fast notes here, so ripples must be collapsed).
      const { stats, slots, skippedBeforeGrid, collisionRate } =
        scoreOnsetsAgainstGrid(gridOnsets, grid);
      setOutcome({
        stats,
        grade: gradeTiming(stats.jitter, stats.averageDrift),
        detectedCount: onsetTimes.length,
        scoredCount: slots.length - skippedBeforeGrid,
        skippedBeforeGrid,
        collisionRate,
        untrustworthy: collisionRate > COLLISION_REFUSE_THRESHOLD,
      });

      // REFERENCE score (the coach) — the Yousician mechanic: the coach's AUTHORED
      // MARKERS are the only anchors. For each marker we search the PLAYER'S RAW AUDIO
      // in a window around it for the player's transient, and measure the offset. NO
      // global player-onset detection, NO two-list matching (that was the whole source
      // of the missed/noise mess). One measurement per marker, always.
      if (coachMode === 'reference' && bassBuffer) {
        const R = originalBpm > 0 ? currentBpm / originalBpm : 1;
        const refMono = toMono(bassBuffer);
        const refBufSec =
          storedReferenceOnsets && storedReferenceOnsets.length > 0
            ? storedReferenceOnsets
            : detectBassOnsets(refMono, bassBuffer.sampleRate, refOnsetOpts).map(
                (o) => o.time,
              );
        // reference marker (buffer-relative seconds) → ctx time: loopStart + t/R
        const refAbs = refBufSec.map((t) => grid.loopStartAudioTime + t / R);

        // SEARCH the player audio at each marker. `signal` is the normalized raw take;
        // `startedAt` is its sample-0 ctx time. Each measurement: where the player's
        // transient is vs the marker, or null (missed).
        const measurements = measureAtMarkers(signal, sampleRate, startedAt, refAbs);

        // PITCH (the "WHAT"): for each HIT, detect the player's fundamental in a window
        // starting ~12ms after the found attack (skip the broadband pluck, land on the
        // steady tone). The window is BOUNDED BY THE NEXT MARKER so a fast cluster's note
        // can't bleed into its neighbour (the cause of harmonic/neighbour mis-reads on
        // quiet runs). Up to ~90ms (≥3 low-B periods) when there's room, but never past
        // ~85% of the gap to the next note. A window too short for a clean read → null.
        const pitchPerMarker = measurements.map((m, i) => {
          if (m.playerSec == null) return null;
          const onsetBuf = Math.round((m.playerSec - startedAt) * sampleRate);
          const winStart = onsetBuf + Math.round(0.012 * sampleRate);
          // gap to the next marker's player onset (or the take end)
          const nextSec =
            measurements
              .slice(i + 1)
              .find((n) => n.playerSec != null)?.playerSec ?? null;
          const gapSec =
            nextSec != null ? Math.max(0, nextSec - (m.playerSec as number)) : Infinity;
          const maxLen = Math.min(
            Math.round(0.09 * sampleRate),
            Math.round(gapSec * 0.85 * sampleRate),
          );
          if (maxLen < Math.round(0.04 * sampleRate)) return null; // too short to trust
          if (winStart + maxLen > signal.length) return null;
          // CONTAMINATION GUARD (lownote-pitch-error workflow): a quiet note's window can be
          // dominated by a LOUDER overlapping neighbour, so YIN confidently reads the
          // NEIGHBOUR's pitch (measured error = neighbourMidi − thisNoteMidi → the ±2-semitone
          // false "wrong note"). A CLEAN read AGREES across a short and a long window; a
          // contaminated one does NOT (probe: real quiet onsets disagreed 6/7). If a short
          // sub-window disagrees with the full window, the read is untrustworthy → demote its
          // confidence below pitchVerdict's minWrongConf (0.85) so it becomes 'unknown' (not
          // penalised), never a confident 'wrong'.
          const full = verifyPitch(signal.subarray(winStart, winStart + maxLen), sampleRate);
          if (full == null) return null;
          const shortLen = Math.min(maxLen, Math.round(0.072 * sampleRate)); // YIN low-B floor
          if (shortLen < maxLen) {
            const shortRead = verifyPitch(
              signal.subarray(winStart, winStart + shortLen),
              sampleRate,
            );
            if (shortRead != null && shortRead.midi !== full.midi) {
              return { ...full, confidence: Math.min(full.confidence, 0.5) };
            }
          }
          return full;
        });

        // COMPARE detected pitch to the AUTHORED note (string+fret per marker → expected
        // pitch). Verdict: correct / octave (slip, graded right) / wrong / unknown / n/a.
        const refBassType = storedReferenceAnalysis?.bassType ?? '4';
        const verdictPerMarker = measurements.map((_m, i) => {
          const note = {
            string: storedReferenceAnalysis?.stringNumbers?.[i] ?? null,
            fret: storedReferenceAnalysis?.frets?.[i] ?? null,
            role: storedReferenceAnalysis?.roles?.[i] ?? null,
          };
          return pitchVerdict(pitchPerMarker[i] ?? null, note, refBassType);
        });
        // GATING RULE (user 2026-06-22): a note counts (and is timing-graded) UNLESS the
        // detector is CONFIDENT it was the WRONG note. Ghosts (n/a) and pitch-unknown still
        // count — the detector's own uncertainty never punishes the player; only a confident
        // wrong-note breaks the slot.
        const isWrong = (i: number) => verdictPerMarker[i]!.verdict === 'wrong';
        // Timing is graded on the NON-wrong notes only. We NULL the errorSec of a wrong
        // note (rather than drop the marker) so it (a) doesn't dilute the feel jitter — a
        // wrong note isn't the right note — but (b) STILL counts in the coverage
        // denominator: it's a marker the coach authored where the player played the wrong
        // note, which is NOT a correctly-played note. Effectively a miss-for-coverage.
        const timingMeasurements = measurements.map((m, i) =>
          isWrong(i) ? { ...m, playerSec: null, errorSec: null } : m,
        );
        const wrongCount = measurements.filter(
          (m, i) => m.playerSec != null && isWrong(i),
        ).length;

        // Summary: of the markers that HAVE an authored pitch and a confident detection,
        // how many were the right note. (octave counts as right.)
        const pitchGraded = verdictPerMarker.filter(
          (v) => v.verdict === 'correct' || v.verdict === 'octave' || v.verdict === 'wrong',
        );
        const pitchRight = pitchGraded.filter(
          (v) => v.verdict === 'correct' || v.verdict === 'octave',
        ).length;
        const pitchAccuracy =
          pitchGraded.length > 0 ? pitchRight / pitchGraded.length : null;

        // TIMING score on the gated set: a confident wrong note doesn't dilute the feel
        // grade (it's not the right note). Coverage/jitter/offset all from non-wrong notes.
        const mScore = scoreMarkerMeasurements(timingMeasurements);

        // Adapt to the existing ReferenceScore shape the UI consumes. No more "noise"
        // (we never detect phantom onsets); matched = hits, missed = no transient found.
        const grade = gradeTiming(mScore.jitterMs, mScore.offsetMs);
        const untrustworthy = mScore.coverage < 0.5;
        const score: ReferenceScore = {
          grade,
          offsetMs: mScore.offsetMs,
          jitterMs: mScore.jitterMs,
          coverage: mScore.coverage,
          matchedCount: mScore.hitCount, // correctly-played notes (right pitch / n/a / unknown)
          // genuine misses = nothing played in the slot. Wrong notes are nulled-for-timing
          // so they're in mScore.missedCount too; split them out for an honest label.
          missedCount: mScore.missedCount - wrongCount,
          noiseCount: wrongCount, // shown as "wrong" in the sub-text (not phantom noise)
          untrustworthy,
          untrustworthyReason: untrustworthy
            ? `Only ${Math.round(mScore.coverage * 100)}% of the part was played — play more of it before scoring the timing.`
            : null,
          alignment: {
            // MATCHED = correctly-played notes (right pitch / n-a / unknown) with an onset.
            // A WRONG-pitch note is NOT a matched pair — it goes to `noise` (drawn red on the
            // player lane) so you SEE where the wrong notes were. (subIndex = original marker
            // index, computed before filtering, so it's correct.)
            matched: measurements
              .map((m, i) => ({ m, i }))
              .filter(({ m, i }) => m.playerSec != null && !isWrong(i))
              .map(({ m, i }) => ({
                subIndex: i,
                referenceSec: m.markerSec,
                playerSec: m.playerSec as number,
                errorSec: m.errorSec as number,
              })),
            // MISSED = a marker where nothing was played (genuine miss) — amber on ref lane.
            missed: measurements
              .filter((m) => m.playerSec == null)
              .map((m) => m.markerSec),
            // WRONG notes (played, but a confident wrong pitch) — red on the player lane.
            noise: measurements
              .map((m, i) => ({ m, i }))
              .filter(({ m, i }) => m.playerSec != null && isWrong(i))
              .map(({ m }) => m.playerSec as number),
            coverage: mScore.coverage,
          },
        };
        setRefScore(score);
        setPitchSummary(
          pitchAccuracy == null
            ? null
            : {
                accuracy: Math.round(pitchAccuracy * 100),
                right: pitchRight,
                graded: pitchGraded.length,
                wrong: wrongCount,
              },
        );
        // DEBUG DUMP (per-marker diagnostic): every marker, where the player transient
        // was found (or missed), and the offset. copy(window.__bassMatchDebug).
        try {
          const r2 = (n: number) => Math.round(n * 1000) / 1000;
          (window as unknown as Record<string, unknown>).__bassMatchDebug =
            JSON.stringify({
              markers: measurements.map((m, i) => {
                const p = pitchPerMarker[i];
                const v = verdictPerMarker[i]!;
                return {
                  marker: r2(m.markerSec),
                  player: m.playerSec == null ? null : r2(m.playerSec),
                  errMs: m.errorSec == null ? null : Math.round(m.errorSec * 1000),
                  strength: Math.round(m.strength * 100) / 100,
                  // pitch (the WHAT): the note the student PLAYED vs the AUTHORED note
                  // (string+fret), as NOTE NAMES (no MIDI) + the verdict.
                  played: p ? midiPitchToNoteName(p.midi) : null,
                  expected: v.expected == null ? null : midiPitchToNoteName(v.expected),
                  cents: p ? p.cents : null,
                  pConf: p ? Math.round(p.confidence * 100) / 100 : null,
                  pitch: v.verdict, // correct/octave/wrong/unknown/n/a
                };
              }),
              hitCount: mScore.hitCount,
              missedCount: mScore.missedCount,
              wrongNoteCount: wrongCount, // confident wrong notes — don't count as played
              offsetMs: Math.round(mScore.offsetMs),
              jitterMs: Math.round(mScore.jitterMs),
              pitchRight,
              pitchGraded: pitchGraded.length,
              pitchAccuracy:
                pitchAccuracy == null ? null : Math.round(pitchAccuracy * 100),
            });
        } catch {
          /* best-effort */
        }
        // Capture everything the visualizer needs to SHOW the analysis.
        setVizData({
          grid,
          playerSignal: signal,
          playerSampleRate: sampleRate,
          playerStartedAt: startedAt,
          // player ticks = where we FOUND the player's transient at each marker (the
          // measured hits) — not a global detection. The blue ticks now sit exactly on
          // what the matcher measured, so the by-eye comparison matches the verdict.
          playerOnsetsSec: measurements
            .filter((m) => m.playerSec != null)
            .map((m) => m.playerSec as number),
          refSignal: refMono,
          refSampleRate: bassBuffer.sampleRate,
          refOnsetsSec: refAbs,
          R,
          score,
        });
      } else {
        setRefScore(null);
        setVizData(null);
        setPitchSummary(null);
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
      storedReferenceAnalysis,
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
                sub={`${refScore.matchedCount} hit · ${refScore.missedCount} missed${refScore.noiseCount > 0 ? ` · ${refScore.noiseCount} wrong note` : ''}`}
              />
              {/* PITCH (the WHAT) — right-note % vs the authored string+fret. */}
              {pitchSummary && (
                <Stat
                  label="right notes"
                  value={`${pitchSummary.accuracy}%`}
                  color={pitchSummary.accuracy >= 85 ? '#6ad08c' : '#e0b24a'}
                  sub={
                    pitchSummary.wrong > 0
                      ? `${pitchSummary.right}/${pitchSummary.graded} right · ${pitchSummary.wrong} wrong (excluded from timing)`
                      : `${pitchSummary.right}/${pitchSummary.graded} notes (vs authored)`
                  }
                />
              )}
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
