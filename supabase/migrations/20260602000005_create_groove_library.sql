-- Groove Library — reusable groove cards.
--
-- Today a groove card is authored INLINE inside every tutorial block (stems +
-- bpm + key baked in), so re-using a groove across many daily drills means
-- re-uploading/re-authoring it each time. This table makes a groove a
-- first-class reusable entity: an admin creates it ONCE (stems + default
-- bpm/key + length), and a drill block references it by id, overriding key /
-- tempo / role / timebox per use.
--
-- Modeled on pattern_library (same library posture): public read of active
-- rows, admin-only writes. The heavy payload (stem URLs) lives here once.

CREATE TABLE IF NOT EXISTS public.groove_library (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity
  name         TEXT        NOT NULL,
  slug         TEXT        UNIQUE NOT NULL,
  subtitle     TEXT        NOT NULL DEFAULT '',
  -- Musical defaults (a referencing block may override key/tempo per use)
  original_bpm INTEGER     NOT NULL CHECK (original_bpm BETWEEN 50 AND 180),
  original_key TEXT        NOT NULL,
  length_bars  INTEGER     NOT NULL CHECK (length_bars > 0),
  -- The single stem set delivered at original_key (bass/drums/harmony URLs).
  -- Bass + harmony are pitch-shifted at runtime; drums are not.
  stems        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Optional metadata
  genre        TEXT,
  tags         TEXT[],
  youtube_url  TEXT,
  -- Library bookkeeping
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  usage_count  INTEGER     NOT NULL DEFAULT 0,
  created_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.groove_library IS
  'Reusable groove cards. A drill/tutorial block references one by id and overrides key/tempo/role/timebox per use.';
COMMENT ON COLUMN public.groove_library.stems IS
  'Stem set { bass, drums, harmony } of audio-samples bucket URLs, delivered at original_key.';

CREATE INDEX IF NOT EXISTS idx_groove_library_active
  ON public.groove_library (is_active);
CREATE INDEX IF NOT EXISTS idx_groove_library_genre
  ON public.groove_library (genre);
CREATE INDEX IF NOT EXISTS idx_groove_library_tags
  ON public.groove_library USING GIN (tags);

ALTER TABLE public.groove_library ENABLE ROW LEVEL SECURITY;

-- Public read of active grooves (same posture as pattern_library). The
-- backend reads with the service-role key (bypasses RLS) for admin listing.
CREATE POLICY "Public read access to active grooves"
  ON public.groove_library FOR SELECT
  USING (is_active = true);

-- Admin full access. Matches the audio-samples bucket admin policy: gate on
-- profiles.role = 'admin'.
CREATE POLICY "Admin full access to grooves"
  ON public.groove_library FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
