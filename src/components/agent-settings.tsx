"use client";

import { useState } from "react";
import {
  BookOpenText,
  Bot,
  Loader2,
  Play,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";

import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";

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
  knowledgeAssets?: WorkspaceAsset[];
  tools?: WorkspaceAsset[];
  workspaceId?: string | null;
};

type AgentConfig = {
  enabled_tools: string[];
  knowledge_asset_ids: string[];
  onboarding_agent_configured?: boolean;
  router_description: string;
};

function getAgentConfig(config: Json): AgentConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {
      enabled_tools: [],
      knowledge_asset_ids: [],
      onboarding_agent_configured: false,
      router_description: "",
    };
  }

  return {
    enabled_tools: Array.isArray(config.enabled_tools)
      ? config.enabled_tools.filter((item): item is string => typeof item === "string")
      : [],
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
    enabled_tools: patch.enabled_tools,
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
  knowledgeAssets = [],
  tools = [],
  workspaceId,
}: AgentSettingsProps) {
  const supabase = createClient();
  const [localAgents, setLocalAgents] = useState(agents);
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const selectedAgent =
    localAgents.find((agent) => agent.id === selectedAgentId) ?? localAgents[0];
  const selectedConfig = getAgentConfig(selectedAgent?.config ?? {});
  const selectedPrompt = parseAgentPrompt(selectedAgent?.system_prompt);
  const [form, setForm] = useState(() => ({
    enabled_tools: selectedConfig.enabled_tools,
    is_active: selectedAgent?.is_active ?? false,
    knowledge_asset_ids: selectedConfig.knowledge_asset_ids,
    model: selectedAgent?.model ?? "gpt-5.4-mini",
    name: selectedAgent?.name ?? "",
    rules: selectedPrompt.rules,
    router_description: selectedConfig.router_description,
    restrictions: selectedPrompt.restrictions,
    system_prompt: selectedPrompt.system_prompt,
    temperature: getResponseStyleValue(selectedAgent?.temperature),
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  function selectAgent(agent: AgentItem) {
    const config = getAgentConfig(agent.config);
    const prompt = parseAgentPrompt(agent.system_prompt);

    setSelectedAgentId(agent.id);
    setForm({
      enabled_tools: config.enabled_tools,
      is_active: agent.is_active,
      knowledge_asset_ids: config.knowledge_asset_ids,
      model: agent.model,
      name: agent.name,
      rules: prompt.rules,
      router_description: config.router_description,
      restrictions: prompt.restrictions,
      system_prompt: prompt.system_prompt,
      temperature: getResponseStyleValue(agent.temperature),
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
        enabled_tools: form.enabled_tools,
        knowledge_asset_ids: form.knowledge_asset_ids,
        onboarding_agent_configured: true,
        router_description: form.router_description,
      }),
      is_active: form.is_active,
      model: form.model.trim(),
      name: form.name.trim(),
      system_prompt: buildAgentPrompt(form),
      temperature: Number(form.temperature),
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
        name: localAgents.length === 0 ? "Sofia - Setter IA" : "Nuevo agente",
        system_prompt:
          "Eres un agente de WhatsApp claro, breve y orientado a agendar o resolver la necesidad del contacto. Responde en espanol, haz una pregunta a la vez y pide datos solo cuando hagan falta.",
        temperature: 0.4,
        type: "setter",
        workspace_id: workspaceId,
        config: {
          enabled_tools: [],
          knowledge_asset_ids: [],
          onboarding_agent_configured: true,
          router_description:
            "Usar para primeros mensajes, calificacion de leads, dudas generales y pasar a citas cuando el contacto quiera agendar.",
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

    setLocalAgents((current) => [data, ...current]);
    setSelectedAgentId(data.id);
    const dataPrompt = parseAgentPrompt(data.system_prompt);
    setForm({
      enabled_tools: getAgentConfig(data.config).enabled_tools,
      is_active: data.is_active,
      knowledge_asset_ids: getAgentConfig(data.config).knowledge_asset_ids,
      model: data.model,
      name: data.name,
      rules: dataPrompt.rules,
      router_description: getAgentConfig(data.config).router_description,
      restrictions: dataPrompt.restrictions,
      system_prompt: dataPrompt.system_prompt,
      temperature: getResponseStyleValue(data.temperature),
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
      setForm({
        enabled_tools: config.enabled_tools,
        is_active: nextAgent.is_active,
        knowledge_asset_ids: config.knowledge_asset_ids,
        model: nextAgent.model,
        name: nextAgent.name,
        rules: prompt.rules,
        router_description: config.router_description,
        restrictions: prompt.restrictions,
        system_prompt: prompt.system_prompt,
        temperature: getResponseStyleValue(nextAgent.temperature),
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
      <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
        <div className="flex items-center gap-2">
          <Bot className="text-[#35735b]" size={19} />
          <h2 className="text-base font-semibold">Configuracion de agentes</h2>
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
    <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="text-[#35735b]" size={19} />
          <h2 className="text-base font-semibold">Configuracion de agentes</h2>
        </div>
        <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
          {selectedAgent.type}
        </span>
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
        <div className="grid content-start gap-2">
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

        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Nombre
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                value={form.name}
              />
            </label>
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
            Descripcion para router
            <textarea
              className="min-h-24 rounded-lg border border-[#cbd2c6] p-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  router_description: event.target.value,
                }))
              }
              placeholder="Ej: Usar este agente cuando el contacto pregunte precios, ubicacion, servicios y dudas generales."
              value={form.router_description}
            />
            <span className="text-xs font-normal text-[#647067]">
              El router compara esta descripcion con el mensaje y decide que agente activo responde.
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

          <div className="grid gap-3 md:grid-cols-2">
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
                Una regla por linea. Se inyectan como obligaciones del agente.
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
                Una restriccion por linea. Tiene prioridad sobre respuestas libres.
              </span>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[#e2e6df] p-3">
              <div className="flex items-center gap-2">
                <Wrench className="text-[#35735b]" size={17} />
                <h3 className="text-sm font-semibold">Tools asignadas</h3>
              </div>
              <div className="mt-3 grid gap-2">
                {tools.map((tool) => (
                  <label
                    className="flex items-start gap-2 rounded-lg border border-[#e2e6df] px-3 py-2 text-sm"
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
                    <span>
                      <span className="block font-medium">{tool.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-[#647067]">
                        {tool.content || "Tool disponible para este agente."}
                      </span>
                    </span>
                  </label>
                ))}
                {tools.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
                    Crea tools en la pestana Tools para asignarlas aqui.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-[#e2e6df] p-3">
              <div className="flex items-center gap-2">
                <BookOpenText className="text-[#35735b]" size={17} />
                <h3 className="text-sm font-semibold">Documentos RAG asignados</h3>
              </div>
              <p className="mt-1 text-xs text-[#647067]">
                Selecciona los documentos que este agente puede usar como contexto.
              </p>
              <div className="mt-3 grid gap-2">
                {knowledgeAssets.map((asset) => (
                  <div
                    className="flex items-start justify-between gap-3 rounded-lg border border-[#e2e6df] px-3 py-2 text-sm"
                    key={asset.id}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{asset.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-[#647067]">
                        {asset.content || "Documento disponible para respuestas."}
                      </span>
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
                    Agrega documentos en Knowledge Base para asignarlos aqui.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-3">
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
                  Esta accion no se puede deshacer.
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
