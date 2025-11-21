-- Add subscriber_count field to tutorials table to store YouTube channel subscriber count
ALTER TABLE tutorials
ADD COLUMN IF NOT EXISTS creator_subscriber_count BIGINT;

-- Add comment for documentation
COMMENT ON COLUMN tutorials.creator_subscriber_count IS 'YouTube channel subscriber count cached from API';