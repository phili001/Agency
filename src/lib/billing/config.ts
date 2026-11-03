/**
 * Variables de la venta con Stripe, leídas y validadas en un solo sitio (sin
 * importar el SDK, para poder probarlo). Ninguna se registra en logs.
 */

export const DEFAULT_GRACE_DAYS = 7;
export const DEFAULT_COMPANY_FIELD = "nombredelnegocio";

export type BillingConfig = {
  companyField: string;
  graceDays: number;
  paymentLinkIds: string[];
  priceIds: string[];
  secretKey: string | null;
  webhookSecret: string | null;
};

function list(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getBillingConfig(env: Record<string, string | undefined> = process.env): BillingConfig {
  const grace = Number.parseInt(env.BILLING_GRACE_DAYS ?? "", 10);

  return {
    companyField: env.STRIPE_FIELD_COMPANY_NAME?.trim() || DEFAULT_COMPANY_FIELD,
    graceDays: Number.isInteger(grace) && grace >= 0 && grace <= 60 ? grace : DEFAULT_GRACE_DAYS,
    paymentLinkIds: list(env.STRIPE_PAYMENT_LINK_IDS),
    priceIds: list(env.STRIPE_PRICE_IDS),
    secretKey: env.STRIPE_SECRET_KEY?.trim() || null,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() || null,
  };
}

/** ¿Este pago es de Levy? Por Payment Link o por algún precio configurado. */
export function isLevyPurchase(
  config: Pick<BillingConfig, "paymentLinkIds" | "priceIds">,
  purchase: { paymentLinkId?: string | null; priceIds?: Array<string | null | undefined> },
) {
  if (purchase.paymentLinkId && config.paymentLinkIds.includes(purchase.paymentLinkId)) {
    return true;
  }
  return (purchase.priceIds ?? []).some((price) => Boolean(price) && config.priceIds.includes(price as string));
}
