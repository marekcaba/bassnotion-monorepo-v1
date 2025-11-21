-- Fix: Add youtube_id column that backend expects
-- The original table used youtube_url but the backend code expects youtube_id

ALTER TABLE tutorials
ADD COLUMN IF NOT EXISTS youtube_id VARCHAR;

-- Copy existing YouTube IDs from youtube_url if present
UPDATE tutorials
SET youtube_id =
  CASE
    WHEN youtube_url LIKE '%youtube.com/watch?v=%' THEN
      split_part(split_part(youtube_url, 'v=', 2), '&', 1)
    WHEN youtube_url LIKE '%youtu.be/%' THEN
      split_part(youtube_url, 'youtu.be/', 2)
    ELSE NULL
  END
WHERE youtube_id IS NULL AND youtube_url IS NOT NULL;