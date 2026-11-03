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
  provider text not null check (provider in ('ycloud', 'openai', 'gohighlevel', 'google_calendar')),
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
  provider text not null check (provider in ('ycloud', 'openai', 'gohighlevel', 'google_calendar')),
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

-- Agenda propia (migración 20261102210000_agenda_core).
create extension if not exists btree_gist with schema extensions;

-- Destino de la FK compuesta (workspace_id, conversation_id).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conversations_workspace_id_id_key') then
    alter table public.conversations
      add constraint conversations_workspace_id_id_key unique (workspace_id, id);
  end if;
end;
$$;

-- Agendas ---------------------------------------------------------------------
-- schedule: horario semanal por día ISO ("1" = lunes … "7" = domingo), cada día
-- una lista de tramos en hora local: {"1": [{"start": "09:00", "end": "14:00"},
-- {"start": "16:00", "end": "20:00"}], ...}. Un día ausente o vacío = cerrado.
-- services: [{"name": "Consulta", "duration_minutes": 30}, ...].
create table if not exists public.agendas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  is_default boolean not null default false,
  active boolean not null default true,
  timezone text not null check (char_length(timezone) between 1 and 64),
  schedule jsonb not null default '{
    "1": [{"start": "09:00", "end": "18:00"}],
    "2": [{"start": "09:00", "end": "18:00"}],
    "3": [{"start": "09:00", "end": "18:00"}],
    "4": [{"start": "09:00", "end": "18:00"}],
    "5": [{"start": "09:00", "end": "18:00"}]
  }'::jsonb check (jsonb_typeof(schedule) = 'object'),
  services jsonb not null default '[]'::jsonb check (jsonb_typeof(services) = 'array'),
  slot_step_minutes integer not null default 30 check (slot_step_minutes between 5 and 240),
  min_notice_minutes integer not null default 60 check (min_notice_minutes between 0 and 43200),
  max_days_ahead integer not null default 30 check (max_days_ahead between 1 and 365),
  closed_dates date[] not null default '{}'::date[],
  google_calendar_id text,
  google_sync_mode text not null default 'off'
    check (google_sync_mode in ('off', 'push', 'push_and_busy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create unique index if not exists idx_agendas_one_default_per_workspace
  on public.agendas (workspace_id) where is_default;
create unique index if not exists idx_agendas_workspace_name
  on public.agendas (workspace_id, lower(name));

-- Citas -----------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agenda_id uuid not null,
  contact_id uuid not null,
  conversation_id uuid,
  service text not null default '' check (char_length(service) <= 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  notes text check (char_length(notes) <= 5000),
  created_by text not null default 'operator'
    check (created_by in ('agent', 'operator', 'flow', 'import')),
  google_event_id text,
  google_sync_pending boolean not null default false,
  reminder_sent_at timestamptz,
  no_show_sent_at timestamptz,
  confirmed_at timestamptz,
  notices jsonb not null default '[]'::jsonb check (jsonb_typeof(notices) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_ends_after_starts check (ends_at > starts_at),
  -- Sin `on delete`: una agenda con citas no se borra (se desactiva). Al borrar
  -- la empresa entera, la cascada se lleva agendas y citas a la vez.
  foreign key (workspace_id, agenda_id)
    references public.agendas (workspace_id, id),
  foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id) on delete cascade,
  foreign key (workspace_id, conversation_id)
    references public.conversations (workspace_id, id) on delete set null (conversation_id),
  constraint appointments_no_overlap exclude using gist (
    agenda_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('scheduled', 'rescheduled'))
);

create index if not exists idx_appointments_workspace_starts
  on public.appointments (workspace_id, starts_at);
create index if not exists idx_appointments_workspace_agenda
  on public.appointments (workspace_id, agenda_id);
create index if not exists idx_appointments_workspace_contact
  on public.appointments (workspace_id, contact_id, starts_at desc);
create index if not exists idx_appointments_workspace_conversation
  on public.appointments (workspace_id, conversation_id);
create index if not exists idx_appointments_google_pending
  on public.appointments (workspace_id) where google_sync_pending;
create index if not exists idx_appointments_reminder_due
  on public.appointments (starts_at)
  where status in ('scheduled', 'rescheduled') and reminder_sent_at is null;

-- Bloqueos --------------------------------------------------------------------
create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agenda_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_blocks_ends_after_starts check (ends_at > starts_at),
  foreign key (workspace_id, agenda_id)
    references public.agendas (workspace_id, id) on delete cascade
);

create index if not exists idx_schedule_blocks_workspace_agenda_starts
  on public.schedule_blocks (workspace_id, agenda_id, starts_at);

-- Horarios ofrecidos ----------------------------------------------------------
create table if not exists public.offered_slots (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null,
  agenda_id uuid not null,
  starts_at timestamptz not null,
  offered_at timestamptz not null default now(),
  primary key (conversation_id, agenda_id, starts_at),
  foreign key (workspace_id, conversation_id)
    references public.conversations (workspace_id, id) on delete cascade,
  foreign key (workspace_id, agenda_id)
    references public.agendas (workspace_id, id) on delete cascade
);

create index if not exists idx_offered_slots_workspace_conversation
  on public.offered_slots (workspace_id, conversation_id);
create index if not exists idx_offered_slots_workspace_agenda
  on public.offered_slots (workspace_id, agenda_id);
create index if not exists idx_offered_slots_offered_at
  on public.offered_slots (offered_at);

-- Eventos de Google por borrar ------------------------------------------------
-- Tras borrar un contacto (RGPD) o una cita, su evento de Google ya no tiene
-- fila de la que colgar: se apunta aquí y crm-jobs lo borra con reintentos.
create table if not exists public.google_event_deletions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  calendar_id text not null,
  google_event_id text not null,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, calendar_id, google_event_id)
);

-- updated_at ------------------------------------------------------------------
create or replace trigger set_agendas_updated_at
before update on public.agendas
for each row execute function public.set_updated_at();

create or replace trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create or replace trigger set_schedule_blocks_updated_at
before update on public.schedule_blocks
for each row execute function public.set_updated_at();

create or replace trigger set_google_event_deletions_updated_at
before update on public.google_event_deletions
for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------
-- Agendas: las configuran owner/admin. Citas y bloqueos: también agent.
-- offered_slots y google_event_deletions los escribe solo el servidor
-- (service_role); en el panel solo se leen.
alter table public.agendas enable row level security;
alter table public.appointments enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.offered_slots enable row level security;
alter table public.google_event_deletions enable row level security;

drop policy if exists "Members can view agendas" on public.agendas;
create policy "Members can view agendas"
on public.agendas for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Admins can insert agendas" on public.agendas;
create policy "Admins can insert agendas"
on public.agendas for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Admins can update agendas" on public.agendas;
create policy "Admins can update agendas"
on public.agendas for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Admins can delete agendas" on public.agendas;
create policy "Admins can delete agendas"
on public.agendas for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Members can view appointments" on public.appointments;
create policy "Members can view appointments"
on public.appointments for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Agents and admins can insert appointments" on public.appointments;
create policy "Agents and admins can insert appointments"
on public.appointments for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Agents and admins can update appointments" on public.appointments;
create policy "Agents and admins can update appointments"
on public.appointments for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Admins can delete appointments" on public.appointments;
create policy "Admins can delete appointments"
on public.appointments for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "Members can view schedule blocks" on public.schedule_blocks;
create policy "Members can view schedule blocks"
on public.schedule_blocks for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Agents and admins can insert schedule blocks" on public.schedule_blocks;
create policy "Agents and admins can insert schedule blocks"
on public.schedule_blocks for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Agents and admins can update schedule blocks" on public.schedule_blocks;
create policy "Agents and admins can update schedule blocks"
on public.schedule_blocks for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Agents and admins can delete schedule blocks" on public.schedule_blocks;
create policy "Agents and admins can delete schedule blocks"
on public.schedule_blocks for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can view offered slots" on public.offered_slots;
create policy "Members can view offered slots"
on public.offered_slots for select to authenticated
using (app_private.is_workspace_member(workspace_id));

drop policy if exists "Admins can view pending google deletions" on public.google_event_deletions;
create policy "Admins can view pending google deletions"
on public.google_event_deletions for select to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Permisos del Data API (ver crm_core_grants).
grant select, insert, update, delete on
  public.agendas,
  public.appointments,
  public.schedule_blocks
to authenticated;
grant select on public.offered_slots, public.google_event_deletions to authenticated;
grant select, insert, update, delete on
  public.agendas,
  public.appointments,
  public.schedule_blocks,
  public.offered_slots,
  public.google_event_deletions
to service_role;

-- Agendar y reagendar (migración 20261102220000_agenda_booking_functions).
grant usage on schema app_private to service_role;

-- Validación común (el solape no: de eso se encarga la restricción).
create or replace function app_private.check_agenda_slot(
  p_agenda public.agendas,
  p_conversation_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_created_by text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_local_start timestamp;
  v_local_end timestamp;
  v_end_time time;
  v_dow text;
begin
  if not p_agenda.active then
    raise exception 'La agenda está desactivada.' using errcode = 'LVA01';
  end if;

  -- El operador y las importaciones deciden por su cuenta.
  if p_created_by not in ('agent', 'flow') then
    return;
  end if;

  if p_created_by = 'agent' and (
    p_conversation_id is null
    or not exists (
      select 1
      from public.offered_slots o
      where o.conversation_id = p_conversation_id
        and o.agenda_id = p_agenda.id
        and o.starts_at = p_starts_at
        and o.offered_at >= now() - interval '30 minutes'
    )
  ) then
    raise exception 'Ese horario no se le ofreció a esta persona en los últimos 30 minutos.'
      using errcode = 'LVN01';
  end if;

  if p_starts_at < now() + make_interval(mins => p_agenda.min_notice_minutes) then
    raise exception 'Esa hora ya pasó o no respeta la antelación mínima.' using errcode = 'LVH01';
  end if;

  if p_starts_at > now() + make_interval(days => p_agenda.max_days_ahead) then
    raise exception 'Esa fecha está demasiado lejos.' using errcode = 'LVH01';
  end if;

  v_local_start := p_starts_at at time zone p_agenda.timezone;
  v_local_end := p_ends_at at time zone p_agenda.timezone;

  if v_local_start::date <> (v_local_end - interval '1 microsecond')::date then
    raise exception 'La cita no puede pasar de un día a otro.' using errcode = 'LVH01';
  end if;

  if v_local_start::date = any (p_agenda.closed_dates) then
    raise exception 'Ese día el negocio está cerrado.' using errcode = 'LVH01';
  end if;

  v_dow := extract(isodow from v_local_start)::int::text;
  v_end_time := case
    when v_local_end::time = time '00:00' then time '24:00'
    else v_local_end::time
  end;

  if not exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_agenda.schedule -> v_dow) = 'array' then p_agenda.schedule -> v_dow
        else '[]'::jsonb
      end
    ) as seg
    where (seg ->> 'start')::time <= v_local_start::time
      and v_end_time <= (seg ->> 'end')::time
  ) then
    raise exception 'Esa hora está fuera del horario de atención.' using errcode = 'LVH01';
  end if;

  if exists (
    select 1
    from public.schedule_blocks b
    where b.agenda_id = p_agenda.id
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_starts_at, p_ends_at)
  ) then
    raise exception 'Ese horario está bloqueado.' using errcode = 'LVB01';
  end if;
end;
$$;

create or replace function app_private.book_appointment(
  p_workspace_id uuid,
  p_agenda_id uuid,
  p_contact_id uuid,
  p_conversation_id uuid,
  p_service text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_created_by text,
  p_notes text default null,
  p_actor_user_id uuid default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agenda public.agendas;
  v_row public.appointments;
begin
  select * into v_agenda
  from public.agendas a
  where a.id = p_agenda_id and a.workspace_id = p_workspace_id;

  if not found then
    raise exception 'La agenda no existe en esta empresa.' using errcode = 'LVW01';
  end if;

  if not exists (
    select 1 from public.contacts c
    where c.id = p_contact_id and c.workspace_id = p_workspace_id
  ) then
    raise exception 'El contacto no existe en esta empresa.' using errcode = 'LVW01';
  end if;

  if p_conversation_id is not null and not exists (
    select 1 from public.conversations cv
    where cv.id = p_conversation_id
      and cv.workspace_id = p_workspace_id
      and cv.contact_id = p_contact_id
  ) then
    raise exception 'La conversación no es de este contacto.' using errcode = 'LVW01';
  end if;

  perform app_private.check_agenda_slot(
    v_agenda, p_conversation_id, p_starts_at, p_ends_at, p_created_by
  );

  begin
    insert into public.appointments (
      workspace_id, agenda_id, contact_id, conversation_id, service,
      starts_at, ends_at, status, notes, created_by, google_sync_pending
    )
    values (
      p_workspace_id, p_agenda_id, p_contact_id, p_conversation_id,
      coalesce(btrim(p_service), ''), p_starts_at, p_ends_at, 'scheduled',
      nullif(btrim(coalesce(p_notes, '')), ''), p_created_by,
      v_agenda.google_sync_mode <> 'off'
    )
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'Ese horario ya está ocupado.' using errcode = 'LVS01';
  end;

  insert into public.crm_contact_activity (workspace_id, contact_id, kind, data, actor, actor_user_id)
  values (
    p_workspace_id, p_contact_id, 'appointment_booked',
    jsonb_build_object(
      'appointment_id', v_row.id,
      'agenda_id', v_row.agenda_id,
      'starts_at', v_row.starts_at,
      'service', v_row.service
    ),
    p_created_by, p_actor_user_id
  );

  return v_row;
end;
$$;

create or replace function app_private.reschedule_appointment(
  p_workspace_id uuid,
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_created_by text,
  p_conversation_id uuid default null,
  p_actor_user_id uuid default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.appointments;
  v_agenda public.agendas;
  v_conversation_id uuid;
  v_row public.appointments;
begin
  select * into v_old
  from public.appointments ap
  where ap.id = p_appointment_id and ap.workspace_id = p_workspace_id
  for update;

  if not found or v_old.status not in ('scheduled', 'rescheduled') then
    raise exception 'Esa cita no existe o ya no está activa.' using errcode = 'LVX01';
  end if;

  if p_created_by in ('agent', 'flow') and v_old.starts_at <= now() then
    raise exception 'Esa cita ya pasó.' using errcode = 'LVX01';
  end if;

  v_conversation_id := coalesce(p_conversation_id, v_old.conversation_id);

  if v_conversation_id is not null and not exists (
    select 1 from public.conversations cv
    where cv.id = v_conversation_id
      and cv.workspace_id = p_workspace_id
      and cv.contact_id = v_old.contact_id
  ) then
    raise exception 'La conversación no es de este contacto.' using errcode = 'LVW01';
  end if;

  select * into v_agenda from public.agendas a where a.id = v_old.agenda_id;

  perform app_private.check_agenda_slot(
    v_agenda, v_conversation_id, p_starts_at, p_ends_at, p_created_by
  );

  -- La vieja suelta el hueco antes de insertar la nueva.
  update public.appointments
  set status = 'cancelled',
      google_sync_pending = google_event_id is not null,
      notices = notices || jsonb_build_array(
        jsonb_build_object('kind', 'rescheduled', 'at', now())
      )
  where id = v_old.id;

  begin
    insert into public.appointments (
      workspace_id, agenda_id, contact_id, conversation_id, service,
      starts_at, ends_at, status, notes, created_by, google_sync_pending, notices
    )
    values (
      p_workspace_id, v_old.agenda_id, v_old.contact_id, v_conversation_id,
      v_old.service, p_starts_at, p_ends_at, 'rescheduled', v_old.notes,
      p_created_by, v_agenda.google_sync_mode <> 'off',
      jsonb_build_array(jsonb_build_object('kind', 'rescheduled_from', 'appointment_id', v_old.id))
    )
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'Ese horario ya está ocupado.' using errcode = 'LVS01';
  end;

  insert into public.crm_contact_activity (workspace_id, contact_id, kind, data, actor, actor_user_id)
  values (
    p_workspace_id, v_old.contact_id, 'appointment_rescheduled',
    jsonb_build_object(
      'appointment_id', v_row.id,
      'previous_appointment_id', v_old.id,
      'previous_starts_at', v_old.starts_at,
      'starts_at', v_row.starts_at
    ),
    p_created_by, p_actor_user_id
  );

  return v_row;
end;
$$;

-- Envoltorios para RPC ---------------------------------------------------------
create or replace function public.book_appointment(
  p_workspace_id uuid,
  p_agenda_id uuid,
  p_contact_id uuid,
  p_conversation_id uuid,
  p_service text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_created_by text,
  p_notes text default null,
  p_actor_user_id uuid default null
)
returns public.appointments
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.book_appointment(
    p_workspace_id, p_agenda_id, p_contact_id, p_conversation_id, p_service,
    p_starts_at, p_ends_at, p_created_by, p_notes, p_actor_user_id
  );
$$;

create or replace function public.reschedule_appointment(
  p_workspace_id uuid,
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_created_by text,
  p_conversation_id uuid default null,
  p_actor_user_id uuid default null
)
returns public.appointments
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.reschedule_appointment(
    p_workspace_id, p_appointment_id, p_starts_at, p_ends_at, p_created_by,
    p_conversation_id, p_actor_user_id
  );
$$;

revoke all on function app_private.check_agenda_slot(public.agendas, uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function app_private.book_appointment(uuid, uuid, uuid, uuid, text, timestamptz, timestamptz, text, text, uuid) from public, anon, authenticated;
revoke all on function app_private.reschedule_appointment(uuid, uuid, timestamptz, timestamptz, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.book_appointment(uuid, uuid, uuid, uuid, text, timestamptz, timestamptz, text, text, uuid) from public, anon, authenticated;
revoke all on function public.reschedule_appointment(uuid, uuid, timestamptz, timestamptz, text, uuid, uuid) from public, anon, authenticated;

grant execute on function app_private.check_agenda_slot(public.agendas, uuid, timestamptz, timestamptz, text) to service_role;
grant execute on function app_private.book_appointment(uuid, uuid, uuid, uuid, text, timestamptz, timestamptz, text, text, uuid) to service_role;
grant execute on function app_private.reschedule_appointment(uuid, uuid, timestamptz, timestamptz, text, uuid, uuid) to service_role;
grant execute on function public.book_appointment(uuid, uuid, uuid, uuid, text, timestamptz, timestamptz, text, text, uuid) to service_role;
grant execute on function public.reschedule_appointment(uuid, uuid, timestamptz, timestamptz, text, uuid, uuid) to service_role;

-- google_calendar como proveedor en tablas ya creadas (migración 20261102230000).
alter table public.integrations drop constraint integrations_provider_check,
--     add constraint integrations_provider_check check (provider in ('ycloud', 'openai', 'gohighlevel'));
--   alter table public.integration_secrets drop constraint integration_secrets_provider_check,
--     add constraint integration_secrets_provider_check check (provider in ('openai', 'ycloud', 'gohighlevel'));
alter table public.integrations
  drop constraint if exists integrations_provider_check,
  add constraint integrations_provider_check
    check (provider in ('ycloud', 'openai', 'gohighlevel', 'google_calendar'));

alter table public.integration_secrets
  drop constraint if exists integration_secrets_provider_check,
  add constraint integration_secrets_provider_check
    check (provider in ('openai', 'ycloud', 'gohighlevel', 'google_calendar'));
