-- Migration: Fix creator data with real YouTube channel information
-- Story: YouTube Widget Creator Attribution - Real Data
-- Date: 2025-06-27

-- Clear all existing fake avatar URLs first
UPDATE tutorials 
SET creator_avatar_url = NULL;

-- Update Rick Astley (Never Gonna Give You Up) - Keep as is, this is correct
UPDATE tutorials 
SET 
    creator_name = 'Rick Astley',
    creator_channel_url = 'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw'
WHERE slug = 'never-gonna-give-you-up';

-- Update Michael Jackson (Billie Jean) - This should be Michael Jackson's official channel
UPDATE tutorials 
SET 
    creator_name = 'Michael Jackson',
    creator_channel_url = 'https://www.youtube.com/channel/UC0WP5P-ufpRfjbNrmOWwLBQ'
WHERE slug = 'billie-jean';

-- Update The Beatles (Come Together) - This should be The Beatles' official channel
UPDATE tutorials 
SET 
    creator_name = 'The Beatles',
    creator_channel_url = 'https://www.youtube.com/channel/UCb2HGwORFBo94DmRx4oLzow'
WHERE slug = 'come-together';

-- Update Queen (Another One Bites the Dust) - This should be Queen's official channel
UPDATE tutorials 
SET 
    creator_name = 'Queen Official',
    creator_channel_url = 'https://www.youtube.com/channel/UCiMhD4jzUqG-IgPzUmmytRQ'
WHERE slug = 'another-one-bites-dust';

-- Note: Avatar URLs are set to NULL to use fallback behavior in the frontend
-- In a production environment, you would either:
-- 1. Use YouTube Data API to fetch real avatar URLs automatically
-- 2. Manually curate and store real avatar URLs for each creator
-- 3. Use a service like Gravatar or similar for consistent avatars 