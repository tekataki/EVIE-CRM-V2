-- EVIE schema 4 mapping. All CRM identifiers remain TEXT, case preserved.
-- Apply once to Supabase. No service_role key is required by the application.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9._-]{3,24}$'),
 username_key text not null unique check (username_key=username),
 display_name text not null default '', preferred_name text not null default '',
 greeting_form text not null default 'Hola' check(greeting_form in ('Hola','Bienvenido','Bienvenida','Bienvenide')),
 avatar_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 revision bigint not null default 1 check(revision>0), updated_at timestamptz not null default now()
);
create table public.crm_records (
 owner_id uuid not null references auth.users(id) on delete cascade,
 collection text not null check(collection in ('transactions','bills','loans','goals','clients','routines','sessions','metrics','skills','studySessions','journal','gymSessions','gymRanks','importBatches','farmAnimals','farmEvents','farmLitters','farmHealthRecords','farmSettings','books','alventoDrops','alventoProducts','alventoSales','alventoMilestones','contentItems','visionItems','mediaMetadata','farmTasks','farmFeedProducts','farmFeedPriceHistory','farmFeedRules','farmFeedInventoryLots','farmFeedMovements','agendaItems','entityLinks','nutritionDays','pantryItems','groceryRuns')),
 record_id text collate "C" not null check(record_id ~ '^[a-zA-Z0-9-]{1,80}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=record_id),
 record_updated_at timestamptz not null default now(), deleted_at timestamptz,
 revision bigint not null default 1 check(revision>0), server_updated_at timestamptz not null default now(),
 primary key(owner_id,collection,record_id),
 check(collection<>'transactions' or (jsonb_typeof(payload->'amount')='number' and (payload->>'amount')::numeric=trunc((payload->>'amount')::numeric) and (payload->>'amount')::numeric between 0 and 9007199254740991))
);
create table public.sync_devices(user_id uuid references auth.users(id) on delete cascade,device_id uuid,device_name text,last_seen_at timestamptz default now(),last_sync_at timestamptz,primary key(user_id,device_id));
create table public.contacts(owner_id uuid references auth.users(id) on delete cascade,id uuid default gen_random_uuid(),display_name text not null,aliases text[] not null default '{}',whatsapp_number text check(whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),instagram_handle text,notes text,deleted_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),primary key(owner_id,id));
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.crm_records enable row level security;
alter table public.sync_devices enable row level security;
alter table public.contacts enable row level security;
create policy own_profile on public.profiles for all to authenticated using(auth.uid() is not null and id=auth.uid()) with check(auth.uid() is not null and id=auth.uid());
create policy own_preferences on public.user_preferences for all to authenticated using(auth.uid() is not null and user_id=auth.uid()) with check(auth.uid() is not null and user_id=auth.uid());
create policy own_records on public.crm_records for all to authenticated using(auth.uid() is not null and owner_id=auth.uid()) with check(auth.uid() is not null and owner_id=auth.uid());
create policy own_devices on public.sync_devices for all to authenticated using(auth.uid() is not null and user_id=auth.uid()) with check(auth.uid() is not null and user_id=auth.uid());
create policy own_contacts on public.contacts for all to authenticated using(auth.uid() is not null and owner_id=auth.uid()) with check(auth.uid() is not null and owner_id=auth.uid());
revoke all on public.profiles,public.user_preferences,public.crm_records,public.sync_devices,public.contacts from anon;
grant select on public.profiles,public.user_preferences,public.crm_records to authenticated;
-- Data writes must pass the CAS RPC, including when using a raw Supabase client.
revoke insert,update,delete on public.profiles,public.user_preferences,public.crm_records from authenticated;
grant select,insert,update,delete on public.contacts,public.sync_devices to authenticated;
create function public.evie_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username,username_key) values(new.id,new.raw_user_meta_data->>'username',new.raw_user_meta_data->>'username');
 return new;
end $$;
revoke all on function public.evie_new_user() from public;
create trigger evie_profile_created after insert on auth.users for each row execute function public.evie_new_user();

create function public.evie_pull(after_key text default '') returns table(owner_id uuid,collection text,record_id text,payload jsonb,revision bigint) language sql stable security invoker set search_path='' as $$
 select * from (
 select r.owner_id,r.collection,r.record_id,r.payload,r.revision from public.crm_records r where r.owner_id=auth.uid()
 union all select p.user_id,'$state'::text,'root'::text,p.payload,p.revision from public.user_preferences p where p.user_id=auth.uid()
 ) x where (x.collection||'/'||x.record_id) collate "C" > after_key collate "C" order by (x.collection||'/'||x.record_id) collate "C" limit 500
$$;
revoke all on function public.evie_pull(text) from public;
grant execute on function public.evie_pull(text) to authenticated;

-- One transaction for a logical Store mutation, including linked payments.
-- Explicit authenticated owner, fixed tables, no dynamic SQL, per-owner lock.
create function public.evie_apply(changes jsonb) returns table(owner_id uuid,collection text,record_id text,payload jsonb,revision bigint) language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); ch jsonb; current_revision bigint; expected bigint; c text; rid text; p jsonb; seen text[]:='{}'; k text;
begin
 if u is null then raise exception 'authentication required' using errcode='42501'; end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes) not between 1 and 5000 then raise exception 'invalid batch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 for ch in select value from jsonb_array_elements(changes) loop
  if (select count(*) from jsonb_object_keys(ch))<>4 or not(ch ?& array['collection','record_id','payload','expected_revision']) then raise exception 'invalid fields'; end if;
  c:=ch->>'collection'; rid:=ch->>'record_id'; p:=ch->'payload'; k:=c||'/'||rid;
  if k=any(seen) then raise exception 'duplicate operation'; end if; seen:=array_append(seen,k);
  if rid !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(p)<>'object' or jsonb_typeof(ch->'expected_revision')<>'number' then raise exception 'invalid record'; end if;
  expected:=(ch->>'expected_revision')::bigint;
  if expected<0 or (ch->>'expected_revision')::numeric<>expected then raise exception 'invalid revision'; end if;
  if c='$state' then
   if rid<>'root' or p->>'version'<>'4' or not(p ?& array['profile','preferences']) then raise exception 'invalid state'; end if;
   select q.revision into current_revision from public.user_preferences q where q.user_id=u;
  else
   if p->>'id' is distinct from rid then raise exception 'changed identity'; end if;
   select r.revision into current_revision from public.crm_records r where r.owner_id=u and r.collection=c and r.record_id=rid;
  end if;
  if coalesce(current_revision,0)<>expected then raise exception 'revision conflict' using errcode='23505'; end if;
  if c='$state' then
   insert into public.user_preferences as pref(user_id,payload,revision) values(u,p,1) on conflict(user_id) do update set payload=excluded.payload,revision=pref.revision+1,updated_at=now();
   update public.profiles set display_name=coalesce(p#>>'{profile,name}',''),preferred_name=coalesce(p#>>'{profile,preferred}',''),greeting_form=coalesce(p#>>'{profile,greeting_form}','Hola'),updated_at=now() where id=u;
  else
   insert into public.crm_records as rec(owner_id,collection,record_id,payload,revision,record_updated_at,deleted_at) values(u,c,rid,p,1,coalesce((p->>'updated_at')::timestamptz,now()),(p->>'deleted_at')::timestamptz)
   on conflict on constraint crm_records_pkey do update set payload=excluded.payload,revision=rec.revision+1,record_updated_at=excluded.record_updated_at,deleted_at=excluded.deleted_at,server_updated_at=now();
  end if;
 end loop;
 return query select r.owner_id,r.collection,r.record_id,r.payload,r.revision from public.crm_records r where r.owner_id=u and (r.collection||'/'||r.record_id)=any(seen)
 union all select pref.user_id,'$state'::text,'root'::text,pref.payload,pref.revision from public.user_preferences pref where pref.user_id=u and '$state/root'=any(seen);
end $$;
revoke all on function public.evie_apply(jsonb) from public;
grant execute on function public.evie_apply(jsonb) to authenticated;
commit;
