import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import {
  getWelcomeState,
  isCheckoutSessionId,
  resendWelcomeAccess,
  sendWelcomeAccess,
  WELCOME_RESEND_MAX_PER_HOUR,
  type WelcomeDeps,
} from "./welcome-page.ts";

const SESSION = "cs_test_a1B2c3D4e5F6";
const config = { paymentLinkIds: ["plink_levy"], priceIds: ["price_levy"] };

let fake: FakeSupabase;
let sessions: Map<string, Record<string, unknown>>;
let users: Map<string, string>;
let sent: Array<{ companyName: string; email: string }>;
let claims: number;

function deps(): WelcomeDeps {
  return {
    client: fake as unknown as CrmClient,
    config,
    findUserIdByEmail: async (email) => users.get(email) ?? null,
    stripe: {
      checkout: {
        sessions: {
          retrieve: async (id: string) => {
            const session = sessions.get(id);
            if (!session) throw Object.assign(new Error("No such session"), { statusCode: 404 });
            return session as never;
          },
        },
      },
    },
  };
}

function paidSession(extra: Record<string, unknown> = {}) {
  return {
    customer: "cus_a",
    customer_details: { email: "Ana@Ejemplo.com" },
    id: SESSION,
    line_items: { data: [] },
    payment_link: "plink_levy",
    payment_status: "paid",
    subscription: null,
    ...extra,
  };
}

beforeEach(() => {
  fake = createCrmFake({
    workspace_billing: [
      { stripe_customer_id: "cus_a", workspace_id: "ws-a" },
      { stripe_customer_id: "cus_b", workspace_id: "ws-b" },
    ],
    workspaces: [
      { company_code: "AAA010", created_at: "2026-11-01T00:00:00Z", id: "ws-a", name: "Clínica Ana", owner_id: "user-a" },
      { company_code: "AAA011", created_at: "2026-11-01T00:00:00Z", id: "ws-b", name: "Taller Beto", owner_id: "user-b" },
    ],
  });
  sessions = new Map([[SESSION, paidSession()]]);
  users = new Map([
    ["ana@ejemplo.com", "user-a"],
    ["beto@ejemplo.com", "user-b"],
  ]);
  sent = [];
  claims = 0;
  fake.rpcHandler = (name) => {
    assert.equal(name, "claim_welcome_resend");
    claims += 1;
    return { data: claims <= WELCOME_RESEND_MAX_PER_HOUR, error: null };
  };
});

describe("isCheckoutSessionId", () => {
  it("solo admite ids de sesión de Checkout", () => {
    assert.equal(isCheckoutSessionId(SESSION), true);
    for (const value of ["", "cs_", "pi_123456789012", "cs_test_../../etc", "{CHECKOUT_SESSION_ID}", null, undefined, 42]) {
      assert.equal(isCheckoutSessionId(value), false, String(value));
    }
  });
});

describe("getWelcomeState", () => {
  it("con el pago y la cuenta listos devuelve el correo y la empresa", async () => {
    assert.deepEqual(await getWelcomeState(SESSION, deps()), {
      companyName: "Clínica Ana",
      email: "ana@ejemplo.com",
      status: "ready",
      workspaceId: "ws-a",
    });
  });

  it("no llama a Stripe con un id mal formado", async () => {
    const d = deps();
    d.stripe = { checkout: { sessions: { retrieve: async () => assert.fail("no debe llamar a Stripe") } } };
    assert.deepEqual(await getWelcomeState("../otra-cosa", d), { status: "not_found" });
  });

  it("sesión inexistente, de otro producto o sin correo: not_found", async () => {
    assert.deepEqual(await getWelcomeState("cs_test_noexiste00", deps()), { status: "not_found" });

    sessions.set(SESSION, paidSession({ payment_link: "plink_otro" }));
    assert.deepEqual(await getWelcomeState(SESSION, deps()), { status: "not_found" });

    sessions.set(SESSION, paidSession({ customer_details: { email: null }, customer_email: null }));
    assert.deepEqual(await getWelcomeState(SESSION, deps()), { status: "not_found" });
  });

  it("un fallo pasajero de Stripe no se confunde con una sesión inexistente", async () => {
    const d = deps();
    d.stripe = {
      checkout: { sessions: { retrieve: async () => { throw Object.assign(new Error("boom"), { statusCode: 500 }); } } },
    };
    await assert.rejects(() => getWelcomeState(SESSION, d), /boom/);
  });

  it("sin pagar: pending, salvo suscripción en prueba", async () => {
    sessions.set(SESSION, paidSession({ payment_status: "unpaid" }));
    assert.deepEqual(await getWelcomeState(SESSION, deps()), { status: "pending" });

    sessions.set(SESSION, paidSession({ payment_status: "no_payment_required", subscription: { status: "trialing" } }));
    assert.equal((await getWelcomeState(SESSION, deps())).status, "ready");
  });

  it("antes de que pase el webhook: preparing, sin crear nada", async () => {
    users.delete("ana@ejemplo.com");
    assert.deepEqual(await getWelcomeState(SESSION, deps()), { email: "ana@ejemplo.com", status: "preparing" });

    users.set("ana@ejemplo.com", "user-a");
    sessions.set(SESSION, paidSession({ customer: "cus_nuevo" }));
    assert.deepEqual(await getWelcomeState(SESSION, deps()), { email: "ana@ejemplo.com", status: "preparing" });
    assert.equal(fake.tables.workspace_billing.length, 2);
  });

  it("pago sin cliente de Stripe: usa la empresa del dueño del correo", async () => {
    sessions.set(SESSION, paidSession({ customer: null }));
    assert.equal((await getWelcomeState(SESSION, deps())).status, "ready");
  });

  it("aislamiento: el cliente de Stripe de otra empresa no da acceso a ella", async () => {
    sessions.set(SESSION, paidSession({ customer: "cus_b" }));
    assert.deepEqual(await getWelcomeState(SESSION, deps()), { email: "ana@ejemplo.com", status: "preparing" });
  });
});

describe("resendWelcomeAccess", () => {
  const send = async (input: { companyName: string; email: string }) => {
    sent.push(input);
  };

  it("reenvía al correo del pago y no devuelve ningún enlace", async () => {
    const result = await resendWelcomeAccess(SESSION, { ...deps(), send });
    assert.deepEqual(result, { email: "ana@ejemplo.com", ok: true });
    assert.deepEqual(sent, [{ companyName: "Clínica Ana", email: "ana@ejemplo.com" }]);
    assert.deepEqual(fake.rpcCalls[0].args, { p_max: 3, p_workspace_id: "ws-a" });
  });

  it("máximo 3 por hora: el cuarto no se envía", async () => {
    for (let i = 0; i < WELCOME_RESEND_MAX_PER_HOUR; i += 1) {
      assert.equal((await resendWelcomeAccess(SESSION, { ...deps(), send })).ok, true);
    }
    assert.deepEqual(await resendWelcomeAccess(SESSION, { ...deps(), send }), { ok: false, reason: "rate_limited" });
    assert.equal(sent.length, WELCOME_RESEND_MAX_PER_HOUR);
  });

  it("sin cuenta lista no gasta intentos ni envía", async () => {
    users.delete("ana@ejemplo.com");
    assert.deepEqual(await resendWelcomeAccess(SESSION, { ...deps(), send }), { ok: false, reason: "not_ready" });
    assert.equal(fake.rpcCalls.length, 0);
    assert.equal(sent.length, 0);
  });

  it("si falla el correo lo dice sin lanzar el detalle al navegador", async () => {
    const result = await resendWelcomeAccess(SESSION, {
      ...deps(),
      send: async () => {
        throw new Error("Resend respondió 500.");
      },
    });
    assert.deepEqual(result, { ok: false, reason: "send_failed" });
  });
});

describe("sendWelcomeAccess", () => {
  it("manda el enlace de primer acceso solo por correo", async () => {
    const requests: Array<{ html: string; to: string }> = [];
    const admin = {
      auth: { admin: { generateLink: async () => ({ data: { properties: { hashed_token: "tok123" } }, error: null }) } },
    };

    await sendWelcomeAccess(admin, { companyName: "Clínica Ana", email: "ana@ejemplo.com" }, {
      env: { NEXT_PUBLIC_APP_URL: "https://agentelevi.com", SMTP_HOST: "smtp.levy.test", SMTP_PASSWORD: "clave", SMTP_USER: "hola@agentelevi.com" },
      transport: async (mail) => {
        requests.push({ html: mail.html, to: mail.to });
        return { messageId: "em_1" };
      },
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].to, "ana@ejemplo.com");
    assert.match(requests[0].html, /https:\/\/agentelevi\.com\/auth\/confirm\?/);
    assert.match(requests[0].html, /token_hash=tok123/);
  });

  it("si Supabase no da el enlace no manda nada", async () => {
    const admin = {
      auth: { admin: { generateLink: async () => ({ data: {}, error: new Error("sin usuario") }) } },
    };
    await assert.rejects(
      () =>
        sendWelcomeAccess(admin, { companyName: "X", email: "x@ejemplo.com" }, {
          transport: async () => assert.fail("no debe enviar"),
        }),
      /sin usuario/,
    );
  });
});
