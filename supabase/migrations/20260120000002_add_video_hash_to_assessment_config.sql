-- =============================================================================
-- Add video_hash column to assessment_config
-- This stores the privacy hash for unlisted Vimeo videos
-- =============================================================================

-- Add video_hash column
ALTER TABLE assessment_config
ADD COLUMN IF NOT EXISTS video_hash TEXT;

-- Add comment
COMMENT ON COLUMN assessment_config.video_hash IS 'Privacy hash for unlisted Vimeo videos (the h parameter from vimeo.com/ID/HASH URLs)';
