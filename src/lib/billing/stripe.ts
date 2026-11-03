import "server-only";

import Stripe from "stripe";

import { getBillingConfig } from "./config.ts";

let cached: { client: Stripe; key: string } | null = null;

/** Cliente de Stripe del servidor. Falla con un mensaje claro si falta la clave. */
export function getStripe(env: Record<string, string | undefined> = process.env) {
  const { secretKey } = getBillingConfig(env);

  if (!secretKey) {
    throw new Error("Falta STRIPE_SECRET_KEY: la venta con Stripe no está configurada.");
  }
  if (cached?.key !== secretKey) {
    cached = { client: new Stripe(secretKey, { appInfo: { name: "AgenteLevy" } }), key: secretKey };
  }
  return cached.client;
}
