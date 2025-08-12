-- Add bass configuration columns to profiles table
ALTER TABLE profiles 
ADD COLUMN bass_string_count INTEGER DEFAULT 4 CHECK (bass_string_count IN (4, 5, 6)),
ADD COLUMN bass_max_frets INTEGER DEFAULT 24 CHECK (bass_max_frets >= 19 AND bass_max_frets <= 25);

-- Add comment for documentation
COMMENT ON COLUMN profiles.bass_string_count IS 'Number of strings on user bass guitar (4, 5, or 6)';
COMMENT ON COLUMN profiles.bass_max_frets IS 'Maximum number of frets on user bass guitar (19-25)';

-- Create index for potential queries
CREATE INDEX IF NOT EXISTS idx_profiles_bass_config ON profiles(bass_string_count, bass_max_frets);