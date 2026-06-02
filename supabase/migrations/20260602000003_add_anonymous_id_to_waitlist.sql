-- Stamp each waitlist row with the visitor's anonymous id so a signup can be
-- joined back to that browser's funnel_events (e.g. the landing_view that
-- carried the YouTube video tag). Nullable: clients that predate this field —
-- or visitors who blocked storage — simply submit without it.
--
-- The existing anon INSERT policy + GRANT on public.waitlist already cover the
-- new column; no policy change is needed.

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS anonymous_id UUID;

COMMENT ON COLUMN public.waitlist.anonymous_id IS
  'The visitor''s bn_anonymous_id cookie at signup. Joins this row to funnel_events.';

CREATE INDEX IF NOT EXISTS idx_waitlist_anonymous_id
  ON public.waitlist (anonymous_id);
