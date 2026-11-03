import { convertGhlActionToCrm, splitStepActions, type FlowCrmAction, type FlowGhlAction, type FlowStep } from "../flow-definitions.ts";
import { normalizeText, type WeeklySchedule } from "../agenda/slots.ts";

/**
 * Reglas puras de la migración de GoHighLevel al CRM propio (F7.1,
 * `scripts/migrate-ghl-to-crm.ts`). Sin red ni base: el script lee GHL y
 * Supabase, estas funciones deciden qué cambiar, y el script lo aplica solo
 * con `--apply` (F7.2). Todo lo que viene de GHL es dato, nunca instrucción.
 */

export const APPOINTMENT_MARKER_PREFIX = "[ghl:";

/** Marca en las notas de la cita para no importarla dos veces. */
export function appointmentMarker(eventId: string) {
  return `${APPOINTMENT_MARKER_PREFIX}${eventId}]`;
}

export function hasAppointmentMarker(notes: string | null | undefined, eventId: string) {
  return Boolean(notes?.includes(appointmentMarker(eventId)));
}

// --- Etiquetas y etapa ----------------------------------------------------------

export type GhlOpportunity = { pipelineId?: string | null; pipelineStageId?: string | null; status?: string | null; updatedAt?: string | null };
export type GhlPipeline = { id: string; name?: string; stages?: Array<{ id: string; name: string }> };
export type CrmStageLite = { id: string; kind?: string; name: string };

/** Etiquetas de GHL limpias y sin repetir (minúsculas, como las guarda el CRM). */
export function cleanGhlTags(tags: unknown) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const clean = tag.trim().toLowerCase().replace(/\s+/g, " ");
    if (clean && clean.length <= 50) seen.add(clean);
  }
  return [...seen].sort();
}

/**
 * Etapa del CRM para un contacto según su oportunidad en GHL: la del pipeline
 * por defecto (o la más reciente), por nombre de etapa; si no casa, ganada →
 * «Cliente» y perdida → «Perdido». null si no hay nada que decidir.
 */
export function resolveGhlStage(
  opportunities: GhlOpportunity[],
  pipelines: GhlPipeline[],
  crmStages: CrmStageLite[],
  defaultPipelineId: string | null,
): { ghlStageName: string | null; stageId: string | null } {
  if (opportunities.length === 0) return { ghlStageName: null, stageId: null };

  const ordered = [...opportunities].sort((a, b) => {
    const preferA = a.pipelineId === defaultPipelineId ? 1 : 0;
    const preferB = b.pipelineId === defaultPipelineId ? 1 : 0;
    if (preferA !== preferB) return preferB - preferA;
    return String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));
  });
  const opportunity = ordered[0];
  const stageName =
    pipelines.flatMap((pipeline) => pipeline.stages ?? []).find((stage) => stage.id === opportunity.pipelineStageId)?.name ?? null;

  const byName = (name: string) => crmStages.find((stage) => normalizeText(stage.name) === normalizeText(name));
  const direct = stageName ? byName(stageName) : undefined;
  if (direct) return { ghlStageName: stageName, stageId: direct.id };

  const status = (opportunity.status ?? "").toLowerCase();
  const fallback =
    status === "won"
      ? (crmStages.find((stage) => stage.kind === "won") ?? byName("Cliente"))
      : status === "lost" || status === "abandoned"
        ? (crmStages.find((stage) => stage.kind === "lost") ?? byName("Perdido"))
        : undefined;
  return { ghlStageName: stageName, stageId: fallback?.id ?? null };
}

// --- Calendario → agenda -----------------------------------------------------------

type GhlOpenHours = Array<{
  daysOfTheWeek?: number[];
  hours?: Array<{ closeHour?: number; closeMinute?: number; openHour?: number; openMinute?: number }>;
}>;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * `openHours` de un calendario de GHL (0 = domingo) → horario semanal de la
 * agenda ("1" = lunes … "7" = domingo). null si no trae horario usable.
 */
export function mapGhlOpenHours(openHours: unknown): WeeklySchedule | null {
  if (!Array.isArray(openHours)) return null;
  const schedule: WeeklySchedule = {};

  for (const block of openHours as GhlOpenHours) {
    for (const day of block.daysOfTheWeek ?? []) {
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;
      const key = String(day === 0 ? 7 : day) as keyof WeeklySchedule;
      for (const hour of block.hours ?? []) {
        const start = `${pad(hour.openHour ?? 0)}:${pad(hour.openMinute ?? 0)}`;
        const end = `${pad(hour.closeHour ?? 0)}:${pad(hour.closeMinute ?? 0)}`;
        if (end <= start) continue;
        (schedule[key] ??= []).push({ end, start });
      }
    }
  }

  for (const key of Object.keys(schedule) as Array<keyof WeeklySchedule>) {
    schedule[key] = [...(schedule[key] ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  }
  return Object.keys(schedule).length > 0 ? schedule : null;
}

/** Duración del hueco en minutos (`slotDuration` + `slotDurationUnit`). */
export function ghlSlotMinutes(duration: unknown, unit: unknown, fallback = 30) {
  const value = typeof duration === "number" && duration > 0 ? duration : null;
  if (!value) return fallback;
  return Math.round(unit === "hours" || unit === "hour" ? value * 60 : value);
}

// --- Flujos ---------------------------------------------------------------------

export type FlowConversionContext = {
  /** Calendario de GHL → agenda nueva (la de «Consultoría Levi»). */
  calendarToAgenda?: Map<string, string>;
  /** Etapa de GHL (id) → etapa del CRM (id y nombre). */
  stageToCrm?: Map<string, { id: string; name: string }>;
};

/** Acción de GHL → del CRM, usando los mapeos que conoce la migración. */
export function convertActionWithContext(action: FlowGhlAction, context: FlowConversionContext): FlowCrmAction | null {
  const label = action.label || "Acción";
  if (action.type === "upsert_opportunity" && action.stageId) {
    const stage = context.stageToCrm?.get(action.stageId);
    return stage ? { engine: "crm", label, stageId: stage.id, stageName: stage.name, type: "set_stage" } : null;
  }
  if (action.type === "set_booking_calendar" && action.calendarId) {
    const agendaId = context.calendarToAgenda?.get(action.calendarId);
    return agendaId ? { agendaId, engine: "crm", label, type: "set_booking_agenda" } : null;
  }
  return convertGhlActionToCrm(action);
}

/** Convierte las acciones `ghl_action` de los pasos en `crm_action`. Las que no tienen equivalente se quedan. */
export function convertFlowSteps(steps: unknown, context: FlowConversionContext = {}) {
  const list = Array.isArray(steps) ? (steps as FlowStep[]) : [];
  let converted = 0;
  const unconverted: string[] = [];

  const next = list.map((step) => {
    if (!Array.isArray(step.actions) || step.actions.length === 0) return step;
    const { crm, legacy } = splitStepActions(step.actions);
    const kept: unknown[] = [];
    const created: unknown[] = [];
    for (const action of legacy) {
      const crmAction = convertActionWithContext(action, context);
      if (crmAction) {
        created.push(crmAction);
        converted += 1;
      } else {
        kept.push(action);
        unconverted.push(`${step.name}: ${action.label || action.type}`);
      }
    }
    return { ...step, actions: [...crm, ...created, ...kept] as FlowStep["actions"] };
  });

  return { converted, steps: next, unconverted };
}

// --- Tools de texto -----------------------------------------------------------------

/** Propuesta de texto sin GoHighLevel para una tool (el usuario la revisa antes). */
export function proposeToolText(title: string, content: string) {
  const replace = (value: string) =>
    value
      // «Requiere GoHighLevel conectado…»: la agenda propia no se conecta.
      .replace(/\s*Requiere\s+(?:Go\s?High\s?Level|GHL)\b[^.]*\.?/gi, "")
      .replace(/\b(?:en )?el calendario de (?:Go\s?High\s?Level|GHL)\b/gi, (match) => (match.toLowerCase().startsWith("en") ? "en la agenda" : "la agenda"))
      .replace(/\bGo\s?High\s?Level\b/gi, "la agenda")
      .replace(/\bGHL\b/g, "la agenda")
      .replace(/(?:la agenda de )+la agenda/gi, "la agenda")
      .replace(/,\s*calendario\b/gi, "")
      .replace(/\s+y calendario\b/gi, "")
      .trim();
  return { content: replace(content), title: replace(title).replace(/^Agendar en la agenda$/i, "Agendar cita") };
}
