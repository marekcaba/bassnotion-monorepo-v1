-- Migration: Add draft status and MIDI URL support to tutorials
-- Purpose: Support FAANG-style immediate draft creation and MIDI file uploads

-- Add status enum type
DO $$ BEGIN
    CREATE TYPE tutorial_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to tutorials table
ALTER TABLE tutorials
ADD COLUMN IF NOT EXISTS status tutorial_status DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_save_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS drummer_midi_url TEXT,
ADD COLUMN IF NOT EXISTS bassline_midi_url TEXT,
ADD COLUMN IF NOT EXISTS harmony_midi_url TEXT,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Update existing tutorials to be 'published' if they have a published_at date
UPDATE tutorials
SET status = 'published'
WHERE published_at IS NOT NULL AND status IS NULL;

-- Create index for efficient draft cleanup queries
CREATE INDEX IF NOT EXISTS idx_tutorials_draft_cleanup
ON tutorials(status, last_modified)
WHERE status = 'draft' AND deleted_at IS NULL;

-- Create index for soft deletes
CREATE INDEX IF NOT EXISTS idx_tutorials_deleted
ON tutorials(deleted_at)
WHERE deleted_at IS NOT NULL;

-- Add trigger to update last_modified on any update
CREATE OR REPLACE FUNCTION update_tutorial_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tutorials_last_modified ON tutorials;
CREATE TRIGGER update_tutorials_last_modified
    BEFORE UPDATE ON tutorials
    FOR EACH ROW
    EXECUTE FUNCTION update_tutorial_last_modified();

-- Add RLS policy for draft tutorials (admins only)
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;

-- Admins can see all tutorials including drafts
CREATE POLICY "Admins can manage all tutorials" ON tutorials
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Regular users can only see published tutorials
CREATE POLICY "Users can view published tutorials" ON tutorials
    FOR SELECT
    TO authenticated
    USING (status = 'published');

-- Public can also view published tutorials (for non-authenticated access)
CREATE POLICY "Public can view published tutorials" ON tutorials
    FOR SELECT
    TO anon
    USING (status = 'published');

-- Grant necessary permissions
GRANT ALL ON tutorials TO authenticated;
GRANT SELECT ON tutorials TO anon;

-- Add comment for documentation
COMMENT ON COLUMN tutorials.status IS 'Tutorial publication status: draft (work in progress), published (live), archived (hidden)';
COMMENT ON COLUMN tutorials.last_modified IS 'Timestamp of last modification, used for auto-save and cleanup';
COMMENT ON COLUMN tutorials.auto_save_version IS 'Incremental version number for auto-save tracking';
COMMENT ON COLUMN tutorials.drummer_midi_url IS 'URL to uploaded MIDI file for drummer widget';
COMMENT ON COLUMN tutorials.bassline_midi_url IS 'URL to uploaded MIDI file for bassline widget';
COMMENT ON COLUMN tutorials.harmony_midi_url IS 'URL to uploaded MIDI file for harmony widget';
COMMENT ON COLUMN tutorials.deleted_at IS 'Soft delete timestamp for recovery mechanism';