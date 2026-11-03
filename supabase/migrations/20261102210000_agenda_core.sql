-- Agenda propia (sustituye al calendario de GoHighLevel): agendas, citas,
-- bloqueos, horarios ofrecidos por conversación y eventos de Google por borrar.
-- Portado de crm-levy `0060_appointments` con multicuenta. Todo aditivo.
--
-- - `appointments`: la restricción de exclusión (btree_gist) impide dos citas
--   activas encimadas en la misma agenda aunque lleguen a la vez por dos
--   canales: la segunda la rechaza Postgres, no el código. `tstzrange` es
--   [inicio, fin), así que una cita que empieza justo cuando termina otra cabe.
-- - `offered_slots`: lo ofrecido a cada conversación. El agente solo puede
--   agendar una hora ofrecida en los últimos 30 min (lo exige
--   `book_appointment`, F1.4): el modelo no puede inventarse una hora.
-- - `agendas.closed_dates`: festivos (días completos cerrados).
--
-- Igual que en crm_core, las referencias son FK compuestas (workspace_id, id)
-- para que nada pueda apuntar a datos de otra empresa.
--
-- Reversión (borra agendas y citas):
--   drop table if exists public.offered_slots, public.schedule_blocks,
--     public.appointments, public.google_event_deletions, public.agendas cascade;
--   alter table public.conversations drop constraint if exists conversations_workspace_id_id_key;
--   drop extension if exists btree_gist;  -- sin cascade, a propósito

create extension if not exists btree_gist with schema extensions;

-- Destino de la FK compuesta (workspace_id, conversation_id).
alter table public.conversations
  add constraint conversations_workspace_id_id_key unique (workspace_id, id);

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

create policy "Members can view agendas"
on public.agendas for select to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Admins can insert agendas"
on public.agendas for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can update agendas"
on public.agendas for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Admins can delete agendas"
on public.agendas for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view appointments"
on public.appointments for select to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Agents and admins can insert appointments"
on public.appointments for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can update appointments"
on public.appointments for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Admins can delete appointments"
on public.appointments for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Members can view schedule blocks"
on public.schedule_blocks for select to authenticated
using (app_private.is_workspace_member(workspace_id));

create policy "Agents and admins can insert schedule blocks"
on public.schedule_blocks for insert to authenticated
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can update schedule blocks"
on public.schedule_blocks for update to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
with check (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Agents and admins can delete schedule blocks"
on public.schedule_blocks for delete to authenticated
using (app_private.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "Members can view offered slots"
on public.offered_slots for select to authenticated
using (app_private.is_workspace_member(workspace_id));

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
