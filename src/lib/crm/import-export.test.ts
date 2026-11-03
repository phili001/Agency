import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { createContact, searchContacts } from "./contacts.ts";
import { csvSafe, csvUnsafe, parseCsv, parseCsvRecords, toCsv } from "./csv.ts";
import { createCustomField } from "./custom-fields.ts";
import { eraseContact } from "./erasure.ts";
import { CrmError } from "./errors.ts";
import { exportContacts, importContacts } from "./import-export.ts";
import type { CrmActor, CrmClient } from "./shared.ts";
import { addTagToContact, createTag } from "./tags.ts";

const A = "workspace-a";
const B = "workspace-b";
const operator: CrmActor = { kind: "operator", userId: "user-a" };

let fake: FakeSupabase;
let client: CrmClient;

function stages(workspaceId: string) {
  return ["Nuevo contacto", "Seguimiento", "Cliente"].map((name, position) => ({
    color: "#64748b",
    id: `${workspaceId}-stage-${position}`,
    kind: position === 2 ? "won" : "open",
    name,
    position,
    workspace_id: workspaceId,
  }));
}

beforeEach(() => {
  fake = createCrmFake({ crm_pipeline_stages: [...stages(A), ...stages(B)] });
  client = fake as unknown as CrmClient;
});

describe("csv", () => {
  it("parsea comillas, saltos de línea, BOM y punto y coma", () => {
    const text = '﻿nombre;telefono;notas\r\n"Pérez; Ana";+34600000001;"dice ""hola""\ny adiós"\r\n\r\n';
    assert.deepEqual(parseCsv(text), [
      ["nombre", "telefono", "notas"],
      ["Pérez; Ana", "+34600000001", 'dice "hola"\ny adiós'],
    ]);
  });

  it("anti-fórmulas de ida y vuelta, sin tocar apóstrofos de verdad", () => {
    assert.equal(csvSafe("=HYPERLINK()"), "'=HYPERLINK()");
    assert.equal(csvSafe("+34600"), "'+34600");
    assert.equal(csvUnsafe("'+34600"), "+34600");
    assert.equal(csvUnsafe("O'Connor"), "O'Connor");
    assert.equal(csvUnsafe("'Hola"), "'Hola");
  });

  it("toCsv y parseCsvRecords son inversos", () => {
    const csv = toCsv(["Nombre", "Telefono"], [["Ana, la de \"arriba\"", "+34600000001"]]);
    assert.ok(csv.startsWith("﻿"));
    assert.deepEqual(parseCsvRecords(csv).records, [{ nombre: 'Ana, la de "arriba"', telefono: "+34600000001" }]);
  });
});

describe("importar", () => {
  it("crea, actualiza, normaliza y explica lo que salta", async () => {
    await createContact(client, A, { fullName: "Existente", phone: "+34600000002" }, operator);
    await createCustomField(client, A, { label: "Presupuesto", type: "money" });
    const csv = [
      "Nombre,Teléfono,Email,Empresa,Etapa,Etiquetas,cf_presupuesto",
      "Ana,+34 600 000 001,ana@x.com,Ana SL,Seguimiento,VIP;Madrid,1200",
      ",0034600000002,,,,VIP,",
      "Sin tel,,,,,,",
      "Malo,600,,,,,",
      "Correo,+34600000003,no-es-correo,,,,",
      "Etapa rara,+34600000004,,,Inventada,,",
      "Presupuesto raro,+34600000005,,,,,mucho",
      "Duplicado,+34600000001,,,,,",
    ].join("\n");

    const result = await importContacts(client, A, csv, operator);
    assert.equal(result.created, 1);
    assert.equal(result.updated, 1);
    assert.equal(result.skipped, 6);
    assert.equal(result.errors.length, 6);
    assert.match(result.errors.join("\n"), /Fila 4: sin teléfono/);
    assert.match(result.errors.join("\n"), /Inventada/);

    const ana = (await searchContacts(client, A, { query: "Ana" })).contacts[0];
    assert.equal(ana.phone_e164, "+34600000001");
    assert.equal(ana.source, "import");
    assert.equal(ana.stage?.name, "Seguimiento");
    assert.deepEqual(ana.custom_fields, { presupuesto: 1200 });
    assert.deepEqual(ana.tags.map((tag) => tag.name).sort(), ["Madrid", "VIP"]);

    const existing = (await searchContacts(client, A, { query: "Existente" })).contacts[0];
    assert.equal(existing.full_name, "Existente"); // el nombre vacío no borra
    assert.deepEqual(existing.tags.map((tag) => tag.name), ["VIP"]);
  });

  it("sin columna de teléfono o demasiado grande", async () => {
    await assert.rejects(importContacts(client, A, "nombre\nAna", operator), (error) => error instanceof CrmError);
    await assert.rejects(importContacts(client, A, `telefono\n${"x".repeat(5 * 1024 * 1024)}`, operator), (error) => error instanceof CrmError);
  });

  it("exportar y volver a importar no duplica", async () => {
    const contact = await createContact(client, A, { email: "a@x.com", fullName: "=Peligro", phone: "+34600000009" }, operator);
    const tag = await createTag(client, A, { name: "VIP" });
    await addTagToContact(client, A, contact.id, tag.id, operator);

    const csv = await exportContacts(client, A);
    assert.match(csv, /'=Peligro/);
    assert.match(csv, /'\+34600000009/);

    const result = await importContacts(client, A, csv, operator);
    assert.equal(result.created, 0);
    assert.equal(result.updated, 1);
    assert.equal(fake.tables.contacts.filter((row) => row.workspace_id === A).length, 1);
    assert.equal(fake.tables.contacts[0].full_name, "=Peligro");
  });

  it("importar en A no toca contactos de B con el mismo teléfono", async () => {
    await createContact(client, B, { fullName: "De B", phone: "+34600000001" }, operator);
    const result = await importContacts(client, A, "telefono,nombre\n+34600000001,De A", operator);
    assert.equal(result.created, 1);
    assert.equal(fake.tables.contacts.find((row) => row.workspace_id === B)?.full_name, "De B");
    assert.ok(!(await exportContacts(client, A)).includes("De B"));
  });
});

describe("borrado RGPD", () => {
  it("borra todo lo del contacto y apunta sus eventos de Google", async () => {
    const contact = await createContact(client, A, { phone: "+34600000020" }, operator);
    const other = await createContact(client, A, { phone: "+34600000021" }, operator);
    fake.table("agendas").push(
      { google_calendar_id: "cal-1", id: "agenda-1", workspace_id: A },
      { google_calendar_id: null, id: "agenda-2", workspace_id: A },
    );
    fake.table("appointments").push(
      { agenda_id: "agenda-1", contact_id: contact.id, google_event_id: "evt-1", id: "ap-1", workspace_id: A },
      { agenda_id: "agenda-2", contact_id: contact.id, google_event_id: "evt-2", id: "ap-2", workspace_id: A },
      { agenda_id: "agenda-1", contact_id: contact.id, google_event_id: null, id: "ap-3", workspace_id: A },
      { agenda_id: "agenda-1", contact_id: other.id, google_event_id: "evt-other", id: "ap-4", workspace_id: A },
    );
    fake.table("messages").push(
      { body: "hola", contact_id: contact.id, id: "m1", workspace_id: A },
      { body: "otro", contact_id: other.id, id: "m2", workspace_id: A },
    );
    fake.table("flow_events").push({ contact_id: contact.id, id: "f1", workspace_id: A });

    const result = await eraseContact(client, A, contact.id);
    assert.equal(result.googleEventsQueued, 1); // la agenda sin calendario no tiene evento que borrar
    assert.deepEqual(fake.table("google_event_deletions").map((row) => row.google_event_id), ["evt-1"]);
    assert.ok(!fake.tables.contacts.some((row) => row.id === contact.id));
    assert.deepEqual(fake.table("messages").map((row) => row.id), ["m2"]);
    assert.equal(fake.table("flow_events").length, 0);
    assert.deepEqual(fake.table("appointments").map((row) => row.id), ["ap-4"]);
  });

  it("A no puede borrar un contacto de B", async () => {
    const contactB = await createContact(client, B, { phone: "+34600000030" }, operator);
    fake.table("messages").push({ body: "de B", contact_id: contactB.id, id: "mb", workspace_id: B });
    await assert.rejects(eraseContact(client, A, contactB.id), (error) => error instanceof CrmError && error.code === "not_found");
    assert.ok(fake.tables.contacts.some((row) => row.id === contactB.id));
    assert.equal(fake.table("messages").length, 1);
  });
});
