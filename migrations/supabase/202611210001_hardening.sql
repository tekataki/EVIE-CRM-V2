-- EVIE · Endurecimiento tras el linter de Supabase (aplicada 2026-11-21 al proyecto evie-crm).
-- Aditiva e idempotente: no toca datos. Se puede repetir sin daño.
--
-- 1) Supabase concede EXECUTE directamente a anon/authenticated en funciones nuevas de "public";
--    "revoke ... from public" (las migraciones anteriores) NO retira esos permisos.
--    · evie_new_user: es solo de trigger → nadie debe poder llamarla por /rest/v1/rpc.
--    · evie_apply / evie_pull: solo usuarios con sesión (authenticated). anon fuera.
-- 2) Políticas RLS con (select auth.uid()) para que se evalúe una vez por consulta, no por fila.
begin;

revoke execute on function public.evie_new_user() from public, anon, authenticated;
revoke execute on function public.evie_apply(jsonb) from public, anon;
revoke execute on function public.evie_pull(text) from public, anon;
grant execute on function public.evie_apply(jsonb) to authenticated;
grant execute on function public.evie_pull(text) to authenticated;

-- Las funciones futuras que se creen en public no quedarán abiertas a anon por defecto.
alter default privileges in schema public revoke execute on functions from public, anon;

alter policy own_profile on public.profiles
  using ((select auth.uid()) is not null and id = (select auth.uid()))
  with check ((select auth.uid()) is not null and id = (select auth.uid()));
alter policy own_preferences on public.user_preferences
  using ((select auth.uid()) is not null and user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
alter policy own_records on public.crm_records
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));
alter policy own_devices on public.sync_devices
  using ((select auth.uid()) is not null and user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
alter policy own_contacts on public.contacts
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

commit;
