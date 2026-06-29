-- Migration: reshape recording_assignments → GIGS (goal-bound, cycle-day-scheduled).
-- Date: 2026-06-29
--
-- The model sharpened after 20260629000001: a deliverable is a GIG, and a gig is
-- tied to a GOAL (not a single user) + a DAY-OFFSET into the billing cycle. Anyone
-- enrolled in the goal inherits its gigs; each student performs them relative to
-- THEIR own 30-day cycle (e.g. "submit your first take by day 3, another by day 14").
-- Gigs surface in the backstage panel and route the student to /gigs to act.
--
-- The previous tables (recording_assignments, take_results) were just created EMPTY
-- in 20260629000001, so we drop the wrongly-shaped assignment table and rebuild it
-- as `gigs`, and repoint take_results' FK at gigs. No data loss (nothing exists yet).

-- Drop the user-bound assignment table + the take FK that referenced it.
ALTER TABLE public.take_results DROP COLUMN IF EXISTS recording_assignment_id;
DROP TABLE IF EXISTS public.recording_assignments;

-- ============================================================================
-- gigs — a goal's deliverable, scheduled by day-offset into the billing cycle.
-- Type is an enum for the future; only 'recording' is wired now (the take flow).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gigs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The GOAL this gig belongs to. Every student enrolled in the goal inherits it.
  goal_id         UUID NOT NULL REFERENCES public.training_goals(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- the admin

  -- What kind of action. Enum now (recording only wired), so adding tutorial/quiz/
  -- task gigs later is a CHECK widen, not a reshape.
  gig_type        TEXT NOT NULL DEFAULT 'recording'
                    CHECK (gig_type IN ('recording')),

  title           TEXT NOT NULL,              -- "Submit Funky Groove, 90 BPM, in key"
  instructions    TEXT,                       -- optional longer brief

  -- WHEN in the student's 30-day cycle this is due — a DAY OFFSET from THEIR cycle
  -- start (enrollment/billing anchor), so it adapts to whenever each student began.
  -- 0 = day one. The /gigs page + backstage compute the real date per student.
  cycle_day       INTEGER NOT NULL DEFAULT 0 CHECK (cycle_day >= 0 AND cycle_day <= 31),

  -- For a 'recording' gig: what to play. The exercise from the gym library + params,
  -- snapshotted so the gig is self-describing even if the library entry changes.
  station         TEXT NOT NULL DEFAULT 'scales',
  exercise_id     UUID REFERENCES public.gym_exercises(id) ON DELETE SET NULL,
  exercise_name   TEXT,
  scale_key       TEXT,
  tempo_bpm       INTEGER,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,  -- soft-disable without deleting
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.gigs IS
  'A goal''s deliverable, scheduled by day-offset into the student''s billing cycle. '
  'Anyone enrolled in the goal inherits its gigs. Surfaced in backstage → /gigs. '
  'gig_type=recording → the student submits a graded take (→ take_results).';

CREATE INDEX IF NOT EXISTS idx_gigs_goal
  ON public.gigs (goal_id, cycle_day);

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

-- Students READ gigs for goals they're enrolled in (so the backstage/gigs page can
-- list them). Writes are admin-only via the service role (no INSERT/UPDATE policy).
CREATE POLICY "Users read gigs for their enrolled goals"
  ON public.gigs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_enrollments ge
      WHERE ge.goal_id = gigs.goal_id
        AND ge.user_id = auth.uid()
    )
  );

-- ============================================================================
-- take_results: re-point at gigs. A submitted take fulfils a gig (nullable — a
-- future free-practice submission may have no gig).
-- ============================================================================
ALTER TABLE public.take_results
  ADD COLUMN IF NOT EXISTS gig_id UUID
    REFERENCES public.gigs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_take_results_gig
  ON public.take_results (gig_id, submitted_at DESC);
