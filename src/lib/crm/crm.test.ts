import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { createContact, getContactCard, searchContacts, updateContact, upsertContactByPhone } from "./contacts.ts";
import { createCustomField } from "./custom-fields.ts";
import { CrmError } from "./errors.ts";
import { addNote, deleteNote, listNotes } from "./notes.ts";
import type { CrmActor, CrmClient } from "./shared.ts";
import { deleteStage, listStages, reorderStages, setContactStage } from "./stages.ts";
import { addTagToContact, createTag, deleteTag, removeTagFromContact, updateTag } from "./tags.ts";
import { createTask, setTaskCompleted } from "./tasks.ts";

const A = "workspace-a";
const B = "workspace-b";
const operator: CrmActor = { kind: "operator", userId: "user-a" };

const STAGE_NAMES: Array<[string, string]> = [
  ["Nuevo contacto", "open"],
  ["Solicitud de presupuesto", "open"],
  ["Seguimiento", "open"],
  ["Cliente", "won"],
  ["Perdido", "lost"],
  ["No cualifica", "lost"],
];

function seedStages(workspaceId: string) {
  return STAGE_NAMES.map(([name, kind], position) => ({
    color: "#64748b",
    id: `${workspaceId}-stage-${position}`,
    kind,
    name,
    position,
    workspace_id: workspaceId,
  }));
}

let fake: FakeSupabase;
let client: CrmClient;

function expectCode(code: CrmError["code"]) {
  return (error: unknown) => error instanceof CrmError && error.code === code;
}

beforeEach(() => {
  fake = createCrmFake({
    contacts: [],
    crm_pipeline_stages: [...seedStages(A), ...seedStages(B)],
    workspace_members: [
      { role: "owner", user_id: "user-a", workspace_id: A },
      { role: "owner", user_id: "user-b", workspace_id: B },
    ],
  });
  client = fake as unknown as CrmClient;
});

describe("contactos", () => {
  it("crea, normaliza y rechaza teléfonos repetidos", async () => {
    const contact = await createContact(client, A, { email: "Ana@X.com", fullName: " Ana  ", phone: "+34 600 000 001" }, operator);
    assert.equal(contact.phone_e164, "+34600000001");
    assert.equal(contact.email, "ana@x.com");
    assert.equal(contact.full_name, "Ana");
    assert.equal(contact.source, "manual");
    await assert.rejects(createContact(client, A, { phone: "0034600000001" }, operator), expectCode("conflict"));
    // El mismo teléfono en otra empresa es otro contacto.
    await createContact(client, B, { phone: "+34600000001" }, operator);
    await assert.rejects(createContact(client, A, { phone: "600000001" }, operator), expectCode("invalid"));
  });

  it("upsert por teléfono no pisa datos y solo rellena vacíos", async () => {
    const first = await upsertContactByPhone(client, A, { fullName: "Ana", phone: "+34600000002", source: "stripe" }, operator);
    assert.equal(first.created, true);
    const second = await upsertContactByPhone(
      client,
      A,
      { company: "Ana SL", fullName: "Otra", phone: "+34600000002", source: "stripe" },
      operator,
    );
    assert.equal(second.created, false);
    assert.equal(second.contact.full_name, "Ana");
    assert.equal(second.contact.company, "Ana SL");
  });

  it("campos personalizados validados al editar", async () => {
    await createCustomField(client, A, { label: "Presupuesto", type: "money" });
    const contact = await createContact(client, A, { phone: "+34600000003" }, operator);
    const updated = await updateContact(client, A, contact.id, { customFields: { presupuesto: "1500,5" } }, operator);
    assert.deepEqual(updated.custom_fields, { presupuesto: 1500.5 });
    await assert.rejects(
      updateContact(client, A, contact.id, { customFields: { presupuesto: "mucho" } }, operator),
      expectCode("invalid"),
    );
    await assert.rejects(
      updateContact(client, A, contact.id, { customFields: { inventado: 1 } }, operator),
      expectCode("invalid"),
    );
  });

  it("busca, filtra y pagina", async () => {
    for (let i = 0; i < 30; i += 1) {
      await createContact(client, A, { fullName: i % 2 ? `Impar ${i}` : `Par ${i}`, phone: `+3460000${String(i).padStart(4, "0")}` }, operator);
    }
    const page = await searchContacts(client, A, { page: 2, pageSize: 10 });
    assert.equal(page.total, 30);
    assert.equal(page.contacts.length, 10);
    const odd = await searchContacts(client, A, { query: "impar", pageSize: 100 });
    assert.equal(odd.total, 15);
    assert.ok(odd.contacts.every((contact) => contact.full_name?.startsWith("Impar")));
    // Sin etapa = primera abierta: aparecen al filtrar por «Nuevo contacto».
    const firstStage = await searchContacts(client, A, { pageSize: 100, stageId: `${A}-stage-0` });
    assert.equal(firstStage.total, 30);
    assert.equal(firstStage.contacts[0].stage?.name, "Nuevo contacto");
  });
});

describe("etapas", () => {
  it("cambia de etapa y lo apunta en la actividad", async () => {
    const contact = await createContact(client, A, { phone: "+34600000010" }, operator);
    const result = await setContactStage(client, A, contact.id, `${A}-stage-3`, operator);
    assert.equal(result.changed, true);
    const again = await setContactStage(client, A, contact.id, `${A}-stage-3`, operator);
    assert.equal(again.changed, false);
    const card = await getContactCard(client, A, contact.id);
    assert.equal(card.stage?.name, "Cliente");
    assert.ok(card.activity.some((entry) => entry.kind === "stage_changed"));
  });

  it("no deja borrar la última etapa abierta y reordena con todas", async () => {
    await deleteStage(client, A, `${A}-stage-0`);
    await deleteStage(client, A, `${A}-stage-1`);
    await assert.rejects(deleteStage(client, A, `${A}-stage-2`), expectCode("invalid"));
    const ids = (await listStages(client, A)).map((stage) => stage.id).reverse();
    await reorderStages(client, A, ids);
    assert.deepEqual((await listStages(client, A)).map((stage) => stage.id), ids);
    await assert.rejects(reorderStages(client, A, ids.slice(1)), expectCode("invalid"));
  });
});

describe("etiquetas, notas y tareas", () => {
  it("etiqueta una vez y avisa si ya la tenía", async () => {
    const contact = await createContact(client, A, { phone: "+34600000020" }, operator);
    const tag = await createTag(client, A, { color: "#FF0000", name: "VIP" });
    assert.equal(tag.color, "#ff0000");
    await assert.rejects(createTag(client, A, { name: "vip" }), expectCode("conflict"));
    assert.equal((await addTagToContact(client, A, contact.id, tag.id, operator)).added, true);
    assert.equal((await addTagToContact(client, A, contact.id, tag.id, operator)).added, false);
    assert.equal((await searchContacts(client, A, { tagId: tag.id })).total, 1);
    assert.equal((await removeTagFromContact(client, A, contact.id, tag.id, operator)).removed, true);
    assert.equal((await removeTagFromContact(client, A, contact.id, tag.id, operator)).removed, false);
    await assert.rejects(createTag(client, A, { name: "onboarding_eligible" }), expectCode("invalid"));
  });

  it("notas y tareas con su actividad", async () => {
    const contact = await createContact(client, A, { phone: "+34600000021" }, operator);
    const note = await addNote(client, A, contact.id, "Prefiere tardes", operator);
    assert.equal((await listNotes(client, A, contact.id)).length, 1);
    await deleteNote(client, A, note.id);
    const task = await createTask(client, A, contact.id, { assignedTo: "user-a", dueAt: "2026-12-01T10:00:00Z", title: "Llamar" }, operator);
    assert.equal(task.created_by, "operator");
    await assert.rejects(
      createTask(client, A, contact.id, { assignedTo: "user-b", title: "x" }, operator),
      expectCode("invalid"),
    );
    const done = await setTaskCompleted(client, A, task.id, true, operator);
    assert.ok(done.completed_at);
    const kinds = (await getContactCard(client, A, contact.id)).activity.map((entry) => entry.kind);
    assert.ok(kinds.includes("note_added") && kinds.includes("task_created") && kinds.includes("task_completed"));
  });
});

describe("aislamiento entre empresas", () => {
  async function seed() {
    const contactA = await createContact(client, A, { fullName: "De A", phone: "+34600000100" }, operator);
    const contactB = await createContact(client, B, { fullName: "De B", phone: "+34600000200" }, { kind: "operator", userId: "user-b" });
    const tagA = await createTag(client, A, { name: "Solo A" });
    const tagB = await createTag(client, B, { name: "Solo B" });
    const noteB = await addNote(client, B, contactB.id, "Privada de B", { kind: "operator", userId: "user-b" });
    const taskB = await createTask(client, B, contactB.id, { title: "Tarea de B" }, { kind: "operator", userId: "user-b" });
    return { contactA, contactB, noteB, tagA, tagB, taskB };
  }

  it("A no ve contactos de B ni al buscar ni al abrir la ficha", async () => {
    const { contactB } = await seed();
    const all = await searchContacts(client, A, { pageSize: 100 });
    assert.deepEqual(all.contacts.map((contact) => contact.full_name), ["De A"]);
    assert.equal((await searchContacts(client, A, { query: "De B" })).total, 0);
    await assert.rejects(getContactCard(client, A, contactB.id), expectCode("not_found"));
  });

  it("A no puede modificar contactos, etiquetas, notas ni tareas de B", async () => {
    const { contactA, contactB, noteB, tagA, tagB, taskB } = await seed();
    await assert.rejects(updateContact(client, A, contactB.id, { fullName: "Hackeado" }, operator), expectCode("not_found"));
    await assert.rejects(addTagToContact(client, A, contactB.id, tagA.id, operator), expectCode("not_found"));
    await assert.rejects(addTagToContact(client, A, contactA.id, tagB.id, operator), expectCode("not_found"));
    await assert.rejects(updateTag(client, A, tagB.id, { name: "x" }), expectCode("not_found"));
    await assert.rejects(deleteTag(client, A, tagB.id), expectCode("not_found"));
    await assert.rejects(setContactStage(client, A, contactA.id, `${B}-stage-3`, operator), expectCode("not_found"));
    await assert.rejects(setContactStage(client, A, contactB.id, `${A}-stage-3`, operator), expectCode("not_found"));
    await assert.rejects(addNote(client, A, contactB.id, "x", operator), expectCode("not_found"));
    await assert.rejects(deleteNote(client, A, noteB.id), expectCode("not_found"));
    await assert.rejects(setTaskCompleted(client, A, taskB.id, true, operator), expectCode("not_found"));
    await assert.rejects(searchContacts(client, A, { stageId: `${B}-stage-0` }), expectCode("not_found"));
    await assert.rejects(createContact(client, A, { phone: "+34600000300", stageId: `${B}-stage-0` }, operator), expectCode("not_found"));

    // Nada de B cambió.
    const contactRow = fake.tables.contacts.find((row) => row.id === contactB.id);
    assert.equal(contactRow?.full_name, "De B");
    assert.equal(fake.tables.crm_tags.filter((row) => row.workspace_id === B).length, 1);
    assert.equal(fake.tables.crm_contact_notes.filter((row) => row.workspace_id === B).length, 1);
    assert.ok(!fake.tables.crm_contact_tasks.find((row) => row.id === taskB.id)?.completed_at);
    assert.equal(fake.tables.crm_contact_tags?.length ?? 0, 0);
  });

  it("toda consulta lleva al menos un filtro (workspace_id)", async () => {
    await seed();
    await searchContacts(client, A, { query: "x" });
    const unfiltered = fake.log.filter((entry) => entry.mode !== "insert" && entry.filters === 0);
    assert.deepEqual(unfiltered, []);
  });
});

describe("mensaje entrante (ycloud-webhook)", () => {
  it("apunta último mensaje y origen, y actividad solo en los hitos", async () => {
    const { recordInboundMessage } = await import("./contacts.ts");
    fake.table("contacts").push({ id: "c-new", phone_e164: "+34600000500", source: null, workspace_id: A });
    fake.table("contacts").push({ id: "c-import", phone_e164: "+34600000501", source: "import", workspace_id: A });
    const at = new Date("2026-09-07T10:00:00Z");

    await recordInboundMessage(client, A, "c-new", { at, newContact: true, newConversation: true });
    await recordInboundMessage(client, A, "c-new", { at, newContact: false, newConversation: false });
    await recordInboundMessage(client, A, "c-import", { at, newContact: false, newConversation: true });

    const rows = fake.table("contacts");
    assert.equal(rows.find((row) => row.id === "c-new")?.source, "whatsapp");
    assert.equal(rows.find((row) => row.id === "c-new")?.last_message_at, at.toISOString());
    assert.equal(rows.find((row) => row.id === "c-import")?.source, "import");
    assert.deepEqual(
      fake.table("crm_contact_activity").map((row) => `${row.contact_id}:${row.kind}`),
      ["c-new:contact_created", "c-import:message_received"],
    );
  });

  it("no toca el contacto de otra empresa", async () => {
    const { recordInboundMessage } = await import("./contacts.ts");
    fake.table("contacts").push({ id: "c-b", phone_e164: "+34600000600", source: null, workspace_id: B });
    await recordInboundMessage(client, A, "c-b", { at: new Date(), newContact: false, newConversation: false });
    assert.equal(fake.table("contacts").find((row) => row.id === "c-b")?.source, null);
    assert.equal(fake.table("contacts").find((row) => row.id === "c-b")?.last_message_at, undefined);
  });
});
