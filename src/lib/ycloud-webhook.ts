import "server-only";

import { NextResponse } from "next/server";

import { normalizeAppUrl } from "@/lib/app-url";
import { handleInboundFlow } from "@/lib/flow-engine";
import { syncContactToGoHighLevel } from "@/lib/integrations/gohighlevel";
import { hashSecret } from "@/lib/integrations/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

type WebhookPayload = Record<string, unknown>;

type NormalizedYCloudEvent = {
  businessPhone: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactName: string | null;
  direction: "inbound" | "outbound";
  eventType: string;
  externalId: string | null;
  providerMessageId: string | null;
  fromPhone: string | null;
  isStatusUpdate: boolean;
  messageType: "text" | "audio" | "image" | "file" | "event";
  status: string | null;
  messageText: string | null;
  phoneId: string | null;
  wabaId: string | null;
};

const AI_BUFFER_DELAY_MS = 20_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runConversationAiBuffer({
  appBaseUrl,
  conversationId,
  workspaceId,
}: {
  appBaseUrl: string;
  conversationId: string;
  workspaceId: string;
}) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return;
  }

  try {
    await sleep(AI_BUFFER_DELAY_MS);

    const baseUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL || appBaseUrl);
    const params = new URLSearchParams({
      conversationId,
      secret: cronSecret,
      workspaceId,
    });

    await fetch(`${baseUrl}/api/cron/buffer?${params.toString()}`, {
      cache: "no-store",
      method: "POST",
    });
    await fetch(`${baseUrl}/api/cron/deliver?${params.toString()}`, {
      cache: "no-store",
      method: "POST",
    });
  } catch (error) {
    console.error("No se pudo ejecutar el buffer IA.", error);
  }
}

async function runConversationDelivery({
  appBaseUrl,
  conversationId,
  workspaceId,
}: {
  appBaseUrl: string;
  conversationId: string;
  workspaceId: string;
}) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return;
  }

  try {
    const baseUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL || appBaseUrl);
    const params = new URLSearchParams({
      conversationId,
      secret: cronSecret,
      workspaceId,
    });

    await fetch(`${baseUrl}/api/cron/deliver?${params.toString()}`, {
      cache: "no-store",
      method: "POST",
    });
  } catch (error) {
    console.error("No se pudo ejecutar entrega de mensajes.", error);
  }
}

function readPath(value: unknown, paths: string[][]) {
  for (const path of paths) {
    let current = value;

    for (const key of path) {
      if (!current || typeof current !== "object" || !(key in current)) {
        current = undefined;
        break;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (current !== undefined && current !== null && current !== "") {
      return String(current);
    }
  }

  return null;
}

function normalizeMessageType(value: string | null): NormalizedYCloudEvent["messageType"] {
  switch (value?.toLowerCase()) {
    case "audio":
    case "image":
    case "file":
    case "text":
      return value.toLowerCase() as NormalizedYCloudEvent["messageType"];
    case "document":
      return "file";
    default:
      return "event";
  }
}

function normalizePhone(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

function normalizeEvent(payload: WebhookPayload): NormalizedYCloudEvent {
  const eventType =
    readPath(payload, [
      ["type"],
      ["event"],
      ["event_type"],
      ["data", "type"],
      ["data", "event"],
    ]) ?? "ycloud.webhook";
  const normalizedEventType = eventType.toLowerCase();
  const statusValue = readPath(payload, [
    ["status"],
    ["whatsappInboundMessage", "status"],
    ["whatsappMessage", "status"],
    ["message", "status"],
    ["data", "status"],
    ["data", "message", "status"],
    ["data", "whatsappInboundMessage", "status"],
    ["data", "whatsappMessage", "status"],
  ]);
  const isStatusUpdate =
    normalizedEventType.includes("message.updated") ||
    normalizedEventType.includes("status") ||
    ["sent", "delivered", "read", "failed"].includes(statusValue?.toLowerCase() ?? "");
  const isOutboundEcho =
    normalizedEventType.includes("echo") || isStatusUpdate;
  const inboundFromPhone = normalizePhone(
    readPath(payload, [
      ["from"],
      ["whatsappInboundMessage", "from"],
      ["whatsappMessage", "from"],
      ["message", "from"],
      ["data", "from"],
      ["data", "message", "from"],
      ["data", "whatsappInboundMessage", "from"],
      ["data", "whatsappInboundMessage", "customerProfile", "whatsapp"],
      ["data", "whatsappMessage", "from"],
      ["data", "whatsappMessage", "customerProfile", "whatsapp"],
      ["data", "object", "messages", "0", "from"],
      ["data", "object", "contacts", "0", "wa_id"],
    ]),
  );
  const toPhone = normalizePhone(
    readPath(payload, [
      ["to"],
      ["whatsappInboundMessage", "to"],
      ["whatsappMessage", "to"],
      ["message", "to"],
      ["data", "to"],
      ["data", "message", "to"],
      ["data", "whatsappInboundMessage", "to"],
      ["data", "whatsappMessage", "to"],
    ]),
  );
  const businessPhone = isOutboundEcho ? inboundFromPhone : toPhone;
  const contactPhone = isOutboundEcho ? toPhone : inboundFromPhone;

  return {
    businessPhone,
    contactPhone,
    contactEmail: readPath(payload, [
      ["contact", "email"],
      ["customer", "email"],
      ["customerProfile", "email"],
      ["whatsappInboundMessage", "customerProfile", "email"],
      ["whatsappMessage", "customerProfile", "email"],
      ["message", "customerProfile", "email"],
      ["data", "contact", "email"],
      ["data", "customer", "email"],
      ["data", "customerProfile", "email"],
      ["data", "message", "customerProfile", "email"],
      ["data", "whatsappInboundMessage", "customerProfile", "email"],
      ["data", "whatsappMessage", "customerProfile", "email"],
    ]),
    contactName: readPath(payload, [
      ["fromName"],
      ["profileName"],
      ["contact", "name"],
      ["contact", "displayName"],
      ["customer", "name"],
      ["customerProfile", "name"],
      ["contacts", "0", "profile", "name"],
      ["whatsappInboundMessage", "fromName"],
      ["whatsappInboundMessage", "profileName"],
      ["whatsappInboundMessage", "customerProfile", "name"],
      ["whatsappMessage", "fromName"],
      ["whatsappMessage", "profileName"],
      ["whatsappMessage", "customerProfile", "name"],
      ["message", "fromName"],
      ["message", "profileName"],
      ["message", "customerProfile", "name"],
      ["data", "fromName"],
      ["data", "profileName"],
      ["data", "contact", "name"],
      ["data", "contact", "displayName"],
      ["data", "customer", "name"],
      ["data", "customerProfile", "name"],
      ["data", "contacts", "0", "profile", "name"],
      ["data", "message", "fromName"],
      ["data", "message", "profileName"],
      ["data", "message", "customerProfile", "name"],
      ["data", "whatsappInboundMessage", "fromName"],
      ["data", "whatsappInboundMessage", "profileName"],
      ["data", "whatsappInboundMessage", "customerProfile", "name"],
      ["data", "whatsappMessage", "fromName"],
      ["data", "whatsappMessage", "profileName"],
      ["data", "whatsappMessage", "customerProfile", "name"],
      ["data", "object", "contacts", "0", "profile", "name"],
    ]),
    direction: isOutboundEcho ? "outbound" : "inbound",
    eventType,
    externalId: readPath(payload, [
      ["whatsappInboundMessage", "wamid"],
      ["whatsappMessage", "wamid"],
      ["message", "wamid"],
      ["data", "message", "wamid"],
      ["data", "whatsappInboundMessage", "wamid"],
      ["data", "whatsappMessage", "wamid"],
      ["wamid"],
      ["messageId"],
      ["id"],
      ["whatsappInboundMessage", "messageId"],
      ["whatsappMessage", "messageId"],
      ["message", "messageId"],
      ["data", "messageId"],
      ["data", "message", "messageId"],
      ["data", "whatsappInboundMessage", "messageId"],
      ["data", "whatsappMessage", "messageId"],
      ["whatsappInboundMessage", "id"],
      ["whatsappMessage", "id"],
      ["message", "id"],
      ["data", "id"],
      ["data", "message", "id"],
      ["data", "whatsappInboundMessage", "id"],
      ["data", "whatsappMessage", "id"],
      ["data", "object", "messages", "0", "id"],
    ]),
    providerMessageId: readPath(payload, [
      ["whatsappInboundMessage", "wamid"],
      ["whatsappMessage", "wamid"],
      ["message", "wamid"],
      ["data", "message", "wamid"],
      ["data", "whatsappInboundMessage", "wamid"],
      ["data", "whatsappMessage", "wamid"],
      ["wamid"],
      ["messageId"],
      ["whatsappInboundMessage", "messageId"],
      ["whatsappMessage", "messageId"],
      ["message", "messageId"],
      ["data", "messageId"],
      ["data", "message", "messageId"],
      ["data", "whatsappInboundMessage", "messageId"],
      ["data", "whatsappMessage", "messageId"],
      ["whatsappInboundMessage", "id"],
      ["whatsappMessage", "id"],
      ["message", "id"],
      ["data", "id"],
      ["data", "message", "id"],
      ["data", "whatsappInboundMessage", "id"],
      ["data", "whatsappMessage", "id"],
      ["data", "object", "messages", "0", "id"],
    ]),
    fromPhone: inboundFromPhone,
    isStatusUpdate,
    messageType: normalizeMessageType(
      readPath(payload, [
        ["type"],
        ["whatsappInboundMessage", "type"],
        ["whatsappMessage", "type"],
        ["message", "type"],
        ["data", "type"],
        ["data", "message", "type"],
        ["data", "whatsappInboundMessage", "type"],
        ["data", "whatsappMessage", "type"],
        ["data", "object", "messages", "0", "type"],
      ]),
    ),
    messageText: readPath(payload, [
      ["whatsappInboundMessage", "interactive", "list_reply", "id"],
      ["whatsappInboundMessage", "interactive", "button_reply", "id"],
      ["message", "interactive", "list_reply", "id"],
      ["message", "interactive", "button_reply", "id"],
      ["data", "message", "interactive", "list_reply", "id"],
      ["data", "message", "interactive", "button_reply", "id"],
      ["data", "whatsappInboundMessage", "interactive", "list_reply", "id"],
      ["data", "whatsappInboundMessage", "interactive", "button_reply", "id"],
      ["text"],
      ["text", "body"],
      ["whatsappInboundMessage", "text", "body"],
      ["whatsappMessage", "text", "body"],
      ["message", "text"],
      ["message", "text", "body"],
      ["data", "text"],
      ["data", "text", "body"],
      ["data", "message", "text"],
      ["data", "message", "text", "body"],
      ["data", "whatsappInboundMessage", "text", "body"],
      ["data", "whatsappMessage", "text", "body"],
      ["data", "object", "messages", "0", "text", "body"],
    ]),
    status: statusValue,
    phoneId: readPath(payload, [
      ["phoneId"],
      ["phone_id"],
      ["whatsappInboundMessage", "phoneId"],
      ["whatsappMessage", "phoneId"],
      ["message", "phoneId"],
      ["data", "phoneId"],
      ["data", "phone_id"],
      ["data", "message", "phoneId"],
      ["data", "whatsappInboundMessage", "phoneId"],
      ["data", "whatsappMessage", "phoneId"],
      ["data", "object", "metadata", "phone_number_id"],
    ]),
    wabaId: readPath(payload, [
      ["wabaId"],
      ["waba_id"],
      ["whatsappBusinessAccountId"],
      ["whatsappInboundMessage", "wabaId"],
      ["whatsappInboundMessage", "waba_id"],
      ["whatsappMessage", "wabaId"],
      ["whatsappMessage", "waba_id"],
      ["data", "wabaId"],
      ["data", "waba_id"],
      ["data", "whatsappBusinessAccountId"],
      ["data", "whatsappInboundMessage", "wabaId"],
      ["data", "whatsappInboundMessage", "waba_id"],
      ["data", "whatsappMessage", "wabaId"],
      ["data", "whatsappMessage", "waba_id"],
    ]),
  };
}

function getMetadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanDisplayName(value: string | null | undefined) {
  const cleanValue = value?.replace(/\s+/g, " ").trim();

  return cleanValue || null;
}

function pickBestContactName({
  currentName,
  incomingName,
  phone,
}: {
  currentName?: string | null;
  incomingName?: string | null;
  phone: string;
}) {
  const current = cleanDisplayName(currentName);
  const incoming = cleanDisplayName(incomingName);

  if (!incoming) {
    return current;
  }

  if (!current || current === phone) {
    return incoming;
  }

  const currentWordCount = current.split(" ").filter(Boolean).length;
  const incomingWordCount = incoming.split(" ").filter(Boolean).length;

  if (
    incoming.length > current.length ||
    incomingWordCount > currentWordCount ||
    current.toLowerCase().includes(incoming.toLowerCase())
  ) {
    return incoming;
  }

  return current;
}

function getReceivedSecret(request: Request) {
  return (
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-ycloud-webhook-secret") ??
    new URL(request.url).searchParams.get("secret")
  );
}

function looksLikeCompanyCode(value: string) {
  return /^[A-Z]{3}[0-9]{3}$/.test(value.toUpperCase());
}

function normalizeMessageStatus(value: string | null) {
  switch (value?.toLowerCase()) {
    case "delivered":
    case "failed":
    case "read":
    case "sent":
      return value.toLowerCase();
    default:
      return null;
  }
}

async function storeYCloudMessage({
  event,
  resolvedWorkspaceId,
  supabase,
}: {
  event: NormalizedYCloudEvent;
  resolvedWorkspaceId: string;
  supabase: ReturnType<typeof createAdminClient>;
}): Promise<{ contactId: string; conversationId: string; shouldStartAiBuffer: boolean }> {
  if (!event.contactPhone) {
    throw new Error("El webhook no incluye telefono de contacto.");
  }

  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id, full_name, email, metadata, automation_labels, messaging_status")
    .eq("workspace_id", resolvedWorkspaceId)
    .eq("phone_e164", event.contactPhone)
    .maybeSingle();
  const existingMetadata = getMetadataRecord(existingContact?.metadata);
  const ycloudMetadata = getMetadataRecord(existingMetadata.ycloud);
  const bestContactName = pickBestContactName({
    currentName:
      existingContact?.full_name ??
      (typeof ycloudMetadata.contact_name === "string"
        ? ycloudMetadata.contact_name
        : null),
    incomingName: event.contactName,
    phone: event.contactPhone,
  });
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .upsert(
      {
        email: event.contactEmail ?? existingContact?.email ?? null,
        full_name: bestContactName,
        metadata: {
          ...existingMetadata,
          source: existingMetadata.source ?? "ycloud",
          ycloud: {
            ...ycloudMetadata,
            business_phone: event.businessPhone ?? ycloudMetadata.business_phone,
            contact_email: event.contactEmail ?? ycloudMetadata.contact_email,
            contact_name: bestContactName ?? ycloudMetadata.contact_name,
            last_received_name: cleanDisplayName(event.contactName),
            external_id: event.externalId,
            last_event_type: event.eventType,
            phone_id: event.phoneId ?? ycloudMetadata.phone_id,
            raw_from: event.fromPhone,
            raw_to: event.businessPhone,
            updated_at: new Date().toISOString(),
            waba_id: event.wabaId ?? ycloudMetadata.waba_id,
          },
        },
        automation_labels:
          existingContact?.automation_labels ?? ["onboarding_eligible"],
        messaging_status: existingContact?.messaging_status ?? "active",
        phone_e164: event.contactPhone,
        workspace_id: resolvedWorkspaceId,
      },
      { onConflict: "workspace_id,phone_e164" },
    )
    .select("id")
    .single();

  if (contactError) {
    throw contactError;
  }

  if (event.direction === "inbound") {
    // El contacto entra a GHL desde su primer mensaje. El upsert usa telefono,
    // evita duplicados y guarda el ghl_contact_id; un fallo de GHL queda en el
    // metadata local sin impedir que WhatsApp continue procesandose.
    await syncContactToGoHighLevel({
      contactId: contact.id,
      workspaceId: resolvedWorkspaceId,
    });
  }

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("workspace_id", resolvedWorkspaceId)
    .eq("contact_id", contact.id)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const conversationId =
    existingConversation?.id ??
    (
      await supabase
        .from("conversations")
        .insert({
          contact_id: contact.id,
          external_conversation_id: event.externalId,
          last_message_at: new Date().toISOString(),
          ai_enabled: false,
          status: "pending_handoff",
          workspace_id: resolvedWorkspaceId,
        })
        .select("id")
        .single()
    ).data?.id;

  if (!conversationId) {
    throw new Error("No se pudo crear la conversacion.");
  }

  const messageProviderId = event.providerMessageId ?? event.externalId;
  let { data: existingMessage } = messageProviderId
    ? await supabase
        .from("messages")
        .select("id, created_at, metadata")
        .eq("workspace_id", resolvedWorkspaceId)
        .eq("provider_message_id", messageProviderId)
        .maybeSingle()
    : { data: null };

  if (!existingMessage && event.direction === "outbound" && event.messageText) {
    const since = new Date(Date.now() - 1000 * 60 * 10).toISOString();
    const { data: matchingMessages } = await supabase
      .from("messages")
      .select("id, created_at, metadata")
      .eq("workspace_id", resolvedWorkspaceId)
      .eq("conversation_id", conversationId)
      .eq("direction", "outbound")
      .eq("body", event.messageText)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);

    existingMessage = matchingMessages?.[0] ?? null;

    if (existingMessage && messageProviderId) {
      await supabase
        .from("messages")
        .update({
          metadata: {
            ...(existingMessage.metadata ?? {}),
            deduped_from_ycloud_status: event.status,
            raw_event_type: event.eventType,
          },
          provider_message_id: messageProviderId,
          status: normalizeMessageStatus(event.status) ?? "sent",
        })
        .eq("id", existingMessage.id)
        .eq("workspace_id", resolvedWorkspaceId);
    }
  }

  if (existingMessage) {
    await supabase
      .from("conversations")
      .update({ last_message_at: existingMessage.created_at })
      .eq("id", conversationId)
      .eq("workspace_id", resolvedWorkspaceId);

    return { contactId: contact.id, conversationId, shouldStartAiBuffer: false };
  }

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      body: event.messageText,
      contact_id: contact.id,
      conversation_id: conversationId,
      direction: event.direction,
      message_type: event.messageText ? "text" : event.messageType,
      metadata: {
        raw_event_type: event.eventType,
        ycloud_message_type: event.messageType,
        ycloud_status: event.status,
      },
      provider_message_id: messageProviderId,
      role:
        event.direction === "outbound"
          ? "human"
          : event.messageText
            ? "user"
            : "system",
      status:
        event.direction === "outbound"
          ? normalizeMessageStatus(event.status) ?? "sent"
          : "stored",
      workspace_id: resolvedWorkspaceId,
    })
    .select("id, created_at")
    .single();

  if (messageError) {
    throw messageError;
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: message.created_at })
    .eq("id", conversationId)
    .eq("workspace_id", resolvedWorkspaceId);

  return {
    contactId: contact.id,
    conversationId,
    shouldStartAiBuffer:
      event.direction === "inbound" &&
      Boolean(event.messageText?.trim()) &&
      (existingContact?.messaging_status ?? "active") !== "blocked",
  };
}

export async function handleYCloudWebhook(
  request: Request,
  workspaceId: string,
  secretOverride?: string,
) {
  const payload = (await request.json()) as WebhookPayload;
  const event = normalizeEvent(payload);
  const appBaseUrl = new URL(request.url).origin;
  const supabase = createAdminClient();
  const receivedSecret = (secretOverride ?? getReceivedSecret(request))?.trim();
  const normalizedIdentifier = workspaceId.trim();
  const workspaceQuery = looksLikeCompanyCode(normalizedIdentifier)
    ? await supabase
        .from("workspaces")
        .select("id, company_code")
        .eq("company_code", normalizedIdentifier.toUpperCase())
        .maybeSingle()
    : await supabase
        .from("workspaces")
        .select("id, company_code")
        .eq("id", normalizedIdentifier)
        .maybeSingle();
  const resolvedWorkspaceId = workspaceQuery.data?.id ?? workspaceId;
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, workspace_id, config")
    .eq("provider", "ycloud")
    .eq("workspace_id", resolvedWorkspaceId)
    .maybeSingle();
  const integrationConfig = getMetadataRecord(integration?.config);
  const expectedWebhookHash =
    typeof integrationConfig.webhook_secret_hash === "string"
      ? integrationConfig.webhook_secret_hash
      : null;

  if (!integration || !expectedWebhookHash) {
    return NextResponse.json(
      { error: "Webhook no autorizado. YCloud no esta conectado para esta empresa." },
      { status: 401 },
    );
  }

  if (!receivedSecret) {
    return NextResponse.json(
      { error: "Webhook no autorizado. Falta el secreto en la URL o header." },
      { status: 401 },
    );
  }

  if (hashSecret(receivedSecret) !== expectedWebhookHash) {
    return NextResponse.json(
      { error: "Webhook no autorizado. El secreto no coincide con esta empresa." },
      { status: 401 },
    );
  }

  const configPhone = normalizePhone(String(integrationConfig.phone_e164 ?? ""));
  const identifierMatches =
    (event.phoneId && integrationConfig.phone_id === event.phoneId) ||
    (event.wabaId && integrationConfig.waba_id === event.wabaId) ||
    (event.businessPhone && configPhone === event.businessPhone) ||
    (!event.phoneId && !event.wabaId && !event.businessPhone);
  let status: "stored" | "ignored" | "error" = "ignored";
  let errorMessage: string | null = null;

  try {
    if (!identifierMatches) {
      errorMessage = "El webhook no coincide con el numero configurado para esta empresa.";
    } else if (event.isStatusUpdate) {
      const providerIds = [
        event.providerMessageId,
        event.externalId,
      ].filter(Boolean) as string[];
      const nextStatus = normalizeMessageStatus(event.status);
      let updated = false;

      if (providerIds.length > 0 && nextStatus) {
        let { data: existingMessages } = await supabase
          .from("messages")
          .select("id, conversation_id, metadata")
          .eq("workspace_id", resolvedWorkspaceId)
          .in("provider_message_id", providerIds)
          .limit(1);
        if (!existingMessages?.length) {
          const { data } = await supabase
            .from("messages")
            .select("id, conversation_id, metadata")
            .eq("workspace_id", resolvedWorkspaceId)
            .or(
              providerIds
                .flatMap((id) => [
                  `metadata->>provider_wamid.eq.${id}`,
                  `metadata->ycloud_response->>wamid.eq.${id}`,
                  `metadata->ycloud_response->>whatsappMessageId.eq.${id}`,
                ])
                .join(","),
            )
            .limit(1);

          existingMessages = data;
        }
        const existingMessage = existingMessages?.[0];

        if (existingMessage) {
          await supabase
            .from("messages")
            .update({
              metadata: {
                ...(existingMessage.metadata ?? {}),
                raw_event_type: event.eventType,
                ycloud_status: event.status,
              },
              status: nextStatus,
            })
            .eq("id", existingMessage.id)
            .eq("workspace_id", resolvedWorkspaceId);

          updated = true;
        }
      }

      if (!updated && event.direction === "outbound" && event.messageText && event.contactPhone) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("id")
          .eq("workspace_id", resolvedWorkspaceId)
          .eq("phone_e164", event.contactPhone)
          .maybeSingle();

        if (contact) {
          const since = new Date(Date.now() - 1000 * 60 * 10).toISOString();
          const { data: matchingMessages } = await supabase
            .from("messages")
            .select("id, metadata")
            .eq("workspace_id", resolvedWorkspaceId)
            .eq("contact_id", contact.id)
            .eq("direction", "outbound")
            .eq("body", event.messageText)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(1);
          const matchingMessage = matchingMessages?.[0];

          if (matchingMessage && nextStatus) {
            await supabase
              .from("messages")
              .update({
                metadata: {
                  ...(matchingMessage.metadata ?? {}),
                  deduped_from_ycloud_status: event.status,
                  raw_event_type: event.eventType,
                },
                provider_message_id: event.providerMessageId ?? event.externalId,
                status: nextStatus,
              })
              .eq("id", matchingMessage.id)
              .eq("workspace_id", resolvedWorkspaceId);

            updated = true;
          }
        }
      }

      if (updated) {
        status = "stored";
      } else if (event.messageText && event.contactPhone) {
        const storedMessage = await storeYCloudMessage({
          event,
          resolvedWorkspaceId,
          supabase,
        });
        if (storedMessage.shouldStartAiBuffer) {
          const flowResult = await handleInboundFlow({
            context: {
              contactId: storedMessage.contactId,
              conversationId: storedMessage.conversationId,
              inboundText: event.messageText,
              workspaceId: resolvedWorkspaceId,
            },
            supabase,
          });

          if (flowResult.handled) {
            await runConversationDelivery({
              appBaseUrl,
              conversationId: storedMessage.conversationId,
              workspaceId: resolvedWorkspaceId,
            });
          } else {
            await runConversationAiBuffer({
              appBaseUrl,
              conversationId: storedMessage.conversationId,
              workspaceId: resolvedWorkspaceId,
            });
          }
        }
        status = "stored";
      } else {
        status = "ignored";
        errorMessage = "Actualizacion de estado sin mensaje saliente previo en Levi.";
      }
    } else if (event.contactPhone) {
      const storedMessage = await storeYCloudMessage({
        event,
        resolvedWorkspaceId,
        supabase,
      });
      if (storedMessage.shouldStartAiBuffer) {
        const flowResult = await handleInboundFlow({
          context: {
            contactId: storedMessage.contactId,
            conversationId: storedMessage.conversationId,
            inboundText: event.messageText,
            workspaceId: resolvedWorkspaceId,
          },
          supabase,
        });

        if (flowResult.handled) {
          await runConversationDelivery({
            appBaseUrl,
            conversationId: storedMessage.conversationId,
            workspaceId: resolvedWorkspaceId,
          });
        } else {
          await runConversationAiBuffer({
            appBaseUrl,
            conversationId: storedMessage.conversationId,
            workspaceId: resolvedWorkspaceId,
          });
        }
      }
      status = "stored";
    } else {
      errorMessage = "El webhook no incluye telefono de contacto.";
    }
  } catch (error) {
    status = "error";
    errorMessage = error instanceof Error ? error.message : "Error desconocido.";
  }

  await supabase.from("webhook_events").insert({
    error: errorMessage,
    event_type: event.eventType,
    external_id: event.externalId,
    payload,
    provider: "ycloud",
    status,
    workspace_id: resolvedWorkspaceId,
  });

  return NextResponse.json({
    eventType: event.eventType,
    matchedBy: "workspace_route",
    status,
    workspaceCode: workspaceQuery.data?.company_code ?? null,
    workspaceId: resolvedWorkspaceId,
  });
}
