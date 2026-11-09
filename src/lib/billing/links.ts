function parsePaymentLink(baseUrl: string | null | undefined) {
  const raw = baseUrl?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Enlace al Payment Link para quien compra desde la landing, o null si no es válido. */
export function publicPaymentLinkUrl(baseUrl: string | null | undefined) {
  return parsePaymentLink(baseUrl)?.toString() ?? null;
}

/**
 * Enlace al Payment Link de Levy para pagar o reactivar desde el panel. Lleva
 * `client_reference_id` (la empresa) y `prefilled_email` (el owner): el
 * webhook solo usa la referencia si el correo del pago es el del owner.
 */
export function buildPaymentLinkUrl(baseUrl: string | null | undefined, { email, workspaceId }: { email: string | null; workspaceId: string }) {
  const url = parsePaymentLink(baseUrl);
  if (!url) return null;

  url.searchParams.set("client_reference_id", workspaceId);
  if (email) url.searchParams.set("prefilled_email", email.trim().toLowerCase());
  return url.toString();
}

const CUSTOMER_PATTERN = /^cus_[A-Za-z0-9]{6,64}$/;

/** Id de cliente de Stripe válido (`cus_…`), o null. */
export function normalizeStripeCustomerId(value: unknown) {
  const id = typeof value === "string" ? value.trim() : "";
  return CUSTOMER_PATTERN.test(id) ? id : null;
}
