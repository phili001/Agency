import { logActivity } from "./activity.ts";
import { conflict, dbFailure, invalid, isUniqueViolation, notFound } from "./errors.ts";
import { normalizeColor } from "./normalize.ts";
import { assertContactInWorkspace, type CrmActor, type CrmClient } from "./shared.ts";

/**
 * Etapas del embudo. Se siembran 6 por empresa en la base (trigger de
 * `crm_core`). Un contacto con `stage_id` null está en la primera etapa
 * abierta: los contactos que ya existían no se reescribieron.
 */
export type StageKind = "lost" | "open" | "won";

export type CrmStage = {
  color: string;
  id: string;
  kind: StageKind;
  name: string;
  position: number;
};

const STAGE_KINDS: StageKind[] = ["open", "won", "lost"];

function normalizeStageName(value: unknown) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

  if (!name || name.length > 60) {
    throw invalid("El nombre de la etapa tiene que tener entre 1 y 60 caracteres.");
  }

  return name;
}

function normalizeKind(value: unknown): StageKind {
  if (value === undefined) {
    return "open";
  }
  if (!STAGE_KINDS.includes(value as StageKind)) {
    throw invalid("Tipo de etapa no válido.");
  }
  return value as StageKind;
}

/** Etapa efectiva: la guardada o, si no hay, la primera abierta. */
export function resolveStage(stages: CrmStage[], stageId: string | null | undefined) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);

  return (
    (stageId ? ordered.find((stage) => stage.id === stageId) : undefined) ??
    ordered.find((stage) => stage.kind === "open") ??
    ordered[0] ??
    null
  );
}

/** La etapa a la que van los contactos sin etapa (null). */
export function defaultStage(stages: CrmStage[]) {
  return resolveStage(stages, null);
}

export async function listStages(client: CrmClient, workspaceId: string) {
  const { data, error } = await client
    .from("crm_pipeline_stages")
    .select("id, name, position, color, kind")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });

  if (error) {
    throw dbFailure("listStages", error);
  }

  return (data ?? []) as CrmStage[];
}

export async function createStage(
  client: CrmClient,
  workspaceId: string,
  input: { color?: unknown; kind?: unknown; name: unknown },
) {
  const stages = await listStages(client, workspaceId);
  const { data, error } = await client
    .from("crm_pipeline_stages")
    .insert({
      color: normalizeColor(input.color),
      kind: normalizeKind(input.kind),
      name: normalizeStageName(input.name),
      position: stages.reduce((max, stage) => Math.max(max, stage.position + 1), 0),
      workspace_id: workspaceId,
    })
    .select("id, name, position, color, kind")
    .single();

  if (isUniqueViolation(error)) {
    throw conflict("Ya existe una etapa con ese nombre.");
  }
  if (error || !data) {
    throw dbFailure("createStage", error ?? { message: "sin fila" });
  }

  return data as CrmStage;
}

export async function updateStage(
  client: CrmClient,
  workspaceId: string,
  stageId: string,
  patch: { color?: unknown; kind?: unknown; name?: unknown },
) {
  const stages = await listStages(client, workspaceId);
  const current = stages.find((stage) => stage.id === stageId);

  if (!current) {
    throw notFound("Esa etapa no existe en esta empresa.");
  }

  const kind = patch.kind === undefined ? current.kind : normalizeKind(patch.kind);

  if (current.kind === "open" && kind !== "open" && !stages.some((s) => s.id !== stageId && s.kind === "open")) {
    throw invalid("Tiene que quedar al menos una etapa abierta.");
  }

  const { data, error } = await client
    .from("crm_pipeline_stages")
    .update({
      color: patch.color === undefined ? current.color : normalizeColor(patch.color),
      kind,
      name: patch.name === undefined ? current.name : normalizeStageName(patch.name),
    })
    .eq("workspace_id", workspaceId)
    .eq("id", stageId)
    .select("id, name, position, color, kind")
    .single();

  if (isUniqueViolation(error)) {
    throw conflict("Ya existe una etapa con ese nombre.");
  }
  if (error || !data) {
    throw dbFailure("updateStage", error ?? { message: "sin fila" });
  }

  return data as CrmStage;
}

export async function reorderStages(client: CrmClient, workspaceId: string, orderedIds: string[]) {
  const stages = await listStages(client, workspaceId);
  const known = new Set(stages.map((stage) => stage.id));

  if (orderedIds.length !== known.size || new Set(orderedIds).size !== known.size || orderedIds.some((id) => !known.has(id))) {
    throw invalid("El orden tiene que incluir todas las etapas de la empresa.");
  }

  for (const [position, id] of orderedIds.entries()) {
    const { error } = await client
      .from("crm_pipeline_stages")
      .update({ position })
      .eq("workspace_id", workspaceId)
      .eq("id", id);

    if (error) {
      throw dbFailure("reorderStages", error);
    }
  }
}

/** Borra una etapa; sus contactos pasan a «sin etapa» (= primera abierta). */
export async function deleteStage(client: CrmClient, workspaceId: string, stageId: string) {
  const stages = await listStages(client, workspaceId);
  const current = stages.find((stage) => stage.id === stageId);

  if (!current) {
    throw notFound("Esa etapa no existe en esta empresa.");
  }
  if (current.kind === "open" && !stages.some((stage) => stage.id !== stageId && stage.kind === "open")) {
    throw invalid("Tiene que quedar al menos una etapa abierta.");
  }

  const { error } = await client
    .from("crm_pipeline_stages")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", stageId);

  if (error) {
    throw dbFailure("deleteStage", error);
  }
}

export async function setContactStage(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  stageId: string,
  actor: CrmActor,
) {
  await assertContactInWorkspace(client, workspaceId, contactId);
  const stages = await listStages(client, workspaceId);
  const target = stages.find((stage) => stage.id === stageId);

  if (!target) {
    throw notFound("Esa etapa no existe en esta empresa.");
  }

  const { data: before, error: readError } = await client
    .from("contacts")
    .select("stage_id")
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .single();

  if (readError) {
    throw dbFailure("setContactStage.read", readError);
  }

  const storedStageId = (before as { stage_id: string | null }).stage_id;
  const previous = resolveStage(stages, storedStageId);

  if (storedStageId === target.id) {
    return { changed: false, stage: target };
  }

  const { error } = await client
    .from("contacts")
    .update({ stage_id: target.id })
    .eq("workspace_id", workspaceId)
    .eq("id", contactId);

  if (error) {
    throw dbFailure("setContactStage", error);
  }

  await logActivity(
    client,
    workspaceId,
    contactId,
    "stage_changed",
    { from: previous?.name ?? null, from_id: previous?.id ?? null, to: target.name, to_id: target.id },
    actor,
  );

  return { changed: true, stage: target };
}

/** Etapa por nombre (sin mayúsculas), para flujos y Stripe («Cliente», «Perdido»). */
export async function findStageByName(client: CrmClient, workspaceId: string, name: string) {
  const stages = await listStages(client, workspaceId);
  const wanted = name.trim().toLowerCase();

  return stages.find((stage) => stage.name.toLowerCase() === wanted) ?? null;
}
