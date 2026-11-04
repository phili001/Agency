import "server-only";

import { NextResponse } from "next/server";

/**
 * Error cuyo mensaje SI se le puede mostrar al usuario final.
 *
 * Todo lo que no sea un ApiError se considera un fallo inesperado: se registra
 * en el servidor y al cliente le llega un mensaje generico. Sin esta separacion
 * las rutas devolvian `error.message` crudo y filtraban detalles internos de
 * Supabase u OpenAI al navegador.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function badRequest(message: string) {
  return new ApiError(message, 400);
}

export function unauthorized(message = "No has iniciado sesión.") {
  return new ApiError(message, 401);
}

export function forbidden(message = "No tienes permisos para este espacio.") {
  return new ApiError(message, 403);
}

export function notFound(message = "No se encontró el recurso.") {
  return new ApiError(message, 404);
}

/**
 * Errores de módulos que no pueden importar este archivo (por `next/server`)
 * pero cuyo mensaje sí es para el usuario, como `CrmError`.
 */
function isUserFacingError(error: unknown): error is Error & { status: number } {
  return (
    error instanceof Error &&
    (error as { userFacing?: unknown }).userFacing === true &&
    typeof (error as { status?: unknown }).status === "number"
  );
}

/**
 * Convierte cualquier excepcion en una respuesta JSON coherente.
 * `context` solo se usa para el log del servidor, nunca viaja al cliente.
 */
export function apiErrorResponse(error: unknown, context: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (isUserFacingError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(`[api:${context}]`, error);

  return NextResponse.json(
    {
      error:
        "Ocurrió un error inesperado. Vuelve a intentarlo y, si sigue fallando, avisa a soporte.",
    },
    { status: 500 },
  );
}
