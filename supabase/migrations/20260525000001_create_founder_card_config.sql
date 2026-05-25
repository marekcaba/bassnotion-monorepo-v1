-- Admin-editable config for the founder upsell card on the marketing
-- waitlist page. Singleton row keyed by id='default' so the backend can
-- always upsert without juggling primary keys.
--
-- All copy + per-block font sizes live in a single JSONB blob (`data`).
-- The shape is validated server-side by the FounderCardConfig Zod schema
-- in @bassnotion/contracts before write, so this column is intentionally
-- schema-less at the SQL level — the contract is the schema.
--
-- No anon policies: the backend mediates both read (served via the
-- public GET endpoint) and write (admin-gated PUT). Keeps RLS surface
-- minimal and admin-only writes auditable to a single service-role path.

CREATE TABLE IF NOT EXISTS public.founder_card_config (
  id          TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID
);

COMMENT ON TABLE public.founder_card_config IS
  'Singleton config table for the founder upsell card on the waitlist '
  'page. One row keyed by id=''default''. Shape of `data` is validated '
  'by the FounderCardConfig Zod schema in @bassnotion/contracts.';

COMMENT ON COLUMN public.founder_card_config.updated_by IS
  'auth.uid() of the admin who made the last edit. NULL for migrations '
  'and for service-role writes (e.g. seeding).';

ALTER TABLE public.founder_card_config ENABLE ROW LEVEL SECURITY;

-- No anon/auth policies — backend service role handles all reads and
-- writes. Public GET endpoint exposes only the validated `data` blob.

-- Seed the default row with the current shipped copy + sizes. The exact
-- same values are mirrored in FOUNDER_CARD_CONFIG_DEFAULTS in
-- libs/contracts so the in-code fallback (used when DB is unreachable)
-- matches the seeded DB state.
INSERT INTO public.founder_card_config (id, data)
VALUES (
  'default',
  jsonb_build_object(
    'eyebrowText',           'Founding 100 · only at launch',
    'eyebrowSizePx',         11,
    'headlinePrefix',        'Become a',
    'headlineAccent',        'founding member',
    'headlineSizePx',        28,
    'subheadText',           'Not a customer. One of the 100 who built it.',
    'subheadSizePx',         15,
    'visionText',            'Bassicology only gets bigger from here. The 100 get everything we ever ship — **forever, for one payment**. You''re not buying access. You''re funding the build.',
    'visionSizePx',          14.5,
    'bullet1Lead',           'Lifetime membership.',
    'bullet1Body',           'Everything we ship, one payment. Never a monthly fee — ever.',
    'bullet2Lead',           'First through every door.',
    'bullet2Body',           'Day one, before every wave.',
    'bullet3Lead',           'A founder''s ear.',
    'bullet3Body',           'I can hear 100 people. I can''t hear 10,000. You''ll shape what we build.',
    'bulletsSizePx',         14,
    'priceHeadline',         '$397 · once · lifetime access',
    'priceHeadlineSizePx',   17,
    'priceCaption',          'Members pay $24/mo. You never will.',
    'priceCaptionSizePx',    12.5,
    'progressClaimedSuffix', 'of {total} spots claimed',
    'progressClosesLabel',   'closes at {total}',
    'objectionLead',         'Not live yet',
    'objectionBody',         '— opens 2026. Lock your price today, get in day one. **Full refund anytime before launch.**',
    'objectionSizePx',       13,
    'ctaPrimary',            'Become a founder — $397',
    'ctaSecondary',          'Secure checkout · 30-day money-back guarantee',
    'skipText',              'No thanks — just notify me when it''s live'
  )
)
ON CONFLICT (id) DO NOTHING;
