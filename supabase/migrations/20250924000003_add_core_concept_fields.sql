-- Add Core Concept fields to tutorials table
ALTER TABLE tutorials
ADD COLUMN IF NOT EXISTS core_concept_description TEXT,
ADD COLUMN IF NOT EXISTS core_concept_points JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS teaching_takeaway JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN tutorials.core_concept_description IS 'Main description for the core concept section';
COMMENT ON COLUMN tutorials.core_concept_points IS 'Array of bullet points for core concepts';
COMMENT ON COLUMN tutorials.teaching_takeaway IS 'JSON object containing all teaching takeaway data including title, points, practice tips, etc.';