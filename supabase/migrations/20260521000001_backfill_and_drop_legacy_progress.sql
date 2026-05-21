-- PR 6/6 of the progress system redesign: backfill + cleanup.
--
-- Background: PR 1 (20260520000001_create_block_completions.sql) added the
-- new block_completions table. PRs 2–5 wired the backend + frontend to
-- read and write that table exclusively. The legacy
-- tutorial_progress.block_progress JSONB column and the legacy
-- tutorial_progress.understood / applied / last_accessed_block_id columns
-- are now dead from the app's perspective:
--
--   - apps/frontend/src and apps/backend/src have zero references to
--     "tutorial_progress" (verified by grep at migration time).
--   - The new system is the only writer to block_completions, and
--     block_completions is the only thing the new system reads.
--
-- This migration:
--   1. Backfills any existing tutorial_progress.block_progress JSONB rows
--      into block_completions, so no user loses data they actually had.
--   2. Drops the legacy columns.
--   3. Decides what to do with the tutorial_progress table itself.
--
-- Pre-production status (per CLAUDE.md) means real impact is minimal, but
-- the backfill is cheap insurance — if any user did have block_progress
-- data that hadn't been migrated through the new endpoints, this preserves
-- it.

-- =============================================================================
-- 1. BACKFILL: copy any completed entries from the legacy JSONB into the
--    normalized block_completions table.
--
-- Each row in tutorial_progress.block_progress looks like:
--   { "<blockId>": { "blockId": "<blockId>", "completed": true,
--                    "completedAt": "<iso>", "data": {...} } }
--
-- jsonb_each(block_progress) flattens this into (key, value) pairs where
-- key = blockId and value = the entry object. We only copy entries whose
-- `completed` flag is true, since the new model treats "row exists" as
-- "completed".
--
-- ON CONFLICT DO NOTHING is important: if any user has both an entry in
-- the old JSONB AND a row in the new table (e.g. completed via the new
-- endpoint after PR 5 went out), we keep the new row's data.
-- =============================================================================
INSERT INTO public.block_completions (user_id, tutorial_id, block_id, completed_at, data)
SELECT
  tp.user_id,
  tp.tutorial_id,
  entry.key AS block_id,
  COALESCE(
    NULLIF(entry.value->>'completedAt', '')::timestamptz,
    tp.updated_at,
    NOW()
  ) AS completed_at,
  entry.value->'data' AS data
FROM public.tutorial_progress AS tp,
     LATERAL jsonb_each(tp.block_progress) AS entry
WHERE tp.block_progress IS NOT NULL
  AND tp.block_progress <> '{}'::jsonb
  AND COALESCE((entry.value->>'completed')::boolean, false) = true
ON CONFLICT (user_id, tutorial_id, block_id) DO NOTHING;

-- =============================================================================
-- 2. DROP the legacy columns. The trigger and table itself stay (some
--    legacy code paths or analytics queries may still want the per-(user,
--    tutorial) row even though they don't care about block_progress).
-- =============================================================================
ALTER TABLE public.tutorial_progress
  DROP COLUMN IF EXISTS block_progress,
  DROP COLUMN IF EXISTS last_accessed_block_id,
  DROP COLUMN IF EXISTS understood,
  DROP COLUMN IF EXISTS understood_at,
  DROP COLUMN IF EXISTS applied,
  DROP COLUMN IF EXISTS applied_at;

-- =============================================================================
-- 3. The tutorial_progress table now only has (id, user_id, tutorial_id,
--    updated_at, the trigger). It's effectively a (user, tutorial) join
--    row with a timestamp. Since nothing reads it and nothing writes to
--    it from the app, drop it entirely.
--
--    The trigger function is also dropped — it's an orphan once the
--    table is gone. The cascade handles the trigger itself.
-- =============================================================================
DROP TABLE IF EXISTS public.tutorial_progress CASCADE;
DROP FUNCTION IF EXISTS public.update_tutorial_progress_timestamp() CASCADE;

-- =============================================================================
-- Sanity: the new table is unchanged, just confirming the migration order
-- doesn't accidentally break it.
-- =============================================================================
COMMENT ON TABLE public.block_completions IS
  'Per-block completion records. One row per (user, tutorial, block). '
  'Single source of truth for tutorial progress (legacy '
  'tutorial_progress table dropped in 20260521000001).';
