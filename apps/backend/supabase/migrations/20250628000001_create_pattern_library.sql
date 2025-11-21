-- Pattern Library System for Drum and Harmony Patterns
-- =====================================================

-- 1. Core pattern library table
CREATE TABLE pattern_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Pattern identification
    type VARCHAR(20) NOT NULL CHECK (type IN ('drums', 'harmony')),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL, -- URL-friendly identifier

    -- Musical properties
    genre VARCHAR(50), -- 'rock', 'jazz', 'funk', 'latin', 'pop', 'blues'
    time_signature VARCHAR(10) DEFAULT '4/4',
    bars INTEGER DEFAULT 4, -- Pattern length in bars

    -- MIDI data stored as JSONB for flexibility
    midi_data JSONB NOT NULL, -- Contains array of MIDI events

    -- Metadata
    description TEXT,
    tags TEXT[], -- For searching: ['shuffle', 'swing', 'straight', 'syncopated']
    is_default BOOLEAN DEFAULT false, -- System-provided patterns
    is_active BOOLEAN DEFAULT true,

    -- Admin tracking
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tutorial pattern configuration
CREATE TABLE tutorial_pattern_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutorial_id UUID NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,

    -- Default patterns set by admin
    default_drum_pattern_id UUID REFERENCES pattern_library(id),
    default_harmony_pattern_id UUID REFERENCES pattern_library(id),

    -- Available variations (NULL = all compatible patterns allowed)
    allowed_drum_patterns UUID[], -- If set, only these patterns can be selected
    allowed_harmony_patterns UUID[],

    -- Configuration
    allow_pattern_switching BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tutorial_id)
);

-- 3. User pattern selections (persisted across sessions)
CREATE TABLE user_pattern_selections (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tutorial_id UUID REFERENCES tutorials(id) ON DELETE CASCADE,

    -- Selected patterns (NULL = use defaults)
    selected_drum_pattern_id UUID REFERENCES pattern_library(id),
    selected_harmony_pattern_id UUID REFERENCES pattern_library(id),

    -- Track usage for analytics
    last_used_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (user_id, tutorial_id)
);

-- 4. Pattern usage analytics
CREATE TABLE pattern_usage_stats (
    pattern_id UUID REFERENCES pattern_library(id) ON DELETE CASCADE,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    average_session_duration INTEGER, -- in seconds

    PRIMARY KEY (pattern_id)
);

-- Indexes for performance
CREATE INDEX idx_pattern_library_type ON pattern_library(type);
CREATE INDEX idx_pattern_library_genre ON pattern_library(genre);
CREATE INDEX idx_pattern_library_tags ON pattern_library USING GIN(tags);
CREATE INDEX idx_pattern_library_active ON pattern_library(is_active);
CREATE INDEX idx_tutorial_pattern_config_tutorial ON tutorial_pattern_config(tutorial_id);
CREATE INDEX idx_user_selections_user ON user_pattern_selections(user_id);

-- RLS Policies
ALTER TABLE pattern_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutorial_pattern_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pattern_selections ENABLE ROW LEVEL SECURITY;

-- Pattern library policies
CREATE POLICY "Public read access to active patterns" ON pattern_library
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admin full access to patterns" ON pattern_library
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Tutorial config policies
CREATE POLICY "Public read access to tutorial configs" ON tutorial_pattern_config
    FOR SELECT USING (true);

CREATE POLICY "Admin manage tutorial configs" ON tutorial_pattern_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- User selection policies
CREATE POLICY "Users manage own selections" ON user_pattern_selections
    FOR ALL USING (auth.uid() = user_id);

-- Function to update usage stats
CREATE OR REPLACE FUNCTION update_pattern_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert usage stats
    INSERT INTO pattern_usage_stats (pattern_id, usage_count, last_used_at)
    VALUES (NEW.selected_drum_pattern_id, 1, NOW())
    ON CONFLICT (pattern_id)
    DO UPDATE SET
        usage_count = pattern_usage_stats.usage_count + 1,
        last_used_at = NOW();

    -- Also update for harmony pattern
    IF NEW.selected_harmony_pattern_id IS NOT NULL THEN
        INSERT INTO pattern_usage_stats (pattern_id, usage_count, last_used_at)
        VALUES (NEW.selected_harmony_pattern_id, 1, NOW())
        ON CONFLICT (pattern_id)
        DO UPDATE SET
            usage_count = pattern_usage_stats.usage_count + 1,
            last_used_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for usage tracking
CREATE TRIGGER track_pattern_usage
    AFTER INSERT OR UPDATE ON user_pattern_selections
    FOR EACH ROW
    EXECUTE FUNCTION update_pattern_usage();

-- Insert default patterns
INSERT INTO pattern_library (type, name, slug, genre, time_signature, bars, midi_data, tags, is_default) VALUES
-- Drum patterns
('drums', 'Basic Rock Beat', 'basic-rock-beat', 'rock', '4/4', 1,
 '{"events": [
    {"type": "kick", "time": 0, "velocity": 100},
    {"type": "kick", "time": 0.5, "velocity": 100},
    {"type": "snare", "time": 0.25, "velocity": 90},
    {"type": "snare", "time": 0.75, "velocity": 90},
    {"type": "hihat", "time": 0, "velocity": 70},
    {"type": "hihat", "time": 0.125, "velocity": 60},
    {"type": "hihat", "time": 0.25, "velocity": 70},
    {"type": "hihat", "time": 0.375, "velocity": 60},
    {"type": "hihat", "time": 0.5, "velocity": 70},
    {"type": "hihat", "time": 0.625, "velocity": 60},
    {"type": "hihat", "time": 0.75, "velocity": 70},
    {"type": "hihat", "time": 0.875, "velocity": 60}
  ]}'::jsonb,
 ARRAY['rock', 'straight', 'basic'], true),

('drums', 'Jazz Swing', 'jazz-swing', 'jazz', '4/4', 2,
 '{"events": [
    {"type": "ride", "time": 0, "velocity": 70},
    {"type": "ride", "time": 0.333, "velocity": 60},
    {"type": "ride", "time": 0.5, "velocity": 70},
    {"type": "ride", "time": 0.833, "velocity": 60},
    {"type": "kick", "time": 0, "velocity": 80},
    {"type": "hihat_foot", "time": 0.5, "velocity": 60}
  ]}'::jsonb,
 ARRAY['jazz', 'swing', 'ride'], true),

('drums', 'Funk Groove', 'funk-groove', 'funk', '4/4', 1,
 '{"events": [
    {"type": "kick", "time": 0, "velocity": 100},
    {"type": "kick", "time": 0.375, "velocity": 80},
    {"type": "kick", "time": 0.625, "velocity": 90},
    {"type": "snare", "time": 0.25, "velocity": 100},
    {"type": "snare", "time": 0.75, "velocity": 100},
    {"type": "hihat", "time": 0, "velocity": 80},
    {"type": "hihat", "time": 0.0625, "velocity": 60},
    {"type": "hihat", "time": 0.125, "velocity": 70},
    {"type": "hihat", "time": 0.1875, "velocity": 60},
    {"type": "hihat_open", "time": 0.4375, "velocity": 90}
  ]}'::jsonb,
 ARRAY['funk', 'syncopated', 'groove'], true),

-- Harmony patterns
('harmony', 'Simple Chords', 'simple-chords', 'pop', '4/4', 4,
 '{"events": [
    {"chord": "C", "time": 0, "duration": 1, "notes": ["C3", "E3", "G3"]},
    {"chord": "Am", "time": 1, "duration": 1, "notes": ["A2", "C3", "E3"]},
    {"chord": "F", "time": 2, "duration": 1, "notes": ["F2", "A2", "C3"]},
    {"chord": "G", "time": 3, "duration": 1, "notes": ["G2", "B2", "D3"]}
  ]}'::jsonb,
 ARRAY['pop', 'simple', 'triads'], true),

('harmony', 'Jazz Voicings', 'jazz-voicings', 'jazz', '4/4', 4,
 '{"events": [
    {"chord": "Cmaj7", "time": 0, "duration": 1, "notes": ["C3", "E3", "G3", "B3"]},
    {"chord": "A7", "time": 1, "duration": 1, "notes": ["A2", "C#3", "E3", "G3"]},
    {"chord": "Dm7", "time": 2, "duration": 1, "notes": ["D3", "F3", "A3", "C4"]},
    {"chord": "G7", "time": 3, "duration": 1, "notes": ["G2", "B2", "D3", "F3"]}
  ]}'::jsonb,
 ARRAY['jazz', 'seventh', 'voicings'], true),

('harmony', 'Power Chords', 'power-chords', 'rock', '4/4', 2,
 '{"events": [
    {"chord": "C5", "time": 0, "duration": 0.5, "notes": ["C3", "G3"]},
    {"chord": "C5", "time": 0.5, "duration": 0.5, "notes": ["C3", "G3"]},
    {"chord": "G5", "time": 1, "duration": 0.5, "notes": ["G2", "D3"]},
    {"chord": "G5", "time": 1.5, "duration": 0.5, "notes": ["G2", "D3"]}
  ]}'::jsonb,
 ARRAY['rock', 'power', 'fifths'], true);

-- Updated timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pattern_library_updated_at BEFORE UPDATE
    ON pattern_library FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tutorial_config_updated_at BEFORE UPDATE
    ON tutorial_pattern_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();