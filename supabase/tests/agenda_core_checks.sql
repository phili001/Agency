-- Comprobaciones de 20261102210000_agenda_core.sql: anti-solape, aislamiento
-- entre empresas (FK compuestas), una agenda por defecto, set null de la
-- conversación y agendas con citas que no se borran.
-- Uso: ejecuta el bloque `do` con execute_sql. Termina SIEMPRE con un error
-- (DRYRUN_OK ... si todo va bien, FAIL ... si no), así la transacción se
-- deshace y no deja datos.
do $$
declare
  wa uuid; wb uuid; ca uuid; cb uuid; conv uuid; ag uuid; ag2 uuid; agb uuid; ap uuid;
  t0 timestamptz := date_trunc('hour', now()) + interval '2 days';
  ok text := '';
begin
  select id into wa from public.workspaces order by company_code limit 1;
  select id into wb from public.workspaces order by company_code offset 1 limit 1;
  insert into public.contacts (workspace_id, phone_e164) values (wa, '+10000000001') returning id into ca;
  insert into public.contacts (workspace_id, phone_e164) values (wb, '+10000000002') returning id into cb;
  insert into public.conversations (workspace_id, contact_id) values (wa, ca) returning id into conv;
  insert into public.agendas (workspace_id, name, timezone, is_default) values (wa, 'Prueba A', 'Europe/Madrid', true) returning id into ag;
  insert into public.agendas (workspace_id, name, timezone) values (wa, 'Prueba A2', 'Europe/Madrid') returning id into ag2;
  insert into public.agendas (workspace_id, name, timezone) values (wb, 'Prueba B', 'Europe/Madrid') returning id into agb;

  begin
    insert into public.agendas (workspace_id, name, timezone, is_default) values (wa, 'Otra default', 'Europe/Madrid', true);
    raise exception 'FAIL two defaults';
  exception when unique_violation then ok := ok || 'onedefault '; end;

  insert into public.appointments (workspace_id, agenda_id, contact_id, conversation_id, starts_at, ends_at)
  values (wa, ag, ca, conv, t0, t0 + interval '30 minutes') returning id into ap;

  begin
    insert into public.appointments (workspace_id, agenda_id, contact_id, starts_at, ends_at)
    values (wa, ag, ca, t0 + interval '15 minutes', t0 + interval '45 minutes');
    raise exception 'FAIL overlap';
  exception when exclusion_violation then ok := ok || 'overlap '; end;

  insert into public.appointments (workspace_id, agenda_id, contact_id, starts_at, ends_at)
  values (wa, ag, ca, t0 + interval '30 minutes', t0 + interval '60 minutes');
  ok := ok || 'touching ';

  insert into public.appointments (workspace_id, agenda_id, contact_id, starts_at, ends_at)
  values (wa, ag2, ca, t0, t0 + interval '30 minutes');
  ok := ok || 'otheragenda ';

  insert into public.appointments (workspace_id, agenda_id, contact_id, starts_at, ends_at, status)
  values (wa, ag, ca, t0, t0 + interval '30 minutes', 'cancelled');
  ok := ok || 'cancelledfree ';

  begin
    insert into public.appointments (workspace_id, agenda_id, contact_id, starts_at, ends_at)
    values (wa, ag, ca, t0 + interval '2 hours', t0 + interval '2 hours');
    raise exception 'FAIL zero length';
  exception when check_violation then ok := ok || 'zerolen '; end;

  begin
    insert into public.appointments (workspace_id, agenda_id, contact_id, starts_at, ends_at)
    values (wa, agb, ca, t0 + interval '3 hours', t0 + interval '4 hours');
    raise exception 'FAIL cross agenda';
  exception when foreign_key_violation then ok := ok || 'xagenda '; end;

  begin
    insert into public.appointments (workspace_id, agenda_id, contact_id, starts_at, ends_at)
    values (wa, ag, cb, t0 + interval '3 hours', t0 + interval '4 hours');
    raise exception 'FAIL cross contact';
  exception when foreign_key_violation then ok := ok || 'xcontact '; end;

  begin
    insert into public.offered_slots (workspace_id, conversation_id, agenda_id, starts_at)
    values (wb, conv, agb, t0);
    raise exception 'FAIL cross offered';
  exception when foreign_key_violation then ok := ok || 'xoffered '; end;
  insert into public.offered_slots (workspace_id, conversation_id, agenda_id, starts_at) values (wa, conv, ag, t0);

  begin
    insert into public.schedule_blocks (workspace_id, agenda_id, starts_at, ends_at)
    values (wb, ag, t0, t0 + interval '1 hour');
    raise exception 'FAIL cross block';
  exception when foreign_key_violation then ok := ok || 'xblock '; end;

  begin
    delete from public.agendas where id = ag;
    raise exception 'FAIL agenda delete with appointments';
  exception when foreign_key_violation then ok := ok || 'agendakeep '; end;

  delete from public.conversations where id = conv;
  if (select conversation_id from public.appointments where id = ap) is not null
     or (select workspace_id from public.appointments where id = ap) <> wa
     or exists (select 1 from public.offered_slots where conversation_id = conv) then
    raise exception 'FAIL conversation set null';
  end if;
  ok := ok || 'convsetnull ';

  delete from public.contacts where id = ca;
  if exists (select 1 from public.appointments where contact_id = ca) then raise exception 'FAIL cascade'; end if;
  ok := ok || 'cascade ';

  raise exception 'DRYRUN_OK %', ok;
end $$;
