-- Migration for Story 3.8: Enhanced Custom Bassline Persistence
-- This migration enhances the existing custom_basslines table with new features

-- Add new columns for Story 3.8 features
ALTER TABLE custom_basslines 
ADD COLUMN description TEXT,
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN version INTEGER DEFAULT 1,
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;

-- Rename title to name for consistency with Story 3.8 schema
ALTER TABLE custom_basslines RENAME COLUMN title TO name;

-- Remove the unique constraint on (user_id, exercise_id, title) as we want
-- users to be able to save multiple basslines with different names
ALTER TABLE custom_basslines DROP CONSTRAINT custom_basslines_user_id_exercise_id_title_key;

-- Add new unique constraint on (user_id, name) to prevent duplicate names per user
ALTER TABLE custom_basslines 
ADD CONSTRAINT custom_basslines_user_id_name_key 
UNIQUE(user_id, name) DEFERRABLE INITIALLY DEFERRED;

-- Add check constraint for version
ALTER TABLE custom_basslines 
ADD CONSTRAINT custom_basslines_version_check 
CHECK (version >= 1);

-- Add check constraint for metadata structure
ALTER TABLE custom_basslines 
ADD CONSTRAINT custom_basslines_metadata_check 
CHECK (jsonb_typeof(metadata) = 'object');

-- Create indexes for new columns
CREATE INDEX idx_custom_basslines_name ON custom_basslines(name);
CREATE INDEX idx_custom_basslines_metadata_gin ON custom_basslines USING gin(metadata);
CREATE INDEX idx_custom_basslines_version ON custom_basslines(version);
CREATE INDEX idx_custom_basslines_deleted_at ON custom_basslines(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Update RLS policies to handle soft deletes
DROP POLICY "Users can view their own custom basslines" ON custom_basslines;
DROP POLICY "Users can create their own custom basslines" ON custom_basslines;
DROP POLICY "Users can update their own custom basslines" ON custom_basslines;
DROP POLICY "Users can delete their own custom basslines" ON custom_basslines;

-- Create new RLS policies with soft delete support
CREATE POLICY "Users can view their own active custom basslines" ON custom_basslines
    FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create their own custom basslines" ON custom_basslines
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom basslines" ON custom_basslines
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can soft delete their own custom basslines" ON custom_basslines
    FOR UPDATE USING (auth.uid() = user_id);

-- Create function for auto-save functionality
CREATE OR REPLACE FUNCTION auto_save_bassline(
    p_user_id UUID,
    p_name VARCHAR(255),
    p_notes JSONB,
    p_bassline_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_bassline_id UUID;
BEGIN
    -- If bassline_id is provided, update existing
    IF p_bassline_id IS NOT NULL THEN
        UPDATE custom_basslines 
        SET notes = p_notes,
            metadata = p_metadata,
            updated_at = NOW()
        WHERE id = p_bassline_id 
          AND user_id = p_user_id 
          AND deleted_at IS NULL;
        
        v_bassline_id := p_bassline_id;
    ELSE
        -- Create new auto-save bassline
        INSERT INTO custom_basslines (user_id, name, notes, metadata)
        VALUES (p_user_id, p_name, p_notes, p_metadata)
        RETURNING id INTO v_bassline_id;
    END IF;
    
    RETURN v_bassline_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for soft delete
CREATE OR REPLACE FUNCTION soft_delete_bassline(
    p_user_id UUID,
    p_bassline_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE custom_basslines 
    SET deleted_at = NOW()
    WHERE id = p_bassline_id 
      AND user_id = p_user_id 
      AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for bassline duplication
CREATE OR REPLACE FUNCTION duplicate_bassline(
    p_user_id UUID,
    p_bassline_id UUID,
    p_new_name VARCHAR(255),
    p_include_description BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
    v_new_bassline_id UUID;
    v_original_description TEXT;
BEGIN
    -- Get original bassline data
    SELECT description INTO v_original_description
    FROM custom_basslines 
    WHERE id = p_bassline_id 
      AND user_id = p_user_id 
      AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bassline not found or access denied';
    END IF;
    
    -- Create duplicate
    INSERT INTO custom_basslines (
        user_id, name, description, notes, metadata, version
    )
    SELECT 
        p_user_id,
        p_new_name,
        CASE WHEN p_include_description THEN v_original_description ELSE NULL END,
        notes,
        metadata,
        1 -- Reset version for duplicate
    FROM custom_basslines 
    WHERE id = p_bassline_id 
      AND user_id = p_user_id 
      AND deleted_at IS NULL
    RETURNING id INTO v_new_bassline_id;
    
    RETURN v_new_bassline_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update table comment
COMMENT ON TABLE custom_basslines IS 'Enhanced custom basslines for Epic 3 Story 3.8 with metadata, versioning, and soft delete support';
COMMENT ON COLUMN custom_basslines.metadata IS 'JSONB object containing tempo, timeSignature, key, difficulty, and tags';
COMMENT ON COLUMN custom_basslines.version IS 'Version number for data format compatibility';
COMMENT ON COLUMN custom_basslines.deleted_at IS 'Soft delete timestamp'; 