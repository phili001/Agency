import "server-only";

import { NextResponse } from "next/server";

import { hashSecret } from "@/lib/integrations/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

type WebhookPayload = Record<string, unknown>;

type NormalizedYCloudEvent = {
  businessPhone: string | null;
  contactEmail: string | null;
  contactName: string | null;
  eventType: string;
  externalId: string | null;
  fromPhone: string | null;
  messageType: "text" | "audio" | "image" | "file" | "event";
  messageText: string | null;
  phoneId: string | null;
  wabaId: string | null;
};

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
  return {
    businessPhone: normalizePhone(
      readPath(payload, [
        ["to"],
        ["phone"],
        ["phoneNumber"],
        ["businessPhone"],
        ["whatsappInboundMessage", "to"],
        ["whatsappMessage", "to"],
        ["message", "to"],
        ["data", "to"],
        ["data", "phone"],
        ["data", "phoneNumber"],
        ["data", "businessPhone"],
        ["data", "message", "to"],
        ["data", "whatsappInboundMessage", "to"],
        ["data", "whatsappMessage", "to"],
        ["data", "object", "metadata", "display_phone_number"],
      ]),
    ),
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
    eventType:
      readPath(payload, [
        ["type"],
        ["event"],
        ["event_type"],
        ["data", "type"],
        ["data", "event"],
      ]) ?? "ycloud.webhook",
    externalId: readPath(payload, [
      ["id"],
      ["messageId"],
      ["whatsappInboundMessage", "id"],
      ["whatsappMessage", "id"],
      ["message", "id"],
      ["data", "id"],
      ["data", "message", "id"],
      ["data", "whatsappInboundMessage", "id"],
      ["data", "whatsappMessage", "id"],
      ["data", "object", "messages", "0", "id"],
    ]),
    fromPhone: normalizePhone(
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
    ),
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

export async function handleYCloudWebhook(
  request: Request,
  workspaceId: string,
  secretOverride?: string,
) {
  const payload = (await request.json()) as WebhookPayload;
  const event = normalizeEvent(payload);
  const supabase = createAdminClient();
  const receivedSecret = secretOverride ?? getReceivedSecret(request);
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
    } else if (event.fromPhone) {
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id, full_name, email, metadata")
        .eq("workspace_id", resolvedWorkspaceId)
        .eq("phone_e164", event.fromPhone)
        .maybeSingle();
      const existingMetadata = getMetadataRecord(existingContact?.metadata);
      const ycloudMetadata = getMetadataRecord(existingMetadata.ycloud);
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .upsert(
          {
            email: event.contactEmail ?? existingContact?.email ?? null,
            full_name: event.contactName ?? existingContact?.full_name ?? null,
            metadata: {
              ...existingMetadata,
              source: existingMetadata.source ?? "ycloud",
              ycloud: {
                ...ycloudMetadata,
                business_phone: event.businessPhone ?? ycloudMetadata.business_phone,
                contact_email: event.contactEmail ?? ycloudMetadata.contact_email,
                contact_name: event.contactName ?? ycloudMetadata.contact_name,
                external_id: event.externalId,
                last_event_type: event.eventType,
                phone_id: event.phoneId ?? ycloudMetadata.phone_id,
                raw_from: event.fromPhone,
                updated_at: new Date().toISOString(),
                waba_id: event.wabaId ?? ycloudMetadata.waba_id,
              },
            },
            phone_e164: event.fromPhone,
            workspace_id: resolvedWorkspaceId,
          },
          { onConflict: "workspace_id,phone_e164" },
        )
        .select("id")
        .single();

      if (contactError) {
        throw contactError;
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

      const { data: message, error: messageError } = await supabase
        .from("messages")
        .insert({
          body: event.messageText,
          contact_id: contact.id,
          conversation_id: conversationId,
          direction: "inbound",
          message_type: event.messageText ? "text" : event.messageType,
          metadata: {
            raw_event_type: event.eventType,
            ycloud_message_type: event.messageType,
          },
          provider_message_id: event.externalId,
          role: event.messageText ? "user" : "system",
          status: "stored",
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
