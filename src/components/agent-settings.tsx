"use client";

import { useState } from "react";
import {
  BookOpenText,
  Bot,
  Headphones,
  Loader2,
  Play,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";

import type { Json } from "@/lib/supabase/database.types";
import type { DefaultConversationMode } from "@/lib/conversation-default";
import { createClient } from "@/lib/supabase/client";

type AgentType = "setter" | "booking" | "support";

type AgentItem = {
  config: Json;
  id: string;
  is_active: boolean;
  model: string;
  name: string;
  system_prompt: string;
  temperature: number;
  type: string;
  workspace_id: string;
};

type WorkspaceAsset = {
  content: string;
  id: string;
  kind: "business_profile" | "tool" | "template" | "knowledge";
  status: "draft" | "active" | "archived";
  title: string;
  workspace_id: string;
};

type AgentSettingsProps = {
  agents: AgentItem[];
  defaultConversationMode?: DefaultConversationMode;
  knowledgeAssets?: WorkspaceAsset[];
  tools?: WorkspaceAsset[];
  workspaceId?: string | null;
};

type AgentConfig = {
  agent_name?: string;
  default_agent_key?: AgentType;
  enabled_tools: string[];
  job_title?: string;
  knowledge_asset_ids: string[];
  onboarding_agent_configured?: boolean;
  router_description: string;
};

const agentTypeOptions: Array<{ label: string; value: AgentType }> = [
  { label: "Setter / Ventas", value: "setter" },
  { label: "Citas", value: "booking" },
  { label: "Información", value: "support" },
];

function isAgentType(value: unknown): value is AgentType {
  return value === "setter" || value === "booking" || value === "support";
}

function normalizeAgentType(value: unknown): AgentType {
  return isAgentType(value) ? value : "support";
}

function getAgentTypeLabel(value: AgentType) {
  return agentTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function splitAgentDisplayName(value?: string | null) {
  const cleanValue = value?.trim() ?? "";
  const [namePart, ...jobParts] = cleanValue.split(/\s+-\s+/);
  const cleanJob = jobParts.join(" - ").replace(/\s+IA$/i, "").trim();

  return {
    agentName: namePart?.trim() || cleanValue || "Mateo",
    jobTitle: cleanJob || "Soporte",
  };
}

function buildAgentDisplayName(agentName: string, jobTitle: string) {
  const cleanName = agentName.trim() || "Mateo";
  const cleanJob = jobTitle.trim() || "Soporte";

  return `${cleanName} - ${cleanJob}`;
}

function getAgentConfig(config: Json): AgentConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {
      agent_name: "Mateo",
      default_agent_key: undefined,
      enabled_tools: [],
      job_title: "Soporte",
      knowledge_asset_ids: [],
      onboarding_agent_configured: false,
      router_description: "",
    };
  }

  return {
    agent_name:
      typeof config.agent_name === "string" ? config.agent_name : undefined,
    default_agent_key: isAgentType(config.default_agent_key)
      ? config.default_agent_key
      : undefined,
    enabled_tools: Array.isArray(config.enabled_tools)
      ? config.enabled_tools.filter((item): item is string => typeof item === "string")
      : [],
    job_title: typeof config.job_title === "string" ? config.job_title : undefined,
    knowledge_asset_ids: Array.isArray(config.knowledge_asset_ids)
      ? config.knowledge_asset_ids.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    onboarding_agent_configured: config.onboarding_agent_configured === true,
    router_description:
      typeof config.router_description === "string" ? config.router_description : "",
  };
}

function mergeAgentConfig(config: Json, patch: AgentConfig): Json {
  const current =
    config && typeof config === "object" && !Array.isArray(config) ? config : {};
  const currentConfigured =
    (current as Record<string, unknown>).onboarding_agent_configured === true;

  return {
    ...current,
    default_agent_key:
      patch.default_agent_key ??
      (isAgentType((current as Record<string, unknown>).default_agent_key)
        ? (current as Record<string, AgentType>).default_agent_key
        : undefined),
    enabled_tools: patch.enabled_tools,
    agent_name: patch.agent_name,
    job_title: patch.job_title,
    knowledge_asset_ids: patch.knowledge_asset_ids,
    onboarding_agent_configured:
      patch.onboarding_agent_configured ?? currentConfigured,
    router_description: patch.router_description,
  };
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function sortAgents(agents: AgentItem[]) {
  const order: Record<AgentType, number> = { support: 0, setter: 1, booking: 2 };

  return [...agents].sort((left, right) => {
    const leftType = getAgentConfig(left.config).default_agent_key;
    const rightType = getAgentConfig(right.config).default_agent_key;

    return (leftType ? order[leftType] : 3) - (rightType ? order[rightType] : 3);
  });
}

const responseStyles = [
  {
    description: "Preciso, controlado y pegado al RAG.",
    label: "Amigable",
    value: "0.3",
  },
  {
    description: "Conversacional y equilibrado.",
    label: "Natural",
    value: "0.5",
  },
  {
    description: "Mas expresivo y variable.",
    label: "Creativo",
    value: "0.8",
  },
] as const;

function getResponseStyleValue(temperature?: number | string | null) {
  const value = Number(temperature ?? 0.5);

  if (value <= 0.35) {
    return "0.3";
  }

  if (value <= 0.65) {
    return "0.5";
  }

  return "0.8";
}

function parseAgentPrompt(prompt?: string | null) {
  const value = prompt ?? "";
  const rulesMarker = "\n\nReglas -- que SI debe hacer:\n";
  const restrictionsMarker = "\n\nRestricciones -- que NUNCA debe hacer:\n";
  const instructionsPrefix = "Instrucciones del agente:\n";

  if (!value.includes(rulesMarker) && !value.includes(restrictionsMarker)) {
    return {
      rules: "",
      restrictions: "",
      system_prompt: value,
    };
  }

  const [instructionsBlock, afterRules = ""] = value.split(rulesMarker);
  const [rules = "", restrictions = ""] = afterRules.split(restrictionsMarker);

  return {
    rules,
    restrictions,
    system_prompt: instructionsBlock.replace(instructionsPrefix, ""),
  };
}

function buildAgentPrompt({
  rules,
  restrictions,
  system_prompt,
}: {
  rules: string;
  restrictions: string;
  system_prompt: string;
}) {
  return [
    `Instrucciones del agente:\n${system_prompt.trim()}`,
    rules.trim() ? `Reglas -- que SI debe hacer:\n${rules.trim()}` : "",
    restrictions.trim()
      ? `Restricciones -- que NUNCA debe hacer:\n${restrictions.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className={`flex h-7 w-[62px] shrink-0 items-center rounded-full p-0.5 text-[10px] font-bold uppercase tracking-normal transition disabled:opacity-60 ${
        checked ? "bg-[#22a7c7] text-white shadow-sm" : "bg-[#eef2eb] text-[#647067]"
      }`}
      disabled={disabled}
      onClick={onChange}
      type="button"
    >
      <span
        className={`grid size-6 place-items-center rounded-full bg-white shadow transition ${
          checked ? "order-2" : "order-1"
        }`}
      />
      <span className={`flex-1 text-center ${checked ? "order-1" : "order-2"}`}>
        {checked ? "ON" : "OFF"}
      </span>
    </button>
  );
}

export function AgentSettings({
  agents,
  defaultConversationMode = "ai",
  knowledgeAssets = [],
  tools = [],
  workspaceId,
}: AgentSettingsProps) {
  const supabase = createClient();
  const [localAgents, setLocalAgents] = useState(() => sortAgents(agents));
  const [selectedAgentId, setSelectedAgentId] = useState(
    () => sortAgents(agents)[0]?.id ?? "",
  );
  const selectedAgent =
    localAgents.find((agent) => agent.id === selectedAgentId) ?? localAgents[0];
  const selectedConfig = getAgentConfig(selectedAgent?.config ?? {});
  const selectedPrompt = parseAgentPrompt(selectedAgent?.system_prompt);
  const selectedDisplayName = splitAgentDisplayName(selectedAgent?.name);
  const [form, setForm] = useState(() => ({
    agent_name: selectedConfig.agent_name ?? selectedDisplayName.agentName,
    enabled_tools: selectedConfig.enabled_tools,
    is_active: selectedAgent?.is_active ?? false,
    job_title: selectedConfig.job_title ?? selectedDisplayName.jobTitle,
    knowledge_asset_ids: selectedConfig.knowledge_asset_ids,
    model: selectedAgent?.model ?? "gpt-5.4-mini",
    rules: selectedPrompt.rules,
    router_description: selectedConfig.router_description,
    restrictions: selectedPrompt.restrictions,
    system_prompt: selectedPrompt.system_prompt,
    temperature: getResponseStyleValue(selectedAgent?.temperature),
    type: normalizeAgentType(selectedAgent?.type),
  }));
  const [testMessage, setTestMessage] = useState(
    "Hola, quiero agendar una cita esta semana.",
  );
  const [testAnswer, setTestAnswer] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conversationMode, setConversationMode] = useState(defaultConversationMode);
  const [isSavingConversationMode, setIsSavingConversationMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  async function saveDefaultConversationMode(mode: DefaultConversationMode) {
    if (!workspaceId || mode === conversationMode) {
      return;
    }

    setIsSavingConversationMode(true);
    setStatus("");
    const response = await fetch("/api/workspaces", {
      body: JSON.stringify({
        action: "set_default_conversation_mode",
        defaultConversationMode: mode,
        workspaceId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setStatus(payload.error ?? "No se pudo guardar el modo de conversación.");
      setIsSavingConversationMode(false);
      return;
    }

    setConversationMode(mode);
    setStatus(`Conversaciones nuevas: ${mode === "ai" ? "IA" : "Handoff"}.`);
    setIsSavingConversationMode(false);
  }

  function selectAgent(agent: AgentItem) {
    const config = getAgentConfig(agent.config);
    const prompt = parseAgentPrompt(agent.system_prompt);
    const displayName = splitAgentDisplayName(agent.name);

    setSelectedAgentId(agent.id);
    setForm({
      agent_name: config.agent_name ?? displayName.agentName,
      enabled_tools: config.enabled_tools,
      is_active: agent.is_active,
      job_title: config.job_title ?? displayName.jobTitle,
      knowledge_asset_ids: config.knowledge_asset_ids,
      model: agent.model,
      rules: prompt.rules,
      router_description: config.router_description,
      restrictions: prompt.restrictions,
      system_prompt: prompt.system_prompt,
      temperature: getResponseStyleValue(agent.temperature),
      type: normalizeAgentType(agent.type),
    });
    setStatus("");
    setTestAnswer("");
    setShowDeleteDialog(false);
  }

  async function saveAgent() {
    if (!selectedAgent) {
      return;
    }

    setIsSaving(true);
    setStatus("");

    const payload = {
      config: mergeAgentConfig(selectedAgent.config, {
        agent_name: form.agent_name,
        default_agent_key: form.type,
        enabled_tools: form.enabled_tools,
        job_title: form.job_title,
        knowledge_asset_ids: form.knowledge_asset_ids,
        onboarding_agent_configured: true,
        router_description: form.router_description,
      }),
      is_active: form.is_active,
      model: form.model.trim(),
      name: buildAgentDisplayName(form.agent_name, form.job_title),
      system_prompt: buildAgentPrompt(form),
      temperature: Number(form.temperature),
      type: form.type,
    };

    const { error } = await supabase
      .from("agents")
      .update(payload)
      .eq("id", selectedAgent.id)
      .eq("workspace_id", selectedAgent.workspace_id);

    if (error) {
      setStatus(error.message);
      setIsSaving(false);
      return;
    }

    setLocalAgents((current) =>
      current.map((agent) =>
        agent.id === selectedAgent.id ? { ...agent, ...payload } : agent,
      ),
    );
    setStatus("Agente guardado.");
    setIsSaving(false);
  }

  async function createBaseAgent() {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    setIsCreating(true);
    setStatus("");

    const { data, error } = await supabase
      .from("agents")
      .insert({
        is_active: localAgents.length === 0,
        model: "gpt-5.4-mini",
        name: localAgents.length === 0 ? "Mateo - Soporte" : "Mateo - Soporte",
        system_prompt:
          "Eres un agente de WhatsApp claro, breve y orientado a agendar o resolver la necesidad del contacto. Responde en español, haz una pregunta a la vez y pide datos solo cuando hagan falta.",
        temperature: 0.4,
        type: "support",
        workspace_id: workspaceId,
        config: {
          agent_name: "Mateo",
          default_agent_key: "support",
          enabled_tools: [],
          job_title: "Soporte",
          knowledge_asset_ids: [],
          onboarding_agent_configured: true,
          router_description:
            "Usar para primeros mensajes, calificación de leads, dudas generales y pasar a citas cuando el contacto quiera agendar.",
        },
      })
      .select(
        "id, workspace_id, name, type, is_active, model, system_prompt, temperature, config",
      )
      .single();

    if (error) {
      setStatus(error.message);
      setIsCreating(false);
      return;
    }

    setLocalAgents((current) => sortAgents([data, ...current]));
    setSelectedAgentId(data.id);
    const dataPrompt = parseAgentPrompt(data.system_prompt);
    const dataConfig = getAgentConfig(data.config);
    const dataDisplayName = splitAgentDisplayName(data.name);
    setForm({
      agent_name: dataConfig.agent_name ?? dataDisplayName.agentName,
      enabled_tools: dataConfig.enabled_tools,
      is_active: data.is_active,
      job_title: dataConfig.job_title ?? dataDisplayName.jobTitle,
      knowledge_asset_ids: dataConfig.knowledge_asset_ids,
      model: data.model,
      rules: dataPrompt.rules,
      router_description: dataConfig.router_description,
      restrictions: dataPrompt.restrictions,
      system_prompt: dataPrompt.system_prompt,
      temperature: getResponseStyleValue(data.temperature),
      type: normalizeAgentType(data.type),
    });
    setStatus("Agente creado.");
    setIsCreating(false);
  }

  async function deleteAgent() {
    if (!selectedAgent) {
      return;
    }

    setIsDeleting(true);
    setStatus("");

    const { error } = await supabase
      .from("agents")
      .delete()
      .eq("id", selectedAgent.id)
      .eq("workspace_id", selectedAgent.workspace_id);

    if (error) {
      setStatus(error.message);
      setIsDeleting(false);
      return;
    }

    const remainingAgents = localAgents.filter((agent) => agent.id !== selectedAgent.id);
    const nextAgent = remainingAgents[0];

    setLocalAgents(remainingAgents);
    setSelectedAgentId(nextAgent?.id ?? "");

    if (nextAgent) {
      const config = getAgentConfig(nextAgent.config);
      const prompt = parseAgentPrompt(nextAgent.system_prompt);
      const displayName = splitAgentDisplayName(nextAgent.name);
      setForm({
        agent_name: config.agent_name ?? displayName.agentName,
        enabled_tools: config.enabled_tools,
        is_active: nextAgent.is_active,
        job_title: config.job_title ?? displayName.jobTitle,
        knowledge_asset_ids: config.knowledge_asset_ids,
        model: nextAgent.model,
        rules: prompt.rules,
        router_description: config.router_description,
        restrictions: prompt.restrictions,
        system_prompt: prompt.system_prompt,
        temperature: getResponseStyleValue(nextAgent.temperature),
        type: normalizeAgentType(nextAgent.type),
      });
    }

    setStatus("Agente borrado.");
    setShowDeleteDialog(false);
    setIsDeleting(false);
  }

  async function testPrompt() {
    if (!selectedAgent || !testMessage.trim()) {
      return;
    }

    setIsTesting(true);
    setStatus("");
    setTestAnswer("");

    const response = await fetch("/api/agents/test-prompt", {
      body: JSON.stringify({
        agentId: selectedAgent.id,
        message: testMessage.trim(),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      setStatus(payload.error ?? "No se pudo probar el prompt.");
      setIsTesting(false);
      return;
    }

    setTestAnswer(payload.answer ?? "");
    setStatus("Prompt probado.");
    setIsTesting(false);
  }

  if (!selectedAgent) {
    return (
      <section className="min-w-0 rounded-lg border border-[#d9ded3] bg-white p-4">
        <div className="flex items-center gap-2">
          <Bot className="text-[#35735b]" size={19} />
          <h2 className="text-base font-semibold">Configuración de agentes</h2>
        </div>
        <p className="mt-3 text-sm text-[#647067]">
          Crea un agente para configurar instrucciones, modelo y pruebas.
        </p>
        {status ? <p className="mt-3 text-sm text-[#647067]">{status}</p> : null}
        <button
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
          disabled={isCreating || !workspaceId}
          onClick={createBaseAgent}
          type="button"
        >
          {isCreating ? <Loader2 className="animate-spin" size={16} /> : <Bot size={16} />}
          Crear agente base
        </button>
      </section>
    );
  }

  return (
    <>
    <section className="min-w-0 rounded-lg border border-[#d9ded3] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="text-[#35735b]" size={19} />
          <h2 className="text-base font-semibold">Configuración de agentes</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#647067]">Conversaciones nuevas</span>
          <div className="inline-flex rounded-lg border border-[#cbd2c6] bg-[#f6f7f3] p-0.5">
            <button
              aria-pressed={conversationMode === "ai"}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition ${
                conversationMode === "ai"
                  ? "bg-[#10231c] text-white"
                  : "text-[#4d5a51] hover:bg-white"
              }`}
              disabled={isSavingConversationMode}
              onClick={() => saveDefaultConversationMode("ai")}
              type="button"
            >
              <Bot size={14} />
              IA
            </button>
            <button
              aria-pressed={conversationMode === "handoff"}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition ${
                conversationMode === "handoff"
                  ? "bg-[#10231c] text-white"
                  : "text-[#4d5a51] hover:bg-white"
              }`}
              disabled={isSavingConversationMode}
              onClick={() => saveDefaultConversationMode("handoff")}
              type="button"
            >
              {isSavingConversationMode ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Headphones size={14} />
              )}
              Handoff
            </button>
          </div>
          <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
            {getAgentTypeLabel(form.type)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#647067]">Agentes</p>
          <p className="mt-1 text-lg font-semibold">{localAgents.length}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-[#647067]">Tools</p>
          <p className="mt-1 text-lg font-semibold">{tools.length}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-[#647067]">Base</p>
          <p className="mt-1 text-lg font-semibold">{knowledgeAssets.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[220px_1fr]">
        <div className="grid content-start gap-2" data-tour="agent-list">
          {localAgents.map((agent) => (
            <button
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                agent.id === selectedAgent.id
                  ? "border-[#35735b] bg-[#eef6df]"
                  : "border-[#e2e6df] hover:bg-[#f6f7f3]"
              }`}
              key={agent.id}
              onClick={() => selectAgent(agent)}
              type="button"
            >
              <p className="font-semibold">{agent.name}</p>
              <p className="mt-1 text-xs text-[#647067]">
                {agent.is_active ? "Activo" : "Pausado"} - {agent.model}
              </p>
            </button>
          ))}
          <button
            className="rounded-lg border border-dashed border-[#cbd2c6] px-3 py-2 text-left text-sm text-[#4d5a51] transition hover:bg-[#f6f7f3]"
            disabled={isCreating}
            onClick={createBaseAgent}
            type="button"
          >
            {isCreating ? "Creando..." : "+ Crear otro agente"}
          </button>
        </div>

        <div className="grid min-w-0 gap-4 [&>*]:min-w-0 [&_input]:min-w-0 [&_label]:min-w-0 [&_select]:min-w-0 [&_select]:w-full [&_textarea]:min-w-0 [&_textarea]:w-full">
          <div className="grid gap-3 md:grid-cols-3" data-tour="agent-identity">
            <label className="grid gap-1.5 text-sm font-medium">
              Nombre
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                onChange={(event) =>
                  setForm((current) => ({ ...current, agent_name: event.target.value }))
                }
                placeholder="Mateo"
                value={form.agent_name}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Trabajo
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                onChange={(event) =>
                  setForm((current) => ({ ...current, job_title: event.target.value }))
                }
                placeholder="Soporte"
                value={form.job_title}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Tipo de agente
              <select
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as AgentType,
                  }))
                }
                value={form.type}
              >
                {agentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Modelo OpenAI
              <select
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                onChange={(event) =>
                  setForm((current) => ({ ...current, model: event.target.value }))
                }
                value={form.model}
              >
                <option value="gpt-5.4-mini">gpt-5.4-mini</option>
                <option value="gpt-5.5">gpt-5.5</option>
                <option value="gpt-5.4-nano">gpt-5.4-nano</option>
                <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[#e2e6df] px-3 py-2">
              <p className="text-sm font-medium">Estado del agente</p>
              <ToggleSwitch
                checked={form.is_active}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    is_active: !current.is_active,
                  }))
                }
              />
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Estilo
              <select
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    temperature: event.target.value,
                  }))
                }
                value={form.temperature}
              >
                {responseStyles.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-medium">
            Descripción para router
            <textarea
              className="min-h-24 rounded-lg border border-[#cbd2c6] p-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  router_description: event.target.value,
                }))
              }
              placeholder="Ej: Usar este agente cuando el contacto pregunte precios, ubicación, servicios y dudas generales."
              value={form.router_description}
            />
            <span className="text-xs font-normal text-[#647067]">
              El router compara esta descripción con el mensaje y decide que agente activo responde.
            </span>
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Instrucciones del agente
            <textarea
              className="min-h-36 rounded-lg border border-[#cbd2c6] p-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  system_prompt: event.target.value,
                }))
              }
              value={form.system_prompt}
            />
            <span className="text-xs font-normal text-[#647067]">
              Define identidad, tono, objetivo y como debe conversar.
            </span>
          </label>

          <div className="grid gap-3 md:grid-cols-2" data-tour="agent-rules">
            <label className="grid gap-1.5 text-sm font-medium">
              Reglas -- que SI debe hacer
              <textarea
                className="min-h-28 rounded-lg border border-[#cbd2c6] p-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    rules: event.target.value,
                  }))
                }
                placeholder={
                  "Presentate cuando sea necesario.\nHaz una pregunta a la vez.\nUsa la base de conocimiento antes de responder."
                }
                value={form.rules}
              />
              <span className="text-xs font-normal text-[#647067]">
                Una regla por línea. Se inyectan como obligaciones del agente.
              </span>
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
              Restricciones -- que NUNCA debe hacer
              <textarea
                className="min-h-28 rounded-lg border border-[#cbd2c6] p-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    restrictions: event.target.value,
                  }))
                }
                placeholder={
                  "No inventes precios ni horarios.\nNo confirmes citas sin datos completos.\nNo prometas cosas fuera del servicio."
                }
                value={form.restrictions}
              />
              <span className="text-xs font-normal text-[#647067]">
                Una restriccion por línea. Tiene prioridad sobre respuestas libres.
              </span>
            </label>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2 [&>*]:min-w-0">
            <div className="min-w-0 rounded-lg border border-[#e2e6df] p-3">
              <div className="flex items-center gap-2">
                <Wrench className="text-[#35735b]" size={17} />
                <h3 className="text-sm font-semibold">Tools asignadas</h3>
              </div>
              <div className="mt-3 grid min-w-0 gap-2">
                {tools.map((tool) => (
                  <label
                    className="flex min-w-0 items-start gap-2 rounded-lg border border-[#e2e6df] px-3 py-2 text-sm"
                    key={tool.id}
                  >
                    <input
                      checked={form.enabled_tools.includes(tool.id)}
                      className="mt-1"
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          enabled_tools: toggleValue(current.enabled_tools, tool.id),
                        }))
                      }
                      type="checkbox"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{tool.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-[#647067]">
                        {tool.content || "Tool disponible para este agente."}
                      </span>
                    </span>
                  </label>
                ))}
                {tools.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
                    Crea tools en la pestana Tools para asignarlas aquí.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-[#e2e6df] p-3">
              <div className="flex items-center gap-2">
                <BookOpenText className="text-[#35735b]" size={17} />
                <h3 className="text-sm font-semibold">Documentos RAG asignados</h3>
              </div>
              <p className="mt-1 text-xs text-[#647067]">
                Selecciona los documentos que este agente puede usar como contexto.
              </p>
              <div className="mt-3 grid min-w-0 gap-2">
                {knowledgeAssets.map((asset) => (
                  <div
                    className="flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-lg border border-[#e2e6df] px-3 py-2 text-sm"
                    key={asset.id}
                  >
                    <span className="min-w-0 truncate font-medium">
                      {asset.title}
                    </span>
                    <ToggleSwitch
                      checked={form.knowledge_asset_ids.includes(asset.id)}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          knowledge_asset_ids: toggleValue(
                            current.knowledge_asset_ids,
                            asset.id,
                          ),
                        }))
                      }
                    />
                  </div>
                ))}
                {knowledgeAssets.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
                    Agrega documentos en Knowledge Base para asignarlos aquí.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="grid gap-3 rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-3"
            data-tour="agent-test"
          >
            <label className="grid gap-1.5 text-sm font-medium">
              Probar prompt
              <textarea
                className="min-h-20 rounded-lg border border-[#cbd2c6] p-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                onChange={(event) => setTestMessage(event.target.value)}
                value={testMessage}
              />
            </label>
            {testAnswer ? (
              <div className="rounded-lg border border-[#d9ded3] bg-white p-3 text-sm">
                <p className="text-xs font-semibold uppercase text-[#647067]">
                  Respuesta
                </p>
                <p className="mt-2 whitespace-pre-wrap">{testAnswer}</p>
              </div>
            ) : null}
          </div>

          {status ? <p className="text-sm text-[#647067]">{status}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
              disabled={isSaving}
              onClick={saveAgent}
              type="button"
            >
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Guardar agente
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium disabled:bg-[#f3f4ef]"
              disabled={isTesting}
              onClick={testPrompt}
              type="button"
            >
              {isTesting ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              Probar prompt
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-700 disabled:bg-[#f3f4ef]"
              disabled={isDeleting || localAgents.length === 0}
              onClick={() => setShowDeleteDialog(true)}
              type="button"
            >
              {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              Borrar agente
            </button>
          </div>
        </div>
      </div>
    </section>
      {showDeleteDialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#10231c]/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-[#d9ded3] bg-white p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
                <Trash2 size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[#20231f]">
                  Borrar agente
                </h3>
                <p className="mt-1 text-sm text-[#647067]">
                  Vas a borrar <span className="font-semibold">{selectedAgent.name}</span>.
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium text-[#20231f] disabled:bg-[#f3f4ef]"
                disabled={isDeleting}
                onClick={() => setShowDeleteDialog(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-700 px-3 text-sm font-medium text-white disabled:bg-red-300"
                disabled={isDeleting}
                onClick={deleteAgent}
                type="button"
              >
                {isDeleting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Trash2 size={16} />
                )}
                Borrar agente
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
