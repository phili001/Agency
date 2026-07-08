-- Incremental SQL for the current app step.
-- Paste in Supabase SQL Editor after the initial schema.
-- It adds workspace assets, webhook audit events, OpenAI provider defaults,
-- and keeps RLS aligned with the existing workspace membership model.

alter table public.agents
alter column model set default 'gpt-5.4-mini';

update public.agents
set model = case
  when model = 'openai/gpt-4o-mini' then 'gpt-4o-mini'
  when model = 'openai/gpt-4o' then 'gpt-4o'
  when model like 'anthropic/%' then 'gpt-5.4-mini'
  when model like 'google/%' then 'gpt-5.4-mini'
  else model
end;

update public.integrations
set provider = 'openai'
where provider = 'openrouter';

alter table public.integrations
drop constraint if exists integrations_provider_check;

alter table public.integrations
add constraint integrations_provider_check
check (provider in ('ycloud', 'openai', 'gohighlevel'));

create table if not exists public.workspace_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('business_profile', 'tool', 'template', 'knowledge')),
  title text not null,
  content text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  provider text not null check (provider in ('ycloud')),
  event_type text not null,
  external_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'ignored' check (status in ('stored', 'ignored', 'error')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_assets_workspace_id_kind
on public.workspace_assets(workspace_id, kind);

create index if not exists idx_webhook_events_workspace_id_created_at
on public.webhook_events(workspace_id, created_at);

create index if not exists idx_webhook_events_external_id
on public.webhook_events(provider, external_id);

create or replace trigger set_workspace_assets_updated_at
before update on public.workspace_assets
for each row execute function public.set_updated_at();

alter table public.workspace_assets enable row level security;
alter table public.webhook_events enable row level security;

drop policy if exists "Members can view workspace assets" on public.workspace_assets;
drop policy if exists "Admins can create workspace assets" on public.workspace_assets;
drop policy if exists "Admins can update workspace assets" on public.workspace_assets;
drop policy if exists "Admins can delete workspace assets" on public.workspace_assets;
drop policy if exists "Admins can view webhook events" on public.webhook_events;

create policy "Members can view workspace assets"
on public.workspace_assets for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins can create workspace assets"
on public.workspace_assets for insert
to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can update workspace assets"
on public.workspace_assets for update
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can delete workspace assets"
on public.workspace_assets for delete
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can view webhook events"
on public.webhook_events for select
to authenticated
using (
  workspace_id is not null
  and app_private.has_workspace_role(workspace_id, array['owner', 'admin'])
);

grant select, insert, update, delete on
  public.workspace_assets,
  public.webhook_events
to authenticated;
