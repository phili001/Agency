import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultLevyFlowStages,
  defaultLevyFlowSteps,
  parseFlowSteps,
} from "./flow-definitions.ts";

describe("plantilla Levy", () => {
  it("no lleva URLs de una empresa concreta escritas a mano", () => {
    // El CTA de cierre debe salir del perfil de negocio de cada cliente.
    // Un link fijo aquí manda los leads de todos los clientes al mismo sitio.
    for (const step of defaultLevyFlowSteps) {
      assert.doesNotMatch(
        step.message ?? "",
        /https?:\/\//,
        `el paso "${step.id}" trae una URL fija`,
      );
    }
  });

  it("cierra con la variable del link de agenda", () => {
    const cierre = defaultLevyFlowSteps.find((step) => step.id === "impacto_operativo");
    assert.ok(cierre?.message?.includes("{{booking_cta}}"));
  });

  it("no repite ids de paso", () => {
    const ids = defaultLevyFlowSteps.map((step) => step.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("todos los nextStepId apuntan a un paso que existe", () => {
    const ids = new Set(defaultLevyFlowSteps.map((step) => step.id));
    for (const step of defaultLevyFlowSteps) {
      if (step.nextStepId) {
        assert.ok(ids.has(step.nextStepId), `${step.id} apunta a ${step.nextStepId}`);
      }
      for (const option of step.options ?? []) {
        if (option.nextStepId) {
          assert.ok(
            ids.has(option.nextStepId),
            `opción de ${step.id} apunta a ${option.nextStepId}`,
          );
        }
      }
    }
  });

  it("usa etapas declaradas", () => {
    const stageKeys = new Set(defaultLevyFlowStages.map((stage) => stage.key));
    for (const step of defaultLevyFlowSteps) {
      assert.ok(stageKeys.has(step.stageKey ?? ""), `etapa desconocida en ${step.id}`);
    }
  });

  it("las opciones guardan valores sin tildes ni espacios", () => {
    // El valor se guarda como respuesta del contacto y viaja a GHL; una tilde
    // o un espacio ahi rompe los filtros que se construyen sobre el.
    for (const step of defaultLevyFlowSteps) {
      for (const option of step.options ?? []) {
        assert.match(
          option.value,
          /^[\x21-\x7e]+$/,
          `valor con caracteres no ASCII: ${option.value}`,
        );
        assert.doesNotMatch(option.value, /\s/, `valor con espacios: ${option.value}`);
      }
    }
  });
});

describe("parseFlowSteps", () => {
  it("devuelve lista vacía ante datos que no son pasos", () => {
    assert.deepEqual(parseFlowSteps(null), []);
    assert.deepEqual(parseFlowSteps({} as never), []);
  });
});
