-- Migration: Add harmony_control_changes to exercises table
-- Feature: Sustain Pedal (CC64) Support for Harmony Instruments
-- Date: 2025-11-13

-- Add harmony_control_changes column to store MIDI control change events
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS harmony_control_changes JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for efficient JSON queries on harmony_control_changes
CREATE INDEX IF NOT EXISTS idx_exercises_harmony_control_changes_gin
ON exercises USING gin(harmony_control_changes);

-- Add column comment for documentation
COMMENT ON COLUMN exercises.harmony_control_changes IS 'MIDI control change events for harmony playback (sustain pedal, expression, etc.). Each event contains: cc (0-127), value (0-127), position (measure/beat/subdivision/tick), ticks (absolute tick position at 960 PPQ), measureNumber. CC64 = sustain pedal, CC11 = expression, etc.';
