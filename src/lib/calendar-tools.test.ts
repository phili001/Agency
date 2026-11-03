import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCalendarToolMetadata,
  buildGhlCalendarToolMetadata,
  getPinnedCalendar,
  hasLegacyGhlCalendarTools,
  isCalendarTool,
  parseCalendarTools,
  resolveCalendarForContact,
  resolveCalendarsForAgent,
} from "./calendar-tools.ts";

const assets = [
  { content: "Primera visita en Madrid", id: "tool-1", metadata: buildCalendarToolMetadata({ agendaId: "agenda-1", agendaName: "Madrid", isDefault: false }), title: "Madrid" },
  { content: "Videollamadas", id: "tool-2", metadata: buildCalendarToolMetadata({ agendaId: "agenda-2", agendaName: "Online", isDefault: true }), title: "Online" },
  { content: "", id: "tool-3", metadata: buildGhlCalendarToolMetadata({ calendarId: "KBt3", calendarName: "Consultoría Levi", isDefault: true }), title: "Consultoría Levi" },
  { content: "otra cosa", id: "tool-4", metadata: { type: "webhook" }, title: "Webhook" },
  { content: "", id: "tool-5", metadata: { agenda_id: " ", type: "agenda" }, title: "Rota" },
];

describe("tools de calendario", () => {
  it("lee el formato nuevo (agenda) y el viejo (GHL)", () => {
    const tools = parseCalendarTools(assets);
    assert.deepEqual(
      tools.map((tool) => [tool.id, tool.kind, tool.calendarId, tool.calendarName]),
      [
        ["tool-1", "agenda", "agenda-1", "Madrid"],
        ["tool-2", "agenda", "agenda-2", "Online"],
        ["tool-3", "ghl", "KBt3", "Consultoría Levi"],
      ],
    );
    assert.equal(isCalendarTool(assets[0].metadata), true);
    assert.equal(isCalendarTool(assets[2].metadata), true);
    assert.equal(isCalendarTool(assets[3].metadata), false);
    assert.equal(hasLegacyGhlCalendarTools(tools), true);
    assert.equal(hasLegacyGhlCalendarTools(tools.filter((tool) => tool.kind === "agenda")), false);
  });

  it("el agente solo ve sus agendas asignadas, la de por defecto primero", () => {
    const tools = parseCalendarTools(assets);
    const result = resolveCalendarsForAgent({ contactMetadata: {}, enabledToolIds: ["tool-1", "tool-2"], tools });
    assert.deepEqual(result.map((tool) => tool.id), ["tool-2", "tool-1"]);
    assert.deepEqual(resolveCalendarsForAgent({ contactMetadata: {}, enabledToolIds: [], tools }), []);
  });

  it("la agenda fijada por un flujo gana; la nueva sobre la vieja", () => {
    const tools = parseCalendarTools(assets);
    const pinnedNew = resolveCalendarsForAgent({
      contactMetadata: { booking_agenda_id: "agenda-1", booking_calendar_id: "KBt3" },
      enabledToolIds: ["tool-2"],
      tools,
    });
    assert.deepEqual(pinnedNew.map((tool) => tool.id), ["tool-1"]);

    const pinnedOld = resolveCalendarsForAgent({ contactMetadata: { booking_calendar_id: "KBt3" }, enabledToolIds: [], tools });
    assert.deepEqual(pinnedOld.map((tool) => [tool.id, tool.kind]), [["tool-3", "ghl"]]);

    const unknown = resolveCalendarsForAgent({ contactMetadata: { booking_agenda_id: "agenda-x" }, enabledToolIds: [], tools });
    assert.deepEqual(unknown.map((tool) => [tool.calendarId, tool.kind, tool.calendarName]), [["agenda-x", "agenda", "Agenda asignada"]]);

    // No se confunde un id de GHL con uno de agenda aunque coincidan.
    const sameId = resolveCalendarsForAgent({
      contactMetadata: { booking_agenda_id: "KBt3" },
      enabledToolIds: [],
      tools,
    });
    assert.equal(sameId[0].id, "");
  });

  it("agenda de un contacto: la fijada o la de por defecto", () => {
    const tools = parseCalendarTools(assets).filter((tool) => tool.kind === "agenda");
    assert.deepEqual(resolveCalendarForContact({ contactMetadata: null, tools }), { calendarId: "agenda-2", kind: "agenda" });
    assert.deepEqual(resolveCalendarForContact({ contactMetadata: { booking_agenda_id: "agenda-1" }, tools }), { calendarId: "agenda-1", kind: "agenda" });
    assert.deepEqual(getPinnedCalendar({ booking_calendar_id: " KBt3 " }), { calendarId: "KBt3", kind: "ghl" });
    assert.equal(getPinnedCalendar([] as unknown as null), null);
  });
});
