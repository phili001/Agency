-- Comprobaciones de 20261102200000_crm_core.sql: siembra, aislamiento entre
-- empresas (FK compuestas), nombres reservados, unicidad, set null y cascada.
-- Uso: ejecuta cada bloque `do` por separado con execute_sql. Cada uno termina
-- SIEMPRE con un error
-- (DRYRUN_OK ... si todo va bien, FAIL ... si no), así la transacción se
-- deshace y no deja datos.
do $$
declare
  wa uuid; wb uuid; ca uuid; cb uuid; ta uuid; sa uuid; sb uuid; wn uuid;
  nws int; nstages int; ok text := '';
begin
  select count(*) into nws from public.workspaces;
  select count(*) into nstages from public.crm_pipeline_stages;
  if nstages <> nws * 6 then raise exception 'FAIL seed: % stages for % ws', nstages, nws; end if;
  ok := ok || 'seed ';

  select id into wa from public.workspaces order by company_code limit 1;
  select id into wb from public.workspaces order by company_code offset 1 limit 1;
  select id into ca from public.contacts where workspace_id = wa limit 1;
  insert into public.contacts (workspace_id, phone_e164) values (wb, '+10000000000') returning id into cb;
  insert into public.crm_tags (workspace_id, name) values (wa, 'VIP') returning id into ta;

  begin
    insert into public.crm_contact_tags (workspace_id, contact_id, tag_id) values (wb, ca, ta);
    raise exception 'FAIL cross tag wb/ca';
  exception when foreign_key_violation then ok := ok || 'xtag1 '; end;
  begin
    insert into public.crm_contact_tags (workspace_id, contact_id, tag_id) values (wb, cb, ta);
    raise exception 'FAIL cross tag cb/ta';
  exception when foreign_key_violation then ok := ok || 'xtag2 '; end;
  insert into public.crm_contact_tags (workspace_id, contact_id, tag_id) values (wa, ca, ta);
  ok := ok || 'tag ';

  begin
    insert into public.crm_tags (workspace_id, name) values (wa, 'Flow_Opt_Out');
    raise exception 'FAIL reserved';
  exception when check_violation then ok := ok || 'reserved '; end;
  begin
    insert into public.crm_tags (workspace_id, name) values (wa, 'vip');
    raise exception 'FAIL dup name';
  exception when unique_violation then ok := ok || 'dupname '; end;

  select id into sb from public.crm_pipeline_stages where workspace_id = wb limit 1;
  begin
    update public.contacts set stage_id = sb where id = ca;
    raise exception 'FAIL cross stage';
  exception when foreign_key_violation then ok := ok || 'xstage '; end;

  select id into sa from public.crm_pipeline_stages where workspace_id = wa order by position limit 1;
  update public.contacts set stage_id = sa where id = ca;
  delete from public.crm_pipeline_stages where id = sa;
  if (select stage_id from public.contacts where id = ca) is not null
     or (select workspace_id from public.contacts where id = ca) <> wa then
    raise exception 'FAIL set null';
  end if;
  ok := ok || 'setnull ';

  begin
    insert into public.crm_contact_notes (workspace_id, contact_id, body) values (wb, ca, 'x');
    raise exception 'FAIL cross note';
  exception when foreign_key_violation then ok := ok || 'xnote '; end;

  insert into public.workspaces (company_code, name, slug, owner_id)
  select 'ZZZ999', 'Prueba F1.2', 'prueba-f12-' || gen_random_uuid(), owner_id from public.workspaces where id = wa
  returning id into wn;
  if (select count(*) from public.crm_pipeline_stages where workspace_id = wn) <> 6 then
    raise exception 'FAIL trigger seed';
  end if;
  ok := ok || 'trigger ';

  delete from public.contacts where id = ca;
  if exists (select 1 from public.crm_contact_tags where contact_id = ca) then raise exception 'FAIL cascade'; end if;
  ok := ok || 'cascade ';

  raise exception 'DRYRUN_OK %', ok;
end $$;

-- RLS como usuario autenticado de una sola empresa: ve solo sus 6 etapas, nada
-- de otra empresa, y no puede crear etiquetas fuera de la suya.
do $$
declare u uuid; mine int; visible int; foreign_visible int; denied boolean := false; other uuid;
begin
  select wm.user_id into u from public.workspace_members wm
  group by wm.user_id having count(*) = 1 limit 1;
  select count(*) into mine from public.workspace_members where user_id = u;
  select w.id into other from public.workspaces w
   where not exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = u) limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into visible from public.crm_pipeline_stages;
  select count(*) into foreign_visible from public.crm_pipeline_stages where workspace_id = other;
  begin
    insert into public.crm_tags (workspace_id, name) values (other, 'intruso');
  exception when insufficient_privilege then denied := true; end;
  execute 'reset role';
  if visible <> mine * 6 or foreign_visible <> 0 or not denied then
    raise exception 'FAIL rls visible=% mine=% foreign=% denied=%', visible, mine, foreign_visible, denied;
  end if;
  raise exception 'DRYRUN_OK rls visible=% foreign=% denied=%', visible, foreign_visible, denied;
end $$;
