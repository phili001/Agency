"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CircleDollarSign,
  Clock3,
  GitBranch,
  Hand,
  ListPlus,
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

type InboxView = "conversations" | "onboarding";

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
      return "Revision";
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
  const [inboxView, setInboxView] = useState<InboxView>("conversations");
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
  const visibleConversations =
    inboxView === "onboarding" ? onboardingConversations : regularConversations;
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
  const selectedMessages = selectedConversation
    ? messagesByConversation[selectedConversation.id] ?? []
    : [];
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
    Boolean(selectedConversation?.workspaceId) &&
    Boolean(selectedConversation?.id) &&
    !selectedConversation?.id.startsWith("mock-");
  const isBlocked =
    selectedConversation?.contactMetadata?.messaging_status === "blocked";
  const canReply = canSend && !isBlocked;

  function selectInboxView(nextView: InboxView) {
    const nextConversations =
      nextView === "onboarding"
        ? onboardingConversations
        : regularConversations;
    setInboxView(nextView);
    setSelectedConversationId(nextConversations[0]?.id ?? "");
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

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let cancelled = false;

    async function refreshSnapshot() {
      const response = await fetch(
        `/api/inbox/snapshot?workspaceId=${encodeURIComponent(workspaceId!)}`,
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        conversations?: ConversationItem[];
        messages?: MessageItem[];
      };

      if (cancelled) {
        return;
      }

      if (payload.conversations?.length) {
        setLocalConversations(payload.conversations);
        setSelectedConversationId((current) => current || payload.conversations?.[0]?.id || "");
      }

      if (payload.messages) {
        setLocalMessages((current) => {
          const localPending = current.filter((message) => message.id.startsWith("local-"));
          return [...payload.messages!, ...localPending];
        });
      }
    }

    const interval = window.setInterval(refreshSnapshot, 3500);
    void refreshSnapshot();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [workspaceId]);

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
      return { errorMessage: "Selecciona una conversacion real." };
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
    <div className="grid h-[calc(100vh-260px)] min-h-[430px] overflow-hidden xl:grid-cols-[320px_1fr_300px]">
      <div className="flex min-h-0 flex-col border-b border-[#e2e6df] lg:border-b-0 lg:border-r">
        <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-[#e2e6df] bg-white p-2">
          <button
            className={`flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${
              inboxView === "conversations"
                ? "bg-[#10231c] text-white"
                : "bg-[#f3f4ef] text-[#4d5a51] hover:bg-[#e8ece5]"
            }`}
            onClick={() => selectInboxView("conversations")}
            type="button"
          >
            <MessageSquareText size={14} />
            <span className="truncate">Conversaciones</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                inboxView === "conversations"
                  ? "bg-white/15"
                  : "bg-white text-[#4d5a51]"
              }`}
            >
              {regularConversations.length}
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
              ) : (
                <MessageSquareText className="mx-auto text-[#a8b0aa]" size={22} />
              )}
              <p className="mt-2 text-sm font-semibold text-[#4d5a51]">
                {inboxView === "onboarding"
                  ? "No hay contactos en onboarding"
                  : "No hay conversaciones normales"}
              </p>
              <p className="mt-1 text-xs text-[#7a847c]">
                Esta vista se actualiza automaticamente.
              </p>
            </div>
          </div>
        ) : null}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col bg-[#fafbf8]">
        <div className="border-b border-[#e2e6df] bg-white px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="font-semibold">
                {selectedConversation?.name ?? "Selecciona una conversacion"}
              </p>
              <p className="mt-1 text-sm text-[#647067]">
                {selectedConversation?.contactPhone ??
                  "Cuando haya mensajes, apareceran aqui."}
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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
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
                  No hay mensajes para esta conversacion.
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
          <div className="flex gap-2">
            <input
              className="h-11 min-w-0 flex-1 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none transition focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50 disabled:bg-[#f3f4ef]"
              disabled={!canReply}
              name="body"
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                isBlocked
                  ? "Toda atencion esta bloqueada"
                  : canSend
                  ? "Escribe una respuesta manual..."
                  : "Selecciona una conversacion real"
              }
              value={draft}
            />
            <button
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

      <aside className="min-h-0 overflow-y-auto border-t border-[#e2e6df] bg-white p-4 xl:border-l xl:border-t-0">
        <div className="flex items-center gap-2">
          <UserRound className="text-[#35735b]" size={18} />
          <h3 className="text-sm font-semibold">Contacto</h3>
        </div>
        <div className="mt-4 rounded-lg border border-[#e2e6df] p-3">
          <p className="font-semibold">
            {selectedConversation?.name ?? "Sin seleccion"}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#647067]">
            <Phone size={14} />
            {selectedConversation?.contactPhone ?? "Sin telefono"}
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
                Respuesta pendiente de revision
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
                Toda atencion bloqueada
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
              Aun no hay eventos de IA para esta conversacion.
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
