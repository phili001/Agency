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
  NotebookPen,
  Phone,
  SendHorizonal,
  UserRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

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
    ghl_contact_id?: string;
    ghl_last_error?: string;
    ghl_synced_at?: string;
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

function isPendingOnboarding(conversation: ConversationItem) {
  return Boolean(
    conversation.onboarding &&
      pendingOnboardingStatuses.has(conversation.onboarding.status),
  );
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
  message_type: string;
  metadata?: { calendar_unavailable_reason?: string | null } | null;
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
  messages: MessageItem[];
  usageEvents: UsageEventItem[];
  webhookEvents: WebhookEventItem[];
  workspaceId: string | null;
};

export function InboxPanel({
  activeRole,
  conversations,
  messages,
  usageEvents,
  webhookEvents,
  workspaceId,
}: InboxPanelProps) {
  const supabase = createClient();
  const [localConversations, setLocalConversations] = useState(conversations);
  const [selectedConversationId, setSelectedConversationId] = useState(
    conversations[0]?.id ?? "",
  );
  const [inboxView, setInboxView] = useState<InboxView>("ai");
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
  const visibleConversations = conversationsByView[inboxView];
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

  function stableDateTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}-${String(date.getUTCDate()).padStart(2, "0")} ${stableTime(value)}`;
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

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let cancelled = false;

    async function refreshSnapshot() {
      // Se pide explicitamente la conversacion abierta: el backend solo carga
      // los mensajes de esa, para que el inbox no dependa de cuantos miles de
      // mensajes tenga el workspace.
      const query = new URLSearchParams({ workspaceId: workspaceId! });

      if (openConversationId) {
        query.set("conversationId", openConversationId);
      }

      const response = await fetch(`/api/inbox/snapshot?${query.toString()}`);

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        conversations?: ConversationItem[];
        messages?: MessageItem[];
        messagesConversationId?: string | null;
      };

      if (cancelled) {
        return;
      }

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

    const interval = window.setInterval(refreshSnapshot, 3500);
    void refreshSnapshot();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
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

    if (direction === "outbound") {
      const response = await fetch("/api/messages/send", {
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
        return { errorMessage: "El mensaje se envio pero la respuesta vino vacia." };
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
      .select("id, conversation_id, body, direction, role, message_type, created_at")
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
    const response = await fetch("/api/flows/review", {
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
      setError(payload.error ?? "No se pudo procesar la decision.");
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
      !window.confirm("Este contacto ya esta en onboarding. Reiniciar desde el primer paso?")
    ) {
      return;
    }

    setError("");
    setNotice("");
    setFlowAction("start");
    const response = await fetch("/api/flows/start", {
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
        : `${payload.flowName ?? "Flujo"} iniciado. El mensaje quedo en cola.`,
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
        "Sacar a este contacto del flujo? Se cancelan los mensajes pendientes y la conversación pasa a una persona.",
      )
    ) {
      return;
    }

    setError("");
    setNotice("");
    setFlowAction("stop");
    const response = await fetch("/api/flows/stop", {
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
    setNotice("Contacto fuera del flujo. La conversación quedo con una persona.");
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
    <div className="grid overflow-hidden xl:h-[calc(100vh-260px)] xl:min-h-[430px] xl:grid-cols-[320px_1fr_300px]">
      <div className="flex max-h-[50vh] min-h-0 flex-col border-b border-[#e2e6df] xl:max-h-none xl:border-b-0 xl:border-r">
        <div className="grid shrink-0 grid-cols-3 gap-1 border-b border-[#e2e6df] bg-white p-2">
          <button
            className={`flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${
              inboxView === "ai"
                ? "bg-[#10231c] text-white"
                : "bg-[#f3f4ef] text-[#4d5a51] hover:bg-[#e8ece5]"
            }`}
            onClick={() => selectInboxView("ai")}
            type="button"
          >
            <Bot size={14} />
            <span className="truncate">Respondiendo IA</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                inboxView === "ai" ? "bg-white/15" : "bg-white text-[#4d5a51]"
              }`}
            >
              {aiConversations.length}
            </span>
          </button>
          <button
            className={`flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${
              inboxView === "handoff"
                ? "bg-[#8a5a12] text-white"
                : "bg-[#f3f4ef] text-[#4d5a51] hover:bg-[#e8ece5]"
            }`}
            onClick={() => selectInboxView("handoff")}
            type="button"
          >
            <Hand size={14} />
            <span className="truncate">Handoff</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                inboxView === "handoff" ? "bg-white/15" : "bg-white text-[#4d5a51]"
              }`}
            >
              {handoffConversations.length}
            </span>
          </button>
          <button
            className={`flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${
              inboxView === "onboarding"
                ? "bg-[#35735b] text-white"
                : "bg-[#f3f4ef] text-[#4d5a51] hover:bg-[#e8ece5]"
            }`}
            onClick={() => selectInboxView("onboarding")}
            type="button"
          >
            <GitBranch size={14} />
            <span className="truncate">Onboarding</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                inboxView === "onboarding"
                  ? "bg-white/15"
                  : "bg-white text-[#4d5a51]"
              }`}
            >
              {onboardingConversations.length}
            </span>
          </button>
        </div>
        <div className="min-h-0 flex-1 divide-y divide-[#edf0ea] overflow-y-auto">
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
            className={`block w-full px-3 py-2.5 text-left transition hover:bg-[#f6f7f3] ${
              conversation.id === selectedConversation?.id ? "bg-[#eef6df]" : ""
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
                  <span className="rounded-md bg-[#eef2eb] px-1.5 py-0.5 text-[11px] text-[#4d5a51]">
                    {conversation.business}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-[#5d685f]">
                  {conversation.summary}
                </p>
              </div>
              <span className="shrink-0 text-right text-xs text-[#7a847c]">
                {conversation.time}
              </span>
            </div>
            <span className="mt-2 inline-flex rounded-md border border-[#d9ded3] px-2 py-0.5 text-[11px]">
              {conversation.status}
            </span>
            {inboxView === "handoff" && conversation.handoff ? (
              <span className="ml-1.5 mt-2 inline-flex max-w-full rounded-md bg-[#fdf1dd] px-2 py-0.5 text-[11px] font-medium text-[#8a5a12]">
                {handoffSourceLabel[conversation.handoff.source] ?? "Escalada"}
              </span>
            ) : null}
            {inboxView === "handoff" && conversation.handoff ? (
              <p className="mt-1.5 line-clamp-1 text-[11px] text-[#7a847c]">
                {conversation.handoff.reason}
              </p>
            ) : null}
            {pendingOnboarding && conversation.onboarding ? (
              <>
                <span className="ml-1.5 mt-2 inline-flex max-w-full rounded-md bg-[#dff0e5] px-2 py-0.5 text-[11px] font-medium text-[#285844]">
                  Onboarding · {conversation.onboarding.stageLabel}
                </span>
                <span
                  className={`ml-1.5 mt-2 inline-flex rounded-md px-2 py-0.5 text-[11px] ${
                    conversation.onboarding.status === "blocked" ||
                    conversation.onboarding.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : conversation.onboarding.status === "review_pending"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-[#eef2eb] text-[#4d5a51]"
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
              <span className="ml-1.5 mt-2 inline-flex rounded-md bg-[#eef2eb] px-2 py-0.5 text-[11px] text-[#4d5a51]">
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
                <GitBranch className="mx-auto text-[#a8b0aa]" size={22} />
              ) : inboxView === "handoff" ? (
                <Hand className="mx-auto text-[#a8b0aa]" size={22} />
              ) : (
                <Bot className="mx-auto text-[#a8b0aa]" size={22} />
              )}
              <p className="mt-2 text-sm font-semibold text-[#4d5a51]">
                {inboxView === "onboarding"
                  ? "No hay contactos en onboarding"
                  : inboxView === "handoff"
                    ? "No hay conversaciones esperando a una persona"
                    : "No hay conversaciones con IA activa"}
              </p>
              <p className="mt-1 text-xs text-[#7a847c]">
                Esta vista se actualiza automáticamente.
              </p>
            </div>
          </div>
        ) : null}
        </div>
      </div>

      <div className="flex min-h-[70vh] min-w-0 flex-col bg-[#fafbf8] xl:min-h-0">
        <div className="border-b border-[#e2e6df] bg-white px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="font-semibold">
                {selectedConversation?.name ?? "Selecciona una conversación"}
              </p>
              <p className="mt-1 text-sm text-[#647067]">
                {selectedConversation?.contactPhone ??
                  "Cuando haya mensajes, apareceran aquí."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#35735b] bg-white px-3 text-sm font-medium text-[#245943] disabled:cursor-not-allowed disabled:opacity-50"
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
                    ? "bg-[#e7f6ce] text-[#31521d]"
                    : "bg-[#eef2eb] text-[#4d5a51]"
                }`}
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
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium"
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
                        ? "border-[#b7d889] bg-[#e7f6ce]"
                        : "border-[#d9ded3] bg-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">
                      {message.body ?? `[${message.message_type}] mensaje sin texto`}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-[#647067]">
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
            <div className="flex h-full min-h-[260px] items-center justify-center text-center text-sm text-[#647067]">
              <div>
                <MessageSquareText className="mx-auto mb-3 text-[#a8b0aa]" />
                <p className="font-medium text-[#20231f]">
                  No hay mensajes para esta conversación.
                </p>
                <p className="mt-1">
                  Revisa que el seed haya insertado filas en `public.messages`.
                </p>
              </div>
            </div>
          )}
        </div>

        <form
          action={handleSend}
          className="border-t border-[#e2e6df] bg-white p-3"
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
              className="h-11 min-w-0 flex-1 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none transition focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50 disabled:bg-[#f3f4ef]"
              disabled={!canReply}
              name="body"
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                isBlocked
                  ? "Toda atención esta bloqueada"
                  : canSend
                  ? "Escribe una respuesta manual..."
                  : "Selecciona una conversación real"
              }
              value={draft}
            />
            <button
              aria-label="Enviar mensaje"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#10231c] text-white disabled:cursor-not-allowed disabled:bg-[#9aa59e]"
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
          className="border-t border-[#edf0ea] bg-[#fbfcf8] p-3"
        >
          <div className="flex gap-2">
            <input
              className="h-10 min-w-0 flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm outline-none transition placeholder:text-amber-700/70 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:bg-[#f3f4ef]"
              disabled={!canSend}
              name="note"
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Nota interna: no se envia al contacto"
              value={noteDraft}
            />
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 text-sm font-medium text-amber-900 disabled:cursor-not-allowed disabled:bg-[#f3f4ef]"
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

      <aside className="min-h-0 border-t border-[#e2e6df] bg-white p-4 xl:overflow-y-auto xl:border-l xl:border-t-0">
        <div className="flex items-center gap-2">
          <UserRound className="text-[#35735b]" size={18} />
          <h3 className="text-sm font-semibold">Contacto</h3>
        </div>
        <div className="mt-4 rounded-lg border border-[#e2e6df] p-3">
          <p className="font-semibold">
            {selectedConversation?.name ?? "Sin selección"}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#647067]">
            <Phone size={14} />
            {selectedConversation?.contactPhone ?? "Sin teléfono"}
          </p>
          <p className="mt-2 text-xs text-[#7a847c]">
            Workspace: {selectedConversation?.business ?? "-"}
          </p>
          {selectedConversation?.contactMetadata?.flow_progress ? (
            <div className="mt-3 rounded-lg border border-[#b9d3c3] bg-[#f3f8ed] p-3">
              <p className="text-[11px] font-semibold uppercase text-[#647067]">
                Etapa actual
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="rounded-lg bg-[#35735b] px-2 py-1 text-xs font-semibold text-white">
                  {selectedConversation.contactMetadata.flow_progress.currentStageLabel ??
                    selectedConversation.contactMetadata.flow_progress.currentStageKey ??
                    "Inicio"}
                </span>
                <span className="text-xs font-semibold text-[#31521d]">
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
                  className="h-9 rounded-lg bg-[#10231c] px-3 text-xs font-semibold text-white disabled:opacity-60"
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
                El contacto agoto los intentos de respuestas validas. Los mensajes
                entrantes se guardan, pero no se envia ninguna respuesta.
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
            <div className="mt-3 rounded-lg bg-[#fafbf8] p-2 text-sm text-[#4d5a51]">
              {selectedConversation.contactMetadata.ai_summary}
            </div>
          ) : null}
          {selectedConversation?.contactMetadata?.ai_tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedConversation.contactMetadata.ai_tags.map((tag) => (
                <span
                  className="rounded-lg bg-[#e7f6ce] px-2 py-1 text-xs text-[#31521d]"
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
                  className="rounded-lg border border-[#cbd2c6] bg-white px-2 py-1 text-xs text-[#4d5a51]"
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          {selectedConversation?.contactMetadata?.ghl_contact_id ||
          selectedConversation?.contactMetadata?.ghl_last_error ? (
            <div className="mt-3 rounded-lg border border-[#e2e6df] p-2 text-xs text-[#647067]">
              <p className="font-semibold text-[#20231f]">GoHighLevel</p>
              {selectedConversation.contactMetadata.ghl_contact_id ? (
                <p className="mt-1 break-all">
                  ID: {selectedConversation.contactMetadata.ghl_contact_id}
                </p>
              ) : null}
              {selectedConversation.contactMetadata.ghl_synced_at ? (
                <p className="mt-1">
                  Sync:{" "}
                  {stableDateTime(selectedConversation.contactMetadata.ghl_synced_at)}
                </p>
              ) : null}
              {selectedConversation.contactMetadata.ghl_last_error ? (
                <p className="mt-1 text-red-700">
                  {selectedConversation.contactMetadata.ghl_last_error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <CircleDollarSign className="text-[#35735b]" size={18} />
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
            <div className="rounded-lg border border-[#e2e6df] p-3" key={label}>
              <p className="text-xs text-[#647067]">{label}</p>
              <p className="mt-1 text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Clock3 className="text-[#35735b]" size={18} />
          <h3 className="text-sm font-semibold">Eventos IA</h3>
        </div>
        <div className="mt-3 grid gap-2">
          {selectedUsageEvents.length > 0 ? (
            selectedUsageEvents.slice(0, 4).map((event) => (
              <div
                className="rounded-lg border border-[#e2e6df] p-3 text-sm"
                key={event.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{event.provider}</span>
                  <span className="text-xs text-[#647067]">
                    ${Number(event.cost_usd ?? 0).toFixed(4)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#647067]">
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
            <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
              Aun no hay eventos de IA para esta conversación.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <MessageSquareText className="text-[#35735b]" size={18} />
          <h3 className="text-sm font-semibold">Webhooks</h3>
        </div>
        <div className="mt-3 grid gap-2">
          {webhookEvents.length > 0 ? (
            webhookEvents.slice(0, 4).map((event) => (
              <div
                className="rounded-lg border border-[#e2e6df] p-3 text-sm"
                key={event.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{event.event_type}</span>
                  <span
                    className={`rounded-lg px-2 py-1 text-xs ${
                      event.status === "stored"
                        ? "bg-[#e7f6ce] text-[#31521d]"
                        : event.status === "error"
                        ? "bg-red-50 text-red-700"
                        : "bg-[#eef2eb] text-[#4d5a51]"
                    }`}
                  >
                    {event.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#647067]">
                  {event.provider} -{" "}
                  {event.displayTime ?? stableTime(event.created_at)}
                </p>
                {event.error ? (
                  <p className="mt-2 text-xs text-red-700">{event.error}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
              Sin webhooks recibidos aun.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
