'use client';

/**
 * useEquipmentListening — the LISTENING SEAM for gym equipment tools.
 *
 * The whole point of the equipment floor: every time a player hits play, the platform
 * HEARS them (the bass-coach engine), scores the take, and stores it over time —
 * "hear how you sounded a month ago vs now" (docs/GYM_EQUIPMENT_DESIGN.md).
 *
 * This is the STUB. The real bass-coach capture+score+store stack lives on the
 * unmerged feature/timing-mirror-spike branch and is not yet validated. So this hook
 * defines the contract NOW (so every tool is listening-ready) but is a NO-OP until
 * the engine is wired behind it — gated by NEXT_PUBLIC_EQUIPMENT_LISTENING so it can
 * be flipped on for dev without shipping a half-built feature.
 *
 * Self-contained ON PURPOSE: it does NOT import ReferenceAnalysis / the timing-mirror
 * modules (they're not on this branch). It owns a minimal local ScoreResult type. When
 * the engine merges, swap the no-op body for the real capture pipeline behind this
 * same interface — no caller changes.
 */

import { useEffect, useRef } from 'react';

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

/** A minimal, self-contained score shape. The real engine will produce a richer one;
 *  this is the contract callers + storage can rely on regardless. */
export interface EquipmentScoreResult {
  station: EquipmentStation;
  /** When the take was recorded (epoch ms — stamped by the real engine, not here). */
  recordedAt: number;
  /** 0-100 overall, or null when the engine couldn't grade (its first-class "unsure"). */
  score: number | null;
}

export interface UseEquipmentListeningOptions {
  station: EquipmentStation;
  audioContext: AudioContext | null;
  isPlaying: boolean;
  loopStartAudioTime: number | null;
  /** Called when a take finishes + is scored. No-op until the engine is wired. */
  onTakeScored?: (result: EquipmentScoreResult) => void;
}

const LISTENING_ENABLED =
  process.env.NEXT_PUBLIC_EQUIPMENT_LISTENING === 'true';

/**
 * Listen to the player while a tool is playing. STUB: arms on play, would capture +
 * score + store on stop. Currently a no-op (logs intent in dev) until the bass-coach
 * engine is wired behind this seam.
 */
export function useEquipmentListening(opts: UseEquipmentListeningOptions): {
  isListening: boolean;
} {
  const { station, isPlaying } = opts;
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    if (!LISTENING_ENABLED) return;

    // Rising edge: play started → a take begins (the real engine would arm capture).
    if (isPlaying && !wasPlayingRef.current) {
      // TODO(bass-coach): start captureBassInput on opts.audioContext here.
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.info(`[equipment-listening] take started @ ${station}`);
      }
    }

    // Falling edge: play stopped → score + store the take (real engine does this).
    if (!isPlaying && wasPlayingRef.current) {
      // TODO(bass-coach): stop capture, score, store; then opts.onTakeScored(result).
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.info(
          `[equipment-listening] take ended @ ${station} (no-op stub)`,
        );
      }
    }

    wasPlayingRef.current = isPlaying;
  }, [isPlaying, station]);

  return { isListening: LISTENING_ENABLED && isPlaying };
}
