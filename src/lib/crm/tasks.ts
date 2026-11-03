import { logActivity } from "./activity.ts";
import { dbFailure, invalid, notFound } from "./errors.ts";
import { optionalText } from "./normalize.ts";
import { assertContactInWorkspace, type CrmActor, type CrmClient } from "./shared.ts";

export type CrmTask = {
  assigned_to: string | null;
  completed_at: string | null;
  contact_id: string;
  created_at: string;
  created_by: "agent" | "flow" | "operator";
  detail: string | null;
  due_at: string | null;
  id: string;
  title: string;
};

const TASK_COLUMNS = "id, contact_id, title, detail, due_at, completed_at, created_by, assigned_to, created_at";

function normalizeTitle(value: unknown) {
  const title = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

  if (!title || title.length > 200) {
    throw invalid("El título de la tarea tiene que tener entre 1 y 200 caracteres.");
  }

  return title;
}

function normalizeDueAt(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw invalid("La fecha de la tarea no es válida.");
  }

  return date.toISOString();
}

function createdByFor(actor: CrmActor): CrmTask["created_by"] {
  return actor.kind === "agent" || actor.kind === "flow" ? actor.kind : "operator";
}

/** El responsable tiene que ser miembro de la empresa. */
async function assertMember(client: CrmClient, workspaceId: string, userId: string) {
  const { data, error } = await client
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw dbFailure("assertMember", error);
  }
  if (!data) {
    throw invalid("Esa persona no es del equipo de esta empresa.");
  }
}

export async function createTask(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  input: { assignedTo?: string | null; detail?: unknown; dueAt?: unknown; title: unknown },
  actor: CrmActor,
) {
  const title = normalizeTitle(input.title);
  const dueAt = normalizeDueAt(input.dueAt);
  await assertContactInWorkspace(client, workspaceId, contactId);

  if (input.assignedTo) {
    await assertMember(client, workspaceId, input.assignedTo);
  }

  const { data, error } = await client
    .from("crm_contact_tasks")
    .insert({
      assigned_to: input.assignedTo ?? null,
      contact_id: contactId,
      created_by: createdByFor(actor),
      detail: optionalText(input.detail, 5000),
      due_at: dueAt,
      title,
      workspace_id: workspaceId,
    })
    .select(TASK_COLUMNS)
    .single();

  if (error || !data) {
    throw dbFailure("createTask", error ?? { message: "sin fila" });
  }

  const task = data as CrmTask;
  await logActivity(client, workspaceId, contactId, "task_created", { task_id: task.id, title }, actor);

  return task;
}

export async function updateTask(
  client: CrmClient,
  workspaceId: string,
  taskId: string,
  patch: { assignedTo?: string | null; detail?: unknown; dueAt?: unknown; title?: unknown },
) {
  const changes: Record<string, string | null> = {};

  if (patch.title !== undefined) {
    changes.title = normalizeTitle(patch.title);
  }
  if (patch.detail !== undefined) {
    changes.detail = optionalText(patch.detail, 5000);
  }
  if (patch.dueAt !== undefined) {
    changes.due_at = normalizeDueAt(patch.dueAt);
  }
  if (patch.assignedTo !== undefined) {
    if (patch.assignedTo) {
      await assertMember(client, workspaceId, patch.assignedTo);
    }
    changes.assigned_to = patch.assignedTo;
  }

  const { data, error } = await client
    .from("crm_contact_tasks")
    .update(changes)
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .select(TASK_COLUMNS)
    .maybeSingle();

  if (error) {
    throw dbFailure("updateTask", error);
  }
  if (!data) {
    throw notFound("Esa tarea no existe en esta empresa.");
  }

  return data as CrmTask;
}

export async function setTaskCompleted(
  client: CrmClient,
  workspaceId: string,
  taskId: string,
  completed: boolean,
  actor: CrmActor,
) {
  const { data, error } = await client
    .from("crm_contact_tasks")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .select(TASK_COLUMNS)
    .maybeSingle();

  if (error) {
    throw dbFailure("setTaskCompleted", error);
  }
  if (!data) {
    throw notFound("Esa tarea no existe en esta empresa.");
  }

  const task = data as CrmTask;

  if (completed) {
    await logActivity(client, workspaceId, task.contact_id, "task_completed", { task_id: task.id, title: task.title }, actor);
  }

  return task;
}

export async function deleteTask(client: CrmClient, workspaceId: string, taskId: string) {
  const { data, error } = await client
    .from("crm_contact_tasks")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .select("id");

  if (error) {
    throw dbFailure("deleteTask", error);
  }
  if (!data?.length) {
    throw notFound("Esa tarea no existe en esta empresa.");
  }
}

export async function listTasks(
  client: CrmClient,
  workspaceId: string,
  { contactId, limit = 100, openOnly = false }: { contactId?: string; limit?: number; openOnly?: boolean } = {},
) {
  let query = client
    .from("crm_contact_tasks")
    .select(TASK_COLUMNS)
    .eq("workspace_id", workspaceId);

  if (contactId) {
    query = query.eq("contact_id", contactId);
  }
  if (openOnly) {
    query = query.is("completed_at", null);
  }

  const { data, error } = await query.order("due_at", { ascending: true }).limit(limit);

  if (error) {
    throw dbFailure("listTasks", error);
  }

  return (data ?? []) as CrmTask[];
}
