-- Funnel events — the append-only attribution/analytics log.
--
-- Every visitor gets an anonymous id (the bn_anonymous_id cookie) on their
-- first page load, and every meaningful step fires a row here carrying that
-- id plus the first-touch attribution (incl. which YouTube video/source sent
-- them). This is the join spine: landing_view -> waitlist_submitted today,
-- and -> account_created -> purchased once accounts exist.
--
-- Inserts are open to the anon role (same posture as waitlist — these are
-- low-trust, high-volume signals). Reads are service-role only (the admin
-- dashboard). Rows are never updated or deleted; aggregate in queries.

CREATE TABLE IF NOT EXISTS public.funnel_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id UUID        NOT NULL,
  user_id      UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  event        TEXT        NOT NULL,
  attribution  JSONB,
  props        JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.funnel_events IS
  'Append-only funnel/attribution event log. One row per tracked step, keyed by anonymous_id.';
COMMENT ON COLUMN public.funnel_events.anonymous_id IS
  'The visitor''s bn_anonymous_id cookie — the join key across events and (later) the account.';
COMMENT ON COLUMN public.funnel_events.user_id IS
  'Null until the anonymous id is stitched to an account via the identities table.';
COMMENT ON COLUMN public.funnel_events.event IS
  'Event name, e.g. landing_view | waitlist_submitted | founder_interest_click.';
COMMENT ON COLUMN public.funnel_events.attribution IS
  'First-touch attribution snapshot (utm/referrer/src/vid/wall). Free-form JSONB.';

CREATE INDEX IF NOT EXISTS idx_funnel_events_anon
  ON public.funnel_events (anonymous_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event_created
  ON public.funnel_events (event, created_at DESC);
-- Per-video readout ("views -> signups for funk-ghost") joins on attribution.vid.
CREATE INDEX IF NOT EXISTS idx_funnel_events_vid
  ON public.funnel_events ((attribution ->> 'vid'));

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

-- Anyone can record an event. No SELECT/UPDATE/DELETE policies for anon —
-- only service_role can read or modify rows.
CREATE POLICY "Anyone can record a funnel event"
  ON public.funnel_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
