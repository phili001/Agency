import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { CrmError } from "../crm/errors.ts";
import type { CrmActor, CrmClient } from "../crm/shared.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { createAgenda, getDefaultAgenda, listAgendas, setDefaultAgenda, updateAgenda } from "./agendas.ts";
import {
  bookAppointment,
  cancelAppointment,
  createBlock,
  deleteBlock,
  getAgendaFreeSlots,
  markAppointment,
  offerSlots,
  purgeOfferedSlots,
  rescheduleAppointment,
  upcomingAppointmentsForContact,
} from "./appointments.ts";
import { AgendaError, translateAgendaDbError } from "./errors.ts";

const A = "workspace-a";
const B = "workspace-b";
const operator: CrmActor = { kind: "operator", userId: "user-a" };
const agent: CrmActor = { kind: "agent" };
// Domingo 6 de septiembre de 2026, 20:00 en Madrid.
const NOW = new Date("2026-09-06T18:00:00Z");
const MONDAY_10 = new Date("2026-09-07T08:00:00Z"); // 10:00 Madrid

let fake: FakeSupabase;
let client: CrmClient;

function isAgendaError(code: AgendaError["code"]) {
  return (error: unknown) => error instanceof AgendaError && error.code === code;
}

function isCrmError(code: CrmError["code"]) {
  return (error: unknown) => error instanceof CrmError && error.code === code;
}

/** Simula las funciones SQL: inserta la cita o devuelve el SQLSTATE indicado. */
function fakeBooking(failWith: { code: string; message: string } | null = null) {
  fake.rpcHandler = (name, args) => {
    if (failWith) {
      return { data: null, error: failWith };
    }
    if (name === "book_appointment") {
      const row = {
        agenda_id: args.p_agenda_id,
        confirmed_at: null,
        contact_id: args.p_contact_id,
        conversation_id: args.p_conversation_id,
        created_by: args.p_created_by,
        ends_at: args.p_ends_at,
        google_event_id: null,
        google_sync_pending: false,
        id: `appt-${fake.table("appointments").length + 1}`,
        notes: args.p_notes,
        service: args.p_service,
        starts_at: args.p_starts_at,
        status: "scheduled",
        workspace_id: args.p_workspace_id,
      };
      fake.table("appointments").push(row);
      return { data: row, error: null };
    }
    if (name === "reschedule_appointment") {
      const old = fake.table("appointments").find((row) => row.id === args.p_appointment_id)!;
      old.status = "cancelled";
      const row = { ...old, ends_at: args.p_ends_at, id: `${old.id}-r`, starts_at: args.p_starts_at, status: "rescheduled" };
      fake.table("appointments").push(row);
      return { data: [row], error: null };
    }
    return { data: null, error: { message: "desconocida" } };
  };
}

async function seed() {
  const agendaA = await createAgenda(client, A, {
    name: "Consultas",
    services: [{ duration_minutes: 60, name: "Primera visita" }],
    timezone: "Europe/Madrid",
  });
  const agendaB = await createAgenda(client, B, { name: "Consultas", timezone: "Europe/Madrid" });
  fake.table("contacts").push(
    { id: "contact-a", phone_e164: "+34600000001", workspace_id: A },
    { id: "contact-b", phone_e164: "+34600000002", workspace_id: B },
  );
  fake.table("conversations").push(
    { contact_id: "contact-a", id: "conv-a", workspace_id: A },
    { contact_id: "contact-b", id: "conv-b", workspace_id: B },
  );
  return { agendaA, agendaB };
}

beforeEach(() => {
  fake = createCrmFake({});
  client = fake as unknown as CrmClient;
  fakeBooking();
});

describe("agendas", () => {
  it("la primera es la de por defecto y se puede cambiar", async () => {
    const first = await createAgenda(client, A, { name: "Madrid", timezone: "Europe/Madrid" });
    const second = await createAgenda(client, A, { name: "Online", timezone: "Europe/Madrid" });
    assert.equal(first.is_default, true);
    assert.equal(second.is_default, false);
    await setDefaultAgenda(client, A, second.id);
    assert.equal((await getDefaultAgenda(client, A))?.id, second.id);
    assert.equal((await listAgendas(client, A)).filter((agenda) => agenda.is_default).length, 1);
  });

  it("valida zona, horario y números", async () => {
    await assert.rejects(createAgenda(client, A, { name: "X", timezone: "Colombia" }), isCrmError("invalid"));
    await assert.rejects(createAgenda(client, A, { name: "", timezone: "UTC" }), isCrmError("invalid"));
    const agenda = await createAgenda(client, A, { name: "X", timezone: "UTC" });
    await assert.rejects(updateAgenda(client, A, agenda.id, { slotStepMinutes: 3 }), isCrmError("invalid"));
    await assert.rejects(updateAgenda(client, A, agenda.id, { googleSyncMode: "todo" }), isCrmError("invalid"));
    await assert.rejects(createAgenda(client, A, { name: "x", timezone: "UTC" }), isCrmError("conflict"));
    const updated = await updateAgenda(client, A, agenda.id, { description: "Videollamadas", minNoticeMinutes: 120 });
    assert.equal(updated.config.minNoticeMinutes, 120);
  });
});

describe("huecos con lo ocupado", () => {
  it("quita citas activas y bloqueos, no las canceladas, y suma Google solo en push_and_busy", async () => {
    const { agendaA } = await seed();
    fake.table("appointments").push(
      { agenda_id: agendaA.id, ends_at: "2026-09-07T08:00:00Z", id: "x1", starts_at: "2026-09-07T07:00:00Z", status: "scheduled", workspace_id: A },
      { agenda_id: agendaA.id, ends_at: "2026-09-07T09:00:00Z", id: "x2", starts_at: "2026-09-07T08:00:00Z", status: "cancelled", workspace_id: A },
    );
    await createBlock(client, A, { agendaId: agendaA.id, endsAt: "2026-09-07T12:00:00Z", startsAt: "2026-09-07T11:00:00Z" });
    const google = async () => [{ end: new Date("2026-09-07T14:00:00Z"), start: new Date("2026-09-07T13:00:00Z") }];

    const { service, slots } = await getAgendaFreeSlots(client, A, agendaA.id, {
      externalBusy: google,
      now: NOW,
      service: "primera visita",
      toDateKey: "2026-09-07",
    });
    const starts = slots.map((slot) => slot.start.toISOString());
    assert.equal(service.durationMinutes, 60);
    assert.ok(!starts.includes("2026-09-07T07:00:00.000Z")); // cita activa
    assert.ok(starts.includes("2026-09-07T08:00:00.000Z")); // la cancelada no ocupa
    assert.ok(!starts.includes("2026-09-07T11:00:00.000Z")); // bloqueo
    assert.ok(starts.includes("2026-09-07T13:00:00.000Z")); // Google no cuenta en modo off

    await updateAgenda(client, A, agendaA.id, { googleSyncMode: "push_and_busy" });
    const withGoogle = await getAgendaFreeSlots(client, A, agendaA.id, { externalBusy: google, now: NOW, toDateKey: "2026-09-07" });
    assert.ok(!withGoogle.slots.some((slot) => slot.start.toISOString() === "2026-09-07T13:00:00.000Z"));
  });

  it("una agenda desactivada no da huecos", async () => {
    const { agendaA } = await seed();
    await updateAgenda(client, A, agendaA.id, { active: false });
    await assert.rejects(getAgendaFreeSlots(client, A, agendaA.id, { now: NOW }), isAgendaError("agenda_inactive"));
  });
});

describe("ofrecer y agendar", () => {
  it("guarda lo ofrecido y refresca la hora si se vuelve a ofrecer", async () => {
    const { agendaA } = await seed();
    await offerSlots(client, A, "conv-a", agendaA.id, [{ start: MONDAY_10 }], NOW);
    await offerSlots(client, A, "conv-a", agendaA.id, [{ start: MONDAY_10 }], new Date(NOW.getTime() + 60_000));
    const offered = fake.table("offered_slots");
    assert.equal(offered.length, 1);
    assert.equal(offered[0].offered_at, new Date(NOW.getTime() + 60_000).toISOString());
    assert.equal(await purgeOfferedSlots(client, new Date(NOW.getTime() + 2 * 86_400_000)), 1);
  });

  it("calcula la duración del servicio y pasa quién agenda", async () => {
    const { agendaA } = await seed();
    const appointment = await bookAppointment(
      client,
      A,
      { agendaId: agendaA.id, contactId: "contact-a", conversationId: "conv-a", service: "una primera visita", startsAt: MONDAY_10 },
      agent,
    );
    assert.equal(appointment.service, "Primera visita");
    assert.equal(appointment.ends_at, "2026-09-07T09:00:00.000Z");
    const call = fake.rpcCalls.at(-1)!;
    assert.equal(call.name, "book_appointment");
    assert.equal(call.args.p_created_by, "agent");
    assert.equal(call.args.p_workspace_id, A);
  });

  it("traduce los rechazos de la base", async () => {
    const { agendaA } = await seed();
    const cases: Array<[string, AgendaError["code"]]> = [
      ["LVS01", "slot_taken"],
      ["23P01", "slot_taken"],
      ["LVN01", "not_offered"],
      ["LVH01", "outside_hours"],
      ["LVB01", "blocked"],
      ["LVW01", "not_found"],
      ["LVA01", "agenda_inactive"],
    ];
    for (const [code, expected] of cases) {
      fakeBooking({ code, message: code === "23P01" ? "conflicting key value violates exclusion constraint" : "Mensaje de la base." });
      await assert.rejects(
        bookAppointment(client, A, { agendaId: agendaA.id, contactId: "contact-a", startsAt: MONDAY_10 }, operator),
        (error: unknown) =>
          error instanceof AgendaError &&
          error.code === expected &&
          error.status >= 400 &&
          !error.message.includes("exclusion constraint"),
      );
    }
    fakeBooking({ code: "XX000", message: "boom" });
    await assert.rejects(
      bookAppointment(client, A, { agendaId: agendaA.id, contactId: "contact-a", startsAt: MONDAY_10 }, operator),
      (error: unknown) => error instanceof Error && !(error instanceof AgendaError),
    );
    assert.equal(translateAgendaDbError(null), null);
  });

  it("reagendar mantiene la duración", async () => {
    const { agendaA } = await seed();
    const original = await bookAppointment(client, A, { agendaId: agendaA.id, contactId: "contact-a", service: "Primera visita", startsAt: MONDAY_10 }, operator);
    const moved = await rescheduleAppointment(client, A, { appointmentId: original.id, startsAt: "2026-09-07T12:00:00Z" }, operator);
    assert.equal(moved.ends_at, "2026-09-07T13:00:00.000Z");
    assert.equal(fake.rpcCalls.at(-1)!.args.p_ends_at, "2026-09-07T13:00:00.000Z");
  });
});

describe("cancelar, marcar y bloqueos", () => {
  it("el agente solo cancela citas futuras de su conversación", async () => {
    const { agendaA } = await seed();
    const appointment = await bookAppointment(client, A, { agendaId: agendaA.id, contactId: "contact-a", conversationId: "conv-a", startsAt: MONDAY_10 }, operator);
    await assert.rejects(
      cancelAppointment(client, A, appointment.id, agent, { conversationId: "otra", now: NOW }),
      isAgendaError("not_active"),
    );
    await assert.rejects(
      cancelAppointment(client, A, appointment.id, agent, { conversationId: "conv-a", now: new Date("2026-09-08T00:00:00Z") }),
      isAgendaError("not_active"),
    );
    const cancelled = await cancelAppointment(client, A, appointment.id, agent, { conversationId: "conv-a", now: NOW });
    assert.equal(cancelled.status, "cancelled");
    assert.ok(fake.table("crm_contact_activity").some((row) => row.kind === "appointment_cancelled"));
    await assert.rejects(cancelAppointment(client, A, appointment.id, operator), isAgendaError("not_active"));
  });

  it("cancelar una cita con evento en Google la deja pendiente de borrar allí", async () => {
    const { agendaA } = await seed();
    const appointment = await bookAppointment(client, A, { agendaId: agendaA.id, contactId: "contact-a", startsAt: MONDAY_10 }, operator);
    fake.table("appointments").find((row) => row.id === appointment.id)!.google_event_id = "evt";
    const cancelled = await cancelAppointment(client, A, appointment.id, operator);
    assert.equal(cancelled.google_sync_pending, true);
  });

  it("solo se marca lo que ya empezó", async () => {
    const { agendaA } = await seed();
    const appointment = await bookAppointment(client, A, { agendaId: agendaA.id, contactId: "contact-a", startsAt: MONDAY_10 }, operator);
    await assert.rejects(markAppointment(client, A, appointment.id, "no_show", NOW), isCrmError("invalid"));
    const done = await markAppointment(client, A, appointment.id, "no_show", new Date("2026-09-07T09:00:00Z"));
    assert.equal(done.status, "no_show");
  });

  it("bloqueos válidos", async () => {
    const { agendaA } = await seed();
    await assert.rejects(
      createBlock(client, A, { agendaId: agendaA.id, endsAt: MONDAY_10, startsAt: MONDAY_10 }),
      isCrmError("invalid"),
    );
  });
});

describe("aislamiento entre empresas", () => {
  it("A no ve ni toca agendas, citas, ofertas ni bloqueos de B", async () => {
    const { agendaA, agendaB } = await seed();
    const appointmentB = await bookAppointment(client, B, { agendaId: agendaB.id, contactId: "contact-b", startsAt: MONDAY_10 }, operator);
    const blockB = await createBlock(client, B, { agendaId: agendaB.id, endsAt: "2026-09-07T10:00:00Z", startsAt: MONDAY_10 });

    await assert.rejects(getAgendaFreeSlots(client, A, agendaB.id, { now: NOW }), isCrmError("not_found"));
    await assert.rejects(updateAgenda(client, A, agendaB.id, { name: "Mía" }), isCrmError("not_found"));
    await assert.rejects(setDefaultAgenda(client, A, agendaB.id), isCrmError("not_found"));
    await assert.rejects(
      bookAppointment(client, A, { agendaId: agendaB.id, contactId: "contact-a", startsAt: MONDAY_10 }, operator),
      isCrmError("not_found"),
    );
    await assert.rejects(offerSlots(client, A, "conv-b", agendaA.id, [{ start: MONDAY_10 }]), isCrmError("not_found"));
    await assert.rejects(offerSlots(client, A, "conv-a", agendaB.id, [{ start: MONDAY_10 }]), isCrmError("not_found"));
    await assert.rejects(cancelAppointment(client, A, appointmentB.id, operator), isAgendaError("not_active"));
    await assert.rejects(rescheduleAppointment(client, A, { appointmentId: appointmentB.id, startsAt: MONDAY_10 }, operator), isAgendaError("not_active"));
    await assert.rejects(markAppointment(client, A, appointmentB.id, "completed", new Date("2026-09-08T00:00:00Z")), isAgendaError("not_active"));
    await assert.rejects(deleteBlock(client, A, blockB.id), isCrmError("not_found"));
    await assert.rejects(createBlock(client, A, { agendaId: agendaB.id, endsAt: "2026-09-07T10:00:00Z", startsAt: MONDAY_10 }), isCrmError("not_found"));
    await assert.rejects(upcomingAppointmentsForContact(client, A, "contact-b", NOW), isCrmError("not_found"));

    // Nada de B cambió.
    assert.equal(fake.table("appointments").find((row) => row.id === appointmentB.id)?.status, "scheduled");
    assert.equal(fake.table("schedule_blocks").filter((row) => row.workspace_id === B).length, 1);
    assert.equal(fake.table("agendas").find((row) => row.id === agendaB.id)?.name, "Consultas");
    assert.equal(fake.table("offered_slots").length, 0);
  });
});
