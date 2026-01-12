-- Add drum_hits column and missing fields to pattern_library
-- ============================================================
-- This allows storing drum patterns as DrumHit[] JSONB data
-- alongside the existing MIDI file storage approach

-- Make midi_file_url and midi_file_path nullable for patterns that use drum_hits
ALTER TABLE pattern_library
  ALTER COLUMN midi_file_url DROP NOT NULL,
  ALTER COLUMN midi_file_path DROP NOT NULL;

-- Add new columns for drum pattern storage
ALTER TABLE pattern_library
  ADD COLUMN IF NOT EXISTS drum_hits JSONB, -- Array of DrumHit objects
  ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS bpm_min INTEGER CHECK (bpm_min >= 20 AND bpm_min <= 300),
  ADD COLUMN IF NOT EXISTS bpm_max INTEGER CHECK (bpm_max >= 20 AND bpm_max <= 300),
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Add constraint to ensure either midi_file_path or drum_hits is provided
ALTER TABLE pattern_library
  ADD CONSTRAINT pattern_has_data CHECK (
    midi_file_path IS NOT NULL OR drum_hits IS NOT NULL
  );

-- Index for drum_hits patterns
CREATE INDEX IF NOT EXISTS idx_pattern_library_difficulty ON pattern_library(difficulty);
CREATE INDEX IF NOT EXISTS idx_pattern_library_featured ON pattern_library(is_featured);
CREATE INDEX IF NOT EXISTS idx_pattern_library_usage ON pattern_library(usage_count DESC);

-- Update RLS policy to allow authenticated users to create patterns
DROP POLICY IF EXISTS "Authenticated users can create patterns" ON pattern_library;
CREATE POLICY "Authenticated users can create patterns" ON pattern_library
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Comment on new columns
COMMENT ON COLUMN pattern_library.drum_hits IS 'DrumHit[] array stored as JSONB for patterns created in the UI';
COMMENT ON COLUMN pattern_library.difficulty IS 'Skill level: beginner, intermediate, or advanced';
COMMENT ON COLUMN pattern_library.bpm_min IS 'Minimum suggested BPM for this pattern';
COMMENT ON COLUMN pattern_library.bpm_max IS 'Maximum suggested BPM for this pattern';
COMMENT ON COLUMN pattern_library.usage_count IS 'Number of times this pattern has been used';
COMMENT ON COLUMN pattern_library.is_featured IS 'Whether this pattern is featured/promoted';
