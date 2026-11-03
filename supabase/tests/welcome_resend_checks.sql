-- Comprobaciones de 20261103030000_welcome_resend.sql: tres reenvíos por hora,
-- la cuarta vez no, la hora siguiente vuelve a contar, cada empresa lleva su
-- cuenta y solo service_role puede llamar a la función.
-- Uso: ejecuta el bloque `do` con execute_sql. Termina SIEMPRE con un error
-- (DRYRUN_OK ... si todo va bien, FAIL ... si no), así la transacción se
-- deshace y no deja datos.
do $$
declare
  wa uuid; wb uuid; n int;
  ok text := '';
begin
  select workspace_id into wa from public.workspace_billing order by workspace_id limit 1;
  select workspace_id into wb from public.workspace_billing order by workspace_id offset 1 limit 1;

  for n in 1..3 loop
    if not app_private.claim_welcome_resend(wa) then raise exception 'FAIL claim % denied', n; end if;
  end loop;
  ok := ok || 'three ';

  if app_private.claim_welcome_resend(wa) then raise exception 'FAIL fourth claim allowed'; end if;
  ok := ok || 'fourth ';

  if not app_private.claim_welcome_resend(wb) then raise exception 'FAIL other workspace affected'; end if;
  ok := ok || 'isolated ';

  update public.workspace_billing
  set welcome_resend_window_start = now() - interval '61 minutes'
  where workspace_id = wa;
  if not app_private.claim_welcome_resend(wa) then raise exception 'FAIL window did not reset'; end if;
  select welcome_resend_count into n from public.workspace_billing where workspace_id = wa;
  if n <> 1 then raise exception 'FAIL count after reset %', n; end if;
  ok := ok || 'reset ';

  if app_private.claim_welcome_resend(gen_random_uuid()) then raise exception 'FAIL unknown workspace allowed'; end if;
  ok := ok || 'unknown ';

  if has_function_privilege('anon', 'public.claim_welcome_resend(uuid, integer)', 'execute')
    or has_function_privilege('authenticated', 'public.claim_welcome_resend(uuid, integer)', 'execute')
    or has_function_privilege('anon', 'app_private.claim_welcome_resend(uuid, integer)', 'execute')
    or has_function_privilege('authenticated', 'app_private.claim_welcome_resend(uuid, integer)', 'execute') then
    raise exception 'FAIL function exposed to clients';
  end if;
  if not has_function_privilege('service_role', 'public.claim_welcome_resend(uuid, integer)', 'execute') then
    raise exception 'FAIL service_role cannot execute';
  end if;
  ok := ok || 'grants ';

  raise exception 'DRYRUN_OK %', ok;
end $$;
