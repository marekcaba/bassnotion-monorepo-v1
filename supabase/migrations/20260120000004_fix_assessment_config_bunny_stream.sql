-- =============================================================================
-- Fix assessment_config to use Bunny Stream with correct values
-- =============================================================================

-- Update the active assessment config to use Bunny Stream
UPDATE assessment_config
SET
  video_platform = 'bunny',
  video_library_id = '583585',
  video_id = '032167b4-e074-4c76-ba39-f3ee9d16966d',
  video_hash = NULL
WHERE is_active = true;
