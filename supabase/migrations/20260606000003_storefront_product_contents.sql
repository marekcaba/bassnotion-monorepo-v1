-- Migration: Storefront foundation — product↔content bundling + accelerator
--            enrollment + product marketing columns.
-- Date: 2026-06-06
--
-- WHY: The store sells one-time products (Groove Packs, later a 4-Week
-- Accelerator). A single `product_id` FK on each content row (PR1) only lets a
-- content item belong to ONE product — which breaks the moment a groove needs to
-- be in two packs, or a pack bundles grooves + videos + exercises. This adds the
-- relational grouping primitive the platform needs long-term:
--
--   • product_contents      — a product bundles many content items; an item can
--                             be in many products (many-to-many). Carries the
--                             per-item drip schedule (unlock_day) for accelerators.
--   • accelerator_enrollments — one row per purchase of an accelerator product;
--                             `started_at` is the day-0 clock for the drip.
--   • products marketing columns — cover/tagline/preview for the store UI.
--
-- The entitlement resolver evolves to check product_contents (own ANY product
-- that bundles this item) rather than the single content.product_id FK. The FK
-- columns stay for backward-compat; free/member content never uses any of this.
--
-- SAFE / ADDITIVE: new tables + new nullable columns only. Nothing existing
-- changes behavior until products + product_contents rows are authored.

-- =============================================================================
-- 1. product_contents — the many-to-many bundle table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_contents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- Polymorphic content reference. No single SQL FK (heterogeneous targets);
  -- referential integrity is enforced in the service layer that brokers writes.
  content_type TEXT NOT NULL CHECK (content_type IN ('groove','video','exercise')),
  content_id   UUID NOT NULL,
  -- Accelerator drip: 0 = unlocked immediately on purchase; N = unlocks N days
  -- after the buyer's accelerator_enrollments.started_at. Ignored for flat packs.
  unlock_day   INTEGER NOT NULL DEFAULT 0 CHECK (unlock_day >= 0),
  -- Display order within the pack/path.
  sort_order   INTEGER NOT NULL DEFAULT 0,
  -- Optional per-item caption for the path UI (e.g. "Day 1: the foundation").
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A given content item appears at most once per product.
  UNIQUE (product_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_product_contents_product
  ON public.product_contents(product_id);
-- The hot path: "which products bundle this content item?" (entitlement resolve).
CREATE INDEX IF NOT EXISTS idx_product_contents_lookup
  ON public.product_contents(content_type, content_id);

COMMENT ON TABLE public.product_contents IS
  'Many-to-many: a product (pack/accelerator) bundles content items; an item may be in many products. unlock_day drives accelerator drip.';
COMMENT ON COLUMN public.product_contents.content_id IS
  'Polymorphic — references groove_library / videos / exercises by content_type. Integrity enforced in the service layer.';

-- =============================================================================
-- 2. accelerator_enrollments — the drip clock (per purchase of an accelerator)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accelerator_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_accelerator_enrollments_user
  ON public.accelerator_enrollments(user_id);

COMMENT ON TABLE public.accelerator_enrollments IS
  'One row per purchase of an accelerator product. started_at is day 0 for product_contents.unlock_day drip.';

-- =============================================================================
-- 3. products — marketing columns for the store
-- =============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cover_image_url   TEXT,
  ADD COLUMN IF NOT EXISTS tagline           TEXT,
  ADD COLUMN IF NOT EXISTS preview_groove_id UUID REFERENCES public.groove_library(id),
  -- Pricing-card bullet points (e.g. ["12 funk grooves","All 12 keys"]).
  ADD COLUMN IF NOT EXISTS features          JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Store display order (lower = first). Membership typically 0.
  ADD COLUMN IF NOT EXISTS sort_order        INTEGER NOT NULL DEFAULT 0,
  -- Optional card label: 'Popular' | 'New' | 'Best value' | NULL.
  ADD COLUMN IF NOT EXISTS badge             TEXT;

COMMENT ON COLUMN public.products.tagline IS
  'Short one-line marketing hook for the store card.';
COMMENT ON COLUMN public.products.preview_groove_id IS
  'A free teaser groove to embed on the pack detail page.';
COMMENT ON COLUMN public.products.features IS
  'Array of bullet-point strings rendered on the store pricing card.';

-- =============================================================================
-- 4. RLS
-- =============================================================================
ALTER TABLE public.product_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accelerator_enrollments ENABLE ROW LEVEL SECURITY;

-- product_contents: the "what's in this pack" list is public catalog info
-- (the store shows it). The SECRET is the content URLs (gated by the signer),
-- not the fact that a pack contains them. Backend reads with service role.
CREATE POLICY "Public read of product contents"
  ON public.product_contents FOR SELECT
  USING (true);

CREATE POLICY "Admin manage product contents"
  ON public.product_contents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- accelerator_enrollments: a user reads only their own enrollments; service
-- role writes them (on purchase). No public read.
CREATE POLICY "Users read own enrollments"
  ON public.accelerator_enrollments FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 5. updated_at not needed (these tables are append-mostly); no trigger.
-- =============================================================================
