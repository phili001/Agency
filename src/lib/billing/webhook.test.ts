import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import Stripe from "stripe";

import type { CrmClient } from "../crm/shared.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { syncAgencyContact } from "./agency-crm.ts";
import { getBillingConfig } from "./config.ts";
import { processStripeEvent, verifyStripeEvent, type StripeWebhookDeps } from "./webhook.ts";

const SECRET = "whsec_test_secret";
const stripeSdk = new Stripe("sk_test_dummy");
const AGENCY = "ws-agency";
const EXISTING = "ws-existing";
const NOW = new Date("2026-11-10T12:00:00Z");
const config = getBillingConfig({
  STRIPE_PAYMENT_LINK_IDS: "plink_levy",
  STRIPE_PRICE_IDS: "price_levy",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  STRIPE_WEBHOOK_SECRET: SECRET,
});

let fake: FakeSupabase;
let client: CrmClient;
let sessions: Map<string, Record<string, unknown>>;
let subscriptions: Map<string, Record<string, unknown>>;
let created: Array<{ companyName: string; email: string }>;
let welcomes: string[];
let metadataUpdates: string[];
let users: Map<string, string>;

function stages(workspaceId: string) {
  return [
    ["Nuevo", "open"],
    ["Cliente", "won"],
    ["Perdido", "lost"],
  ].map(([name, kind], position) => ({ color: "#64748b", id: `${workspaceId}-stage-${position}`, kind, name, position, workspace_id: workspaceId }));
}

function subscription(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    cancel_at_period_end: false,
    customer: "cus_1",
    id,
    items: { data: [{ current_period_end: 1_800_000_000, price: { id: "price_levy", lookup_key: null, nickname: "Levy mensual" } }] },
    metadata: {},
    object: "subscription",
    status,
    ...extra,
  };
}

function session(id: string, extra: Record<string, unknown> = {}) {
  return {
    client_reference_id: null,
    custom_fields: [{ key: "nombredelnegocio", text: { value: "Panadería Sol" } }],
    customer: "cus_1",
    customer_details: { email: "Ana@Example.com", name: "Ana López", phone: "+34600111222" },
    id,
    line_items: { data: [{ price: { id: "price_levy" } }] },
    object: "checkout.session",
    payment_link: "plink_levy",
    payment_status: "paid",
    subscription: "sub_1",
    ...extra,
  };
}

/** Evento firmado como lo manda Stripe y verificado con el SDK real. */
function signedEvent(id: string, type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ api_version: "2025-10-29", data: { object }, id, object: "event", type });
  const header = stripeSdk.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const event = verifyStripeEvent(stripeSdk.webhooks, payload, header, SECRET);
  assert.ok(event, "la firma de prueba debe ser válida");
  return event;
}

function deps(): StripeWebhookDeps {
  return {
    client,
    config,
    createCompany: async ({ companyName, email }) => {
      created.push({ companyName, email });
      const workspaceId = `ws-new-${created.length}`;
      const userId = `user-new-${created.length}`;
      users.set(email, userId);
      fake.tables.workspaces.push({ company_code: `NEW00${created.length}`, created_at: NOW.toISOString(), id: workspaceId, name: companyName, owner_id: userId });
      return { workspaceId };
    },
    findUserEmailById: async (userId) => [...users.entries()].find(([, id]) => id === userId)?.[0] ?? null,
    findUserIdByEmail: async (email) => users.get(email) ?? null,
    now: () => NOW,
    sendWelcome: async ({ email }) => {
      welcomes.push(email);
    },
    stripe: {
      checkout: { sessions: { retrieve: async (id) => sessions.get(id) as unknown as Stripe.Checkout.Session } },
      customers: { update: async (id) => metadataUpdates.push(`customer:${id}`) },
      subscriptions: {
        retrieve: async (id) => subscriptions.get(id) as unknown as Stripe.Subscription,
        update: async (id) => metadataUpdates.push(`subscription:${id}`),
      },
    },
    syncAgencyContact: (input) => syncAgencyContact(client, input, { LEVY_WORKSPACE_CODE: "AAA001" }),
  };
}

async function agencyContact(email: string) {
  const contact = fake.tables.contacts.find((row) => row.workspace_id === AGENCY && row.email === email);
  const tagIds = fake.tables.crm_contact_tags.filter((row) => row.contact_id === contact?.id).map((row) => row.tag_id);
  const tags = fake.tables.crm_tags.filter((row) => tagIds.includes(row.id)).map((row) => row.name);
  const stage = fake.tables.crm_pipeline_stages.find((row) => row.id === contact?.stage_id)?.name ?? null;
  return { contact, stage, tags: tags.sort() };
}

beforeEach(() => {
  fake = createCrmFake({
    billing_events: [],
    contacts: [],
    crm_contact_activity: [],
    crm_contact_tags: [],
    crm_custom_fields: [],
    crm_pipeline_stages: [...stages(AGENCY), ...stages(EXISTING)],
    crm_tags: [],
    workspace_billing: [{ billing_exempt: false, cancel_at_period_end: false, past_due_since: null, status: null, stripe_customer_id: null, stripe_subscription_id: null, workspace_id: EXISTING }],
    workspaces: [
      { company_code: "AAA001", created_at: "2026-01-01T00:00:00Z", id: AGENCY, name: "Agencia", owner_id: "user-agency" },
      { company_code: "BBB002", created_at: "2026-02-01T00:00:00Z", id: EXISTING, name: "Cliente existente", owner_id: "user-existing" },
    ],
  });
  client = fake as unknown as CrmClient;
  sessions = new Map([["cs_1", session("cs_1")]]);
  subscriptions = new Map([["sub_1", subscription("sub_1", "active")]]);
  created = [];
  welcomes = [];
  metadataUpdates = [];
  users = new Map([["dueno@existente.com", "user-existing"]]);
});

describe("firma", () => {
  it("rechaza una firma inválida, de otro secreto o ausente", () => {
    const payload = JSON.stringify({ data: { object: {} }, id: "evt_x", object: "event", type: "invoice.paid" });
    const otherSecret = stripeSdk.webhooks.generateTestHeaderString({ payload, secret: "whsec_otro" });
    assert.equal(verifyStripeEvent(stripeSdk.webhooks, payload, otherSecret, SECRET), null);
    assert.equal(verifyStripeEvent(stripeSdk.webhooks, payload, "t=1,v1=bad", SECRET), null);
    assert.equal(verifyStripeEvent(stripeSdk.webhooks, payload, null, SECRET), null);
    const good = stripeSdk.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    assert.equal(verifyStripeEvent(stripeSdk.webhooks, payload.replace("evt_x", "evt_y"), good, SECRET), null);
  });
});

describe("checkout.session.completed", () => {
  it("pago correcto: crea la empresa, guarda la facturación, avisa y deja el contacto en AAA001", async () => {
    const outcome = await processStripeEvent(signedEvent("evt_1", "checkout.session.completed", session("cs_1")), deps());

    assert.equal(outcome.result, "processed", outcome.detail);
    assert.deepEqual(created, [{ companyName: "Panadería Sol", email: "ana@example.com" }]);
    assert.deepEqual(welcomes, ["ana@example.com"]);
    assert.deepEqual(metadataUpdates.sort(), ["customer:cus_1", "subscription:sub_1"]);

    const billing = fake.tables.workspace_billing.find((row) => row.workspace_id === "ws-new-1");
    assert.equal(billing?.status, "active");
    assert.equal(billing?.stripe_customer_id, "cus_1");
    assert.equal(billing?.price_id, "price_levy");
    assert.equal(billing?.billing_exempt ?? false, false);

    const agency = await agencyContact("ana@example.com");
    assert.equal(agency.contact?.source, "stripe");
    assert.deepEqual(agency.tags, ["cliente-levy"]);
    assert.equal(agency.stage, "Cliente");
    assert.deepEqual(agency.contact?.custom_fields, { levy_company_code: "NEW001", levy_plan: "Levy mensual", levy_workspace_id: "ws-new-1" });
    // Nada se escribe en el CRM de otra empresa.
    assert.equal(fake.tables.contacts.filter((row) => row.workspace_id !== AGENCY).length, 0);

    assert.equal(fake.tables.billing_events[0]?.result, "processed");
  });

  it("si el correo falla, el evento sigue procesado y el motivo queda registrado", async () => {
    const outcome = await processStripeEvent(signedEvent("evt_1", "checkout.session.completed", session("cs_1")), {
      ...deps(),
      sendWelcome: async () => {
        throw new Error("No hay correo configurado.");
      },
    });

    assert.equal(outcome.result, "processed");
    assert.equal(fake.tables.billing_events[0].result, "processed");
    assert.equal(fake.tables.billing_events[0].error, "correo no enviado: No hay correo configurado.");
  });

  it("reintento duplicado: no crea otra empresa ni reenvía el correo", async () => {
    const event = signedEvent("evt_1", "checkout.session.completed", session("cs_1"));
    await processStripeEvent(event, deps());
    const again = await processStripeEvent(event, deps());

    assert.equal(again.duplicate, true);
    assert.equal(created.length, 1);
    assert.equal(welcomes.length, 1);
    assert.equal(fake.tables.billing_events.length, 1);
  });

  it("pago de otro producto: se ignora sin crear nada", async () => {
    sessions.set("cs_2", session("cs_2", { line_items: { data: [{ price: { id: "price_otro" } }] }, payment_link: "plink_otro" }));
    const outcome = await processStripeEvent(signedEvent("evt_2", "checkout.session.completed", session("cs_2")), deps());

    assert.equal(outcome.result, "ignored");
    assert.equal(created.length, 0);
    assert.equal(fake.tables.contacts.length, 0);
    assert.equal(fake.tables.billing_events[0]?.result, "ignored");
  });

  it("sin pagar todavía: se ignora", async () => {
    sessions.set("cs_3", session("cs_3", { payment_status: "unpaid" }));
    subscriptions.set("sub_1", subscription("sub_1", "incomplete"));
    const outcome = await processStripeEvent(signedEvent("evt_3", "checkout.session.completed", session("cs_3")), deps());
    assert.equal(outcome.result, "ignored");
    assert.equal(created.length, 0);
  });

  it("client_reference_id ajeno (correo que no es del owner): no se usa esa empresa", async () => {
    sessions.set("cs_4", session("cs_4", { client_reference_id: EXISTING }));
    const outcome = await processStripeEvent(signedEvent("evt_4", "checkout.session.completed", session("cs_4")), deps());

    assert.equal(outcome.result, "processed");
    assert.notEqual(outcome.workspaceId, EXISTING);
    assert.equal(fake.tables.workspace_billing.find((row) => row.workspace_id === EXISTING)?.stripe_customer_id, null);
  });

  it("client_reference_id propio (correo del owner): reactiva esa empresa sin crear otra", async () => {
    sessions.set(
      "cs_5",
      session("cs_5", { client_reference_id: EXISTING, customer_details: { email: "dueno@existente.com", name: "Dueño", phone: "+34600999888" } }),
    );
    const outcome = await processStripeEvent(signedEvent("evt_5", "checkout.session.completed", session("cs_5")), deps());

    assert.equal(outcome.workspaceId, EXISTING);
    assert.equal(created.length, 0);
    assert.equal(fake.tables.workspace_billing.find((row) => row.workspace_id === EXISTING)?.status, "active");
  });
});

describe("cambios de estado", () => {
  beforeEach(async () => {
    await processStripeEvent(signedEvent("evt_buy", "checkout.session.completed", session("cs_1")), deps());
  });

  it("impago: past_due con fecha de inicio y etiqueta levy-impago en AAA001", async () => {
    subscriptions.set("sub_1", subscription("sub_1", "past_due"));
    const invoice = { customer: "cus_1", id: "in_1", object: "invoice", parent: { subscription_details: { subscription: "sub_1" } } };
    const outcome = await processStripeEvent(signedEvent("evt_fail", "invoice.payment_failed", invoice), deps());

    assert.equal(outcome.result, "processed", outcome.detail);
    const billing = fake.tables.workspace_billing.find((row) => row.workspace_id === "ws-new-1");
    assert.equal(billing?.status, "past_due");
    assert.equal(billing?.past_due_since, NOW.toISOString());
    assert.deepEqual((await agencyContact("ana@example.com")).tags, ["cliente-levy", "levy-impago"]);

    // Al volver a pagar se quita el impago.
    subscriptions.set("sub_1", subscription("sub_1", "active"));
    await processStripeEvent(signedEvent("evt_paid", "invoice.paid", invoice), deps());
    assert.equal(fake.tables.workspace_billing.find((row) => row.workspace_id === "ws-new-1")?.past_due_since, null);
    assert.deepEqual((await agencyContact("ana@example.com")).tags, ["cliente-levy"]);
  });

  it("cancelación: estado canceled, etiqueta levy-cancelado y etapa Perdido", async () => {
    subscriptions.set("sub_1", subscription("sub_1", "canceled"));
    const outcome = await processStripeEvent(signedEvent("evt_del", "customer.subscription.deleted", subscription("sub_1", "canceled")), deps());

    assert.equal(outcome.result, "processed");
    assert.equal(fake.tables.workspace_billing.find((row) => row.workspace_id === "ws-new-1")?.status, "canceled");
    const agency = await agencyContact("ana@example.com");
    assert.ok(agency.tags.includes("levy-cancelado"));
    assert.equal(agency.stage, "Perdido");
  });

  it("una suscripción desconocida se ignora aunque traiga metadata de otra empresa con cliente", async () => {
    fake.tables.workspace_billing.find((row) => row.workspace_id === EXISTING)!.stripe_customer_id = "cus_existing";
    subscriptions.set("sub_x", subscription("sub_x", "active", { customer: "cus_intruso", metadata: { workspace_id: EXISTING } }));
    const outcome = await processStripeEvent(signedEvent("evt_x", "customer.subscription.updated", subscription("sub_x", "active")), deps());

    assert.equal(outcome.result, "ignored");
    assert.equal(fake.tables.workspace_billing.find((row) => row.workspace_id === EXISTING)?.status, null);
  });
});
