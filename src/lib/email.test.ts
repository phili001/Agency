import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EmailError, buildWelcomeEmail, isEmailConfigured, sendViaResend } from "./email.ts";

const ENV = { EMAIL_FROM: "Levy <hola@levy.test>", RESEND_API_KEY: "re_test_key" };

function recorder(status = 200, body: unknown = { id: "email_1" }) {
  const calls: Array<{ init: RequestInit; url: string }> = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ init, url });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

describe("sendViaResend", () => {
  it("manda a Resend con la clave en la cabecera y el destinatario normalizado", async () => {
    const { calls, fetcher } = recorder();
    const result = await sendViaResend({ html: "<p>x</p>", subject: "Hola", text: "x", to: " Ana@Example.com " }, { env: ENV, fetch: fetcher });

    assert.deepEqual(result, { id: "email_1" });
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    assert.equal((calls[0].init.headers as Record<string, string>).authorization, "Bearer re_test_key");
    const sent = JSON.parse(String(calls[0].init.body));
    assert.deepEqual(sent.to, ["ana@example.com"]);
    assert.equal(sent.from, ENV.EMAIL_FROM);
  });

  it("no envía sin configuración ni a un correo no válido", async () => {
    const { calls, fetcher } = recorder();
    assert.equal(isEmailConfigured({}), false);
    await assert.rejects(sendViaResend({ html: "", subject: "", text: "", to: "a@b.co" }, { env: {}, fetch: fetcher }), (error: unknown) => error instanceof EmailError && error.code === "not_configured");
    await assert.rejects(sendViaResend({ html: "", subject: "", text: "", to: "no-es-correo" }, { env: ENV, fetch: fetcher }), (error: unknown) => error instanceof EmailError && error.code === "invalid");
    assert.equal(calls.length, 0);
  });

  it("un error de Resend no filtra la clave en el mensaje", async () => {
    const { fetcher } = recorder(422, { message: "bad" });
    await assert.rejects(sendViaResend({ html: "", subject: "", text: "", to: "a@b.co" }, { env: ENV, fetch: fetcher }), (error: unknown) => {
      assert.ok(error instanceof EmailError);
      assert.equal(error.code, "failed");
      assert.doesNotMatch(error.message, /re_test_key/);
      return true;
    });
  });
});

describe("buildWelcomeEmail", () => {
  it("escapa el nombre del negocio en el HTML e incluye el enlace", () => {
    const email = buildWelcomeEmail({ companyName: "<b>Pan & Co</b>", link: "https://app.test/auth/confirm?a=1&b=2", to: "a@b.co" });
    assert.match(email.html, /&lt;b&gt;Pan &amp; Co&lt;\/b&gt;/);
    assert.match(email.html, /href="https:\/\/app.test\/auth\/confirm\?a=1&amp;b=2"/);
    assert.match(email.text, /https:\/\/app.test\/auth\/confirm\?a=1&b=2/);
    assert.equal(buildWelcomeEmail({ companyName: " ", link: "x", to: "a@b.co" }).subject, "Tu cuenta de Levy para tu empresa");
  });
});
