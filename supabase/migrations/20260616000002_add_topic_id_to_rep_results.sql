-- ============================================================================
-- Content ladder (BASS_GYM_CONTENT_LADDER_EPIC.md, Build A) — attribute each rep
-- to a TOPIC so the engine can tally per-topic quotas.
--
-- Founder decision (epic §5 / §2): rep ↔ topic = a `topic_id` STAMP on
-- rep_results → the quota tally is COUNT(*) WHERE topic_id = $1. One finished rep
-- = one topic = one tick. Clean, indexable, append-only — survives a
-- goal_snapshot edit (the count lives in the immutable history, not mutable
-- climb state).
--
-- ADDITIVE + NULLABLE + IDEMPOTENT: existing single-focal SPEED reps and all
-- legacy rows simply carry topic_id = NULL (they belong to no topic). No
-- backfill, no breaking change. Keep `topic_id` in sync with training.ts
-- RepResult.topicId / Topic.id.
-- ============================================================================

ALTER TABLE public.rep_results
  ADD COLUMN IF NOT EXISTS topic_id TEXT;

COMMENT ON COLUMN public.rep_results.topic_id IS
  'Content-ladder topic this rep belonged to (Topic.id from the goal snapshot). '
  'NULL on single-focal SPEED reps + legacy rows. Quota tally = COUNT(*) per '
  '(goal_enrollment_id, topic_id). See BASS_GYM_CONTENT_LADDER_EPIC §3.';

-- The quota-tally read: per enrollment, count reps grouped by topic. A partial
-- index (topic_id IS NOT NULL) keeps it lean — single-focal goals add no weight.
CREATE INDEX IF NOT EXISTS idx_rep_results_enrollment_topic
  ON public.rep_results (goal_enrollment_id, topic_id)
  WHERE topic_id IS NOT NULL;
