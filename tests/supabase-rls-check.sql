-- EVIE · Prueba reproducible de permisos (RLS + GRANT + reglas) en Supabase.
-- Pégala en Supabase → SQL Editor → Run. NO deja nada guardado: crea dos usuarios falsos (A y B)
-- dentro de un bloque que termina con un error a propósito, y Postgres deshace todo.
-- El "error" que ves al final ES el resultado: un JSON con cada prueba.
-- Esperado (2026-11-21, proyecto evie-crm): todo lo de anon y de B contra A = "bloqueado" o 0;
-- 05 = ok revision 1, 06 = 2, 14 = 1, 19 = revision 1, 21 = {revision 1, amount 15000}, 22 = 1.
do $t$
declare
  a uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  b uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  res jsonb := '{}'::jsonb; n int; rev bigint;
begin
  insert into auth.users(id,instance_id,aud,role,email,raw_user_meta_data,created_at,updated_at)
  values (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-a@accounts.evie.local','{"username":"qa-usuario-a"}',now(),now()),
         (b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-b@accounts.evie.local','{"username":"qa-usuario-b"}',now(),now());
  select count(*) into n from public.profiles where id in (a,b);
  res := res || jsonb_build_object('01_trigger_crea_perfiles', n);

  -- Visitante sin sesión (anon)
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  perform set_config('role','anon',true);
  begin select count(*) into n from public.crm_records; res:=res||jsonb_build_object('02_anon_lee_registros','PERMITIDO('||n||')');
  exception when others then res:=res||jsonb_build_object('02_anon_lee_registros','bloqueado: '||sqlerrm); end;
  begin perform public.evie_apply('[]'); res:=res||jsonb_build_object('03_anon_llama_evie_apply','PERMITIDO');
  exception when others then res:=res||jsonb_build_object('03_anon_llama_evie_apply','bloqueado: '||sqlerrm); end;
  begin select count(*) into n from public.profiles; res:=res||jsonb_build_object('04_anon_lee_perfiles','PERMITIDO('||n||')');
  exception when others then res:=res||jsonb_build_object('04_anon_lee_perfiles','bloqueado: '||sqlerrm); end;
  reset role;

  -- Usuario A
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  select max(x.revision) into rev from public.evie_apply(jsonb_build_array(
    jsonb_build_object('collection','transactions','record_id','tx-1','expected_revision',0,'payload',jsonb_build_object('id','tx-1','amount',15000,'type','income')),
    jsonb_build_object('collection','$state','record_id','root','expected_revision',0,'payload','{"version":4,"profile":{"name":"QA A","preferred":"A"},"preferences":{}}'::jsonb))) x;
  res:=res||jsonb_build_object('05_A_guarda_por_evie_apply','ok revision '||rev);
  select count(*) into n from public.evie_pull('');
  res:=res||jsonb_build_object('06_A_evie_pull_ve_sus_filas', n);
  begin insert into public.crm_records(owner_id,collection,record_id,payload) values(a,'goals','g-1','{"id":"g-1"}'); res:=res||jsonb_build_object('07_A_insert_directo_sin_rpc','PERMITIDO');
  exception when others then res:=res||jsonb_build_object('07_A_insert_directo_sin_rpc','bloqueado: '||sqlerrm); end;
  begin perform * from public.evie_apply('[{"collection":"transactions","record_id":"tx-1","expected_revision":0,"payload":{"id":"tx-1","amount":1}}]'); res:=res||jsonb_build_object('08_A_revision_vieja','PERMITIDO');
  exception when others then res:=res||jsonb_build_object('08_A_revision_vieja','bloqueado: '||sqlerrm); end;
  begin perform * from public.evie_apply('[{"collection":"transactions","record_id":"tx-2","expected_revision":0,"payload":{"id":"tx-2","amount":10.5}}]'); res:=res||jsonb_build_object('09_A_importe_con_decimales','PERMITIDO');
  exception when others then res:=res||jsonb_build_object('09_A_importe_con_decimales','bloqueado: '||sqlerrm); end;
  begin perform * from public.evie_apply('[{"collection":"hackeo","record_id":"x-1","expected_revision":0,"payload":{"id":"x-1"}}]'); res:=res||jsonb_build_object('10_A_coleccion_no_permitida','PERMITIDO');
  exception when others then res:=res||jsonb_build_object('10_A_coleccion_no_permitida','bloqueado: '||sqlerrm); end;
  begin perform * from public.evie_apply('[{"collection":"automations","record_id":"au-1","expected_revision":0,"payload":{"id":"au-1","name":"x","url":"javascript:alert(1)"}}]'); res:=res||jsonb_build_object('11_A_atajo_javascript','PERMITIDO');
  exception when others then res:=res||jsonb_build_object('11_A_atajo_javascript','bloqueado: '||sqlerrm); end;
  insert into public.contacts(owner_id,display_name) values(a,'Contacto de A');
  reset role;

  -- Usuario B intentando ver o alterar lo de A
  perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  select count(*) into n from public.crm_records; res:=res||jsonb_build_object('12_B_ve_registros_de_A', n);
  select count(*) into n from public.evie_pull(''); res:=res||jsonb_build_object('13_B_evie_pull', n);
  select count(*) into n from public.profiles; res:=res||jsonb_build_object('14_B_ve_perfiles(solo el suyo=1)', n);
  select count(*) into n from public.contacts; res:=res||jsonb_build_object('15_B_ve_contactos_de_A', n);
  begin update public.crm_records set payload='{"id":"tx-1","amount":0}' where owner_id=a; res:=res||jsonb_build_object('16_B_update_directo_a_A','PERMITIDO');
  exception when others then res:=res||jsonb_build_object('16_B_update_directo_a_A','bloqueado: '||sqlerrm); end;
  begin insert into public.contacts(owner_id,display_name) values(a,'Contacto falso para A'); res:=res||jsonb_build_object('17_B_crea_contacto_como_A','PERMITIDO');
  exception when others then res:=res||jsonb_build_object('17_B_crea_contacto_como_A','bloqueado: '||sqlerrm); end;
  update public.contacts set owner_id=b where owner_id=a; get diagnostics n = row_count;
  res:=res||jsonb_build_object('18_B_roba_contacto_de_A(filas)', n);
  select max(x.revision) into rev from public.evie_apply('[{"collection":"transactions","record_id":"tx-1","expected_revision":0,"payload":{"id":"tx-1","amount":1}}]') x;
  res:=res||jsonb_build_object('19_B_mismo_id_crea_fila_propia', 'revision '||rev);
  begin insert into storage.objects(bucket_id,name) values('user-media', a::text||'/foto-1.png'); res:=res||jsonb_build_object('20_B_sube_archivo_a_carpeta_de_A','PERMITIDO');
  exception when others then res:=res||jsonb_build_object('20_B_sube_archivo_a_carpeta_de_A','bloqueado: '||sqlerrm); end;
  reset role;

  -- Estado final visto como administrador
  select r.revision into rev from public.crm_records r where r.owner_id=a and r.record_id='tx-1';
  res:=res||jsonb_build_object('21_fila_de_A_intacta', jsonb_build_object('revision',rev,'amount',(select payload->'amount' from public.crm_records where owner_id=a and record_id='tx-1')));
  select count(*) into n from public.contacts where owner_id=a; res:=res||jsonb_build_object('22_contactos_de_A_siguen', n);

  raise exception 'RESULTADOS(rollback) %', res::text;
end $t$;
