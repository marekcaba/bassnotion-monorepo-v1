-- Aggressive lockdown: revoke anon + (most) authenticated SELECT on tables
-- the frontend does not read directly.
--
-- Architecture context (verified via exhaustive grep of apps/frontend/src):
--   - Public/marketing pages SSR through the backend NestJS API, which uses
--     SUPABASE_SERVICE_ROLE_KEY (bypasses RLS + grants entirely).
--   - The ONLY tables the frontend Supabase client touches directly are:
--       exercises   (read — in auth-gated /library player, runs as
--                    authenticated; keep authenticated SELECT)
--       profiles    (already self-only via 20260605000004)
--       waitlist, founder_interest, funnel_events (writes — already locked
--                    down via the route-swap migrations 1-4)
--       avatars     (storage bucket, not a public table)
--   - Backend services use service_role for everything else, which bypasses
--     RLS + grants entirely.
--
-- This migration revokes BOTH anon AND authenticated SELECT on every table
-- except `exercises` and `exercises_with_runtime` (the only content surface
-- the in-app player reads directly). Closes ~31 anon + ~29 authenticated
-- findings (the two `exercises*` entries stay flagged for authenticated).
--
-- Service role still bypasses everything, so backend reads are unaffected.
--
-- ROLLBACK:
--   GRANT SELECT ON TABLE public.<name> TO anon, authenticated;

-- ── Internal / per-user / write-only tables ──────────────────────────────────
-- (zero anon AND zero authenticated reads from frontend)

REVOKE SELECT ON TABLE public.assessment_config         FROM anon, authenticated;
REVOKE SELECT ON TABLE public.assessment_flow_edges     FROM anon, authenticated;
REVOKE SELECT ON TABLE public.assessment_flow_nodes     FROM anon, authenticated;
REVOKE SELECT ON TABLE public.assessment_questions      FROM anon, authenticated;
REVOKE SELECT ON TABLE public.assessment_segments       FROM anon, authenticated;
REVOKE SELECT ON TABLE public.block_completions         FROM anon, authenticated;
REVOKE SELECT ON TABLE public.coach_insight_templates   FROM anon, authenticated;
REVOKE SELECT ON TABLE public.custom_basslines          FROM anon, authenticated;
REVOKE SELECT ON TABLE public.exercise_favorites        FROM anon, authenticated;
REVOKE SELECT ON TABLE public.exercise_likes            FROM anon, authenticated;
REVOKE SELECT ON TABLE public.founder_card_config       FROM anon, authenticated;
REVOKE SELECT ON TABLE public.founder_interest          FROM anon, authenticated;
REVOKE SELECT ON TABLE public.founder_members           FROM anon, authenticated;
REVOKE SELECT ON TABLE public.funnel_events             FROM anon, authenticated;
REVOKE SELECT ON TABLE public.learning_journeys         FROM anon, authenticated;
REVOKE SELECT ON TABLE public.login_attempts            FROM anon, authenticated;
REVOKE SELECT ON TABLE public.pattern_uploads           FROM anon, authenticated;
REVOKE SELECT ON TABLE public.pattern_usage_stats       FROM anon, authenticated;
REVOKE SELECT ON TABLE public.practice_days             FROM anon, authenticated;
REVOKE SELECT ON TABLE public.practice_progress         FROM anon, authenticated;
REVOKE SELECT ON TABLE public.tutorial_pattern_config   FROM anon, authenticated;
REVOKE SELECT ON TABLE public.tutorial_sections         FROM anon, authenticated;
REVOKE SELECT ON TABLE public.user_assessment_sessions  FROM anon, authenticated;
REVOKE SELECT ON TABLE public.user_journeys             FROM anon, authenticated;
REVOKE SELECT ON TABLE public.user_pattern_selections   FROM anon, authenticated;
REVOKE SELECT ON TABLE public.user_preferences          FROM anon, authenticated;
REVOKE SELECT ON TABLE public.waitlist                  FROM anon, authenticated;

-- ── Content tables — backend SSRs everything; zero direct frontend reads ────

REVOKE SELECT ON TABLE public.creator_stats             FROM anon, authenticated;
REVOKE SELECT ON TABLE public.groove_library            FROM anon, authenticated;
REVOKE SELECT ON TABLE public.pattern_library           FROM anon, authenticated;
REVOKE SELECT ON TABLE public.tutorials                 FROM anon, authenticated;

-- ── Views — same story ──────────────────────────────────────────────────────

REVOKE SELECT ON public.fresh_creator_stats             FROM anon, authenticated;

-- ── KEPT: exercises + exercises_with_runtime ────────────────────────────────
-- These are read directly by the in-app player (ExerciseLoader.ts +
-- widgets/api/exercises.ts) under the user's session JWT. Revoking
-- authenticated SELECT here would break /library/<slug> playback.
-- Revoke only from anon:

REVOKE SELECT ON TABLE public.exercises                 FROM anon;
REVOKE SELECT ON public.exercises_with_runtime          FROM anon;
