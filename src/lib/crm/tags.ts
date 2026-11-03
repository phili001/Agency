import { logActivity } from "./activity.ts";
import { conflict, dbFailure, invalid, isUniqueViolation, notFound } from "./errors.ts";
import { normalizeColor } from "./normalize.ts";
import { assertContactInWorkspace, type CrmActor, type CrmClient } from "./shared.ts";

/**
 * Etiquetas del CRM (decisión F1.1): las del operador, con color. No confundir
 * con `contacts.automation_labels`, que son marcas internas del sistema y cuyos
 * nombres están reservados (también lo impide un check en `crm_tags`).
 */
export const RESERVED_TAG_NAMES = [
  "flow_opt_out",
  "onboarding_completed",
  "onboarding_eligible",
  "onboarding_excluded_existing",
] as const;

export type CrmTag = { color: string; id: string; name: string };

export function normalizeTagName(value: unknown) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

  if (!name || name.length > 50) {
    throw invalid("El nombre de la etiqueta tiene que tener entre 1 y 50 caracteres.");
  }
  if ((RESERVED_TAG_NAMES as readonly string[]).includes(name.toLowerCase())) {
    throw invalid("Ese nombre está reservado por el sistema.");
  }

  return name;
}

/**
 * Lo que comparan las audiencias de los flujos (`requiredLabels`,
 * `excludedLabels`): marcas internas + nombres de etiquetas, sin mayúsculas.
 */
export function contactAudienceLabels(automationLabels: unknown, tagNames: string[]) {
  const labels = Array.isArray(automationLabels)
    ? automationLabels.filter((item): item is string => typeof item === "string")
    : [];

  return Array.from(new Set([...labels, ...tagNames].map((label) => label.trim().toLowerCase())));
}

export async function listTags(client: CrmClient, workspaceId: string) {
  const { data, error } = await client
    .from("crm_tags")
    .select("id, name, color")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) {
    throw dbFailure("listTags", error);
  }

  return (data ?? []) as CrmTag[];
}

export async function createTag(
  client: CrmClient,
  workspaceId: string,
  input: { color?: unknown; name: unknown },
) {
  const { data, error } = await client
    .from("crm_tags")
    .insert({
      color: normalizeColor(input.color),
      name: normalizeTagName(input.name),
      workspace_id: workspaceId,
    })
    .select("id, name, color")
    .single();

  if (isUniqueViolation(error)) {
    throw conflict("Ya existe una etiqueta con ese nombre.");
  }
  if (error || !data) {
    throw dbFailure("createTag", error ?? { message: "sin fila" });
  }

  return data as CrmTag;
}

export async function updateTag(
  client: CrmClient,
  workspaceId: string,
  tagId: string,
  patch: { color?: unknown; name?: unknown },
) {
  const changes: Record<string, string> = {};

  if (patch.name !== undefined) {
    changes.name = normalizeTagName(patch.name);
  }
  if (patch.color !== undefined) {
    changes.color = normalizeColor(patch.color);
  }

  const { data, error } = await client
    .from("crm_tags")
    .update(changes)
    .eq("workspace_id", workspaceId)
    .eq("id", tagId)
    .select("id, name, color")
    .maybeSingle();

  if (isUniqueViolation(error)) {
    throw conflict("Ya existe una etiqueta con ese nombre.");
  }
  if (error) {
    throw dbFailure("updateTag", error);
  }
  if (!data) {
    throw notFound("Esa etiqueta no existe en esta empresa.");
  }

  return data as CrmTag;
}

/** Borra la etiqueta y se la quita a todos sus contactos (cascada). */
export async function deleteTag(client: CrmClient, workspaceId: string, tagId: string) {
  const { data, error } = await client
    .from("crm_tags")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", tagId)
    .select("id");

  if (error) {
    throw dbFailure("deleteTag", error);
  }
  if (!data?.length) {
    throw notFound("Esa etiqueta no existe en esta empresa.");
  }
}

/**
 * Etiquetas existentes por nombre (sin mayúsculas). La usan el agente y los
 * flujos, que solo pueden poner etiquetas que ya existan.
 */
export async function findTagsByNames(client: CrmClient, workspaceId: string, names: string[]) {
  const wanted = new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean));

  if (wanted.size === 0) {
    return [];
  }

  const tags = await listTags(client, workspaceId);

  return tags.filter((tag) => wanted.has(tag.name.toLowerCase()));
}

async function assertTagInWorkspace(client: CrmClient, workspaceId: string, tagId: string) {
  const { data, error } = await client
    .from("crm_tags")
    .select("id, name, color")
    .eq("workspace_id", workspaceId)
    .eq("id", tagId)
    .maybeSingle();

  if (error) {
    throw dbFailure("assertTagInWorkspace", error);
  }
  if (!data) {
    throw notFound("Esa etiqueta no existe en esta empresa.");
  }

  return data as CrmTag;
}

/**
 * Pone una etiqueta. `added: false` si el contacto ya la tenía: quien dispare
 * flujos con trigger `tag` (F5.3) solo debe hacerlo cuando `added` es true.
 */
export async function addTagToContact(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  tagId: string,
  actor: CrmActor,
) {
  await assertContactInWorkspace(client, workspaceId, contactId);
  const tag = await assertTagInWorkspace(client, workspaceId, tagId);
  const { error } = await client.from("crm_contact_tags").insert({
    contact_id: contactId,
    tag_id: tagId,
    workspace_id: workspaceId,
  });

  if (isUniqueViolation(error)) {
    return { added: false, tag };
  }
  if (error) {
    throw dbFailure("addTagToContact", error);
  }

  await logActivity(client, workspaceId, contactId, "tag_added", { tag_id: tag.id, tag_name: tag.name }, actor);

  return { added: true, tag };
}

export async function removeTagFromContact(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  tagId: string,
  actor: CrmActor,
) {
  const { data, error } = await client
    .from("crm_contact_tags")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .eq("tag_id", tagId)
    .select("tag_id");

  if (error) {
    throw dbFailure("removeTagFromContact", error);
  }

  const removed = Boolean(data?.length);

  if (removed) {
    const tag = await assertTagInWorkspace(client, workspaceId, tagId);
    await logActivity(client, workspaceId, contactId, "tag_removed", { tag_id: tag.id, tag_name: tag.name }, actor);
  }

  return { removed };
}

export async function listContactTags(client: CrmClient, workspaceId: string, contactIds: string[]) {
  const result = new Map<string, CrmTag[]>();

  if (contactIds.length === 0) {
    return result;
  }

  const [{ data: links, error }, tags] = await Promise.all([
    client
      .from("crm_contact_tags")
      .select("contact_id, tag_id")
      .eq("workspace_id", workspaceId)
      .in("contact_id", contactIds),
    listTags(client, workspaceId),
  ]);

  if (error) {
    throw dbFailure("listContactTags", error);
  }

  const byId = new Map(tags.map((tag) => [tag.id, tag]));

  for (const link of (links ?? []) as Array<{ contact_id: string; tag_id: string }>) {
    const tag = byId.get(link.tag_id);
    if (tag) {
      result.set(link.contact_id, [...(result.get(link.contact_id) ?? []), tag]);
    }
  }

  return result;
}
