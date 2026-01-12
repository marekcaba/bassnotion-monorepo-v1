-- Migration: Add fretboard_view_config column to exercises table
-- Purpose: Store per-exercise fretboard display settings (preset, scroll mode, zoom, etc.)
-- Presets: 'default' (follow mode, standard zoom) and 'octave' (locked view, frets 0-13)

ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS fretboard_view_config JSONB DEFAULT '{"preset": "default"}'::jsonb;

-- Add a comment to document the column
COMMENT ON COLUMN exercises.fretboard_view_config IS
  'Fretboard display configuration. Fields: preset (default|octave), scrollMode (locked|follow), zoomLevel (0.5-2.0), initialFret (0-24), visibleFretRange ({start, end}), sceneX (number)';

-- Create a GIN index for efficient JSON queries (optional, for future filtering)
CREATE INDEX IF NOT EXISTS idx_exercises_fretboard_view_config_gin
ON exercises USING GIN (fretboard_view_config);
