import type { CrmClient } from "../crm/shared.ts";
import { escapeHtml, type EmailMessage } from "../email.ts";
import { getGmailStatus, isValidEmailAddress, sendGmail } from "../integrations/gmail.ts";
import type { GoogleDeps } from "../integrations/google-calendar.ts";
import { formatMeetingWhen, getBookedMeeting } from "../onboarding-meeting.ts";
import type { Json } from "../supabase/database.types.ts";
import { resolveMeetingAgenda, type MeetingTarget } from "./levy-meeting.ts";

/**
 * Correos de la reunión de puesta en marcha: confirmación al reservar y aviso
 * si se mueve o se cancela. Salen solo del Gmail conectado de AAA001, sin
 * Resend de respaldo. Son un extra: nada de aquí lanza, así que un Gmail sin
 * conectar o caído nunca tumba la reserva.
 */

export type MeetingEmailKind = "cancelled" | "confirmed" | "moved";

export type MeetingEmailInput = {
  companyName: string;
  kind: MeetingEmailKind;
  /** Hora anterior, si se conoce (al mover). */
  previousStartTime?: string | null;
  startTime: string;
  timezone: string;
  to: string | null | undefined;
};

export type MeetingEmailResult =
  | { sent: true }
  | { reason: "failed" | "invalid_recipient" | "not_connected"; sent: false };

export function buildMeetingEmail(input: MeetingEmailInput & { to: string }): EmailMessage {
  const name = input.companyName.trim() || "tu empresa";
  const when = formatMeetingWhen(input.startTime, input.timezone);
  const zone = input.timezone ? ` (hora de ${input.timezone})` : "";
  const previous = input.previousStartTime ? formatMeetingWhen(input.previousStartTime, input.timezone) : "";

  const copy = {
    cancelled: {
      lines: [`Hemos cancelado la reunión de puesta en marcha de ${name} del ${when}${zone}.`, "Puedes reservar otra hora desde el asistente de configuración de Levy."],
      subject: `Reunión de puesta en marcha cancelada: ${name}`,
    },
    confirmed: {
      lines: [`Tu reunión de puesta en marcha de ${name} queda reservada para el ${when}${zone}.`, "Si necesitas cambiarla, puedes hacerlo desde el asistente de configuración de Levy."],
      subject: `Reunión de puesta en marcha confirmada: ${name}`,
    },
    moved: {
      lines: [
        `Tu reunión de puesta en marcha de ${name} ha cambiado de hora. Ahora es el ${when}${zone}.`,
        ...(previous ? [`Antes era el ${previous}.`] : []),
        "Si necesitas cambiarla, puedes hacerlo desde el asistente de configuración de Levy.",
      ],
      subject: `Reunión de puesta en marcha movida: ${name}`,
    },
  }[input.kind];
  const lines = ["¡Hola!", ...copy.lines];

  return {
    html: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n"),
    subject: copy.subject,
    text: lines.join("\n\n"),
    to: input.to,
  };
}

/** Envía el aviso desde el Gmail de AAA001. Nunca lanza: devuelve qué pasó. */
export async function sendMeetingEmail(
  client: CrmClient,
  target: MeetingTarget,
  input: MeetingEmailInput,
  deps: GoogleDeps = {},
): Promise<MeetingEmailResult> {
  const to = input.to?.trim() ?? "";

  if (!isValidEmailAddress(to)) {
    return { reason: "invalid_recipient", sent: false };
  }

  try {
    const status = await getGmailStatus(client, target.workspaceId, deps.env ?? process.env);

    if (!status.connected) {
      console.warn(`[levy-meeting-email] Gmail de AAA001 sin conectar: aviso «${input.kind}» sin enviar.`);
      return { reason: "not_connected", sent: false };
    }

    await sendGmail(client, target.workspaceId, buildMeetingEmail({ ...input, to }), deps, { fromName: "Levy" });
    return { sent: true };
  } catch (error) {
    console.error(`[levy-meeting-email] Aviso «${input.kind}» sin enviar: ${error instanceof Error ? error.message : "error"}`);
    return { reason: "failed", sent: false };
  }
}

type ChangedAppointment = { agenda_id: string; contact_id: string; id: string; starts_at: string };

/**
 * El equipo movió o canceló una cita desde el panel de Agenda. Si es la reunión
 * de onboarding de un cliente, actualiza lo que ve el cliente en su asistente y
 * le avisa por correo. Cualquier otra cita no se toca. Nunca lanza.
 */
export async function handlePanelMeetingChange(
  client: CrmClient,
  workspaceId: string,
  change: { appointment: ChangedAppointment; kind: "cancelled" | "moved"; previousAppointmentId: string },
  deps: GoogleDeps = {},
): Promise<MeetingEmailResult | null> {
  try {
    const target = await resolveMeetingAgenda(client, deps.env ?? process.env);

    if (!target || target.workspaceId !== workspaceId || target.agendaId !== change.appointment.agenda_id) {
      return null;
    }

    const { data, error } = await client
      .from("workspaces")
      .select("id, name, onboarding_state")
      .eq("onboarding_state->meeting->>appointmentId", change.previousAppointmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const owner = data as { id: string; name: string | null; onboarding_state: Json } | null;
    const meeting = getBookedMeeting(owner?.onboarding_state);

    if (!owner || !meeting) {
      return null;
    }

    const state = { ...(owner.onboarding_state as Record<string, Json>) };

    if (change.kind === "moved") {
      state.meeting = { ...meeting, appointmentId: change.appointment.id, startTime: change.appointment.starts_at };
    } else {
      delete state.meeting;
    }

    const { error: updateError } = await client.from("workspaces").update({ onboarding_state: state }).eq("id", owner.id);
    if (updateError) throw new Error(updateError.message);

    const { data: contact } = await client
      .from("contacts")
      .select("email")
      .eq("workspace_id", workspaceId)
      .eq("id", change.appointment.contact_id)
      .maybeSingle();

    return await sendMeetingEmail(
      client,
      target,
      {
        companyName: owner.name ?? "",
        kind: change.kind,
        previousStartTime: change.kind === "moved" ? meeting.startTime : null,
        startTime: change.kind === "moved" ? change.appointment.starts_at : meeting.startTime,
        timezone: meeting.timezone,
        to: meeting.email || (contact as { email: string | null } | null)?.email,
      },
      deps,
    );
  } catch (error) {
    console.error(`[levy-meeting-email] Cambio desde el panel sin aplicar: ${error instanceof Error ? error.message : "error"}`);
    return { reason: "failed", sent: false };
  }
}
