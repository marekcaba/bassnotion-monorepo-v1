-- Add headline column to tutorials table for hero section headlines
-- This will be used as the main learning objective headline in tutorial hero sections
-- Different from title (song name) and description (detailed explanation)

-- Add headline column to tutorials table
ALTER TABLE tutorials ADD COLUMN IF NOT EXISTS headline TEXT;

-- Add comment explaining the new column
COMMENT ON COLUMN tutorials.headline IS 'Learning objective headline displayed prominently in tutorial hero sections (e.g., "Master Modal Interchange Techniques")';

-- Update existing tutorials with compelling headlines focused on learning objectives
UPDATE tutorials 
SET headline = CASE 
  WHEN slug = 'billie-jean' THEN 'Master Iconic Groove Techniques'
  WHEN slug = 'come-together' THEN 'Explore Psychedelic Bass Foundations'
  WHEN slug = 'never-gonna-give-you-up' THEN 'Decode Irresistible Bass Patterns'
  WHEN slug = 'superstition' THEN 'Unlock Funk Masterpiece Secrets'
  ELSE 'Elevate Your Bass Playing Skills'
END
WHERE headline IS NULL OR headline = '';

-- Create index for potential text searches on headlines
CREATE INDEX IF NOT EXISTS idx_tutorials_headline ON tutorials USING gin(to_tsvector('english', headline));

-- Drop and recreate the helper function to include headline
DROP FUNCTION IF EXISTS get_tutorials_with_exercise_count();
CREATE FUNCTION get_tutorials_with_exercise_count()
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  artist TEXT,
  youtube_url TEXT,
  difficulty TEXT,
  duration TEXT,
  description TEXT,
  headline TEXT,
  concepts TEXT[],
  thumbnail TEXT,
  rating DECIMAL(2,1),
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  creator_name TEXT,
  creator_channel_url TEXT,
  creator_avatar_url TEXT,
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
    t.headline,
    t.concepts,
    t.thumbnail,
    t.rating,
    t.is_active,
    t.created_at,
    t.updated_at,
    t.creator_name,
    t.creator_channel_url,
    t.creator_avatar_url,
    COUNT(e.id) as exercise_count
  FROM tutorials t
  LEFT JOIN exercises e ON t.id = e.tutorial_id
  WHERE t.is_active = true
  GROUP BY t.id, t.slug, t.title, t.artist, t.youtube_url, t.difficulty, t.duration, t.description, t.headline, t.concepts, t.thumbnail, t.rating, t.is_active, t.created_at, t.updated_at, t.creator_name, t.creator_channel_url, t.creator_avatar_url
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql; 