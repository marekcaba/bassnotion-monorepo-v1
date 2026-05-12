-- Practice progress: tracks per-exercise completion count and last tempo
-- Used by the hybrid localStorage + Supabase sync in usePracticeCompletions hook

CREATE TABLE public.practice_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutorial_id UUID NOT NULL,
  exercise_id TEXT NOT NULL,
  completion_count INTEGER NOT NULL DEFAULT 0
    CHECK (completion_count >= 0 AND completion_count <= 10),
  last_tempo_bpm INTEGER
    CHECK (last_tempo_bpm IS NULL OR (last_tempo_bpm >= 20 AND last_tempo_bpm <= 300)),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, tutorial_id, exercise_id)
);

-- Index for fast lookups by user + tutorial
CREATE INDEX idx_practice_progress_user_tutorial
  ON public.practice_progress(user_id, tutorial_id);

-- RLS policies
ALTER TABLE public.practice_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own progress"
  ON public.practice_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.practice_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.practice_progress FOR UPDATE
  USING (auth.uid() = user_id);
