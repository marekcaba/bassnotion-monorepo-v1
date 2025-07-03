-- Create creator_stats table to cache YouTube channel data
CREATE TABLE creator_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_url TEXT UNIQUE NOT NULL,
  channel_id TEXT,
  creator_name TEXT NOT NULL,
  subscriber_count BIGINT,
  subscriber_count_formatted TEXT, -- "1.8M subscribers"
  thumbnail_url TEXT,
  last_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_creator_stats_channel_url ON creator_stats(channel_url);
CREATE INDEX idx_creator_stats_last_fetched ON creator_stats(last_fetched_at);
CREATE INDEX idx_creator_stats_channel_id ON creator_stats(channel_id);

-- Enable RLS
ALTER TABLE creator_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read creator stats (public data)
CREATE POLICY "Allow public read access to creator_stats"
ON creator_stats FOR SELECT
USING (true);

-- Policy: Only service role can insert/update (for batch jobs)
CREATE POLICY "Allow service role to manage creator_stats"
ON creator_stats FOR ALL
USING (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_creator_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_creator_stats_updated_at
    BEFORE UPDATE ON creator_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_creator_stats_updated_at();

-- Create a view to get fresh creator stats (updated within 24 hours)
CREATE VIEW fresh_creator_stats AS
SELECT *
FROM creator_stats
WHERE last_fetched_at > NOW() - INTERVAL '24 hours';

-- Comment on table
COMMENT ON TABLE creator_stats IS 'Cached YouTube creator statistics updated daily via batch job';
COMMENT ON COLUMN creator_stats.channel_url IS 'Original YouTube channel URL from tutorials';
COMMENT ON COLUMN creator_stats.channel_id IS 'Extracted YouTube channel ID for API calls';
COMMENT ON COLUMN creator_stats.subscriber_count IS 'Raw subscriber count number';
COMMENT ON COLUMN creator_stats.subscriber_count_formatted IS 'Human readable format like "1.8M subscribers"';
COMMENT ON COLUMN creator_stats.last_fetched_at IS 'When this data was last fetched from YouTube API'; 