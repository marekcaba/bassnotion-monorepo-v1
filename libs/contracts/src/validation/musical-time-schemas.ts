import { z } from 'zod';

/**
 * Musical time validation schemas
 *
 * Shared Zod schemas for musical timing and note durations
 * Used by both backend MIDI parsing and conversion endpoints
 */

/**
 * Musical position schema (measure, beat, subdivision, tick precision)
 */
export const MusicalPositionSchema = z.object({
  measure: z.number().int().min(1),
  beat: z.number().int().min(1),
  subdivision: z.number().int().min(0),
  tick: z.number().int().min(0).max(479).optional(), // 480 PPQ precision (0-479)
});

export type MusicalPositionValidation = z.infer<typeof MusicalPositionSchema>;

/**
 * Note duration schema with dotted and triplet support
 *
 * Matches NoteDuration type from musical-time.ts
 */
export const NoteDurationSchema = z.enum([
  // Standard durations
  'whole',
  'half',
  'quarter',
  'eighth',
  'sixteenth',
  'thirty-second',
  'sixty-fourth',
  // Dotted durations
  'whole-dotted',
  'half-dotted',
  'quarter-dotted',
  'eighth-dotted',
  'sixteenth-dotted',
  // Triplet durations
  'quarter-triplet',
  'eighth-triplet',
  'sixteenth-triplet',
]);

export type NoteDurationValidation = z.infer<typeof NoteDurationSchema>;

/**
 * Time signature schema
 */
export const TimeSignatureSchema = z.object({
  numerator: z.number().int().min(1).max(32),
  denominator: z.number().int().min(1).max(64),
});

export type TimeSignatureValidation = z.infer<typeof TimeSignatureSchema>;
