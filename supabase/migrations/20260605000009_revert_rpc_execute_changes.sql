-- Revert the RPC EXECUTE changes from migrations 20260605000006/7/8.
--
-- Migration 20260605000006 revoked EXECUTE FROM PUBLIC on 15 SECURITY
-- DEFINER functions and granted to specific roles. 20260605000007 and
-- 20260605000008 added more grants trying to make signup work.
--
-- We spent the day chasing a signup failure that, on closer inspection
-- of the Supabase Auth logs, has been silently happening since long
-- before today (the May 20260513214005 migration is literally a
-- backfill for exactly this — users with auth.users rows but no
-- public.profiles row). Today's changes did not cause it; they merely
-- coincided with us testing it for the first time after the work.
--
-- Rather than continue speculating, revert today's EXECUTE changes
-- back to a known state and treat the long-standing signup-trigger
-- silent failure as a separate problem to investigate fresh.
--
-- Net effect after this migration: EXECUTE grants on the affected
-- functions return to pre-PR-117 state (PUBLIC has EXECUTE on all of
-- them). We re-incur the 15+15 0028/0029 linter findings — that's
-- the explicit trade we're making for stability today.

GRANT EXECUTE ON FUNCTION public.auto_save_bassline(uuid, character varying, jsonb, uuid, jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_exists(text)                                          TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_temp_midi_files()                                TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_bassline(uuid, uuid, character varying, boolean)       TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tutorials_with_exercise_count()                              TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role()                                                  TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user()                                                TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_completed_assessment(uuid)                                   TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(character varying)                                      TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.initialize_user_preferences()                                    TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                                                   TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_bassline(uuid, uuid)                                 TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_exercise_like_count()                                     TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pattern_usage()                                           TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_practice_streak()                                         TO PUBLIC;
