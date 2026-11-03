import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appointmentMarker,
  cleanGhlTags,
  convertFlowSteps,
  ghlSlotMinutes,
  hasAppointmentMarker,
  mapGhlOpenHours,
  proposeToolText,
  resolveGhlStage,
} from "./ghl-to-crm.ts";

const STAGES = [
  { id: "s-new", kind: "open", name: "Nuevo contacto" },
  { id: "s-quote", kind: "open", name: "Solicitud de presupuesto" },
  { id: "s-won", kind: "won", name: "Cliente" },
  { id: "s-lost", kind: "lost", name: "Perdido" },
];
const PIPELINES = [
  { id: "p-main", stages: [{ id: "g-new", name: "Nuevo Contacto" }, { id: "g-quote", name: "Solicitud de presupuésto" }, { id: "g-odd", name: "Esperando firma" }] },
  { id: "p-other", stages: [{ id: "g-x", name: "Cliente" }] },
];

describe("etiquetas y etapa", () => {
  it("limpia etiquetas de GHL", () => {
    assert.deepEqual(cleanGhlTags([" Lead WhatsApp ", "lead whatsapp", "", 3, "x".repeat(60), "VIP"]), ["lead whatsapp", "vip"]);
    assert.deepEqual(cleanGhlTags(null), []);
  });

  it("toma la etapa por nombre (sin tildes ni mayúsculas) y prefiere el pipeline por defecto", () => {
    const opportunities = [
      { pipelineId: "p-other", pipelineStageId: "g-x", updatedAt: "2026-10-02" },
      { pipelineId: "p-main", pipelineStageId: "g-quote", updatedAt: "2026-09-01" },
    ];
    assert.deepEqual(resolveGhlStage(opportunities, PIPELINES, STAGES, "p-main"), { ghlStageName: "Solicitud de presupuésto", stageId: "s-quote" });
    // Sin pipeline por defecto gana la más reciente.
    assert.equal(resolveGhlStage(opportunities, PIPELINES, STAGES, null).stageId, "s-won");
  });

  it("si la etapa no casa, usa ganada/perdida; si no, la deja sin decidir", () => {
    assert.equal(resolveGhlStage([{ pipelineStageId: "g-odd", status: "won" }], PIPELINES, STAGES, null).stageId, "s-won");
    assert.equal(resolveGhlStage([{ pipelineStageId: "g-odd", status: "lost" }], PIPELINES, STAGES, null).stageId, "s-lost");
    assert.deepEqual(resolveGhlStage([{ pipelineStageId: "g-odd", status: "open" }], PIPELINES, STAGES, null), { ghlStageName: "Esperando firma", stageId: null });
    assert.deepEqual(resolveGhlStage([], PIPELINES, STAGES, null), { ghlStageName: null, stageId: null });
  });
});

describe("calendario → agenda", () => {
  it("pasa openHours (0 = domingo) a horario por día ISO", () => {
    const schedule = mapGhlOpenHours([
      { daysOfTheWeek: [1, 2], hours: [{ closeHour: 14, closeMinute: 0, openHour: 9, openMinute: 30 }, { closeHour: 19, openHour: 16 }] },
      { daysOfTheWeek: [0], hours: [{ closeHour: 12, openHour: 10 }] },
      { daysOfTheWeek: [3], hours: [{ closeHour: 9, openHour: 10 }] },
    ]);
    assert.deepEqual(schedule, {
      "1": [{ end: "14:00", start: "09:30" }, { end: "19:00", start: "16:00" }],
      "2": [{ end: "14:00", start: "09:30" }, { end: "19:00", start: "16:00" }],
      "7": [{ end: "12:00", start: "10:00" }],
    });
    assert.equal(mapGhlOpenHours(undefined), null);
    assert.equal(mapGhlOpenHours([]), null);
  });

  it("convierte la duración a minutos", () => {
    assert.equal(ghlSlotMinutes(45, "mins"), 45);
    assert.equal(ghlSlotMinutes(1, "hours"), 60);
    assert.equal(ghlSlotMinutes(undefined, "mins", 30), 30);
  });

  it("marca las citas importadas para no duplicarlas", () => {
    assert.equal(hasAppointmentMarker(`Importada ${appointmentMarker("evt1")}`, "evt1"), true);
    assert.equal(hasAppointmentMarker("Importada [ghl:evt10]", "evt1"), false);
    assert.equal(hasAppointmentMarker(null, "evt1"), false);
  });
});

describe("flujos y tools", () => {
  it("convierte acciones de GHL con los mapeos de la migración y deja las que no tienen equivalente", () => {
    const steps = [
      { actions: [{ label: "Etiqueta", tag: "interesado", type: "add_tag" }, { label: "Etapa", stageId: "g-quote", type: "upsert_opportunity" }], id: "1", name: "Inicio" },
      { actions: [{ calendarId: "cal-levi", label: "Agenda", type: "set_booking_calendar" }, { label: "Etapa rara", stageId: "g-zzz", type: "upsert_opportunity" }], id: "2", name: "Agenda" },
      { id: "3", name: "Sin acciones" },
    ];
    const result = convertFlowSteps(steps, {
      calendarToAgenda: new Map([["cal-levi", "agenda-1"]]),
      stageToCrm: new Map([["g-quote", { id: "s-quote", name: "Solicitud de presupuesto" }]]),
    });

    assert.equal(result.converted, 3);
    assert.deepEqual(result.unconverted, ["Agenda: Etapa rara"]);
    assert.deepEqual(result.steps[0].actions, [
      { engine: "crm", label: "Etiqueta", tagName: "interesado", type: "add_tag" },
      { engine: "crm", label: "Etapa", stageId: "s-quote", stageName: "Solicitud de presupuesto", type: "set_stage" },
    ]);
    assert.deepEqual(result.steps[1].actions?.[0], { agendaId: "agenda-1", engine: "crm", label: "Agenda", type: "set_booking_agenda" });
    assert.equal(result.steps[1].actions?.length, 2);
    // Repetirla no cambia nada (idempotente).
    const again = convertFlowSteps(result.steps, { calendarToAgenda: new Map([["cal-levi", "agenda-1"]]) });
    assert.equal(again.converted, 0);
  });

  it("propone texto sin GoHighLevel", () => {
    const proposal = proposeToolText(
      "Agendar en GoHighLevel",
      "Accion: crea una cita directamente en GoHighLevel. Inputs: nombre, fecha, hora, calendario y notas. Requiere GoHighLevel conectado en esta empresa.",
    );
    assert.equal(proposal.title, "Agendar cita");
    assert.equal(proposal.content, "Accion: crea una cita directamente en la agenda. Inputs: nombre, fecha, hora y notas.");
    assert.equal(
      proposeToolText("Consultar disponibilidad", "Accion: consulta horarios en el calendario de GoHighLevel antes de reservar. Inputs: rango de fechas y calendario.").content,
      "Accion: consulta horarios en la agenda antes de reservar. Inputs: rango de fechas.",
    );
  });
});
