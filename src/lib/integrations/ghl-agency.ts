import "server-only";

import { ACTIVE_TAG } from "@/lib/levy-purchase";

/**
 * GoHighLevel de la agencia (donde vive el funnel que vende Levy), no el de
 * cada cliente. El token y la location van en variables de entorno porque son
 * de la plataforma: las integraciones de los workspaces siguen cifradas en BD.
 */

type AgencyContact = {
  customFields?: { id?: string; value?: unknown }[];
  email?: string | null;
  firstName?: string | null;
  id: string;
  locationId?: string;
  phone?: string | null;
  tags?: string[];
};

type AgencyCustomField = {
  fieldKey?: string;
  id: string;
  model?: string;
};

export function getAgencyGhlConfig() {
  const token = process.env.GHL_AGENCY_TOKEN?.trim();
  const locationId = process.env.GHL_AGENCY_LOCATION_ID?.trim();

  return token && locationId ? { locationId, token } : null;
}

async function agencyFetch<T>(
  path: string,
  { body, method = "GET" }: { body?: Record<string, unknown>; method?: "GET" | "POST" | "PUT" } = {},
) {
  const config = getAgencyGhlConfig();

  if (!config) {
    throw new Error("Faltan GHL_AGENCY_TOKEN o GHL_AGENCY_LOCATION_ID.");
  }

  const apiBase = process.env.GHL_API_BASE ?? "https://services.leadconnectorhq.com";
  const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    method,
  });
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };

  if (!response.ok) {
    throw new Error(`GHL ${response.status}: ${payload.message ?? "petición rechazada"}`);
  }

  return payload;
}

export async function getAgencyContact(contactId: string) {
  const config = getAgencyGhlConfig();
  const { contact } = await agencyFetch<{ contact?: AgencyContact }>(
    `/contacts/${encodeURIComponent(contactId)}`,
  );

  // El token es de la location, pero se comprueba igual: un id de otra cuenta
  // no debe poder activar nada aqui.
  if (!contact || (contact.locationId && contact.locationId !== config?.locationId)) {
    return null;
  }

  return contact;
}

export async function findAgencyContactByEmail(email: string) {
  const config = getAgencyGhlConfig();

  if (!config) {
    return null;
  }

  const params = new URLSearchParams({ email, locationId: config.locationId });
  const { contact } = await agencyFetch<{ contact?: AgencyContact | null }>(
    `/contacts/search/duplicate?${params.toString()}`,
  );

  return contact ?? null;
}

/** Mapa "levy_link_acceso" -> id del campo, que es lo que pide la API al escribir. */
async function getContactFieldIds() {
  const config = getAgencyGhlConfig();
  const { customFields } = await agencyFetch<{ customFields?: AgencyCustomField[] }>(
    `/locations/${encodeURIComponent(config?.locationId ?? "")}/customFields?model=contact`,
  );

  return new Map(
    (customFields ?? [])
      .filter((field) => field.fieldKey)
      .map((field) => [field.fieldKey!.replace(/^contact\./, ""), field.id]),
  );
}

export async function readAgencyContactField(contact: AgencyContact, key: string) {
  const fieldIds = await getContactFieldIds();
  const id = fieldIds.get(key);
  const value = contact.customFields?.find((field) => field.id === id)?.value;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function setAgencyContactFields(contactId: string, values: Record<string, string>) {
  const fieldIds = await getContactFieldIds();
  const missing = Object.keys(values).filter((key) => !fieldIds.has(key));

  if (missing.length) {
    throw new Error(`No existen en GHL los campos: ${missing.join(", ")}`);
  }

  await agencyFetch(`/contacts/${encodeURIComponent(contactId)}`, {
    body: {
      customFields: Object.entries(values).map(([key, value]) => ({
        field_value: value,
        id: fieldIds.get(key),
      })),
    },
    method: "PUT",
  });
}

export async function addAgencyContactTags(contactId: string, tags: string[]) {
  await agencyFetch(`/contacts/${encodeURIComponent(contactId)}/tags`, {
    body: { tags },
    method: "POST",
  });
}

/**
 * El cliente termino la configuración guiada: se etiqueta en el CRM de la
 * agencia para cortar los recordatorios de activación. No lanza: si GHL no
 * esta configurado o el contacto no existe (cuentas creadas a mano), no pasa
 * nada.
 */
export async function markAgencyContactActive(email: string | null | undefined) {
  if (!email || !getAgencyGhlConfig()) {
    return;
  }

  try {
    const contact = await findAgencyContactByEmail(email);

    if (contact) {
      await addAgencyContactTags(contact.id, [ACTIVE_TAG]);
    }
  } catch (error) {
    console.error("[ghl-agency] No se pudo marcar el cliente como activo:", error);
  }
}
