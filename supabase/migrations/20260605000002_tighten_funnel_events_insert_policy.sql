-- Tighten the funnel_events INSERT policy.
--
-- funnel_events is high-volume + fire-and-forget: every meaningful page
-- interaction writes a row from the browser via the anon Supabase client
-- (see apps/frontend/src/shared/attribution/events.ts). Routing it through a
-- Next.js server route would add latency to every analytics event, so we
-- keep the anon INSERT path — but the old `WITH CHECK (true)` policy let
-- anyone with the public anon key flood the table with arbitrary garbage.
--
-- The tightened predicate enforces the same shape the client always sends:
--
--   1. event is one of the names the contracts package exports
--      (funnelEventNames in libs/contracts/src/types/analytics.ts).
--      Spammers can't invent new event names; new client events require a
--      contracts release AND a matching policy update.
--   2. attribution + props are JSON objects (not arrays/strings/numbers) or
--      NULL. attribution capped at 8 KB (~headroom over the ~4.9 KB worst
--      case from the contracts Attribution schema); props capped at 4 KB.
--   3. anonymous_id is required by NOT NULL on the column; we don't have to
--      re-check it here, the predicate only blocks INSERTs the column
--      constraint would already reject.
--
-- This still allows an attacker with the anon key to insert *valid-shaped*
-- garbage at high rate. That's an acceptable trade-off vs the latency of
-- routing every event through a server — funnel_events is treated as
-- low-trust data, the dashboard already does outlier-aware aggregation.
-- If volume becomes a real problem we add Cloudflare rate-limiting in
-- front of /rest/v1/funnel_events; the predicate is defense-in-depth.

DROP POLICY IF EXISTS "Anyone can record a funnel event" ON public.funnel_events;

CREATE POLICY "Anyone can record a funnel event"
  ON public.funnel_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event IN (
      'landing_view',
      'waitlist_submitted',
      'founder_interest_click',
      'drill_started',
      'cap_hit',
      'groove_conquered',
      'first_win'
    )
    -- Attribution max from contracts schema is ~4.9 KB worst-case (two 2KB
    -- referrer/landingPath strings + a handful of UTM fields). 8KB gives
    -- headroom and still stops payload-bloat abuse.
    AND (attribution IS NULL OR (jsonb_typeof(attribution) = 'object' AND octet_length(attribution::text) <= 8192))
    AND (props       IS NULL OR (jsonb_typeof(props)       = 'object' AND octet_length(props::text)       <= 4096))
  );
