-- CRM propio (sustituye a GoHighLevel): etapas del embudo, etiquetas, campos
-- personalizados, notas, tareas y actividad de cada contacto. Todo aditivo:
-- tablas nuevas, columnas nuevas nullable o con default en `contacts`, una
-- restricción unique redundante (id ya es pk) para las FK compuestas y la
-- siembra de 6 etapas por empresa.
--
-- Multicuenta: cada tabla lleva workspace_id y las referencias a contactos,
-- etapas y etiquetas son FK compuestas (workspace_id, id), así una fila nunca
-- puede apuntar a datos de otra empresa aunque el código se equivoque.
--
-- Etiquetas (decisión F1.1 en PROGRESO_CRM_SUPABASE.md): `crm_tags` son las
-- del operador; `contacts.automation_labels` siguen siendo marcas internas y
-- sus nombres están reservados.
--
-- Reversión (borra los datos del CRM):
--   drop trigger if exists seed_crm_pipeline_stages_on_workspace on public.workspaces;
--   drop function if exists app_private.seed_crm_pipeline_stages_trigger();
--   drop function if exists app_private.seed_crm_pipeline_stages(uuid);
--   drop table if exists public.crm_contact_activity, public.crm_contact_tasks,
--     public.crm_contact_notes, public.crm_contact_tags, public.crm_custom_fields,
--     public.crm_tags cascade;
--   alter table public.contacts drop column if exists stage_id,
--     drop column if exists custom_fields, drop column if exists company,
--     drop column if exists source, drop column if exists last_message_at;
--   drop table if exists public.crm_pipeline_stages;
--   alter table public.contacts drop constraint if exists contacts_workspace_id_id_key;

-- Destino de las FK compuestas (workspace_id, contact_id).
alter table public.contacts
  add constraint contacts_workspace_id_id_key unique (workspace_id, id);

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

alter table public.contacts
  add constraint contacts_source_check
    check (source is null or source in ('whatsapp', 'manual', 'import', 'stripe')),
  add constraint contacts_custom_fields_object_check
    check (jsonb_typeof(custom_fields) = 'object'),
  add constraint contacts_stage_fkey
    foreign key (workspace_id, stage_id)
    references public.crm_pipeline_stages (workspace_id, id)
    on delete set null (stage_id);

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

create policy "Members can view pipeline stages"
on public.crm_pipeline_stages for select to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins can insert pipeline stages"
on public.crm_pipeline_stages for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can update pipeline stages"
on public.crm_pipeline_stages for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can delete pipeline stages"
on public.crm_pipeline_stages for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view tags"
on public.crm_tags for select to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins can insert tags"
on public.crm_tags for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can update tags"
on public.crm_tags for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can delete tags"
on public.crm_tags for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view custom fields"
on public.crm_custom_fields for select to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins can insert custom fields"
on public.crm_custom_fields for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can update custom fields"
on public.crm_custom_fields for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can delete custom fields"
on public.crm_custom_fields for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view contact tags"
on public.crm_contact_tags for select to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Agents and admins can insert contact tags"
on public.crm_contact_tags for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can delete contact tags"
on public.crm_contact_tags for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Members can view contact notes"
on public.crm_contact_notes for select to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Agents and admins can insert contact notes"
on public.crm_contact_notes for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can update contact notes"
on public.crm_contact_notes for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can delete contact notes"
on public.crm_contact_notes for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Members can view contact tasks"
on public.crm_contact_tasks for select to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Agents and admins can insert contact tasks"
on public.crm_contact_tasks for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can update contact tasks"
on public.crm_contact_tasks for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can delete contact tasks"
on public.crm_contact_tasks for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Members can view contact activity"
on public.crm_contact_activity for select to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Agents and admins can insert contact activity"
on public.crm_contact_activity for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
