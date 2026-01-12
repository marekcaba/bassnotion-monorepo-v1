-- Add provider column to profiles table for OAuth tracking
alter table public.profiles
add column if not exists provider text default 'email' check (provider in ('email', 'google', 'github', 'apple', 'facebook'));

-- Create index for provider column for efficient querying
create index if not exists idx_profiles_provider on public.profiles(provider);

-- Add comment for documentation
comment on column public.profiles.provider is 'Authentication provider used to create the account (email, google, github, etc.)'; 