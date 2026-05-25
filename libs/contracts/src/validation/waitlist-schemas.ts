import { z } from 'zod';
import { emailSchema } from './common-schemas.js';

export const waitlistLevels = [
  'starting',
  'returning',
  'intermediate',
  'advanced',
] as const;

export type WaitlistLevel = (typeof waitlistLevels)[number];

/**
 * First-touch attribution context captured on the visitor's FIRST page load
 * and persisted in their localStorage for up to 30 days. Sent with both the
 * waitlist signup and the founder-interest click so we can answer "which
 * YouTube video / source brought this person."
 *
 * Every field is optional — visitors who land via direct traffic or
 * decline storage end up with mostly-empty attribution, which is fine.
 */
export const attributionSchema = z
  .object({
    utmSource: z.string().max(120).optional(),
    utmMedium: z.string().max(120).optional(),
    utmCampaign: z.string().max(120).optional(),
    utmContent: z.string().max(120).optional(),
    utmTerm: z.string().max(120).optional(),
    referrer: z.string().max(2048).optional(),
    landingPath: z.string().max(2048).optional(),
    timezone: z.string().max(80).optional(),
    capturedAt: z.string().max(40).optional(),
  })
  .strict();

export type Attribution = z.infer<typeof attributionSchema>;

export const waitlistEntrySchema = z.object({
  email: emailSchema,
  level: z.enum(waitlistLevels, {
    errorMap: () => ({ message: 'Pick where you are with bass' }),
  }),
  attribution: attributionSchema.optional(),
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
  attribution: attributionSchema.optional(),
});

export type FounderInterest = z.infer<typeof founderInterestSchema>;
