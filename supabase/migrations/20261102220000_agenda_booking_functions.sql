-- Agendar y reagendar en la base, en una sola transacción. Portado de
-- crm-levy `agenda.agendar` / `agenda.reagendar` / `_validar_para_agente`.
--
-- - book_appointment: comprueba que agenda, contacto y conversación son de la
--   empresa; para el agente (y los flujos) exige que la hora se le ofreciera a
--   esa conversación en los últimos 30 min y que siga dentro del horario, sin
--   festivo ni bloqueo, con la antelación mínima y el máximo de días. El
--   operador puede agendar fuera de horario (decide él). El solape lo impide
--   siempre la restricción `appointments_no_overlap`.
-- - reschedule_appointment: cancela la vieja y crea la nueva `rescheduled`; la
--   vieja suelta el hueco antes de insertar (la exclusión se comprueba fila a
--   fila). Si la nueva choca o no es válida, el error deshace todo y la vieja
--   queda como estaba.
-- - Ambas apuntan la actividad del contacto en la misma transacción y marcan
--   `google_sync_pending` para la copia en Google (F3.3).
--
-- Errores (SQLSTATE propios; los traduce src/lib/agenda, F2.4):
--   LVS01 slot_taken     el hueco ya está ocupado
--   LVN01 not_offered    el agente no ofreció esa hora en los últimos 30 min
--   LVH01 outside_hours  fuera de horario, festivo, pasado, antelación o límite de días
--   LVB01 blocked        cae en un bloqueo
--   LVW01 wrong_workspace agenda/contacto/conversación de otra empresa o inexistente
--   LVA01 agenda_inactive agenda desactivada
--   LVX01 not_active     la cita a mover no existe o no está activa
--
-- Las funciones de verdad viven en app_private (security definer, search_path
-- vacío). En public hay envoltorios `security invoker` para poder llamarlas
-- por RPC; solo service_role puede ejecutarlas (el servidor comprueba antes el
-- rol con requireWorkspaceRole y saca workspace_id de la sesión).
--
-- Reversión:
--   drop function if exists public.book_appointment(uuid, uuid, uuid, uuid, text, timestamptz, timestamptz, text, text, uuid);
--   drop function if exists public.reschedule_appointment(uuid, uuid, timestamptz, timestamptz, text, uuid, uuid);
--   drop function if exists app_private.book_appointment(uuid, uuid, uuid, uuid, text, timestamptz, timestamptz, text, text, uuid);
--   drop function if exists app_private.reschedule_appointment(uuid, uuid, timestamptz, timestamptz, text, uuid, uuid);
--   drop function if exists app_private.check_agenda_slot(public.agendas, uuid, timestamptz, timestamptz, text);

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
