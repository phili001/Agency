import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { buildCalendarToolMetadata, parseCalendarTools } from "../calendar-tools.ts";
import type { CrmClient } from "../crm/shared.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { type AgendaCalendarRuntime, buildAgendaRuntime, runAgendaTool } from "./agent-agenda.ts";
import {
  buildCalendarContext,
  buildCalendarToolDefinitions,
  buildDirectBookingAnswer,
  buildDirectCancelAnswer,
  sanitizeCalendarAnswer,
} from "./agent-guards.ts";
import { createAgenda } from "./agendas.ts";

const A = "workspace-a";
// Lunes 7 de septiembre de 2026, 08:00 en Madrid.
const NOW = new Date("2026-09-07T06:00:00Z");
const TUESDAY_10 = "2026-09-08T08:00:00.000Z";
const deps = { now: () => NOW };

let fake: FakeSupabase;
let client: CrmClient;

const ACTIVE = ["scheduled", "rescheduled"];

/** Simula book/reschedule_appointment: oferta en 30 min para el agente y solape. */
function simulateSql() {
  const overlaps = (row: Record<string, unknown>, agendaId: unknown, start: string, end: string, ignore?: unknown) =>
    row.agenda_id === agendaId &&
    row.id !== ignore &&
    ACTIVE.includes(String(row.status)) &&
    new Date(String(row.starts_at)) < new Date(end) &&
    new Date(String(row.ends_at)) > new Date(start);
  const offered = (conversationId: unknown, agendaId: unknown, start: string) =>
    fake.table("offered_slots").some(
      (row) =>
        row.conversation_id === conversationId &&
        row.agenda_id === agendaId &&
        new Date(String(row.starts_at)).getTime() === new Date(start).getTime() &&
        new Date(String(row.offered_at)).getTime() >= NOW.getTime() - 30 * 60_000,
    );

  fake.rpcHandler = (name, args) => {
    const start = String(args.p_starts_at);
    const end = String(args.p_ends_at);
    if (name === "book_appointment") {
      if (args.p_created_by === "agent" && !offered(args.p_conversation_id, args.p_agenda_id, start)) {
        return { data: null, error: { code: "LVN01", message: "Ese horario no se le ofreció a esta persona en los últimos 30 minutos." } };
      }
      if (fake.table("appointments").some((row) => overlaps(row, args.p_agenda_id, start, end))) {
        return { data: null, error: { code: "LVS01", message: "Ese horario ya está ocupado." } };
      }
      const row = {
        agenda_id: args.p_agenda_id, contact_id: args.p_contact_id, conversation_id: args.p_conversation_id, created_by: args.p_created_by,
        ends_at: end, google_event_id: null, id: `appt-${fake.table("appointments").length + 1}`, service: args.p_service,
        starts_at: start, status: "scheduled", workspace_id: args.p_workspace_id,
      };
      fake.table("appointments").push(row);
      return { data: row, error: null };
    }
    if (name === "reschedule_appointment") {
      const old = fake.table("appointments").find((row) => row.id === args.p_appointment_id)!;
      if (!offered(args.p_conversation_id ?? old.conversation_id, old.agenda_id, start)) {
        return { data: null, error: { code: "LVN01", message: "No ofrecida." } };
      }
      if (fake.table("appointments").some((row) => overlaps(row, old.agenda_id, start, end, old.id))) {
        return { data: null, error: { code: "LVS01", message: "Ocupado." } };
      }
      old.status = "cancelled";
      const row = { ...old, ends_at: end, id: `${old.id}-r`, starts_at: start, status: "rescheduled" };
      fake.table("appointments").push(row);
      return { data: row, error: null };
    }
    return { data: null, error: { message: "?" } };
  };
}

const ask = (text: string) => [{ body: text, direction: "inbound" }];

async function setup() {
  const agenda = await createAgenda(client, A, {
    minNoticeMinutes: 0,
    name: "Consultas",
    services: [{ duration_minutes: 60, name: "Primera visita" }],
    timezone: "Europe/Madrid",
  });
  const result = await buildAgendaRuntime(
    client,
    {
      agentName: "Citas",
      contact: { fullName: null, id: "contact-a", metadata: {}, phone: "+34600000001" },
      conversationId: "conv-a",
      enabledToolIds: [],
      tools: [],
      workspaceId: A,
    },
    deps,
  );
  return { agenda, runtime: result.runtime! };
}

function call(name: string, args: Record<string, unknown>) {
  return { arguments: JSON.stringify(args), name };
}

beforeEach(() => {
  fake = createCrmFake({
    contacts: [{ full_name: null, id: "contact-a", phone_e164: "+34600000001", workspace_id: A }],
    conversations: [
      { contact_id: "contact-a", id: "conv-a", workspace_id: A },
      { contact_id: "contact-a", id: "conv-otra", workspace_id: A },
    ],
  });
  client = fake as unknown as CrmClient;
  simulateSql();
});

describe("runtime de la agenda propia", () => {
  it("sin tools usa la agenda por defecto; con tools, solo las asignadas", async () => {
    const { agenda, runtime } = await setup();
    assert.equal(runtime.engine, "agenda");
    assert.deepEqual(runtime.calendars.map((item) => item.calendarId), [agenda.id]);

    const tools = parseCalendarTools([
      { content: "Presencial", id: "tool-1", metadata: buildCalendarToolMetadata({ agendaId: agenda.id, agendaName: "Madrid", isDefault: true }), title: "Madrid" },
    ]);
    const none = await buildAgendaRuntime(client, { agentName: "Citas", contact: { fullName: null, id: "contact-a", metadata: {}, phone: "+3460" }, conversationId: "conv-a", enabledToolIds: [], tools, workspaceId: A });
    assert.match(String(none.reason), /no tiene ninguna agenda asignada/);
    const assigned = await buildAgendaRuntime(client, { agentName: "Citas", contact: { fullName: null, id: "contact-a", metadata: {}, phone: "+3460" }, conversationId: "conv-a", enabledToolIds: ["tool-1"], tools, workspaceId: A });
    assert.deepEqual(assigned.runtime?.calendars.map((item) => [item.calendarName, item.description]), [["Madrid", "Presencial"]]);
  });
});

describe("tools del agente", () => {
  it("consultar ofrece los huecos a la conversación y agendar con ese ISO confirma", async () => {
    const { runtime } = await setup();
    const result = await runAgendaTool(client, runtime, call("consultar_disponibilidad", { dias: 1, fecha_inicio: "2026-09-08", servicio: null }), ask("¿qué tienes el martes?"), deps);
    const horarios = result.horarios as Array<{ hora: string; inicio: string }>;
    assert.equal(result.fecha_consultada, "2026-09-08");
    assert.equal(result.duracion_minutos, 30);
    assert.ok(horarios.length > 0 && horarios.length <= 6);
    assert.equal(horarios[0].hora, "09:00");
    assert.equal(fake.table("offered_slots").length, horarios.length);

    const booked = await runAgendaTool(client, runtime, call("agendar_cita", { horario_iso: horarios[0].inicio, motivo: "Primera visita", nombre: "Ana Pérez" }), ask("la primera"), deps);
    assert.equal(booked.confirmada, true);
    assert.equal(typeof booked.cita_id, "string");
    assert.equal(fake.table("contacts")[0].full_name, "Ana Pérez");
    assert.equal(fake.table("appointments")[0].ends_at, new Date(new Date(horarios[0].inicio).getTime() + 60 * 60_000).toISOString());
  });

  it("un ISO que no se ofreció no se agenda (el modelo no puede inventar la hora)", async () => {
    const { runtime } = await setup();
    const result = await runAgendaTool(client, runtime, call("agendar_cita", { horario_iso: TUESDAY_10, motivo: "Cita", nombre: "Ana" }), ask("vale"), deps);
    assert.notEqual(result.confirmada, true);
    assert.equal(result.codigo, "not_offered");
    assert.ok(Array.isArray(result.horarios_libres));
    assert.equal(fake.table("appointments").length, 0);
  });

  it("fecha y hora en el mensaje: el servidor busca el hueco real, lo ofrece y agenda", async () => {
    const { runtime } = await setup();
    const result = await runAgendaTool(client, runtime, call("agendar_cita", { horario_iso: "inventado", motivo: "Cita", nombre: "Ana" }), ask("el martes a las 10 de la mañana"), deps);
    assert.equal(result.confirmada, true);
    assert.equal(result.inicio, TUESDAY_10);
  });

  it("hueco ocupado: error con alternativas y nunca confirmada", async () => {
    const { agenda, runtime } = await setup();
    fake.table("appointments").push({ agenda_id: agenda.id, contact_id: "otro", ends_at: "2026-09-08T09:00:00Z", id: "x", starts_at: TUESDAY_10, status: "scheduled", workspace_id: A });
    const result = await runAgendaTool(client, runtime, call("agendar_cita", { horario_iso: "x", motivo: "Cita", nombre: "Ana" }), ask("el martes a las 10:00"), deps);
    assert.notEqual(result.confirmada, true);
    assert.match(String(result.error), /no está libre/);
    const answer = buildDirectBookingAnswer(result, runtime);
    assert.match(answer, /ya no está libre/);
    assert.doesNotMatch(answer, /quedo agendada/);
  });

  it("hora ambigua: pregunta antes de reservar", async () => {
    const { runtime } = await setup();
    const result = await runAgendaTool(client, runtime, call("agendar_cita", { horario_iso: "x", motivo: "Cita", nombre: "Ana" }), ask("el martes a las 4"), deps);
    assert.match(String(result.error ?? ""), /ambigua|no está libre/);
    assert.equal(fake.table("appointments").length, 0);
  });

  it("reagendar: mueve la única próxima; con varias pide cuál", async () => {
    const { runtime } = await setup();
    await runAgendaTool(client, runtime, call("agendar_cita", { horario_iso: "x", motivo: "Cita", nombre: "Ana" }), ask("el martes a las 10:00"), deps);
    const moved = await runAgendaTool(client, runtime, call("reagendar_cita", { cita_actual_inicio: null, horario_iso: "x" }), ask("mejor el martes a las 12:00"), deps);
    assert.equal(moved.confirmada, true);
    assert.equal(moved.reagendada, true);
    assert.equal(moved.inicio, "2026-09-08T10:00:00.000Z");
    assert.match(buildDirectBookingAnswer(moved, runtime), /quedo cambiada/);

    await runAgendaTool(client, runtime, call("agendar_cita", { horario_iso: "x", motivo: "Cita", nombre: "Ana" }), ask("y otra el martes a las 16:00"), deps);
    const ambiguous = await runAgendaTool(client, runtime, call("reagendar_cita", { cita_actual_inicio: null, horario_iso: "x" }), ask("el martes a las 17:00"), deps);
    assert.match(String(ambiguous.error), /varias citas/);
    assert.equal((ambiguous.citas as unknown[]).length, 2);
  });

  it("cancelar: solo citas de esta conversación", async () => {
    const { runtime } = await setup();
    await runAgendaTool(client, runtime, call("agendar_cita", { horario_iso: "x", motivo: "Cita", nombre: "Ana" }), ask("el martes a las 10:00"), deps);

    const otherConversation: AgendaCalendarRuntime = { ...runtime, conversationId: "conv-otra" };
    const refused = await runAgendaTool(client, otherConversation, call("cancelar_cita", { cita_actual_inicio: null, motivo: null }), ask("cancela"), deps);
    assert.notEqual(refused.cancelada, true);
    assert.match(buildDirectCancelAnswer(refused, runtime), /sigue en pie/);

    const cancelled = await runAgendaTool(client, runtime, call("cancelar_cita", { cita_actual_inicio: null, motivo: "viaje" }), ask("cancela"), deps);
    assert.equal(cancelled.cancelada, true);
    assert.match(buildDirectCancelAnswer(cancelled, runtime), /^Listo, cancelé tu cita del martes, 8 de septiembre de 2026/);
    assert.equal(fake.table("appointments")[0].status, "cancelled");
  });
});

describe("barreras con reagendar y cancelar", () => {
  it("tools extra solo en la agenda propia", () => {
    const base = buildCalendarToolDefinitions([{ calendarName: "Consultas", description: "" }]);
    const withChanges = buildCalendarToolDefinitions([{ calendarName: "Consultas", description: "" }], { withChanges: true });
    assert.deepEqual(base.map((tool) => tool.name), ["consultar_disponibilidad", "agendar_cita"]);
    assert.deepEqual(withChanges.map((tool) => tool.name), ["consultar_disponibilidad", "agendar_cita", "reagendar_cita", "cancelar_cita"]);
    assert.ok(withChanges[0].parameters.required.includes("servicio"));
    assert.ok(!base[0].parameters.required.includes("servicio"));
  });

  it("no dice «cancelada» sin cancelar_cita confirmada", () => {
    const view = { calendars: [{ calendarName: "C", description: "" }], contact: { fullName: null }, engine: "agenda" as const, timezone: "Europe/Madrid" };
    const blocked = sanitizeCalendarAnswer({ answer: "Listo, tu cita quedó cancelada.", calendarRuntime: view, toolCalls: [] });
    assert.match(String(blocked.blockedReason), /cancelada sin cancelar_cita/);
    const ok = sanitizeCalendarAnswer({ answer: "Listo, tu cita quedó cancelada.", calendarRuntime: view, toolCalls: [{ name: "cancelar_cita", result: { cancelada: true } }] });
    assert.equal(ok.blockedReason, null);
    const moved = sanitizeCalendarAnswer({ answer: "Tu cita quedó confirmada para el jueves.", calendarRuntime: view, toolCalls: [{ name: "reagendar_cita", result: { cita_id: "x", confirmada: true } }] });
    assert.equal(moved.blockedReason, null);
  });

  it("el contexto lista las citas próximas con su inicio", () => {
    const text = buildCalendarContext({
      calendars: [{ calendarName: "C", description: "" }],
      contact: { fullName: null },
      engine: "agenda",
      timezone: "Europe/Madrid",
      upcoming: [{ label: "martes 8 de septiembre, 10:00", service: "Limpieza", startsAt: TUESDAY_10 }],
    });
    assert.match(text, /martes 8 de septiembre, 10:00 \(Limpieza\) -> inicio: 2026-09-08T08:00:00.000Z/);
    assert.match(text, /SOLO puedes decir que quedó cancelada/);
    assert.doesNotMatch(buildCalendarContext({ calendars: [{ calendarName: "C", description: "" }], contact: { fullName: null }, timezone: "UTC" }), /reagendar_cita/);
  });
});
