-- ============================================================================
-- scale_blueprints — admin-authored box shapes + practice rhythm for the gym
-- Scales tool. One row per scale type. The engine seeds sensible defaults in
-- code (scaleBlueprints.ts) and falls back to them, but when a row exists here
-- it OVERRIDES the default — the admin owns the final shapes (visual editor at
-- /admin/scales). Mirrors the training_goals admin-authored pattern:
--   • public read (the runtime needs the shapes), admin-only write
--   • via public.is_admin(auth.uid())
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scale_blueprints (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One blueprint per scale type (the lookup key the runtime uses).
  scale_type  TEXT        NOT NULL UNIQUE
                CHECK (scale_type IN (
                  'major', 'natural_minor', 'dorian', 'mixolydian',
                  'minor_pentatonic', 'major_pentatonic'
                )),
  -- ScalePositionShape[] — [{ positionNumber, startFretOffset, span }, …].
  positions   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- The note value each step of the scale run occupies (Tone.js notation).
  rhythm      TEXT        NOT NULL DEFAULT '8n'
                CHECK (rhythm IN ('4n', '8n', '16n')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.scale_blueprints IS
  'Admin-authored scale box shapes + rhythm for the gym Scales tool. One row per scale type; overrides the in-code seed defaults.';

ALTER TABLE public.scale_blueprints ENABLE ROW LEVEL SECURITY;

-- The runtime reads shapes to render/play the scale → everyone can read.
CREATE POLICY "Scale blueprints are viewable by everyone"
  ON public.scale_blueprints FOR SELECT
  USING (TRUE);

-- Only admins author them (the /admin/scales editor).
CREATE POLICY "Admins can manage scale blueprints"
  ON public.scale_blueprints FOR ALL
  USING (public.is_admin(auth.uid()));

-- ── Seed the default shapes (the standard CAGED-style boxes the code ships) ──
-- SPAN=4, STEP=2, startFretOffset = -1 + i*STEP. 7 positions for the 7-note
-- modes, 5 for the pentatonics. Idempotent: ON CONFLICT keeps any admin edits.
INSERT INTO public.scale_blueprints (scale_type, positions, rhythm)
VALUES
  ('major', '[
    {"positionNumber":1,"startFretOffset":-1,"span":4},
    {"positionNumber":2,"startFretOffset":1,"span":4},
    {"positionNumber":3,"startFretOffset":3,"span":4},
    {"positionNumber":4,"startFretOffset":5,"span":4},
    {"positionNumber":5,"startFretOffset":7,"span":4},
    {"positionNumber":6,"startFretOffset":9,"span":4},
    {"positionNumber":7,"startFretOffset":11,"span":4}
  ]'::jsonb, '8n'),
  ('natural_minor', '[
    {"positionNumber":1,"startFretOffset":-1,"span":4},
    {"positionNumber":2,"startFretOffset":1,"span":4},
    {"positionNumber":3,"startFretOffset":3,"span":4},
    {"positionNumber":4,"startFretOffset":5,"span":4},
    {"positionNumber":5,"startFretOffset":7,"span":4},
    {"positionNumber":6,"startFretOffset":9,"span":4},
    {"positionNumber":7,"startFretOffset":11,"span":4}
  ]'::jsonb, '8n'),
  ('dorian', '[
    {"positionNumber":1,"startFretOffset":-1,"span":4},
    {"positionNumber":2,"startFretOffset":1,"span":4},
    {"positionNumber":3,"startFretOffset":3,"span":4},
    {"positionNumber":4,"startFretOffset":5,"span":4},
    {"positionNumber":5,"startFretOffset":7,"span":4},
    {"positionNumber":6,"startFretOffset":9,"span":4},
    {"positionNumber":7,"startFretOffset":11,"span":4}
  ]'::jsonb, '8n'),
  ('mixolydian', '[
    {"positionNumber":1,"startFretOffset":-1,"span":4},
    {"positionNumber":2,"startFretOffset":1,"span":4},
    {"positionNumber":3,"startFretOffset":3,"span":4},
    {"positionNumber":4,"startFretOffset":5,"span":4},
    {"positionNumber":5,"startFretOffset":7,"span":4},
    {"positionNumber":6,"startFretOffset":9,"span":4},
    {"positionNumber":7,"startFretOffset":11,"span":4}
  ]'::jsonb, '8n'),
  ('minor_pentatonic', '[
    {"positionNumber":1,"startFretOffset":-1,"span":4},
    {"positionNumber":2,"startFretOffset":1,"span":4},
    {"positionNumber":3,"startFretOffset":3,"span":4},
    {"positionNumber":4,"startFretOffset":5,"span":4},
    {"positionNumber":5,"startFretOffset":7,"span":4}
  ]'::jsonb, '8n'),
  ('major_pentatonic', '[
    {"positionNumber":1,"startFretOffset":-1,"span":4},
    {"positionNumber":2,"startFretOffset":1,"span":4},
    {"positionNumber":3,"startFretOffset":3,"span":4},
    {"positionNumber":4,"startFretOffset":5,"span":4},
    {"positionNumber":5,"startFretOffset":7,"span":4}
  ]'::jsonb, '8n')
ON CONFLICT (scale_type) DO NOTHING;
