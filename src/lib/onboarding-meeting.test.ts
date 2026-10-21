import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatMeetingWhen,
  getBookedMeeting,
  isMeetingPast,
  isScopeError,
  resolveMeetingCredentials,
} from "./onboarding-meeting.ts";

describe("reunión de puesta en marcha", () => {
  it("lee la reunión guardada en onboarding_state", () => {
    const meeting = getBookedMeeting({
      meeting: {
        appointmentId: "evt_1",
        bookedAt: "2026-10-19T09:00:00.000Z",
        phone: "+34600112233",
        startTime: "2026-10-23T08:00:00.000Z",
        timezone: "Europe/Madrid",
      },
    });

    assert.equal(meeting?.appointmentId, "evt_1");
    assert.equal(meeting?.timezone, "Europe/Madrid");
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
      phone: "+34600112233",
      startTime: "2026-10-23T08:00:00.000Z",
      timezone: "Europe/Madrid",
    };

    assert.equal(isMeetingPast(meeting, new Date("2026-10-23T07:00:00.000Z")), false);
    assert.equal(isMeetingPast(meeting, new Date("2026-10-24T07:00:00.000Z")), true);
    assert.equal(isMeetingPast(null), false);
  });

  it("usa las claves propias del calendario de onboarding", () => {
    assert.deepEqual(
      resolveMeetingCredentials({
        GHL_AGENCY_LOCATION_ID: "loc_agencia",
        GHL_AGENCY_TOKEN: "pit-agencia",
        LEVY_MEETING_CALENDAR_ID: "cal_onboarding",
        LEVY_MEETING_GHL_LOCATION_ID: "loc_onboarding",
        LEVY_MEETING_GHL_TOKEN: "pit-onboarding",
      }),
      {
        calendarId: "cal_onboarding",
        locationId: "loc_onboarding",
        source: "LEVY_MEETING_GHL_TOKEN",
        token: "pit-onboarding",
      },
    );
  });

  it("hereda token y location del GoHighLevel de la agencia", () => {
    assert.deepEqual(
      resolveMeetingCredentials({
        GHL_AGENCY_LOCATION_ID: "loc_agencia",
        GHL_AGENCY_TOKEN: "pit-agencia",
        LEVY_MEETING_CALENDAR_ID: " cal_onboarding ",
      }),
      {
        calendarId: "cal_onboarding",
        locationId: "loc_agencia",
        source: "GHL_AGENCY_TOKEN",
        token: "pit-agencia",
      },
    );
  });

  it("sin id de calendario no hay reunión que agendar", () => {
    assert.equal(resolveMeetingCredentials({ LEVY_MEETING_CALENDAR_ID: "   " }).calendarId, "");
    assert.equal(resolveMeetingCredentials({}).calendarId, "");
  });

  it("reconoce el rechazo de GoHighLevel por permisos", () => {
    assert.equal(isScopeError(new Error("The token is not authorized for this scope.")), true);
    assert.equal(isScopeError(new Error("GHL 401: unauthorized")), true);
    assert.equal(isScopeError(new Error("fetch failed")), false);
  });

  it("sin token propio ni de agencia, el origen es la conexión de AAA001", () => {
    assert.equal(resolveMeetingCredentials({ LEVY_MEETING_CALENDAR_ID: "cal" }).source, "AAA001");
  });
});
