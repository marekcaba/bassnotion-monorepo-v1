-- Migration: product_features — product → FEATURE grant mapping.
-- Date: 2026-06-10
--
-- WHY: The platform already has product → CONTENT entitlement (product_contents:
-- "this pack bundles these grooves/videos"). What it lacks is product → FEATURE
-- entitlement: "owning Bass College unlocks the Lines & Fills feature." Today the
-- frontend hardcodes which levers (tempo/transpose/loopRange/deconstruction/
-- dynamicLoop) each tier gets. This table makes that a DATA decision: a product
-- (or the membership tier) grants a SET of feature keys, and the backend resolver
-- unions the features across everything a user owns.
--
-- The feature keys mirror libs/contracts FEATURE_KEYS:
--   tempo, transpose, loopRange, deconstruction, dynamicLoop, linesAndFills
-- (`mute` is intentionally NOT a feature — it is never capped for anyone.)
--
-- SAFE / ADDITIVE: new table only. Nothing changes behavior until the resolver
-- (A3) reads it. The seed below reproduces TODAY's membership baseline (the 5
-- levers an active member already gets), so the rewire is behavior-preserving.

-- =============================================================================
-- 1. product_features — the product → feature grant table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_features (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- One of the contracts FEATURE_KEYS. Stored as TEXT (not an enum) so adding a
  -- feature is a contracts-only change; the resolver filters unknown keys.
  feature_key TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A product grants a given feature at most once.
  UNIQUE (product_id, feature_key)
);

-- Hot path: "which features does this product grant?" (resolver unions per product).
CREATE INDEX IF NOT EXISTS idx_product_features_product
  ON public.product_features(product_id);
-- Reverse lookup: "which products grant this feature?" (admin / analytics).
CREATE INDEX IF NOT EXISTS idx_product_features_feature
  ON public.product_features(feature_key);

COMMENT ON TABLE public.product_features IS
  'Product → feature grant. Owning the product grants the feature everywhere it appears (global, not per-content). feature_key matches contracts FEATURE_KEYS.';

-- =============================================================================
-- 2. RLS — mirror product_contents: the grant catalog is public; admin writes.
--    (The backend resolver reads with the service role, which bypasses RLS;
--    public read just lets the store/admin UI show "this product unlocks X".)
-- =============================================================================
ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read of product features"
  ON public.product_features FOR SELECT
  USING (true);

CREATE POLICY "Admin manage product features"
  ON public.product_features FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- 3. Seed — the membership baseline (TODAY's 5 member levers).
--    Resolve the membership product by TYPE at apply-time (its UUID is
--    gen_random_uuid() and differs per environment — never hardcode it).
--    `linesAndFills` is deliberately NOT in the baseline — it is granted by the
--    Bass College (accelerator) product instead (seeded when that grant lands).
-- =============================================================================
INSERT INTO public.product_features (product_id, feature_key)
SELECT p.id, f.feature_key
FROM public.products p
CROSS JOIN (
  VALUES
    ('tempo'),
    ('transpose'),
    ('loopRange'),
    ('deconstruction'),
    ('dynamicLoop')
) AS f(feature_key)
WHERE p.type = 'membership'
ON CONFLICT (product_id, feature_key) DO NOTHING;

-- =============================================================================
-- 4. Seed — Bass College grants `linesAndFills` (locked product decision).
--    Bass College is an admin-authored `accelerator` product (resolved by name,
--    unambiguous). It already confers member-tier access via hasMemberAccess, so
--    a College owner gets the 5 baseline levers (above) PLUS linesAndFills here.
--    Idempotent + name-scoped: a no-op in any environment where the product
--    hasn't been authored yet (staging is empty); re-running is safe.
-- =============================================================================
INSERT INTO public.product_features (product_id, feature_key)
SELECT p.id, 'linesAndFills'
FROM public.products p
WHERE p.type = 'accelerator' AND p.name = 'Bass College'
ON CONFLICT (product_id, feature_key) DO NOTHING;
