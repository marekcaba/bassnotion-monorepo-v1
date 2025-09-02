-- Create structured_logs table for centralized logging
CREATE TABLE IF NOT EXISTS public.structured_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level VARCHAR(10) NOT NULL,
  service VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  correlation_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  data JSONB,
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_structured_logs_timestamp ON public.structured_logs(timestamp DESC);
CREATE INDEX idx_structured_logs_correlation_id ON public.structured_logs(correlation_id);
CREATE INDEX idx_structured_logs_user_id ON public.structured_logs(user_id);
CREATE INDEX idx_structured_logs_level ON public.structured_logs(level);
CREATE INDEX idx_structured_logs_service ON public.structured_logs(service);

-- Create composite index for correlation tracing
CREATE INDEX idx_structured_logs_correlation_timestamp 
  ON public.structured_logs(correlation_id, timestamp);

-- Add RLS policies
ALTER TABLE public.structured_logs ENABLE ROW LEVEL SECURITY;

-- Policy for service accounts to write logs
CREATE POLICY "Service accounts can insert logs" ON public.structured_logs
  FOR INSERT WITH CHECK (true);

-- Policy for authenticated users to read their own logs
CREATE POLICY "Users can read their own logs" ON public.structured_logs
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create a function to automatically clean up old logs
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  -- Delete logs older than 30 days (configurable)
  DELETE FROM public.structured_logs
  WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up logs (requires pg_cron extension)
-- Note: This needs to be set up separately in Supabase dashboard
-- SELECT cron.schedule('cleanup-old-logs', '0 2 * * *', 'SELECT cleanup_old_logs();');

-- Create a view for easy log analysis
CREATE VIEW public.log_summary AS
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  level,
  service,
  COUNT(*) as count,
  COUNT(DISTINCT correlation_id) as unique_requests,
  COUNT(DISTINCT user_id) as unique_users
FROM public.structured_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour, level, service
ORDER BY hour DESC, count DESC;

-- Grant necessary permissions
GRANT SELECT ON public.log_summary TO authenticated;
GRANT INSERT ON public.structured_logs TO authenticated;
GRANT USAGE ON SEQUENCE structured_logs_id_seq TO authenticated;