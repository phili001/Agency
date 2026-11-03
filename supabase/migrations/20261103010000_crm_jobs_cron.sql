-- Llamada a /api/cron/crm-jobs cada 5 minutos desde la base (F4.3): pg_cron
-- programa, pg_net hace el POST. La URL y el CRON_SECRET viven en Supabase
-- Vault, nunca en este SQL. El job se crea DESACTIVADO: se activa en la salida
-- a producción (F7.5), cuando la app con la ruta ya esté desplegada.
--
-- Secretos (los mete una persona, una vez, en el SQL Editor):
--   select vault.create_secret('https://<dominio-de-la-app>/api/cron/crm-jobs', 'crm_jobs_url');
--   select vault.create_secret('<CRON_SECRET>', 'crm_jobs_cron_secret');
-- Activar / pausar / ver ejecuciones: ver DEPLOY_RUNBOOK.md («Trabajos del CRM»).
--
-- Reversión:
--   select cron.unschedule('levy-crm-jobs');
--   drop function if exists app_private.invoke_crm_jobs();
--   (pg_cron y pg_net se pueden dejar instalados; quitarlos: drop extension pg_net; drop extension pg_cron;)

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Sin los dos secretos no llama a nada (y lo deja en el log de Postgres): así un
-- job activado por error antes de configurar Vault no falla cada 5 minutos.
create or replace function app_private.invoke_crm_jobs()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'crm_jobs_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'crm_jobs_cron_secret';

  if v_url is null or v_secret is null then
    raise log 'crm-jobs: faltan crm_jobs_url o crm_jobs_cron_secret en Vault; no se llama a la app';
    return null;
  end if;

  return net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function app_private.invoke_crm_jobs() from public, anon, authenticated;

-- cron.schedule con el mismo nombre actualiza el job si ya existía.
select cron.schedule('levy-crm-jobs', '*/5 * * * *', $$ select app_private.invoke_crm_jobs(); $$);
select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'levy-crm-jobs'), active := false);
