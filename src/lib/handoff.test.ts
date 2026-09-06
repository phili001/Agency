import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectAnswerHandoff,
  findHandoffKeyword,
  getHandoffKeywords,
  withHandoffNotice,
} from "./handoff.ts";

describe("findHandoffKeyword", () => {
  const keywords = ["humano", "asesor", "caro"];

  it("detecta la palabra aunque venga en una frase", () => {
    assert.equal(findHandoffKeyword("quiero hablar con un humano", keywords), "humano");
  });

  it("ignora mayúsculas y tildes del contacto", () => {
    assert.equal(findHandoffKeyword("Pásame un ASESOR", keywords), "asesor");
  });

  it("no salta con una palabra que solo contiene la clave", () => {
    assert.equal(findHandoffKeyword("es un carrusel", keywords), null);
  });

  it("devuelve null si no hay coincidencia", () => {
    assert.equal(findHandoffKeyword("cuanto cuesta?", keywords), null);
  });
});

describe("getHandoffKeywords", () => {
  it("no inventa palabras cuando el agente no define ninguna", () => {
    assert.deepEqual(getHandoffKeywords(null), []);
    assert.deepEqual(getHandoffKeywords({}), []);
  });

  it("descarta entradas que no son texto útil", () => {
    assert.deepEqual(
      getHandoffKeywords({ handoff_keywords: ["reclamo", "", 7, "  "] }),
      ["reclamo"],
    );
  });

  it("usa las del agente cuando existen", () => {
    const keywords = getHandoffKeywords({ handoff_keywords: ["reclamo"] });
    assert.ok(keywords.includes("reclamo"));
  });
});

describe("detectAnswerHandoff", () => {
  it("escala cuando la IA admite que no tiene la información", () => {
    const result = detectAnswerHandoff("No tengo esa información sobre el precio.");
    assert.ok(result, "debería escalar");
    assert.equal(result?.source, "unknown_answer");
  });

  it("escala cuando la IA promete que responderá una persona", () => {
    const result = detectAnswerHandoff("Voy a avisar al equipo para que te contacte.");
    assert.ok(result, "debería escalar");
    assert.equal(result?.source, "promise_guard");
  });

  it("no escala en una respuesta normal", () => {
    assert.equal(
      detectAnswerHandoff("Abrimos de lunes a viernes de 9:00 a 18:00."),
      null,
    );
  });

  it("no escala con una respuesta vacía", () => {
    assert.equal(detectAnswerHandoff(""), null);
    assert.equal(detectAnswerHandoff(null), null);
  });
});

describe("withHandoffNotice", () => {
  it("añade el aviso al cliente una sola vez", () => {
    const once = withHandoffNotice("No puedo resolver eso.");
    assert.equal(withHandoffNotice(once), once);
  });
});
