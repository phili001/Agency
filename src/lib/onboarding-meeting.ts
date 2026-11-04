import type { Json } from "@/lib/supabase/database.types";

/**
 * Reunión de puesta en marcha con el equipo de Levy, en la agenda propia de
 * AAA001 (`LEVY_MEETING_AGENDA_ID`, `lib/agenda/levy-meeting.ts`). Se guarda en
 * `workspaces.onboarding_state.meeting`.
 */
export type MeetingSlot = {
  /** Inicio en ISO. */
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
  /** Correo de quien la reservó: ahí van los avisos si se mueve o se cancela. */
  email: string;
  /** Teléfono personal de contacto, no el WhatsApp del negocio. */
  phone: string;
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
    email: asString(meeting.email),
    phone: asString(meeting.phone),
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
