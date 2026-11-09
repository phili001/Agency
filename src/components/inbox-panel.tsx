"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CircleDollarSign,
  Clock3,
  GitBranch,
  Hand,
  ListPlus,
  ListX,
  Loader2,
  MessageSquareText,
  Mic,
  NotebookPen,
  Paperclip,
  Phone,
  Search,
  SendHorizonal,
  UserRound,
  X,
} from "lucide-react";

import { ContactCrmSummary } from "@/components/crm/contact-crm-summary";
import { createClient } from "@/lib/supabase/client";
import { clientFetch } from "@/lib/client-fetch";

/** Ritmo del polling del inbox: rapido mientras hay movimiento, lento en reposo. */
const SNAPSHOT_POLL_MIN_MS = 3500;
const SNAPSHOT_POLL_MAX_MS = 10000;

type ConversationItem = {
  aiEnabled?: boolean;
  business: string;
  contactId?: string | null;
  contactMetadata?: {
    ai_summary?: string;
    ai_tags?: string[];
    automation_labels?: string[];
    flow_progress?: {
      completedStageKeys?: string[];
      completedStepIds?: string[];
      completedSteps?: number;
      currentStageKey?: string;
      currentStageLabel?: string;
      flowId?: string;
      totalSteps?: number;
      updatedAt?: string;
    };
    flow_opt_out?: {
      at?: string;
      by?: string | null;
      reason?: string;
    };
    messaging_status?: "active" | "blocked";
    pending_review?: {
      attempt_count: number;
      created_at: string;
      id: string;
      original_answer: string;
      question: string;
      validation_reason: string;
    };
    ycloud_contact_name?: string;
  } | null;
  contactPhone?: string | null;
  handoff?: {
    handoffAt: string;
    reason: string;
    source: string;
  };
  id: string;
  name: string;
  onboarding?: {
    completedSteps: number;
    currentStepId?: string | null;
    flowId: string;
    runId: string;
    stageLabel: string;
    status: string;
    totalSteps: number;
  };
  rawStatus?: string;
  status: string;
  summary: string;
  time: string;
  workspaceId?: string | null;
};

type InboxView = "ai" | "handoff" | "onboarding";

/** Igual que el `.limit(100)` del panel y de /api/inbox/snapshot. */
const INBOX_CONVERSATION_LIMIT = 100;

const handoffSourceLabel: Record<string, string> = {
  flow_review: "Revisión de onboarding",
  keyword: "Lo pidió el contacto",
  promise_guard: "La IA prometio un humano",
  unknown_answer: "La IA no supo responder",
};

const pendingOnboardingStatuses = new Set([
  "active",
  "blocked",
  "failed",
  "paused",
  "review_pending",
  "waiting",
]);

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s+\-().]/g, "");
}

function messageTypeLabel(type: string) {
  switch (type) {
    case "audio":
      return "Nota de voz sin archivo";
    case "image":
      return "Imagen sin archivo";
    case "file":
      return "Documento sin archivo";
    case "event":
      return "Mensaje que no se puede mostrar aquí; míralo en WhatsApp";
    default:
      return "Mensaje sin texto";
  }
}

/**
 * Foto, nota de voz o documento del mensaje. Se sirve por /api/media porque el
 * link de YCloud caduca en minutos si no va con la API key.
 */
/**
 * Que pintar: foto, audio o documento. Se mira el tipo guardado y, si no
 * ayuda, el MIME del archivo: las fotos recibidas antes del arreglo del webhook
 * quedaron con tipo "event" y sin esto seguirian saliendo como documento.
 */
function resolveAttachmentKind(message: MessageItem): "audio" | "file" | "image" {
  if (message.message_type === "image" || message.message_type === "audio") {
    return message.message_type;
  }

  const mime = message.metadata?.media_mime_type ?? "";

  if (mime.startsWith("image/")) {
    return "image";
  }

  if (mime.startsWith("audio/")) {
    return "audio";
  }

  return "file";
}

function MessageAttachment({ message }: { message: MessageItem }) {
  if (!message.media_url) {
    return null;
  }

  const src = `/api/media/${message.id}`;
  const filename = message.metadata?.media_filename ?? null;
  const kind = resolveAttachmentKind(message);
  const downloadName =
    filename ??
    (kind === "image"
      ? `foto-${message.id.slice(0, 8)}.jpg`
      : kind === "audio"
        ? `nota-de-voz-${message.id.slice(0, 8)}.ogg`
        : `archivo-${message.id.slice(0, 8)}`);

  let attachment;

  if (kind === "image") {
    attachment = (
      <a className="block" href={src} rel="noreferrer" target="_blank">
        {/* eslint-disable-next-line @next/next/no-img-element -- origen dinamico y privado, no pasa por el optimizador */}
        <img
          alt={message.body ?? "Imagen enviada por WhatsApp"}
          className="max-h-72 w-auto max-w-full rounded-md border border-line object-contain"
          loading="lazy"
          src={src}
        />
      </a>
    );
  } else if (kind === "audio") {
    attachment = (
      <div className="flex items-center gap-2 rounded-md border border-line bg-paper-2 px-3 py-2">
        <Mic className="shrink-0 text-ink" size={16} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink">Nota de voz</p>
          <audio className="mt-1 h-8 w-full max-w-xs" controls preload="none" src={src}>
            <a href={src}>Escuchar</a>
          </audio>
        </div>
      </div>
    );
  } else {
    attachment = (
      <a
        className="flex items-center gap-2 rounded-md border border-line bg-paper-2 px-3 py-2 text-ink hover:bg-paper-2"
        href={src}
        rel="noreferrer"
        target="_blank"
      >
        <Paperclip className="shrink-0 text-ink" size={16} />
        <span className="truncate text-xs font-semibold">{filename ?? "Documento adjunto"}</span>
      </a>
    );
  }

  return (
    <div className="mb-2 grid gap-1">
      {attachment}
      {/* WhatsApp conserva el archivo 30 dias; despues el enlace deja de servir. */}
      <p className="flex items-center gap-1 text-[11px] text-muted">
        <Clock3 className="shrink-0" size={11} />
        <span>
          Disponible 30 días ·{" "}
          <a
            className="font-medium text-ink underline-offset-2 hover:underline"
            download={downloadName}
            href={src}
          >
            Guardar en tu dispositivo
          </a>{" "}
          si es importante
        </span>
      </p>
    </div>
  );
}

function isPendingOnboarding(conversation: ConversationItem) {
  return Boolean(
    conversation.onboarding &&
      pendingOnboardingStatuses.has(conversation.onboarding.status),
  );
}

function inboxViewOf(conversation: ConversationItem | undefined): InboxView {
  if (!conversation) return "ai";
  if (isPendingOnboarding(conversation)) return "onboarding";
  return conversation.aiEnabled ? "ai" : "handoff";
}

function onboardingStatusLabel(status: string) {
  switch (status) {
    case "waiting":
      return "Esperando respuesta";
    case "review_pending":
      return "Revisión";
    case "blocked":
      return "Bloqueado";
    case "paused":
      return "Pausado";
    case "failed":
      return "Error";
    default:
      return "En curso";
  }
}

type MessageItem = {
  body: string | null;
  conversation_id: string;
  created_at: string;
  direction: string;
  displayTime?: string;
  id: string;
  media_url?: string | null;
  message_type: string;
  metadata?: {
    calendar_unavailable_reason?: string | null;
    media_filename?: string | null;
    media_mime_type?: string | null;
  } | null;
  role: string;
};

type UsageEventItem = {
  conversation_id: string | null;
  cost_usd: number;
  created_at: string;
  displayTokenTotal?: string;
  id: string;
  input_tokens: number;
  model: string | null;
  output_tokens: number;
  provider: string;
  total_tokens?: number;
};

type WebhookEventItem = {
  created_at: string;
  displayTime?: string;
  error: string | null;
  event_type: string;
  id: string;
  provider: string;
  status: string;
};

type InboxPanelProps = {
  activeRole: string;
  conversations: ConversationItem[];
  /** Conversación a abrir al entrar (`/?conversacion=<id>`), si está en la lista. */
  initialConversationId?: string | null;
  messages: MessageItem[];
  usageEvents: UsageEventItem[];
  webhookEvents: WebhookEventItem[];
  workspaceId: string | null;
};

export function InboxPanel({
  activeRole,
  conversations,
  initialConversationId,
  messages,
  usageEvents,
  webhookEvents,
  workspaceId,
}: InboxPanelProps) {
  const supabase = createClient();
  const [localConversations, setLocalConversations] = useState(conversations);
  const initialConversation =
    conversations.find((conversation) => conversation.id === initialConversationId) ?? conversations[0];
  const [selectedConversationId, setSelectedConversationId] = useState(initialConversation?.id ?? "");
  // Abre en la pestaña de la conversación elegida: si no, un enlace a un chat en
  // handoff (o una bandeja sin chats con IA) enseñaría una lista vacía.
  const [inboxView, setInboxView] = useState<InboxView>(() => inboxViewOf(initialConversation));
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [reviewAction, setReviewAction] = useState("");
  const [flowAction, setFlowAction] = useState("");
  const [localMessages, setLocalMessages] = useState<MessageItem[]>(messages);
  const onboardingConversations = useMemo(
    () => localConversations.filter(isPendingOnboarding),
    [localConversations],
  );
  const regularConversations = useMemo(
    () => localConversations.filter((conversation) => !isPendingOnboarding(conversation)),
    [localConversations],
  );
  // La bandeja se parte por quien esta al mando: si la IA responde o si la
  // conversacion espera a una persona. Mezcladas no se veia que estaba parado.
  const aiConversations = useMemo(
    () => regularConversations.filter((conversation) => conversation.aiEnabled),
    [regularConversations],
  );
  const handoffConversations = useMemo(
    () => regularConversations.filter((conversation) => !conversation.aiEnabled),
    [regularConversations],
  );
  const conversationsByView = useMemo(
    () => ({
      ai: aiConversations,
      handoff: handoffConversations,
      onboarding: onboardingConversations,
    }),
    [aiConversations, handoffConversations, onboardingConversations],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = normalizeSearchText(searchQuery);
  // El buscador filtra dentro de la pestaña activa; sin texto no cambia nada.
  const visibleConversations = useMemo(() => {
    const list = conversationsByView[inboxView];

    if (!normalizedQuery) {
      return list;
    }

    return list.filter((conversation) =>
      normalizeSearchText(
        `${conversation.name} ${conversation.contactPhone ?? ""} ${conversation.business}`,
      ).includes(normalizedQuery),
    );
  }, [conversationsByView, inboxView, normalizedQuery]);
  const selectedConversation =
    visibleConversations.find(
      (conversation) => conversation.id === selectedConversationId,
    ) ?? visibleConversations[0];
  const messagesByConversation = useMemo(() => {
    return localMessages.reduce<Record<string, MessageItem[]>>((grouped, message) => {
      grouped[message.conversation_id] ??= [];
      grouped[message.conversation_id].push(message);
      return grouped;
    }, {});
  }, [localMessages]);
  const selectedMessages = useMemo(
    () =>
      selectedConversation
        ? messagesByConversation[selectedConversation.id] ?? []
        : [],
    [messagesByConversation, selectedConversation],
  );
  // Si el ultimo mensaje de la IA no pudo usar el calendario, se explica por que
  // en pantalla, en vez de dejar al agente diciendo "no tengo acceso" sin motivo.
  const calendarIssue = [...selectedMessages]
    .reverse()
    .find((message) => message.metadata?.calendar_unavailable_reason)
    ?.metadata?.calendar_unavailable_reason;
  const messageListRef = useRef<HTMLDivElement>(null);
  const lastMessageId = selectedMessages.at(-1)?.id;

  // Al abrir una conversacion o al llegar un mensaje nuevo hay que ver el final,
  // que es donde esta lo ultimo. Sin esto el chat abre arriba del todo.
  useEffect(() => {
    const list = messageListRef.current;

    if (!list) {
      return;
    }

    list.scrollTop = list.scrollHeight;
  }, [lastMessageId, selectedConversation?.id]);
  const selectedUsageEvents = selectedConversation
    ? usageEvents.filter((event) => event.conversation_id === selectedConversation.id)
    : [];
  const selectedTokenTotal = selectedUsageEvents.reduce(
    (sum, event) =>
      sum + Number(event.total_tokens ?? event.input_tokens + event.output_tokens),
    0,
  );
  const selectedCostTotal = selectedUsageEvents.reduce(
    (sum, event) => sum + Number(event.cost_usd ?? 0),
    0,
  );
  const inboundCount = selectedMessages.filter(
    (message) => message.direction === "inbound",
  ).length;
  const outboundCount = selectedMessages.filter(
    (message) => message.direction === "outbound",
  ).length;
  const internalCount = selectedMessages.filter(
    (message) => message.direction === "internal",
  ).length;
  const canSend =
    Boolean(selectedConversation?.workspaceId) && Boolean(selectedConversation?.id);
  const isBlocked =
    selectedConversation?.contactMetadata?.messaging_status === "blocked";
  const canReply = canSend && !isBlocked;

  function selectInboxView(nextView: InboxView) {
    setInboxView(nextView);
    setSelectedConversationId(conversationsByView[nextView][0]?.id ?? "");
  }

  function stableTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
      date.getUTCMinutes(),
    ).padStart(2, "0")} UTC`;
  }

  function stableNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function upsertLocalMessage(message: MessageItem) {
    setLocalMessages((current) => {
      const withoutMessage = current.filter((item) => item.id !== message.id);
      return [...withoutMessage, message];
    });
  }

  // Id estable de la conversacion abierta, para que el polling pida sus mensajes.
  const openConversationId = selectedConversation?.id ?? "";
  // Conversacion cuyos mensajes ya vinieron renderizados del servidor: al
  // montar no hace falta pedirlos otra vez al instante.
  const serverRenderedConversationIdRef = useRef(
    messages[0]?.conversation_id ?? conversations[0]?.id ?? "",
  );
  // Lo llaman las acciones del usuario: tras enviar o cambiar algo se espera
  // respuesta pronto, asi que el polling vuelve a su ritmo rapido.
  const resetPollingRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let delay = SNAPSHOT_POLL_MIN_MS;
    let lastPayloadText = "";
    let latestRequest = 0;

    async function refreshSnapshot() {
      // Se pide explicitamente la conversacion abierta: el backend solo carga
      // los mensajes de esa, para que el inbox no dependa de cuantos miles de
      // mensajes tenga el workspace.
      const query = new URLSearchParams({ workspaceId: workspaceId! });

      if (openConversationId) {
        query.set("conversationId", openConversationId);
      }

      const requestId = ++latestRequest;
      let text: string;

      try {
        const response = await clientFetch(`/api/inbox/snapshot?${query.toString()}`);

        if (!response.ok) {
          delay = SNAPSHOT_POLL_MAX_MS;
          return;
        }

        text = await response.text();
      } catch {
        delay = Math.min(delay * 2, SNAPSHOT_POLL_MAX_MS);
        return;
      }

      // Una respuesta vieja que llega tarde no pisa a una mas nueva.
      if (cancelled || requestId !== latestRequest) {
        return;
      }

      // Sin cambios no se toca el estado (no se re-renderiza toda la bandeja)
      // y el siguiente ciclo se espacia; cualquier cambio vuelve al ritmo rapido.
      if (text === lastPayloadText) {
        delay = Math.min(Math.round(delay * 1.5), SNAPSHOT_POLL_MAX_MS);
        return;
      }

      lastPayloadText = text;
      delay = SNAPSHOT_POLL_MIN_MS;

      const payload = JSON.parse(text) as {
        conversations?: ConversationItem[];
        messages?: MessageItem[];
        messagesConversationId?: string | null;
      };

      if (payload.conversations?.length) {
        setLocalConversations(payload.conversations);
        setSelectedConversationId((current) => current || payload.conversations?.[0]?.id || "");
      }

      if (payload.messages && payload.messagesConversationId) {
        setLocalMessages((current) => {
          // Se reemplazan solo los de la conversacion que vino; los de las
          // demas se conservan para que volver a ellas sea inmediato.
          const otras = current.filter(
            (message) =>
              message.conversation_id !== payload.messagesConversationId &&
              !message.id.startsWith("local-"),
          );
          const pendientes = current.filter((message) =>
            message.id.startsWith("local-"),
          );
          return [...otras, ...payload.messages!, ...pendientes];
        });
      }
    }

    // Con la pestana oculta no se consulta nada: un panel abierto en segundo
    // plano hacia ~1.000 llamadas por hora a la funcion y ~8 por llamada a
    // Supabase. Al volver a la pestana se actualiza al momento.
    function schedule() {
      window.clearTimeout(timer);

      if (cancelled || document.hidden) {
        return;
      }

      timer = window.setTimeout(() => {
        void refreshSnapshot().finally(schedule);
      }, delay);
    }

    function refreshNow() {
      window.clearTimeout(timer);
      delay = SNAPSHOT_POLL_MIN_MS;
      void refreshSnapshot().finally(schedule);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        window.clearTimeout(timer);
      } else {
        refreshNow();
      }
    }

    resetPollingRef.current = () => {
      delay = SNAPSHOT_POLL_MIN_MS;
      schedule();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (openConversationId === serverRenderedConversationIdRef.current) {
      // Primer montaje: lo que hay en pantalla acaba de llegar del servidor.
      serverRenderedConversationIdRef.current = "";
      schedule();
    } else {
      refreshNow();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resetPollingRef.current = () => {};
    };
  }, [openConversationId, workspaceId]);

  async function insertMessage({
    body,
    direction,
    role,
  }: {
    body: string;
    direction: "outbound" | "internal";
    role: "human";
  }) {
    if (!selectedConversation || !canSend) {
      return { errorMessage: "Selecciona una conversación real." };
    }

    const now = new Date().toISOString();
    const optimisticMessage: MessageItem = {
      body,
      conversation_id: selectedConversation.id,
      created_at: now,
      direction,
      displayTime: stableTime(now),
      id: `local-${crypto.randomUUID()}`,
      message_type: "text",
      role,
    };

    setError("");
    upsertLocalMessage(optimisticMessage);
    resetPollingRef.current();

    if (direction === "outbound") {
      const response = await clientFetch("/api/messages/send", {
        body: JSON.stringify({
          body,
          conversationId: selectedConversation.id,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: MessageItem;
      };

      if (payload.message) {
        setLocalMessages((current) =>
          current.map((message) =>
            message.id === optimisticMessage.id ? payload.message! : message,
          ),
        );
      }

      if (!response.ok) {
        setLocalMessages((current) =>
          payload.message
            ? current
            : current.filter((message) => message.id !== optimisticMessage.id),
        );
        return {
          errorMessage:
            payload.error ?? "No se pudo enviar el mensaje por YCloud.",
        };
      }

      if (!payload.message) {
        setLocalMessages((current) =>
          current.filter((message) => message.id !== optimisticMessage.id),
        );
        return { errorMessage: "El mensaje se envió pero la respuesta vino vacía." };
      }

      return { errorMessage: "" };
    }

    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({
        body,
        contact_id: selectedConversation.contactId ?? null,
        conversation_id: selectedConversation.id,
        direction,
        message_type: "text",
        role,
        status: "stored",
        workspace_id: selectedConversation.workspaceId,
      })
      .select("id, conversation_id, body, direction, role, message_type, media_url, metadata, created_at")
      .single();

    if (insertError) {
      setLocalMessages((current) =>
        current.filter((message) => message.id !== optimisticMessage.id),
      );
      return { errorMessage: insertError.message };
    }

    if (direction !== "internal") {
      await supabase
        .from("conversations")
        .update({ last_message_at: data.created_at })
        .eq("id", selectedConversation.id)
        .eq("workspace_id", selectedConversation.workspaceId);
    }

    setLocalMessages((current) =>
      current.map((message) => (message.id === optimisticMessage.id ? data : message)),
    );
    return { errorMessage: "" };
  }

  async function handleSend(formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();

    if (!body) {
      return;
    }

    setDraft("");
    setIsSending(true);
    void insertMessage({
      body,
      direction: "outbound",
      role: "human",
    }).then(({ errorMessage }) => {
      if (errorMessage) {
        setError(errorMessage);
        setDraft(body);
      }

      setIsSending(false);
    });
  }

  async function handleReviewAction(action: "approve" | "reject" | "unblock") {
    if (!selectedConversation?.workspaceId) {
      return;
    }

    const reviewId = selectedConversation.contactMetadata?.pending_review?.id;
    if (action !== "unblock" && !reviewId) {
      return;
    }

    setError("");
    setReviewAction(action);
    const response = await clientFetch("/api/flows/review", {
      body: JSON.stringify({
        action,
        contactId: selectedConversation.contactId,
        reviewId,
        workspaceId: selectedConversation.workspaceId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo procesar la decisión.");
    } else {
      setLocalConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? {
                ...conversation,
                aiEnabled: false,
                contactMetadata: {
                  ...conversation.contactMetadata,
                  messaging_status: action === "unblock" ? "active" : conversation.contactMetadata?.messaging_status,
                  pending_review: undefined,
                },
                rawStatus: "pending_handoff",
                status: "Handoff",
              }
            : conversation,
        ),
      );
    }

    setReviewAction("");
  }

  async function handleAddToFlow() {
    if (
      !selectedConversation?.workspaceId ||
      !selectedConversation.contactId ||
      activeRole === "viewer"
    ) {
      return;
    }

    if (
      selectedConversation.onboarding &&
      pendingOnboardingStatuses.has(selectedConversation.onboarding.status) &&
      !window.confirm("Este contacto ya está en onboarding. ¿Reiniciar desde el primer paso?")
    ) {
      return;
    }

    setError("");
    setNotice("");
    setFlowAction("start");
    const response = await clientFetch("/api/flows/start", {
      body: JSON.stringify({
        contactId: selectedConversation.contactId,
        conversationId: selectedConversation.id,
        workspaceId: selectedConversation.workspaceId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as {
      currentStepId?: string | null;
      delivered?: boolean;
      error?: string;
      flowId?: string;
      flowName?: string;
      runId?: string;
      runStatus?: string;
    };

    if (!response.ok || !payload.flowId || !payload.runId) {
      setError(payload.error ?? "No se pudo agregar el contacto al flujo.");
      setFlowAction("");
      return;
    }

    setLocalConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              aiEnabled: false,
              contactMetadata: {
                ...conversation.contactMetadata,
                automation_labels: Array.from(
                  new Set([
                    ...(conversation.contactMetadata?.automation_labels ?? []).filter(
                      (label) =>
                        ![
                          "blocked_invalid_answers",
                          "onboarding_completed",
                          "onboarding_excluded_existing",
                          "onboarding_review_pending",
                        ].includes(label),
                    ),
                    "onboarding_eligible",
                  ]),
                ),
                messaging_status: "active",
                pending_review: undefined,
              },
              onboarding: {
                completedSteps: 0,
                currentStepId: payload.currentStepId,
                flowId: payload.flowId!,
                runId: payload.runId!,
                stageLabel: "Inicio",
                status: payload.runStatus ?? "waiting",
                totalSteps: 0,
              },
              rawStatus: "open",
              status: "Onboarding",
            }
          : conversation,
      ),
    );
    setInboxView("onboarding");
    setSelectedConversationId(selectedConversation.id);
    setNotice(
      payload.delivered
        ? `${payload.flowName ?? "Flujo"} iniciado. Primer mensaje enviado.`
        : `${payload.flowName ?? "Flujo"} iniciado. El mensaje quedó en cola.`,
    );
    setFlowAction("");
  }

  async function handleRemoveFromFlow() {
    if (
      !selectedConversation?.workspaceId ||
      !selectedConversation.contactId ||
      activeRole === "viewer"
    ) {
      return;
    }

    if (
      !window.confirm(
        "¿Sacar a este contacto del flujo? Se cancelan los mensajes pendientes y la conversación pasa a una persona.",
      )
    ) {
      return;
    }

    setError("");
    setNotice("");
    setFlowAction("stop");
    const response = await clientFetch("/api/flows/stop", {
      body: JSON.stringify({
        contactId: selectedConversation.contactId,
        conversationId: selectedConversation.id,
        workspaceId: selectedConversation.workspaceId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as {
      error?: string;
      reason?: string;
      runIds?: string[];
    };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo sacar al contacto del flujo.");
      setFlowAction("");
      return;
    }

    setLocalConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              aiEnabled: false,
              contactMetadata: {
                ...conversation.contactMetadata,
                automation_labels: Array.from(
                  new Set([
                    ...(conversation.contactMetadata?.automation_labels ?? []).filter(
                      (label) =>
                        ![
                          "blocked_invalid_answers",
                          "onboarding_eligible",
                          "onboarding_review_pending",
                        ].includes(label),
                    ),
                    "flow_opt_out",
                  ]),
                ),
                flow_opt_out: {
                  at: new Date().toISOString(),
                  reason: payload.reason,
                },
                pending_review: undefined,
              },
              onboarding: conversation.onboarding
                ? { ...conversation.onboarding, status: "transferred" }
                : undefined,
              rawStatus: "pending_handoff",
              status: "Handoff",
            }
          : conversation,
      ),
    );
    setInboxView("handoff");
    setSelectedConversationId(selectedConversation.id);
    setNotice("Contacto fuera del flujo. La conversación quedó con una persona.");
    setFlowAction("");
  }

  async function handleInternalNote(formData: FormData) {
    const body = String(formData.get("note") ?? "").trim();

    if (!body) {
      return;
    }

    setNoteDraft("");
    setIsSavingNote(true);
    void insertMessage({
      body,
      direction: "internal",
      role: "human",
    }).then(({ errorMessage }) => {
      if (errorMessage) {
        setError(errorMessage);
        setNoteDraft(body);
      }

      setIsSavingNote(false);
    });
  }

  async function updateConversation(next: {
    aiEnabled?: boolean;
    rawStatus?: string;
    status?: string;
  }) {
    if (!selectedConversation || !canSend) {
      return;
    }

    setError("");
    resetPollingRef.current();
    const previous = selectedConversation;

    // Al encender o apagar la IA la conversacion cambia de pestana; sin esto
    // desaparecia de la vista y parecia que se habia perdido.
    if (next.aiEnabled !== undefined && next.aiEnabled !== previous.aiEnabled) {
      setInboxView(next.aiEnabled ? "ai" : "handoff");
    }

    setLocalConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              aiEnabled: next.aiEnabled ?? conversation.aiEnabled,
              rawStatus: next.rawStatus ?? conversation.rawStatus,
              status: next.status ?? conversation.status,
            }
          : conversation,
      ),
    );

    void supabase
      .from("conversations")
      .update({
        ...(next.aiEnabled !== undefined ? { ai_enabled: next.aiEnabled } : {}),
        ...(next.rawStatus ? { status: next.rawStatus } : {}),
      })
      .eq("id", selectedConversation.id)
      .eq("workspace_id", selectedConversation.workspaceId)
      .then(({ error: updateError }) => {
        if (updateError) {
          setLocalConversations((current) =>
            current.map((conversation) =>
              conversation.id === selectedConversation.id ? previous : conversation,
            ),
          );
          setError(updateError.message);
        }
      });
  }

  return (
    <div className="grid overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-[minmax(430px,calc(100vh-260px))_auto] xl:h-[calc(100vh-260px)] xl:min-h-[430px] xl:grid-cols-[260px_minmax(0,1fr)_240px] xl:grid-rows-1 2xl:grid-cols-[280px_minmax(0,1fr)_260px]">
      <div className="flex max-h-[50vh] min-h-0 flex-col border-b border-line lg:max-h-none lg:border-b-0 lg:border-r">
        <div
          className="grid shrink-0 grid-cols-3 gap-1 border-b border-line bg-white p-2"
          data-tour="inbox-tabs"
        >
          <button
            className={`flex min-h-9 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-xs font-semibold transition 2xl:flex-row 2xl:gap-1.5 2xl:px-2 ${
              inboxView === "ai"
                ? "bg-ink text-white"
                : "bg-paper-2 text-ink-2 hover:bg-line"
            }`}
            onClick={() => selectInboxView("ai")}
            type="button"
          >
            <Bot className="hidden shrink-0 2xl:block" size={14} />
            <span className="truncate">
              <span className="2xl:hidden">Con IA</span>
              <span className="hidden 2xl:inline">Respondiendo IA</span>
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                inboxView === "ai" ? "bg-white/15" : "bg-white text-ink-2"
              }`}
            >
              {aiConversations.length}
            </span>
          </button>
          <button
            className={`flex min-h-9 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-xs font-semibold transition 2xl:flex-row 2xl:gap-1.5 2xl:px-2 ${
              inboxView === "handoff"
                ? "bg-[#8a5a12] text-white"
                : "bg-paper-2 text-ink-2 hover:bg-line"
            }`}
            onClick={() => selectInboxView("handoff")}
            type="button"
          >
            <Hand className="hidden shrink-0 2xl:block" size={14} />
            <span className="truncate">Handoff</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                inboxView === "handoff" ? "bg-white/15" : "bg-white text-ink-2"
              }`}
            >
              {handoffConversations.length}
            </span>
          </button>
          <button
            className={`flex min-h-9 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-xs font-semibold transition 2xl:flex-row 2xl:gap-1.5 2xl:px-2 ${
              inboxView === "onboarding"
                ? "bg-ink text-white"
                : "bg-paper-2 text-ink-2 hover:bg-line"
            }`}
            onClick={() => selectInboxView("onboarding")}
            type="button"
          >
            <GitBranch className="hidden shrink-0 2xl:block" size={14} />
            <span className="truncate">Onboarding</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                inboxView === "onboarding"
                  ? "bg-white/15"
                  : "bg-white text-ink-2"
              }`}
            >
              {onboardingConversations.length}
            </span>
          </button>
        </div>
        {localConversations.length >= INBOX_CONVERSATION_LIMIT ? (
          // Las pestañas cuentan solo lo cargado; sin esto no cuadran con las métricas.
          <p className="shrink-0 border-b border-line bg-paper-2 px-3 py-1.5 text-[11px] text-muted">
            Se muestran las {INBOX_CONVERSATION_LIMIT} conversaciones más recientes.
          </p>
        ) : null}
        <label className="relative block shrink-0 border-b border-line bg-white px-2 py-2">
          <span className="sr-only">Buscar conversación</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            size={14}
          />
          <input
            className="h-9 w-full rounded-lg border border-line bg-paper-2 pl-8 pr-8 text-sm outline-none transition placeholder:text-faint focus:border-ink focus:bg-white"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por nombre o teléfono"
            type="search"
            value={searchQuery}
          />
          {searchQuery ? (
            <button
              aria-label="Limpiar búsqueda"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              onClick={() => setSearchQuery("")}
              type="button"
            >
              <X size={14} />
            </button>
          ) : null}
        </label>
        <div
          className="min-h-0 flex-1 divide-y divide-line overflow-y-auto"
          data-tour="conversation-list"
        >
        {visibleConversations.map((conversation) => {
          const pendingOnboarding = isPendingOnboarding(conversation);
          const optedOutOfFlow =
            conversation.contactMetadata?.automation_labels?.includes(
              "flow_opt_out",
            ) ?? false;
          const completedOnboarding =
            conversation.onboarding?.status === "completed" ||
            conversation.onboarding?.status === "transferred" ||
            conversation.contactMetadata?.automation_labels?.includes(
              "onboarding_completed",
            );

          return (
          <button
            className={`block w-full px-3 py-2.5 text-left transition hover:bg-paper-2 ${
              conversation.id === selectedConversation?.id ? "bg-yellow-soft" : ""
            }`}
            key={conversation.id}
            onClick={() => setSelectedConversationId(conversation.id)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">
                    {conversation.name}
                  </h3>
                  <span className="rounded-md bg-paper-2 px-1.5 py-0.5 text-[11px] text-ink-2">
                    {conversation.business}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted">
                  {conversation.summary}
                </p>
              </div>
              <span className="shrink-0 text-right text-xs text-muted">
                {conversation.time}
              </span>
            </div>
            <span className="mt-2 inline-flex rounded-md border border-line px-2 py-0.5 text-[11px]">
              {conversation.status}
            </span>
            {inboxView === "handoff" && conversation.handoff ? (
              <span className="ml-1.5 mt-2 inline-flex max-w-full rounded-md bg-[#fdf1dd] px-2 py-0.5 text-[11px] font-medium text-[#8a5a12]">
                {handoffSourceLabel[conversation.handoff.source] ?? "Escalada"}
              </span>
            ) : null}
            {inboxView === "handoff" && conversation.handoff ? (
              <p className="mt-1.5 line-clamp-1 text-[11px] text-muted">
                {conversation.handoff.reason}
              </p>
            ) : null}
            {pendingOnboarding && conversation.onboarding ? (
              <>
                <span className="ml-1.5 mt-2 inline-flex max-w-full rounded-md bg-yellow-soft px-2 py-0.5 text-[11px] font-medium text-ink-2">
                  Onboarding · {conversation.onboarding.stageLabel}
                </span>
                <span
                  className={`ml-1.5 mt-2 inline-flex rounded-md px-2 py-0.5 text-[11px] ${
                    conversation.onboarding.status === "blocked" ||
                    conversation.onboarding.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : conversation.onboarding.status === "review_pending"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-paper-2 text-ink-2"
                  }`}
                >
                  {onboardingStatusLabel(conversation.onboarding.status)}
                </span>
              </>
            ) : optedOutOfFlow ? (
              <span className="ml-1.5 mt-2 inline-flex rounded-md bg-[#f6e9e9] px-2 py-0.5 text-[11px] text-[#8a2f2f]">
                Fuera del flujo
              </span>
            ) : completedOnboarding ? (
              <span className="ml-1.5 mt-2 inline-flex rounded-md bg-paper-2 px-2 py-0.5 text-[11px] text-ink-2">
                Onboarding completado
              </span>
            ) : null}
          </button>
          );
        })}
        {visibleConversations.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center p-5 text-center">
            <div>
              {inboxView === "onboarding" ? (
                <GitBranch className="mx-auto text-faint" size={22} />
              ) : inboxView === "handoff" ? (
                <Hand className="mx-auto text-faint" size={22} />
              ) : (
                <Bot className="mx-auto text-faint" size={22} />
              )}
              <p className="mt-2 text-sm font-semibold text-ink-2">
                {searchQuery
                  ? `Nada coincide con «${searchQuery}»`
                  : inboxView === "onboarding"
                    ? "No hay contactos en onboarding"
                    : inboxView === "handoff"
                      ? "No hay conversaciones esperando a una persona"
                      : "No hay conversaciones con IA activa"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {searchQuery
                  ? "Prueba con otro nombre o con el teléfono."
                  : "Esta vista se actualiza automáticamente."}
              </p>
            </div>
          </div>
        ) : null}
        </div>
      </div>

      <div className="flex min-h-[70vh] min-w-0 flex-col bg-paper-2 lg:min-h-0">
        <div className="border-b border-line bg-white px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="font-semibold">
                {selectedConversation?.name ?? "Selecciona una conversación"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {selectedConversation?.contactPhone ??
                  "Cuando haya mensajes, aparecerán aquí."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-ink bg-white px-3 text-sm font-medium text-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  !canSend ||
                  !selectedConversation?.contactId ||
                  activeRole === "viewer" ||
                  flowAction === "start"
                }
                onClick={handleAddToFlow}
                type="button"
              >
                {flowAction === "start" ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <ListPlus size={16} />
                )}
                Agregar al flujo
              </button>
              {selectedConversation && isPendingOnboarding(selectedConversation) ? (
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e0c3c3] bg-white px-3 text-sm font-medium text-[#8a2f2f] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    !canSend ||
                    !selectedConversation.contactId ||
                    activeRole === "viewer" ||
                    flowAction === "stop"
                  }
                  onClick={handleRemoveFromFlow}
                  type="button"
                >
                  {flowAction === "stop" ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <ListX size={16} />
                  )}
                  Sacar del flujo
                </button>
              ) : null}
              <button
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ${
                  selectedConversation?.aiEnabled
                    ? "bg-yellow-soft text-ink"
                    : "bg-paper-2 text-ink-2"
                }`}
                data-tour="ai-toggle"
                disabled={!canReply}
                onClick={() =>
                  updateConversation({
                    aiEnabled: !selectedConversation?.aiEnabled,
                    rawStatus: !selectedConversation?.aiEnabled
                      ? "open"
                      : "pending_handoff",
                    status: !selectedConversation?.aiEnabled
                      ? "IA activa"
                      : "Handoff",
                  })
                }
                type="button"
              >
                <Bot size={16} />
                {selectedConversation?.aiEnabled ? "IA activa" : "IA apagada"}
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium"
                data-tour="handoff-button"
                disabled={!canReply}
                onClick={() =>
                  updateConversation({
                    aiEnabled: false,
                    rawStatus: "pending_handoff",
                    status: "Handoff",
                  })
                }
                type="button"
              >
                <Hand size={16} />
                Handoff
              </button>
            </div>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
          ref={messageListRef}
        >
          {selectedMessages.length > 0 ? (
            selectedMessages.map((message) => {
              const isOutbound = message.direction === "outbound";
              const isInternal = message.direction === "internal";

              return (
                <div
                  className={`flex ${
                    isInternal ? "justify-center" : isOutbound ? "justify-end" : "justify-start"
                  }`}
                  key={message.id}
                >
                  <div
                    className={`max-w-[78%] rounded-lg border px-3 py-2 text-sm ${
                      isInternal
                        ? "border-amber-200 bg-amber-50 text-amber-950"
                        : isOutbound
                        ? "border-yellow-strong bg-yellow-soft"
                        : "border-line bg-white"
                    }`}
                  >
                    <MessageAttachment message={message} />
                    {message.body ? (
                      <p className="whitespace-pre-wrap">{message.body}</p>
                    ) : message.media_url ? null : (
                      <p className="italic text-muted">
                        {messageTypeLabel(message.message_type)}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-muted">
                                  <span>{isInternal ? "nota interna" : message.role}</span>
                      <span>
                        {message.displayTime ?? stableTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex h-full min-h-[260px] items-center justify-center text-center text-sm text-muted">
              <div>
                <MessageSquareText className="mx-auto mb-3 text-faint" />
                <p className="font-medium text-ink">
                  {selectedConversation
                    ? "Esta conversación aún no tiene mensajes."
                    : "Elige una conversación de la lista para ver sus mensajes."}
                </p>
              </div>
            </div>
          )}
        </div>

        <form
          action={handleSend}
          className="border-t border-line bg-white p-3"
          data-tour="composer"
        >
          {error ? (
            <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {notice}
            </p>
          ) : null}
          {calendarIssue ? (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="font-semibold">El agente no pudo agendar:</span>{" "}
              {calendarIssue}
            </p>
          ) : null}
          <div className="flex gap-2">
            <input
              className="h-11 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-yellow/50 disabled:bg-paper-2"
              disabled={!canReply}
              name="body"
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                isBlocked
                  ? "Toda atención está bloqueada"
                  : canSend
                  ? "Escribe una respuesta manual..."
                  : "Selecciona una conversación real"
              }
              value={draft}
            />
            <button
              aria-label="Enviar mensaje"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-yellow shadow-[inset_0_0_0_1.5px_var(--color-ink)] text-ink disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canReply || draft.trim().length === 0}
              title="Enviar"
              type="submit"
            >
              {isSending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <SendHorizonal size={18} />
              )}
            </button>
          </div>
        </form>

        <form
          action={handleInternalNote}
          className="border-t border-line bg-paper-2 p-3"
          data-tour="internal-note"
        >
          <div className="flex gap-2">
            <input
              className="h-10 min-w-0 flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm outline-none transition placeholder:text-amber-700/70 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:bg-paper-2"
              disabled={!canSend}
              name="note"
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Nota interna: no se envía al contacto"
              value={noteDraft}
            />
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 text-sm font-medium text-amber-900 disabled:cursor-not-allowed disabled:bg-paper-2"
              disabled={!canSend || noteDraft.trim().length === 0}
              type="submit"
            >
              {isSavingNote ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <NotebookPen size={16} />
              )}
              Nota
            </button>
          </div>
        </form>
      </div>

      <aside
        className="min-h-0 border-t border-line bg-white p-4 lg:col-span-2 xl:col-span-1 xl:overflow-y-auto xl:border-l xl:border-t-0"
        data-tour="contact-panel"
      >
        <div className="flex items-center gap-2">
          <UserRound className="text-ink" size={18} />
          <h3 className="text-sm font-semibold">Contacto</h3>
        </div>
        <div className="mt-4 rounded-lg border border-line p-3">
          <p className="font-semibold">
            {selectedConversation?.name ?? "Sin selección"}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Phone size={14} />
            {selectedConversation?.contactPhone ?? "Sin teléfono"}
          </p>
          <p className="mt-2 text-xs text-muted">
            Workspace: {selectedConversation?.business ?? "-"}
          </p>
          {selectedConversation?.contactMetadata?.flow_progress ? (
            <div className="mt-3 rounded-lg border border-line-strong bg-yellow-soft p-3">
              <p className="text-[11px] font-semibold uppercase text-muted">
                Etapa actual
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="rounded-lg bg-ink px-2 py-1 text-xs font-semibold text-white">
                  {selectedConversation.contactMetadata.flow_progress.currentStageLabel ??
                    selectedConversation.contactMetadata.flow_progress.currentStageKey ??
                    "Inicio"}
                </span>
                <span className="text-xs font-semibold text-ink">
                  {selectedConversation.contactMetadata.flow_progress.completedSteps ?? 0}/
                  {selectedConversation.contactMetadata.flow_progress.totalSteps ?? 0} checks
                </span>
              </div>
            </div>
          ) : null}
          {selectedConversation?.contactMetadata?.pending_review ? (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase text-amber-900">
                Respuesta pendiente de revisión
              </p>
              <p className="mt-2 text-sm font-medium">
                {selectedConversation.contactMetadata.pending_review.question}
              </p>
              <p className="mt-2 rounded-lg bg-white p-2 text-sm">
                {selectedConversation.contactMetadata.pending_review.original_answer}
              </p>
              <p className="mt-2 text-xs text-amber-900">
                {selectedConversation.contactMetadata.pending_review.validation_reason}
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Intento {selectedConversation.contactMetadata.pending_review.attempt_count}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="h-9 rounded-lg bg-ink px-3 text-xs font-semibold text-paper disabled:opacity-60"
                  disabled={Boolean(reviewAction)}
                  onClick={() => handleReviewAction("approve")}
                  type="button"
                >
                  Aprobar y continuar
                </button>
                <button
                  className="h-9 rounded-lg border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-950 disabled:opacity-60"
                  disabled={Boolean(reviewAction)}
                  onClick={() => handleReviewAction("reject")}
                  type="button"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ) : null}
          {isBlocked ? (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase text-red-800">
                Toda atención bloqueada
              </p>
              <p className="mt-1 text-xs text-red-700">
                El contacto agotó los intentos de respuestas válidas. Los mensajes
                entrantes se guardan, pero no se envía ninguna respuesta.
              </p>
              {activeRole === "owner" || activeRole === "admin" ? (
                <button
                  className="mt-3 h-9 rounded-lg border border-red-300 bg-white px-3 text-xs font-semibold text-red-800 disabled:opacity-60"
                  disabled={Boolean(reviewAction)}
                  onClick={() => handleReviewAction("unblock")}
                  type="button"
                >
                  Desbloquear en handoff
                </button>
              ) : null}
            </div>
          ) : null}
          {selectedConversation?.contactMetadata?.ai_summary ? (
            <div className="mt-3 rounded-lg bg-paper-2 p-2 text-sm text-ink-2">
              {selectedConversation.contactMetadata.ai_summary}
            </div>
          ) : null}
          {selectedConversation?.contactMetadata?.ai_tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedConversation.contactMetadata.ai_tags.map((tag) => (
                <span
                  className="rounded-lg bg-yellow-soft px-2 py-1 text-xs text-ink"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {selectedConversation?.contactMetadata?.automation_labels?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedConversation.contactMetadata.automation_labels.map((label) => (
                <span
                  className="rounded-lg border border-line bg-white px-2 py-1 text-xs text-ink-2"
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          {selectedConversation?.contactId ? (
            <ContactCrmSummary contactId={selectedConversation.contactId} />
          ) : null}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <CircleDollarSign className="text-ink" size={18} />
          <h3 className="text-sm font-semibold">Observabilidad</h3>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ["Tokens", stableNumber(selectedTokenTotal)],
            ["Costo", `$${selectedCostTotal.toFixed(4)}`],
            ["Entrantes", String(inboundCount)],
            ["Salientes", String(outboundCount)],
            ["Notas", String(internalCount)],
            ["Eventos", String(selectedUsageEvents.length)],
          ].map(([label, value]) => (
            <div className="rounded-lg border border-line p-3" key={label}>
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Clock3 className="text-ink" size={18} />
          <h3 className="text-sm font-semibold">Eventos IA</h3>
        </div>
        <div className="mt-3 grid gap-2">
          {selectedUsageEvents.length > 0 ? (
            selectedUsageEvents.slice(0, 4).map((event) => (
              <div
                className="rounded-lg border border-line p-3 text-sm"
                key={event.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{event.provider}</span>
                  <span className="text-xs text-muted">
                    ${Number(event.cost_usd ?? 0).toFixed(4)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {event.model ?? "sin modelo"} ·{" "}
                  {event.displayTokenTotal ??
                    stableNumber(
                      Number(
                        event.total_tokens ??
                          event.input_tokens + event.output_tokens,
                      ),
                    )}{" "}
                  tokens
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-line p-3 text-sm text-muted">
              Aún no hay eventos de IA para esta conversación.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <MessageSquareText className="text-ink" size={18} />
          <h3 className="text-sm font-semibold">Webhooks</h3>
        </div>
        <div className="mt-3 grid gap-2">
          {webhookEvents.length > 0 ? (
            webhookEvents.slice(0, 4).map((event) => (
              <div
                className="rounded-lg border border-line p-3 text-sm"
                key={event.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{event.event_type}</span>
                  <span
                    className={`rounded-lg px-2 py-1 text-xs ${
                      event.status === "stored"
                        ? "bg-yellow-soft text-ink"
                        : event.status === "error"
                        ? "bg-red-50 text-red-700"
                        : "bg-paper-2 text-ink-2"
                    }`}
                  >
                    {event.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {event.provider} -{" "}
                  {event.displayTime ?? stableTime(event.created_at)}
                </p>
                {event.error ? (
                  <p className="mt-2 text-xs text-red-700">{event.error}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-line p-3 text-sm text-muted">
              Sin webhooks recibidos aún.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
