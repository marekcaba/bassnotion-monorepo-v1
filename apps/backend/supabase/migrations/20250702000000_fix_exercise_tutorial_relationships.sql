-- Migration: Fix exercise-tutorial relationships
-- Story: 3.11 - Tutorial Page Data Flow (Fix)
-- Date: 2025-07-02
-- Issue: Exercise tutorial_id values were not properly set during initial migration

-- Fix the relationship: Blues Scale Mastery -> Billie Jean tutorial
UPDATE exercises 
SET tutorial_id = (SELECT id FROM tutorials WHERE slug = 'billie-jean')
WHERE title = 'Blues Scale Mastery' AND tutorial_id IS NULL;

-- Add more exercise-tutorial relationships if needed in the future
-- (Keeping the pattern from the original migration)

-- Modal Interchange Exercise -> Never Gonna Give You Up (if exists)
UPDATE exercises 
SET tutorial_id = (SELECT id FROM tutorials WHERE slug = 'never-gonna-give-you-up')
WHERE title = 'Modal Interchange Exercise' AND tutorial_id IS NULL;

-- Funk Slap Technique Builder -> Another One Bites the Dust (if exists)
UPDATE exercises 
SET tutorial_id = (SELECT id FROM tutorials WHERE slug = 'another-one-bites-dust')
WHERE title = 'Funk Slap Technique Builder' AND tutorial_id IS NULL;

-- II-V-I Progression Study -> Come Together (if exists)
UPDATE exercises 
SET tutorial_id = (SELECT id FROM tutorials WHERE slug = 'come-together')
WHERE title = 'II-V-I Progression Study' AND tutorial_id IS NULL;

-- Verify the relationships were created correctly
-- This will help debug future issues
DO $$
DECLARE
    tutorial_count INTEGER;
    linked_exercises INTEGER;
    total_exercises INTEGER;
BEGIN
    -- Count tutorials
    SELECT COUNT(*) INTO tutorial_count FROM tutorials WHERE is_active = true;
    
    -- Count linked exercises
    SELECT COUNT(*) INTO linked_exercises FROM exercises WHERE tutorial_id IS NOT NULL AND is_active = true;
    
    -- Count total exercises
    SELECT COUNT(*) INTO total_exercises FROM exercises WHERE is_active = true;
    
    RAISE NOTICE 'Migration completed:';
    RAISE NOTICE '- Active tutorials: %', tutorial_count;
    RAISE NOTICE '- Linked exercises: %', linked_exercises;
    RAISE NOTICE '- Total exercises: %', total_exercises;
    RAISE NOTICE '- Unlinked exercises: %', (total_exercises - linked_exercises);
END $$; 