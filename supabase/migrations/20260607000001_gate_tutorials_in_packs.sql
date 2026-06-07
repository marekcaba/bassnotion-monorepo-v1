-- Migration: Make tutorials gateable + allow bundling them in products.
-- Date: 2026-06-07
--
-- WHY: In this app a groove card / groove page is always wrapped in a TUTORIAL
-- nest — so a customer buys access to a tutorial, not a loose groove. To sell
-- tutorials in Groove Packs we need (a) a per-tutorial access tier (they're
-- fully public today), and (b) the product_contents bundle to accept
-- content_type = 'tutorial'.
--
-- Mirrors the gating already on groove_library / videos: access_tier defaults
-- to 'free', so this migration changes NOTHING until a tutorial is curated to
-- 'member'/'product'. The EntitlementService resolves a 'product'-tier item via
-- product_contents (own ANY product that bundles it).

-- =============================================================================
-- 1. tutorials — add the gate
-- =============================================================================
ALTER TABLE public.tutorials
  ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (access_tier IN ('free','member','product')),
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- A 'product'-tier tutorial MUST name which product unlocks it (unless it's
-- bundled purely via product_contents — but the single FK is the fast path).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'tutorials' AND constraint_name = 'tutorial_tier_product_ck'
  ) THEN
    ALTER TABLE public.tutorials
      ADD CONSTRAINT tutorial_tier_product_ck
      CHECK (access_tier <> 'product' OR product_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tutorials_access_tier
  ON public.tutorials(access_tier);

COMMENT ON COLUMN public.tutorials.access_tier IS
  'free = anyone; member = active subscription/founder; product = must own product_id (or a pack bundling this tutorial).';

-- NOTE: RLS still allows public read of active tutorials. The list endpoint
-- stays public (catalog/teasers); the SINGLE-tutorial fetch is gated in the
-- service via EntitlementService (mirrors grooves/videos). Tightening RLS to
-- "public read of free rows only" can follow once teaser behavior is decided.

-- =============================================================================
-- 2. product_contents — allow bundling tutorials
-- =============================================================================
ALTER TABLE public.product_contents
  DROP CONSTRAINT IF EXISTS product_contents_content_type_check;

ALTER TABLE public.product_contents
  ADD CONSTRAINT product_contents_content_type_check
  CHECK (content_type IN ('groove','video','exercise','tutorial'));

COMMENT ON COLUMN public.product_contents.content_id IS
  'Polymorphic — references tutorials / groove_library / videos / exercises by content_type. Integrity enforced in the service layer.';
