-- Migration: DB-driven sidebar folders ("collections") + tutorial assignments.
-- Date: 2026-06-07
--
-- WHY: The Bassment sidebar folders are a 2-element hardcoded TypeScript array
-- (PRODUCT_FOLDERS = 'starter-kit' | 'revisiting-basics'), and tutorials are
-- bucketed into them by an exact string match of the free-text tutorials.category
-- column against those two ids. Any tutorial whose category doesn't match a known
-- folder id silently VANISHES from the sidebar (useTutorialsByFolder drops it).
-- There is no DB folder concept, no ordering, no FK, no enforced vocabulary, and
-- real packs (Groove Packs) have no folder at all.
--
-- This replaces the fiction with a real, relational folder system:
--
--   • collections          — real DB folders. title, slug, sort order, and an
--                            access_tier (free/member/product) mirroring the
--                            gating already on tutorials/grooves/videos. The
--                            backend filters folders through EntitlementService
--                            (the single access authority).
--   • collection_tutorials — many-to-many: a tutorial can live in several folders
--                            (e.g. a free folder AND, conceptually, a pack). The
--                            relationship the brittle category-string match should
--                            have been.
--
-- Packs do NOT get a collection row — an owned pack renders as a *virtual* folder
-- computed from product_contents at read time (the source of truth for owned
-- content stays product_contents, so this never fights the auto-gating that flips
-- tutorials.access_tier when content is bundled into a product).
--
-- Backfill (idempotent): seeds the two existing folders and assigns every tutorial
-- by its current category. tutorials.category is left in place (dormant) as a
-- fallback; a follow-up migration drops it once the DB-driven sidebar is verified.
--
-- SAFE / ADDITIVE: new tables + a seed/backfill only. Nothing existing changes
-- behavior until the sidebar is rewritten to read these tables (a later PR).

-- =============================================================================
-- 1. collections — real sidebar folders
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  -- Mirrors content gating: free = anyone; member = active subscription/founder;
  -- product = reserved for paid standalone folders (the common "owned pack" case
  -- is a virtual folder from product_contents, not a row here).
  access_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (access_tier IN ('free','member','product')),
  -- Sidebar display order (lower = first).
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_active_sort
  ON public.collections(is_active, sort_order);

COMMENT ON TABLE public.collections IS
  'DB-driven Bassment sidebar folders. Replaces the hardcoded PRODUCT_FOLDERS array + tutorials.category string-match. Owned packs render as virtual folders from product_contents (not stored here).';
COMMENT ON COLUMN public.collections.access_tier IS
  'free = anyone; member = active subscription/founder; product = paid standalone folder. Resolved via EntitlementService.';

-- =============================================================================
-- 2. collection_tutorials — many-to-many folder ↔ tutorial assignment
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.collection_tutorials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  tutorial_id   UUID NOT NULL REFERENCES public.tutorials(id)   ON DELETE CASCADE,
  -- Display order within the folder.
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A tutorial appears at most once per folder.
  UNIQUE (collection_id, tutorial_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_tutorials_collection
  ON public.collection_tutorials(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_tutorials_tutorial
  ON public.collection_tutorials(tutorial_id);

COMMENT ON TABLE public.collection_tutorials IS
  'Many-to-many: a folder groups many tutorials; a tutorial may be in many folders. Replaces tutorials.category string-matching (which dropped tutorials silently).';

-- =============================================================================
-- 3. updated_at trigger (collections is editable; reuses the shared function)
-- =============================================================================
-- DROP-then-CREATE so the whole migration is re-runnable (CREATE TRIGGER has no
-- IF NOT EXISTS on the PG version Supabase targets).
DROP TRIGGER IF EXISTS update_collections_updated_at ON public.collections;
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. RLS
-- =============================================================================
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_tutorials ENABLE ROW LEVEL SECURITY;

-- collections: which folders exist is catalog metadata (the sidebar shows folder
-- names as upgrade teasers). Folder ACCESS is resolved server-side via
-- EntitlementService; tutorial content stays gated separately. Backend reads with
-- the service role regardless.
DROP POLICY IF EXISTS "Public read active collections" ON public.collections;
CREATE POLICY "Public read active collections"
  ON public.collections FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin manage collections" ON public.collections;
CREATE POLICY "Admin manage collections"
  ON public.collections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- collection_tutorials: the membership list is public catalog info (mirrors
-- product_contents). The content URLs are gated by the tutorial signer, not here.
DROP POLICY IF EXISTS "Public read collection tutorials" ON public.collection_tutorials;
CREATE POLICY "Public read collection tutorials"
  ON public.collection_tutorials FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin manage collection tutorials" ON public.collection_tutorials;
CREATE POLICY "Admin manage collection tutorials"
  ON public.collection_tutorials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- 5. Backfill — seed the two existing hardcoded folders + assign tutorials.
--    Idempotent: ON CONFLICT makes re-running a no-op.
-- =============================================================================

-- 5a. The two folders that were hardcoded in product-folders.ts. 'Revisiting
-- Basics' was isFree=false (a paid teaser) → member tier; 'Starter Kit' was the
-- free default.
INSERT INTO public.collections (slug, title, description, access_tier, sort_order)
VALUES
  ('starter-kit',       'Starter Kit',       'Free tutorials to get you started', 'free',   0),
  ('revisiting-basics', 'Revisiting Basics', 'Strengthen your foundation',        'member', 1)
ON CONFLICT (slug) DO NOTHING;

-- 5b. Assign every tutorial to the folder matching its current category. A NULL/
-- empty category defaulted to 'starter-kit' in the old hook (useTutorialsByFolder:
-- `t.category || 'starter-kit'`), so COALESCE replicates that exactly. A category
-- that matches no folder slug simply produces no row (it was invisible before too,
-- but now it's an explicit, queryable absence rather than a silent runtime drop).
INSERT INTO public.collection_tutorials (collection_id, tutorial_id)
SELECT c.id, t.id
FROM public.tutorials t
JOIN public.collections c
  ON c.slug = COALESCE(NULLIF(t.category, ''), 'starter-kit')
ON CONFLICT (collection_id, tutorial_id) DO NOTHING;
