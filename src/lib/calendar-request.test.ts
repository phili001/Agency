import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCalendarRequestContext } from "./calendar-request.ts";

const inbound = (body: string) => [{ body, direction: "inbound" }];
// Lunes 7 de septiembre de 2026, para que las fechas relativas sean estables.
const reference = new Date("2026-09-07T10:00:00Z");

function dateFor(text: string) {
  return resolveCalendarRequestContext(inbound(text), "UTC", reference).dateKey;
}

/**
 * Las claves de `weekdays` y `months` se comparan contra texto ya normalizado
 * (sin tildes). Si alguien "corrige" `miercoles` a `miércoles` dentro del objeto,
 * el lookup deja de encontrar el día y el agente propone fechas equivocadas sin
 * romper nada visible. Estos casos existen para que eso salte aquí.
 */
describe("resolveCalendarRequestContext: días de la semana", () => {
  const cases: Array<[string, number]> = [
    ["quiero cita el miercoles", 3],
    ["quiero cita el miércoles", 3],
    ["quiero cita el sabado", 6],
    ["quiero cita el sábado", 6],
    ["quiero cita el martes", 2],
    ["quiero cita el viernes", 5],
  ];

  for (const [texto, diaEsperado] of cases) {
    it(`entiende "${texto}"`, () => {
      const dateKey = dateFor(texto);
      assert.ok(dateKey, `no reconoció la fecha en "${texto}"`);
      assert.equal(new Date(`${dateKey}T00:00:00Z`).getUTCDay(), diaEsperado);
    });
  }
});

describe("resolveCalendarRequestContext: fechas relativas", () => {
  it("entiende 'mañana' con y sin tilde", () => {
    assert.equal(dateFor("mañana"), "2026-09-08");
    assert.equal(dateFor("manana"), "2026-09-08");
  });

  it("entiende 'pasado mañana'", () => {
    assert.equal(dateFor("pasado mañana"), "2026-09-09");
  });

  it("entiende 'hoy'", () => {
    assert.equal(dateFor("puede ser hoy?"), "2026-09-07");
  });

  it("no inventa fecha cuando el mensaje no habla de fechas", () => {
    assert.equal(dateFor("cuánto cuesta el servicio"), null);
  });
});

describe("resolveCalendarRequestContext: hora pedida", () => {
  it("lee la hora del mensaje del contacto", () => {
    const context = resolveCalendarRequestContext(
      inbound("agendemos mañana a las 3 de la tarde"),
      "UTC",
      reference,
    );
    assert.equal(context.dateKey, "2026-09-08");
    assert.ok(context.time, "debería detectar una hora");
    assert.ok(context.time!.hours.includes(15));
  });

  it("hereda la fecha del mensaje anterior cuando solo responden la hora", () => {
    const context = resolveCalendarRequestContext(
      [
        { body: "quiero cita el miercoles", direction: "inbound" },
        { body: "¿A qué hora te viene bien?", direction: "outbound" },
        { body: "a las 10", direction: "inbound" },
      ],
      "UTC",
      reference,
    );
    assert.ok(context.dateKey, "debería heredar la fecha");
    assert.equal(context.inheritedDate, true);
  });
});
