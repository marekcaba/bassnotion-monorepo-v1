-- Migration: Update get_tutorials_with_exercise_count function to include creator fields
-- Story: YouTube Widget Creator Attribution
-- Date: 2025-06-27

-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS get_tutorials_with_exercise_count();

-- Create the updated function with creator fields in the return type and query
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
    LEFT JOIN exercises e ON t.id = e.tutorial_id AND e.is_active = true
    WHERE t.is_active = true
    GROUP BY t.id, t.slug, t.title, t.artist, t.youtube_url, t.difficulty, 
             t.duration, t.description, t.concepts, t.thumbnail, t.rating, 
             t.is_active, t.created_at, t.updated_at, t.creator_name, 
             t.creator_channel_url, t.creator_avatar_url
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 