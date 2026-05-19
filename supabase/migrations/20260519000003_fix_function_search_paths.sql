-- Fix Supabase linter 0011_function_search_path_mutable
--
-- Functions without an explicit search_path inherit it from the caller's
-- session. An attacker who can influence the search_path can shadow trusted
-- functions/operators by creating same-named objects in a schema that comes
-- first in the path. Pinning search_path to `public, pg_temp` removes that
-- attack surface. This is a defense-in-depth change — no behavior change is
-- expected, since all referenced objects live in `public` already.

ALTER FUNCTION public.auto_save_bassline(uuid, character varying, jsonb, uuid, jsonb)        SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_exercise_runtime(integer, integer)                           SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_temp_midi_files()                                      SET search_path = public, pg_temp;
ALTER FUNCTION public.duplicate_bassline(uuid, uuid, character varying, boolean)             SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_slug(text)                                                    SET search_path = public, pg_temp;
ALTER FUNCTION public.get_pattern_storage_url(text)                                          SET search_path = public, pg_temp;
ALTER FUNCTION public.get_tutorials_with_exercise_count()                                    SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_role()                                                        SET search_path = public, pg_temp;
ALTER FUNCTION public.has_completed_assessment(uuid)                                         SET search_path = public, pg_temp;
ALTER FUNCTION public.has_role(character varying)                                            SET search_path = public, pg_temp;
ALTER FUNCTION public.initialize_user_preferences()                                          SET search_path = public, pg_temp;
ALTER FUNCTION public.migrate_all_exercises_to_musical_timing()                              SET search_path = public, pg_temp;
ALTER FUNCTION public.migrate_exercise_to_musical_timing(uuid)                               SET search_path = public, pg_temp;
ALTER FUNCTION public.ms_to_musical_duration(integer, integer)                               SET search_path = public, pg_temp;
ALTER FUNCTION public.ms_to_musical_position(integer, jsonb, integer)                        SET search_path = public, pg_temp;
ALTER FUNCTION public.musical_time_to_milliseconds(integer, integer, integer, integer, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.soft_delete_bassline(uuid, uuid)                                       SET search_path = public, pg_temp;
ALTER FUNCTION public.tick_to_milliseconds(integer, integer, integer)                        SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_generate_slug()                                                SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_set_updated_at()                                               SET search_path = public, pg_temp;
ALTER FUNCTION public.update_assessment_config_updated_at()                                  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_creator_stats_updated_at()                                      SET search_path = public, pg_temp;
ALTER FUNCTION public.update_exercise_like_count()                                           SET search_path = public, pg_temp;
ALTER FUNCTION public.update_exercises_updated_at()                                          SET search_path = public, pg_temp;
ALTER FUNCTION public.update_journey_timestamp()                                             SET search_path = public, pg_temp;
ALTER FUNCTION public.update_practice_streak()                                               SET search_path = public, pg_temp;
ALTER FUNCTION public.update_tutorial_last_modified()                                        SET search_path = public, pg_temp;
ALTER FUNCTION public.update_tutorial_progress_timestamp()                                   SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column()                                             SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_epic4_note_properties(jsonb)                                  SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_exercise_notes(uuid)                                          SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_musical_timing_migration()                                    SET search_path = public, pg_temp;
