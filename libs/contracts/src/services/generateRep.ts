/**
 * generateRep — the Bass Gym Training Engine's brain (Phase 0).
 *
 * A PURE function of (ClimbState, BlockPool, RepResult[]) → TutorialBlock[].
 * No I/O, no clock, no playback, no randomness — fully deterministic and
 * Vitest-tested in isolation before any UI exists (spec §10 seam 5).
 *
 * It returns SIX ordered drill bricks — L1a, L1b, L2a, L2b, L3a, L3b — the
 * 2+2+2 daily rep (spec §2). Each brick is a materialized `TutorialBlock`
 * carrying `config.completionCriterion` + per-use `tempoOverride`/`keyOverride`,
 * which the shipped drill executor auto-applies on mount (no PlaybackAdapter on
 * the MVP critical path — spec §10 seam 3).
 *
 * Phase 0 implements the SPEED dial fully (three tempos bracketing today's spot)
 * and dispatches on goal type so KNOWLEDGE / VOCABULARY / FEEL slot in later
 * without the engine growing a branch per widget (spec §10 seam 6). The MVP
 * goal is "SPEED scales" (spec §14).
 */

import type { TutorialBlock } from '../types/block.js';
import type {
  BlockPool,
  ClimbState,
  GenerateRepOptions,
  LadderLevel,
  RepResult,
} from '../types/training.js';

// ---------------------------------------------------------------------------
// Runtime clamps — the playback engine clamps SILENTLY (setTempo → [50,180],
// setKey → [-6,+6]) with no error. generateRep must clamp before emit so a
// brick never silently lands somewhere the author didn't intend (spec §12).
// ---------------------------------------------------------------------------
export const TEMPO_MIN = 50;
export const TEMPO_MAX = 180;
export const KEY_MIN = -6;
export const KEY_MAX = 6;

/** Whole-minute bounds for a brick's timebox: 3-min floor, 6-min ceiling rep. */
export const BRICK_MINUTES_MIN = 1;
export const BRICK_MINUTES_MAX = 3;

/** Per-rep brick count: 2 (L1) + 2 (L2) + 2 (L3). */
export const REP_BRICK_COUNT = 6;

export function clampTempo(bpm: number): number {
  return Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(bpm)));
}

export function clampKey(semitones: number): number {
  return Math.max(KEY_MIN, Math.min(KEY_MAX, Math.round(semitones)));
}

// ---------------------------------------------------------------------------
// The SPEED dial. L2 = today's tempo; L1 = a notch easier; L3 = a notch harder.
// The notch size is scaled DOWN by difficultyScalar (the §4 back-off
// multiplier): after a too_hard streak or missed days, the bracket tightens so
// the climb eases without a second code path.
// ---------------------------------------------------------------------------
/** Base tempo notch (BPM) between adjacent ladder levels at scalar 1.0. */
export const SPEED_BASE_NOTCH_BPM = 8;

/** Resolve the current target tempo from climb position, falling back safely. */
function currentTempoBpm(state: ClimbState): number {
  const pos = state.currentPosition?.tempoBpm;
  const bpm = typeof pos === 'number' && Number.isFinite(pos) ? pos : TEMPO_MIN;
  return clampTempo(bpm);
}

/** The per-level tempo for SPEED, bracketing today's spot. */
function speedTempoForLevel(state: ClimbState, level: LadderLevel): number {
  const today = currentTempoBpm(state);
  const scalar =
    Number.isFinite(state.difficultyScalar) && state.difficultyScalar > 0
      ? state.difficultyScalar
      : 1;
  const notch = Math.max(1, Math.round(SPEED_BASE_NOTCH_BPM * scalar));
  switch (level) {
    case 'L1':
      return clampTempo(today - notch);
    case 'L2':
      return clampTempo(today);
    case 'L3':
      return clampTempo(today + notch);
  }
}

// ---------------------------------------------------------------------------
// Spaced review (§2): once the player has past wins, L1 rotates in a previously
// conquered block. v1 rule: "oldest-not-seen, tie-break weakest achieved_tier",
// computed from rep_results history at read time. Swappable behind this fn.
// Before any wins, L1 falls back to an easier version of today's task.
// ---------------------------------------------------------------------------
const TIER_RANK: Record<string, number> = { bronze: 0, silver: 1, gold: 2 };

export function selectReviewBlock(history: RepResult[]): string | null {
  const conquered = history.filter((r) => r.result === 'conquered');
  if (conquered.length === 0) return null;

  // Latest completion per block (so "last seen" reflects the most recent rep).
  const lastSeen = new Map<string, RepResult>();
  for (const r of conquered) {
    const prev = lastSeen.get(r.blockId);
    if (!prev || r.completedAt > prev.completedAt) lastSeen.set(r.blockId, r);
  }

  const candidates = [...lastSeen.values()];
  candidates.sort((a, b) => {
    // Oldest-not-seen first (ascending completedAt).
    if (a.completedAt !== b.completedAt) {
      return a.completedAt < b.completedAt ? -1 : 1;
    }
    // Tie-break: weakest achieved tier first.
    const ta = TIER_RANK[a.achievedTier ?? 'bronze'] ?? 0;
    const tb = TIER_RANK[b.achievedTier ?? 'bronze'] ?? 0;
    return ta - tb;
  });

  return candidates[0]?.blockId ?? null;
}

// ---------------------------------------------------------------------------
// Brick materialization.
// ---------------------------------------------------------------------------
function clampMinutes(min: number): number {
  return Math.max(
    BRICK_MINUTES_MIN,
    Math.min(BRICK_MINUTES_MAX, Math.round(min)),
  );
}

/**
 * Clamp a tempo into a block's authored tempoRange (spec §13) on top of the
 * global engine clamp, so a brick never asks for a tempo the author marked as
 * musically invalid for that material. No range → just the global clamp.
 */
function clampTempoToBlock(bpm: number, source: TutorialBlock): number {
  const clamped = clampTempo(bpm);
  const range = source.tempoRange;
  if (!range) return clamped;
  return Math.max(range.min, Math.min(range.max, clamped));
}

/**
 * Stamp a pooled block as a drill brick at a ladder level + tempo. Returns a
 * fresh TutorialBlock (never mutates the pool entry — purity).
 *
 * Widget-agnostic: it always sets tempoOverride/keyOverride on the config (the
 * groove-card executor auto-applies them on mount). For a `task` block (no audio
 * engine to drive), it ALSO interpolates the tempo into a `{tempo}` token in the
 * instruction so the student reads the target tempo — a tiny type-agnostic
 * string replace, not a per-widget branch in the engine.
 */
function materializeBrick(
  source: TutorialBlock,
  opts: {
    level: LadderLevel;
    order: number;
    tempoBpm?: number;
    keyOverride?: number;
  },
): TutorialBlock {
  const cfg = { ...(source.config as Record<string, unknown>) };

  let tempoBpm: number | undefined;
  if (typeof opts.tempoBpm === 'number') {
    tempoBpm = clampTempoToBlock(opts.tempoBpm, source);
    cfg.tempoOverride = tempoBpm;
  }
  if (typeof opts.keyOverride === 'number') {
    cfg.keyOverride = clampKey(opts.keyOverride);
  }
  // The brick's timebox: 2 minutes per the 2+2+2 shape (clamped to bounds).
  cfg.timeboxMinutes = clampMinutes(2);

  // Interpolate the tempo into a task instruction's {tempo} token, if present.
  // Harmless for any other block type (no token → unchanged).
  if (typeof cfg.instruction === 'string' && tempoBpm != null) {
    cfg.instruction = cfg.instruction.replace(/\{tempo\}/g, String(tempoBpm));
  }

  return {
    ...source,
    id: `${source.id}--${opts.level}--${opts.order}`,
    config: cfg as TutorialBlock['config'],
    order: opts.order,
    showInIsland: true,
    ladderPosition: opts.level,
  };
}

/** Pick the today/work block from the pool — first entry is the focal task. */
function focalBlock(content: BlockPool): TutorialBlock | null {
  return content.blocks[0] ?? null;
}

/** Find a pooled block by id (for L1 spaced review). */
function blockById(
  content: BlockPool,
  id: string | null,
): TutorialBlock | null {
  if (!id) return null;
  return content.blocks.find((b) => b.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Per-type rep assembly. Each returns the SIX ladder bricks for its dial.
// Phase 0 ships SPEED; the others throw a clear "not yet implemented" so a
// mis-typed goal fails loudly in tests rather than silently emitting nonsense.
// ---------------------------------------------------------------------------
function generateSpeedRep(
  state: ClimbState,
  content: BlockPool,
  history: RepResult[],
): TutorialBlock[] {
  const focal = focalBlock(content);
  if (!focal) {
    throw new Error('generateRep(speed): BlockPool.blocks is empty');
  }

  // L1 = spaced review of a prior conquered block once wins exist; else an
  // easier version of today's task.
  const reviewId = selectReviewBlock(history);
  const l1Source = blockById(content, reviewId) ?? focal;

  const bricks: TutorialBlock[] = [];
  let order = 0;
  const levels: LadderLevel[] = ['L1', 'L2', 'L3'];
  for (const level of levels) {
    const source = level === 'L1' ? l1Source : focal;
    const tempoBpm = speedTempoForLevel(state, level);
    // Two bricks per level (the "2+2+2" — a, then b at the same intensity).
    for (let i = 0; i < 2; i++) {
      bricks.push(materializeBrick(source, { level, order, tempoBpm }));
      order++;
    }
  }
  return bricks;
}

// ---------------------------------------------------------------------------
// The public entry point — dispatches on the goal type (from the enrollment's
// immutable goal_snapshot, passed via options; NOT carried on ClimbState).
// ---------------------------------------------------------------------------
export function generateRep(
  state: ClimbState,
  content: BlockPool,
  history: RepResult[],
  options: GenerateRepOptions,
): TutorialBlock[] {
  switch (options.goalType) {
    case 'speed':
      return generateSpeedRep(state, content, history);
    case 'knowledge':
    case 'vocabulary':
    case 'feel':
      throw new Error(
        `generateRep: goal type "${options.goalType}" is not implemented yet ` +
          '(Phase 0 ships SPEED only — see BASS_GYM spec §14)',
      );
  }
}
