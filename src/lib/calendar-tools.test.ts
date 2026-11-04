import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCalendarToolMetadata,
  getPinnedCalendar,
  isCalendarTool,
  parseCalendarTools,
  resolveCalendarForContact,
  resolveCalendarsForAgent,
} from "./calendar-tools.ts";

const assets = [
  { content: "Primera visita en Madrid", id: "tool-1", metadata: buildCalendarToolMetadata({ agendaId: "agenda-1", agendaName: "Madrid", isDefault: false }), title: "Madrid" },
  { content: "Videollamadas", id: "tool-2", metadata: buildCalendarToolMetadata({ agendaId: "agenda-2", agendaName: "Online", isDefault: true }), title: "Online" },
  { content: "otra cosa", id: "tool-4", metadata: { type: "webhook" }, title: "Webhook" },
  { content: "", id: "tool-5", metadata: { agenda_id: " ", type: "agenda" }, title: "Rota" },
];

describe("tools de calendario", () => {
  it("lee las tools de agenda e ignora las demás", () => {
    const tools = parseCalendarTools(assets);
    assert.deepEqual(
      tools.map((tool) => [tool.id, tool.calendarId, tool.calendarName]),
      [
        ["tool-1", "agenda-1", "Madrid"],
        ["tool-2", "agenda-2", "Online"],
      ],
    );
    assert.equal(isCalendarTool(assets[0].metadata), true);
    assert.equal(isCalendarTool(assets[2].metadata), false);
  });

  it("el agente solo ve sus agendas asignadas, la de por defecto primero", () => {
    const tools = parseCalendarTools(assets);
    const result = resolveCalendarsForAgent({ contactMetadata: {}, enabledToolIds: ["tool-1", "tool-2"], tools });
    assert.deepEqual(result.map((tool) => tool.id), ["tool-2", "tool-1"]);
    assert.deepEqual(resolveCalendarsForAgent({ contactMetadata: {}, enabledToolIds: [], tools }), []);
  });

  it("la agenda fijada por un flujo gana", () => {
    const tools = parseCalendarTools(assets);
    const pinnedNew = resolveCalendarsForAgent({
      contactMetadata: { booking_agenda_id: "agenda-1" },
      enabledToolIds: ["tool-2"],
      tools,
    });
    assert.deepEqual(pinnedNew.map((tool) => tool.id), ["tool-1"]);

    const unknown = resolveCalendarsForAgent({ contactMetadata: { booking_agenda_id: "agenda-x" }, enabledToolIds: [], tools });
    assert.deepEqual(unknown.map((tool) => [tool.calendarId, tool.calendarName]), [["agenda-x", "Agenda asignada"]]);
  });

  it("agenda de un contacto: la fijada o la de por defecto", () => {
    const tools = parseCalendarTools(assets);
    assert.deepEqual(resolveCalendarForContact({ contactMetadata: null, tools }), { calendarId: "agenda-2" });
    assert.deepEqual(resolveCalendarForContact({ contactMetadata: { booking_agenda_id: "agenda-1" }, tools }), { calendarId: "agenda-1" });
    assert.deepEqual(getPinnedCalendar({ booking_agenda_id: " agenda-1 " }), { calendarId: "agenda-1" });
    assert.equal(getPinnedCalendar({ booking_calendar_id: "KBt3" }), null);
    assert.equal(getPinnedCalendar([] as unknown as null), null);
  });
});
