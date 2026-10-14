/**
 * El prompt de cada agente se guarda como un solo texto con tres bloques.
 * Estas funciones lo parten y lo vuelven a juntar; las usan la pantalla de
 * Agentes y el paso de agentes del onboarding, para que editen lo mismo.
 */
const RULES_MARKER = "\n\nReglas -- que SI debe hacer:\n";
const RESTRICTIONS_MARKER = "\n\nRestricciones -- que NUNCA debe hacer:\n";
const INSTRUCTIONS_PREFIX = "Instrucciones del agente:\n";

export type AgentPromptParts = {
  restrictions: string;
  rules: string;
  system_prompt: string;
};

export function parseAgentPrompt(prompt?: string | null): AgentPromptParts {
  const value = prompt ?? "";

  if (!value.includes(RULES_MARKER) && !value.includes(RESTRICTIONS_MARKER)) {
    return { restrictions: "", rules: "", system_prompt: value };
  }

  const [instructionsBlock, afterRules = ""] = value.split(RULES_MARKER);
  const [rules = "", restrictions = ""] = afterRules.split(RESTRICTIONS_MARKER);

  return {
    restrictions,
    rules,
    system_prompt: instructionsBlock.replace(INSTRUCTIONS_PREFIX, ""),
  };
}

export function buildAgentPrompt({
  restrictions,
  rules,
  system_prompt,
}: AgentPromptParts) {
  return [
    `${INSTRUCTIONS_PREFIX}${system_prompt.trim()}`,
    rules.trim() ? `Reglas -- que SI debe hacer:\n${rules.trim()}` : "",
    restrictions.trim()
      ? `Restricciones -- que NUNCA debe hacer:\n${restrictions.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Tono de los agentes. Es el mismo "Estilo" de la pantalla de Agentes: se
 * guarda en `temperature`, así los dos sitios editan el mismo dato.
 */
export const agentTones = [
  {
    description: "Se ciñe a lo que le contaste. Para clínicas o temas delicados.",
    label: "Formal y preciso",
    value: "0.3",
  },
  {
    description: "Conversacional y equilibrado, como un empleado con experiencia.",
    label: "Natural",
    value: "0.5",
  },
  {
    description: "Más suelto y con chispa. Para marcas desenfadadas.",
    label: "Cercano y expresivo",
    value: "0.8",
  },
] as const;

export type AgentToneValue = (typeof agentTones)[number]["value"];

export function getAgentToneValue(temperature?: number | string | null): AgentToneValue {
  const value = Number(temperature ?? 0.5);

  if (value <= 0.35) {
    return "0.3";
  }

  if (value <= 0.65) {
    return "0.5";
  }

  return "0.8";
}

/** Tono común de varios agentes; "" si no coinciden entre ellos. */
export function getSharedTone(temperatures: Array<number | string | null | undefined>) {
  const tones = [...new Set(temperatures.map((item) => getAgentToneValue(item)))];

  return tones.length === 1 ? tones[0] : "";
}
