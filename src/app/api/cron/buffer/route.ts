import { NextResponse } from "next/server";

import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

type AgentRow = {
  config: Json;
  id: string;
  model: string;
  system_prompt: string;
  temperature: number;
  workspace_id: string;
};

type KnowledgeAsset = {
  content: string;
  id: string;
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

function buildInstructions(agent: AgentRow, assets: KnowledgeAsset[]) {
  const basePrompt =
    agent.system_prompt ||
    "Eres un agente de WhatsApp claro, breve y orientado a resolver. Responde en espanol y evita sonar como robot.";

  if (assets.length === 0) {
    return basePrompt;
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
${basePrompt}`;
}

async function generateReply(
  agent: AgentRow,
  messages: MessageRow[],
  knowledgeAssets: KnowledgeAsset[],
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY.");
  }

  const model = normalizeModel(agent.model);
  const instructions = buildInstructions(agent, knowledgeAssets);
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
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY.");
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
  const cutoff = new Date(Date.now() - 45_000).toISOString();
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("id, workspace_id, contact_id, agent_id, last_message_at")
    .eq("status", "open")
    .eq("ai_enabled", true)
    .lte("last_message_at", cutoff)
    .order("last_message_at", { ascending: true })
    .limit(5);

  if (conversationsError) {
    return NextResponse.json({ error: conversationsError.message }, { status: 500 });
  }

  const results = [];

  for (const conversation of conversations ?? []) {
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

    const { data: agent } = conversation.agent_id
      ? await supabase
        .from("agents")
          .select("id, workspace_id, model, system_prompt, temperature, config")
          .eq("id", conversation.agent_id)
          .single()
      : await supabase
          .from("agents")
          .select("id, workspace_id, model, system_prompt, temperature, config")
          .eq("workspace_id", conversation.workspace_id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

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
      const reply = await generateReply(
        typedAgent,
        chronologicalMessages,
        (knowledgeAssets ?? []) as KnowledgeAsset[],
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
        .update({ last_message_at: message.created_at })
        .eq("id", conversation.id)
        .eq("workspace_id", conversation.workspace_id);

      results.push({ conversationId: conversation.id, status: "queued" });
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
