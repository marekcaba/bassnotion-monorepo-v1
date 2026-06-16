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
