import { NextResponse } from "next/server";

import type { Json } from "@/lib/supabase/database.types";
import {
  applyBusinessVariables,
  buildBusinessContext,
  getBusinessVariables,
} from "@/lib/business-profile";
import { getWorkspaceOpenAIKey } from "@/lib/integrations/openai";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

type OpenAIResponsePayload = {
  error?: {
    message?: string;
  };
  id?: string;
  model?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

type KnowledgeAsset = {
  content: string;
  id: string;
  title: string;
};

type BusinessProfileAsset = {
  content: string;
  metadata: Json;
  title: string;
};

type AgentLike = {
  config: Json;
  name: string;
};

function getAgentIdentity(agent: AgentLike) {
  const config =
    agent.config && typeof agent.config === "object" && !Array.isArray(agent.config)
      ? (agent.config as Record<string, unknown>)
      : {};
  const [fallbackName, ...fallbackJobParts] = agent.name.split(/\s+-\s+/);

  return {
    agentName:
      typeof config.agent_name === "string" && config.agent_name.trim()
        ? config.agent_name.trim()
        : fallbackName?.trim() || agent.name,
    jobTitle:
      typeof config.job_title === "string" && config.job_title.trim()
        ? config.job_title.trim()
        : fallbackJobParts.join(" - ").replace(/\s+IA$/i, "").trim(),
  };
}

function buildIdentityContext(agent: AgentLike) {
  const identity = getAgentIdentity(agent);
  const jobTitle = identity.jobTitle.replace(/\s+IA$/i, "").trim();
  const introduction = jobTitle
    ? `Soy ${identity.agentName}, del equipo de ${jobTitle.toLocaleLowerCase("es")}.`
    : `Soy ${identity.agentName}.`;

  return `Identidad personalizada:
- Te llamas ${identity.agentName}${identity.jobTitle ? ` y eres ${identity.jobTitle}` : ""}.
- Cuando tomes una conversacion, presentate de forma natural como: "${introduction}"
- Habla en primera persona y no uses prefijos como "IA:" o "assistant:".`;
}

function getKnowledgeAssetIds(config: Json) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [];
  }

  return Array.isArray(config.knowledge_asset_ids)
    ? config.knowledge_asset_ids.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
}

function buildInstructions(
  agent: AgentLike,
  systemPrompt: string | null,
  assets: KnowledgeAsset[],
  businessProfile?: BusinessProfileAsset | null,
) {
  const basePrompt =
    systemPrompt ||
    "Eres un agente de WhatsApp claro, breve y orientado a resolver.";
  const identity = getAgentIdentity(agent);
  const businessVariables = {
    ...getBusinessVariables(businessProfile),
    agent_name: identity.agentName,
    job_title: identity.jobTitle,
  };
  const promptWithVariables = applyBusinessVariables(basePrompt, businessVariables);
  const businessContext = buildBusinessContext(businessProfile);
  const identityContext = buildIdentityContext(agent);

  if (assets.length === 0) {
    return [identityContext, businessContext, promptWithVariables]
      .filter(Boolean)
      .join("\n\n");
  }

  const ragContext = assets
    .map(
      (asset, index) =>
        `[Documento RAG ${index + 1}: ${asset.title}]\n${asset.content.trim()}`,
    )
    .join("\n\n");

  return `${identityContext}

Base de conocimiento asignada al agente:
${ragContext}

Reglas obligatorias sobre la base de conocimiento:
- La base de conocimiento tiene prioridad sobre el prompt del agente.
- Si la base contiene una instruccion directa sobre como responder, obedecela literalmente.
- Usa estos documentos como fuente principal para responder.
- Si la respuesta no está en la base, dilo con claridad y pide que un humano lo confirme.
- No inventes precios, horarios, politicas ni condiciones que no aparezcan aqui.

Prompt del agente:
${promptWithVariables}

${businessContext}`;
}

function getOpenAIModel(model?: string | null) {
  if (!model) {
    return DEFAULT_OPENAI_MODEL;
  }

  const normalized = model.startsWith("openai/")
    ? model.replace("openai/", "")
    : model;

  if (normalized.startsWith("gpt-") || normalized.startsWith("o")) {
    return normalized;
  }

  return DEFAULT_OPENAI_MODEL;
}

function getResponseText(payload: OpenAIResponsePayload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

export async function POST(request: Request) {
  const { agentId, message } = await request.json();

  if (!agentId || !message) {
    return NextResponse.json(
      { error: "agentId y message son requeridos." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, workspace_id, name, model, system_prompt, temperature, config")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json(
      { error: agentError?.message ?? "Agente no encontrado." },
      { status: 404 },
    );
  }

  const model = getOpenAIModel(agent.model);
  const apiKey = await getWorkspaceOpenAIKey(agent.workspace_id);

  if (!apiKey) {
    return NextResponse.json(
      { error: "Conecta OpenAI en Integraciones antes de probar el agente." },
      { status: 400 },
    );
  }
  const knowledgeAssetIds = getKnowledgeAssetIds(agent.config);
  const { data: businessProfile } = await supabase
    .from("workspace_assets")
    .select("title, content, metadata")
    .eq("workspace_id", agent.workspace_id)
    .eq("kind", "business_profile")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: knowledgeAssets } =
    knowledgeAssetIds.length > 0
      ? await supabase
          .from("workspace_assets")
          .select("id, title, content")
          .eq("workspace_id", agent.workspace_id)
          .eq("kind", "knowledge")
          .neq("status", "archived")
          .in("id", knowledgeAssetIds)
      : { data: [] };
  const instructions = buildInstructions(
    agent,
    agent.system_prompt,
    (knowledgeAssets ?? []) as KnowledgeAsset[],
    businessProfile as BusinessProfileAsset | null,
  );

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: message,
      instructions,
      max_output_tokens: 300,
      model,
      temperature: Number(agent.temperature ?? 0.4),
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.error?.message ?? "OpenAI rechazo la prueba." },
      { status: response.status },
    );
  }

  const answer = getResponseText(payload);
  const usage = payload?.usage ?? {};

  const { error: usageError } = await supabase.from("usage_events").insert({
    agent_id: agent.id,
    cost_usd: 0,
    input_tokens: Number(usage.input_tokens ?? 0),
    metadata: {
      kind: "prompt_test",
      openai_response_id: payload?.id ?? null,
      rag_document_ids: knowledgeAssetIds,
    },
    model: payload?.model ?? model,
    output_tokens: Number(usage.output_tokens ?? 0),
    provider: "openai",
    workspace_id: agent.workspace_id,
  });

  return NextResponse.json({
    answer,
    logWarning: usageError?.message ?? null,
    usage,
  });
}
