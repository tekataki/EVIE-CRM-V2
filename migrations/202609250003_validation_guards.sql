-- Additive hardening. Does not rewrite IDs or silently repair invalid data.
-- An invalid existing row aborts the migration for explicit operator review.
begin;

alter table public.crm_records add constraint evie_record_identity_required
 check ((jsonb_typeof(payload)='object' and jsonb_typeof(payload->'id')='string' and payload->>'id'=record_id) is true);
alter table public.crm_records add constraint evie_transaction_cents_required
 check (collection<>'transactions' or (case when jsonb_typeof(payload->'amount')='number' then
   (payload->>'amount')::numeric=trunc((payload->>'amount')::numeric)
   and (payload->>'amount')::numeric between 0 and 9007199254740991
  else false end));
alter table public.crm_records add constraint evie_record_revision_safe check(revision<=9007199254740991);
alter table public.user_preferences add constraint evie_preferences_revision_safe check(revision<=9007199254740991);
alter table public.user_preferences add constraint evie_state_shape_required check ((
 payload->'version'='4'::jsonb
 and jsonb_typeof(payload->'profile')='object'
 and jsonb_typeof(payload->'preferences')='object'
 and jsonb_typeof(payload#>'{profile,name}')='string'
 and jsonb_typeof(payload#>'{profile,preferred}')='string'
 and (not (payload->'profile' ? 'greeting_form') or payload#>>'{profile,greeting_form}' in ('Hola','Bienvenido','Bienvenida','Bienvenide'))
 ) is true);

create or replace function public.evie_apply(changes jsonb)
 returns table(owner_id uuid,collection text,record_id text,payload jsonb,revision bigint)
 language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); ch jsonb; current_revision bigint; expected bigint; c text; rid text; p jsonb; seen text[]:='{}'; k text; expected_number numeric;
begin
 if u is null then raise exception 'authentication required' using errcode='42501'; end if;
 -- IS DISTINCT FROM also rejects SQL NULL, unlike the earlier <> predicate.
 if jsonb_typeof(changes) is distinct from 'array' then raise exception 'invalid batch'; end if;
 if jsonb_array_length(changes) not between 1 and 5000 then raise exception 'invalid batch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 for ch in select value from jsonb_array_elements(changes) loop
  if jsonb_typeof(ch) is distinct from 'object' then raise exception 'invalid fields'; end if;
  if (select count(*) from jsonb_object_keys(ch))<>4 or not(ch ?& array['collection','record_id','payload','expected_revision']) then raise exception 'invalid fields'; end if;
  if jsonb_typeof(ch->'collection') is distinct from 'string'
   or jsonb_typeof(ch->'record_id') is distinct from 'string'
   or jsonb_typeof(ch->'payload') is distinct from 'object'
   or jsonb_typeof(ch->'expected_revision') is distinct from 'number' then raise exception 'invalid record'; end if;
  c:=ch->>'collection'; rid:=ch->>'record_id'; p:=ch->'payload'; k:=c||'/'||rid;
  if rid !~ '^[a-zA-Z0-9-]{1,80}$' then raise exception 'invalid record'; end if;
  if k=any(seen) then raise exception 'duplicate operation'; end if;
  seen:=array_append(seen,k);
  expected_number:=(ch->>'expected_revision')::numeric;
  -- Check before casting so fractions, overflow and unsafe JS revisions cannot pass.
  if expected_number<>trunc(expected_number) or expected_number not between 0 and 9007199254740990 then raise exception 'invalid revision'; end if;
  expected:=expected_number::bigint;
  if c='$state' then
   if rid<>'root' or p->'version' is distinct from '4'::jsonb
    or jsonb_typeof(p->'profile') is distinct from 'object'
    or jsonb_typeof(p->'preferences') is distinct from 'object'
    or jsonb_typeof(p#>'{profile,name}') is distinct from 'string'
    or jsonb_typeof(p#>'{profile,preferred}') is distinct from 'string' then raise exception 'invalid state'; end if;
   select q.revision into current_revision from public.user_preferences q where q.user_id=u;
  else
   if jsonb_typeof(p->'id') is distinct from 'string' or p->>'id' is distinct from rid then raise exception 'changed identity'; end if;
   select r.revision into current_revision from public.crm_records r where r.owner_id=u and r.collection=c and r.record_id=rid;
  end if;
  if coalesce(current_revision,0)<>expected then raise exception 'revision conflict' using errcode='23505'; end if;
  if c='$state' then
   insert into public.user_preferences as pref(user_id,payload,revision) values(u,p,1)
    on conflict(user_id) do update set payload=excluded.payload,revision=pref.revision+1,updated_at=now();
   update public.profiles set display_name=p#>>'{profile,name}',preferred_name=p#>>'{profile,preferred}',greeting_form=coalesce(p#>>'{profile,greeting_form}','Hola'),updated_at=now() where id=u;
  else
   insert into public.crm_records as rec(owner_id,collection,record_id,payload,revision,record_updated_at,deleted_at)
    values(u,c,rid,p,1,coalesce((p->>'updated_at')::timestamptz,now()),(p->>'deleted_at')::timestamptz)
    on conflict on constraint crm_records_pkey do update set payload=excluded.payload,revision=rec.revision+1,record_updated_at=excluded.record_updated_at,deleted_at=excluded.deleted_at,server_updated_at=now();
  end if;
 end loop;
 return query select r.owner_id,r.collection,r.record_id,r.payload,r.revision from public.crm_records r where r.owner_id=u and (r.collection||'/'||r.record_id)=any(seen)
 union all select pref.user_id,'$state'::text,'root'::text,pref.payload,pref.revision from public.user_preferences pref where pref.user_id=u and '$state/root'=any(seen);
end $$;
revoke all on function public.evie_apply(jsonb) from public;
grant execute on function public.evie_apply(jsonb) to authenticated;

-- Correct an accidentally pre-existing public bucket instead of silently keeping it public.
update storage.buckets set public=false,file_size_limit=10485760,
 allowed_mime_types=array['image/webp','image/png','image/jpeg'] where id='user-media';
-- Restrictive policies remain ANDed with any unrelated permissive policy. Other
-- buckets keep their existing policy behavior. Supabase owns/enables Storage RLS.
create policy evie_media_owner_guard on storage.objects as restrictive for all to authenticated
 using (bucket_id<>'user-media' or (auth.uid() is not null and (storage.foldername(name))[1]=auth.uid()::text
  and name ~ '^[0-9a-f-]{36}/[a-zA-Z0-9-]{1,86}\.(webp|png|jpg|jpeg)$'))
 with check (bucket_id<>'user-media' or (auth.uid() is not null and (storage.foldername(name))[1]=auth.uid()::text
  and name ~ '^[0-9a-f-]{36}/[a-zA-Z0-9-]{1,86}\.(webp|png|jpg|jpeg)$'));
create policy evie_media_no_anon on storage.objects as restrictive for all to anon
 using (bucket_id<>'user-media') with check (bucket_id<>'user-media');
commit;
