-- Migration: Add Musical Timing System to Exercises
-- Date: 2025-07-06
-- Story: Replace millisecond-based timing with musical note values and positions
-- 
-- BEFORE: {"duration": 250, "timestamp": 0}
-- AFTER:  {"duration": "sixteenth", "position": {"measure": 1, "beat": 1, "subdivision": 0}}

-- Step 1: Add new musical timing columns to exercises table
ALTER TABLE exercises 
ADD COLUMN time_signature JSONB DEFAULT '{"numerator": 4, "denominator": 4}'::jsonb;

-- Add comment explaining the new column
COMMENT ON COLUMN exercises.time_signature IS 'Musical time signature (e.g., {"numerator": 4, "denominator": 4} for 4/4 time)';

-- Step 2: Create helper function to convert milliseconds to musical duration
CREATE OR REPLACE FUNCTION ms_to_musical_duration(duration_ms INTEGER, bpm INTEGER DEFAULT 120)
RETURNS TEXT AS $$
DECLARE
    quarter_note_ms NUMERIC;
    scaled_duration NUMERIC;
BEGIN
    -- Calculate milliseconds per quarter note
    quarter_note_ms := (60.0 * 1000.0) / bpm;
    
    -- Scale the duration
    scaled_duration := duration_ms::NUMERIC / quarter_note_ms;
    
    -- Map to closest musical duration
    CASE 
        WHEN scaled_duration <= 0.125 THEN RETURN 'thirty-second';
        WHEN scaled_duration <= 0.25 THEN RETURN 'sixteenth';
        WHEN scaled_duration <= 0.375 THEN RETURN 'dotted-sixteenth';
        WHEN scaled_duration <= 0.5 THEN RETURN 'eighth';
        WHEN scaled_duration <= 0.75 THEN RETURN 'dotted-eighth';
        WHEN scaled_duration <= 1.0 THEN RETURN 'quarter';
        WHEN scaled_duration <= 1.5 THEN RETURN 'dotted-quarter';
        WHEN scaled_duration <= 2.0 THEN RETURN 'half';
        WHEN scaled_duration <= 3.0 THEN RETURN 'dotted-half';
        ELSE RETURN 'whole';
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Create helper function to convert timestamp to musical position
CREATE OR REPLACE FUNCTION ms_to_musical_position(timestamp_ms INTEGER, time_sig JSONB, bpm INTEGER DEFAULT 120)
RETURNS JSONB AS $$
DECLARE
    beats_per_measure INTEGER;
    ms_per_beat NUMERIC;
    total_beats NUMERIC;
    measure_num INTEGER;
    beat_in_measure INTEGER;
    subdivision INTEGER;
    beat_fraction NUMERIC;
BEGIN
    -- Extract beats per measure from time signature
    beats_per_measure := (time_sig->>'numerator')::INTEGER;
    
    -- Calculate milliseconds per beat
    ms_per_beat := (60.0 * 1000.0) / bpm;
    
    -- Convert timestamp to total beats
    total_beats := timestamp_ms::NUMERIC / ms_per_beat;
    
    -- Calculate measure (1-based)
    measure_num := FLOOR(total_beats / beats_per_measure) + 1;
    
    -- Calculate beat within measure (1-based)
    beat_in_measure := FLOOR(total_beats % beats_per_measure) + 1;
    
    -- Calculate subdivision (0-3 for 16th note subdivisions)
    beat_fraction := total_beats - FLOOR(total_beats);
    subdivision := LEAST(FLOOR(beat_fraction * 4), 3);
    
    RETURN jsonb_build_object(
        'measure', measure_num,
        'beat', beat_in_measure,
        'subdivision', subdivision
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Create function to migrate exercise notes to musical timing
CREATE OR REPLACE FUNCTION migrate_exercise_to_musical_timing(exercise_id UUID)
RETURNS VOID AS $$
DECLARE
    exercise_row exercises%ROWTYPE;
    note_item JSONB;
    new_notes JSONB[] DEFAULT '{}';
    updated_note JSONB;
BEGIN
    -- Get the exercise
    SELECT * INTO exercise_row FROM exercises WHERE id = exercise_id;
    
    -- Skip if exercise doesn't exist or has no notes
    IF exercise_row.id IS NULL OR exercise_row.notes IS NULL THEN
        RETURN;
    END IF;
    
    -- Check if already migrated (first note has 'position' field)
    IF jsonb_array_length(exercise_row.notes) > 0 AND 
       (exercise_row.notes->0) ? 'position' THEN
        RAISE NOTICE 'Exercise % already migrated', exercise_id;
        RETURN;
    END IF;
    
    -- Process each note in the array
    FOR note_item IN SELECT * FROM jsonb_array_elements(exercise_row.notes)
    LOOP
        -- Skip notes without required legacy timing
        IF NOT (note_item ? 'timestamp' AND note_item ? 'duration') THEN
            CONTINUE;
        END IF;
        
        -- Create updated note with musical timing
        updated_note := note_item ||
            jsonb_build_object(
                'duration', ms_to_musical_duration(
                    (note_item->>'duration')::INTEGER, 
                    exercise_row.bpm
                ),
                'position', ms_to_musical_position(
                    (note_item->>'timestamp')::INTEGER,
                    exercise_row.time_signature,
                    exercise_row.bpm
                )
            );
        
        -- Add to new notes array
        new_notes := new_notes || updated_note;
    END LOOP;
    
    -- Update the exercise with new notes
    UPDATE exercises 
    SET 
        notes = to_jsonb(new_notes),
        updated_at = NOW()
    WHERE id = exercise_id;
    
    RAISE NOTICE 'Migrated exercise %: % notes converted', exercise_id, array_length(new_notes, 1);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create migration function for all exercises
CREATE OR REPLACE FUNCTION migrate_all_exercises_to_musical_timing()
RETURNS TABLE(exercise_id UUID, title TEXT, status TEXT, note_count INTEGER) AS $$
DECLARE
    exercise_record RECORD;
    migrated_count INTEGER := 0;
    skipped_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    -- Process each exercise
    FOR exercise_record IN SELECT id, title FROM exercises WHERE is_active = true
    LOOP
        BEGIN
            -- Attempt migration
            PERFORM migrate_exercise_to_musical_timing(exercise_record.id);
            
            -- Return success status
            exercise_id := exercise_record.id;
            title := exercise_record.title;
            status := 'migrated';
            
            -- Get note count
            SELECT jsonb_array_length(notes) INTO note_count 
            FROM exercises WHERE id = exercise_record.id;
            
            migrated_count := migrated_count + 1;
            RETURN NEXT;
            
        EXCEPTION WHEN OTHERS THEN
            -- Return error status
            exercise_id := exercise_record.id;
            title := exercise_record.title;
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

-- Step 6: Create validation function
CREATE OR REPLACE FUNCTION validate_musical_timing_migration()
RETURNS TABLE(exercise_id UUID, title TEXT, has_musical_timing BOOLEAN, note_count INTEGER) AS $$
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

-- Step 7: Add indexes for musical timing queries
CREATE INDEX idx_exercises_time_signature ON exercises USING gin(time_signature);

-- Add index for notes with musical timing (expression index)
CREATE INDEX idx_exercises_notes_musical_timing ON exercises 
USING gin((notes)) 
WHERE notes IS NOT NULL AND jsonb_array_length(notes) > 0;

-- Add comment for the migration
COMMENT ON FUNCTION migrate_all_exercises_to_musical_timing() IS 
'Migrates all exercises from millisecond-based timing to musical note durations and positions. 
Preserves original timestamp/duration fields for backwards compatibility.';

COMMENT ON FUNCTION validate_musical_timing_migration() IS 
'Validates that all exercises have proper musical timing data after migration.';

-- Final step: Show current status before migration
DO $$
DECLARE
    total_exercises INTEGER;
    exercises_with_notes INTEGER;
    migration_ready INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_exercises FROM exercises WHERE is_active = true;
    
    SELECT COUNT(*) INTO exercises_with_notes 
    FROM exercises 
    WHERE is_active = true AND jsonb_array_length(notes) > 0;
    
    SELECT COUNT(*) INTO migration_ready
    FROM exercises 
    WHERE is_active = true 
      AND jsonb_array_length(notes) > 0
      AND NOT (notes->0) ? 'position'; -- Not already migrated
    
    RAISE NOTICE 'Musical Timing Migration Ready:';
    RAISE NOTICE '- Total active exercises: %', total_exercises;
    RAISE NOTICE '- Exercises with notes: %', exercises_with_notes;
    RAISE NOTICE '- Ready for migration: %', migration_ready;
    RAISE NOTICE '';
    RAISE NOTICE 'To migrate all exercises, run:';
    RAISE NOTICE 'SELECT * FROM migrate_all_exercises_to_musical_timing();';
    RAISE NOTICE '';
    RAISE NOTICE 'To validate migration, run:';
    RAISE NOTICE 'SELECT * FROM validate_musical_timing_migration();';
END $$;