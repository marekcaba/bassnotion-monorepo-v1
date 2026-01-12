-- Story 4.2: Enhance admin role system for tutorial/exercise creation
-- This migration enhances the existing admin role functionality

-- Ensure role column exists with proper constraints
DO $$
BEGIN
  -- Check if role column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role VARCHAR DEFAULT 'user';
  END IF;

  -- Add more role options if needed
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS valid_user_role;
  ALTER TABLE profiles ADD CONSTRAINT valid_user_role
    CHECK (role IN ('user', 'admin', 'moderator', 'creator'));
END $$;

-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Create helper function to check if user has specific role (enhanced version)
CREATE OR REPLACE FUNCTION has_role(required_role VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS VARCHAR AS $$
BEGIN
  RETURN (
    SELECT role FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION has_role(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;

-- Ensure at least one admin exists for testing (optional - comment out in production)
-- UPDATE profiles
-- SET role = 'admin'
-- WHERE email = 'admin@example.com'  -- Replace with your admin email
-- LIMIT 1;