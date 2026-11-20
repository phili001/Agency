import assert from "node:assert/strict";
import { test } from "node:test";

import { FOUNDERS_MONTHLY_EUR, FOUNDERS_YEARLY_EUR, foundersStatus } from "./founders.ts";

// En noviembre Madrid va en UTC+1.
test("antes del 27 en Madrid: todavía no abre", () => {
  assert.equal(foundersStatus(new Date("2026-11-18T10:00:00Z")), "soon");
  assert.equal(foundersStatus(new Date("2026-11-26T22:59:59Z")), "soon");
});

test("todo el 27 en hora de Madrid: abierta", () => {
  assert.equal(foundersStatus(new Date("2026-11-26T23:00:00Z")), "open");
  assert.equal(foundersStatus(new Date("2026-11-27T22:59:59Z")), "open");
});

test("desde el 28 en Madrid: cerrada", () => {
  assert.equal(foundersStatus(new Date("2026-11-27T23:00:00Z")), "closed");
  assert.equal(foundersStatus(new Date("2027-01-10T12:00:00Z")), "closed");
});

test("el anual ahorra dos meses frente al mensual", () => {
  assert.equal(FOUNDERS_MONTHLY_EUR * 12 - FOUNDERS_YEARLY_EUR, FOUNDERS_MONTHLY_EUR * 2);
});
