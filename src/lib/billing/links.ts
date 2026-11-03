/**
 * Enlace al Payment Link de Levy para pagar o reactivar desde el panel. Lleva
 * `client_reference_id` (la empresa) y `prefilled_email` (el owner): el
 * webhook solo usa la referencia si el correo del pago es el del owner.
 */
export function buildPaymentLinkUrl(baseUrl: string | null | undefined, { email, workspaceId }: { email: string | null; workspaceId: string }) {
  const raw = baseUrl?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

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
