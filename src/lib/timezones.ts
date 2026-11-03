/**
 * Zonas horarias IANA reales del navegador. La zona del negocio decide a que
 * hora se agenda, asi que no puede ser texto libre: "Colombia" o "GMT-5" no son
 * zonas validas y se descartarian en silencio al consultar el calendario.
 */
export function getTimeZoneOptions() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

/** Zona del navegador, para proponerla como valor inicial. */
export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/**
 * "GMT+2" para enseñar la diferencia horaria sin jerga. Se calcula con el
 * desfase actual, que es estable salvo el día del cambio de hora.
 */
export function getZoneOffsetLabel(zone: string) {
  try {
    const parts = new Intl.DateTimeFormat("es-ES", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());

    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

// --- Cálculo con zonas horarias (servidor y navegador) ----------------------
// Sin dependencias: lo usan la agenda (`src/lib/agenda`), el agente y el panel.
// Las fechas sin hora van como "YYYY-MM-DD" (dateKey) y las horas locales como
// "HH:MM"; los instantes, como `Date`.

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export type ZonedParts = {
  /** "YYYY-MM-DD" en la zona. */
  dateKey: string;
  day: number;
  hour: number;
  /** 1 = lunes … 7 = domingo, como `isodow` de Postgres. */
  isoWeekday: number;
  minute: number;
  month: number;
  /** Minutos desde la medianoche local (0–1439). */
  minuteOfDay: number;
  second: number;
  year: number;
};

const WEEKDAYS: Record<string, number> = {
  Fri: 5,
  Mon: 1,
  Sat: 6,
  Sun: 7,
  Thu: 4,
  Tue: 2,
  Wed: 3,
};

/** Fecha y hora de pared de un instante en una zona. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    weekday: "short",
    year: "numeric",
  }).formatToParts(date);
  const map: Record<string, string> = {};

  for (const part of parts) {
    map[part.type] = part.value;
  }

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour) % 24;
  const minute = Number(map.minute);

  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    day,
    hour,
    isoWeekday: WEEKDAYS[map.weekday] ?? 0,
    minute,
    minuteOfDay: hour * 60 + minute,
    month,
    second: Number(map.second),
    year,
  };
}

function timeZoneOffsetMs(timeZone: string, date: Date) {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    return null;
  }

  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));

  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }

  return { day, month, year };
}

/** "HH:MM" → minutos desde medianoche. Admite "24:00" (fin del día). */
export function parseClockTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) {
    return null;
  }

  return hours * 60 + minutes;
}

function wallClockToInstant(
  dateKey: string,
  minuteOfDay: number,
  timeZone: string,
) {
  const date = parseDateKey(dateKey);

  if (!date || !isValidTimeZone(timeZone)) {
    return null;
  }

  const wallClockAsUtc = Date.UTC(date.year, date.month - 1, date.day, 0, minuteOfDay);
  const firstOffset = timeZoneOffsetMs(timeZone, new Date(wallClockAsUtc));
  let epoch = wallClockAsUtc - firstOffset;
  // Segunda pasada por si el primer instante caia en un cambio de horario.
  const secondOffset = timeZoneOffsetMs(timeZone, new Date(epoch));

  if (secondOffset !== firstOffset) {
    epoch = wallClockAsUtc - secondOffset;
  }

  return new Date(epoch);
}

/**
 * Convierte "YYYY-MM-DD" al instante real de medianoche en la zona horaria de
 * esa empresa. Sin esto, `new Date("2026-08-06T00:00:00")` se interpreta en la
 * zona del servidor (UTC en Vercel), asi que el rango se corre varias horas y
 * de forma distinta para cada empresa segun su pais.
 */
export function zonedStartOfDay(dateKey: string, timeZone: string) {
  return wallClockToInstant(dateKey, 0, timeZone);
}

/**
 * Instante de una hora de pared ("HH:MM") de un día en una zona. Devuelve null
 * si esa hora no existe ese día (el salto del cambio de hora: en Madrid, el 29
 * de marzo de 2026 no hay 02:30). Si existe dos veces (al atrasar la hora),
 * devuelve la primera.
 */
export function zonedDateTime(dateKey: string, clockTime: string, timeZone: string) {
  const minuteOfDay = parseClockTime(clockTime);

  if (minuteOfDay === null) {
    return null;
  }

  if (minuteOfDay === 24 * 60) {
    return zonedStartOfDay(addDaysToDateKey(dateKey, 1), timeZone);
  }

  const instant = wallClockToInstant(dateKey, minuteOfDay, timeZone);

  if (!instant) {
    return null;
  }

  const parts = getZonedParts(instant, timeZone);

  if (parts.dateKey !== dateKey || parts.minuteOfDay !== minuteOfDay) {
    return null;
  }

  // Hora repetida al atrasar el reloj: la misma hora de pared una hora antes
  // también existe y es la primera.
  const earlier = new Date(instant.getTime() - 60 * 60 * 1000);
  const earlierParts = getZonedParts(earlier, timeZone);

  if (earlierParts.dateKey === dateKey && earlierParts.minuteOfDay === minuteOfDay) {
    return earlier;
  }

  return instant;
}

/** "YYYY-MM-DD" de hoy (o de `now`) en la zona. */
export function dateKeyInTimeZone(timeZone: string, now = new Date()) {
  return getZonedParts(now, timeZone).dateKey;
}

/** Suma días de calendario a "YYYY-MM-DD" (sin zona: no hay cambio de hora). */
export function addDaysToDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return dateKey;
  }

  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12));

  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** 1 = lunes … 7 = domingo para "YYYY-MM-DD" (independiente de la zona). */
export function isoWeekdayOfDateKey(dateKey: string) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return null;
  }

  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();

  return weekday === 0 ? 7 : weekday;
}
