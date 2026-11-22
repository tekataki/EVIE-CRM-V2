-- Rollback of 202611230001_ai_chat. DESTRUCTIVE: removes every chat and memory stored in Supabase.
-- Run only with the owner's explicit approval (and after exporting «Lo que Ivi sabe de ti» if needed).
drop function if exists public.evie_chat_stamp();
drop function if exists public.ai_truncate_messages(uuid, integer);
drop function if exists public.ai_append_messages(uuid, jsonb);
drop trigger if exists ai_messages_same_owner on public.ai_messages;
drop function if exists public.ai_messages_same_owner();
drop table if exists public.ai_memory_events;
drop table if exists public.ai_state;
drop table if exists public.ai_messages;
drop table if exists public.ai_memories;
drop table if exists public.ai_conversations;
