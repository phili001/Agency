import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import {
  fillNotice,
  isMessagingWindowOpen,
  isSendingHour,
  noShowDue,
  noticeValues,
  reminderDue,
  runAppointmentNotices,
} from "./reminders.ts";

const A = "workspace-a";
const B = "workspace-b";
// Lunes 7 de septiembre de 2026, 12:00 en Madrid.
const NOW = new Date("2026-09-07T10:00:00Z");

let fake: FakeSupabase;
let client: CrmClient;

function agenda(extra: Record<string, unknown> = {}) {
  const row = {
    id: "agenda-a",
    no_show_enabled: false,
    no_show_hours_after: 1,
    no_show_message: null,
    no_show_template: null,
    reminder_enabled: true,
    reminder_hours_before: 24,
    reminder_message: null,
    reminder_template: null,
    timezone: "Europe/Madrid",
    workspace_id: A,
    ...extra,
  };
  fake.table("agendas").push(row);
  return row;
}

function appointment(extra: Record<string, unknown> = {}) {
  const row = {
    agenda_id: "agenda-a",
    contact_id: "contact-a",
    conversation_id: "conv-a",
    created_at: "2026-09-01T10:00:00Z",
    id: `appt-${fake.table("appointments").length + 1}`,
    no_show_sent_at: null,
    notices: [],
    reminder_sent_at: null,
    service: "Limpieza",
    starts_at: "2026-09-08T08:00:00Z", // mañana 10:00 Madrid: dentro de 22 h
    status: "scheduled",
    updated_at: "2026-09-01T10:00:00Z",
    workspace_id: A,
    ...extra,
  };
  fake.table("appointments").push(row);
  return row;
}

function inbound(at: string, contactId = "contact-a", workspaceId = A) {
  fake.table("messages").push({ contact_id: contactId, created_at: at, direction: "inbound", id: `in-${at}`, workspace_id: workspaceId });
}

const queued = () => fake.table("messages").filter((row) => row.status === "queued");

beforeEach(() => {
  fake = createCrmFake({
    contacts: [
      { automation_labels: [], full_name: "Ana Pérez", id: "contact-a", messaging_status: "active", phone_e164: "+34600000001", workspace_id: A },
      { automation_labels: [], full_name: "Bea", id: "contact-b", messaging_status: "active", phone_e164: "+34600000002", workspace_id: B },
    ],
    conversations: [
      { contact_id: "contact-a", id: "conv-a", last_message_at: "2026-09-07T09:00:00Z", workspace_id: A },
      { contact_id: "contact-b", id: "conv-b", last_message_at: "2026-09-07T09:00:00Z", workspace_id: B },
    ],
    workspaces: [
      { id: A, name: "Clínica Sonrisa" },
      { id: B, name: "Otra" },
    ],
  });
  client = fake as unknown as CrmClient;
});

describe("piezas puras", () => {
  it("rellena el texto sin dejar llaves sueltas", () => {
    const values = noticeValues({ businessName: "Clínica", contactName: "Ana Pérez", service: "Limpieza", startsAt: new Date("2026-09-08T08:00:00Z"), timezone: "Europe/Madrid" });
    assert.deepEqual(values, { fecha: "martes 8 de septiembre", hora: "10:00", negocio: "Clínica", nombre: "Ana", servicio: "Limpieza" });
    assert.equal(fillNotice("Hola {nombre}, {inventada}cita el {fecha}.", values), "Hola Ana, cita el martes 8 de septiembre.");
    assert.equal(fillNotice("Hola {nombre}, nos vemos.", { ...values, nombre: "" }), "Hola, nos vemos.");
  });

  it("ventana de 24 h con 30 min de margen", () => {
    assert.equal(isMessagingWindowOpen(new Date("2026-09-06T11:00:00Z"), NOW), true); // hace 23 h
    assert.equal(isMessagingWindowOpen(new Date("2026-09-06T10:20:00Z"), NOW), false); // hace 23 h 40
    assert.equal(isMessagingWindowOpen(null, NOW), false);
  });

  it("horario de envío en la zona de la agenda", () => {
    assert.equal(isSendingHour(NOW, "Europe/Madrid"), true); // 12:00
    assert.equal(isSendingHour(new Date("2026-09-07T20:30:00Z"), "Europe/Madrid"), false); // 22:30
    assert.equal(isSendingHour(new Date("2026-09-07T05:30:00Z"), "America/Bogota"), false); // 00:30
  });

  it("cuándo toca cada aviso", () => {
    assert.equal(reminderDue({ created_at: "2026-09-01T00:00:00Z", starts_at: "2026-09-08T08:00:00Z" }, 24, NOW), true);
    assert.equal(reminderDue({ created_at: "2026-09-01T00:00:00Z", starts_at: "2026-09-09T08:00:00Z" }, 24, NOW), false); // aún no
    assert.equal(reminderDue({ created_at: "2026-09-07T09:00:00Z", starts_at: "2026-09-08T08:00:00Z" }, 24, NOW), false); // agendada después
    assert.equal(reminderDue({ created_at: "2026-09-01T00:00:00Z", starts_at: "2026-09-07T10:20:00Z" }, 24, NOW), false); // a 20 min
    assert.equal(noShowDue({ starts_at: "2026-09-07T07:00:00Z" }, new Date("2026-09-07T08:30:00Z"), 1, NOW), true);
    assert.equal(noShowDue({ starts_at: "2026-09-07T07:00:00Z" }, new Date("2026-09-07T09:30:00Z"), 1, NOW), false);
    assert.equal(noShowDue({ starts_at: "2026-08-20T07:00:00Z" }, new Date("2026-08-20T09:00:00Z"), 1, NOW), false); // > 7 días
  });
});

describe("vuelta de avisos", () => {
  it("con la ventana abierta encola el texto una sola vez", async () => {
    agenda();
    const row = appointment();
    inbound("2026-09-07T08:00:00Z");

    assert.deepEqual(await runAppointmentNotices(client, { now: NOW }), { queued: 1, skipped: 0, waiting: 0 });
    assert.equal(queued().length, 1);
    assert.match(String(queued()[0].body), /^Hola Ana, te recordamos tu cita de Limpieza el martes 8 de septiembre a las 10:00 con Clínica Sonrisa/);
    assert.equal(queued()[0].conversation_id, "conv-a");
    assert.ok(row.reminder_sent_at);
    assert.equal((row.notices as Array<{ result: string }>)[0].result, "queued");

    assert.deepEqual(await runAppointmentNotices(client, { now: NOW }), { queued: 0, skipped: 0, waiting: 0 });
    assert.equal(queued().length, 1);
  });

  it("con la ventana cerrada se omite con motivo (sin plantilla, D3)", async () => {
    agenda();
    const row = appointment();
    inbound("2026-09-05T08:00:00Z");
    assert.deepEqual(await runAppointmentNotices(client, { now: NOW }), { queued: 0, skipped: 1, waiting: 0 });
    assert.equal(queued().length, 0);
    const notice = (row.notices as Array<{ reason: string; result: string }>)[0];
    assert.equal(notice.result, "skipped");
    assert.match(notice.reason, /no hay plantilla/);
    assert.ok(fake.table("crm_contact_activity").some((entry) => entry.kind === "reminder_skipped"));
  });

  it("fuera de horario espera sin reclamar la cita", async () => {
    agenda();
    const row = appointment({ starts_at: "2026-09-08T19:30:00Z" });
    inbound("2026-09-07T20:00:00Z");
    const night = new Date("2026-09-07T20:30:00Z"); // 22:30 Madrid
    assert.deepEqual(await runAppointmentNotices(client, { now: night }), { queued: 0, skipped: 0, waiting: 1 });
    assert.equal(row.reminder_sent_at, null);
  });

  it("contacto que pidió no recibir mensajes", async () => {
    agenda();
    appointment();
    inbound("2026-09-07T08:00:00Z");
    fake.table("contacts")[0].automation_labels = ["flow_opt_out"];
    assert.deepEqual(await runAppointmentNotices(client, { now: NOW }), { queued: 0, skipped: 1, waiting: 0 });
  });

  it("apagados de fábrica y empresas excluidas por impago", async () => {
    agenda({ reminder_enabled: false });
    appointment();
    inbound("2026-09-07T08:00:00Z");
    assert.deepEqual(await runAppointmentNotices(client, { now: NOW }), { queued: 0, skipped: 0, waiting: 0 });

    fake.table("agendas")[0].reminder_enabled = true;
    assert.deepEqual(await runAppointmentNotices(client, { excludeWorkspaceIds: [A], now: NOW }), { queued: 0, skipped: 0, waiting: 0 });
  });

  it("inasistencia marcada hace más de una hora", async () => {
    agenda({ no_show_enabled: true, reminder_enabled: false });
    const row = appointment({ starts_at: "2026-09-07T07:00:00Z", status: "no_show", updated_at: "2026-09-07T08:30:00Z" });
    inbound("2026-09-07T06:00:00Z");
    assert.deepEqual(await runAppointmentNotices(client, { now: NOW }), { queued: 1, skipped: 0, waiting: 0 });
    assert.match(String(queued()[0].body), /te echamos de menos/);
    assert.ok(row.no_show_sent_at);
  });

  it("cada aviso va a la conversación de su propia empresa", async () => {
    agenda();
    agenda({ id: "agenda-b", workspace_id: B });
    appointment();
    appointment({ agenda_id: "agenda-b", contact_id: "contact-b", conversation_id: "conv-b", workspace_id: B });
    inbound("2026-09-07T08:00:00Z");
    inbound("2026-09-07T08:00:00Z", "contact-b", B);
    // Una cita «colada» con la agenda de B pero de la empresa A no sale.
    appointment({ agenda_id: "agenda-b", workspace_id: A });

    const result = await runAppointmentNotices(client, { now: NOW });
    assert.equal(result.queued, 2);
    assert.deepEqual(queued().map((row) => `${row.workspace_id}:${row.conversation_id}`).sort(), [`${A}:conv-a`, `${B}:conv-b`]);
    assert.match(String(queued().find((row) => row.workspace_id === B)?.body), /con Otra/);
  });
});
