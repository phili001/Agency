import { upsertContactByPhone } from "../crm/contacts.ts";
import type { CrmActor, CrmClient } from "../crm/shared.ts";
import { agencyWorkspaceCode } from "../billing/agency-crm.ts";
import { getAgenda } from "./agendas.ts";
import { bookAppointment, cancelAppointment, getAgendaFreeSlots, type ExternalBusyProvider } from "./appointments.ts";
import { AgendaError } from "./errors.ts";
import { isValidTimeZone } from "../timezones.ts";

/**
 * Reunión de puesta en marcha sobre la **agenda propia de AAA001**
 * (`LEVY_MEETING_AGENDA_ID`). Sin esa variable, el asistente no ofrece horas.
 *
 * El cliente que agenda queda como contacto en el CRM de AAA001 (por su
 * teléfono personal) y la cita la ve el equipo en la Agenda de AAA001.
 */

export type MeetingTarget = { agendaId: string; workspaceId: string };
export type MeetingSlotView = { iso: string; label: string };
export type MeetingDayView = { dateKey: string; label: string; slots: MeetingSlotView[] };

const DAYS_AHEAD = 14;
const MAX_DAYS = 6;
const MAX_SLOTS_PER_DAY = 10;
const ACTOR: CrmActor = { kind: "system" };

/** Agenda de la reunión, comprobando que es de AAA001 y está activa. null si no hay. */
export async function resolveMeetingAgenda(
  client: CrmClient,
  env: Record<string, string | undefined> = process.env,
): Promise<MeetingTarget | null> {
  const agendaId = env.LEVY_MEETING_AGENDA_ID?.trim();
  if (!agendaId) return null;

  const { data, error } = await client
    .from("workspaces")
    .select("id")
    .eq("company_code", agencyWorkspaceCode(env))
    .maybeSingle();
  if (error) throw new Error(`agency workspace: ${error.message}`);
  if (!data) return null;
  const workspaceId = (data as { id: string }).id;

  try {
    const agenda = await getAgenda(client, workspaceId, agendaId);
    return agenda.active ? { agendaId: agenda.id, workspaceId } : null;
  } catch {
    // La variable apunta a una agenda que no es de AAA001: como si no estuviera.
    return null;
  }
}

/** Agrupa huecos por día en la zona del cliente («jueves 23 de octubre» → «10:00»). */
export function groupMeetingSlots(starts: Date[], timeZone: string, now = new Date()): MeetingDayView[] {
  const zone = isValidTimeZone(timeZone) ? timeZone : "Europe/Madrid";
  const dayFormat = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: zone, weekday: "long" });
  const hourFormat = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: zone });
  const keyFormat = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: zone, year: "numeric" });
  const days = new Map<string, MeetingDayView>();

  for (const start of [...starts].sort((a, b) => a.getTime() - b.getTime())) {
    if (start.getTime() < now.getTime()) continue;
    const dateKey = keyFormat.format(start);
    const day = days.get(dateKey) ?? { dateKey, label: dayFormat.format(start), slots: [] };
    if (day.slots.length < MAX_SLOTS_PER_DAY) {
      day.slots.push({ iso: start.toISOString(), label: hourFormat.format(start) });
    }
    days.set(dateKey, day);
  }

  return [...days.values()].slice(0, MAX_DAYS);
}

export async function getMeetingDays(
  client: CrmClient,
  target: MeetingTarget,
  timeZone: string,
  options: { externalBusy?: ExternalBusyProvider; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const { slots } = await getAgendaFreeSlots(client, target.workspaceId, target.agendaId, {
    externalBusy: options.externalBusy,
    now,
    toDateKey: new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  return groupMeetingSlots(
    slots.map((slot) => slot.start),
    timeZone,
    now,
  );
}

export async function bookMeeting(
  client: CrmClient,
  target: MeetingTarget,
  input: {
    companyName: string;
    email: string | null | undefined;
    externalBusy?: ExternalBusyProvider;
    fullName: string | null;
    now?: Date;
    phone: string;
    startTime: string;
    workspaceCode: string | null;
  },
) {
  const now = input.now ?? new Date();
  const start = new Date(input.startTime);
  // Solo horas que la agenda ofrece ahora mismo (no una hora suelta).
  const { slots } = await getAgendaFreeSlots(client, target.workspaceId, target.agendaId, {
    externalBusy: input.externalBusy,
    now,
    toDateKey: new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  if (!slots.some((slot) => slot.start.getTime() === start.getTime())) {
    throw new AgendaError("slot_taken", "Esa hora acaba de ocuparse. Elige otra de la lista.");
  }

  const { contact } = await upsertContactByPhone(
    client,
    target.workspaceId,
    { company: input.companyName, email: input.email ?? null, fullName: input.fullName, phone: input.phone, source: "manual" },
    ACTOR,
  );

  const appointment = await bookAppointment(
    client,
    target.workspaceId,
    {
      agendaId: target.agendaId,
      contactId: contact.id,
      notes: `Puesta en marcha de Levy: ${input.companyName}${input.workspaceCode ? ` (${input.workspaceCode})` : ""}`.slice(0, 500),
      startsAt: start,
    },
    ACTOR,
  );

  return { appointmentId: appointment.id, contactId: contact.id };
}

/** Cancela la reunión. Si ya no está activa (pasó o la movió el equipo), no hace nada. */
export async function cancelMeeting(client: CrmClient, target: MeetingTarget, appointmentId: string) {
  try {
    await cancelAppointment(client, target.workspaceId, appointmentId, ACTOR, { reason: "El cliente cambió o anuló la reunión" });
    return true;
  } catch (error) {
    if (error instanceof AgendaError && error.code === "not_active") return false;
    throw error;
  }
}
