import { listActivity, logActivity } from "./activity.ts";
import { listCustomFields, mergeCustomFieldValues } from "./custom-fields.ts";
import { conflict, dbFailure, invalid, isUniqueViolation, notFound } from "./errors.ts";
import { normalizeEmail, normalizePhoneE164, optionalText, sanitizeSearchTerm } from "./normalize.ts";
import { listNotes } from "./notes.ts";
import { assertContactInWorkspace, type CrmActor, type CrmClient } from "./shared.ts";
import { defaultStage, listStages, resolveStage } from "./stages.ts";
import { listContactTags } from "./tags.ts";
import { listTasks } from "./tasks.ts";

export type ContactSource = "import" | "manual" | "stripe" | "whatsapp";

export const CONTACT_SOURCES: ContactSource[] = ["whatsapp", "manual", "import", "stripe"];

export type CrmContact = {
  company: string | null;
  created_at: string;
  custom_fields: Record<string, unknown>;
  email: string | null;
  full_name: string | null;
  id: string;
  last_message_at: string | null;
  phone_e164: string;
  source: ContactSource | null;
  stage_id: string | null;
  updated_at: string;
};

const CONTACT_COLUMNS =
  "id, full_name, phone_e164, email, company, source, stage_id, custom_fields, last_message_at, created_at, updated_at";

function requirePhone(value: unknown) {
  const phone = normalizePhoneE164(typeof value === "string" ? value : null);

  if (!phone) {
    throw invalid("El teléfono tiene que llevar el prefijo de país (por ejemplo, +34 600 000 000).");
  }

  return phone;
}

function optionalEmail(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const email = normalizeEmail(String(value));

  if (!email) {
    throw invalid("El correo no es válido.");
  }

  return email;
}

function normalizeSource(value: unknown): ContactSource {
  return CONTACT_SOURCES.includes(value as ContactSource) ? (value as ContactSource) : "manual";
}

export type CreateContactInput = {
  company?: unknown;
  customFields?: Record<string, unknown>;
  email?: unknown;
  fullName?: unknown;
  phone: unknown;
  source?: unknown;
  stageId?: string | null;
};

/** Alta desde el panel o la importación. Teléfono repetido → 409. */
export async function createContact(
  client: CrmClient,
  workspaceId: string,
  input: CreateContactInput,
  actor: CrmActor,
) {
  const phone = requirePhone(input.phone);
  const definitions = input.customFields ? await listCustomFields(client, workspaceId) : [];
  const customFields = input.customFields ? mergeCustomFieldValues(definitions, {}, input.customFields) : {};

  if (input.stageId) {
    const stages = await listStages(client, workspaceId);
    if (!stages.some((stage) => stage.id === input.stageId)) {
      throw notFound("Esa etapa no existe en esta empresa.");
    }
  }

  const { data, error } = await client
    .from("contacts")
    .insert({
      company: optionalText(input.company, 160),
      custom_fields: customFields,
      email: optionalEmail(input.email),
      full_name: optionalText(input.fullName, 160),
      phone_e164: phone,
      source: normalizeSource(input.source),
      stage_id: input.stageId ?? null,
      workspace_id: workspaceId,
    })
    .select(CONTACT_COLUMNS)
    .single();

  if (isUniqueViolation(error)) {
    throw conflict("Ya hay un contacto con ese teléfono.");
  }
  if (error || !data) {
    throw dbFailure("createContact", error ?? { message: "sin fila" });
  }

  const contact = data as CrmContact;
  await logActivity(client, workspaceId, contact.id, "contact_created", { source: contact.source }, actor);

  return contact;
}

/**
 * Busca por teléfono y, si no existe, lo crea. Para entradas automáticas
 * (Stripe, reunión de onboarding): no pisa nombre, correo ni empresa que ya
 * tuviera el contacto, solo rellena los que estén vacíos.
 */
export async function upsertContactByPhone(
  client: CrmClient,
  workspaceId: string,
  input: { company?: unknown; email?: unknown; fullName?: unknown; phone: unknown; source: ContactSource },
  actor: CrmActor,
) {
  const phone = requirePhone(input.phone);
  const { data: existing, error } = await client
    .from("contacts")
    .select(CONTACT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("phone_e164", phone)
    .maybeSingle();

  if (error) {
    throw dbFailure("upsertContactByPhone.read", error);
  }

  if (!existing) {
    try {
      return { contact: await createContact(client, workspaceId, { ...input, phone }, actor), created: true };
    } catch (createError) {
      // Otro proceso lo creó a la vez: se sigue con el que ya existe.
      if (!(createError instanceof Error && "code" in createError && createError.code === "conflict")) {
        throw createError;
      }
      return upsertContactByPhone(client, workspaceId, input, actor);
    }
  }

  const current = existing as CrmContact;
  const fill: Record<string, string> = {};
  const fullName = optionalText(input.fullName, 160);
  const company = optionalText(input.company, 160);
  const email = normalizeEmail(typeof input.email === "string" ? input.email : null);

  if (!current.full_name && fullName) fill.full_name = fullName;
  if (!current.company && company) fill.company = company;
  if (!current.email && email) fill.email = email;
  if (!current.source) fill.source = input.source;

  if (Object.keys(fill).length === 0) {
    return { contact: current, created: false };
  }

  const { data, error: updateError } = await client
    .from("contacts")
    .update(fill)
    .eq("workspace_id", workspaceId)
    .eq("id", current.id)
    .select(CONTACT_COLUMNS)
    .single();

  if (updateError || !data) {
    throw dbFailure("upsertContactByPhone.update", updateError ?? { message: "sin fila" });
  }

  return { contact: data as CrmContact, created: false };
}

export type UpdateContactInput = {
  company?: unknown;
  customFields?: Record<string, unknown>;
  email?: unknown;
  fullName?: unknown;
};

/** Edición desde la ficha. El teléfono no se cambia (identifica el chat). */
export async function updateContact(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  patch: UpdateContactInput,
  actor: CrmActor,
) {
  const { data: current, error: readError } = await client
    .from("contacts")
    .select("id, custom_fields")
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .maybeSingle();

  if (readError) {
    throw dbFailure("updateContact.read", readError);
  }
  if (!current) {
    throw notFound("Ese contacto no existe en esta empresa.");
  }

  const changes: Record<string, unknown> = {};

  if (patch.fullName !== undefined) changes.full_name = optionalText(patch.fullName, 160);
  if (patch.company !== undefined) changes.company = optionalText(patch.company, 160);
  if (patch.email !== undefined) changes.email = optionalEmail(patch.email);
  if (patch.customFields) {
    const definitions = await listCustomFields(client, workspaceId);
    changes.custom_fields = mergeCustomFieldValues(
      definitions,
      (current as { custom_fields: unknown }).custom_fields,
      patch.customFields,
    );
  }

  if (Object.keys(changes).length === 0) {
    throw invalid("No hay nada que cambiar.");
  }

  const { data, error } = await client
    .from("contacts")
    .update(changes)
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .select(CONTACT_COLUMNS)
    .single();

  if (error || !data) {
    throw dbFailure("updateContact", error ?? { message: "sin fila" });
  }

  await logActivity(client, workspaceId, contactId, "contact_updated", { fields: Object.keys(changes) }, actor);

  return data as CrmContact;
}

/** Mensaje entrante: actualiza `last_message_at` y fija `source` si faltaba. */
export async function touchContactInbound(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  at: Date,
) {
  const { error } = await client
    .from("contacts")
    .update({ last_message_at: at.toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", contactId);

  if (error) {
    throw dbFailure("touchContactInbound", error);
  }

  const { error: sourceError } = await client
    .from("contacts")
    .update({ source: "whatsapp" })
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .is("source", null);

  if (sourceError) {
    throw dbFailure("touchContactInbound.source", sourceError);
  }
}

export type ContactSearch = {
  page?: number;
  pageSize?: number;
  query?: string | null;
  source?: string | null;
  stageId?: string | null;
  tagId?: string | null;
};

/** Lista paginada con búsqueda y filtros por etapa, etiqueta y origen. */
export async function searchContacts(client: CrmClient, workspaceId: string, search: ContactSearch = {}) {
  const pageSize = Math.min(Math.max(Math.trunc(search.pageSize ?? 25), 1), 100);
  const page = Math.max(Math.trunc(search.page ?? 1), 1);
  const stages = await listStages(client, workspaceId);
  let query = client
    .from("contacts")
    .select(CONTACT_COLUMNS, { count: "exact" })
    .eq("workspace_id", workspaceId);

  const term = sanitizeSearchTerm(search.query);
  if (term) {
    const like = `%${term}%`;
    query = query.or(`full_name.ilike.${like},phone_e164.ilike.${like},email.ilike.${like},company.ilike.${like}`);
  }

  if (search.stageId) {
    if (!stages.some((stage) => stage.id === search.stageId)) {
      throw notFound("Esa etapa no existe en esta empresa.");
    }
    // Los contactos sin etapa cuentan como de la primera abierta.
    query =
      defaultStage(stages)?.id === search.stageId
        ? query.or(`stage_id.eq.${search.stageId},stage_id.is.null`)
        : query.eq("stage_id", search.stageId);
  }

  if (search.source) {
    if (!CONTACT_SOURCES.includes(search.source as ContactSource)) {
      throw invalid("Origen no válido.");
    }
    query = query.eq("source", search.source);
  }

  if (search.tagId) {
    const { data: links, error } = await client
      .from("crm_contact_tags")
      .select("contact_id")
      .eq("workspace_id", workspaceId)
      .eq("tag_id", search.tagId);

    if (error) {
      throw dbFailure("searchContacts.tag", error);
    }

    const ids = (links ?? []).map((link) => (link as { contact_id: string }).contact_id);
    if (ids.length === 0) {
      return { contacts: [], page, pageSize, total: 0 };
    }
    query = query.in("id", ids);
  }

  const from = (page - 1) * pageSize;
  const { count, data, error } = await query
    .order("last_message_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) {
    throw dbFailure("searchContacts", error);
  }

  const contacts = (data ?? []) as CrmContact[];
  const tags = await listContactTags(client, workspaceId, contacts.map((contact) => contact.id));

  return {
    contacts: contacts.map((contact) => ({
      ...contact,
      stage: resolveStage(stages, contact.stage_id),
      tags: tags.get(contact.id) ?? [],
    })),
    page,
    pageSize,
    total: count ?? contacts.length,
  };
}

/** Todo lo de la ficha de un contacto. 404 si no es de la empresa. */
export async function getContactCard(client: CrmClient, workspaceId: string, contactId: string) {
  await assertContactInWorkspace(client, workspaceId, contactId);

  const [contactResult, stages, tags, fields, notes, tasks, activity, appointmentsResult, conversationResult] =
    await Promise.all([
      client.from("contacts").select(CONTACT_COLUMNS).eq("workspace_id", workspaceId).eq("id", contactId).single(),
      listStages(client, workspaceId),
      listContactTags(client, workspaceId, [contactId]),
      listCustomFields(client, workspaceId),
      listNotes(client, workspaceId, contactId),
      listTasks(client, workspaceId, { contactId }),
      listActivity(client, workspaceId, contactId),
      client
        .from("appointments")
        .select("id, agenda_id, service, starts_at, ends_at, status, created_by")
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contactId)
        .order("starts_at", { ascending: false })
        .limit(20),
      client
        .from("conversations")
        .select("id, status, last_message_at")
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1),
    ]);

  if (contactResult.error || !contactResult.data) {
    throw dbFailure("getContactCard", contactResult.error ?? { message: "sin fila" });
  }
  if (appointmentsResult.error) {
    throw dbFailure("getContactCard.appointments", appointmentsResult.error);
  }
  if (conversationResult.error) {
    throw dbFailure("getContactCard.conversation", conversationResult.error);
  }

  const contact = contactResult.data as CrmContact;

  return {
    activity,
    appointments: appointmentsResult.data ?? [],
    contact,
    conversationId: ((conversationResult.data ?? [])[0] as { id: string } | undefined)?.id ?? null,
    customFields: fields,
    notes,
    stage: resolveStage(stages, contact.stage_id),
    stages,
    tags: tags.get(contactId) ?? [],
    tasks,
  };
}
