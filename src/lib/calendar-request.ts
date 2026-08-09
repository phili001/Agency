export type CalendarRequestMessage = {
  body: string | null;
  direction: string;
};

export type RequestedCalendarTime = {
  hours: number[];
  label: string;
  minute: number;
};

export type CalendarRequestContext = {
  dateKey: string | null;
  inheritedDate: boolean;
  time: RequestedCalendarTime | null;
};

const weekdays: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const months: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9:/.-]+/g, " ")
    .trim();
}

export function dateKeyInTimezone(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(text: string, todayKey: string) {
  const normalized = normalize(text);
  const iso = normalized.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);

  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  if (/\bpasado manana\b/.test(normalized)) {
    return addDaysToDateKey(todayKey, 2);
  }

  if (/\bmanana\b/.test(normalized)) {
    return addDaysToDateKey(todayKey, 1);
  }

  if (/\bhoy\b/.test(normalized)) {
    return todayKey;
  }

  const namedDate = normalized.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+(20\d{2}))?\b/,
  );

  if (namedDate) {
    const todayYear = Number(todayKey.slice(0, 4));
    const year = Number(namedDate[3] ?? todayYear);
    const month = months[namedDate[2]];
    const candidate = `${year}-${String(month).padStart(2, "0")}-${namedDate[1].padStart(2, "0")}`;
    return !namedDate[3] && candidate < todayKey
      ? `${year + 1}-${candidate.slice(5)}`
      : candidate;
  }

  const weekdayMatch = normalized.match(
    /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/,
  );

  if (!weekdayMatch) {
    return null;
  }

  const todayWeekday = new Date(`${todayKey}T12:00:00Z`).getUTCDay();
  const targetWeekday = weekdays[weekdayMatch[1]];
  const daysAhead = (targetWeekday - todayWeekday + 7) % 7;
  return addDaysToDateKey(todayKey, daysAhead);
}

type ParsedTime = {
  explicitMeridiem: "am" | "pm" | null;
  minute: number;
  rawHour: number;
};

function parseTime(text: string): ParsedTime | null {
  const normalized = normalize(text);
  const matches = [
    {
      kind: "minutes" as const,
      match: normalized.match(
        /\b(?:a\s+las?\s+)?(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/,
      ),
    },
    {
      kind: "hour" as const,
      match: normalized.match(/\ba\s+las?\s+(\d{1,2})\s*(am|pm)?\b/),
    },
    {
      kind: "hour" as const,
      match: normalized.match(/\b(\d{1,2})\s*(am|pm)\b/),
    },
  ]
    .filter((candidate) => candidate.match)
    .sort(
      (left, right) =>
        (left.match?.index ?? Number.MAX_SAFE_INTEGER) -
        (right.match?.index ?? Number.MAX_SAFE_INTEGER),
    );
  const candidate = matches[0];
  const match = candidate?.match;

  if (!match) {
    return null;
  }

  const rawHour = Number(match[1]);
  const minute = candidate.kind === "minutes" ? Number(match[2]) : 0;
  const meridiem = (candidate.kind === "minutes" ? match[3] : match[2]) as
    | "am"
    | "pm"
    | undefined;

  if (rawHour > 23 || minute > 59 || (meridiem && rawHour > 12)) {
    return null;
  }

  return { explicitMeridiem: meridiem ?? null, minute, rawHour };
}

function resolveRequestedTime(
  parsed: ParsedTime | null,
  inheritedMeridiem: "am" | "pm" | null,
): RequestedCalendarTime | null {
  if (!parsed) {
    return null;
  }

  const meridiem = parsed.explicitMeridiem ?? inheritedMeridiem;
  let hours: number[];

  if (meridiem === "pm") {
    hours = [parsed.rawHour === 12 ? 12 : parsed.rawHour + 12];
  } else if (meridiem === "am") {
    hours = [parsed.rawHour === 12 ? 0 : parsed.rawHour];
  } else if (parsed.rawHour > 12) {
    hours = [parsed.rawHour];
  } else if (parsed.rawHour >= 1 && parsed.rawHour <= 7) {
    hours = [parsed.rawHour, parsed.rawHour + 12];
  } else {
    hours = [parsed.rawHour];
  }

  const minuteLabel = String(parsed.minute).padStart(2, "0");
  const label = meridiem
    ? `${parsed.rawHour}:${minuteLabel} ${meridiem.toUpperCase()}`
    : `${parsed.rawHour}:${minuteLabel}${hours.length > 1 ? " (AM o PM)" : ""}`;

  return { hours, label, minute: parsed.minute };
}

export function resolveCalendarRequestContext(
  messages: CalendarRequestMessage[],
  timeZone: string,
  now = new Date(),
): CalendarRequestContext {
  const latestInboundIndex = messages.findLastIndex(
    (message) => message.direction === "inbound" && message.body?.trim(),
  );
  const latest = latestInboundIndex >= 0 ? messages[latestInboundIndex].body ?? "" : "";
  const todayKey = dateKeyInTimezone(timeZone, now);
  const directDate = parseDateKey(latest, todayKey);
  let inheritedDate: string | null = null;
  let inheritedMeridiem: "am" | "pm" | null = null;

  for (let index = latestInboundIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const body = message.body ?? "";

    if (!inheritedDate && message.direction === "inbound") {
      inheritedDate = parseDateKey(body, todayKey);
    }

    if (!inheritedMeridiem && message.direction === "inbound") {
      inheritedMeridiem = parseTime(body)?.explicitMeridiem ?? null;
    }

    if (inheritedDate && inheritedMeridiem) {
      break;
    }
  }

  return {
    dateKey: directDate ?? inheritedDate,
    inheritedDate: !directDate && Boolean(inheritedDate),
    time: resolveRequestedTime(parseTime(latest), inheritedMeridiem),
  };
}

export function slotMatchesRequestedTime(
  iso: string,
  timeZone: string,
  requested: RequestedCalendarTime,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour);
  const minute = Number(values.minute);

  return requested.hours.includes(hour) && requested.minute === minute;
}
