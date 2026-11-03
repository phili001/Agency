import type { Json } from "@/lib/supabase/database.types";

import { dbFailure } from "./errors.ts";
import type { CrmActor, CrmClient } from "./shared.ts";

/**
 * Registro de lo que le pasa a un contacto (cambio de etapa, etiquetas, notas,
 * citas…). Es un histórico: no se edita. Las citas lo escriben desde SQL
 * (`book_appointment`/`reschedule_appointment`) en su misma transacción.
 */
export type ActivityKind =
  | "appointment_booked"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "contact_created"
  | "contact_updated"
  | "message_received"
  | "note_added"
  | "stage_changed"
  | "tag_added"
  | "tag_removed"
  | "task_completed"
  | "task_created";

export type ActivityEntry = {
  actor: string;
  actor_user_id: string | null;
  created_at: string;
  data: Json;
  id: string;
  kind: string;
};

export async function logActivity(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  kind: ActivityKind,
  data: Record<string, Json | undefined>,
  actor: CrmActor,
) {
  const { error } = await client.from("crm_contact_activity").insert({
    actor: actor.kind,
    actor_user_id: actor.userId ?? null,
    contact_id: contactId,
    data,
    kind,
    workspace_id: workspaceId,
  });

  if (error) {
    throw dbFailure("logActivity", error);
  }
}

export async function listActivity(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  limit = 50,
) {
  const { data, error } = await client
    .from("crm_contact_activity")
    .select("id, kind, data, actor, actor_user_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw dbFailure("listActivity", error);
  }

  return (data ?? []) as ActivityEntry[];
}
