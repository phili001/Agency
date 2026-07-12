-- WhatsApp SaaS initial schema
-- Paste this in the Supabase SQL Editor for the correct project.
-- It creates the multi-tenant data model with RLS enabled from day one.

create extension if not exists pgcrypto;

create schema if not exists app_private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  company_code text not null unique check (company_code ~ '^[A-Z]{3}[0-9]{3}$'),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'agent' check (role in ('owner', 'admin', 'agent', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text,
  phone_e164 text not null,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, phone_e164)
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  type text not null default 'setter' check (type in ('setter', 'booking', 'support')),
  system_prompt text not null default '',
  model text not null default 'gpt-5.4-mini',
  temperature numeric(3,2) not null default 0.40 check (temperature >= 0 and temperature <= 2),
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  external_conversation_id text,
  status text not null default 'pending_handoff' check (status in ('open', 'pending_handoff', 'closed')),
  ai_enabled boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  role text not null check (role in ('user', 'assistant', 'human', 'system', 'tool')),
  message_type text not null default 'text' check (message_type in ('text', 'audio', 'image', 'file', 'event')),
  body text,
  media_url text,
  provider_message_id text,
  status text not null default 'stored' check (status in ('stored', 'queued', 'sent', 'delivered', 'read', 'failed')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(12,6) not null default 0 check (cost_usd >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('ycloud', 'openai', 'gohighlevel')),
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'disabled')),
  config jsonb not null default '{}'::jsonb,
  secret_ref text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('ycloud', 'openai', 'gohighlevel')),
  kind text not null,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, kind)
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  provider text not null,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer generated always as (input_tokens + output_tokens) stored,
  cost_usd numeric(12,6) not null default 0 check (cost_usd >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);
create index if not exists idx_contacts_workspace_id on public.contacts(workspace_id);
create index if not exists idx_agents_workspace_id on public.agents(workspace_id);
create index if not exists idx_conversations_workspace_id on public.conversations(workspace_id);
create index if not exists idx_conversations_contact_id on public.conversations(contact_id);
create index if not exists idx_messages_conversation_id_created_at on public.messages(conversation_id, created_at);
create index if not exists idx_messages_workspace_id_created_at on public.messages(workspace_id, created_at);
create index if not exists idx_integrations_workspace_id on public.integrations(workspace_id);
create index if not exists idx_integration_secrets_workspace_provider on public.integration_secrets(workspace_id, provider);
create index if not exists idx_usage_events_workspace_id_created_at on public.usage_events(workspace_id, created_at);
create index if not exists idx_workspace_assets_workspace_id_kind on public.workspace_assets(workspace_id, kind);
create index if not exists idx_webhook_events_workspace_id_created_at on public.webhook_events(workspace_id, created_at);
create index if not exists idx_webhook_events_external_id on public.webhook_events(provider, external_id);

create or replace trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create or replace trigger set_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create or replace trigger set_agents_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

create or replace trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create or replace trigger set_integrations_updated_at
before update on public.integrations
for each row execute function public.set_updated_at();

create or replace trigger set_integration_secrets_updated_at
before update on public.integration_secrets
for each row execute function public.set_updated_at();

create or replace trigger set_workspace_assets_updated_at
before update on public.workspace_assets
for each row execute function public.set_updated_at();

create or replace function app_private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
    );
$$;

create or replace function app_private.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = any(allowed_roles)
    );
$$;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
revoke all on function app_private.is_workspace_member(uuid) from public;
revoke all on function app_private.has_workspace_role(uuid, text[]) from public;
grant execute on function app_private.is_workspace_member(uuid) to authenticated;
grant execute on function app_private.has_workspace_role(uuid, text[]) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.contacts enable row level security;
alter table public.agents enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.usage_events enable row level security;
alter table public.workspace_assets enable row level security;
alter table public.webhook_events enable row level security;

revoke all on public.integration_secrets from anon;
revoke all on public.integration_secrets from authenticated;

drop policy if exists "Members can view workspaces" on public.workspaces;
drop policy if exists "Users can create owned workspaces" on public.workspaces;
drop policy if exists "Owners and admins can update workspaces" on public.workspaces;
drop policy if exists "Owners can delete workspaces" on public.workspaces;

drop policy if exists "Members can view workspace members" on public.workspace_members;
drop policy if exists "Owners and admins can add members" on public.workspace_members;
drop policy if exists "Owners and admins can update members" on public.workspace_members;
drop policy if exists "Owners and admins can delete members" on public.workspace_members;

drop policy if exists "Members can view contacts" on public.contacts;
drop policy if exists "Agents and admins can write contacts" on public.contacts;
drop policy if exists "Agents and admins can update contacts" on public.contacts;
drop policy if exists "Admins can delete contacts" on public.contacts;

drop policy if exists "Members can view agents" on public.agents;
drop policy if exists "Admins can create agents" on public.agents;
drop policy if exists "Admins can update agents" on public.agents;
drop policy if exists "Admins can delete agents" on public.agents;

drop policy if exists "Members can view conversations" on public.conversations;
drop policy if exists "Agents and admins can create conversations" on public.conversations;
drop policy if exists "Agents and admins can update conversations" on public.conversations;
drop policy if exists "Admins can delete conversations" on public.conversations;

drop policy if exists "Members can view messages" on public.messages;
drop policy if exists "Agents and admins can create messages" on public.messages;
drop policy if exists "Agents and admins can update messages" on public.messages;
drop policy if exists "Admins can delete messages" on public.messages;

drop policy if exists "Admins can view integrations" on public.integrations;
drop policy if exists "Admins can create integrations" on public.integrations;
drop policy if exists "Admins can update integrations" on public.integrations;
drop policy if exists "Admins can delete integrations" on public.integrations;

drop policy if exists "Members can view usage events" on public.usage_events;
drop policy if exists "Agents and admins can create usage events" on public.usage_events;

drop policy if exists "Members can view workspace assets" on public.workspace_assets;
drop policy if exists "Admins can create workspace assets" on public.workspace_assets;
drop policy if exists "Admins can update workspace assets" on public.workspace_assets;
drop policy if exists "Admins can delete workspace assets" on public.workspace_assets;

drop policy if exists "Admins can view webhook events" on public.webhook_events;

create policy "Members can view workspaces"
on public.workspaces for select
to authenticated
using (app_private.is_workspace_member(id));

create policy "Users can create owned workspaces"
on public.workspaces for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "Owners and admins can update workspaces"
on public.workspaces for update
to authenticated
using (app_private.has_workspace_role(id, array['owner', 'admin']))
with check (app_private.has_workspace_role(id, array['owner', 'admin']));

create policy "Owners can delete workspaces"
on public.workspaces for delete
to authenticated
using (app_private.has_workspace_role(id, array['owner']));

create policy "Members can view workspace members"
on public.workspace_members for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Owners and admins can add members"
on public.workspace_members for insert
to authenticated
with check (
  app_private.has_workspace_role(workspace_id, array['owner', 'admin'])
  or (user_id = (select auth.uid()) and role = 'owner')
);

create policy "Owners and admins can update members"
on public.workspace_members for update
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Owners and admins can delete members"
on public.workspace_members for delete
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view contacts"
on public.contacts for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Agents and admins can write contacts"
on public.contacts for insert
to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can update contacts"
on public.contacts for update
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Admins can delete contacts"
on public.contacts for delete
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view agents"
on public.agents for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins can create agents"
on public.agents for insert
to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can update agents"
on public.agents for update
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can delete agents"
on public.agents for delete
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view conversations"
on public.conversations for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Agents and admins can create conversations"
on public.conversations for insert
to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can update conversations"
on public.conversations for update
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Admins can delete conversations"
on public.conversations for delete
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view messages"
on public.messages for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Agents and admins can create messages"
on public.messages for insert
to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can update messages"
on public.messages for update
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Admins can delete messages"
on public.messages for delete
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can view integrations"
on public.integrations for select
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can create integrations"
on public.integrations for insert
to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can update integrations"
on public.integrations for update
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can delete integrations"
on public.integrations for delete
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view usage events"
on public.usage_events for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Agents and admins can create usage events"
on public.usage_events for insert
to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

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

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.workspaces,
  public.workspace_members,
  public.contacts,
  public.agents,
  public.conversations,
  public.messages,
  public.integrations,
  public.usage_events,
  public.workspace_assets,
  public.webhook_events
to authenticated;
