-- Create a function to check if a user exists by email
create or replace function public.check_user_exists(email_input text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from auth.users
    where email = email_input
  );
end;
$$;

-- Grant access to the function
grant execute on function public.check_user_exists(text) to anon, authenticated; 