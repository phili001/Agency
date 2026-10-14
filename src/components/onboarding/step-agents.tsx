"use client";

import { Bot, ChevronDown, Headphones } from "lucide-react";
import { useState } from "react";

import {
  agentTones,
  buildAgentPrompt,
  getAgentToneValue,
  getSharedTone,
  parseAgentPrompt,
} from "@/lib/agent-prompt";
import type { DefaultConversationMode } from "@/lib/conversation-default";
import { createClient } from "@/lib/supabase/client";

import {
  Field,
  HowTo,
  Notice,
  OptionCard,
  Question,
  StepFooter,
  StepHeading,
  ToggleSwitch,
  inputClass,
  readApiError,
} from "./shared";
import type { StepContext, WizardAgent } from "./wizard";

const roleCopy: Record<string, { label: string; what: string }> = {
  booking: {
    label: "Citas",
    what: "Cuando alguien quiere agendar, cambiar o cancelar una cita. Consulta tu calendario antes de ofrecer horas.",
  },
  setter: {
    label: "Ventas",
    what: "Cuando alguien muestra interés en comprar. Entiende qué necesita, resuelve objeciones y lo prepara para agendar.",
  },
  support: {
    label: "Información",
    what: "Cuando alguien pregunta por horarios, ubicación, servicios, precios o políticas.",
  },
};

type AgentDraft = {
  isActive: boolean;
  name: string;
  restrictions: string;
  rules: string;
};

function getConfig(agent: WizardAgent) {
  return agent.config && typeof agent.config === "object" && !Array.isArray(agent.config)
    ? (agent.config as Record<string, unknown>)
    : {};
}

function getAgentName(agent: WizardAgent) {
  const config = getConfig(agent);

  return typeof config.agent_name === "string" && config.agent_name.trim()
    ? config.agent_name.trim()
    : agent.name.split(/\s+-\s+/)[0]?.trim() || agent.name;
}

function getJobTitle(agent: WizardAgent) {
  const config = getConfig(agent);

  return typeof config.job_title === "string" && config.job_title.trim()
    ? config.job_title.trim()
    : agent.name.split(/\s+-\s+/).slice(1).join(" - ").trim();
}

function getHandoffKeywords(agent: WizardAgent) {
  const config = getConfig(agent);

  return Array.isArray(config.handoff_keywords)
    ? config.handoff_keywords.filter((item): item is string => typeof item === "string")
    : [];
}

function createDraft(agent: WizardAgent): AgentDraft {
  const prompt = parseAgentPrompt(agent.system_prompt);

  return {
    isActive: agent.is_active,
    name: getAgentName(agent),
    restrictions: prompt.restrictions.trim(),
    rules: prompt.rules.trim(),
  };
}

export function StepAgents({ ctx }: { ctx: StepContext }) {
  const supabase = createClient();
  const [drafts, setDrafts] = useState<Record<string, AgentDraft>>(() =>
    Object.fromEntries(ctx.agents.map((agent) => [agent.id, createDraft(agent)])),
  );
  const [tone, setTone] = useState(
    () => getSharedTone(ctx.agents.map((agent) => agent.temperature)) || "0.5",
  );
  const [openAgentId, setOpenAgentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [error, setError] = useState("");

  function updateDraft(id: string, next: Partial<AgentDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...next } }));
  }

  async function saveMode(mode: DefaultConversationMode) {
    if (mode === ctx.defaultConversationMode) {
      return;
    }

    setSavingMode(true);
    setError("");
    const response = await fetch("/api/workspaces", {
      body: JSON.stringify({
        action: "set_default_conversation_mode",
        defaultConversationMode: mode,
        workspaceId: ctx.workspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setSavingMode(false);

    if (!response.ok) {
      setError(await readApiError(response, "No se pudo guardar tu elección."));
      return;
    }

    ctx.setDefaultConversationMode(mode);
  }

  async function confirm() {
    if (ctx.agents.length > 0 && !ctx.agents.some((agent) => drafts[agent.id]?.isActive)) {
      setError("Deja al menos un agente activo: si no, nadie responderá los chats.");
      return;
    }

    setSaving(true);
    setError("");
    const updated: WizardAgent[] = [];

    for (const agent of ctx.agents) {
      const draft = drafts[agent.id];
      const prompt = parseAgentPrompt(agent.system_prompt);
      const cleanName = draft.name.trim() || getAgentName(agent);
      const renamed = cleanName !== getAgentName(agent);
      const rewritten =
        draft.rules !== prompt.rules.trim() || draft.restrictions !== prompt.restrictions.trim();
      const retoned = getAgentToneValue(agent.temperature) !== tone;
      const switched = draft.isActive !== agent.is_active;

      if (!renamed && !rewritten && !retoned && !switched) {
        updated.push(agent);
        continue;
      }

      const jobTitle = getJobTitle(agent);
      // Renombrar o reescribir sí es personalizar: a partir de ahí este agente
      // deja de recibir las mejoras del prompt base. Cambiar tono o estado, no.
      const config = {
        ...getConfig(agent),
        agent_name: cleanName,
        ...(renamed || rewritten ? { onboarding_agent_configured: true } : {}),
      };
      const systemPrompt = buildAgentPrompt({
        restrictions: draft.restrictions,
        rules: draft.rules,
        system_prompt: prompt.system_prompt,
      });
      const payload = {
        config,
        is_active: draft.isActive,
        name: jobTitle ? `${cleanName} - ${jobTitle}` : cleanName,
        system_prompt: systemPrompt,
        temperature: Number(tone),
      };
      const { error: updateError } = await supabase
        .from("agents")
        .update(payload)
        .eq("id", agent.id)
        .eq("workspace_id", ctx.workspace.id);

      if (updateError) {
        setError("No se pudieron guardar los cambios. Inténtalo otra vez.");
        setSaving(false);
        return;
      }

      updated.push({ ...agent, ...payload });
    }

    ctx.setAgents(updated);

    const response = await fetch("/api/workspaces", {
      body: JSON.stringify({ action: "confirm_agents", workspaceId: ctx.workspace.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setSaving(false);

    if (!response.ok) {
      setError(await readApiError(response, "No se pudo confirmar. Inténtalo otra vez."));
      return;
    }

    ctx.patchChecklist({ agentReady: true });
    ctx.goNext();
  }

  return (
    <div className="grid gap-6">
      <StepHeading
        eyebrow="Paso 2 · Tus agentes"
        title="Conoce a tus agentes"
        description="Ya vienen listos y entrenados con lo que escribiste de tu negocio. Aquí decides cómo hablan, cuáles trabajan y, si quieres, afinas sus instrucciones."
      />

      <HowTo
        items={[
          <>Lee qué hace cada agente. Si quieres, cámbiale el <span className="font-medium">nombre</span> o <span className="font-medium">pausa</span> el que no necesites.</>,
          <>Elige el <span className="font-medium">tono</span> con el que hablan todos.</>,
          <>Elige quién responde los chats nuevos: la IA o una persona.</>,
          <>Pulsa <span className="font-medium">Confirmar mis agentes</span>.</>,
        ]}
      />

      {ctx.agents.length === 0 ? (
        <Notice>
          Todavía no hay agentes en esta empresa. Pide a tu administrador que los
          cree o continúa: podrás crearlos después desde la sección Agentes.
        </Notice>
      ) : null}

      <div className="grid gap-3">
        {ctx.agents.map((agent) => {
          const copy = roleCopy[agent.type] ?? { label: agent.type, what: "" };
          const keywords = getHandoffKeywords(agent);
          const draft = drafts[agent.id];
          const open = openAgentId === agent.id;

          return (
            <div
              className={`grid gap-3 rounded-xl border p-4 ${
                draft.isActive
                  ? "border-[#e2e6df] bg-[#fafbf8]"
                  : "border-dashed border-[#cbd2c6] bg-white"
              }`}
              key={agent.id}
            >
              <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#35735b]">
                    Agente de {copy.label.toLowerCase()}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#4d5a51]">{copy.what}</p>
                  {keywords.length > 0 ? (
                    <p className="mt-2 text-sm text-[#647067]">
                      Pasa el chat a una persona si el cliente dice:{" "}
                      <span className="font-medium text-[#20231f]">{keywords.join(", ")}</span>.
                    </p>
                  ) : null}
                </div>
                <Field label="Nombre">
                  <input
                    className={inputClass}
                    maxLength={40}
                    onChange={(event) => updateDraft(agent.id, { name: event.target.value })}
                    value={draft.name}
                  />
                </Field>
                <div className="flex items-center gap-2 md:mt-9">
                  <ToggleSwitch
                    checked={draft.isActive}
                    label={`Activar ${draft.name}`}
                    onChange={() => updateDraft(agent.id, { isActive: !draft.isActive })}
                  />
                  <span className="text-sm font-medium text-[#4d5a51]">
                    {draft.isActive ? "Activo" : "Pausado"}
                  </span>
                </div>
              </div>

              <div className="border-t border-[#e2e6df] pt-3">
                <button
                  aria-expanded={open}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#35735b]"
                  onClick={() => setOpenAgentId(open ? "" : agent.id)}
                  type="button"
                >
                  <ChevronDown className={open ? "rotate-180" : ""} size={16} />
                  {open ? "Cerrar instrucciones" : "Editar sus instrucciones a fondo"}
                </button>

                {open ? (
                  <div className="mt-3 grid gap-3">
                    <Field
                      help="Una idea por línea, como se lo dirías a un empleado nuevo."
                      label="Qué debe hacer siempre"
                    >
                      <textarea
                        className={`${inputClass} h-auto min-h-32 py-3`}
                        onChange={(event) =>
                          updateDraft(agent.id, { rules: event.target.value })
                        }
                        rows={5}
                        value={draft.rules}
                      />
                    </Field>
                    <Field
                      help="Lo que nunca debe decir ni prometer."
                      label="Qué no debe hacer nunca"
                    >
                      <textarea
                        className={`${inputClass} h-auto min-h-32 py-3`}
                        onChange={(event) =>
                          updateDraft(agent.id, { restrictions: event.target.value })
                        }
                        rows={5}
                        value={draft.restrictions}
                      />
                    </Field>
                    <p className="text-sm text-[#647067]">
                      Lo que escribas entre llaves, como {"{company_name}"} o{" "}
                      {"{business_hours}"}, se cambia solo por los datos de tu negocio.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <Question
        hint="Vale para los tres. Luego puedes cambiarlo cuando quieras."
        title="¿Con qué tono quieres que hablen?"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {agentTones.map((option) => (
            <OptionCard
              active={tone === option.value}
              description={option.description}
              key={option.value}
              label={option.label}
              onClick={() => setTone(option.value)}
            />
          ))}
        </div>
      </Question>

      <Question
        hint="En cada chat puedes apagar o encender la IA con un botón."
        title="¿Quién responde los chats nuevos?"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                description:
                  "Los agentes contestan al instante. Si el cliente pide hablar con alguien, te avisan.",
                icon: Bot,
                label: "La IA responde sola",
                value: "ai",
              },
              {
                description:
                  "Los chats llegan a tu bandeja y una persona decide cuándo dejar que la IA siga.",
                icon: Headphones,
                label: "Una persona primero",
                value: "handoff",
              },
            ] as const
          ).map((option) => {
            const active = ctx.defaultConversationMode === option.value;

            return (
              <button
                aria-pressed={active}
                className={`grid gap-2 rounded-xl border-2 p-4 text-left transition ${
                  active
                    ? "border-[#10231c] bg-[#eef6df]"
                    : "border-[#e2e6df] bg-white hover:border-[#cbd2c6]"
                }`}
                disabled={savingMode}
                key={option.value}
                onClick={() => saveMode(option.value)}
                type="button"
              >
                <span className="flex items-center gap-2 text-base font-semibold">
                  <option.icon size={18} />
                  {option.label}
                </span>
                <span className="text-sm text-[#4d5a51]">{option.description}</span>
              </button>
            );
          })}
        </div>
      </Question>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <StepFooter
        busy={saving}
        nextLabel="Confirmar mis agentes"
        onBack={ctx.goBack}
        onNext={confirm}
      />
    </div>
  );
}
