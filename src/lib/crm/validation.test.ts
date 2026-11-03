import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type CustomFieldDefinition,
  describeAiReadableFields,
  mergeCustomFieldValues,
  slugifyFieldKey,
  validateFieldDefinition,
  validateFieldValue,
} from "./custom-fields.ts";
import { CrmError } from "./errors.ts";
import { normalizeColor, normalizeEmail, normalizePhoneE164, sanitizeSearchTerm } from "./normalize.ts";
import { resolveStage, type CrmStage } from "./stages.ts";
import { contactAudienceLabels, normalizeTagName } from "./tags.ts";

function field(type: CustomFieldDefinition["type"], extra: Partial<CustomFieldDefinition> = {}): CustomFieldDefinition {
  return {
    active: true,
    ai_readable: false,
    id: `f-${type}`,
    key: type,
    label: type,
    options: [],
    position: 0,
    type,
    ...extra,
  };
}

function rejects(fn: () => unknown) {
  assert.throws(fn, (error) => error instanceof CrmError && error.code === "invalid");
}

describe("normalize", () => {
  it("teléfono a E.164", () => {
    assert.equal(normalizePhoneE164("+34 600 11 22 33"), "+34600112233");
    assert.equal(normalizePhoneE164("0034-600-112-233"), "+34600112233");
    assert.equal(normalizePhoneE164("+57 (300) 123.4567"), "+573001234567");
    assert.equal(normalizePhoneE164("600112233"), null);
    assert.equal(normalizePhoneE164("+0123456789"), null);
    assert.equal(normalizePhoneE164(""), null);
  });

  it("correo", () => {
    assert.equal(normalizeEmail("  Ana@Ejemplo.COM "), "ana@ejemplo.com");
    assert.equal(normalizeEmail("ana@ejemplo"), null);
  });

  it("color", () => {
    assert.equal(normalizeColor("#AABBCC"), "#aabbcc");
    assert.equal(normalizeColor("rojo"), "#64748b");
  });

  it("búsqueda sin caracteres que rompan el filtro or()", () => {
    assert.equal(sanitizeSearchTerm("ana,(x)%_*"), "ana x");
    assert.equal(sanitizeSearchTerm(null), "");
  });
});

describe("campos personalizados: definición", () => {
  it("genera la clave desde el nombre", () => {
    assert.equal(slugifyFieldKey("Fecha de nacimiento"), "fecha_de_nacimiento");
    assert.equal(slugifyFieldKey("¿Nº de hijos?"), "n_de_hijos");
    assert.equal(slugifyFieldKey("2º teléfono"), "campo_2_telefono");
  });

  it("exige opciones en select/multi y las deduplica", () => {
    const def = validateFieldDefinition({ label: "Plan", options: ["Básico", " básico ", "Pro"], type: "select" });
    assert.deepEqual(def.options, ["Básico", "Pro"]);
    rejects(() => validateFieldDefinition({ label: "Plan", options: [], type: "select" }));
    rejects(() => validateFieldDefinition({ label: "Plan", type: "desconocido" }));
    rejects(() => validateFieldDefinition({ key: "Mal-Clave", label: "X", type: "text" }));
  });

  it("los tipos sin opciones las ignoran", () => {
    assert.deepEqual(validateFieldDefinition({ label: "Notas", options: ["a"], type: "long_text" }).options, []);
  });
});

describe("campos personalizados: valores", () => {
  it("vacío borra", () => {
    assert.equal(validateFieldValue(field("text"), ""), null);
    assert.equal(validateFieldValue(field("multi", { options: ["a"] }), []), null);
  });

  it("número y dinero", () => {
    assert.equal(validateFieldValue(field("number"), "12,5"), 12.5);
    assert.equal(validateFieldValue(field("money"), 10.456), 10.46);
    rejects(() => validateFieldValue(field("number"), "doce"));
  });

  it("fecha real", () => {
    assert.equal(validateFieldValue(field("date"), "2026-02-28"), "2026-02-28");
    rejects(() => validateFieldValue(field("date"), "2026-02-30"));
    rejects(() => validateFieldValue(field("date"), "28/02/2026"));
  });

  it("sí/no", () => {
    assert.equal(validateFieldValue(field("boolean"), "true"), true);
    rejects(() => validateFieldValue(field("boolean"), "quizá"));
  });

  it("select y multi respetan las opciones (sin mayúsculas)", () => {
    const select = field("select", { options: ["Básico", "Pro"] });
    assert.equal(validateFieldValue(select, "pro"), "Pro");
    rejects(() => validateFieldValue(select, "Gold"));
    const multi = field("multi", { options: ["Rojo", "Azul"] });
    assert.deepEqual(validateFieldValue(multi, ["azul", "Azul", "rojo"]), ["Azul", "Rojo"]);
    rejects(() => validateFieldValue(multi, ["verde"]));
  });

  it("teléfono, correo y enlace", () => {
    assert.equal(validateFieldValue(field("phone"), "+34 600 112 233"), "+34600112233");
    rejects(() => validateFieldValue(field("phone"), "600112233"));
    assert.equal(validateFieldValue(field("email"), "A@B.CO"), "a@b.co");
    assert.equal(validateFieldValue(field("url"), "https://levy.com/x"), "https://levy.com/x");
    rejects(() => validateFieldValue(field("url"), "javascript:alert(1)"));
  });

  it("texto con límite", () => {
    rejects(() => validateFieldValue(field("text"), "x".repeat(501)));
    assert.equal(validateFieldValue(field("long_text"), "x".repeat(501))?.toString().length, 501);
  });

  it("merge: solo campos activos, borra con null y conserva los inactivos", () => {
    const defs = [field("text", { key: "nota" }), field("number", { active: false, key: "viejo" })];
    const merged = mergeCustomFieldValues(defs, { nota: "a", viejo: 3 }, { nota: null });
    assert.deepEqual(merged, { viejo: 3 });
    rejects(() => mergeCustomFieldValues(defs, {}, { viejo: 4 }));
    rejects(() => mergeCustomFieldValues(defs, {}, { inventado: "x" }));
  });

  it("la IA solo ve los campos marcados", () => {
    const defs = [
      field("text", { ai_readable: true, key: "alergias", label: "Alergias", position: 1 }),
      field("boolean", { ai_readable: true, key: "vip", label: "VIP", position: 0 }),
      field("text", { key: "dni", label: "DNI" }),
    ];
    assert.deepEqual(describeAiReadableFields(defs, { alergias: "polen", dni: "123", vip: true }), [
      "VIP: sí",
      "Alergias: polen",
    ]);
  });
});

describe("etiquetas y etapas", () => {
  it("nombres reservados del sistema", () => {
    rejects(() => normalizeTagName("Flow_Opt_Out"));
    rejects(() => normalizeTagName("  "));
    assert.equal(normalizeTagName("  Cliente   VIP "), "Cliente VIP");
  });

  it("audiencia de flujos = marcas internas + etiquetas, sin mayúsculas", () => {
    assert.deepEqual(contactAudienceLabels(["onboarding_eligible"], ["VIP", "vip "]), ["onboarding_eligible", "vip"]);
    assert.deepEqual(contactAudienceLabels(null, []), []);
  });

  it("sin etapa = primera abierta por posición", () => {
    const stages: CrmStage[] = [
      { color: "#000000", id: "won", kind: "won", name: "Cliente", position: 0 },
      { color: "#000000", id: "b", kind: "open", name: "Seguimiento", position: 2 },
      { color: "#000000", id: "a", kind: "open", name: "Nuevo", position: 1 },
    ];
    assert.equal(resolveStage(stages, null)?.id, "a");
    assert.equal(resolveStage(stages, "b")?.id, "b");
    assert.equal(resolveStage(stages, "borrada")?.id, "a");
    assert.equal(resolveStage([], null), null);
  });
});
