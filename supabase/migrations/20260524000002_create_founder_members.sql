-- Founder members — every successful "Become a founder" Stripe checkout writes
-- one row here. Distinct from `founder_interest` (clicks) and `waitlist`
-- (signups). Source of truth for the "X of 100 spots claimed" counter on the
-- marketing page and the trigger for the welcome email.
--
-- Stripe is the canonical source: this table is a local cache populated by
-- the checkout.session.completed webhook. `stripe_checkout_session_id` is
-- unique to make the webhook handler idempotent (Stripe retries safely).
--
-- Anonymous purchasers (not authenticated users) — no user_id column. We
-- have email from Stripe; when these founders sign up post-launch, we link
-- them by email.

CREATE TABLE IF NOT EXISTS public.founder_members (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                       CITEXT      NOT NULL,
  full_name                   TEXT,
  stripe_customer_id          TEXT        NOT NULL,
  stripe_checkout_session_id  TEXT        NOT NULL UNIQUE,
  stripe_payment_intent_id    TEXT,
  stripe_price_id             TEXT        NOT NULL,
  amount                      INTEGER     NOT NULL,
  currency                    TEXT        NOT NULL,
  mode                        TEXT        NOT NULL CHECK (mode IN ('test', 'live')),
  metadata                    JSONB,
  paid_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  welcome_email_sent_at       TIMESTAMPTZ
);

COMMENT ON TABLE public.founder_members IS
  'One row per successful "Become a founder" Stripe checkout. Cache of '
  'Stripe checkout.session.completed events for the Bassicology founder tier. '
  'Source of truth for the "X of 100 spots claimed" counter.';
COMMENT ON COLUMN public.founder_members.mode IS
  'Stripe mode the purchase came from: test or live. Lets us count live '
  'founders separately from test fixtures.';
COMMENT ON COLUMN public.founder_members.welcome_email_sent_at IS
  'NULL until the welcome email is dispatched. Populated by the webhook '
  'handler after Resend accepts the send. Lets us retry safely.';

CREATE INDEX IF NOT EXISTS idx_founder_members_email
  ON public.founder_members (email);

CREATE INDEX IF NOT EXISTS idx_founder_members_paid_at
  ON public.founder_members (paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_founder_members_mode_paid_at
  ON public.founder_members (mode, paid_at DESC);

ALTER TABLE public.founder_members ENABLE ROW LEVEL SECURITY;

-- No policies for anon — only the service role (used by the backend webhook
-- handler) reads/writes this table. The marketing-page "X of 100 spots
-- claimed" counter is served by a backend endpoint that runs a count query
-- server-side and returns the integer only, so individual rows (which
-- contain email, name, amount, Stripe IDs) never leave the server.
