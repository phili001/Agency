import type { CrmClient } from "../crm/shared.ts";
import {
  type GoogleDeps,
  GoogleCalendarError,
  deleteEvent,
  freeBusy,
  getGoogleOAuthConfig,
  upsertEvent,
} from "../integrations/google-calendar.ts";
import { ACTIVE_STATUSES, type AppointmentStatus, type ExternalBusyProvider } from "./appointments.ts";

/**
 * Copia de la agenda en Google Calendar (de crm-levy `calendar_sync.py`).
 *
 * - La agenda del CRM es la fuente de verdad; Google es una copia. Lo que se
 *   cambie en Google no vuelve.
 * - `google_sync_pending` lo marcan las funciones SQL y `cancelAppointment`;
 *   aquí se pone al día la copia y se baja la marca SOLO si la cita no cambió
 *   mientras tanto (se compara `updated_at`).
 * - Si Google no está conectado o falla, la marca se queda: la barrida de
 *   crm-jobs (F4.2) lo reintenta. Solo se barren empresas conectadas, para no
 *   pedir tokens revocados cada cinco minutos.
 */

const SWEEP_BATCH = 50;
const MAX_DELETION_ATTEMPTS = 10;

export type SyncOutcome =
  | "changed_meanwhile"
  | "created"
  | "deleted"
  | "deleted_meanwhile"
  | "missing"
  | "nothing_to_do"
  | "updated";

type SyncRow = {
  agenda_id: string;
  contact_id: string;
  ends_at: string;
  google_event_id: string | null;
  google_sync_pending: boolean;
  id: string;
  service: string;
  starts_at: string;
  status: AppointmentStatus;
  updated_at: string;
  workspace_id: string;
};

type AgendaSync = { google_calendar_id: string | null; google_sync_mode: string; timezone: string };

/** Empresas con Google Calendar conectado y activo. */
async function connectedWorkspaces(client: CrmClient, onlyWorkspaceId?: string) {
  let query = client.from("integrations").select("workspace_id").eq("provider", "google_calendar").eq("status", "active");

  if (onlyWorkspaceId) {
    query = query.eq("workspace_id", onlyWorkspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`[google-sync:connected] ${error.message}`);
  }

  return ((data ?? []) as Array<{ workspace_id: string }>).map((row) => row.workspace_id);
}

/**
 * Ocupado de Google para `getAgendaFreeSlots`. Solo cuenta en `push_and_busy`
 * (lo comprueba la agenda) y con la empresa conectada. Si Google no contesta,
 * se ofrece igual: perder un cliente por un corte de Google es peor que un
 * hueco que choca con algo personal.
 */
export function googleBusyProvider(client: CrmClient, workspaceId: string, deps: GoogleDeps = {}): ExternalBusyProvider {
  return async (agenda, from, to) => {
    if (!agenda.google_calendar_id || !getGoogleOAuthConfig(deps.env)) {
      return [];
    }

    try {
      if ((await connectedWorkspaces(client, workspaceId)).length === 0) {
        return [];
      }
      return await freeBusy(client, workspaceId, [agenda.google_calendar_id], from, to, deps);
    } catch (error) {
      console.warn("[google-sync:busy]", error instanceof Error ? error.message : error);
      return [];
    }
  };
}

async function clearPending(client: CrmClient, row: SyncRow, googleEventId: string | null) {
  const { data, error } = await client
    .from("appointments")
    .update({ google_event_id: googleEventId, google_sync_pending: false })
    .eq("workspace_id", row.workspace_id)
    .eq("id", row.id)
    .eq("updated_at", row.updated_at)
    .select("id");

  if (error) {
    throw new Error(`[google-sync:clear] ${error.message}`);
  }

  return Boolean(data?.length);
}

async function queueDeletion(client: CrmClient, workspaceId: string, calendarId: string, eventId: string) {
  const { error } = await client
    .from("google_event_deletions")
    .upsert(
      { attempts: 0, calendar_id: calendarId, google_event_id: eventId, workspace_id: workspaceId },
      { onConflict: "workspace_id,calendar_id,google_event_id" },
    );

  if (error) {
    throw new Error(`[google-sync:queue] ${error.message}`);
  }
}

function eventSummary(service: string, contactName: string | null) {
  const what = service.trim() || "Cita";
  return contactName ? `${what} · ${contactName}` : what;
}

/**
 * Pone al día la copia de una cita. Lanza `GoogleCalendarError` si Google no
 * está disponible (la marca se queda para la barrida).
 */
export async function syncAppointment(
  client: CrmClient,
  workspaceId: string,
  appointmentId: string,
  deps: GoogleDeps = {},
): Promise<SyncOutcome> {
  const { data, error } = await client
    .from("appointments")
    .select("id, workspace_id, agenda_id, contact_id, service, starts_at, ends_at, status, google_event_id, google_sync_pending, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`[google-sync:read] ${error.message}`);
  }

  const row = data as SyncRow | null;

  if (!row) {
    return "missing";
  }
  if (!row.google_sync_pending) {
    return "nothing_to_do";
  }

  const { data: agendaData, error: agendaError } = await client
    .from("agendas")
    .select("google_calendar_id, google_sync_mode, timezone")
    .eq("workspace_id", workspaceId)
    .eq("id", row.agenda_id)
    .maybeSingle();

  if (agendaError) {
    throw new Error(`[google-sync:agenda] ${agendaError.message}`);
  }

  const agenda = agendaData as AgendaSync | null;
  const calendarId = agenda?.google_calendar_id ?? null;
  const active = ACTIVE_STATUSES.includes(row.status);

  if (active && (!calendarId || agenda?.google_sync_mode === "off")) {
    // La agenda no copia a Google: no hay nada pendiente.
    return (await clearPending(client, row, row.google_event_id)) ? "nothing_to_do" : "changed_meanwhile";
  }

  if (!active) {
    // Cancelada: se borra su copia. Completada o no asistió: se deja (pasó).
    if (row.status === "cancelled" && row.google_event_id && calendarId) {
      await deleteEvent(client, workspaceId, calendarId, row.google_event_id, deps);
      return (await clearPending(client, row, null)) ? "deleted" : "changed_meanwhile";
    }
    return (await clearPending(client, row, row.google_event_id)) ? "nothing_to_do" : "changed_meanwhile";
  }

  const { data: contact } = await client
    .from("contacts")
    .select("full_name, phone_e164")
    .eq("workspace_id", workspaceId)
    .eq("id", row.contact_id)
    .maybeSingle();
  const contactRow = contact as { full_name: string | null; phone_e164: string } | null;
  const { eventId, result } = await upsertEvent(
    client,
    workspaceId,
    calendarId!,
    row.id,
    {
      description: [
        contactRow?.phone_e164 ? `Teléfono: ${contactRow.phone_e164}` : null,
        "Cita de la agenda de Levy. Se gestiona desde Levy: lo que se cambie aquí no vuelve allí.",
      ]
        .filter(Boolean)
        .join("\n"),
      end: new Date(row.ends_at),
      start: new Date(row.starts_at),
      summary: eventSummary(row.service, contactRow?.full_name ?? null),
      timeZone: agenda?.timezone ?? "UTC",
    },
    deps,
  );

  if (await clearPending(client, row, eventId)) {
    return result;
  }

  // La cita cambió mientras se copiaba. Si además ya no existe (se borró con
  // su contacto), el evento recién escrito no tiene dueño: se apunta para borrar.
  const { data: still } = await client
    .from("appointments")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", row.id)
    .maybeSingle();

  if (!still) {
    await queueDeletion(client, workspaceId, calendarId!, eventId);
    return "deleted_meanwhile";
  }

  return "changed_meanwhile";
}

export type SweepResult = { deletionsDone: number; deletionsFailed: number; failed: number; synced: number };

/**
 * Barrida de crm-jobs: por cada empresa conectada, primero borra en Google lo
 * apuntado y luego copia las citas pendientes. Un fallo de Google corta esa
 * empresa (el resto tampoco entraría) pero no las demás.
 */
export async function sweepGoogleSync(client: CrmClient, deps: GoogleDeps = {}, batch = SWEEP_BATCH): Promise<SweepResult> {
  const result: SweepResult = { deletionsDone: 0, deletionsFailed: 0, failed: 0, synced: 0 };

  if (!getGoogleOAuthConfig(deps.env)) {
    return result;
  }

  for (const workspaceId of await connectedWorkspaces(client)) {
    const deletions = await processGoogleDeletions(client, workspaceId, deps, batch);
    result.deletionsDone += deletions.done;
    result.deletionsFailed += deletions.failed;

    if (deletions.stopped) {
      continue;
    }

    const { data, error } = await client
      .from("appointments")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("google_sync_pending", true)
      .order("updated_at", { ascending: true })
      .limit(batch);

    if (error) {
      throw new Error(`[google-sync:sweep] ${error.message}`);
    }

    for (const { id } of (data ?? []) as Array<{ id: string }>) {
      try {
        await syncAppointment(client, workspaceId, id, deps);
        result.synced += 1;
      } catch (syncError) {
        result.failed += 1;
        if (syncError instanceof GoogleCalendarError) {
          console.warn("[google-sync:sweep-stopped]", workspaceId, syncError.code);
          break;
        }
        console.error("[google-sync:sweep-error]", workspaceId, id, syncError);
      }
    }
  }

  return result;
}

/** Borra en Google lo apuntado en `google_event_deletions` de una empresa. */
export async function processGoogleDeletions(client: CrmClient, workspaceId: string, deps: GoogleDeps = {}, batch = SWEEP_BATCH) {
  const outcome = { done: 0, failed: 0, stopped: false };
  const { data, error } = await client
    .from("google_event_deletions")
    .select("id, calendar_id, google_event_id, attempts")
    .eq("workspace_id", workspaceId)
    .lt("attempts", MAX_DELETION_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(batch);

  if (error) {
    throw new Error(`[google-sync:deletions] ${error.message}`);
  }

  for (const row of (data ?? []) as Array<{ attempts: number; calendar_id: string; google_event_id: string; id: string }>) {
    try {
      await deleteEvent(client, workspaceId, row.calendar_id, row.google_event_id, deps);
      await client.from("google_event_deletions").delete().eq("workspace_id", workspaceId).eq("id", row.id);
      outcome.done += 1;
    } catch (deleteError) {
      outcome.failed += 1;
      await client
        .from("google_event_deletions")
        .update({
          attempts: row.attempts + 1,
          last_error: (deleteError instanceof Error ? deleteError.message : String(deleteError)).slice(0, 500),
        })
        .eq("workspace_id", workspaceId)
        .eq("id", row.id);

      if (deleteError instanceof GoogleCalendarError && deleteError.code !== "api_error") {
        outcome.stopped = true;
        break;
      }
    }
  }

  return outcome;
}

