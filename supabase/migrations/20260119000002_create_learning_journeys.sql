-- Create learning journeys system
-- Journeys are curated learning paths assigned to users based on assessment results

-- Learning journey templates (admin-defined)
CREATE TABLE IF NOT EXISTS public.learning_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,

  -- Targeting criteria for journey matching
  target_skill_level TEXT CHECK (target_skill_level IN ('beginner', 'intermediate', 'advanced')),
  target_goals TEXT[] DEFAULT '{}',      -- Goals this journey is good for
  target_techniques TEXT[] DEFAULT '{}', -- Techniques covered
  target_genres TEXT[] DEFAULT '{}',     -- Genres covered

  -- Journey content
  milestones JSONB NOT NULL DEFAULT '[]', -- Array of milestone objects
  estimated_weeks INTEGER,

  -- Display
  icon_url TEXT,
  color TEXT,                            -- Primary color for UI

  -- Status
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  is_featured BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User's assigned journey
CREATE TABLE IF NOT EXISTS public.user_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES public.learning_journeys(id) ON DELETE CASCADE,

  -- Progress tracking
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  current_milestone_index INTEGER DEFAULT 0,
  completed_milestones INTEGER[] DEFAULT '{}', -- Array of completed milestone indices
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- One active journey per user
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.learning_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_journeys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for learning_journeys (read-only for users, admin can modify)
CREATE POLICY "Active journeys are viewable by everyone"
  ON public.learning_journeys FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage journeys"
  ON public.learning_journeys FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for user_journeys
CREATE POLICY "Users can view their own journey"
  ON public.user_journeys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own journey progress"
  ON public.user_journeys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert user journeys"
  ON public.user_journeys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all user journeys"
  ON public.user_journeys FOR ALL
  USING (public.is_admin(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_learning_journeys_active ON public.learning_journeys(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_learning_journeys_skill ON public.learning_journeys(target_skill_level);
CREATE INDEX IF NOT EXISTS idx_user_journeys_user ON public.user_journeys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_journeys_status ON public.user_journeys(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_journey_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_learning_journeys_timestamp
  BEFORE UPDATE ON public.learning_journeys
  FOR EACH ROW EXECUTE FUNCTION public.update_journey_timestamp();

CREATE TRIGGER update_user_journeys_timestamp
  BEFORE UPDATE ON public.user_journeys
  FOR EACH ROW EXECUTE FUNCTION public.update_journey_timestamp();

-- Comments
COMMENT ON TABLE public.learning_journeys IS 'Curated learning paths with milestones';
COMMENT ON TABLE public.user_journeys IS 'User assigned journey and progress tracking';
COMMENT ON COLUMN public.learning_journeys.milestones IS 'JSON array of milestone objects: [{id, title, description, tutorials[], exercises[], order}]';

-- Seed initial journey templates
INSERT INTO public.learning_journeys (name, slug, description, target_skill_level, target_goals, target_techniques, target_genres, milestones, estimated_weeks, color)
VALUES
  (
    'Bass Fundamentals',
    'bass-fundamentals',
    'Master the essential techniques every bassist needs. Perfect for beginners who want a solid foundation.',
    'beginner',
    ARRAY['play_in_band', 'learn_songs', 'jam_for_fun'],
    ARRAY['fingerstyle'],
    ARRAY['rock', 'pop'],
    '[
      {"id": "m1", "title": "Getting Started", "description": "Learn to hold your bass, tune it, and play your first notes", "order": 1},
      {"id": "m2", "title": "Basic Rhythm", "description": "Understand quarter notes, eighth notes, and keeping time", "order": 2},
      {"id": "m3", "title": "Root Notes", "description": "Play along with chord progressions using root notes", "order": 3},
      {"id": "m4", "title": "Simple Grooves", "description": "Combine everything into your first complete bass lines", "order": 4}
    ]'::jsonb,
    6,
    '#3B82F6'
  ),
  (
    'Funk & Groove Master',
    'funk-groove-master',
    'Dive into the world of funk bass. Learn slap technique, syncopation, and pocket playing.',
    'intermediate',
    ARRAY['play_in_band', 'master_techniques'],
    ARRAY['fingerstyle', 'slap'],
    ARRAY['funk', 'rnb'],
    '[
      {"id": "m1", "title": "The Pocket", "description": "Learn to lock in with the drums and find the groove", "order": 1},
      {"id": "m2", "title": "Slap Basics", "description": "Thumb technique, ghost notes, and muted strings", "order": 2},
      {"id": "m3", "title": "Syncopation", "description": "Master off-beat rhythms that define funk", "order": 3},
      {"id": "m4", "title": "Classic Funk Lines", "description": "Learn iconic bass lines from funk legends", "order": 4},
      {"id": "m5", "title": "Creating Grooves", "description": "Develop your own funky bass lines", "order": 5}
    ]'::jsonb,
    8,
    '#8B5CF6'
  ),
  (
    'Advanced Techniques',
    'advanced-techniques',
    'Push your limits with advanced techniques like tapping, harmonics, and complex chord tones.',
    'advanced',
    ARRAY['master_techniques', 'create_music'],
    ARRAY['tapping', 'harmonics', 'slap'],
    ARRAY['jazz', 'fusion'],
    '[
      {"id": "m1", "title": "Harmonic Mastery", "description": "Natural and artificial harmonics across the fretboard", "order": 1},
      {"id": "m2", "title": "Two-Hand Tapping", "description": "Melodic tapping patterns and chord voicings", "order": 2},
      {"id": "m3", "title": "Advanced Slap", "description": "Double thumbing, strumming, and percussive techniques", "order": 3},
      {"id": "m4", "title": "Chord Tones", "description": "Navigate changes using arpeggios and extensions", "order": 4},
      {"id": "m5", "title": "Solo Bass", "description": "Create complete musical arrangements on bass alone", "order": 5}
    ]'::jsonb,
    12,
    '#F59E0B'
  )
ON CONFLICT (slug) DO NOTHING;
