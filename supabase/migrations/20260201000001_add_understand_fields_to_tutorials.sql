-- Migration: Add Act 1 Understand fields to tutorials
-- Feature: Interactive video-first learning experience
-- Date: 2026-02-01

-- Add understand video fields for Act 1
-- These enable the video-first learning experience with interactive quizzes
ALTER TABLE tutorials
ADD COLUMN IF NOT EXISTS understand_video_url TEXT,
ADD COLUMN IF NOT EXISTS understand_video_library_id TEXT,
ADD COLUMN IF NOT EXISTS understand_headline TEXT,
ADD COLUMN IF NOT EXISTS understand_questions JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the understand_questions structure
COMMENT ON COLUMN tutorials.understand_video_url IS 'Bunny Stream video ID for the understand/explanation video';
COMMENT ON COLUMN tutorials.understand_video_library_id IS 'Bunny Stream library ID';
COMMENT ON COLUMN tutorials.understand_headline IS 'One-line pitch shown below title (e.g., "Before you play anything, you need to know where your notes live.")';
COMMENT ON COLUMN tutorials.understand_questions IS 'Interactive quiz questions shown during video. Structure: [{id, question, options: [{id, text}], correct_option_id, timestamp?}]';

-- Create index for tutorials with understand content (for filtering)
CREATE INDEX IF NOT EXISTS idx_tutorials_has_understand_video
ON tutorials ((understand_video_url IS NOT NULL));

-- Drop and recreate the function (PostgreSQL can't change return type with CREATE OR REPLACE)
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
    concepts TEXT[],
    thumbnail TEXT,
    rating DECIMAL(2,1),
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    exercise_count BIGINT,
    understand_video_url TEXT,
    understand_video_library_id TEXT,
    understand_headline TEXT,
    understand_questions JSONB
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
        COUNT(e.id) as exercise_count,
        t.understand_video_url,
        t.understand_video_library_id,
        t.understand_headline,
        t.understand_questions
    FROM tutorials t
    LEFT JOIN exercises e ON t.id = e.tutorial_id AND e.is_active = true
    WHERE t.is_active = true
    GROUP BY t.id, t.slug, t.title, t.artist, t.youtube_url, t.difficulty,
             t.duration, t.description, t.concepts, t.thumbnail, t.rating,
             t.is_active, t.created_at, t.updated_at,
             t.understand_video_url, t.understand_video_library_id,
             t.understand_headline, t.understand_questions
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
