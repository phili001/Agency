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
  automation_labels text[] not null default '{}'::text[],
  messaging_status text not null default 'active' check (messaging_status in ('active', 'blocked')),
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
create index if not exists idx_contacts_automation_labels on public.contacts using gin (automation_labels);
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

-- Supabase stopped auto-granting Data API access on new public tables (2026-10-30).
grant usage on schema public to service_role;
grant select, insert, update, delete on
  public.workspaces,
  public.workspace_members,
  public.contacts,
  public.agents,
  public.conversations,
  public.messages,
  public.integrations,
  public.integration_secrets,
  public.usage_events,
  public.workspace_assets,
  public.webhook_events
to service_role;

-- CRM propio (migraciones 20261102200000_crm_core y 20261102200100_crm_core_grants).
-- Destino de las FK compuestas (workspace_id, contact_id).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_workspace_id_id_key') then
    alter table public.contacts
      add constraint contacts_workspace_id_id_key unique (workspace_id, id);
  end if;
end;
$$;

-- Etapas del embudo -----------------------------------------------------------
create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position integer not null default 0,
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  kind text not null default 'open' check (kind in ('open', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create unique index if not exists idx_crm_pipeline_stages_workspace_name
  on public.crm_pipeline_stages (workspace_id, lower(name));
create index if not exists idx_crm_pipeline_stages_workspace_position
  on public.crm_pipeline_stages (workspace_id, position);

-- Columnas nuevas de contactos ------------------------------------------------
-- stage_id null = primera etapa abierta (no se reescriben los contactos que ya
-- existen). source/last_message_at se rellenan desde el código en adelante.
alter table public.contacts
  add column if not exists stage_id uuid,
  add column if not exists custom_fields jsonb not null default '{}'::jsonb,
  add column if not exists company text,
  add column if not exists source text,
  add column if not exists last_message_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_source_check') then
    alter table public.contacts
      add constraint contacts_source_check
        check (source is null or source in ('whatsapp', 'manual', 'import', 'stripe'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contacts_custom_fields_object_check') then
    alter table public.contacts
      add constraint contacts_custom_fields_object_check
        check (jsonb_typeof(custom_fields) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contacts_stage_fkey') then
    alter table public.contacts
      add constraint contacts_stage_fkey
        foreign key (workspace_id, stage_id)
        references public.crm_pipeline_stages (workspace_id, id)
        on delete set null (stage_id);
  end if;
end;
$$;

create index if not exists idx_contacts_workspace_stage
  on public.contacts (workspace_id, stage_id);
create index if not exists idx_contacts_workspace_last_message
  on public.contacts (workspace_id, last_message_at desc nulls last);

-- Etiquetas -------------------------------------------------------------------
create table if not exists public.crm_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (
    char_length(btrim(name)) between 1 and 50
    and lower(btrim(name)) not in (
      'flow_opt_out',
      'onboarding_eligible',
      'onboarding_completed',
      'onboarding_excluded_existing'
    )
  ),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create unique index if not exists idx_crm_tags_workspace_name
  on public.crm_tags (workspace_id, lower(name));

create table if not exists public.crm_contact_tags (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id),
  foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id) on delete cascade,
  foreign key (workspace_id, tag_id)
    references public.crm_tags (workspace_id, id) on delete cascade
);

create index if not exists idx_crm_contact_tags_workspace_tag
  on public.crm_contact_tags (workspace_id, tag_id);
create index if not exists idx_crm_contact_tags_workspace_contact
  on public.crm_contact_tags (workspace_id, contact_id);

-- Campos personalizados -------------------------------------------------------
create table if not exists public.crm_custom_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,49}$'),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  type text not null check (type in (
    'text', 'long_text', 'number', 'money', 'date', 'boolean',
    'select', 'multi', 'phone', 'email', 'url'
  )),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  ai_readable boolean not null default false,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

-- Notas, tareas y actividad ---------------------------------------------------
create table if not exists public.crm_contact_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id) on delete cascade
);

create index if not exists idx_crm_contact_notes_workspace_contact
  on public.crm_contact_notes (workspace_id, contact_id, created_at desc);
create index if not exists idx_crm_contact_notes_author
  on public.crm_contact_notes (author_id);

create table if not exists public.crm_contact_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  detail text,
  due_at timestamptz,
  completed_at timestamptz,
  created_by text not null default 'operator'
    check (created_by in ('agent', 'operator', 'flow')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id) on delete cascade
);

create index if not exists idx_crm_contact_tasks_workspace_contact
  on public.crm_contact_tasks (workspace_id, contact_id);
create index if not exists idx_crm_contact_tasks_workspace_open_due
  on public.crm_contact_tasks (workspace_id, due_at)
  where completed_at is null;
create index if not exists idx_crm_contact_tasks_assigned_to
  on public.crm_contact_tasks (assigned_to);

create table if not exists public.crm_contact_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null,
  kind text not null check (char_length(kind) between 1 and 60),
  data jsonb not null default '{}'::jsonb,
  actor text not null default 'system'
    check (actor in ('agent', 'operator', 'flow', 'system', 'import', 'stripe')),
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id) on delete cascade
);

create index if not exists idx_crm_contact_activity_workspace_contact
  on public.crm_contact_activity (workspace_id, contact_id, created_at desc);
create index if not exists idx_crm_contact_activity_actor_user
  on public.crm_contact_activity (actor_user_id);

-- updated_at ------------------------------------------------------------------
create or replace trigger set_crm_pipeline_stages_updated_at
before update on public.crm_pipeline_stages
for each row execute function public.set_updated_at();

create or replace trigger set_crm_tags_updated_at
before update on public.crm_tags
for each row execute function public.set_updated_at();

create or replace trigger set_crm_custom_fields_updated_at
before update on public.crm_custom_fields
for each row execute function public.set_updated_at();

create or replace trigger set_crm_contact_notes_updated_at
before update on public.crm_contact_notes
for each row execute function public.set_updated_at();

create or replace trigger set_crm_contact_tasks_updated_at
before update on public.crm_contact_tasks
for each row execute function public.set_updated_at();

-- Siembra de etapas -----------------------------------------------------------
-- Idempotente: solo siembra si la empresa no tiene ninguna etapa.
create or replace function app_private.seed_crm_pipeline_stages(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.crm_pipeline_stages s
    where s.workspace_id = target_workspace_id
  ) then
    return;
  end if;

  insert into public.crm_pipeline_stages (workspace_id, name, position, color, kind)
  values
    (target_workspace_id, 'Nuevo contacto', 0, '#3b82f6', 'open'),
    (target_workspace_id, 'Solicitud de presupuesto', 1, '#8b5cf6', 'open'),
    (target_workspace_id, 'Seguimiento', 2, '#f59e0b', 'open'),
    (target_workspace_id, 'Cliente', 3, '#10b981', 'won'),
    (target_workspace_id, 'Perdido', 4, '#ef4444', 'lost'),
    (target_workspace_id, 'No cualifica', 5, '#64748b', 'lost');
end;
$$;

create or replace function app_private.seed_crm_pipeline_stages_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.seed_crm_pipeline_stages(new.id);
  return new;
end;
$$;

revoke all on function app_private.seed_crm_pipeline_stages(uuid) from public;
revoke all on function app_private.seed_crm_pipeline_stages_trigger() from public;

create or replace trigger seed_crm_pipeline_stages_on_workspace
after insert on public.workspaces
for each row execute function app_private.seed_crm_pipeline_stages_trigger();

select app_private.seed_crm_pipeline_stages(w.id) from public.workspaces w;

-- RLS -------------------------------------------------------------------------
-- Configuración del CRM (etapas, etiquetas, campos): la ven todos los miembros
-- y la cambian owner/admin. Datos de contacto (etiquetas puestas, notas,
-- tareas): también agent. La actividad es un registro: no se edita.
alter table public.crm_pipeline_stages enable row level security;
alter table public.crm_tags enable row level security;
alter table public.crm_contact_tags enable row level security;
alter table public.crm_custom_fields enable row level security;
alter table public.crm_contact_notes enable row level security;
alter table public.crm_contact_tasks enable row level security;
alter table public.crm_contact_activity enable row level security;

drop policy if exists "Members can view pipeline stages" on public.crm_pipeline_stages;
create policy "Members can view pipeline stages"
on public.crm_pipeline_stages for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Admins can insert pipeline stages" on public.crm_pipeline_stages;
create policy "Admins can insert pipeline stages"
on public.crm_pipeline_stages for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Admins can update pipeline stages" on public.crm_pipeline_stages;
create policy "Admins can update pipeline stages"
on public.crm_pipeline_stages for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Admins can delete pipeline stages" on public.crm_pipeline_stages;
create policy "Admins can delete pipeline stages"
on public.crm_pipeline_stages for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Members can view tags" on public.crm_tags;
create policy "Members can view tags"
on public.crm_tags for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Admins can insert tags" on public.crm_tags;
create policy "Admins can insert tags"
on public.crm_tags for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Admins can update tags" on public.crm_tags;
create policy "Admins can update tags"
on public.crm_tags for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Admins can delete tags" on public.crm_tags;
create policy "Admins can delete tags"
on public.crm_tags for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Members can view custom fields" on public.crm_custom_fields;
create policy "Members can view custom fields"
on public.crm_custom_fields for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Admins can insert custom fields" on public.crm_custom_fields;
create policy "Admins can insert custom fields"
on public.crm_custom_fields for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Admins can update custom fields" on public.crm_custom_fields;
create policy "Admins can update custom fields"
on public.crm_custom_fields for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Admins can delete custom fields" on public.crm_custom_fields;
create policy "Admins can delete custom fields"
on public.crm_custom_fields for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Members can view contact tags" on public.crm_contact_tags;
create policy "Members can view contact tags"
on public.crm_contact_tags for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Agents and admins can insert contact tags" on public.crm_contact_tags;
create policy "Agents and admins can insert contact tags"
on public.crm_contact_tags for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Agents and admins can delete contact tags" on public.crm_contact_tags;
create policy "Agents and admins can delete contact tags"
on public.crm_contact_tags for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can view contact notes" on public.crm_contact_notes;
create policy "Members can view contact notes"
on public.crm_contact_notes for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Agents and admins can insert contact notes" on public.crm_contact_notes;
create policy "Agents and admins can insert contact notes"
on public.crm_contact_notes for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Agents and admins can update contact notes" on public.crm_contact_notes;
create policy "Agents and admins can update contact notes"
on public.crm_contact_notes for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Agents and admins can delete contact notes" on public.crm_contact_notes;
create policy "Agents and admins can delete contact notes"
on public.crm_contact_notes for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can view contact tasks" on public.crm_contact_tasks;
create policy "Members can view contact tasks"
on public.crm_contact_tasks for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Agents and admins can insert contact tasks" on public.crm_contact_tasks;
create policy "Agents and admins can insert contact tasks"
on public.crm_contact_tasks for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Agents and admins can update contact tasks" on public.crm_contact_tasks;
create policy "Agents and admins can update contact tasks"
on public.crm_contact_tasks for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Agents and admins can delete contact tasks" on public.crm_contact_tasks;
create policy "Agents and admins can delete contact tasks"
on public.crm_contact_tasks for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can view contact activity" on public.crm_contact_activity;
create policy "Members can view contact activity"
on public.crm_contact_activity for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Agents and admins can insert contact activity" on public.crm_contact_activity;
create policy "Agents and admins can insert contact activity"
on public.crm_contact_activity for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

grant select, insert, update, delete on
  public.crm_pipeline_stages,
  public.crm_tags,
  public.crm_contact_tags,
  public.crm_custom_fields,
  public.crm_contact_notes,
  public.crm_contact_tasks,
  public.crm_contact_activity
to authenticated, service_role;
