-- Real fix for signup-trigger failure introduced by 20260605000006.
--
-- Diagnostic query against staging confirmed that after 20260605000007
-- (which tried to GRANT EXECUTE ... TO PUBLIC), the actual grants on
-- handle_new_user + initialize_user_preferences are:
--   anon, authenticated, postgres, service_role
-- — `supabase_auth_admin` is NOT in that list, and apparently doesn't
-- inherit through PUBLIC in Supabase's role hierarchy.
--
-- When Supabase Auth POST /auth/v1/signup creates an auth.users row,
-- the INSERT runs as `supabase_auth_admin`. The trigger
-- on_auth_user_created fires, tries to EXECUTE handle_new_user(), and
-- silently fails because supabase_auth_admin lacks the privilege. The
-- auth.users row exists; the public.profiles row is missing; backend
-- validateToken then 401s with "Invalid token" when the user logs in.
--
-- Fix: explicit grant to supabase_auth_admin (the role Supabase Auth
-- runs INSERTs on auth.users as) for both auth.users triggers.

GRANT EXECUTE ON FUNCTION public.handle_new_user()             TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.initialize_user_preferences() TO supabase_auth_admin;
