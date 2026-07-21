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

alter table public.flow_runs
drop constraint if exists flow_runs_status_check;

alter table public.flow_runs
add constraint flow_runs_status_check
check (
  status in (
    'active',
    'waiting',
    'completed',
    'paused',
    'transferred',
    'failed',
    'review_pending',
    'blocked'
  )
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
    check (
      status in (
        'rejected_by_ai',
        'pending_human',
        'approved_by_human',
        'rejected_by_human',
        'accepted',
        'blocked'
      )
    ),
  human_decision_reason text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_flow_answer_reviews_workspace_status
on public.flow_answer_reviews(workspace_id, status, created_at desc);

create index if not exists idx_flow_answer_reviews_run_step
on public.flow_answer_reviews(flow_run_id, step_id, created_at desc);

create or replace trigger set_flow_answer_reviews_updated_at
before update on public.flow_answer_reviews
for each row execute function public.set_updated_at();

alter table public.flow_answer_reviews enable row level security;

drop policy if exists "Members can view flow answer reviews"
on public.flow_answer_reviews;
drop policy if exists "Admins and agents can update flow answer reviews"
on public.flow_answer_reviews;

create policy "Members can view flow answer reviews"
on public.flow_answer_reviews for select
to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins and agents can update flow answer reviews"
on public.flow_answer_reviews for update
to authenticated
using (
  app_private.has_workspace_role(
    workspace_id,
    array['owner', 'admin', 'agent']
  )
)
with check (
  app_private.has_workspace_role(
    workspace_id,
    array['owner', 'admin', 'agent']
  )
);

grant select, update on table public.flow_answer_reviews to authenticated;
