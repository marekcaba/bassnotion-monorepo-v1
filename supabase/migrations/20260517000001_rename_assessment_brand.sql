-- =============================================================================
-- Brand rename: drop 'BassNotion' from the entrance assessment row title
-- =============================================================================
--
-- The original 20260120000001_create_assessment_config.sql seed inserted
-- a row titled 'BassNotion Entrance Assessment'. This row is now decoupled
-- from any brand name (the surrounding UI provides product context).
--
-- Targeted by video_id (stable identifier) rather than the old name so that
-- the migration is idempotent if anyone manually edited the title in between.
-- =============================================================================

UPDATE assessment_config
SET name = 'Entrance Assessment'
WHERE video_id = '76979871'
  AND video_platform = 'vimeo';
