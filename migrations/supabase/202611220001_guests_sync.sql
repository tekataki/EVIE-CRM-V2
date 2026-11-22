-- EVIE · Invitados de 72 h en Supabase + sello de sincronización entre dispositivos.
-- Aditiva: no modifica ni borra datos existentes. Requiere 0001–0005.
--
-- Invitados (sin clave secreta en el servidor):
--   · El Worker crea al invitado con el alta normal de Supabase (correo sintético guest-<12 hex>@…,
--     metadata guest=true) y, con la sesión del propio invitado, llama a evie_guest_register().
--   · La caducidad la fija ESTA base (now()+72 h), no el cliente ni el Worker.
--   · Al vencer (o al terminarla el propietario) la RLS bloquea todo de inmediato, y pg_cron borra al
--     usuario cada 15 min; ON DELETE CASCADE elimina perfiles, preferencias, registros, contactos y dispositivos.
--   · Los invitados no suben archivos a Storage: así no quedan archivos huérfanos (Supabase prohíbe
--     borrar objetos de Storage desde SQL).
-- Sincronización: evie_sync_stamp() devuelve una huella barata de la cuenta para que cada dispositivo
-- sepa si otro cambió algo sin descargar todo.
begin;

create table if not exists public.evie_guests(
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  constraint evie_guest_max_72h check (expires_at <= created_at + interval '72 hours')
);
create index if not exists evie_guests_expiry on public.evie_guests(expires_at);
alter table public.evie_guests enable row level security;
revoke all on public.evie_guests from anon, authenticated;
grant select on public.evie_guests to authenticated;
drop policy if exists own_guest_row on public.evie_guests;
create policy own_guest_row on public.evie_guests for select to authenticated using (user_id = (select auth.uid()));

-- ¿La sesión actual es de un invitado vencido o terminado? (solo mira su propia fila)
create or replace function public.evie_guest_blocked() returns boolean
 language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.evie_guests g
   where g.user_id = (select auth.uid()) and (g.ended_at is not null or g.expires_at <= now()))
$$;
revoke all on function public.evie_guest_blocked() from public, anon;
grant execute on function public.evie_guest_blocked() to authenticated;

-- El invitado se registra a sí mismo UNA vez, dentro de los 10 min posteriores a su alta.
create or replace function public.evie_guest_register(display_name text) returns timestamptz
 language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); e text; meta jsonb; born timestamptz; exp timestamptz;
 n text := btrim(regexp_replace(coalesce(display_name,''), '\s+', ' ', 'g'));
begin
 if u is null then raise exception 'authentication required' using errcode='42501'; end if;
 select x.email, x.raw_user_meta_data, x.created_at into e, meta, born from auth.users x where x.id = u;
 if coalesce(e,'') !~ '^guest-[0-9a-f]{12}@' or coalesce(meta->>'guest','') <> 'true' then
  raise exception 'not a guest account' using errcode='42501'; end if;
 if born < now() - interval '10 minutes' then raise exception 'guest registration window closed' using errcode='42501'; end if;
 if char_length(n) not between 2 and 40 then raise exception 'invalid display name' using errcode='22023'; end if;
 insert into public.evie_guests(user_id, display_name, created_at, expires_at)
  values (u, n, now(), now() + interval '72 hours') on conflict (user_id) do nothing;
 select g.expires_at into exp from public.evie_guests g where g.user_id = u;
 return exp;
end $$;
revoke all on function public.evie_guest_register(text) from public, anon;
grant execute on function public.evie_guest_register(text) to authenticated;

-- El Worker la llama con la sesión del invitado cuando el propietario termina el acceso antes de tiempo.
create or replace function public.evie_guest_end() returns void
 language sql security definer set search_path='' as $$
  update public.evie_guests set ended_at = coalesce(ended_at, now()) where user_id = (select auth.uid())
$$;
revoke all on function public.evie_guest_end() from public, anon;
grant execute on function public.evie_guest_end() to authenticated;

-- Borra invitados vencidos/terminados y altas de invitado que nunca se registraron (>1 h).
-- Nunca toca una cuenta sin metadata guest=true y correo guest-<hex>.
create or replace function public.evie_guest_purge() returns integer
 language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 with doomed as (
  select g.user_id from public.evie_guests g where coalesce(g.ended_at, g.expires_at) <= now()
  union
  select u.id from auth.users u
   where u.email ~ '^guest-[0-9a-f]{12}@' and u.raw_user_meta_data->>'guest' = 'true'
     and u.created_at < now() - interval '1 hour'
     and not exists (select 1 from public.evie_guests g where g.user_id = u.id)
 )
 delete from auth.users u using doomed d
  where u.id = d.user_id
    and u.email ~ '^guest-[0-9a-f]{12}@' and u.raw_user_meta_data->>'guest' = 'true'
    and not exists (select 1 from storage.objects o where o.bucket_id = 'user-media' and (storage.foldername(o.name))[1] = u.id::text);
 get diagnostics n = row_count;
 return n;
end $$;
revoke all on function public.evie_guest_purge() from public, anon, authenticated;

-- Bloqueo inmediato al vencer, también para llamadas directas a la API (RLS restrictiva, se suma a las otras).
drop policy if exists evie_guest_expired_block on public.crm_records;
create policy evie_guest_expired_block on public.crm_records as restrictive for all to authenticated
 using (not (select public.evie_guest_blocked())) with check (not (select public.evie_guest_blocked()));
drop policy if exists evie_guest_expired_block on public.user_preferences;
create policy evie_guest_expired_block on public.user_preferences as restrictive for all to authenticated
 using (not (select public.evie_guest_blocked())) with check (not (select public.evie_guest_blocked()));
drop policy if exists evie_guest_expired_block on public.profiles;
create policy evie_guest_expired_block on public.profiles as restrictive for all to authenticated
 using (not (select public.evie_guest_blocked())) with check (not (select public.evie_guest_blocked()));
drop policy if exists evie_guest_expired_block on public.contacts;
create policy evie_guest_expired_block on public.contacts as restrictive for all to authenticated
 using (not (select public.evie_guest_blocked())) with check (not (select public.evie_guest_blocked()));
drop policy if exists evie_guest_expired_block on public.sync_devices;
create policy evie_guest_expired_block on public.sync_devices as restrictive for all to authenticated
 using (not (select public.evie_guest_blocked())) with check (not (select public.evie_guest_blocked()));
-- Invitados: sin subidas a Storage (sus fotos se quedan en su dispositivo).
drop policy if exists evie_media_no_guest_upload on storage.objects;
create policy evie_media_no_guest_upload on storage.objects as restrictive for insert to authenticated
 with check (bucket_id <> 'user-media' or not exists (select 1 from public.evie_guests g where g.user_id = (select auth.uid())));

-- evie_apply es SECURITY DEFINER (no pasa por RLS): mismo cuerpo que 0003 + bloqueo de invitado vencido.
create or replace function public.evie_apply(changes jsonb)
 returns table(owner_id uuid,collection text,record_id text,payload jsonb,revision bigint)
 language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); ch jsonb; current_revision bigint; expected bigint; c text; rid text; p jsonb; seen text[]:='{}'; k text; expected_number numeric;
begin
 if u is null then raise exception 'authentication required' using errcode='42501'; end if;
 if public.evie_guest_blocked() then raise exception 'guest access ended' using errcode='42501'; end if;
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
revoke all on function public.evie_apply(jsonb) from public, anon;
grant execute on function public.evie_apply(jsonb) to authenticated;

-- Huella de la cuenta: cambia con cualquier alta, edición, borrado lógico o cambio de preferencias.
create or replace function public.evie_sync_stamp() returns text
 language sql stable security invoker set search_path='' as $$
  select (select count(*)::text || '.' || coalesce(extract(epoch from max(r.server_updated_at))::text, '0')
            from public.crm_records r where r.owner_id = (select auth.uid()))
      || '|' || coalesce((select p.revision::text from public.user_preferences p where p.user_id = (select auth.uid())), '0')
$$;
revoke all on function public.evie_sync_stamp() from public, anon;
grant execute on function public.evie_sync_stamp() to authenticated;

commit;

-- Limpieza programada (fuera de la transacción: pg_cron).
create extension if not exists pg_cron;
select cron.schedule('evie-guest-purge', '*/15 * * * *', $cron$select public.evie_guest_purge()$cron$);
