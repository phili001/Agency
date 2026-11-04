import type { Json } from "@/lib/supabase/database.types";

/**
 * Una "tool de calendario" es un workspace_asset de kind "tool" cuyo metadata
 * apunta a una agenda propia: `{ type: "agenda", agenda_id, agenda_name,
 * is_default }`.
 *
 * Reglas del modelo:
 * - El agente elige solo entre las agendas que tenga asignadas, leyendo la
 *   descripción de cada una.
 * - Un flujo puede fijar la agenda de un contacto concreto; esa elección se
 *   guarda en el contacto y gana sobre la del modelo.
 */
export const CALENDAR_TOOL_TYPE = "agenda";

/** Clave donde el flujo deja la agenda elegida para ese contacto. */
export const CONTACT_CALENDAR_KEY = "booking_agenda_id";

export type CalendarToolMetadata = {
  agenda_id: string;
  agenda_name: string;
  is_default: boolean;
  type: typeof CALENDAR_TOOL_TYPE;
};

export type CalendarTool = {
  /** `agendas.id`. */
  calendarId: string;
  calendarName: string;
  /** Cuando usar esta agenda. Es lo que lee el modelo para elegir. */
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

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildCalendarToolMetadata({
  agendaId,
  agendaName,
  isDefault,
}: {
  agendaId: string;
  agendaName: string;
  isDefault: boolean;
}): CalendarToolMetadata {
  return {
    agenda_id: agendaId,
    agenda_name: agendaName,
    is_default: isDefault,
    type: CALENDAR_TOOL_TYPE,
  };
}

/** ¿Es una tool de calendario? */
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

  const calendarId = text(metadata.agenda_id);

  if (!calendarId) {
    return null;
  }

  return {
    calendarId,
    calendarName: text(metadata.agenda_name) ? String(metadata.agenda_name) : asset.title,
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

/** Agenda fijada a un contacto por un flujo. */
export function getPinnedCalendar(contactMetadata: Json | null | undefined): { calendarId: string } | null {
  const agendaId = text(asRecord(contactMetadata)[CONTACT_CALENDAR_KEY]);

  return agendaId ? { calendarId: agendaId } : null;
}

/**
 * Agendas entre las que puede elegir este agente, en orden de preferencia.
 *
 * - Si un flujo fijó una agenda para el contacto, esa es la única: la
 *   elección explícita de un flujo gana sobre la del modelo.
 * - Si no, el agente elige solo entre las agendas que tenga asignadas,
 *   leyendo la descripción de cada una para decidir según lo que pida el
 *   paciente.
 * - Si el workspace ya tiene tools de calendario pero el agente no tiene
 *   ninguna asignada, no se usa ninguna. Caer a "todas" mezcla agendas y
 *   permite que un agente confirme citas sin estar configurado.
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
  const pinned = getPinnedCalendar(contactMetadata);

  if (pinned) {
    const match = tools.find((tool) => tool.calendarId === pinned.calendarId);
    // Una agenda fijada por un flujo se respeta aunque no esté registrada
    // como tool: la elección fue explícita y no debe caerse en silencio.
    return [
      match ?? {
        calendarId: pinned.calendarId,
        calendarName: "Agenda asignada",
        description: "Agenda asignada por un flujo para este contacto.",
        id: "",
        isDefault: false,
        title: "Agenda asignada",
      },
    ];
  }

  const assigned = tools.filter((tool) => enabledToolIds.includes(tool.id));

  // La marcada por defecto primero: si el modelo duda, es la que verá antes.
  return [...assigned].sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
}

/**
 * Agenda que debe usar el agente para este contacto: la que le asignó un flujo
 * o, si no, la marcada por defecto en Tools.
 *
 * Devuelve el id directo, no la tool: un flujo puede asignar una agenda que no
 * esté registrada como tool, y esa elección explícita debe respetarse igual.
 */
export function resolveCalendarForContact({
  contactMetadata,
  tools,
}: {
  contactMetadata: Json | null | undefined;
  tools: CalendarTool[];
}): { calendarId: string } | null {
  const pinned = getPinnedCalendar(contactMetadata);

  if (pinned) {
    return pinned;
  }

  const fallback = tools.find((tool) => tool.isDefault);

  return fallback ? { calendarId: fallback.calendarId } : null;
}
