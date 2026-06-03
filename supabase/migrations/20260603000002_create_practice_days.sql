-- Append-only practice log: one row per (user, day) the user practiced.
--
-- profiles.practice_streak_days + last_practiced_on hold only the CURRENT
-- streak (overwritten each practice), so they can't answer "longest streak",
-- "days practiced this month", "total practice days", or drive a calendar /
-- heatmap. This table is the durable journal those features derive from.
--
-- One idempotent insert per calendar day (PRIMARY KEY (user_id, practiced_on)
-- → re-practising the same day is a no-op via ON CONFLICT DO NOTHING). The
-- current-streak counter on profiles stays as-is; this is purely additive.
--
-- A "practice day" = the user completed a drill session (reached the summary),
-- the same trigger that bumps the streak counter — see
-- apps/backend/src/domains/progress/practice.service.ts.

CREATE TABLE IF NOT EXISTS public.practice_days (
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  practiced_on  DATE        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, practiced_on)
);

COMMENT ON TABLE public.practice_days IS
  'Append-only practice log — one row per (user, calendar day) the user '
  'completed a drill session. Source of truth for streak history, calendars, '
  'and total-days metrics. The current streak counter lives on profiles.';

-- Index for "this user''s practice history, newest first" (calendar, longest-
-- streak scans). The PK already covers (user_id, practiced_on) ascending; this
-- supports the common descending read.
CREATE INDEX IF NOT EXISTS idx_practice_days_user_date
  ON public.practice_days (user_id, practiced_on DESC);

-- RLS — same per-user pattern as block_completions / practice_progress.
ALTER TABLE public.practice_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own practice days"
  ON public.practice_days FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own practice days"
  ON public.practice_days FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy — the log is append-only. DELETE allowed for admin/reset
-- tooling parity with block_completions.
CREATE POLICY "Users can delete their own practice days"
  ON public.practice_days FOR DELETE
  USING (auth.uid() = user_id);
