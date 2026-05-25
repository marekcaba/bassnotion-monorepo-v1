-- Pre-launch waitlist for Bassicology.
--
-- The landing page at "/" is a single-field waitlist form. Anonymous visitors
-- submit (email, level) to reserve a spot. Inserts are open to the anon role;
-- reads are restricted to service-role (admin) only.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      CITEXT      NOT NULL UNIQUE,
  level      TEXT        NOT NULL CHECK (level IN ('starting', 'returning', 'intermediate', 'advanced')),
  source     TEXT        NOT NULL DEFAULT 'landing',
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.waitlist IS
  'Pre-launch waitlist signups from the landing page. One row per unique email.';
COMMENT ON COLUMN public.waitlist.level IS
  'Self-reported playing level: starting | returning | intermediate | advanced.';
COMMENT ON COLUMN public.waitlist.source IS
  'Where the signup came from (default: landing). Future: ads, referrals, etc.';
COMMENT ON COLUMN public.waitlist.metadata IS
  'Optional context (user agent, referrer, UTM params). Free-form JSONB.';

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at
  ON public.waitlist (created_at DESC);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors can sign up. No SELECT/UPDATE/DELETE policies are
-- defined for anon — only service_role can read or modify rows.
CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
