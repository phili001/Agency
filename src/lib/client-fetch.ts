export const OFFLINE_ERROR = "Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";

/**
 * `fetch` para componentes de cliente. Si la red falla, devuelve una respuesta
 * 503 con `{ error }` en vez de lanzar: así cada pantalla muestra su mensaje de
 * error y suelta el botón, en lugar de quedarse «Guardando…» para siempre.
 */
export async function clientFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return new Response(JSON.stringify({ error: OFFLINE_ERROR }), {
      headers: { "Content-Type": "application/json" },
      status: 503,
    });
  }
}
