import { logActivity } from "./activity.ts";
import { dbFailure, invalid, notFound } from "./errors.ts";
import { assertContactInWorkspace, type CrmActor, type CrmClient } from "./shared.ts";

export type CrmNote = {
  author_id: string | null;
  body: string;
  created_at: string;
  id: string;
  updated_at: string;
};

const NOTE_COLUMNS = "id, body, author_id, created_at, updated_at";

function normalizeBody(value: unknown) {
  const body = typeof value === "string" ? value.trim() : "";

  if (!body || body.length > 10000) {
    throw invalid("La nota tiene que tener entre 1 y 10.000 caracteres.");
  }

  return body;
}

export async function addNote(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  body: unknown,
  actor: CrmActor,
) {
  const text = normalizeBody(body);
  await assertContactInWorkspace(client, workspaceId, contactId);
  const { data, error } = await client
    .from("crm_contact_notes")
    .insert({
      author_id: actor.userId ?? null,
      body: text,
      contact_id: contactId,
      workspace_id: workspaceId,
    })
    .select(NOTE_COLUMNS)
    .single();

  if (error || !data) {
    throw dbFailure("addNote", error ?? { message: "sin fila" });
  }

  await logActivity(client, workspaceId, contactId, "note_added", { note_id: (data as CrmNote).id }, actor);

  return data as CrmNote;
}

export async function listNotes(client: CrmClient, workspaceId: string, contactId: string, limit = 50) {
  const { data, error } = await client
    .from("crm_contact_notes")
    .select(NOTE_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw dbFailure("listNotes", error);
  }

  return (data ?? []) as CrmNote[];
}

export async function updateNote(client: CrmClient, workspaceId: string, noteId: string, body: unknown) {
  const { data, error } = await client
    .from("crm_contact_notes")
    .update({ body: normalizeBody(body) })
    .eq("workspace_id", workspaceId)
    .eq("id", noteId)
    .select(NOTE_COLUMNS)
    .maybeSingle();

  if (error) {
    throw dbFailure("updateNote", error);
  }
  if (!data) {
    throw notFound("Esa nota no existe en esta empresa.");
  }

  return data as CrmNote;
}

export async function deleteNote(client: CrmClient, workspaceId: string, noteId: string) {
  const { data, error } = await client
    .from("crm_contact_notes")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", noteId)
    .select("id");

  if (error) {
    throw dbFailure("deleteNote", error);
  }
  if (!data?.length) {
    throw notFound("Esa nota no existe en esta empresa.");
  }
}
