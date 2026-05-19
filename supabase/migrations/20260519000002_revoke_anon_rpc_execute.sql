-- Fix Supabase linter 0028_anon_security_definer_function_executable
--
-- 15 SECURITY DEFINER functions are currently EXECUTE-able by the `anon` role
-- via /rest/v1/rpc/<name>. Most are triggers or backend-only utilities and
-- should never be callable by unauthenticated REST clients.
--
-- KEPT for anon: check_user_exists  (used by the frontend register flow to
--                                    detect existing accounts pre-signin)

-- Trigger functions (should never be called via RPC at all)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                FROM anon;
REVOKE EXECUTE ON FUNCTION public.initialize_user_preferences()    FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_exercise_like_count()     FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_pattern_usage()           FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_practice_streak()         FROM anon;

-- Authenticated-only utilities (caller is always a signed-in user)
REVOKE EXECUTE ON FUNCTION public.get_user_role()                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_completed_assessment(uuid)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(character varying)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)                                   FROM anon;

-- Backend / service-role only (service_role bypasses these grants)
REVOKE EXECUTE ON FUNCTION public.auto_save_bassline(uuid, character varying, jsonb, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_bassline(uuid, uuid, character varying, boolean)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_bassline(uuid, uuid)                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_temp_midi_files()                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_tutorials_with_exercise_count()                             FROM anon;
