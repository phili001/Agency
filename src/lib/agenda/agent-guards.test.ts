import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type CalendarRuntimeView,
  buildCalendarContext,
  buildCalendarToolDefinitions,
  buildDirectAvailabilityAnswer,
  buildDirectBookingAnswer,
  hasAvailabilityLookup,
  hasConfirmedAppointment,
  sanitizeCalendarAnswer,
  textLooksLikeAvailabilityClaim,
  textLooksLikeBookingClaim,
} from "./agent-guards.ts";

const runtime: CalendarRuntimeView = {
  calendars: [{ calendarName: "Consultas", description: "Primera visita" }],
  contact: { fullName: "Ana Pérez" },
  timezone: "Europe/Madrid",
};

const confirmed = [{ name: "agendar_cita", result: { cita_id: "abc", confirmada: true, inicio: "2026-09-08T08:00:00Z" } }];
const lookup = [{ name: "consultar_disponibilidad", result: { fecha_consultada: "2026-09-08", horarios: [] } }];

describe("barrera: no afirmar una cita sin confirmación de la tool", () => {
  it("detecta frases de cita confirmada", () => {
    assert.equal(textLooksLikeBookingClaim("¡Listo! Tu cita quedó agendada para mañana."), true);
    assert.equal(textLooksLikeBookingClaim("La consulta está confirmada para el martes"), true);
    assert.equal(textLooksLikeBookingClaim("¿Quieres que te busque un hueco?"), false);
  });

  it("bloquea la afirmación sin agendar_cita confirmada con cita_id", () => {
    const blocked = sanitizeCalendarAnswer({ answer: "Tu cita quedó agendada.", calendarRuntime: runtime, toolCalls: [] });
    assert.match(String(blocked.blockedReason), /sin agendar_cita confirmada/);
    assert.ok(!/agendada/.test(blocked.answer));

    const fakeId = sanitizeCalendarAnswer({
      answer: "Tu cita quedó agendada.",
      calendarRuntime: runtime,
      toolCalls: [{ name: "agendar_cita", result: { cita_id: "  ", confirmada: true } }],
    });
    assert.ok(fakeId.blockedReason);

    const failed = sanitizeCalendarAnswer({
      answer: "Tu cita quedó agendada.",
      calendarRuntime: runtime,
      toolCalls: [{ name: "agendar_cita", result: { error: "Ese horario ya no está libre." } }],
    });
    assert.ok(failed.blockedReason);
  });

  it("deja pasar la afirmación con confirmación real", () => {
    const ok = sanitizeCalendarAnswer({ answer: "Tu cita quedó agendada.", calendarRuntime: runtime, toolCalls: confirmed });
    assert.deepEqual(ok, { answer: "Tu cita quedó agendada.", blockedReason: null });
    assert.equal(hasConfirmedAppointment(confirmed), true);
  });

  it("sin calendario, cualquier afirmación de cita se bloquea", () => {
    const blocked = sanitizeCalendarAnswer({ answer: "Te dejo la cita reservada.", calendarRuntime: null, toolCalls: [] });
    assert.match(String(blocked.blockedReason), /sin calendario conectado/);
  });
});

describe("barrera: no inventar disponibilidad", () => {
  it("detecta frases de disponibilidad", () => {
    assert.equal(textLooksLikeAvailabilityClaim("Tengo disponibilidad el jueves a las 10"), true);
    assert.equal(textLooksLikeAvailabilityClaim("Estos son los horarios libres"), true);
    assert.equal(textLooksLikeAvailabilityClaim("Gracias por escribirnos"), false);
  });

  it("bloquea horarios sin consulta válida", () => {
    const blocked = sanitizeCalendarAnswer({ answer: "Tengo libre el jueves a las 10.", calendarRuntime: runtime, toolCalls: [] });
    assert.match(String(blocked.blockedReason), /sin una consulta valida/);

    const failedLookup = sanitizeCalendarAnswer({
      answer: "Tengo libre el jueves a las 10.",
      calendarRuntime: runtime,
      toolCalls: [{ name: "consultar_disponibilidad", result: { error: "Agenda caída" } }],
    });
    assert.ok(failedLookup.blockedReason);
  });

  it("deja pasar horarios con consulta real (o alternativas de agendar_cita)", () => {
    assert.equal(sanitizeCalendarAnswer({ answer: "Tengo libre el jueves a las 10.", calendarRuntime: runtime, toolCalls: lookup }).blockedReason, null);
    assert.equal(hasAvailabilityLookup([{ name: "agendar_cita", result: { horarios_libres: [] } }]), true);
  });

  it("sin calendario, hablar de disponibilidad se bloquea", () => {
    const blocked = sanitizeCalendarAnswer({ answer: "Hay disponibilidad el lunes.", calendarRuntime: null, toolCalls: lookup });
    assert.match(String(blocked.blockedReason), /sin calendario conectado/);
  });
});

describe("tools e instrucciones", () => {
  it("con una agenda no se pide el parámetro calendario; con varias es un enum obligatorio", () => {
    const single = buildCalendarToolDefinitions(runtime.calendars);
    assert.deepEqual(single.map((tool) => tool.name), ["consultar_disponibilidad", "agendar_cita"]);
    assert.ok(!("calendario" in single[0].parameters.properties));

    const multiple = buildCalendarToolDefinitions([
      { calendarName: "Madrid", description: "Presencial" },
      { calendarName: "Online", description: "Videollamada" },
    ]);
    const properties = multiple[1].parameters.properties as Record<string, { enum?: string[] }>;
    assert.deepEqual(properties.calendario.enum, ["Madrid", "Online"]);
    assert.ok(multiple[1].parameters.required.includes("calendario"));
  });

  it("instrucciones: sin calendario prohíbe agendar; con calendario exige cita_id", () => {
    assert.match(buildCalendarContext(null), /PROHIBIDO decir que agendaste/);
    const connected = buildCalendarContext(runtime);
    assert.match(connected, /zona horaria Europe\/Madrid/);
    assert.match(connected, /"confirmada": true y un "cita_id"/);
  });
});

describe("respuestas directas", () => {
  it("cita confirmada con nombre y fecha en la zona", () => {
    const answer = buildDirectBookingAnswer({ cita_id: "x", confirmada: true, inicio: "2026-09-08T08:00:00Z", zona_horaria: "Europe/Madrid" }, runtime);
    assert.match(answer, /^Listo, Ana\. Tu cita quedó agendada para martes, 8 de septiembre de 2026, 10:00/);
  });

  it("si falla, nunca dice que quedó agendada", () => {
    const alternatives = buildDirectBookingAnswer({ error: "ocupado", horarios_libres: [{ hora: "11:00" }, { hora: "12:00" }] }, runtime);
    assert.match(alternatives, /ya no está libre/);
    assert.match(alternatives, /- 11:00\n- 12:00/);
    const failure = buildDirectBookingAnswer({ error: "boom" }, runtime);
    assert.match(failure, /no quedó agendada/);
  });

  it("disponibilidad: hora pedida libre, ocupada o lista del día", () => {
    const base = { fecha_consultada: "2026-09-08", hora_solicitada: "10:00", zona_horaria: "Europe/Madrid" };
    assert.match(buildDirectAvailabilityAnswer({ ...base, horario_solicitado_disponible: true, horarios: [] }, runtime), /^Sí, 10:00 está disponible el martes, 8 de septiembre de 2026/);
    assert.match(
      buildDirectAvailabilityAnswer({ ...base, horario_solicitado_disponible: false, horarios: [{ hora: "11:00" }] }, runtime),
      /10:00 no está disponible.*\n- 11:00/,
    );
    assert.match(buildDirectAvailabilityAnswer({ error: "x" }, runtime), /No pude consultar la agenda real/);
  });
});
