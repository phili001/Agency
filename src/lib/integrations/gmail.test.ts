import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { contactEmailVariables, sendContactEmail } from "../crm/contact-email.ts";
import { runCrmFlowActions } from "../crm/flow-actions.ts";
import type { CrmClient } from "../crm/shared.ts";
import { EmailError, sendSystemEmail } from "../email.ts";
import type { FlowCrmAction } from "../flow-definitions.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { encryptSecret } from "./crypto.ts";
import {
  GMAIL_SEND_SCOPE,
  buildRawMessage,
  disconnectGmail,
  encodeHeaderText,
  getGmailStatus,
  gmailConnectUrl,
  sendGmail,
} from "./gmail.ts";
import { GOOGLE_SCOPES, GoogleCalendarError, type GoogleDeps, type GoogleTokens, createOAuthState, disconnect } from "./google-calendar.ts";
import { callbackRedirectPath, completeGoogleCallback } from "./google-calendar-callback.ts";

process.env.INTEGRATION_ENCRYPTION_KEY = "clave-de-prueba-de-32-caracteres!!";

const A = "workspace-a";
const B = "workspace-b";
const AGENCY = "workspace-agency";
const ENV = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
  LEVY_WORKSPACE_CODE: "AAA001",
  NEXT_PUBLIC_APP_URL: "https://app.levy.test/",
};
const NOW = new Date("2026-11-03T10:00:00Z");
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MESSAGE = { html: "<p>Hola</p>", subject: "Hola", text: "Hola", to: "cliente@ejemplo.com" };

type Call = { auth: string | null; body: string; url: string };
type Route = (call: Call) => { body?: unknown; status: number } | undefined;

let fake: FakeSupabase;
let client: CrmClient;
let calls: Call[];
let routes: Route[];

function deps(extra: Partial<GoogleDeps> = {}): GoogleDeps {
  return {
    env: ENV,
    fetch: (async (url: string | URL, init: RequestInit = {}) => {
      const call: Call = {
        auth: new Headers(init.headers).get("authorization"),
        body: typeof init.body === "string" ? init.body : String(init.body ?? ""),
        url: String(url),
      };
      calls.push(call);
      for (const route of routes) {
        const result = route(call);
        if (result) return new Response(JSON.stringify(result.body ?? {}), { status: result.status });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch,
    now: () => NOW,
    ...extra,
  };
}

function tokens(extra: Partial<GoogleTokens> = {}): GoogleTokens {
  return {
    accessToken: "access-a",
    expiresAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
    refreshToken: "refresh-a",
    scope: `${GMAIL_SEND_SCOPE} openid email`,
    ...extra,
  };
}

function connect(workspaceId: string, email: string, saved: GoogleTokens = tokens()) {
  fake.tables.integrations.push({
    config: { account_email: email, scopes: saved.scope.split(" ") },
    last_error: null,
    provider: "gmail",
    status: "active",
    workspace_id: workspaceId,
  });
  fake.tables.integration_secrets.push({
    ciphertext: encryptSecret(JSON.stringify(saved)),
    kind: "oauth_tokens",
    provider: "gmail",
    workspace_id: workspaceId,
  });
}

/** Decodifica el `raw` de la última llamada a Gmail. */
function sentMessage() {
  const call = calls.findLast((item) => item.url === SEND_URL);
  assert.ok(call, "no se llamó a Gmail");
  const { raw } = JSON.parse(call.body) as { raw: string };
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  return { auth: call.auth, mime: Buffer.from(raw, "base64url").toString("utf8") };
}

beforeEach(() => {
  fake = createCrmFake({
    contacts: [
      { company: "Clínica", email: "ana@ejemplo.com", full_name: "Ana", id: "contact-a", phone_e164: "+34600000001", workspace_id: A },
      { company: null, email: null, full_name: "Sin Correo", id: "contact-a2", phone_e164: "+34600000002", workspace_id: A },
      { company: null, email: "beto@ejemplo.com", full_name: "Beto", id: "contact-b", phone_e164: "+34600000003", workspace_id: B },
    ],
    crm_contact_activity: [],
    integration_secrets: [],
    integrations: [],
    workspace_billing: [
      { billing_exempt: true, workspace_id: A },
      { billing_exempt: true, workspace_id: B },
    ],
    workspace_members: [
      { role: "owner", user_id: "user-1", workspace_id: A },
    ],
    workspaces: [
      { company_code: "AAA001", id: AGENCY, name: "Levy" },
      { company_code: "AAA010", id: A, name: "Clínica Ñandú" },
      { company_code: "AAA011", id: B, name: "Taller" },
    ],
  });
  client = fake as unknown as CrmClient;
  calls = [];
  routes = [(call) => (call.url === SEND_URL ? { body: { id: "gmail-1" }, status: 200 } : undefined)];
});

describe("mensaje MIME", () => {
  it("codifica en UTF-8 y base64url asunto, remitente y cuerpo", () => {
    const raw = buildRawMessage(
      { html: "<p>¿Qué tal, Núria? 😀</p>", subject: "Cita de mañana ✓", text: "¿Qué tal, Núria? 😀", to: "a@b.es" },
      { email: "yo@empresa.es", name: "Clínica Ñandú" },
    );
    assert.match(raw, /^[A-Za-z0-9_-]+$/);
    const mime = Buffer.from(raw, "base64url").toString("utf8");

    assert.match(mime, /^From: =\?UTF-8\?B\?[^?]+\?= <yo@empresa\.es>\r\n/);
    assert.match(mime, /\r\nTo: a@b\.es\r\n/);
    const subject = /Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(mime);
    assert.equal(Buffer.from(subject![1], "base64").toString("utf8"), "Cita de mañana ✓");
    const boundary = /boundary="([^"]+)"/.exec(mime)![1];
    const parts = mime.split(`--${boundary}`);
    assert.equal(parts.length, 4);
    assert.match(parts[1], /text\/plain; charset="UTF-8"/);
    assert.match(parts[2], /text\/html; charset="UTF-8"/);
    assert.equal(Buffer.from(parts[1].split("\r\n\r\n")[1].replace(/\s/g, ""), "base64").toString("utf8"), "¿Qué tal, Núria? 😀");
    assert.equal(Buffer.from(parts[2].split("\r\n\r\n")[1].replace(/\s/g, ""), "base64").toString("utf8"), "<p>¿Qué tal, Núria? 😀</p>");
  });

  it("un asunto largo se parte sin romper caracteres y cada trozo es válido", () => {
    const subject = "ñ😀".repeat(40);
    const encoded = encodeHeaderText(subject);
    const words = encoded.split("\r\n ");
    assert.ok(words.length > 1);
    for (const word of words) assert.ok(word.length <= 75, word);
    const decoded = words.map((word) => Buffer.from(/=\?UTF-8\?B\?([^?]+)\?=/.exec(word)![1], "base64").toString("utf8")).join("");
    assert.equal(decoded, subject);
  });

  it("un nombre con comas no parte la dirección del remitente", () => {
    const mime = Buffer.from(buildRawMessage(MESSAGE, { email: "yo@taller.es", name: "Taller, S.L." }), "base64url").toString("utf8");
    const encoded = /^From: =\?UTF-8\?B\?([^?]+)\?= <yo@taller\.es>\r\n/.exec(mime);
    assert.ok(encoded, mime);
    assert.equal(Buffer.from(encoded[1], "base64").toString("utf8"), "Taller, S.L.");
  });

  it("no deja inyectar cabeceras con saltos de línea", () => {
    const mime = Buffer.from(
      buildRawMessage({ ...MESSAGE, subject: "Hola\r\nBcc: robo@malo.com", to: "a@b.es\r\nBcc: robo@malo.com" }),
      "base64url",
    ).toString("utf8");
    assert.equal(/^Bcc:/m.test(mime), false);
  });
});

describe("conexión", () => {
  it("pide solo el scope de correo, sin los de Calendar", () => {
    const url = new URL(gmailConnectUrl({ userId: "user-1", workspaceId: A }, deps()));
    const scope = url.searchParams.get("scope")!.split(" ");
    assert.ok(scope.includes(GMAIL_SEND_SCOPE));
    for (const calendarScope of GOOGLE_SCOPES) assert.equal(scope.includes(calendarScope), false);
    assert.equal(url.searchParams.get("include_granted_scopes"), "true");
  });

  it("el callback guarda aparte de Calendar: dirección, scopes y sin tocar su conexión", async () => {
    fake.tables.integrations.push({ config: { account_email: "cal@x.es" }, provider: "google_calendar", status: "active", workspace_id: A });
    routes.push((call) =>
      call.url === TOKEN_URL
        ? { body: { access_token: "new", expires_in: 3600, refresh_token: "r", scope: `${GMAIL_SEND_SCOPE} openid email` }, status: 200 }
        : call.url.includes("userinfo")
          ? { body: { email: "yo@empresa.es" }, status: 200 }
          : undefined,
    );
    const state = createOAuthState({ purpose: "gmail", userId: "user-1", workspaceId: A }, deps());
    const result = await completeGoogleCallback(client, { code: "c", error: null, state }, "user-1", deps());

    assert.equal(result.ok, true);
    assert.equal(callbackRedirectPath(result), "/integraciones?gmail=conectado");
    const status = await getGmailStatus(client, A, ENV);
    assert.equal(status.accountEmail, "yo@empresa.es");
    assert.equal(status.canSend, true);
    assert.deepEqual(fake.tables.integrations.find((row) => row.provider === "gmail")?.config, {
      account_email: "yo@empresa.es",
      connected_at: NOW.toISOString(),
      scopes: [GMAIL_SEND_SCOPE, "openid", "email"],
    });
    assert.equal(fake.tables.integrations.find((row) => row.provider === "google_calendar")?.status, "active");
    assert.equal(fake.tables.integration_secrets.filter((row) => row.provider === "gmail").length, 1);
    assert.equal(fake.tables.integration_secrets.filter((row) => row.provider === "google_calendar").length, 0);
  });

  it("si desmarcan la casilla de enviar no queda conectado y lo explica", async () => {
    routes.push((call) =>
      call.url === TOKEN_URL ? { body: { access_token: "new", refresh_token: "r", scope: "openid email" }, status: 200 } : undefined,
    );
    const state = createOAuthState({ purpose: "gmail", userId: "user-1", workspaceId: A }, deps());
    const result = await completeGoogleCallback(client, { code: "c", error: null, state }, "user-1", deps());

    assert.equal(result.ok, false);
    assert.match(callbackRedirectPath(result), /^\/integraciones\?gmail=error&motivo=/);
    assert.equal(fake.tables.integration_secrets.length, 0);
    assert.equal((await getGmailStatus(client, A, ENV)).connected, false);
  });

  it("el state de Calendar sigue conectando Calendar", async () => {
    routes.push((call) =>
      call.url === TOKEN_URL ? { body: { access_token: "new", refresh_token: "r", scope: GOOGLE_SCOPES.join(" ") }, status: 200 } : undefined,
    );
    const state = createOAuthState({ userId: "user-1", workspaceId: A }, deps());
    const result = await completeGoogleCallback(client, { code: "c", error: null, state }, "user-1", deps());

    assert.equal(callbackRedirectPath(result), "/integraciones?google=conectado");
    assert.equal(fake.tables.integrations[0].provider, "google_calendar");
  });

  it("desconectar uno no revoca el acceso del otro; el último sí revoca", async () => {
    connect(A, "yo@empresa.es");
    fake.tables.integrations.push({ provider: "google_calendar", status: "active", workspace_id: A });
    fake.tables.integration_secrets.push({
      ciphertext: encryptSecret(JSON.stringify(tokens({ refreshToken: "refresh-cal" }))),
      kind: "oauth_tokens",
      provider: "google_calendar",
      workspace_id: A,
    });

    await disconnectGmail(client, A, deps());
    assert.equal(calls.filter((call) => call.url.includes("/revoke")).length, 0);
    assert.deepEqual(fake.tables.integration_secrets.map((row) => row.provider), ["google_calendar"]);
    assert.equal((await getGmailStatus(client, A, ENV)).status, "disabled");

    await disconnect(client, A, deps());
    assert.equal(calls.filter((call) => call.url.includes("/revoke")).length, 1);
    assert.equal(fake.tables.integration_secrets.length, 0);
  });
});

describe("sendGmail", () => {
  it("envía con el token de la empresa y su dirección como remitente", async () => {
    connect(A, "yo@empresa.es");
    const result = await sendGmail(client, A, MESSAGE, deps(), { fromName: "Clinica Sol" });

    assert.deepEqual(result, { from: "yo@empresa.es", id: "gmail-1" });
    const { auth, mime } = sentMessage();
    assert.equal(auth, "Bearer access-a");
    assert.match(mime, /From: Clinica Sol <yo@empresa\.es>/);
    assert.match(mime, /To: cliente@ejemplo\.com/);
  });

  it("renueva el token caducado y conserva el refresh y los scopes", async () => {
    connect(A, "yo@empresa.es", tokens({ expiresAt: new Date(NOW.getTime() - 1000).toISOString() }));
    routes.push((call) => (call.url === TOKEN_URL ? { body: { access_token: "fresh", expires_in: 3600 }, status: 200 } : undefined));

    await sendGmail(client, A, MESSAGE, deps());
    assert.equal(sentMessage().auth, "Bearer fresh");

    // Con el token renovado (sin `scope` en la respuesta) se sigue pudiendo enviar.
    calls.length = 0;
    await sendGmail(client, A, MESSAGE, deps());
    assert.equal(sentMessage().auth, "Bearer fresh");
    assert.equal(calls.filter((call) => call.url === TOKEN_URL).length, 0);
  });

  it("un 401 de Gmail renueva y reintenta una vez", async () => {
    connect(A, "yo@empresa.es");
    routes.unshift((call) => (call.url === SEND_URL && call.auth === "Bearer access-a" ? { status: 401 } : undefined));
    routes.push((call) => (call.url === TOKEN_URL ? { body: { access_token: "fresh", scope: GMAIL_SEND_SCOPE }, status: 200 } : undefined));

    await sendGmail(client, A, MESSAGE, deps());
    assert.equal(sentMessage().auth, "Bearer fresh");
  });

  it("permiso retirado en Google: la integración queda en error con el motivo", async () => {
    connect(A, "yo@empresa.es", tokens({ expiresAt: new Date(NOW.getTime() - 1000).toISOString() }));
    routes.push((call) => (call.url === TOKEN_URL ? { body: { error: "invalid_grant" }, status: 400 } : undefined));

    await assert.rejects(
      () => sendGmail(client, A, MESSAGE, deps()),
      (error: GoogleCalendarError) => error.code === "reconnect_required" && /correo de Google/.test(error.message),
    );
    const status = await getGmailStatus(client, A, ENV);
    assert.equal(status.status, "error");
    assert.match(status.lastError ?? "", /correo de Google/);
    await assert.rejects(
      () => sendGmail(client, A, MESSAGE, deps()),
      (error: GoogleCalendarError) => error.code === "reconnect_required",
    );
  });

  it("scope no concedido: no llama a Gmail", async () => {
    connect(A, "yo@empresa.es", tokens({ scope: "openid email" }));
    await assert.rejects(
      () => sendGmail(client, A, MESSAGE, deps()),
      (error: GoogleCalendarError) => error.code === "missing_scope",
    );
    assert.equal(calls.filter((call) => call.url === SEND_URL).length, 0);
  });

  it("403 por permisos insuficientes marca la integración para reconectar", async () => {
    connect(A, "yo@empresa.es");
    routes.unshift((call) =>
      call.url === SEND_URL ? { body: { error: { errors: [{ reason: "insufficientPermissions" }], message: "no" } }, status: 403 } : undefined,
    );
    await assert.rejects(
      () => sendGmail(client, A, MESSAGE, deps()),
      (error: GoogleCalendarError) => error.code === "missing_scope",
    );
    assert.equal((await getGmailStatus(client, A, ENV)).status, "error");
  });

  it("429 es pasajero y no desconecta nada", async () => {
    connect(A, "yo@empresa.es");
    routes.unshift((call) => (call.url === SEND_URL ? { status: 429 } : undefined));
    await assert.rejects(
      () => sendGmail(client, A, MESSAGE, deps()),
      (error: GoogleCalendarError) => error.code === "temporary",
    );
    assert.equal((await getGmailStatus(client, A, ENV)).connected, true);
  });

  it("aislamiento: B sin conexión no usa el Gmail de A", async () => {
    connect(A, "yo@empresa.es");
    await assert.rejects(
      () => sendGmail(client, B, MESSAGE, deps()),
      (error: GoogleCalendarError) => error.code === "not_connected",
    );
    assert.equal(calls.length, 0);
  });

  it("aislamiento: cada empresa envía con sus tokens", async () => {
    connect(A, "a@empresa.es");
    connect(B, "b@taller.es", tokens({ accessToken: "access-b", refreshToken: "refresh-b" }));

    await sendGmail(client, B, MESSAGE, deps());
    assert.equal(sentMessage().auth, "Bearer access-b");
    assert.match(sentMessage().mime, /From: b@taller\.es/);
  });
});

describe("sendSystemEmail", () => {
  const RESEND_ENV = { ...ENV, EMAIL_FROM: "Levy <hola@levy.test>", RESEND_API_KEY: "re_key" };
  const RESEND_URL = "https://api.resend.com/emails";

  function resendRoute() {
    routes.push((call) => (call.url === RESEND_URL ? { body: { id: "re-1" }, status: 200 } : undefined));
  }

  it("usa el Gmail de AAA001 si está conectado, no Resend", async () => {
    connect(AGENCY, "hola@levy.es", tokens({ accessToken: "access-levy" }));
    resendRoute();
    const result = await sendSystemEmail(client, MESSAGE, { env: RESEND_ENV, fetch: deps().fetch, now: () => NOW });

    assert.deepEqual(result, { id: "gmail-1", via: "gmail" });
    assert.equal(sentMessage().auth, "Bearer access-levy");
    assert.equal(calls.some((call) => call.url === RESEND_URL), false);
  });

  it("no usa el Gmail de otra empresa: cae a Resend", async () => {
    connect(A, "yo@empresa.es");
    resendRoute();
    const result = await sendSystemEmail(client, MESSAGE, { env: RESEND_ENV, fetch: deps().fetch, now: () => NOW });

    assert.deepEqual(result, { id: "re-1", via: "resend" });
    assert.equal(calls.some((call) => call.url === SEND_URL), false);
  });

  it("si falla el Gmail de AAA001, respaldo con Resend", async () => {
    connect(AGENCY, "hola@levy.es");
    routes.unshift((call) => (call.url === SEND_URL ? { status: 500 } : undefined));
    resendRoute();
    const result = await sendSystemEmail(client, MESSAGE, { env: RESEND_ENV, fetch: deps().fetch, now: () => NOW });

    assert.equal(result.via, "resend");
  });

  it("sin ninguno: error claro", async () => {
    await assert.rejects(
      () => sendSystemEmail(client, MESSAGE, { env: ENV, fetch: deps().fetch, now: () => NOW }),
      (error: EmailError) => error.code === "not_configured" && /RESEND_API_KEY/.test(error.message),
    );
  });

  it("Gmail falla y no hay Resend: dice por qué", async () => {
    connect(AGENCY, "hola@levy.es");
    routes.unshift((call) => (call.url === SEND_URL ? { status: 500 } : undefined));
    await assert.rejects(
      () => sendSystemEmail(client, MESSAGE, { env: ENV, fetch: deps().fetch, now: () => NOW }),
      (error: EmailError) => error.code === "failed" && /Gmail/.test(error.message),
    );
  });
});

describe("correo a un contacto", () => {
  const OPERATOR = { kind: "operator" as const, userId: "user-1" };
  const send = (workspaceId: string, contactId: string, input = { body: "Línea 1\nLínea <2>", subject: "Tu cita" }) =>
    sendContactEmail(client, workspaceId, contactId, input, OPERATOR, { google: deps() });

  it("envía con el Gmail de la empresa, escapa el HTML y lo apunta en la actividad", async () => {
    connect(A, "yo@empresa.es");
    assert.deepEqual(await send(A, "contact-a"), { from: "yo@empresa.es", id: "gmail-1", to: "ana@ejemplo.com" });

    const { mime } = sentMessage();
    const boundary = /boundary="([^"]+)"/.exec(mime)![1];
    const html = Buffer.from(mime.split(`--${boundary}`)[2].split("\r\n\r\n")[1].replace(/\s/g, ""), "base64").toString("utf8");
    assert.equal(html, "<div>Línea 1<br>Línea &lt;2&gt;</div>");
    assert.match(mime, /From: =\?UTF-8/);

    const [activity] = fake.tables.crm_contact_activity;
    assert.equal(activity.kind, "email_sent");
    assert.equal(activity.actor, "operator");
    assert.equal(activity.workspace_id, A);
    assert.equal((activity.data as { subject: string }).subject, "Tu cita");
  });

  it("si Google falla queda en la actividad y el error llega al panel", async () => {
    await assert.rejects(
      () => send(A, "contact-a"),
      (error: GoogleCalendarError) => error.code === "not_connected",
    );
    assert.equal(fake.tables.crm_contact_activity[0].kind, "email_failed");
  });

  it("valida asunto, cuerpo y que el contacto tenga correo", async () => {
    connect(A, "yo@empresa.es");
    await assert.rejects(() => send(A, "contact-a", { body: "x", subject: "  " }), /asunto/i);
    await assert.rejects(() => send(A, "contact-a", { body: " ", subject: "x" }), /texto/i);
    await assert.rejects(() => send(A, "contact-a2"), /no tiene correo/);
    assert.equal(calls.length, 0);
  });

  it("aislamiento: A no puede escribir a un contacto de B ni leer sus variables", async () => {
    connect(A, "yo@empresa.es");
    await assert.rejects(() => send(A, "contact-b"), /no existe en esta empresa/);
    await assert.rejects(() => contactEmailVariables(client, A, "contact-b"), /no existe en esta empresa/);
    assert.equal(calls.length, 0);
    assert.equal(fake.tables.crm_contact_activity.length, 0);
  });

  it("empresa bloqueada por impago: no envía", async () => {
    connect(A, "yo@empresa.es");
    const row = fake.tables.workspace_billing.find((item) => item.workspace_id === A)!;
    Object.assign(row, { billing_exempt: false, status: "canceled" });

    await assert.rejects(() => send(A, "contact-a"), /sin pagar/);
    assert.equal(calls.length, 0);
  });

  it("acción de flujo send_email: variables del contacto y respuestas; un fallo no para las demás", async () => {
    connect(A, "yo@empresa.es");
    const actions: FlowCrmAction[] = [
      { emailBody: "Hola {{nombre}} de {{empresa}}: {{respuesta}}", emailSubject: "Sobre {{respuesta}}", engine: "crm", label: "Correo", type: "send_email" },
      { emailBody: "x", emailSubject: "y", engine: "crm", label: "Otro", type: "send_email" },
      { engine: "crm", label: "Nota", noteBody: "hecho", type: "add_note" },
    ];

    const first = await runCrmFlowActions(client, A, "contact-a", [actions[0]], { respuesta: "precios" }, { google: deps() });
    assert.deepEqual(first.results, [{ action: "send_email", detail: "ana@ejemplo.com", ok: true }]);
    const { mime } = sentMessage();
    const boundary = /boundary="([^"]+)"/.exec(mime)![1];
    const text = Buffer.from(mime.split(`--${boundary}`)[1].split("\r\n\r\n")[1].replace(/\s/g, ""), "base64").toString("utf8");
    assert.equal(text, "Hola Ana de Clínica: precios");
    assert.match(mime, /Subject: Sobre precios/);
    assert.equal(fake.tables.crm_contact_activity[0].actor, "flow");

    const second = await runCrmFlowActions(client, A, "contact-a2", actions.slice(1), {}, { google: deps() });
    assert.equal(second.results[0].ok, false);
    assert.equal(second.results[0].error, "Este contacto no tiene correo.");
    assert.equal(second.results[1].ok, true);
  });
});
