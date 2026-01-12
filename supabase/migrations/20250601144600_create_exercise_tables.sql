-- Create enum for difficulty levels
CREATE TYPE exercise_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TABLE exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty exercise_difficulty NOT NULL,
    duration INTEGER NOT NULL, -- duration in milliseconds
    bpm INTEGER NOT NULL DEFAULT 120,
    key VARCHAR(10) DEFAULT 'C',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true
);

-- Create exercise_notes table
CREATE TABLE exercise_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    note_id VARCHAR(50) NOT NULL, -- e.g., "note-1", "note-2"
    timestamp INTEGER NOT NULL, -- milliseconds
    string INTEGER NOT NULL CHECK (string >= 1 AND string <= 4), -- 1=E, 2=A, 3=D, 4=G
    fret INTEGER NOT NULL CHECK (fret >= 0 AND fret <= 24),
    duration INTEGER NOT NULL DEFAULT 500, -- milliseconds
    note VARCHAR(10) NOT NULL, -- e.g., "A#", "C", "D"
    color VARCHAR(20) DEFAULT 'green', -- red, green, blue, yellow, purple
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_exercises_difficulty ON exercises(difficulty);
CREATE INDEX idx_exercises_active ON exercises(is_active);
CREATE INDEX idx_exercise_notes_exercise_id ON exercise_notes(exercise_id);
CREATE INDEX idx_exercise_notes_timestamp ON exercise_notes(timestamp);

-- Enable Row Level Security (RLS)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for exercises
CREATE POLICY "Allow public read access to active exercises" ON exercises
    FOR SELECT USING (is_active = true);

CREATE POLICY "Allow authenticated users to create exercises" ON exercises
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow users to update their own exercises" ON exercises
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Allow users to delete their own exercises" ON exercises
    FOR DELETE USING (auth.uid() = created_by);

-- Create policies for exercise_notes
CREATE POLICY "Allow public read access to notes for active exercises" ON exercise_notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exercises 
            WHERE exercises.id = exercise_notes.exercise_id 
            AND exercises.is_active = true
        )
    );

CREATE POLICY "Allow authenticated users to create exercise notes" ON exercise_notes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow users to update notes for their own exercises" ON exercise_notes
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM exercises 
            WHERE exercises.id = exercise_notes.exercise_id 
            AND exercises.created_by = auth.uid()
        )
    );

CREATE POLICY "Allow users to delete notes for their own exercises" ON exercise_notes
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM exercises 
            WHERE exercises.id = exercise_notes.exercise_id 
            AND exercises.created_by = auth.uid()
        )
    );

-- Insert sample exercises
INSERT INTO exercises (id, title, description, difficulty, duration, bpm, key) VALUES
(
    'e1d5a8f9-c123-4567-8901-234567890123',
    'Modal Interchange Exercise',
    'Practice modal interchange concepts with chord progressions using D Dorian and D Aeolian modes',
    'intermediate',
    16000,
    100,
    'D'
),
(
    'e2d5a8f9-c123-4567-8901-234567890124',
    'II-V-I Progression Study',
    'Advanced II-V-I progressions with modal variations in C major',
    'advanced',
    12000,
    120,
    'C'
),
(
    'e3d5a8f9-c123-4567-8901-234567890125',
    'Funk Slap Technique Builder',
    'Build your funk slap technique with rhythmic patterns in E',
    'intermediate',
    14000,
    95,
    'E'
),
(
    'e4d5a8f9-c123-4567-8901-234567890126',
    'Blues Scale Mastery',
    'Master the blues scale across the fretboard in A',
    'beginner',
    18000,
    80,
    'A'
);

-- Insert sample exercise notes for Modal Interchange Exercise
INSERT INTO exercise_notes (exercise_id, note_id, timestamp, string, fret, duration, note, color) VALUES
-- D Dorian pattern
('e1d5a8f9-c123-4567-8901-234567890123', 'note-1', 0, 3, 5, 500, 'D', 'green'),
('e1d5a8f9-c123-4567-8901-234567890123', 'note-2', 1000, 3, 7, 500, 'E', 'green'),
('e1d5a8f9-c123-4567-8901-234567890123', 'note-3', 2000, 3, 9, 500, 'F#', 'green'),
('e1d5a8f9-c123-4567-8901-234567890123', 'note-4', 3000, 2, 5, 500, 'G', 'green'),
-- Modal shift to D Aeolian
('e1d5a8f9-c123-4567-8901-234567890123', 'note-5', 4000, 2, 7, 500, 'A', 'green'),
('e1d5a8f9-c123-4567-8901-234567890123', 'note-6', 5000, 2, 8, 500, 'Bb', 'green'),
('e1d5a8f9-c123-4567-8901-234567890123', 'note-7', 6000, 1, 5, 500, 'C', 'green'),
('e1d5a8f9-c123-4567-8901-234567890123', 'note-8', 7000, 3, 5, 500, 'D', 'green'),
-- Repeat pattern
('e1d5a8f9-c123-4567-8901-234567890123', 'note-9', 8000, 3, 7, 500, 'E', 'green'),
('e1d5a8f9-c123-4567-8901-234567890123', 'note-10', 9000, 3, 9, 500, 'F#', 'green'),
('e1d5a8f9-c123-4567-8901-234567890123', 'note-11', 10000, 2, 5, 500, 'G', 'green'),
('e1d5a8f9-c123-4567-8901-234567890123', 'note-12', 11000, 2, 7, 500, 'A', 'green');

-- Insert sample exercise notes for II-V-I Progression Study  
INSERT INTO exercise_notes (exercise_id, note_id, timestamp, string, fret, duration, note, color) VALUES
-- ii chord (Dm7)
('e2d5a8f9-c123-4567-8901-234567890124', 'note-1', 0, 3, 5, 500, 'D', 'green'),
('e2d5a8f9-c123-4567-8901-234567890124', 'note-2', 500, 2, 3, 500, 'F', 'green'),
('e2d5a8f9-c123-4567-8901-234567890124', 'note-3', 1000, 2, 5, 500, 'A', 'green'),
('e2d5a8f9-c123-4567-8901-234567890124', 'note-4', 1500, 1, 5, 500, 'C', 'green'),
-- V chord (G7)
('e2d5a8f9-c123-4567-8901-234567890124', 'note-5', 3000, 2, 10, 500, 'G', 'green'),
('e2d5a8f9-c123-4567-8901-234567890124', 'note-6', 3500, 1, 8, 500, 'B', 'green'),
('e2d5a8f9-c123-4567-8901-234567890124', 'note-7', 4000, 3, 5, 500, 'D', 'green'),
('e2d5a8f9-c123-4567-8901-234567890124', 'note-8', 4500, 2, 3, 500, 'F', 'green'),
-- I chord (CMaj7)
('e2d5a8f9-c123-4567-8901-234567890124', 'note-9', 6000, 1, 3, 500, 'C', 'green'),
('e2d5a8f9-c123-4567-8901-234567890124', 'note-10', 6500, 1, 7, 500, 'E', 'green'),
('e2d5a8f9-c123-4567-8901-234567890124', 'note-11', 7000, 2, 10, 500, 'G', 'green'),
('e2d5a8f9-c123-4567-8901-234567890124', 'note-12', 7500, 1, 10, 500, 'B', 'green');

-- Insert sample exercise notes for Funk Slap Technique Builder
INSERT INTO exercise_notes (exercise_id, note_id, timestamp, string, fret, duration, note, color) VALUES
-- Slap pattern in E
('e3d5a8f9-c123-4567-8901-234567890125', 'note-1', 0, 1, 0, 250, 'E', 'green'),
('e3d5a8f9-c123-4567-8901-234567890125', 'note-2', 500, 1, 7, 250, 'B', 'green'),
('e3d5a8f9-c123-4567-8901-234567890125', 'note-3', 1000, 1, 0, 250, 'E', 'green'),
('e3d5a8f9-c123-4567-8901-234567890125', 'note-4', 1250, 2, 7, 250, 'E', 'green'),
('e3d5a8f9-c123-4567-8901-234567890125', 'note-5', 2000, 1, 0, 250, 'E', 'green'),
('e3d5a8f9-c123-4567-8901-234567890125', 'note-6', 2500, 1, 7, 250, 'B', 'green'),
('e3d5a8f9-c123-4567-8901-234567890125', 'note-7', 3000, 2, 5, 250, 'A', 'green'),
('e3d5a8f9-c123-4567-8901-234567890125', 'note-8', 3500, 1, 5, 250, 'A', 'green'),
-- Groove variation
('e3d5a8f9-c123-4567-8901-234567890125', 'note-9', 4000, 1, 0, 250, 'E', 'green'),
('e3d5a8f9-c123-4567-8901-234567890125', 'note-10', 4750, 3, 2, 250, 'E', 'green'),
('e3d5a8f9-c123-4567-8901-234567890125', 'note-11', 5500, 1, 7, 250, 'B', 'green'),
('e3d5a8f9-c123-4567-8901-234567890125', 'note-12', 6000, 2, 7, 250, 'E', 'green');

-- Insert sample exercise notes for Blues Scale Mastery
INSERT INTO exercise_notes (exercise_id, note_id, timestamp, string, fret, duration, note, color) VALUES
-- A Blues scale ascending
('e4d5a8f9-c123-4567-8901-234567890126', 'note-1', 0, 2, 5, 750, 'A', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-2', 1000, 1, 5, 750, 'C', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-3', 2000, 3, 5, 750, 'D', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-4', 3000, 3, 6, 750, 'Eb', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-5', 4000, 3, 7, 750, 'E', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-6', 5000, 2, 8, 750, 'G', 'green'),
-- Descending pattern
('e4d5a8f9-c123-4567-8901-234567890126', 'note-7', 6000, 2, 8, 750, 'G', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-8', 7000, 3, 7, 750, 'E', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-9', 8000, 3, 6, 750, 'Eb', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-10', 9000, 3, 5, 750, 'D', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-11', 10000, 1, 5, 750, 'C', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-12', 11000, 2, 5, 750, 'A', 'green'),
-- Pentatonic variation
('e4d5a8f9-c123-4567-8901-234567890126', 'note-13', 12000, 2, 7, 500, 'A', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-14', 13000, 1, 8, 500, 'C', 'green'),
('e4d5a8f9-c123-4567-8901-234567890126', 'note-15', 14000, 3, 7, 500, 'D', 'green'); 