-- Migration: Create tutorials table and add tutorial_id to exercises
-- Story: 3.11 - Tutorial Page Data Flow
-- Date: 2025-06-27

-- Create tutorials table
CREATE TABLE tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- 'billie-jean', 'never-gonna-give-you-up'
  title TEXT NOT NULL,                 -- 'Billie Jean'
  artist TEXT NOT NULL,                -- 'Michael Jackson'
  youtube_url TEXT,                    -- YouTube video URL
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  duration TEXT,                       -- '12 min'
  description TEXT,
  concepts TEXT[],                     -- ['Rhythm Fundamentals', 'Groove Patterns']
  thumbnail TEXT,                      -- '🕺'
  rating DECIMAL(2,1),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add tutorial_id to exercises table (nullable to maintain backward compatibility)
ALTER TABLE exercises ADD COLUMN tutorial_id UUID REFERENCES tutorials(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_tutorials_slug ON tutorials(slug);
CREATE INDEX idx_tutorials_active ON tutorials(is_active);
CREATE INDEX idx_exercises_tutorial_id ON exercises(tutorial_id);

-- Enable Row Level Security (RLS)
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;

-- Create policies for tutorials
CREATE POLICY "Allow public read access to active tutorials" ON tutorials
    FOR SELECT USING (is_active = true);

CREATE POLICY "Allow authenticated users to create tutorials" ON tutorials
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update tutorials" ON tutorials
    FOR UPDATE WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete tutorials" ON tutorials
    FOR DELETE USING (auth.role() = 'authenticated');

-- Insert seed data for existing mock tutorials
INSERT INTO tutorials (slug, title, artist, youtube_url, difficulty, duration, description, concepts, thumbnail, rating) VALUES
(
    'never-gonna-give-you-up',
    'Never Gonna Give You Up',
    'Rick Astley',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'intermediate',
    '15 min',
    'Learn modal interchange and tension & release concepts through this classic 80s hit.',
    ARRAY['Modal Interchange', 'Tension & Release', 'II-V-I Variations'],
    '🎵',
    4.8
),
(
    'billie-jean',
    'Billie Jean',
    'Michael Jackson',
    'https://www.youtube.com/watch?v=Zi_XLOBDo_Y',
    'beginner',
    '12 min',
    'Master the iconic bassline with focus on rhythm and groove fundamentals.',
    ARRAY['Rhythm Fundamentals', 'Groove Patterns', 'Syncopation'],
    '🕺',
    4.9
),
(
    'come-together',
    'Come Together',
    'The Beatles',
    'https://www.youtube.com/watch?v=45cYwDMibGo',
    'advanced',
    '20 min',
    'Explore complex rhythmic patterns and advanced bass techniques.',
    ARRAY['Complex Rhythms', 'Chromatic Runs', 'Advanced Techniques'],
    '🎸',
    4.7
),
(
    'another-one-bites-dust',
    'Another One Bites the Dust',
    'Queen',
    'https://www.youtube.com/watch?v=rY0WxgSXdEE',
    'intermediate',
    '18 min',
    'Learn the legendary bassline focusing on precision and timing.',
    ARRAY['Precision Playing', 'Timing', 'Rock Fundamentals'],
    '👑',
    4.8
);

-- Link existing exercises to appropriate tutorials
-- Modal Interchange Exercise -> Never Gonna Give You Up (modal concepts)
UPDATE exercises 
SET tutorial_id = (SELECT id FROM tutorials WHERE slug = 'never-gonna-give-you-up')
WHERE title = 'Modal Interchange Exercise';

-- Blues Scale Mastery -> Billie Jean (rhythm fundamentals)
UPDATE exercises 
SET tutorial_id = (SELECT id FROM tutorials WHERE slug = 'billie-jean')
WHERE title = 'Blues Scale Mastery';

-- Funk Slap Technique Builder -> Another One Bites the Dust (precision playing)
UPDATE exercises 
SET tutorial_id = (SELECT id FROM tutorials WHERE slug = 'another-one-bites-dust')
WHERE title = 'Funk Slap Technique Builder';

-- II-V-I Progression Study -> Come Together (advanced techniques)
UPDATE exercises 
SET tutorial_id = (SELECT id FROM tutorials WHERE slug = 'come-together')
WHERE title = 'II-V-I Progression Study';

-- Create function to get tutorials with exercise count
CREATE OR REPLACE FUNCTION get_tutorials_with_exercise_count()
RETURNS TABLE (
    id UUID,
    slug TEXT,
    title TEXT,
    artist TEXT,
    youtube_url TEXT,
    difficulty TEXT,
    duration TEXT,
    description TEXT,
    concepts TEXT[],
    thumbnail TEXT,
    rating DECIMAL(2,1),
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    exercise_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.slug,
        t.title,
        t.artist,
        t.youtube_url,
        t.difficulty,
        t.duration,
        t.description,
        t.concepts,
        t.thumbnail,
        t.rating,
        t.is_active,
        t.created_at,
        t.updated_at,
        COUNT(e.id) as exercise_count
    FROM tutorials t
    LEFT JOIN exercises e ON t.id = e.tutorial_id AND e.is_active = true
    WHERE t.is_active = true
    GROUP BY t.id, t.slug, t.title, t.artist, t.youtube_url, t.difficulty, 
             t.duration, t.description, t.concepts, t.thumbnail, t.rating, 
             t.is_active, t.created_at, t.updated_at
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 