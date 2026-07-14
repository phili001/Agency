import { NextResponse } from "next/server";

import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyBusinessVariables,
  buildBusinessContext,
  getBusinessVariables,
} from "@/lib/business-profile";
import { getWorkspaceOpenAIKey } from "@/lib/integrations/openai";

type AgentRow = {
  config: Json;
  id: string;
  model: string;
  name: string;
  system_prompt: string;
  temperature: number;
  type: string;
  workspace_id: string;
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

type MessageRow = {
  body: string | null;
  created_at: string;
  direction: string;
  role: string;
};

type ContactMetadata = {
  ai_summary?: string;
  ai_tags?: string[];
  [key: string]: unknown;
};

type OpenAIResponsePayload = {
  error?: {
    message?: string;
  };
  id?: string;
  model?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

const DEFAULT_MODEL = "gpt-5.4-mini";

function getAgentIdentity(agent: AgentRow) {
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

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");

  return Boolean(
    cronSecret &&
      (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret),
  );
}

function normalizeModel(model?: string | null) {
  if (!model) {
    return DEFAULT_MODEL;
  }

  const normalized = model.startsWith("openai/")
    ? model.replace("openai/", "")
    : model;

  return normalized.startsWith("gpt-") || normalized.startsWith("o")
    ? normalized
    : DEFAULT_MODEL;
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

function buildTranscript(messages: MessageRow[]) {
  return messages
    .map((message) => {
      const speaker =
        message.direction === "inbound"
          ? "Cliente"
          : message.role === "assistant"
          ? "IA"
          : "Humano";
      return `${speaker}: ${message.body ?? ""}`;
    })
    .join("\n");
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

function getConfigRecord(config: Json) {
  return config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

function getRouterDescription(agent: AgentRow) {
  const config = getConfigRecord(agent.config);
  return typeof config.router_description === "string"
    ? config.router_description
    : "";
}

function getRoutingKeywords(agent: AgentRow) {
  const config = getConfigRecord(agent.config);
  return Array.isArray(config.routing_keywords)
    ? config.routing_keywords.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeRoutingText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_]/g, " ");
}

function getRoutingTokens(value: string) {
  const stopWords = new Set([
    "para",
    "cuando",
    "este",
    "esta",
    "usar",
    "agente",
    "contacto",
    "quiero",
    "quieres",
    "tengo",
    "duda",
    "dudas",
    "con",
    "por",
    "una",
    "uno",
    "los",
    "las",
    "del",
    "que",
    "como",
    "pero",
  ]);

  return normalizeRoutingText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function getAgentIntentBoost(agent: AgentRow, messageText: string) {
  const config = getConfigRecord(agent.config);
  const key = String(config.default_agent_key ?? agent.type ?? "");
  const text = normalizeRoutingText(messageText);
  const groups: Record<string, string[]> = {
    booking: [
      "agenda",
      "agendar",
      "cita",
      "reservar",
      "reserva",
      "disponibilidad",
      "horario",
      "hora",
      "manana",
      "hoy",
      "calendario",
      "confirmar",
    ],
    setter: [
      "info",
      "informacion",
      "precio",
      "precios",
      "cuanto",
      "servicio",
      "servicios",
      "ubicacion",
      "direccion",
      "horarios",
      "interesa",
    ],
    support: [
      "problema",
      "ayuda",
      "soporte",
      "queja",
      "reclamo",
      "humano",
      "asesor",
      "persona",
      "cancelar",
      "cambiar",
      "error",
    ],
  };

  return (groups[key] ?? []).reduce(
    (score, keyword) => score + (text.includes(keyword) ? 3 : 0),
    0,
  );
}

function routeAgent(agents: AgentRow[], messages: MessageRow[]) {
  if (agents.length <= 1) {
    return {
      agent: agents[0] ?? null,
      score: 0,
      strategy: agents.length === 1 ? "single_active_agent" : "no_active_agent",
    };
  }

  const transcript = messages.map((message) => message.body ?? "").join("\n");
  const latest = messages.at(-1)?.body ?? "";
  const messageTokens = new Set(getRoutingTokens(`${latest}\n${transcript}`));
  const ranked = agents
    .map((agent) => {
      const description = getRouterDescription(agent);
      const keywordText = getRoutingKeywords(agent).join(" ");
      const routerTokens = getRoutingTokens(
        `${agent.name} ${agent.type} ${description} ${keywordText}`,
      );
      const overlap = routerTokens.reduce(
        (score, token) => score + (messageTokens.has(token) ? 2 : 0),
        0,
      );
      const keywordBoost = getRoutingKeywords(agent).reduce(
        (score, keyword) =>
          score +
          (normalizeRoutingText(`${latest}\n${transcript}`).includes(
            normalizeRoutingText(keyword),
          )
            ? 4
            : 0),
        0,
      );
      const intentBoost = getAgentIntentBoost(agent, `${latest}\n${transcript}`);

      return {
        agent,
        score: overlap + keywordBoost + intentBoost,
      };
    })
    .sort((left, right) => right.score - left.score);

  return {
    agent: ranked[0]?.agent ?? null,
    score: ranked[0]?.score ?? 0,
    strategy: ranked[0]?.score ? "router_description" : "active_agent_fallback",
  };
}

function buildInstructions(
  agent: AgentRow,
  assets: KnowledgeAsset[],
  businessProfile?: BusinessProfileAsset | null,
) {
  const basePrompt =
    agent.system_prompt ||
    "Eres un agente de WhatsApp claro, breve y orientado a resolver. Responde en espanol y evita sonar como robot.";
  const identity = getAgentIdentity(agent);
  const businessVariables = {
    ...getBusinessVariables(businessProfile),
    agent_name: identity.agentName,
    job_title: identity.jobTitle,
  };
  const promptWithVariables = applyBusinessVariables(basePrompt, businessVariables);
  const businessContext = buildBusinessContext(businessProfile);

  if (assets.length === 0) {
    return [businessContext, promptWithVariables].filter(Boolean).join("\n\n");
  }

  const ragContext = assets
    .map(
      (asset, index) =>
        `[Documento RAG ${index + 1}: ${asset.title}]\n${asset.content.trim()}`,
    )
    .join("\n\n");

  return `Base de conocimiento asignada al agente:
${ragContext}

Reglas obligatorias sobre la base de conocimiento:
- La base de conocimiento tiene prioridad sobre el prompt del agente.
- Si la base contiene una instruccion directa sobre como responder, obedecela literalmente.
- Usa estos documentos como fuente principal para responder.
- Si la respuesta no esta en la base, dilo con claridad y pide que un humano lo confirme.
- No inventes precios, horarios, politicas ni condiciones que no aparezcan aqui.

Prompt del agente:
${promptWithVariables}

${businessContext}`;
}

async function generateReply(
  agent: AgentRow,
  messages: MessageRow[],
  knowledgeAssets: KnowledgeAsset[],
  businessProfile?: BusinessProfileAsset | null,
) {
  const apiKey = await getWorkspaceOpenAIKey(agent.workspace_id);

  if (!apiKey) {
    throw new Error("OpenAI no esta conectado para este workspace.");
  }

  const model = normalizeModel(agent.model);
  const instructions = buildInstructions(agent, knowledgeAssets, businessProfile);
  const transcript = buildTranscript(messages);
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: `Conversacion reciente:\n${transcript}\n\nResponde el ultimo mensaje del cliente.`,
      instructions,
      max_output_tokens: 450,
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
    throw new Error(payload.error?.message ?? "OpenAI rechazo el buffer.");
  }

  return {
    answer: getResponseText(payload),
    model: payload.model ?? model,
    responseId: payload.id ?? null,
    usage: payload.usage ?? {},
  };
}

async function generateContactInsights(agent: AgentRow, messages: MessageRow[]) {
  const apiKey = await getWorkspaceOpenAIKey(agent.workspace_id);

  if (!apiKey) {
    throw new Error("OpenAI no esta conectado para este workspace.");
  }

  const model = normalizeModel(agent.model);
  const transcript = buildTranscript(messages);
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: `Analiza esta conversacion de WhatsApp y responde solo JSON valido:
{
  "summary": "resumen breve del lead en una frase",
  "tags": ["tag_1", "tag_2"]
}

Conversacion:
${transcript}`,
      instructions:
        "Eres un clasificador CRM. Usa tags cortos en snake_case, maximo 5 tags. No agregues markdown.",
      max_output_tokens: 220,
      model,
      temperature: 0.2,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "OpenAI rechazo el resumen.");
  }

  const rawText = getResponseText(payload);

  try {
    const parsed = JSON.parse(rawText) as {
      summary?: unknown;
      tags?: unknown;
    };

    return {
      model: payload.model ?? model,
      responseId: payload.id ?? null,
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary.slice(0, 240)
          : "Conversacion pendiente de revisar.",
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
            .filter((tag): tag is string => typeof tag === "string")
            .slice(0, 5)
        : [],
      usage: payload.usage ?? {},
    };
  } catch {
    return {
      model: payload.model ?? model,
      responseId: payload.id ?? null,
      summary: rawText.slice(0, 240),
      tags: [],
      usage: payload.usage ?? {},
    };
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Cron no autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const params = new URL(request.url).searchParams;
  const conversationId = params.get("conversationId");
  const force = params.get("force") === "true";
  const workspaceId = params.get("workspaceId");
  const cutoff = new Date(Date.now() - 20_000).toISOString();
  let conversationsQuery = supabase
    .from("conversations")
    .select("id, workspace_id, contact_id, agent_id, last_message_at")
    .eq("status", "open")
    .eq("ai_enabled", true)
    .order("last_message_at", { ascending: true });

  if (conversationId) {
    conversationsQuery = conversationsQuery.eq("id", conversationId).limit(1);

    if (workspaceId) {
      conversationsQuery = conversationsQuery.eq("workspace_id", workspaceId);
    }
  } else {
    conversationsQuery = conversationsQuery.lte("last_message_at", cutoff).limit(5);
  }

  const { data: conversations, error: conversationsError } =
    await conversationsQuery;

  if (conversationsError) {
    return NextResponse.json({ error: conversationsError.message }, { status: 500 });
  }

  const results = [];

  for (const conversation of conversations ?? []) {
    if (
      conversationId &&
      !force &&
      conversation.last_message_at &&
      conversation.last_message_at > cutoff
    ) {
      results.push({
        conversationId: conversation.id,
        status: "waiting_for_buffer_window",
      });
      continue;
    }

    const { data: messages } = await supabase
      .from("messages")
      .select("body, created_at, direction, role")
      .eq("workspace_id", conversation.workspace_id)
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(8);
    const chronologicalMessages = [...(messages ?? [])].reverse() as MessageRow[];
    const latestMessage = chronologicalMessages.at(-1);

    if (!latestMessage || latestMessage.direction !== "inbound") {
      results.push({ conversationId: conversation.id, status: "skipped" });
      continue;
    }

    const { data: activeAgents } = await supabase
      .from("agents")
      .select("id, workspace_id, name, type, model, system_prompt, temperature, config")
      .eq("workspace_id", conversation.workspace_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    const routedAgent = routeAgent(
      ((activeAgents ?? []) as AgentRow[]),
      chronologicalMessages,
    );
    const agent = routedAgent.agent;

    if (!agent) {
      results.push({ conversationId: conversation.id, status: "no_agent" });
      continue;
    }

    try {
      const typedAgent = agent as AgentRow;
      const knowledgeAssetIds = getKnowledgeAssetIds(typedAgent.config);
      const { data: knowledgeAssets } =
        knowledgeAssetIds.length > 0
          ? await supabase
              .from("workspace_assets")
              .select("id, title, content")
              .eq("workspace_id", typedAgent.workspace_id)
              .eq("kind", "knowledge")
              .neq("status", "archived")
              .in("id", knowledgeAssetIds)
          : { data: [] };
      const { data: businessProfile } = await supabase
        .from("workspace_assets")
        .select("title, content, metadata")
        .eq("workspace_id", typedAgent.workspace_id)
        .eq("kind", "business_profile")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const reply = await generateReply(
        typedAgent,
        chronologicalMessages,
        (knowledgeAssets ?? []) as KnowledgeAsset[],
        businessProfile as BusinessProfileAsset | null,
      );
      const insights = await generateContactInsights(
        typedAgent,
        chronologicalMessages,
      );

      if (!reply.answer) {
        results.push({ conversationId: conversation.id, status: "empty_reply" });
        continue;
      }

      const { data: message, error: messageError } = await supabase
        .from("messages")
        .insert({
          body: reply.answer,
          contact_id: conversation.contact_id,
          conversation_id: conversation.id,
          direction: "outbound",
          input_tokens: Number(reply.usage.input_tokens ?? 0),
          message_type: "text",
          metadata: {
            delivery: "queued_only",
            kind: "buffer_ai_reply",
            openai_response_id: reply.responseId,
            rag_document_ids: knowledgeAssetIds,
            router: {
              agent_id: typedAgent.id,
              agent_name: typedAgent.name,
              score: routedAgent.score,
              strategy: routedAgent.strategy,
            },
          },
          output_tokens: Number(reply.usage.output_tokens ?? 0),
          role: "assistant",
          status: "queued",
          workspace_id: conversation.workspace_id,
        })
        .select("id, created_at")
        .single();

      if (messageError) {
        throw messageError;
      }

      await supabase.from("usage_events").insert({
        agent_id: agent.id,
        conversation_id: conversation.id,
        input_tokens: Number(reply.usage.input_tokens ?? 0),
        message_id: message.id,
        metadata: {
          kind: "buffer_ai_reply",
          openai_response_id: reply.responseId,
          rag_document_ids: knowledgeAssetIds,
          router: {
            agent_id: typedAgent.id,
            agent_name: typedAgent.name,
            score: routedAgent.score,
            strategy: routedAgent.strategy,
          },
        },
        model: reply.model,
        output_tokens: Number(reply.usage.output_tokens ?? 0),
        provider: "openai",
        workspace_id: conversation.workspace_id,
      });

      await supabase.from("usage_events").insert({
        agent_id: agent.id,
        conversation_id: conversation.id,
        input_tokens: Number(insights.usage.input_tokens ?? 0),
        metadata: {
          kind: "contact_insights",
          openai_response_id: insights.responseId,
          router: {
            agent_id: typedAgent.id,
            agent_name: typedAgent.name,
            score: routedAgent.score,
            strategy: routedAgent.strategy,
          },
        },
        model: insights.model,
        output_tokens: Number(insights.usage.output_tokens ?? 0),
        provider: "openai",
        workspace_id: conversation.workspace_id,
      });

      const { data: contact } = await supabase
        .from("contacts")
        .select("metadata")
        .eq("id", conversation.contact_id)
        .eq("workspace_id", conversation.workspace_id)
        .single();
      const currentMetadata =
        contact?.metadata &&
        typeof contact.metadata === "object" &&
        !Array.isArray(contact.metadata)
          ? (contact.metadata as ContactMetadata)
          : {};

      await supabase
        .from("contacts")
        .update({
          metadata: {
            ...currentMetadata,
            ai_summary: insights.summary,
            ai_tags: insights.tags,
            ai_updated_at: new Date().toISOString(),
          },
        })
        .eq("id", conversation.contact_id)
        .eq("workspace_id", conversation.workspace_id);

      await supabase
        .from("conversations")
        .update({
          agent_id: typedAgent.id,
          last_message_at: message.created_at,
        })
        .eq("id", conversation.id)
        .eq("workspace_id", conversation.workspace_id);

      results.push({
        agentId: typedAgent.id,
        agentName: typedAgent.name,
        conversationId: conversation.id,
        routerScore: routedAgent.score,
        routerStrategy: routedAgent.strategy,
        status: "queued",
      });
    } catch (error) {
      results.push({
        conversationId: conversation.id,
        error: error instanceof Error ? error.message : "Error desconocido.",
        status: "error",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

export async function GET(request: Request) {
  return POST(request);
}
