-- Drop broad SELECT policies on public storage buckets.
--
-- Each of these buckets had a policy of the shape:
--   FOR SELECT USING (bucket_id = '<name>')
-- which grants SELECT for ALL storage operations on the bucket, including
-- the `list-objects` endpoint. With `public=true` on the buckets, anyone
-- with the published anon key could enumerate every file (Supabase linter
-- 0025_public_bucket_allows_listing).
--
-- Per Supabase's recommendation: public buckets serve get-object via the
-- CDN-style URL `/storage/v1/object/public/<bucket>/<path>` WITHOUT going
-- through RLS. That endpoint is what the app actually uses (verified
-- via grep of getPublicUrl + the /public/ URL pattern in apps/frontend/).
-- Dropping the broad SELECT policy stops listing but keeps every legitimate
-- per-object fetch working.
--
-- AFFECTED APP CODE:
--   - SupabaseProvider.testConnection() (apps/frontend/src/domains/playback/
--     modules/storage/providers/SupabaseProvider.ts) pings audio-samples
--     via list('', { limit: 1 }) on init. After this migration that ping
--     will fail and the provider will log "Failed to connect to Supabase"
--     and retry. This is noise, not a functional break — actual audio
--     loading uses getPublicUrl and is unaffected. The ping can be replaced
--     in a follow-up commit (e.g. with a HEAD on a known file).
--   - listInstruments() in AudioStorageService is defined but never called
--     from any other code path (verified via grep). Dead code.
--
-- ROLLBACK:
--   recreate the broad SELECT policy for each bucket — example:
--     CREATE POLICY "Public Access" ON storage.objects FOR SELECT
--       USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public Access"                          ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Audio Samples"         ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Exercise Files"        ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view exercise MIDI files"    ON storage.objects;
DROP POLICY IF EXISTS "Public read access to patterns"         ON storage.objects;
DROP POLICY IF EXISTS "tutorial_thumbnails_select"             ON storage.objects;
