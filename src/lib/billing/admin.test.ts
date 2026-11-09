import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { createCrmFake } from "../testing/fake-supabase.ts";
import { BillingAdminError, updateWorkspaceBillingAdmin } from "./admin.ts";
import { buildPaymentLinkUrl, normalizeStripeCustomerId, publicPaymentLinkUrl } from "./links.ts";

const A = "workspace-a";
const B = "workspace-b";

function client() {
  return createCrmFake({
    workspace_billing: [
      { billing_exempt: true, status: null, stripe_customer_id: null, workspace_id: A },
      { billing_exempt: false, status: "active", stripe_customer_id: "cus_bbbbbbbb", workspace_id: B },
    ],
    workspaces: [{ id: A }, { id: B }, { id: "workspace-c" }],
  }) as unknown as CrmClient;
}

describe("buildPaymentLinkUrl", () => {
  it("añade la empresa y el correo del owner al Payment Link", () => {
    const url = new URL(buildPaymentLinkUrl("https://buy.stripe.com/test_abc?locale=es", { email: " Ana@Example.com ", workspaceId: A })!);
    assert.equal(url.searchParams.get("client_reference_id"), A);
    assert.equal(url.searchParams.get("prefilled_email"), "ana@example.com");
    assert.equal(url.searchParams.get("locale"), "es");
  });

  it("sin URL, o sin https, no hay botón", () => {
    assert.equal(buildPaymentLinkUrl("", { email: null, workspaceId: A }), null);
    assert.equal(buildPaymentLinkUrl("http://buy.stripe.com/x", { email: null, workspaceId: A }), null);
    assert.equal(buildPaymentLinkUrl("no es una url", { email: null, workspaceId: A }), null);
  });

  it("la landing usa el Payment Link sin datos de ninguna empresa", () => {
    assert.equal(publicPaymentLinkUrl(" https://buy.stripe.com/abc "), "https://buy.stripe.com/abc");
    assert.equal(publicPaymentLinkUrl("http://buy.stripe.com/abc"), null);
    assert.equal(publicPaymentLinkUrl(undefined), null);
  });

  it("valida ids de cliente de Stripe", () => {
    assert.equal(normalizeStripeCustomerId(" cus_ABC123xyz "), "cus_ABC123xyz");
    assert.equal(normalizeStripeCustomerId("sub_123456"), null);
    assert.equal(normalizeStripeCustomerId(42), null);
  });
});

describe("updateWorkspaceBillingAdmin", () => {
  it("marca o quita la exención solo en esa empresa", async () => {
    const db = client();
    const saved = await updateWorkspaceBillingAdmin(db, A, { billingExempt: false });
    assert.equal(saved.billing_exempt, false);
    const other = await db.from("workspace_billing").select("billing_exempt").eq("workspace_id", B).single();
    assert.equal((other.data as { billing_exempt: boolean }).billing_exempt, false);
  });

  it("crea la fila si la empresa no tenía y enlaza el cliente", async () => {
    const saved = await updateWorkspaceBillingAdmin(client(), "workspace-c", { stripeCustomerId: "cus_cccccccc" });
    assert.equal(saved.stripe_customer_id, "cus_cccccccc");
  });

  it("no deja enlazar un cliente que ya es de otra empresa, ni ids raros, ni empresas que no existen", async () => {
    const db = client();
    await assert.rejects(updateWorkspaceBillingAdmin(db, A, { stripeCustomerId: "cus_bbbbbbbb" }), (error: unknown) => error instanceof BillingAdminError && error.status === 409);
    await assert.rejects(updateWorkspaceBillingAdmin(db, A, { stripeCustomerId: "algo" }), (error: unknown) => error instanceof BillingAdminError && error.status === 400);
    await assert.rejects(updateWorkspaceBillingAdmin(db, "no-existe", { billingExempt: true }), (error: unknown) => error instanceof BillingAdminError && error.status === 404);
    await assert.rejects(updateWorkspaceBillingAdmin(db, A, {}), (error: unknown) => error instanceof BillingAdminError && error.status === 400);
  });
});
