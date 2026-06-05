-- Practice streak support.
--
-- profiles.practice_streak_days already exists (integer, default 0; see
-- 20250530144500_update_user_context_tables.sql). To compute and reset a streak
-- we also need the date the user last practiced. A streak day is "completed a
-- drill session" (reached the session summary); the backend PracticeService
-- bumps practice_streak_days and stamps last_practiced_on once per calendar day.
--
-- Nullable + IF NOT EXISTS so this is additive and idempotent — safe to re-run
-- via the deploy workflow. No RLS change: the column lives on profiles, whose
-- existing per-user policies already cover it, and the streak write happens
-- through the backend service-role client.

alter table public.profiles
  add column if not exists last_practiced_on date;

-- Index by last_practiced_on for any future "who's at risk of losing a streak"
-- batch jobs / reminders. Cheap, and matches the existing streak index style.
create index if not exists idx_profiles_last_practiced_on
  on public.profiles(last_practiced_on);
