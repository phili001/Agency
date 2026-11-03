import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { callbackRedirectPath, completeGoogleCallback } from "./google-calendar-callback.ts";
import { GOOGLE_SCOPES, type GoogleDeps, createOAuthState } from "./google-calendar.ts";

process.env.INTEGRATION_ENCRYPTION_KEY = "clave-de-prueba-de-32-caracteres!!";

const A = "workspace-a";
const B = "workspace-b";
const ENV = {
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
  NEXT_PUBLIC_APP_URL: "https://app.levy.test",
};

let fake: FakeSupabase;
let client: CrmClient;
let tokenCalls: number;

const deps: GoogleDeps = {
  env: ENV,
  fetch: (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/token")) {
      tokenCalls += 1;
      return new Response(
        JSON.stringify({ access_token: "a", expires_in: 3600, refresh_token: "r", scope: GOOGLE_SCOPES.join(" ") }),
        { status: 200 },
      );
    }
    if (url.includes("/calendarList")) {
      return new Response(JSON.stringify({ items: [{ accessRole: "owner", id: "dueno@x.com", primary: true }] }), { status: 200 });
    }
    throw new Error(`sin ruta ${url}`);
  }) as typeof fetch,
};

beforeEach(() => {
  tokenCalls = 0;
  fake = createCrmFake({
    workspace_members: [
      { role: "owner", user_id: "owner-a", workspace_id: A },
      { role: "agent", user_id: "agent-a", workspace_id: A },
      { role: "owner", user_id: "owner-b", workspace_id: B },
    ],
  });
  client = fake as unknown as CrmClient;
});

describe("callback de Google", () => {
  it("conecta la empresa del state firmado", async () => {
    const state = createOAuthState({ userId: "owner-a", workspaceId: A }, deps);
    const result = await completeGoogleCallback(client, { code: "c", error: null, state }, "owner-a", deps);
    assert.deepEqual(result, { accountEmail: "dueno@x.com", ok: true, purpose: "calendar", workspaceId: A });
    assert.equal(fake.table("integrations")[0].workspace_id, A);
    assert.equal(fake.table("integrations")[0].status, "active");
    assert.equal(callbackRedirectPath(result), "/integraciones?google=conectado");
  });

  it("rechaza el state de otro usuario sin canjear el código", async () => {
    const state = createOAuthState({ userId: "owner-a", workspaceId: A }, deps);
    const result = await completeGoogleCallback(client, { code: "c", error: null, state }, "owner-b", deps);
    assert.equal(result.ok, false);
    assert.equal(tokenCalls, 0);
    assert.equal(fake.table("integrations").length, 0);
  });

  it("un agente no puede conectar Google", async () => {
    const state = createOAuthState({ userId: "agent-a", workspaceId: A }, deps);
    const result = await completeGoogleCallback(client, { code: "c", error: null, state }, "agent-a", deps);
    assert.equal(result.ok, false);
    assert.equal(tokenCalls, 0);
  });

  it("no se puede apuntar a una empresa de la que no eres miembro", async () => {
    const state = createOAuthState({ userId: "owner-a", workspaceId: B }, deps);
    const result = await completeGoogleCallback(client, { code: "c", error: null, state }, "owner-a", deps);
    assert.equal(result.ok, false);
    assert.equal(fake.table("integrations").length, 0);
  });

  it("cancelación en Google y errores con mensaje para el panel", async () => {
    const state = createOAuthState({ userId: "owner-a", workspaceId: A }, deps);
    const denied = await completeGoogleCallback(client, { code: null, error: "access_denied", state }, "owner-a", deps);
    assert.deepEqual(denied, { message: "Cancelaste la conexión con Google.", ok: false, purpose: "calendar" });
    const path = callbackRedirectPath(denied);
    assert.ok(path.startsWith("/integraciones?google=error&motivo="));
    assert.equal(new URLSearchParams(path.split("?")[1]).get("motivo"), "Cancelaste la conexión con Google.");
    const noCode = await completeGoogleCallback(client, { code: null, error: null, state }, "owner-a", deps);
    assert.equal(noCode.ok, false);
    const badState = await completeGoogleCallback(client, { code: "c", error: null, state: "x.y" }, "owner-a", deps);
    assert.equal(badState.ok, false);
  });
});
