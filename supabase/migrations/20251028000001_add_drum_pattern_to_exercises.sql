-- Migration: Add drum_pattern column to exercises table
-- This stores pre-converted drum hits from MIDI files
-- Similar to how 'notes' stores pre-converted bass fretboard positions

-- Add drum_pattern column (JSONB for structured drum hit data)
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS drum_pattern JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN exercises.drum_pattern IS 'Pre-converted drum hits from MIDI file. Array of {drum, velocity, position, durationTicks}. Similar to notes column for bass.';

-- Add index for JSONB queries (if we want to search by drum patterns later)
CREATE INDEX IF NOT EXISTS idx_exercises_drum_pattern_gin
ON exercises USING GIN (drum_pattern);

-- Example drum_pattern structure:
-- [
--   {
--     "id": "drum-1",
--     "drum": "kick",
--     "velocity": 100,
--     "position": { "measure": 1, "beat": 1, "subdivision": 0 },
--     "durationTicks": 480
--   },
--   {
--     "id": "drum-2",
--     "drum": "snare",
--     "velocity": 90,
--     "position": { "measure": 1, "beat": 2, "subdivision": 0 },
--     "durationTicks": 480
--   }
-- ]
