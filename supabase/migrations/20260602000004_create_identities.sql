-- Identity stitching — maps an anonymous visitor id to a real account.
--
-- When a visitor creates an account, the backend records the link here so the
-- browser's entire pre-signup history (all the funnel_events tagged with that
-- anonymous_id) attributes to the eventual user — answering "which YouTube
-- video produced this paying member," not just "this signup."
--
-- Many anonymous ids can point at one user (the same person on phone + laptop,
-- each browser with its own anonymous id), hence anonymous_id is unique but
-- user_id is not. Written by the backend (service-role) only — no anon access.
--
-- NOTE: the stitch call in auth.service.registerUser() is wired when /app
-- account signup goes live. This table ships now so the schema seam exists.

CREATE TABLE IF NOT EXISTS public.identities (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id UUID        NOT NULL UNIQUE,
  user_id      UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.identities IS
  'Maps anonymous visitor ids (bn_anonymous_id) to accounts. Many anon ids per user (multi-device).';
COMMENT ON COLUMN public.identities.anonymous_id IS
  'The browser''s anonymous id. Unique — each is stitched to exactly one account.';

CREATE INDEX IF NOT EXISTS idx_identities_user
  ON public.identities (user_id);

ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: only the backend service-role role writes
-- (and reads) the stitch. RLS is enabled with zero policies = deny by default
-- for anon, which is what we want.
