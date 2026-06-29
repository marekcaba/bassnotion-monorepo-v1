/**
 * Bass Gym Training Engine — validation schemas (Phase 1).
 *
 * Single source of truth shared frontend↔backend. The backend DTO wraps
 * `recordRepResultSchema` via a `getSchema()` static (the global
 * ZodValidationPipe reads it off the DTO metatype); the frontend can reuse the
 * inferred type for the sibling-write payload.
 *
 * Enums are declared once here and kept in sync with the PG CHECK constraints
 * in 20260613000002 and the TS unions in types/training.ts (spec §11 rule:
 * enums declared three ways).
 */

import { z } from 'zod';

export const ladderLevelSchema = z.enum(['L1', 'L2', 'L3']);

export const repResultOutcomeSchema = z.enum([
  'conquered',
  'completed',
  'released',
  'too_hard',
]);

export const masteryTierSchema = z.enum(['bronze', 'silver', 'gold']);

/** The source-abstracted ProgressSignal (mirrors the TS discriminated union). */
export const progressSignalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('button'), value: z.number(), at: z.number() }),
  z.object({
    kind: z.literal('completion'),
    value: z.number(),
    at: z.number(),
  }),
  z.object({
    kind: z.literal('tap_proxy'),
    value: z.number(),
    at: z.number(),
    meta: z.record(z.unknown()).optional(),
  }),
  z.object({
    kind: z.literal('audio_analysis'),
    value: z.number(),
    at: z.number(),
    meta: z.record(z.unknown()).optional(),
  }),
]);

/**
 * The body the frontend POSTs to append a rep result. Server-derived fields
 * (id, userId, completedAt) are NOT accepted from the client.
 */
export const recordRepResultSchema = z.object({
  goalEnrollmentId: z.string().uuid(),
  drillSessionId: z.string().uuid().nullish(),
  blockId: z.string().min(1),
  ladderLevel: ladderLevelSchema,
  tempoBpm: z.number().int().nullish(),
  /** Content-ladder topic this rep belonged to (epic §3). The executor reads it
   *  off the brick the engine planned and echoes it back → the quota tally.
   *  Absent on single-focal SPEED reps. */
  topicId: z.string().min(1).nullish(),
  signal: progressSignalSchema.nullable(),
  result: repResultOutcomeSchema,
  achievedTier: masteryTierSchema.nullish(),
});

export type RecordRepResultData = z.infer<typeof recordRepResultSchema>;

// =====================================================
// SCALE BLUEPRINTS — admin authoring validation
// =====================================================

export const scaleRhythmSchema = z.enum(['4n', '8n', '8t', '16n']);

export const scaleTypeIdSchema = z.enum([
  'major',
  'natural_minor',
  'dorian',
  'mixolydian',
  'minor_pentatonic',
  'major_pentatonic',
]);

export const scalePositionShapeSchema = z.object({
  positionNumber: z.number().int().min(1),
  startFretOffset: z.number().int().min(-6).max(24),
  span: z.number().int().min(1).max(12),
});

/** Admin PATCH body — at least one of positions/rhythm; both optional individually. */
export const updateScaleBlueprintSchema = z
  .object({
    positions: z.array(scalePositionShapeSchema).min(1).optional(),
    rhythm: scaleRhythmSchema.optional(),
  })
  .refine((v) => v.positions !== undefined || v.rhythm !== undefined, {
    message: 'Provide at least one of: positions, rhythm',
  });

export type UpdateScaleBlueprintData = z.infer<typeof updateScaleBlueprintSchema>;

// =====================================================
// GYM EXERCISES — authoring validation (draft-friendly)
// =====================================================

export const gymExerciseKindSchema = z.enum(['scale_path', 'groove']);

// payload is opaque JSON (shape depends on kind) — we don't validate its internals here.
export const createGymExerciseSchema = z.object({
  kind: gymExerciseKindSchema,
  name: z.string().max(200).default(''),
  description: z.string().max(2000).optional().default(''),
  equipment: z.string().min(1).max(64),
  scaleType: z.string().max(64).nullish(),
  payload: z.unknown(),
});

// Any subset — saving partial progress is fine, no required fields.
export const updateGymExerciseSchema = z
  .object({
    name: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    scaleType: z.string().max(64).nullish(),
    payload: z.unknown().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

export type CreateGymExerciseData = z.infer<typeof createGymExerciseSchema>;
export type UpdateGymExerciseData = z.infer<typeof updateGymExerciseSchema>;

// =====================================================
// GIGS — gig authoring + take submission validation
// =====================================================

/** Admin create body for a gig. `goalId` is the goal it's authored on; `createdBy` is
 *  stamped server-side from the authenticated admin (not in the body). `cycleDay` is the
 *  day-offset (0-31) into each enrolled student's billing cycle. */
export const createGigSchema = z.object({
  goalId: z.string().uuid(),
  gigType: z.enum(['recording']).default('recording'),
  title: z.string().min(1).max(200),
  instructions: z.string().max(2000).nullish(),
  cycleDay: z.number().int().min(0).max(31),
  station: z.string().min(1).max(64).default('scales'),
  exerciseId: z.string().uuid().nullish(),
  exerciseName: z.string().max(200).nullish(),
  scaleKey: z.string().max(16).nullish(),
  tempoBpm: z.number().int().min(20).max(400).nullish(),
});

/** The reconstruction recipe — what backing to load to replay a take in context (see
 *  PlaybackContext). Arrives as a JSON STRING on the multipart body; the controller parses it
 *  before validation. Permissive (any field may be absent), bounded so a bad client can't store
 *  junk. */
/** One backing layer (stem file or click). Bounded so a bad client can't store junk; URLs are
 *  capped + must be http(s). */
const backingLayerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stem'),
    url: z.string().url().max(2048),
    loop: z.boolean().optional(),
    gain: z.number().min(0).max(4).optional(),
    label: z.string().max(64).optional(),
  }),
  z.object({
    kind: z.literal('click'),
    tempoBpm: z.number().int().min(20).max(400),
    beatsPerBar: z.number().int().min(1).max(16).optional(),
    countInBeats: z.number().int().min(0).max(16).optional(),
    gain: z.number().min(0).max(4).optional(),
  }),
]);

export const playbackContextSchema = z.object({
  station: z.string().max(64).nullish(),
  exerciseId: z.string().uuid().nullish(),
  scaleKey: z.string().max(16).nullish(),
  tempoBpm: z.number().int().min(20).max(400).nullish(),
  recordLoops: z.number().int().min(1).max(8).nullish(),
  position: z.union([z.number().int(), z.string().max(16)]).nullish(),
  stringCount: z.number().int().min(4).max(7).nullish(),
  backingId: z.string().max(128).nullish(),
  // Cap the layer count so a malformed/abusive client can't bloat the row.
  backingLayers: z.array(backingLayerSchema).max(16).nullish(),
  // Count-in pre-roll baked into the clip (seconds). Bounded — a take can't sanely pre-roll >30s.
  preRollSec: z.number().min(0).max(30).nullish(),
});

/** The non-file metadata of a take submission. The scores arrive as strings off the
 *  multipart body, so the controller coerces before validating — these are the post-coerce
 *  shapes. All grade fields are optional (a take may be submitted ungraded). */
export const submitTakeSchema = z.object({
  gigId: z.string().uuid().nullish(),
  station: z.string().min(1).max(64).default('scales'),
  exerciseName: z.string().max(200).nullish(),
  scaleKey: z.string().max(16).nullish(),
  tempoBpm: z.number().int().min(20).max(400).nullish(),
  timingScore: z.number().int().min(0).max(100).nullish(),
  pitchScore: z.number().int().min(0).max(100).nullish(),
  jitterMs: z.number().nullish(),
  offsetMs: z.number().nullish(),
  noteCount: z.number().int().min(0).nullish(),
  playbackContext: playbackContextSchema.nullish(),
});

export type CreateGigData = z.infer<typeof createGigSchema>;
export type SubmitTakeData = z.infer<typeof submitTakeSchema>;
