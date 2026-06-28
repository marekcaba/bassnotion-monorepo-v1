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
import { detectBassOnsets } from './dsp/bassOnsetDetector';
import { scoreOnsetsAgainstGrid } from './dsp/scoreAgainstGrid';
import { gradeTiming, type TimingGrade } from './dsp/timingGrade';

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
  const { station, isPlaying, loopStartAudioTime, bpm, loopBeats, onTakeScored } =
    opts;
  const wasPlayingRef = useRef(false);
  const captureRef = useRef<BassCapture | null>(null);
  // Snapshot the grid params at the moment recording starts — they must reflect the take that
  // was just played, not whatever the rollers show by the time it's scored.
  const gridAtStartRef = useRef<{
    loopStartAudioTime: number;
    bpm: number;
    loopBeats: number;
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

      // 1) Onsets (absolute audio-clock seconds via the capture's compensated anchor).
      const onsetInfos = detectBassOnsets(signal, sampleRate);
      const onsetsSec = onsetInfos.map(
        (o) => capture.startedAtCtxTime + o.time,
      );

      const beatSeconds = 60 / Math.max(grid.bpm, 1);
      const loopDurationSeconds = grid.loopBeats * beatSeconds;
      const lengthBars = Math.max(1, Math.round(grid.loopBeats / 4));

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

      const grade = refusedReason ? null : gradeTiming(jitterMs, offsetMs);

      const scored: EquipmentScoreResult = {
        station,
        recordedAt: Date.now(),
        grade,
        refusedReason,
        jitterMs,
        offsetMs,
        syncScore: score.stats.syncScore,
        noteCount,
      };
      logger.info('[listening] take scored', {
        station,
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

    // Rising edge: a record-mode take started → arm capture, snapshot the grid.
    if (isPlaying && !wasPlayingRef.current) {
      gridAtStartRef.current =
        loopStartAudioTime != null ? { loopStartAudioTime, bpm, loopBeats } : null;
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
  }, [isPlaying, loopStartAudioTime, bpm, loopBeats, scoreTake]);

  return { isListening: LISTENING_ENABLED && isPlaying };
}
