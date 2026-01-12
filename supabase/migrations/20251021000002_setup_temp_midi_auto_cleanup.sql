-- Story 4.4 - Task 2.4: Automatic cleanup of temporary MIDI files
-- Uses Supabase's pg_cron extension to delete files older than 2 hours
-- Runs every hour at 5 minutes past the hour (e.g., 1:05, 2:05, 3:05)
-- No API calls needed - runs directly in PostgreSQL!

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to clean up expired temp MIDI files
CREATE OR REPLACE FUNCTION cleanup_expired_temp_midi_files()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges
AS $$
DECLARE
  deleted_count integer;
  expiration_threshold timestamptz;
BEGIN
  -- Calculate expiration threshold (2 hours ago)
  expiration_threshold := NOW() - INTERVAL '2 hours';

  -- Delete files from storage.objects where:
  -- 1. Bucket is 'exercise-midi-temp'
  -- 2. File was created more than 2 hours ago
  WITH deleted AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'exercise-midi-temp'
      AND created_at < expiration_threshold
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  -- Log the cleanup operation
  RAISE NOTICE 'Cleaned up % expired temp MIDI files (older than %)',
    deleted_count, expiration_threshold;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_expired_temp_midi_files() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_temp_midi_files() TO service_role;

-- Schedule the cleanup job to run every hour
-- Cron format: '5 * * * *' = "At 5 minutes past every hour"
SELECT cron.schedule(
  'cleanup-temp-midi-files',           -- Job name
  '5 * * * *',                         -- Every hour at :05 minutes
  $$SELECT cleanup_expired_temp_midi_files()$$
);

-- Verify the cron job was created
-- You can check with: SELECT * FROM cron.job;
COMMENT ON FUNCTION cleanup_expired_temp_midi_files() IS
  'Automatically deletes temporary MIDI files older than 2 hours. Scheduled to run every hour via pg_cron.';
