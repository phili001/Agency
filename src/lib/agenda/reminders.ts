import type { CrmClient } from "../crm/shared.ts";
import { getZonedParts } from "../timezones.ts";
import { ACTIVE_STATUSES } from "./appointments.ts";
import { formatSlotLabel } from "./slots.ts";

/**
 * Recordatorios de cita y aviso de inasistencia (de crm-levy `seguimientos.py`).
 *
 * - Recordatorio: `reminder_hours_before` horas antes. Solo a citas agendadas
 *   antes de ese momento (a quien agenda para dentro de tres horas no se le
 *   recuerda nada) y que aún están a más de 30 min (si no, llega tarde).
 * - Inasistencia: `no_show_hours_after` horas después de que alguien marque «No
 *   asistió», solo de los últimos 7 días. Nunca se marca solo.
 * - Cómo sale: dentro de la ventana de 24 h de WhatsApp (último mensaje del
 *   contacto, con 30 min de margen) → texto a la cola de `messages` que manda
 *   `cron/deliver`. Fuera → haría falta una plantilla aprobada; `deliver` aún no
 *   las manda (decisión D3), así que se omite y se apunta el motivo.
 * - Idempotente: se reclama la cita con `update … where reminder_sent_at is
 *   null` antes de encolar; dos vueltas a la vez no lo mandan dos veces. Si
 *   encolar falla, se suelta para la siguiente vuelta.
 * - Solo de 08:00 a 21:00 en la zona de la agenda: fuera de ese horario espera.
 */

export type NoticeKind = "no_show" | "reminder";
export type NoticeResult = "queued" | "skipped";

const MESSAGING_WINDOW_MS = 24 * 60 * 60_000;
const WINDOW_MARGIN_MS = 30 * 60_000;
const MIN_LEAD_MS = 30 * 60_000;
const NO_SHOW_LOOKBACK_MS = 7 * 24 * 60 * 60_000;
const SEND_FROM_HOUR = 8;
const SEND_UNTIL_HOUR = 21;
const BATCH = 100;

export const DEFAULT_MESSAGES: Record<NoticeKind, string> = {
  no_show:
    "Hola {nombre}, te echamos de menos en tu cita de {servicio} del {fecha}. Si quieres, te buscamos otro hueco: responde a este mensaje.",
  reminder:
    "Hola {nombre}, te recordamos tu cita de {servicio} el {fecha} a las {hora} con {negocio}. Si no puedes venir, responde a este mensaje y la cambiamos.",
};

export type NoticeValues = { fecha: string; hora: string; negocio: string; nombre: string; servicio: string };

/** Rellena {variables}. Las que falten se quitan sin dejar llaves sueltas. */
export function fillNotice(template: string, values: NoticeValues) {
  return template
    .replace(/\{(nombre|negocio|fecha|hora|servicio)\}/g, (_, key: keyof NoticeValues) => values[key] ?? "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/ {2,}/g, " ")
    .replace(/ ([,.])/g, "$1")
    .trim();
}

/** Primer nombre o «hola» a secas si no hay nombre. */
export function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] ?? "";
}

export function noticeValues(input: {
  businessName: string;
  contactName: string | null;
  service: string;
  startsAt: Date;
  timezone: string;
}): NoticeValues {
  const [fecha, hora] = formatSlotLabel(input.startsAt, input.timezone).split(", ");

  return {
    fecha,
    hora,
    negocio: input.businessName,
    nombre: firstName(input.contactName),
    servicio: input.service.trim() || "tu cita",
  };
}

/** ¿Sigue abierta la ventana de 24 h de WhatsApp (con 30 min de margen)? */
export function isMessagingWindowOpen(lastInboundAt: Date | null, now: Date) {
  return Boolean(lastInboundAt && now.getTime() - lastInboundAt.getTime() < MESSAGING_WINDOW_MS - WINDOW_MARGIN_MS);
}

/** Solo se escribe de 08:00 a 21:00 en la zona de la agenda. */
export function isSendingHour(now: Date, timezone: string) {
  const { hour } = getZonedParts(now, timezone);
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
}

/** ¿Toca ya el recordatorio de esta cita? */
export function reminderDue(
  appointment: { created_at: string; starts_at: string },
  hoursBefore: number,
  now: Date,
) {
  const startsAt = new Date(appointment.starts_at).getTime();
  const remindAt = startsAt - hoursBefore * 60 * 60_000;

  return (
    now.getTime() >= remindAt &&
    startsAt - now.getTime() > MIN_LEAD_MS &&
    new Date(appointment.created_at).getTime() < remindAt
  );
}

/** ¿Toca ya el aviso de inasistencia? (`markedAt` = cuándo se marcó). */
export function noShowDue(appointment: { starts_at: string }, markedAt: Date, hoursAfter: number, now: Date) {
  return (
    now.getTime() - markedAt.getTime() >= hoursAfter * 60 * 60_000 &&
    now.getTime() - new Date(appointment.starts_at).getTime() <= NO_SHOW_LOOKBACK_MS
  );
}

// --- Base de datos -------------------------------------------------------------

type AgendaNoticeConfig = {
  id: string;
  no_show_enabled: boolean;
  no_show_hours_after: number;
  no_show_message: string | null;
  no_show_template: string | null;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  reminder_message: string | null;
  reminder_template: string | null;
  timezone: string;
  workspace_id: string;
};

type CandidateRow = {
  agenda_id: string;
  contact_id: string;
  conversation_id: string | null;
  created_at: string;
  id: string;
  notices: unknown;
  service: string;
  starts_at: string;
  status: string;
  updated_at: string;
  workspace_id: string;
};

export type ReminderRunResult = {
  /** Conversaciones con un aviso recién encolado: hay que pedirle a `deliver` que las mande. */
  conversations: Array<{ conversationId: string; workspaceId: string }>;
  queued: number;
  skipped: number;
  waiting: number;
};

const SENT_COLUMN: Record<NoticeKind, "no_show_sent_at" | "reminder_sent_at"> = {
  no_show: "no_show_sent_at",
  reminder: "reminder_sent_at",
};

async function claim(client: CrmClient, row: CandidateRow, kind: NoticeKind, now: Date) {
  const column = SENT_COLUMN[kind];
  const { data, error } = await client
    .from("appointments")
    .update({ [column]: now.toISOString() })
    .eq("workspace_id", row.workspace_id)
    .eq("id", row.id)
    .is(column, null)
    .select("id");

  if (error) {
    throw new Error(`[reminders:claim] ${error.message}`);
  }

  return Boolean(data?.length);
}

async function release(client: CrmClient, row: CandidateRow, kind: NoticeKind) {
  await client
    .from("appointments")
    .update({ [SENT_COLUMN[kind]]: null })
    .eq("workspace_id", row.workspace_id)
    .eq("id", row.id);
}

async function recordOutcome(
  client: CrmClient,
  row: CandidateRow,
  kind: NoticeKind,
  result: NoticeResult,
  reason: string | null,
  now: Date,
) {
  const notices = Array.isArray(row.notices) ? row.notices : [];
  await client
    .from("appointments")
    .update({ notices: [...notices, { at: now.toISOString(), kind, reason, result }] })
    .eq("workspace_id", row.workspace_id)
    .eq("id", row.id);
  await client.from("crm_contact_activity").insert({
    actor: "system",
    contact_id: row.contact_id,
    data: { appointment_id: row.id, reason, result },
    kind: `${kind}_${result === "queued" ? "sent" : "skipped"}`,
    workspace_id: row.workspace_id,
  });
}

/**
 * Manda (encola) o descarta el aviso de una cita ya reclamada. Devuelve el
 * resultado y el motivo si se descartó.
 */
async function deliverNotice(
  client: CrmClient,
  row: CandidateRow,
  agenda: AgendaNoticeConfig,
  kind: NoticeKind,
  businessName: string,
  now: Date,
): Promise<{ conversationId?: string; reason: string | null; result: NoticeResult }> {
  const { data: contactData } = await client
    .from("contacts")
    .select("full_name, messaging_status, automation_labels")
    .eq("workspace_id", row.workspace_id)
    .eq("id", row.contact_id)
    .maybeSingle();
  const contact = contactData as { automation_labels: string[] | null; full_name: string | null; messaging_status: string } | null;

  if (!contact) {
    return { reason: "el contacto ya no existe", result: "skipped" };
  }
  if (contact.messaging_status === "blocked" || (contact.automation_labels ?? []).includes("flow_opt_out")) {
    return { reason: "el contacto pidió no recibir mensajes", result: "skipped" };
  }

  const { data: conversations } = await client
    .from("conversations")
    .select("id, last_message_at")
    .eq("workspace_id", row.workspace_id)
    .eq("contact_id", row.contact_id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1);
  const conversation = (conversations ?? [])[0] as { id: string } | undefined;
  const conversationId = row.conversation_id ?? conversation?.id ?? null;

  if (!conversationId) {
    return { reason: "no hay conversación de WhatsApp con este contacto", result: "skipped" };
  }

  const { data: lastInbound } = await client
    .from("messages")
    .select("created_at")
    .eq("workspace_id", row.workspace_id)
    .eq("contact_id", row.contact_id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1);
  const lastInboundAt = (lastInbound ?? [])[0] ? new Date(((lastInbound ?? [])[0] as { created_at: string }).created_at) : null;

  if (!isMessagingWindowOpen(lastInboundAt, now)) {
    const template = kind === "reminder" ? agenda.reminder_template : agenda.no_show_template;
    return {
      reason: template
        ? "la ventana de 24 h está cerrada y el envío de plantillas aún no está activo"
        : "la ventana de 24 h está cerrada y no hay plantilla de WhatsApp configurada",
      result: "skipped",
    };
  }

  const text = fillNotice(
    (kind === "reminder" ? agenda.reminder_message : agenda.no_show_message) ?? DEFAULT_MESSAGES[kind],
    noticeValues({
      businessName,
      contactName: contact.full_name,
      service: row.service,
      startsAt: new Date(row.starts_at),
      timezone: agenda.timezone,
    }),
  );
  const { error } = await client.from("messages").insert({
    body: text,
    contact_id: row.contact_id,
    conversation_id: conversationId,
    direction: "outbound",
    message_type: "text",
    metadata: { appointment_id: row.id, kind: `appointment_${kind}` },
    role: "assistant",
    status: "queued",
    workspace_id: row.workspace_id,
  });

  if (error) {
    throw new Error(`[reminders:enqueue] ${error.message}`);
  }

  return { conversationId, reason: null, result: "queued" };
}

async function processKind(
  client: CrmClient,
  kind: NoticeKind,
  agendas: AgendaNoticeConfig[],
  businessNames: Map<string, string>,
  now: Date,
  result: ReminderRunResult,
) {
  const enabled = agendas.filter((agenda) => (kind === "reminder" ? agenda.reminder_enabled : agenda.no_show_enabled));

  if (enabled.length === 0) {
    return;
  }

  const byId = new Map(enabled.map((agenda) => [agenda.id, agenda]));
  const maxHours = Math.max(...enabled.map((agenda) => (kind === "reminder" ? agenda.reminder_hours_before : 0)));
  let query = client
    .from("appointments")
    .select("id, workspace_id, agenda_id, contact_id, conversation_id, service, starts_at, created_at, updated_at, status, notices")
    .in("agenda_id", [...byId.keys()])
    .is(SENT_COLUMN[kind], null);

  query =
    kind === "reminder"
      ? query
          .in("status", ACTIVE_STATUSES)
          .gt("starts_at", new Date(now.getTime() + MIN_LEAD_MS).toISOString())
          .lte("starts_at", new Date(now.getTime() + maxHours * 60 * 60_000).toISOString())
      : query.eq("status", "no_show").gte("starts_at", new Date(now.getTime() - NO_SHOW_LOOKBACK_MS).toISOString());

  const { data, error } = await query.order("starts_at", { ascending: true }).limit(BATCH);

  if (error) {
    throw new Error(`[reminders:${kind}] ${error.message}`);
  }

  for (const row of (data ?? []) as CandidateRow[]) {
    const agenda = byId.get(row.agenda_id);

    if (!agenda || agenda.workspace_id !== row.workspace_id) {
      continue;
    }

    const due =
      kind === "reminder"
        ? reminderDue(row, agenda.reminder_hours_before, now)
        : noShowDue(row, new Date(row.updated_at), agenda.no_show_hours_after, now);

    if (!due) {
      continue;
    }
    if (!isSendingHour(now, agenda.timezone)) {
      result.waiting += 1;
      continue;
    }
    if (!(await claim(client, row, kind, now))) {
      continue;
    }

    try {
      const outcome = await deliverNotice(client, row, agenda, kind, businessNames.get(row.workspace_id) ?? "", now);
      await recordOutcome(client, row, kind, outcome.result, outcome.reason, now);
      result[outcome.result] += 1;
      if (
        outcome.conversationId &&
        !result.conversations.some((item) => item.conversationId === outcome.conversationId)
      ) {
        result.conversations.push({ conversationId: outcome.conversationId, workspaceId: row.workspace_id });
      }
    } catch (deliverError) {
      await release(client, row, kind);
      console.error(`[reminders:${kind}]`, row.id, deliverError);
    }
  }
}

/**
 * Vuelta de crm-jobs: recordatorios e inasistencias de todas las empresas con
 * los avisos encendidos. `excludeWorkspaceIds`: empresas bloqueadas por impago
 * (F6.4), que no envían nada.
 */
export async function runAppointmentNotices(
  client: CrmClient,
  { excludeWorkspaceIds = [], now = new Date() }: { excludeWorkspaceIds?: string[]; now?: Date } = {},
) {
  const result: ReminderRunResult = { conversations: [], queued: 0, skipped: 0, waiting: 0 };
  const { data, error } = await client
    .from("agendas")
    .select(
      "id, workspace_id, timezone, reminder_enabled, reminder_hours_before, reminder_message, reminder_template, no_show_enabled, no_show_hours_after, no_show_message, no_show_template",
    )
    .or("reminder_enabled.eq.true,no_show_enabled.eq.true");

  if (error) {
    throw new Error(`[reminders:agendas] ${error.message}`);
  }

  const agendas = ((data ?? []) as AgendaNoticeConfig[]).filter((agenda) => !excludeWorkspaceIds.includes(agenda.workspace_id));

  if (agendas.length === 0) {
    return result;
  }

  const { data: workspaces } = await client
    .from("workspaces")
    .select("id, name")
    .in("id", [...new Set(agendas.map((agenda) => agenda.workspace_id))]);
  const businessNames = new Map(((workspaces ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));

  await processKind(client, "reminder", agendas, businessNames, now, result);
  await processKind(client, "no_show", agendas, businessNames, now, result);

  return result;
}
