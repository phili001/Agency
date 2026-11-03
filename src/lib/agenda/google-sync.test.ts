import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { encryptSecret } from "../integrations/crypto.ts";
import { GOOGLE_SCOPES, type GoogleDeps } from "../integrations/google-calendar.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { createAgenda, getAgenda } from "./agendas.ts";
import { getAgendaFreeSlots } from "./appointments.ts";
import { googleBusyProvider, processGoogleDeletions, sweepGoogleSync, syncAppointment } from "./google-sync.ts";

process.env.INTEGRATION_ENCRYPTION_KEY = "clave-de-prueba-de-32-caracteres!!";

const A = "workspace-a";
const B = "workspace-b";
const APPT = "0f8fad5b-d9cb-469f-a165-70867728950e";
const EVENT = "0f8fad5bd9cb469fa16570867728950e";
const ENV = {
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
  NEXT_PUBLIC_APP_URL: "https://app.levy.test",
};

type Call = { body: string | null; method: string; url: string };
type Route = (call: Call) => { body?: unknown; status: number } | undefined;

let fake: FakeSupabase;
let client: CrmClient;
let calls: Call[];
let routes: Route[];

const deps: GoogleDeps = {
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
  now: () => new Date("2026-09-07T10:00:00Z"),
};

function connect(workspaceId: string, status = "active") {
  fake.table("integrations").push({ provider: "google_calendar", status, workspace_id: workspaceId });
  fake.table("integration_secrets").push({
    ciphertext: encryptSecret(
      JSON.stringify({ accessToken: `token-${workspaceId}`, expiresAt: "2026-09-07T12:00:00Z", refreshToken: "r", scope: GOOGLE_SCOPES.join(" ") }),
    ),
    kind: "oauth_tokens",
    provider: "google_calendar",
    workspace_id: workspaceId,
  });
}

async function agendaWithCalendar(workspaceId: string, mode = "push") {
  const agenda = await createAgenda(client, workspaceId, { googleCalendarId: "cal@x.com", googleSyncMode: mode, name: "Consultas", timezone: "Europe/Madrid" });
  return agenda;
}

function appointment(extra: Record<string, unknown> = {}) {
  const row = {
    agenda_id: "",
    contact_id: "contact-a",
    ends_at: "2026-09-08T09:00:00Z",
    google_event_id: null,
    google_sync_pending: true,
    id: APPT,
    service: "Primera visita",
    starts_at: "2026-09-08T08:00:00Z",
    status: "scheduled",
    updated_at: "2026-09-07T09:00:00Z",
    workspace_id: A,
    ...extra,
  };
  fake.table("appointments").push(row);
  return row;
}

beforeEach(() => {
  fake = createCrmFake({ contacts: [{ full_name: "Ana", id: "contact-a", phone_e164: "+34600000001", workspace_id: A }] });
  client = fake as unknown as CrmClient;
  calls = [];
  routes = [];
});

describe("copia de una cita", () => {
  it("crea el evento con id fijo, nombre y zona, y baja la marca", async () => {
    connect(A);
    const agenda = await agendaWithCalendar(A);
    const row = appointment({ agenda_id: agenda.id });
    routes.push((call) => (call.method === "POST" && call.url.includes("/events") ? { body: {}, status: 200 } : undefined));

    assert.equal(await syncAppointment(client, A, APPT, deps), "created");
    const body = JSON.parse(calls[0].body ?? "{}");
    assert.equal(body.id, EVENT);
    assert.equal(body.summary, "Primera visita · Ana");
    assert.equal(body.start.timeZone, "Europe/Madrid");
    assert.match(body.description, /\+34600000001/);
    assert.equal(row.google_sync_pending, false);
    assert.equal(row.google_event_id, EVENT);
    assert.equal(await syncAppointment(client, A, APPT, deps), "nothing_to_do");
  });

  it("cancelada: borra la copia; completada: la deja", async () => {
    connect(A);
    const agenda = await agendaWithCalendar(A);
    const row = appointment({ agenda_id: agenda.id, google_event_id: EVENT, status: "cancelled" });
    routes.push((call) => (call.method === "DELETE" ? { status: 204 } : undefined));
    assert.equal(await syncAppointment(client, A, APPT, deps), "deleted");
    assert.equal(row.google_event_id, null);

    calls = [];
    appointment({ agenda_id: agenda.id, google_event_id: "otro", id: "11111111-1111-1111-1111-111111111111", status: "completed" });
    assert.equal(await syncAppointment(client, A, "11111111-1111-1111-1111-111111111111", deps), "nothing_to_do");
    assert.equal(calls.length, 0);
  });

  it("agenda sin copia a Google: baja la marca sin llamar a Google", async () => {
    connect(A);
    const agenda = await createAgenda(client, A, { name: "Sin Google", timezone: "Europe/Madrid" });
    const row = appointment({ agenda_id: agenda.id });
    assert.equal(await syncAppointment(client, A, APPT, deps), "nothing_to_do");
    assert.equal(row.google_sync_pending, false);
    assert.equal(calls.length, 0);
  });

  it("si la cita cambia mientras se copia, la marca se queda", async () => {
    connect(A);
    const agenda = await agendaWithCalendar(A);
    const row = appointment({ agenda_id: agenda.id });
    routes.push((call) => {
      if (call.method !== "POST") return undefined;
      row.updated_at = "2026-09-07T09:59:00Z"; // alguien la movió a la vez
      return { body: {}, status: 200 };
    });
    assert.equal(await syncAppointment(client, A, APPT, deps), "changed_meanwhile");
    assert.equal(row.google_sync_pending, true);
  });

  it("si la cita se borra mientras se copia, el evento queda apuntado para borrar", async () => {
    connect(A);
    const agenda = await agendaWithCalendar(A);
    appointment({ agenda_id: agenda.id });
    routes.push((call) => {
      if (call.method !== "POST") return undefined;
      fake.tables.appointments = [];
      return { body: {}, status: 200 };
    });
    assert.equal(await syncAppointment(client, A, APPT, deps), "deleted_meanwhile");
    assert.deepEqual(fake.table("google_event_deletions").map((row) => row.google_event_id), [EVENT]);
  });

  it("no toca citas de otra empresa", async () => {
    connect(A);
    const agenda = await agendaWithCalendar(B);
    const row = appointment({ agenda_id: agenda.id, workspace_id: B });
    assert.equal(await syncAppointment(client, A, APPT, deps), "missing");
    assert.equal(row.google_sync_pending, true);
  });
});

describe("barrida", () => {
  it("solo empresas conectadas; Google caído corta esa empresa y la marca se queda", async () => {
    connect(A);
    connect(B, "error");
    const agendaA = await agendaWithCalendar(A);
    const agendaB = await agendaWithCalendar(B);
    const rowA = appointment({ agenda_id: agendaA.id });
    const rowA2 = appointment({ agenda_id: agendaA.id, id: "22222222-2222-2222-2222-222222222222", updated_at: "2026-09-07T09:30:00Z" });
    const rowB = appointment({ agenda_id: agendaB.id, id: "33333333-3333-3333-3333-333333333333", workspace_id: B });
    routes.push((call) => (call.method === "POST" ? { status: 503 } : undefined));

    const result = await sweepGoogleSync(client, deps);
    assert.deepEqual(result, { deletionsDone: 0, deletionsFailed: 0, failed: 1, synced: 0 });
    assert.equal(calls.length, 1); // cortó tras el primer fallo
    assert.ok(rowA.google_sync_pending && rowA2.google_sync_pending && rowB.google_sync_pending);
    assert.ok(calls.every((call) => !call.url.includes("33333333")));
  });

  it("sin credenciales de Google en el servidor no hace nada", async () => {
    connect(A);
    assert.deepEqual(await sweepGoogleSync(client, { ...deps, env: {} }), { deletionsDone: 0, deletionsFailed: 0, failed: 0, synced: 0 });
  });

  it("borrados pendientes: hechos se quitan, fallidos suman intentos", async () => {
    connect(A);
    fake.table("google_event_deletions").push(
      { attempts: 0, calendar_id: "cal", google_event_id: "ok", id: "d1", workspace_id: A },
      { attempts: 0, calendar_id: "cal", google_event_id: "prohibido", id: "d2", workspace_id: A },
      { attempts: 10, calendar_id: "cal", google_event_id: "agotado", id: "d3", workspace_id: A },
      { attempts: 0, calendar_id: "cal", google_event_id: "de-b", id: "d4", workspace_id: B },
    );
    routes.push((call) => {
      if (call.method !== "DELETE") return undefined;
      return call.url.includes("prohibido") ? { body: { error: { message: "Forbidden" } }, status: 403 } : { status: 204 };
    });
    const outcome = await processGoogleDeletions(client, A, deps);
    assert.deepEqual(outcome, { done: 1, failed: 1, stopped: false });
    const left = fake.table("google_event_deletions");
    assert.deepEqual(left.map((row) => row.id).sort(), ["d2", "d3", "d4"]);
    assert.equal(left.find((row) => row.id === "d2")?.attempts, 1);
    assert.ok(calls.every((call) => !call.url.includes("agotado") && !call.url.includes("de-b")));
  });
});

describe("ocupado de Google en los huecos", () => {
  it("solo en push_and_busy, y si Google falla se ofrece igual", async () => {
    connect(A);
    const agenda = await agendaWithCalendar(A, "push_and_busy");
    routes.push((call) =>
      call.url.endsWith("/freeBusy")
        ? { body: { calendars: { "cal@x.com": { busy: [{ end: "2026-09-08T10:00:00Z", start: "2026-09-08T07:00:00Z" }] } } }, status: 200 }
        : undefined,
    );
    const now = new Date("2026-09-07T06:00:00Z");
    const provider = googleBusyProvider(client, A, deps);
    const busySlots = await getAgendaFreeSlots(client, A, agenda.id, { externalBusy: provider, fromDateKey: "2026-09-08", now, toDateKey: "2026-09-08" });
    assert.equal(busySlots.slots[0].start.toISOString(), "2026-09-08T10:00:00.000Z");

    routes = [(call) => (call.url.endsWith("/freeBusy") ? { status: 500 } : undefined)];
    const degraded = await getAgendaFreeSlots(client, A, agenda.id, { externalBusy: provider, fromDateKey: "2026-09-08", now, toDateKey: "2026-09-08" });
    assert.equal(degraded.slots[0].start.toISOString(), "2026-09-08T07:00:00.000Z");

    const notConnected = googleBusyProvider(client, B, deps);
    assert.deepEqual(await notConnected(await getAgenda(client, A, agenda.id), now, now), []);
  });
});
