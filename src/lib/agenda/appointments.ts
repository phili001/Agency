import { logActivity } from "../crm/activity.ts";
import { dbFailure, invalid, notFound } from "../crm/errors.ts";
import { assertContactInWorkspace, type CrmActor, type CrmClient } from "../crm/shared.ts";
import { addDaysToDateKey, dateKeyInTimeZone, zonedStartOfDay } from "../timezones.ts";
import { type Agenda, getAgenda } from "./agendas.ts";
import { AgendaError, translateAgendaDbError } from "./errors.ts";
import { type Interval, type Slot, freeSlots, resolveService } from "./slots.ts";

/**
 * Operaciones de la agenda. Agendar y reagendar pasan por las funciones SQL
 * (`book_appointment`/`reschedule_appointment`), que validan oferta, horario y
 * bloqueos y dejan el solape a la restricción de exclusión; aquí se calcula la
 * duración, se traducen los errores y se hace lo demás (cancelar, confirmar,
 * marcar, bloqueos). Todo filtra por `workspace_id`.
 */

export type AppointmentStatus = "cancelled" | "completed" | "no_show" | "rescheduled" | "scheduled";
export type AppointmentCreator = "agent" | "flow" | "import" | "operator";

export type Appointment = {
  agenda_id: string;
  confirmed_at: string | null;
  contact_id: string;
  conversation_id: string | null;
  created_by: AppointmentCreator;
  ends_at: string;
  google_event_id: string | null;
  google_sync_pending: boolean;
  id: string;
  notes: string | null;
  service: string;
  starts_at: string;
  status: AppointmentStatus;
};

export const ACTIVE_STATUSES: AppointmentStatus[] = ["scheduled", "rescheduled"];

const APPOINTMENT_COLUMNS =
  "id, agenda_id, contact_id, conversation_id, service, starts_at, ends_at, status, notes, created_by, google_event_id, google_sync_pending, confirmed_at";

/** Ofertas válidas durante 30 min (lo mismo que comprueba la base). */
export const OFFER_VALIDITY_MINUTES = 30;

function creatorFor(actor: CrmActor): AppointmentCreator {
  if (actor.kind === "agent" || actor.kind === "flow" || actor.kind === "import") {
    return actor.kind;
  }
  return "operator";
}

function toDate(value: unknown, label: string) {
  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw invalid(`${label} no es una fecha válida.`);
  }

  return date;
}

function rpcRow(data: unknown) {
  return (Array.isArray(data) ? data[0] : data) as Appointment | undefined;
}

// --- Ocupado y huecos ----------------------------------------------------------

/**
 * Citas activas y bloqueos de una agenda que se cruzan con [from, to).
 * `excludeAppointmentId`: la que se está moviendo (su hueco cuenta como libre).
 */
export async function loadBusyIntervals(
  client: CrmClient,
  workspaceId: string,
  agendaId: string,
  from: Date,
  to: Date,
  excludeAppointmentId?: string | null,
) {
  const [appointments, blocks] = await Promise.all([
    client
      .from("appointments")
      .select("id, starts_at, ends_at")
      .eq("workspace_id", workspaceId)
      .eq("agenda_id", agendaId)
      .in("status", ACTIVE_STATUSES)
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString()),
    client
      .from("schedule_blocks")
      .select("starts_at, ends_at")
      .eq("workspace_id", workspaceId)
      .eq("agenda_id", agendaId)
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString()),
  ]);

  if (appointments.error) {
    throw dbFailure("loadBusyIntervals.appointments", appointments.error);
  }
  if (blocks.error) {
    throw dbFailure("loadBusyIntervals.blocks", blocks.error);
  }

  const rows = [
    ...((appointments.data ?? []) as Array<{ ends_at: string; id: string; starts_at: string }>).filter(
      (row) => row.id !== excludeAppointmentId,
    ),
    ...((blocks.data ?? []) as Array<{ ends_at: string; starts_at: string }>),
  ];

  return rows.map((row): Interval => ({ end: new Date(row.ends_at), start: new Date(row.starts_at) }));
}

/** Ocupado de fuera (Google, F3.3). Se inyecta para no acoplar la agenda a Google. */
export type ExternalBusyProvider = (agenda: Agenda, from: Date, to: Date) => Promise<Interval[]>;

export async function getAgendaFreeSlots(
  client: CrmClient,
  workspaceId: string,
  agendaId: string,
  options: {
    excludeAppointmentId?: string | null;
    externalBusy?: ExternalBusyProvider;
    fromDateKey?: string;
    now?: Date;
    service?: string | null;
    toDateKey?: string;
  } = {},
) {
  const agenda = await getAgenda(client, workspaceId, agendaId);

  if (!agenda.active) {
    throw new AgendaError("agenda_inactive");
  }

  const now = options.now ?? new Date();
  const config = agenda.config;
  const today = dateKeyInTimeZone(config.timezone, now);
  const fromDateKey = options.fromDateKey && options.fromDateKey > today ? options.fromDateKey : today;
  const toDateKey = options.toDateKey ?? addDaysToDateKey(fromDateKey, 6);
  const service = resolveService(options.service, config.services);
  const from = zonedStartOfDay(fromDateKey, config.timezone) ?? now;
  const to = zonedStartOfDay(addDaysToDateKey(toDateKey, 1), config.timezone) ?? now;
  const busy = await loadBusyIntervals(client, workspaceId, agendaId, from, to, options.excludeAppointmentId);

  if (options.externalBusy && agenda.google_sync_mode === "push_and_busy") {
    busy.push(...(await options.externalBusy(agenda, from, to)));
  }

  return {
    agenda,
    service,
    slots: freeSlots(fromDateKey, toDateKey, service.durationMinutes, busy, config, now),
  };
}

// --- Ofrecer -------------------------------------------------------------------

async function assertConversationInWorkspace(client: CrmClient, workspaceId: string, conversationId: string) {
  const { data, error } = await client
    .from("conversations")
    .select("id, contact_id")
    .eq("workspace_id", workspaceId)
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    throw dbFailure("assertConversationInWorkspace", error);
  }
  if (!data) {
    throw notFound("Esa conversación no existe en esta empresa.");
  }

  return data as { contact_id: string; id: string };
}

/**
 * Apunta los huecos que el agente le acaba de ofrecer a una conversación. Solo
 * esos (en los próximos 30 min) se pueden agendar como agente.
 */
export async function offerSlots(
  client: CrmClient,
  workspaceId: string,
  conversationId: string,
  agendaId: string,
  slots: Array<Pick<Slot, "start">>,
  now = new Date(),
) {
  if (slots.length === 0) {
    return;
  }

  await assertConversationInWorkspace(client, workspaceId, conversationId);
  await getAgenda(client, workspaceId, agendaId);

  const { error } = await client.from("offered_slots").upsert(
    slots.map((slot) => ({
      agenda_id: agendaId,
      conversation_id: conversationId,
      offered_at: now.toISOString(),
      starts_at: slot.start.toISOString(),
      workspace_id: workspaceId,
    })),
    { onConflict: "conversation_id,agenda_id,starts_at" },
  );

  if (error) {
    throw dbFailure("offerSlots", error);
  }
}

// --- Agendar y reagendar ----------------------------------------------------------

export async function bookAppointment(
  client: CrmClient,
  workspaceId: string,
  input: {
    agendaId: string;
    contactId: string;
    conversationId?: string | null;
    notes?: string | null;
    service?: string | null;
    startsAt: Date | string;
  },
  actor: CrmActor,
) {
  const agenda = await getAgenda(client, workspaceId, input.agendaId);
  const service = resolveService(input.service, agenda.config.services);
  const startsAt = toDate(input.startsAt, "La hora de la cita");
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
  const { data, error } = await client.rpc("book_appointment", {
    p_actor_user_id: actor.userId ?? null,
    p_agenda_id: agenda.id,
    p_contact_id: input.contactId,
    p_conversation_id: input.conversationId ?? null,
    p_created_by: creatorFor(actor),
    p_ends_at: endsAt.toISOString(),
    p_notes: input.notes ?? null,
    p_service: service.name,
    p_starts_at: startsAt.toISOString(),
    p_workspace_id: workspaceId,
  });

  if (error) {
    throw translateAgendaDbError(error) ?? dbFailure("bookAppointment", error);
  }

  const appointment = rpcRow(data);

  if (!appointment) {
    throw dbFailure("bookAppointment", { message: "sin fila" });
  }

  return appointment;
}

async function getAppointment(client: CrmClient, workspaceId: string, appointmentId: string) {
  const { data, error } = await client
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    throw dbFailure("getAppointment", error);
  }
  if (!data) {
    throw new AgendaError("not_active");
  }

  return data as Appointment;
}

/** Mueve una cita manteniendo su duración. Vieja cancelada + nueva, o nada. */
export async function rescheduleAppointment(
  client: CrmClient,
  workspaceId: string,
  input: { appointmentId: string; conversationId?: string | null; startsAt: Date | string },
  actor: CrmActor,
) {
  const current = await getAppointment(client, workspaceId, input.appointmentId);
  const startsAt = toDate(input.startsAt, "La nueva hora");
  const durationMs = new Date(current.ends_at).getTime() - new Date(current.starts_at).getTime();
  const { data, error } = await client.rpc("reschedule_appointment", {
    p_actor_user_id: actor.userId ?? null,
    p_appointment_id: current.id,
    p_conversation_id: input.conversationId ?? null,
    p_created_by: creatorFor(actor),
    p_ends_at: new Date(startsAt.getTime() + durationMs).toISOString(),
    p_starts_at: startsAt.toISOString(),
    p_workspace_id: workspaceId,
  });

  if (error) {
    throw translateAgendaDbError(error) ?? dbFailure("rescheduleAppointment", error);
  }

  const appointment = rpcRow(data);

  if (!appointment) {
    throw dbFailure("rescheduleAppointment", { message: "sin fila" });
  }

  return appointment;
}

// --- Cancelar, confirmar, marcar -------------------------------------------------

async function getActiveAppointment(client: CrmClient, workspaceId: string, appointmentId: string) {
  const appointment = await getAppointment(client, workspaceId, appointmentId);

  if (!ACTIVE_STATUSES.includes(appointment.status)) {
    throw new AgendaError("not_active");
  }

  return appointment;
}

async function updateActive(
  client: CrmClient,
  workspaceId: string,
  appointmentId: string,
  changes: Record<string, unknown>,
) {
  const { data, error } = await client
    .from("appointments")
    .update(changes)
    .eq("workspace_id", workspaceId)
    .eq("id", appointmentId)
    .in("status", ACTIVE_STATUSES)
    .select(APPOINTMENT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw dbFailure("updateActiveAppointment", error);
  }
  if (!data) {
    // Otro proceso la cambió entre la lectura y la escritura.
    throw new AgendaError("not_active");
  }

  return data as Appointment;
}

/**
 * Cancela. El agente solo puede cancelar citas futuras de la conversación con
 * la que habla (lo comprueba `conversationId`).
 */
export async function cancelAppointment(
  client: CrmClient,
  workspaceId: string,
  appointmentId: string,
  actor: CrmActor,
  options: { conversationId?: string | null; now?: Date; reason?: string | null } = {},
) {
  const current = await getActiveAppointment(client, workspaceId, appointmentId);
  const now = options.now ?? new Date();

  if (actor.kind === "agent") {
    if (!options.conversationId || current.conversation_id !== options.conversationId) {
      throw new AgendaError("not_active", "Esa cita no es de esta conversación.");
    }
    if (new Date(current.starts_at) <= now) {
      throw new AgendaError("not_active", "Esa cita ya pasó.");
    }
  }

  const appointment = await updateActive(client, workspaceId, appointmentId, {
    google_sync_pending: Boolean(current.google_event_id),
    status: "cancelled",
  });

  await logActivity(
    client,
    workspaceId,
    appointment.contact_id,
    "appointment_cancelled",
    { appointment_id: appointment.id, reason: options.reason?.slice(0, 500) ?? null, starts_at: appointment.starts_at },
    actor,
  );

  return appointment;
}

/** El contacto confirma que viene (respuesta al recordatorio, F4.1). */
export async function confirmAppointment(client: CrmClient, workspaceId: string, appointmentId: string, now = new Date()) {
  await getActiveAppointment(client, workspaceId, appointmentId);

  return updateActive(client, workspaceId, appointmentId, { confirmed_at: now.toISOString() });
}

/** Completada o no asistió. Solo citas que ya empezaron. */
export async function markAppointment(
  client: CrmClient,
  workspaceId: string,
  appointmentId: string,
  status: "completed" | "no_show",
  now = new Date(),
) {
  const current = await getActiveAppointment(client, workspaceId, appointmentId);

  if (status !== "completed" && status !== "no_show") {
    throw invalid("Estado no válido.");
  }
  if (new Date(current.starts_at) > now) {
    throw invalid("Solo se puede marcar una cita que ya empezó.");
  }

  return updateActive(client, workspaceId, appointmentId, { status });
}

// --- Consultas -------------------------------------------------------------------

export async function listAppointments(
  client: CrmClient,
  workspaceId: string,
  { agendaId, from, includeCancelled = false, to }: { agendaId?: string; from: Date; includeCancelled?: boolean; to: Date },
) {
  let query = client
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString());

  if (agendaId) {
    query = query.eq("agenda_id", agendaId);
  }
  if (!includeCancelled) {
    query = query.neq("status", "cancelled");
  }

  const { data, error } = await query.order("starts_at", { ascending: true });

  if (error) {
    throw dbFailure("listAppointments", error);
  }

  return (data ?? []) as Appointment[];
}

/** Próximas citas activas de un contacto (para el agente y la bandeja). */
export async function upcomingAppointmentsForContact(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  now = new Date(),
  limit = 5,
) {
  await assertContactInWorkspace(client, workspaceId, contactId);
  const { data, error } = await client
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .in("status", ACTIVE_STATUSES)
    .gte("starts_at", now.toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw dbFailure("upcomingAppointmentsForContact", error);
  }

  return (data ?? []) as Appointment[];
}

// --- Bloqueos --------------------------------------------------------------------

export type ScheduleBlock = { agenda_id: string; ends_at: string; id: string; reason: string | null; starts_at: string };

export async function createBlock(
  client: CrmClient,
  workspaceId: string,
  input: { agendaId: string; endsAt: Date | string; reason?: string | null; startsAt: Date | string },
) {
  await getAgenda(client, workspaceId, input.agendaId);
  const startsAt = toDate(input.startsAt, "El inicio del bloqueo");
  const endsAt = toDate(input.endsAt, "El fin del bloqueo");

  if (endsAt <= startsAt) {
    throw invalid("El bloqueo tiene que terminar después de empezar.");
  }

  const { data, error } = await client
    .from("schedule_blocks")
    .insert({
      agenda_id: input.agendaId,
      ends_at: endsAt.toISOString(),
      reason: input.reason?.trim().slice(0, 200) || null,
      starts_at: startsAt.toISOString(),
      workspace_id: workspaceId,
    })
    .select("id, agenda_id, starts_at, ends_at, reason")
    .single();

  if (error || !data) {
    throw dbFailure("createBlock", error ?? { message: "sin fila" });
  }

  return data as ScheduleBlock;
}

export async function deleteBlock(client: CrmClient, workspaceId: string, blockId: string) {
  const { data, error } = await client
    .from("schedule_blocks")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", blockId)
    .select("id");

  if (error) {
    throw dbFailure("deleteBlock", error);
  }
  if (!data?.length) {
    throw notFound("Ese bloqueo no existe en esta empresa.");
  }
}

export async function listBlocks(
  client: CrmClient,
  workspaceId: string,
  { agendaId, from, to }: { agendaId?: string; from: Date; to: Date },
) {
  let query = client
    .from("schedule_blocks")
    .select("id, agenda_id, starts_at, ends_at, reason")
    .eq("workspace_id", workspaceId)
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString());

  if (agendaId) {
    query = query.eq("agenda_id", agendaId);
  }

  const { data, error } = await query.order("starts_at", { ascending: true });

  if (error) {
    throw dbFailure("listBlocks", error);
  }

  return (data ?? []) as ScheduleBlock[];
}

/** Borra las ofertas de más de un día (crm-jobs, F4.2). */
export async function purgeOfferedSlots(client: CrmClient, now = new Date()) {
  const { data, error } = await client
    .from("offered_slots")
    .delete()
    .lt("offered_at", new Date(now.getTime() - 24 * 60 * 60_000).toISOString())
    .select("conversation_id");

  if (error) {
    throw dbFailure("purgeOfferedSlots", error);
  }

  return data?.length ?? 0;
}
