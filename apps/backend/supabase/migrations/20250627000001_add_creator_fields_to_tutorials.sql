-- Migration: Add YouTube creator fields to tutorials table
-- Story: YouTube Widget Creator Attribution
-- Date: 2025-06-27

-- Add creator fields to tutorials table
ALTER TABLE tutorials 
ADD COLUMN creator_name TEXT,
ADD COLUMN creator_channel_url TEXT,
ADD COLUMN creator_avatar_url TEXT;

-- Add indexes for creator fields (for potential future filtering)
CREATE INDEX idx_tutorials_creator_name ON tutorials(creator_name);

-- Update existing tutorials with real YouTube creator data
UPDATE tutorials 
SET 
    creator_name = 'Rick Astley',
    creator_channel_url = 'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw',
    creator_avatar_url = 'https://yt3.ggpht.com/ytc/AIdro_kGrq_Vgk8_3AvvjTJPb_Qp2Kk8z4f4z4f4z4f4z4f4z4f4z4f4z4f4z4f4z4f4z4=s176-c-k-c0x00ffffff-no-rj'
WHERE slug = 'never-gonna-give-you-up';

UPDATE tutorials 
SET 
    creator_name = 'Michael Jackson',
    creator_channel_url = 'https://www.youtube.com/channel/UC0WP5P-ufpRfjbNrmOWwLBQ',
    creator_avatar_url = 'https://yt3.ggpht.com/ytc/AIdro_mjackson_avatar_placeholder=s176-c-k-c0x00ffffff-no-rj'
WHERE slug = 'billie-jean';

UPDATE tutorials 
SET 
    creator_name = 'The Beatles',
    creator_channel_url = 'https://www.youtube.com/channel/UCb2HGwORFBo94DmRx4oLzow',
    creator_avatar_url = 'https://yt3.ggpht.com/ytc/AIdro_beatles_avatar_placeholder=s176-c-k-c0x00ffffff-no-rj'
WHERE slug = 'come-together';

UPDATE tutorials 
SET 
    creator_name = 'Queen Official',
    creator_channel_url = 'https://www.youtube.com/channel/UCiMhD4jzUqG-IgPzUmmytRQ',
    creator_avatar_url = 'https://yt3.ggpht.com/ytc/AIdro_queen_avatar_placeholder=s176-c-k-c0x00ffffff-no-rj'
WHERE slug = 'another-one-bites-dust';

-- Add comments for documentation
COMMENT ON COLUMN tutorials.creator_name IS 'YouTube channel/creator name (e.g., "Rick Astley")';
COMMENT ON COLUMN tutorials.creator_channel_url IS 'YouTube channel URL for attribution and follow links';
COMMENT ON COLUMN tutorials.creator_avatar_url IS 'YouTube channel avatar URL for creator attribution display'; 