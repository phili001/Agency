import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CrmError } from "../crm/errors.ts";
import {
  type AgendaConfig,
  agendaConfigFromRow,
  closedReason,
  daySlots,
  distributeSlots,
  formatSlotLabel,
  freeSlots,
  isOpenAt,
  resolveService,
  spaced,
  validateAgendaSettings,
} from "./slots.ts";

const WEEKDAYS_9_TO_18 = {
  "1": [{ end: "18:00", start: "09:00" }],
  "2": [{ end: "18:00", start: "09:00" }],
  "3": [{ end: "18:00", start: "09:00" }],
  "4": [{ end: "18:00", start: "09:00" }],
  "5": [{ end: "18:00", start: "09:00" }],
};

function config(extra: Partial<AgendaConfig> = {}): AgendaConfig {
  return {
    closedDates: [],
    maxDaysAhead: 60,
    minNoticeMinutes: 0,
    schedule: WEEKDAYS_9_TO_18,
    services: [],
    slotStepMinutes: 30,
    timezone: "Europe/Madrid",
    ...extra,
  };
}

const iso = (date: Date) => date.toISOString();
// Domingo 6 de septiembre de 2026, 20:00 en Madrid (18:00Z).
const SUNDAY_EVENING = new Date("2026-09-06T18:00:00Z");

describe("daySlots", () => {
  it("reparte el tramo con el paso y la duración, en hora local", () => {
    const slots = daySlots("2026-09-07", 30, [], config(), SUNDAY_EVENING);
    assert.equal(slots.length, 18);
    assert.equal(iso(slots[0].start), "2026-09-07T07:00:00.000Z"); // 09:00 Madrid (+2)
    assert.equal(iso(slots.at(-1)!.end), "2026-09-07T16:00:00.000Z"); // 18:00 Madrid
  });

  it("una cita larga no se sale del tramo", () => {
    const slots = daySlots("2026-09-07", 90, [], config(), SUNDAY_EVENING);
    assert.equal(iso(slots.at(-1)!.start), "2026-09-07T14:30:00.000Z"); // 16:30 → 18:00
  });

  it("varios tramos con pausa a mediodía", () => {
    const split = config({
      schedule: { "1": [{ end: "20:00", start: "16:00" }, { end: "14:00", start: "09:00" }] },
    });
    const slots = daySlots("2026-09-07", 60, [], agendaConfigFromRow({ ...toRow(split) }), SUNDAY_EVENING);
    const hours = slots.map((slot) => formatSlotLabel(slot.start, "Europe/Madrid").split(", ").at(-1));
    assert.deepEqual(hours, ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"]);
  });

  it("quita lo ocupado (citas, bloqueos, Google) incluso a medias", () => {
    const busy = [
      { end: new Date("2026-09-07T08:00:00Z"), start: new Date("2026-09-07T07:00:00Z") }, // 09-10
      { end: new Date("2026-09-07T10:45:00Z"), start: new Date("2026-09-07T10:15:00Z") }, // 12:15-12:45
    ];
    const starts = daySlots("2026-09-07", 30, busy, config(), SUNDAY_EVENING).map((slot) => iso(slot.start));
    assert.ok(!starts.includes("2026-09-07T07:00:00.000Z"));
    assert.ok(!starts.includes("2026-09-07T07:30:00.000Z"));
    assert.ok(starts.includes("2026-09-07T08:00:00.000Z")); // justo al acabar, sí cabe
    assert.ok(!starts.includes("2026-09-07T10:00:00.000Z"));
    assert.ok(!starts.includes("2026-09-07T10:30:00.000Z"));
    assert.ok(starts.includes("2026-09-07T10:45:00.000Z") === false); // no está en la rejilla
    assert.ok(starts.includes("2026-09-07T11:00:00.000Z"));
  });

  it("respeta lo pasado y la antelación mínima", () => {
    // Lunes 7, 12:10 en Madrid; antelación 60 min → desde las 13:10 → primer hueco 13:30.
    const now = new Date("2026-09-07T10:10:00Z");
    const slots = daySlots("2026-09-07", 30, [], config({ minNoticeMinutes: 60 }), now);
    assert.equal(iso(slots[0].start), "2026-09-07T11:30:00.000Z");
  });

  it("no ofrece más allá del máximo de días", () => {
    const now = new Date("2026-09-07T06:00:00Z");
    assert.equal(daySlots("2026-09-10", 30, [], config({ maxDaysAhead: 2 }), now).length, 0);
    assert.ok(daySlots("2026-09-08", 30, [], config({ maxDaysAhead: 2 }), now).length > 0);
  });

  it("días cerrados y festivos no dan nada", () => {
    assert.equal(daySlots("2026-09-12", 30, [], config(), SUNDAY_EVENING).length, 0); // sábado
    const holiday = config({ closedDates: ["2026-09-07"] });
    assert.equal(daySlots("2026-09-07", 30, [], holiday, SUNDAY_EVENING).length, 0);
    assert.equal(closedReason("2026-09-07", holiday), "Ese día el negocio está cerrado (festivo).");
    assert.equal(closedReason("2026-09-12", config()), "El negocio no atiende los sábados.");
    assert.equal(closedReason("2026-09-08", config()), null);
  });

  it("cambio de hora: la apertura sigue a las 09:00 locales", () => {
    const now = new Date("2026-03-20T00:00:00Z");
    const before = daySlots("2026-03-27", 30, [], config(), now); // viernes, +1
    const after = daySlots("2026-03-30", 30, [], config(), now); // lunes, +2
    assert.equal(iso(before[0].start), "2026-03-27T08:00:00.000Z");
    assert.equal(iso(after[0].start), "2026-03-30T07:00:00.000Z");
  });

  it("cambio de hora: la hora que no existe no se ofrece", () => {
    // 29-03-2026 en Madrid salta de 02:00 a 03:00.
    const night = config({ schedule: { "7": [{ end: "05:00", start: "01:00" }] } });
    const slots = daySlots("2026-03-29", 30, [], night, new Date("2026-03-20T00:00:00Z"));
    const labels = slots.map((slot) => formatSlotLabel(slot.start, "Europe/Madrid").split(", ").at(-1));
    assert.deepEqual(labels, ["01:00", "01:30", "03:00", "03:30", "04:00", "04:30"]);
  });

  it("cambio de hora: al atrasar el reloj no se duplican horas", () => {
    const night = config({ schedule: { "7": [{ end: "04:00", start: "01:00" }] } });
    const slots = daySlots("2026-10-25", 60, [], night, new Date("2026-10-20T00:00:00Z"));
    const labels = slots.map((slot) => formatSlotLabel(slot.start, "Europe/Madrid").split(", ").at(-1));
    assert.equal(new Set(labels).size, labels.length);
  });

  it("bordes del día: tramo hasta 24:00", () => {
    const late = config({ schedule: { "1": [{ end: "24:00", start: "23:00" }] } });
    const slots = daySlots("2026-09-07", 30, [], late, SUNDAY_EVENING);
    assert.equal(slots.length, 2);
    assert.equal(iso(slots[1].end), "2026-09-07T22:00:00.000Z"); // 00:00 del martes en Madrid
  });

  it("otra zona: Bogotá (sin horario de verano)", () => {
    const bogota = config({ timezone: "America/Bogota" });
    const slots = daySlots("2026-09-07", 30, [], bogota, SUNDAY_EVENING);
    assert.equal(iso(slots[0].start), "2026-09-07T14:00:00.000Z");
  });
});

describe("freeSlots", () => {
  it("recorre días y se corta en el máximo (contado desde ahora, como book_appointment)", () => {
    // Lunes 08:00 en Madrid + 3 días = jueves 08:00: el jueves a las 09:00 ya no.
    const now = new Date("2026-09-07T06:00:00Z");
    const slots = freeSlots("2026-09-07", "2026-09-30", 60, [], config({ maxDaysAhead: 3 }), now);
    const days = new Set(slots.map((slot) => slot.dateKey));
    assert.deepEqual([...days], ["2026-09-07", "2026-09-08", "2026-09-09"]);
    assert.ok(slots.every((slot) => slot.start.getTime() <= now.getTime() + 3 * 86_400_000));
  });
});

describe("isOpenAt", () => {
  it("abre dentro de un tramo y cierra fuera", () => {
    assert.equal(isOpenAt(new Date("2026-09-07T08:00:00Z"), config()), true); // lunes 10:00
    assert.equal(isOpenAt(new Date("2026-09-07T16:00:00Z"), config()), false); // lunes 18:00
    assert.equal(isOpenAt(new Date("2026-09-12T10:00:00Z"), config()), false); // sábado
  });
});

describe("qué ofrecer", () => {
  const slots = daySlots("2026-09-07", 30, [], config(), SUNDAY_EVENING)
    .concat(daySlots("2026-09-08", 30, [], config(), SUNDAY_EVENING));

  it("spaced reparte de punta a punta", () => {
    assert.deepEqual(spaced([1, 2, 3, 4, 5, 6, 7, 8, 9], 3), [1, 5, 9]);
    assert.deepEqual(spaced([1, 2], 5), [1, 2]);
    assert.deepEqual(spaced([1, 2, 3], 1), [1]);
  });

  it("sin preferencia: unos de cada día y repartidos", () => {
    const chosen = distributeSlots(slots, 4, "Europe/Madrid");
    assert.deepEqual(chosen.map((slot) => slot.dateKey), ["2026-09-07", "2026-09-07", "2026-09-08", "2026-09-08"]);
    assert.equal(iso(chosen[0].start), "2026-09-07T07:00:00.000Z");
    assert.equal(iso(chosen[1].start), "2026-09-07T15:30:00.000Z");
  });

  it("con hora preferida: los más cercanos, en orden", () => {
    const chosen = distributeSlots(slots, 3, "Europe/Madrid", 17 * 60);
    const labels = chosen.map((slot) => formatSlotLabel(slot.start, "Europe/Madrid"));
    assert.deepEqual(labels, [
      "lunes 7 de septiembre, 16:30",
      "lunes 7 de septiembre, 17:00",
      "martes 8 de septiembre, 17:00",
    ]);
  });

  it("nada que ofrecer", () => {
    assert.deepEqual(distributeSlots([], 3, "Europe/Madrid"), []);
    assert.deepEqual(distributeSlots(slots, 0, "Europe/Madrid"), []);
  });
});

describe("resolveService", () => {
  const catalog = [
    { durationMinutes: 45, name: "Limpieza dental" },
    { durationMinutes: 90, name: "Implante dental" },
    { durationMinutes: 20, name: "Revisión" },
  ];

  it("igual, contenido o por palabras", () => {
    assert.equal(resolveService("limpieza dental", catalog).durationMinutes, 45);
    assert.equal(resolveService("una limpieza", catalog).name, "Limpieza dental");
    assert.equal(resolveService("REVISION", catalog).durationMinutes, 20);
  });

  it("empate o desconocido: lo que dijo con 30 min", () => {
    assert.deepEqual(resolveService("algo dental", catalog), { durationMinutes: 30, name: "algo dental" });
    assert.deepEqual(resolveService("masaje", catalog), { durationMinutes: 30, name: "masaje" });
    assert.deepEqual(resolveService("", catalog), { durationMinutes: 30, name: "Cita" });
  });
});

describe("configuración", () => {
  it("desde la fila es tolerante", () => {
    const parsed = agendaConfigFromRow({
      closed_dates: ["2026-12-25", "no-fecha", "2026-12-25"],
      max_days_ahead: 9999,
      schedule: { "1": [{ end: "18:00", start: "09:00" }, { end: "08:00", start: "10:00" }], "9": [] },
      services: [{ duration_minutes: 30, name: "Consulta" }, { duration_minutes: 2, name: "Corta" }],
      slot_step_minutes: 15,
      timezone: "Inventada/Zona",
    });
    assert.equal(parsed.timezone, "UTC");
    assert.deepEqual(parsed.closedDates, ["2026-12-25"]);
    assert.equal(parsed.maxDaysAhead, 365);
    assert.deepEqual(parsed.schedule, { "1": [{ end: "18:00", start: "09:00" }] });
    assert.deepEqual(parsed.services, [{ durationMinutes: 30, name: "Consulta" }]);
    assert.equal(parsed.slotStepMinutes, 15);
  });

  it("lo del panel se valida con motivo", () => {
    const isInvalid = (error: unknown) => error instanceof CrmError && error.code === "invalid";
    assert.throws(() => validateAgendaSettings({ timezone: "Colombia" }), isInvalid);
    assert.throws(() => validateAgendaSettings({ schedule: { "1": [{ end: "09:00", start: "10:00" }] } }), isInvalid);
    assert.throws(
      () => validateAgendaSettings({ schedule: { "1": [{ end: "12:00", start: "09:00" }, { end: "13:00", start: "11:00" }] } }),
      isInvalid,
    );
    assert.throws(() => validateAgendaSettings({ schedule: { "8": [] } }), isInvalid);
    assert.throws(() => validateAgendaSettings({ services: [{ duration_minutes: 600, name: "Larga" }] }), isInvalid);
    assert.throws(() => validateAgendaSettings({ closedDates: ["25/12/2026"] }), isInvalid);
    assert.deepEqual(
      validateAgendaSettings({ services: [{ durationMinutes: 30, name: " Consulta " }], timezone: "Europe/Madrid" }),
      { services: [{ duration_minutes: 30, name: "Consulta" }], timezone: "Europe/Madrid" },
    );
  });
});

function toRow(value: AgendaConfig) {
  return {
    closed_dates: value.closedDates,
    max_days_ahead: value.maxDaysAhead,
    min_notice_minutes: value.minNoticeMinutes,
    schedule: value.schedule,
    services: value.services.map((service) => ({ duration_minutes: service.durationMinutes, name: service.name })),
    slot_step_minutes: value.slotStepMinutes,
    timezone: value.timezone,
  };
}
