-- Flow builder for per-workspace WhatsApp automations.
-- Run after schema.sql and self_service_onboarding.sql.

alter table public.contacts
add column if not exists automation_labels text[] not null default '{}'::text[],
add column if not exists messaging_status text not null default 'active';

alter table public.contacts
drop constraint if exists contacts_messaging_status_check;

alter table public.contacts
add constraint contacts_messaging_status_check
check (messaging_status in ('active', 'blocked'));

create index if not exists idx_contacts_automation_labels
on public.contacts using gin (automation_labels);

create table if not exists public.flows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  trigger_type text not null default 'first_inbound' check (trigger_type in ('first_inbound', 'keyword', 'tag', 'webhook', 'manual')),
  trigger_config jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flow_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  flow_id uuid not null references public.flows(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  current_step_id text,
  status text not null default 'active' check (status in ('active', 'waiting', 'completed', 'paused', 'transferred', 'failed', 'review_pending', 'blocked')),
  answers jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  last_error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.flow_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  flow_id uuid references public.flows(id) on delete set null,
  flow_run_id uuid references public.flow_runs(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'stored' check (status in ('stored', 'error')),
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.flow_answer_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  flow_id uuid not null references public.flows(id) on delete cascade,
  flow_run_id uuid not null references public.flow_runs(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  step_id text not null,
  field_key text,
  question text not null,
  original_answer text not null,
  normalized_answer text,
  validation_reason text not null,
  confidence numeric(5,4),
  attempt_count integer not null default 1 check (attempt_count > 0),
  post_review_attempts integer not null default 0 check (post_review_attempts >= 0),
  model text,
  status text not null default 'rejected_by_ai'
    check (status in ('rejected_by_ai', 'pending_human', 'approved_by_human', 'rejected_by_human', 'accepted', 'blocked')),
  human_decision_reason text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_flows_workspace_status
on public.flows(workspace_id, status);

create index if not exists idx_flow_runs_workspace_contact_status
on public.flow_runs(workspace_id, contact_id, status);

create index if not exists idx_flow_runs_conversation_status
on public.flow_runs(conversation_id, status);

create index if not exists idx_flow_events_workspace_created
on public.flow_events(workspace_id, created_at);

create index if not exists idx_flow_answer_reviews_workspace_status
on public.flow_answer_reviews(workspace_id, status, created_at desc);

create or replace trigger set_flows_updated_at
before update on public.flows
for each row execute function public.set_updated_at();

create or replace trigger set_flow_runs_updated_at
before update on public.flow_runs
for each row execute function public.set_updated_at();

create or replace trigger set_flow_answer_reviews_updated_at
before update on public.flow_answer_reviews
for each row execute function public.set_updated_at();

alter table public.flows enable row level security;
alter table public.flow_runs enable row level security;
alter table public.flow_events enable row level security;
alter table public.flow_answer_reviews enable row level security;

drop policy if exists "Members can view flows" on public.flows;
drop policy if exists "Admins can write flows" on public.flows;
drop policy if exists "Members can view flow runs" on public.flow_runs;
drop policy if exists "Admins and agents can write flow runs" on public.flow_runs;
drop policy if exists "Members can view flow events" on public.flow_events;
drop policy if exists "Admins and agents can write flow events" on public.flow_events;
drop policy if exists "Members can view flow answer reviews" on public.flow_answer_reviews;
drop policy if exists "Admins and agents can update flow answer reviews" on public.flow_answer_reviews;

create policy "Members can view flows"
on public.flows for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins can write flows"
on public.flows for all
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view flow runs"
on public.flow_runs for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins and agents can write flow runs"
on public.flow_runs for all
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Members can view flow events"
on public.flow_events for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins and agents can write flow events"
on public.flow_events for all
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Members can view flow answer reviews"
on public.flow_answer_reviews for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins and agents can update flow answer reviews"
on public.flow_answer_reviews for update
to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

grant select, update on table public.flow_answer_reviews to authenticated;
