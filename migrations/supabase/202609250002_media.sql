begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('user-media','user-media',false,10485760,array['image/webp','image/png','image/jpeg']) on conflict(id) do nothing;
create policy evie_media_read on storage.objects for select to authenticated using(bucket_id='user-media' and auth.uid() is not null and (storage.foldername(name))[1]=auth.uid()::text);
create policy evie_media_insert on storage.objects for insert to authenticated with check(bucket_id='user-media' and auth.uid() is not null and (storage.foldername(name))[1]=auth.uid()::text);
create policy evie_media_update on storage.objects for update to authenticated using(bucket_id='user-media' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='user-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy evie_media_delete on storage.objects for delete to authenticated using(bucket_id='user-media' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
