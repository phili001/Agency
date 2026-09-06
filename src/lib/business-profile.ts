import type { Json } from "@/lib/supabase/database.types";

export type BusinessProfileMetadata = {
  custom_fields?: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  fields?: Record<string, string>;
};

type BusinessProfileAsset = {
  content?: string | null;
  metadata?: Json;
  title?: string | null;
};

export const businessProfileFields = [
  {
    help: "Nombre comercial que debe usar el agente.",
    key: "company_name",
    label: "Nombre empresa",
    placeholder: "Clínica Dental Norte",
    variable: "{company_name}",
  },
  {
    help: "Horario normal de atención y excepciones importantes.",
    key: "business_hours",
    label: "Horarios",
    placeholder: "Lunes a viernes 9:00-18:00, sabados 9:00-13:00",
    variable: "{business_hours}",
  },
  {
    help: "Ciudad, zona o sucursales donde opera.",
    key: "location",
    label: "Ubicación",
    placeholder: "Madrid, zona Chamberi",
    variable: "{location}",
  },
  {
    help: "Dirección exacta si atiende presencialmente.",
    key: "address",
    label: "Dirección",
    placeholder: "Calle Ejemplo 123, Local 4",
    variable: "{address}",
  },
  {
    help: "Servicios o productos principales que puede mencionar el agente.",
    key: "services",
    label: "Servicios",
    placeholder: "Limpieza dental, blanqueamiento, ortodoncia",
    variable: "{services}",
  },
  {
    help: "Personas, roles o especialistas que el agente puede nombrar.",
    key: "team",
    label: "Equipo",
    placeholder: "Dra. Ana Perez, higiene dental; Dr. Luis Gomez, ortodoncia",
    variable: "{team}",
  },
  {
    help: "Formas de pago aceptadas y condiciones básicas.",
    key: "payment_methods",
    label: "Métodos de pago",
    placeholder: "Tarjeta, transferencia, efectivo. Reserva con anticipo.",
    variable: "{payment_methods}",
  },
  {
    help: "Reglas comerciales que no deben improvisarse.",
    key: "policies",
    label: "Políticas",
    placeholder: "Cancelar con 24h. Llegar 10 minutos antes.",
    variable: "{policies}",
  },
  {
    help: "Link donde el contacto reserva su cita. Lo usan los flujos y los agentes.",
    key: "booking_url",
    label: "Link de agenda",
    placeholder: "https://tuempresa.com/agenda",
    variable: "{booking_url}",
  },
  {
    help: "Pais por defecto para interpretar números y contexto.",
    key: "country",
    label: "País",
    placeholder: "Espana",
    variable: "{country}",
  },
  {
    help: "Zona horaria para citas y recordatorios.",
    key: "timezone",
    label: "Zona horaria",
    placeholder: "Europe/Madrid",
    variable: "{timezone}",
  },
] as const;

export function getBusinessProfileMetadata(
  metadata?: Json | null,
): BusinessProfileMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { custom_fields: [], fields: {} };
  }

  const record = metadata as Record<string, unknown>;
  const fields =
    record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
      ? Object.fromEntries(
          Object.entries(record.fields).map(([key, value]) => [key, String(value ?? "")]),
        )
      : {};
  const customFields = Array.isArray(record.custom_fields)
    ? record.custom_fields
        .map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? (item as Record<string, unknown>)
            : null,
        )
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          key: String(item.key ?? ""),
          label: String(item.label ?? ""),
          value: String(item.value ?? ""),
        }))
        .filter((item) => item.key || item.label || item.value)
    : [];

  return { custom_fields: customFields, fields };
}

export function normalizeVariableKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildBusinessProfileContent(metadata: BusinessProfileMetadata) {
  const fields = metadata.fields ?? {};
  const baseLines = businessProfileFields
    .map((field) => {
      const value = fields[field.key]?.trim();
      return value ? `${field.label}: ${value}` : "";
    })
    .filter(Boolean);
  const customLines = (metadata.custom_fields ?? [])
    .map((field) => {
      const value = field.value.trim();
      const label = field.label.trim() || field.key;
      return value ? `${label}: ${value}` : "";
    })
    .filter(Boolean);

  return [...baseLines, ...customLines].join("\n");
}

export function getBusinessVariables(asset?: BusinessProfileAsset | null) {
  const metadata = getBusinessProfileMetadata(asset?.metadata ?? null);
  const variables: Record<string, string> = {};

  for (const field of businessProfileFields) {
    const value = metadata.fields?.[field.key]?.trim();
    if (value) {
      variables[field.key] = value;
    }
  }

  if (variables.company_name) {
    variables.business_name = variables.company_name;
  } else if (asset?.title) {
    variables.business_name = asset.title;
    variables.company_name = asset.title;
  }

  for (const field of metadata.custom_fields ?? []) {
    const key = normalizeVariableKey(field.key || field.label);
    if (key && field.value.trim()) {
      variables[key] = field.value.trim();
    }
  }

  return variables;
}

export function applyBusinessVariables(prompt: string, variables: Record<string, string>) {
  return prompt.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => variables[key] ?? match);
}

export function buildBusinessContext(asset?: BusinessProfileAsset | null) {
  const variables = getBusinessVariables(asset);
  const lines = Object.entries(variables).map(([key, value]) => `- {${key}}: ${value}`);

  if (lines.length === 0 && !asset?.content?.trim()) {
    return "";
  }

  return `Contexto del negocio:
${asset?.content?.trim() ? `${asset.content.trim()}\n\n` : ""}Variables disponibles para el prompt:
${lines.join("\n")}`;
}
