-- Tutorial progress table for three-stage tracking (Understand → Practice → Apply)
-- Stores user progress through tutorials on /app/tutorials
CREATE TABLE IF NOT EXISTS public.tutorial_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutorial_id UUID NOT NULL,
  understood BOOLEAN DEFAULT FALSE,
  understood_at TIMESTAMPTZ,
  applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tutorial_id)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_tutorial_progress_user_tutorial
  ON public.tutorial_progress(user_id, tutorial_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_tutorial_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tutorial_progress_timestamp
  BEFORE UPDATE ON public.tutorial_progress
  FOR EACH ROW EXECUTE FUNCTION update_tutorial_progress_timestamp();

-- RLS Policies
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tutorial progress"
  ON public.tutorial_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tutorial progress"
  ON public.tutorial_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tutorial progress"
  ON public.tutorial_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
