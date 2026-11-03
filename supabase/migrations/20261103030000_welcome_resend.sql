-- F6.5: límite de «Reenviar» en /bienvenida (máx. 3 por hora y empresa).
-- Aditiva: dos columnas con default en workspace_billing y una función.
--
-- El contador va en la base porque el servidor corre en varias instancias, y
-- se reclama en una sola sentencia para que dos clics a la vez no se cuelen.
--
-- Reversión:
--   drop function if exists public.claim_welcome_resend(uuid, integer);
--   drop function if exists app_private.claim_welcome_resend(uuid, integer);
--   alter table public.workspace_billing
--     drop column if exists welcome_resend_count,
--     drop column if exists welcome_resend_window_start;
alter table public.workspace_billing
  add column if not exists welcome_resend_count integer not null default 0
    check (welcome_resend_count >= 0),
  add column if not exists welcome_resend_window_start timestamptz;

-- Devuelve true si se puede reenviar (y lo cuenta); false si ya se llegó al
-- límite en la última hora o la empresa no tiene fila de facturación.
create or replace function app_private.claim_welcome_resend(
  p_workspace_id uuid,
  p_max integer default 3
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.workspace_billing b
    set
      welcome_resend_count = case
        when b.welcome_resend_window_start is null
          or b.welcome_resend_window_start <= now() - interval '1 hour' then 1
        else b.welcome_resend_count + 1
      end,
      welcome_resend_window_start = case
        when b.welcome_resend_window_start is null
          or b.welcome_resend_window_start <= now() - interval '1 hour' then now()
        else b.welcome_resend_window_start
      end
    where b.workspace_id = p_workspace_id
      and (
        b.welcome_resend_window_start is null
        or b.welcome_resend_window_start <= now() - interval '1 hour'
        or b.welcome_resend_count < p_max
      )
    returning 1
  )
  select exists (select 1 from claimed);
$$;

create or replace function public.claim_welcome_resend(
  p_workspace_id uuid,
  p_max integer default 3
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select app_private.claim_welcome_resend(p_workspace_id, p_max);
$$;

revoke all on function app_private.claim_welcome_resend(uuid, integer) from public, anon, authenticated;
revoke all on function public.claim_welcome_resend(uuid, integer) from public, anon, authenticated;
grant execute on function app_private.claim_welcome_resend(uuid, integer) to service_role;
grant execute on function public.claim_welcome_resend(uuid, integer) to service_role;
