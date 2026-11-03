import type Stripe from "stripe";

import type { CrmClient } from "../crm/shared.ts";
import { resolveCompanyName } from "../welcome.ts";
import type { AgencyContactInput, AgencyContactResult } from "./agency-crm.ts";
import { isLevyPurchase, type BillingConfig } from "./config.ts";
import type { StripeSubscriptionStatus } from "./state.ts";

/**
 * Eventos de Stripe de la venta de Levy (Payment Link externo). La ruta
 * `api/webhooks/stripe` verifica la firma y llama a `processStripeEvent`.
 *
 * - Dedupe por `event.id` en `billing_events`: un evento ya procesado o
 *   ignorado no se repite; uno fallido sí (Stripe lo reintenta).
 * - `checkout.session.completed`: solo si es un Payment Link o precio de Levy
 *   y está pagado (o en prueba). Crea la empresa si el correo no tiene una,
 *   guarda la facturación, marca `metadata.workspace_id` en Stripe, manda el
 *   correo de acceso y deja al comprador en el CRM de AAA001.
 * - `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`:
 *   actualizan el estado (siempre releyendo la suscripción en Stripe).
 *
 * El texto de los eventos (nombre del negocio, etc.) es dato del cliente: se
 * guarda, nunca se interpreta como instrucción.
 */

type StripeApi = {
  checkout: { sessions: { retrieve: (id: string, params?: Stripe.Checkout.SessionRetrieveParams) => Promise<Stripe.Checkout.Session> } };
  customers: { update: (id: string, params: Stripe.CustomerUpdateParams) => Promise<unknown> };
  subscriptions: {
    retrieve: (id: string) => Promise<Stripe.Subscription>;
    update: (id: string, params: Stripe.SubscriptionUpdateParams) => Promise<unknown>;
  };
};

export type StripeWebhookDeps = {
  client: CrmClient;
  config: BillingConfig;
  /** Crea usuario (con contraseña aleatoria) + empresa + agentes. */
  createCompany: (input: { companyName: string; email: string }) => Promise<{ workspaceId: string }>;
  findUserIdByEmail: (email: string) => Promise<string | null>;
  findUserEmailById: (userId: string) => Promise<string | null>;
  now?: () => Date;
  /** Correo de acceso (enlace de primer acceso). Un fallo no tumba el evento. */
  sendWelcome: (input: { companyName: string; email: string }) => Promise<void>;
  stripe: StripeApi;
  syncAgencyContact: (input: AgencyContactInput) => Promise<AgencyContactResult>;
};

export type StripeEventOutcome = {
  detail?: string;
  duplicate?: boolean;
  result: "failed" | "ignored" | "processed";
  workspaceId?: string | null;
};

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.updated",
]);

function idOf(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function periodEnd(subscription: Stripe.Subscription) {
  const ends = subscription.items?.data?.map((item) => item.current_period_end).filter((value) => typeof value === "number") ?? [];
  return ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null;
}

function priceOf(subscription: Stripe.Subscription) {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

function planOf(subscription: Stripe.Subscription | null, fallback: string | null) {
  const price = subscription?.items?.data?.[0]?.price;
  return price?.nickname || price?.lookup_key || price?.id || fallback;
}

async function recordEvent(client: CrmClient, event: Stripe.Event, outcome: StripeEventOutcome, now: Date) {
  const { error } = await client.from("billing_events").upsert(
    {
      error: outcome.result === "failed" ? (outcome.detail ?? "error").slice(0, 2000) : null,
      processed_at: now.toISOString(),
      result: outcome.result,
      stripe_event_id: event.id,
      type: event.type.slice(0, 120),
      workspace_id: outcome.workspaceId ?? null,
    },
    { onConflict: "stripe_event_id" },
  );
  if (error) throw new Error(`billing_events: ${error.message}`);
}

type BillingRow = { stripe_customer_id: string | null; status: StripeSubscriptionStatus | null; past_due_since: string | null; workspace_id: string };

async function billingRowBy(client: CrmClient, column: "stripe_customer_id" | "stripe_subscription_id" | "workspace_id", value: string) {
  const { data, error } = await client
    .from("workspace_billing")
    .select("workspace_id, stripe_customer_id, status, past_due_since")
    .eq(column, value)
    .maybeSingle();
  if (error) throw new Error(`workspace_billing: ${error.message}`);
  return (data as BillingRow | null) ?? null;
}

/** Guarda el estado de la suscripción. El impago cuenta desde la primera vez que se ve. */
async function saveSubscription(
  client: CrmClient,
  workspaceId: string,
  customerId: string | null,
  subscription: Stripe.Subscription | null,
  now: Date,
) {
  const previous = await billingRowBy(client, "workspace_id", workspaceId);
  const status = (subscription?.status ?? null) as StripeSubscriptionStatus | null;
  const pastDue = status === "past_due" || status === "unpaid";
  const row: Record<string, unknown> = {
    cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
    current_period_end: subscription ? periodEnd(subscription) : null,
    past_due_since: pastDue ? (previous?.past_due_since ?? now.toISOString()) : null,
    price_id: subscription ? priceOf(subscription) : null,
    status,
    stripe_customer_id: customerId ?? previous?.stripe_customer_id ?? null,
    stripe_subscription_id: subscription?.id ?? null,
    workspace_id: workspaceId,
  };
  const { error } = await client.from("workspace_billing").upsert(row, { onConflict: "workspace_id" });
  if (error) throw new Error(`workspace_billing: ${error.message}`);
}

async function workspaceInfo(client: CrmClient, workspaceId: string) {
  const { data, error } = await client
    .from("workspaces")
    .select("id, owner_id, company_code, name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(`workspaces: ${error.message}`);
  return (data as { company_code: string; id: string; name: string; owner_id: string } | null) ?? null;
}

async function ownedWorkspaceId(client: CrmClient, userId: string) {
  const { data, error } = await client
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(`workspaces: ${error.message}`);
  return ((data ?? [])[0] as { id: string } | undefined)?.id ?? null;
}

function customFieldValue(session: Stripe.Checkout.Session, key: string) {
  const field = session.custom_fields?.find((item) => item.key === key);
  return field?.text?.value ?? field?.dropdown?.value ?? field?.numeric?.value ?? null;
}

async function handleCheckout(event: Stripe.Event, deps: StripeWebhookDeps, now: Date): Promise<StripeEventOutcome> {
  const base = event.data.object as Stripe.Checkout.Session;
  const session = await deps.stripe.checkout.sessions.retrieve(base.id, { expand: ["line_items"] });
  const priceIds = session.line_items?.data?.map((item) => item.price?.id) ?? [];

  if (!isLevyPurchase(deps.config, { paymentLinkId: idOf(session.payment_link), priceIds })) {
    return { detail: "otro producto", result: "ignored" };
  }

  const subscriptionId = idOf(session.subscription);
  const subscription = subscriptionId ? await deps.stripe.subscriptions.retrieve(subscriptionId) : null;
  const paid = session.payment_status === "paid" || subscription?.status === "trialing";
  if (!paid) {
    return { detail: `sin pagar (${session.payment_status})`, result: "ignored" };
  }

  const email = (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
  if (!email) {
    return { detail: "el pago no trae correo", result: "failed" };
  }

  const userId = await deps.findUserIdByEmail(email);
  let workspaceId: string | null = null;

  // client_reference_id solo vale si la empresa existe y el correo del pago es el del owner.
  if (session.client_reference_id && userId) {
    const referenced = await workspaceInfo(deps.client, session.client_reference_id);
    if (referenced && referenced.owner_id === userId) workspaceId = referenced.id;
  }
  if (!workspaceId && userId) workspaceId = await ownedWorkspaceId(deps.client, userId);

  const companyName = resolveCompanyName({
    companyName: customFieldValue(session, deps.config.companyField),
    email,
    firstName: session.customer_details?.name?.split(/\s+/)[0] ?? null,
  });
  let created = false;
  if (!workspaceId) {
    workspaceId = (await deps.createCompany({ companyName, email })).workspaceId;
    created = true;
  }

  const customerId = idOf(session.customer);
  if (customerId) {
    const owner = await billingRowBy(deps.client, "stripe_customer_id", customerId);
    if (owner && owner.workspace_id !== workspaceId) {
      return { detail: "ese cliente de Stripe ya es de otra empresa", result: "failed", workspaceId };
    }
  }

  await saveSubscription(deps.client, workspaceId, customerId, subscription, now);
  if (customerId) await deps.stripe.customers.update(customerId, { metadata: { workspace_id: workspaceId } });
  if (subscription) await deps.stripe.subscriptions.update(subscription.id, { metadata: { workspace_id: workspaceId } });

  const notes: string[] = [created ? "empresa creada" : "empresa existente"];
  try {
    await deps.sendWelcome({ companyName: (await workspaceInfo(deps.client, workspaceId))?.name ?? companyName, email });
    notes.push("correo enviado");
  } catch (error) {
    notes.push(`correo no enviado: ${error instanceof Error ? error.message : "error"}`);
  }

  const info = await workspaceInfo(deps.client, workspaceId);
  const crm = await deps.syncAgencyContact({
    companyCode: info?.company_code ?? null,
    email,
    fullName: session.customer_details?.name ?? null,
    phone: session.customer_details?.phone ?? null,
    plan: planOf(subscription, priceIds.find(Boolean) ?? null),
    status: subscription?.status ?? "paid",
    workspaceId,
  });
  notes.push(crm.ok ? "contacto en AAA001" : `AAA001: ${crm.reason}`);

  return { detail: notes.join("; "), result: "processed", workspaceId };
}

/** Empresa de una suscripción: por los ids guardados y, si no, por `metadata.workspace_id`. */
async function workspaceForSubscription(client: CrmClient, subscription: Stripe.Subscription) {
  const bySubscription = await billingRowBy(client, "stripe_subscription_id", subscription.id);
  if (bySubscription) return bySubscription.workspace_id;
  const customerId = idOf(subscription.customer);
  const byCustomer = customerId ? await billingRowBy(client, "stripe_customer_id", customerId) : null;
  if (byCustomer) return byCustomer.workspace_id;
  const metadataId = subscription.metadata?.workspace_id;
  if (!metadataId) return null;
  const row = await billingRowBy(client, "workspace_id", metadataId);
  // Solo si esa empresa no tiene ya otro cliente de Stripe.
  return row && (!row.stripe_customer_id || row.stripe_customer_id === customerId) ? metadataId : null;
}

async function handleSubscriptionChange(subscriptionId: string, deps: StripeWebhookDeps, now: Date): Promise<StripeEventOutcome> {
  const subscription = await deps.stripe.subscriptions.retrieve(subscriptionId);
  const workspaceId = await workspaceForSubscription(deps.client, subscription);
  if (!workspaceId) {
    return { detail: "suscripción sin empresa conocida", result: "ignored" };
  }
  const priceId = priceOf(subscription);
  if (priceId && deps.config.priceIds.length > 0 && !deps.config.priceIds.includes(priceId)) {
    return { detail: "precio que no es de Levy", result: "ignored", workspaceId };
  }

  await saveSubscription(deps.client, workspaceId, idOf(subscription.customer), subscription, now);

  const info = await workspaceInfo(deps.client, workspaceId);
  const owner = info ? ((await deps.findUserEmailById(info.owner_id))?.toLowerCase() ?? null) : null;
  let detail = `estado ${subscription.status}`;
  if (owner) {
    const crm = await deps.syncAgencyContact({
      companyCode: info?.company_code ?? null,
      email: owner,
      plan: planOf(subscription, null),
      status: subscription.status as StripeSubscriptionStatus,
      workspaceId,
    });
    detail += crm.ok ? "; contacto en AAA001" : `; AAA001: ${crm.reason}`;
  }
  return { detail, result: "processed", workspaceId };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  return idOf(fromParent ?? legacy ?? null);
}

/** Comprueba la firma de Stripe; null si falta o no es válida. */
export function verifyStripeEvent(
  webhooks: Pick<Stripe["webhooks"], "constructEvent">,
  rawBody: string,
  signature: string | null,
  secret: string,
) {
  if (!signature) return null;
  try {
    return webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

/** Verificada la firma en la ruta: aplica el evento (con dedupe) y lo apunta. */
export async function processStripeEvent(event: Stripe.Event, deps: StripeWebhookDeps): Promise<StripeEventOutcome> {
  const now = (deps.now ?? (() => new Date()))();
  const { data: seen, error } = await deps.client
    .from("billing_events")
    .select("result, workspace_id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (error) throw new Error(`billing_events: ${error.message}`);
  const previous = seen as { result: StripeEventOutcome["result"]; workspace_id: string | null } | null;
  if (previous && previous.result !== "failed") {
    return { duplicate: true, result: previous.result, workspaceId: previous.workspace_id };
  }

  let outcome: StripeEventOutcome;
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      outcome = await handleCheckout(event, deps, now);
    } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
      outcome = await handleSubscriptionChange((event.data.object as Stripe.Subscription).id, deps, now);
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const subscriptionId = invoiceSubscriptionId(event.data.object as Stripe.Invoice);
      outcome = subscriptionId
        ? await handleSubscriptionChange(subscriptionId, deps, now)
        : { detail: "factura sin suscripción", result: "ignored" };
    } else {
      outcome = { detail: "tipo no usado", result: "ignored" };
    }
  } catch (caught) {
    outcome = { detail: caught instanceof Error ? caught.message : "error", result: "failed" };
  }

  await recordEvent(deps.client, event, outcome, now);
  return outcome;
}
