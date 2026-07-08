import { NextResponse } from "next/server";

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
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta OPENAI_API_KEY en .env.local." },
      { status: 500 },
    );
  }

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
    .select("id, workspace_id, name, model, system_prompt, temperature")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json(
      { error: agentError?.message ?? "Agente no encontrado." },
      { status: 404 },
    );
  }

  const model = getOpenAIModel(agent.model);
  const instructions =
    agent.system_prompt ||
    "Eres un agente de WhatsApp claro, breve y orientado a resolver.";

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
