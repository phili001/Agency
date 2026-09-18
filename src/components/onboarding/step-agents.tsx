"use client";

import { Bot, ExternalLink, Headphones } from "lucide-react";
import { useState } from "react";

import type { DefaultConversationMode } from "@/lib/conversation-default";
import { createClient } from "@/lib/supabase/client";

import { Field, HowTo, Notice, StepFooter, StepHeading, inputClass, readApiError } from "./shared";
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

export function StepAgents({ ctx }: { ctx: StepContext }) {
  const supabase = createClient();
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(ctx.agents.map((agent) => [agent.id, getAgentName(agent)])),
  );
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [error, setError] = useState("");

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
    setSaving(true);
    setError("");

    // Solo se tocan los agentes renombrados. Al guardar se marcan como
    // personalizados, igual que hace la pantalla Agentes.
    const renamed = ctx.agents.filter(
      (agent) => (names[agent.id] ?? "").trim() && names[agent.id].trim() !== getAgentName(agent),
    );

    for (const agent of renamed) {
      const cleanName = names[agent.id].trim();
      const jobTitle = getJobTitle(agent);
      const { error: updateError } = await supabase
        .from("agents")
        .update({
          config: { ...getConfig(agent), agent_name: cleanName, onboarding_agent_configured: true },
          name: jobTitle ? `${cleanName} - ${jobTitle}` : cleanName,
        })
        .eq("id", agent.id)
        .eq("workspace_id", ctx.workspace.id);

      if (updateError) {
        setError("No se pudo guardar el nombre. Inténtalo otra vez.");
        setSaving(false);
        return;
      }
    }

    if (renamed.length > 0) {
      ctx.setAgents(
        ctx.agents.map((agent) => {
          if (!renamed.includes(agent)) {
            return agent;
          }

          const cleanName = names[agent.id].trim();
          const jobTitle = getJobTitle(agent);

          return {
            ...agent,
            config: {
              ...getConfig(agent),
              agent_name: cleanName,
              onboarding_agent_configured: true,
            },
            name: jobTitle ? `${cleanName} - ${jobTitle}` : cleanName,
          };
        }),
      );
    }

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
        description="Ya vienen listos y entrenados con lo que escribiste de tu negocio. Puedes cambiarles el nombre para que suene como tu equipo."
      />

      <HowTo
        items={[
          <>Lee qué hace cada agente. Si quieres, cámbiale el <span className="font-medium">nombre</span> en la casilla de la derecha.</>,
          <>Elige abajo <span className="font-medium">quién responde los chats nuevos</span>: la IA sola o una persona primero.</>,
          <>Pulsa <span className="font-medium">Confirmar mis agentes</span>. No hace falta tocar nada más para que funcionen.</>,
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

          return (
            <div
              className="grid gap-3 rounded-xl border border-[#e2e6df] bg-[#fafbf8] p-4 md:grid-cols-[1fr_220px]"
              key={agent.id}
            >
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
                  onChange={(event) =>
                    setNames((current) => ({ ...current, [agent.id]: event.target.value }))
                  }
                  value={names[agent.id] ?? ""}
                />
              </Field>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3">
        <div>
          <h3 className="text-base font-semibold">¿Quién responde los chats nuevos?</h3>
          <p className="mt-1 text-sm text-[#647067]">
            Puedes cambiarlo cuando quieras, y en cada chat puedes apagar o encender
            la IA con un botón.
          </p>
        </div>
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
      </div>

      <a
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#35735b] underline-offset-4 hover:underline"
        href="/agentes"
        rel="noreferrer"
        target="_blank"
      >
        Quiero editar sus instrucciones a fondo
        <ExternalLink size={14} />
      </a>

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
