-- Migration: private `groove-stems` bucket + public `demo-grooves` bucket (PR3 storage gating).
-- Date: 2026-06-13
--
-- WHY: The per-groove stems (bass/drums/harmony) are the platform's sellable
-- content, but today they live as PERMANENT PUBLIC URLs in the `audio-samples`
-- bucket — anyone (or a scraper) can bulk-download the entire library by URL.
-- This is the "#1 business-model risk" in docs/security/PLAN-PR3-storage-gating.md.
--
-- The fix mirrors the already-shipped `premium-basslines` pattern (PR4):
--   • PREMIUM groove stems (access_tier IN ('member','product')) → this PRIVATE
--     `groove-stems` bucket. No public URL, no broad authenticated read; the ONLY
--     read path is a short-lived signed URL minted by the backend signer AFTER it
--     checks the groove's content entitlement (EntitlementService.canAccessContent).
--   • FREE groove stems + ALL instrument plumbing (drums/, bass/, Keyboards/,
--     metronome/, silence.ogg, etc.) STAY in the public `audio-samples` bucket —
--     they were never secret and ~40 loaders + the /free funnel depend on them.
--   • The waitlist DEMO groove (economy-groove-1) moves to a dedicated PUBLIC
--     `demo-grooves` bucket so the marketing card has a clean, intentional public
--     home decoupled from the gated library.
--
-- Rollout is ZERO-IMPACT: every current groove is `free`, so its stems stay on
-- the public path. You flip a groove to `member`/`product` and move its stems
-- into `groove-stems` only when you actually have a paid one to lock — AND only
-- after the signer-consuming frontend has shipped (hard rule: enforcement code
-- deploys before any lockdown).

-- ── 1. Private bucket for PREMIUM groove stems ───────────────────────────────
INSERT INTO storage.buckets (
  id, name, public, avif_autodetection, file_size_limit, allowed_mime_types
)
VALUES (
  'groove-stems',
  'groove-stems',
  false,                              -- PRIVATE: no public CDN URL
  false,
  8388608,                           -- 8MB (same ceiling as premium-basslines)
  ARRAY['audio/ogg', 'audio/mpeg', 'audio/wav', 'application/octet-stream']
) ON CONFLICT (id) DO NOTHING;

-- RLS: enabled by default on storage.objects. We add NO anon/authenticated
-- SELECT/INSERT policy for this bucket on purpose:
--   • READS  → only via backend-minted signed URLs (service role bypasses RLS).
--   • WRITES → only via the admin upload endpoint (service role, AdminGuard).
-- Absence of a policy = deny for non-service-role roles. The entitlement-gated
-- signer is the sole door — identical to `premium-basslines`.

-- ── 2. Public bucket for the marketing DEMO groove ───────────────────────────
-- A dedicated public home for the waitlist/funnel demo stems, so the demo's
-- "intentionally public" status is explicit (its own bucket) rather than implied
-- by a prefix carve-out inside the gated library's bucket.
INSERT INTO storage.buckets (
  id, name, public, avif_autodetection, file_size_limit, allowed_mime_types
)
VALUES (
  'demo-grooves',
  'demo-grooves',
  true,                              -- PUBLIC: marketing content, intentionally open
  false,
  8388608,
  ARRAY['audio/ogg', 'audio/mpeg', 'audio/wav', 'application/octet-stream']
) ON CONFLICT (id) DO NOTHING;

-- Public read policy for demo-grooves (mirrors the audio-samples public-read
-- shape so anon visitors can fetch the demo card's stems with no auth).
DROP POLICY IF EXISTS "demo_grooves_public_read" ON storage.objects;
CREATE POLICY "demo_grooves_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'demo-grooves');
