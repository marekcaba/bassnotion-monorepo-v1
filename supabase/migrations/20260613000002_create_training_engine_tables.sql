-- Bass Gym Training Engine — Phase 0 schema.
--
-- The training engine is an ADDITIVE backend domain that plans a player's
-- daily "rep" (the 2+2+2 climb) toward a goal target, anchored to the
-- enrollment (NOT the Stripe billing cycle — free/beta users have no
-- subscription row, see BASS_GYM_TRAINING_ENGINE_SPEC_v3 §7).
--
-- Conventions match the existing repo (verified against learning_journeys
-- 20260119000002, block_completions 20260520000001, practice_days
-- 20260603000002):
--   * UUID PKs via gen_random_uuid()
--   * TIMESTAMPTZ created_at/updated_at; updated_at driven by the shared
--     public.update_journey_timestamp() trigger fn
--   * FK to public.profiles(id) ON DELETE CASCADE (the dominant convention;
--     accelerator_enrollments FKs auth.users, but we follow the per-user RLS
--     tables the engine sits closest to — block_completions/practice_days)
--   * RLS enabled on every table; per-user policies use auth.uid() = user_id;
--     admin-authored content uses public.is_admin(auth.uid())
--   * Append-only tables (rep_results, user_milestones) OMIT the UPDATE policy
--
-- This migration is purely additive: no existing table is altered destructively
-- (profiles gets two new nullable/defaulted columns only).

-- ============================================================================
-- training_goals — admin-authored goal templates (the climb recipe).
-- Precedent: learning_journeys (public read where is_active, admin ALL).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.training_goals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT NOT NULL UNIQUE,
  type               TEXT NOT NULL CHECK (type IN ('speed', 'knowledge', 'vocabulary', 'feel')),
  title              TEXT NOT NULL,
  description        TEXT,

  -- The climb definition the pure generateRep reads (data, not code).
  target             JSONB NOT NULL DEFAULT '{}'::jsonb,   -- e.g. { "tempoBpm": 120 }
  assessment_config  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- placement spec
  block_set          JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ordered content refs (the recipe)
  prerequisites      JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ signalType, minValue }] — suggest, not block
  day30_milestone    JSONB NOT NULL DEFAULT '{}'::jsonb,
  fork_config        JSONB NOT NULL DEFAULT '{}'::jsonb,   -- the 3-door fork template

  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.training_goals IS
  'Admin-authored goal templates. block_set is the ordered climb recipe the '
  'pure generateRep reads. Content is data, not code — adding a goal = a row.';

CREATE INDEX IF NOT EXISTS idx_training_goals_active
  ON public.training_goals (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_training_goals_type
  ON public.training_goals (type);

ALTER TABLE public.training_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active training goals are viewable by everyone"
  ON public.training_goals FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage training goals"
  ON public.training_goals FOR ALL
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- goal_enrollments — one row per (user, goal) enrollment; the graduation clock.
-- Precedent: accelerator_enrollments started_at drip pattern (but FK profiles).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.goal_enrollments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id               UUID NOT NULL REFERENCES public.training_goals(id) ON DELETE CASCADE,

  -- The graduation clock anchor. graduationDueAt = started_at + 30 days.
  -- NOT subscription.current_period_start (null for free/beta users). For a
  -- paying member you MAY align this to the billing boundary at write time,
  -- but the default NOW() works for everyone (the entire MVP audience).
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'paused', 'completed', 'graduated', 'abandoned')),

  -- Deep copy of block_set + target + assessment + day30 + fork at enroll time,
  -- so draft→publish edits to a training_goal never mutate an in-flight climb.
  goal_snapshot         JSONB NOT NULL,

  placement             JSONB NOT NULL DEFAULT '{}'::jsonb,  -- where the assessment landed the player

  -- The reserved tutorials-row slug the generated rep bricks render through
  -- (the virtual-tutorial seam, spec §7a). Nullable until first rep mints it.
  virtual_tutorial_slug TEXT,

  graduated_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Re-enrollment idempotency: a user has at most one enrollment per goal.
  UNIQUE (user_id, goal_id)
);

COMMENT ON TABLE public.goal_enrollments IS
  'One enrollment per (user, goal). started_at is the graduation clock anchor '
  '(started_at + 30 days), NOT the Stripe billing cycle. goal_snapshot freezes '
  'the climb so content edits never disturb an in-flight enrollment.';
COMMENT ON COLUMN public.goal_enrollments.virtual_tutorial_slug IS
  'Reserved tutorials-row slug the generated rep bricks render through (§7a). '
  'block_completions.tutorial_id has no FK, so writes never fight a constraint.';

CREATE INDEX IF NOT EXISTS idx_goal_enrollments_user
  ON public.goal_enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_goal_enrollments_user_status
  ON public.goal_enrollments (user_id, status);

ALTER TABLE public.goal_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goal enrollments"
  ON public.goal_enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goal enrollments"
  ON public.goal_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal enrollments"
  ON public.goal_enrollments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all goal enrollments"
  ON public.goal_enrollments FOR ALL
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- rep_results — APPEND-ONLY history; the engine's own source of truth.
-- generateRep reads THIS, never block_completions (spec §11). Precedent:
-- block_completions + practice_days (no UPDATE policy).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rep_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_enrollment_id  UUID NOT NULL REFERENCES public.goal_enrollments(id) ON DELETE CASCADE,
  drill_session_id    UUID,
  block_id            TEXT NOT NULL,
  ladder_level        TEXT NOT NULL CHECK (ladder_level IN ('L1', 'L2', 'L3')),
  tempo_bpm           INTEGER,
  signal_kind         TEXT,                                  -- ProgressSignal.kind
  signal_value        JSONB,                                 -- ProgressSignal payload
  -- reuses DrillCompletionResult (conquered|completed|released) + the new too_hard
  -- 'too_hard' is engine-only (the drill UI never emits it). Keep this list in
  -- sync with training.ts RepResultOutcome = DrillCompletionResult | 'too_hard'.
  result              TEXT NOT NULL
                        CHECK (result IN ('conquered', 'completed', 'released', 'too_hard')),
  -- Mirrors block.ts MasteryTier. Nullable: only a 'conquered' rep carries one.
  achieved_tier       TEXT
                        CHECK (achieved_tier IS NULL OR achieved_tier IN ('bronze', 'silver', 'gold')),
  completed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.rep_results IS
  'Append-only rep history — the engine''s own source of truth. generateRep '
  'derives mastery tier + spaced-review from these rows at read time. NOT '
  'block_completions (that is the drill UI''s unlock/summary store).';

CREATE INDEX IF NOT EXISTS idx_rep_results_enrollment
  ON public.rep_results (goal_enrollment_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rep_results_user
  ON public.rep_results (user_id, completed_at DESC);

ALTER TABLE public.rep_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own rep results"
  ON public.rep_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rep results"
  ON public.rep_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy — rep_results is append-only (future training data for the
-- Bridge + analytics). DELETE allowed for admin/reset parity.
CREATE POLICY "Users can delete their own rep results"
  ON public.rep_results FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- climb_states — one mutable row per enrollment (current position + back-off).
-- Precedent: a richer analog of user_journeys.current_milestone_index, but
-- JSONB position (not INTEGER[]).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.climb_states (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_enrollment_id  UUID NOT NULL UNIQUE
                        REFERENCES public.goal_enrollments(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  current_position    JSONB NOT NULL DEFAULT '{}'::jsonb,    -- e.g. { tempoBpm, blockIndex }
  spaced_review_queue JSONB NOT NULL DEFAULT '[]'::jsonb,
  difficulty_scalar   DOUBLE PRECISION NOT NULL DEFAULT 1.0, -- §4 back-off multiplier
  backoff_count       INTEGER NOT NULL DEFAULT 0,
  last_rep_date       DATE,                                  -- drives missed-day re-plan
  recommendations     JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.climb_states IS
  'One mutable row per enrollment. current_position is REP-driven (not '
  'calendar-driven). difficulty_scalar is the §4 back-off multiplier that '
  'generateRep applies to the L1/L2/L3 deltas. SCAFFOLDING: backoff_count and '
  'last_rep_date are persisted now but only CONSUMED by generateRep in a later '
  'phase — the §4 "check-in after ~3 backs-off" + injury bypass and the §3 '
  'missed-day re-plan depend on signal recording (Phase 1). Phase 0 reads only '
  'current_position + difficulty_scalar.';

CREATE INDEX IF NOT EXISTS idx_climb_states_user
  ON public.climb_states (user_id);

ALTER TABLE public.climb_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own climb states"
  ON public.climb_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own climb states"
  ON public.climb_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own climb states"
  ON public.climb_states FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all climb states"
  ON public.climb_states FOR ALL
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- user_milestones — APPEND-ONLY trophy case (streak milestones, etc.).
-- Precedent: block_completions / practice_days (no UPDATE policy). Written
-- best-effort from recordSessionCompleted.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  milestone_type  TEXT NOT NULL,
  achieved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data            JSONB,

  -- One row per (user, milestone_type) — idempotent best-effort writes.
  UNIQUE (user_id, milestone_type)
);

COMMENT ON TABLE public.user_milestones IS
  'Append-only trophy case (streak milestones: 7/30/100/365, etc.). Written '
  'best-effort; one row per (user, milestone_type) makes writes idempotent.';

CREATE INDEX IF NOT EXISTS idx_user_milestones_user
  ON public.user_milestones (user_id, achieved_at DESC);

ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own milestones"
  ON public.user_milestones FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own milestones"
  ON public.user_milestones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy — append-only. DELETE allowed for admin/reset parity.
CREATE POLICY "Users can delete their own milestones"
  ON public.user_milestones FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- updated_at triggers — reuse the shared public.update_journey_timestamp() fn
-- (defined in 20260119000002). Append-only tables (rep_results,
-- user_milestones) have no updated_at and therefore no trigger.
-- ============================================================================
CREATE TRIGGER update_training_goals_timestamp
  BEFORE UPDATE ON public.training_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_journey_timestamp();

CREATE TRIGGER update_goal_enrollments_timestamp
  BEFORE UPDATE ON public.goal_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_journey_timestamp();

CREATE TRIGGER update_climb_states_timestamp
  BEFORE UPDATE ON public.climb_states
  FOR EACH ROW EXECUTE FUNCTION public.update_journey_timestamp();

-- ============================================================================
-- profiles ALTER — streak ceiling tier + freeze-token state (spec §8).
-- Precedent: 20260603000001 added last_practiced_on the same way.
-- practice_streak_days stays = the floor; practice_streak_ceiling = the ceiling.
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_state JSONB;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS practice_streak_ceiling INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.streak_freeze_state IS
  'Freeze-token + repair-window state (token count, repair-window-open-until). '
  'Policy shape is a founder decision (§14 Q4); JSONB holds any policy.';
COMMENT ON COLUMN public.profiles.practice_streak_ceiling IS
  'The progression-tier streak (full 6-min reps). practice_streak_days is the '
  'floor (showed-up reps).';
