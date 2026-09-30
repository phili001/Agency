/**
 * Compra de Levy desde el funnel de GoHighLevel. El workflow "Crear cuenta"
 * manda un webhook normal de GHL: los datos del contacto van en la raiz y los
 * pares que configuramos a mano, dentro de `customData`. Aqui solo se lee y se
 * normaliza; quien decide si se crea la cuenta es la ruta del webhook.
 */

/** Etiqueta que pone el workflow de pago. Sin ella no se crea ninguna cuenta. */
export const PAID_TAG = "cliente-levy";
/** La pone Levy al crear la cuenta; dispara el correo con el acceso. */
export const ACCESS_READY_TAG = "levy-acceso-listo";
/** La pone Levy cuando el cliente termina la configuración guiada. */
export const ACTIVE_TAG = "levy-activo";

/** Campos personalizados del contacto en la location de la agencia. */
export const GHL_FIELD_ACCESS_LINK = "levy_link_acceso";
export const GHL_FIELD_WORKSPACE_ID = "levy_workspace_id";
export const GHL_FIELD_COMPANY_NAME = "nombre_del_negocio";

export type PurchasePayload = {
  companyName: string | null;
  email: string | null;
  firstName: string | null;
  ghlContactId: string | null;
  phone: string | null;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(sources: Record<string, unknown>[], keys: string[]) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];

      // GHL deja el merge tag tal cual cuando el campo esta vacio.
      if (typeof value === "string" && value.trim() && !/^\{\{.*\}\}$/.test(value.trim())) {
        return value.trim();
      }
    }
  }

  return null;
}

export function parsePurchasePayload(body: unknown): PurchasePayload {
  const root = asRecord(body);
  // customData primero: son los valores que elegimos en el workflow.
  const sources = [asRecord(root.customData), root];
  const email = pickString(sources, ["email"]);

  return {
    companyName: pickString(sources, ["companyName", GHL_FIELD_COMPANY_NAME]),
    email: email ? email.toLowerCase() : null,
    firstName: pickString(sources, ["firstName", "first_name"]),
    ghlContactId: pickString(sources, ["ghlContactId", "contact_id", "contactId"]),
    phone: pickString(sources, ["phone"]),
  };
}

export function hasPaidTag(tags: unknown) {
  return (
    Array.isArray(tags) &&
    tags.some((tag) => typeof tag === "string" && tag.trim().toLowerCase() === PAID_TAG)
  );
}

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
