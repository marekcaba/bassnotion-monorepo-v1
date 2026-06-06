-- Migration: Videos registry (per-video access tier for Bunny token gating).
-- Date: 2026-06-06
--
-- WHY: Bunny videos are currently played via plain public embed URLs built in
-- the browser from raw library/video IDs — anyone with the IDs can watch any
-- video, bypassing membership entirely. To gate them we need (a) a place to
-- declare each video's access tier, and (b) a server-signed playback URL.
--
-- This table is the registry. It is keyed by the Bunny `video_id` (the stable
-- identifier already used everywhere). Videos NOT present in this table default
-- to FREE at the signer — so this migration changes NOTHING on rollout; you
-- register + mark a video only when you want to gate it (opt-in gating).
--
-- Access tiers mirror groove_library / the EntitlementService:
--   free    — anyone (anon or logged in)
--   member  — active subscription / founder
--   product — must own the linked product (Groove Pack / Accelerator)

CREATE TABLE IF NOT EXISTS public.videos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Bunny identifiers (the lookup key + the library the video lives in)
  bunny_video_id  TEXT UNIQUE NOT NULL,
  bunny_library_id TEXT NOT NULL,
  -- Human label for admin management (optional)
  title           TEXT,
  -- The gate
  access_tier     TEXT NOT NULL DEFAULT 'free'
    CHECK (access_tier IN ('free','member','product')),
  product_id      UUID REFERENCES public.products(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A 'product'-tier video MUST name which product unlocks it.
ALTER TABLE public.videos
  ADD CONSTRAINT video_tier_product_ck
  CHECK (access_tier <> 'product' OR product_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_videos_access_tier ON public.videos(access_tier);

COMMENT ON TABLE public.videos IS
  'Per-video access tier for Bunny token-authenticated playback. Videos absent from this table default to FREE at the signer (opt-in gating).';
COMMENT ON COLUMN public.videos.bunny_video_id IS
  'The Bunny Stream video GUID — the lookup key used by the playback-url signer.';
COMMENT ON COLUMN public.videos.access_tier IS
  'free = anyone; member = active subscription/founder; product = must own product_id.';

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- The registry's TIER metadata is not secret (it just says "this video is
-- gated"); the SECRET is the Bunny signing key, held server-side. The backend
-- reads this table with the service-role key (bypasses RLS) inside the signer.
-- We deliberately do NOT grant anon/authenticated direct SELECT — clients have
-- no reason to read the registry directly; they call the signer endpoint.
-- (No SELECT policy = no direct client reads; service role still works.)

-- Admins manage the registry.
CREATE POLICY "Admin full access to videos"
  ON public.videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- updated_at trigger
-- =============================================================================
CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
