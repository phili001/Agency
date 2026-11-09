// Cookie de sesión de Supabase: sb-<ref>-auth-token, partida en .0, .1… si es
// grande. No incluye sb-<ref>-auth-token-code-verifier, que existe sin sesión.
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Solo mira si la cookie existe, sin validarla: basta para elegir entre la
 * landing y el panel, y el panel sigue comprobando la sesión por su cuenta.
 */
export function hasSessionCookie(cookieNames: readonly string[]) {
  return cookieNames.some((name) => SESSION_COOKIE.test(name));
}
