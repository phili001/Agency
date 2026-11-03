import { logActivity } from "./activity.ts";
import { type CrmContact, createContact } from "./contacts.ts";
import { parseCsvRecords, toCsv } from "./csv.ts";
import { type CustomFieldDefinition, listCustomFields, mergeCustomFieldValues } from "./custom-fields.ts";
import { CrmError, dbFailure, invalid } from "./errors.ts";
import { normalizeEmail, normalizePhoneE164, optionalText } from "./normalize.ts";
import type { CrmActor, CrmClient } from "./shared.ts";
import { listStages, resolveStage } from "./stages.ts";
import { type CrmTag, createTag, listContactTags, listTags, normalizeTagName } from "./tags.ts";

/**
 * Importar y exportar contactos en CSV (de crm-levy `api/contacts.py`).
 *
 * Columnas: nombre, telefono (obligatoria), email, empresa, origen, etapa,
 * etiquetas (separadas por `;`), creado, ultimo_mensaje y un `cf_<clave>` por
 * cada campo personalizado. Exportar → abrir en Excel → importar no duplica:
 * el teléfono se normaliza a E.164 y la protección anti-fórmulas se deshace.
 */

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 5000;
const MAX_ERROR_LINES = 50;
const PAGE = 1000;

const ALIASES: Record<string, string> = {
  company: "empresa",
  correo: "email",
  "e-mail": "email",
  etiqueta: "etiquetas",
  móvil: "telefono",
  movil: "telefono",
  name: "nombre",
  phone: "telefono",
  stage: "etapa",
  tags: "etiquetas",
  teléfono: "telefono",
  whatsapp: "telefono",
};

function canonical(record: Record<string, string>) {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(record)) {
    const name = ALIASES[key] ?? key;
    if (!(name in result) || !result[name]) {
      result[name] = value;
    }
  }

  return result;
}

export type ImportResult = {
  created: number;
  errors: string[];
  skipped: number;
  truncated: boolean;
  updated: number;
};

type ParsedRow = {
  company: string | null;
  customFields: Record<string, unknown>;
  email: string | null;
  fullName: string | null;
  line: number;
  phone: string;
  stage: string | null;
  tags: string[];
};

function parseRows(text: string, definitions: CustomFieldDefinition[], result: ImportResult) {
  const { columns, records } = parseCsvRecords(text);
  const canonicalColumns = columns.map((column) => ALIASES[column] ?? column);

  if (!canonicalColumns.includes("telefono")) {
    throw invalid("El CSV necesita una columna «telefono». Exporta primero para ver el formato.");
  }

  const fieldKeys = new Set(definitions.map((definition) => definition.key));
  const rows: ParsedRow[] = [];
  const addError = (message: string) => {
    if (result.errors.length < MAX_ERROR_LINES) {
      result.errors.push(message);
    }
  };

  for (const [index, raw] of records.entries()) {
    const line = index + 2; // la fila 1 es la cabecera

    if (rows.length + result.skipped >= IMPORT_MAX_ROWS) {
      result.truncated = true;
      addError(`Cortado en ${IMPORT_MAX_ROWS} filas; el resto no se importó.`);
      break;
    }

    const record = canonical(raw);
    const phone = normalizePhoneE164(record.telefono);

    if (!phone) {
      result.skipped += 1;
      addError(record.telefono ? `Fila ${line}: teléfono no válido (${record.telefono.slice(0, 40)}).` : `Fila ${line}: sin teléfono.`);
      continue;
    }

    const email = record.email ? normalizeEmail(record.email) : null;

    if (record.email && !email) {
      result.skipped += 1;
      addError(`Fila ${line}: correo no válido (${record.email.slice(0, 60)}).`);
      continue;
    }

    const customFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (key.startsWith("cf_") && fieldKeys.has(key.slice(3)) && value !== "") {
        customFields[key.slice(3)] = value;
      }
    }

    rows.push({
      company: optionalText(record.empresa, 160),
      customFields,
      email,
      fullName: optionalText(record.nombre, 160),
      line,
      phone,
      stage: optionalText(record.etapa, 60),
      tags: (record.etiquetas ?? "")
        .split(/[;|]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  }

  return rows;
}

async function contactsByPhone(client: CrmClient, workspaceId: string, phones: string[]) {
  const found = new Map<string, { custom_fields: unknown; id: string }>();

  for (let i = 0; i < phones.length; i += 500) {
    const { data, error } = await client
      .from("contacts")
      .select("id, phone_e164, custom_fields")
      .eq("workspace_id", workspaceId)
      .in("phone_e164", phones.slice(i, i + 500));

    if (error) {
      throw dbFailure("importContacts.lookup", error);
    }

    for (const row of (data ?? []) as Array<{ custom_fields: unknown; id: string; phone_e164: string }>) {
      found.set(row.phone_e164, row);
    }
  }

  return found;
}

/**
 * Importa un CSV. Contacto nuevo → se crea con origen `import`; existente (mismo
 * teléfono) → se actualizan los datos que traiga la fila (lo vacío no borra
 * nada). Las etiquetas que no existan se crean; la etapa se busca por nombre.
 */
export async function importContacts(client: CrmClient, workspaceId: string, text: string, actor: CrmActor) {
  if (new TextEncoder().encode(text).length > IMPORT_MAX_BYTES) {
    throw invalid(`El archivo supera el máximo permitido (${IMPORT_MAX_BYTES / (1024 * 1024)} MB).`);
  }

  const result: ImportResult = { created: 0, errors: [], skipped: 0, truncated: false, updated: 0 };
  const [definitions, stages, existingTags] = await Promise.all([
    listCustomFields(client, workspaceId),
    listStages(client, workspaceId),
    listTags(client, workspaceId),
  ]);
  const rows = parseRows(text, definitions, result);
  const existing = await contactsByPhone(client, workspaceId, Array.from(new Set(rows.map((row) => row.phone))));
  const tagsByName = new Map(existingTags.map((tag) => [tag.name.toLowerCase(), tag]));
  const seen = new Set<string>();

  const tagFor = async (name: string): Promise<CrmTag | null> => {
    const clean = normalizeTagName(name);
    const known = tagsByName.get(clean.toLowerCase());
    if (known) {
      return known;
    }
    const created = await createTag(client, workspaceId, { name: clean });
    tagsByName.set(created.name.toLowerCase(), created);
    return created;
  };

  for (const row of rows) {
    if (seen.has(row.phone)) {
      result.skipped += 1;
      if (result.errors.length < MAX_ERROR_LINES) {
        result.errors.push(`Fila ${row.line}: teléfono repetido en el archivo; se usó la primera.`);
      }
      continue;
    }
    seen.add(row.phone);

    try {
      const stage = row.stage ? stages.find((item) => item.name.toLowerCase() === row.stage!.toLowerCase()) : null;

      if (row.stage && !stage) {
        throw invalid(`la etapa «${row.stage}» no existe`);
      }

      const tags: CrmTag[] = [];
      for (const name of row.tags) {
        const tag = await tagFor(name);
        if (tag) tags.push(tag);
      }

      const current = existing.get(row.phone);
      let contactId: string;

      if (!current) {
        const contact: CrmContact = await createContact(
          client,
          workspaceId,
          {
            company: row.company,
            customFields: row.customFields,
            email: row.email,
            fullName: row.fullName,
            phone: row.phone,
            source: "import",
            stageId: stage?.id ?? null,
          },
          actor,
        );
        contactId = contact.id;
        result.created += 1;
      } else {
        const changes: Record<string, unknown> = {};
        if (row.fullName) changes.full_name = row.fullName;
        if (row.email) changes.email = row.email;
        if (row.company) changes.company = row.company;
        if (stage) changes.stage_id = stage.id;
        if (Object.keys(row.customFields).length > 0) {
          changes.custom_fields = mergeCustomFieldValues(definitions, current.custom_fields, row.customFields);
        }

        if (Object.keys(changes).length > 0) {
          const { error } = await client
            .from("contacts")
            .update(changes)
            .eq("workspace_id", workspaceId)
            .eq("id", current.id);

          if (error) {
            throw dbFailure("importContacts.update", error);
          }
          await logActivity(client, workspaceId, current.id, "contact_updated", { fields: Object.keys(changes), via: "import" }, actor);
        }
        contactId = current.id;
        result.updated += 1;
      }

      if (tags.length > 0) {
        const { error } = await client.from("crm_contact_tags").upsert(
          tags.map((tag) => ({ contact_id: contactId, tag_id: tag.id, workspace_id: workspaceId })),
          { onConflict: "contact_id,tag_id" },
        );
        if (error) {
          throw dbFailure("importContacts.tags", error);
        }
      }
    } catch (error) {
      if (!(error instanceof CrmError)) {
        throw error;
      }
      result.skipped += 1;
      if (result.errors.length < MAX_ERROR_LINES) {
        result.errors.push(`Fila ${row.line}: ${error.message}`);
      }
    }
  }

  return result;
}

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

/** Todos los contactos de la empresa en CSV (paginado de 1.000 en 1.000). */
export async function exportContacts(client: CrmClient, workspaceId: string) {
  const [definitions, stages] = await Promise.all([
    listCustomFields(client, workspaceId, { includeInactive: true }),
    listStages(client, workspaceId),
  ]);
  const header = [
    "nombre",
    "telefono",
    "email",
    "empresa",
    "origen",
    "etapa",
    "etiquetas",
    "creado",
    "ultimo_mensaje",
    ...definitions.map((definition) => `cf_${definition.key}`),
  ];
  const rows: string[][] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("contacts")
      .select("id, full_name, phone_e164, email, company, source, stage_id, custom_fields, created_at, last_message_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      throw dbFailure("exportContacts", error);
    }

    const contacts = (data ?? []) as Array<CrmContact & { custom_fields: Record<string, unknown> }>;
    const tags = await listContactTags(client, workspaceId, contacts.map((contact) => contact.id));

    for (const contact of contacts) {
      const values = contact.custom_fields ?? {};
      rows.push([
        contact.full_name ?? "",
        contact.phone_e164,
        contact.email ?? "",
        contact.company ?? "",
        contact.source ?? "",
        resolveStage(stages, contact.stage_id)?.name ?? "",
        (tags.get(contact.id) ?? []).map((tag) => tag.name).join(";"),
        dateOnly(contact.created_at),
        dateOnly(contact.last_message_at),
        ...definitions.map((definition) => {
          const value = values[definition.key];
          if (value === undefined || value === null) return "";
          return Array.isArray(value) ? value.join(";") : String(value);
        }),
      ]);
    }

    if (contacts.length < PAGE) {
      break;
    }
  }

  return toCsv(header, rows);
}
