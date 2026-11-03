-- Facturación con Stripe (F6.1). Aditivo: dos tablas nuevas y una fila por
-- empresa existente con `billing_exempt = true` (las que ya usan Levy no se
-- bloquean por no tener suscripción).
--
-- - workspace_billing: estado de la suscripción de cada empresa. La escribe
--   solo el servidor (webhook de Stripe y consola de empresas); en el panel el
--   owner/admin la lee.
-- - billing_events: eventos de Stripe ya procesados, para no repetirlos
--   (dedupe por `stripe_event_id`). Solo servidor.
--
-- status: el de la suscripción en Stripe; null = sin suscripción todavía.
--
-- Reversión (solo si no hay datos que conservar):
--   drop table if exists public.billing_events;
--   drop table if exists public.workspace_billing;
create table if not exists public.workspace_billing (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  stripe_customer_id text unique check (stripe_customer_id is null or char_length(stripe_customer_id) <= 255),
  stripe_subscription_id text unique check (stripe_subscription_id is null or char_length(stripe_subscription_id) <= 255),
  price_id text check (price_id is null or char_length(price_id) <= 255),
  status text check (
    status is null or status in (
      'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )
  ),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  billing_exempt boolean not null default false,
  -- Primer impago sin resolver: desde aquí cuentan los días de gracia.
  past_due_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_billing_status
  on public.workspace_billing (status) where status is not null;

create table if not exists public.billing_events (
  stripe_event_id text primary key check (char_length(stripe_event_id) between 1 and 255),
  type text not null check (char_length(type) between 1 and 120),
  -- Empresa a la que acabó aplicándose (null si el evento se ignoró).
  workspace_id uuid references public.workspaces(id) on delete cascade,
  result text not null default 'processed'
    check (result in ('processed', 'ignored', 'failed')),
  error text check (error is null or char_length(error) <= 2000),
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_events_workspace
  on public.billing_events (workspace_id, processed_at desc) where workspace_id is not null;

create or replace trigger set_workspace_billing_updated_at
before update on public.workspace_billing
for each row execute function public.set_updated_at();

create or replace trigger set_billing_events_updated_at
before update on public.billing_events
for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------
alter table public.workspace_billing enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists "Admins can view workspace billing" on public.workspace_billing;
create policy "Admins can view workspace billing"
on public.workspace_billing for select to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Admins can view billing events" on public.billing_events;
create policy "Admins can view billing events"
on public.billing_events for select to authenticated
using (workspace_id is not null and app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

grant select on public.workspace_billing, public.billing_events to authenticated;
grant select, insert, update, delete on public.workspace_billing, public.billing_events to service_role;

-- Empresas que ya existen: exentas (D2: el cobro empieza con las altas nuevas).
insert into public.workspace_billing (workspace_id, billing_exempt)
select id, true from public.workspaces
on conflict (workspace_id) do nothing;
