-- Create custom basslines table for user-specific exercise storage
-- This supports Epic 3 custom bassline persistence functionality

CREATE TABLE custom_basslines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    notes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of note objects matching ExerciseNote schema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique bassline titles per user per exercise
    UNIQUE(user_id, exercise_id, title)
);

-- Create indexes for performance
CREATE INDEX idx_custom_basslines_user_id ON custom_basslines(user_id);
CREATE INDEX idx_custom_basslines_exercise_id ON custom_basslines(exercise_id);
CREATE INDEX idx_custom_basslines_notes_gin ON custom_basslines USING gin(notes);
CREATE INDEX idx_custom_basslines_created_at ON custom_basslines(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE custom_basslines ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for custom basslines
-- Users can only see and modify their own custom basslines
CREATE POLICY "Users can view their own custom basslines" ON custom_basslines
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom basslines" ON custom_basslines
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom basslines" ON custom_basslines
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom basslines" ON custom_basslines
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_custom_basslines_updated_at
    BEFORE UPDATE ON custom_basslines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE custom_basslines IS 'Stores user-created custom basslines for exercises in Epic 3';
COMMENT ON COLUMN custom_basslines.notes IS 'JSONB array of ExerciseNote objects compatible with Epic 4 schema'; 