-- ============================================================================
-- Goal lifecycle (admin authoring) — add an ARCHIVE state to training_goals.
--
-- The admin needs three levels of "take a goal out of circulation", distinct
-- from hard delete (which cascades and would destroy enrollees' climbs):
--   - is_active = false  → INACTIVE: hidden from NEW enrollments, still in the
--     admin list (the existing deactivate).
--   - archived_at IS NOT NULL → ARCHIVED: hidden from the admin list too + not
--     enrollable; a reversible soft-delete that NEVER cascades. The "get it off
--     my screen without destroying data" state.
--   - hard DELETE → only when zero enrollments, or via an explicit admin
--     force-delete (handled in the service, not here).
--
-- The engine is unaffected: enrollees ride a frozen goal_snapshot, so archiving
-- (or editing) a goal never touches an in-flight climb. ADDITIVE + NULLABLE +
-- IDEMPOTENT — existing goals default to archived_at = NULL (not archived).
-- ============================================================================

ALTER TABLE public.training_goals
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.training_goals.archived_at IS
  'Soft-delete timestamp (goal lifecycle). NULL = live. Non-null = archived: '
  'hidden from admin lists + not enrollable, reversible, never cascades. '
  'Distinct from is_active (inactive = hidden from new enrollments only).';

-- Content-ladder topics (epic §3 Build A/B). These were AUTHORED by the admin UI
-- but had no column to land in — create/update silently dropped them and the
-- enroll snapshot couldn't copy them, so a multi-topic goal saved empty. This
-- adds the missing store (mirrors block_set: a JSONB array of Topic). Defaults
-- to [] so single-focal SPEED goals are unaffected.
ALTER TABLE public.training_goals
  ADD COLUMN IF NOT EXISTS topics JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.training_goals.topics IS
  'Content-ladder topics (Topic[]): ~3 student-facing skill areas, each with a '
  'rep quota + internal stages. Empty for single-focal SPEED goals. Frozen onto '
  'goal_enrollments.goal_snapshot at enroll time (see training.ts GoalSnapshot).';

-- The admin list + the public enrollable lookup both filter to non-archived;
-- a partial index keeps those reads lean as archived goals accumulate.
CREATE INDEX IF NOT EXISTS idx_training_goals_not_archived
  ON public.training_goals (created_at DESC)
  WHERE archived_at IS NULL;
