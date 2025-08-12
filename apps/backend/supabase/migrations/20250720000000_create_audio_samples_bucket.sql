-- Create audio-samples storage bucket for professional audio samples
-- Admin write permissions, public read access for professional audio content
insert into storage.buckets (id, name, public)
values ('audio-samples', 'audio-samples', true)
on conflict (id) do nothing;

-- Drop existing policies if they exist
drop policy if exists "Public Access to Audio Samples" on storage.objects;
drop policy if exists "Admin can upload audio samples" on storage.objects;
drop policy if exists "Admin can update audio samples" on storage.objects;
drop policy if exists "Admin can delete audio samples" on storage.objects;

-- Set up storage policies for audio samples
-- Public read access for all users (needed for audio playback)
create policy "Public Access to Audio Samples"
on storage.objects for select
using ( bucket_id = 'audio-samples' );

-- Admin-only write permissions for sample management
create policy "Admin can upload audio samples"
on storage.objects for insert
with check ( 
  bucket_id = 'audio-samples' 
  and auth.role() = 'authenticated'
  and exists (
    select 1 from profiles 
    where profiles.id = auth.uid() 
    and profiles.role = 'admin'
  )
);

create policy "Admin can update audio samples"
on storage.objects for update
using ( 
  bucket_id = 'audio-samples' 
  and auth.role() = 'authenticated'
  and exists (
    select 1 from profiles 
    where profiles.id = auth.uid() 
    and profiles.role = 'admin'
  )
);

create policy "Admin can delete audio samples"
on storage.objects for delete
using ( 
  bucket_id = 'audio-samples' 
  and auth.role() = 'authenticated'
  and exists (
    select 1 from profiles 
    where profiles.id = auth.uid() 
    and profiles.role = 'admin'
  )
);