import { invalid } from "../crm/errors.ts";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  getZonedParts,
  isoWeekdayOfDateKey,
  isValidTimeZone,
  parseClockTime,
  zonedDateTime,
} from "../timezones.ts";

/**
 * Huecos libres de una agenda. Portado de crm-levy `services/agenda.py`
 * (`huecos_del_dia`, `_espaciados`, `repartir`, `resolver_servicio`) y de
 * `schedule_config.py`. Todo puro: las citas, bloqueos y el «ocupado» de
 * Google llegan ya como intervalos (`busy`), y `now` se pasa desde fuera para
 * poder probarlo.
 *
 * Las horas del horario son de pared en la zona de la agenda; los huecos son
 * instantes. Así un cambio de hora no mueve la apertura: si se abre a las
 * 09:00, se abre a las 09:00 locales antes y después del cambio.
 */

export const DEFAULT_SERVICE_MINUTES = 30;
const MIN_SERVICE_MINUTES = 5;
const MAX_SERVICE_MINUTES = 8 * 60;

export type ScheduleSegment = { end: string; start: string };
/** Clave = día ISO ("1" = lunes … "7" = domingo). */
export type WeeklySchedule = Partial<Record<"1" | "2" | "3" | "4" | "5" | "6" | "7", ScheduleSegment[]>>;
export type AgendaService = { durationMinutes: number; name: string };

export type AgendaConfig = {
  closedDates: string[];
  maxDaysAhead: number;
  minNoticeMinutes: number;
  schedule: WeeklySchedule;
  services: AgendaService[];
  slotStepMinutes: number;
  timezone: string;
};

export type Interval = { end: Date; start: Date };
export type Slot = Interval & { dateKey: string };

const DAY_KEYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

/** Horario de una agenda nueva: lunes a viernes de 9 a 18 (igual que el default de la columna). */
export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  "1": [{ end: "18:00", start: "09:00" }],
  "2": [{ end: "18:00", start: "09:00" }],
  "3": [{ end: "18:00", start: "09:00" }],
  "4": [{ end: "18:00", start: "09:00" }],
  "5": [{ end: "18:00", start: "09:00" }],
};
const WEEKDAY_PLURALS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];

// --- Configuración -----------------------------------------------------------

function parseSegments(raw: unknown, strict: boolean, day: string): ScheduleSegment[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    if (strict) throw invalid(`El horario del día ${day} tiene que ser una lista de tramos.`);
    return [];
  }

  const segments: Array<ScheduleSegment & { from: number; to: number }> = [];

  for (const item of raw) {
    const start = typeof item?.start === "string" ? item.start : "";
    const end = typeof item?.end === "string" ? item.end : "";
    const from = parseClockTime(start);
    const to = parseClockTime(end);

    if (from === null || to === null || to <= from || from === 24 * 60) {
      if (strict) throw invalid(`Tramo no válido el día ${day}: usa HH:MM y que el fin sea posterior al inicio.`);
      continue;
    }

    segments.push({ end, from, start, to });
  }

  segments.sort((a, b) => a.from - b.from);

  for (let i = 1; i < segments.length; i += 1) {
    if (segments[i].from < segments[i - 1].to) {
      if (strict) throw invalid(`Los tramos del día ${day} se solapan.`);
      segments.splice(i, 1);
      i -= 1;
    }
  }

  return segments.map(({ end, start }) => ({ end, start }));
}

function parseSchedule(raw: unknown, strict: boolean): WeeklySchedule {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const schedule: WeeklySchedule = {};

  if (strict) {
    for (const key of Object.keys(record)) {
      if (!(DAY_KEYS as readonly string[]).includes(key)) {
        throw invalid("El horario solo admite los días 1 (lunes) a 7 (domingo).");
      }
    }
  }

  for (const day of DAY_KEYS) {
    const segments = parseSegments(record[day], strict, day);
    if (segments.length > 0) {
      schedule[day] = segments;
    }
  }

  return schedule;
}

function parseServices(raw: unknown, strict: boolean): AgendaService[] {
  if (!Array.isArray(raw)) {
    if (strict && raw !== undefined && raw !== null) throw invalid("Los servicios tienen que ser una lista.");
    return [];
  }

  const services: AgendaService[] = [];

  for (const item of raw) {
    const name = typeof item?.name === "string" ? item.name.trim().slice(0, 120) : "";
    const duration = Number(item?.duration_minutes ?? item?.durationMinutes);

    if (!name || !Number.isInteger(duration) || duration < MIN_SERVICE_MINUTES || duration > MAX_SERVICE_MINUTES) {
      if (strict) throw invalid("Cada servicio necesita nombre y una duración entre 5 y 480 minutos.");
      continue;
    }
    if (services.some((service) => normalizeText(service.name) === normalizeText(name))) {
      if (strict) throw invalid(`El servicio «${name}» está repetido.`);
      continue;
    }

    services.push({ durationMinutes: duration, name });
  }

  return services;
}

function parseClosedDates(raw: unknown): string[] {
  return Array.isArray(raw)
    ? Array.from(new Set(raw.filter((item): item is string => typeof item === "string" && isoWeekdayOfDateKey(item) !== null))).sort()
    : [];
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(Math.max(number, min), max) : fallback;
}

/**
 * Configuración desde una fila de `agendas`. Tolerante: lo que no se entiende
 * se descarta (una agenda con un tramo roto no puede tumbar al agente). Para
 * validar lo que escribe el panel, `validateAgendaSettings`.
 */
export function agendaConfigFromRow(row: Record<string, unknown>): AgendaConfig {
  const timezone = typeof row.timezone === "string" && isValidTimeZone(row.timezone) ? row.timezone : "UTC";

  return {
    closedDates: parseClosedDates(row.closed_dates),
    maxDaysAhead: clampInt(row.max_days_ahead, 30, 1, 365),
    minNoticeMinutes: clampInt(row.min_notice_minutes, 60, 0, 43200),
    schedule: parseSchedule(row.schedule, false),
    services: parseServices(row.services, false),
    slotStepMinutes: clampInt(row.slot_step_minutes, 30, 5, 240),
    timezone,
  };
}

/** Valida lo que manda el panel. Lanza `CrmError("invalid")` con el motivo. */
export function validateAgendaSettings(input: {
  closedDates?: unknown;
  schedule?: unknown;
  services?: unknown;
  timezone?: unknown;
}) {
  const result: { closed_dates?: string[]; schedule?: WeeklySchedule; services?: Array<{ duration_minutes: number; name: string }>; timezone?: string } = {};

  if (input.timezone !== undefined) {
    if (typeof input.timezone !== "string" || !isValidTimeZone(input.timezone)) {
      throw invalid("Zona horaria no válida (usa una como Europe/Madrid o America/Bogota).");
    }
    result.timezone = input.timezone;
  }
  if (input.schedule !== undefined) {
    result.schedule = parseSchedule(input.schedule, true);
  }
  if (input.services !== undefined) {
    result.services = parseServices(input.services, true).map((service) => ({
      duration_minutes: service.durationMinutes,
      name: service.name,
    }));
  }
  if (input.closedDates !== undefined) {
    if (!Array.isArray(input.closedDates) || input.closedDates.some((item) => typeof item !== "string" || isoWeekdayOfDateKey(item) === null)) {
      throw invalid("Los festivos tienen que ser fechas AAAA-MM-DD.");
    }
    result.closed_dates = parseClosedDates(input.closedDates);
  }

  return result;
}

// --- Huecos ------------------------------------------------------------------

/** Por qué ese día no se atiende, en lenguaje llano. null = sí se abre. */
export function closedReason(dateKey: string, config: AgendaConfig) {
  if (config.closedDates.includes(dateKey)) {
    return "Ese día el negocio está cerrado (festivo).";
  }

  const weekday = isoWeekdayOfDateKey(dateKey);

  if (!weekday || !config.schedule[String(weekday) as (typeof DAY_KEYS)[number]]?.length) {
    return `El negocio no atiende los ${WEEKDAY_PLURALS[weekday ?? 0] ?? "días así"}.`;
  }

  return null;
}

function overlaps(start: Date, end: Date, busy: Interval[]) {
  return busy.some((interval) => start < interval.end && end > interval.start);
}

/**
 * Huecos libres de un día: tramos del horario, sin lo ocupado, lo pasado, lo
 * que no da la antelación mínima ni lo que pasa del máximo de días.
 */
export function daySlots(
  dateKey: string,
  durationMinutes: number,
  busy: Interval[],
  config: AgendaConfig,
  now: Date,
): Slot[] {
  if (closedReason(dateKey, config)) {
    return [];
  }

  const weekday = String(isoWeekdayOfDateKey(dateKey)) as (typeof DAY_KEYS)[number];
  const floor = new Date(now.getTime() + config.minNoticeMinutes * 60_000);
  const ceiling = new Date(now.getTime() + config.maxDaysAhead * 24 * 60 * 60_000);
  const durationMs = durationMinutes * 60_000;
  const slots: Slot[] = [];

  for (const segment of config.schedule[weekday] ?? []) {
    const from = parseClockTime(segment.start) ?? 0;
    const to = parseClockTime(segment.end) ?? 0;
    const segmentEnd = zonedDateTime(dateKey, segment.end, config.timezone);

    if (!segmentEnd) {
      continue;
    }

    for (let minute = from; minute + durationMinutes <= to; minute += config.slotStepMinutes) {
      const clock = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const start = zonedDateTime(dateKey, clock, config.timezone);

      // La hora no existe ese día (adelanto del reloj): no se ofrece.
      if (!start) {
        continue;
      }

      const end = new Date(start.getTime() + durationMs);

      if (end > segmentEnd || start < floor || start > ceiling || overlaps(start, end, busy)) {
        continue;
      }

      slots.push({ dateKey, end, start });
    }
  }

  return slots;
}

/** Huecos libres de `fromDateKey` a `toDateKey` (ambos incluidos), en orden. */
export function freeSlots(
  fromDateKey: string,
  toDateKey: string,
  durationMinutes: number,
  busy: Interval[],
  config: AgendaConfig,
  now: Date,
) {
  const lastAllowed = addDaysToDateKey(dateKeyInTimeZone(config.timezone, now), config.maxDaysAhead);
  const last = toDateKey < lastAllowed ? toDateKey : lastAllowed;
  const slots: Slot[] = [];

  for (let day = fromDateKey; day <= last; day = addDaysToDateKey(day, 1)) {
    slots.push(...daySlots(day, durationMinutes, busy, config, now));
  }

  return slots;
}

/** Si en ese instante se atiende (día abierto y dentro de un tramo). */
export function isOpenAt(instant: Date, config: AgendaConfig) {
  const parts = getZonedParts(instant, config.timezone);

  if (closedReason(parts.dateKey, config)) {
    return false;
  }

  return (config.schedule[String(parts.isoWeekday) as (typeof DAY_KEYS)[number]] ?? []).some((segment) => {
    const from = parseClockTime(segment.start) ?? 0;
    const to = parseClockTime(segment.end) ?? 0;
    return parts.minuteOfDay >= from && parts.minuteOfDay < to;
  });
}

// --- Qué ofrecer -------------------------------------------------------------

/** `count` elementos repartidos de punta a punta de la lista. */
export function spaced<T>(list: T[], count: number): T[] {
  if (count >= list.length) {
    return [...list];
  }
  if (count <= 0) {
    return [];
  }
  if (count === 1) {
    return [list[0]];
  }

  const indices = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    indices.add(Math.round((i * (list.length - 1)) / (count - 1)));
  }

  return [...indices].sort((a, b) => a - b).map((index) => list[index]);
}

/**
 * Qué huecos ofrecer. Los N primeros caían todos a primera hora; con una hora
 * preferida (minutos desde medianoche local) se dan los más cercanos a ella;
 * sin ella, repartidos por el día y, si hay varios días, unos cuantos de cada.
 */
export function distributeSlots(
  slots: Slot[],
  count: number,
  timezone: string,
  preferredMinuteOfDay?: number | null,
) {
  if (count <= 0 || slots.length === 0) {
    return [];
  }

  if (preferredMinuteOfDay !== null && preferredMinuteOfDay !== undefined) {
    const distance = (slot: Slot) =>
      Math.abs(getZonedParts(slot.start, timezone).minuteOfDay - preferredMinuteOfDay);

    return [...slots]
      .sort((a, b) => distance(a) - distance(b) || a.start.getTime() - b.start.getTime())
      .slice(0, count)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  const byDay = new Map<string, Slot[]>();
  for (const slot of slots) {
    byDay.set(slot.dateKey, [...(byDay.get(slot.dateKey) ?? []), slot]);
  }

  const quota = Math.ceil(count / byDay.size);
  const chosen: Slot[] = [];

  for (const daySlotList of byDay.values()) {
    chosen.push(...spaced(daySlotList, Math.min(quota, count - chosen.length)));
    if (chosen.length >= count) {
      break;
    }
  }

  return chosen;
}

// --- Servicios ---------------------------------------------------------------

/** Minúsculas, sin acentos y con los espacios de uno en uno. */
export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function weightyWords(text: string) {
  return new Set(
    text
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter((word) => word.length >= 4),
  );
}

/**
 * Del texto libre del modelo («una limpieza») al servicio del catálogo:
 * primero igual, luego contenido en cualquier sentido, luego el que comparta
 * más palabras si no hay empate. Si no casa, se usa lo que dijo con la
 * duración por defecto: mejor una cita de 30 min con su nombre que ninguna.
 */
export function resolveService(text: string | null | undefined, catalog: AgendaService[]): AgendaService {
  const wanted = normalizeText(text);

  if (!wanted) {
    return { durationMinutes: DEFAULT_SERVICE_MINUTES, name: "Cita" };
  }

  const exact = catalog.find((service) => normalizeText(service.name) === wanted);
  if (exact) {
    return exact;
  }

  if (wanted.length >= 4) {
    const contained = catalog.find((service) => {
      const name = normalizeText(service.name);
      return wanted.includes(name) || name.includes(wanted);
    });
    if (contained) {
      return contained;
    }
  }

  const words = weightyWords(wanted);
  const scores = catalog.map((service) => {
    const serviceWords = weightyWords(normalizeText(service.name));
    return { score: [...words].filter((word) => serviceWords.has(word)).length, service };
  });
  const best = Math.max(0, ...scores.map((item) => item.score));
  const winners = scores.filter((item) => item.score > 0 && item.score === best);

  if (winners.length === 1) {
    return winners[0].service;
  }

  return { durationMinutes: DEFAULT_SERVICE_MINUTES, name: (text ?? "").trim().slice(0, 120) };
}

// --- Texto -------------------------------------------------------------------

/** «lunes 7 de septiembre, 10:30» en la zona de la agenda. */
export function formatSlotLabel(start: Date, timezone: string) {
  const day = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    timeZone: timezone,
    weekday: "long",
  }).format(start);
  const time = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: timezone,
  }).format(start);

  // es-ES escribe «lunes, 7 de septiembre»: sin esa coma se lee mejor en un mensaje.
  return `${day.replace(",", "")}, ${time}`;
}
