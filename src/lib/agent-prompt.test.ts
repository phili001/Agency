import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAgentPrompt,
  getAgentToneValue,
  getSharedTone,
  parseAgentPrompt,
} from "./agent-prompt.ts";

describe("prompt de los agentes", () => {
  it("parte y rearma el prompt sin perder nada", () => {
    const prompt = buildAgentPrompt({
      restrictions: "No inventes precios.",
      rules: "Responde breve.",
      system_prompt: "Eres Mateo.",
    });

    assert.deepEqual(parseAgentPrompt(prompt), {
      restrictions: "No inventes precios.",
      rules: "Responde breve.",
      system_prompt: "Eres Mateo.",
    });
  });

  it("un prompt viejo sin bloques se queda entero como instrucciones", () => {
    assert.deepEqual(parseAgentPrompt("Eres un agente de WhatsApp."), {
      restrictions: "",
      rules: "",
      system_prompt: "Eres un agente de WhatsApp.",
    });
  });

  it("traduce la temperatura al tono más cercano", () => {
    assert.equal(getAgentToneValue(0.3), "0.3");
    assert.equal(getAgentToneValue(0.5), "0.5");
    assert.equal(getAgentToneValue(0.9), "0.8");
    assert.equal(getAgentToneValue(null), "0.5");
  });

  it("solo hay tono común si todos los agentes coinciden", () => {
    assert.equal(getSharedTone([0.3, 0.3, 0.3]), "0.3");
    assert.equal(getSharedTone([0.3, 0.8]), "");
    assert.equal(getSharedTone([]), "");
  });
});
