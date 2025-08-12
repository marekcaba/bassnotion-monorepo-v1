-- Add 10 test exercises with multi-track data for testing the unified architecture

-- Exercise 1: Funk Slap Workout
INSERT INTO exercises (
  id, title, description, difficulty, duration, bpm, key, notes,
  drum_pattern, harmony_voicing, track_configuration, 
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Funk Slap Workout',
  'Master the classic funk slap technique with syncopated rhythms',
  'intermediate',
  24000,
  100,
  'E',
  '[
    {"id": "note-1", "timestamp": 0, "string": 1, "fret": 0, "duration": 250, "note": "E", "color": "green"},
    {"id": "note-2", "timestamp": 500, "string": 1, "fret": 7, "duration": 250, "note": "B", "color": "blue"},
    {"id": "note-3", "timestamp": 1000, "string": 2, "fret": 7, "duration": 250, "note": "E", "color": "green"},
    {"id": "note-4", "timestamp": 1500, "string": 1, "fret": 5, "duration": 250, "note": "A", "color": "yellow"},
    {"id": "note-5", "timestamp": 2000, "string": 1, "fret": 0, "duration": 250, "note": "E", "color": "green"},
    {"id": "note-6", "timestamp": 2500, "string": 1, "fret": 7, "duration": 250, "note": "B", "color": "blue"}
  ]'::jsonb,
  '{
    "enabled": true,
    "pattern": [
      {"timestamp": 0, "type": "kick", "velocity": 0.9},
      {"timestamp": 500, "type": "hihat", "velocity": 0.6},
      {"timestamp": 1000, "type": "snare", "velocity": 0.8},
      {"timestamp": 1500, "type": "hihat", "velocity": 0.6},
      {"timestamp": 2000, "type": "kick", "velocity": 0.9},
      {"timestamp": 2500, "type": "hihat", "velocity": 0.6}
    ]
  }'::jsonb,
  '{
    "enabled": true,
    "voicing": [
      {"timestamp": 0, "chord": "Em7", "notes": ["E", "G", "B", "D"]},
      {"timestamp": 2000, "chord": "Am7", "notes": ["A", "C", "E", "G"]}
    ]
  }'::jsonb,
  '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.8, "pan": 0},
      "drums": {"enabled": true, "volume": 0.7, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.6, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.8,
      "tempo": 100,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Exercise 2: Jazz Walking Bass
INSERT INTO exercises (
  id, title, description, difficulty, duration, bpm, key, notes,
  drum_pattern, harmony_voicing, track_configuration, 
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Jazz Walking Bass',
  'Learn the fundamentals of jazz walking bass lines',
  'advanced',
  32000,
  120,
  'Bb',
  '[
    {"id": "note-1", "timestamp": 0, "string": 2, "fret": 6, "duration": 500, "note": "Bb", "color": "green"},
    {"id": "note-2", "timestamp": 500, "string": 1, "fret": 3, "duration": 500, "note": "C", "color": "blue"},
    {"id": "note-3", "timestamp": 1000, "string": 3, "fret": 5, "duration": 500, "note": "D", "color": "yellow"},
    {"id": "note-4", "timestamp": 1500, "string": 2, "fret": 3, "duration": 500, "note": "F", "color": "red"},
    {"id": "note-5", "timestamp": 2000, "string": 2, "fret": 6, "duration": 500, "note": "Bb", "color": "green"},
    {"id": "note-6", "timestamp": 2500, "string": 1, "fret": 1, "duration": 500, "note": "A", "color": "purple"}
  ]'::jsonb,
  '{
    "enabled": true,
    "pattern": [
      {"timestamp": 0, "type": "kick", "velocity": 0.7},
      {"timestamp": 250, "type": "hihat", "velocity": 0.5},
      {"timestamp": 500, "type": "snare", "velocity": 0.6},
      {"timestamp": 750, "type": "hihat", "velocity": 0.5},
      {"timestamp": 1000, "type": "kick", "velocity": 0.7},
      {"timestamp": 1250, "type": "hihat", "velocity": 0.5},
      {"timestamp": 1500, "type": "snare", "velocity": 0.6},
      {"timestamp": 1750, "type": "hihat", "velocity": 0.5}
    ]
  }'::jsonb,
  '{
    "enabled": true,
    "voicing": [
      {"timestamp": 0, "chord": "BbMaj7", "notes": ["Bb", "D", "F", "A"]},
      {"timestamp": 1000, "chord": "Cm7", "notes": ["C", "Eb", "G", "Bb"]},
      {"timestamp": 2000, "chord": "F7", "notes": ["F", "A", "C", "Eb"]}
    ]
  }'::jsonb,
  '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.8, "pan": 0},
      "drums": {"enabled": true, "volume": 0.6, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.7, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.8,
      "tempo": 120,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Exercise 3: Rock Power Chords
INSERT INTO exercises (
  id, title, description, difficulty, duration, bpm, key, notes,
  drum_pattern, harmony_voicing, track_configuration, 
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Rock Power Chords',
  'Drive through classic rock power chord progressions',
  'beginner',
  28000,
  140,
  'D',
  '[
    {"id": "note-1", "timestamp": 0, "string": 3, "fret": 5, "duration": 1000, "note": "D", "color": "green"},
    {"id": "note-2", "timestamp": 1000, "string": 2, "fret": 5, "duration": 1000, "note": "A", "color": "blue"},
    {"id": "note-3", "timestamp": 2000, "string": 2, "fret": 7, "duration": 1000, "note": "B", "color": "yellow"},
    {"id": "note-4", "timestamp": 3000, "string": 2, "fret": 10, "duration": 1000, "note": "G", "color": "red"},
    {"id": "note-5", "timestamp": 4000, "string": 3, "fret": 5, "duration": 1000, "note": "D", "color": "green"}
  ]'::jsonb,
  '{
    "enabled": true,
    "pattern": [
      {"timestamp": 0, "type": "kick", "velocity": 0.9},
      {"timestamp": 250, "type": "hihat", "velocity": 0.7},
      {"timestamp": 500, "type": "snare", "velocity": 0.9},
      {"timestamp": 750, "type": "hihat", "velocity": 0.7},
      {"timestamp": 1000, "type": "kick", "velocity": 0.9},
      {"timestamp": 1250, "type": "hihat", "velocity": 0.7},
      {"timestamp": 1500, "type": "snare", "velocity": 0.9},
      {"timestamp": 1750, "type": "hihat", "velocity": 0.7}
    ]
  }'::jsonb,
  '{
    "enabled": true,
    "voicing": [
      {"timestamp": 0, "chord": "D5", "notes": ["D", "A"]},
      {"timestamp": 1000, "chord": "A5", "notes": ["A", "E"]},
      {"timestamp": 2000, "chord": "B5", "notes": ["B", "F#"]},
      {"timestamp": 3000, "chord": "G5", "notes": ["G", "D"]}
    ]
  }'::jsonb,
  '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.9, "pan": 0},
      "drums": {"enabled": true, "volume": 0.8, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.7, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.9,
      "tempo": 140,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Exercise 4: Latin Groove
INSERT INTO exercises (
  id, title, description, difficulty, duration, bpm, key, notes,
  drum_pattern, harmony_voicing, track_configuration, 
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Latin Groove',
  'Explore Latin rhythms with syncopated bass patterns',
  'intermediate',
  30000,
  110,
  'Am',
  '[
    {"id": "note-1", "timestamp": 0, "string": 2, "fret": 5, "duration": 375, "note": "A", "color": "green"},
    {"id": "note-2", "timestamp": 375, "string": 1, "fret": 5, "duration": 250, "note": "C", "color": "blue"},
    {"id": "note-3", "timestamp": 750, "string": 2, "fret": 5, "duration": 375, "note": "A", "color": "green"},
    {"id": "note-4", "timestamp": 1125, "string": 1, "fret": 7, "duration": 250, "note": "E", "color": "yellow"},
    {"id": "note-5", "timestamp": 1500, "string": 2, "fret": 7, "duration": 375, "note": "D", "color": "red"},
    {"id": "note-6", "timestamp": 1875, "string": 1, "fret": 5, "duration": 250, "note": "C", "color": "blue"}
  ]'::jsonb,
  '{
    "enabled": true,
    "pattern": [
      {"timestamp": 0, "type": "kick", "velocity": 0.8},
      {"timestamp": 375, "type": "hihat", "velocity": 0.6},
      {"timestamp": 750, "type": "snare", "velocity": 0.7},
      {"timestamp": 1125, "type": "hihat", "velocity": 0.6},
      {"timestamp": 1500, "type": "kick", "velocity": 0.8},
      {"timestamp": 1875, "type": "hihat", "velocity": 0.6}
    ]
  }'::jsonb,
  '{
    "enabled": true,
    "voicing": [
      {"timestamp": 0, "chord": "Am", "notes": ["A", "C", "E"]},
      {"timestamp": 750, "chord": "Dm", "notes": ["D", "F", "A"]},
      {"timestamp": 1500, "chord": "G", "notes": ["G", "B", "D"]}
    ]
  }'::jsonb,
  '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.8, "pan": 0},
      "drums": {"enabled": true, "volume": 0.7, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.6, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.8,
      "tempo": 110,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Exercise 5: Blues Shuffle
INSERT INTO exercises (
  id, title, description, difficulty, duration, bpm, key, notes,
  drum_pattern, harmony_voicing, track_configuration, 
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Blues Shuffle',
  'Master the classic 12-bar blues shuffle pattern',
  'intermediate',
  36000,
  90,
  'A',
  '[
    {"id": "note-1", "timestamp": 0, "string": 2, "fret": 5, "duration": 750, "note": "A", "color": "green"},
    {"id": "note-2", "timestamp": 750, "string": 1, "fret": 5, "duration": 750, "note": "C", "color": "blue"},
    {"id": "note-3", "timestamp": 1500, "string": 2, "fret": 5, "duration": 750, "note": "A", "color": "green"},
    {"id": "note-4", "timestamp": 2250, "string": 3, "fret": 5, "duration": 750, "note": "D", "color": "yellow"},
    {"id": "note-5", "timestamp": 3000, "string": 2, "fret": 5, "duration": 750, "note": "A", "color": "green"},
    {"id": "note-6", "timestamp": 3750, "string": 1, "fret": 7, "duration": 750, "note": "E", "color": "red"}
  ]'::jsonb,
  '{
    "enabled": true,
    "pattern": [
      {"timestamp": 0, "type": "kick", "velocity": 0.8},
      {"timestamp": 500, "type": "hihat", "velocity": 0.5},
      {"timestamp": 750, "type": "snare", "velocity": 0.7},
      {"timestamp": 1250, "type": "hihat", "velocity": 0.5},
      {"timestamp": 1500, "type": "kick", "velocity": 0.8},
      {"timestamp": 2000, "type": "hihat", "velocity": 0.5},
      {"timestamp": 2250, "type": "snare", "velocity": 0.7},
      {"timestamp": 2750, "type": "hihat", "velocity": 0.5}
    ]
  }'::jsonb,
  '{
    "enabled": true,
    "voicing": [
      {"timestamp": 0, "chord": "A7", "notes": ["A", "C#", "E", "G"]},
      {"timestamp": 2250, "chord": "D7", "notes": ["D", "F#", "A", "C"]},
      {"timestamp": 3750, "chord": "E7", "notes": ["E", "G#", "B", "D"]}
    ]
  }'::jsonb,
  '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.8, "pan": 0},
      "drums": {"enabled": true, "volume": 0.7, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.6, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.8,
      "tempo": 90,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Exercise 6: Reggae Skank
INSERT INTO exercises (
  id, title, description, difficulty, duration, bpm, key, notes,
  drum_pattern, harmony_voicing, track_configuration, 
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Reggae Skank',
  'Learn the classic reggae bass skank rhythm',
  'beginner',
  24000,
  80,
  'G',
  '[
    {"id": "note-1", "timestamp": 0, "string": 2, "fret": 10, "duration": 500, "note": "G", "color": "green"},
    {"id": "note-2", "timestamp": 1000, "string": 2, "fret": 10, "duration": 500, "note": "G", "color": "green"},
    {"id": "note-3", "timestamp": 2000, "string": 1, "fret": 5, "duration": 500, "note": "C", "color": "blue"},
    {"id": "note-4", "timestamp": 3000, "string": 1, "fret": 5, "duration": 500, "note": "C", "color": "blue"},
    {"id": "note-5", "timestamp": 4000, "string": 3, "fret": 5, "duration": 500, "note": "D", "color": "yellow"},
    {"id": "note-6", "timestamp": 5000, "string": 2, "fret": 10, "duration": 500, "note": "G", "color": "green"}
  ]'::jsonb,
  '{
    "enabled": true,
    "pattern": [
      {"timestamp": 0, "type": "kick", "velocity": 0.8},
      {"timestamp": 1000, "type": "snare", "velocity": 0.9},
      {"timestamp": 2000, "type": "kick", "velocity": 0.8},
      {"timestamp": 3000, "type": "snare", "velocity": 0.9},
      {"timestamp": 4000, "type": "kick", "velocity": 0.8},
      {"timestamp": 5000, "type": "snare", "velocity": 0.9}
    ]
  }'::jsonb,
  '{
    "enabled": true,
    "voicing": [
      {"timestamp": 0, "chord": "G", "notes": ["G", "B", "D"]},
      {"timestamp": 2000, "chord": "C", "notes": ["C", "E", "G"]},
      {"timestamp": 4000, "chord": "D", "notes": ["D", "F#", "A"]}
    ]
  }'::jsonb,
  '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.8, "pan": 0},
      "drums": {"enabled": true, "volume": 0.7, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.6, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.8,
      "tempo": 80,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Exercise 7: Progressive Metal
INSERT INTO exercises (
  id, title, description, difficulty, duration, bpm, key, notes,
  drum_pattern, harmony_voicing, track_configuration, 
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Progressive Metal',
  'Complex time signatures and intricate bass patterns',
  'advanced',
  40000,
  160,
  'F#',
  '[
    {"id": "note-1", "timestamp": 0, "string": 3, "fret": 2, "duration": 300, "note": "F#", "color": "green"},
    {"id": "note-2", "timestamp": 300, "string": 2, "fret": 4, "duration": 300, "note": "G#", "color": "blue"},
    {"id": "note-3", "timestamp": 600, "string": 2, "fret": 6, "duration": 300, "note": "A#", "color": "yellow"},
    {"id": "note-4", "timestamp": 900, "string": 1, "fret": 2, "duration": 300, "note": "C#", "color": "red"},
    {"id": "note-5", "timestamp": 1200, "string": 3, "fret": 2, "duration": 300, "note": "F#", "color": "green"},
    {"id": "note-6", "timestamp": 1500, "string": 2, "fret": 4, "duration": 300, "note": "G#", "color": "blue"}
  ]'::jsonb,
  '{
    "enabled": true,
    "pattern": [
      {"timestamp": 0, "type": "kick", "velocity": 0.9},
      {"timestamp": 150, "type": "hihat", "velocity": 0.6},
      {"timestamp": 300, "type": "snare", "velocity": 0.8},
      {"timestamp": 450, "type": "hihat", "velocity": 0.6},
      {"timestamp": 600, "type": "kick", "velocity": 0.9},
      {"timestamp": 750, "type": "hihat", "velocity": 0.6},
      {"timestamp": 900, "type": "snare", "velocity": 0.8},
      {"timestamp": 1050, "type": "hihat", "velocity": 0.6}
    ]
  }'::jsonb,
  '{
    "enabled": true,
    "voicing": [
      {"timestamp": 0, "chord": "F#m", "notes": ["F#", "A", "C#"]},
      {"timestamp": 600, "chord": "G#dim", "notes": ["G#", "B", "D"]},
      {"timestamp": 1200, "chord": "C#m", "notes": ["C#", "E", "G#"]}
    ]
  }'::jsonb,
  '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.8, "pan": 0},
      "drums": {"enabled": true, "volume": 0.8, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.7, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.9,
      "tempo": 160,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Exercise 8: Motown Groove
INSERT INTO exercises (
  id, title, description, difficulty, duration, bpm, key, notes,
  drum_pattern, harmony_voicing, track_configuration, 
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Motown Groove',
  'Classic soul and R&B bass lines with the Motown feel',
  'intermediate',
  32000,
  115,
  'C',
  '[
    {"id": "note-1", "timestamp": 0, "string": 1, "fret": 3, "duration": 500, "note": "C", "color": "green"},
    {"id": "note-2", "timestamp": 500, "string": 1, "fret": 5, "duration": 250, "note": "D", "color": "blue"},
    {"id": "note-3", "timestamp": 750, "string": 1, "fret": 7, "duration": 500, "note": "E", "color": "yellow"},
    {"id": "note-4", "timestamp": 1250, "string": 2, "fret": 3, "duration": 500, "note": "F", "color": "red"},
    {"id": "note-5", "timestamp": 1750, "string": 2, "fret": 5, "duration": 250, "note": "G", "color": "purple"},
    {"id": "note-6", "timestamp": 2000, "string": 1, "fret": 3, "duration": 500, "note": "C", "color": "green"}
  ]'::jsonb,
  '{
    "enabled": true,
    "pattern": [
      {"timestamp": 0, "type": "kick", "velocity": 0.8},
      {"timestamp": 250, "type": "hihat", "velocity": 0.5},
      {"timestamp": 500, "type": "snare", "velocity": 0.7},
      {"timestamp": 750, "type": "hihat", "velocity": 0.5},
      {"timestamp": 1000, "type": "kick", "velocity": 0.8},
      {"timestamp": 1250, "type": "hihat", "velocity": 0.5},
      {"timestamp": 1500, "type": "snare", "velocity": 0.7},
      {"timestamp": 1750, "type": "hihat", "velocity": 0.5}
    ]
  }'::jsonb,
  '{
    "enabled": true,
    "voicing": [
      {"timestamp": 0, "chord": "C", "notes": ["C", "E", "G"]},
      {"timestamp": 750, "chord": "F", "notes": ["F", "A", "C"]},
      {"timestamp": 1500, "chord": "G", "notes": ["G", "B", "D"]}
    ]
  }'::jsonb,
  '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.8, "pan": 0},
      "drums": {"enabled": true, "volume": 0.7, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.6, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.8,
      "tempo": 115,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Exercise 9: Bossa Nova
INSERT INTO exercises (
  id, title, description, difficulty, duration, bpm, key, notes,
  drum_pattern, harmony_voicing, track_configuration, 
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Bossa Nova',
  'Smooth Brazilian bossa nova rhythms and harmony',
  'advanced',
  28000,
  95,
  'Dm',
  '[
    {"id": "note-1", "timestamp": 0, "string": 3, "fret": 5, "duration": 750, "note": "D", "color": "green"},
    {"id": "note-2", "timestamp": 750, "string": 2, "fret": 3, "duration": 500, "note": "F", "color": "blue"},
    {"id": "note-3", "timestamp": 1250, "string": 2, "fret": 5, "duration": 750, "note": "A", "color": "yellow"},
    {"id": "note-4", "timestamp": 2000, "string": 1, "fret": 5, "duration": 500, "note": "C", "color": "red"},
    {"id": "note-5", "timestamp": 2500, "string": 2, "fret": 7, "duration": 750, "note": "E", "color": "purple"},
    {"id": "note-6", "timestamp": 3250, "string": 3, "fret": 5, "duration": 750, "note": "D", "color": "green"}
  ]'::jsonb,
  '{
    "enabled": true,
    "pattern": [
      {"timestamp": 0, "type": "kick", "velocity": 0.6},
      {"timestamp": 500, "type": "hihat", "velocity": 0.4},
      {"timestamp": 750, "type": "snare", "velocity": 0.5},
      {"timestamp": 1250, "type": "hihat", "velocity": 0.4},
      {"timestamp": 1500, "type": "kick", "velocity": 0.6},
      {"timestamp": 2000, "type": "hihat", "velocity": 0.4},
      {"timestamp": 2250, "type": "snare", "velocity": 0.5},
      {"timestamp": 2750, "type": "hihat", "velocity": 0.4}
    ]
  }'::jsonb,
  '{
    "enabled": true,
    "voicing": [
      {"timestamp": 0, "chord": "Dm7", "notes": ["D", "F", "A", "C"]},
      {"timestamp": 1250, "chord": "G7", "notes": ["G", "B", "D", "F"]},
      {"timestamp": 2500, "chord": "CMaj7", "notes": ["C", "E", "G", "B"]}
    ]
  }'::jsonb,
  '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.7, "pan": 0},
      "drums": {"enabled": true, "volume": 0.5, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.8, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.7,
      "tempo": 95,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Exercise 10: Disco Fever
INSERT INTO exercises (
  id, title, description, difficulty, duration, bpm, key, notes,
  drum_pattern, harmony_voicing, track_configuration, 
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Disco Fever',
  'Get down with classic disco bass lines and four-on-the-floor',
  'beginner',
  24000,
  125,
  'F',
  '[
    {"id": "note-1", "timestamp": 0, "string": 2, "fret": 3, "duration": 500, "note": "F", "color": "green"},
    {"id": "note-2", "timestamp": 500, "string": 2, "fret": 3, "duration": 500, "note": "F", "color": "green"},
    {"id": "note-3", "timestamp": 1000, "string": 1, "fret": 6, "duration": 500, "note": "Bb", "color": "blue"},
    {"id": "note-4", "timestamp": 1500, "string": 1, "fret": 6, "duration": 500, "note": "Bb", "color": "blue"},
    {"id": "note-5", "timestamp": 2000, "string": 1, "fret": 3, "duration": 500, "note": "C", "color": "yellow"},
    {"id": "note-6", "timestamp": 2500, "string": 2, "fret": 3, "duration": 500, "note": "F", "color": "green"}
  ]'::jsonb,
  '{
    "enabled": true,
    "pattern": [
      {"timestamp": 0, "type": "kick", "velocity": 0.9},
      {"timestamp": 250, "type": "hihat", "velocity": 0.6},
      {"timestamp": 500, "type": "kick", "velocity": 0.9},
      {"timestamp": 750, "type": "hihat", "velocity": 0.6},
      {"timestamp": 1000, "type": "kick", "velocity": 0.9},
      {"timestamp": 1250, "type": "hihat", "velocity": 0.6},
      {"timestamp": 1500, "type": "kick", "velocity": 0.9},
      {"timestamp": 1750, "type": "hihat", "velocity": 0.6}
    ]
  }'::jsonb,
  '{
    "enabled": true,
    "voicing": [
      {"timestamp": 0, "chord": "F", "notes": ["F", "A", "C"]},
      {"timestamp": 1000, "chord": "Bb", "notes": ["Bb", "D", "F"]},
      {"timestamp": 2000, "chord": "C", "notes": ["C", "E", "G"]}
    ]
  }'::jsonb,
  '{
    "tracks": {
      "bass": {"enabled": true, "volume": 0.8, "pan": 0},
      "drums": {"enabled": true, "volume": 0.8, "pan": 0},
      "harmony": {"enabled": true, "volume": 0.6, "pan": 0}
    },
    "globalSettings": {
      "masterVolume": 0.8,
      "tempo": 125,
      "metronome": {"enabled": false, "volume": 0.5}
    }
  }'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Comment on the migration
COMMENT ON TABLE exercises IS 'Updated exercises table with multi-track data for unified exercise-centric architecture';