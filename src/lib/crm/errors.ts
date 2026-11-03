/**
 * Error del CRM cuyo mensaje se puede enseñar al usuario. `apiErrorResponse`
 * lo reconoce por `userFacing` (no por clase) para que este módulo no importe
 * `next/server` y se pueda probar con `node --test`.
 */
export type CrmErrorCode = "conflict" | "invalid" | "not_found";

const STATUS: Record<CrmErrorCode, number> = {
  conflict: 409,
  invalid: 400,
  not_found: 404,
};

export class CrmError extends Error {
  readonly code: CrmErrorCode;
  readonly status: number;
  readonly userFacing = true;

  constructor(code: CrmErrorCode, message: string) {
    super(message);
    this.name = "CrmError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export function invalid(message: string) {
  return new CrmError("invalid", message);
}

export function notFound(message = "No se encontró en esta empresa.") {
  return new CrmError("not_found", message);
}

export function conflict(message: string) {
  return new CrmError("conflict", message);
}

/** Error de PostgREST/Postgres: lo que devuelve supabase-js en `error`. */
export type DbError = { code?: string; message: string } | null;

export function isUniqueViolation(error: DbError) {
  return error?.code === "23505";
}

/** Fallo inesperado de la base: no se enseña al usuario (lo registra la ruta). */
export function dbFailure(context: string, error: NonNullable<DbError>) {
  return new Error(`[crm:${context}] ${error.code ?? ""} ${error.message}`.trim());
}
