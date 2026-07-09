"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  CircleDollarSign,
  Clock3,
  Hand,
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
    ghl_contact_id?: string;
    ghl_last_error?: string;
    ghl_synced_at?: string;
  } | null;
  contactPhone?: string | null;
  id: string;
  name: string;
  rawStatus?: string;
  status: string;
  summary: string;
  time: string;
  workspaceId?: string | null;
};

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
  conversations: ConversationItem[];
  messages: MessageItem[];
  usageEvents: UsageEventItem[];
  webhookEvents: WebhookEventItem[];
};

export function InboxPanel({
  conversations,
  messages,
  usageEvents,
  webhookEvents,
}: InboxPanelProps) {
  const supabase = createClient();
  const [localConversations, setLocalConversations] = useState(conversations);
  const [selectedConversationId, setSelectedConversationId] = useState(
    conversations[0]?.id ?? "",
  );
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isUpdatingConversation, setIsUpdatingConversation] = useState(false);
  const [localMessages, setLocalMessages] = useState<MessageItem[]>(messages);
  const selectedConversation =
    localConversations.find(
      (conversation) => conversation.id === selectedConversationId,
    ) ?? localConversations[0];
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
    setLocalMessages((current) => [...current, message]);
  }

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

      if (!response.ok || !payload.message) {
        setLocalMessages((current) =>
          current.filter((message) => message.id !== optimisticMessage.id),
        );
        return {
          errorMessage:
            payload.error ?? "No se pudo enviar el mensaje por YCloud.",
        };
      }

      setLocalMessages((current) =>
        current.map((message) =>
          message.id === optimisticMessage.id ? payload.message! : message,
        ),
      );
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
    const { errorMessage } = await insertMessage({
      body,
      direction: "outbound",
      role: "human",
    });

    if (errorMessage) {
      setError(errorMessage);
      setDraft(body);
    }

    setIsSending(false);
  }

  async function handleInternalNote(formData: FormData) {
    const body = String(formData.get("note") ?? "").trim();

    if (!body) {
      return;
    }

    setNoteDraft("");
    setIsSavingNote(true);
    const { errorMessage } = await insertMessage({
      body,
      direction: "internal",
      role: "human",
    });

    if (errorMessage) {
      setError(errorMessage);
      setNoteDraft(body);
    }

    setIsSavingNote(false);
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
    setIsUpdatingConversation(true);

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

    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        ...(next.aiEnabled !== undefined ? { ai_enabled: next.aiEnabled } : {}),
        ...(next.rawStatus ? { status: next.rawStatus } : {}),
      })
      .eq("id", selectedConversation.id)
      .eq("workspace_id", selectedConversation.workspaceId);

    if (updateError) {
      setLocalConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id ? previous : conversation,
        ),
      );
      setError(updateError.message);
    }

    setIsUpdatingConversation(false);
  }

  return (
    <div className="grid min-h-[430px] xl:grid-cols-[320px_1fr_300px]">
      <div className="divide-y divide-[#edf0ea] border-b border-[#e2e6df] lg:border-b-0 lg:border-r">
        {localConversations.map((conversation) => (
          <button
            className={`block w-full px-4 py-4 text-left transition hover:bg-[#f6f7f3] ${
              conversation.id === selectedConversation?.id ? "bg-[#eef6df]" : ""
            }`}
            key={conversation.id}
            onClick={() => setSelectedConversationId(conversation.id)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold">{conversation.name}</h3>
                  <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
                    {conversation.business}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-[#5d685f]">
                  {conversation.summary}
                </p>
              </div>
              <span className="shrink-0 text-right text-xs text-[#7a847c]">
                {conversation.time}
              </span>
            </div>
            <span className="mt-3 inline-flex rounded-lg border border-[#d9ded3] px-2.5 py-1 text-xs">
              {conversation.status}
            </span>
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-col bg-[#fafbf8]">
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
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ${
                  selectedConversation?.aiEnabled
                    ? "bg-[#e7f6ce] text-[#31521d]"
                    : "bg-[#eef2eb] text-[#4d5a51]"
                }`}
                disabled={!canSend || isUpdatingConversation}
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
                disabled={!canSend || isUpdatingConversation}
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

        <div className="flex-1 space-y-3 p-4">
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
          <div className="flex gap-2">
            <input
              className="h-11 min-w-0 flex-1 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none transition focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50 disabled:bg-[#f3f4ef]"
              disabled={!canSend || isSending}
              name="body"
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                canSend
                  ? "Escribe una respuesta manual..."
                  : "Selecciona una conversacion real"
              }
              value={draft}
            />
            <button
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#10231c] text-white disabled:cursor-not-allowed disabled:bg-[#9aa59e]"
              disabled={!canSend || isSending || draft.trim().length === 0}
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
              disabled={!canSend || isSavingNote}
              name="note"
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Nota interna: no se envia al contacto"
              value={noteDraft}
            />
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 text-sm font-medium text-amber-900 disabled:cursor-not-allowed disabled:bg-[#f3f4ef]"
              disabled={!canSend || isSavingNote || noteDraft.trim().length === 0}
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

      <aside className="border-t border-[#e2e6df] bg-white p-4 xl:border-l xl:border-t-0">
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
