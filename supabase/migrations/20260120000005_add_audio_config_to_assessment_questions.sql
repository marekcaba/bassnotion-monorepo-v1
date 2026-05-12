-- =============================================================================
-- Add audioConfig to assessment questions that require audio playback
-- =============================================================================
-- Questions q1, q2, and q5 require users to listen to audio clips.
-- The audio files are stored in Supabase storage: audio-samples/assessment/
-- The URL format is: {SUPABASE_URL}/storage/v1/object/public/audio-samples/assessment/{filename}
-- We store the relative path here; the frontend resolves the full URL at runtime.

-- Use a DO block to handle the string-to-jsonb conversion properly
DO $$
DECLARE
  current_questions jsonb;
  updated_questions jsonb;
  config_id uuid;
BEGIN
  -- Get the active config
  SELECT id,
    CASE
      WHEN jsonb_typeof(questions) = 'string' THEN (questions #>> '{}')::jsonb
      ELSE questions
    END
  INTO config_id, current_questions
  FROM assessment_config
  WHERE is_active = TRUE
  LIMIT 1;

  -- If no config found, exit
  IF config_id IS NULL THEN
    RAISE NOTICE 'No active assessment config found';
    RETURN;
  END IF;

  -- Build the updated questions array
  SELECT jsonb_agg(
    CASE
      WHEN q->>'id' = 'q1-instrument' THEN
        q || '{"audioConfig": {"url": "assessment/q1-instrument.mp3", "label": "Listen to the instrument"}}'::jsonb
      WHEN q->>'id' = 'q2-time-signature' THEN
        q || '{"audioConfig": {"url": "assessment/q2-groove.mp3", "label": "Listen to the groove"}}'::jsonb
      WHEN q->>'id' = 'q5-note-name' THEN
        q || '{"audioConfig": {"url": "assessment/q5-note.mp3", "label": "Listen to the note"}}'::jsonb
      ELSE q
    END
  )
  INTO updated_questions
  FROM jsonb_array_elements(current_questions) AS q;

  -- Update the config
  UPDATE assessment_config
  SET questions = updated_questions
  WHERE id = config_id;

  RAISE NOTICE 'Updated assessment config % with audioConfig', config_id;
END $$;

-- Add comment explaining audioConfig
COMMENT ON COLUMN assessment_config.questions IS 'Array of AssessmentQuestion objects stored as JSONB. Questions may include audioConfig: { url: string, label?: string } for audio-based questions.';
