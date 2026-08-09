import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceGoHighLevelKey } from "./gohighlevel";

// Los endpoints de calendario usan una Version distinta a la de contactos.
const CALENDAR_API_VERSION = "2021-04-15";
const CONTACTS_API_VERSION = "2021-07-28";

type GhlCalendar = {
  id: string;
  name: string;
  timezone: string | null;
};

type FreeSlot = {
  iso: string;
  label: string;
};

function apiBase() {
  return (
    process.env.GHL_API_BASE ?? "https://services.leadconnectorhq.com"
  ).replace(/\/$/, "");
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function timeZoneOffsetMs(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const map: Record<string, string> = {};

  for (const part of parts) {
    map[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second),
  );

  return asUtc - date.getTime();
}

/**
 * Convierte "YYYY-MM-DD" al instante real de medianoche en la zona horaria de
 * esa empresa. Sin esto, `new Date("2026-08-06T00:00:00")` se interpreta en la
 * zona del servidor (UTC en Vercel), asi que el rango se corre varias horas y
 * de forma distinta para cada empresa segun su pais.
 */
export function zonedStartOfDay(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day || !isValidTimeZone(timeZone)) {
    return null;
  }

  const wallClockAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const firstOffset = timeZoneOffsetMs(timeZone, new Date(wallClockAsUtc));
  let epoch = wallClockAsUtc - firstOffset;
  // Segunda pasada por si el primer instante caia en un cambio de horario.
  const secondOffset = timeZoneOffsetMs(timeZone, new Date(epoch));

  if (secondOffset !== firstOffset) {
    epoch = wallClockAsUtc - secondOffset;
  }

  return new Date(epoch);
}

async function calendarFetch<T>({
  apiKey,
  body,
  method,
  path,
  query,
  version = CALENDAR_API_VERSION,
}: {
  apiKey: string;
  body?: Record<string, unknown>;
  method: "DELETE" | "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  version?: string;
}) {
  const url = new URL(`${apiBase()}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: version,
    },
    method,
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string | string[];
  };

  if (!response.ok) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(" ")
      : payload.message;
    throw new Error(message ?? `GoHighLevel rechazo la peticion. HTTP ${response.status}.`);
  }

  return payload;
}

export function getGhlConfig(config: unknown) {
  const record =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  const read = (key: string) =>
    typeof record[key] === "string" && (record[key] as string).trim()
      ? (record[key] as string).trim()
      : null;

  return {
    calendarId: read("calendar_id"),
    locationId: read("location_id"),
  };
}

export async function getWorkspaceCalendarContext(workspaceId: string) {
  const admin = createAdminClient();
  const [{ data: integration }, apiKey] = await Promise.all([
    admin
      .from("integrations")
      .select("config")
      .eq("workspace_id", workspaceId)
      .eq("provider", "gohighlevel")
      .eq("status", "active")
      .maybeSingle(),
    getWorkspaceGoHighLevelKey(workspaceId),
  ]);

  if (!integration || !apiKey) {
    return null;
  }

  const { calendarId, locationId } = getGhlConfig(integration.config);

  if (!locationId) {
    return null;
  }

  return { apiKey, calendarId, locationId };
}

export async function listCalendars({
  apiKey,
  locationId,
}: {
  apiKey: string;
  locationId: string;
}): Promise<GhlCalendar[]> {
  const payload = await calendarFetch<{ calendars?: Array<Record<string, unknown>> }>({
    apiKey,
    method: "GET",
    path: "/calendars/",
    query: { locationId },
  });

  return (payload.calendars ?? [])
    .map((calendar) => ({
      id: typeof calendar.id === "string" ? calendar.id : "",
      name: typeof calendar.name === "string" ? calendar.name : "Calendario sin nombre",
      timezone:
        typeof calendar.timezone === "string" && isValidTimeZone(calendar.timezone)
          ? calendar.timezone
          : null,
    }))
    .filter((calendar) => calendar.id);
}

/** Zona horaria configurada en GHL para ese calendario, si la expone. */
export async function getCalendarTimezone({
  apiKey,
  calendarId,
  locationId,
}: {
  apiKey: string;
  calendarId: string;
  locationId: string;
}) {
  const calendars = await listCalendars({ apiKey, locationId });
  return calendars.find((calendar) => calendar.id === calendarId)?.timezone ?? null;
}

export type FreeSlotsResult = {
  debug: { responseKeys: string[] };
  slots: FreeSlot[];
};

export async function getFreeSlots({
  apiKey,
  calendarId,
  endDate,
  startDate,
  timezone,
}: {
  apiKey: string;
  calendarId: string;
  endDate: Date;
  startDate: Date;
  timezone: string;
}): Promise<FreeSlotsResult> {
  const payload = await calendarFetch<Record<string, unknown>>({
    apiKey,
    method: "GET",
    path: `/calendars/${encodeURIComponent(calendarId)}/free-slots`,
    query: {
      endDate: String(endDate.getTime()),
      startDate: String(startDate.getTime()),
      timezone,
    },
  });

  // La respuesta es un mapa por fecha (YYYY-MM-DD) y cada dia trae { slots: [...] }.
  const slots: FreeSlot[] = [];

  for (const value of Object.values(payload)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }

    const daySlots = (value as { slots?: unknown }).slots;

    if (!Array.isArray(daySlots)) {
      continue;
    }

    for (const slot of daySlots) {
      if (typeof slot !== "string") {
        continue;
      }

      const parsed = new Date(slot);

      if (Number.isNaN(parsed.getTime())) {
        continue;
      }

      slots.push({
        iso: slot,
        label: `${new Intl.DateTimeFormat("es", {
          day: "numeric",
          month: "long",
          timeZone: timezone,
          weekday: "long",
        }).format(parsed)}, ${new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          hour12: true,
          minute: "2-digit",
          timeZone: timezone,
        }).format(parsed)}`,
      });
    }
  }

  return {
    // Claves crudas de la respuesta: si no se parsea ningun hueco, es lo unico
    // que permite saber si GHL devolvio vacio o con otra forma.
    debug: { responseKeys: Object.keys(payload).slice(0, 12) },
    slots: slots.sort((left, right) => left.iso.localeCompare(right.iso)),
  };
}

export async function createAppointment({
  apiKey,
  calendarId,
  contactId,
  endTime,
  locationId,
  startTime,
  title,
}: {
  apiKey: string;
  calendarId: string;
  contactId: string;
  endTime?: string;
  locationId: string;
  startTime: string;
  title: string;
}) {
  const payload = await calendarFetch<{
    appointment?: { id?: string };
    event?: { id?: string };
    id?: string;
  }>({
    apiKey,
    body: {
      appointmentStatus: "confirmed",
      calendarId,
      contactId,
      locationId,
      title,
      ...(endTime ? { endTime } : {}),
      startTime,
    },
    method: "POST",
    path: "/calendars/events/appointments",
  });
  const appointmentId =
    payload.event?.id ?? payload.appointment?.id ?? payload.id ?? null;

  if (!appointmentId) {
    // GHL respondio 2xx pero sin id: no hay prueba de que la cita exista. Se
    // trata como fallo, porque devolver "confirmada" sin id hacia que el agente
    // le dijera al cliente que estaba agendada cuando no aparecia en GHL.
    throw new Error(
      "GoHighLevel no devolvio el id de la cita, asi que no se puede confirmar que se creo.",
    );
  }

  return appointmentId;
}

export async function getAppointment({
  apiKey,
  eventId,
}: {
  apiKey: string;
  eventId: string;
}) {
  return calendarFetch<Record<string, unknown>>({
    apiKey,
    method: "GET",
    path: `/calendars/events/appointments/${encodeURIComponent(eventId)}`,
  });
}

export async function deleteCalendarEvent({
  apiKey,
  eventId,
}: {
  apiKey: string;
  eventId: string;
}) {
  await calendarFetch<Record<string, unknown>>({
    apiKey,
    method: "DELETE",
    path: `/calendars/events/${encodeURIComponent(eventId)}`,
  });
}

export async function ensureGhlContact({
  apiKey,
  email,
  fullName,
  locationId,
  phone,
}: {
  apiKey: string;
  email?: string | null;
  fullName?: string | null;
  locationId: string;
  phone: string;
}) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const payload = await calendarFetch<{
    contact?: { id?: string };
    id?: string;
  }>({
    apiKey,
    body: {
      email: email ?? undefined,
      firstName: parts[0] ?? "WhatsApp",
      lastName: parts.slice(1).join(" ") || "Lead",
      locationId,
      phone,
      source: "LEVY Agente de citas",
    },
    method: "POST",
    path: "/contacts/upsert",
    version: CONTACTS_API_VERSION,
  });

  return payload.contact?.id ?? payload.id ?? null;
}
