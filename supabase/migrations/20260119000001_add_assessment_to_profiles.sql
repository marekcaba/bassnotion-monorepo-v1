-- Add assessment/onboarding columns to profiles table
-- These columns store the results of the entrance assessment quiz

-- Skill level determined by knowledge questions
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced'));

-- Assessment completion tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS assessment_completed BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS assessment_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assessment_score INTEGER CHECK (assessment_score >= 0 AND assessment_score <= 100);

-- User's primary learning goal
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS primary_goal TEXT CHECK (primary_goal IN (
  'play_in_band',
  'learn_songs',
  'master_techniques',
  'create_music',
  'jam_for_fun'
));

-- User's preferred techniques and genres (arrays for multi-select)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_techniques TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_genres TEXT[] DEFAULT '{}';

-- Indexes for filtering users by skill level and assessment status
CREATE INDEX IF NOT EXISTS idx_profiles_skill_level ON public.profiles(skill_level) WHERE skill_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_assessment ON public.profiles(assessment_completed);
CREATE INDEX IF NOT EXISTS idx_profiles_primary_goal ON public.profiles(primary_goal) WHERE primary_goal IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN public.profiles.skill_level IS 'User skill level determined by assessment quiz (beginner, intermediate, advanced)';
COMMENT ON COLUMN public.profiles.assessment_completed IS 'Whether user has completed the entrance assessment';
COMMENT ON COLUMN public.profiles.assessment_completed_at IS 'Timestamp when assessment was completed';
COMMENT ON COLUMN public.profiles.assessment_score IS 'Percentage score from assessment quiz (0-100)';
COMMENT ON COLUMN public.profiles.primary_goal IS 'User primary learning goal selected during assessment';
COMMENT ON COLUMN public.profiles.preferred_techniques IS 'Array of preferred bass techniques (fingerstyle, slap, pick, tapping, harmonics)';
COMMENT ON COLUMN public.profiles.preferred_genres IS 'Array of preferred music genres (funk, rock, jazz, metal, rnb, gospel, pop)';

-- Helper function to check if user has completed assessment
CREATE OR REPLACE FUNCTION public.has_completed_assessment(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND assessment_completed = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.has_completed_assessment(UUID) TO authenticated;
