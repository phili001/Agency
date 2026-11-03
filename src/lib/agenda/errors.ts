import type { DbError } from "../crm/errors.ts";

/**
 * Rechazos de la agenda, en lenguaje llano. Los lanza la base con SQLSTATE
 * propios (`book_appointment`/`reschedule_appointment`, F1.4) y aquí se
 * traducen. Como `CrmError`, `apiErrorResponse` los reconoce por `userFacing`.
 */
export type AgendaErrorCode =
  | "agenda_inactive"
  | "blocked"
  | "invalid"
  | "not_active"
  | "not_found"
  | "not_offered"
  | "outside_hours"
  | "slot_taken";

const STATUS: Record<AgendaErrorCode, number> = {
  agenda_inactive: 409,
  blocked: 409,
  invalid: 400,
  not_active: 409,
  not_found: 404,
  not_offered: 409,
  outside_hours: 409,
  slot_taken: 409,
};

const DEFAULT_MESSAGES: Record<AgendaErrorCode, string> = {
  agenda_inactive: "La agenda está desactivada.",
  blocked: "Ese horario está bloqueado.",
  invalid: "Datos de la cita no válidos.",
  not_active: "Esa cita no existe o ya no está activa.",
  not_found: "No se encontró en esta empresa.",
  not_offered: "Ese horario no se le ofreció a esta persona en los últimos 30 minutos.",
  outside_hours: "Esa hora está fuera del horario de atención.",
  slot_taken: "Ese horario ya está ocupado.",
};

export class AgendaError extends Error {
  readonly code: AgendaErrorCode;
  readonly status: number;
  readonly userFacing = true;

  constructor(code: AgendaErrorCode, message = DEFAULT_MESSAGES[code]) {
    super(message);
    this.name = "AgendaError";
    this.code = code;
    this.status = STATUS[code];
  }
}

const SQLSTATE_CODES: Record<string, AgendaErrorCode> = {
  "23P01": "slot_taken",
  LVA01: "agenda_inactive",
  LVB01: "blocked",
  LVH01: "outside_hours",
  LVN01: "not_offered",
  LVS01: "slot_taken",
  LVW01: "not_found",
  LVX01: "not_active",
};

/**
 * Error de la base → `AgendaError` si es uno de los rechazos conocidos (con el
 * mensaje que escribió la función SQL, que ya está en español); null si no.
 */
export function translateAgendaDbError(error: DbError) {
  const code = error?.code ? SQLSTATE_CODES[error.code] : undefined;

  if (!error || !code) {
    return null;
  }

  // El 23P01 crudo trae el texto técnico de Postgres: mejor el nuestro.
  return new AgendaError(code, error.code === "23P01" ? DEFAULT_MESSAGES[code] : error.message || DEFAULT_MESSAGES[code]);
}
