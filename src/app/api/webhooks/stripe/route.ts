import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { createCompanyWithOwner, findAuthUserByEmail } from "@/lib/admin-companies";
import { normalizeAppUrl } from "@/lib/app-url";
import { syncAgencyContact } from "@/lib/billing/agency-crm";
import { getBillingConfig } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { processStripeEvent, verifyStripeEvent } from "@/lib/billing/webhook";
import { buildWelcomeEmail, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWelcomeLink } from "@/lib/welcome";

/**
 * Webhook de Stripe (venta de Levy por Payment Link). Cuerpo crudo + firma;
 * la lógica está en `lib/billing/webhook.ts`. Responde 500 solo si el evento
 * falló, para que Stripe lo reintente; lo ignorado o repetido es 200.
 */
export async function POST(request: Request) {
  const config = getBillingConfig();

  if (!config.webhookSecret || !config.secretKey) {
    console.error("[stripe-webhook] Faltan STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET.");
    return NextResponse.json({ error: "Stripe no está configurado." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();
  const stripe = getStripe();

  const event = verifyStripeEvent(stripe.webhooks, rawBody, signature, config.webhookSecret);
  if (!event) {
    return NextResponse.json({ error: "Firma no válida." }, { status: 400 });
  }

  const admin = createAdminClient();
  const outcome = await processStripeEvent(event, {
    client: admin,
    config,
    createCompany: async ({ companyName, email }) => {
      const { workspace } = await createCompanyWithOwner({
        companyName,
        ownerEmail: email,
        // Nadie la conoce: el cliente pone la suya con el enlace de bienvenida.
        temporaryPassword: randomBytes(24).toString("base64url"),
      });
      return { workspaceId: workspace.id as string };
    },
    findUserEmailById: async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      return data.user?.email ?? null;
    },
    findUserIdByEmail: async (email) => (await findAuthUserByEmail(admin, email))?.id ?? null,
    sendWelcome: async ({ companyName, email }) => {
      const { data, error } = await admin.auth.admin.generateLink({ email, type: "recovery" });
      if (error || !data.properties?.hashed_token) {
        throw error ?? new Error("Supabase no devolvió el enlace de acceso.");
      }
      const link = buildWelcomeLink(normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL), data.properties.hashed_token);
      await sendEmail(buildWelcomeEmail({ companyName, link, to: email }));
    },
    stripe,
    syncAgencyContact: (input) => syncAgencyContact(admin, input),
  });

  // Solo id, tipo y resultado: nada del cliente en los logs.
  console.info(`[stripe-webhook] ${event.id} ${event.type} → ${outcome.result}${outcome.duplicate ? " (repetido)" : ""}`);

  if (outcome.result === "failed") {
    console.error(`[stripe-webhook] ${event.id} falló: ${outcome.detail ?? ""}`);
    return NextResponse.json({ error: "No se pudo procesar el evento." }, { status: 500 });
  }

  return NextResponse.json({ received: true, result: outcome.result });
}
