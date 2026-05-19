-- ROLLBACK PARTIAL: Restore EXECUTE on trigger functions to anon/authenticated.
--
-- Migration 20260519000002 revoked EXECUTE from anon on functions including
-- those bound as TRIGGERs. In practice, when a row insert in auth.users (or
-- elsewhere) fires a SECURITY DEFINER trigger, PostgreSQL still enforces the
-- EXECUTE privilege on the trigger function against the *invoking* role at
-- statement-prep time. For anon-context signups, that role chain includes
-- anon, so the revoke broke /auth/v1/signup with a 500 (handle_new_user).
--
-- These functions take no callable arguments via PostgREST that would do
-- harm (they expect a TRIGGER context), so restoring EXECUTE is safe.
-- The corresponding 0028/0029 linter warnings will reappear for these
-- specific functions, and that's acceptable.

GRANT EXECUTE ON FUNCTION public.handle_new_user()             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_user_preferences() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_exercise_like_count()  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_pattern_usage()        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_practice_streak()      TO anon, authenticated;
