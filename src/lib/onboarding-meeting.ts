import type { Json } from "@/lib/supabase/database.types";

/**
 * Reunión de puesta en marcha con el equipo de Levy. Se agenda en el
 * calendario de GoHighLevel de la empresa creadora (AAA001) y se guarda en
 * `workspaces.onboarding_state.meeting`.
 */
export type MeetingSlot = {
  /** Inicio en ISO, tal como lo devuelve GoHighLevel. */
  iso: string;
  /** "10:00", ya en la zona horaria del cliente. */
  label: string;
};

export type MeetingDay = {
  /** YYYY-MM-DD en la zona del cliente; sirve de clave en la UI. */
  dateKey: string;
  /** "jueves 23 de octubre". */
  label: string;
  slots: MeetingSlot[];
};

export type BookedMeeting = {
  appointmentId: string;
  bookedAt: string;
  startTime: string;
  timezone: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getBookedMeeting(onboardingState: Json | null | undefined): BookedMeeting | null {
  const meeting = asRecord(asRecord(onboardingState).meeting);
  const appointmentId = asString(meeting.appointmentId);
  const startTime = asString(meeting.startTime);

  if (!appointmentId || !startTime || Number.isNaN(new Date(startTime).getTime())) {
    return null;
  }

  return {
    appointmentId,
    bookedAt: asString(meeting.bookedAt),
    startTime,
    timezone: asString(meeting.timezone),
  };
}

/** "jueves 23 de octubre a las 10:00". */
export function formatMeetingWhen(startTime: string, timeZone: string) {
  const date = new Date(startTime);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    const day = new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long",
      timeZone: timeZone || undefined,
      weekday: "long",
    }).format(date);
    const hour = new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    }).format(date);

    return `${day} a las ${hour}`;
  } catch {
    return date.toISOString();
  }
}

/** La reunión ya pasó: deja de mostrarse como pendiente en el wizard. */
export function isMeetingPast(meeting: BookedMeeting | null, now = new Date()) {
  if (!meeting) {
    return false;
  }

  return new Date(meeting.startTime).getTime() < now.getTime();
}

/**
 * Credenciales del calendario de puesta en marcha. Es un calendario propio del
 * onboarding, distinto del que AAA001 usa con sus clientes, así que el id se
 * pone siempre a mano. El token y la location se heredan, por este orden:
 * las del propio calendario > las del GoHighLevel de la agencia (el del funnel
 * de compra) > la conexión guardada de AAA001.
 */
export type MeetingCredentials = {
  calendarId: string;
  locationId: string;
  /** De dónde salió el token: lo dice el log cuando GHL rechaza por permisos. */
  source: "AAA001" | "GHL_AGENCY_TOKEN" | "LEVY_MEETING_GHL_TOKEN";
  token: string;
};

export function resolveMeetingCredentials(
  env: Record<string, string | undefined>,
): MeetingCredentials {
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const value = env[key]?.trim();

      if (value) {
        return value;
      }
    }

    return "";
  };

  const token = read("LEVY_MEETING_GHL_TOKEN", "GHL_AGENCY_TOKEN");

  return {
    calendarId: read("LEVY_MEETING_CALENDAR_ID"),
    locationId: read("LEVY_MEETING_GHL_LOCATION_ID", "GHL_AGENCY_LOCATION_ID"),
    source: env.LEVY_MEETING_GHL_TOKEN?.trim()
      ? "LEVY_MEETING_GHL_TOKEN"
      : token
        ? "GHL_AGENCY_TOKEN"
        : "AAA001",
    token,
  };
}

/**
 * GoHighLevel responde "The token is not authorized for this scope" cuando el
 * token existe pero no tiene los permisos de calendario. Es el fallo más
 * común al estrenar el paso, así que se reconoce para poder decir qué arreglar.
 */
export function isScopeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  return /not authorized for this scope|insufficient.*scope|401|403/i.test(message);
}
