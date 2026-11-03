-- Comprobaciones de 20261103020000_billing.sql: todas las empresas exentas,
-- estado de Stripe válido, cliente de Stripe único y aislamiento por RLS (un
-- owner solo ve la facturación de su empresa; un agent no ve ninguna).
-- Uso: ejecuta el bloque `do` con execute_sql. Termina SIEMPRE con un error
-- (DRYRUN_OK ... si todo va bien, FAIL ... si no), así la transacción se
-- deshace y no deja datos.
do $$
declare
  wa uuid; wb uuid; owner_a uuid; agent_a uuid; seen int; other int;
  ok text := '';
begin
  if exists (select 1 from public.workspaces w where not exists (
    select 1 from public.workspace_billing b where b.workspace_id = w.id and b.billing_exempt)) then
    raise exception 'FAIL workspace without exempt billing row';
  end if;
  ok := ok || 'exempt ';

  select id into wa from public.workspaces order by company_code limit 1;
  select id into wb from public.workspaces order by company_code offset 1 limit 1;
  update public.workspace_billing set stripe_customer_id = 'cus_test_a' where workspace_id = wa;

  begin
    update public.workspace_billing set stripe_customer_id = 'cus_test_a' where workspace_id = wb;
    raise exception 'FAIL duplicate customer';
  exception when unique_violation then ok := ok || 'uniquecustomer '; end;

  begin
    update public.workspace_billing set status = 'gratis' where workspace_id = wa;
    raise exception 'FAIL bad status';
  exception when check_violation then ok := ok || 'status '; end;

  insert into public.billing_events (stripe_event_id, type, workspace_id) values ('evt_test_a', 'invoice.paid', wa);
  begin
    insert into public.billing_events (stripe_event_id, type) values ('evt_test_a', 'invoice.paid');
    raise exception 'FAIL duplicate event';
  exception when unique_violation then ok := ok || 'dedupe '; end;

  select user_id into owner_a from public.workspace_members where workspace_id = wa and role = 'owner' limit 1;
  if owner_a is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into seen from public.workspace_billing where workspace_id = wa;
    select count(*) into other from public.workspace_billing
      where workspace_id not in (select workspace_id from public.workspace_members where user_id = owner_a and role in ('owner', 'admin'));
    reset role;
    if seen <> 1 or other <> 0 then
      raise exception 'FAIL owner rls seen=% other=%', seen, other;
    end if;
    ok := ok || 'rls_owner ';
  end if;

  select user_id into agent_a from public.workspace_members m where role in ('agent', 'viewer')
    and not exists (select 1 from public.workspace_members o where o.user_id = m.user_id and o.role in ('owner', 'admin')) limit 1;
  if agent_a is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', agent_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into seen from public.workspace_billing;
    reset role;
    if seen <> 0 then
      raise exception 'FAIL agent sees billing %', seen;
    end if;
    ok := ok || 'rls_agent ';
  end if;

  raise exception 'DRYRUN_OK %', ok;
end $$;
