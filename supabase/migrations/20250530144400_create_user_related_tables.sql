-- Create tokens table for managing refresh tokens and other user tokens
create table if not exists public.tokens (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    token_type text not null,
    token_value text not null,
    expires_at timestamptz,
    revoked boolean default false,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    -- Composite unique constraint to prevent duplicate active tokens
    unique(user_id, token_type, token_value)
);

-- Set up RLS for tokens
alter table public.tokens enable row level security;

-- Only allow users to see their own tokens
create policy "Users can view their own tokens"
    on tokens for select
    using (auth.uid() = user_id);

-- Only allow users to insert their own tokens
create policy "Users can insert their own tokens"
    on tokens for insert
    with check (auth.uid() = user_id);

-- Only allow users to update their own tokens
create policy "Users can update their own tokens"
    on tokens for update
    using (auth.uid() = user_id);

-- Create user_preferences table
create table if not exists public.user_preferences (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    theme text default 'light',
    language text default 'en',
    notifications_enabled boolean default true,
    email_notifications_enabled boolean default true,
    practice_reminder_time time,
    weekly_goal_minutes integer default 0,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    -- One preference record per user
    unique(user_id)
);

-- Set up RLS for user_preferences
alter table public.user_preferences enable row level security;

-- Only allow users to see their own preferences
create policy "Users can view their own preferences"
    on user_preferences for select
    using (auth.uid() = user_id);

-- Only allow users to insert their own preferences
create policy "Users can insert their own preferences"
    on user_preferences for insert
    with check (auth.uid() = user_id);

-- Only allow users to update their own preferences
create policy "Users can update their own preferences"
    on user_preferences for update
    using (auth.uid() = user_id);

-- Create function to initialize user preferences
create or replace function public.initialize_user_preferences()
returns trigger as $$
begin
    insert into public.user_preferences (user_id)
    values (new.id);
    return new;
end;
$$ language plpgsql security definer;

-- Create trigger to automatically create user preferences
create or replace trigger on_auth_user_created_preferences
    after insert on auth.users
    for each row execute procedure public.initialize_user_preferences(); 