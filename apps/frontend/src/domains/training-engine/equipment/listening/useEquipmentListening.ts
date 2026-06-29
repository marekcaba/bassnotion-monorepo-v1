'use client';

/**
 * useEquipmentListening — the LISTENING + GRADING seam for gym equipment tools.
 *
 * The whole point of the equipment floor: in RECORD mode, every time a player hits play, the
 * platform HEARS them, grades their TIMING against the exercise grid, and (later) stores the
 * grade over time — "hear how you sounded a month ago vs now" (docs/GYM_EQUIPMENT_DESIGN.md).
 *
 * THE LOOP (rising edge → arm capture; falling edge → score):
 *   play start → startBassCapture (mic, latency-comped, bound to the engine context)
 *   play stop  → stop() → detectBassOnsets → scoreOnsetsAgainstGrid → trust gates → gradeTiming
 *                → onTakeScored(result)
 *
 * The grid is anchored at loopStartAudioTime (the sequencer's beat-0 audio time) so the player's
 * recorded onsets and the exercise's ideal grid share one clock by construction.
 *
 * TRUST GATES (a grader that confidently lies is worse than none):
 *   G1 — offset vs jitter: a constant latency offset is NOT a timing error; we grade on jitter
 *        (consistency) and report offset separately. (gradeTiming already separates them.)
 *   G3 — over-trigger refusal: if the onset detector collided too many notes on one grid slot
 *        (collisionRate high) or found too few notes, we REFUSE to grade (score = null).
 *
 * Flag-gated by NEXT_PUBLIC_EQUIPMENT_LISTENING. No persistence yet — the score is handed to the
 * caller via onTakeScored; storage (the take_results table) is a later phase.
 */

import { useCallback, useEffect, useRef } from 'react';
import { getLogger } from '@/utils/logger.js';
import { startBassCapture, type BassCapture } from './dsp/captureBassInput';
import {
  detectBassOnsetsAdaptive,
  normalizePeak,
} from './dsp/bassOnsetDetector';
import { scoreOnsetsAgainstGrid } from './dsp/scoreAgainstGrid';
import {
  gradeTiming,
  gradeHits,
  gradePitch,
  type TimingGrade,
  type HitGrade,
  type PitchGrade,
} from './dsp/timingGrade';
import { verifyPitchChartInformed, midiToHz } from './dsp/verifyPitch';

const logger = getLogger('useEquipmentListening');

/** Which equipment station this take belongs to (for the take-history rollup). */
export type EquipmentStation =
  | 'scales'
  | 'chords'
  | 'rhythm'
  | 'groove'
  | 'timing'
  | 'listening'
  | 'arpeggios'
  | 'song-structure';

/** The result of grading one recorded take. `grade` is null when the trust gates refused. */
export interface EquipmentScoreResult {
  station: EquipmentStation;
  /** When the take was recorded (epoch ms). */
  recordedAt: number;
  /** The human-scaled timing grade, or null when we couldn't trust the take (refused). */
  grade: TimingGrade | null;
  /** Per-note HIT/MISS headline ("6 of 8 in time"), or null when refused. */
  hitGrade: HitGrade | null;
  /** SEPARATE pitch grade ("14 of 17 right notes"), or null when refused / no expected notes. */
  pitchGrade: PitchGrade | null;
  /** Why we refused, when grade is null (for a player-facing "try again" hint). */
  refusedReason: string | null;
  /** Raw stats kept alongside the grade (for the history table later). */
  jitterMs: number;
  offsetMs: number;
  syncScore: number;
  noteCount: number;
}

export interface UseEquipmentListeningOptions {
  station: EquipmentStation;
  audioContext: AudioContext | null;
  /** True while a RECORD-mode take is playing (rising = arm, falling = score). */
  isPlaying: boolean;
  /** Audio-context time of the exercise's beat 0 — the grid anchor. */
  loopStartAudioTime: number | null;
  /** Tempo (BPM) of the take — drives the grid spacing. */
  bpm: number;
  /** Loop length in beats — used to derive loop seconds + bars for the grid. */
  loopBeats: number;
  /** The exercise's EXPECTED notes for ONE loop — the answer key. Each carries midi + startBeat +
   *  durBeats (the chart's note length in beats), so the pitch-analysis window is sized to the
   *  ACTUAL note duration (a quarter → long read, a 16th → short). Omit/empty → no pitch grade. */
  expectedNotes?: { midi: number; startBeat: number; durBeats: number }[];
  /** How many loops the take recorded — the TARGET note count is expectedNotes.length × loops.
   *  Notes the player didn't play (fewer onsets than the target) count as MISSES, so you can't
   *  game the score by playing fewer notes. Defaults to 1. */
  loops?: number;
  /** Called when a take finishes + is scored. */
  onTakeScored?: (result: EquipmentScoreResult) => void;
}

const LISTENING_ENABLED =
  process.env.NEXT_PUBLIC_EQUIPMENT_LISTENING === 'true';

/** G3 floor: fewer than this many detected notes = not a real take, refuse. */
const MIN_NOTES = 3;
/** G3 ceiling: more than this fraction of onsets colliding on one grid slot = the detector is
 *  over-triggering (sustain re-fires), the score is untrustworthy — refuse. */
const MAX_COLLISION_RATE = 0.25;

export function useEquipmentListening(opts: UseEquipmentListeningOptions): {
  isListening: boolean;
} {
  const {
    station,
    isPlaying,
    loopStartAudioTime,
    bpm,
    loopBeats,
    expectedNotes,
    loops,
    onTakeScored,
  } = opts;
  const wasPlayingRef = useRef(false);
  const captureRef = useRef<BassCapture | null>(null);
  // Snapshot the grid params + expected notes at the moment recording starts — they must reflect
  // the take that was just played, not whatever the rollers show by the time it's scored.
  const gridAtStartRef = useRef<{
    loopStartAudioTime: number;
    bpm: number;
    loopBeats: number;
    expectedNotes: { midi: number; startBeat: number; durBeats: number }[];
    loops: number;
  } | null>(null);
  // Latest callback in a ref so the effect doesn't re-fire when the caller passes a new closure.
  const onTakeScoredRef = useRef(onTakeScored);
  useEffect(() => {
    onTakeScoredRef.current = onTakeScored;
  }, [onTakeScored]);

  // Score a finished take: signal → onsets → grid → gates → grade → callback.
  const scoreTake = useCallback(
    async (capture: BassCapture) => {
      const grid = gridAtStartRef.current;
      const result = await capture.stop();
      if (!result || !grid) {
        logger.info('[listening] no audio captured / no grid — skipped');
        return;
      }
      const { signal, sampleRate } = result;

      const beatSeconds = 60 / Math.max(grid.bpm, 1);
      const loopDurationSeconds = grid.loopBeats * beatSeconds;
      const lengthBars = Math.max(1, Math.round(grid.loopBeats / 4));

      // 1) Onsets — CHART-INFORMED. We KNOW how many notes the exercise demands (one loop ×
      //    loops), so use the adaptive detector: it sweeps sensitivity to gather every candidate,
      //    then sets the confidence floor to keep ~that many. The old fixed-sensitivity detector
      //    (sensitivity 2.1, gap 120ms — tuned for SPARSE slow takes) merged adjacent notes and
      //    dropped ~half of a denser scale, which scrambled the order-based pitch alignment.
      //    The gap is derived from the TIGHTEST expected note spacing (so it never merges two real
      //    notes) with a floor; a too-large gap pre-merges notes the sensitivity sweep can't recover.
      const expectedTotal =
        grid.expectedNotes.length > 0
          ? grid.expectedNotes.length * grid.loops
          : undefined;
      let minSpacingSec = Infinity;
      const sortedExp = [...grid.expectedNotes].sort(
        (a, b) => a.startBeat - b.startBeat,
      );
      for (let i = 1; i < sortedExp.length; i++) {
        const dBeats = sortedExp[i]!.startBeat - sortedExp[i - 1]!.startBeat;
        if (dBeats > 0) minSpacingSec = Math.min(minSpacingSec, dBeats * beatSeconds);
      }
      // Gap = ~40% of the tightest spacing (so two real notes never collapse), floored at 45ms
      // (below a real bass note's minimum re-pluck) and capped at 120ms (the old default).
      const onsetGapSec = Number.isFinite(minSpacingSec)
        ? Math.min(0.12, Math.max(0.045, minSpacingSec * 0.4))
        : 0.08;
      const onsetInfos = detectBassOnsetsAdaptive(signal, sampleRate, {
        minOnsetGapSeconds: onsetGapSec,
        expectedCount: expectedTotal,
      });
      const onsetsSec = onsetInfos.map(
        (o) => capture.startedAtCtxTime + o.time,
      );

      // 2) Score against the grid (same clock as the engine, anchored at loopStart).
      const score = scoreOnsetsAgainstGrid(onsetsSec, {
        loopStartAudioTime: grid.loopStartAudioTime,
        loopDurationSeconds,
        lengthBars,
        bpm: grid.bpm,
      });

      const noteCount = score.stats.totalBeats;
      const jitterMs = score.stats.jitter;
      const offsetMs = score.stats.averageDrift;

      // 3) TRUST GATES — refuse rather than lie.
      let refusedReason: string | null = null;
      if (noteCount < MIN_NOTES) {
        refusedReason = `Only ${noteCount} note(s) heard — play the whole scale into the mic.`;
      } else if (score.collisionRate > MAX_COLLISION_RATE) {
        refusedReason = `Onset detection looks noisy (${Math.round(
          score.collisionRate * 100,
        )}% collisions) — check the input level / mute room bleed.`;
      }

      // TARGET note count = the notes the exercise DEMANDED (one loop × loops). Both grades use
      // this as the denominator, so notes the player skipped count as MISSES — you can't game the
      // score by playing fewer notes.
      const targetCount =
        grid.expectedNotes.length > 0
          ? grid.expectedNotes.length * grid.loops
          : undefined;

      const grade = refusedReason ? null : gradeTiming(jitterMs, offsetMs);
      // Per-note hit/miss from the grid slots (count-in onsets excluded). The headline a learner
      // reads — concrete + motivating — over the deeper jitter grade.
      const hitGrade = refusedReason
        ? null
        : gradeHits(
            score.slots.filter((s) => !s.beforeGrid).map((s) => s.errorSec),
            targetCount,
          );

      // PITCH grade (SEPARATE from timing): detect each played note's pitch and compare to the
      // expected note. A right-rhythm/wrong-key take is "great timing, wrong notes". Skipped when
      // refused or there's no answer key.
      //
      // MATCH BY ORDER, WRAPPING PER LOOP: a take is the one-loop exercise played `maxLoops` times,
      // so expectedNotes is just ONE loop. The player's k-th onset corresponds to expected note
      // k % loopLen — that's how a repeated scale run lines up. (Earlier this capped at
      // min(onsets, oneLoop) → only the FIRST loop was pitch-judged: the 13-vs-6 bug.) Exact-grid
      // matching was even worse (timing drift → adjacent slot → miss). Both lists are time-ordered.
      let pitchGrade: PitchGrade | null = null;
      if (!refusedReason && grid.expectedNotes.length > 0) {
        const playedOnsets = score.slots
          .filter((s) => !s.beforeGrid)
          .sort((a, b) => a.onsetSec - b.onsetSec);
        const expected = [...grid.expectedNotes].sort(
          (a, b) => a.startBeat - b.startBeat,
        );
        const loopLen = expected.length;

        // MATCH each onset to its expected note by ABSOLUTE GRID POSITION across the WHOLE take.
        // The per-LOOP-position matcher mismatched when a loop has REPEATS or fast LEAPS: two notes
        // near the same loop position, so an onset could pair with the wrong one. Fix: build the
        // full expected sequence (the loop repeated `loops` times) and give EACH note its ABSOLUTE
        // subIndex (loopIdx·loopSubs + its loop position). Then pair each onset (also an absolute
        // subIndex) with the expected note whose absolute grid position is NEAREST. Every repeat
        // now sits at a distinct absolute slot, and the match is robust to onset count drift (no
        // per-loop index assumption). SUB_PER_BEAT=4 mirrors scoreAgainstGrid's sixteenth grid.
        const SUB_PER_BEAT = 4;
        const loopSubs = Math.max(1, Math.round(grid.loopBeats * SUB_PER_BEAT));
        const expandedExpected: { note: (typeof expected)[number]; absSub: number }[] = [];
        for (let loopI = 0; loopI < grid.loops; loopI++) {
          for (const n of expected) {
            const loopPos = Math.round(n.startBeat * SUB_PER_BEAT) % loopSubs;
            expandedExpected.push({ note: n, absSub: loopI * loopSubs + loopPos });
          }
        }
        const expectedForOnset = (slot: { subIndex: number }) => {
          let best = expandedExpected[0]!.note;
          let bestDist = Infinity;
          for (const e of expandedExpected) {
            const d = Math.abs(e.absSub - slot.subIndex);
            if (d < bestDist) {
              bestDist = d;
              best = e.note;
            }
          }
          return best;
        };

        // WINDOW — sized to each note's CHART DURATION (we HAVE the chart). A quarter note gets a
        // long read; a 16th (funky staccato high note) gets a short one — so the window lands on the
        // note's own sustain instead of overshooting into its decay or the next note (that's why the
        // high A#2/C3 leaps were going unread). Skip 28ms past the broadband pluck so the fundamental
        // has settled. Floor the window at YIN's own guard (2·maxLag at the band's low edge) so even
        // a 16th gives the detector enough samples; a tiny tail is fine, swallowing the next note is
        // not (we cap at the note's chart length).
        const skip = Math.round(0.028 * sampleRate);
        // The chart-informed detector tests the octave-DOWN candidate (½ the expected freq), so its
        // difference function needs ≥ 2·maxLag samples where maxLag = period of the octave-down,
        // a semitone flat. Compute the floor PER NOTE from the expected pitch (a high note needs
        // little; a low note's octave-down candidate needs more). Below this → null (clean refusal).
        const winFloorSamples = (expHz: number) =>
          Math.ceil(2 * (sampleRate / (expHz / 2 / Math.pow(2, 1 / 12))));
        const pairs: { detected: number | null; expected: number }[] = [];
        const diag: {
          exp: number;
          det: number | null;
          hz: number | null;
          conf: number | null;
          winMs: number;
        }[] = [];
        for (let k = 0; k < playedOnsets.length; k++) {
          const slot = playedOnsets[k]!;
          const expNote = expectedForOnset(slot); // match by loop grid position, not raw index
          const exp = expNote.midi;
          const expHz = midiToHz(exp);
          // Window = the note's CHART DURATION in samples (minus the attack we skip), but never
          // below YIN's floor for this note's band (a 16th of a low note still needs enough samples)
          // and capped at 250ms (a long note doesn't need more, and avoids drift). Chart-driven.
          const noteDurSamples = Math.round(
            expNote.durBeats * beatSeconds * sampleRate,
          );
          const winLen = Math.min(
            Math.round(0.25 * sampleRate),
            Math.max(noteDurSamples - skip, winFloorSamples(expHz)),
          );
          const startSample = Math.round(
            (slot.onsetSec - capture.startedAtCtxTime) * sampleRate + skip,
          );
          const endSample = Math.min(startSample + winLen, signal.length);
          const winSamples = endSample - startSample;
          if (startSample < 0 || winSamples < winFloorSamples(expHz)) {
            pairs.push({ detected: null, expected: exp });
            diag.push({
              exp,
              det: null,
              hz: null,
              conf: null,
              winMs: Math.round((winSamples / sampleRate) * 1000),
            });
            continue;
          }
          const window = normalizePeak(signal.subarray(startSample, endSample));
          // CHART-INFORMED, OCTAVE-EXACT detection. We KNOW the expected note, so we MEASURE the
          // signal's periodicity at the expected period AND its octave neighbors (½×, 2×) and pick
          // the real one — the octave is unambiguous (an octave up = exactly half the period). This
          // replaces blind YIN (which guessed the octave + slipped on bright high notes), and lets
          // us grade the EXACT note including octave: a note played an octave off now reads as the
          // wrong octave and grades WRONG, honestly. Detects a slightly sharp/flat fret as the right
          // note (±1 semitone search per candidate + parabolic interp = ~±49 cents of slack).
          const pitch = verifyPitchChartInformed(window, sampleRate, exp, {
            minConfidence: 0.3,
          });
          pairs.push({ detected: pitch?.midi ?? null, expected: exp });
          diag.push({
            exp,
            det: pitch?.midi ?? null,
            hz: pitch ? Math.round(pitch.hz * 10) / 10 : null,
            conf: pitch ? Math.round(pitch.confidence * 100) / 100 : null,
            winMs: Math.round((winSamples / sampleRate) * 1000),
          });
        }
        pitchGrade = gradePitch(pairs, targetCount);
        // VALIDATION DIAG — note names + Hz + confidence + semitone delta per note, so a clean
        // re-take is unambiguous: deltas all 0 = fixed; small scatter = window still short; ±12 =
        // band wrong. The user thinks in note names, not MIDI.
        const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const nameOf = (m: number | null) =>
          m == null ? '—' : `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
        // eslint-disable-next-line no-console
        console.log('[PitchDiag]', {
          recordedSec: (signal.length / sampleRate).toFixed(2),
          onsetsDetected: playedOnsets.length,
          expectedTotal,
          onsetGapMs: Math.round(onsetGapSec * 1000),
          notesPerLoop: loopLen,
          perNote: diag.map((d) => ({
            exp: nameOf(d.exp),
            det: nameOf(d.det),
            deltaSemis: d.det == null ? '—' : d.det - d.exp,
            hz: d.hz,
            conf: d.conf,
            winMs: d.winMs,
          })),
          correct: pitchGrade.correct,
          judged: pitchGrade.judged,
          unverified: pitchGrade.unverified,
        });
      }

      const scored: EquipmentScoreResult = {
        station,
        recordedAt: Date.now(),
        grade,
        hitGrade,
        pitchGrade,
        refusedReason,
        jitterMs,
        offsetMs,
        syncScore: score.stats.syncScore,
        noteCount,
      };
      logger.info('[listening] take scored', {
        station,
        hits: hitGrade ? `${hitGrade.hits}/${hitGrade.total}` : '—',
        pitch: pitchGrade
          ? `${pitchGrade.correct}/${pitchGrade.judged} (${pitchGrade.unverified} unverified)`
          : '—',
        grade: grade?.label ?? `REFUSED: ${refusedReason}`,
        jitterMs: Math.round(jitterMs),
        offsetMs: Math.round(offsetMs),
        noteCount,
      });
      onTakeScoredRef.current?.(scored);
    },
    [station],
  );

  useEffect(() => {
    if (!LISTENING_ENABLED) return;

    // Rising edge: a record-mode take started → arm capture, snapshot the grid + answer key.
    if (isPlaying && !wasPlayingRef.current) {
      gridAtStartRef.current =
        loopStartAudioTime != null
          ? {
              loopStartAudioTime,
              bpm,
              loopBeats,
              expectedNotes: expectedNotes ?? [],
              loops: Math.max(1, loops ?? 1),
            }
          : null;
      startBassCapture(() => {
        // Engine context died mid-take — drop the capture, nothing to score.
        captureRef.current = null;
        logger.warn('[listening] capture interrupted (context lost)');
      })
        .then((cap) => {
          captureRef.current = cap;
        })
        .catch((e) => {
          logger.warn('[listening] could not start capture', e as Error);
          captureRef.current = null;
        });
    }

    // Falling edge: take stopped → score it (if we have a live capture).
    if (!isPlaying && wasPlayingRef.current) {
      const cap = captureRef.current;
      captureRef.current = null;
      if (cap) void scoreTake(cap);
    }

    wasPlayingRef.current = isPlaying;
    // expectedNotes is read only on the rising edge (snapshotted), so its identity changing
    // mid-render is harmless — the edge guards make a re-fire a no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, loopStartAudioTime, bpm, loopBeats, scoreTake]);

  return { isListening: LISTENING_ENABLED && isPlaying };
}
