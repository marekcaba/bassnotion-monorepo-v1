-- Refactor exercises to use JSON notes instead of separate table
-- This migration consolidates exercise_notes into exercises.notes as JSONB

-- First, create a backup of existing data by creating the new structure
CREATE TABLE exercises_new (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty exercise_difficulty NOT NULL,
    duration INTEGER NOT NULL, -- duration in milliseconds
    bpm INTEGER NOT NULL DEFAULT 120,
    key VARCHAR(10) DEFAULT 'C',
    notes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of note objects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true
);

-- Migrate existing data by combining exercises with their notes
INSERT INTO exercises_new (id, title, description, difficulty, duration, bpm, key, notes, created_at, updated_at, created_by, is_active)
SELECT 
    e.id,
    e.title,
    e.description,
    e.difficulty,
    e.duration,
    e.bpm,
    e.key,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', en.note_id,
                'timestamp', en.timestamp,
                'string', en.string,
                'fret', en.fret,
                'duration', en.duration,
                'note', en.note,
                'color', en.color
            ) ORDER BY en.timestamp
        ) FILTER (WHERE en.id IS NOT NULL),
        '[]'::jsonb
    ) as notes,
    e.created_at,
    e.updated_at,
    e.created_by,
    e.is_active
FROM exercises e
LEFT JOIN exercise_notes en ON e.id = en.exercise_id
GROUP BY e.id, e.title, e.description, e.difficulty, e.duration, e.bpm, e.key, e.created_at, e.updated_at, e.created_by, e.is_active;

-- Drop the old tables and policies
DROP POLICY IF EXISTS "Allow public read access to notes for active exercises" ON exercise_notes;
DROP POLICY IF EXISTS "Allow authenticated users to create exercise notes" ON exercise_notes;
DROP POLICY IF EXISTS "Allow users to update notes for their own exercises" ON exercise_notes;
DROP POLICY IF EXISTS "Allow users to delete notes for their own exercises" ON exercise_notes;
DROP POLICY IF EXISTS "Allow public read access to active exercises" ON exercises;
DROP POLICY IF EXISTS "Allow authenticated users to create exercises" ON exercises;
DROP POLICY IF EXISTS "Allow users to update their own exercises" ON exercises;
DROP POLICY IF EXISTS "Allow users to delete their own exercises" ON exercises;

DROP TABLE exercise_notes;
DROP TABLE exercises;

-- Rename the new table
ALTER TABLE exercises_new RENAME TO exercises;

-- Create indexes for the new structure
CREATE INDEX idx_exercises_difficulty ON exercises(difficulty);
CREATE INDEX idx_exercises_active ON exercises(is_active);
CREATE INDEX idx_exercises_notes_gin ON exercises USING gin(notes); -- GIN index for JSON queries

-- Enable Row Level Security (RLS)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Create policies for the new structure
CREATE POLICY "Allow public read access to active exercises" ON exercises
    FOR SELECT USING (is_active = true);

CREATE POLICY "Allow authenticated users to create exercises" ON exercises
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow users to update their own exercises" ON exercises
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Allow users to delete their own exercises" ON exercises
    FOR DELETE USING (auth.uid() = created_by);

-- Verify the migration by showing the new structure
SELECT 
    id,
    title,
    difficulty,
    duration,
    bpm,
    key,
    jsonb_array_length(notes) as note_count
FROM exercises
ORDER BY created_at;
