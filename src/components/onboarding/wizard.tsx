"use client";

import { Bot, Check, LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { DefaultConversationMode } from "@/lib/conversation-default";
import {
  type OnboardingChecklist,
  getOnboardingStep,
  onboardingStepCount,
  onboardingSteps,
} from "@/lib/onboarding-steps";
import type { Json } from "@/lib/supabase/database.types";

import { SupportContact } from "./shared";
import { StepAgents } from "./step-agents";
import { StepBusiness } from "./step-business";
import { StepDone } from "./step-done";
import { StepExtras } from "./step-extras";
import { StepOpenAI } from "./step-openai";
import { StepTest } from "./step-test";
import { StepWelcome } from "./step-welcome";
import { StepWhatsApp } from "./step-whatsapp";

export type WizardWorkspace = {
  company_code: string | null;
  id: string;
  name: string;
};

export type WizardIntegration = {
  config: Json;
  provider: "gohighlevel" | "openai" | "ycloud";
  status: string;
};

export type WizardAgent = {
  config: Json;
  id: string;
  name: string;
  type: string;
};

export type WizardAsset = {
  content: string;
  id: string;
  kind: string;
  metadata: Json;
  status: string;
  title: string;
};

export type WizardProps = {
  agents: WizardAgent[];
  appUrl: string;
  businessProfile: WizardAsset | null;
  checklist: OnboardingChecklist;
  defaultConversationMode: DefaultConversationMode;
  initialStep: number;
  integrations: WizardIntegration[];
  memberCount: number;
  /** Solo existe cuando YCloud ya se guardo; la genera el servidor. */
  webhookUrl: string | null;
  workspace: WizardWorkspace;
};

/** Lo que recibe cada paso para leer y actualizar el estado compartido. */
export type StepContext = {
  agents: WizardAgent[];
  appUrl: string;
  businessProfile: WizardAsset | null;
  checklist: OnboardingChecklist;
  defaultConversationMode: DefaultConversationMode;
  goBack: () => void;
  goNext: () => void;
  goTo: (index: number) => void;
  integrations: WizardIntegration[];
  memberCount: number;
  patchChecklist: (patch: Partial<OnboardingChecklist>) => void;
  setAgents: (agents: WizardAgent[]) => void;
  setBusinessProfile: (asset: WizardAsset | null) => void;
  setDefaultConversationMode: (mode: DefaultConversationMode) => void;
  setMemberCount: (count: number) => void;
  setWebhookUrl: (url: string | null) => void;
  skipForNow: () => Promise<void>;
  upsertIntegration: (integration: WizardIntegration) => void;
  webhookUrl: string | null;
  workspace: WizardWorkspace;
};

export function getIntegrationConfig(integration?: WizardIntegration | null) {
  return integration?.config &&
    typeof integration.config === "object" &&
    !Array.isArray(integration.config)
    ? (integration.config as Record<string, unknown>)
    : {};
}

export function OnboardingWizard(props: WizardProps) {
  const [step, setStep] = useState(props.initialStep);
  const [checklist, setChecklist] = useState(props.checklist);
  const [integrations, setIntegrations] = useState(props.integrations);
  const [agents, setAgents] = useState(props.agents);
  const [businessProfile, setBusinessProfile] = useState(props.businessProfile);
  const [memberCount, setMemberCount] = useState(props.memberCount);
  const [webhookUrl, setWebhookUrl] = useState(props.webhookUrl);
  const [defaultConversationMode, setDefaultConversationMode] = useState(
    props.defaultConversationMode,
  );
  const [leaving, setLeaving] = useState(false);

  // El paso vive en la URL para que recargar o volver atras no pierda el sitio.
  const goTo = useCallback((index: number) => {
    const clamped = Math.min(Math.max(index, 0), onboardingStepCount - 1);
    setStep(clamped);
    window.history.replaceState(null, "", `/onboarding?paso=${clamped}`);
    window.scrollTo({ behavior: "smooth", top: 0 });
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `/onboarding?paso=${step}`);
    // Solo al montar: sincroniza la URL con el paso inicial calculado en servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipForNow = useCallback(async () => {
    setLeaving(true);
    await fetch("/api/workspaces", {
      body: JSON.stringify({ action: "skip_onboarding", workspaceId: props.workspace.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    window.location.href = "/";
  }, [props.workspace.id]);

  const context: StepContext = {
    agents,
    appUrl: props.appUrl,
    businessProfile,
    checklist,
    defaultConversationMode,
    goBack: () => goTo(step - 1),
    goNext: () => goTo(step + 1),
    goTo,
    integrations,
    memberCount,
    patchChecklist: (patch) => setChecklist((current) => ({ ...current, ...patch })),
    setAgents,
    setBusinessProfile,
    setDefaultConversationMode,
    setMemberCount,
    setWebhookUrl,
    skipForNow,
    upsertIntegration: (integration) =>
      setIntegrations((current) => [
        ...current.filter((item) => item.provider !== integration.provider),
        integration,
      ]),
    webhookUrl,
    workspace: props.workspace,
  };

  const current = getOnboardingStep(step);
  const isFirst = step === 0;
  const isLast = step === onboardingStepCount - 1;
  // La bienvenida y el cierre no cuentan en "Paso N de M".
  const numberedSteps = onboardingSteps.filter((item) => item.index !== 0);

  return (
    <main className="min-h-screen bg-[#f6f7f3] text-[#20231f]">
      <header className="border-b border-[#d9ded3] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#10231c] text-[#d2f36b]">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold">Levy</p>
              <p className="text-xs text-[#647067]">Configuración inicial · {props.workspace.name}</p>
            </div>
          </div>
          {!isFirst && !isLast ? (
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium text-[#4d5a51] disabled:text-[#9aa59e]"
              disabled={leaving}
              onClick={skipForNow}
              type="button"
            >
              <LogOut size={15} />
              Continuar después
            </button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto grid max-w-3xl gap-5 px-5 py-6 md:py-10">
        {!isFirst ? (
          <nav aria-label="Progreso" className="grid gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[#20231f]">
                Paso {step} de {numberedSteps.length}
              </span>
              <span className="text-[#647067]">{current.shortTitle}</span>
            </div>
            <ol className="grid grid-cols-7 gap-1.5">
              {numberedSteps.map((item) => {
                // Verde solo si el checklist lo confirma: pasar de largo no cuenta.
                const done = Boolean(item.checklistKey && checklist[item.checklistKey]);
                const active = item.index === step;

                return (
                  <li key={item.id}>
                    <button
                      aria-current={active ? "step" : undefined}
                      aria-label={item.shortTitle}
                      className={`h-2.5 w-full rounded-full transition ${
                        active
                          ? "bg-[#10231c]"
                          : done
                            ? "bg-[#35735b]"
                            : "bg-[#d9ded3]"
                      }`}
                      onClick={() => goTo(item.index)}
                      title={item.shortTitle}
                      type="button"
                    />
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}

        <section className="rounded-2xl border border-[#d9ded3] bg-white p-5 shadow-sm md:p-8">
          {current.id === "welcome" ? <StepWelcome ctx={context} /> : null}
          {current.id === "business" ? <StepBusiness ctx={context} /> : null}
          {current.id === "agents" ? <StepAgents ctx={context} /> : null}
          {current.id === "openai" ? <StepOpenAI ctx={context} /> : null}
          {current.id === "whatsapp" ? <StepWhatsApp ctx={context} /> : null}
          {current.id === "test" ? <StepTest ctx={context} /> : null}
          {current.id === "extras" ? <StepExtras ctx={context} /> : null}
          {current.id === "done" ? <StepDone ctx={context} /> : null}
        </section>

        <SupportContact
          companyName={props.workspace.name}
          stepIndex={isFirst || isLast ? null : step}
          stepTitle={current.shortTitle}
        />

        {!isFirst && !isLast ? (
          <p className="flex items-center justify-center gap-2 text-center text-sm text-[#7a847c]">
            <Check size={14} />
            Todo lo que guardas queda guardado: puedes cerrar y seguir otro día.
          </p>
        ) : null}
      </div>
    </main>
  );
}
