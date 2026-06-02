-- Like the waitlist table, funnel_events has RLS + an INSERT policy for anon,
-- but PostgREST returns 42501 (insufficient_privilege) before RLS is even
-- evaluated unless the role also holds the table-level INSERT grant.
-- Grant it explicitly here.

GRANT INSERT ON TABLE public.funnel_events TO anon, authenticated;
