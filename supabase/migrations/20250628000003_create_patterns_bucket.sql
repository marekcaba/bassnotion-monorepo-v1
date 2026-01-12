-- Create dedicated patterns bucket for MIDI files
-- =================================================

-- Create the patterns bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('patterns', 'patterns', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the patterns bucket
CREATE POLICY "Public read access to patterns"
ON storage.objects
FOR SELECT
USING (bucket_id = 'patterns');

CREATE POLICY "Admin can upload patterns"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'patterns'
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admin can update patterns"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'patterns'
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admin can delete patterns"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'patterns'
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Update the function to use patterns bucket
CREATE OR REPLACE FUNCTION get_pattern_storage_url(pattern_path TEXT)
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
  supabase_url TEXT;
BEGIN
  -- Get the Supabase URL from environment or use a default
  supabase_url := COALESCE(
    current_setting('app.supabase_url', true),
    'https://amozinlyqpbierjbnknz.supabase.co'
  );

  -- Build the full URL for patterns bucket
  base_url := CONCAT(
    supabase_url,
    '/storage/v1/object/public/patterns/',
    pattern_path
  );

  RETURN base_url;
END;
$$ LANGUAGE plpgsql;

-- Update existing pattern records to use patterns bucket
UPDATE pattern_library SET
  midi_file_path = CASE slug
    WHEN 'basic-rock-beat' THEN 'drums/basic-rock-beat.mid'
    WHEN 'jazz-swing' THEN 'drums/jazz-swing.mid'
    WHEN 'funk-groove' THEN 'drums/funk-groove.mid'
    WHEN 'simple-chords' THEN 'harmony/simple-chords.mid'
    WHEN 'jazz-voicings' THEN 'harmony/jazz-voicings.mid'
    WHEN 'power-chords' THEN 'harmony/power-chords.mid'
    ELSE midi_file_path
  END,
  midi_file_url = CASE slug
    WHEN 'basic-rock-beat' THEN get_pattern_storage_url('drums/basic-rock-beat.mid')
    WHEN 'jazz-swing' THEN get_pattern_storage_url('drums/jazz-swing.mid')
    WHEN 'funk-groove' THEN get_pattern_storage_url('drums/funk-groove.mid')
    WHEN 'simple-chords' THEN get_pattern_storage_url('harmony/simple-chords.mid')
    WHEN 'jazz-voicings' THEN get_pattern_storage_url('harmony/jazz-voicings.mid')
    WHEN 'power-chords' THEN get_pattern_storage_url('harmony/power-chords.mid')
    ELSE midi_file_url
  END
WHERE slug IN ('basic-rock-beat', 'jazz-swing', 'funk-groove', 'simple-chords', 'jazz-voicings', 'power-chords');

-- Create folder structure documentation
COMMENT ON TABLE pattern_library IS 'Pattern library stores references to MIDI files in the patterns bucket. Files should be organized as: patterns/drums/*.mid and patterns/harmony/*.mid';

-- Sample MIDI pattern metadata for reference
INSERT INTO pattern_library (type, name, slug, genre, time_signature, bars, midi_file_path, midi_file_url, tags, is_default, is_active)
VALUES
  -- Additional drum patterns
  ('drums', 'Latin Salsa', 'latin-salsa', 'latin', '4/4', 2, 'drums/latin-salsa.mid', get_pattern_storage_url('drums/latin-salsa.mid'), ARRAY['latin', 'salsa', 'percussion'], true, true),
  ('drums', 'Hip Hop Beat', 'hip-hop-beat', 'hip-hop', '4/4', 2, 'drums/hip-hop-beat.mid', get_pattern_storage_url('drums/hip-hop-beat.mid'), ARRAY['hip-hop', 'urban', 'groove'], true, true),
  ('drums', 'Reggae One Drop', 'reggae-one-drop', 'reggae', '4/4', 2, 'drums/reggae-one-drop.mid', get_pattern_storage_url('drums/reggae-one-drop.mid'), ARRAY['reggae', 'one-drop', 'laid-back'], true, true),

  -- Additional harmony patterns
  ('harmony', 'Blues 12-Bar', 'blues-12-bar', 'blues', '4/4', 12, 'harmony/blues-12-bar.mid', get_pattern_storage_url('harmony/blues-12-bar.mid'), ARRAY['blues', '12-bar', 'traditional'], true, true),
  ('harmony', 'Neo Soul', 'neo-soul', 'soul', '4/4', 4, 'harmony/neo-soul.mid', get_pattern_storage_url('harmony/neo-soul.mid'), ARRAY['soul', 'neo', 'r&b'], true, true),
  ('harmony', 'Bossa Nova', 'bossa-nova', 'latin', '4/4', 4, 'harmony/bossa-nova.mid', get_pattern_storage_url('harmony/bossa-nova.mid'), ARRAY['latin', 'bossa', 'brazilian'], true, true)
ON CONFLICT (slug) DO NOTHING;