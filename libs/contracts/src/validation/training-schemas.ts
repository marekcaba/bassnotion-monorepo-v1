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
