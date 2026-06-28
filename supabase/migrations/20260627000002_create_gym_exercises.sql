-- ============================================================================
-- gym_exercises — admin-authored exercises for gym EQUIPMENT (scale paths today,
-- groove exercises later). ONE authoring interface (/admin/scales) produces all of
-- them; the PAYLOAD (the authored content — per-key note paths, meter, etc.) is
-- opaque JSONB so the same table serves any equipment. Columns are queryable metadata.
--
-- DRAFT-FRIENDLY: a half-authored exercise (a few of the 12 keys filled, the rest
-- empty) saves fine — there is NO content validation gate. The admin saves, leaves,
-- comes back, keeps editing. So payload defaults to {} and nothing about the content
-- is constrained at the DB level.
--
-- RLS mirrors the training_goals / scale_blueprints pattern: admins author; the
-- runtime reads (so the gym tool can load a published exercise).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gym_exercises (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which authoring payload shape + which equipment family.
  kind        TEXT        NOT NULL DEFAULT 'scale_path'
                CHECK (kind IN ('scale_path', 'groove')),
  name        TEXT        NOT NULL DEFAULT '',
  description TEXT        NOT NULL DEFAULT '',
  -- The gym equipment station this targets (e.g. 'scales').
  equipment   TEXT        NOT NULL DEFAULT 'scales',
  -- For scale_path: the scale type ('major' …). NULL for kinds without one.
  scale_type  TEXT,
  -- The authored content. Shape depends on kind (PathsByKey for scale_path).
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gym_exercises IS
  'Admin-authored gym equipment exercises (scale paths, grooves). Draft-friendly: payload is opaque JSON, no content gate.';

CREATE INDEX IF NOT EXISTS idx_gym_exercises_equipment_kind
  ON public.gym_exercises (equipment, kind, updated_at DESC);

ALTER TABLE public.gym_exercises ENABLE ROW LEVEL SECURITY;

-- The gym tool reads exercises to play them → any authenticated user can read.
CREATE POLICY "Gym exercises are readable by authenticated users"
  ON public.gym_exercises FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins author them.
CREATE POLICY "Admins can manage gym exercises"
  ON public.gym_exercises FOR ALL
  USING (public.is_admin(auth.uid()));
