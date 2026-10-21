import "server-only";

import { cache } from "react";

import {
  type MeetingDay,
  resolveMeetingCredentials,
} from "@/lib/onboarding-meeting";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  createAppointment,
  deleteCalendarEvent,
  ensureGhlContact,
  getVerifiedFreeSlots,
  getWorkspaceCalendarContext,
  isValidTimeZone,
} from "./ghl-calendar";

/**
 * Calendario con el que los clientes nuevos agendan su puesta en marcha con
 * nosotros. No es el calendario del cliente ni el que AAA001 usa con los
 * suyos: es uno propio del onboarding, que se indica en
 * LEVY_MEETING_CALENDAR_ID. Si está en la subcuenta de AAA001 se reutiliza su
 * conexión guardada; si vive en otra, se le dan token y location propios.
 *
 * Todo se cachea en memoria porque el wizard lo pinta de entrada: la
 * configuración cambia muy de vez en cuando y los huecos, cada minuto.
 */
const LEVY_WORKSPACE_CODE = process.env.LEVY_WORKSPACE_CODE?.trim() || "AAA001";
const CONFIG_TTL_MS = 5 * 60 * 1000;
const SLOTS_TTL_MS = 60 * 1000;
/** Ventana que se ofrece al cliente. */
const DAYS_AHEAD = 14;
const MAX_DAYS = 6;
const MAX_SLOTS_PER_DAY = 10;

export type LevyCalendar = {
  apiKey: string;
  calendarId: string;
  locationId: string;
};

type Cached<T> = { expiresAt: number; value: T };

let configCache: Cached<LevyCalendar | null> | null = null;
const slotsCache = new Map<string, Cached<MeetingDay[]>>();

function fresh<T>(entry: Cached<T> | null | undefined) {
  return entry && entry.expiresAt > Date.now() ? entry : null;
}

/**
 * Credenciales y calendario de AAA001. `cache` evita repetir la consulta
 * dentro de la misma petición y el TTL, entre peticiones.
 */
export const getLevyCalendar = cache(async (): Promise<LevyCalendar | null> => {
  const cached = fresh(configCache);

  if (cached) {
    return cached.value;
  }

  const value = await resolveLevyCalendar();
  configCache = { expiresAt: Date.now() + CONFIG_TTL_MS, value };

  return value;
});

async function resolveLevyCalendar(): Promise<LevyCalendar | null> {
  const { calendarId, locationId, token } = resolveMeetingCredentials(process.env);

  // Sin calendario propio no se agenda nada: el calendario de puesta en marcha
  // es distinto del que AAA001 usa con sus clientes, así que nunca se adivina.
  if (!calendarId) {
    return null;
  }

  // Credenciales propias (el calendario vive en otra subcuenta de GHL): ni se
  // toca la base de datos.
  if (token && locationId) {
    return { apiKey: token, calendarId, locationId };
  }

  // Si no, el calendario está en la subcuenta de AAA001: se usa su conexión
  // guardada y cifrada, pero con el calendario que diga la variable.
  const admin = createAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("id")
    .eq("company_code", LEVY_WORKSPACE_CODE)
    .maybeSingle();

  if (!workspace) {
    return null;
  }

  const context = await getWorkspaceCalendarContext(workspace.id);

  if (!context) {
    return null;
  }

  return {
    apiKey: token || context.apiKey,
    calendarId,
    locationId: locationId || context.locationId,
  };
}

function groupSlotsByDay(slots: Array<{ iso: string }>, timeZone: string): MeetingDay[] {
  const dayFormat = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    timeZone,
    weekday: "long",
  });
  const hourFormat = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
  const keyFormat = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const days = new Map<string, MeetingDay>();

  for (const slot of slots) {
    const date = new Date(slot.iso);

    if (Number.isNaN(date.getTime()) || date.getTime() < Date.now()) {
      continue;
    }

    const dateKey = keyFormat.format(date);
    const day = days.get(dateKey) ?? {
      dateKey,
      label: dayFormat.format(date),
      slots: [],
    };

    if (day.slots.length < MAX_SLOTS_PER_DAY) {
      day.slots.push({ iso: slot.iso, label: hourFormat.format(date) });
    }

    days.set(dateKey, day);
  }

  return [...days.values()].slice(0, MAX_DAYS);
}

/**
 * Huecos libres de los próximos días, ya agrupados y escritos en la zona
 * horaria del cliente. Cacheado un minuto por zona: el wizard puede pedirlos
 * en cada carga sin castigar a GoHighLevel ni hacer esperar a nadie.
 */
export async function getLevyMeetingDays(timeZone: string): Promise<MeetingDay[]> {
  const calendar = await getLevyCalendar();

  if (!calendar) {
    return [];
  }

  const zone = isValidTimeZone(timeZone) ? timeZone : "Europe/Madrid";
  const key = `${calendar.calendarId}|${zone}`;
  const cached = fresh(slotsCache.get(key));

  if (cached) {
    return cached.value;
  }

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
  const { slots } = await getVerifiedFreeSlots({
    apiKey: calendar.apiKey,
    calendarId: calendar.calendarId,
    endDate,
    locationId: calendar.locationId,
    startDate,
    timezone: zone,
  });
  const days = groupSlotsByDay(slots, zone);

  slotsCache.set(key, { expiresAt: Date.now() + SLOTS_TTL_MS, value: days });

  return days;
}

/** Tras agendar o cancelar, los huecos cambian: se tira la caché. */
export function clearLevyMeetingSlots() {
  slotsCache.clear();
}

export async function bookLevyMeeting({
  companyName,
  email,
  fullName,
  phone,
  startTime,
}: {
  companyName: string;
  email?: string | null;
  fullName?: string | null;
  phone: string;
  startTime: string;
}) {
  const calendar = await getLevyCalendar();

  if (!calendar) {
    throw new Error("El calendario de puesta en marcha no está configurado.");
  }

  const contactId = await ensureGhlContact({
    apiKey: calendar.apiKey,
    email,
    fullName: fullName || companyName,
    locationId: calendar.locationId,
    phone,
  });

  if (!contactId) {
    throw new Error("GoHighLevel no devolvió el contacto de la reunión.");
  }

  const appointmentId = await createAppointment({
    apiKey: calendar.apiKey,
    calendarId: calendar.calendarId,
    contactId,
    locationId: calendar.locationId,
    startTime,
    title: `Puesta en marcha Levy · ${companyName}`,
  });

  clearLevyMeetingSlots();

  return appointmentId;
}

export async function cancelLevyMeeting(appointmentId: string) {
  const calendar = await getLevyCalendar();

  if (!calendar) {
    return;
  }

  try {
    await deleteCalendarEvent({ apiKey: calendar.apiKey, eventId: appointmentId });
  } catch (error) {
    // Si en GHL ya no existe (lo borró el equipo), no es motivo para dejar al
    // cliente sin poder elegir otra hora.
    console.error("[levy-calendar] No se pudo borrar la cita:", error);
  }

  clearLevyMeetingSlots();
}
