import { NextResponse } from "next/server";

import type { Json } from "@/lib/supabase/database.types";
import {
  parseCalendarTools,
  resolveCalendarsForAgent,
  type CalendarTool,
} from "@/lib/calendar-tools";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyBusinessVariables,
  buildBusinessContext,
  getBusinessVariables,
} from "@/lib/business-profile";
import { getWorkspaceOpenAIKey } from "@/lib/integrations/openai";
import {
  createAppointment,
  ensureGhlContact,
  getCalendarTimezone,
  getFreeSlots,
  getWorkspaceCalendarContext,
  isValidTimeZone,
  zonedStartOfDay,
} from "@/lib/integrations/ghl-calendar";

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

/**
 * Las definiciones se arman segun los calendarios que tenga el agente. Con uno
 * solo no se expone el parametro: pedirle al modelo que elija entre una sola
 * opcion solo agrega ruido y posibilidad de error.
 */
function buildCalendarToolDefinitions(calendars: CalendarTool[]) {
  const multiple = calendars.length > 1;
  const options = calendars
    .map(
      (calendar) =>
        `- "${calendar.calendarName}": ${calendar.description || "sin descripcion"}`,
    )
    .join("\n");
  const calendarProperty = multiple
    ? {
        calendario: {
          description: `Cual agenda usar, segun lo que pida el cliente:\n${options}`,
          enum: calendars.map((calendar) => calendar.calendarName),
          type: "string",
        },
      }
    : {};
  const calendarRequired = multiple ? ["calendario"] : [];

  return [
    {
      description:
        "Consulta los horarios realmente disponibles. Usala SIEMPRE antes de proponer u ofrecer cualquier horario al cliente.",
      name: "consultar_disponibilidad",
      parameters: {
        additionalProperties: false,
        properties: {
          ...calendarProperty,
          dias: {
            description:
              "Cuantos dias hacia adelante buscar desde la fecha de inicio. Entre 1 y 14.",
            type: "integer",
          },
          fecha_inicio: {
            description:
              "Fecha desde la que buscar, en formato YYYY-MM-DD. Usa la fecha de hoy si el cliente no indica otra.",
            type: "string",
          },
        },
        required: [...calendarRequired, "fecha_inicio", "dias"],
        type: "object",
      },
      strict: true,
      type: "function",
    },
    {
      description:
        "Crea la cita. Usala solo despues de consultar disponibilidad y de que el cliente haya elegido un horario concreto de los ofrecidos.",
      name: "agendar_cita",
      parameters: {
        additionalProperties: false,
        properties: {
          ...calendarProperty,
          horario_iso: {
            description:
              "El horario exacto elegido, copiado tal cual del campo 'inicio' que devolvio consultar_disponibilidad.",
            type: "string",
          },
          motivo: {
            description: "Motivo o servicio de la cita, en pocas palabras.",
            type: "string",
          },
          nombre: {
            description: "Nombre completo del cliente.",
            type: "string",
          },
        },
        required: [...calendarRequired, "horario_iso", "nombre", "motivo"],
        type: "object",
      },
      strict: true,
      type: "function",
    },
  ];
}

function getEnabledToolIds(config: Json) {
  const record = getConfigRecord(config);
  return Array.isArray(record.enabled_tools)
    ? record.enabled_tools.filter((item): item is string => typeof item === "string")
    : [];
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
      "agend",
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

/**
 * La fecha de hoy va SIEMPRE, tenga o no calendario conectado. Sin esto el
 * modelo no sabe en que dia esta y se inventa fechas: pedirle "este viernes" le
 * hacia responder con un viernes de otro mes.
 */
function buildTimeContext(timezone: string) {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  const weekday = new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    weekday: "long",
  }).format(now);

  return `Fecha actual:
- Hoy es ${weekday} ${today} (formato YYYY-MM-DD), zona horaria ${timezone}.
- Calcula "hoy", "manana", "este viernes" o "la proxima semana" a partir de esa fecha.
- Nunca inventes una fecha ni cambies de mes. Si no puedes calcularla con certeza, preguntale al cliente.`;
}

/**
 * Barrera anti-alucinacion para agentes sin calendario. Sin esto un agente
 * afirmaba haber agendado citas que nunca existieron en GoHighLevel.
 */
function buildNoCalendarContext() {
  return `Agenda -- NO tienes acceso:
- No puedes consultar disponibilidad ni crear citas. No tienes ninguna tool de calendario.
- PROHIBIDO decir que agendaste, reservaste, confirmaste o registraste una cita.
- PROHIBIDO afirmar que tienes un horario libre o proponer una hora concreta.
- PROHIBIDO prometer recordatorios o confirmaciones de una cita.
- Si el cliente quiere agendar, dile con naturalidad que enseguida lo ayudan con la agenda y pidele que confirme que quiere reservar. No inventes el paso siguiente.`;
}

function buildCalendarContext(calendarRuntime: CalendarRuntime | null) {
  if (!calendarRuntime) {
    return buildNoCalendarContext();
  }

  // Sin la fecha de hoy el modelo no puede resolver "manana" ni "el jueves".
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: calendarRuntime.timezone,
  }).format(new Date());

  const calendarList =
    calendarRuntime.calendars.length > 1
      ? `\n- Tienes varias agendas. Elige la que corresponda a lo que pida el cliente:\n${calendarRuntime.calendars
          .map(
            (calendar) =>
              `  - "${calendar.calendarName}": ${
                calendar.description || "sin descripcion"
              }`,
          )
          .join(
            "\n",
          )}\n- Si no queda claro cual corresponde, preguntale al cliente antes de consultar horarios.`
      : "";

  return `Agenda conectada:
- Hoy es ${today} (formato YYYY-MM-DD) en la zona horaria ${calendarRuntime.timezone}.
- Tienes acceso real al calendario mediante tools. Los horarios que devuelven son reales.${calendarList}
- Antes de mencionar cualquier horario, llama a consultar_disponibilidad. Nunca inventes huecos.
- Ofrece como maximo 3 opciones por mensaje, en lenguaje natural, sin mostrar fechas ISO ni IDs.
- Solo llama a agendar_cita cuando el cliente haya elegido explicitamente uno de los horarios que le ofreciste, y ya tengas su nombre.
- Si una tool devuelve un error, no lo repitas literal: explica el problema en palabras simples y ofrece otra opcion.`;
}

function buildInstructions(
  agent: AgentRow,
  assets: KnowledgeAsset[],
  businessProfile: BusinessProfileAsset | null | undefined,
  calendarRuntime: CalendarRuntime | null,
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
  const calendarContext = buildCalendarContext(calendarRuntime);
  // La zona del calendario si existe; si no, la de la empresa. La fecha se
  // inyecta siempre, tenga o no agenda conectada.
  const profileTimezone = getBusinessVariables(businessProfile).timezone;
  const timeContext = buildTimeContext(
    calendarRuntime?.timezone ??
      (profileTimezone && isValidTimeZone(profileTimezone)
        ? profileTimezone
        : "UTC"),
  );
  const identityContext = `Identidad:
- Te llamas ${identity.agentName}${identity.jobTitle ? ` y eres ${identity.jobTitle}` : ""}.
- En tu primer mensaje de la conversacion presentate por tu nombre y di en que puedes ayudar.
- Habla siempre en primera persona como ${identity.agentName}. Nunca escribas "IA:" ni "assistant:" delante de tu respuesta.`;

  if (assets.length === 0) {
    return [
      identityContext,
      businessContext,
      promptWithVariables,
      timeContext,
      calendarContext,
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
- La base de conocimiento tiene prioridad sobre el prompt del agente.
- Si la base contiene una instruccion directa sobre como responder, obedecela literalmente.
- Usa estos documentos como fuente principal para responder.
- Si la respuesta no esta en la base, dilo con claridad y pide que un humano lo confirme.
- No inventes precios, horarios, politicas ni condiciones que no aparezcan aqui.

Prompt del agente:
${promptWithVariables}

${businessContext}

${timeContext}

${calendarContext}`;
}

type CalendarRuntime = {
  apiKey: string;
  calendars: CalendarTool[];
  contact: {
    email: string | null;
    fullName: string | null;
    ghlContactId: string | null;
    id: string;
    phone: string;
  };
  locationId: string;
  timezone: string;
  workspaceId: string;
};

async function buildCalendarRuntime({
  agent,
  businessProfile,
  contactId,
  workspaceId,
}: {
  agent: AgentRow;
  businessProfile: BusinessProfileAsset | null;
  contactId: string;
  workspaceId: string;
}): Promise<CalendarRuntime | null> {
  // Solo el agente de citas agenda. El setter y el de soporte no deben tocar
  // el calendario aunque el workspace lo tenga conectado.
  if (agent.type !== "booking") {
    return null;
  }

  const context = await getWorkspaceCalendarContext(workspaceId);

  if (!context) {
    return null;
  }

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("contacts")
    .select("id, email, full_name, phone_e164, metadata")
    .eq("id", contactId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!contact?.phone_e164) {
    return null;
  }

  // El agente elige entre los calendarios que tenga asignados, salvo que un
  // flujo le haya fijado uno a este contacto.
  const { data: toolAssets } = await admin
    .from("workspace_assets")
    .select("id, title, content, metadata")
    .eq("workspace_id", workspaceId)
    .eq("kind", "tool")
    .neq("status", "archived");
  const calendars = resolveCalendarsForAgent({
    contactMetadata: contact.metadata,
    enabledToolIds: getEnabledToolIds(agent.config),
    tools: parseCalendarTools(toolAssets ?? []),
  });
  // Compatibilidad: si aun no se crearon tools de calendario, se usa el que
  // quedo configurado en la tarjeta de Integraciones.
  const fallbackCalendars: CalendarTool[] =
    calendars.length > 0
      ? calendars
      : context.calendarId
        ? [
            {
              calendarId: context.calendarId,
              calendarName: "Agenda del negocio",
              description: "Calendario configurado en Integraciones.",
              id: "",
              isDefault: true,
              title: "Agenda del negocio",
            },
          ]
        : [];

  if (fallbackCalendars.length === 0) {
    return null;
  }

  // Cada empresa tiene su propia zona horaria. Se toma la del perfil de negocio
  // y, si no esta configurada, la que tenga el calendario en GHL. Nunca se
  // adivina una por defecto: una zona equivocada agenda a la hora equivocada.
  const profileTimezone = getBusinessVariables(businessProfile).timezone;
  const timezone =
    profileTimezone && isValidTimeZone(profileTimezone)
      ? profileTimezone
      : await getCalendarTimezone({
          apiKey: context.apiKey,
          calendarId: fallbackCalendars[0].calendarId,
          locationId: context.locationId,
        });

  if (!timezone) {
    return null;
  }

  const metadata =
    contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata)
      ? (contact.metadata as Record<string, unknown>)
      : {};

  return {
    apiKey: context.apiKey,
    calendars: fallbackCalendars,
    contact: {
      email: contact.email,
      fullName: contact.full_name,
      ghlContactId:
        typeof metadata.ghl_contact_id === "string" ? metadata.ghl_contact_id : null,
      id: contact.id,
      phone: contact.phone_e164,
    },
    locationId: context.locationId,
    timezone,
    workspaceId,
  };
}

async function runCalendarTool(
  runtime: CalendarRuntime,
  call: OpenAIOutputItem,
): Promise<Record<string, unknown>> {
  let args: Record<string, unknown> = {};

  try {
    args = JSON.parse(call.arguments ?? "{}") as Record<string, unknown>;
  } catch {
    return { error: "No se pudieron leer los argumentos de la tool." };
  }

  // Con un solo calendario el modelo no manda el parametro; con varios elige
  // por nombre. Si manda uno que no existe, se corta: agendar en el calendario
  // equivocado es peor que pedirle que lo reintente.
  const requested = typeof args.calendario === "string" ? args.calendario.trim() : "";
  const calendar = requested
    ? runtime.calendars.find((item) => item.calendarName === requested)
    : runtime.calendars[0];

  if (!calendar) {
    return {
      error: `No existe la agenda "${requested}". Opciones validas: ${runtime.calendars
        .map((item) => item.calendarName)
        .join(", ")}.`,
    };
  }

  try {
    if (call.name === "consultar_disponibilidad") {
      // La medianoche se resuelve en la zona horaria de esta empresa, no en la
      // del servidor: si no, el rango se corre y cada empresa recibe otro dia.
      const startDate = zonedStartOfDay(String(args.fecha_inicio), runtime.timezone);

      if (!startDate) {
        return { error: "fecha_inicio invalida. Usa formato YYYY-MM-DD." };
      }

      const days = Math.min(Math.max(Number(args.dias) || 1, 1), 14);
      const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
      const slots = await getFreeSlots({
        apiKey: runtime.apiKey,
        calendarId: calendar.calendarId,
        endDate,
        startDate,
        timezone: runtime.timezone,
      });

      if (slots.length === 0) {
        return {
          horarios: [],
          mensaje:
            "No hay horarios libres en ese rango. Ofrece buscar en fechas posteriores.",
        };
      }

      return {
        horarios: slots.slice(0, 12).map((slot) => ({
          cuando: slot.label,
          inicio: slot.iso,
        })),
        zona_horaria: runtime.timezone,
      };
    }

    if (call.name === "agendar_cita") {
      const startTime = String(args.horario_iso ?? "");

      if (Number.isNaN(new Date(startTime).getTime())) {
        return {
          error:
            "horario_iso invalido. Copia exactamente el campo 'inicio' de consultar_disponibilidad.",
        };
      }

      const ghlContactId =
        runtime.contact.ghlContactId ??
        (await ensureGhlContact({
          apiKey: runtime.apiKey,
          email: runtime.contact.email,
          fullName: String(args.nombre ?? "") || runtime.contact.fullName,
          locationId: runtime.locationId,
          phone: runtime.contact.phone,
        }));

      if (!ghlContactId) {
        return { error: "No se pudo crear el contacto en GoHighLevel." };
      }

      const appointmentId = await createAppointment({
        apiKey: runtime.apiKey,
        calendarId: calendar.calendarId,
        contactId: ghlContactId,
        locationId: runtime.locationId,
        startTime,
        title: `${String(args.motivo ?? "Cita")} - ${String(args.nombre ?? "")}`.trim(),
      });

      const admin = createAdminClient();
      const { data: contactRow } = await admin
        .from("contacts")
        .select("metadata")
        .eq("id", runtime.contact.id)
        .eq("workspace_id", runtime.workspaceId)
        .maybeSingle();
      const currentMetadata =
        contactRow?.metadata &&
        typeof contactRow.metadata === "object" &&
        !Array.isArray(contactRow.metadata)
          ? (contactRow.metadata as Record<string, unknown>)
          : {};

      await admin
        .from("contacts")
        .update({
          metadata: {
            ...currentMetadata,
            ghl_appointment_id: appointmentId,
            ghl_appointment_start: startTime,
            ghl_contact_id: ghlContactId,
          },
        })
        .eq("id", runtime.contact.id)
        .eq("workspace_id", runtime.workspaceId);

      return { cita_id: appointmentId, confirmada: true, inicio: startTime };
    }

    return { error: `Tool desconocida: ${call.name}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Error al llamar GoHighLevel.",
    };
  }
}

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
    throw new Error(payload.error?.message ?? "OpenAI rechazo el buffer.");
  }

  return payload;
}

async function generateReply(
  agent: AgentRow,
  messages: MessageRow[],
  knowledgeAssets: KnowledgeAsset[],
  businessProfile: BusinessProfileAsset | null | undefined,
  calendarRuntime: CalendarRuntime | null,
) {
  const apiKey = await getWorkspaceOpenAIKey(agent.workspace_id);

  if (!apiKey) {
    throw new Error("OpenAI no esta conectado para este workspace.");
  }

  const model = normalizeModel(agent.model);
  const temperature = Number(agent.temperature ?? 0.4);
  const instructions = buildInstructions(
    agent,
    knowledgeAssets,
    businessProfile,
    calendarRuntime,
  );
  const transcript = buildTranscript(messages);
  const tools = calendarRuntime
    ? buildCalendarToolDefinitions(calendarRuntime.calendars)
    : undefined;
  const input: unknown[] = [
    {
      content: `Conversacion reciente:\n${transcript}\n\nResponde el ultimo mensaje del cliente.`,
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
      const result = await runCalendarTool(calendarRuntime, call);
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

  return {
    answer: getResponseText(payload),
    model: payload.model ?? model,
    responseId: payload.id ?? null,
    toolCalls,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
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
      .select("body, created_at, direction, role")
      .eq("workspace_id", conversation.workspace_id)
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(8);
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
      const calendarRuntime = await buildCalendarRuntime({
        agent: typedAgent,
        businessProfile: businessProfile as BusinessProfileAsset | null,
        contactId: conversation.contact_id,
        workspaceId: conversation.workspace_id,
      });
      const reply = await generateReply(
        typedAgent,
        chronologicalMessages,
        (knowledgeAssets ?? []) as KnowledgeAsset[],
        businessProfile as BusinessProfileAsset | null,
        calendarRuntime,
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
            calendar_tool_calls: reply.toolCalls,
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
