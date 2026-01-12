-- Fix: Resolve column reference ambiguity in migration function
-- Date: 2025-07-06

-- Drop and recreate the migration function with fixed variable names
DROP FUNCTION IF EXISTS migrate_all_exercises_to_musical_timing();

CREATE OR REPLACE FUNCTION migrate_all_exercises_to_musical_timing()
RETURNS TABLE(exercise_id UUID, exercise_title TEXT, status TEXT, note_count INTEGER) AS $$
DECLARE
    exercise_record RECORD;
    migrated_count INTEGER := 0;
    skipped_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    -- Process each exercise (use table aliases to avoid ambiguity)
    FOR exercise_record IN 
        SELECT e.id, e.title FROM exercises e WHERE e.is_active = true
    LOOP
        BEGIN
            -- Attempt migration
            PERFORM migrate_exercise_to_musical_timing(exercise_record.id);
            
            -- Return success status
            exercise_id := exercise_record.id;
            exercise_title := exercise_record.title;
            status := 'migrated';
            
            -- Get note count
            SELECT jsonb_array_length(e.notes) INTO note_count 
            FROM exercises e WHERE e.id = exercise_record.id;
            
            migrated_count := migrated_count + 1;
            RETURN NEXT;
            
        EXCEPTION WHEN OTHERS THEN
            -- Return error status
            exercise_id := exercise_record.id;
            exercise_title := exercise_record.title;
            status := 'error: ' || SQLERRM;
            note_count := 0;
            error_count := error_count + 1;
            RETURN NEXT;
        END;
    END LOOP;
    
    -- Log summary
    RAISE NOTICE 'Migration completed: % migrated, % errors', migrated_count, error_count;
END;
$$ LANGUAGE plpgsql;

-- Also fix the validation function for consistency
DROP FUNCTION IF EXISTS validate_musical_timing_migration();

CREATE OR REPLACE FUNCTION validate_musical_timing_migration()
RETURNS TABLE(exercise_id UUID, exercise_title TEXT, has_musical_timing BOOLEAN, note_count INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.title,
        CASE 
            WHEN jsonb_array_length(e.notes) = 0 THEN TRUE -- Empty notes is valid
            ELSE (
                SELECT bool_and(
                    note_item ? 'duration' AND 
                    note_item ? 'position' AND
                    (note_item->>'duration') ~ '^(whole|half|quarter|eighth|sixteenth|thirty-second|dotted-(half|quarter|eighth|sixteenth)|triplet-(quarter|eighth))$'
                )
                FROM jsonb_array_elements(e.notes) AS note_item
            )
        END AS has_musical_timing,
        jsonb_array_length(e.notes) AS note_count
    FROM exercises e
    WHERE e.is_active = true
    ORDER BY e.title;
END;
$$ LANGUAGE plpgsql;