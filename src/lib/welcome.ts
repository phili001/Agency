/**
 * Piezas del alta de una empresa tras pagar Levy que no dependen de dónde se
 * vendió.
 */

/**
 * Si el cliente no llego a rellenar el formulario, la empresa se crea con un
 * nombre provisional; lo corrige en el paso "Tu negocio" del onboarding.
 */
export function resolveCompanyName({
  companyName,
  email,
  firstName,
}: {
  companyName: string | null;
  email: string;
  firstName: string | null;
}) {
  const clean = companyName?.trim();

  if (clean) {
    return clean.slice(0, 120);
  }

  const who = firstName?.trim() || email.split("@")[0];
  return `Negocio de ${who}`.slice(0, 120);
}

/** Enlace de primer acceso: la ruta /auth/confirm canjea el token por sesion. */
export function buildWelcomeLink(appUrl: string, hashedToken: string) {
  const params = new URLSearchParams({
    next: "/reset-password?bienvenida=1",
    token_hash: hashedToken,
    type: "recovery",
  });

  return `${appUrl.replace(/\/$/, "")}/auth/confirm?${params.toString()}`;
}
