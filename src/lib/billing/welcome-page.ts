import type Stripe from "stripe";

import type { CrmClient } from "../crm/shared.ts";
import { normalizeAppUrl } from "../app-url.ts";
import { buildWelcomeEmail, sendSystemEmail, type EmailDeps } from "../email.ts";
import { buildWelcomeLink } from "../welcome.ts";
import { isLevyPurchase, type BillingConfig } from "./config.ts";
import { idOf, ownedWorkspaceId, workspaceInfo } from "./webhook.ts";

/**
 * Página `/bienvenida`, a la que vuelve el comprador desde el Payment Link.
 * Solo lee: quien crea la cuenta es siempre el webhook de Stripe. El enlace de
 * acceso solo viaja por correo; nunca se devuelve al navegador.
 */

export const WELCOME_RESEND_MAX_PER_HOUR = 3;

type WelcomeStripe = {
  checkout: { sessions: { retrieve: (id: string, params?: Stripe.Checkout.SessionRetrieveParams) => Promise<Stripe.Checkout.Session> } };
};

export type WelcomeDeps = {
  client: CrmClient;
  config: Pick<BillingConfig, "paymentLinkIds" | "priceIds">;
  findUserIdByEmail: (email: string) => Promise<string | null>;
  stripe: WelcomeStripe;
};

export type WelcomeState =
  /** Sesión que no existe, de otro producto o sin correo: no se dice cuál. */
  | { status: "not_found" }
  /** Pago aún sin confirmar (p. ej. transferencia). */
  | { status: "pending" }
  /** Pagado, pero el webhook todavía no ha dejado la cuenta lista. */
  | { email: string; status: "preparing" }
  | { companyName: string; email: string; status: "ready"; workspaceId: string };

export type WelcomeResendResult =
  | { email: string; ok: true }
  | { ok: false; reason: "not_ready" | "rate_limited" | "send_failed" };

export function isCheckoutSessionId(value: unknown): value is string {
  return typeof value === "string" && /^cs_[A-Za-z0-9_]{10,255}$/.test(value);
}

async function retrieveSession(sessionId: string, stripe: WelcomeStripe) {
  try {
    return await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items", "subscription"] });
  } catch (error) {
    // Stripe responde 404 a una sesión que no existe; lo demás es un fallo pasajero.
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }
}

async function billingWorkspace(client: CrmClient, column: "stripe_customer_id" | "workspace_id", value: string) {
  const { data, error } = await client.from("workspace_billing").select("workspace_id").eq(column, value).maybeSingle();
  if (error) throw new Error(`workspace_billing: ${error.message}`);
  return (data as { workspace_id: string } | null)?.workspace_id ?? null;
}

/** Misma regla que el webhook: se llega a «lista» solo cuando este ya ha guardado la facturación. */
export async function getWelcomeState(sessionId: unknown, deps: WelcomeDeps): Promise<WelcomeState> {
  if (!isCheckoutSessionId(sessionId)) return { status: "not_found" };

  const session = await retrieveSession(sessionId, deps.stripe);
  if (!session) return { status: "not_found" };

  const priceIds = session.line_items?.data?.map((item) => item.price?.id) ?? [];
  if (!isLevyPurchase(deps.config, { paymentLinkId: idOf(session.payment_link), priceIds })) {
    return { status: "not_found" };
  }

  const subscription = session.subscription as Stripe.Subscription | string | null;
  const trialing = typeof subscription === "object" && subscription?.status === "trialing";
  if (session.payment_status !== "paid" && !trialing) return { status: "pending" };

  const email = (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
  if (!email) return { status: "not_found" };

  const userId = await deps.findUserIdByEmail(email);
  if (!userId) return { email, status: "preparing" };

  const customerId = idOf(session.customer);
  const owned = customerId ? null : await ownedWorkspaceId(deps.client, userId);
  const workspaceId = customerId
    ? await billingWorkspace(deps.client, "stripe_customer_id", customerId)
    : owned && (await billingWorkspace(deps.client, "workspace_id", owned));
  if (!workspaceId) return { email, status: "preparing" };

  // El correo del pago tiene que ser el del dueño de esa empresa.
  const workspace = await workspaceInfo(deps.client, workspaceId);
  if (workspace?.owner_id !== userId) return { email, status: "preparing" };

  return { companyName: workspace.name, email, status: "ready", workspaceId };
}

export async function resendWelcomeAccess(
  sessionId: unknown,
  deps: WelcomeDeps & { send: (input: { companyName: string; email: string }) => Promise<void> },
): Promise<WelcomeResendResult> {
  const state = await getWelcomeState(sessionId, deps);
  if (state.status !== "ready") return { ok: false, reason: "not_ready" };

  const { data, error } = await deps.client.rpc("claim_welcome_resend", {
    p_max: WELCOME_RESEND_MAX_PER_HOUR,
    p_workspace_id: state.workspaceId,
  });
  if (error) throw new Error(`claim_welcome_resend: ${error.message}`);
  if (data !== true) return { ok: false, reason: "rate_limited" };

  try {
    await deps.send({ companyName: state.companyName, email: state.email });
  } catch (sendError) {
    console.error(`[bienvenida] correo no enviado: ${sendError instanceof Error ? sendError.message : "error"}`);
    return { ok: false, reason: "send_failed" };
  }

  return { email: state.email, ok: true };
}

type RecoveryLinkAdmin = {
  auth: {
    admin: {
      generateLink: (params: { email: string; type: "recovery" }) => Promise<{
        data: { properties?: { hashed_token?: string } | null };
        error: Error | null;
      }>;
    };
  };
};

/** Correo con el enlace de primer acceso. Lo usan el webhook de Stripe y «Reenviar». */
export async function sendWelcomeAccess(
  admin: CrmClient & RecoveryLinkAdmin,
  { companyName, email }: { companyName: string; email: string },
  deps: EmailDeps = {},
) {
  const { data, error } = await admin.auth.admin.generateLink({ email, type: "recovery" });
  const hashedToken = data.properties?.hashed_token;
  if (error || !hashedToken) {
    throw error ?? new Error("Supabase no devolvió el enlace de acceso.");
  }
  const appUrl = normalizeAppUrl((deps.env ?? process.env).NEXT_PUBLIC_APP_URL);
  await sendSystemEmail(admin, buildWelcomeEmail({ companyName, link: buildWelcomeLink(appUrl, hashedToken), to: email }), deps);
}
