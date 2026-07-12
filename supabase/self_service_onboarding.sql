-- Self-service onboarding and per-workspace integration secrets.
-- Run this after schema.sql and next_workspace_assets_and_webhooks.sql.

create extension if not exists pgcrypto;

alter table public.workspaces
add column if not exists onboarding_completed_at timestamptz;

alter table public.workspaces
add column if not exists onboarding_state jsonb not null default '{}'::jsonb;

alter table public.workspaces
add column if not exists company_code text;

with ordered_workspaces as (
  select
    id,
    row_number() over (order by created_at, id) as row_number
  from public.workspaces
  where company_code is null
),
generated_codes as (
  select
    id,
    concat(
      chr(65 + (((row_number - 1) / 999 / 26 / 26)::int % 26)),
      chr(65 + (((row_number - 1) / 999 / 26)::int % 26)),
      chr(65 + (((row_number - 1) / 999)::int % 26)),
      lpad((((row_number - 1) % 999) + 1)::text, 3, '0')
    ) as company_code
  from ordered_workspaces
)
update public.workspaces as workspace
set company_code = generated_codes.company_code
from generated_codes
where workspace.id = generated_codes.id;

alter table public.workspaces
alter column company_code set not null;

alter table public.workspaces
drop constraint if exists workspaces_company_code_format;

alter table public.workspaces
add constraint workspaces_company_code_format
check (company_code ~ '^[A-Z]{3}[0-9]{3}$');

create unique index if not exists workspaces_company_code_key
on public.workspaces(company_code);

alter table public.integrations
add column if not exists connected_at timestamptz;

create table if not exists public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('openai', 'ycloud', 'gohighlevel')),
  kind text not null,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, kind)
);

create or replace trigger set_integration_secrets_updated_at
before update on public.integration_secrets
for each row execute function public.set_updated_at();

alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from anon;
revoke all on public.integration_secrets from authenticated;

create index if not exists idx_integration_secrets_workspace_provider
on public.integration_secrets(workspace_id, provider);

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon;
revoke all on public.platform_admins from authenticated;

create index if not exists idx_workspaces_owner_id
on public.workspaces(owner_id);

create index if not exists idx_workspace_members_workspace_user
on public.workspace_members(workspace_id, user_id);

create index if not exists idx_integrations_ycloud_workspace
on public.integrations(workspace_id)
where provider = 'ycloud';
