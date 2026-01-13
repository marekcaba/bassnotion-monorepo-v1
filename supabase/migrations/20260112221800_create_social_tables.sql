-- =====================================================
-- Migration: Create Social Tables (Likes & Favorites)
-- Description: Public likes and private favorites for exercises
-- =====================================================

-- =====================================================
-- EXERCISE LIKES TABLE (Public - visible to everyone)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.exercise_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Ensure one like per user per exercise
    CONSTRAINT exercise_likes_unique_user_exercise UNIQUE(exercise_id, user_id)
);

-- Add comment for documentation
COMMENT ON TABLE public.exercise_likes IS 'Public likes on exercises - visible to everyone for like counts';

-- =====================================================
-- EXERCISE FAVORITES TABLE (Private - only visible to owner)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.exercise_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Ensure one favorite per user per exercise
    CONSTRAINT exercise_favorites_unique_user_exercise UNIQUE(exercise_id, user_id)
);

-- Add comment for documentation
COMMENT ON TABLE public.exercise_favorites IS 'Private favorites - only visible to the owning user for bookmarking';

-- =====================================================
-- DENORMALIZED LIKE COUNT ON EXERCISES (for performance)
-- =====================================================
ALTER TABLE public.exercises
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.exercises.like_count IS 'Denormalized like count for fast queries - maintained by trigger';

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Index for checking if user liked an exercise (fast lookup)
CREATE INDEX IF NOT EXISTS idx_exercise_likes_user_exercise
ON public.exercise_likes(user_id, exercise_id);

-- Index for getting all likes for an exercise
CREATE INDEX IF NOT EXISTS idx_exercise_likes_exercise_id
ON public.exercise_likes(exercise_id);

-- Index for getting user's likes list (sorted by most recent)
CREATE INDEX IF NOT EXISTS idx_exercise_likes_user_created
ON public.exercise_likes(user_id, created_at DESC);

-- Index for checking if user favorited an exercise (fast lookup)
CREATE INDEX IF NOT EXISTS idx_exercise_favorites_user_exercise
ON public.exercise_favorites(user_id, exercise_id);

-- Index for getting user's favorites list (sorted by most recent)
CREATE INDEX IF NOT EXISTS idx_exercise_favorites_user_created
ON public.exercise_favorites(user_id, created_at DESC);

-- Index for popular exercises by like count
CREATE INDEX IF NOT EXISTS idx_exercises_like_count
ON public.exercises(like_count DESC) WHERE is_active = true;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.exercise_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_favorites ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- LIKES POLICIES (Public Read, Authenticated Write)
-- =====================================================

-- Anyone can view likes (needed for count display)
CREATE POLICY "exercise_likes_select_public"
ON public.exercise_likes
FOR SELECT
USING (true);

-- Authenticated users can insert their own likes
CREATE POLICY "exercise_likes_insert_authenticated"
ON public.exercise_likes
FOR INSERT
WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
);

-- Users can only delete their own likes (unlike)
CREATE POLICY "exercise_likes_delete_own"
ON public.exercise_likes
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- FAVORITES POLICIES (Private - Only owner can access)
-- =====================================================

-- Users can only see their own favorites (PRIVATE)
CREATE POLICY "exercise_favorites_select_own"
ON public.exercise_favorites
FOR SELECT
USING (auth.uid() = user_id);

-- Authenticated users can insert their own favorites
CREATE POLICY "exercise_favorites_insert_authenticated"
ON public.exercise_favorites
FOR INSERT
WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
);

-- Users can only delete their own favorites (unfavorite)
CREATE POLICY "exercise_favorites_delete_own"
ON public.exercise_favorites
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGER FUNCTION: Auto-update like_count on exercises
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_exercise_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.exercises
        SET like_count = like_count + 1
        WHERE id = NEW.exercise_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.exercises
        SET like_count = GREATEST(like_count - 1, 0)
        WHERE id = OLD.exercise_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_exercise_like_count IS 'Maintains denormalized like_count on exercises table';

-- Create trigger to auto-update like count
DROP TRIGGER IF EXISTS exercise_likes_count_trigger ON public.exercise_likes;
CREATE TRIGGER exercise_likes_count_trigger
AFTER INSERT OR DELETE ON public.exercise_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_exercise_like_count();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON public.exercise_likes TO authenticated;
GRANT INSERT, DELETE ON public.exercise_likes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.exercise_favorites TO authenticated;

-- Grant read access to anon for like counts (public data)
GRANT SELECT ON public.exercise_likes TO anon;
