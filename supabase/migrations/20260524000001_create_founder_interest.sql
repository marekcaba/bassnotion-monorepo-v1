-- Founder interest tracking — captures who clicked "Become a founder" on the
-- waitlist page after signup. Distinct from `waitlist` (every email is in
-- waitlist; only the hot leads land here). One row per click — repeat clicks
-- intentionally allowed so we can spot returning interest.

CREATE TABLE IF NOT EXISTS public.founder_interest (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      CITEXT      NOT NULL,
  source     TEXT        NOT NULL DEFAULT 'landing',
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.founder_interest IS
  'Each row = one click on "Become a founder" on the pre-launch waitlist page. '
  'Not deduped by email on purpose — repeat clicks signal stronger intent.';

CREATE INDEX IF NOT EXISTS idx_founder_interest_email
  ON public.founder_interest (email);

CREATE INDEX IF NOT EXISTS idx_founder_interest_created_at
  ON public.founder_interest (created_at DESC);

ALTER TABLE public.founder_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record founder interest"
  ON public.founder_interest FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Match the waitlist table's GRANT pattern — RLS policy alone isn't enough,
-- the role also needs the underlying table privilege.
GRANT INSERT ON TABLE public.founder_interest TO anon, authenticated;
