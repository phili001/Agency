import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { createCrmFake } from "../testing/fake-supabase.ts";
import { DEFAULT_GRACE_DAYS, getBillingConfig, isLevyPurchase } from "./config.ts";
import { billingMessage, computeBillingState, type WorkspaceBillingRow } from "./state.ts";
import { getWorkspaceBillingState, isWorkspaceBlocked, listBlockedWorkspaceIds } from "./workspace-billing.ts";

const NOW = new Date("2026-11-10T12:00:00Z");
const A = "workspace-a";
const B = "workspace-b";

function row(extra: Partial<WorkspaceBillingRow> = {}): WorkspaceBillingRow {
  return {
    billing_exempt: false,
    cancel_at_period_end: false,
    current_period_end: null,
    past_due_since: null,
    status: "active",
    workspace_id: A,
    ...extra,
  };
}

const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe("getBillingConfig", () => {
  it("lee listas separadas por coma y usa los valores por defecto", () => {
    const config = getBillingConfig({
      STRIPE_PAYMENT_LINK_IDS: " plink_1 , plink_2,,",
      STRIPE_PRICE_IDS: "price_1",
      STRIPE_SECRET_KEY: "sk_test_x",
    });
    assert.deepEqual(config.paymentLinkIds, ["plink_1", "plink_2"]);
    assert.deepEqual(config.priceIds, ["price_1"]);
    assert.equal(config.graceDays, DEFAULT_GRACE_DAYS);
    assert.equal(config.companyField, "nombredelnegocio");
    assert.equal(config.webhookSecret, null);
  });

  it("ignora días de gracia no válidos", () => {
    assert.equal(getBillingConfig({ BILLING_GRACE_DAYS: "3" }).graceDays, 3);
    assert.equal(getBillingConfig({ BILLING_GRACE_DAYS: "-1" }).graceDays, DEFAULT_GRACE_DAYS);
    assert.equal(getBillingConfig({ BILLING_GRACE_DAYS: "abc" }).graceDays, DEFAULT_GRACE_DAYS);
  });

  it("solo reconoce pagos de los Payment Links o precios de Levy", () => {
    const config = { paymentLinkIds: ["plink_levy"], priceIds: ["price_levy"] };
    assert.equal(isLevyPurchase(config, { paymentLinkId: "plink_levy" }), true);
    assert.equal(isLevyPurchase(config, { priceIds: [null, "price_levy"] }), true);
    assert.equal(isLevyPurchase(config, { paymentLinkId: "plink_otro", priceIds: ["price_otro"] }), false);
    assert.equal(isLevyPurchase({ paymentLinkIds: [], priceIds: [] }, {}), false);
  });
});

describe("computeBillingState", () => {
  const at = { graceDays: 7, now: NOW };

  it("exenta siempre ok, aunque Stripe diga cancelada", () => {
    assert.equal(computeBillingState(row({ billing_exempt: true, status: "canceled" }), at).state, "ok");
  });

  it("sin fila o sin suscripción avisa pero no bloquea", () => {
    assert.deepEqual(computeBillingState(null, at), { graceEndsAt: null, reason: "no_subscription", state: "aviso" });
    assert.equal(computeBillingState(row({ status: null }), at).state, "aviso");
  });

  it("activa o en prueba ok; con cancelación programada, aviso", () => {
    assert.equal(computeBillingState(row(), at).state, "ok");
    assert.equal(computeBillingState(row({ status: "trialing" }), at).state, "ok");
    assert.equal(computeBillingState(row({ cancel_at_period_end: true }), at).reason, "cancel_scheduled");
  });

  it("impago: aviso durante la gracia y bloqueo al acabar", () => {
    const grace = computeBillingState(row({ past_due_since: daysAgo(3), status: "past_due" }), at);
    assert.equal(grace.state, "aviso");
    assert.equal(grace.graceEndsAt, new Date(NOW.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString());
    assert.equal(computeBillingState(row({ past_due_since: daysAgo(7), status: "past_due" }), at).state, "bloqueado");
    // Sin fecha de inicio cuenta desde ahora: nunca bloquea de golpe.
    assert.equal(computeBillingState(row({ status: "past_due" }), at).state, "aviso");
  });

  it("cancelada, impagada, en pausa o caducada bloquean", () => {
    for (const status of ["canceled", "unpaid", "paused", "incomplete_expired"] as const) {
      assert.equal(computeBillingState(row({ status }), at).state, "bloqueado", status);
    }
    assert.equal(computeBillingState(row({ status: "incomplete" }), at).state, "aviso");
  });

  it("tiene texto para el panel salvo cuando todo va bien", () => {
    assert.equal(billingMessage(computeBillingState(row(), at)), "");
    assert.match(billingMessage(computeBillingState(row({ status: "canceled" }), at)), /Reactívala/);
  });
});

describe("estado por empresa en la base", () => {
  function fake() {
    return createCrmFake({
      workspace_billing: [
        row({ past_due_since: daysAgo(10), status: "past_due", workspace_id: A }),
        row({ status: "active", workspace_id: B }),
        row({ billing_exempt: true, status: "canceled", workspace_id: "workspace-c" }),
        row({ past_due_since: daysAgo(1), status: "past_due", workspace_id: "workspace-d" }),
        row({ status: "unpaid", workspace_id: "workspace-e" }),
      ],
    }) as unknown as CrmClient;
  }

  it("cada empresa ve solo su propio estado", async () => {
    const client = fake();
    assert.equal((await getWorkspaceBillingState(client, A, { env: {}, now: NOW })).state, "bloqueado");
    assert.equal((await getWorkspaceBillingState(client, B, { env: {}, now: NOW })).state, "ok");
    assert.equal(await isWorkspaceBlocked(client, B, { env: {}, now: NOW }), false);
    assert.equal((await getWorkspaceBillingState(client, "workspace-z", { env: {}, now: NOW })).reason, "no_subscription");
  });

  it("lista solo las bloqueadas (ni exentas ni en gracia) y respeta BILLING_GRACE_DAYS", async () => {
    const client = fake();
    assert.deepEqual((await listBlockedWorkspaceIds(client, { env: {}, now: NOW })).sort(), [A, "workspace-e"]);
    assert.deepEqual((await listBlockedWorkspaceIds(client, { env: { BILLING_GRACE_DAYS: "15" }, now: NOW })).sort(), ["workspace-e"]);
  });
});
