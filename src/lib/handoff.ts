import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Json } from "@/lib/supabase/database.types";

type AdminClient = SupabaseClient;

/** Marca que llevan los mensajes internos generados por un handoff. */
export const HANDOFF_EVENT_KIND = "handoff";

/** De donde salio la escalada. Sirve para auditar en el inbox. */
export type HandoffSource =
  | "flow_review"
  | "keyword"
  | "promise_guard"
  | "unknown_answer";

/**
 * Se inyecta en runtime, asi la regla aplica tambien a los agentes ya creados.
 * No hay tool que llamar: el agente solo tiene que admitir que no sabe, y el
 * sistema escala solo. Una tool no habria servido de nada contra un agente que
 * se inventa la respuesta, que es el caso que de verdad hace dano.
 */
export function buildHandoffContext() {
  return `Cuando no sepas algo:
- Si no tienes la respuesta, o el tema no es tuyo, o el cliente reporta un problema con algo que ya contrato, DILO EN CLARO: "no tengo esa informacion" o "eso no lo puedo resolver yo".
- En cuanto lo digas, la conversacion pasa automaticamente a una persona del equipo, y el sistema se lo avisa al cliente por ti. No lo anuncies tu ni lo repitas.
- PROHIBIDO inventarte la respuesta para salir del paso. Preferimos mil veces un "no lo se" que un dato falso.
- No derives al cliente a un tercero ajeno al negocio. Si el problema es de un servicio del negocio, se resuelve aqui dentro.
- No prometas plazos ni soluciones concretas al decirlo.`;
}

/**
 * Lo que lee el cliente cuando la conversacion cambia de manos. Se anade desde
 * el servidor y no se deja a criterio del modelo: un "no tengo esa informacion"
 * a secas deja al cliente pensando que ahi se acabo la conversacion.
 */
export const HANDOFF_CLIENT_NOTICE =
  "Te paso con una persona del equipo para que lo revise y te responda por aqui mismo.";

export function normalizeHandoffText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getHandoffKeywords(config: Json) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [];
  }

  const keywords = (config as Record<string, unknown>).handoff_keywords;

  return Array.isArray(keywords)
    ? keywords.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

/**
 * Coincidencia por palabra completa: con `includes` la keyword "persona"
 * saltaba dentro de "personalizado" y "caro" dentro de "carro".
 */
export function findHandoffKeyword(text: string | null | undefined, keywords: string[]) {
  const normalizedText = normalizeHandoffText(text ?? "");

  if (!normalizedText.trim()) {
    return null;
  }

  return (
    keywords.find((keyword) => {
      const normalizedKeyword = normalizeHandoffText(keyword).trim();

      if (!normalizedKeyword) {
        return false;
      }

      const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normalizedText);
    }) ?? null
  );
}

const TEAM_NOUNS = "equipo|soporte|tecnic[oa]|companer[oa]|responsable|encargado|area|departamento|asesor";
const CASE_NOUNS = "solicitud|caso|consulta|peticion|mensaje|incidencia";

const HANDOFF_PROMISE_PATTERNS = [
  // "voy a avisar al equipo", "puedo escalarlo al area tecnica"
  new RegExp(
    `\\b(voy a|vamos a|puedo|podemos|paso|pasare|pasaremos|traslado|trasladare|derivo|derivare|escalo|escalare|aviso|avisare)\\b[^.]{0,60}\\b(${TEAM_NOUNS})`,
  ),
  // "te ayudare a contactar al equipo tecnico", "conectate con soporte".
  // Tambien salta si manda al cliente con un tecnico de fuera: derivar hacia
  // afuera tambien merece que una persona lo mire.
  new RegExp(
    `\\b(contactar|contact[ae]\\w*|avisar|escribir|hablar|comunicar\\w*|comuniqu\\w*|conectar\\w*|conect[ae]\\w*)\\b[^.]{0,25}\\b(${TEAM_NOUNS})`,
  ),
  // "el equipo te escribira en breve"
  new RegExp(
    `\\b(el|un|nuestro|mi)\\s+(${TEAM_NOUNS})\\b[^.]{0,60}\\b(te|le)\\s+(contactar|escribir|llamar|respondera|atender)`,
  ),
  /\b(te|le)\s+(contactara|contactaran|escribira|escribiran|llamara|llamaran|respondera|responderan|atendera|atenderan)\b/,
  // "voy a pasar tu solicitud", "dejo registrado tu caso"
  new RegExp(
    `\\b(pasar|paso|pasare|trasladar|traslado|derivar|derivo|escalar|escalo|dejar|dejo|dejare|registrar|registro|registrare|anotar|anoto)\\b[^.]{0,25}\\b(tu|su)\\s+(${CASE_NOUNS})`,
  ),
  // "se pondran en contacto contigo"
  /\bse\s+(pongan|pondra|pondran|ponen)\s+en\s+contacto\b/,
];

/**
 * El aviso solo se anade si el agente no lo dijo ya por su cuenta. Los patrones
 * de promesa son justo la senal de "aqui ya se anuncia un humano", asi que se
 * reutilizan: sin esto el cliente leia lo mismo tres veces seguidas.
 */
export function withHandoffNotice(answer: string | null | undefined) {
  const clean = (answer ?? "").trim();

  if (!clean) {
    return HANDOFF_CLIENT_NOTICE;
  }

  const normalized = normalizeHandoffText(clean);

  if (
    normalized.includes("una persona del equipo") ||
    HANDOFF_PROMISE_PATTERNS.some((pattern) => pattern.test(normalized))
  ) {
    return clean;
  }

  return `${clean}\n\n${HANDOFF_CLIENT_NOTICE}`;
}

/**
 * "No se" explicito. Los patrones son cerrados a proposito: "no se si prefieres
 * el martes" o "no se puede pagar en cuotas" son frases normales y no pueden
 * apagar la IA.
 */
const UNKNOWN_ANSWER_PATTERNS = [
  /\bno lo se\b/,
  /\bno (sabria|se) (decirte|decirle|responderte|responderle|confirmarte|confirmarle)\b/,
  /\bno (tengo|dispongo de|cuento con|manejo)\b[^.]{0,20}\b(esa|ese|la|el|dicha|dicho)?\s*(informacion|dato|datos|detalle|respuesta)\b/,
  /\bno tengo (forma|manera) de (saber|confirmar|verificar)\b/,
  /\bno (puedo|podria) (ayudarte|ayudarle|resolver|responder|confirmar)\b/,
  /\bdesconozco\b/,
  /\bno (es|esta)\b[^.]{0,15}\b(mi area|mi alcance|de mi competencia)\b/,
  /\bno (aparece|figura|consta)\b[^.]{0,30}\b(informacion|documentos|base|datos)\b/,
  /\bescapa a lo que puedo\b/,
];

/**
 * Red de seguridad sobre el texto que el agente escribe: si admite que no sabe,
 * o si promete que una persona va a intervenir, la conversacion se escala. Es
 * lo unico verificable -- si el agente se inventa la respuesta, no hay senal.
 */
export function detectAnswerHandoff(answer: string | null | undefined) {
  const normalized = normalizeHandoffText(answer ?? "");

  if (UNKNOWN_ANSWER_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      reason: "El agente respondio que no sabe o no puede resolverlo.",
      source: "unknown_answer" as HandoffSource,
    };
  }

  if (HANDOFF_PROMISE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      reason: "El agente prometio que una persona continuaria la conversacion.",
      source: "promise_guard" as HandoffSource,
    };
  }

  return null;
}

export type ConversationHandoffInfo = {
  handoffAt: string;
  reason: string;
  source: string;
};

/**
 * Ultimo evento de handoff por conversacion, para explicar en el inbox por que
 * cayo ahi. Sin esto la pestana de handoff es una lista sin contexto.
 */
export async function getConversationHandoffInfo(
  supabase: AdminClient,
  workspaceId: string,
  conversationIds: string[],
) {
  const info = new Map<string, ConversationHandoffInfo>();

  if (conversationIds.length === 0) {
    return info;
  }

  const { data: events } = await supabase
    .from("messages")
    .select("conversation_id, created_at, metadata")
    .eq("workspace_id", workspaceId)
    .eq("direction", "internal")
    .eq("metadata->>kind", HANDOFF_EVENT_KIND)
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  (events ?? []).forEach((event) => {
    if (info.has(event.conversation_id)) {
      return;
    }

    const metadata =
      event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : {};

    info.set(event.conversation_id, {
      handoffAt:
        typeof metadata.handoff_at === "string" ? metadata.handoff_at : event.created_at,
      reason: typeof metadata.reason === "string" ? metadata.reason : "Sin motivo registrado.",
      source: typeof metadata.source === "string" ? metadata.source : "agent_tool",
    });
  });

  return info;
}

function buildHandoffNote(reason: string, summary: string | null, source: HandoffSource) {
  const origin =
    source === "keyword"
      ? "El contacto uso una palabra de handoff"
      : source === "promise_guard"
        ? "La IA prometio intervencion humana"
        : source === "flow_review"
          ? "Una respuesta del onboarding necesita revision"
          : "La IA no supo responder";

  return [`Handoff: ${origin}.`, `Motivo: ${reason}`, summary ? `Resumen: ${summary}` : null]
    .filter(Boolean)
    .join("\n");
}

/**
 * Punto unico de escalada: apaga la IA, marca la conversacion y le pone dueno.
 * Cualquier camino nuevo (tool, keyword, flow) deberia entrar por aqui para que
 * el inbox y la asignacion queden siempre coherentes.
 */
export async function applyConversationHandoff({
  contactId,
  conversationId,
  reason,
  source,
  summary,
  supabase,
  workspaceId,
}: {
  contactId?: string | null;
  conversationId: string;
  reason: string;
  source: HandoffSource;
  summary?: string | null;
  supabase: AdminClient;
  workspaceId: string;
}) {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("contact_id")
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const handoffAt = new Date().toISOString();

  // La conversacion queda de la empresa, no de una persona: todo el equipo la
  // ve igual en la pestana de handoff y la coge quien pueda.
  await supabase
    .from("conversations")
    .update({
      ai_enabled: false,
      status: "pending_handoff",
    })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);

  await supabase.from("messages").insert({
    body: buildHandoffNote(reason, summary ?? null, source),
    contact_id: contactId ?? (conversation?.contact_id as string | null) ?? null,
    conversation_id: conversationId,
    direction: "internal",
    message_type: "event",
    metadata: {
      handoff_at: handoffAt,
      kind: HANDOFF_EVENT_KIND,
      reason,
      source,
      summary: summary ?? null,
    },
    role: "system",
    status: "stored",
    workspace_id: workspaceId,
  });

  return { handoffAt };
}
