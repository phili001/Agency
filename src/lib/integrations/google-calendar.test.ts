import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { decryptSecret, encryptSecret } from "./crypto.ts";
import {
  GOOGLE_SCOPES,
  type GoogleDeps,
  GoogleCalendarError,
  type GoogleTokens,
  buildAuthUrl,
  createOAuthState,
  deleteEvent,
  disconnect,
  eventIdForAppointment,
  exchangeCode,
  freeBusy,
  getAccessToken,
  getConnectionStatus,
  listCalendars,
  saveConnection,
  upsertEvent,
  verifyOAuthState,
  writableCalendars,
} from "./google-calendar.ts";

process.env.INTEGRATION_ENCRYPTION_KEY = "clave-de-prueba-de-32-caracteres!!";

const A = "workspace-a";
const B = "workspace-b";
const ENV = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
  NEXT_PUBLIC_APP_URL: "https://app.levy.test/",
};
const NOW = new Date("2026-09-07T10:00:00Z");

type Call = { body: string | null; method: string; url: string };
type Route = (call: Call) => { body?: unknown; status: number } | undefined;

let fake: FakeSupabase;
let client: CrmClient;
let calls: Call[];
let routes: Route[];

function deps(extra: Partial<GoogleDeps> = {}): GoogleDeps {
  return {
    env: ENV,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = { body: init?.body ? String(init.body) : null, method: init?.method ?? "GET", url: String(input) };
      calls.push(call);
      for (const route of routes) {
        const result = route(call);
        if (result) {
          return new Response(result.body === undefined ? null : JSON.stringify(result.body), { status: result.status });
        }
      }
      throw new Error(`fetch sin ruta: ${call.method} ${call.url}`);
    }) as typeof fetch,
    now: () => NOW,
    ...extra,
  };
}

function storeTokens(workspaceId: string, tokens: Partial<GoogleTokens>) {
  fake.table("integration_secrets").push({
    ciphertext: encryptSecret(
      JSON.stringify({ accessToken: "access-1", expiresAt: "2026-09-07T11:00:00Z", refreshToken: "refresh-1", scope: GOOGLE_SCOPES.join(" "), ...tokens }),
    ),
    kind: "oauth_tokens",
    provider: "google_calendar",
    workspace_id: workspaceId,
  });
  fake.table("integrations").push({ provider: "google_calendar", status: "active", workspace_id: workspaceId });
}

const tokenOk = (call: Call) =>
  call.url.startsWith("https://oauth2.googleapis.com/token")
    ? { body: { access_token: "access-2", expires_in: 3600, scope: GOOGLE_SCOPES.join(" ") }, status: 200 }
    : undefined;

beforeEach(() => {
  fake = createCrmFake({});
  client = fake as unknown as CrmClient;
  calls = [];
  routes = [];
});

describe("state del OAuth", () => {
  it("firmado, ligado al usuario y con caducidad", () => {
    const state = createOAuthState({ userId: "user-1", workspaceId: A }, deps());
    assert.deepEqual(verifyOAuthState(state, "user-1", deps()), { userId: "user-1", workspaceId: A });

    const isInvalid = (error: unknown) => error instanceof GoogleCalendarError && error.code === "invalid_state";
    assert.throws(() => verifyOAuthState(state, "otro-usuario", deps()), isInvalid);
    assert.throws(() => verifyOAuthState(state, "user-1", deps({ now: () => new Date(NOW.getTime() + 11 * 60_000) })), isInvalid);

    // Cambiar la empresa dentro del payload rompe la firma.
    const [payload, signature] = state.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), w: B }),
    ).toString("base64url");
    assert.throws(() => verifyOAuthState(`${forged}.${signature}`, "user-1", deps()), isInvalid);
    assert.throws(() => verifyOAuthState("basura", "user-1", deps()), isInvalid);
    assert.throws(() => verifyOAuthState(null, "user-1", deps()), isInvalid);
  });

  it("URL de autorización con acceso offline y la redirección del panel", () => {
    const url = new URL(buildAuthUrl("st", deps()));
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("prompt"), "consent");
    assert.equal(url.searchParams.get("redirect_uri"), "https://app.levy.test/api/integrations/google-calendar/callback");
    assert.equal(url.searchParams.get("scope"), GOOGLE_SCOPES.join(" "));
    assert.throws(() => buildAuthUrl("st", deps({ env: {} })), (error) => error instanceof GoogleCalendarError && error.code === "not_configured");
  });
});

describe("conexión y tokens", () => {
  it("canjea el código, exige scopes y refresh token", async () => {
    routes.push((call) =>
      call.url.startsWith("https://oauth2.googleapis.com/token")
        ? { body: { access_token: "a", expires_in: 3600, refresh_token: "r", scope: GOOGLE_SCOPES.join(" ") }, status: 200 }
        : undefined,
    );
    const tokens = await exchangeCode("code", deps());
    assert.equal(tokens.refreshToken, "r");
    assert.equal(tokens.expiresAt, "2026-09-07T11:00:00.000Z");
    assert.match(calls[0].body ?? "", /grant_type=authorization_code/);

    routes = [(call) => (call.url.includes("/token") ? { body: { access_token: "a", refresh_token: "r", scope: GOOGLE_SCOPES[1] }, status: 200 } : undefined)];
    await assert.rejects(exchangeCode("code", deps()), (error) => error instanceof GoogleCalendarError && error.code === "missing_scope");

    routes = [(call) => (call.url.includes("/token") ? { body: { access_token: "a", scope: GOOGLE_SCOPES.join(" ") }, status: 200 } : undefined)];
    await assert.rejects(exchangeCode("code", deps()), (error) => error instanceof GoogleCalendarError && error.code === "reconnect_required");
  });

  it("guarda tokens cifrados y la cuenta conectada", async () => {
    routes.push((call) =>
      call.url.includes("/calendarList")
        ? { body: { items: [{ accessRole: "owner", id: "ana@gmail.com", primary: true, summary: "Ana" }] }, status: 200 }
        : undefined,
    );
    const result = await saveConnection(
      client,
      A,
      { accessToken: "a", expiresAt: "2026-09-07T11:00:00Z", refreshToken: "r", scope: GOOGLE_SCOPES.join(" ") },
      deps(),
    );
    assert.equal(result.accountEmail, "ana@gmail.com");
    const secret = fake.table("integration_secrets")[0];
    assert.ok(!String(secret.ciphertext).includes("\"r\""));
    assert.equal(JSON.parse(decryptSecret(String(secret.ciphertext))).refreshToken, "r");
    const status = await getConnectionStatus(client, A, ENV);
    assert.equal(status.connected, true);
    assert.equal(status.accountEmail, "ana@gmail.com");
  });

  it("usa el token vigente y renueva el caducado conservando el refresh token", async () => {
    storeTokens(A, {});
    assert.equal(await getAccessToken(client, A, deps()), "access-1");
    assert.equal(calls.length, 0);

    fake.tables.integration_secrets = [];
    fake.tables.integrations = [];
    storeTokens(A, { expiresAt: "2026-09-07T10:00:30Z" });
    routes.push(tokenOk);
    assert.equal(await getAccessToken(client, A, deps()), "access-2");
    const saved = JSON.parse(decryptSecret(String(fake.table("integration_secrets")[0].ciphertext)));
    assert.equal(saved.accessToken, "access-2");
    assert.equal(saved.refreshToken, "refresh-1");
  });

  it("rechazo definitivo de Google: integración en error con mensaje", async () => {
    storeTokens(A, { expiresAt: "2026-09-07T09:00:00Z" });
    routes.push((call) => (call.url.includes("/token") ? { body: { error: "invalid_grant" }, status: 400 } : undefined));
    await assert.rejects(getAccessToken(client, A, deps()), (error) => error instanceof GoogleCalendarError && error.code === "reconnect_required");
    const integration = fake.table("integrations").find((row) => row.workspace_id === A);
    assert.equal(integration?.status, "error");
    assert.match(String(integration?.last_error), /Vuelve a conectar/);
  });

  it("fallo pasajero: no desconecta", async () => {
    storeTokens(A, { expiresAt: "2026-09-07T09:00:00Z" });
    routes.push((call) => (call.url.includes("/token") ? { status: 503 } : undefined));
    await assert.rejects(getAccessToken(client, A, deps()), (error) => error instanceof GoogleCalendarError && error.code === "temporary");
    assert.equal(fake.table("integrations").find((row) => row.workspace_id === A)?.status, "active");
  });

  it("credenciales ilegibles o sin conexión", async () => {
    fake.table("integration_secrets").push({ ciphertext: "roto", kind: "oauth_tokens", provider: "google_calendar", workspace_id: A });
    await assert.rejects(getAccessToken(client, A, deps()), (error) => error instanceof GoogleCalendarError && error.code === "reconnect_required");
    await assert.rejects(getAccessToken(client, B, deps()), (error) => error instanceof GoogleCalendarError && error.code === "not_connected");
  });

  it("desconectar revoca, borra los tokens y deja la integración desactivada", async () => {
    storeTokens(A, {});
    storeTokens(B, {});
    routes.push((call) => (call.url.startsWith("https://oauth2.googleapis.com/revoke") ? { status: 200 } : undefined));
    await disconnect(client, A, deps());
    assert.match(calls[0].url, /token=refresh-1/);
    assert.deepEqual(fake.table("integration_secrets").map((row) => row.workspace_id), [B]);
    assert.equal(fake.table("integrations").find((row) => row.workspace_id === A)?.status, "disabled");
    assert.equal(fake.table("integrations").find((row) => row.workspace_id === B)?.status, "active");
  });
});

describe("API de Calendar", () => {
  it("lista calendarios y filtra los escribibles", async () => {
    storeTokens(A, {});
    routes.push((call) =>
      call.url.includes("/calendarList")
        ? {
            body: {
              items: [
                { accessRole: "owner", id: "a@x.com", primary: true, summary: "Principal" },
                { accessRole: "reader", id: "festivos", summary: "Festivos" },
                { accessRole: "writer", id: "equipo", summaryOverride: "Equipo" },
              ],
            },
            status: 200,
          }
        : undefined,
    );
    const calendars = await listCalendars(client, A, deps());
    assert.deepEqual(writableCalendars(calendars).map((calendar) => calendar.summary), ["Principal", "Equipo"]);
  });

  it("freeBusy convierte los tramos ocupados", async () => {
    storeTokens(A, {});
    routes.push((call) =>
      call.url.endsWith("/freeBusy")
        ? {
            body: {
              calendars: {
                "a@x.com": { busy: [{ end: "2026-09-07T11:00:00Z", start: "2026-09-07T10:00:00Z" }, { end: "x", start: "y" }] },
              },
            },
            status: 200,
          }
        : undefined,
    );
    const busy = await freeBusy(client, A, ["a@x.com"], NOW, new Date("2026-09-08T00:00:00Z"), deps());
    assert.deepEqual(busy, [{ end: new Date("2026-09-07T11:00:00Z"), start: new Date("2026-09-07T10:00:00Z") }]);
    assert.deepEqual(await freeBusy(client, A, [], NOW, NOW, deps()), []);
  });

  it("un 401 renueva el token y reintenta una vez", async () => {
    storeTokens(A, {});
    routes.push(tokenOk, (call) => {
      if (!call.url.includes("/calendarList")) return undefined;
      return calls.filter((item) => item.url.includes("/calendarList")).length === 1 ? { status: 401 } : { body: { items: [] }, status: 200 };
    });
    assert.deepEqual(await listCalendars(client, A, deps()), []);
    assert.equal(calls.filter((call) => call.url.includes("/token")).length, 1);
  });

  it("evento con id fijo: crea, y si ya existe lo actualiza", async () => {
    storeTokens(A, {});
    const appointmentId = "0f8fad5b-d9cb-469f-a165-70867728950e";
    assert.equal(eventIdForAppointment(appointmentId), "0f8fad5bd9cb469fa16570867728950e");

    routes.push((call) => (call.method === "POST" && call.url.includes("/events") ? { status: 409 } : undefined));
    routes.push((call) => (call.method === "PUT" ? { body: {}, status: 200 } : undefined));
    const result = await upsertEvent(
      client,
      A,
      "primary",
      appointmentId,
      { end: new Date("2026-09-07T11:00:00Z"), start: NOW, summary: "Cita con Ana", timeZone: "Europe/Madrid" },
      deps(),
    );
    assert.deepEqual(result, { eventId: "0f8fad5bd9cb469fa16570867728950e", result: "updated" });
    const created = JSON.parse(calls[0].body ?? "{}");
    assert.equal(created.id, "0f8fad5bd9cb469fa16570867728950e");
    assert.equal(created.start.timeZone, "Europe/Madrid");
    assert.match(calls[1].url, /events\/0f8fad5bd9cb469fa16570867728950e\?sendUpdates=none$/);
  });

  it("borrar un evento ya borrado cuenta como hecho; un 403 no", async () => {
    storeTokens(A, {});
    routes.push((call) => (call.method === "DELETE" && call.url.includes("gone") ? { status: 410 } : undefined));
    routes.push((call) => (call.method === "DELETE" ? { body: { error: { message: "Forbidden" } }, status: 403 } : undefined));
    await deleteEvent(client, A, "primary", "gone", deps());
    await assert.rejects(deleteEvent(client, A, "primary", "evt", deps()), (error) => error instanceof GoogleCalendarError && error.code === "api_error");
  });

  it("cada empresa usa sus propios tokens", async () => {
    storeTokens(A, { accessToken: "token-de-a" });
    storeTokens(B, { accessToken: "token-de-b" });
    const seen: string[] = [];
    const tracking = deps();
    const originalFetch = tracking.fetch!;
    tracking.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(String((init?.headers as Record<string, string>)?.Authorization));
      return originalFetch(input, init);
    }) as typeof fetch;
    routes.push((call) => (call.url.includes("/calendarList") ? { body: { items: [] }, status: 200 } : undefined));
    await listCalendars(client, B, tracking);
    assert.deepEqual(seen, ["Bearer token-de-b"]);
  });
});
