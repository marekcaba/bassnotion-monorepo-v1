-- Create login_attempts table for rate limiting and account lockout
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_attempted_at 
  ON login_attempts(email, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_attempted_at 
  ON login_attempts(ip_address, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_success_attempted_at 
  ON login_attempts(success, attempted_at DESC);

-- Create composite index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_success_attempted_at 
  ON login_attempts(email, success, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_success_attempted_at 
  ON login_attempts(ip_address, success, attempted_at DESC);

-- Create index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at 
  ON login_attempts(attempted_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can read/write login attempts
-- This prevents regular users from accessing login attempt data
CREATE POLICY "login_attempts_service_only" ON login_attempts
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE login_attempts IS 'Tracks login attempts for rate limiting and security monitoring';
COMMENT ON COLUMN login_attempts.email IS 'Email address used in login attempt (lowercase)';
COMMENT ON COLUMN login_attempts.ip_address IS 'IP address of the login attempt';
COMMENT ON COLUMN login_attempts.user_agent IS 'User agent string from the login attempt';
COMMENT ON COLUMN login_attempts.success IS 'Whether the login attempt was successful';
COMMENT ON COLUMN login_attempts.attempted_at IS 'Timestamp when the login was attempted';
COMMENT ON COLUMN login_attempts.created_at IS 'Timestamp when the record was created'; 