-- Migration: Add title_highlight_words to tutorials
-- Feature: Gradient-highlighted words in tutorial titles for Act 1
-- Date: 2026-02-02

-- Add title_highlight_words column for styling specific words in titles
ALTER TABLE tutorials
ADD COLUMN IF NOT EXISTS title_highlight_words TEXT[] DEFAULT '{}';

-- Add comment to explain the field
COMMENT ON COLUMN tutorials.title_highlight_words IS 'Words in the title to highlight with gradient styling (case-insensitive match)';

-- Drop and recreate the function to include the new column
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
    understand_questions JSONB,
    title_highlight_words TEXT[]
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
        t.understand_questions,
        t.title_highlight_words
    FROM tutorials t
    LEFT JOIN exercises e ON t.id = e.tutorial_id AND e.is_active = true
    WHERE t.is_active = true
    GROUP BY t.id, t.slug, t.title, t.artist, t.youtube_url, t.difficulty,
             t.duration, t.description, t.concepts, t.thumbnail, t.rating,
             t.is_active, t.created_at, t.updated_at,
             t.understand_video_url, t.understand_video_library_id,
             t.understand_headline, t.understand_questions, t.title_highlight_words
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
