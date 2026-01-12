-- Add multi-track data fields to exercises table for unified data architecture
-- This migration adds JSONB fields for drum patterns, harmony voicings, and track configuration

-- Add drum_pattern JSONB field for drum track data
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS drum_pattern JSONB DEFAULT '{"enabled": false, "pattern": []}'::jsonb;

-- Add harmony_voicing JSONB field for harmony track data  
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS harmony_voicing JSONB DEFAULT '{"enabled": false, "voicing": []}'::jsonb;

-- Add track_configuration JSONB field for multi-track setup
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS track_configuration JSONB DEFAULT '{
  "tracks": {
    "bass": {"enabled": true, "volume": 0.8, "pan": 0},
    "drums": {"enabled": false, "volume": 0.7, "pan": 0},
    "harmony": {"enabled": false, "volume": 0.6, "pan": 0}
  },
  "globalSettings": {
    "masterVolume": 0.8,
    "tempo": 120,
    "metronome": {"enabled": false, "volume": 0.5}
  }
}'::jsonb;

-- Create GIN indexes for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_exercises_drum_pattern_gin 
ON exercises USING GIN (drum_pattern);

CREATE INDEX IF NOT EXISTS idx_exercises_harmony_voicing_gin 
ON exercises USING GIN (harmony_voicing);

CREATE INDEX IF NOT EXISTS idx_exercises_track_configuration_gin 
ON exercises USING GIN (track_configuration);

-- Create partial indexes for enabled tracks to optimize queries
CREATE INDEX IF NOT EXISTS idx_exercises_drums_enabled 
ON exercises ((drum_pattern->>'enabled')) 
WHERE (drum_pattern->>'enabled')::boolean = true;

CREATE INDEX IF NOT EXISTS idx_exercises_harmony_enabled 
ON exercises ((harmony_voicing->>'enabled')) 
WHERE (harmony_voicing->>'enabled')::boolean = true;

-- Add comments explaining the new fields
COMMENT ON COLUMN exercises.drum_pattern IS 'JSONB field storing drum pattern data with format: {"enabled": boolean, "pattern": [{"timestamp": number, "type": string, "velocity": number}]}';

COMMENT ON COLUMN exercises.harmony_voicing IS 'JSONB field storing harmony voicing data with format: {"enabled": boolean, "voicing": [{"timestamp": number, "chord": string, "notes": [string]}]}';

COMMENT ON COLUMN exercises.track_configuration IS 'JSONB field storing multi-track configuration including volume, pan, and global settings for bass, drums, and harmony tracks';

-- Update existing exercises with sample multi-track data for testing
UPDATE exercises 
SET 
  drum_pattern = CASE 
    WHEN title LIKE '%Funk%' THEN '{
      "enabled": true,
      "pattern": [
        {"timestamp": 0, "type": "kick", "velocity": 0.9},
        {"timestamp": 500, "type": "snare", "velocity": 0.8},
        {"timestamp": 1000, "type": "kick", "velocity": 0.9},
        {"timestamp": 1500, "type": "hihat", "velocity": 0.6}
      ]
    }'::jsonb
    WHEN title LIKE '%Blues%' THEN '{
      "enabled": true,
      "pattern": [
        {"timestamp": 0, "type": "kick", "velocity": 0.8},
        {"timestamp": 1000, "type": "snare", "velocity": 0.7},
        {"timestamp": 2000, "type": "kick", "velocity": 0.8},
        {"timestamp": 3000, "type": "snare", "velocity": 0.7}
      ]
    }'::jsonb
    ELSE drum_pattern
  END,
  harmony_voicing = CASE 
    WHEN title LIKE '%II-V-I%' THEN '{
      "enabled": true,
      "voicing": [
        {"timestamp": 0, "chord": "Dm7", "notes": ["D", "F", "A", "C"]},
        {"timestamp": 3000, "chord": "G7", "notes": ["G", "B", "D", "F"]},
        {"timestamp": 6000, "chord": "CMaj7", "notes": ["C", "E", "G", "B"]}
      ]
    }'::jsonb
    WHEN title LIKE '%Modal%' THEN '{
      "enabled": true,
      "voicing": [
        {"timestamp": 0, "chord": "Dm7", "notes": ["D", "F", "A", "C"]},
        {"timestamp": 4000, "chord": "G7", "notes": ["G", "B", "D", "F"]},
        {"timestamp": 8000, "chord": "Am7", "notes": ["A", "C", "E", "G"]}
      ]
    }'::jsonb
    ELSE harmony_voicing
  END,
  track_configuration = '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.8, "pan": 0},
      "drums": {"enabled": true, "volume": 0.7, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.6, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.8,
      "tempo": 120,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb
WHERE drum_pattern = '{"enabled": false, "pattern": []}'::jsonb 
   OR harmony_voicing = '{"enabled": false, "voicing": []}'::jsonb;