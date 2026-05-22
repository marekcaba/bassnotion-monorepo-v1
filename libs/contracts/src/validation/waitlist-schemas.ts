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
