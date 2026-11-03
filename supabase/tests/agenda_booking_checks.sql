-- Comprobaciones de 20261102220000_agenda_booking_functions.sql.
-- Uso: ejecuta el bloque `do` con execute_sql. Termina SIEMPRE con un error
-- (DRYRUN_OK ... si todo va bien, FAIL ... si no), así la transacción se
-- deshace y no deja datos.
do $$
declare
  wa uuid; wb uuid; ca uuid; ca2 uuid; cb uuid; conv uuid; conv2 uuid; ag uuid; agb uuid;
  a1 public.appointments; a2 public.appointments; r public.appointments;
  d date := (now() at time zone 'UTC')::date + 2;
  t0 timestamptz;
  got text;
  ok text := '';
begin
  t0 := (d + time '10:00') at time zone 'UTC';
  select id into wa from public.workspaces order by company_code limit 1;
  select id into wb from public.workspaces order by company_code offset 1 limit 1;
  insert into public.contacts (workspace_id, phone_e164) values (wa, '+10000000011') returning id into ca;
  insert into public.contacts (workspace_id, phone_e164) values (wa, '+10000000012') returning id into ca2;
  insert into public.contacts (workspace_id, phone_e164) values (wb, '+10000000013') returning id into cb;
  insert into public.conversations (workspace_id, contact_id) values (wa, ca) returning id into conv;
  insert into public.conversations (workspace_id, contact_id) values (wa, ca2) returning id into conv2;
  insert into public.agendas (workspace_id, name, timezone, min_notice_minutes, closed_dates, schedule, google_sync_mode)
  values (wa, 'Prueba F1.4', 'UTC', 0, array[d + 1],
    '{"1":[{"start":"09:00","end":"18:00"}],"2":[{"start":"09:00","end":"18:00"}],"3":[{"start":"09:00","end":"18:00"}],"4":[{"start":"09:00","end":"18:00"}],"5":[{"start":"09:00","end":"18:00"}],"6":[{"start":"09:00","end":"18:00"}],"7":[{"start":"09:00","end":"18:00"}]}',
    'push')
  returning id into ag;
  insert into public.agendas (workspace_id, name, timezone) values (wb, 'Prueba F1.4 B', 'UTC') returning id into agb;

  -- Operador agenda sin oferta.
  a1 := public.book_appointment(wa, ag, ca, conv, 'Consulta', t0, t0 + interval '30 minutes', 'operator');
  if a1.status <> 'scheduled' or not a1.google_sync_pending then raise exception 'FAIL book operator'; end if;
  if not exists (select 1 from public.crm_contact_activity where contact_id = ca and kind = 'appointment_booked') then
    raise exception 'FAIL activity';
  end if;
  ok := ok || 'book ';

  begin
    perform public.book_appointment(wa, ag, ca2, conv2, '', t0 + interval '15 minutes', t0 + interval '45 minutes', 'operator');
    raise exception 'FAIL overlap';
  exception when others then got := sqlstate; if got <> 'LVS01' then raise exception 'FAIL overlap got %: %', got, sqlerrm; end if; ok := ok || 'slot_taken '; end;

  begin
    perform public.book_appointment(wa, ag, ca, conv, '', t0 + interval '1 hour', t0 + interval '90 minutes', 'agent');
    raise exception 'FAIL not offered';
  exception when others then got := sqlstate; if got <> 'LVN01' then raise exception 'FAIL not offered got %: %', got, sqlerrm; end if; ok := ok || 'not_offered '; end;

  insert into public.offered_slots (workspace_id, conversation_id, agenda_id, starts_at, offered_at)
  values (wa, conv, ag, t0 + interval '2 hours', now() - interval '31 minutes');
  begin
    perform public.book_appointment(wa, ag, ca, conv, '', t0 + interval '2 hours', t0 + interval '150 minutes', 'agent');
    raise exception 'FAIL stale offer';
  exception when others then got := sqlstate; if got <> 'LVN01' then raise exception 'FAIL stale got %: %', got, sqlerrm; end if; ok := ok || 'stale_offer '; end;

  insert into public.offered_slots (workspace_id, conversation_id, agenda_id, starts_at)
  values (wa, conv, ag, t0 + interval '1 hour'),
         (wa, conv, ag, t0 + interval '10 hours'),
         (wa, conv, ag, t0 + interval '1 day'),
         (wa, conv, ag, t0 + interval '3 hours');
  a2 := public.book_appointment(wa, ag, ca, conv, '', t0 + interval '1 hour', t0 + interval '90 minutes', 'agent');
  ok := ok || 'agent_offered ';

  begin
    perform public.book_appointment(wa, ag, ca, conv, '', t0 + interval '10 hours', t0 + interval '630 minutes', 'agent');
    raise exception 'FAIL outside hours';
  exception when others then got := sqlstate; if got <> 'LVH01' then raise exception 'FAIL hours got %: %', got, sqlerrm; end if; ok := ok || 'outside_hours '; end;

  begin
    perform public.book_appointment(wa, ag, ca, conv, '', t0 + interval '1 day', t0 + interval '1 day 30 minutes', 'agent');
    raise exception 'FAIL closed date';
  exception when others then got := sqlstate; if got <> 'LVH01' then raise exception 'FAIL closed got %: %', got, sqlerrm; end if; ok := ok || 'closed_date '; end;

  insert into public.schedule_blocks (workspace_id, agenda_id, starts_at, ends_at)
  values (wa, ag, t0 + interval '3 hours', t0 + interval '4 hours');
  begin
    perform public.book_appointment(wa, ag, ca, conv, '', t0 + interval '3 hours', t0 + interval '210 minutes', 'agent');
    raise exception 'FAIL blocked';
  exception when others then got := sqlstate; if got <> 'LVB01' then raise exception 'FAIL blocked got %: %', got, sqlerrm; end if; ok := ok || 'blocked '; end;

  begin
    perform public.book_appointment(wa, agb, ca, null, '', t0, t0 + interval '30 minutes', 'operator');
    raise exception 'FAIL foreign agenda';
  exception when others then got := sqlstate; if got <> 'LVW01' then raise exception 'FAIL xagenda got %: %', got, sqlerrm; end if; ok := ok || 'xagenda '; end;

  begin
    perform public.book_appointment(wb, agb, ca, null, '', t0, t0 + interval '30 minutes', 'operator');
    raise exception 'FAIL foreign contact';
  exception when others then got := sqlstate; if got <> 'LVW01' then raise exception 'FAIL xcontact got %: %', got, sqlerrm; end if; ok := ok || 'xcontact '; end;

  begin
    perform public.book_appointment(wa, ag, ca, conv2, '', t0 + interval '5 hours', t0 + interval '330 minutes', 'operator');
    raise exception 'FAIL other conversation';
  exception when others then got := sqlstate; if got <> 'LVW01' then raise exception 'FAIL xconv got %: %', got, sqlerrm; end if; ok := ok || 'xconversation '; end;

  -- Reagendar a un hueco ocupado: no cambia nada.
  begin
    perform public.reschedule_appointment(wa, a2.id, t0, t0 + interval '30 minutes', 'operator');
    raise exception 'FAIL reschedule taken';
  exception when others then got := sqlstate; if got <> 'LVS01' then raise exception 'FAIL resched taken got %: %', got, sqlerrm; end if; end;
  if (select status from public.appointments where id = a2.id) <> 'scheduled' then
    raise exception 'FAIL reschedule not atomic';
  end if;
  ok := ok || 'resched_atomic ';

  -- Reagendar solapando su propio hueco viejo (30 min más tarde).
  r := public.reschedule_appointment(wa, a2.id, t0 + interval '90 minutes', t0 + interval '120 minutes', 'operator');
  if r.status <> 'rescheduled'
     or (select status from public.appointments where id = a2.id) <> 'cancelled'
     or r.contact_id <> ca or r.conversation_id <> conv then
    raise exception 'FAIL reschedule';
  end if;
  ok := ok || 'resched ';

  begin
    perform public.reschedule_appointment(wa, a2.id, t0 + interval '5 hours', t0 + interval '330 minutes', 'operator');
    raise exception 'FAIL reschedule cancelled';
  exception when others then got := sqlstate; if got <> 'LVX01' then raise exception 'FAIL resched cancelled got %: %', got, sqlerrm; end if; ok := ok || 'not_active '; end;

  begin
    perform public.reschedule_appointment(wb, r.id, t0 + interval '5 hours', t0 + interval '330 minutes', 'operator');
    raise exception 'FAIL reschedule foreign';
  exception when others then got := sqlstate; if got <> 'LVX01' then raise exception 'FAIL resched foreign got %: %', got, sqlerrm; end if; ok := ok || 'resched_xworkspace '; end;

  -- Solo service_role puede ejecutar.
  execute 'set local role authenticated';
  begin
    perform public.book_appointment(wa, ag, ca, conv, '', t0 + interval '6 hours', t0 + interval '390 minutes', 'operator');
    raise exception 'FAIL authenticated can book';
  exception when insufficient_privilege then ok := ok || 'grants '; end;
  execute 'reset role';

  raise exception 'DRYRUN_OK %', ok;
end $$;
