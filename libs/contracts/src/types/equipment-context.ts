/**
 * Gym tool CONTEXT contract — the single shape every gym equipment tool (Scales is the first /
 * the reference implementation) takes to know which of the three mount contexts it's running in.
 *
 * A tool is mounted three ways, resolving four axes:
 *   • GIG  — admin-assigned per billing cycle; LOCKED; records + SUBMITS a graded take.
 *   • REP  — engine-minted daily brick;        LOCKED; ATTENDED (completion only, for now).
 *   • GYM  — open practice;                     OPEN;   stores NOTHING (grades in-memory only).
 *
 * The four axes: (1) settings locked vs open, (2) result handling, (3) which exercise/preset,
 * (4) UI framing. Axes 1-3 live in this contract; axis 4 (framing) does NOT — the tool owns its
 * own chrome and the caller only supplies an outer width wrapper.
 *
 * Design note: the CALLER resolves the axes and hands the tool a fully-resolved object, rather
 * than the tool branching internally on a bare 'gig'|'rep'|'gym' string. That keeps the
 * gig/rep/gym → (lock, sink, preset) mapping out of every future tool, and lets `locked` and the
 * result sink be decided once, at the mount site.
 */

import type { Gig } from './training.js';

/** Which of the three mount contexts a gym tool is running in. Used only for the few things the
 *  tool legitimately varies by NAME (banner copy, product rules); everything else is data. */
export type GymToolContextKind = 'gig' | 'rep' | 'gym';

/**
 * AXIS 3 — the locked exercise/key/tempo/loops preset. These are `Gig`'s preset fields lifted
 * into a station-agnostic shape so the tool never depends on `Gig` directly. `null` fields mean
 * "tool default / user picks" (the open GYM case omits the preset entirely).
 */
export interface GymToolPreset {
  /** → GymExercise.id. null = no fixed exercise (open practice picks). */
  exerciseId: string | null;
  /** For banner + submit metadata. */
  exerciseName?: string | null;
  /** ASCII PathKey, e.g. "Gb". null = tool default / user picks. */
  scaleKey: string | null;
  /** Locked tempo. null = tool default / user picks. */
  tempoBpm: number | null;
  /** Take length in loops before record-mode auto-stops (1-8). Default 2. */
  recordLoops: number;
}

/**
 * REP completion payload — what a completed rep brick reports up. ATTENDED-only for now: the rep
 * records that the brick was done (+ the tempo it ran at), NOT a graded take. A future scored rep
 * would extend this with a grade; the discriminated sink absorbs that without touching capture.
 */
export interface RepBrickPayload {
  completed: true;
  tempoBpm?: number;
}

/**
 * AXIS 2 — where a graded take goes. Discriminated so the tool never imports gig/rep-specific
 * APIs; the caller injects the sink and its callbacks.
 */
export type GymToolResultSink =
  | {
      kind: 'submit';
      /** The gig the take is submitted against. */
      gig: Gig;
      /** The backing block id recorded alongside the take. */
      backingId?: string;
      /** Fired after a successful submit (e.g. route back to /gigs). */
      onSubmitted?: () => void;
    }
  | {
      kind: 'rep';
      /** Fired when the rep brick is completed (attended-only payload). */
      onBrickComplete: (payload: RepBrickPayload) => void;
    }
  | { kind: 'none' };

/** The single context prop every gym tool takes. */
export interface GymToolContext {
  kind: GymToolContextKind;
  /**
   * AXIS 1 — are the pickers frozen to the preset? Computed by the CALLER (= `kind !== 'gym'`
   * given the current product rules: gig + rep are locked, gym is open), NOT derived from `kind`
   * inside the tool — so any future gig-vs-rep lock divergence (e.g. freestyle warm-up in rep)
   * is decided in one place at the mount site.
   */
  locked: boolean;
  /** AXIS 3 — the resolved preset (omitted for open GYM). */
  preset?: GymToolPreset;
  /** AXIS 2 — result destination. */
  resultSink: GymToolResultSink;
}
