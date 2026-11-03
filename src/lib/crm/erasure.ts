import { dbFailure } from "./errors.ts";
import { assertContactInWorkspace, type CrmClient } from "./shared.ts";

/**
 * Borrado completo de un contacto (RGPD art. 17), de crm-levy
 * `data_erasure.erase_contact`. La cascada de la base se lleva conversaciones,
 * mensajes de esas conversaciones, etiquetas, notas, tareas, actividad, citas
 * y ejecuciones de flujos. Esto cubre lo que la cascada NO borra:
 *
 * - `messages.contact_id` y `flow_events.contact_id` son `on delete set null`:
 *   quedarían filas con texto personal sin dueño. Se borran antes.
 * - Las copias de sus citas en Google Calendar: la cita desaparece y su evento
 *   ya no tiene de qué colgar, así que se apunta en `google_event_deletions`
 *   para que crm-jobs (F4.2) lo borre allí con reintentos.
 *
 * No toca `webhook_events` (cuerpo crudo de YCloud, se purga por antigüedad) ni
 * los datos de otras empresas: todo filtra por `workspace_id`.
 */
export async function eraseContact(client: CrmClient, workspaceId: string, contactId: string) {
  await assertContactInWorkspace(client, workspaceId, contactId);

  const { data: appointments, error: appointmentsError } = await client
    .from("appointments")
    .select("id, agenda_id, google_event_id")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .not("google_event_id", "is", null);

  if (appointmentsError) {
    throw dbFailure("eraseContact.appointments", appointmentsError);
  }

  const withEvents = (appointments ?? []) as Array<{ agenda_id: string; google_event_id: string; id: string }>;
  let googleEventsQueued = 0;

  if (withEvents.length > 0) {
    const agendaIds = Array.from(new Set(withEvents.map((row) => row.agenda_id)));
    const { data: agendas, error: agendasError } = await client
      .from("agendas")
      .select("id, google_calendar_id")
      .eq("workspace_id", workspaceId)
      .in("id", agendaIds);

    if (agendasError) {
      throw dbFailure("eraseContact.agendas", agendasError);
    }

    const calendarByAgenda = new Map(
      ((agendas ?? []) as Array<{ google_calendar_id: string | null; id: string }>).map((row) => [row.id, row.google_calendar_id]),
    );
    const deletions = withEvents.flatMap((row) => {
      const calendarId = calendarByAgenda.get(row.agenda_id);
      return calendarId
        ? [{ attempts: 0, calendar_id: calendarId, google_event_id: row.google_event_id, workspace_id: workspaceId }]
        : [];
    });

    if (deletions.length > 0) {
      const { error } = await client
        .from("google_event_deletions")
        .upsert(deletions, { onConflict: "workspace_id,calendar_id,google_event_id" });

      if (error) {
        throw dbFailure("eraseContact.google", error);
      }
      googleEventsQueued = deletions.length;
    }
  }

  for (const table of ["flow_events", "messages"] as const) {
    const { error } = await client.from(table).delete().eq("workspace_id", workspaceId).eq("contact_id", contactId);

    if (error) {
      throw dbFailure(`eraseContact.${table}`, error);
    }
  }

  const { error } = await client.from("contacts").delete().eq("workspace_id", workspaceId).eq("id", contactId);

  if (error) {
    throw dbFailure("eraseContact", error);
  }

  return { googleEventsQueued };
}
