-- Revoke anon INSERT on waitlist + founder_interest
--
-- Both tables previously had `WITH CHECK (true)` INSERT policies granted to
-- the anon role. The public anon key is published in every browser bundle,
-- so anyone could POST raw rows to PostgREST and bypass the Next.js routes
-- that wrap the inserts in Zod validation + a honeypot.
--
-- /api/waitlist and /api/waitlist/founder-interest were swapped to
-- service_role in commit 5dfad81d (PR #105) and are live in production as
-- of release b4a81b27 (PR #106). Service role bypasses RLS policies AND
-- table-level grants, so revoking both here only affects the anon path.
--
-- After this migration:
--   - The two API routes continue to insert normally (service_role bypass)
--   - Direct POSTs to PostgREST with the anon key get HTTP 401
--   - The corresponding `rls_policy_always_true` linter findings (0024)
--     clear for both tables
--
-- Rollback (if a route ever needs to go back to anon):
--   GRANT INSERT ON TABLE public.waitlist TO anon, authenticated;
--   CREATE POLICY "Anyone can join the waitlist" ON public.waitlist
--     FOR INSERT TO anon, authenticated WITH CHECK (true);
--   (same shape for founder_interest)

DROP POLICY IF EXISTS "Anyone can join the waitlist"        ON public.waitlist;
DROP POLICY IF EXISTS "Anyone can record founder interest"  ON public.founder_interest;

REVOKE INSERT ON TABLE public.waitlist         FROM anon, authenticated;
REVOKE INSERT ON TABLE public.founder_interest FROM anon, authenticated;
