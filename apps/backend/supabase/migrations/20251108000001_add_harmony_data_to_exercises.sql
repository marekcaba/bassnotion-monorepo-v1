-- Migration: Add harmony_notes and harmony_instrument to exercises table
-- Story: Harmony Instrument System
-- Date: 2025-11-08

-- Add harmony_notes column to store pre-converted MIDI data
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS harmony_notes JSONB DEFAULT '[]'::jsonb;

-- Add harmony_instrument column to store default instrument type
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS harmony_instrument VARCHAR(50) DEFAULT 'salamander';

-- Create GIN index for efficient JSON queries on harmony_notes
CREATE INDEX IF NOT EXISTS idx_exercises_harmony_notes_gin
ON exercises USING gin(harmony_notes);

-- Add column comments for documentation
COMMENT ON COLUMN exercises.harmony_notes IS 'Pre-converted harmony note data with pitch, velocity, and musical timing. Each note contains: id, pitch (0-127), velocity (0-127), noteName, position (measure/beat/subdivision), noteDuration, durationTicks, measureNumber, voiceIndex (optional)';

COMMENT ON COLUMN exercises.harmony_instrument IS 'Default harmony instrument for this exercise. Valid values: salamander (Grand Piano), rhodes (Fender Rhodes), wurlitzer (Wurlitzer Electric Piano), pad (Synth Pad)';

-- Add check constraint to ensure valid instrument types
ALTER TABLE exercises
ADD CONSTRAINT chk_harmony_instrument
CHECK (harmony_instrument IN ('salamander', 'rhodes', 'wurlitzer', 'pad') OR harmony_instrument IS NULL);
