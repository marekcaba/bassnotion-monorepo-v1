-- Migration: Entitlement foundation (products catalog + product-scoped purchases
--            + content access tiers).
-- Date: 2026-06-06
--
-- WHY: The platform has four content access tiers:
--   1. free      — anyone (anon or logged in)
--   2. member    — active monthly subscription / founder lifetime
--   3. product   — a one-time purchase (Groove Pack); a member who did NOT buy
--                  the pack does NOT get it (product-scoped, not membership-scoped)
--   4. accelerator — a product purchase + a time-based drip (layers later)
--
-- The old model only understood `hasActiveSubscription` (a boolean) and a rigid
-- `purchases.course_type` enum with no per-product identity. This migration adds
-- the three structures the entitlement resolver needs: a real product catalog, a
-- purchases→product link, and an access tier on gateable content.
--
-- SAFE TO LAND ANY TIME: content `access_tier` defaults to 'free', so existing
-- behavior is unchanged until specific rows are curated to 'member'/'product'.
-- This migration does NOT close the public-content hole on its own — it is the
-- foundation the URL-signing PRs (Bunny + Supabase storage) build on.

-- =============================================================================
-- 1. products — the SKU catalog (replaces the in-memory priceIds map / TS const)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,            -- 'monthly-membership', 'groove-pack-funk-101', '4week-economy-picking'
  type            TEXT NOT NULL CHECK (type IN ('membership','groove_pack','accelerator','course')),
  name            TEXT NOT NULL,
  description     TEXT,
  stripe_price_id TEXT UNIQUE,                     -- maps a completed Stripe payment → this internal product
  price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'usd',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- e.g. accelerator { "duration_days": 28 }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_type ON public.products(type);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

COMMENT ON TABLE public.products IS
  'Sellable product catalog. A completed Stripe payment maps to one product via stripe_price_id; gateable content references a product via product_id.';
COMMENT ON COLUMN public.products.metadata IS
  'Type-specific config, e.g. accelerator { duration_days } for the 30-day drip.';

-- =============================================================================
-- 2. purchases — make product-scoped (was a rigid basic/standard/premium enum)
-- =============================================================================
-- Add the product link. Keep course_type for backward-compat but make it
-- nullable and drop the rigid CHECK so new product types aren't rejected.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'purchases' AND constraint_name = 'purchases_course_type_check'
  ) THEN
    ALTER TABLE public.purchases DROP CONSTRAINT purchases_course_type_check;
  END IF;
END $$;

ALTER TABLE public.purchases ALTER COLUMN course_type DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON public.purchases(product_id);

COMMENT ON COLUMN public.purchases.product_id IS
  'The product this purchase grants. NULL only for legacy course_type-only rows.';

-- =============================================================================
-- 3. groove_library — add the access tier (the gate dimension)
-- =============================================================================
ALTER TABLE public.groove_library
  ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (access_tier IN ('free','member','product')),
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- A 'product'-tier groove MUST name which product unlocks it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'groove_library' AND constraint_name = 'groove_tier_product_ck'
  ) THEN
    ALTER TABLE public.groove_library
      ADD CONSTRAINT groove_tier_product_ck
      CHECK (access_tier <> 'product' OR product_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_groove_library_access_tier
  ON public.groove_library(access_tier);

COMMENT ON COLUMN public.groove_library.access_tier IS
  'free = anyone; member = active subscription/founder; product = must own product_id.';

-- NOTE: groove_library RLS still permits public read of all active rows. That is
-- INTENTIONALLY left unchanged here — tightening it to "public read of free rows
-- only" is done in the same PR as the server-side entitlement resolver + signer,
-- so list endpoints don't break in the gap. (See PLAN-entitlements-and-commerce.md.)

-- =============================================================================
-- 4. RLS for products
-- =============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- The storefront catalog is public: anyone may read active products.
CREATE POLICY "Public read of active products"
  ON public.products FOR SELECT
  USING (is_active = true);

-- Admins manage the catalog (service-role bypasses RLS for webhook/seed writes).
CREATE POLICY "Admin full access to products"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- 5. updated_at trigger for products (reuse the shared function)
-- =============================================================================
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 6. Seed the monthly membership product so the model is uniform from day one.
--    Pack/accelerator rows are inserted when those products are authored.
--    stripe_price_id is left NULL for now (wired during storefront work); the
--    membership flow today resolves its price via STRIPE_SUBSCRIPTION_PRICE_ID.
-- =============================================================================
INSERT INTO public.products (slug, type, name, description, price_cents, currency, metadata)
VALUES (
  'monthly-membership',
  'membership',
  'Bassicology Membership',
  'Play the full instrument — every tempo, key, loop, and layer',
  2400,
  'usd',
  '{}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
