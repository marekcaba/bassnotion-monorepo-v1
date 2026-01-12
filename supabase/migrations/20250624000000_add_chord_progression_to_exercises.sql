-- Add chord_progression field to exercises table for Story 3.3
-- This field will store JSON array of chord names for each exercise

ALTER TABLE exercises 
ADD COLUMN chord_progression JSONB DEFAULT '[]'::jsonb;

-- Add index for chord progression queries
CREATE INDEX idx_exercises_chord_progression ON exercises USING GIN (chord_progression);

-- Update existing exercises with appropriate chord progressions based on their key and style
UPDATE exercises 
SET chord_progression = CASE 
    WHEN key = 'D' AND title LIKE '%Modal%' THEN '["Dm7", "G7", "Am7", "Dm7"]'::jsonb
    WHEN key = 'C' AND title LIKE '%II-V-I%' THEN '["Dm7", "G7", "CMaj7", "CMaj7"]'::jsonb
    WHEN key = 'E' AND title LIKE '%Funk%' THEN '["Em7", "Am7", "Em7", "Bm7"]'::jsonb
    WHEN key = 'A' AND title LIKE '%Blues%' THEN '["A7", "D7", "A7", "E7"]'::jsonb
    ELSE CASE key
        WHEN 'C' THEN '["C", "Am", "F", "G"]'::jsonb
        WHEN 'D' THEN '["D", "Bm", "G", "A"]'::jsonb
        WHEN 'E' THEN '["E", "C#m", "A", "B"]'::jsonb
        WHEN 'F' THEN '["F", "Dm", "Bb", "C"]'::jsonb
        WHEN 'G' THEN '["G", "Em", "C", "D"]'::jsonb
        WHEN 'A' THEN '["A", "F#m", "D", "E"]'::jsonb
        WHEN 'B' THEN '["B", "G#m", "E", "F#"]'::jsonb
        ELSE '["Dm7", "G7", "CMaj7", "CMaj7"]'::jsonb
    END
END
WHERE chord_progression = '[]'::jsonb OR chord_progression IS NULL;

-- Add comment explaining the field
COMMENT ON COLUMN exercises.chord_progression IS 'JSON array of chord names for the exercise progression (e.g., ["Dm7", "G7", "CMaj7"])'; 