-- Add MIDI URL fields for each widget type to exercises table
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS drummer_midi_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS bassline_midi_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS harmony_midi_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS metronome_midi_url VARCHAR(500);

-- Add comments for documentation
COMMENT ON COLUMN exercises.drummer_midi_url IS 'URL to the MIDI file for drum track';
COMMENT ON COLUMN exercises.bassline_midi_url IS 'URL to the MIDI file for bass track';
COMMENT ON COLUMN exercises.harmony_midi_url IS 'URL to the MIDI file for harmony/keys track';
COMMENT ON COLUMN exercises.metronome_midi_url IS 'URL to the MIDI file for metronome track';

-- Create indexes for faster queries when filtering by MIDI availability
CREATE INDEX IF NOT EXISTS idx_exercises_has_drummer_midi
ON exercises(drummer_midi_url)
WHERE drummer_midi_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_has_bassline_midi
ON exercises(bassline_midi_url)
WHERE bassline_midi_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_has_harmony_midi
ON exercises(harmony_midi_url)
WHERE harmony_midi_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_has_metronome_midi
ON exercises(metronome_midi_url)
WHERE metronome_midi_url IS NOT NULL;