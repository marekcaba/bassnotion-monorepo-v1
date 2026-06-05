-- ROOT-CAUSE FIX: the auth.users triggers are completely missing.
--
-- Diagnostic against staging:
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;
-- returned NO rows. Both on_auth_user_created (calls handle_new_user)
-- and on_auth_user_created_preferences (calls initialize_user_preferences)
-- are absent. So every signup creates an auth.users row with no
-- corresponding profiles / user_preferences row — confirmed by 3 orphaned
-- users in staging (dakjgds@google.com, fsdfs@google.com,
-- digmarec@gmail.com).
--
-- The functions exist; only the trigger bindings are missing. Something
-- somewhere dropped them. We've spent the day blaming GRANTs while the
-- triggers were never being invoked in the first place. Every signup
-- after the trigger was dropped has been silently orphaning.
--
-- This migration:
--   1. Re-creates the trigger function bodies idempotently (defensive —
--      same shape as the May 20260513214005 migration).
--   2. Drops + re-creates both AFTER INSERT triggers on auth.users.
--   3. Backfills profiles + user_preferences rows for any existing
--      auth.users without one.
--
-- After applying: register a fresh account → profile + user_preferences
-- rows appear instantly. The validateToken 401 disappears because the
-- backend finds a profile row.

-- 1a. handle_new_user — creates profiles row on signup ────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 1b. initialize_user_preferences — creates user_preferences row on signup
CREATE OR REPLACE FUNCTION public.initialize_user_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2a. Re-bind on_auth_user_created (profiles) ─────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2b. Re-bind on_auth_user_created_preferences (user_preferences) ─────────
DROP TRIGGER IF EXISTS on_auth_user_created_preferences ON auth.users;
CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.initialize_user_preferences();

-- 3. Backfill orphans ─────────────────────────────────────────────────────
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_preferences (user_id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.user_preferences up ON up.user_id = u.id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
