-- Fix Supabase database linter findings:
--   0010_security_definer_view  : public.exercises_with_runtime, public.fresh_creator_stats
--   0013_rls_disabled_in_public : public.pattern_usage_stats, public.pattern_uploads
--
-- Strategy:
--   1. Recreate the two views with `security_invoker = true` so they enforce
--      the querying user's RLS instead of the view owner's. The underlying
--      tables already have appropriate RLS (public-readable creator_stats and
--      exercises), so behavior is preserved.
--   2. Enable RLS on pattern_usage_stats and pattern_uploads and add policies
--      that mirror the existing pattern_library access model (public can read,
--      admins can manage). The pattern_usage_stats trigger is made
--      SECURITY DEFINER so authenticated users' usage tracking still works.

-- =============================================================================
-- 1. exercises_with_runtime: recreate as security invoker
-- =============================================================================
DROP VIEW IF EXISTS public.exercises_with_runtime;
CREATE VIEW public.exercises_with_runtime
WITH (security_invoker = true) AS
SELECT
  e.*,
  (e.total_bars * (e.time_signature->>'numerator')::integer * 60000.0 / e.tempo) AS runtime_duration_ms,
  (e.total_bars * (e.time_signature->>'numerator')::integer * 60.0 / e.tempo)     AS runtime_duration_seconds,
  (e.total_bars * (e.time_signature->>'numerator')::integer)                      AS total_beats,
  (e.total_bars * (e.time_signature->>'numerator')::integer * 480)                AS total_ticks
FROM public.exercises e
WHERE e.is_active = true;

-- =============================================================================
-- 2. fresh_creator_stats: recreate as security invoker
-- =============================================================================
DROP VIEW IF EXISTS public.fresh_creator_stats;
CREATE VIEW public.fresh_creator_stats
WITH (security_invoker = true) AS
SELECT *
FROM public.creator_stats
WHERE last_fetched_at > NOW() - INTERVAL '24 hours';

-- =============================================================================
-- 3. pattern_usage_stats: enable RLS
-- =============================================================================
ALTER TABLE public.pattern_usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to pattern usage stats"
  ON public.pattern_usage_stats
  FOR SELECT USING (true);

CREATE POLICY "Admin manage pattern usage stats"
  ON public.pattern_usage_stats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- The update_pattern_usage() trigger fires on user_pattern_selections writes
-- (by the owning user) and writes to pattern_usage_stats. With RLS now on,
-- the trigger must run with elevated privileges or normal users' inserts/
-- updates to user_pattern_selections will fail. Make the trigger function
-- SECURITY DEFINER so it bypasses RLS on pattern_usage_stats specifically.
CREATE OR REPLACE FUNCTION public.update_pattern_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO pattern_usage_stats (pattern_id, usage_count, last_used_at)
    VALUES (NEW.selected_drum_pattern_id, 1, NOW())
    ON CONFLICT (pattern_id)
    DO UPDATE SET
        usage_count = pattern_usage_stats.usage_count + 1,
        last_used_at = NOW();

    IF NEW.selected_harmony_pattern_id IS NOT NULL THEN
        INSERT INTO pattern_usage_stats (pattern_id, usage_count, last_used_at)
        VALUES (NEW.selected_harmony_pattern_id, 1, NOW())
        ON CONFLICT (pattern_id)
        DO UPDATE SET
            usage_count = pattern_usage_stats.usage_count + 1,
            last_used_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

-- =============================================================================
-- 4. pattern_uploads: enable RLS (admin-only — uploads are a back-office flow)
-- =============================================================================
ALTER TABLE public.pattern_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage pattern uploads"
  ON public.pattern_uploads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );
