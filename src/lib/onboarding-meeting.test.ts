import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatMeetingWhen,
  getBookedMeeting,
  isMeetingPast,
} from "./onboarding-meeting.ts";

describe("reunión de puesta en marcha", () => {
  it("lee la reunión guardada en onboarding_state", () => {
    const meeting = getBookedMeeting({
      meeting: {
        appointmentId: "evt_1",
        bookedAt: "2026-10-19T09:00:00.000Z",
        email: "ana@example.com",
        phone: "+34600112233",
        startTime: "2026-10-23T08:00:00.000Z",
        timezone: "Europe/Madrid",
      },
    });

    assert.equal(meeting?.appointmentId, "evt_1");
    assert.equal(meeting?.timezone, "Europe/Madrid");
    assert.equal(meeting?.email, "ana@example.com");
    assert.equal(getBookedMeeting({ meeting: { appointmentId: "a", startTime: "2026-10-23T08:00:00.000Z" } })?.email, "");
    // El teléfono vuelve con la reunión: al cambiar la hora no se vuelve a pedir.
    assert.equal(meeting?.phone, "+34600112233");
  });

  it("descarta lo que no sea una reunión completa", () => {
    assert.equal(getBookedMeeting(null), null);
    assert.equal(getBookedMeeting({ meeting: { appointmentId: "evt_1" } }), null);
    assert.equal(
      getBookedMeeting({ meeting: { appointmentId: "evt_1", startTime: "mañana" } }),
      null,
    );
  });

  it("escribe la fecha en la zona del cliente", () => {
    const when = formatMeetingWhen("2026-10-23T08:00:00.000Z", "Europe/Madrid");
    assert.match(when, /viernes, 23 de octubre a las 10:00/);
    // Misma hora real, otra zona: el cliente ve su hora local.
    assert.match(formatMeetingWhen("2026-10-23T08:00:00.000Z", "America/Bogota"), /03:00/);
  });

  it("sabe si la reunión ya pasó", () => {
    const meeting = {
      appointmentId: "evt_1",
      bookedAt: "",
      email: "",
      phone: "+34600112233",
      startTime: "2026-10-23T08:00:00.000Z",
      timezone: "Europe/Madrid",
    };

    assert.equal(isMeetingPast(meeting, new Date("2026-10-23T07:00:00.000Z")), false);
    assert.equal(isMeetingPast(meeting, new Date("2026-10-24T07:00:00.000Z")), true);
    assert.equal(isMeetingPast(null), false);
  });
});
