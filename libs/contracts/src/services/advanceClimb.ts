/**
 * advanceClimb — the Bass Gym Training Engine's "treadmill" brain (Treadmill
 * epic, Story 2; the fix for the §2.2 "stationary mat" finding).
 *
 * A PURE function of (StudentState, options) → ClimbAdvance delta. No I/O, no
 * clock, no randomness — the sibling of `generateRep`. The backend assembler
 * passes in a frozen StudentState; this decides where the climb moves next; the
 * backend persists the returned delta. Nothing here reads a DB, a service, or a
 * clock (StudentState already carries every time fact it needs).
 *
 * It dispatches on goal type like `generateRep` does — SPEED is implemented;
 * knowledge/vocabulary/feel throw a clear "not yet" so a mis-typed goal fails
 * loudly rather than silently mis-advancing.
 *
 * v1 SPEED rule (matches SPEED_BASE_NOTCH_BPM = 8):
 *   - conquered the most recent rep (a win)  → raise currentPosition.tempoBpm
 *     one notch, CAPPED at the goal target, and recover difficultyScalar toward
 *     1.0 (a clean win loosens any prior back-off).
 *   - a run of too_hard / released in the recent window → DON'T advance; lower
 *     difficultyScalar (generateRep already scales its L1/L2/L3 notch by it — no
 *     second code path) and bump backoffCount.
 *   - otherwise (held, but didn't win) → stay put.
 */

import type {
  ClimbState,
  GenerateRepOptions,
  StudentState,
} from '../types/training.js';
import { clampTempo } from './generateRep.js';

/** The base tempo notch (kept in sync with generateRep's SPEED_BASE_NOTCH_BPM). */
export const ADVANCE_NOTCH_BPM = 8;

/** Floor/ceiling for the back-off multiplier so it can ease AND recover. */
export const DIFFICULTY_SCALAR_MIN = 0.5;
export const DIFFICULTY_SCALAR_MAX = 1;

/** How many recent too_hard/released reps trip the back-off. */
export const BACKOFF_TRIGGER = 2;

/** How much a win recovers / a back-off eases the scalar each step. */
const SCALAR_STEP = 0.25;

/**
 * The mutable climb fields advanceClimb may change. A DELTA — the caller merges
 * it onto the existing climb_state row and persists. Fields are only present
 * when they changed (an empty object = "hold, nothing to write").
 */
export interface ClimbAdvance {
  currentPosition?: Record<string, unknown>;
  difficultyScalar?: number;
  backoffCount?: number;
  /** Whether anything actually moved (lets the caller skip a no-op write). */
  changed: boolean;
}

function clampScalar(s: number): number {
  if (!Number.isFinite(s)) return DIFFICULTY_SCALAR_MAX;
  return Math.max(DIFFICULTY_SCALAR_MIN, Math.min(DIFFICULTY_SCALAR_MAX, s));
}

/** Resolve the climb's current tempo, falling back safely (mirrors generateRep). */
function currentTempo(climb: ClimbState): number {
  const t = climb.currentPosition?.tempoBpm;
  return typeof t === 'number' && Number.isFinite(t) ? clampTempo(t) : NaN;
}

/** Resolve the goal's tempo cap (the climb never advances past target). */
function targetTempo(student: StudentState): number | null {
  const t = student.goal.target?.tempoBpm;
  return typeof t === 'number' && Number.isFinite(t) ? clampTempo(t) : null;
}

function advanceSpeed(student: StudentState): ClimbAdvance {
  const climb = student.climb;
  const { consecutiveWins, recentTooHardCount } = student.derived;
  const scalar = clampScalar(climb.difficultyScalar);

  // Back-off: a run of too-hard/released → ease, don't advance.
  if (recentTooHardCount >= BACKOFF_TRIGGER) {
    const eased = clampScalar(scalar - SCALAR_STEP);
    if (eased === scalar) return { changed: false }; // already at floor
    return {
      difficultyScalar: eased,
      backoffCount: climb.backoffCount + 1,
      changed: true,
    };
  }

  // Win: the most recent rep was conquered → raise a notch (capped at target),
  // and recover the scalar toward 1.0.
  if (consecutiveWins >= 1) {
    const today = currentTempo(climb);
    const recovered = clampScalar(scalar + SCALAR_STEP);

    if (Number.isNaN(today)) {
      // No usable position yet — only recover the scalar if it moved.
      return recovered === scalar
        ? { changed: false }
        : { difficultyScalar: recovered, changed: true };
    }

    const cap = targetTempo(student);
    const raw = today + ADVANCE_NOTCH_BPM;
    const next = clampTempo(cap != null ? Math.min(raw, cap) : raw);

    const positionMoved = next !== today;
    const scalarMoved = recovered !== scalar;
    if (!positionMoved && !scalarMoved) return { changed: false };

    const delta: ClimbAdvance = { changed: true };
    if (positionMoved) {
      delta.currentPosition = { ...climb.currentPosition, tempoBpm: next };
    }
    if (scalarMoved) delta.difficultyScalar = recovered;
    return delta;
  }

  // Held but didn't win — stay put.
  return { changed: false };
}

/**
 * Decide the climb delta from the whole-student snapshot. Pure; dispatches on
 * the goal type (from the immutable goalSnapshot, passed via options).
 */
export function advanceClimb(
  student: StudentState,
  options: GenerateRepOptions,
): ClimbAdvance {
  switch (options.goalType) {
    case 'speed':
      return advanceSpeed(student);
    case 'knowledge':
    case 'vocabulary':
    case 'feel':
      throw new Error(
        `advanceClimb: goal type "${options.goalType}" is not implemented yet ` +
          '(Story 2 ships SPEED only — see BASS_GYM_TREADMILL_EPIC).',
      );
  }
}
