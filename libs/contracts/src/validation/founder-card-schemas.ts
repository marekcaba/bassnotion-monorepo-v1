import { z } from 'zod';

/**
 * Admin-editable config for the founder upsell card on the waitlist
 * page. One singleton row in `founder_card_config` keyed by id='default'.
 *
 * Text fields drive the copy on the card. Size fields drive the font-size
 * (in px) of each text block — kept as numbers so the admin form can use
 * numeric inputs and we can clamp into a safe range server-side, instead
 * of letting admins paste arbitrary Tailwind class strings that could
 * break the layout.
 */

const cssPxSize = (min: number, max: number) =>
  z.number().min(min).max(max).finite();

export const founderCardConfigSchema = z
  .object({
    // 1. Eyebrow
    eyebrowText: z.string().min(1).max(120),
    eyebrowSizePx: cssPxSize(8, 24),

    // 2. Headline + italic subhead
    headlinePrefix: z.string().min(1).max(80),
    headlineAccent: z.string().min(1).max(80),
    headlineSizePx: cssPxSize(16, 56),
    subheadText: z.string().min(1).max(200),
    subheadSizePx: cssPxSize(10, 28),

    // 3. Vision paragraph
    visionText: z.string().min(1).max(600),
    visionSizePx: cssPxSize(10, 24),

    // 4. Three benefit bullets — each has a bold lead + body
    bullet1Lead: z.string().min(1).max(80),
    bullet1Body: z.string().min(1).max(300),
    bullet2Lead: z.string().min(1).max(80),
    bullet2Body: z.string().min(1).max(300),
    bullet3Lead: z.string().min(1).max(80),
    bullet3Body: z.string().min(1).max(300),
    bulletsSizePx: cssPxSize(10, 24),

    // 5. Price block
    priceHeadline: z.string().min(1).max(80),
    priceHeadlineSizePx: cssPxSize(12, 32),
    priceCaption: z.string().min(1).max(240),
    priceCaptionSizePx: cssPxSize(8, 20),

    // 6. Progress bar (text only — bar geometry stays in code)
    progressClaimedSuffix: z.string().min(1).max(80),
    progressClosesLabel: z.string().min(1).max(60),

    // 7. Objection handler
    objectionLead: z.string().min(1).max(80),
    objectionBody: z.string().min(1).max(400),
    objectionSizePx: cssPxSize(10, 22),

    // 8. CTA
    ctaPrimary: z.string().min(1).max(80),
    ctaSecondary: z.string().min(1).max(160),

    // Skip button
    skipText: z.string().min(1).max(120),
  })
  .strict();

export type FounderCardConfig = z.infer<typeof founderCardConfigSchema>;

/**
 * Defaults match the current hard-coded copy/sizes on the card so the
 * first DB read after migration returns the exact same UI we ship today.
 * Source of truth for "what does the card look like before any admin
 * touches it" — used by the migration seed AND as the in-code fallback
 * when the DB is unreachable.
 */
export const FOUNDER_CARD_CONFIG_DEFAULTS: FounderCardConfig = {
  eyebrowText: 'Founding 100 · only at launch',
  eyebrowSizePx: 11,

  headlinePrefix: 'Become a',
  headlineAccent: 'founding member',
  headlineSizePx: 28,
  subheadText: 'Not a customer. One of the 100 who built it.',
  subheadSizePx: 15,

  visionText:
    "Bassicology only gets bigger from here. The 100 get everything we ever ship — **forever, for one payment**. You're not buying access. You're funding the build.",
  visionSizePx: 14.5,

  bullet1Lead: 'Lifetime membership.',
  bullet1Body: 'Everything we ship, one payment. Never a monthly fee — ever.',
  bullet2Lead: 'First through every door.',
  bullet2Body: 'Day one, before every wave.',
  bullet3Lead: "A founder's ear.",
  bullet3Body:
    "I can hear 100 people. I can't hear 10,000. You'll shape what we build.",
  bulletsSizePx: 14,

  priceHeadline: '$397 · once · lifetime access',
  priceHeadlineSizePx: 17,
  priceCaption: 'Members pay $24/mo. You never will.',
  priceCaptionSizePx: 12.5,

  progressClaimedSuffix: 'of {total} spots claimed',
  progressClosesLabel: 'closes at {total}',

  objectionLead: 'Not live yet',
  objectionBody:
    '— opens 2026. Lock your price today, get in day one. **Full refund anytime before launch.**',
  objectionSizePx: 13,

  ctaPrimary: 'Become a founder — $397',
  ctaSecondary: 'Secure checkout · 30-day money-back guarantee',

  skipText: "No thanks — just notify me when it's live",
};
