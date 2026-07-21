import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getWorkspaceOpenAIKey } from "@/lib/integrations/openai";

type VerificationResult = {
  confidence: number;
  model: string | null;
  normalizedAnswer: string;
  reason: string;
  source: "ai" | "local_fallback" | "local_rejection";
  valid: boolean;
};

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];

  for (const item of output) {
    const content = Array.isArray(getRecord(item).content) ? getRecord(item).content : [];

    for (const part of content as unknown[]) {
      const text = getRecord(part).text;
      if (typeof text === "string") {
        return text;
      }
    }
  }

  return "";
}

export function validateAnswerLocally(answer: string, minimumLength = 3) {
  const normalized = answer.replace(/\s+/g, " ").trim();
  const meaningful = normalized.replace(/[\p{P}\p{S}\s]/gu, "");

  if (!normalized) {
    return { normalized, reason: "La respuesta esta vacia.", valid: false };
  }

  if (!meaningful) {
    return {
      normalized,
      reason: "La respuesta solo contiene puntuacion, simbolos o emojis.",
      valid: false,
    };
  }

  if (meaningful.length < Math.max(1, minimumLength)) {
    return {
      normalized,
      reason: "La respuesta es demasiado corta para completar este dato.",
      valid: false,
    };
  }

  if (/^(no se|nose|n\/a|na|ninguno|nada|x+)$/i.test(normalized)) {
    return {
      normalized,
      reason: "La respuesta no aporta informacion suficiente.",
      valid: false,
    };
  }

  return { normalized, reason: "Supero las reglas basicas.", valid: true };
}

export async function verifyFlowAnswer({
  answer,
  criteria,
  minimumLength,
  question,
  supabase,
  workspaceId,
}: {
  answer: string;
  criteria: string;
  minimumLength: number;
  question: string;
  supabase: SupabaseClient;
  workspaceId: string;
}): Promise<VerificationResult> {
  const local = validateAnswerLocally(answer, minimumLength);

  if (!local.valid) {
    return {
      confidence: 1,
      model: null,
      normalizedAnswer: local.normalized,
      reason: local.reason,
      source: "local_rejection",
      valid: false,
    };
  }

  const [{ data: integration }, apiKey] = await Promise.all([
    supabase
      .from("integrations")
      .select("config")
      .eq("workspace_id", workspaceId)
      .eq("provider", "openai")
      .eq("status", "active")
      .maybeSingle(),
    getWorkspaceOpenAIKey(workspaceId),
  ]);
  const config = getRecord(integration?.config);
  const configuredModel =
    typeof config.model === "string" && config.model.trim()
      ? config.model.replace(/^openai\//, "")
      : "gpt-5.4-mini";

  if (!apiKey) {
    return {
      confidence: 0.5,
      model: null,
      normalizedAnswer: local.normalized,
      reason: "OpenAI no disponible; aceptada por reglas locales sustanciales.",
      source: "local_fallback",
      valid: true,
    };
  }

  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        body: JSON.stringify({
          input: [
            {
              content: [
                {
                  text:
                    "Evalua una respuesta de onboarding comercial. Rechaza texto sin sentido, evasivo, irrelevante o insuficiente. No inventes datos. Normaliza ortografia y espacios sin cambiar el significado.\n\n" +
                    `Pregunta: ${question}\nCriterio esperado: ${criteria || "Debe responder directamente la pregunta con informacion util."}\nRespuesta: ${local.normalized}`,
                  type: "input_text",
                },
              ],
              role: "user",
            },
          ],
          model: configuredModel,
          text: {
            format: {
              name: "flow_answer_verification",
              schema: {
                additionalProperties: false,
                properties: {
                  confidence: { maximum: 1, minimum: 0, type: "number" },
                  normalizedAnswer: { type: "string" },
                  reason: { type: "string" },
                  valid: { type: "boolean" },
                },
                required: ["valid", "reason", "normalizedAnswer", "confidence"],
                type: "object",
              },
              strict: true,
              type: "json_schema",
            },
          },
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "object" &&
            payload.error &&
            typeof getRecord(payload.error).message === "string"
            ? String(getRecord(payload.error).message)
            : "OpenAI rechazo la validacion.",
        );
      }

      const parsed = JSON.parse(extractOutputText(payload)) as Record<string, unknown>;
      return {
        confidence:
          typeof parsed.confidence === "number" ? parsed.confidence : 0,
        model: configuredModel,
        normalizedAnswer:
          typeof parsed.normalizedAnswer === "string" &&
          parsed.normalizedAnswer.trim()
            ? parsed.normalizedAnswer.trim()
            : local.normalized,
        reason:
          typeof parsed.reason === "string"
            ? parsed.reason
            : "Validacion semantica completada.",
        source: "ai",
        valid: parsed.valid === true,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Fallo tecnico de OpenAI.";
    }
  }

  return {
    confidence: 0.5,
    model: configuredModel,
    normalizedAnswer: local.normalized,
    reason: `OpenAI no estuvo disponible tras tres intentos (${lastError}). Aceptada por reglas locales sustanciales.`,
    source: "local_fallback",
    valid: true,
  };
}
