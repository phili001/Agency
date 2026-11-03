import "server-only";

import { after } from "next/server";

import type { CalendarRequestMessage } from "@/lib/calendar-request";
import {
  addDaysToDateKey,
  resolveCalendarRequestContext,
  slotMatchesRequestedTime,
} from "@/lib/calendar-request";
import {
  hasLegacyGhlCalendarTools,
  parseCalendarTools,
  resolveCalendarsForAgent,
  type CalendarTool,
} from "@/lib/calendar-tools";
import {
  createAppointment,
  ensureGhlContact,
  getLocationTimezone,
  getVerifiedFreeSlots,
  getWorkspaceCalendarContext,
  listCalendars,
} from "@/lib/integrations/ghl-calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { zonedStartOfDay } from "@/lib/timezones";

import { type AgendaCalendarRuntime, buildAgendaRuntime, runAgendaTool } from "./agent-agenda";
import { googleBusyProvider, syncAppointment } from "./google-sync";

/**
 * Calendario del agente de WhatsApp: con qué agendas trabaja este agente y con
 * este contacto (`buildCalendarRuntime`) y qué hace cada tool
 * (`runCalendarTool`). Dos motores:
 *
 * - `agenda` (F5.2): la agenda propia, en `agent-agenda.ts`.
 * - `ghl`: GoHighLevel, movido tal cual desde `cron/buffer` (F5.0). Se usa
 *   mientras el workspace tenga alguna tool de calendario de GHL (coexistencia
 *   hasta la migración de F7.2): así AAA001 no se queda sin agenda al desplegar.
 */

/** Llamada a una tool tal como la devuelve la API de Responses. */
export type CalendarToolCall = { arguments?: string; name?: string };

export type CalendarRuntime = AgendaCalendarRuntime | GhlCalendarRuntime;

export type CalendarRuntimeResult =
  | { reason: null; runtime: CalendarRuntime }
  | { reason: string; runtime: null };

export type GhlCalendarRuntime = {
  engine: "ghl";
  apiKey: string;
  calendars: Array<CalendarTool & { timezone: string }>;
  contact: {
    email: string | null;
    fullName: string | null;
    ghlContactId: string | null;
    id: string;
    phone: string;
  };
  locationId: string;
  timezone: string;
  workspaceId: string;
};

export async function buildCalendarRuntime({
  agentName,
  contactId,
  conversationId,
  enabledToolIds,
  isBookingAgent,
  workspaceId,
}: {
  agentName: string;
  contactId: string;
  conversationId: string | null;
  enabledToolIds: string[];
  isBookingAgent: boolean;
  workspaceId: string;
}): Promise<CalendarRuntimeResult> {
  // Solo el agente de citas agenda. El setter y el de soporte no deben tocar
  // el calendario aunque el workspace tenga agenda.
  if (!isBookingAgent) {
    return {
      reason: `El agente "${agentName}" no esta identificado como agente de citas. Solo un agente de citas usa el calendario.`,
      runtime: null,
    };
  }

  const admin = createAdminClient();
  const [{ data: contact }, { data: toolAssets }] = await Promise.all([
    admin
      .from("contacts")
      .select("id, full_name, phone_e164, metadata")
      .eq("id", contactId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    admin
      .from("workspace_assets")
      .select("id, title, content, metadata")
      .eq("workspace_id", workspaceId)
      .eq("kind", "tool")
      .neq("status", "archived"),
  ]);
  const tools = parseCalendarTools(toolAssets ?? []);

  if (hasLegacyGhlCalendarTools(tools)) {
    return buildGhlCalendarRuntime({ agentName, contactId, enabledToolIds, isBookingAgent, workspaceId });
  }

  if (!contact?.phone_e164) {
    return { reason: "El contacto no tiene teléfono guardado.", runtime: null };
  }

  return buildAgendaRuntime(
    admin,
    {
      agentName,
      contact: { fullName: contact.full_name, id: contact.id, metadata: contact.metadata, phone: contact.phone_e164 },
      conversationId,
      enabledToolIds,
      tools,
      workspaceId,
    },
  );
}

async function buildGhlCalendarRuntime({
  agentName,
  contactId,
  enabledToolIds,
  isBookingAgent,
  workspaceId,
}: {
  agentName: string;
  contactId: string;
  enabledToolIds: string[];
  isBookingAgent: boolean;
  workspaceId: string;
}): Promise<CalendarRuntimeResult> {
  // Solo el agente de citas agenda. El setter y el de soporte no deben tocar
  // el calendario aunque el workspace lo tenga conectado.
  if (!isBookingAgent) {
    return {
      reason: `El agente "${agentName}" no esta identificado como agente de citas. Solo un agente de citas usa el calendario.`,
      runtime: null,
    };
  }

  const context = await getWorkspaceCalendarContext(workspaceId);

  if (!context) {
    return {
      reason:
        "GoHighLevel no está activo para esta empresa, falta la API key o falta el Location ID en Integraciones.",
      runtime: null,
    };
  }

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("contacts")
    .select("id, email, full_name, phone_e164, metadata")
    .eq("id", contactId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!contact?.phone_e164) {
    return {
      reason: "El contacto no tiene teléfono guardado, así que no se puede crear en GHL.",
      runtime: null,
    };
  }

  // El agente elige entre los calendarios que tenga asignados, salvo que un
  // flujo le haya fijado uno a este contacto.
  const { data: toolAssets } = await admin
    .from("workspace_assets")
    .select("id, title, content, metadata")
    .eq("workspace_id", workspaceId)
    .eq("kind", "tool")
    .neq("status", "archived");
  // Este runtime es el de GoHighLevel: solo tools del formato viejo. Las
  // agendas propias las usa el runtime de F5.2.
  const calendarTools = parseCalendarTools(toolAssets ?? []).filter((tool) => tool.kind === "ghl");
  const calendars = resolveCalendarsForAgent({
    contactMetadata: contact.metadata,
    enabledToolIds,
    tools: calendarTools,
  }).filter((tool) => tool.kind === "ghl");
  // Compatibilidad: si aun no se crearon tools de calendario, se usa el que
  // quedo configurado en la tarjeta de Integraciones.
  const fallbackCalendars: CalendarTool[] =
    calendars.length > 0
      ? calendars
      : calendarTools.length === 0 && context.calendarId
        ? [
            {
              calendarId: context.calendarId,
              calendarName: "Agenda del negocio",
              description: "Calendario configurado en Integraciones.",
              id: "",
              isDefault: true,
              kind: "ghl" as const,
              title: "Agenda del negocio",
            },
          ]
        : [];

  if (fallbackCalendars.length === 0) {
    const hasCalendarTools = calendarTools.length > 0;
    return {
      reason:
        hasCalendarTools && enabledToolIds.length === 0
          ? `El agente "${agentName}" no tiene ninguna tool de calendario asignada. Asignale el calendario correcto en Agentes > Tools asignadas.`
          : "No hay ningun calendario elegido: habilita uno en Tools o seleccionalo en la tarjeta de GoHighLevel en Integraciones.",
      runtime: null,
    };
  }

  // Los calendarios actuales de GHL heredan la zona de la subcuenta y no
  // siempre la incluyen en GET /calendars. No usamos aqui la zona del perfil
  // local: si difiere de GHL, desplaza todas las citas aunque el ISO sea valido.
  const [ghlCalendars, locationTimezone] = await Promise.all([
    listCalendars({
      apiKey: context.apiKey,
      locationId: context.locationId,
    }),
    getLocationTimezone({
      apiKey: context.apiKey,
      locationId: context.locationId,
    }),
  ]);
  const ghlTimezoneByCalendar = new Map(
    ghlCalendars.map((calendar) => [calendar.id, calendar.timezone]),
  );
  const runtimeCalendars = fallbackCalendars.map((calendar) => ({
    ...calendar,
    timezone:
      ghlTimezoneByCalendar.get(calendar.calendarId) ??
      locationTimezone,
  }));
  const calendarWithoutTimezone = runtimeCalendars.find(
    (calendar) => !calendar.timezone,
  );

  if (calendarWithoutTimezone) {
    return {
      reason:
        `No se pudo leer la zona horaria de GHL para "${calendarWithoutTimezone.calendarName}". Habilita View Locations en el Private Integration Token.`,
      runtime: null,
    };
  }

  const calendarsWithTimezone = runtimeCalendars as Array<
    CalendarTool & { timezone: string }
  >;

  const metadata =
    contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata)
      ? (contact.metadata as Record<string, unknown>)
      : {};

  return {
    reason: null,
    runtime: {
      engine: "ghl",
      apiKey: context.apiKey,
      calendars: calendarsWithTimezone,
      contact: {
        email: contact.email,
        fullName: contact.full_name,
        ghlContactId:
          typeof metadata.ghl_contact_id === "string" ? metadata.ghl_contact_id : null,
        id: contact.id,
        phone: contact.phone_e164,
      },
      locationId: context.locationId,
      timezone: calendarsWithTimezone[0].timezone,
      workspaceId,
    },
  };
}

export async function runCalendarTool(
  runtime: CalendarRuntime,
  call: CalendarToolCall,
  messages: CalendarRequestMessage[],
): Promise<Record<string, unknown>> {
  if (runtime.engine === "agenda") {
    const admin = createAdminClient();
    return runAgendaTool(admin, runtime, call, messages, {
      externalBusy: googleBusyProvider(admin, runtime.workspaceId),
      // La copia a Google no hace esperar al cliente: va después de responder
      // (y si falla, la barrida de crm-jobs la reintenta).
      onAppointmentChanged: (appointmentId) =>
        after(() =>
          syncAppointment(admin, runtime.workspaceId, appointmentId).then(
            () => undefined,
            (error) => console.warn("[agent-tools:google-sync]", appointmentId, error instanceof Error ? error.message : error),
          ),
        ),
    });
  }

  return runGhlCalendarTool(runtime, call, messages);
}

async function runGhlCalendarTool(
  runtime: GhlCalendarRuntime,
  call: CalendarToolCall,
  messages: CalendarRequestMessage[],
): Promise<Record<string, unknown>> {
  let args: Record<string, unknown> = {};

  try {
    args = JSON.parse(call.arguments ?? "{}") as Record<string, unknown>;
  } catch {
    return { error: "No se pudieron leer los argumentos de la tool." };
  }

  // Con un solo calendario el modelo no manda el parametro; con varios elige
  // por nombre. Si manda uno que no existe, se corta: agendar en el calendario
  // equivocado es peor que pedirle que lo reintente.
  const requested = typeof args.calendario === "string" ? args.calendario.trim() : "";
  const calendar = requested
    ? runtime.calendars.find((item) => item.calendarName === requested)
    : runtime.calendars[0];

  if (!calendar) {
    return {
      error: `No existe la agenda "${requested}". Opciones validas: ${runtime.calendars
        .map((item) => item.calendarName)
        .join(", ")}.`,
    };
  }

  const timezone = calendar.timezone;
  const requestContext = resolveCalendarRequestContext(messages, timezone);
  const formatSlot = (slot: { iso: string; label: string }) => ({
    cuando: slot.label,
    hora: slot.label.split(", ").at(-1) ?? slot.label,
    inicio: slot.iso,
  });

  try {
    if (call.name === "consultar_disponibilidad") {
      // La medianoche se resuelve en la zona horaria de esta empresa, no en la
      // del servidor: si no, el rango se corre y cada empresa recibe otro dia.
      // La fecha resuelta desde la conversacion manda sobre la que proponga el
      // modelo. Asi "y a las 4?" conserva el viernes del turno anterior.
      const dateKey = requestContext.dateKey ?? String(args.fecha_inicio);
      const startDate = zonedStartOfDay(dateKey, timezone);

      if (!startDate) {
        return { error: "fecha_inicio inválida. Usa formato YYYY-MM-DD." };
      }

      const days = requestContext.dateKey
        ? 1
        : Math.min(Math.max(Number(args.dias) || 1, 1), 14);
      const endDate =
        zonedStartOfDay(addDaysToDateKey(dateKey, days), timezone) ??
        new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
      const { debug, slots } = await getVerifiedFreeSlots({
        apiKey: runtime.apiKey,
        calendarId: calendar.calendarId,
        endDate,
        locationId: runtime.locationId,
        startDate,
        timezone,
      });
      const requestedSlots = requestContext.time
        ? slots.filter((slot) =>
            slotMatchesRequestedTime(slot.iso, timezone, requestContext.time!),
          )
        : [];
      if (slots.length === 0) {
        return {
          // Las claves crudas quedan en el metadata del mensaje: si GHL empieza
          // a responder con otra forma, es lo unico que permite verlo.
          diagnostico: `GHL respondio sin huecos. Claves: ${debug.responseKeys.join(", ") || "(ninguna)"}. Calendario: ${calendar.calendarId}. Zona: ${timezone}.`,
          fecha_consultada: dateKey,
          hora_solicitada: requestContext.time?.label ?? null,
          horarios: [],
          horario_solicitado: null,
          horario_solicitado_disponible: requestContext.time ? false : null,
          mensaje:
            "No hay horarios libres en la fecha consultada. Pregunta si desea buscar otro día.",
        };
      }

      return {
        fecha_consultada: dateKey,
        hora_solicitada: requestContext.time?.label ?? null,
        horarios: slots.map(formatSlot),
        horario_solicitado: requestedSlots[0]
          ? formatSlot(requestedSlots[0])
          : null,
        horario_solicitado_disponible: requestContext.time
          ? requestedSlots.length > 0
          : null,
        zona_horaria: timezone,
      };
    }

    if (call.name === "agendar_cita") {
      let startTime = String(args.horario_iso ?? "");
      let freeSlots: Array<{ iso: string; label: string }>;

      if (requestContext.time && requestContext.time.hours.length > 1) {
        return {
          error: `La hora ${requestContext.time.label} es ambigua. Pregunta si se refiere a AM o PM antes de reservar.`,
          fecha_consultada: requestContext.dateKey,
          hora_solicitada: requestContext.time.label,
        };
      }

      if (requestContext.dateKey && requestContext.time) {
        const dayStart = zonedStartOfDay(requestContext.dateKey, timezone);
        const dayEnd = zonedStartOfDay(
          addDaysToDateKey(requestContext.dateKey, 1),
          timezone,
        );

        if (!dayStart || !dayEnd) {
          return { error: "No se pudo resolver la fecha solicitada." };
        }

        ({ slots: freeSlots } = await getVerifiedFreeSlots({
          apiKey: runtime.apiKey,
          calendarId: calendar.calendarId,
          endDate: dayEnd,
          locationId: runtime.locationId,
          startDate: dayStart,
          timezone,
        }));
        const contextualSlot = freeSlots.find((slot) =>
          slotMatchesRequestedTime(slot.iso, timezone, requestContext.time!),
        );

        if (!contextualSlot) {
          return {
            error: "El horario solicitado ya no está libre.",
            fecha_consultada: requestContext.dateKey,
            hora_solicitada: requestContext.time.label,
            horarios_libres: freeSlots.map(formatSlot),
          };
        }

        // El servidor usa el ISO real de GHL. El modelo no necesita recordar
        // un valor oculto de una consulta anterior ni puede inventarlo.
        startTime = contextualSlot.iso;
      } else {
        const requested = new Date(startTime);

        if (Number.isNaN(requested.getTime())) {
          return {
            error:
              "horario_iso inválido. Copia exactamente el campo 'inicio' de consultar_disponibilidad.",
          };
        }

        const dayStart = new Date(requested.getTime() - 24 * 60 * 60 * 1000);
        const dayEnd = new Date(requested.getTime() + 24 * 60 * 60 * 1000);
        ({ slots: freeSlots } = await getVerifiedFreeSlots({
          apiKey: runtime.apiKey,
          calendarId: calendar.calendarId,
          endDate: dayEnd,
          locationId: runtime.locationId,
          startDate: dayStart,
          timezone,
        }));
      }

      // Se vuelve a preguntar a GHL justo antes de crear. El prompt no es una
      // garantia y el hueco puede haberse ocupado desde la consulta anterior.
      const requested = new Date(startTime);
      const isFree = freeSlots.some(
        (slot) => new Date(slot.iso).getTime() === requested.getTime(),
      );

      if (!isFree) {
        const alternativas = freeSlots.map(formatSlot);

        return {
          error:
            alternativas.length > 0
              ? "Ese horario ya no está libre. Ofrece al cliente una de las alternativas y vuelve a intentarlo con la que elija."
              : "Ese horario no está libre y no quedan huecos cerca. Ofrece buscar en otra fecha.",
          horarios_libres: alternativas,
        };
      }

      const ghlContactId =
        runtime.contact.ghlContactId ??
        (await ensureGhlContact({
          apiKey: runtime.apiKey,
          email: runtime.contact.email,
          fullName: String(args.nombre ?? "") || runtime.contact.fullName,
          locationId: runtime.locationId,
          phone: runtime.contact.phone,
        }));

      if (!ghlContactId) {
        return { error: "No se pudo crear el contacto en GoHighLevel." };
      }

      const appointmentId = await createAppointment({
        apiKey: runtime.apiKey,
        calendarId: calendar.calendarId,
        contactId: ghlContactId,
        locationId: runtime.locationId,
        startTime,
        title: `${String(args.motivo ?? "Cita")} - ${String(args.nombre ?? "")}`.trim(),
      });

      const admin = createAdminClient();
      const { data: contactRow } = await admin
        .from("contacts")
        .select("metadata")
        .eq("id", runtime.contact.id)
        .eq("workspace_id", runtime.workspaceId)
        .maybeSingle();
      const currentMetadata =
        contactRow?.metadata &&
        typeof contactRow.metadata === "object" &&
        !Array.isArray(contactRow.metadata)
          ? (contactRow.metadata as Record<string, unknown>)
          : {};

      await admin
        .from("contacts")
        .update({
          metadata: {
            ...currentMetadata,
            ghl_appointment_id: appointmentId,
            ghl_appointment_start: startTime,
            ghl_contact_id: ghlContactId,
          },
        })
        .eq("id", runtime.contact.id)
        .eq("workspace_id", runtime.workspaceId);

      return {
        cita_id: appointmentId,
        confirmada: true,
        inicio: startTime,
        zona_horaria: timezone,
      };
    }

    return { error: `Tool desconocida: ${call.name}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Error al llamar GoHighLevel.",
    };
  }
}
