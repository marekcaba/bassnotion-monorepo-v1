-- Revoke RPC EXECUTE from PUBLIC (the actual fix the May migration missed).
--
-- In Postgres, EXECUTE on functions is granted to the PUBLIC pseudo-role by
-- default. The `anon` and `authenticated` roles both inherit from PUBLIC.
-- Migration 20260519000002 revoked EXECUTE FROM anon on 15 SECURITY DEFINER
-- functions, but did NOT revoke from PUBLIC — so anon still inherited
-- EXECUTE and the linter findings stayed.
--
-- Live proof of the gap (before this migration):
--   curl -X POST .../rest/v1/rpc/get_tutorials_with_exercise_count
--     -H "apikey: <published anon key>"
--   → returns the full tutorials list to anyone with the anon key,
--     bypassing the table-level revokes we shipped earlier today.
--
-- Fix: revoke from PUBLIC, then GRANT back to the SPECIFIC roles that
-- legitimately need EXECUTE for each function.
--
-- Per-function caller analysis (verified via grep of apps/):
--
--   FRONTEND (anon) callers:
--     - check_user_exists       (pre-signin register flow)
--
--   BACKEND (service_role) callers — service_role bypasses grants but we
--   GRANT explicitly anyway for clarity:
--     - auto_save_bassline, duplicate_bassline, soft_delete_bassline
--     - get_tutorials_with_exercise_count
--     - cleanup_expired_temp_midi_files (cron)
--
--   TRIGGER / SIGNUP context (anon executes during signup) — needed for
--   /auth/v1/signup to complete:
--     - handle_new_user, initialize_user_preferences
--
--   AUTHENTICATED-CONTEXT triggers (fire on inserts by signed-in users):
--     - update_exercise_like_count, update_pattern_usage,
--       update_practice_streak
--
--   RLS POLICY HELPERS (called from inside CREATE POLICY ... USING/CHECK
--   expressions, so the role evaluating the policy needs EXECUTE):
--     - is_admin, has_role, get_user_role, has_completed_assessment
--
-- service_role keeps EXECUTE on everything (always — it's a superuser).
-- supabase_admin and postgres also retain EXECUTE (defaults).

-- 1. Revoke from PUBLIC ─────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.auto_save_bassline(uuid, character varying, jsonb, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_user_exists(text)                                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_temp_midi_files()                                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.duplicate_bassline(uuid, uuid, character varying, boolean)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_tutorials_with_exercise_count()                              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role()                                                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_completed_assessment(uuid)                                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(character varying)                                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.initialize_user_preferences()                                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)                                                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.soft_delete_bassline(uuid, uuid)                                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_exercise_like_count()                                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_pattern_usage()                                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_practice_streak()                                         FROM PUBLIC;

-- 2. GRANT back to the specific roles each function legitimately needs ──────

-- anon: only check_user_exists (register flow) + signup-context triggers
GRANT EXECUTE ON FUNCTION public.check_user_exists(text)             TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user()                   TO anon;
GRANT EXECUTE ON FUNCTION public.initialize_user_preferences()       TO anon;

-- authenticated:
--   - check_user_exists is also called post-login in some flows; keep
--   - signup triggers also fire when authenticated users insert (defensive)
--   - per-user triggers fire on user inserts
--   - RLS-policy helpers are evaluated as authenticated
GRANT EXECUTE ON FUNCTION public.check_user_exists(text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_user_preferences()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_exercise_like_count()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_pattern_usage()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_practice_streak()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(character varying)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_completed_assessment(uuid)      TO authenticated;

-- service_role: everything (always — bypasses RLS + grants, but explicit
-- grant keeps the schema readable and proves intent)
GRANT EXECUTE ON FUNCTION public.auto_save_bassline(uuid, character varying, jsonb, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_user_exists(text)                                         TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_temp_midi_files()                               TO service_role;
GRANT EXECUTE ON FUNCTION public.duplicate_bassline(uuid, uuid, character varying, boolean)      TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tutorials_with_exercise_count()                             TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role()                                                 TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user()                                               TO service_role;
GRANT EXECUTE ON FUNCTION public.has_completed_assessment(uuid)                                  TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(character varying)                                     TO service_role;
GRANT EXECUTE ON FUNCTION public.initialize_user_preferences()                                   TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                                                  TO service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_bassline(uuid, uuid)                                TO service_role;
GRANT EXECUTE ON FUNCTION public.update_exercise_like_count()                                    TO service_role;
GRANT EXECUTE ON FUNCTION public.update_pattern_usage()                                          TO service_role;
GRANT EXECUTE ON FUNCTION public.update_practice_streak()                                        TO service_role;
