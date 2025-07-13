-- Create exercise-files storage bucket for MIDI and MusicXML files
insert into storage.buckets (id, name, public)
values ('exercise-files', 'exercise-files', true)
on conflict (id) do nothing;

-- Drop existing policies if they exist
drop policy if exists "Public Access to Exercise Files" on storage.objects;
drop policy if exists "Users can upload exercise files" on storage.objects;
drop policy if exists "Users can update their own exercise files" on storage.objects;
drop policy if exists "Users can delete their own exercise files" on storage.objects;

-- Set up storage policies for exercise files
create policy "Public Access to Exercise Files"
on storage.objects for select
using ( bucket_id = 'exercise-files' );

create policy "Users can upload exercise files"
on storage.objects for insert
with check ( 
  bucket_id = 'exercise-files' 
  and auth.role() = 'authenticated'
);

create policy "Users can update their own exercise files"
on storage.objects for update
using ( 
  bucket_id = 'exercise-files' 
  and auth.role() = 'authenticated'
);

create policy "Users can delete their own exercise files"
on storage.objects for delete
using ( 
  bucket_id = 'exercise-files' 
  and auth.role() = 'authenticated'
);