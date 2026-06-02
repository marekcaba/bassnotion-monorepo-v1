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
 * The three funnel "walls" / segments a piece of content can imply. Carried
 * inward from the door (YouTube short/video, SEO post) onto the visitor's
 * attribution so the matched-offer brain has a guess before they convert.
 * It is an IMPLIED segment, not a measured fact — stored as-is, refined later.
 */
export const implicitWalls = ['breadth', 'depth', 'discipline'] as const;
export type ImplicitWall = (typeof implicitWalls)[number];

/**
 * First-touch attribution context captured on the visitor's FIRST page load
 * and persisted in their localStorage for up to 30 days. Sent with both the
 * waitlist signup and the founder-interest click so we can answer "which
 * YouTube video / source brought this person."
 *
 * Every field is optional — visitors who land via direct traffic or
 * decline storage end up with mostly-empty attribution, which is fine.
 *
 * `src` / `vid` / `wall` are the door identifiers we set ourselves on the
 * links we control (e.g. a YouTube description link
 * `?src=yt&vid=funk-ghost&wall=depth`). `vid` is OUR slug, not YouTube's raw
 * id — human readable, renameable, reusable across a short + its long video.
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
    // Door identifiers on links we control (YouTube, shorts, SEO, ads).
    src: z.string().max(40).optional(),
    vid: z.string().max(120).optional(),
    wall: z.enum(implicitWalls).optional(),
  })
  .strict();

export type Attribution = z.infer<typeof attributionSchema>;

/**
 * What the visitor actually opted into. Both intents create a waitlist
 * row; the difference is downstream — `beta` testers get earlier outreach
 * (private builds, pre-launch surveys), `notify_only` people only get the
 * single "we're live" email at open day.
 */
export const signupIntents = ['beta', 'notify_only'] as const;
export type SignupIntent = (typeof signupIntents)[number];

export const waitlistEntrySchema = z.object({
  email: emailSchema,
  level: z.enum(waitlistLevels, {
    errorMap: () => ({ message: 'Pick where you are with bass' }),
  }),
  signupIntent: z.enum(signupIntents).optional(),
  attribution: attributionSchema.optional(),
  // Anonymous visitor id (the bn_anonymous_id cookie). Optional so older
  // cached clients that predate this field still submit successfully; the
  // row just won't be joinable to that visitor's funnel_events.
  anonymousId: z.string().uuid().optional(),
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
  anonymousId: z.string().uuid().optional(),
});

export type FounderInterest = z.infer<typeof founderInterestSchema>;
