-- Rollback for 202610130001_automations.sql. Run ONLY to undo it.
-- Export first if you want to keep shortcuts:
--   select owner_id, payload from public.crm_records where collection='automations';
begin;
delete from public.crm_records where collection='automations';
alter table public.crm_records drop constraint if exists evie_automation_url_safe;
alter table public.crm_records drop constraint if exists evie_collection_allowed;
alter table public.crm_records add constraint crm_records_collection_check check (collection in (
 'transactions','bills','loans','goals','clients','routines','sessions','metrics','skills','studySessions','journal',
 'gymSessions','gymRanks','importBatches','farmAnimals','farmEvents','farmLitters','farmHealthRecords','farmSettings',
 'books','alventoDrops','alventoProducts','alventoSales','alventoMilestones','contentItems','visionItems','mediaMetadata',
 'farmTasks','farmFeedProducts','farmFeedPriceHistory','farmFeedRules','farmFeedInventoryLots','farmFeedMovements',
 'agendaItems','entityLinks','nutritionDays','pantryItems','groceryRuns'));
commit;
