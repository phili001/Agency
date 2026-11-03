import { NextResponse } from "next/server";

import type { Json } from "@/lib/supabase/database.types";
import { resolveCalendarRequestContext } from "@/lib/calendar-request";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyBusinessVariables,
  buildBusinessContext,
  getBusinessVariables,
} from "@/lib/business-profile";
import {
  applyConversationHandoff,
  buildHandoffContext,
  detectAnswerHandoff,
  findHandoffKeyword,
  getHandoffKeywords,
  withHandoffNotice,
  HANDOFF_CLIENT_NOTICE,
} from "@/lib/handoff";
import { getWorkspaceOpenAIKey } from "@/lib/integrations/openai";
import {
  buildCalendarContext,
  buildCalendarToolDefinitions,
  buildDirectAvailabilityAnswer,
  buildDirectBookingAnswer,
  sanitizeCalendarAnswer,
} from "@/lib/agenda/agent-guards";
import {
  buildCalendarRuntime,
  runCalendarTool,
  type CalendarRuntime,
} from "@/lib/agenda/agent-tools";
import { isValidTimeZone } from "@/lib/timezones";

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
  media_url?: string | null;
  message_type?: string | null;
  role: string;
};

// Sin esto, una foto o una nota de voz aparecia como "Cliente: " vacio y el
// modelo no sabia que el contacto habia mandado algo.
function describeMedia(message: MessageRow) {
  if (!message.media_url) {
    return "";
  }

  switch (message.message_type) {
    case "image":
      return "[envió una imagen]";
    case "audio":
      return "[envió una nota de voz; no se puede escuchar por aquí]";
    case "file":
      return "[envió un documento]";
    default:
      return "[envió un archivo]";
  }
}

type ContactMetadata = {
  ai_summary?: string;
  ai_tags?: string[];
  [key: string]: unknown;
};

type OpenAIOutputItem = {
  arguments?: string;
  call_id?: string;
  content?: Array<{
    text?: string;
  }>;
  name?: string;
  type?: string;
};

type OpenAIResponsePayload = {
  error?: {
    message?: string;
  };
  id?: string;
  model?: string;
  output?: OpenAIOutputItem[];
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

function getAgentIntroduction(agent: AgentRow) {
  const identity = getAgentIdentity(agent);
  const jobTitle = identity.jobTitle.replace(/\s+IA$/i, "").trim();

  return jobTitle
    ? `Soy ${identity.agentName}, del equipo de ${jobTitle.toLocaleLowerCase("es")}.`
    : `Soy ${identity.agentName}.`;
}

function ensureAgentIntroduction(
  answer: string,
  agent: AgentRow,
  introduceAgent: boolean,
) {
  if (!introduceAgent || !answer.trim()) {
    return answer;
  }

  const identity = getAgentIdentity(agent);
  const opening = normalizeRoutingText(answer.slice(0, 160));

  if (opening.includes(normalizeRoutingText(identity.agentName))) {
    return answer;
  }

  return `${getAgentIntroduction(agent)}\n\n${answer}`;
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
      const media = describeMedia(message);
      const text = [media, message.body ?? ""].filter(Boolean).join(" ");
      return `${speaker}: ${text}`;
    })
    .join("\n");
}

/**
 * Las definiciones se arman segun los calendarios que tenga el agente. Con uno
 * solo no se expone el parametro: pedirle al modelo que elija entre una sola
 * opcion solo agrega ruido y posibilidad de error.
 */
function getEnabledToolIds(config: Json) {
  const record = getConfigRecord(config);
  return Array.isArray(record.enabled_tools)
    ? record.enabled_tools.filter((item): item is string => typeof item === "string")
    : [];
}

function isBookingAgent(agent: AgentRow) {
  const config = getConfigRecord(agent.config);
  const key = String(config.default_agent_key ?? "").toLowerCase();
  const searchable = normalizeRoutingText(
    `${agent.name} ${agent.type} ${getRouterDescription(agent)}`,
  );

  return (
    agent.type === "booking" ||
    key === "booking" ||
    /\b(citas?|agenda|agendar|reservar|disponibilidad|calendario)\b/.test(searchable)
  );
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
  // Instalaciones antiguas pueden conservar type/default_agent_key = "setter"
  // aunque el agente haya sido convertido en el agente de citas. Usa la misma
  // clasificacion que habilita el calendario para que el router no lo penalice.
  const key = isBookingAgent(agent)
    ? "booking"
    : String(config.default_agent_key ?? agent.type ?? "");
  const text = normalizeRoutingText(messageText);
  const groups: Record<string, string[]> = {
    booking: [
      "agend",
      "agenda",
      "agendar",
      "cita",
      "reservar",
      "reserva",
      "disponibilidad",
      "horario",
      "manana",
      "hoy",
      "calendario",
      "confirmar",
      // Dias: "este viernes a las 3pm" no marcaba intencion de cita.
      "lunes",
      "martes",
      "miercoles",
      "jueves",
      "viernes",
      "sabado",
      "domingo",
      "semana",
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
      "proyecto",
      "negocio",
      "explica",
      "explicacion",
      "informacion",
      "oferta",
      "servicio",
      "precio",
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

  const wordScore = (groups[key] ?? []).reduce(
    (score, keyword) => score + (text.includes(keyword) ? 1 : 0),
    0,
  );

  if (key !== "booking") {
    return wordScore;
  }

  // Horas sueltas necesitan limite de palabra: como subcadena, "am" hacia match
  // dentro de "progr-am-a" y "hora" dentro de "a-hora", mandando a citas
  // conversaciones que no tenian nada que ver.
  const timePatterns = [
    /\b\d{1,2}\s*[:.]\d{2}\b/,
    /\b\d{1,2}\s*(am|pm)\b/,
    /\bhoras?\b/,
  ];

  return (
    wordScore + timePatterns.reduce((score, rx) => score + (rx.test(text) ? 1 : 0), 0)
  );
}

function isContextualBookingFollowUp(messages: MessageRow[]) {
  const latest = normalizeRoutingText(messages.at(-1)?.body ?? "").trim();
  const previous = normalizeRoutingText(
    messages
      .slice(0, -1)
      .slice(-4)
      .map((message) => message.body ?? "")
      .join(" "),
  );
  const shortTimeFollowUp =
    latest.length <= 80 &&
    (/(?:^|\b)(?:y\s+)?(?:a|para)\s+las?\s+\d{1,2}\b/.test(latest) ||
      /\b\d{1,2}\s*(?:am|pm)\b/.test(latest) ||
      /\b(?:otra hora|ese horario|y a que hora)\b/.test(latest));
  const previousBookingContext =
    /\b(?:cita|agenda|agendar|reservar|disponibilidad|horario|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(
      previous,
    );

  return shortTimeFollowUp && previousBookingContext;
}

function isExplicitBookingRequest(messages: MessageRow[]) {
  const latest = normalizeRoutingText(messages.at(-1)?.body ?? "");

  return (
    /\b(?:agend\w*|reserv\w*|program\w*)\b/.test(latest) ||
    /\b(?:confirmo|elijo|quiero)\b.*\b(?:cita|horario|opcion)\b/.test(latest)
  );
}

function routeAgent(
  agents: AgentRow[],
  messages: MessageRow[],
  currentAgentId?: string | null,
) {
  if (agents.length <= 1) {
    return {
      agent: agents[0] ?? null,
      score: 0,
      strategy: agents.length === 1 ? "single_active_agent" : "no_active_agent",
    };
  }

  const latest = messages.at(-1)?.body ?? "";
  // El overlap se mide solo contra el ULTIMO mensaje. Midiendolo contra toda la
  // conversacion, las palabras de los primeros mensajes seguian votando para
  // siempre y el setter se quedaba pegado aunque el cliente ya pidiera cita.
  const latestTokens = new Set(getRoutingTokens(latest));
  const normalizedLatest = normalizeRoutingText(latest);
  const contextualBookingFollowUp = isContextualBookingFollowUp(messages);
  const ranked = agents
    .map((agent) => {
      const description = getRouterDescription(agent);
      const keywordText = getRoutingKeywords(agent).join(" ");
      const routerTokens = getRoutingTokens(
        `${agent.name} ${agent.type} ${description} ${keywordText}`,
      );
      const overlap = routerTokens.reduce(
        (score, token) => score + (latestTokens.has(token) ? 2 : 0),
        0,
      );
      const keywordBoost = getRoutingKeywords(agent).reduce(
        (score, keyword) =>
          score + (normalizedLatest.includes(normalizeRoutingText(keyword)) ? 4 : 0),
        0,
      );
      // El historial no vota permanentemente por un agente: los seguimientos
      // cortos se resuelven con contextBoost y una intencion nueva puede sacar
      // la conversacion de citas para volver al agente de informacion.
      const intentBoost = getAgentIntentBoost(agent, latest) * 12;
      // El agente que ya venia atendiendo se queda salvo señal clara de cambio.
      // Sin esto, respuestas de puro dato ("Felipe, restaurante") devolvian la
      // conversacion al setter en mitad del agendamiento.
      const stickiness = currentAgentId && agent.id === currentAgentId ? 8 : 0;
      const contextBoost =
        contextualBookingFollowUp && isBookingAgent(agent) ? 24 : 0;

      return {
        agent,
        score: overlap + keywordBoost + intentBoost + stickiness + contextBoost,
      };
    })
    .sort((left, right) => right.score - left.score);

  return {
    agent: ranked[0]?.agent ?? null,
    score: ranked[0]?.score ?? 0,
    strategy: ranked[0]?.score ? "router_description" : "active_agent_fallback",
  };
}

/**
 * La fecha de hoy va SIEMPRE, tenga o no calendario conectado. Sin esto el
 * modelo no sabe en que dia esta y se inventa fechas: pedirle "este viernes" le
 * hacia responder con un viernes de otro mes.
 */
/** Zona horaria efectiva: la del calendario si hay, si no la de la empresa. */
function resolveAgentTimezone(
  businessProfile: BusinessProfileAsset | null | undefined,
  calendarRuntime: CalendarRuntime | null,
) {
  if (calendarRuntime?.timezone) {
    return calendarRuntime.timezone;
  }

  const profileTimezone = getBusinessVariables(businessProfile).timezone;
  // UTC solo como ultimo recurso para no dejar al agente sin fecha. Si se llega
  // aqui, las horas que diga estaran corridas: hay que configurar la zona en
  // Negocio. El aviso del inbox lo señala.
  return profileTimezone && isValidTimeZone(profileTimezone) ? profileTimezone : "UTC";
}

/** Linea corta y contundente con la fecha, para inyectar en el turno del usuario. */
function buildTodayLine(timezone: string) {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  const weekday = new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    weekday: "long",
  }).format(now);
  const legible = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    timeZone: timezone,
    year: "numeric",
  }).format(now);

  return `[DATO DEL SISTEMA -- HOY ES ${weekday.toUpperCase()} ${today} (${legible}), zona ${timezone}. Esta es la fecha real. Cualquier fecha relativa se calcula desde aqui. No uses ninguna otra fecha.]`;
}

function buildTimeContext(timezone: string) {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  const weekday = new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    weekday: "long",
  }).format(now);

  return `Fecha actual:
- Hoy es ${weekday} ${today} (formato YYYY-MM-DD), zona horaria ${timezone}.
- Calcula "hoy", "manana", "este viernes" o "la próxima semana" a partir de esa fecha.
- Nunca inventes una fecha ni cambies de mes. Si no puedes calcularla con certeza, preguntale al cliente.`;
}

function buildInstructions(
  agent: AgentRow,
  assets: KnowledgeAsset[],
  businessProfile: BusinessProfileAsset | null | undefined,
  calendarRuntime: CalendarRuntime | null,
  introduceAgent: boolean,
) {
  const basePrompt =
    agent.system_prompt ||
    "Eres un agente de WhatsApp claro, breve y orientado a resolver. Responde en español y evita sonar como robot.";
  const identity = getAgentIdentity(agent);
  const businessVariables = {
    ...getBusinessVariables(businessProfile),
    agent_name: identity.agentName,
    job_title: identity.jobTitle,
  };
  const promptWithVariables = applyBusinessVariables(basePrompt, businessVariables);
  const businessContext = buildBusinessContext(businessProfile);
  const calendarContext = buildCalendarContext(calendarRuntime);
  // Se inyecta en runtime a proposito: asi la regla de escalada aplica tambien
  // a los agentes ya creados, sin tener que reescribir sus prompts guardados.
  const handoffContext = buildHandoffContext();
  // La fecha se inyecta siempre, tenga o no agenda conectada.
  const timeContext = buildTimeContext(
    resolveAgentTimezone(businessProfile, calendarRuntime),
  );
  const identityContext = `Identidad:
- Te llamas ${identity.agentName}${identity.jobTitle ? ` y eres ${identity.jobTitle}` : ""}.
- Tu presentacion personalizada es: "${getAgentIntroduction(agent)}"
${
  introduceAgent
    ? `- Acabas de tomar esta conversacion. Empieza esta respuesta identificandote como ${identity.agentName} y menciona brevemente tu trabajo.`
    : "- Ya estas atendiendo esta conversación. No repitas tu presentacion en cada mensaje."
}
- Habla siempre en primera persona como ${identity.agentName}. Nunca escribas "IA:" ni "assistant:" delante de tu respuesta.`;

  if (assets.length === 0) {
    return [
      identityContext,
      businessContext,
      promptWithVariables,
      timeContext,
      calendarContext,
      handoffContext,
    ]
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
- Usa estos documentos como fuente principal para el CONTENIDO del negocio:
  precios, servicios, políticas, condiciones y forma de responder.
- Si la respuesta no está en la base, dilo con claridad y pide que un humano lo confirme.
- No inventes precios, horarios, politicas ni condiciones que no aparezcan aqui.

Límites de la base de conocimiento -- NUNCA los sobreescribe:
- La fecha de hoy. Las fechas que aparezcan en los documentos son EJEMPLOS
  escritos en el pasado, nunca la fecha actual. Usa siempre la fecha del sistema.
- Tu acceso al calendario y la disponibilidad real de horarios.
- Las prohibiciones sobre agendar, confirmar citas o prometer horarios.
- Si un documento muestra un ejemplo de cierre con una fecha u hora concreta,
  imita el TONO, nunca copies esa fecha ni esa hora.

Prompt del agente:
${promptWithVariables}

${businessContext}

${timeContext}

${calendarContext}

${handoffContext}

Recuerda: la fecha del sistema y los límites de arriba mandan sobre cualquier
fecha, hora o ejemplo que aparezca en los documentos.`;
}

/** Cuando no hay calendario, se explica por que: antes fallaba en silencio. */
async function callResponsesApi({
  apiKey,
  input,
  instructions,
  model,
  temperature,
  tools,
}: {
  apiKey: string;
  input: unknown;
  instructions: string;
  model: string;
  temperature: number;
  tools?: unknown[];
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input,
      instructions,
      max_output_tokens: 900,
      model,
      temperature,
      ...(tools?.length ? { tools } : {}),
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "OpenAI rechazó el buffer.");
  }

  return payload;
}

async function generateReply(
  agent: AgentRow,
  messages: MessageRow[],
  knowledgeAssets: KnowledgeAsset[],
  businessProfile: BusinessProfileAsset | null | undefined,
  calendarRuntime: CalendarRuntime | null,
  introduceAgent: boolean,
) {
  const apiKey = await getWorkspaceOpenAIKey(agent.workspace_id);

  if (!apiKey) {
    throw new Error("OpenAI no está conectado para este workspace.");
  }

  const model = normalizeModel(agent.model);
  const temperature = Number(agent.temperature ?? 0.4);
  const instructions = buildInstructions(
    agent,
    knowledgeAssets,
    businessProfile,
    calendarRuntime,
    introduceAgent,
  );
  const transcript = buildTranscript(messages);
  const tools = calendarRuntime
    ? buildCalendarToolDefinitions(calendarRuntime.calendars)
    : undefined;
  // La fecha va tambien en el turno del usuario, no solo en las instrucciones:
  // enterrada en un prompt largo el modelo la ignoraba e inventaba el mes.
  const timezone = resolveAgentTimezone(businessProfile, calendarRuntime);
  // Sin zona configurada, el agente habla en UTC y da horas corridas.
  const timezoneWarning =
    timezone === "UTC" && !calendarRuntime
      ? "Falta la zona horaria en Negocio: el agente esta usando UTC y las horas que diga estarán corridas."
      : null;
  const calendarRequest = calendarRuntime
    ? resolveCalendarRequestContext(messages, calendarRuntime.timezone)
    : null;
  const explicitBookingRequest = isExplicitBookingRequest(messages);
  const resolvedRequestLine = calendarRequest?.dateKey
    ? `[SOLICITUD DE AGENDA RESUELTA POR EL SISTEMA: fecha ${calendarRequest.dateKey}${
        calendarRequest.time ? `, hora ${calendarRequest.time.label}` : ""
      }${calendarRequest.inheritedDate ? ". La fecha viene del contexto anterior" : ""}. Usa esta fecha al consultar; no la reemplaces por otra.]`
    : "";
  const input: unknown[] = [
    {
      content: `${buildTodayLine(timezone)}${
        resolvedRequestLine ? `\n\n${resolvedRequestLine}` : ""
      }\n\nConversacion reciente:\n${transcript}\n\nResponde el ultimo mensaje del cliente.`,
      role: "user",
    },
  ];
  const toolCalls: Array<Record<string, unknown>> = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let payload = await callResponsesApi({
    apiKey,
    input,
    instructions,
    model,
    temperature,
    tools,
  });

  inputTokens += Number(payload.usage?.input_tokens ?? 0);
  outputTokens += Number(payload.usage?.output_tokens ?? 0);

  // El modelo puede encadenar consultar_disponibilidad -> agendar_cita, asi que
  // se itera hasta que deje de pedir tools. El tope evita un bucle infinito.
  for (let round = 0; round < 4; round += 1) {
    const functionCalls = (payload.output ?? []).filter(
      (item) => item.type === "function_call" && item.call_id && item.name,
    );

    if (!calendarRuntime || functionCalls.length === 0) {
      break;
    }

    for (const item of payload.output ?? []) {
      input.push(item);
    }

    for (const call of functionCalls) {
      const result = await runCalendarTool(calendarRuntime, call, messages);
      toolCalls.push({ name: call.name, result });
      input.push({
        call_id: call.call_id,
        output: JSON.stringify(result),
        type: "function_call_output",
      });
    }

    payload = await callResponsesApi({
      apiKey,
      input,
      instructions,
      model,
      temperature,
      tools,
    });
    inputTokens += Number(payload.usage?.input_tokens ?? 0);
    outputTokens += Number(payload.usage?.output_tokens ?? 0);
  }

  // La disponibilidad se redacta con datos estructurados del servidor. Dejar
  // esta parte al modelo permitia que un ISO de 01:00 AM terminara anunciado
  // como 1 PM aunque la consulta a GHL hubiera sido correcta.
  const availabilityCall = toolCalls.findLast(
    (call) => call.name === "consultar_disponibilidad",
  );
  const bookingCall = toolCalls.findLast((call) => call.name === "agendar_cita");

  if (bookingCall) {
    const result = bookingCall.result as Record<string, unknown>;

    return {
      answer: ensureAgentIntroduction(
        buildDirectBookingAnswer(result, calendarRuntime!),
        agent,
        introduceAgent,
      ),
      calendarGuard:
        result.confirmada === true
          ? null
          : "La reserva fue rechazada o el horario ya no estaba libre.",
      timezoneWarning,
      model: payload.model ?? model,
      responseId: payload.id ?? null,
      toolCalls,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    };
  }

  if (availabilityCall) {
    const result = availabilityCall.result as Record<string, unknown>;

    return {
      answer: ensureAgentIntroduction(
        buildDirectAvailabilityAnswer(result, calendarRuntime!),
        agent,
        introduceAgent,
      ),
      calendarGuard:
        typeof result.error === "string"
          ? "La consulta de disponibilidad fallo en GHL."
          : null,
      timezoneWarning,
      model: payload.model ?? model,
      responseId: payload.id ?? null,
      toolCalls,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    };
  }

  // Cuando el cliente elige una hora ya ofrecida, la reserva no depende de que
  // el modelo conserve el ISO de una tool anterior. El servidor vuelve a
  // validar esa fecha/hora en GHL y crea la cita con el slot real.
  if (
    explicitBookingRequest &&
    calendarRuntime &&
    calendarRuntime.calendars.length === 1 &&
    calendarRequest?.dateKey &&
    calendarRequest.time &&
    !toolCalls.some((call) => call.name === "agendar_cita")
  ) {
    const result = await runCalendarTool(
      calendarRuntime,
      {
        arguments: JSON.stringify({
          motivo: "Cita",
          nombre: calendarRuntime.contact.fullName ?? "Cliente",
        }),
        name: "agendar_cita",
      },
      messages,
    );
    toolCalls.push({ automatic: true, name: "agendar_cita", result });

    return {
      answer: ensureAgentIntroduction(
        buildDirectBookingAnswer(result, calendarRuntime),
        agent,
        introduceAgent,
      ),
      calendarGuard:
        result.confirmada === true
          ? null
          : "La reserva directa fue rechazada o el horario ya no estaba libre.",
      timezoneWarning,
      model: payload.model ?? model,
      responseId: payload.id ?? null,
      toolCalls,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    };
  }

  const sanitized = sanitizeCalendarAnswer({
    answer: getResponseText(payload),
    calendarRuntime,
    toolCalls,
  });

  return {
    answer: ensureAgentIntroduction(sanitized.answer, agent, introduceAgent),
    calendarGuard: sanitized.blockedReason,
    timezoneWarning,
    model: payload.model ?? model,
    responseId: payload.id ?? null,
    toolCalls,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

async function generateContactInsights(agent: AgentRow, messages: MessageRow[]) {
  const apiKey = await getWorkspaceOpenAIKey(agent.workspace_id);

  if (!apiKey) {
    throw new Error("OpenAI no está conectado para este workspace.");
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
        "Eres un clasificador CRM. Usa tags cortos en snake_case, máximo 5 tags. No agregues markdown.",
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
    throw new Error(payload.error?.message ?? "OpenAI rechazó el resumen.");
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
          : "Conversación pendiente de revisar.",
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
    const { data: contactStatus } = await supabase
      .from("contacts")
      .select("messaging_status")
      .eq("id", conversation.contact_id)
      .eq("workspace_id", conversation.workspace_id)
      .maybeSingle();

    if (contactStatus?.messaging_status === "blocked") {
      await supabase
        .from("conversations")
        .update({ ai_enabled: false, status: "pending_handoff" })
        .eq("id", conversation.id)
        .eq("workspace_id", conversation.workspace_id);
      results.push({ conversationId: conversation.id, status: "contact_blocked" });
      continue;
    }

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
      .select("body, created_at, direction, role, media_url, message_type")
      .eq("workspace_id", conversation.workspace_id)
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const chronologicalMessages = [...(messages ?? [])].reverse() as MessageRow[];
    const latestMessage = chronologicalMessages.at(-1);

    if (
      !latestMessage ||
      latestMessage.direction !== "inbound" ||
      latestMessage.role === "system" ||
      !latestMessage.body?.trim()
    ) {
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
      conversation.agent_id,
    );
    const agent = routedAgent.agent;

    if (!agent) {
      results.push({ conversationId: conversation.id, status: "no_agent" });
      continue;
    }

    try {
      const typedAgent = agent as AgentRow;
      // Si el contacto pide un humano, no se gasta una respuesta de IA: se
      // escala y se le avisa. Antes estas palabras estaban configuradas pero
      // no las leia nadie.
      const matchedKeyword = findHandoffKeyword(
        latestMessage.body,
        getHandoffKeywords(typedAgent.config),
      );

      if (matchedKeyword) {
        await applyConversationHandoff({
          contactId: conversation.contact_id,
          conversationId: conversation.id,
          reason: `El contacto escribio "${matchedKeyword}".`,
          source: "keyword",
          summary: latestMessage.body?.trim() ?? null,
          supabase,
          workspaceId: conversation.workspace_id,
        });
        await supabase.from("messages").insert({
          body: HANDOFF_CLIENT_NOTICE,
          contact_id: conversation.contact_id,
          conversation_id: conversation.id,
          direction: "outbound",
          message_type: "text",
          metadata: {
            delivery: "queued_only",
            handoff_keyword: matchedKeyword,
            kind: "handoff_ack",
          },
          role: "assistant",
          status: "queued",
          workspace_id: conversation.workspace_id,
        });
        results.push({
          conversationId: conversation.id,
          handoffSource: "keyword",
          status: "handoff",
        });
        continue;
      }

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
      const calendarResult = await buildCalendarRuntime({
        agentName: typedAgent.name,
        contactId: conversation.contact_id,
        enabledToolIds: getEnabledToolIds(typedAgent.config),
        isBookingAgent: isBookingAgent(typedAgent),
        workspaceId: conversation.workspace_id,
      });
      const calendarRuntime = calendarResult.runtime;
      const reply = await generateReply(
        typedAgent,
        chronologicalMessages,
        (knowledgeAssets ?? []) as KnowledgeAsset[],
        businessProfile as BusinessProfileAsset | null,
        calendarRuntime,
        !conversation.agent_id || conversation.agent_id !== typedAgent.id,
      );
      const insights = await generateContactInsights(
        typedAgent,
        chronologicalMessages,
      );

      if (!reply.answer) {
        results.push({ conversationId: conversation.id, status: "empty_reply" });
        continue;
      }

      // Si el agente admitio que no sabe, o prometio que alguien contactaria al
      // cliente, la conversacion pasa a la bandeja de handoff de la empresa. Se
      // mira lo que escribio, que es lo unico comprobable.
      const answerHandoff = detectAnswerHandoff(reply.answer);
      // El cliente tiene que enterarse de que cambia de interlocutor. Sin esto
      // leia un "no tengo esa información" y parecia un callejon sin salida.
      const answerBody = answerHandoff
        ? withHandoffNotice(reply.answer)
        : reply.answer;

      const { data: message, error: messageError } = await supabase
        .from("messages")
        .insert({
          body: answerBody,
          contact_id: conversation.contact_id,
          conversation_id: conversation.id,
          direction: "outbound",
          input_tokens: Number(reply.usage.input_tokens ?? 0),
          message_type: "text",
          metadata: {
            calendar_guard: reply.calendarGuard,
            calendar_tool_calls: reply.toolCalls,
            calendar_unavailable_reason:
              calendarResult.reason ?? reply.timezoneWarning ?? null,
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
          calendar_guard: reply.calendarGuard,
          calendar_tool_calls: reply.toolCalls,
          calendar_unavailable_reason:
            calendarResult.reason ?? reply.timezoneWarning ?? null,
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

      if (answerHandoff) {
        await applyConversationHandoff({
          contactId: conversation.contact_id,
          conversationId: conversation.id,
          reason: answerHandoff.reason,
          source: answerHandoff.source,
          summary: latestMessage.body?.trim() ?? null,
          supabase,
          workspaceId: conversation.workspace_id,
        });
      }

      results.push({
        agentId: typedAgent.id,
        agentName: typedAgent.name,
        // Por que el agente no pudo usar el calendario, si fue el caso.
        calendarUnavailable: calendarResult.reason ?? undefined,
        conversationId: conversation.id,
        handoffSource: answerHandoff?.source,
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
