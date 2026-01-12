-- Story 3.15: Professional Musical Time System
-- Transform existing exercises table to professional structure like Logic Pro X and Ableton Live

-- Phase 1: Add new professional columns
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS total_bars INTEGER NOT NULL DEFAULT 4,
ADD COLUMN IF NOT EXISTS tempo INTEGER NOT NULL DEFAULT 120,
ADD COLUMN IF NOT EXISTS key_signature VARCHAR(10) NOT NULL DEFAULT 'C',
ADD COLUMN IF NOT EXISTS time_signature JSONB NOT NULL DEFAULT '{"numerator": 4, "denominator": 4}',
ADD COLUMN IF NOT EXISTS musical_content JSONB NOT NULL DEFAULT '{
  "bass": {"enabled": true, "notes": []},
  "drums": {"enabled": true, "resolution": 480, "patterns": [], "arrangement": []},
  "harmony": {"enabled": true, "progression": []}
}',
ADD COLUMN IF NOT EXISTS mix_settings JSONB NOT NULL DEFAULT '{
  "levels": {"bass": 0.8, "drums": 0.7, "harmony": 0.6},
  "master": 0.8
}';

-- Phase 2: Migrate existing data to new professional structure
UPDATE exercises SET 
  total_bars = CASE 
    WHEN duration <= 8000 THEN 2    -- 2 bars for very short exercises
    WHEN duration <= 16000 THEN 4   -- 4 bars for short exercises
    WHEN duration <= 32000 THEN 8   -- 8 bars for medium exercises
    WHEN duration <= 48000 THEN 12  -- 12 bars for long exercises
    ELSE 16                         -- 16 bars for very long exercises
  END,
  tempo = COALESCE(bpm, 120),
  key_signature = COALESCE(key, 'C'),
  musical_content = jsonb_build_object(
    'bass', jsonb_build_object(
      'enabled', true, 
      'notes', COALESCE(notes, '[]'::jsonb)
    ),
    'drums', CASE 
      WHEN drum_pattern IS NOT NULL AND drum_pattern != '{"enabled": false, "pattern": []}'::jsonb 
      THEN jsonb_build_object(
        'enabled', COALESCE(drum_pattern->>'enabled', 'false')::boolean,
        'resolution', 480,
        'patterns', CASE 
          WHEN drum_pattern->'pattern' IS NOT NULL 
          THEN jsonb_build_array(jsonb_build_object(
            'name', 'main_groove',
            'bars', 1,
            'events', '[]'::jsonb
          ))
          ELSE '[]'::jsonb
        END,
        'arrangement', '["main_groove"]'::jsonb
      )
      ELSE '{"enabled": false, "resolution": 480, "patterns": [], "arrangement": []}'::jsonb
    END,
    'harmony', CASE 
      WHEN harmony_voicing IS NOT NULL AND harmony_voicing != '{"enabled": false, "voicing": []}'::jsonb
      THEN jsonb_build_object(
        'enabled', COALESCE(harmony_voicing->>'enabled', 'false')::boolean,
        'progression', COALESCE(harmony_voicing->'voicing', '[]'::jsonb)
      )
      ELSE '{"enabled": false, "progression": []}'::jsonb
    END
  ),
  mix_settings = CASE 
    WHEN track_configuration IS NOT NULL AND track_configuration->'tracks' IS NOT NULL
    THEN jsonb_build_object(
      'levels', jsonb_build_object(
        'bass', COALESCE(track_configuration->'tracks'->'bass'->>'volume', '0.8')::numeric,
        'drums', COALESCE(track_configuration->'tracks'->'drums'->>'volume', '0.7')::numeric,
        'harmony', COALESCE(track_configuration->'tracks'->'harmony'->>'volume', '0.6')::numeric
      ),
      'master', COALESCE(track_configuration->'globalSettings'->>'masterVolume', '0.8')::numeric
    )
    ELSE '{"levels": {"bass": 0.8, "drums": 0.7, "harmony": 0.6}, "master": 0.8}'::jsonb
  END
WHERE 
  total_bars IS NULL OR 
  tempo IS NULL OR 
  key_signature IS NULL OR 
  musical_content = '{}'::jsonb OR 
  mix_settings = '{}'::jsonb;

-- Phase 3: Add proper indexes for professional queries
CREATE INDEX IF NOT EXISTS idx_exercises_tempo ON exercises(tempo);
CREATE INDEX IF NOT EXISTS idx_exercises_total_bars ON exercises(total_bars);
CREATE INDEX IF NOT EXISTS idx_exercises_key_signature ON exercises(key_signature);
CREATE INDEX IF NOT EXISTS idx_exercises_musical_content_gin ON exercises USING GIN (musical_content);
CREATE INDEX IF NOT EXISTS idx_exercises_mix_settings_gin ON exercises USING GIN (mix_settings);
CREATE INDEX IF NOT EXISTS idx_exercises_time_signature_gin ON exercises USING GIN (time_signature);

-- Phase 4: Add comments explaining the professional structure
COMMENT ON COLUMN exercises.total_bars IS 'Total number of bars in the exercise (musical time, tempo-independent)';
COMMENT ON COLUMN exercises.tempo IS 'Tempo in BPM (beats per minute) - single source of truth';
COMMENT ON COLUMN exercises.key_signature IS 'Musical key signature (e.g., C, D, E, F#, Bb)';
COMMENT ON COLUMN exercises.time_signature IS 'Time signature as JSONB: {"numerator": 4, "denominator": 4}';
COMMENT ON COLUMN exercises.musical_content IS 'Professional musical content with 480 ticks per quarter note resolution';
COMMENT ON COLUMN exercises.mix_settings IS 'Professional mixing levels and master volume settings';

-- Phase 5: Drop existing view and create new professional view
DROP VIEW IF EXISTS exercises_with_runtime;
CREATE VIEW exercises_with_runtime AS
SELECT 
  e.*,
  -- Calculate runtime duration in milliseconds based on current tempo
  -- Formula: (total_bars * beats_per_bar * 60000) / tempo
  (e.total_bars * (e.time_signature->>'numerator')::integer * 60000.0 / e.tempo) AS runtime_duration_ms,
  -- Calculate runtime duration in seconds
  (e.total_bars * (e.time_signature->>'numerator')::integer * 60.0 / e.tempo) AS runtime_duration_seconds,
  -- Calculate total beats
  (e.total_bars * (e.time_signature->>'numerator')::integer) AS total_beats,
  -- Calculate total ticks (480 ticks per quarter note)
  (e.total_bars * (e.time_signature->>'numerator')::integer * 480) AS total_ticks
FROM exercises e
WHERE e.is_active = true;

-- Create helper function for musical time conversions
CREATE OR REPLACE FUNCTION musical_time_to_milliseconds(
  bars INTEGER,
  beats INTEGER,
  subdivision INTEGER,
  tempo INTEGER,
  time_signature JSONB DEFAULT '{"numerator": 4, "denominator": 4}'
) RETURNS INTEGER AS $$
DECLARE
  beats_per_bar INTEGER := (time_signature->>'numerator')::integer;
  ticks_per_beat INTEGER := 480;
  total_ticks INTEGER;
  milliseconds_per_tick NUMERIC;
BEGIN
  -- Convert musical position to ticks
  total_ticks := ((bars - 1) * beats_per_bar * ticks_per_beat) + 
                 ((beats - 1) * ticks_per_beat) + 
                 (subdivision * (ticks_per_beat / 4));
  
  -- Convert ticks to milliseconds
  milliseconds_per_tick := 60000.0 / (tempo * ticks_per_beat);
  
  RETURN (total_ticks * milliseconds_per_tick)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create helper function for tick to milliseconds conversion
CREATE OR REPLACE FUNCTION tick_to_milliseconds(
  tick INTEGER,
  tempo INTEGER,
  resolution INTEGER DEFAULT 480
) RETURNS INTEGER AS $$
DECLARE
  ticks_per_second NUMERIC;
BEGIN
  ticks_per_second := (tempo / 60.0) * resolution;
  RETURN (tick / ticks_per_second * 1000)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Verify the migration by showing sample data
SELECT 
  id,
  title,
  total_bars,
  tempo,
  key_signature,
  time_signature,
  (musical_content->'bass'->>'enabled')::boolean AS bass_enabled,
  (musical_content->'drums'->>'enabled')::boolean AS drums_enabled,
  (musical_content->'harmony'->>'enabled')::boolean AS harmony_enabled,
  (mix_settings->'levels'->>'bass')::numeric AS bass_level,
  (mix_settings->>'master')::numeric AS master_level
FROM exercises 
WHERE is_active = true
ORDER BY created_at DESC 
LIMIT 5;