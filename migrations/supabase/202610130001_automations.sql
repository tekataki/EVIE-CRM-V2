-- EVIE v3.1 · Automatizaciones (website shortcuts) — PREPARED, NOT YET APPLIED TO PRODUCTION.
-- Adds 'automations' to the allowed crm_records collections and guards its payload shape.
-- Rows stay per-owner under the existing RLS (owner_id = auth.uid()). Nothing else changes.
-- Apply once in Supabase → SQL Editor. Rollback: rollback/202610130001_automations_down.sql
begin;
do $$
declare cname text;
begin
  -- The original inline CHECK has an auto-generated name; locate it instead of guessing.
  select con.conname into cname
  from pg_constraint con join pg_class rel on rel.oid=con.conrelid join pg_namespace n on n.oid=rel.relnamespace
  where n.nspname='public' and rel.relname='crm_records' and con.contype='c'
    and pg_get_constraintdef(con.oid) like '%groceryRuns%';
  if cname is null then raise exception 'collection check constraint not found on public.crm_records'; end if;
  execute format('alter table public.crm_records drop constraint %I', cname);
end $$;
alter table public.crm_records add constraint evie_collection_allowed check (collection in (
 'transactions','bills','loans','goals','clients','routines','sessions','metrics','skills','studySessions','journal',
 'gymSessions','gymRanks','importBatches','farmAnimals','farmEvents','farmLitters','farmHealthRecords','farmSettings',
 'books','alventoDrops','alventoProducts','alventoSales','alventoMilestones','contentItems','visionItems','mediaMetadata',
 'farmTasks','farmFeedProducts','farmFeedPriceHistory','farmFeedRules','farmFeedInventoryLots','farmFeedMovements',
 'agendaItems','entityLinks','nutritionDays','pantryItems','groceryRuns','automations'));
-- Defence in depth: active shortcuts may only point to http(s) websites (the client validates fully).
alter table public.crm_records add constraint evie_automation_url_safe check (
  collection<>'automations' or deleted_at is not null or (
    jsonb_typeof(payload->'url')='string' and (payload->>'url') ~* '^https?://[^/@[:space:]]+' and length(payload->>'url')<=2048
    and jsonb_typeof(payload->'name')='string' and length(payload->>'name') between 1 and 80));
commit;
