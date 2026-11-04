import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EmailError,
  buildWelcomeEmail,
  isEmailConfigured,
  sendEmail,
  type EmailAuth,
  type EmailTransport,
  type OutgoingEmail,
} from "./email.ts";

const ENV = { GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop", GMAIL_USER: "hola@levy.test" };

function recorder(failure?: Error) {
  const calls: Array<{ auth: EmailAuth; mail: OutgoingEmail }> = [];
  const transport: EmailTransport = async (mail, auth) => {
    calls.push({ auth, mail });
    if (failure) throw failure;
    return { messageId: "<email_1@levy.test>" };
  };
  return { calls, transport };
}

describe("sendEmail", () => {
  it("sale del Gmail configurado, con el destinatario normalizado y la contraseña sin espacios", async () => {
    const { calls, transport } = recorder();
    const result = await sendEmail({ html: "<p>x</p>", subject: "Hola", text: "x", to: " Ana@Example.com " }, { env: ENV, transport });

    assert.deepEqual(result, { id: "<email_1@levy.test>" });
    assert.deepEqual(calls[0].auth, { pass: "abcdefghijklmnop", user: "hola@levy.test" });
    assert.deepEqual(calls[0].mail.from, { address: "hola@levy.test", name: "Levy" });
    assert.equal(calls[0].mail.to, "ana@example.com");
  });

  it("no envía sin configuración ni a un correo no válido", async () => {
    const { calls, transport } = recorder();
    assert.equal(isEmailConfigured({}), false);
    assert.equal(isEmailConfigured({ GMAIL_USER: "hola@levy.test" }), false);
    assert.equal(isEmailConfigured(ENV), true);
    await assert.rejects(sendEmail({ html: "", subject: "", text: "", to: "a@b.co" }, { env: {}, transport }), (error) => error instanceof EmailError && error.code === "not_configured");
    await assert.rejects(sendEmail({ html: "", subject: "", text: "", to: "no-es-correo" }, { env: ENV, transport }), (error) => error instanceof EmailError && error.code === "invalid");
    assert.equal(calls.length, 0);
  });

  it("un error de Gmail no filtra la contraseña en el mensaje", async () => {
    const failure = Object.assign(new Error("Invalid login abcdefghijklmnop"), { code: "EAUTH" });
    const { transport } = recorder(failure);
    await assert.rejects(sendEmail({ html: "", subject: "", text: "", to: "a@b.co" }, { env: ENV, transport }), (error) => {
      assert.ok(error instanceof EmailError);
      assert.equal(error.code, "failed");
      assert.match(error.message, /GMAIL_APP_PASSWORD/);
      assert.doesNotMatch(error.message, /abcdefghijklmnop/);
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
