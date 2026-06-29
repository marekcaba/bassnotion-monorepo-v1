-- Migration: gym RECORDING SUBMISSIONS — admin-assigned, student-delivered takes.
-- Date: 2026-06-29
--
-- THE MODEL (deliberately NOT "store every gym take"):
--   • The open gym (Scales tool) is FREE practice — the student plays, sees their
--     timing + pitch grade in the moment, but NOTHING is stored. Ephemeral.
--   • RECORDINGS are an admin-assigned DELIVERABLE. Each billing cycle the admin
--     creates a `recording_assignment` ("submit Funky Groove @ 90bpm"); the student
--     plays it in record mode and SUBMITS one take. THAT take's grade + a tiny Opus
--     audio clip is stored as a `take_result`. A few per cycle, intentional, curated.
--   • The user HISTORY combines rep_results (the goal-side progress) with these
--     submitted recordings.
--
-- Storage is small + controlled BECAUSE it's not open-upload from casual play —
-- only deliberate, admin-gated submissions land audio. Audio lives in a PRIVATE
-- bucket (signed-URL-on-read only), with a hard bucket-level size cap as defence in
-- depth beyond the app-layer check.

-- ============================================================================
-- recording_assignments — an admin-created "submit this" task for a billing cycle.
-- The student sees the active assignment in the gym; submitting fulfils it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recording_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who must deliver it. (A future variant could assign to a class/cohort; for now
  -- one row per assigned student keeps RLS simple.)
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- the admin
  title           TEXT NOT NULL,                 -- "Submit Funky Groove, 90 BPM, in key"
  -- What to play. `station` mirrors the equipment station; the exercise + params are
  -- a snapshot so the assignment is self-describing even if the library changes.
  station         TEXT NOT NULL DEFAULT 'scales',
  exercise_id     UUID REFERENCES public.gym_exercises(id) ON DELETE SET NULL,
  exercise_name   TEXT,
  scale_key       TEXT,
  tempo_bpm       INTEGER,
  -- The 30-day window this deliverable belongs to (the student's billing cycle).
  cycle_start     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.recording_assignments IS
  'Admin-assigned recording deliverables. The student fulfils one by SUBMITTING a '
  'take (→ take_results). Open gym practice is NOT stored; only these submissions.';

CREATE INDEX IF NOT EXISTS idx_recording_assignments_user
  ON public.recording_assignments (user_id, created_at DESC);

ALTER TABLE public.recording_assignments ENABLE ROW LEVEL SECURITY;

-- Students read their OWN assignments. Writes (create/delete) are admin-only via the
-- service role (no anon/authenticated INSERT policy = deny for normal users).
CREATE POLICY "Users read their own recording assignments"
  ON public.recording_assignments FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- take_results — a SUBMITTED, graded take with its tiny audio clip.
-- Binds to user_id directly (equipment is OPEN practice — no goal_enrollment, unlike
-- rep_results). Append-only history. audio_path points into the private bucket.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.take_results (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The assignment this take fulfils (nullable — a future self-submit path may omit it).
  recording_assignment_id UUID REFERENCES public.recording_assignments(id) ON DELETE SET NULL,

  station                TEXT NOT NULL DEFAULT 'scales',
  exercise_name          TEXT,
  scale_key              TEXT,
  tempo_bpm              INTEGER,

  -- The grade (0-100 each) + the raw stats behind it, for the history trend.
  timing_score           INTEGER,                -- hits/target × 100
  pitch_score            INTEGER,                -- right notes/target × 100
  jitter_ms              DOUBLE PRECISION,
  offset_ms              DOUBLE PRECISION,
  note_count             INTEGER,

  -- Path into the PRIVATE `user-take-audio` bucket (read only via a backend-minted
  -- signed URL). NULL if a take was graded but no audio kept.
  audio_path             TEXT,
  audio_bytes            INTEGER,                -- recorded size, for quota/auditing

  submitted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.take_results IS
  'Submitted, graded gym takes (the admin-requested deliverables). Append-only. '
  'audio_path → private user-take-audio bucket, read via signed URL. Open gym '
  'practice is NOT stored here — only deliberate submissions.';

CREATE INDEX IF NOT EXISTS idx_take_results_user
  ON public.take_results (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_take_results_assignment
  ON public.take_results (recording_assignment_id, submitted_at DESC);

ALTER TABLE public.take_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own take results"
  ON public.take_results FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT is done by the backend (service role) AFTER it validates ownership, the
-- assignment, the file size + type, and stores the audio — so there is NO direct
-- authenticated INSERT policy (the client never writes this table directly).
CREATE POLICY "Users delete their own take results"
  ON public.take_results FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Private bucket for the submitted take audio.
-- ============================================================================
INSERT INTO storage.buckets (
  id, name, public, avif_autodetection, file_size_limit, allowed_mime_types
)
VALUES (
  'user-take-audio',
  'user-take-audio',
  false,                              -- PRIVATE: no public URL; signed-URL reads only
  false,
  2097152,                           -- 2MB HARD CAP at the storage layer (defence in
                                     -- depth: even if the app check is bypassed, Supabase
                                     -- rejects an oversized take). A ~30s Opus clip is
                                     -- ~250-500KB, so 2MB is generous headroom + a wall.
  ARRAY['audio/ogg', 'audio/webm', 'application/octet-stream']
) ON CONFLICT (id) DO NOTHING;

-- No anon/authenticated SELECT/INSERT policy on this bucket on purpose:
--   • READS  → only via backend-minted signed URLs (service role bypasses RLS).
--   • WRITES → only via the proxied submit endpoint (service role, AuthGuard +
--     ownership + rate-limit + size/type checks).
-- Absence of a policy = deny for non-service-role roles.
