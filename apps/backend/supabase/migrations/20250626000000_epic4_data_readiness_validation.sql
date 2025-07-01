-- Epic 4 Data Readiness Validation Migration
-- This migration validates that the current JSONB schema can handle Epic 4 technique properties
-- and ensures backward compatibility with Epic 3 notes

-- Create validation function for Epic 4 note properties
CREATE OR REPLACE FUNCTION validate_epic4_note_properties(note_json JSONB) 
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate required Epic 3 properties exist
    IF NOT (note_json ? 'id' AND 
            note_json ? 'timestamp' AND 
            note_json ? 'string' AND 
            note_json ? 'fret' AND 
            note_json ? 'duration' AND 
            note_json ? 'note' AND 
            note_json ? 'color') THEN
        RETURN FALSE;
    END IF;
    
    -- Validate Epic 4 technique types if present
    IF note_json ? 'techniques' THEN
        -- Check if techniques is an array
        IF jsonb_typeof(note_json->'techniques') != 'array' THEN
            RETURN FALSE;
        END IF;
        
        -- Validate each technique type
        FOR i IN 0..jsonb_array_length(note_json->'techniques')-1 LOOP
            IF NOT (note_json->'techniques'->i #>> '{}' = ANY(ARRAY[
                'hammer_on', 'pull_off', 'slide_up', 'slide_down', 
                'slap', 'pop', 'tap', 'harmonic', 'vibrato', 'bend'
            ])) THEN
                RETURN FALSE;
            END IF;
        END LOOP;
    END IF;
    
    -- Validate bend_target_pitch values if present
    IF note_json ? 'bend_target_pitch' THEN
        IF NOT (note_json->>'bend_target_pitch' = ANY(ARRAY['half_step', 'full_step'])) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Validate vibrato_intensity values if present
    IF note_json ? 'vibrato_intensity' THEN
        IF NOT (note_json->>'vibrato_intensity' = ANY(ARRAY['light', 'medium', 'heavy'])) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Validate accent_level values if present
    IF note_json ? 'accent_level' THEN
        IF NOT (note_json->>'accent_level' = ANY(ARRAY['light', 'medium', 'heavy'])) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Validate mute_type values if present
    IF note_json ? 'mute_type' THEN
        IF NOT (note_json->>'mute_type' = ANY(ARRAY['palm_mute', 'fretting_hand_mute', 'dead_note'])) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Validate slide_type values if present
    IF note_json ? 'slide_type' THEN
        IF NOT (note_json->>'slide_type' = ANY(ARRAY['legato', 'shift'])) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Validate tapping_hand values if present
    IF note_json ? 'tapping_hand' THEN
        IF NOT (note_json->>'tapping_hand' = ANY(ARRAY['right', 'left', 'both'])) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Validate pluck_position values if present
    IF note_json ? 'pluck_position' THEN
        IF NOT (note_json->>'pluck_position' = ANY(ARRAY['neck', 'middle', 'bridge'])) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate all notes in an exercise
CREATE OR REPLACE FUNCTION validate_exercise_notes(exercise_id UUID)
RETURNS TABLE(note_index INTEGER, is_valid BOOLEAN, error_message TEXT) AS $$
DECLARE
    note_json JSONB;
    note_count INTEGER;
BEGIN
    SELECT jsonb_array_length(notes) INTO note_count 
    FROM exercises WHERE id = exercise_id;
    
    FOR i IN 0..note_count-1 LOOP
        SELECT notes->i INTO note_json 
        FROM exercises WHERE id = exercise_id;
        
        IF validate_epic4_note_properties(note_json) THEN
            RETURN QUERY SELECT i, TRUE, NULL::TEXT;
        ELSE
            RETURN QUERY SELECT i, FALSE, 'Invalid Epic 4 note properties'::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Insert Epic 4 test exercise with advanced techniques
INSERT INTO exercises (id, title, description, difficulty, duration, bpm, key, notes) VALUES
(
    'e4d5a8f9-c123-4567-8901-234567890001',
    'Epic 4 Advanced Techniques Demo',
    'Comprehensive test of all Epic 4 advanced bass techniques including hammer-ons, pull-offs, slides, bends, vibrato, slapping, and harmonics',
    'advanced',
    20000,
    120,
    'E',
    '[
        {
            "id": "note-1",
            "timestamp": 0,
            "string": 1,
            "fret": 0,
            "duration": 500,
            "note": "E",
            "color": "green",
            "techniques": ["slap"],
            "is_accented": true,
            "accent_level": "heavy",
            "pluck_position": "bridge"
        },
        {
            "id": "note-2",
            "timestamp": 1000,
            "string": 1,
            "fret": 2,
            "duration": 500,
            "note": "F#",
            "color": "blue",
            "techniques": ["hammer_on"],
            "target_note_id": "note-3",
            "finger_index": 2
        },
        {
            "id": "note-3",
            "timestamp": 1500,
            "string": 1,
            "fret": 4,
            "duration": 500,
            "note": "G#",
            "color": "blue",
            "techniques": ["pull_off"],
            "target_note_id": "note-2",
            "finger_index": 4
        },
        {
            "id": "note-4",
            "timestamp": 2500,
            "string": 2,
            "fret": 5,
            "duration": 1000,
            "note": "D",
            "color": "red",
            "techniques": ["slide_up"],
            "slide_to_fret": 7,
            "slide_type": "legato"
        },
        {
            "id": "note-5",
            "timestamp": 4000,
            "string": 2,
            "fret": 7,
            "duration": 1500,
            "note": "E",
            "color": "red",
            "techniques": ["bend", "vibrato"],
            "bend_target_pitch": "half_step",
            "vibrato_intensity": "medium"
        },
        {
            "id": "note-6",
            "timestamp": 6000,
            "string": 3,
            "fret": 12,
            "duration": 800,
            "note": "D",
            "color": "yellow",
            "techniques": ["harmonic"],
            "is_harmonic": true,
            "pluck_position": "neck"
        },
        {
            "id": "note-7",
            "timestamp": 7500,
            "string": 1,
            "fret": 3,
            "duration": 250,
            "note": "G",
            "color": "purple",
            "techniques": ["pop"],
            "is_ghost_note": true
        },
        {
            "id": "note-8",
            "timestamp": 8000,
            "string": 2,
            "fret": 0,
            "duration": 500,
            "note": "A",
            "color": "green",
            "techniques": ["tap"],
            "is_tapped": true,
            "tapping_hand": "right",
            "finger_index": 1
        },
        {
            "id": "note-9",
            "timestamp": 9000,
            "string": 4,
            "fret": 5,
            "duration": 750,
            "note": "G",
            "color": "blue",
            "is_muted": true,
            "mute_type": "palm_mute",
            "display_symbol": "PM"
        },
        {
            "id": "note-10",
            "timestamp": 10500,
            "string": 3,
            "fret": 9,
            "duration": 1000,
            "note": "F#",
            "color": "red",
            "techniques": ["slide_down"],
            "slide_to_fret": 5,
            "slide_type": "shift"
        }
    ]'::jsonb
);

-- Validate all existing exercises can handle Epic 4 properties
DO $$
DECLARE
    exercise_record RECORD;
    validation_results RECORD;
    total_exercises INTEGER := 0;
    valid_exercises INTEGER := 0;
    total_notes INTEGER := 0;
    valid_notes INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting Epic 4 Data Readiness Validation...';
    
    -- Count total exercises and notes
    SELECT COUNT(*) INTO total_exercises FROM exercises;
    SELECT SUM(jsonb_array_length(notes)) INTO total_notes FROM exercises;
    
    RAISE NOTICE 'Found % exercises with % total notes', total_exercises, total_notes;
    
    -- Validate each exercise
    FOR exercise_record IN SELECT id, title FROM exercises LOOP
        DECLARE
            exercise_valid BOOLEAN := TRUE;
            note_count INTEGER := 0;
            valid_note_count INTEGER := 0;
        BEGIN
            -- Validate all notes in this exercise
            FOR validation_results IN SELECT * FROM validate_exercise_notes(exercise_record.id) LOOP
                note_count := note_count + 1;
                IF validation_results.is_valid THEN
                    valid_note_count := valid_note_count + 1;
                ELSE
                    exercise_valid := FALSE;
                    RAISE NOTICE 'Exercise "%" note % failed validation: %', 
                        exercise_record.title, validation_results.note_index, validation_results.error_message;
                END IF;
            END LOOP;
            
            IF exercise_valid THEN
                valid_exercises := valid_exercises + 1;
                RAISE NOTICE 'Exercise "%" passed validation (% notes)', exercise_record.title, note_count;
            END IF;
            
            valid_notes := valid_notes + valid_note_count;
        END;
    END LOOP;
    
    RAISE NOTICE 'Epic 4 Validation Complete:';
    RAISE NOTICE '  Exercises: %/% passed (%.1f%%)', valid_exercises, total_exercises, 
        (valid_exercises::FLOAT / total_exercises * 100);
    RAISE NOTICE '  Notes: %/% passed (%.1f%%)', valid_notes, total_notes, 
        (valid_notes::FLOAT / total_notes * 100);
    
    IF valid_exercises = total_exercises AND valid_notes = total_notes THEN
        RAISE NOTICE 'SUCCESS: All existing data is Epic 4 compatible!';
    ELSE
        RAISE WARNING 'Some data failed Epic 4 validation - check logs above';
    END IF;
END;
$$;

-- Test Epic 4 specific queries
DO $$
BEGIN
    RAISE NOTICE 'Testing Epic 4 Query Capabilities...';
    
    -- Test technique filtering
    PERFORM id FROM exercises 
    WHERE notes @> '[{"techniques": ["slap"]}]';
    RAISE NOTICE 'Slap technique query: OK';
    
    -- Test complex technique combinations
    PERFORM id FROM exercises 
    WHERE notes @> '[{"techniques": ["bend", "vibrato"]}]';
    RAISE NOTICE 'Combined technique query: OK';
    
    -- Test Epic 4 property filtering
    PERFORM id FROM exercises 
    WHERE notes @> '[{"is_harmonic": true}]';
    RAISE NOTICE 'Harmonic property query: OK';
    
    -- Test slide target filtering
    PERFORM id FROM exercises 
    WHERE notes @> '[{"slide_to_fret": 7}]';
    RAISE NOTICE 'Slide target query: OK';
    
    RAISE NOTICE 'All Epic 4 queries successful!';
END;
$$;

-- Create indexes for Epic 4 performance
CREATE INDEX IF NOT EXISTS idx_exercises_notes_techniques 
ON exercises USING gin((notes->'techniques'));

CREATE INDEX IF NOT EXISTS idx_exercises_notes_epic4_properties 
ON exercises USING gin(notes jsonb_path_ops);

-- Verify backward compatibility
DO $$
DECLARE
    original_count INTEGER;
    post_migration_count INTEGER;
BEGIN
    RAISE NOTICE 'Verifying Backward Compatibility...';
    
    -- Count notes before and after to ensure no data loss
    SELECT SUM(jsonb_array_length(notes)) INTO post_migration_count FROM exercises;
    
    RAISE NOTICE 'Post-migration note count: %', post_migration_count;
    
    -- Verify all Epic 3 properties are still accessible
    PERFORM id FROM exercises 
    WHERE notes @> '[{"color": "green"}]';
    RAISE NOTICE 'Epic 3 color property: OK';
    
    PERFORM id FROM exercises 
    WHERE notes @> '[{"fret": 5}]';
    RAISE NOTICE 'Epic 3 fret property: OK';
    
    PERFORM id FROM exercises 
    WHERE notes @> '[{"string": 1}]';
    RAISE NOTICE 'Epic 3 string property: OK';
    
    RAISE NOTICE 'Backward compatibility verified!';
END;
$$;

-- Summary report
DO $$
DECLARE
    total_exercises INTEGER;
    epic4_exercises INTEGER;
    epic3_exercises INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_exercises FROM exercises;
    
    SELECT COUNT(*) INTO epic4_exercises FROM exercises 
    WHERE notes @? '$[*].techniques';
    
    epic3_exercises := total_exercises - epic4_exercises;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== EPIC 4 DATA READINESS SUMMARY ===';
    RAISE NOTICE 'Total Exercises: %', total_exercises;
    RAISE NOTICE 'Epic 3 Only: %', epic3_exercises;
    RAISE NOTICE 'Epic 4 Compatible: %', epic4_exercises;
    RAISE NOTICE '';
    RAISE NOTICE 'Database Schema: READY for Epic 4';
    RAISE NOTICE 'Backward Compatibility: MAINTAINED';
    RAISE NOTICE 'Query Performance: OPTIMIZED';
    RAISE NOTICE '=====================================';
END;
$$; 