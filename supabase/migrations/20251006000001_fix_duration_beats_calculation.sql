-- Fix duration_beats calculation for all exercises
-- This migration properly calculates duration_beats from exercise duration and BPM

-- First, let's see what we have
-- UPDATE exercises to have proper duration_beats values

-- For exercises with valid duration and BPM, calculate duration_beats
UPDATE exercises 
SET duration_beats = GREATEST(4, ROUND((duration / 60.0) * bpm))
WHERE duration > 0 AND bpm > 0 AND (duration_beats IS NULL OR duration_beats = 0);

-- For exercises without duration but with BPM, default to 2 measures (8 beats in 4/4)
UPDATE exercises
SET duration_beats = 8
WHERE (duration IS NULL OR duration = 0) AND bpm > 0 AND (duration_beats IS NULL OR duration_beats = 0);

-- For any remaining exercises, set a minimum of 4 beats (1 measure)
UPDATE exercises
SET duration_beats = 4
WHERE duration_beats IS NULL OR duration_beats = 0;

-- Add helpful comments
COMMENT ON COLUMN exercises.duration_beats IS 'Total number of beats in the exercise. For 4/4 time: 4 beats = 1 bar, 8 beats = 2 bars, etc.';
COMMENT ON COLUMN exercises.duration IS 'DEPRECATED: Duration in seconds. Use duration_beats with BPM to calculate actual runtime.';
