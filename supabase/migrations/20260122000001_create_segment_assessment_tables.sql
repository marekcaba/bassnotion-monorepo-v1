-- =============================================================================
-- Segment-Based Assessment System
-- =============================================================================
-- This migration creates tables for the new branching assessment flow:
-- - Video segments library
-- - Flow graph (nodes + edges)
-- - Normalized questions
-- - Coach insight templates
-- - User sessions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Assessment Segments - Video segment library
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Video configuration (Bunny Stream)
  video_library_id TEXT NOT NULL,
  video_id TEXT NOT NULL,

  -- Segment metadata
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  duration_seconds INTEGER,

  -- Categorization
  topic TEXT NOT NULL CHECK (topic IN (
    'level_intro',
    'skill_check_response',
    'goals_beginner',
    'goals_intermediate',
    'struggle_true_beginner',
    'struggle_solid_beginner',
    'struggle_beginner_with_gaps',
    'struggle_intermediate_theory_gaps',
    'struggle_solid_intermediate',
    'learning_style',
    'practice_time',
    'genre',
    'genre_acknowledgment',
    'equipment',
    'equipment_response',
    'commitment'
  )),

  -- Targeting (which users see this segment)
  target_buckets TEXT[] DEFAULT '{}',

  -- Ordering within topic
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for segments
CREATE INDEX IF NOT EXISTS idx_assessment_segments_topic ON assessment_segments(topic);
CREATE INDEX IF NOT EXISTS idx_assessment_segments_active ON assessment_segments(is_active) WHERE is_active = TRUE;

-- -----------------------------------------------------------------------------
-- 2. Assessment Flow Nodes - Graph nodes for branching flow
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Node identification
  node_id TEXT NOT NULL UNIQUE,

  -- Node type
  node_type TEXT NOT NULL CHECK (node_type IN (
    'segment',           -- Video segment to watch
    'question',          -- Question overlay (no video)
    'skill_verification', -- Skill check with feedback
    'branch',            -- Decision point (no content, routing only)
    'result'             -- Final results node
  )),

  -- Content references (depends on node_type)
  segment_id UUID REFERENCES assessment_segments(id) ON DELETE SET NULL,
  question_key TEXT,  -- References assessment_questions.question_key

  -- Display info
  title TEXT,
  description TEXT,

  -- Position for visual editor (pixels)
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_entry_point BOOLEAN DEFAULT FALSE,  -- Only one node should be entry point

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active nodes
CREATE INDEX IF NOT EXISTS idx_assessment_flow_nodes_active ON assessment_flow_nodes(is_active) WHERE is_active = TRUE;

-- Ensure only one entry point
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_flow_nodes_entry
ON assessment_flow_nodes(is_entry_point) WHERE is_entry_point = TRUE;

-- -----------------------------------------------------------------------------
-- 3. Assessment Flow Edges - Transitions between nodes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_flow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Connection
  from_node_id UUID NOT NULL REFERENCES assessment_flow_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES assessment_flow_nodes(id) ON DELETE CASCADE,

  -- Condition for taking this edge
  condition_type TEXT NOT NULL CHECK (condition_type IN (
    'always',         -- Default path, no condition
    'answer_equals',  -- Take if answer matches value
    'bucket_equals',  -- Take if user's bucket matches
    'skill_verified', -- Take if skill check passed
    'skill_failed'    -- Take if skill check failed
  )),

  -- Condition value (JSON for flexibility)
  -- Examples:
  -- answer_equals: {"question_key": "level_self_report", "value": "beginner"}
  -- bucket_equals: {"bucket": "true_beginner"}
  condition_value JSONB,

  -- Priority (lower = higher priority, for multiple matching edges)
  priority INTEGER DEFAULT 0,

  -- Edge label for display
  label TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for edge traversal
CREATE INDEX IF NOT EXISTS idx_assessment_flow_edges_from ON assessment_flow_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_assessment_flow_edges_to ON assessment_flow_edges(to_node_id);

-- -----------------------------------------------------------------------------
-- 4. Assessment Questions - Normalized question storage
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Question identification
  question_key TEXT NOT NULL UNIQUE,

  -- Content
  question_text TEXT NOT NULL,
  description TEXT,

  -- Question type
  question_type TEXT NOT NULL CHECK (question_type IN (
    'multiple-choice',    -- Single select
    'multi-select',       -- Multiple select
    'text-input',         -- Free text
    'skill-verification'  -- With correct answer and feedback
  )),

  -- Options for choice-based questions
  -- Format: [{id, text, value, next_bucket?, is_correct?}]
  options JSONB,

  -- Skill verification config (for skill-verification type)
  -- Format: {correct_answer, wrong_answer_feedback, audio_url?}
  verification_config JSONB,

  -- Audio config (optional)
  -- Format: {url, label?}
  audio_config JSONB,

  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'level',        -- Level self-report
    'verification', -- Skill verification
    'goal',         -- Goals question
    'struggle',     -- Pain point question
    'style',        -- Learning style, practice, genre, equipment
    'commitment'    -- Ready to start
  )),

  -- Scoring (for verification questions)
  points INTEGER DEFAULT 0,

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for question lookup
CREATE INDEX IF NOT EXISTS idx_assessment_questions_key ON assessment_questions(question_key);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_category ON assessment_questions(category);

-- -----------------------------------------------------------------------------
-- 5. Coach Insight Templates - Personalized result messages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_insight_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Targeting criteria (all must match for template to apply)
  target_bucket TEXT NOT NULL CHECK (target_bucket IN (
    'true_beginner',
    'solid_beginner',
    'beginner_with_gaps',
    'intermediate_theory_gaps',
    'solid_intermediate'
  )),

  -- Optional additional targeting (null = matches any)
  target_goal TEXT,      -- Primary goal value
  target_struggle TEXT,  -- Struggle/pain point value
  target_practice_time TEXT,  -- Practice time value

  -- Content
  insight_title TEXT NOT NULL,
  insight_body TEXT NOT NULL,  -- Supports markdown, template variables: {userName}, {goal}, etc.

  -- Coach persona
  coach_name TEXT DEFAULT 'Coach',
  coach_avatar_url TEXT,

  -- Skill check acknowledgment text
  skill_check_acknowledgment TEXT,

  -- 3-Day Plan customization
  day1_title TEXT,
  day1_description TEXT,
  day2_title TEXT,
  day2_description TEXT,
  day3_title TEXT,
  day3_description TEXT,

  -- Call to action
  cta_text TEXT DEFAULT 'Save Your Plan',
  cta_link TEXT,

  -- Priority for template matching (higher = preferred)
  priority INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for template matching
CREATE INDEX IF NOT EXISTS idx_coach_insight_templates_bucket ON coach_insight_templates(target_bucket);
CREATE INDEX IF NOT EXISTS idx_coach_insight_templates_active ON coach_insight_templates(is_active) WHERE is_active = TRUE;

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_coach_insight_templates_match
ON coach_insight_templates(target_bucket, target_goal, target_struggle, priority DESC)
WHERE is_active = TRUE;

-- -----------------------------------------------------------------------------
-- 6. User Assessment Sessions - Session state for resume
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference (nullable for anonymous sessions)
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Current position in flow
  current_node_id UUID REFERENCES assessment_flow_nodes(id) ON DELETE SET NULL,

  -- All answers collected
  -- Format: {question_key: answer_value, ...}
  answers JSONB NOT NULL DEFAULT '{}',

  -- Visited nodes for history/back navigation
  visited_node_ids TEXT[] DEFAULT '{}',

  -- Determined values
  self_reported_level TEXT,
  determined_bucket TEXT CHECK (determined_bucket IS NULL OR determined_bucket IN (
    'true_beginner',
    'solid_beginner',
    'beginner_with_gaps',
    'intermediate_theory_gaps',
    'solid_intermediate'
  )),
  skill_check_passed BOOLEAN,
  skill_check_score INTEGER,

  -- Session timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Session status
  status TEXT DEFAULT 'in_progress' CHECK (status IN (
    'in_progress',
    'completed',
    'abandoned'
  ))
);

-- Index for finding user's current session
CREATE INDEX IF NOT EXISTS idx_user_assessment_sessions_user
ON user_assessment_sessions(user_id, status) WHERE status = 'in_progress';

-- Index for session cleanup
CREATE INDEX IF NOT EXISTS idx_user_assessment_sessions_activity
ON user_assessment_sessions(last_activity_at) WHERE status = 'in_progress';

-- -----------------------------------------------------------------------------
-- 7. Add level_bucket column to profiles table
-- -----------------------------------------------------------------------------
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS level_bucket TEXT CHECK (level_bucket IS NULL OR level_bucket IN (
  'true_beginner',
  'solid_beginner',
  'beginner_with_gaps',
  'intermediate_theory_gaps',
  'solid_intermediate'
));

-- Index for filtering by bucket
CREATE INDEX IF NOT EXISTS idx_profiles_level_bucket ON profiles(level_bucket) WHERE level_bucket IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 8. Triggers for updated_at timestamps
-- -----------------------------------------------------------------------------

-- Generic trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_assessment_segments_updated_at ON assessment_segments;
CREATE TRIGGER update_assessment_segments_updated_at
  BEFORE UPDATE ON assessment_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessment_flow_nodes_updated_at ON assessment_flow_nodes;
CREATE TRIGGER update_assessment_flow_nodes_updated_at
  BEFORE UPDATE ON assessment_flow_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessment_questions_updated_at ON assessment_questions;
CREATE TRIGGER update_assessment_questions_updated_at
  BEFORE UPDATE ON assessment_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_coach_insight_templates_updated_at ON coach_insight_templates;
CREATE TRIGGER update_coach_insight_templates_updated_at
  BEFORE UPDATE ON coach_insight_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 9. Row Level Security Policies
-- -----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE assessment_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_insight_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_assessment_sessions ENABLE ROW LEVEL SECURITY;

-- Assessment Segments: Public read, admin write
CREATE POLICY "Anyone can read active segments"
  ON assessment_segments FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage segments"
  ON assessment_segments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Flow Nodes: Public read, admin write
CREATE POLICY "Anyone can read active flow nodes"
  ON assessment_flow_nodes FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage flow nodes"
  ON assessment_flow_nodes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Flow Edges: Public read, admin write
CREATE POLICY "Anyone can read flow edges"
  ON assessment_flow_edges FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage flow edges"
  ON assessment_flow_edges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Questions: Public read, admin write
CREATE POLICY "Anyone can read active questions"
  ON assessment_questions FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage questions"
  ON assessment_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Coach Insight Templates: Public read, admin write
CREATE POLICY "Anyone can read active insights"
  ON coach_insight_templates FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage insights"
  ON coach_insight_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- User Sessions: User can manage own, admin can read all
CREATE POLICY "Users can manage own sessions"
  ON user_assessment_sessions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all sessions"
  ON user_assessment_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow anonymous session creation (for unauthenticated users starting assessment)
CREATE POLICY "Anyone can create anonymous sessions"
  ON user_assessment_sessions FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 10. Seed initial placeholder data
-- -----------------------------------------------------------------------------

-- Insert a placeholder segment for testing
INSERT INTO assessment_segments (video_library_id, video_id, name, slug, description, topic, sort_order)
VALUES
  ('583585', 'placeholder-level-intro', 'Level Introduction', 'level-intro', 'Introduction video for level assessment', 'level_intro', 1),
  ('583585', 'placeholder-goals-beginner', 'Goals - Beginner Path', 'goals-beginner', 'Goals video for beginner users', 'goals_beginner', 1),
  ('583585', 'placeholder-goals-intermediate', 'Goals - Intermediate Path', 'goals-intermediate', 'Goals video for intermediate users', 'goals_intermediate', 1)
ON CONFLICT (slug) DO NOTHING;

-- Insert entry point node
INSERT INTO assessment_flow_nodes (node_id, node_type, title, is_entry_point, position_x, position_y)
VALUES ('start', 'segment', 'Assessment Start', TRUE, 100, 100)
ON CONFLICT (node_id) DO NOTHING;

-- Insert placeholder questions
INSERT INTO assessment_questions (question_key, question_text, question_type, category, options)
VALUES
  (
    'level_self_report',
    'Be honest—where are you right now?',
    'multiple-choice',
    'level',
    '[
      {"id": "complete_beginner", "text": "Complete beginner – never really played bass", "value": "complete_beginner"},
      {"id": "know_basics", "text": "I know some basics but still struggle", "value": "know_basics"},
      {"id": "intermediate", "text": "Intermediate – I can play stuff, but I''ve hit a wall", "value": "intermediate"},
      {"id": "advanced", "text": "Advanced – I''m looking for specific techniques", "value": "advanced"}
    ]'::jsonb
  ),
  (
    'skill_check_fret_note',
    'What note is at the 5th fret on the A string?',
    'skill-verification',
    'verification',
    '[
      {"id": "c", "text": "C", "value": "C", "is_correct": false},
      {"id": "d", "text": "D", "value": "D", "is_correct": true},
      {"id": "e", "text": "E", "value": "E", "is_correct": false},
      {"id": "g", "text": "G", "value": "G", "is_correct": false}
    ]'::jsonb
  ),
  (
    'goal',
    'What''s your main goal with bass?',
    'multiple-choice',
    'goal',
    '[
      {"id": "play_songs", "text": "Play along to my favorite songs", "value": "play_songs"},
      {"id": "join_band", "text": "Join or start a band", "value": "join_band"},
      {"id": "write_music", "text": "Write my own music", "value": "write_music"},
      {"id": "hobby", "text": "Just enjoy it as a hobby", "value": "hobby"},
      {"id": "professional", "text": "Go professional / session level", "value": "professional"}
    ]'::jsonb
  )
ON CONFLICT (question_key) DO NOTHING;

-- Insert placeholder coach insight templates (one per bucket)
INSERT INTO coach_insight_templates (target_bucket, insight_title, insight_body, day1_title, day2_title, day3_title, priority)
VALUES
  (
    'true_beginner',
    'Starting From Zero',
    E'You''re starting from zero. That''s perfect.\n\nNo bad habits to unlearn. We''re going to get you playing something real within days, not months.\n\nYour path is designed for ONE thing: get you playing music as fast as possible.',
    'First sounds, first win',
    'Basic rhythm patterns',
    'Play your first riff',
    10
  ),
  (
    'solid_beginner',
    'Building on Your Basics',
    E'You''ve got the basics. Let''s build on them.\n\nYour fingers know the fundamentals. Now it''s time to develop feel and groove.\n\nYour path focuses on technique and timing to take you to the next level.',
    'Finger technique unlock',
    'Fretboard foundations',
    'Your first groove',
    10
  ),
  (
    'beginner_with_gaps',
    'Filling the Gaps',
    E'You know more than you think, but there are holes.\n\nThat''s not an insult. It''s just what happens when you learn without structure. You picked up piece A, skipped piece B, grabbed piece C.\n\nYour path fills those gaps so everything clicks.',
    'Rhythm reset',
    'Fretboard mapping',
    'Connect the pieces',
    10
  ),
  (
    'intermediate_theory_gaps',
    'Map Your Fretboard',
    E'You can play. Your hands work.\n\nBut when someone says "play the 5th" or "go to the relative minor"—you freeze. Or you guess.\n\nYour path turns what your hands already know into a map you can see. Then you can go anywhere.',
    'Interval logic',
    'Fretboard visualization',
    'Apply it: theory jam',
    10
  ),
  (
    'solid_intermediate',
    'Breaking the Plateau',
    E'You''re not a beginner. Your foundation is solid.\n\nBut you''ve plateaued. The needle isn''t moving.\n\nHere''s what nobody tells intermediate players: The plateau doesn''t break by adding more. It breaks by tightening what you already have.\n\nGroove over speed. Pocket over flash.',
    'Groove tightening',
    'Lock the pocket',
    'Feel and dynamics',
    10
  )
ON CONFLICT DO NOTHING;

-- Update placeholder verification config
UPDATE assessment_questions
SET verification_config = '{"correct_answer": "D", "wrong_answer_feedback": "That''s a gap. Not a big deal—it''s actually one of the most common holes I see. We''re going to fix it."}'::jsonb
WHERE question_key = 'skill_check_fret_note';
