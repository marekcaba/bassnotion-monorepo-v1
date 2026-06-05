-- Lock down sensitive tables from the `anon` role.
--
-- Five tables hold user-identifying or billing data that has no business
-- being readable pre-signin. Revoke anon SELECT (and the broader-than-needed
-- defaults) on each.
--
-- profiles is the most urgent — its create migration set
--   `CREATE POLICY "Public profiles are viewable by everyone" USING (true)`
-- which let anyone with the published anon key list every user's email and
-- display_name via /rest/v1/profiles. Confirmed live before this migration.
-- Drop that policy and add a tight self-only policy. All frontend reads
-- already happen after auth.getUser() and run as `authenticated`, so they
-- continue to work; the backend uses service_role so it bypasses RLS.
--
-- For purchases/subscriptions/tokens/identities the existing per-user RLS
-- already returns [] under anon (they have `USING (auth.uid() = user_id)`
-- or no policy at all → default-deny). But the tables still appear in the
-- GraphQL schema for anon (linter finding 0026_pg_graphql_anon_table_exposed)
-- because anon has the default schema-grant SELECT. Revoking that grant
-- removes them from introspection and is defense-in-depth.
--
-- Backend (NestJS) connects to Supabase with SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses both RLS policies and table-level GRANTs, so backend
-- reads/writes to all five tables are completely unaffected.

-- profiles — the actual PII leak
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

REVOKE SELECT ON TABLE public.profiles      FROM anon;

-- Other sensitive tables — defense-in-depth against schema introspection
REVOKE SELECT ON TABLE public.purchases     FROM anon;
REVOKE SELECT ON TABLE public.subscriptions FROM anon;
REVOKE SELECT ON TABLE public.tokens        FROM anon;
REVOKE SELECT ON TABLE public.identities    FROM anon;
