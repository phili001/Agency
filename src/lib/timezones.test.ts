import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  getZonedParts,
  isoWeekdayOfDateKey,
  isValidTimeZone,
  parseClockTime,
  zonedDateTime,
  zonedStartOfDay,
} from "./timezones.ts";

describe("isValidTimeZone", () => {
  it("acepta zonas IANA y rechaza texto libre", () => {
    assert.equal(isValidTimeZone("Europe/Madrid"), true);
    assert.equal(isValidTimeZone("America/Bogota"), true);
    assert.equal(isValidTimeZone("UTC"), true);
    assert.equal(isValidTimeZone("Colombia"), false);
    assert.equal(isValidTimeZone(""), false);
  });
});

describe("zonedStartOfDay", () => {
  it("da la medianoche local, no la del servidor", () => {
    assert.equal(
      zonedStartOfDay("2026-08-06", "Europe/Madrid")?.toISOString(),
      "2026-08-05T22:00:00.000Z",
    );
    assert.equal(
      zonedStartOfDay("2026-08-06", "America/Bogota")?.toISOString(),
      "2026-08-06T05:00:00.000Z",
    );
  });

  it("acierta en los días de cambio de hora", () => {
    // Madrid: 29-03-2026 pasa de +1 a +2 a las 02:00; la medianoche sigue en +1.
    assert.equal(
      zonedStartOfDay("2026-03-29", "Europe/Madrid")?.toISOString(),
      "2026-03-28T23:00:00.000Z",
    );
    // Madrid: 25-10-2026 vuelve a +1; la medianoche aún es +2.
    assert.equal(
      zonedStartOfDay("2026-10-25", "Europe/Madrid")?.toISOString(),
      "2026-10-24T22:00:00.000Z",
    );
  });

  it("rechaza fechas y zonas inválidas", () => {
    assert.equal(zonedStartOfDay("2026-02-30", "Europe/Madrid"), null);
    assert.equal(zonedStartOfDay("06/08/2026", "Europe/Madrid"), null);
    assert.equal(zonedStartOfDay("2026-08-06", "Marte/Olympus"), null);
  });
});

describe("zonedDateTime", () => {
  it("convierte una hora de pared al instante", () => {
    assert.equal(
      zonedDateTime("2026-09-07", "09:30", "Europe/Madrid")?.toISOString(),
      "2026-09-07T07:30:00.000Z",
    );
    assert.equal(
      zonedDateTime("2026-09-07", "09:30", "America/Bogota")?.toISOString(),
      "2026-09-07T14:30:00.000Z",
    );
  });

  it("usa el desfase correcto a cada lado del cambio de hora", () => {
    assert.equal(
      zonedDateTime("2026-03-29", "01:30", "Europe/Madrid")?.toISOString(),
      "2026-03-29T00:30:00.000Z",
    );
    assert.equal(
      zonedDateTime("2026-03-29", "03:30", "Europe/Madrid")?.toISOString(),
      "2026-03-29T01:30:00.000Z",
    );
    assert.equal(
      zonedDateTime("2026-03-08", "10:00", "America/New_York")?.toISOString(),
      "2026-03-08T14:00:00.000Z",
    );
  });

  it("devuelve null para la hora que no existe al adelantar el reloj", () => {
    assert.equal(zonedDateTime("2026-03-29", "02:30", "Europe/Madrid"), null);
    assert.equal(zonedDateTime("2026-03-08", "02:15", "America/New_York"), null);
  });

  it("elige la primera vez de la hora repetida al atrasar el reloj", () => {
    // 25-10-2026 en Madrid: 02:30 ocurre en +2 (00:30Z) y otra vez en +1 (01:30Z).
    assert.equal(
      zonedDateTime("2026-10-25", "02:30", "Europe/Madrid")?.toISOString(),
      "2026-10-25T00:30:00.000Z",
    );
  });

  it("admite 24:00 como fin del día", () => {
    assert.equal(
      zonedDateTime("2026-09-07", "24:00", "Europe/Madrid")?.toISOString(),
      "2026-09-07T22:00:00.000Z",
    );
  });

  it("rechaza horas mal escritas", () => {
    assert.equal(zonedDateTime("2026-09-07", "9:30", "Europe/Madrid"), null);
    assert.equal(zonedDateTime("2026-09-07", "25:00", "Europe/Madrid"), null);
    assert.equal(zonedDateTime("2026-09-07", "10:60", "Europe/Madrid"), null);
  });
});

describe("getZonedParts", () => {
  it("da fecha, hora y día ISO en la zona", () => {
    // 2026-09-06T23:30Z es domingo en UTC pero lunes 01:30 en Madrid.
    const instant = new Date("2026-09-06T23:30:00Z");
    const madrid = getZonedParts(instant, "Europe/Madrid");
    const utc = getZonedParts(instant, "UTC");

    assert.equal(madrid.dateKey, "2026-09-07");
    assert.equal(madrid.isoWeekday, 1);
    assert.equal(madrid.minuteOfDay, 90);
    assert.equal(utc.dateKey, "2026-09-06");
    assert.equal(utc.isoWeekday, 7);
  });

  it("pone la medianoche a 0, no a 24", () => {
    const parts = getZonedParts(new Date("2026-09-07T00:00:00Z"), "UTC");

    assert.equal(parts.hour, 0);
    assert.equal(parts.minuteOfDay, 0);
  });
});

describe("utilidades de fecha", () => {
  it("dateKeyInTimeZone depende de la zona", () => {
    const now = new Date("2026-09-07T03:00:00Z");

    assert.equal(dateKeyInTimeZone("UTC", now), "2026-09-07");
    assert.equal(dateKeyInTimeZone("America/Bogota", now), "2026-09-06");
  });

  it("addDaysToDateKey cruza meses y años", () => {
    assert.equal(addDaysToDateKey("2026-12-31", 1), "2027-01-01");
    assert.equal(addDaysToDateKey("2026-03-01", -1), "2026-02-28");
    assert.equal(addDaysToDateKey("2026-03-28", 2), "2026-03-30");
  });

  it("isoWeekdayOfDateKey: 1 = lunes, 7 = domingo", () => {
    assert.equal(isoWeekdayOfDateKey("2026-09-07"), 1);
    assert.equal(isoWeekdayOfDateKey("2026-09-13"), 7);
    assert.equal(isoWeekdayOfDateKey("2026-13-01"), null);
  });

  it("parseClockTime", () => {
    assert.equal(parseClockTime("00:00"), 0);
    assert.equal(parseClockTime("09:30"), 570);
    assert.equal(parseClockTime("24:00"), 1440);
    assert.equal(parseClockTime("24:30"), null);
    assert.equal(parseClockTime("9:30"), null);
  });
});
