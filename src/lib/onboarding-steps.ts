import type { Json } from "@/lib/supabase/database.types";

/**
 * Checklist que calcula el servidor (ver getOnboardingChecklist). Se duplica el
 * tipo aqui porque workspaces.ts es server-only y el wizard corre en cliente.
 */
export type OnboardingChecklist = {
  agentReady: boolean;
  businessReady: boolean;
  firstSignalReady: boolean;
  openaiReady: boolean;
  teamReady: boolean;
  ycloudReady: boolean;
};

export type OnboardingStepId =
  | "welcome"
  | "business"
  | "agents"
  | "openai"
  | "whatsapp"
  | "test"
  | "extras"
  | "done";

export type OnboardingStep = {
  /** Campo del checklist que marca el paso como hecho. */
  checklistKey: keyof OnboardingChecklist | null;
  id: OnboardingStepId;
  /** Posicion en la URL: /onboarding?paso=N */
  index: number;
  optional: boolean;
  /** Titulo corto para la barra de progreso y la tarjeta de pendientes. */
  shortTitle: string;
};

/**
 * Estado del wizard, guardado en workspaces.onboarding_state junto al
 * checklist final y al modo de conversacion por defecto.
 */
export type OnboardingState = {
  agents_confirmed_at: string | null;
  wizard_skipped_at: string | null;
};

export const onboardingSteps: OnboardingStep[] = [
  { checklistKey: null, id: "welcome", index: 0, optional: true, shortTitle: "Bienvenida" },
  { checklistKey: "businessReady", id: "business", index: 1, optional: false, shortTitle: "Tu negocio" },
  { checklistKey: "agentReady", id: "agents", index: 2, optional: false, shortTitle: "Tus agentes" },
  { checklistKey: "openaiReady", id: "openai", index: 3, optional: false, shortTitle: "El cerebro (OpenAI)" },
  { checklistKey: "ycloudReady", id: "whatsapp", index: 4, optional: false, shortTitle: "Tu WhatsApp" },
  { checklistKey: "firstSignalReady", id: "test", index: 5, optional: false, shortTitle: "Prueba real" },
  { checklistKey: "teamReady", id: "extras", index: 6, optional: true, shortTitle: "Equipo y extras" },
  { checklistKey: null, id: "done", index: 7, optional: true, shortTitle: "Listo" },
];

export const onboardingStepCount = onboardingSteps.length;

export function getOnboardingStep(index: number) {
  return onboardingSteps.find((step) => step.index === index) ?? onboardingSteps[0];
}

export function isStepDone(step: OnboardingStep, checklist: OnboardingChecklist) {
  return step.checklistKey ? checklist[step.checklistKey] : false;
}

/** Pasos obligatorios que todavia no están marcados en el checklist. */
export function getPendingSteps(checklist: OnboardingChecklist) {
  return onboardingSteps.filter(
    (step) => !step.optional && step.checklistKey && !checklist[step.checklistKey],
  );
}

/**
 * Donde retomar el wizard: el primer obligatorio pendiente. Si no falta nada,
 * la pantalla final. Si no se ha hecho nada todavia, la bienvenida.
 */
export function getFirstPendingStep(checklist: OnboardingChecklist) {
  const pending = getPendingSteps(checklist);
  const nothingDone = onboardingSteps.every((step) => !isStepDone(step, checklist));

  if (nothingDone) {
    return getOnboardingStep(0);
  }

  return pending[0] ?? getOnboardingStep(onboardingStepCount - 1);
}

export function parseStepIndex(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= onboardingStepCount) {
    return null;
  }

  return parsed;
}

export function getOnboardingState(value: Json | null | undefined): OnboardingState {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    agents_confirmed_at:
      typeof record.agents_confirmed_at === "string" ? record.agents_confirmed_at : null,
    wizard_skipped_at:
      typeof record.wizard_skipped_at === "string" ? record.wizard_skipped_at : null,
  };
}
