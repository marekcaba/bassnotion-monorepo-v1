-- Ensure every auth.users row has a matching profiles row.
--
-- A trigger to auto-create the profile on signup exists in
-- 20250530144300_create_profiles_table.sql, but production has users
-- without a corresponding profile row (e.g. signups via the frontend-direct
-- supabase.auth.signUp path that don't go through the backend's registerUser
-- flow). The backend's validateToken throws 401 "Invalid token" when a
-- valid JWT references a user that has no profile, breaking the dashboard
-- for any account created outside the backend.
--
-- This migration:
--   1. Re-creates the trigger function idempotently (defensive — in case
--      it was dropped or its behavior drifted).
--   2. Re-binds the trigger to auth.users.
--   3. Backfills profile rows for any existing auth.users without one.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for any existing auth.users without one.
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
