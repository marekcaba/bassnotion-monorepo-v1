-- Refactor duration column to use musical time instead of milliseconds
-- This makes the system more flexible for tempo changes and MIDI-based exercises

-- Add musical duration columns (duration_beats is the key field)
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS duration_beats INTEGER DEFAULT 16;

-- Update existing exercises with calculated beat durations based on current BPM
-- Formula: duration_beats = (duration_ms / 1000) * (bpm / 60)
UPDATE exercises 
SET duration_beats = GREATEST(4, ROUND((duration / 1000.0) * (bpm / 60.0)))
WHERE duration_beats IS NULL;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_exercises_duration_beats ON exercises(duration_beats);

-- Add comments explaining the new approach
COMMENT ON COLUMN exercises.duration_beats IS 'Total number of beats in the exercise (musical time, tempo-independent)';
COMMENT ON COLUMN exercises.duration IS 'DEPRECATED: Duration in milliseconds - use duration_beats with BPM to calculate runtime';

-- Create a helper function to calculate runtime duration
CREATE OR REPLACE FUNCTION calculate_exercise_runtime(beats INTEGER, bpm INTEGER) 
RETURNS INTEGER AS $$
BEGIN
  -- Returns duration in milliseconds
  RETURN (beats * 60000.0 / bpm)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view for exercises with calculated runtime durations
CREATE OR REPLACE VIEW exercises_with_runtime AS
SELECT 
  e.*,
  calculate_exercise_runtime(e.duration_beats, e.bpm) AS runtime_duration_ms,
  ROUND(calculate_exercise_runtime(e.duration_beats, e.bpm) / 1000.0, 1) AS runtime_duration_seconds
FROM exercises e
WHERE e.is_active = true;