import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyBusinessVariables,
  businessProfileFields,
  getBusinessVariables,
  normalizeVariableKey,
} from "./business-profile.ts";

describe("businessProfileFields", () => {
  it("no repite claves", () => {
    const keys = businessProfileFields.map((field) => field.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("las claves siguen siendo ASCII: se usan como variables de prompt", () => {
    for (const field of businessProfileFields) {
      assert.match(field.key, /^[a-z0-9_]+$/, `clave inválida: ${field.key}`);
      assert.equal(field.variable, `{${field.key}}`);
    }
  });

  it("incluye el link de agenda que usan los flujos", () => {
    assert.ok(businessProfileFields.some((field) => field.key === "booking_url"));
  });
});

describe("getBusinessVariables", () => {
  const asset = {
    metadata: {
      custom_fields: [{ key: "", label: "Garantía Extendida", value: "12 meses" }],
      fields: { booking_url: "https://agenda.test/x", company_name: "Clínica Norte" },
    },
    title: "Respaldo",
  };

  it("expone los campos configurados", () => {
    const variables = getBusinessVariables(asset);
    assert.equal(variables.company_name, "Clínica Norte");
    assert.equal(variables.booking_url, "https://agenda.test/x");
  });

  it("usa el título del asset solo si no hay nombre de empresa", () => {
    assert.equal(getBusinessVariables({ metadata: {}, title: "Respaldo" }).company_name, "Respaldo");
  });

  it("convierte etiquetas con tilde en claves ASCII usables en prompts", () => {
    assert.equal(getBusinessVariables(asset).garantia_extendida, "12 meses");
  });

  it("no falla sin asset", () => {
    assert.deepEqual(getBusinessVariables(null), {});
  });
});

describe("normalizeVariableKey", () => {
  it("quita tildes, espacios y símbolos", () => {
    assert.equal(normalizeVariableKey("Métodos de Pago"), "metodos_de_pago");
    assert.equal(normalizeVariableKey("  ¿Política? "), "politica");
  });
});

describe("applyBusinessVariables", () => {
  it("sustituye lo que conoce y deja intacto lo que no", () => {
    assert.equal(
      applyBusinessVariables("Hola desde {company_name} en {ciudad}", {
        company_name: "Clínica Norte",
      }),
      "Hola desde Clínica Norte en {ciudad}",
    );
  });
});
