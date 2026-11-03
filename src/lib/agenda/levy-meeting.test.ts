import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { markAgencyContactActiveInCrm } from "../billing/agency-crm.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { createAgenda } from "./agendas.ts";
import { AgendaError } from "./errors.ts";
import { bookMeeting, cancelMeeting, getMeetingDays, groupMeetingSlots, resolveMeetingAgenda } from "./levy-meeting.ts";

const AGENCY = "ws-agency";
const CLIENT = "ws-client";
const ENV = { LEVY_WORKSPACE_CODE: "AAA001" };
// Domingo 6 de septiembre de 2026, 20:00 en Madrid.
const NOW = new Date("2026-09-06T18:00:00Z");
const MONDAY_10 = "2026-09-07T08:00:00.000Z";

let fake: FakeSupabase;
let client: CrmClient;
let agendaId: string;
let clientAgendaId: string;

beforeEach(async () => {
  fake = createCrmFake({
    contacts: [],
    crm_contact_activity: [],
    crm_contact_tags: [],
    crm_pipeline_stages: [],
    crm_tags: [],
    workspaces: [
      { company_code: "AAA001", id: AGENCY },
      { company_code: "BBB002", id: CLIENT },
    ],
  });
  client = fake as unknown as CrmClient;
  fake.rpcHandler = (name, args) => {
    if (name !== "book_appointment") return { data: null, error: { message: "desconocida" } };
    const row = {
      agenda_id: args.p_agenda_id,
      contact_id: args.p_contact_id,
      ends_at: args.p_ends_at,
      google_event_id: null,
      id: `appt-${fake.table("appointments").length + 1}`,
      notes: args.p_notes,
      service: args.p_service,
      starts_at: args.p_starts_at,
      status: "scheduled",
      workspace_id: args.p_workspace_id,
    };
    fake.table("appointments").push(row);
    return { data: row, error: null };
  };
  agendaId = (await createAgenda(client, AGENCY, { name: "Puesta en marcha", timezone: "Europe/Madrid" })).id;
  clientAgendaId = (await createAgenda(client, CLIENT, { name: "Del cliente", timezone: "Europe/Madrid" })).id;
});

describe("agenda de la reunión", () => {
  it("solo vale una agenda activa de AAA001", async () => {
    assert.equal(await resolveMeetingAgenda(client, ENV), null);
    assert.deepEqual(await resolveMeetingAgenda(client, { ...ENV, LEVY_MEETING_AGENDA_ID: agendaId }), { agendaId, workspaceId: AGENCY });
    // Una agenda de otra empresa no sirve aunque la variable la nombre.
    assert.equal(await resolveMeetingAgenda(client, { ...ENV, LEVY_MEETING_AGENDA_ID: clientAgendaId }), null);
    fake.table("agendas").find((row) => row.id === agendaId)!.active = false;
    assert.equal(await resolveMeetingAgenda(client, { ...ENV, LEVY_MEETING_AGENDA_ID: agendaId }), null);
  });

  it("agrupa los huecos por día en la zona del cliente", () => {
    const days = groupMeetingSlots([new Date(MONDAY_10), new Date("2026-09-07T08:30:00Z"), new Date("2026-09-01T08:00:00Z")], "America/Bogota", NOW);
    assert.equal(days.length, 1);
    assert.match(days[0].label, /lunes, 7 de septiembre/);
    assert.deepEqual(days[0].slots.map((slot) => slot.label), ["03:00", "03:30"]);
  });

  it("ofrece huecos, agenda la reunión con el cliente como contacto de AAA001 y la cancela", async () => {
    const target = { agendaId, workspaceId: AGENCY };
    const days = await getMeetingDays(client, target, "Europe/Madrid", { now: NOW });
    assert.ok(days[0].slots.some((slot) => slot.iso === MONDAY_10));

    const booked = await bookMeeting(client, target, {
      companyName: "Panadería Sol",
      email: "ana@example.com",
      fullName: "Ana",
      now: NOW,
      phone: "+34600111222",
      startTime: MONDAY_10,
      workspaceCode: "BBB002",
    });
    const appointment = fake.table("appointments").find((row) => row.id === booked.appointmentId)!;
    assert.equal(appointment.workspace_id, AGENCY);
    assert.match(String(appointment.notes), /Panadería Sol \(BBB002\)/);
    const contact = fake.table("contacts").find((row) => row.id === booked.contactId)!;
    assert.equal(contact.workspace_id, AGENCY);
    assert.equal(contact.email, "ana@example.com");
    // Nada en el CRM de la empresa cliente.
    assert.equal(fake.table("contacts").filter((row) => row.workspace_id === CLIENT).length, 0);

    // Esa hora ya no se ofrece ni se puede volver a coger.
    await assert.rejects(
      bookMeeting(client, target, { companyName: "Otra", email: null, fullName: null, now: NOW, phone: "+34600999888", startTime: MONDAY_10, workspaceCode: null }),
      (error: unknown) => error instanceof AgendaError && error.code === "slot_taken",
    );

    assert.equal(await cancelMeeting(client, target, booked.appointmentId), true);
    assert.equal(appointment.status, "cancelled");
    assert.equal(await cancelMeeting(client, target, booked.appointmentId), false);
  });

  it("no agenda horas que la agenda no ofrece", async () => {
    await assert.rejects(
      bookMeeting(client, { agendaId, workspaceId: AGENCY }, {
        companyName: "X",
        email: null,
        fullName: null,
        now: NOW,
        phone: "+34600111222",
        startTime: "2026-09-07T03:00:00.000Z",
        workspaceCode: null,
      }),
      (error: unknown) => error instanceof AgendaError && error.code === "slot_taken",
    );
  });
});

describe("levy-activo", () => {
  it("etiqueta al contacto de AAA001 con ese correo y no crea contactos", async () => {
    fake.table("contacts").push({ created_at: "2026-01-01T00:00:00Z", email: "ana@example.com", id: "c-ana", phone_e164: "+34600111222", workspace_id: AGENCY });
    fake.table("contacts").push({ created_at: "2026-01-01T00:00:00Z", email: "ana@example.com", id: "c-otro", phone_e164: "+34600111222", workspace_id: CLIENT });

    const result = await markAgencyContactActiveInCrm(client, " Ana@Example.com ", ENV);
    assert.deepEqual(result, { contactId: "c-ana", ok: true });
    const tag = fake.table("crm_tags").find((row) => row.name === "levy-activo")!;
    assert.equal(tag.workspace_id, AGENCY);
    assert.deepEqual(fake.table("crm_contact_tags").map((row) => row.contact_id), ["c-ana"]);

    assert.deepEqual(await markAgencyContactActiveInCrm(client, "nadie@example.com", ENV), { ok: false, reason: "no_contact" });
    assert.equal(fake.table("contacts").length, 2);
  });
});
