-- Migration: gigs.record_loops + one-take-per-gig (replace-on-resubmit).
-- Date: 2026-06-29
--
-- Two changes driven by the gig PERFORM flow:
--
-- 1. record_loops — the admin sets HOW MANY full loops the record-mode take captures before it
--    auto-stops (1-8). The student can't change it; it's the length of the deliverable. Default 2
--    matches the gym tool's current default.
--
-- 2. ONE submission per gig per user (replace-on-resubmit). A gig is a single deliverable: the
--    student's latest take REPLACES the previous one. We enforce "at most one take_result per
--    (user_id, gig_id) where gig_id IS NOT NULL" with a partial UNIQUE index — free-practice takes
--    (gig_id NULL) are unconstrained. The backend deletes the old audio + row before inserting the
--    new one, so this index is a backstop, not the primary path.

-- 1. record_loops on gigs.
ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS record_loops INTEGER NOT NULL DEFAULT 2
    CHECK (record_loops >= 1 AND record_loops <= 8);

COMMENT ON COLUMN public.gigs.record_loops IS
  'How many full loops the record-mode take captures before auto-stopping (1-8). '
  'Admin-set; the student can''t change it (it''s the deliverable length).';

-- 2. At most one take per (user, gig) — only when gig_id is set (free practice unconstrained).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_take_results_user_gig
  ON public.take_results (user_id, gig_id)
  WHERE gig_id IS NOT NULL;
