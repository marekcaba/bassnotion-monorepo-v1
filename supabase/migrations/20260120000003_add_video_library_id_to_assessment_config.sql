-- =============================================================================
-- Add video_library_id column for Bunny Stream support
-- =============================================================================

-- Add video_library_id column for Bunny Stream library ID
-- This is required for Bunny Stream video embeds (format: library_id/video_id)
ALTER TABLE assessment_config
ADD COLUMN IF NOT EXISTS video_library_id TEXT DEFAULT '';

-- Add comment explaining the column
COMMENT ON COLUMN assessment_config.video_library_id IS 'Bunny Stream library ID. Required when video_platform is "bunny". Format for embed URL: https://iframe.mediadelivery.net/embed/{library_id}/{video_id}';

-- Update the video_platform column comment to reflect supported platforms
COMMENT ON COLUMN assessment_config.video_platform IS 'Video platform: "bunny" (Bunny Stream - primary) or "vimeo" (legacy support)';
