-- EVIE v10 · Chat con Ivi + memoria a largo plazo (aditiva: no toca tablas existentes).
-- Todo el contenido (títulos, mensajes, recuerdos, perfil de memoria) llega CIFRADO por el Worker (AES-GCM con
-- EVIE_SESSION_KEY): un volcado crudo de la base no expone texto. El navegador nunca habla con Supabase; el Worker
-- usa el token del propio usuario, así que RLS por dueño aplica en cada fila.

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title_sealed text not null default '' check (length(title_sealed) <= 4000),
  pinned boolean not null default false,
  archived boolean not null default false,
  private boolean not null default false,
  tier text not null default 'enfoque' check (tier in ('chispa','enfoque','profundo')),
  message_count integer not null default 0 check (message_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_owner_updated on public.ai_conversations (owner_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seq integer not null check (seq >= 1),
  role text not null check (role in ('user','assistant')),
  content_sealed text not null check (length(content_sealed) <= 400000),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object' and length(meta::text) <= 4000),
  created_at timestamptz not null default now(),
  unique (conversation_id, seq)
);
create index if not exists ai_messages_owner on public.ai_messages (owner_id);

create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('profile','preference','project','goal','person','decision','fact')),
  content_sealed text not null check (length(content_sealed) <= 20000),
  importance smallint not null default 3 check (importance between 1 and 5),
  confidence real not null default 0.8 check (confidence >= 0 and confidence <= 1),
  source_conversation uuid references public.ai_conversations(id) on delete set null,
  superseded_by uuid references public.ai_memories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists ai_memories_owner_active on public.ai_memories (owner_id, updated_at desc) where deleted_at is null;

create table if not exists public.ai_memory_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  memory_id uuid references public.ai_memories(id) on delete set null,
  op text not null check (op in ('add','update','forget','restore','edit','migrate')),
  detail_sealed text not null default '' check (length(detail_sealed) <= 20000),
  created_at timestamptz not null default now()
);
create index if not exists ai_memory_events_owner on public.ai_memory_events (owner_id, created_at desc);

create table if not exists public.ai_state (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  profile_sealed text not null default '' check (length(profile_sealed) <= 20000),
  profile_version integer not null default 0,
  changes_since_profile integer not null default 0,
  migrated_d1 boolean not null default false,
  updated_at timestamptz not null default now()
);

-- RLS: each person only sees and writes their own rows; expired guests are blocked like everywhere else.
do $$
declare t text;
begin
  foreach t in array array['ai_conversations','ai_messages','ai_memories','ai_memory_events','ai_state'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid()) is not null and owner_id = (select auth.uid())) with check ((select auth.uid()) is not null and owner_id = (select auth.uid()))', t);
    execute format('drop policy if exists evie_guest_expired_block on public.%I', t);
    execute format('create policy evie_guest_expired_block on public.%I as restrictive for all to authenticated using (not (select public.evie_guest_blocked())) with check (not (select public.evie_guest_blocked()))', t);
  end loop;
end $$;
revoke all on sequence public.ai_memory_events_id_seq from anon, public;
grant usage on sequence public.ai_memory_events_id_seq to authenticated;

-- A message belongs to a conversation of the same owner (RLS alone would allow pointing at another id).
create or replace function public.ai_messages_same_owner() returns trigger
 language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.ai_conversations c where c.id = new.conversation_id and c.owner_id = new.owner_id) then
    raise exception 'conversation not found' using errcode = '23503';
  end if;
  return new;
end $$;
drop trigger if exists ai_messages_same_owner on public.ai_messages;
create trigger ai_messages_same_owner before insert or update on public.ai_messages for each row execute function public.ai_messages_same_owner();

-- Append messages atomically with consecutive seq numbers (locks the conversation row; RLS applies).
create or replace function public.ai_append_messages(p_conversation uuid, p_messages jsonb)
 returns table (id uuid, seq integer, role text, created_at timestamptz)
 language plpgsql security invoker set search_path = '' as $$
declare n integer; m jsonb; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) not between 1 and 4 then raise exception 'invalid batch' using errcode = '22023'; end if;
  perform 1 from public.ai_conversations c where c.id = p_conversation and c.owner_id = uid for update;
  if not found then raise exception 'conversation not found' using errcode = '23503'; end if;
  select coalesce(max(x.seq), 0) into n from public.ai_messages x where x.conversation_id = p_conversation;
  for m in select * from jsonb_array_elements(p_messages) loop
    n := n + 1;
    return query insert into public.ai_messages (conversation_id, owner_id, seq, role, content_sealed, meta)
      values (p_conversation, uid, n, m->>'role', m->>'content_sealed', coalesce(m->'meta', '{}'::jsonb))
      returning ai_messages.id, ai_messages.seq, ai_messages.role, ai_messages.created_at;
  end loop;
  update public.ai_conversations c set message_count = n, updated_at = now() where c.id = p_conversation;
end $$;

-- Regenerate / edit-last: drop the messages from p_seq on (same owner only).
create or replace function public.ai_truncate_messages(p_conversation uuid, p_seq integer)
 returns integer language plpgsql security invoker set search_path = '' as $$
declare removed integer; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  perform 1 from public.ai_conversations c where c.id = p_conversation and c.owner_id = uid for update;
  if not found then raise exception 'conversation not found' using errcode = '23503'; end if;
  delete from public.ai_messages x where x.conversation_id = p_conversation and x.seq >= p_seq;
  get diagnostics removed = row_count;
  update public.ai_conversations c set message_count = (select count(*) from public.ai_messages y where y.conversation_id = p_conversation), updated_at = now() where c.id = p_conversation;
  return removed;
end $$;

-- Cheap cross-device change detector for chats and memory (polled with the existing sync stamp).
create or replace function public.evie_chat_stamp() returns text
 language sql stable security invoker set search_path = '' as $$
  select coalesce((select count(*)::text || '.' || coalesce(extract(epoch from max(updated_at))::bigint::text, '0') from public.ai_conversations where owner_id = (select auth.uid())), '0.0')
    || '|' || coalesce((select count(*)::text || '.' || coalesce(extract(epoch from max(updated_at))::bigint::text, '0') from public.ai_memories where owner_id = (select auth.uid())), '0.0')
$$;

do $$
declare f text;
begin
  foreach f in array array['ai_append_messages(uuid, jsonb)','ai_truncate_messages(uuid, integer)','evie_chat_stamp()','ai_messages_same_owner()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
  end loop;
end $$;
grant execute on function public.ai_append_messages(uuid, jsonb) to authenticated;
grant execute on function public.ai_truncate_messages(uuid, integer) to authenticated;
grant execute on function public.evie_chat_stamp() to authenticated;
