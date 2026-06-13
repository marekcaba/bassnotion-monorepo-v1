-- Migration: private premium-basslines storage bucket (Lines & Fills, PR4).
-- Date: 2026-06-10
--
-- WHY: Premium alternate basslines must be GENUINELY access-controlled, not just
-- hidden in the UI. The free bass/drums/harmony stems live in the PUBLIC
-- audio-samples bucket (the /free funnel + ~40 loaders depend on that) and stay
-- there. Paid basslines go in THIS private bucket: no public URL, no broad
-- authenticated read — the ONLY read path is a short-lived signed URL minted by
-- the backend signer AFTER it checks entitlement (feature grant AND the groove's
-- own content access). The signer uses the service-role client, which bypasses
-- RLS, so we intentionally grant NO storage SELECT policy to anon/authenticated.
--
-- Contrast with exercise-midi-temp (the private-bucket precedent), which DOES
-- let any authenticated user read — that's wrong for paid content, so we lock
-- this one to service-role-only reads.

INSERT INTO storage.buckets (
  id, name, public, avif_autodetection, file_size_limit, allowed_mime_types
)
VALUES (
  'premium-basslines',
  'premium-basslines',
  false,                              -- PRIVATE: no public CDN URL
  false,
  8388608,                           -- 8MB (same ceiling as groove stems)
  ARRAY['audio/ogg', 'audio/mpeg', 'audio/wav', 'application/octet-stream']
) ON CONFLICT (id) DO NOTHING;

-- RLS: enabled by default on storage.objects. We add NO anon/authenticated
-- SELECT/INSERT policy for this bucket on purpose:
--   • READS  → only via backend-minted signed URLs (service role bypasses RLS).
--   • WRITES → only via the admin upload endpoint (service role, AdminGuard).
-- So a logged-in non-admin user has zero direct storage access to this bucket;
-- the entitlement-gated signer is the sole door. (No GRANT/policy needed —
-- absence of a policy = deny for non-service-role roles.)
