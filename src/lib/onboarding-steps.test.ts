import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getFirstPendingStep,
  getOnboardingState,
  getPendingSteps,
  onboardingStepCount,
  onboardingSteps,
  parseStepIndex,
} from "./onboarding-steps.ts";

const empty = {
  agentReady: false,
  businessReady: false,
  firstSignalReady: false,
  openaiReady: false,
  teamReady: false,
  ycloudReady: false,
};

describe("pasos del onboarding", () => {
  it("los indices van de 0 a N-1 sin huecos", () => {
    const indices = onboardingSteps.map((step) => step.index);
    assert.deepEqual(indices, [...indices.keys()]);
  });

  it("arranca en la bienvenida cuando no se ha hecho nada", () => {
    assert.equal(getFirstPendingStep(empty).id, "welcome");
  });

  it("retoma en el primer obligatorio pendiente", () => {
    const checklist = { ...empty, agentReady: true, businessReady: true };
    assert.equal(getFirstPendingStep(checklist).id, "openai");
  });

  it("va al final cuando todo lo obligatorio esta hecho", () => {
    const checklist = {
      ...empty,
      agentReady: true,
      businessReady: true,
      firstSignalReady: true,
      openaiReady: true,
      ycloudReady: true,
    };
    assert.equal(getFirstPendingStep(checklist).id, "done");
    assert.equal(getPendingSteps(checklist).length, 0);
  });

  it("el equipo y GoHighLevel no cuentan como pendientes", () => {
    const pending = getPendingSteps(empty).map((step) => step.id);
    assert.ok(!pending.includes("extras"));
    assert.equal(pending.length, 5);
  });

  it("descarta ?paso= fuera de rango o no numerico", () => {
    assert.equal(parseStepIndex("3"), 3);
    assert.equal(parseStepIndex(["2", "9"]), 2);
    assert.equal(parseStepIndex(String(onboardingStepCount)), null);
    assert.equal(parseStepIndex("-1"), null);
    assert.equal(parseStepIndex("abc"), null);
    assert.equal(parseStepIndex(undefined), null);
  });

  it("normaliza onboarding_state aunque venga vacio o roto", () => {
    assert.deepEqual(getOnboardingState(null), {
      agents_confirmed_at: null,
      wizard_skipped_at: null,
    });
    assert.deepEqual(
      getOnboardingState({
        agents_confirmed_at: "2026-01-01T00:00:00.000Z",
        wizard_skipped_at: 1,
      }),
      {
        agents_confirmed_at: "2026-01-01T00:00:00.000Z",
        wizard_skipped_at: null,
      },
    );
  });
});
