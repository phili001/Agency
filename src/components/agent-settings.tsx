"use client";

import { useState } from "react";
import { Bot, Loader2, Play, Save } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type AgentItem = {
  id: string;
  is_active: boolean;
  model: string;
  name: string;
  system_prompt: string;
  temperature: number;
  type: string;
  workspace_id: string;
};

type AgentSettingsProps = {
  agents: AgentItem[];
  workspaceId?: string | null;
};

export function AgentSettings({ agents, workspaceId }: AgentSettingsProps) {
  const supabase = createClient();
  const [localAgents, setLocalAgents] = useState(agents);
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const selectedAgent =
    localAgents.find((agent) => agent.id === selectedAgentId) ?? localAgents[0];
  const [form, setForm] = useState(() => ({
    is_active: selectedAgent?.is_active ?? false,
    model: selectedAgent?.model ?? "gpt-5.4-mini",
    name: selectedAgent?.name ?? "",
    system_prompt: selectedAgent?.system_prompt ?? "",
    temperature: String(selectedAgent?.temperature ?? 0.4),
  }));
  const [testMessage, setTestMessage] = useState(
    "Hola, quiero agendar una cita esta semana.",
  );
  const [testAnswer, setTestAnswer] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  function selectAgent(agent: AgentItem) {
    setSelectedAgentId(agent.id);
    setForm({
      is_active: agent.is_active,
      model: agent.model,
      name: agent.name,
      system_prompt: agent.system_prompt,
      temperature: String(agent.temperature),
    });
    setStatus("");
    setTestAnswer("");
  }

  async function saveAgent() {
    if (!selectedAgent) {
      return;
    }

    setIsSaving(true);
    setStatus("");

    const payload = {
      is_active: form.is_active,
      model: form.model.trim(),
      name: form.name.trim(),
      system_prompt: form.system_prompt,
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
      })
      .select("id, workspace_id, name, type, is_active, model, system_prompt, temperature")
      .single();

    if (error) {
      setStatus(error.message);
      setIsCreating(false);
      return;
    }

    setLocalAgents((current) => [data, ...current]);
    setSelectedAgentId(data.id);
    setForm({
      is_active: data.is_active,
      model: data.model,
      name: data.name,
      system_prompt: data.system_prompt,
      temperature: String(data.temperature),
    });
    setStatus("Agente creado.");
    setIsCreating(false);
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
          Crea un agente en Supabase para configurar prompt, modelo y pruebas.
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

          <div className="grid gap-3 md:grid-cols-[1fr_140px]">
            <label className="flex items-center gap-2 rounded-lg border border-[#e2e6df] px-3 py-2 text-sm font-medium">
              <input
                checked={form.is_active}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Agente activo
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Temperatura
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                max="2"
                min="0"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    temperature: event.target.value,
                  }))
                }
                step="0.1"
                type="number"
                value={form.temperature}
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-medium">
            Prompt del agente
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
          </label>

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
          </div>
        </div>
      </div>
    </section>
  );
}
