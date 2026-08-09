import type { Json } from "@/lib/supabase/database.types";

/**
 * Una "tool de calendario" es un workspace_asset de kind "tool" cuyo metadata
 * apunta a un calendario real de GoHighLevel.
 *
 * Reglas del modelo:
 * - El agente de agendamiento usa SIEMPRE una sola: la marcada por defecto.
 *   Nunca elige entre varias.
 * - Un flujo puede cambiar el calendario de un contacto concreto; esa eleccion
 *   se guarda en el contacto y tiene prioridad sobre la de por defecto.
 */
export const CALENDAR_TOOL_TYPE = "ghl_calendar";

/** Clave donde el flujo deja el calendario elegido para ese contacto. */
export const CONTACT_CALENDAR_KEY = "booking_calendar_id";

export type CalendarToolMetadata = {
  calendar_id: string;
  calendar_name: string;
  is_default: boolean;
  type: typeof CALENDAR_TOOL_TYPE;
};

export type CalendarTool = {
  calendarId: string;
  calendarName: string;
  /** Cuando usar este calendario. Es lo que lee el modelo para elegir. */
  description: string;
  id: string;
  isDefault: boolean;
  title: string;
};

function asRecord(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function buildCalendarToolMetadata({
  calendarId,
  calendarName,
  isDefault,
}: {
  calendarId: string;
  calendarName: string;
  isDefault: boolean;
}): CalendarToolMetadata {
  return {
    calendar_id: calendarId,
    calendar_name: calendarName,
    is_default: isDefault,
    type: CALENDAR_TOOL_TYPE,
  };
}

export function isCalendarTool(metadata: Json | null | undefined) {
  return asRecord(metadata).type === CALENDAR_TOOL_TYPE;
}

/** Lee una tool de calendario desde su asset. Devuelve null si no lo es. */
export function parseCalendarTool(asset: {
  content?: string | null;
  id: string;
  metadata: Json | null;
  title: string;
}): CalendarTool | null {
  const metadata = asRecord(asset.metadata);

  if (metadata.type !== CALENDAR_TOOL_TYPE) {
    return null;
  }

  const calendarId =
    typeof metadata.calendar_id === "string" ? metadata.calendar_id.trim() : "";

  if (!calendarId) {
    return null;
  }

  return {
    calendarId,
    calendarName:
      typeof metadata.calendar_name === "string" && metadata.calendar_name.trim()
        ? metadata.calendar_name
        : asset.title,
    description: asset.content?.trim() ?? "",
    id: asset.id,
    isDefault: metadata.is_default === true,
    title: asset.title,
  };
}

export function parseCalendarTools(
  assets: Array<{
    content?: string | null;
    id: string;
    metadata: Json | null;
    title: string;
  }>,
) {
  return assets
    .map((asset) => parseCalendarTool(asset))
    .filter((tool): tool is CalendarTool => tool !== null);
}

/**
 * Calendarios entre los que puede elegir este agente, en orden de preferencia.
 *
 * - Si un flujo fijo un calendario para el contacto, ese es el unico: la
 *   eleccion explicita de un flujo gana sobre la del modelo.
 * - Si no, el agente elige solo entre los calendarios que tenga asignados,
 *   leyendo la descripcion de cada uno para decidir segun lo que pida el
 *   paciente.
 * - Si el workspace ya tiene tools de calendario pero el agente no tiene
 *   ninguna asignada, no se usa ningun calendario. Caer a "todos" mezcla
 *   agendas y permite que un agente confirme citas sin estar configurado.
 */
export function resolveCalendarsForAgent({
  contactMetadata,
  enabledToolIds,
  tools,
}: {
  contactMetadata: Json | null | undefined;
  enabledToolIds: string[];
  tools: CalendarTool[];
}): CalendarTool[] {
  const pinned = asRecord(contactMetadata)[CONTACT_CALENDAR_KEY];

  if (typeof pinned === "string" && pinned.trim()) {
    const match = tools.find((tool) => tool.calendarId === pinned.trim());
    // Un calendario fijado por un flujo se respeta aunque no este registrado
    // como tool: la eleccion fue explicita y no debe caerse en silencio.
    return [
      match ?? {
        calendarId: pinned.trim(),
        calendarName: "Calendario asignado",
        description: "Calendario asignado por un flujo para este contacto.",
        id: "",
        isDefault: false,
        title: "Calendario asignado",
      },
    ];
  }

  const assigned = tools.filter((tool) => enabledToolIds.includes(tool.id));
  const available = assigned.length > 0 ? assigned : [];

  // El marcado por defecto primero: si el modelo duda, es el que vera antes.
  return [...available].sort(
    (left, right) => Number(right.isDefault) - Number(left.isDefault),
  );
}

/**
 * Calendario que debe usar el agente de agendamiento para este contacto.
 * Prioridad: el que le asigno un flujo > el marcado por defecto en Tools.
 *
 * Devuelve el id directo, no la tool: un flujo puede asignar un calendario de
 * GHL que no este registrado como tool, y esa eleccion explicita debe respetarse
 * igual. Si se buscara la tool, se caeria al de por defecto en silencio.
 */
export function resolveCalendarForContact({
  contactMetadata,
  tools,
}: {
  contactMetadata: Json | null | undefined;
  tools: CalendarTool[];
}): string | null {
  const assigned = asRecord(contactMetadata)[CONTACT_CALENDAR_KEY];

  if (typeof assigned === "string" && assigned.trim()) {
    return assigned.trim();
  }

  return tools.find((tool) => tool.isDefault)?.calendarId ?? null;
}
