import {
  type CalendarRequestMessage,
  resolveCalendarRequestContext,
  slotMatchesRequestedTime,
} from "../calendar-request.ts";
import { type CalendarTool, resolveCalendarsForAgent } from "../calendar-tools.ts";
import type { CrmClient } from "../crm/shared.ts";
import { addDaysToDateKey, getZonedParts, isoWeekdayOfDateKey } from "../timezones.ts";
import { getDefaultAgenda, listAgendas } from "./agendas.ts";
import {
  type Appointment,
  type ExternalBusyProvider,
  bookAppointment,
  cancelAppointment,
  getAgendaFreeSlots,
  offerSlots,
  rescheduleAppointment,
  upcomingAppointmentsForContact,
} from "./appointments.ts";
import { AgendaError } from "./errors.ts";
import { type AgendaService, type Slot, distributeSlots, formatSlotLabel, resolveService } from "./slots.ts";

/**
 * Calendario del agente sobre la agenda propia (F5.2). Mismas tools y mismas
 * reglas de siempre, más `reagendar_cita` y `cancelar_cita`:
 *
 * - Lo que devuelve `consultar_disponibilidad` se apunta en `offered_slots` de
 *   esta conversación. Agendar como agente exige que la hora se ofreciera en
 *   los últimos 30 min (lo comprueba `book_appointment` en la base).
 * - Cuando el cliente pide fecha y hora en el mensaje («el jueves a las 4»),
 *   el servidor calcula los huecos en el momento, toma el real y lo ofrece
 *   antes de agendar: el modelo no tiene que recordar ni puede inventar el ISO.
 * - Reagendar y cancelar solo tocan citas futuras de este contacto; cancelar,
 *   solo las de esta conversación (`cancelAppointment` lo comprueba).
 */

const MAX_OFFERED = 6;

export type AgendaRuntimeCalendar = {
  calendarId: string;
  calendarName: string;
  description: string;
  services: AgendaService[];
  timezone: string;
};

export type UpcomingForAgent = { agendaName: string; id: string; label: string; service: string; startsAt: string };

export type AgendaCalendarRuntime = {
  calendars: AgendaRuntimeCalendar[];
  contact: { fullName: string | null; id: string; phone: string };
  conversationId: string | null;
  engine: "agenda";
  timezone: string;
  upcoming: UpcomingForAgent[];
  workspaceId: string;
};

export type AgendaRuntimeDeps = {
  externalBusy?: ExternalBusyProvider;
  now?: () => Date;
  /** Tras crear, mover o cancelar una cita (copia a Google en segundo plano). */
  onAppointmentChanged?: (appointmentId: string) => void;
};

function upcomingFor(appointments: Appointment[], calendars: AgendaRuntimeCalendar[], fallbackTimezone: string, agendaNames: Map<string, string>) {
  return appointments.map((appointment) => {
    const calendar = calendars.find((item) => item.calendarId === appointment.agenda_id);
    return {
      agendaName: agendaNames.get(appointment.agenda_id) ?? calendar?.calendarName ?? "Agenda",
      id: appointment.id,
      label: formatSlotLabel(new Date(appointment.starts_at), calendar?.timezone ?? fallbackTimezone),
      service: appointment.service,
      startsAt: appointment.starts_at,
    };
  });
}

/**
 * Agendas de este agente para este contacto. `tools` son las tools de
 * calendario del workspace ya leídas; aquí solo se usan las de tipo agenda.
 */
export async function buildAgendaRuntime(
  client: CrmClient,
  input: {
    agentName: string;
    contact: { fullName: string | null; id: string; metadata: unknown; phone: string };
    conversationId: string | null;
    enabledToolIds: string[];
    tools: CalendarTool[];
    workspaceId: string;
  },
  deps: AgendaRuntimeDeps = {},
): Promise<{ reason: null; runtime: AgendaCalendarRuntime } | { reason: string; runtime: null }> {
  const agendaTools = input.tools;
  const resolved = resolveCalendarsForAgent({
    contactMetadata: input.contact.metadata as never,
    enabledToolIds: input.enabledToolIds,
    tools: agendaTools,
  });
  const agendas = await listAgendas(client, input.workspaceId, { activeOnly: true });
  const byId = new Map(agendas.map((agenda) => [agenda.id, agenda]));
  let chosen = resolved.flatMap((tool) => {
    const agenda = byId.get(tool.calendarId);
    return agenda ? [{ agenda, description: tool.description || agenda.description, name: tool.calendarName }] : [];
  });

  // Sin tools de agenda en el workspace, la agenda por defecto. Con tools pero
  // ninguna asignada, nada.
  if (chosen.length === 0 && agendaTools.length === 0) {
    const fallback = await getDefaultAgenda(client, input.workspaceId);
    chosen = fallback ? [{ agenda: fallback, description: fallback.description, name: fallback.name }] : [];
  }

  if (chosen.length === 0) {
    return {
      reason:
        agendaTools.length > 0 && input.enabledToolIds.length === 0
          ? `El agente "${input.agentName}" no tiene ninguna agenda asignada. Asígnale la correcta en Agentes > Tools asignadas.`
          : "No hay ninguna agenda activa para agendar: crea una en Agenda o asígnala al agente.",
      runtime: null,
    };
  }

  const calendars = chosen.map(({ agenda, description, name }) => ({
    calendarId: agenda.id,
    calendarName: name,
    description,
    services: agenda.config.services,
    timezone: agenda.config.timezone,
  }));
  const now = deps.now?.() ?? new Date();
  const upcoming = await upcomingAppointmentsForContact(client, input.workspaceId, input.contact.id, now);

  return {
    reason: null,
    runtime: {
      calendars,
      contact: { fullName: input.contact.fullName, id: input.contact.id, phone: input.contact.phone },
      conversationId: input.conversationId,
      engine: "agenda",
      timezone: calendars[0].timezone,
      upcoming: upcomingFor(upcoming, calendars, calendars[0].timezone, new Map(agendas.map((agenda) => [agenda.id, agenda.name]))),
      workspaceId: input.workspaceId,
    },
  };
}

function formatSlot(slot: Pick<Slot, "start">, timezone: string) {
  const label = formatSlotLabel(slot.start, timezone);
  return { cuando: label, hora: label.split(", ").at(-1) ?? label, inicio: slot.start.toISOString() };
}

function sameInstant(a: string | Date, b: string | Date) {
  return new Date(a).getTime() === new Date(b).getTime();
}

type ToolArgs = Record<string, unknown>;

/** Cita objetivo de reagendar/cancelar: la indicada o la única próxima. */
async function pickUpcoming(client: CrmClient, runtime: AgendaCalendarRuntime, args: ToolArgs, now: Date) {
  const upcoming = await upcomingAppointmentsForContact(client, runtime.workspaceId, runtime.contact.id, now);
  const requested = typeof args.cita_actual_inicio === "string" ? args.cita_actual_inicio.trim() : "";

  if (upcoming.length === 0) {
    return { error: { error: "Este contacto no tiene citas próximas." } };
  }
  if (requested) {
    const match = upcoming.find((appointment) => sameInstant(appointment.starts_at, requested));
    return match
      ? { appointment: match }
      : { error: { citas: upcoming.map((item) => ({ inicio: item.starts_at, servicio: item.service })), error: "No encuentro una cita a esa hora. Usa el 'inicio' exacto de una de sus citas." } };
  }
  if (upcoming.length > 1) {
    return {
      error: {
        citas: upcoming.map((item) => ({ inicio: item.starts_at, servicio: item.service })),
        error: "El contacto tiene varias citas: pregunta cuál y pasa su 'inicio' en cita_actual_inicio.",
      },
    };
  }
  return { appointment: upcoming[0] };
}

/** Huecos de un día (para alternativas), ya ofrecidos a la conversación. */
async function alternativesFor(
  client: CrmClient,
  runtime: AgendaCalendarRuntime,
  calendar: AgendaRuntimeCalendar,
  dateKey: string,
  service: string | null,
  deps: AgendaRuntimeDeps,
  excludeAppointmentId?: string,
) {
  const now = deps.now?.() ?? new Date();
  const { slots } = await getAgendaFreeSlots(client, runtime.workspaceId, calendar.calendarId, {
    excludeAppointmentId,
    externalBusy: deps.externalBusy,
    fromDateKey: dateKey,
    now,
    service,
    toDateKey: dateKey,
  });
  const chosen = distributeSlots(slots, MAX_OFFERED, calendar.timezone);

  if (runtime.conversationId && chosen.length > 0) {
    await offerSlots(client, runtime.workspaceId, runtime.conversationId, calendar.calendarId, chosen, now);
  }

  return { chosen, slots };
}

/**
 * Hora para agendar o mover: la pedida en el mensaje (calculada y ofrecida por
 * el servidor) o el `horario_iso` que copió el modelo de la consulta.
 */
async function resolveStart(
  client: CrmClient,
  runtime: AgendaCalendarRuntime,
  calendar: AgendaRuntimeCalendar,
  args: ToolArgs,
  messages: CalendarRequestMessage[],
  service: string | null,
  deps: AgendaRuntimeDeps,
  excludeAppointmentId?: string,
): Promise<{ error: Record<string, unknown> } | { start: Date }> {
  const requestContext = resolveCalendarRequestContext(messages, calendar.timezone, deps.now?.());

  if (requestContext.time && requestContext.time.hours.length > 1) {
    return {
      error: {
        error: `La hora ${requestContext.time.label} es ambigua. Pregunta si se refiere a AM o PM antes de reservar.`,
        fecha_consultada: requestContext.dateKey,
        hora_solicitada: requestContext.time.label,
      },
    };
  }

  if (requestContext.dateKey && requestContext.time) {
    const { chosen, slots } = await alternativesFor(client, runtime, calendar, requestContext.dateKey, service, deps, excludeAppointmentId);
    const match = slots.find((slot) => slotMatchesRequestedTime(slot.start.toISOString(), calendar.timezone, requestContext.time!));

    if (!match) {
      return {
        error: {
          error: "El horario solicitado no está libre.",
          fecha_consultada: requestContext.dateKey,
          hora_solicitada: requestContext.time.label,
          horarios_libres: chosen.map((slot) => formatSlot(slot, calendar.timezone)),
        },
      };
    }

    if (runtime.conversationId) {
      await offerSlots(client, runtime.workspaceId, runtime.conversationId, calendar.calendarId, [match], deps.now?.());
    }

    return { start: match.start };
  }

  const start = new Date(String(args.horario_iso ?? ""));

  if (Number.isNaN(start.getTime())) {
    return { error: { error: "horario_iso inválido. Copia exactamente el campo 'inicio' de consultar_disponibilidad." } };
  }

  return { start };
}

async function failureWithAlternatives(
  error: unknown,
  client: CrmClient,
  runtime: AgendaCalendarRuntime,
  calendar: AgendaRuntimeCalendar,
  start: Date,
  service: string | null,
  deps: AgendaRuntimeDeps,
  excludeAppointmentId?: string,
) {
  if (!(error instanceof AgendaError)) {
    throw error;
  }

  if (error.code === "slot_taken" || error.code === "not_offered" || error.code === "blocked" || error.code === "outside_hours") {
    const dateKey = getZonedParts(start, calendar.timezone).dateKey;
    const { chosen } = await alternativesFor(client, runtime, calendar, dateKey, service, deps, excludeAppointmentId).catch(() => ({ chosen: [] as Slot[] }));
    return {
      codigo: error.code,
      error:
        error.code === "not_offered"
          ? "Ese horario no se le ofreció en esta conversación. Consulta disponibilidad y ofrécelo antes de agendar."
          : chosen.length > 0
            ? "Ese horario ya no está libre. Ofrece al cliente una de las alternativas y vuelve a intentarlo con la que elija."
            : "Ese horario no está libre y no quedan huecos ese día. Ofrece buscar en otra fecha.",
      horarios_libres: chosen.map((slot) => formatSlot(slot, calendar.timezone)),
    };
  }

  return { codigo: error.code, error: error.message };
}

export async function runAgendaTool(
  client: CrmClient,
  runtime: AgendaCalendarRuntime,
  call: { arguments?: string; name?: string },
  messages: CalendarRequestMessage[],
  deps: AgendaRuntimeDeps = {},
): Promise<Record<string, unknown>> {
  let args: ToolArgs = {};

  try {
    args = JSON.parse(call.arguments ?? "{}") as ToolArgs;
  } catch {
    return { error: "No se pudieron leer los argumentos de la tool." };
  }

  const now = deps.now?.() ?? new Date();
  const agent = { kind: "agent" as const };

  try {
    if (call.name === "reagendar_cita" || call.name === "cancelar_cita") {
      const picked = await pickUpcoming(client, runtime, args, now);
      if ("error" in picked) {
        return picked.error!;
      }
      const target = picked.appointment!;
      const calendar = runtime.calendars.find((item) => item.calendarId === target.agenda_id);

      if (call.name === "cancelar_cita") {
        const cancelled = await cancelAppointment(client, runtime.workspaceId, target.id, agent, {
          conversationId: runtime.conversationId,
          now,
          reason: typeof args.motivo === "string" ? args.motivo : null,
        });
        deps.onAppointmentChanged?.(cancelled.id);
        return { cancelada: true, cita_id: cancelled.id, inicio: cancelled.starts_at, zona_horaria: calendar?.timezone ?? runtime.timezone };
      }

      if (!calendar) {
        return { error: "Esa cita es de una agenda que este agente no gestiona. El equipo la moverá." };
      }

      const resolved = await resolveStart(client, runtime, calendar, args, messages, target.service, deps, target.id);
      if ("error" in resolved) {
        return resolved.error;
      }

      try {
        const moved = await rescheduleAppointment(
          client,
          runtime.workspaceId,
          { appointmentId: target.id, conversationId: runtime.conversationId, startsAt: resolved.start },
          agent,
        );
        deps.onAppointmentChanged?.(target.id);
        deps.onAppointmentChanged?.(moved.id);
        return { cita_id: moved.id, confirmada: true, inicio: moved.starts_at, reagendada: true, zona_horaria: calendar.timezone };
      } catch (error) {
        return failureWithAlternatives(error, client, runtime, calendar, resolved.start, target.service, deps, target.id);
      }
    }

    // Con una sola agenda el modelo no manda el parámetro; con varias elige por
    // nombre. Si manda una que no existe, se corta.
    const requested = typeof args.calendario === "string" ? args.calendario.trim() : "";
    const calendar = requested ? runtime.calendars.find((item) => item.calendarName === requested) : runtime.calendars[0];

    if (!calendar) {
      return { error: `No existe la agenda "${requested}". Opciones validas: ${runtime.calendars.map((item) => item.calendarName).join(", ")}.` };
    }

    if (call.name === "consultar_disponibilidad") {
      const requestContext = resolveCalendarRequestContext(messages, calendar.timezone, now);
      const dateKey = requestContext.dateKey ?? String(args.fecha_inicio ?? "");

      if (!isoWeekdayOfDateKey(dateKey)) {
        return { error: "fecha_inicio inválida. Usa formato YYYY-MM-DD." };
      }

      const days = requestContext.dateKey ? 1 : Math.min(Math.max(Number(args.dias) || 1, 1), 14);
      const serviceText = typeof args.servicio === "string" ? args.servicio : null;
      const service = resolveService(serviceText, calendar.services);
      const { slots } = await getAgendaFreeSlots(client, runtime.workspaceId, calendar.calendarId, {
        externalBusy: deps.externalBusy,
        fromDateKey: dateKey,
        now,
        service: serviceText,
        toDateKey: addDaysToDateKey(dateKey, days - 1),
      });
      const requestedSlots = requestContext.time
        ? slots.filter((slot) => slotMatchesRequestedTime(slot.start.toISOString(), calendar.timezone, requestContext.time!))
        : [];
      const chosen = distributeSlots(slots, MAX_OFFERED, calendar.timezone);
      const offered = requestedSlots[0] && !chosen.includes(requestedSlots[0]) ? [requestedSlots[0], ...chosen] : chosen;

      if (runtime.conversationId && offered.length > 0) {
        await offerSlots(client, runtime.workspaceId, runtime.conversationId, calendar.calendarId, offered, now);
      }

      if (slots.length === 0) {
        return {
          fecha_consultada: dateKey,
          hora_solicitada: requestContext.time?.label ?? null,
          horarios: [],
          horario_solicitado: null,
          horario_solicitado_disponible: requestContext.time ? false : null,
          mensaje: "No hay horarios libres en la fecha consultada. Pregunta si desea buscar otro día.",
          servicio: service.name,
          zona_horaria: calendar.timezone,
        };
      }

      return {
        duracion_minutos: service.durationMinutes,
        fecha_consultada: dateKey,
        hora_solicitada: requestContext.time?.label ?? null,
        horarios: chosen.map((slot) => formatSlot(slot, calendar.timezone)),
        horario_solicitado: requestedSlots[0] ? formatSlot(requestedSlots[0], calendar.timezone) : null,
        horario_solicitado_disponible: requestContext.time ? requestedSlots.length > 0 : null,
        servicio: service.name,
        zona_horaria: calendar.timezone,
      };
    }

    if (call.name === "agendar_cita") {
      const service = typeof args.motivo === "string" && args.motivo.trim() ? args.motivo : null;
      const resolved = await resolveStart(client, runtime, calendar, args, messages, service, deps);

      if ("error" in resolved) {
        return resolved.error;
      }

      try {
        const appointment = await bookAppointment(
          client,
          runtime.workspaceId,
          {
            agendaId: calendar.calendarId,
            contactId: runtime.contact.id,
            conversationId: runtime.conversationId,
            service,
            startsAt: resolved.start,
          },
          agent,
        );
        const name = typeof args.nombre === "string" ? args.nombre.trim().slice(0, 160) : "";

        if (name && !runtime.contact.fullName) {
          await client.from("contacts").update({ full_name: name }).eq("workspace_id", runtime.workspaceId).eq("id", runtime.contact.id);
        }

        deps.onAppointmentChanged?.(appointment.id);
        return { cita_id: appointment.id, confirmada: true, inicio: appointment.starts_at, servicio: appointment.service, zona_horaria: calendar.timezone };
      } catch (error) {
        return failureWithAlternatives(error, client, runtime, calendar, resolved.start, service, deps);
      }
    }

    return { error: `Tool desconocida: ${call.name}` };
  } catch (error) {
    if (error instanceof AgendaError) {
      return { codigo: error.code, error: error.message };
    }
    console.error("[agent-agenda]", call.name, error);
    return { error: "No se pudo consultar la agenda en este momento." };
  }
}

