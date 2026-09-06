/**
 * Supabase devuelve sus errores en ingles. Mostrarlos tal cual rompe la
 * experiencia de un producto en español, asi que se traducen los casos reales y
 * el resto cae en un mensaje generico en vez de filtrar texto del proveedor.
 */
const authMessages: Array<{ match: RegExp; message: string }> = [
  {
    match: /invalid login credentials/i,
    message: "El email o la contraseña no son correctos.",
  },
  {
    match: /email not confirmed/i,
    message: "Tu email todavía no está confirmado. Revisa tu bandeja de entrada.",
  },
  {
    match: /user not found/i,
    message: "No encontramos una cuenta con ese email.",
  },
  {
    match: /email rate limit|over_email_send_rate_limit|too many requests|rate limit/i,
    message: "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.",
  },
  {
    match: /password should be at least|weak password/i,
    message: "La contraseña es demasiado corta. Usa mínimo 8 caracteres.",
  },
  {
    match: /new password should be different/i,
    message: "La nueva contraseña debe ser distinta de la anterior.",
  },
  {
    match: /token has expired|invalid.*token|expired/i,
    message: "El enlace caducó o ya se usó. Pide uno nuevo.",
  },
  {
    match: /same_password/i,
    message: "La nueva contraseña debe ser distinta de la anterior.",
  },
];

export function translateAuthError(message?: string | null) {
  const text = message?.trim();

  if (!text) {
    return "No pudimos completar la operación. Vuelve a intentarlo.";
  }

  return (
    authMessages.find((entry) => entry.match.test(text))?.message ??
    "No pudimos completar la operación. Vuelve a intentarlo."
  );
}
