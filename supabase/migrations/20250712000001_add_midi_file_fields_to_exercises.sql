-- Add MIDI file reference fields to exercises table
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS midi_file_path TEXT,
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE;

-- Add index for MIDI file queries
CREATE INDEX IF NOT EXISTS idx_exercises_midi_file 
ON exercises(midi_file_path) 
WHERE midi_file_path IS NOT NULL;

-- Add index for file upload queries
CREATE INDEX IF NOT EXISTS idx_exercises_uploaded_at 
ON exercises(uploaded_at) 
WHERE uploaded_at IS NOT NULL;

-- Update the existing updated_at trigger to include new fields
CREATE OR REPLACE FUNCTION update_exercises_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure trigger exists for updated_at
DROP TRIGGER IF EXISTS update_exercises_updated_at_trigger ON exercises;
CREATE TRIGGER update_exercises_updated_at_trigger
  BEFORE UPDATE ON exercises
  FOR EACH ROW
  EXECUTE FUNCTION update_exercises_updated_at();