-- Update profiles table with additional fields
alter table public.profiles
add column if not exists skill_level text check (skill_level in ('beginner', 'intermediate', 'advanced')) default 'beginner',
add column if not exists bio text,
add column if not exists location text,
add column if not exists social_links jsonb default '{}',
add column if not exists zero_mission_completed boolean default false,
add column if not exists practice_streak_days integer default 0;

-- Update user_preferences table with playback-related settings
alter table public.user_preferences
add column if not exists default_metronome_volume integer default 75 check (default_metronome_volume between 0 and 100),
add column if not exists default_drums_volume integer default 75 check (default_drums_volume between 0 and 100),
add column if not exists default_bass_volume integer default 75 check (default_bass_volume between 0 and 100),
add column if not exists default_harmony_volume integer default 75 check (default_harmony_volume between 0 and 100),
add column if not exists default_tempo integer default 120 check (default_tempo between 40 and 300),
add column if not exists default_metronome_sound text default 'click',
add column if not exists default_time_signature text default '4/4',
add column if not exists default_subdivision text default '1/4',
add column if not exists fretboard_left_handed boolean default false,
add column if not exists notation_left_handed boolean default false,
add column if not exists generation_tokens_balance integer default 5;

-- Add indexes for frequently accessed fields
create index if not exists idx_profiles_skill_level on public.profiles(skill_level);
create index if not exists idx_profiles_zero_mission on public.profiles(zero_mission_completed);
create index if not exists idx_profiles_practice_streak on public.profiles(practice_streak_days);

-- Update RLS policies for new fields
drop policy if exists "Users can view their own preferences" on user_preferences;
create policy "Users can view their own preferences"
    on user_preferences for select
    using (auth.uid() = user_id);

drop policy if exists "Users can update their own preferences" on user_preferences;
create policy "Users can update their own preferences"
    on user_preferences for update
    using (auth.uid() = user_id);

-- Add function to update practice streak
create or replace function public.update_practice_streak()
returns trigger as $$
begin
    -- Logic for updating practice streak will be implemented here
    -- This is a placeholder for future implementation
    return new;
end;
$$ language plpgsql security definer; 