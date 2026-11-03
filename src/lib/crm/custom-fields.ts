import type { SupabaseClient } from "@supabase/supabase-js";

import type { Json } from "@/lib/supabase/database.types";

import { conflict, dbFailure, invalid, isUniqueViolation, notFound } from "./errors.ts";
import { normalizeEmail, normalizePhoneE164 } from "./normalize.ts";

/**
 * Campos personalizados del contacto (diseño de crm-levy
 * `design/contacts_crm.md`). La definición vive en `crm_custom_fields` y los
 * valores en `contacts.custom_fields` (jsonb `{ key: valor }`). Se validan aquí,
 * no en la base: el tipo de cada clave depende de la definición de la empresa.
 */

export const CUSTOM_FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "money",
  "date",
  "boolean",
  "select",
  "multi",
  "phone",
  "email",
  "url",
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export type CustomFieldDefinition = {
  active: boolean;
  ai_readable: boolean;
  id: string;
  key: string;
  label: string;
  options: string[];
  position: number;
  type: CustomFieldType;
};

export type CustomFieldValue = boolean | number | string | string[];
export type CustomFieldValues = Record<string, CustomFieldValue>;

const MAX_OPTIONS = 50;
const MAX_TEXT = 500;
const MAX_LONG_TEXT = 5000;

export function isCustomFieldType(value: unknown): value is CustomFieldType {
  return typeof value === "string" && (CUSTOM_FIELD_TYPES as readonly string[]).includes(value);
}

/** "Fecha de nacimiento" → "fecha_de_nacimiento". */
export function slugifyFieldKey(label: string) {
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);

  return /^[a-z]/.test(slug) ? slug : `campo_${slug}`.slice(0, 50).replace(/_+$/, "");
}

function normalizeOptions(type: CustomFieldType, options: unknown) {
  if (type !== "select" && type !== "multi") {
    return [];
  }

  if (!Array.isArray(options)) {
    throw invalid("Las opciones tienen que ser una lista.");
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const option of options) {
    const value = typeof option === "string" ? option.trim() : "";
    if (!value || value.length > 100) {
      throw invalid("Cada opción tiene que tener entre 1 y 100 caracteres.");
    }
    if (!seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      result.push(value);
    }
  }

  if (result.length === 0) {
    throw invalid("Un campo de selección necesita al menos una opción.");
  }
  if (result.length > MAX_OPTIONS) {
    throw invalid(`Como máximo ${MAX_OPTIONS} opciones.`);
  }

  return result;
}

export type CustomFieldDefinitionInput = {
  ai_readable?: boolean;
  key?: string;
  label: string;
  options?: unknown;
  type: string;
};

export function validateFieldDefinition(input: CustomFieldDefinitionInput) {
  const label = typeof input.label === "string" ? input.label.trim() : "";

  if (!label || label.length > 80) {
    throw invalid("El nombre del campo tiene que tener entre 1 y 80 caracteres.");
  }
  if (!isCustomFieldType(input.type)) {
    throw invalid("Tipo de campo no válido.");
  }

  const key = input.key?.trim() || slugifyFieldKey(label);

  if (!/^[a-z][a-z0-9_]{0,49}$/.test(key)) {
    throw invalid("La clave solo admite minúsculas, números y guiones bajos, y empieza por letra.");
  }

  return {
    ai_readable: input.ai_readable === true,
    key,
    label,
    options: normalizeOptions(input.type, input.options),
    type: input.type,
  };
}

function isEmpty(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && /^-?\d+([.,]\d+)?$/.test(value.trim())) {
    return Number(value.trim().replace(",", "."));
  }
  return Number.NaN;
}

/**
 * Valida y normaliza un valor para un campo. Devuelve null si el valor está
 * vacío (borrar el campo). Lanza `CrmError("invalid")` con el motivo.
 */
export function validateFieldValue(
  definition: Pick<CustomFieldDefinition, "label" | "options" | "type">,
  value: unknown,
): CustomFieldValue | null {
  if (isEmpty(value)) {
    return null;
  }

  const label = definition.label;

  switch (definition.type) {
    case "text":
    case "long_text": {
      if (typeof value !== "string" && typeof value !== "number") {
        throw invalid(`«${label}» tiene que ser texto.`);
      }
      const text = String(value).trim();
      const max = definition.type === "text" ? MAX_TEXT : MAX_LONG_TEXT;
      if (text.length > max) {
        throw invalid(`«${label}» admite como máximo ${max} caracteres.`);
      }
      return text;
    }
    case "number":
    case "money": {
      const number = toNumber(value);
      if (!Number.isFinite(number)) {
        throw invalid(`«${label}» tiene que ser un número.`);
      }
      return definition.type === "money" ? Math.round(number * 100) / 100 : number;
    }
    case "date": {
      const text = String(value).trim();
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
      if (!match || !date || date.getUTCMonth() !== +match[2] - 1 || date.getUTCDate() !== +match[3]) {
        throw invalid(`«${label}» tiene que ser una fecha (AAAA-MM-DD).`);
      }
      return text;
    }
    case "boolean": {
      if (typeof value === "boolean") {
        return value;
      }
      if (value === "true" || value === "false") {
        return value === "true";
      }
      throw invalid(`«${label}» tiene que ser sí o no.`);
    }
    case "select": {
      const text = String(value).trim();
      const option = definition.options.find((item) => item.toLowerCase() === text.toLowerCase());
      if (!option) {
        throw invalid(`«${text}» no es una opción de «${label}».`);
      }
      return option;
    }
    case "multi": {
      const items = Array.isArray(value) ? value : [value];
      const result: string[] = [];
      for (const item of items) {
        const text = String(item).trim();
        const option = definition.options.find((candidate) => candidate.toLowerCase() === text.toLowerCase());
        if (!option) {
          throw invalid(`«${text}» no es una opción de «${label}».`);
        }
        if (!result.includes(option)) {
          result.push(option);
        }
      }
      return result;
    }
    case "phone": {
      const phone = normalizePhoneE164(String(value));
      if (!phone) {
        throw invalid(`«${label}» tiene que ser un teléfono con prefijo de país.`);
      }
      return phone;
    }
    case "email": {
      const email = normalizeEmail(String(value));
      if (!email) {
        throw invalid(`«${label}» tiene que ser un correo válido.`);
      }
      return email;
    }
    case "url": {
      try {
        const url = new URL(String(value).trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          throw new Error("protocol");
        }
        return url.toString();
      } catch {
        throw invalid(`«${label}» tiene que ser un enlace que empiece por http:// o https://.`);
      }
    }
  }
}

/**
 * Aplica un cambio parcial a los valores de un contacto. Solo admite claves de
 * campos activos; `null` o vacío borra la clave. Las claves de campos ya
 * desactivados que el contacto tuviera se conservan (no se pierden datos).
 */
export function mergeCustomFieldValues(
  definitions: CustomFieldDefinition[],
  current: unknown,
  patch: Record<string, unknown>,
): CustomFieldValues {
  const result: CustomFieldValues =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as CustomFieldValues) }
      : {};

  for (const [key, raw] of Object.entries(patch)) {
    const definition = definitions.find((item) => item.key === key && item.active);

    if (!definition) {
      throw invalid(`El campo «${key}» no existe o está desactivado.`);
    }

    const value = validateFieldValue(definition, raw);

    if (value === null) {
      delete result[key];
    } else {
      result[key] = value;
    }
  }

  return result;
}

function formatValue(definition: CustomFieldDefinition, value: CustomFieldValue) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "sí" : "no";
  }
  return String(value);
}

/**
 * Líneas «Etiqueta: valor» de los campos que el agente puede leer
 * (`ai_readable`). Lo que no está marcado nunca llega al modelo.
 */
export function describeAiReadableFields(
  definitions: CustomFieldDefinition[],
  values: unknown,
) {
  const record = values && typeof values === "object" ? (values as CustomFieldValues) : {};

  return [...definitions]
    .filter((definition) => definition.active && definition.ai_readable)
    .sort((a, b) => a.position - b.position)
    .flatMap((definition) => {
      const value = record[definition.key];
      return value === undefined || isEmpty(value)
        ? []
        : [`${definition.label}: ${formatValue(definition, value)}`];
    });
}

// --- Base de datos -----------------------------------------------------------

type Client = SupabaseClient;

function toDefinition(row: Record<string, unknown>): CustomFieldDefinition {
  return {
    active: row.active !== false,
    ai_readable: row.ai_readable === true,
    id: String(row.id),
    key: String(row.key),
    label: String(row.label),
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    position: Number(row.position ?? 0),
    type: isCustomFieldType(row.type) ? row.type : "text",
  };
}

export async function listCustomFields(
  client: Client,
  workspaceId: string,
  { includeInactive = false } = {},
) {
  let query = client
    .from("crm_custom_fields")
    .select("id, key, label, type, options, ai_readable, position, active")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });

  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw dbFailure("listCustomFields", error);
  }

  return (data ?? []).map((row) => toDefinition(row as Record<string, unknown>));
}

export async function createCustomField(
  client: Client,
  workspaceId: string,
  input: CustomFieldDefinitionInput,
) {
  const definition = validateFieldDefinition(input);
  const existing = await listCustomFields(client, workspaceId, { includeInactive: true });
  const position = existing.reduce((max, item) => Math.max(max, item.position + 1), 0);
  const { data, error } = await client
    .from("crm_custom_fields")
    .insert({
      ...definition,
      active: true,
      options: definition.options as Json,
      position,
      workspace_id: workspaceId,
    })
    .select("id, key, label, type, options, ai_readable, position, active")
    .single();

  if (isUniqueViolation(error)) {
    throw conflict("Ya existe un campo con esa clave.");
  }
  if (error || !data) {
    throw dbFailure("createCustomField", error ?? { message: "sin fila" });
  }

  return toDefinition(data as Record<string, unknown>);
}

/**
 * Cambia nombre, opciones, visibilidad para la IA o lo activa/desactiva. La
 * clave y el tipo no cambian: los valores ya guardados dependen de ellos.
 */
export async function updateCustomField(
  client: Client,
  workspaceId: string,
  fieldId: string,
  patch: { active?: boolean; ai_readable?: boolean; label?: string; options?: unknown },
) {
  const { data: current, error: readError } = await client
    .from("crm_custom_fields")
    .select("id, key, label, type, options, ai_readable, position, active")
    .eq("workspace_id", workspaceId)
    .eq("id", fieldId)
    .maybeSingle();

  if (readError) {
    throw dbFailure("updateCustomField.read", readError);
  }
  if (!current) {
    throw notFound("Ese campo no existe en esta empresa.");
  }

  const base = toDefinition(current as Record<string, unknown>);
  const next = validateFieldDefinition({
    ai_readable: patch.ai_readable ?? base.ai_readable,
    key: base.key,
    label: patch.label ?? base.label,
    options: patch.options ?? base.options,
    type: base.type,
  });
  const { data, error } = await client
    .from("crm_custom_fields")
    .update({
      active: patch.active ?? base.active,
      ai_readable: next.ai_readable,
      label: next.label,
      options: next.options as Json,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", fieldId)
    .select("id, key, label, type, options, ai_readable, position, active")
    .single();

  if (error || !data) {
    throw dbFailure("updateCustomField", error ?? { message: "sin fila" });
  }

  return toDefinition(data as Record<string, unknown>);
}

export async function reorderCustomFields(client: Client, workspaceId: string, orderedIds: string[]) {
  const existing = await listCustomFields(client, workspaceId, { includeInactive: true });
  const known = new Set(existing.map((item) => item.id));

  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    throw invalid("El orden tiene que incluir todos los campos de la empresa.");
  }

  for (const [position, id] of orderedIds.entries()) {
    const { error } = await client
      .from("crm_custom_fields")
      .update({ position })
      .eq("workspace_id", workspaceId)
      .eq("id", id);

    if (error) {
      throw dbFailure("reorderCustomFields", error);
    }
  }
}
