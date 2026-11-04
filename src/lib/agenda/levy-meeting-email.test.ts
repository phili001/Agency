import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { encryptSecret } from "../integrations/crypto.ts";
import { GMAIL_SEND_SCOPE } from "../integrations/gmail.ts";
import type { GoogleDeps } from "../integrations/google-calendar.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { createAgenda } from "./agendas.ts";
import { bookMeeting } from "./levy-meeting.ts";
import { buildMeetingEmail, handlePanelMeetingChange, sendMeetingEmail } from "./levy-meeting-email.ts";

process.env.INTEGRATION_ENCRYPTION_KEY = "clave-de-prueba-de-32-caracteres!!";

const AGENCY = "ws-agency";
const CLIENT = "ws-client";
const NOW = new Date("2026-09-06T18:00:00Z");
const MONDAY_10 = "2026-09-07T08:00:00.000Z";
const TUESDAY_12 = "2026-09-08T10:00:00.000Z";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

let fake: FakeSupabase;
let client: CrmClient;
let agendaId: string;
let env: Record<string, string | undefined>;
let sends: string[];
let gmailStatus: number;

function deps(): GoogleDeps {
  return {
    env,
    fetch: (async (url: string | URL, init: RequestInit = {}) => {
      assert.equal(String(url), SEND_URL);
      sends.push(Buffer.from((JSON.parse(String(init.body)) as { raw: string }).raw, "base64url").toString("utf8"));
      return new Response(JSON.stringify({ id: "gmail-1" }), { status: gmailStatus });
    }) as unknown as typeof fetch,
    now: () => NOW,
  };
}

function connectGmail(workspaceId: string, email: string) {
  const scope = `${GMAIL_SEND_SCOPE} openid email`;
  fake.table("integrations").push({
    config: { account_email: email, scopes: scope.split(" ") },
    last_error: null,
    provider: "gmail",
    status: "active",
    workspace_id: workspaceId,
  });
  fake.table("integration_secrets").push({
    ciphertext: encryptSecret(
      JSON.stringify({ accessToken: "a", expiresAt: new Date(NOW.getTime() + 3_600_000).toISOString(), refreshToken: "r", scope }),
    ),
    kind: "oauth_tokens",
    provider: "gmail",
    workspace_id: workspaceId,
  });
}

function base(kind: "cancelled" | "confirmed" | "moved") {
  return { companyName: "Panadería Sol", kind, startTime: MONDAY_10, timezone: "Europe/Madrid", to: "ana@example.com" };
}

const target = () => ({ agendaId, workspaceId: AGENCY });

beforeEach(async () => {
  fake = createCrmFake({
    contacts: [],
    crm_contact_activity: [],
    crm_contact_tags: [],
    crm_pipeline_stages: [],
    crm_tags: [],
    integration_secrets: [],
    integrations: [],
    workspaces: [
      { company_code: "AAA001", id: AGENCY, name: "Levy", onboarding_state: {} },
      { company_code: "BBB002", id: CLIENT, name: "Panadería Sol", onboarding_state: {} },
    ],
  });
  client = fake as unknown as CrmClient;
  fake.rpcHandler = (name, args) => {
    if (name === "book_appointment" || name === "reschedule_appointment") {
      const row = {
        agenda_id: args.p_agenda_id ?? agendaId,
        contact_id: args.p_contact_id ?? "contact",
        ends_at: args.p_ends_at,
        google_event_id: null,
        id: `appt-${fake.table("appointments").length + 1}`,
        notes: args.p_notes ?? null,
        service: args.p_service ?? null,
        starts_at: args.p_starts_at,
        status: "scheduled",
        workspace_id: args.p_workspace_id ?? AGENCY,
      };
      fake.table("appointments").push(row);
      return { data: row, error: null };
    }
    return { data: null, error: { message: "desconocida" } };
  };
  agendaId = (await createAgenda(client, AGENCY, { name: "Puesta en marcha", timezone: "Europe/Madrid" })).id;
  env = {
    GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret",
    INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
    LEVY_MEETING_AGENDA_ID: agendaId,
    LEVY_WORKSPACE_CODE: "AAA001",
  };
  sends = [];
  gmailStatus = 200;
});

describe("texto del correo de la reunión", () => {
  it("dice qué pasó, cuándo y en la zona del cliente", () => {
    const confirmed = buildMeetingEmail(base("confirmed"));
    assert.match(confirmed.subject, /confirmada: Panadería Sol/);
    assert.match(confirmed.text, /lunes, 7 de septiembre a las 10:00 \(hora de Europe\/Madrid\)/);

    const bogota = buildMeetingEmail({ ...base("confirmed"), timezone: "America/Bogota" });
    assert.match(bogota.text, /a las 03:00/);

    const moved = buildMeetingEmail({ ...base("moved"), previousStartTime: TUESDAY_12 });
    assert.match(moved.subject, /movida/);
    assert.match(moved.text, /Ahora es el lunes, 7 de septiembre/);
    assert.match(moved.text, /Antes era el martes, 8 de septiembre/);

    assert.match(buildMeetingEmail(base("cancelled")).subject, /cancelada/);
  });

  it("escapa el nombre de la empresa en el HTML", () => {
    const email = buildMeetingEmail({ ...base("confirmed"), companyName: "<b>Sol</b> & Co" });
    assert.ok(!email.html.includes("<b>Sol</b>"));
    assert.match(email.html, /&lt;b&gt;Sol&lt;\/b&gt; &amp; Co/);
  });
});

describe("envío desde el Gmail de AAA001", () => {
  it("sale del Gmail de AAA001 hacia el cliente", async () => {
    connectGmail(AGENCY, "equipo@levy.test");
    assert.deepEqual(await sendMeetingEmail(client, target(), base("confirmed"), deps()), { sent: true });
    assert.equal(sends.length, 1);
    assert.match(sends[0], /From: Levy <equipo@levy\.test>/);
    assert.match(sends[0], /To: ana@example\.com/);
  });

  it("sin Gmail conectado no lanza, no envía y la reserva sigue en pie", async () => {
    const booked = await bookMeeting(client, target(), {
      companyName: "Panadería Sol",
      email: "ana@example.com",
      fullName: "Ana",
      now: NOW,
      phone: "+34600111222",
      startTime: MONDAY_10,
      workspaceCode: "BBB002",
    });
    assert.deepEqual(await sendMeetingEmail(client, target(), base("confirmed"), deps()), { reason: "not_connected", sent: false });
    assert.equal(sends.length, 0);
    assert.equal(fake.table("appointments").find((row) => row.id === booked.appointmentId)?.status, "scheduled");
  });

  it("no usa Resend aunque esté configurado", async () => {
    env.RESEND_API_KEY = "re_x";
    env.EMAIL_FROM = "Levy <hola@levy.test>";
    assert.deepEqual(await sendMeetingEmail(client, target(), base("confirmed"), deps()), { reason: "not_connected", sent: false });
    assert.equal(sends.length, 0);
  });

  it("no usa el Gmail de otra empresa", async () => {
    connectGmail(CLIENT, "cliente@sol.test");
    assert.deepEqual(await sendMeetingEmail(client, target(), base("confirmed"), deps()), { reason: "not_connected", sent: false });
    assert.equal(sends.length, 0);
  });

  it("un fallo de Gmail no lanza", async () => {
    connectGmail(AGENCY, "equipo@levy.test");
    gmailStatus = 500;
    assert.deepEqual(await sendMeetingEmail(client, target(), base("confirmed"), deps()), { reason: "failed", sent: false });
  });

  it("sin destinatario válido no intenta enviar", async () => {
    connectGmail(AGENCY, "equipo@levy.test");
    assert.deepEqual(await sendMeetingEmail(client, target(), { ...base("confirmed"), to: null }, deps()), { reason: "invalid_recipient", sent: false });
    assert.deepEqual(await sendMeetingEmail(client, target(), { ...base("confirmed"), to: "no-es-correo" }, deps()), { reason: "invalid_recipient", sent: false });
    assert.equal(sends.length, 0);
  });
});

describe("cambios desde el panel de Agenda", () => {
  function seedMeeting(appointmentId = "appt-old") {
    fake.table("contacts").push({ email: "contacto@example.com", id: "contact-1", phone_e164: "+34600111222", workspace_id: AGENCY });
    fake.table("workspaces").find((row) => row.id === CLIENT)!.onboarding_state = {
      keep: true,
      meeting: { appointmentId, bookedAt: "", email: "ana@example.com", phone: "+34600111222", startTime: MONDAY_10, timezone: "America/Bogota" },
    };
  }

  const moved = () => ({ agenda_id: agendaId, contact_id: "contact-1", id: "appt-new", starts_at: TUESDAY_12 });

  it("mover la reunión actualiza el asistente del cliente y le avisa", async () => {
    connectGmail(AGENCY, "equipo@levy.test");
    seedMeeting();
    const result = await handlePanelMeetingChange(client, AGENCY, { appointment: moved(), kind: "moved", previousAppointmentId: "appt-old" }, deps());
    assert.deepEqual(result, { sent: true });
    const state = fake.table("workspaces").find((row) => row.id === CLIENT)!.onboarding_state as { keep: boolean; meeting: Record<string, string> };
    assert.equal(state.keep, true);
    assert.equal(state.meeting.appointmentId, "appt-new");
    assert.equal(state.meeting.startTime, TUESDAY_12);
    assert.match(sends[0], /To: ana@example\.com/);
  });

  it("cancelarla la quita del asistente y le avisa, también sin Gmail no lanza", async () => {
    seedMeeting();
    const result = await handlePanelMeetingChange(
      client,
      AGENCY,
      { appointment: { ...moved(), id: "appt-old", starts_at: MONDAY_10 }, kind: "cancelled", previousAppointmentId: "appt-old" },
      deps(),
    );
    assert.deepEqual(result, { reason: "not_connected", sent: false });
    const state = fake.table("workspaces").find((row) => row.id === CLIENT)!.onboarding_state as Record<string, unknown>;
    assert.equal(state.meeting, undefined);
    assert.equal(state.keep, true);
  });

  it("sin correo guardado usa el del contacto", async () => {
    connectGmail(AGENCY, "equipo@levy.test");
    seedMeeting();
    const row = fake.table("workspaces").find((item) => item.id === CLIENT)!;
    const state = row.onboarding_state as { meeting: Record<string, string> };
    delete state.meeting.email;
    await handlePanelMeetingChange(client, AGENCY, { appointment: moved(), kind: "moved", previousAppointmentId: "appt-old" }, deps());
    assert.match(sends[0], /To: contacto@example\.com/);
  });

  it("no toca otras citas, otras agendas ni otras empresas", async () => {
    connectGmail(AGENCY, "equipo@levy.test");
    seedMeeting();
    const before = JSON.stringify(fake.table("workspaces"));
    const change = { appointment: moved(), kind: "moved" as const, previousAppointmentId: "appt-old" };

    // Otra cita de la misma agenda: no es la reunión de nadie.
    assert.equal(await handlePanelMeetingChange(client, AGENCY, { ...change, previousAppointmentId: "appt-otra" }, deps()), null);
    // Cita de otra agenda de AAA001.
    assert.equal(await handlePanelMeetingChange(client, AGENCY, { ...change, appointment: { ...moved(), agenda_id: "otra" } }, deps()), null);
    // Otra empresa moviendo una cita suya.
    assert.equal(await handlePanelMeetingChange(client, CLIENT, change, deps()), null);
    // Sin agenda de reunión configurada.
    env.LEVY_MEETING_AGENDA_ID = "";
    assert.equal(await handlePanelMeetingChange(client, AGENCY, change, deps()), null);

    assert.equal(sends.length, 0);
    assert.equal(JSON.stringify(fake.table("workspaces")), before);
  });
});
