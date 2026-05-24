import { z } from 'zod';
import { emailSchema } from './common-schemas.js';

export const waitlistLevels = [
  'starting',
  'returning',
  'intermediate',
  'advanced',
] as const;

export type WaitlistLevel = (typeof waitlistLevels)[number];

export const waitlistEntrySchema = z.object({
  email: emailSchema,
  level: z.enum(waitlistLevels, {
    errorMap: () => ({ message: 'Pick where you are with bass' }),
  }),
});

export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;

export const waitlistResponseSchema = z.object({
  ok: z.literal(true),
  position: z.number().int().positive(),
  alreadyOnList: z.boolean(),
});

export type WaitlistResponse = z.infer<typeof waitlistResponseSchema>;

/**
 * Founder-interest click signal — recorded when someone clicks "Become a
 * founder" on the post-signup upsell. Stored separately from `waitlist` so
 * one row = one click (repeat clicks signal stronger intent).
 */
export const founderInterestSchema = z.object({
  email: emailSchema,
});

export type FounderInterest = z.infer<typeof founderInterestSchema>;
