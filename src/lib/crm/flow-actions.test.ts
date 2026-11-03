import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  type FlowGhlAction,
  convertGhlActionToCrm,
  defaultLevyFlowSteps,
  flowMatchesTags,
  splitStepActions,
} from "../flow-definitions.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { createContact } from "./contacts.ts";
import { createCustomField } from "./custom-fields.ts";
import { renderFlowTemplate, runCrmFlowActions } from "./flow-actions.ts";
import type { CrmClient } from "./shared.ts";
import { createTag } from "./tags.ts";

const A = "workspace-a";
const B = "workspace-b";

let fake: FakeSupabase;
let client: CrmClient;

beforeEach(() => {
  fake = createCrmFake({
    crm_pipeline_stages: [
      { color: "#64748b", id: "stage-new", kind: "open", name: "Nuevo contacto", position: 0, workspace_id: A },
      { color: "#64748b", id: "stage-client", kind: "won", name: "Cliente", position: 1, workspace_id: A },
      { color: "#64748b", id: "stage-b", kind: "open", name: "Cliente", position: 0, workspace_id: B },
    ],
  });
  client = fake as unknown as CrmClient;
});

describe("definiciones", () => {
  it("convierte acciones de GHL que tienen equivalente", () => {
    const actions: FlowGhlAction[] = [
      { label: "Tag", tag: " vip ", type: "add_tag" },
      { label: "Campo", customFieldKey: "presupuesto", customFieldValue: "{{monto}}", type: "update_contact_field" },
      { label: "Tarea", taskTitle: "Llamar", type: "create_task" },
      { label: "Oportunidad", pipelineId: "p", stageId: "s", type: "upsert_opportunity" },
      { calendarId: "KBt3", label: "Calendario", type: "set_booking_calendar" },
    ];
    assert.deepEqual(actions.map(convertGhlActionToCrm), [
      { engine: "crm", label: "Tag", tagName: "vip", type: "add_tag" },
      { engine: "crm", fieldKey: "presupuesto", fieldValue: "{{monto}}", label: "Campo", type: "update_contact_field" },
      { engine: "crm", label: "Tarea", taskTitle: "Llamar", type: "create_task" },
      null,
      null,
    ]);
  });

  it("separa acciones del CRM y viejas de GHL", () => {
    const { crm, legacy } = splitStepActions([
      { engine: "crm", label: "x", type: "add_note" },
      { label: "y", tag: "t", type: "add_tag" },
      null,
    ]);
    assert.equal(crm.length, 1);
    assert.equal(legacy.length, 1);
    assert.deepEqual(splitStepActions(undefined), { crm: [], legacy: [] });
  });

  it("la plantilla de Levy ya usa acciones del CRM", () => {
    const step = defaultLevyFlowSteps.find((item) => item.id === "tag_diagnostico");
    assert.equal(step?.type, "crm_action");
    assert.equal(splitStepActions(step?.actions).crm.length, 1);
  });

  it("disparo por etiqueta: por id o por nombre sin mayúsculas", () => {
    const tags = [{ id: "t1", name: "Cliente VIP" }];
    assert.equal(flowMatchesTags({ tagId: "t1" }, tags), true);
    assert.equal(flowMatchesTags({ tag: "cliente vip " }, tags), true);
    assert.equal(flowMatchesTags({ tag: "otra" }, tags), false);
    assert.equal(flowMatchesTags({}, tags), false);
    assert.equal(flowMatchesTags(null, tags), false);
  });

  it("plantillas {{respuesta}}", () => {
    assert.equal(renderFlowTemplate("Hola {{nombre}}, {{falta}}.", { nombre: "Ana" }), "Hola Ana, .");
  });
});

describe("acciones del CRM en un flujo", () => {
  it("etiqueta (crea si no existe), etapa, campo, tarea, nota y agenda", async () => {
    const contact = await createContact(client, A, { phone: "+34600000001" }, { kind: "operator" });
    await createCustomField(client, A, { label: "Presupuesto", type: "money" });
    fake.table("agendas").push({ id: "agenda-1", name: "Madrid", workspace_id: A });

    const { addedTagIds, results } = await runCrmFlowActions(
      client,
      A,
      contact.id,
      [
        { engine: "crm", label: "", tagName: "Interesado", type: "add_tag" },
        { engine: "crm", label: "", stageName: "cliente", type: "set_stage" },
        { engine: "crm", fieldKey: "presupuesto", fieldValue: "{{monto}}", label: "", type: "update_contact_field" },
        { engine: "crm", fieldKey: "full_name", fieldValue: "{{nombre}}", label: "", type: "update_contact_field" },
        { engine: "crm", label: "", taskDueInDays: 2, taskTitle: "Llamar a {{nombre}}", type: "create_task" },
        { engine: "crm", label: "", noteBody: "Viene de un flujo", type: "add_note" },
        { agendaId: "agenda-1", engine: "crm", label: "", type: "set_booking_agenda" },
      ],
      { monto: "1500", nombre: "Ana" },
    );

    assert.ok(results.every((result) => result.ok), JSON.stringify(results));
    assert.equal(addedTagIds.length, 1);
    const row = fake.table("contacts")[0];
    assert.equal(row.stage_id, "stage-client");
    assert.deepEqual(row.custom_fields, { presupuesto: 1500 });
    assert.equal(row.full_name, "Ana");
    assert.equal((row.metadata as Record<string, unknown>).booking_agenda_id, "agenda-1");
    assert.equal(fake.table("crm_contact_tasks")[0].title, "Llamar a Ana");
    assert.ok(fake.table("crm_contact_activity").every((entry) => ["flow", "operator"].includes(String(entry.actor))));
  });

  it("volver a poner una etiqueta no la cuenta como nueva (no relanza flujos)", async () => {
    const contact = await createContact(client, A, { phone: "+34600000002" }, { kind: "operator" });
    const tag = await createTag(client, A, { name: "VIP" });
    const first = await runCrmFlowActions(client, A, contact.id, [{ engine: "crm", label: "", tagId: tag.id, type: "add_tag" }]);
    const second = await runCrmFlowActions(client, A, contact.id, [{ engine: "crm", label: "", tagId: tag.id, type: "add_tag" }]);
    assert.deepEqual(first.addedTagIds, [tag.id]);
    assert.deepEqual(second.addedTagIds, []);
  });

  it("una acción que falla no para las demás", async () => {
    const contact = await createContact(client, A, { phone: "+34600000003" }, { kind: "operator" });
    const { results } = await runCrmFlowActions(client, A, contact.id, [
      { engine: "crm", label: "", stageName: "Inventada", type: "set_stage" },
      { engine: "crm", label: "", noteBody: "sigue", type: "add_note" },
    ]);
    assert.equal(results[0].ok, false);
    assert.match(String(results[0].error), /no existe/);
    assert.equal(results[1].ok, true);
  });

  it("no toca datos de otra empresa", async () => {
    const contactA = await createContact(client, A, { phone: "+34600000004" }, { kind: "operator" });
    const tagB = await createTag(client, B, { name: "De B" });
    fake.table("agendas").push({ id: "agenda-b", name: "B", workspace_id: B });
    const { results } = await runCrmFlowActions(client, A, contactA.id, [
      { engine: "crm", label: "", tagId: tagB.id, type: "add_tag" },
      { engine: "crm", label: "", stageId: "stage-b", type: "set_stage" },
      { agendaId: "agenda-b", engine: "crm", label: "", type: "set_booking_agenda" },
    ]);
    assert.ok(results.every((result) => !result.ok));
    assert.equal(fake.table("crm_contact_tags").length, 0);
    assert.equal(fake.table("contacts").find((row) => row.id === contactA.id)?.stage_id, null);

    const contactB = await createContact(client, B, { phone: "+34600000005" }, { kind: "operator" });
    const crossed = await runCrmFlowActions(client, A, contactB.id, [{ engine: "crm", label: "", noteBody: "x", type: "add_note" }]);
    assert.equal(crossed.results[0].ok, false);
  });
});
