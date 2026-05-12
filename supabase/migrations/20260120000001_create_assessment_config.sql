-- =============================================================================
-- Assessment Configuration Table
-- Stores the single active assessment with video ID and questions
-- =============================================================================

-- Assessment config table (only one active at a time)
CREATE TABLE IF NOT EXISTS assessment_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Video configuration
  video_id TEXT NOT NULL,              -- Vimeo video ID
  video_platform TEXT DEFAULT 'vimeo', -- Future: 'youtube', etc.

  -- Questions stored as JSONB array
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Skill level thresholds
  skill_thresholds JSONB NOT NULL DEFAULT '{"advanced": 80, "intermediate": 50}'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  name TEXT,                           -- Optional name for identification
  description TEXT,                    -- Optional description
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id)
);

-- Ensure only one active assessment at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_config_single_active
ON assessment_config (is_active)
WHERE is_active = TRUE;

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_assessment_config_active
ON assessment_config (is_active);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE assessment_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read active assessment config
CREATE POLICY "Anyone can read active assessment config"
ON assessment_config FOR SELECT
USING (is_active = TRUE);

-- Only admins can manage assessment config
CREATE POLICY "Admins can manage assessment config"
ON assessment_config FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- =============================================================================
-- Updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_assessment_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assessment_config_updated_at
  BEFORE UPDATE ON assessment_config
  FOR EACH ROW
  EXECUTE FUNCTION update_assessment_config_updated_at();

-- =============================================================================
-- Seed default assessment from existing data
-- =============================================================================

INSERT INTO assessment_config (
  video_id,
  video_platform,
  name,
  description,
  questions,
  skill_thresholds,
  is_active
) VALUES (
  '76979871',
  'vimeo',
  'BassNotion Entrance Assessment',
  'The main assessment quiz for determining user skill level, goals, and preferences.',
  '[
    {
      "id": "q1-instrument",
      "type": "multiple-choice",
      "category": "knowledge",
      "timestamp": 15,
      "question": "What instrument is this?",
      "description": "Listen to the audio and identify the instrument.",
      "options": [
        { "id": "q1-a", "text": "Harp", "isCorrect": true },
        { "id": "q1-b", "text": "Piano", "isCorrect": false },
        { "id": "q1-c", "text": "Guitar", "isCorrect": false },
        { "id": "q1-d", "text": "Koto", "isCorrect": false }
      ],
      "points": 10,
      "difficulty": "beginner"
    },
    {
      "id": "q2-time-signature",
      "type": "multiple-choice",
      "category": "knowledge",
      "timestamp": 35,
      "question": "What''s the time signature of this groove?",
      "description": "Count the beats and identify the time signature.",
      "options": [
        { "id": "q2-a", "text": "4/4", "isCorrect": false },
        { "id": "q2-b", "text": "3/4", "isCorrect": false },
        { "id": "q2-c", "text": "6/8", "isCorrect": true },
        { "id": "q2-d", "text": "5/4", "isCorrect": false }
      ],
      "points": 15,
      "difficulty": "intermediate"
    },
    {
      "id": "q3-open-strings",
      "type": "drag-drop",
      "category": "knowledge",
      "timestamp": 55,
      "question": "Name the open strings on a 4-string bass",
      "description": "Drag the note names to the correct string positions (low to high).",
      "dragDropConfig": {
        "draggableItems": ["E", "A", "D", "G", "B", "C"],
        "dropZones": ["String 4 (lowest)", "String 3", "String 2", "String 1 (highest)"],
        "correctMapping": {
          "String 4 (lowest)": "E",
          "String 3": "A",
          "String 2": "D",
          "String 1 (highest)": "G"
        }
      },
      "points": 20,
      "difficulty": "beginner"
    },
    {
      "id": "q4-harmonics",
      "type": "multiple-choice",
      "category": "knowledge",
      "timestamp": 80,
      "question": "Who is famous for using false harmonics on bass?",
      "options": [
        { "id": "q4-a", "text": "Flea", "isCorrect": false },
        { "id": "q4-b", "text": "Marcus Miller", "isCorrect": false },
        { "id": "q4-c", "text": "Jaco Pastorius", "isCorrect": true },
        { "id": "q4-d", "text": "Victor Wooten", "isCorrect": false }
      ],
      "points": 15,
      "difficulty": "intermediate"
    },
    {
      "id": "q5-note-name",
      "type": "text-input",
      "category": "knowledge",
      "timestamp": 100,
      "question": "What note is being played?",
      "description": "Type the name of the note you hear.",
      "textInputConfig": {
        "acceptableAnswers": ["e", "E", "e note", "the note e"],
        "placeholder": "Enter note name...",
        "caseSensitive": false
      },
      "points": 10,
      "difficulty": "beginner"
    },
    {
      "id": "q6-goal",
      "type": "multiple-choice",
      "category": "goal",
      "timestamp": 120,
      "question": "What''s your main goal with learning bass?",
      "description": "This helps us personalize your learning journey.",
      "options": [
        { "id": "q6-a", "text": "Play in a band" },
        { "id": "q6-b", "text": "Learn my favorite songs" },
        { "id": "q6-c", "text": "Master advanced techniques" },
        { "id": "q6-d", "text": "Just have fun jamming" }
      ]
    },
    {
      "id": "q7-techniques",
      "type": "multi-select",
      "category": "preference",
      "timestamp": 140,
      "question": "Which techniques interest you most?",
      "description": "Select all that apply.",
      "options": [
        { "id": "q7-a", "text": "Fingerstyle" },
        { "id": "q7-b", "text": "Slap" },
        { "id": "q7-c", "text": "Pick" },
        { "id": "q7-d", "text": "Tapping" }
      ]
    },
    {
      "id": "q8-genres",
      "type": "multi-select",
      "category": "preference",
      "timestamp": 160,
      "question": "What genres do you want to play?",
      "description": "Select all that appeal to you.",
      "options": [
        { "id": "q8-a", "text": "Funk" },
        { "id": "q8-b", "text": "Rock" },
        { "id": "q8-c", "text": "Jazz" },
        { "id": "q8-d", "text": "Metal" }
      ]
    }
  ]'::jsonb,
  '{"advanced": 80, "intermediate": 50}'::jsonb,
  TRUE
);

-- =============================================================================
-- Comment
-- =============================================================================

COMMENT ON TABLE assessment_config IS 'Stores assessment quiz configuration including video ID and questions. Only one assessment can be active at a time.';
COMMENT ON COLUMN assessment_config.questions IS 'Array of AssessmentQuestion objects stored as JSONB';
COMMENT ON COLUMN assessment_config.skill_thresholds IS 'Percentage thresholds for skill level determination: { advanced: number, intermediate: number }';
