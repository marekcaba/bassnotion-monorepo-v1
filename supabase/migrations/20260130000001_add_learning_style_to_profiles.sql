-- Add learning_style column to profiles table
-- This column stores the user's preferred learning journey progression style

ALTER TABLE profiles
ADD COLUMN learning_style TEXT DEFAULT 'free_flow'
CHECK (learning_style IN ('free_flow', 'guided_practice', 'strict_mode'));

-- Add index for efficient queries when filtering by learning style
CREATE INDEX idx_profiles_learning_style ON profiles(learning_style);

-- Documentation
COMMENT ON COLUMN profiles.learning_style IS
  'User preference for learning journey progression: free_flow (default, no restrictions), guided_practice (soft nudges), strict_mode (must complete before proceeding)';
