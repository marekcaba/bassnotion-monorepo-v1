-- The previous migration created waitlist with RLS + an INSERT policy for anon,
-- but did not grant the underlying table privilege. PostgREST returns 42501
-- (insufficient_privilege) before RLS is even evaluated when the role lacks
-- INSERT on the table. Add the grants explicitly here.

GRANT INSERT ON TABLE public.waitlist TO anon, authenticated;
